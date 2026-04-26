// ─── injuryForecast.js — Rolling injury risk history + 4-week projection ─────
// Based on Malone 2017, Gabbett 2016, Hulin 2016
// ─────────────────────────────────────────────────────────────────────────────

import { predictInjuryRisk } from '../intelligence.js'

export const INJURY_RISK_CITATION = 'Malone 2017 · Gabbett 2016 · Hulin 2016'

// ─── riskBand ─────────────────────────────────────────────────────────────────
/**
 * Classify a numeric risk score (0–100) into a band string.
 * @param {number} score
 * @returns {'low'|'moderate'|'high'}
 */
export function riskBand(score) {
  if (score <= 30) return 'low'
  if (score <= 60) return 'moderate'
  return 'high'
}

// ─── ISO week helpers ─────────────────────────────────────────────────────────
/**
 * Return the ISO week string ('YYYY-Www') for a given Date.
 */
function toISOWeekString(date) {
  // Clone to avoid mutation
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  // ISO week: week containing Thursday; Jan 4 is always in week 1
  const dayNum = d.getUTCDay() || 7 // 1=Mon … 7=Sun
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  const y = d.getUTCFullYear()
  return `${y}-W${String(weekNo).padStart(2, '0')}`
}

/**
 * Return the Sunday (end-of-week) of the ISO week that contains `date`.
 * ISO week: Mon–Sun.
 */
function sundayOfWeekContaining(date) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun, 1=Mon …
  // Days until Sunday: if day===0 → +0, else → +(7-day)
  const daysUntilSunday = day === 0 ? 0 : 7 - day
  d.setDate(d.getDate() + daysUntilSunday)
  return d
}

/**
 * Return the Monday that starts the ISO week containing `date`.
 */
function _mondayOfWeekContaining(date) {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun
  const daysBack = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - daysBack)
  return d
}

/**
 * Add `days` to a Date and return a new Date.
 */
function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Format a Date as 'YYYY-MM-DD'.
 */
function toDateStr(date) {
  return date.toISOString().slice(0, 10)
}

// ─── injuryRiskHistory ────────────────────────────────────────────────────────
/**
 * Compute rolling 8-week injury risk history.
 *
 * For each of the last `weeks` ISO weeks ending on `today`, slice the log up to
 * that week's Sunday (inclusive) and call predictInjuryRisk with that slice and
 * the full recovery array. Extract the numeric risk score from the result.
 *
 * @param {Array}  log      - training log entries ({ date, tss, rpe, type, … })
 * @param {Array}  recovery - recovery entries
 * @param {number} weeks    - number of weeks to include (default 8)
 * @param {string} today    - 'YYYY-MM-DD' string (default: today)
 * @returns {Array<{isoWeek:string, score:number, band:string}>} sorted oldest→newest
 */
export function injuryRiskHistory(
  log = [],
  recovery = [],
  weeks = 8,
  today = new Date().toISOString().slice(0, 10),
) {
  if (log.length < 7) return []

  const todayDate = new Date(today + 'T00:00:00')
  const results = []

  for (let w = weeks - 1; w >= 0; w--) {
    // Reference date: this week minus w weeks
    const refDate = addDays(todayDate, -w * 7)
    const weekSunday = sundayOfWeekContaining(refDate)
    const cutoffStr = toDateStr(weekSunday)
    const isoWeek = toISOWeekString(weekSunday)

    // Slice log up to and including the Sunday of this week
    const slicedLog = log.filter(e => e.date <= cutoffStr)

    if (slicedLog.length === 0) {
      results.push({ isoWeek, score: 0, band: 'low' })
      continue
    }

    const result = predictInjuryRisk(slicedLog, recovery)
    const score = result.score ?? 0
    results.push({ isoWeek, score, band: riskBand(score) })
  }

  return results
}

// ─── projectInjuryRisk ────────────────────────────────────────────────────────
/**
 * Project injury risk 4 weeks forward using a simple load-continuation model.
 *
 * For each forward week, create a simulated log by extending the actual log with
 * synthetic sessions matching the previous 4-week mean weekly TSS and session count.
 * Each synthetic session: { date: futureDate, tss: meanTSS, rpe: meanRPE, type: dominantType }
 * Call predictInjuryRisk on the extended log and extract the score.
 *
 * @param {Array}  log          - training log entries
 * @param {Array}  recovery     - recovery entries
 * @param {number} forwardWeeks - number of weeks to project (default 4)
 * @param {string} today        - 'YYYY-MM-DD' string
 * @returns {Array<{isoWeek:string, score:number, band:string, projected:true}>}
 */
