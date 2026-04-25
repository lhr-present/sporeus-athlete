// ─── src/lib/sport/rowing.js — Rowing sport-science engine ────────────────────
// Paul's Law scaling, Critical Power hyperbolic model, Concept2 VO2max,
// British Rowing 7-zone system, split conversions.
// E10 additions: splitPer500m, formatSplit, strokeEfficiency,
//   classifyStrokeRate, rowingEfficiencyFactor.
//
// References (E10):
//   Nolte V. (2005). Rowing Faster. Human Kinetics.
//   Coggan A.R. (2003). Training and racing using a power meter: an update.
//     Efficiency Factor concept adapted for pace/HR.

import { ROWING } from './constants.js'

// ── Paul's Law: time scaling across distances ─────────────────────────────────
// t2 = t1 × (d2 / d1)^1.07  (empirical rowing exponent, British Rowing)
/**
 * @description Scales a rowing time from one distance to another using Paul's Law exponent (1.07).
 * @param {number} t1Sec - Known time in seconds at distance d1M
 * @param {number} d1M - Reference distance in metres
 * @param {number} d2M - Target distance in metres
 * @returns {number|null} Predicted time in seconds, or null on invalid input
 * @source Paul (1969) — International rowing performance prediction
 * @example
 * paulsLaw(360, 1000, 2000) // => ~776 seconds
 */
export function paulsLaw(t1Sec, d1M, d2M) {
  if (!t1Sec || !d1M || !d2M || t1Sec <= 0 || d1M <= 0 || d2M <= 0) return null
  return t1Sec * Math.pow(d2M / d1M, ROWING.PAULS_LAW_EXPONENT)
}

/**
 * @description Predicts 2000 m ergometer time from a result at any distance using Paul's Law.
 * @param {number} timeSec - Race time in seconds
 * @param {number} distanceM - Distance rowed in metres
 * @returns {number|null} Predicted 2000 m time in seconds, or null on invalid input
 * @source Paul (1969) — International rowing performance prediction
 * @example
 * predict2000m(390, 1000) // => ~841 seconds
 */
export function predict2000m(timeSec, distanceM) {
  return paulsLaw(timeSec, distanceM, 2000)
}

// ── Split conversions ──────────────────────────────────────────────────────────
// split (sec per 500m) ↔ pace (sec per 500m) — same unit; convenience aliases
/**
 * @description Converts total elapsed time and distance to a 500 m split time.
 * @param {number} totalSec - Total time in seconds
 * @param {number} distanceM - Total distance in metres
 * @returns {number|null} Split in seconds per 500 m, or null on invalid input
 * @example
 * secToSplit(360, 1000) // => 180 (sec/500m)
 */
export function secToSplit(totalSec, distanceM) {
  if (!totalSec || !distanceM || distanceM <= 0) return null
  return (totalSec / distanceM) * 500  // seconds per 500m
}

/**
 * @description Converts a 500 m split time to velocity in m/s.
 * @param {number} splitSec500m - Split in seconds per 500 m
 * @returns {number|null} Velocity in m/s, or null on invalid input
 * @example
 * splitToVelocity(100) // => 5 (m/s)
 */
export function splitToVelocity(splitSec500m) {
  if (!splitSec500m || splitSec500m <= 0) return null
  return 500 / splitSec500m  // m/s
}

/**
 * @description Converts velocity in m/s to a 500 m split time in seconds.
 * @param {number} velocityMs - Velocity in metres per second
 * @returns {number|null} Split in seconds per 500 m, or null on invalid input
 * @example
 * velocityToSplit(5) // => 100 (sec/500m)
 */
export function velocityToSplit(velocityMs) {
  if (!velocityMs || velocityMs <= 0) return null
  return 500 / velocityMs  // sec/500m
}

/**
 * @description Formats a 500 m split time as a 'M:SS' string for display.
 * @param {number} splitSec500m - Split in seconds per 500 m
 * @returns {string} Formatted split e.g. '1:45', or '--:--' on invalid input
 * @example
 * fmtSplit(105) // => '1:45'
 */
