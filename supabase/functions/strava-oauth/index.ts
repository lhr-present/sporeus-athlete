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

// Estimate zone distribution from HR fraction
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
  // Refresh if within 5 minutes of expiry
  const expiresAt = new Date(tokenRow.expires_at)
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000)
  if (expiresAt > fiveMinFromNow) return null

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

// Fetch one page of activities, respecting rate limit headers.
// Returns { activities, rateLimitExceeded, retryAfter }
async function fetchActivitiesPage(
  accessToken: string,
  after: number,
  page: number,
): Promise<{ activities: unknown[]; rateLimitExceeded: boolean; retryAfter: number }> {
  const resp = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100&page=${page}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (resp.status === 429) {
    const retryAfter = parseInt(resp.headers.get("Retry-After") || "60", 10)
    return { activities: [], rateLimitExceeded: true, retryAfter }
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => "")
    throw new Error(`Strava API ${resp.status}: ${body.slice(0, 200)}`)
  }

  const activities = await resp.json()
  return { activities: Array.isArray(activities) ? activities : [], rateLimitExceeded: false, retryAfter: 0 }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return fail(401, "Unauthorized")

  const supabaseUrl  = Deno.env.get("SUPABASE_URL")!
  const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const anonKey      = Deno.env.get("SUPABASE_ANON_KEY")!
  const stravaId     = Deno.env.get("STRAVA_CLIENT_ID")     || ""
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

    const athleteName = tokens.athlete
      ? `${tokens.athlete.firstname || ""} ${tokens.athlete.lastname || ""}`.trim()
      : null

    const { error: upsertErr } = await admin.from("strava_tokens").upsert({
      user_id:               user.id,
      access_token:          tokens.access_token,
      refresh_token:         tokens.refresh_token,
      expires_at:            new Date(tokens.expires_at * 1000).toISOString(),
      strava_athlete_id:     tokens.athlete?.id ?? null,
      provider_athlete_name: athleteName,
      sync_status:           "idle",
      last_error:            null,
      updated_at:            new Date().toISOString(),
    })
    if (upsertErr) return fail(500, upsertErr.message)

    return ok({ athlete: athleteName, strava_id: tokens.athlete?.id })
  }

  // ── SYNC: import recent Strava activities ────────────────────────────────────
  if (action === "sync") {
    const { data: tokenRow, error: fetchErr } = await admin
      .from("strava_tokens")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()

    if (fetchErr || !tokenRow) return fail(404, "Strava not connected")

    // Mark syncing
    await admin.from("strava_tokens").update({ sync_status: "syncing" }).eq("user_id", user.id)

    const setSyncDone = async (error?: string) => {
      await admin.from("strava_tokens").update({
        sync_status:  error ? "error" : "idle",
        last_error:   error ?? null,
        last_sync_at: error ? tokenRow.last_sync_at : new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      }).eq("user_id", user.id)
    }

    // Refresh token if expiring within 5 minutes
    let accessToken: string
    try {
      const newToken = await refreshIfExpired(admin, tokenRow, stravaId, stravaSecret)
      accessToken = newToken || tokenRow.access_token
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await setSyncDone(`Token refresh failed: ${msg}`)
      return fail(502, `Token refresh failed: ${msg}`)
    }

    // Fetch activities — max 2 pages (200 activities) to stay within rate limits
    const after = Math.floor(Date.now() / 1000) - 30 * 24 * 3600
    const allActivities: unknown[] = []

    for (let page = 1; page <= 2; page++) {
      let pageResult: { activities: unknown[]; rateLimitExceeded: boolean; retryAfter: number }
      try {
        pageResult = await fetchActivitiesPage(accessToken, after, page)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await setSyncDone(msg)
        return fail(502, msg)
      }

      if (pageResult.rateLimitExceeded) {
        await setSyncDone(`Rate limit hit — retry after ${pageResult.retryAfter}s`)
        return fail(429, `Strava rate limit — retry after ${pageResult.retryAfter}s`)
      }

      allActivities.push(...pageResult.activities)
      // Stop early if page wasn't full (no more data)
      if (pageResult.activities.length < 100) break
    }

    // Upsert activities into training_log
    let synced = 0
    for (const a of allActivities as Record<string, unknown>[]) {
      if (!a.id || !a.start_date) continue
      const durationMin = Math.round(((a.moving_time as number) || 0) / 60)
      if (durationMin < 3) continue

      const avgHR = a.average_heartrate ? Math.round(a.average_heartrate as number) : null
      const maxHR = a.max_heartrate ? Math.round(a.max_heartrate as number) : 190
      const tss   = estimateTSS((a.moving_time as number) || 0, avgHR, maxHR)
      const zones = estimateZones((a.sport_type as string) || (a.type as string) || "", avgHR, maxHR)

      const distKm = a.distance ? ((a.distance as number) / 1000).toFixed(2) : null
      const noteParts = [(a.name as string) || "Strava Activity"]
      if (distKm) noteParts.push(`${distKm} km`)
      if (avgHR)  noteParts.push(`avg HR ${avgHR}`)

      const row = {
        user_id:      user.id,
        date:         ((a.start_date_local as string) || (a.start_date as string)).slice(0, 10),
        type:         mapStravaType((a.sport_type as string) || (a.type as string) || ""),
        duration_min: durationMin,
        tss,
        rpe:          null,
        zones,
        notes:        noteParts.join(" · "),
        source:       "strava" as const,
        external_id:  String(a.id),
      }

      const { error: insertErr } = await admin
        .from("training_log")
        .upsert(row, { onConflict: "user_id,external_id" })
      if (!insertErr) synced++
    }

    await setSyncDone()
    return ok({ synced, total: allActivities.length })
  }

  // ── DISCONNECT: revoke at Strava, then remove local tokens ──────────────────
  if (action === "disconnect") {
    // Fetch the current access token to send to Strava's deauthorize endpoint
    const { data: tokenRow } = await admin
      .from("strava_tokens")
      .select("access_token")
      .eq("user_id", user.id)
      .maybeSingle()

    if (tokenRow?.access_token) {
      // Best-effort revocation — don't fail the disconnect if Strava is unreachable
      try {
        await fetch("https://www.strava.com/oauth/deauthorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: tokenRow.access_token }),
        })
      } catch {
        // Network error during revocation — proceed with local deletion anyway
      }
    }

    await admin.from("strava_tokens").delete().eq("user_id", user.id)
    return ok({ ok: true })
  }

  return fail(400, `Unknown action: ${action}`)
})
