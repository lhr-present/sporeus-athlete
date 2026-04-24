// ─── lactate.js — Lactate Threshold Estimation ───────────────────────────────
// Implements D-max method (Cheng et al. 1992) and auxiliary HR/RPE estimators.
// D-max: fit a cubic polynomial to [power/pace, lactate] points, draw a straight
// line from the first to the last point, find the point on the curve with
// maximum perpendicular distance to that line → lactate threshold.
// Reference:
//   Cheng B et al. (1992). A new approach for the determination of ventilatory
//   and lactate thresholds. Int J Sports Med, 13(6), 518-522.
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
import './types.js'

/**
 * Validate and normalise step-test input.
 * @param {Array<{load, lactate}>} steps — sorted by load ascending
 * @returns {{valid, steps, error}}
 */
function validateSteps(steps) {
  if (!Array.isArray(steps) || steps.length < 4) {
    return { valid: false, error: 'At least 4 steps required' }
  }
  const normalised = steps
    .map(s => ({ load: parseFloat(s.load), lactate: parseFloat(s.lactate) }))
    .filter(s => !isNaN(s.load) && !isNaN(s.lactate) && s.lactate > 0)
    .sort((a, b) => a.load - b.load)

  if (normalised.length < 4) return { valid: false, error: 'Not enough valid steps (need ≥4 with positive lactate)' }
  return { valid: true, steps: normalised }
}

// ── Cubic polynomial fitting (least-squares) ──────────────────────────────────

/** Solve the 4×4 Vandermonde system for cubic coefficients [a0, a1, a2, a3]. */
function fitCubic(xs, ys) {
  // Build 4×4 system via normal equations for degree-3 polynomial
  // We use 4 Vandermonde basis vectors: [1, x, x^2, x^3]
  // For robustness with ill-conditioned data, normalise x to [0,1]
  const n = xs.length
  const xMin = Math.min(...xs), xMax = Math.max(...xs)
  const range = xMax - xMin || 1
  const xn = xs.map(x => (x - xMin) / range)

  // Sums for normal equations: S[p+q] = Σ xn^(p+q)
  const S = Array(7).fill(0)
  const T = Array(4).fill(0)
  for (let i = 0; i < n; i++) {
    let xp = 1
    for (let p = 0; p <= 6; p++) { S[p] += xp; xp *= xn[i] }
    let xk = 1
    for (let k = 0; k <= 3; k++) { T[k] += ys[i] * xk; xk *= xn[i] }
  }

  // Normal equations matrix M * coef = T
  const M = [
    [S[0], S[1], S[2], S[3]],
    [S[1], S[2], S[3], S[4]],
    [S[2], S[3], S[4], S[5]],
    [S[3], S[4], S[5], S[6]],
  ]

  const coef = gaussElim(M, T)
  // Return an evaluator that works in original x space
  return (x) => {
    const xNorm = (x - xMin) / range
    let xp = 1; let y = 0
    for (let k = 0; k < 4; k++) { y += coef[k] * xp; xp *= xNorm }
    return y
  }
}

/** Simple Gaussian elimination with partial pivoting. Returns solution vector. */
function gaussElim(A, b) {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let maxRow = col
    for (let row = col + 1; row < n; row++) if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row;
    [M[col], M[maxRow]] = [M[maxRow], M[col]]
    if (Math.abs(M[col][col]) < 1e-12) continue
    for (let row = col + 1; row < n; row++) {
      const f = M[row][col] / M[col][col]
      for (let k = col; k <= n; k++) M[row][k] -= f * M[col][k]
    }
  }
  const x = Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n]
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j]
    x[i] /= M[i][i] || 1
  }
  return x
}

// ── D-max method ──────────────────────────────────────────────────────────────

/**
 * @description Estimates lactate threshold from incremental step-test data using the D-max method.
 *   Fits a cubic polynomial to the lactate–load curve, then finds the load with maximum
 *   perpendicular distance from the line joining the first and last test points.
 * @param {LactateTestPoint[]} steps - Steps sorted by load (watts, km/h, etc.)
 * @param {{loadUnit?: string}} [options] - Optional display unit override
 * @returns {{lt:number|null, ltLactate:number|null, lt1:number|null, lt2:number|null, curve:Array, dmax:number, error?:string}|null}
 *   lt — primary threshold load (D-max); lt1 — aerobic threshold; lt2 — anaerobic (D-max);
 *   ltLactate — blood lactate at LT2 (mmol/L); curve — 61-point fitted lactate curve
 * @source Cheng et al. (1992) — A new approach for the determination of ventilatory threshold
 * @example
 * estimateLTFromStep([{load:100,lactate:1.1},{load:150,lactate:1.3},{load:200,lactate:2.1},{load:250,lactate:5.0}])
 * // => {lt: ~210, lt1: ~145, ltLactate: ~2.8, ...}
 */
