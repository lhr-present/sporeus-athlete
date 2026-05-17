// src/lib/athlete/tsbFreshnessBand.js
//
// Pure fn: classifies the athlete's current Training Stress Balance (TSB)
// into actionable freshness bands and reports the 28-day TSB history plus
// a 7-day trend direction. Wraps the existing `calcLoad` daily TSB output
// from src/lib/formulas.js (Banister impulse-response PMC: CTL=42d EMA,
// ATL=7d EMA, TSB=CTL−ATL).
//
// Bands (Banister 1975; Coggan & Allen 2010):
//   VERY_FRESH    TSB > +25      — race-ready, but undertrained if sustained
//   FRESH         +5 < TSB ≤ +25 — race-tapered window
//   NEUTRAL       −10 < TSB ≤ +5 — productive training
//   FATIGUED      −20 < TSB ≤ −10 — load accumulation
//   VERY_FATIGUED TSB ≤ −20      — overreaching risk
//
// Returns null when the log is empty so the card can render nothing.

export const TSB_FRESHNESS_CITATION = 'Banister 1975; Coggan & Allen 2010'

/**
 * Classify a numeric TSB value into a band code.
 * @param {number} tsb
 * @returns {'VERY_FRESH'|'FRESH'|'NEUTRAL'|'FATIGUED'|'VERY_FATIGUED'}
 */
export function bandForTsb(tsb) {
  if (tsb > 25) return 'VERY_FRESH'
  if (tsb > 5) return 'FRESH'
  if (tsb > -10) return 'NEUTRAL'
  if (tsb > -20) return 'FATIGUED'
  return 'VERY_FATIGUED'
}

function parseISODate(s) {
  if (!s || typeof s !== 'string') return null
  const d = new Date(s + 'T00:00:00Z')
  return Number.isNaN(d.getTime()) ? null : d
}

function resolveToday(today) {
  if (today instanceof Date && !Number.isNaN(today.getTime())) {
    return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  }
  if (typeof today === 'string' && today) {
    return parseISODate(today.slice(0, 10))
  }
  const n = new Date()
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()))
}

/**
 * Iterate Banister PMC across all logged dates up to `endDate` and return
 * per-day TSB. Mirrors the EMA constants used in calcLoad in
 * src/lib/formulas.js (kA = 2/(7+1), kC = 2/(42+1)).
 *
 * @param {Array<{date:string, tss?:number}>} log
 * @param {Date} endDate - inclusive end-of-window (UTC midnight)
 * @returns {Array<{date:string, tsb:number}>}
 */
function fullTsbSeries(log, endDate) {
  if (!Array.isArray(log) || log.length === 0) return []
  const byDate = {}
  for (const e of log) {
    if (!e || !e.date) continue
    byDate[e.date] = (byDate[e.date] || 0) + (e.tss || 0)
  }
  const sortedKeys = Object.keys(byDate).sort()
  if (sortedKeys.length === 0) return []
  const start = parseISODate(sortedKeys[0])
  if (!start) return []
  if (start > endDate) return []
  let atl = 0, ctl = 0
  const kA = 2 / (7 + 1)
  const kC = 2 / (42 + 1)
  const series = []
  for (let d = new Date(start); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
    const ds = d.toISOString().slice(0, 10)
    const tss = byDate[ds] || 0
    atl = tss * kA + atl * (1 - kA)
    ctl = tss * kC + ctl * (1 - kC)
    series.push({ date: ds, tsb: Math.round(ctl - atl) })
  }
  return series
}

/**
 * @typedef {Object} TsbFreshnessResult
 * @property {number} currentTsb
 * @property {'VERY_FRESH'|'FRESH'|'NEUTRAL'|'FATIGUED'|'VERY_FATIGUED'} band
 * @property {'rising'|'falling'|'stable'} trend7d
 * @property {string} citation
 * @property {Array<{date:string, tsb:number}>} tsbHistory
 */

/**
 * Classify the athlete's current TSB freshness state.
 *
 * @param {Object}   args
 * @param {Array}    args.log         - training log entries
 * @param {Date|string} [args.today]  - reference date (defaults to today UTC)
 * @param {number}   [args.trendDays] - window for tsbHistory (default 28)
 * @returns {TsbFreshnessResult|null}
 */
export function classifyTsbFreshness({ log, today, trendDays = 28 } = {}) {
  if (!Array.isArray(log) || log.length === 0) return null

  const refToday = resolveToday(today)
  if (!refToday) return null

  // Build a daily TSB series across the entire log up to refToday so the
  // current value, trend, and history all share the same anchor.
  const series = fullTsbSeries(log, refToday)
  if (series.length === 0) return null

  const currentTsb = series[series.length - 1].tsb
  const band = bandForTsb(currentTsb)

  // Slice the trailing window for the sparkline.
  const windowDays = Math.max(1, parseInt(trendDays, 10) || 28)
  const tsbHistory = series.length > windowDays ? series.slice(-windowDays) : series

  // 7-day trend: TSB(today) − TSB(7d ago). If the log is shorter than
  // 7 prior days, fall back to first-vs-last in the available series.
  let trend7d = 'stable'
  const len = series.length
  if (len >= 2) {
    const last = series[len - 1].tsb
    const ref = len >= 8 ? series[len - 8].tsb : series[0].tsb
    const delta = last - ref
    if (delta > 1) trend7d = 'rising'
    else if (delta < -1) trend7d = 'falling'
    else trend7d = 'stable'
  }

  return {
    currentTsb,
    band,
    trend7d,
    citation: TSB_FRESHNESS_CITATION,
    tsbHistory,
  }
}
