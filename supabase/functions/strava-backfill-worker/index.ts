// supabase/functions/strava-backfill-worker/index.ts — pgmq strava_backfill consumer
// Cron: every 2 minutes (*/2 * * * *)
// Reads strava_backfill messages (one per activity page fetch), fetches from Strava API,
// upserts to training_log, enqueues next page if full (100 activities).
// Checks rolling rate counter: max 90 requests per 15-minute window (Strava's
// documented default app limit is 100 req/15min — stay under it with headroom).

import { serve }        from "https://deno.land/std@0.177.0/http/server.ts"
import { withTelemetry, telemetryHeartbeat } from '../_shared/telemetry.ts'
import { isVerifiedServiceCall } from '../_shared/serviceAuth.ts'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
// v9.465: activity→row mapping is shared with strava-oauth (was duplicated +
// drifting). Enrichment (power/elevation/RPE/clock) lives in the shared mapper.
import { buildTrainingLogRow, resolveProfilePhysiology, enqueueStreamEnrichment, computePowerTSS, fetchStreamEnrichedIds, stripStreamDerived } from '../_shared/stravaActivity.ts'
// v9.466 P1: per-activity streams + detail enrichment (FIT-parity scalars).
import { normalizedPower, decouplingPct, zonesFromHR, wPrimeExhausted } from '../_shared/streamScience.ts'

const RATE_WINDOW_MS = 15 * 60 * 1000   // 15 minutes
const MAX_REQUESTS   = 90               // < Strava's 100/15min app limit (was 600 → 429 risk)
const MAX_READ       = 10  // poison ceiling: dead-letter a message after N reads (VT=120s → ~20min)

async function refreshIfExpired(
  sb: ReturnType<typeof createClient>,
  tokenRow: { expires_at: string; refresh_token: string; user_id: string },
  stravaClientId: string,
  stravaClientSecret: string,
): Promise<string | null> {
  const expiresAt    = new Date(tokenRow.expires_at)
  const fiveMinLater = new Date(Date.now() + 5 * 60 * 1000)
  if (expiresAt > fiveMinLater) return null

  const resp = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id:     stravaClientId,
      client_secret: stravaClientSecret,
      refresh_token: tokenRow.refresh_token,
      grant_type:    "refresh_token",
    }),
  })
  // Throw on a real refresh failure (vs the early `return null` = not yet expired),
  // so the caller can record last_error and stop retrying a revoked token forever.
  const refreshed = await resp.json().catch(() => ({} as Record<string, unknown>))
  if (!resp.ok || !refreshed.access_token) {
    const blob = JSON.stringify(refreshed)
    if (resp.status === 400 || /invalid_grant|revoked|invalid/i.test(blob)) {
      throw new Error("Strava authorization revoked — please reconnect Strava")
    }
    throw new Error(`Strava token refresh failed (${resp.status})`)
  }

  await sb.from("strava_tokens").update({
    access_token:  refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    expires_at:    new Date(refreshed.expires_at * 1000).toISOString(),
    updated_at:    new Date().toISOString(),
  }).eq("user_id", tokenRow.user_id)

  return refreshed.access_token
}