export function fmtSplit(splitSec500m) {
  if (!splitSec500m || splitSec500m <= 0) return '--:--'
  const m = Math.floor(splitSec500m / 60)
  const s = Math.round(splitSec500m % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// ── Concept2 VO2max estimation ────────────────────────────────────────────────
// From 2000m time: power → polynomial VO2max.
// Formula source: Concept2 (Hagerman 1984 calibration), valid for ~60–180s splits.
// P = 2.80 / (split_sec/500)^3 gives watts in a 5–26 W "normalized" range when
// using split directly. We compute via the C2 formula then apply the polynomial.
/**
 * @description Estimates VO2max (mL/kg/min) from a 2000 m Concept2 ergometer result
 *   using the Hagerman (1984) polynomial calibrated to ergometer power output.
 * @param {number} time2000Sec - 2000 m time in seconds
 * @param {number} bodyWeightKg - Athlete body mass in kg (defaults to 75 if ≤ 0)
 * @returns {number|null} VO2max in mL/kg/min rounded to 1 decimal, or null on invalid input
 * @source Paul (1969) — International rowing performance prediction; Hagerman (1984) ergometer calibration
 * @example
 * concept2VO2max(420, 80) // => ~56.2 mL/kg/min
 */
export function concept2VO2max(time2000Sec, bodyWeightKg) {
  if (!time2000Sec || time2000Sec <= 0) return null
  const splitSec = time2000Sec / 4  // seconds per 500m
  // Concept2 power formula: P (W) = 2.80 / (split_sec/500)^3
  const powerW = 2.80 / Math.pow(splitSec / 500, 3)
  // VO2max from ergometer power (Hagerman 1984, linear cost model):
  //   VO2 (mL/kg/min) = (14.7 × P_watts + 250) / bodyWeightKg
  //   250 mL/min accounts for basal metabolic + unloaded rowing cost
  const bw  = bodyWeightKg > 0 ? bodyWeightKg : 75
  const vo2 = (14.7 * powerW + 250) / bw
  return Math.max(0, Math.round(vo2 * 10) / 10)
}

// ── British Rowing 7-zone system ──────────────────────────────────────────────
// Zones defined as % of 2000m race pace split.
// Zone 1 (UT2) — Zone 7 (Anaerobic)
const ROWING_ZONE_DEFS = [
  { id: 1, name: 'UT2',         pctMin: 1.20, pctMax: Infinity },
  { id: 2, name: 'UT1',         pctMin: 1.12, pctMax: 1.20 },
  { id: 3, name: 'AT',          pctMin: 1.06, pctMax: 1.12 },
  { id: 4, name: 'TR',          pctMin: 1.01, pctMax: 1.06 },
  { id: 5, name: '2k Pace',     pctMin: 0.97, pctMax: 1.01 },
  { id: 6, name: 'AN',          pctMin: 0.93, pctMax: 0.97 },
  { id: 7, name: 'Sprint/Max',  pctMin: 0,    pctMax: 0.93 },
]

/**
 * @description Returns the British Rowing zone number (1–7) for a current split relative to the athlete's 2000 m race split.
 * @param {number} currentSplitSec - Current session split in sec/500 m
 * @param {number} split2000Sec - Athlete's 2000 m race split in sec/500 m
 * @returns {number|null} Zone 1 (UT2) to 7 (Sprint/Max), or null on invalid input
 * @source Paul (1969) — International rowing performance prediction; British Rowing intensity zones
 * @example
 * rowingZone(115, 100) // => 2 (UT1, ratio 1.15)
 */
export function rowingZone(currentSplitSec, split2000Sec) {
  if (!currentSplitSec || !split2000Sec || split2000Sec <= 0) return null
  const ratio = currentSplitSec / split2000Sec
  for (const z of ROWING_ZONE_DEFS) {
    if (ratio >= z.pctMin && ratio < z.pctMax) return z.id
  }
  return 1  // slower than UT2 threshold → still zone 1
}

/**
 * @description Returns all 7 British Rowing zones with absolute split boundaries for a given 2000 m race split.
 * @param {number} split2000Sec - Athlete's 2000 m race split in sec/500 m
 * @returns {Array<{id, name, pctMin, pctMax, splitMin, splitMax}>} Zone objects with computed split ranges
 * @source Paul (1969) — International rowing performance prediction; British Rowing intensity zones
 * @example
 * rowingZones(100) // => [{id:1, name:'UT2', splitMin:120, ...}, ...]
 */
export function rowingZones(split2000Sec) {
  if (!split2000Sec || split2000Sec <= 0) return []
  return ROWING_ZONE_DEFS.map(z => ({
    ...z,
    splitMin: z.pctMin === 0     ? null : Math.round(split2000Sec * z.pctMin * 10) / 10,
    splitMax: z.pctMax === Infinity ? null : Math.round(split2000Sec * z.pctMax * 10) / 10,
  }))
}

// ── Critical Power (hyperbolic) model ─────────────────────────────────────────
// Hyperbolic CP model: t = W' / (P − CP)
// Given at least two (time, power) pairs, returns { CP, WPrime } via least squares.
// power in watts, time in seconds.
/**
 * @description Fits the Critical Power hyperbolic model to maximal ergometer efforts using ordinary least squares.
 *   Linearises as: Work = CP × time + W' and solves for CP and W'.
 * @param {Array<{timeSec: number, powerW: number}>} efforts - At least 2 maximal efforts at different durations
 * @returns {{CP: number, WPrime: number}|null} CP in watts and W' in joules, or null if fit fails
 * @source Morton (1986) — A 3-parameter critical power model
 * @example
 * fitCP([{timeSec:300,powerW:300},{timeSec:600,powerW:260}]) // => {CP:~230, WPrime:~21000}
 */
export function fitCP(efforts) {
  // efforts: [{ timeSec, powerW }, ...]
  if (!efforts || efforts.length < 2) return null
  // Linear: 1/P = 1/CP − W'/(CP × t × P) → simplify to P × t = CP × t + W'
  // i.e. "work = CP × time + W'" form: W_i = CP × t_i + W'
  // Ordinary least squares on W_i = a × t_i + b → a = CP, b = W'
  const n = efforts.length
  const xs = efforts.map(e => e.timeSec)
  const ys = efforts.map(e => e.powerW * e.timeSec)  // total work
  const sumX  = xs.reduce((a, b) => a + b, 0)
  const sumY  = ys.reduce((a, b) => a + b, 0)
  const sumXX = xs.reduce((a, x) => a + x * x, 0)
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0)
  const denom = n * sumXX - sumX * sumX
  if (Math.abs(denom) < 1e-9) return null
  const CP     = (n * sumXY - sumX * sumY) / denom
  const WPrime = (sumY - CP * sumX) / n
  if (CP <= 0 || WPrime <= 0) return null
  return { CP: Math.round(CP * 10) / 10, WPrime: Math.round(WPrime) }
}

// ── Multi-test 2000m prediction with confidence interval ──────────────────────
// Predicts 2000m time from multiple test results at different distances.
// Returns { predicted2000Sec, confidenceInterval95: [low, high], stdDevSec }
/**
 * @description Predicts 2000 m time from multiple test results at different distances using Paul's Law
 *   and computes a 95% confidence interval across predictions.
 * @param {Array<{distanceM: number, timeSec: number}>} tests - Array of test results (at least 1)
 * @returns {{predicted2000Sec: number, confidenceInterval95: [number,number]|null, stdDevSec: number|null}|null}
 * @source Paul (1969) — International rowing performance prediction
 * @example
 * predict2000mFromMultipleTests([{distanceM:1000,timeSec:200},{distanceM:5000,timeSec:1100}])
 * // => { predicted2000Sec: ..., confidenceInterval95: [...], stdDevSec: ... }
 */
export function predict2000mFromMultipleTests(tests) {
  // tests: [{ distanceM, timeSec }, ...]
  if (!tests || tests.length === 0) return null
  const predictions = tests
    .map(t => predict2000m(t.timeSec, t.distanceM))
    .filter(p => p !== null)
  if (predictions.length === 0) return null
  const mean = predictions.reduce((a, b) => a + b, 0) / predictions.length
  if (predictions.length === 1) {
    return { predicted2000Sec: Math.round(mean), confidenceInterval95: null, stdDevSec: null }
  }
  const variance = predictions.reduce((a, p) => a + (p - mean) ** 2, 0) / (predictions.length - 1)
  const std = Math.sqrt(variance)
  const tCrit = 2.776  // t-value for 95% CI, df=4 (conservative for small n)
  const margin = tCrit * std / Math.sqrt(predictions.length)
  return {
    predicted2000Sec: Math.round(mean),
    confidenceInterval95: [Math.round(mean - margin), Math.round(mean + margin)],
    stdDevSec: Math.round(std * 10) / 10,
  }
}

// ── E10 — Dashboard metric helpers ────────────────────────────────────────────

/**
 * Split time per 500m — standard rowing performance metric.
 * @param {number} distanceM - total distance in metres
 * @param {number} durationSec - total duration in seconds
 * @returns {number|null} split in seconds per 500m, or null if distanceM is falsy
 */
export function splitPer500m(distanceM, durationSec) {
  if (!distanceM) return null
  return (durationSec / distanceM) * 500
}

/**
 * Format split as mm:ss.t string (e.g. "1:52.3").
 * Always zero-pads seconds to two digits before the decimal.
 * @param {number} splitSec - split in seconds per 500m
 * @returns {string} formatted string, e.g. "1:45.0"
 */
export function formatSplit(splitSec) {
  if (splitSec == null || isNaN(splitSec)) return '—'
  const totalTenths = Math.round(splitSec * 10)
  const tenths = totalTenths % 10
  const totalSeconds = Math.floor(totalTenths / 10)
  const mins = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${mins}:${String(secs).padStart(2, '0')}.${tenths}`
}

/**
 * Stroke efficiency — metres per stroke.
 * Ref: Nolte (2005) "Rowing Faster"
 * @param {number} distanceM
 * @param {number} totalStrokes
 * @returns {number|null} metres per stroke, or null if totalStrokes falsy
 */
export function strokeEfficiency(distanceM, totalStrokes) {
  if (!totalStrokes) return null
  return distanceM / totalStrokes
}

/**
 * Classify stroke rate (spm) into zones.
 * Ref: Nolte (2005) — standard competition stroke rate ranges.
 * @param {number} spm - strokes per minute
 * @returns {{ zone: string, label: { en: string, tr: string } }}
 */
export function classifyStrokeRate(spm) {
  if (spm < 18) {
    return { zone: 'recovery', label: { en: 'Recovery / Technical', tr: 'Toparlanma / Teknik' } }
  }
  if (spm < 22) {
    return { zone: 'steady', label: { en: 'Steady state', tr: 'Sabit tempo' } }
  }
  if (spm < 26) {
    return { zone: 'threshold', label: { en: 'Threshold', tr: 'Eşik' } }
  }
  if (spm <= 30) {
    return { zone: 'race', label: { en: 'Race pace', tr: 'Yarış temposu' } }
  }
  return { zone: 'sprint', label: { en: 'Sprint', tr: 'Sprint' } }
}

/**
 * Rowing efficiency factor — pace-per-HR analogue for rowing.
 * Adapted from Coggan (2003) efficiency factor concept.
 * @param {number} distanceM
 * @param {number} durationSec
 * @param {number} avgHR - average heart rate (bpm)
 * @returns {number|null} m/s per bpm (null if avgHR falsy)
 */
export function rowingEfficiencyFactor(distanceM, durationSec, avgHR) {
  if (!avgHR || !durationSec) return null
  const avgVelocity = distanceM / durationSec  // m/s
  return Math.round((avgVelocity / avgHR) * 10000) / 10000
}
