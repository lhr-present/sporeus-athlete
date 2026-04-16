// ─── src/lib/decoupling.js — Aerobic Decoupling (Pw:Hr) ─────────────────────
// Friel / TrainingPeaks standard: compares the efficiency ratio (power÷HR or
// speed÷HR) between the first and second halves of a steady-state aerobic effort.
//
// decoupling% = ((firstHalfRatio − secondHalfRatio) / firstHalfRatio) × 100
//
// Positive value = second half became less efficient (HR rose relative to output).
// Thresholds (Friel):
//   < 5%  — coupled   (aerobic base sufficient)
//   5–10% — mild drift (some aerobic limitation)
//   > 10% — significant decoupling (aerobic insufficiency at this intensity)
//
// Valid only for steady-state aerobic efforts ≥ 60 min (configurable).
// A warmup window is excluded from the analysis.
//
// Reference:
//   Friel J. The Cyclist's Training Bible, 4th ed. VeloPress 2009.
//   TrainingPeaks — "Understanding Aerobic Decoupling" (methodology article).
//   Implementation: Sporeus Athlete src/lib/decoupling.js

// ── Exported constants ────────────────────────────────────────────────────────

/**
 * Decoupling classification thresholds (%).
 * Values BELOW `coupled` → 'coupled'; between coupled–mild → 'mild'; above mild → 'significant'.
 */
export const DECOUPLING_THRESHOLDS = Object.freeze({ coupled: 5, mild: 10 })

// ── Internal helpers ──────────────────────────────────────────────────────────