export function estimateLTFromStep(steps, options = {}) {
  const v = validateSteps(steps)
  if (!v.valid) return { lt: null, error: v.error }

  const xs = v.steps.map(s => s.load)
  const ys = v.steps.map(s => s.lactate)

  let poly
  try { poly = fitCubic(xs, ys) }
  catch { return { lt: null, error: 'Could not fit lactate curve — check step data' } }

  const x0 = xs[0], xN = xs[xs.length - 1]
  const y0 = poly(x0), yN = poly(xN)

  // Perpendicular distance from point (px,py) to line (x0,y0)→(xN,yN)
  const dx = xN - x0, dy = yN - y0
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const dist = (px, py) => Math.abs(dy * px - dx * py + xN * y0 - yN * x0) / len

  // Scan 200 interior points for D-max
  const N = 200
  let bestLoad = x0, bestDist = 0
  for (let i = 1; i < N; i++) {
    const x = x0 + (i / N) * (xN - x0)
    const y = poly(x)
    const d = dist(x, y)
    if (d > bestDist) { bestDist = d; bestLoad = x }
  }

  const ltLoad = Math.round(bestLoad * 10) / 10
  const ltLactate = Math.round(poly(bestLoad) * 100) / 100

  // LT1 (aerobic threshold): first load where lactate > baseline + 0.5 mmol/L
  const baseline = ys[0]
  let lt1 = null
  for (let i = 1; i < N; i++) {
    const x = x0 + (i / N) * (xN - x0)
    if (poly(x) > baseline + 0.5) { lt1 = Math.round(x * 10) / 10; break }
  }

  // Build fitted curve for chart
  const curve = []
  for (let i = 0; i <= 60; i++) {
    const x = x0 + (i / 60) * (xN - x0)
    curve.push({ load: Math.round(x * 10) / 10, lactate: Math.max(0, Math.round(poly(x) * 100) / 100) })
  }

  return {
    lt: ltLoad, lt2: ltLoad, lt1,
    ltLactate, curve,
    dmax: Math.round(bestDist * 1000) / 1000,
    loadUnit: options.loadUnit || 'W',
  }
}

/**
 * @description Estimates lactate threshold from HR-only step data using a Conconi-style deflection method.
 *   Finds the load at which the HR–load relationship changes slope (bilinear fit).
 * @param {Array<{load:number, hr:number}>} hrSteps - At least 5 steps with load and HR values
 * @returns {{lt:number|null, ltHR:number|null, error?:string}}
 * @source Cheng et al. (1992) — A new approach for the determination of ventilatory threshold
 * @example
 * estimateLTFromHR([{load:100,hr:130},{load:150,hr:145},{load:200,hr:162},{load:250,hr:175},{load:300,hr:182}])
 * // => {lt: ~250, ltHR: 175}
 */
export function estimateLTFromHR(hrSteps) {
  if (!Array.isArray(hrSteps) || hrSteps.length < 5) {
    return { lt: null, error: 'At least 5 HR steps required' }
  }
  const valid = hrSteps
    .map(s => ({ load: parseFloat(s.load), hr: parseFloat(s.hr) }))
    .filter(s => !isNaN(s.load) && !isNaN(s.hr) && s.hr > 0)
    .sort((a, b) => a.load - b.load)
  if (valid.length < 5) return { lt: null, error: 'Not enough valid steps' }

  // Fit two linear segments, find best split (sum of squared residuals minimised)
  let bestSplit = 0, bestSSR = Infinity
  for (let i = 2; i < valid.length - 2; i++) {
    const seg1 = valid.slice(0, i + 1)
    const seg2 = valid.slice(i)
    const ssr1 = linearSSR(seg1.map(s => s.load), seg1.map(s => s.hr))
    const ssr2 = linearSSR(seg2.map(s => s.load), seg2.map(s => s.hr))
    if (ssr1 + ssr2 < bestSSR) { bestSSR = ssr1 + ssr2; bestSplit = i }
  }

  return {
    lt: Math.round(valid[bestSplit].load * 10) / 10,
    ltHR: Math.round(valid[bestSplit].hr),
  }
}

function linearSSR(xs, ys) {
  const n = xs.length
  const mx = xs.reduce((s, v) => s + v, 0) / n
  const my = ys.reduce((s, v) => s + v, 0) / n
  const sxy = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0)
  const sxx = xs.reduce((s, x) => s + (x - mx) ** 2, 0) || 1
  const slope = sxy / sxx
  return xs.reduce((s, x, i) => s + (ys[i] - (my + slope * (x - mx))) ** 2, 0)
}

/**
 * @description Estimates lactate threshold from RPE step data by interpolating to the threshold
 *   RPE value (RPE 12 on Borg 6–20 scale, or RPE 5 on CR-10).
 * @param {Array<{load:number, rpe:number}>} rpeSteps - At least 3 steps with load and RPE values
 * @returns {{lt:number|null, error?:string}}
 * @source Cheng et al. (1992) — A new approach for the determination of ventilatory threshold
 * @example
 * estimateLTFromRPE([{load:150,rpe:9},{load:200,rpe:12},{load:250,rpe:15}])
 * // => {lt: 200}
 */