export function projectInjuryRisk(
  log = [],
  recovery = [],
  forwardWeeks = 4,
  today = new Date().toISOString().slice(0, 10),
) {
  if (log.length < 14) return []

  const todayDate = new Date(today + 'T00:00:00')

  // Compute 4-week baseline stats from the last 28 days
  const w4StartDate = addDays(todayDate, -28)
  const w4StartStr = toDateStr(w4StartDate)
  const last4wLog = log.filter(e => e.date >= w4StartStr && e.date <= today)

  // Weekly sessions over 4 weeks
  const weeklySessionCount = last4wLog.length / 4
  const sessionsPerWeek = Math.max(1, Math.round(weeklySessionCount))

  // Mean TSS per session (across 4 weeks)
  const totalTSS = last4wLog.reduce((s, e) => s + (e.tss || 0), 0)
  const meanTSS = last4wLog.length > 0 ? totalTSS / last4wLog.length : 50

  // Mean RPE
  const validRPE = last4wLog.filter(e => e.rpe != null)
  const meanRPE = validRPE.length > 0
    ? validRPE.reduce((s, e) => s + e.rpe, 0) / validRPE.length
    : 6

  // Dominant type
  const typeCounts = {}
  for (const e of last4wLog) {
    const t = e.type || 'run'
    typeCounts[t] = (typeCounts[t] || 0) + 1
  }
  const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'run'

  const results = []
  let extendedLog = [...log]

  for (let w = 1; w <= forwardWeeks; w++) {
    // Generate synthetic sessions for this forward week
    const weekStart = addDays(todayDate, (w - 1) * 7 + 1)
    const syntheticSessions = []

    for (let s = 0; s < sessionsPerWeek; s++) {
      const sessionDate = addDays(weekStart, Math.floor(s * (7 / sessionsPerWeek)))
      syntheticSessions.push({
        date: toDateStr(sessionDate),
        tss: Math.round(meanTSS),
        rpe: Math.round(meanRPE),
        type: dominantType,
      })
    }

    extendedLog = [...extendedLog, ...syntheticSessions]

    // Use the last day of this forward week as the reference for isoWeek
    const weekEnd = addDays(todayDate, w * 7)
    const isoWeek = toISOWeekString(weekEnd)

    const result = predictInjuryRisk(extendedLog, recovery)
    const score = result.score ?? 0
    results.push({ isoWeek, score, band: riskBand(score), projected: true })
  }

  return results
}

// ─── computeInjuryForecast ────────────────────────────────────────────────────
/**
 * Master function: returns { history, forecast, topFactor, citation }
 *   topFactor: from the LATEST predictInjuryRisk call — the factor with the
 *              highest severity contribution (high > moderate > low > none).
 * Returns null if log.length < 7.
 *
 * @param {Array}  log      - training log entries
 * @param {Array}  recovery - recovery entries
 * @param {string} today    - 'YYYY-MM-DD' string
 * @returns {{ history, forecast, topFactor, citation }|null}
 */
export function computeInjuryForecast(
  log = [],
  recovery = [],
  today = new Date().toISOString().slice(0, 10),
) {
  if (log.length < 7) return null

  const history = injuryRiskHistory(log, recovery, 8, today)
  const forecast = projectInjuryRisk(log, recovery, 4, today)

  // Latest risk call for topFactor
  const latest = predictInjuryRisk(log, recovery)
  const factors = latest.factors || []

  // Severity order: high > moderate > low
  const severityRank = { high: 3, moderate: 2, low: 1 }
  const topFactor = factors.reduce((best, f) => {
    const rank = severityRank[f.severity] || 0
    const bestRank = severityRank[best?.severity] || 0
    return rank > bestRank ? f : best
  }, factors[0] || null)

  return { history, forecast, topFactor, citation: INJURY_RISK_CITATION }
}
