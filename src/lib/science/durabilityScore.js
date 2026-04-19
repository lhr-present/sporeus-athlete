// src/lib/science/durabilityScore.js
// E12 — Durability: ability to sustain high-end power deep into long efforts.
//
// Durability compares the athlete's best 5-minute power in the LAST HOUR of a
// long session (≥90 min) against a rested-state baseline 5-minute MMP (maximal
// mean power). A high durability score means fatigue-induced power degradation
// is small — a key predictor of endurance event performance.
//
// durability% = (lastHour5minPeak / baseline5minMMP) × 100
//
// Thresholds (Maunder et al. 2021):
//   ≥ 95%    — high          (elite endurance athletes)
//   90–95%   — moderate      (trained athletes)
//   85–90%   — low           (moderate impairment)
//   < 85%    — very_low      (significant fatigue-related decline)
//
// Valid only for sessions ≥ 90 minutes with a 1-Hz power stream.
//
// References:
//   Maunder E. et al. (2021). Relevance of training volume, intensity distribution
//     and durability to middle- and long-distance triathlon. Sports Med 51:1523–1550.
//   Rønnestad B.R. & Vikmoen O. (2019). Physiological determinants of performance
//     in cycling. Sports Med.

// ── Citation ──────────────────────────────────────────────────────────────────

export const DURABILITY_CITATION =
  'Maunder E. et al. (2021) Sports Med 51:1523–1550; Rønnestad & Vikmoen (2019) Sports Med.'

// ── Thresholds ────────────────────────────────────────────────────────────────

export const DURABILITY_THRESHOLDS = Object.freeze({
  high:     95,   // ≥ 95%
  moderate: 90,   // 90–95%
  low:      85,   // 85–90%
  // < 85% = 'very_low'
})

// ── Minimum valid session duration ───────────────────────────────────────────
const MIN_DURATION_SEC = 90 * 60   // 90 minutes
const WINDOW_SEC       = 60 * 60   // analyse last 60 minutes
const PEAK_WINDOW_SEC  = 5  * 60   // 5-minute peak window

// ── Internal: rolling mean over window ────────────────────────────────────────
function _rollingMean(arr, windowSize) {
  let best = 0
  for (let i = 0; i <= arr.length - windowSize; i++) {
    let sum = 0
    for (let j = i; j < i + windowSize; j++) sum += arr[j]
    const mean = sum / windowSize
    if (mean > best) best = mean
  }
  return best
}

// ── computeDurability ─────────────────────────────────────────────────────────

/**
 * Compute durability score for a single long session.
 *
 * @param {Object} session
 * @param {number[]} session.powerStream  - 1-Hz power data (watts). Required.
 * @param {number}   [session.durationSec] - Total duration (s). Defaults to powerStream.length.
 * @param {number}   baselineMMP5min       - Athlete's rested-state best 5-min power (W).
 *
 * @returns {{
 *   durabilityPct: number,
 *   lastHour5minPeak: number,
 *   baselineMMP5min: number,
 *   tier: 'high'|'moderate'|'low'|'very_low',
 *   durationSec: number,
 *   citation: string,
 * } | null}  null when preconditions are not met
 */
export function computeDurability(session, baselineMMP5min) {
  if (!session) return null
  if (!baselineMMP5min || baselineMMP5min <= 0) return null

  const { powerStream } = session
  if (!Array.isArray(powerStream) || powerStream.length === 0) return null

  const durationSec = session.durationSec ?? powerStream.length

  // Must be ≥ 90 min
  if (durationSec < MIN_DURATION_SEC) return null

  // The analysis window: last 60 minutes of the effort
  const windowStart = Math.max(0, powerStream.length - WINDOW_SEC)
  const lastHourSlice = powerStream.slice(windowStart)

  // Need at least a full 5-min window in the last hour
  if (lastHourSlice.length < PEAK_WINDOW_SEC) return null

  // Best 5-min rolling mean in the last-hour slice
  const lastHour5minPeak = _rollingMean(lastHourSlice, PEAK_WINDOW_SEC)

  const durabilityPct = Math.round((lastHour5minPeak / baselineMMP5min) * 100 * 10) / 10

  const tier =
    durabilityPct >= DURABILITY_THRESHOLDS.high     ? 'high' :
    durabilityPct >= DURABILITY_THRESHOLDS.moderate ? 'moderate' :
    durabilityPct >= DURABILITY_THRESHOLDS.low      ? 'low' :
                                                      'very_low'

  return {
    durabilityPct,
    lastHour5minPeak: Math.round(lastHour5minPeak * 10) / 10,
    baselineMMP5min,
    tier,
    durationSec,
    citation: DURABILITY_CITATION,
  }
}

// ── classifyDurability ─────────────────────────────────────────────────────────

/**
 * Classify a durability percentage into a tier string.
 *
 * @param {number} pct
 * @returns {'high'|'moderate'|'low'|'very_low'}
 */
export function classifyDurability(pct) {
  if (pct >= DURABILITY_THRESHOLDS.high)     return 'high'
  if (pct >= DURABILITY_THRESHOLDS.moderate) return 'moderate'
  if (pct >= DURABILITY_THRESHOLDS.low)      return 'low'
  return 'very_low'
}