export function estimateLTFromRPE(rpeSteps) {
  if (!Array.isArray(rpeSteps) || rpeSteps.length < 3) {
    return { lt: null, error: 'At least 3 RPE steps required' }
  }
  const valid = rpeSteps
    .map(s => ({ load: parseFloat(s.load), rpe: parseFloat(s.rpe) }))
    .filter(s => !isNaN(s.load) && !isNaN(s.rpe))
    .sort((a, b) => a.load - b.load)

  // Detect Borg scale: > 10 = Borg 6-20, ≤ 10 = CR-10
  const maxRPE = Math.max(...valid.map(s => s.rpe))
  const threshold = maxRPE > 10 ? 12 : 5  // LT ≈ RPE 12 (Borg) / 5 (CR-10)

  let prev = valid[0]
  for (const step of valid) {
    if (step.rpe >= threshold) {
      // Interpolate
      const frac = (threshold - prev.rpe) / ((step.rpe - prev.rpe) || 1)
      const lt = prev.load + frac * (step.load - prev.load)
      return { lt: Math.round(lt * 10) / 10 }
    }
    prev = step
  }
  return { lt: valid[valid.length - 1].load }
}

/**
 * Detects cross-session lactate threshold drift from a history of LT2 results.
 * @param {Array<{date: string, lt2W: number}>} sessions - at least 3 required
 * @returns {{trend: 'improving'|'stable'|'declining', deltaPercent: number, confidence: 'low'|'medium'|'high'}}
 */
export function computeLactateDrift(sessions) {
  // Filter to sessions with valid lt2W, sort by date ascending, take last 6
  const valid = (Array.isArray(sessions) ? sessions : [])
    .filter(s => s && s.date && typeof s.lt2W === 'number' && s.lt2W > 0)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-6);

  if (valid.length < 3) {
    return { trend: 'stable', deltaPercent: 0, confidence: 'low' };
  }

  // Linear regression: x = session index (0..n-1), y = lt2W
  const n = valid.length;
  const xs = valid.map((_, i) => i);
  const ys = valid.map(s => s.lt2W);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = ys.reduce((a, b) => a + b, 0) / n;
  const slope = xs.reduce((acc, x, i) => acc + (x - xMean) * (ys[i] - yMean), 0) /
                xs.reduce((acc, x) => acc + (x - xMean) ** 2, 0);

  // Convert slope to % change over the span
  const spanDays = (new Date(valid[n-1].date) - new Date(valid[0].date)) / (1000 * 60 * 60 * 24);
  const monthlyPct = spanDays > 0 ? (slope * (n - 1) / yMean) * (30 / spanDays) * 100 : 0;

  const confidence = n < 3 ? 'low' : n < 6 ? 'medium' : 'high';
  const trend = monthlyPct > 1.5 ? 'improving' : monthlyPct < -1.5 ? 'declining' : 'stable';

  return { trend, deltaPercent: Math.round(monthlyPct * 10) / 10, confidence };
}

/**
 * @description Formats a lactate threshold result object into human-readable display strings.
 * @param {{lt:number|null, lt1:number|null, lt2:number|null, ltLactate:number|null, loadUnit?:string}} result - LT result from estimateLTFromStep
 * @param {'run'|'bike'|'swim'|string} sport - Sport context for zone note generation
 * @returns {{primary:string, secondary:string, zoneNote:string}}
 * @source Cheng et al. (1992) — A new approach for the determination of ventilatory threshold
 * @example
 * formatLTResult({lt:250, lt1:190, ltLactate:3.2, loadUnit:'W'}, 'bike')
 * // => {primary:'LT2 (D-max): 250 W · lactate @ LT2: 3.2 mmol/L', secondary:'LT1...', zoneNote:'...'}
 */
export function formatLTResult(result, sport) {
  if (!result || result.lt == null) return { primary: '—', secondary: '', zoneNote: '' }

  const unit = result.loadUnit || (sport === 'run' ? 'km/h' : 'W')
  const primary = `LT2 (D-max): ${result.lt} ${unit}`
  const secondary = result.lt1 != null ? `LT1 (aerobic): ${result.lt1} ${unit}` : ''

  let zoneNote = ''
  if (sport === 'bike' || sport === 'Bike') {
    zoneNote = `Use LT2 as FTP proxy (+2-5%) in Zone Calculator`
  } else if (sport === 'run' || sport === 'Run') {
    zoneNote = `Use LT2 for threshold pace zone in Zone Calculator`
  }

  const lac = result.ltLactate ? ` · lactate @ LT2: ${result.ltLactate} mmol/L` : ''

  return { primary: primary + lac, secondary, zoneNote }
}
