/** @jsxImportSource https://esm.sh/react@18.2.0 */
// ─── generate-report/index.ts — PDF report generation edge function ───────────
// Input:  POST { kind: 'weekly'|'monthly_squad'|'race_readiness', params: {} }
//         OR   POST { source: 'pg_cron', batch: 'weekly'|'monthly_squad' } (batch mode)
// Output: { signedUrl, reportId, expiresAt, storagePath }
//
// @react-pdf/renderer v3.4.4 runs in Deno without a browser (pure JS renderer).

import { serve }        from "https://deno.land/std@0.177.0/http/server.ts"
import { withTelemetry } from '../_shared/telemetry.ts'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import React            from "https://esm.sh/react@18.2.0"
import { pdf }          from "https://esm.sh/@react-pdf/renderer@3.4.4?deps=react@18.2.0"

import { WeeklyAthleteReport }  from "./templates/WeeklyAthleteReport.tsx"
import { MonthlySquadReport }   from "./templates/MonthlySquadReport.tsx"
import { RaceReadinessReport }  from "./templates/RaceReadinessReport.tsx"
import type { WeeklyReportData }   from "./templates/WeeklyAthleteReport.tsx"
import type { MonthlySquadData }   from "./templates/MonthlySquadReport.tsx"
import type { RaceReadinessData }  from "./templates/RaceReadinessReport.tsx"

const SUPABASE_URL    = Deno.env.get("SUPABASE_URL")!
const SERVICE_KEY     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
const SIGNED_URL_TTL  = 604800    // 7 days in seconds
const REPORT_TTL_DAYS = 30

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  })
}

function err(msg: string, status = 400) {
  return json({ error: msg }, status)
}

// ── Auth helper ───────────────────────────────────────────────────────────────
function isServiceRole(authHeader: string | null): boolean {
  if (!authHeader) return false
  try {
    const token = authHeader.replace("Bearer ", "")
    const [, payloadB64] = token.split(".")
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")))
    return payload?.role === "service_role"
  } catch { return false }
}

// ── Riegel race time predictor ────────────────────────────────────────────────
function riegel(t1Secs: number, d1: number, d2: number): number {
  return t1Secs * Math.pow(d2 / d1, 1.06)
}

