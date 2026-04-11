// supabase/functions/strava-oauth/index.ts
// Handles Strava OAuth: connect (token exchange), sync (activity import), disconnect
// Secrets required: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET
// Auto-provided by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  })
}

function fail(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  })
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

// TRIMP-based TSS estimate — no LTHR needed, uses max HR
function estimateTSS(durationS: number, avgHR: number | null, maxHR: number): number {
  if (!avgHR || !maxHR || maxHR <= 0) return Math.round(durationS / 3600 * 50)
  const hrFrac = Math.min(avgHR / maxHR, 1)
  const trimp = (durationS / 60) * hrFrac * 0.64 * Math.exp(1.92 * hrFrac)
  return Math.round(trimp * 1.2)
}

// Estimate zone distribution from activity type and effort
function estimateZones(sportType: string, avgHR: number | null, maxHR: number): number[] | null {
  if (!avgHR || !maxHR) return null
  const pct = avgHR / maxHR
  if (pct < 0.70) return [60, 35, 5, 0, 0]
  if (pct < 0.80) return [20, 55, 20, 5, 0]
  if (pct < 0.88) return [5, 20, 45, 25, 5]
  if (pct < 0.94) return [0, 5, 15, 55, 25]
  return [0, 0, 5, 25, 70]
}

async function refreshIfExpired(
  adminClient: ReturnType<typeof createClient>,
  tokenRow: { expires_at: string; refresh_token: string; user_id: string },
  stravaClientId: string,
  stravaClientSecret: string,
): Promise<string | null> {
  if (new Date(tokenRow.expires_at) > new Date()) {
    return null // not expired
  }
  const resp = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: stravaClientId,
      client_secret: stravaClientSecret,
      refresh_token: tokenRow.refresh_token,
      grant_type: "refresh_token",
    }),
  })
  const refreshed = await resp.json()
  if (!refreshed.access_token) return null
  await adminClient.from("strava_tokens").update({
    access_token: refreshed.access_token,
    refresh_token: refreshed.refresh_token,
    expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("user_id", tokenRow.user_id)
  return refreshed.access_token
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return fail(401, "Unauthorized")

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!
  const stravaId    = Deno.env.get("STRAVA_CLIENT_ID") || ""
  const stravaSecret = Deno.env.get("STRAVA_CLIENT_SECRET") || ""

  // Verify calling user via their JWT
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return fail(401, "Invalid token")

  const admin = createClient(supabaseUrl, serviceKey)

  let body: { action?: string; code?: string; redirectUri?: string } = {}
  try { body = await req.json() } catch { return fail(400, "Invalid JSON") }
  const { action, code, redirectUri } = body

  // ── CONNECT: exchange Strava code for tokens ─────────────────────────────────
  if (action === "connect") {
    if (!code) return fail(400, "Missing code")
    if (!stravaId || !stravaSecret) return fail(500, "Strava credentials not configured")

    const resp = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: stravaId,
        client_secret: stravaSecret,
        code,
        grant_type: "authorization_code",
        ...(redirectUri ? { redirect_uri: redirectUri } : {}),
      }),
    })
    const tokens = await resp.json()
    if (!tokens.access_token) {
      return fail(400, tokens.message || tokens.errors?.[0]?.message || "Strava token exchange failed")
    }

    const { error: upsertErr } = await admin.from("strava_tokens").upsert({
      user_id:          user.id,
      access_token:     tokens.access_token,
      refresh_token:    tokens.refresh_token,
      expires_at:       new Date(tokens.expires_at * 1000).toISOString(),
      strava_athlete_id: tokens.athlete?.id ?? null,
      updated_at:       new Date().toISOString(),
    })
    if (upsertErr) return fail(500, upsertErr.message)

    const name = tokens.athlete
      ? `${tokens.athlete.firstname} ${tokens.athlete.lastname}`.trim()
      : "Unknown"
    return ok({ athlete: name, strava_id: tokens.athlete?.id })
  }

  // ── SYNC: import recent Strava activities ────────────────────────────────────
  if (action === "sync") {
    const { data: tokenRow, error: fetchErr } = await admin
      .from("strava_tokens")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()

    if (fetchErr || !tokenRow) return fail(404, "Strava not connected")

    // Refresh token if needed
    const newToken = await refreshIfExpired(admin, tokenRow, stravaId, stravaSecret)
    const accessToken = newToken || tokenRow.access_token

    // Fetch activities from last 30 days
    const after = Math.floor(Date.now() / 1000) - 30 * 24 * 3600
    const activitiesResp = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )
    const activities = await activitiesResp.json()
    if (!Array.isArray(activities)) {
      return fail(400, "Strava API error: " + JSON.stringify(activities).slice(0, 200))
    }

    let synced = 0
    for (const a of activities) {
      if (!a.id || !a.start_date) continue
      const durationMin = Math.round((a.moving_time || 0) / 60)
      if (durationMin < 3) continue // skip tiny activities

      const avgHR = a.average_heartrate ? Math.round(a.average_heartrate) : null
      const maxHR = a.max_heartrate ? Math.round(a.max_heartrate) : 190
      const tss   = estimateTSS(a.moving_time || 0, avgHR, maxHR)
      const zones = estimateZones(a.sport_type || a.type || "", avgHR, maxHR)

      const distKm = a.distance ? (a.distance / 1000).toFixed(2) : null
      const noteParts = [a.name || "Strava Activity"]
      if (distKm) noteParts.push(`${distKm} km`)
      if (avgHR)  noteParts.push(`avg HR ${avgHR}`)

      const row = {
        user_id:      user.id,
        date:         (a.start_date_local || a.start_date).slice(0, 10),
        type:         mapStravaType(a.sport_type || a.type || ""),
        duration_min: durationMin,
        tss,
        rpe:          null, // Strava doesn't provide RPE
        zones:        zones,
        notes:        noteParts.join(" · "),
        source:       "strava" as const,
        external_id:  String(a.id),
      }

      const { error: insertErr } = await admin
        .from("training_log")
        .upsert(row, { onConflict: "user_id,external_id" })
      if (!insertErr) synced++
    }

    await admin.from("strava_tokens").update({
      last_sync_at: new Date().toISOString(),
    }).eq("user_id", user.id)

    return ok({ synced, total: activities.length })
  }

  // ── DISCONNECT ───────────────────────────────────────────────────────────────
  if (action === "disconnect") {
    await admin.from("strava_tokens").delete().eq("user_id", user.id)
    return ok({ ok: true })
  }

  return fail(400, `Unknown action: ${action}`)
})
