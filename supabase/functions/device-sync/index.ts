// supabase/functions/device-sync/index.ts (v5.12.0)
// Proxies open-wearables REST API for each athlete device and upserts
// normalized activities into training_log + recovery_entries.
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (auto-provided)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { withTelemetry } from '../_shared/telemetry.ts'
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

// ─── SSRF guard (audit M2) ───────────────────────────────────────────────────
// base_url is user-supplied at device registration and is fetched server-side
// with a DECRYPTED provider token attached. Without validation an attacker can
// point it at internal/cloud-metadata endpoints (169.254.169.254, localhost,
// RFC-1918 ranges, link-local) to exfiltrate the bearer token or use this
// function as an SSRF proxy. Enforce https + block private/loopback/link-local
// IP literals + reject embedded credentials. An optional env allow-list
// (DEVICE_SYNC_ALLOWED_HOSTS, comma-separated hostnames) narrows it further.
//
// NOTE: this blocks IP *literals* in the URL. DNS-rebinding (a public hostname
// that resolves to a private IP) is out of scope for this layer — Deno's fetch
// does not expose the resolved address pre-connect. The allow-list env is the
// hard control for high-security deployments; the IP-literal + https checks are
// the baseline that closes the obvious metadata/loopback vectors.

function isBlockedIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return false
  const [a, b] = [Number(m[1]), Number(m[2])]
  if (a === 10) return true                       // 10.0.0.0/8
  if (a === 127) return true                      // loopback
  if (a === 0) return true                        // 0.0.0.0/8
  if (a === 169 && b === 254) return true         // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true         // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64.0.0/10
  if (a >= 224) return true                       // multicast / reserved
  return false
}

function validateBaseUrl(raw: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL
  try { url = new URL(raw) } catch { return { ok: false, reason: "malformed_url" } }

  if (url.protocol !== "https:")        return { ok: false, reason: "not_https" }
  if (url.username || url.password)     return { ok: false, reason: "embedded_credentials" }

  const host = url.hostname.toLowerCase()
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return { ok: false, reason: "internal_host" }
  }
  // Block IPv6 loopback / link-local / unique-local literals
  if (host.includes(":")) {
    if (host === "::1" || host.startsWith("fe80") || host.startsWith("fc") || host.startsWith("fd") || host === "::") {
      return { ok: false, reason: "blocked_ipv6" }
    }
  }
  if (isBlockedIPv4(host)) return { ok: false, reason: "blocked_ip" }

  const allow = (Deno.env.get("DEVICE_SYNC_ALLOWED_HOSTS") || "")
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean)
  if (allow.length > 0 && !allow.includes(host)) {
    return { ok: false, reason: "host_not_allowed" }
  }

  return { ok: true, url }
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

serve(withTelemetry('device-sync', async (req: Request) => {
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
      // M2 fix: validate the user-supplied base_url BEFORE attaching the token /
      // making any server-side request, to prevent SSRF / token exfiltration.
      const urlCheck = validateBaseUrl(String(device.base_url || ""))
      if (!urlCheck.ok) {
        deviceResult.status = "error"
        ;(deviceResult as { error?: string }).error = `invalid_base_url:${urlCheck.reason}`
        results.push(deviceResult)
        continue
      }

      // Decrypt token
      let token: string | null = null
      if (device.token_enc) {
        const { data: decrypted, error: decErr } = await adminClient
          .rpc("decrypt_device_token", { enc: device.token_enc })
        if (!decErr && decrypted) token = decrypted
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (token) headers["Authorization"] = `Bearer ${token}`

      // Use the parsed/validated URL (origin + path), not the raw string.
      const baseUrl = (urlCheck.url.origin + urlCheck.url.pathname).replace(/\/$/, "")
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

        // v9.341.0 — Dedup on (user_id, external_id), the only training_log
        // unique index that fits. Pre-v9.341 used onConflict:'user_id,date,
        // source', which has NO matching constraint → upsert threw, so every
        // device sync silently failed. A (user_id,date,source) constraint
        // can't be added: the app allows multiple sessions per day. Using
        // external_id (the provider's stable activity id) gives idempotent
        // re-sync AND preserves two-a-days. When the provider omits an id,
        // fall back to plain insert (can't dedup without a key anyway).
        const externalId = act.id ? `ow:${device.provider}:${act.id}` : null
        const row = {
          user_id:      user.id,
          date,
          type,
          duration_min: duration,
          tss,
          source:       `ow:${device.provider}`,
          external_id:  externalId,
          notes:        act.notes ?? null,
        }
        if (externalId) {
          await adminClient.from("training_log").upsert(row, { onConflict: "user_id,external_id" })
        } else {
          await adminClient.from("training_log").insert(row)
        }
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
}))
