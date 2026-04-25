// ─── hrvSummary.js — HRV Dashboard summary (pure functions) ──────────────────
// References: Plews 2012 (Int J Sports Physiol Perform), Kiviniemi 2007
// Uses 28-day rolling lnRMSSD baseline, readiness score, trend, suppression.
// ─────────────────────────────────────────────────────────────────────────────
import { computeHRVReadiness, computeHRVTrend, isHRVSuppressed } from '../hrv.js'

/**
 * Filter recovery entries to those with a valid positive hrv value.
 * Sort oldest→newest. Return [{ date, hrv }].
 * @param {Array<{date:string, hrv:number|null}>} recovery
 * @returns {Array<{date:string, hrv:number}>}
 */
export function extractHRVEntries(recovery = []) {
  if (!Array.isArray(recovery)) return []
  return recovery
    .filter(e => e && e.date && typeof e.hrv === 'number' && e.hrv > 0)
    .map(e => ({ date: e.date, hrv: e.hrv }))
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
}

/**
 * Compute 28-day rolling baseline: mean and SD of hrv values from entries
 * within the last 28 days relative to `today`.
 * @param {Array<{date:string, hrv:number}>} entries - sorted oldest→newest
 * @param {string} today - 'YYYY-MM-DD'
 * @returns {{ mean: number, sd: number } | null}
 */
export function computeHRVBaseline(entries = [], today = new Date().toISOString().slice(0, 10)) {
  if (!Array.isArray(entries)) return null

  // Compute cutoff date: 28 days before today
  const todayMs = new Date(today + 'T00:00:00Z').getTime()
  const cutoffMs = todayMs - 28 * 24 * 60 * 60 * 1000
  const cutoffStr = new Date(cutoffMs).toISOString().slice(0, 10)

  const window = entries.filter(e => e.date >= cutoffStr && e.date <= today)

  if (window.length < 7) return null

  const vals = window.map(e => e.hrv)
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length
  const sd = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length)

  return {
    mean: Math.round(mean * 1000) / 1000,
    sd:   Math.round(sd * 1000) / 1000,
  }
}

/**
 * Returns last `n` entries by date (most recent n, sorted oldest→newest).
 * @param {Array<{date:string, hrv:number}>} entries - sorted oldest→newest
 * @param {number} n
 * @returns {Array<{date:string, hrv:number}>}
 */
export function lastNEntries(entries = [], n = 14) {
  if (!Array.isArray(entries)) return []
  return entries.slice(-n)
}

/**
 * Master function — returns full HRV summary object.
 * Returns null if extractHRVEntries(recovery).length < 7.
 * @param {Array} recovery
 * @param {string} today - 'YYYY-MM-DD'
 * @returns {{
 *   current: number,
 *   baseline: {mean:number, sd:number}|null,
 *   readiness: object|null,
 *   trend: object|null,
 *   suppressed: boolean,
 *   last14: Array<{date:string, hrv:number}>,
 *   citation: string
 * }|null}
 */
export function computeHRVSummary(recovery = [], today = new Date().toISOString().slice(0, 10)) {
  const entries = extractHRVEntries(recovery)
  if (entries.length < 7) return null

  const current  = entries[entries.length - 1].hrv
  const last14   = lastNEntries(entries, 14)
  const baseline = computeHRVBaseline(entries, today)

  // computeHRVReadiness(recentRMSSD, baselineRMSSD, baselineSD)
  const readiness = baseline != null
    ? computeHRVReadiness(current, baseline.mean, baseline.sd)
    : null

  // computeHRVTrend(entries) — expects [{ date, hrv }] with positive hrv
  const trend = computeHRVTrend(last14)

  // isHRVSuppressed(entries)
  const suppressed = isHRVSuppressed(last14)

  return {
    current,
    baseline,
    readiness,
    trend,
    suppressed,
    last14,
    citation: 'Plews 2012 · Kiviniemi 2007',
  }
}
