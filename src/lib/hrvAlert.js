// ─── src/lib/hrvAlert.js — HRV drop alert math ────────────────────────────────
// Pure math for detecting clinically significant HRV drops.
// Mirrors the plpgsql fn_check_hrv_drop() logic in 20260422_webhooks.sql.
// Used for unit testing and client-side pre-check before DB write.

/**
 * Compute mean and population standard deviation from an HRV series.
 * Requires at least 5 valid samples; returns null if insufficient data.
 * @param {number[]} series — rMSSD values (ms)
 * @returns {{ mean: number, stddev: number } | null}
 */
export function hrv28dStats(series) {
  const valid = (series || []).filter(v => typeof v === 'number' && !isNaN(v) && v > 0)
  if (valid.length < 5) return null
  const mean     = valid.reduce((s, v) => s + v, 0) / valid.length
  const variance = valid.reduce((s, v) => s + (v - mean) ** 2, 0) / valid.length
  const stddev   = Math.sqrt(variance)
  return { mean: Math.round(mean * 10) / 10, stddev: Math.round(stddev * 10) / 10 }
}

/**
 * Determine whether a current HRV reading is a significant drop vs 28-day baseline.
 * Threshold: more than 2 standard deviations below the personal mean.
 *
 * @param {number}   currentHRV      — today's rMSSD value
 * @param {number[]} hrv28dSeries    — last 28 days of prior readings (NOT including today)
 * @returns {{
 *   alert:  boolean,   — true if drop > 2σ
 *   delta:  number,    — raw delta vs mean (negative = drop)
 *   sigma:  number,    — delta expressed in standard deviations
 *   mean:   number,
 *   stddev: number
 * }}
 */
export function detectHRVAlert(currentHRV, hrv28dSeries) {
  const stats = hrv28dStats(hrv28dSeries)
  if (!stats || stats.stddev < 0.01) {
    return { alert: false, delta: 0, sigma: 0, mean: stats?.mean ?? 0, stddev: stats?.stddev ?? 0 }
  }
  const delta = currentHRV - stats.mean
  const sigma = delta / stats.stddev
  return {
    alert:  sigma < -2.0,
    delta:  Math.round(delta * 10) / 10,
    sigma:  Math.round(sigma * 100) / 100,
    mean:   stats.mean,
    stddev: stats.stddev,
  }
}