function _mean(arr) {
  if (!arr || arr.length === 0) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

// Rolling coefficient of variation over a window; used by requireSteady option.
function _rollingCV(arr, windowSize) {
  const results = []
  for (let i = 0; i <= arr.length - windowSize; i++) {
    const window = arr.slice(i, i + windowSize)
    const m = _mean(window)
    if (m === 0) { results.push(0); continue }
    const variance = window.reduce((s, v) => s + (v - m) ** 2, 0) / windowSize
    results.push(Math.sqrt(variance) / m)
  }
  return results
}

// ── computeDecoupling ─────────────────────────────────────────────────────────

/**
 * Compute aerobic decoupling percentage for a single effort.
 *
 * @param {Object} input
 * @param {number[]} [input.timestamps]   - Unix seconds or sequential 1-Hz indices (optional; array length used if omitted)
 * @param {number[]} input.hr             - Heart rate samples (bpm), one per second (required)
 * @param {number[]} [input.power]        - Power stream (watts) — cycling; takes precedence over speed
 * @param {number[]} [input.speed]        - Speed stream (m/s) — running; used if no power
 * @param {Object}   [input.options]
 * @param {number}   [input.options.minDurationSec=3600]  - Minimum valid effort duration after warmup
 * @param {number}   [input.options.warmupSec=600]        - Seconds to skip at start
 * @param {number}   [input.options.cooldownSec=0]        - Seconds to skip at end
 * @param {boolean}  [input.options.requireSteady=false]  - Filter non-steady samples via rolling CV
 * @param {number}   [input.options.steadyCVThreshold=0.15] - CV threshold for steady filter
 * @param {number}   [input.options.steadyWindow=60]      - Rolling window (seconds) for CV computation
 *
 * @returns {{
 *   decouplingPct: number|null,
 *   firstHalfRatio: number|null,
 *   secondHalfRatio: number|null,
 *   durationSec: number,
 *   samplesUsed: number,
 *   sport: 'cycling'|'running'|null,
 *   valid: boolean,
 *   reason?: string
 * }}
 */
export function computeDecoupling({ timestamps, hr, power, speed, options = {} } = {}) {
  const {
    minDurationSec    = 3600,
    warmupSec         = 600,
    cooldownSec       = 0,
    requireSteady     = false,
    steadyCVThreshold = 0.15,
    steadyWindow      = 60,
  } = options

  const _invalid = (reason) => ({
    decouplingPct: null, firstHalfRatio: null, secondHalfRatio: null,
    durationSec: 0, samplesUsed: 0, sport: null, valid: false, reason,
  })

  // ── Validate inputs ───────────────────────────────────────────────────────

  if (!hr || hr.length === 0) return _invalid('no heart rate data')

  const hasPower = Array.isArray(power) && power.some(p => p > 0)
  const hasSpeed = Array.isArray(speed) && speed.some(s => s > 0)

  if (!hasPower && !hasSpeed) return _invalid('no power or speed data')

  const sport    = hasPower ? 'cycling' : 'running'
  const signal   = hasPower ? power : speed

  // Align arrays to the shortest common length
  const rawLen = Math.min(hr.length, signal.length)
  if (rawLen === 0) return _invalid('mismatched array lengths')

  const totalDuration = rawLen // assumes 1-Hz data
  const _ts = timestamps || Array.from({ length: rawLen }, (_, i) => i)

  // ── Trim warmup + cooldown ────────────────────────────────────────────────

  const startIdx = Math.min(warmupSec, rawLen)
  const endIdx   = Math.max(startIdx, rawLen - cooldownSec)

  const hrTrim     = hr.slice(startIdx, endIdx)
  const signalTrim = signal.slice(startIdx, endIdx)

  const analysisDuration = hrTrim.length

  if (analysisDuration < minDurationSec) {
    return {
      decouplingPct: null, firstHalfRatio: null, secondHalfRatio: null,
      durationSec: totalDuration, samplesUsed: 0, sport, valid: false,
      reason: `effort too short — ${analysisDuration}s after warmup, need ≥${minDurationSec}s`,
    }
  }

  // ── Optional: steady-state filter ────────────────────────────────────────

  let indices = Array.from({ length: analysisDuration }, (_, i) => i)

  if (requireSteady && signalTrim.length >= steadyWindow) {
    const cvs = _rollingCV(signalTrim, steadyWindow)
    // Mark only samples whose rolling window CV is below threshold
    indices = indices.filter(i => {
      const cvIdx = Math.max(0, Math.min(i, cvs.length - 1))
      return cvs[cvIdx] < steadyCVThreshold
    })
    if (indices.length < minDurationSec * 0.5) {
      return {
        decouplingPct: null, firstHalfRatio: null, secondHalfRatio: null,
        durationSec: totalDuration, samplesUsed: indices.length, sport, valid: false,
        reason: 'too few steady-state samples after CV filter',
      }
    }
  }

  // ── Split into two halves ─────────────────────────────────────────────────

  const halfLen    = Math.floor(indices.length / 2)
  const firstIdx   = indices.slice(0, halfLen)
  const secondIdx  = indices.slice(halfLen)

  const firstHr    = _mean(firstIdx.map(i => hrTrim[i]))
  const firstSig   = _mean(firstIdx.map(i => signalTrim[i]))
  const secondHr   = _mean(secondIdx.map(i => hrTrim[i]))
  const secondSig  = _mean(secondIdx.map(i => signalTrim[i]))

  if (firstHr === 0 || secondHr === 0) return _invalid('zero HR in one half — check data quality')
  if (firstSig === 0) return _invalid('zero power/speed in first half — check data quality')

  const firstHalfRatio  = firstSig / firstHr
  const secondHalfRatio = secondSig / secondHr

  const decouplingPct = Math.round(
    ((firstHalfRatio - secondHalfRatio) / firstHalfRatio) * 100 * 100
  ) / 100

  return {
    decouplingPct,
    firstHalfRatio:  Math.round(firstHalfRatio  * 1000) / 1000,
    secondHalfRatio: Math.round(secondHalfRatio * 1000) / 1000,
    durationSec: totalDuration,
    samplesUsed: indices.length,
    sport,
    valid: true,
  }
}

// ── classifyDecoupling ────────────────────────────────────────────────────────

/**
 * Classify a decoupling percentage into a named tier.
 *
 * @param {number} pct
 * @returns {'coupled'|'mild'|'significant'}
 */
export function classifyDecoupling(pct) {
  if (pct < DECOUPLING_THRESHOLDS.coupled) return 'coupled'
  if (pct < DECOUPLING_THRESHOLDS.mild)    return 'mild'
  return 'significant'
}
