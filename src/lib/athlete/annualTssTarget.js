// src/lib/athlete/annualTssTarget.js
// Annual TSS projection: forward-projects year-end total TSS from YTD pace,
// classifies it against published elite-endurance annual load benchmarks.
//
// Distinct from YearOverYearCard (compares to last year) and SeasonStatsCard
// (annual snapshot of completed work). This card answers: "at the pace I'm
// going, where will I land at year-end, and what tier does that put me in?"
//
// Benchmarks: Tønnessen 2014 ("Training Olympic-Level Elite Endurance
// Athletes") documents elite annual load distributions in the 2500-5000 TSS
// range. Hellard 2019 ("Quantifying the relationship between training load
// and performance") provides the load-to-adaptation framing.
//
// Pure module. No React, no I/O.
//
// Inputs:
//   log: array of training sessions, each shaped { date, tss, ... }
//        — `date` is 'YYYY-MM-DD'.
//   today: ISO 'YYYY-MM-DD' string (defaults to the real today, UTC).
//
// Output: see analyzeAnnualTssTarget() return shape, or `null` when it's too
// early in the year to project (< 14 days) or there's no TSS logged yet.

const CITATION = 'Hellard 2019; Tønnessen 2014'

const ELITE_ENDURANCE_THRESHOLD = 5000
const COMPETITIVE_THRESHOLD     = 3000
const CONSISTENT_THRESHOLD      = 1500
const DEVELOPING_THRESHOLD      = 500

const MIN_DAYS_TO_PROJECT = 14

/**
 * Internal: is `year` a leap year (Gregorian)?
 */
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0)
}

/**
 * Internal: total days in `year` (365 or 366).
 */
function daysInYear(year) {
  return isLeapYear(year) ? 366 : 365
}

/**
 * Internal: day-of-year (1-based) for a 'YYYY-MM-DD' string. UTC-anchored to
 * match the same UTC-day semantics used elsewhere in athlete libs.
 */
function dayOfYear(isoDate) {
  const year = Number(isoDate.slice(0, 4))
  const startMs = Date.UTC(year, 0, 1)
  const todayMs = new Date(isoDate + 'T00:00:00Z').getTime()
  return Math.floor((todayMs - startMs) / 86400000) + 1
}

/**
 * Internal: classify projection into one of five bands.
 */
function classifyBand(projectedAnnualTss) {
  if (!Number.isFinite(projectedAnnualTss)) return 'CASUAL'
  if (projectedAnnualTss >= ELITE_ENDURANCE_THRESHOLD) return 'ELITE_ENDURANCE'
  if (projectedAnnualTss >= COMPETITIVE_THRESHOLD)     return 'COMPETITIVE'
  if (projectedAnnualTss >= CONSISTENT_THRESHOLD)      return 'CONSISTENT'
  if (projectedAnnualTss >= DEVELOPING_THRESHOLD)      return 'DEVELOPING'
  return 'CASUAL'
}

/**
 * analyzeAnnualTssTarget({ log, today })
 *
 * Sums TSS from Jan 1 of today's year through today, then linearly extrapolates
 * to the year-end based on days elapsed. Classifies the projection against
 * elite-endurance annual load benchmarks (Tønnessen 2014).
 *
 * Returns null when daysIntoYear < 14 (too early to project) or ytdTss = 0.
 */
export function analyzeAnnualTssTarget({ log, today } = {}) {
  if (!Array.isArray(log)) return null

  const todayStr = typeof today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(today)
    ? today
    : new Date().toISOString().slice(0, 10)

  const year = Number(todayStr.slice(0, 4))
  const yearStart = `${year}-01-01`

  let ytdTss = 0
  for (const e of log) {
    const d = e?.date
    if (typeof d !== 'string') continue
    if (d < yearStart || d > todayStr) continue
    const t = Number(e?.tss)
    if (Number.isFinite(t)) ytdTss += t
  }

  const daysIntoYear = dayOfYear(todayStr)
  const totalDaysInYear = daysInYear(year)

  if (daysIntoYear < MIN_DAYS_TO_PROJECT) return null
  if (ytdTss <= 0) return null

  const projectedAnnualTss = ytdTss * (totalDaysInYear / daysIntoYear)
  const weeklyAvgPace = ytdTss / (daysIntoYear / 7)
  const band = classifyBand(projectedAnnualTss)

  return {
    band,
    ytdTss,
    projectedAnnualTss,
    weeklyAvgPace,
    daysIntoYear,
    totalDaysInYear,
    citation: CITATION,
  }
}

export default analyzeAnnualTssTarget
