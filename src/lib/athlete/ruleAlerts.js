// ─── ruleAlerts.js — Compute coaching alert inputs and dispatch to getAthleteInsights ──
import { getAthleteInsights } from '../ruleInsights.js'
import { calculateACWR } from '../trainingLoad.js'

// ─── wellnessScore100 ─────────────────────────────────────────────────────────
// Compute wellness average (0–100) from a single recovery entry.
// Maps (sleep + energy + (6-soreness) + (6-stress) + mood) across 5 fields, each 1–5.
// Each mapped to 0–100, then average. Returns 50 if entry is null.
export function wellnessScore100(entry) {
  if (!entry || typeof entry !== 'object') return 50

  const rawFields = [
    entry.sleep,
    entry.energy,
    entry.soreness != null ? 6 - entry.soreness : null,
    entry.stress   != null ? 6 - entry.stress   : null,
    entry.mood,
  ]

  const components = rawFields
    .filter(v => v != null && !isNaN(v))
    .map(v => (v - 1) / 4 * 100)

  if (components.length === 0) return 50

  return Math.round(components.reduce((s, v) => s + v, 0) / components.length)
}

// ─── last7DayTSS ──────────────────────────────────────────────────────────────
// Compute last 7 days' daily TSS as an array [day-6, day-5, ..., today] (length 7).
// today: 'YYYY-MM-DD'. Fills with 0 for days with no session.
export function last7DayTSS(log = [], today = new Date().toISOString().slice(0, 10)) {
  const tssMap = {}
  for (const e of log) {
    if (!e.date) continue
    const d = e.date.slice(0, 10)
    tssMap[d] = (tssMap[d] || 0) + (e.tss || 0)
  }

  const result = []
  const base = new Date(today + 'T00:00:00Z')
  for (let i = 6; i >= 0; i--) {
    const d = new Date(base)
    d.setUTCDate(base.getUTCDate() - i)
    const key = d.toISOString().slice(0, 10)
    result.push(tssMap[key] || 0)
  }
  return result
}

// ─── last3DayFatigue ──────────────────────────────────────────────────────────
// Compute last 3 days' RPE-based fatigue scores as array [day-2, day-1, today].
// fatigue score per day = sum of (rpe / 10) for all sessions that day. 0 if no session.
export function last3DayFatigue(log = [], today = new Date().toISOString().slice(0, 10)) {
  const fatigueMap = {}
  for (const e of log) {
    if (!e.date) continue
    const d = e.date.slice(0, 10)
    fatigueMap[d] = (fatigueMap[d] || 0) + ((e.rpe || 0) / 10)
  }

  const result = []
  const base = new Date(today + 'T00:00:00Z')
  for (let i = 2; i >= 0; i--) {
    const d = new Date(base)
    d.setUTCDate(base.getUTCDate() - i)
    const key = d.toISOString().slice(0, 10)
    result.push(fatigueMap[key] || 0)
  }
  return result
}

// ─── consecutiveTrainingDays ──────────────────────────────────────────────────
// Count consecutive training days ending on `today`.
// A day counts if at least one log entry exists for it.
export function consecutiveTrainingDays(log = [], today = new Date().toISOString().slice(0, 10)) {
  const sessionDates = new Set(
    log
      .filter(e => e.date)
      .map(e => e.date.slice(0, 10))
  )

  let count = 0
  const base = new Date(today + 'T00:00:00Z')
  for (let i = 0; i < 365; i++) {
    const d = new Date(base)
    d.setUTCDate(base.getUTCDate() - i)
    const key = d.toISOString().slice(0, 10)
    if (sessionDates.has(key)) {
      count++
    } else {
      break
    }
  }
  return count
}

// ─── computeRuleAlerts ────────────────────────────────────────────────────────
// Build athleteData and call getAthleteInsights.
// latestRecovery: most recent recovery entry sorted by date, or null.
// Returns alerts array (may be empty); never throws.
export function computeRuleAlerts(log = [], recovery = [], today = new Date().toISOString().slice(0, 10)) {
  try {
    // Find the most recent recovery entry
    const sorted = [...recovery].filter(e => e.date).sort((a, b) => b.date.localeCompare(a.date))
    const latestRecovery = sorted[0] || null

    const acwrResult = calculateACWR(log)
    const acwr = acwrResult ? acwrResult.ratio : null

    const athleteData = {
      acwr,
      wellnessAvg:             wellnessScore100(latestRecovery),
      loads7days:              last7DayTSS(log, today),
      fatigueScores3days:      last3DayFatigue(log, today),
      consecutiveTrainingDays: consecutiveTrainingDays(log, today),
    }

    return getAthleteInsights(athleteData)
  } catch {
    return []
  }
}
