// supabase/functions/strava-backfill-worker/index.ts — pgmq strava_backfill consumer
// Cron: every 2 minutes (*/2 * * * *)
// Reads strava_backfill messages (one per activity page fetch), fetches from Strava API,
// upserts to training_log, enqueues next page if full (100 activities).
// Checks rolling rate counter: max 600 requests per 15-minute window.

import { serve }        from "https://deno.land/std@0.177.0/http/server.ts"
import { withTelemetry, telemetryHeartbeat } from '../_shared/telemetry.ts'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const RATE_WINDOW_MS = 15 * 60 * 1000   // 15 minutes
const MAX_REQUESTS   = 600

function jwtRole(h: string | null): string | null {
  try {
    if (!h) return null
    const p = JSON.parse(atob(h.replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/")))
    return p.role || null
  } catch { return null }
}

function mapStravaType(sportType: string): string {
  const m: Record<string, string> = {
    Run: "run", TrailRun: "run", VirtualRun: "run",
    Ride: "bike", EBikeRide: "bike", VirtualRide: "bike", MountainBikeRide: "bike",
    Swim: "swim", OpenWaterSwim: "swim",
    Walk: "walk", Hike: "walk",
    WeightTraining: "strength", Yoga: "other", Workout: "other",
    Rowing: "other", Kayaking: "other", Crossfit: "strength",
  }
  return m[sportType] || "other"
}

function estimateTSS(durationS: number, avgHR: number | null, maxHR: number): number {
  if (!avgHR || !maxHR || maxHR <= 0) return Math.round(durationS / 3600 * 50)
  const hrFrac = Math.min(avgHR / maxHR, 1)
  const trimp  = (durationS / 60) * hrFrac * 0.64 * Math.exp(1.92 * hrFrac)
  return Math.round(trimp * 1.2)
}

function estimateZones(avgHR: number | null, maxHR: number): number[] | null {
  if (!avgHR || !maxHR) return null
  const pct = avgHR / maxHR
  if (pct < 0.70) return [60, 35, 5, 0, 0]
  if (pct < 0.80) return [20, 55, 20, 5, 0]
  if (pct < 0.88) return [5, 20, 45, 25, 5]
  if (pct < 0.94) return [0, 5, 15, 55, 25]
  return [0, 0, 5, 25, 70]
}

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
  const refreshed = await resp.json()
  if (!refreshed.access_token) return null

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

  if (jwtRole(req.headers.get("authorization")) !== "service_role") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const supabaseUrl  = Deno.env.get("SUPABASE_URL")!
  const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
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
    const payload = row.message as Record<string, unknown>

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

      const freshToken = await refreshIfExpired(sb, tokenRow, stravaId, stravaSecret)
      const accessToken = freshToken || tokenRow.access_token

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
        // Non-retryable error — discard
        await sb.rpc("delete_strava_backfill_msg", { p_msg_id: msgId })
        continue
      }

      const activities = await resp.json()
      if (!Array.isArray(activities) || activities.length === 0) {
        // Empty page — backfill complete for this user
        await sb.rpc("delete_strava_backfill_msg", { p_msg_id: msgId })
        continue
      }

      // Upsert activities
      let synced = 0
      for (const a of activities as Record<string, unknown>[]) {
        if (!a.id || !a.start_date) continue
        const durationMin = Math.round(((a.moving_time as number) || 0) / 60)
        if (durationMin < 3) continue

        const avgHR  = a.average_heartrate ? Math.round(a.average_heartrate as number) : null
        const maxHR  = a.max_heartrate     ? Math.round(a.max_heartrate as number)     : 190
        const tss    = estimateTSS((a.moving_time as number) || 0, avgHR, maxHR)
        const zones  = estimateZones(avgHR, maxHR)
        const distKm = a.distance ? ((a.distance as number) / 1000).toFixed(2) : null
        const noteParts = [(a.name as string) || "Strava Activity"]
        if (distKm) noteParts.push(`${distKm} km`)
        if (avgHR)  noteParts.push(`avg HR ${avgHR}`)

        const { error: upsertErr } = await sb.from("training_log").upsert({
          user_id:      userId,
          date:         ((a.start_date_local as string) || (a.start_date as string)).slice(0, 10),
          type:         mapStravaType((a.sport_type as string) || (a.type as string) || ""),
          duration_min: durationMin,
          tss, rpe: null, zones,
          notes:        noteParts.join(" · "),
          source:       "strava",
          external_id:  String(a.id),
        }, { onConflict: "user_id,external_id" })

        if (!upsertErr) synced++
      }

      totalSynced += synced

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
