// supabase/functions/garmin-sync/index.ts — E10: Garmin spike (PROTOTYPE)
// Pulls last 30 days of activities from Garmin Health API and inserts to training_log.
//
// PROTOTYPE ONLY — not production code. Part of the v9 discovery spike.
// Decision gate: see docs/roadmap/garmin_spike_v9.md
//
// Key differences from Strava sync (documented for GO/NO-GO decision):
//   + Garmin provides TSS, body battery, HRV, stress — Strava doesn't
//   - Garmin activity API requires separate Health API approval
//   - Garmin uses local timestamps (timezone handling needed)
//   - Garmin normalizedPower field differs from Strava's weighted_average_watts
//   - Garmin typeKey strings differ from both Strava sport_type and Sporeus type strings

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const GARMIN_API_BASE    = "https://apis.garmin.com"
const GARMIN_ACTIVITY_URL = `${GARMIN_API_BASE}/wellness-api/rest/activities`

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

// ── Schema mapping (mirrors src/lib/garmin/schemaMapper.js in Deno) ────────
// Kept inline so the edge function has no import dependency on client-side code.

const GARMIN_TYPE_MAP: Record<string, string> = {
  running: "Running", indoor_running: "Running", treadmill_running: "Running",
  trail_running: "Running", cycling: "Cycling", road_biking: "Cycling",
  indoor_cycling: "Cycling", mountain_biking: "Cycling", gravel_cycling: "Cycling",
  virtual_ride: "Cycling", swimming: "Swimming", open_water_swimming: "Swimming",
  pool_swimming: "Swimming", lap_swimming: "Swimming",
  rowing: "Rowing", indoor_rowing: "Rowing",
  triathlon: "Triathlon",
  strength_training: "Strength", fitness_equipment: "Strength", yoga: "Strength", hiit: "Strength",
}

function mapActivityType(typeKey: string): string {
  if (!typeKey) return "Other"
  const key = typeKey.toLowerCase().replace(/[-\s]/g, "_")
  return GARMIN_TYPE_MAP[key] ?? "Other"
}

function ateToRpe(ate: number | null): number | null {
  if (ate == null || isNaN(ate)) return null
  return Math.min(10, Math.max(1, Math.round(ate * 2) + 1))
}

