// ─── src/lib/athlete/hrvAlertSummary.js — E37: HRV Drop Alert summary ──────────
// Wraps detectHRVAlert / hrv28dStats from src/lib/hrvAlert.js into dashboard-ready
// state object. Shows alert only when clinically actionable (>2σ drop, Plews 2012).

import { detectHRVAlert, hrv28dStats as _hrv28dStats } from '../hrvAlert.js'

/**
 * Extract valid HRV series from a recovery array.
 * Filters entries with positive numeric hrv, sorts oldest → newest.
 * @param {object[]} recovery — recovery log entries with { hrv, date }
 * @returns {number[]} — sorted array of valid hrv values
 */
export function extractHRVSeries(recovery = []) {
  return (recovery || [])
    .filter(e => typeof e.hrv === 'number' && e.hrv > 0 && e.date)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map(e => e.hrv)
}

/**
 * Compute HRV alert state for dashboard display.
 * Returns null if fewer than 6 valid readings (need baseline + current).
 *
 * @param {object[]} recovery — recovery log entries
 * @returns {{
 *   alert: boolean,
 *   delta: number,
 *   sigma: number,
 *   mean: number,
 *   stddev: number,
 *   current: number,
 *   status: 'alert' | 'suppressed' | 'normal',
 *   citation: string
 * } | null}
 */
export function computeHRVAlertState(recovery = []) {
  const series = extractHRVSeries(recovery)
  if (series.length < 6) return null

  const current  = series[series.length - 1]
  const series28 = series.slice(0, series.length - 1)

  const result = detectHRVAlert(current, series28)

  let status
  if (result.alert) {
    status = 'alert'
  } else if (result.sigma < -1.5) {
    status = 'suppressed'
  } else {
    status = 'normal'
  }

  return {
    alert:    result.alert,
    delta:    result.delta,
    sigma:    result.sigma,
    mean:     result.mean,
    stddev:   result.stddev,
    current,
    status,
    citation: 'Plews 2012 · Kiviniemi 2007 · 2σ threshold',
  }
}
