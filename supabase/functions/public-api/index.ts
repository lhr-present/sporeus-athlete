/**
 * supabase/functions/public-api/index.ts — Sporeus Public REST API (v1)
 * Read-only. Requires Club tier. Auth via Bearer API key.
 *
 * ─── Endpoints ───────────────────────────────────────────────────────────────
 *
 * GET /api/v1/squad
 *   Returns team readiness snapshot (no PII).
 *   Response: [{ display_name, acwr, wellness_avg, risk_level }]
 *
 * GET /api/v1/athlete/:id/load
 *   Returns last 28 days of daily load for one athlete.
 *   Response: { athlete_id, days: [{ date, tss, rpe }] }
 *
 * GET /api/v1/squad/export
 *   Returns CSV of squad weekly summary.
 *   Response: text/csv with columns athlete,week,total_tss,avg_rpe,sessions
 *
 * ─── Auth ────────────────────────────────────────────────────────────────────
 *   Authorization: Bearer {api_key}
 *   API key validated against api_keys table (Club tier required).
 *
 * ─── Rate Limit ──────────────────────────────────────────────────────────────
 *   100 requests/hour per api_key.
 *   Tracked in request_counts table.
 *
 * ─── CORS ────────────────────────────────────────────────────────────────────
 *   Access-Control-Allow-Origin: * (for Excel/Sheets GET requests)
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  })
}

function csv(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { ...CORS, "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=squad.csv" },
  })
}

function err(status: number, message: string) {
  return json({ error: message }, status)
}

// ── Rate limit check (100 req/hour per key) ────────────────────────────────────
async function checkRateLimit(db: ReturnType<typeof createClient>, apiKey: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - 3600000).toISOString()
  const { count } = await db
    .from("request_counts")
    .select("*", { count: "exact", head: true })
    .eq("api_key", apiKey)
    .gte("created_at", windowStart)
  return (count ?? 0) < 100
}

async function logRequest(db: ReturnType<typeof createClient>, apiKey: string, orgId: string, path: string) {
  await db.from("request_counts").insert({ api_key: apiKey, org_id: orgId, path, created_at: new Date().toISOString() })
  await db.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("api_key", apiKey)
}

// ── Auth: validate API key ─────────────────────────────────────────────────────
interface ApiKeyRow { org_id: string; tier: string }

async function validateApiKey(db: ReturnType<typeof createClient>, rawHeader: string | null): Promise<{ valid: false } | { valid: true; orgId: string }> {
  if (!rawHeader?.startsWith("Bearer ")) return { valid: false }
  const apiKey = rawHeader.slice(7).trim()
  if (!apiKey) return { valid: false }

  const { data } = await db
    .from("api_keys")
    .select("org_id, tier")
    .eq("api_key", apiKey)
    .maybeSingle()

  if (!data) return { valid: false }
  const row = data as ApiKeyRow
  if (row.tier !== "club") return { valid: false }  // club tier required
  return { valid: true, orgId: row.org_id }
}

// ── Endpoint handlers ─────────────────────────────────────────────────────────

async function handleSquad(db: ReturnType<typeof createClient>, orgId: string) {
  const { data, error } = await db
    .from("coach_athletes")
    .select("athlete_id, display_name, acwr_ratio, wellness_avg, acwr_status")
    .eq("coach_id", orgId)

  if (error) return err(500, error.message)

  const snapshot = (data ?? []).map((a: { display_name: string; acwr_ratio: number | null; wellness_avg: number | null; acwr_status: string | null }) => ({
    display_name: a.display_name,
    acwr:         a.acwr_ratio,
    wellness_avg: a.wellness_avg,
    risk_level:   a.acwr_status === "danger" ? "high" : a.acwr_status === "caution" ? "medium" : "low",
  }))

  return json({ athletes: snapshot, generated_at: new Date().toISOString() })
}

async function handleAthletLoad(db: ReturnType<typeof createClient>, athleteId: string, orgId: string) {
  // Verify athlete belongs to org
  const { data: link } = await db
    .from("coach_athletes")
    .select("athlete_id")
    .eq("coach_id", orgId)
    .eq("athlete_id", athleteId)
    .maybeSingle()

  if (!link) return err(403, "Athlete not found in your org")

  const cutoff = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10)
  const { data, error } = await db
    .from("training_log")
    .select("date, tss, rpe")
    .eq("user_id", athleteId)
    .gte("date", cutoff)
    .order("date", { ascending: true })

  if (error) return err(500, error.message)
  return json({ athlete_id: athleteId, days: data ?? [] })
}

async function handleSquadExport(db: ReturnType<typeof createClient>, orgId: string) {
  const { data: athletes } = await db
    .from("coach_athletes")
    .select("athlete_id, display_name")
    .eq("coach_id", orgId)

  if (!athletes?.length) return csv("athlete,week,total_tss,avg_rpe,sessions\n")

  const cutoff = new Date(Date.now() - 56 * 86400000).toISOString().slice(0, 10)
  const ids = athletes.map((a: { athlete_id: string }) => a.athlete_id)

  const { data: logs } = await db
    .from("training_log")
    .select("user_id, date, tss, rpe")
    .in("user_id", ids)
    .gte("date", cutoff)

  // Group by athlete + ISO week
  const nameMap = Object.fromEntries(athletes.map((a: { athlete_id: string; display_name: string }) => [a.athlete_id, a.display_name]))
  const weeks: Record<string, { tss: number; rpe: number[]; sessions: number }> = {}

  for (const row of (logs ?? []) as { user_id: string; date: string; tss: number; rpe: number }[]) {
    const d = new Date(row.date)
    const week = `${d.getFullYear()}-W${String(Math.ceil(d.getDate() / 7)).padStart(2, "0")}`
    const key  = `${nameMap[row.user_id] ?? row.user_id}___${week}`
    if (!weeks[key]) weeks[key] = { tss: 0, rpe: [], sessions: 0 }
    weeks[key].tss += (row.tss ?? 0)
    if (row.rpe) weeks[key].rpe.push(row.rpe)
    weeks[key].sessions++
  }

  const lines = ["athlete,week,total_tss,avg_rpe,sessions"]
  for (const [key, v] of Object.entries(weeks)) {
    const [athlete, week] = key.split("___")
    const avgRpe = v.rpe.length ? Math.round(v.rpe.reduce((a, b) => a + b, 0) / v.rpe.length * 10) / 10 : ""
    lines.push(`"${athlete}","${week}",${Math.round(v.tss)},${avgRpe},${v.sessions}`)
  }

  return csv(lines.join("\n"))
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS })
  if (req.method !== "GET")    return err(405, "Method not allowed")

  const db = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  )

  // Auth
  const authHeader = req.headers.get("Authorization")
  const auth = await validateApiKey(db, authHeader)
  if (!auth.valid) return err(401, "Invalid or missing API key. Club tier required.")

  const { orgId } = auth as { valid: true; orgId: string }
  const url = new URL(req.url)
  const path = url.pathname.replace(/\/functions\/v1\/public-api/, "")

  // Rate limit
  const apiKey = (authHeader ?? "").slice(7).trim()
  const allowed = await checkRateLimit(db, apiKey)
  if (!allowed) return err(429, "Rate limit exceeded — 100 req/hour per key")
  await logRequest(db, apiKey, orgId, path)

  // Route
  if (path === "/api/v1/squad")         return handleSquad(db, orgId)
  if (path === "/api/v1/squad/export")  return handleSquadExport(db, orgId)
  if (/^\/api\/v1\/athlete\/[^/]+\/load$/.test(path)) {
    const athleteId = path.split("/")[4]
    return handleAthletLoad(db, athleteId, orgId)
  }

  return err(404, "Unknown endpoint. See function header for available endpoints.")
})
