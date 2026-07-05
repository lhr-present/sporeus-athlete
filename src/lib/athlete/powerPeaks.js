// src/lib/athlete/powerPeaks.js
//
// v9.480.0 — compact per-session power peaks (the "raw-series storage" intent,
// founder-approved, delivered as scalars). Instead of persisting 10,800-sample
// watt blobs, each powered session stores a 6-number MMP vector:
//
//   p5 / p60 / p300 / p1200 / p3600 — best mean power over 5s/1min/5min/20min/1h
//   lh300 — best 5-min power within the FINAL HOUR (durability numerator,
//           Maunder 2021: lastHour5minPeak / baseline5minMMP)
//
// This unlocks DurabilityCard (which read entry.powerStream — a field NOTHING
// ever produced, so the card was dead since E12) and power-curve/CP history
// from synced data, at zero storage cost and no per-session fetch weight.
//
// Deno port lives in supabase/functions/_shared/streamScience.ts
// (computePowerPeaks) — keep the two in sync; this file is the source of truth
// and its tests are the executable contract.

export const PEAK_WINDOWS = Object.freeze({ p5: 5, p60: 60, p300: 300, p1200: 1200, p3600: 3600 })
const LAST_HOUR_SEC = 3600
const LH_WINDOW_SEC = 300

// Best rolling mean over `windowSize` samples — O(n) sliding sum.
function bestRollingMean(arr, windowSize) {
  if (!Array.isArray(arr) || arr.length < windowSize) return null
  let sum = 0
  for (let i = 0; i < windowSize; i++) sum += arr[i]
  let best = sum
  for (let i = windowSize; i < arr.length; i++) {
    sum += arr[i] - arr[i - windowSize]
    if (sum > best) best = sum
  }
  return best / windowSize
}

/**
 * @description Compute the peaks vector from a 1-Hz watts series (gap samples
 *   as 0, the app-wide stream convention). Returns null when the series is too
 *   short (<30 samples) or carries no positive power. Windows longer than the
 *   series are omitted from the result rather than fabricated.
 *
 * @param {number[]} powers - 1-Hz power stream in watts
 * @returns {Record<string, number>|null} integer watts per present key
 */
export function computePowerPeaks(powers) {
  if (!Array.isArray(powers) || powers.length < 30) return null
  if (!powers.some(p => p > 0)) return null

  const peaks = {}
  for (const [key, win] of Object.entries(PEAK_WINDOWS)) {
    const v = bestRollingMean(powers, win)
    if (v != null && v > 0) peaks[key] = Math.round(v)
  }

  // Durability numerator: best 5-min mean inside the final hour of the session.
  const lastHour = powers.slice(Math.max(0, powers.length - LAST_HOUR_SEC))
  const lh = bestRollingMean(lastHour, LH_WINDOW_SEC)
  if (lh != null && lh > 0) peaks.lh300 = Math.round(lh)

  return Object.keys(peaks).length ? peaks : null
}

/**
 * @description Sanitize a peaks object from storage/sync: keep only known keys
 *   with plausible positive integer watts (≤2500, the app-wide power bound).
 *   Returns null when nothing survives.
 *
 * @param {unknown} raw
 * @returns {Record<string, number>|null}
 */
export function sanitizePowerPeaks(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const out = {}
  for (const key of [...Object.keys(PEAK_WINDOWS), 'lh300']) {
    const v = Number(raw[key])
    if (Number.isFinite(v) && v > 0 && v <= 2500) out[key] = Math.round(v)
  }
  return Object.keys(out).length ? out : null
}