function garminDateToLocal(ts: string | number | null): string | null {
  if (!ts) return null
  if (typeof ts === "string" && /^\d{4}-\d{2}-\d{2}/.test(ts)) return ts.slice(0, 10)
  if (typeof ts === "number") {
    const d = new Date(ts)
    if (isNaN(d.getTime())) return null
    const y  = d.getFullYear()
    const m  = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${dd}`
  }
  return null
}

interface GarminActivity {
  activityId:             string | number
  activityName?:          string
  startTimeLocal?:        string | number
  startTimeGMT?:          string | number
  activityType?:          { typeKey?: string } | string
  duration?:              number
  movingDuration?:        number
  averageHR?:             number
  maxHR?:                 number
  distance?:              number
  normalizedPower?:       number
  normPower?:             number
  aerobicTrainingEffect?: number
  trainingStressScore?:   number
  bodyBattery?:           number
  stressScore?:           number
  hrvWeeklyAverage?:      number
  anaerobicTrainingEffect?: number
}

function mapActivity(g: GarminActivity) {
  const date     = garminDateToLocal(g.startTimeLocal ?? g.startTimeGMT ?? null)
  const durationSec = Number(g.duration ?? g.movingDuration) || 0
  const duration = Math.round(durationSec / 60)
  if (!date || duration <= 0) return null

  const typeKey  = typeof g.activityType === "object" ? g.activityType?.typeKey : g.activityType
  const type     = mapActivityType(typeKey ?? "")
  const bpmAvg   = g.averageHR ? Math.round(g.averageHR) : null
  const bpmMax   = g.maxHR ? Math.round(g.maxHR) : null
  const normPow  = g.normPower ?? g.normalizedPower ?? null
  const distM    = g.distance ?? 0
  const distKm   = distM > 0 ? Math.round(distM / 10) / 100 : null
  const rpe      = ateToRpe(g.aerobicTrainingEffect ?? null)
  const tss      = g.trainingStressScore ? Math.round(g.trainingStressScore) : null

  return {
    date,
    type,
    duration,
    tss,
    rpe,
    bpm_avg:            bpmAvg,
    bpm_max:            bpmMax,
    power_norm:         normPow ? Math.round(normPow) : null,
    distance_km:        distKm,
    notes:              `[Garmin] ${g.activityName ?? ""}`.trim(),
    garmin_activity_id: String(g.activityId ?? ""),
  }
}

// ── Token refresh ──────────────────────────────────────────────────────────
async function refreshGarminToken(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  const basicAuth = btoa(`${clientId}:${clientSecret}`)
  const resp = await fetch(
    "https://connect.garmin.com/oauth-service/oauth/exchange/user/2.0",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        grant_type:    "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    },
  )
  if (!resp.ok) return null
  const tokens = await resp.json()
  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString()
  await adminClient.from("garmin_tokens").upsert({
    user_id:       userId,
    access_token:  tokens.access_token,
    refresh_token: tokens.refresh_token ?? refreshToken,
    expires_at:    expiresAt,
    updated_at:    new Date().toISOString(),
  }, { onConflict: "user_id" })
  return tokens.access_token
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const anonKey     = Deno.env.get("SUPABASE_ANON_KEY")!
  const clientId    = Deno.env.get("GARMIN_CLIENT_ID") ?? ""
  const clientSecret = Deno.env.get("GARMIN_CLIENT_SECRET") ?? ""

  if (!clientId) {
    return fail(501, "Garmin integration not yet enabled — prototype spike only")
  }

  const authHeader = req.headers.get("authorization") ?? ""
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return fail(401, "Unauthorized")

  const adminClient = createClient(supabaseUrl, serviceKey)

  // Load Garmin tokens
  const { data: tokenRow } = await adminClient
    .from("garmin_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", user.id)
    .maybeSingle()

  if (!tokenRow) return fail(400, "Garmin not connected")

  let accessToken = tokenRow.access_token
  const expiresAt = new Date(tokenRow.expires_at)
  if (expiresAt <= new Date(Date.now() + 5 * 60 * 1000)) {
    const refreshed = await refreshGarminToken(adminClient, user.id, tokenRow.refresh_token, clientId, clientSecret)
    if (!refreshed) return fail(502, "Garmin token refresh failed")
    accessToken = refreshed
  }

  // Fetch last 30 days of activities from Garmin Health API
  const endTs   = Math.floor(Date.now() / 1000)
  const startTs = endTs - 30 * 24 * 60 * 60

  const garminResp = await fetch(
    `${GARMIN_ACTIVITY_URL}?startTimeInSeconds=${startTs}&endTimeInSeconds=${endTs}&limit=100`,
    {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      },
    },
  )

  if (!garminResp.ok) {
    const errBody = await garminResp.text()
    console.error("[garmin-sync] activities fetch failed:", garminResp.status, errBody)
    return fail(502, "Garmin activities fetch failed")
  }

  const garminActivities: GarminActivity[] = await garminResp.json()

  // Map activities and dedup by garmin_activity_id
  const mapped = garminActivities
    .map(mapActivity)
    .filter((row): row is NonNullable<ReturnType<typeof mapActivity>> => row !== null)

  if (mapped.length === 0) return ok({ synced: 0, message: "No activities in last 30 days" })

  // Load existing garmin_activity_ids to avoid duplicates
  const ids = mapped.map(r => r.garmin_activity_id).filter(Boolean)
  const { data: existing } = await adminClient
    .from("training_log")
    .select("garmin_activity_id")
    .eq("user_id", user.id)
    .in("garmin_activity_id", ids)

  const existingIds = new Set((existing ?? []).map((r: { garmin_activity_id: string }) => r.garmin_activity_id))
  const newActivities = mapped.filter(r => !existingIds.has(r.garmin_activity_id))

  if (newActivities.length === 0) return ok({ synced: 0, message: "All activities already imported" })

  const rows = newActivities.map(r => ({ ...r, user_id: user.id }))
  const { error: insertError } = await adminClient.from("training_log").insert(rows)
  if (insertError) {
    console.error("[garmin-sync] insert error:", insertError.message)
    return fail(500, "Failed to insert activities")
  }

  return ok({ synced: newActivities.length, total_fetched: garminActivities.length })
})
