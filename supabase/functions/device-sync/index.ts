// supabase/functions/device-sync/index.ts (v5.12.0)
// Proxies open-wearables REST API for each athlete device and upserts
// normalized activities into training_log + recovery_entries.
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (auto-provided)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
  })
}
function fail(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }, status,
  })
}

// ─── Schema mappers ────────────────────────────────────────────────────────────

function mapOWActivityType(owType: string): string {
  const m: Record<string, string> = {
    running: "run", trail_running: "run",
    cycling: "bike", virtual_cycling: "bike",
    swimming: "swim", open_water_swimming: "swim",
    walking: "walk", hiking: "walk",
    strength_training: "strength", weight_training: "strength",
    yoga: "other", workout: "other",
  }
  return m[owType?.toLowerCase()] ?? "other"
}

function estimateTSSFromOW(durationS: number, avgHR: number | null, maxHR: number | null): number {
  if (!avgHR || !maxHR || maxHR <= 0) return Math.round(durationS / 3600 * 50)
  const hrFrac = Math.min(avgHR / maxHR, 1)
  const trimp  = (durationS / 60) * hrFrac * 0.64 * Math.exp(1.92 * hrFrac)
  return Math.round(trimp * 1.2)
}

interface OWActivity {
  id?: string
  type?: string
  start_time?: string
  duration_seconds?: number
  distance_meters?: number
  avg_heart_rate?: number
  max_heart_rate?: number
  calories?: number
  notes?: string
}

interface OWRecovery {
  date?: string
  hrv_rmssd?: number
  resting_hr?: number
  sleep_duration_hours?: number
  readiness_score?: number
}

// ─── Main handler ──────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) return fail(401, "Missing Authorization header")

  const supabaseUrl     = Deno.env.get("SUPABASE_URL")!
  const serviceRoleKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

  // Verify JWT and get user
  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return fail(401, "Invalid token")

  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  // Fetch registered devices for this user
  const { data: devices, error: devErr } = await adminClient
    .from("athlete_devices")
    .select("id, provider, label, base_url, token_enc")
    .eq("user_id", user.id)

  if (devErr) return fail(500, devErr.message)
  if (!devices || devices.length === 0) return ok({ results: [], synced: 0 })

  const results: Array<{ deviceId: string; provider: string; status: string; count: number; error?: string }> = []
  let totalSynced = 0

  for (const device of devices) {
    const deviceResult = { deviceId: device.id, provider: device.provider, status: "ok", count: 0 }
    try {
      // Decrypt token
      let token: string | null = null
      if (device.token_enc) {
        const { data: decrypted, error: decErr } = await adminClient
          .rpc("decrypt_device_token", { enc: device.token_enc })
        if (!decErr && decrypted) token = decrypted
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`

      const baseUrl = device.base_url.replace(/\/$/, "")
      const since   = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      // Fetch activities with 8s timeout
      const actCtrl = new AbortController()
      const actTimer = setTimeout(() => actCtrl.abort(), 8000)
      let activities: OWActivity[] = []
      try {
        const resp = await fetch(`${baseUrl}/api/v1/activities?since=${since}`, { headers, signal: actCtrl.signal })
        if (resp.ok) {
          const json = await resp.json()
          activities = Array.isArray(json) ? json : (json.activities ?? [])
        }
      } finally {
        clearTimeout(actTimer)
      }

      // Fetch recovery/HRV data
      const recCtrl = new AbortController()
      const recTimer = setTimeout(() => recCtrl.abort(), 8000)
      let recoveries: OWRecovery[] = []
      try {
        const resp = await fetch(`${baseUrl}/api/v1/recovery?since=${since}`, { headers, signal: recCtrl.signal })
        if (resp.ok) {
          const json = await resp.json()
          recoveries = Array.isArray(json) ? json : (json.recovery ?? [])
        }
      } finally {
        clearTimeout(recTimer)
      }

      // Upsert activities → training_log
      for (const act of activities) {
        if (!act.start_time) continue
        const date     = act.start_time.slice(0, 10)
        const duration = Math.round((act.duration_seconds ?? 0) / 60)
        const tss      = estimateTSSFromOW(act.duration_seconds ?? 0, act.avg_heart_rate ?? null, act.max_heart_rate ?? null)
        const type     = mapOWActivityType(act.type ?? "")

        await adminClient.from("training_log").upsert({
          user_id:      user.id,
          date,
          type,
          duration_min: duration,
          tss,
          source:       `ow:${device.provider}`,
          notes:        act.notes ?? null,
        }, { onConflict: "user_id,date,source" })
        deviceResult.count++
      }

      // Upsert recovery → recovery_entries
      for (const rec of recoveries) {
        if (!rec.date) continue
        await adminClient.from("recovery").upsert({
          user_id:   user.id,
          date:      rec.date,
          hrv:       rec.hrv_rmssd ?? null,
          score:     rec.readiness_score ?? null,
          sleep_hrs: rec.sleep_duration_hours ?? null,
        }, { onConflict: "user_id,date" })
      }

      totalSynced += deviceResult.count

      // Update last_sync_at
      await adminClient.from("athlete_devices")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", device.id)

    } catch (err: unknown) {
      deviceResult.status = "error"
      deviceResult.error  = err instanceof Error ? err.message : String(err)
    }
    results.push(deviceResult)
  }

  return ok({ results, synced: totalSynced })
})