function secsToHMS(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = Math.round(secs % 60)
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

// ── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchWeeklyData(sb: ReturnType<typeof createClient>, userId: string, weekStart: string): Promise<WeeklyReportData> {
  const weekEnd = new Date(new Date(weekStart).getTime() + 6 * 86400000).toISOString().slice(0, 10)

  const [profileRes, sessionsRes, metricsRes, insightsRes] = await Promise.all([
    sb.from("profiles").select("display_name, email").eq("id", userId).single(),
    sb.from("training_log")
      .select("id, date, type, duration_min, tss, rpe, notes, created_at")
      .eq("user_id", userId)
      .gte("date", weekStart).lte("date", weekEnd)
      .order("date", { ascending: true }),
    sb.from("mv_ctl_atl_daily")
      .select("ctl, atl, tsb, tss, date")
      .eq("user_id", userId)
      .lte("date", weekEnd)
      .order("date", { ascending: false })
      .limit(1),
    sb.from("ai_insights")
      .select("kind, insight_json, created_at")
      .eq("athlete_id", userId)
      .gte("created_at", weekStart + "T00:00:00Z")
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  const profile   = profileRes.data  || { display_name: "Athlete", email: "" }
  const sessions  = (sessionsRes.data || []) as WeeklyReportData["sessions"]
  const mvRow     = metricsRes.data?.[0]
  const rawInsights = insightsRes.data || []
  const insights: WeeklyReportData["insights"] = rawInsights.map((row: { kind: string; insight_json: { text?: string } | null; created_at: string }) => ({
    kind:       row.kind || "daily",
    content:    row.insight_json?.text || "(no content)",
    created_at: row.created_at,
  }))

  const weekTss   = sessions.reduce((sum, s) => sum + (s.tss || 0), 0)
  const totalMins = sessions.reduce((sum, s) => sum + (s.duration_min || 0), 0)
  const rpeValues = sessions.filter(s => s.rpe != null).map(s => s.rpe!)
  const avgRpe    = rpeValues.length ? rpeValues.reduce((a, b) => a + b) / rpeValues.length : null

  return {
    athlete:     { display_name: profile.display_name || "Athlete", email: profile.email || "" },
    weekStart, weekEnd,
    metrics: {
      ctl:              mvRow?.ctl_42d        ?? 0,
      atl:              mvRow?.atl_7d        ?? 0,
      tsb:              (mvRow?.ctl_42d ?? 0) - (mvRow?.atl_7d ?? 0),
      weekTss:          weekTss,
      sessionsCount:    sessions.length,
      totalDurationMin: totalMins,
      avgRpe:           avgRpe,
    },
    sessions, insights,
    suggestedFocus: undefined,
  }
}

async function fetchMonthlySquadData(sb: ReturnType<typeof createClient>, coachId: string, month: string): Promise<MonthlySquadData> {
  const [year, mon] = month.split("-").map(Number)
  const monthStart  = `${month}-01`
  const monthEnd    = new Date(year, mon, 0).toISOString().slice(0, 10)  // last day of month

  const coachRes = await sb.from("profiles").select("display_name").eq("id", coachId).single()
  const athletesRes = await sb.from("coach_athletes")
    .select("athlete_id, profiles!coach_athletes_athlete_id_fkey(display_name)")
    .eq("coach_id", coachId).eq("status", "active")

  const athletes = athletesRes.data || []
  const athleteIds = athletes.map((a: { athlete_id: string }) => a.athlete_id)

  // Bulk fetch metrics for all athletes
  const [sessionsRes, metricsRes, injuriesRes] = await Promise.all([
    athleteIds.length
      ? sb.from("training_log")
          .select("user_id, date, tss, created_at")
          .in("user_id", athleteIds)
          .gte("date", monthStart).lte("date", monthEnd)
      : Promise.resolve({ data: [] }),
    athleteIds.length
      ? sb.from("mv_ctl_atl_daily")
          .select("user_id, ctl_42d, atl_7d, date")
          .in("user_id", athleteIds)
          .lte("date", monthEnd)
          .order("date", { ascending: false })
      : Promise.resolve({ data: [] }),
    athleteIds.length
      ? sb.from("injuries")
          .select("user_id, description, created_at")
          .in("user_id", athleteIds)
          .gte("created_at", monthStart + "T00:00:00Z")
      : Promise.resolve({ data: [] }),
  ])

  const allSessions = sessionsRes.data || []
  const allMetrics  = metricsRes.data  || []
  const allInjuries = injuriesRes.data || []

  // 4-week TSS buckets
  const weekBuckets: string[] = []
  for (let w = 3; w >= 0; w--) {
    const d = new Date(new Date(monthEnd).getTime() - w * 7 * 86400000)
    weekBuckets.push(d.toISOString().slice(0, 10))
  }

  type RawAthlete = { athlete_id: string; profiles: { display_name: string } | null }
  const athleteList = athletes.map((a: RawAthlete) => {
    const id = a.athlete_id
    const name = (a.profiles as { display_name: string } | null)?.display_name || "Athlete"

    const myMetrics = allMetrics.filter((m: { user_id: string }) => m.user_id === id)
    const latestRaw = myMetrics[0] || { ctl_42d: 0, atl_7d: 0 }
    const latestMetric = {
      ctl: latestRaw.ctl_42d ?? 0,
      atl: latestRaw.atl_7d  ?? 0,
      tsb: (latestRaw.ctl_42d ?? 0) - (latestRaw.atl_7d ?? 0),
    }

    const mySessions = allSessions.filter((s: { user_id: string }) => s.user_id === id)

    // Weekly TSS buckets (last 4 weeks)
    const weeklyTss = weekBuckets.map((wStart, wi) => {
      const wEnd = wi < 3 ? weekBuckets[wi + 1] : monthEnd
      return mySessions
        .filter((s: { date: string }) => s.date >= wStart && s.date < wEnd)
        .reduce((sum: number, s: { tss: number | null }) => sum + (s.tss || 0), 0)
    })

    const myInjuries = allInjuries.filter((i: { user_id: string }) => i.user_id === id)

    const flags: string[] = []
    if (myInjuries.length) flags.push(`Injury logged: ${myInjuries[0].description?.slice(0, 40) || "see record"}`)
    if (latestMetric.tsb < -20) flags.push("High fatigue (TSB < -20)")
    const acwr = latestMetric.atl && latestMetric.ctl ? latestMetric.atl / latestMetric.ctl : 0
    if (acwr > 1.5) flags.push("High ACWR (overload risk)")

    return {
      athlete_id:    id,
      display_name:  name,
      ctl:           latestMetric.ctl,
      atl:           latestMetric.atl,
      tsb:           latestMetric.tsb,
      weeklyTss,
      sessionsCount: mySessions.length,
      flags,
    }
  })

  return {
    coach:      { display_name: coachRes.data?.display_name || "Coach" },
    month,
    monthStart,
    monthEnd,
    athletes:   athleteList,
  }
}

async function fetchRaceReadinessData(sb: ReturnType<typeof createClient>, userId: string, params: Record<string, unknown>): Promise<RaceReadinessData> {
  const raceDate     = (params.race_date as string) || new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  const raceName     = (params.race_name as string) || "Upcoming Race"
  const raceDistKm   = Number(params.race_distance_km) || 42.195
  const raceSport    = (params.race_sport as string) || "run"

  const eightWeeksAgo = new Date(Date.now() - 56 * 86400000).toISOString().slice(0, 10)
  const daysToRace    = Math.max(0, Math.ceil((new Date(raceDate).getTime() - Date.now()) / 86400000))

  const [profileRes, sessionsRes, metricsRes, raceResultRes, injuryRes] = await Promise.all([
    sb.from("profiles").select("display_name").eq("id", userId).single(),
    sb.from("training_log")
      .select("date, type, duration_min, tss, notes")
      .eq("user_id", userId)
      .gte("date", eightWeeksAgo)
      .order("date", { ascending: false })
      .limit(40),
    sb.from("mv_ctl_atl_daily")
      .select("ctl_42d, atl_7d")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(1),
    // Most recent race result for Riegel predictor (distance_m in metres, actual_s in seconds)
    sb.from("race_results")
      .select("distance_m, actual_s, date, notes")
      .eq("user_id", userId)
      .not("actual_s", "is", null)
      .order("date", { ascending: false })
      .limit(1),
    sb.from("injuries")
      .select("description, severity, created_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  const profile   = profileRes.data  || { display_name: "Athlete" }
  const sessions  = sessionsRes.data || []
  const mvRow     = metricsRes.data?.[0]
  const raceRow   = raceResultRes.data?.[0]
  const injuries  = injuryRes.data   || []

  // Riegel prediction from most recent race result
  let predictedTime: string | null = null
  let predictionBasis: string | undefined
  if (raceRow?.actual_s && raceRow?.distance_m) {
    try {
      const knownTimeSecs = Number(raceRow.actual_s)
      const knownDistKm   = Number(raceRow.distance_m) / 1000
      if (knownTimeSecs > 0 && knownDistKm > 0 && raceDistKm > 0) {
        const predicted   = riegel(knownTimeSecs, knownDistKm, raceDistKm)
        predictedTime     = secsToHMS(predicted)
        predictionBasis   = `Based on ${knownDistKm.toFixed(1)}km ${raceSport} in ${secsToHMS(knownTimeSecs)} (${raceRow.date})`
      }
    } catch { /* skip if math fails */ }
  }

  const m    = { ctl: mvRow?.ctl_42d ?? 0, atl: mvRow?.atl_7d ?? 0, tsb: (mvRow?.ctl_42d ?? 0) - (mvRow?.atl_7d ?? 0) }
  const tsbN = m.tsb
  const taperStatus: RaceReadinessData["taperStatus"] =
    tsbN > 10 ? "fresh" : tsbN < -10 ? "fatigued" : "trained"

  // Readiness score: 60-point form basis + 20-point fitness basis + 20-point injury penalty
  const formScore    = Math.max(0, Math.min(60, 30 + tsbN * 1.5))
  const fitnessScore = Math.max(0, Math.min(20, (m.ctl / 100) * 20))
  const injuryPenalty = injuries.length * 8
  const readinessScore = Math.round(Math.max(0, Math.min(100, formScore + fitnessScore - injuryPenalty)))

  const injuryFlags = injuries.map((i: { description: string; severity: string }) =>
    `${i.description?.slice(0, 60) || "Injury"} (${i.severity || "unknown severity"})`
  )

  return {
    athlete:        { display_name: profile.display_name || "Athlete" },
    race:           { name: raceName, date: raceDate, distance_km: raceDistKm, sport: raceSport },
    predictedTime,
    predictionBasis,
    taperStatus,
    readinessScore,
    metrics:        { ctl: m.ctl || 0, atl: m.atl || 0, tsb: m.tsb || 0 },
    recentSessions: (sessions as RaceReadinessData["recentSessions"]).slice(0, 12),
    injuryFlags,
    daysToRace,
  }
}

// ── PDF rendering ─────────────────────────────────────────────────────────────

async function renderPdf(kind: string, data: WeeklyReportData | MonthlySquadData | RaceReadinessData): Promise<Uint8Array> {
  let element: React.ReactElement

  switch (kind) {
    case "weekly":
      element = React.createElement(WeeklyAthleteReport, { data: data as WeeklyReportData })
      break
    case "monthly_squad":
      element = React.createElement(MonthlySquadReport, { data: data as MonthlySquadData })
      break
    case "race_readiness":
      element = React.createElement(RaceReadinessReport, { data: data as RaceReadinessData })
      break
    default:
      throw new Error(`Unknown report kind: ${kind}`)
  }

  const pdfInstance = pdf(element)
  const buffer      = await pdfInstance.toBuffer()
  return new Uint8Array(buffer)
}

// ── Single report generation ──────────────────────────────────────────────────

async function generateOne(
  sb: ReturnType<typeof createClient>,
  userId: string,
  kind: string,
  params: Record<string, unknown>
): Promise<{ signedUrl: string; reportId: string; expiresAt: string; storagePath: string }> {
  const today       = new Date().toISOString().slice(0, 10)
  const storagePath = `${userId}/${kind}/${today}.pdf`
  const expiresAt   = new Date(Date.now() + REPORT_TTL_DAYS * 86400000).toISOString()

  // Fetch data for this report kind
  let data: WeeklyReportData | MonthlySquadData | RaceReadinessData
  if (kind === "weekly") {
    const weekStart = (params.week_start as string) || getPreviousMonday()
    data = await fetchWeeklyData(sb, userId, weekStart)
  } else if (kind === "monthly_squad") {
    const month = (params.month as string) || getPreviousMonth()
    data = await fetchMonthlySquadData(sb, userId, month)
  } else {
    data = await fetchRaceReadinessData(sb, userId, params)
  }

  // Render PDF
  const pdfBytes = await renderPdf(kind, data)

  // Upload to storage
  const { error: uploadErr } = await sb.storage
    .from("reports")
    .upload(storagePath, pdfBytes, {
      contentType: "application/pdf",
      upsert:      true,
    })
  if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`)

  // Insert generated_reports row
  const { data: rowData, error: insertErr } = await sb
    .from("generated_reports")
    .insert({ user_id: userId, kind, storage_path: storagePath, params, expires_at: expiresAt })
    .select("id")
    .single()
  if (insertErr) throw new Error(`DB insert failed: ${insertErr.message}`)

  // Create signed URL (7 days)
  const { data: urlData, error: urlErr } = await sb.storage
    .from("reports")
    .createSignedUrl(storagePath, SIGNED_URL_TTL)
  if (urlErr) throw new Error(`Signed URL failed: ${urlErr.message}`)

  return {
    signedUrl:   urlData!.signedUrl,
    reportId:    rowData!.id,
    expiresAt,
    storagePath,
  }
}

// ── Batch helpers ─────────────────────────────────────────────────────────────

function getPreviousMonday(): string {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))  // Monday this week
  d.setDate(d.getDate() - 7)  // Previous Monday
  return d.toISOString().slice(0, 10)
}

function getPreviousMonth(): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 7)
}

async function runWeeklyBatch(sb: ReturnType<typeof createClient>): Promise<{ processed: number; errors: number }> {
  // Find all users with coach/club tier that have email_reports or are auto-scheduled
  const { data: profiles } = await sb
    .from("profiles")
    .select("id, subscription_tier, email_reports")
    .in("subscription_tier", ["coach", "club"])

  if (!profiles?.length) return { processed: 0, errors: 0 }

  let processed = 0, errors = 0
  const weekStart = getPreviousMonday()

  // Process with concurrency limit 5
  for (let i = 0; i < profiles.length; i += 5) {
    const batch = profiles.slice(i, i + 5)
    await Promise.allSettled(
      batch.map(async (p: { id: string; email_reports: boolean }) => {
        try {
          await generateOne(sb, p.id, "weekly", { week_start: weekStart })
          processed++
        } catch (e) {
          console.error(`Weekly report failed for ${p.id}:`, e)
          errors++
        }
      })
    )
  }

  return { processed, errors }
}

async function runMonthlySquadBatch(sb: ReturnType<typeof createClient>): Promise<{ processed: number; errors: number }> {
  // Find all coaches
  const { data: coaches } = await sb
    .from("profiles")
    .select("id")
    .in("subscription_tier", ["coach", "club"])
    .eq("role", "coach")

  if (!coaches?.length) return { processed: 0, errors: 0 }

  let processed = 0, errors = 0
  const month = getPreviousMonth()

  for (let i = 0; i < coaches.length; i += 3) {
    const batch = coaches.slice(i, i + 3)
    await Promise.allSettled(
      batch.map(async (c: { id: string }) => {
        try {
          await generateOne(sb, c.id, "monthly_squad", { month })
          processed++
        } catch (e) {
          console.error(`Monthly squad report failed for ${c.id}:`, e)
          errors++
        }
      })
    )
  }

  return { processed, errors }
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(withTelemetry('generate-report', async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS })
  if (req.method !== "POST")    return err("Method not allowed", 405)

  const authHeader = req.headers.get("authorization")
  const serviceRole = isServiceRole(authHeader)

  const sb = createClient(SUPABASE_URL, SERVICE_KEY)  // always service for storage access

  let body: { kind?: string; params?: Record<string, unknown>; source?: string; batch?: string }
  try { body = await req.json() } catch { return err("Invalid JSON") }

  // ── Batch mode (pg_cron) ──────────────────────────────────────────────────
  if (body.source === "pg_cron" && body.batch) {
    if (!serviceRole) return err("Forbidden", 403)
    try {
      if (body.batch === "weekly") {
        const result = await runWeeklyBatch(sb)
        return json({ ok: true, ...result })
      }
      if (body.batch === "monthly_squad") {
        const result = await runMonthlySquadBatch(sb)
        return json({ ok: true, ...result })
      }
      return err(`Unknown batch: ${body.batch}`)
    } catch (e) {
      return err(`Batch failed: ${(e as Error).message}`, 500)
    }
  }

  // ── On-demand mode (user request) ─────────────────────────────────────────
  const { kind, params = {} } = body

  if (!kind || !["weekly", "monthly_squad", "race_readiness"].includes(kind)) {
    return err("kind must be weekly | monthly_squad | race_readiness")
  }

  // Get userId from JWT
  let userId: string
  if (serviceRole && params.user_id) {
    userId = params.user_id as string
  } else {
    // User JWT path
    const userSb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader || "" } },
    })
    const { data: { user }, error: authErr } = await userSb.auth.getUser()
    if (authErr || !user) return err("Unauthorized", 401)
    userId = user.id

    // Tier check for squad/race reports
    if (kind !== "weekly") {
      const { data: profile } = await sb.from("profiles").select("subscription_tier").eq("id", userId).single()
      const tier = profile?.subscription_tier || "free"
      if (tier === "free") return err("Coach or Club plan required for this report type", 403)
    }
  }

  try {
    const result = await generateOne(sb, userId, kind, params)
    return json({ ok: true, ...result })
  } catch (e) {
    console.error("generate-report error:", e)
    return err(`Report generation failed: ${(e as Error).message}`, 500)
  }
}))
