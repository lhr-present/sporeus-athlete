// src/lib/science/aerobicEfficiency.js
// E20 — Aerobic Efficiency Factor Trend: weekly EF history + OLS trend classification.
//
// Efficiency Factor (EF) per week provides a robust signal of aerobic adaptation
// over multi-week training blocks. Weekly medians smooth day-to-day variation;
// OLS slope across weeks quantifies the rate of change.
//
// References:
//   Coggan A.R. (2003). Training and Racing with a Power Meter. VeloPress.
//   Allen H. & Coggan A.R. (2010). Training and Racing with a Power Meter (2nd ed.).

import { computeEF, EF_CITATION } from './efficiencyFactor.js'

export { EF_CITATION }

// ── isoWeekLabel ──────────────────────────────────────────────────────────────

/**
 * Return ISO week label for a date string 'YYYY-MM-DD'.
 * Returns e.g. '2026-W17'
 *
 * @param {string} dateStr - ISO date 'YYYY-MM-DD'
 * @returns {string}
 */
export function isoWeekLabel(dateStr) {
  // Parse as noon UTC to avoid date-boundary shifts across timezones.
  // ISO week: week containing the nearest Thursday; Mon=start of week.
  const d = new Date(dateStr + 'T12:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7  // Mon=0 … Sun=6
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - dow + 3))
  // First Thursday of the ISO year
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1))
  if (firstThursday.getUTCDay() !== 4) {
    firstThursday.setUTCDate(1 + ((4 - firstThursday.getUTCDay() + 7) % 7))
  }
  const weekNum = 1 + Math.round((thursday - firstThursday) / 604800000)
  return `${thursday.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

// ── weeklyEFHistory ───────────────────────────────────────────────────────────

/**
 * Group log sessions by ISO week, compute median EF per week.
 * Returns [] if fewer than 3 weeks have usable EF data.
 *
 * @param {Object[]} log     - Array of session objects
 * @param {number}   weeks   - Number of most-recent weeks to return (default 8)
 * @param {string}   today   - 'YYYY-MM-DD' string (default today)
 * @returns {{ isoWeek: string, ef: number, sessionCount: number }[]}
 *          sorted oldest→newest; only the last `weeks` ISO weeks up to and
 *          including the week containing `today`
 */
export function weeklyEFHistory(
  log = [],
  weeks = 8,
  today = new Date().toISOString().slice(0, 10),
) {
  if (!Array.isArray(log) || log.length === 0) return []

  const todayWeek = isoWeekLabel(today)

  // Build a map: isoWeek → [ef values]
  const weekMap = new Map()

  for (const session of log) {
    if (!session.date) continue
    const weekLabel = isoWeekLabel(session.date)
    // Only include weeks up to and including the week containing `today`
    if (weekLabel > todayWeek) continue

    const result = computeEF(session)
    if (result === null || result.ef === null) continue
    const ef = result.ef
    if (!Number.isFinite(ef) || ef <= 0) continue

    if (!weekMap.has(weekLabel)) weekMap.set(weekLabel, [])
    weekMap.get(weekLabel).push(ef)
  }

  if (weekMap.size === 0) return []

  // Sort all available week labels
  const sortedWeeks = [...weekMap.keys()].sort()

  // Take only the last `weeks` weeks
  const slicedWeeks = sortedWeeks.slice(-weeks)

  // Build output: compute median per week
  const result = slicedWeeks.map(isoWeek => {
    const vals = weekMap.get(isoWeek).sort((a, b) => a - b)
    const n = vals.length
    const mid = Math.floor(n / 2)
    const ef = n % 2 === 1 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2
    return { isoWeek, ef, sessionCount: n }
  })

  // Return [] if fewer than 3 weeks with usable EF
  if (result.length < 3) return []

  return result
}

// ── classifyEFTrend ───────────────────────────────────────────────────────────

/**
 * Classify EF trend using OLS slope on weekly EF history.
 *
 * @param {{ isoWeek: string, ef: number, sessionCount: number }[]} weeklyHistory
 * @returns {{
 *   slope: number,
 *   classification: 'improving'|'stable'|'declining',
 *   weeklyGain: number,
 * } | null}  null if history.length < 3
 */
export function classifyEFTrend(weeklyHistory = []) {
  if (!Array.isArray(weeklyHistory) || weeklyHistory.length < 3) return null

  const n = weeklyHistory.length
  // x = 0, 1, 2, ... (week index); y = ef values
  const xs = weeklyHistory.map((_, i) => i)
  const ys = weeklyHistory.map(w => w.ef)

  const xMean = xs.reduce((s, v) => s + v, 0) / n
  const yMean = ys.reduce((s, v) => s + v, 0) / n

  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (ys[i] - yMean)
    den += (xs[i] - xMean) ** 2
  }

  const slope = den === 0 ? 0 : num / den
  const weeklyGain = slope

  const classification =
    slope > 0.005  ? 'improving'  :
    slope < -0.005 ? 'declining'  :
                     'stable'

  return { slope, classification, weeklyGain }
}

// ── computeAerobicEfficiencyTrend ─────────────────────────────────────────────

/**
 * Master function: build weekly EF history and classify trend.
 *
 * @param {Object[]} log    - Training log sessions
 * @param {number}   nWeeks - Number of weeks to analyse (default 8)
 * @param {string}   today  - 'YYYY-MM-DD' string (default today)
 * @returns {{
 *   weeks: { isoWeek: string, ef: number, sessionCount: number }[],
 *   slope: number,
 *   weeklyGain: number,
 *   classification: 'improving'|'stable'|'declining',
 *   citation: string,
 * } | null}  null if insufficient data (< 3 weeks with EF)
 */
export function computeAerobicEfficiencyTrend(
  log = [],
  nWeeks = 8,
  today = new Date().toISOString().slice(0, 10),
) {
  const weeks = weeklyEFHistory(log, nWeeks, today)
  if (weeks.length < 3) return null

  const trend = classifyEFTrend(weeks)
  if (trend === null) return null

  return {
    weeks,
    slope:          trend.slope,
    weeklyGain:     trend.weeklyGain,
    classification: trend.classification,
    citation:       EF_CITATION,
  }
}
