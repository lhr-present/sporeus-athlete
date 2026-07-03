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
import { buildTrainingLogRow, resolveProfilePhysiology } from '../_shared/stravaActivity.ts'

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
  let apiCallsUsed = 0

  for (const row of msgs) {
    const msgId   = row.msg_id as bigint
    const readCt  = (row.read_ct as number) ?? 0
    const payload = row.message as Record<string, unknown>

    // Poison ceiling: a message that keeps failing (revoked token, persistent 5xx,
    // deleted user) would otherwise be re-read forever, blocking consumer capacity.
    // Dead-letter it after MAX_READ reads instead of indefinitely.
    if (readCt >= MAX_READ) {
      console.warn(`strava-backfill-worker: msg ${msgId} read_ct=${readCt} >= MAX_READ — dead-lettering`)
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

      // Upsert activities
      let synced = 0
      for (const a of activities as Record<string, unknown>[]) {
        const row = buildTrainingLogRow(a, userId, physio)
        if (!row) continue

        const { error: upsertErr } = await sb.from("training_log")
          .upsert(row, { onConflict: "user_id,external_id" })

        if (!upsertErr) synced++
      }

      totalSynced += synced

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

  console.log(`strava-backfill-worker: synced=${totalSynced} api_calls=${apiCallsUsed}`)
  return new Response(
    JSON.stringify({ synced: totalSynced, api_calls: apiCallsUsed }),
    { headers: { "Content-Type": "application/json" } },
  )
}))
