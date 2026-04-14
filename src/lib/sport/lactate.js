// ─── lactate.js — Lactate Threshold Estimation ───────────────────────────────
// Implements D-max method (Cheng et al. 1992) and auxiliary HR/RPE estimators.
// D-max: fit a cubic polynomial to [power/pace, lactate] points, draw a straight
// line from the first to the last point, find the point on the curve with
// maximum perpendicular distance to that line → lactate threshold.
// Reference:
//   Cheng B et al. (1992). A new approach for the determination of ventilatory
//   and lactate thresholds. Int J Sports Med, 13(6), 518-522.
// ─────────────────────────────────────────────────────────────────────────────

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
 * Estimate lactate threshold from incremental step-test data using the D-max method.
 * @param {Array<{load, lactate}>} steps — steps sorted by load (watts or km/h or km/min)
 * @param {{ loadUnit?: string }} options
 * @returns {{ lt, ltLactate, lt1, lt2, curve, dmax, error? }}
 *   lt  — primary threshold load (D-max)
 *   lt1 — aerobic threshold (first rise: load where lactate first exceeds baseline+0.5 mmol/L)
 *   lt2 — anaerobic threshold (D-max)
 *   ltLactate — blood lactate at lt (mmol/L)
 *   curve — Array<{load, lactate}> with fitted curve values (100 points)
 *   dmax — perpendicular distance at lt
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
 * Estimate LT from HR-only step data (Conconi-style deflection).
 * Finds the HR at which the HR/load relationship deflects from linearity.
 * @param {Array<{load, hr}>} hrSteps
 * @returns {{ lt, ltHR, error? }}
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
 * Estimate LT from RPE step data (simple: load at RPE=12 on Borg 6-20 scale
 * or RPE=5 on CR-10, corresponding to first perceived difficulty).
 * @param {Array<{load, rpe}>} rpeSteps
 * @returns {{ lt, error? }}
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
 * Format a LT result for display.
 * @param {{ lt, lt1, lt2, ltLactate, loadUnit }} result
 * @param {'run'|'bike'|'swim'|string} sport
 * @returns {{ primary, secondary, zoneNote }}
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
