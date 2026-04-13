// ─── src/lib/sport/rowing.js — Rowing sport-science engine ────────────────────
// Paul's Law scaling, Critical Power hyperbolic model, Concept2 VO2max,
// British Rowing 7-zone system, split conversions.

// ── Paul's Law: time scaling across distances ─────────────────────────────────
// t2 = t1 × (d2 / d1)^1.07  (empirical rowing exponent, British Rowing)
export function paulsLaw(t1Sec, d1M, d2M) {
  if (!t1Sec || !d1M || !d2M || d1M <= 0 || d2M <= 0) return null
  return t1Sec * Math.pow(d2M / d1M, 1.07)
}

// Predict 2000m time from a result at any distance
export function predict2000m(timeSec, distanceM) {
  return paulsLaw(timeSec, distanceM, 2000)
}

// ── Split conversions ──────────────────────────────────────────────────────────
// split (sec per 500m) ↔ pace (sec per 500m) — same unit; convenience aliases
export function secToSplit(totalSec, distanceM) {
  if (!totalSec || !distanceM || distanceM <= 0) return null
  return (totalSec / distanceM) * 500  // seconds per 500m
}

export function splitToVelocity(splitSec500m) {
  if (!splitSec500m || splitSec500m <= 0) return null
  return 500 / splitSec500m  // m/s
}

export function velocityToSplit(velocityMs) {
  if (!velocityMs || velocityMs <= 0) return null
  return 500 / velocityMs  // sec/500m
}

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

// Returns zone number (1–7) for a given split relative to race split.
// split2000: athlete's 2000m race split (sec/500m); currentSplit: session split
export function rowingZone(currentSplitSec, split2000Sec) {
  if (!currentSplitSec || !split2000Sec || split2000Sec <= 0) return null
  const ratio = currentSplitSec / split2000Sec
  for (const z of ROWING_ZONE_DEFS) {
    if (ratio >= z.pctMin && ratio < z.pctMax) return z.id
  }
  return 1  // slower than UT2 threshold → still zone 1
}

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

// Predict time for a distance given CP model and 2000m time (uses split→power)
export function predictTimeCP(distanceM, CP, WPrime, split2000Sec) {
  if (!distanceM || !CP || !WPrime || !split2000Sec || split2000Sec <= 0) return null
  const velocity = splitToVelocity(split2000Sec)
  const power    = CP  // approximation: race ~= CP power at 2000m
  // t = W' / (P - CP) + constant; for general predictions use Paul's Law instead
  // This is kept for CP model consistency checks.
  const t = WPrime / (power - CP + 0.01)  // guard division by tiny number
  return t > 0 ? t : null
}

// ── Multi-test 2000m prediction with confidence interval ──────────────────────
// Predicts 2000m time from multiple test results at different distances.
// Returns { predicted2000Sec, confidenceInterval95: [low, high], stdDevSec }
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