serve(withTelemetry('strava-backfill-worker', async (req) => {

  // ── Heartbeat: proves liveness every 60s ──────────────────────────────
  const stopHeartbeat = telemetryHeartbeat('strava-backfill-worker')
  // stopHeartbeat() on graceful shutdown if needed
  if (req.method === "OPTIONS") return new Response("ok", { status: 200 })
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 })

  // H1 fix: cron-only consumer with service-role token writes. Authorize via
  // constant-time shared secret instead of the forgeable unsigned-JWT role claim.
  // The cron net.http_post must send the x-sporeus-webhook-secret header.
  if (!isVerifiedServiceCall(req)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const supabaseUrl  = Deno.env.get("SUPABASE_URL")!
  const serviceKey   = (Deno.env.get("SPOREUS_SERVICE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!
  const stravaId     = Deno.env.get("STRAVA_CLIENT_ID")     || ""
  const stravaSecret = Deno.env.get("STRAVA_CLIENT_SECRET") || ""
  const sb           = createClient(supabaseUrl, serviceKey)

  // ── Rolling rate check ────────────────────────────────────────────────────
  const { data: rateState } = await sb
    .from("strava_rate_state")
    .select("window_start, req_count")
    .eq("id", 1)
    .single()

  const now         = new Date()
  const windowStart = rateState ? new Date(rateState.window_start) : now
  const windowAge   = now.getTime() - windowStart.getTime()
  const currentReqs = windowAge > RATE_WINDOW_MS ? 0 : (rateState?.req_count || 0)

  if (currentReqs >= MAX_REQUESTS) {
    return new Response(
      JSON.stringify({ skipped: true, reason: "rate_limit", req_count: currentReqs }),
      { headers: { "Content-Type": "application/json" } },
    )
  }

  // Read up to 5 messages (each represents one activity page fetch, VT=120s)
  const { data: msgs, error: readErr } = await sb.rpc("read_strava_backfill", { batch_size: 5, vt: 120 })
  if (readErr) return new Response(JSON.stringify({ error: readErr.message }), { status: 500 })
  if (!msgs?.length) {
    return new Response(JSON.stringify({ synced: 0 }), { headers: { "Content-Type": "application/json" } })
  }

  let totalSynced = 0
  let totalEnriched = 0
  let apiCallsUsed = 0

  for (const row of msgs) {
    const msgId   = row.msg_id as bigint
    const readCt  = (row.read_ct as number) ?? 0
    const payload = row.message as Record<string, unknown>

    // Poison ceiling: a message that keeps failing (revoked token, persistent 5xx,
    // deleted user) would otherwise be re-read forever, blocking consumer capacity.
    // Dead-letter it after MAX_READ reads instead of indefinitely.
    if (readCt >= MAX_READ) {
      // Include kind/external_id so a dead-lettered ENRICH is visible in logs
      // (its stream_enriched_at stays null; only a window re-import re-enqueues).
      console.warn(`strava-backfill-worker: msg ${msgId} read_ct=${readCt} >= MAX_READ — dead-lettering (kind=${payload.kind ?? "page"}${payload.external_id ? ` external_id=${payload.external_id}` : ""})`)
      await sb.rpc("delete_strava_backfill_msg", { p_msg_id: msgId })
      continue
    }

    const userId = payload.user_id as string
    const page   = (payload.page as number) || 1
    const after  = (payload.after as number) || 0

    if (!userId) {
      await sb.rpc("delete_strava_backfill_msg", { p_msg_id: msgId })
      continue
    }

    // Rate check per message
    if (currentReqs + apiCallsUsed >= MAX_REQUESTS) {
      console.warn("strava-backfill-worker: rate limit reached mid-batch — leaving remaining messages")
      break
    }

    try {
      // Fetch fresh access token (handles refresh if expiring)
      const { data: tokenRow, error: tokenErr } = await sb
        .from("strava_tokens")
        .select("access_token, refresh_token, expires_at, user_id")
        .eq("user_id", userId)
        .maybeSingle()

      if (tokenErr || !tokenRow) {
        // Token row gone — discard message
        await sb.rpc("delete_strava_backfill_msg", { p_msg_id: msgId })
        continue
      }

      let accessToken: string
      try {
        const freshToken = await refreshIfExpired(sb, tokenRow, stravaId, stravaSecret)
        accessToken = freshToken || tokenRow.access_token
      } catch (refreshErr) {
        // Revoked / failed refresh: record last_error so the UI can prompt a
        // reconnect (was previously silent — sync health still read "healthy"),
        // and drop the message since retrying a revoked token can never succeed.
        const rmsg = refreshErr instanceof Error ? refreshErr.message : String(refreshErr)
        await sb.from("strava_tokens").update({
          sync_status: "error", last_error: rmsg, updated_at: new Date().toISOString(),
        }).eq("user_id", userId)
        await sb.rpc("delete_strava_backfill_msg", { p_msg_id: msgId })
        continue
      }

      // ── v9.466 P1: 'enrich' message — streams + detail for ONE activity ─────
      if (payload.kind === "enrich") {
        const externalId = String(payload.external_id || "")
        if (!externalId) {
          await sb.rpc("delete_strava_backfill_msg", { p_msg_id: msgId })
          continue
        }
        // Costs 2 API calls — need both within budget or leave for next run.
        if (currentReqs + apiCallsUsed + 2 > MAX_REQUESTS) {
          console.warn("strava-backfill-worker: budget < 2 calls — deferring enrich messages")
          break
        }
        // Row must still exist (user may have deleted the entry — respect that).
        const { data: logRow } = await sb
          .from("training_log")
          .select("id, duration_min, avg_hr, max_hr")
          .eq("user_id", userId)
          .eq("external_id", externalId)
          .maybeSingle()
        if (!logRow) {
          await sb.rpc("delete_strava_backfill_msg", { p_msg_id: msgId })
          continue
        }

        const auth = { headers: { Authorization: `Bearer ${accessToken}` } }
        const sResp = await fetch(
          `https://www.strava.com/api/v3/activities/${externalId}/streams?keys=time,heartrate,watts,velocity_smooth,cadence,altitude&key_by_type=true`,
          auth,
        )
        apiCallsUsed++
        if (sResp.status === 429) { console.warn("strava-backfill-worker: 429 on streams"); break }
        // v9.468 — a non-definitive failure must NOT mark the row enriched
        // (pre-fix: a revoked token or a 5xx blip fell through to streams={} and
        // stamped stream_enriched_at → enrichment permanently lost for that row).
        if (sResp.status === 401 || sResp.status === 403) {
          // Revoked/rejected auth: surface it (mirrors the page branch) and drop
          // the message WITHOUT the marker — a reconnect re-backfills and the
          // still-null marker re-enqueues enrichment.
          await sb.from("strava_tokens").update({
            sync_status: "error",
            last_error: "Strava authorization rejected — please reconnect Strava",
            updated_at: new Date().toISOString(),
          }).eq("user_id", userId)
          await sb.rpc("delete_strava_backfill_msg", { p_msg_id: msgId })
          continue
        }
        if (!sResp.ok && sResp.status !== 404) {
          // Transient (5xx) — leave the message for the VT retry / poison ceiling.
          console.warn(`strava-backfill-worker: streams fetch ${sResp.status} for ${externalId} — retrying later`)
          continue
        }
        // 404 = definitively no streams (manual/very old) — still worth the detail fetch.
        const streams = sResp.ok ? await sResp.json().catch(() => ({})) : {}

        // Detail failure is NON-fatal (perceived_exertion/calories are bonus data;
        // retrying would re-spend the streams call too).
        const dResp = await fetch(`https://www.strava.com/api/v3/activities/${externalId}`, auth)
        apiCallsUsed++
        if (dResp.status === 429) { console.warn("strava-backfill-worker: 429 on detail"); break }
        const detail = dResp.ok ? await dResp.json().catch(() => null) : null

        // Cap at 3h of 1-Hz samples (matches the FIT importer's 10,800 cap).
        // Gap samples (null) become 0 — NOT filtered out — so hr[i]/watts[i]
        // stay index-aligned across streams (audit MED-2: independent
        // compaction desynced the halves-split in decouplingPct → garbage
        // values; 0-fill is the exact parse-activity semantics).
        const asSeries = (s: unknown): number[] => {
          const d = (s as { data?: unknown[] })?.data
          return Array.isArray(d)
            ? (d as unknown[]).map((v) => (typeof v === "number" && Number.isFinite(v) ? v : 0)).slice(0, 10800)
            : []
        }
        const hr    = asSeries((streams as Record<string, unknown>).heartrate)
        const watts = asSeries((streams as Record<string, unknown>).watts)
        const vel   = asSeries((streams as Record<string, unknown>).velocity_smooth)

        const physio = await resolveProfilePhysiology(sb, userId)
        const upd: Record<string, unknown> = { stream_enriched_at: new Date().toISOString() }

        // Real per-session HR facts the summary lacked.
        // Dropout zeros excluded from avg (audit LOW-3, parse-activity parity).
        const hrValid = hr.filter((h) => h > 0)
        const maxFromStream = hrValid.length ? Math.round(Math.max(...hrValid)) : null
        if (!logRow.max_hr && maxFromStream) upd.max_hr = maxFromStream
        if (!logRow.avg_hr && hrValid.length) upd.avg_hr = Math.round(hrValid.reduce((s, v) => s + v, 0) / hrValid.length)
        const effMaxHR = (logRow.max_hr as number) ?? maxFromStream ?? physio.maxHR

        // True 5-zone distribution (replaces the single-band estimate).
        const zones = zonesFromHR(hr, effMaxHR)
        if (zones) upd.zones = zones

        // Real NP from the watts stream (more accurate than weighted_average_watts
        // on variable rides) → headline power-TSS when FTP known.
        if (watts.length >= 30) {
          const np = normalizedPower(watts)
          if (np > 0) {
            upd.np = np
            if (physio.ftp) {
              const durS = (Number(logRow.duration_min) || 0) * 60
              const t = computePowerTSS(np, durS, physio.ftp)
              if (t != null && t > 0) upd.tss = t
            }
          }
          if (physio.cp && physio.wPrime && wPrimeExhausted(watts, physio.cp, physio.wPrime)) {
            upd.w_prime_exhausted = true
            upd.w_prime_method = physio.wPrimeMethod
          }
        }

        // Friel decoupling: Pw:Hr when powered, else Pa:Hr (velocity).
        const dc = watts.length >= 120 ? decouplingPct(hr, watts) : decouplingPct(hr, vel)
        if (dc != null) upd.decoupling_pct = dc

        // P2 detail: athlete-entered RPE is the authoritative effort signal.
        const pe = Number((detail as Record<string, unknown>)?.perceived_exertion)
        if (Number.isFinite(pe) && pe > 0) {
          upd.rpe = Math.min(10, Math.max(1, Math.round(pe)))
          upd.rpe_method = "athlete"
        }
        const cal = Number((detail as Record<string, unknown>)?.calories)
        if (Number.isFinite(cal) && cal > 0) upd.calories = Math.round(cal)

        await sb.from("training_log").update(upd).eq("id", logRow.id)
        await sb.rpc("delete_strava_backfill_msg", { p_msg_id: msgId })
        totalEnriched++
        continue
      }

      const resp = await fetch(
        `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100&page=${page}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      apiCallsUsed++

      if (resp.status === 429) {
        // Rate limited by Strava — leave message in queue for VT retry
        console.warn(`strava-backfill-worker: 429 from Strava for user ${userId}`)
        break
      }

      if (!resp.ok) {
        // Auth failures must be surfaced (not silently discarded) so sync-health
        // stops reporting "healthy" while imports die — write last_error before
        // dropping the message.
        if (resp.status === 401 || resp.status === 403) {
          await sb.from("strava_tokens").update({
            sync_status: "error",
            last_error: "Strava authorization rejected — please reconnect Strava",
            updated_at: new Date().toISOString(),
          }).eq("user_id", userId)
        }
        await sb.rpc("delete_strava_backfill_msg", { p_msg_id: msgId })
        continue
      }

      const activities = await resp.json()
      if (!Array.isArray(activities) || activities.length === 0) {
        // Empty page — backfill complete for this user. F3: flip the row to a healthy
        // idle with a real last_sync_at so a backfill-only import stops showing STALE.
        await sb.from("strava_tokens").update({
          sync_status:  "idle",
          last_error:   null,
          last_sync_at: new Date().toISOString(),
          updated_at:   new Date().toISOString(),
        }).eq("user_id", userId)
        await sb.rpc("delete_strava_backfill_msg", { p_msg_id: msgId })
        continue
      }

      // Athlete physiology: max HR (real → 220−age → null) + FTP for power-TSS.
      const physio = await resolveProfilePhysiology(sb, userId)

      // HIGH-1 fix: don't let a summary re-import clobber streams-derived values.
      const enrichedIds = await fetchStreamEnrichedIds(sb, userId, activities as Record<string, unknown>[])

      // Upsert activities
      let synced = 0
      for (const a of activities as Record<string, unknown>[]) {
        const row = buildTrainingLogRow(a, userId, physio)
        if (!row) continue

        const payload = enrichedIds.has(String(row.external_id)) ? stripStreamDerived(row) : row
        const { error: upsertErr } = await sb.from("training_log")
          .upsert(payload, { onConflict: "user_id,external_id" })

        if (!upsertErr) synced++
      }

      totalSynced += synced

      // v9.466 P1: queue streams+detail enrichment for qualifying activities
      // (has_heartrate/device_watts, non-manual, not yet enriched).
      const enrichable = await enqueueStreamEnrichment(sb, userId, activities as Record<string, unknown>[])
      if (enrichable > 0) console.log(`strava-backfill-worker: enqueued ${enrichable} enrich msgs for user ${userId}`)

      // F3: a successful page that imported activities must set last_sync_at and clear
      // the status — otherwise a backfill-only import (no client Sync) left the row at
      // sync_status='idle', last_sync_at=null forever → the UI showed perpetual STALE
      // despite N imported activities. More pages may follow (re-runs are idempotent).
      if (synced > 0) {
        await sb.from("strava_tokens").update({
          sync_status:  "idle",
          last_error:   null,
          last_sync_at: new Date().toISOString(),
          updated_at:   new Date().toISOString(),
        }).eq("user_id", userId)
      }

      // Enqueue next page if this one was full
      if (activities.length === 100) {
        await sb.rpc("enqueue_strava_backfill", {
          p_payload: {
            user_id:     userId,
            page:        page + 1,
            after,
            enqueued_at: new Date().toISOString(),
          },
        })
      }

      await sb.rpc("delete_strava_backfill_msg", { p_msg_id: msgId })

    } catch (e) {
      // Leave in queue for VT retry
      console.error(`strava-backfill-worker: msg ${msgId} user ${userId}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Update rolling rate counter
  if (apiCallsUsed > 0) {
    const resetWindow = windowAge > RATE_WINDOW_MS
    await sb.from("strava_rate_state").update({
      window_start: resetWindow ? now.toISOString() : windowStart.toISOString(),
      req_count:    resetWindow ? apiCallsUsed : currentReqs + apiCallsUsed,
      updated_at:   now.toISOString(),
    }).eq("id", 1)
  }

  console.log(`strava-backfill-worker: synced=${totalSynced} enriched=${totalEnriched} api_calls=${apiCallsUsed}`)
  return new Response(
    JSON.stringify({ synced: totalSynced, enriched: totalEnriched, api_calls: apiCallsUsed }),
    { headers: { "Content-Type": "application/json" } },
  )
}))
