// ─── trainingLoad.js — PMC + ACWR + Banister model ────────────────────────
// Pure JS — no React, no DOM, no localStorage.
// PMC uses TrainingPeaks impulse-response decay: K = 1 − e^(−1/τ)

const K_CTL    = 1 - Math.exp(-1 / 42)   // ≈ 0.02353  fitness decay factor
const K_ATL    = 1 - Math.exp(-1 / 7)    // ≈ 0.13307  fatigue decay factor
const DECAY_CTL = 1 - K_CTL              // ≈ 0.97647
const DECAY_ATL = 1 - K_ATL              // ≈ 0.86693

// ─── calculatePMC ────────────────────────────────────────────────────────────
// Returns a daily array of { date, tss, ctl, atl, tsb, isFuture }.
// TSB = CTL(yesterday) − ATL(yesterday), matching TrainingPeaks convention.
// Primes CTL/ATL over an extra 180 days before the display window so values
// are accurate regardless of how far back the log goes.
//
// @param {Array}  log        - training log entries [{ date, tss }]
// @param {number} daysBack   - days of history to return (default 90)
// @param {number} daysFuture - days of zeros to project forward (default 30)
// @returns {Array<{date,tss,ctl,atl,tsb,isFuture}>}
export function calculatePMC(log, daysBack = 90, daysFuture = 30) {
  const byDate = {}
  for (const e of (log || [])) {
    if (e.date) byDate[e.date] = (byDate[e.date] || 0) + (e.tss || 0)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const primeStart  = new Date(today)
  primeStart.setDate(primeStart.getDate() - daysBack - 180)
  // windowStart = today − (daysBack−1) so that daysBack+daysFuture total points are returned
  const windowStart = new Date(today)
  windowStart.setDate(windowStart.getDate() - (daysBack - 1))
  const windowEnd   = new Date(today)
  windowEnd.setDate(windowEnd.getDate() + daysFuture)

  let ctl = 0, atl = 0
  const points = []

  for (let d = new Date(primeStart); d <= windowEnd; d.setDate(d.getDate() + 1)) {
    const ds  = d.toISOString().slice(0, 10)
    const tss = byDate[ds] || 0
    const prevCTL = ctl
    const prevATL = atl
    ctl = prevCTL * DECAY_CTL + tss * K_CTL
    atl = prevATL * DECAY_ATL + tss * K_ATL

    if (d >= windowStart) {
      const isFuture = d > today
      points.push({
        date:      ds,
        tss:       isFuture ? 0 : tss,
        ctl:       Math.round(ctl  * 10) / 10,
        atl:       Math.round(atl  * 10) / 10,
        tsb:       Math.round((prevCTL - prevATL) * 10) / 10,
        isFuture,
      })
    }
  }

  return points
}

// ─── calculateACWR ───────────────────────────────────────────────────────────
// Acute:Chronic Workload Ratio via EWMA (Hulin et al. 2016).
// λ_acute  = 0.25  → half-life ≈ 3.5 days (ATL proxy)
// λ_chronic = 0.067 → half-life ≈ 10 days  (CTL proxy)
// Zero-load days are inserted for any missing date in the 28-day window.
// TSS per day is capped at MAX_TSS_PER_SESSION to guard against data errors.
// status: 'optimal' (0.8–1.3) | 'caution' (1.3–1.5) | 'danger' (>1.5) |
//         'undertraining' (<0.8) | 'insufficient' (no chronic base)
//
// @param {Array} log - training log entries [{ date, tss }]
// @returns {{ ratio, status, acute, chronicWeekly }}

const MAX_TSS_PER_SESSION = 300
const λ_ACUTE   = 0.25
const λ_CHRONIC = 0.067

export function calculateACWR(log) {
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  // Build daily TSS map (YYYY-MM-DD → capped sum)
  const tssMap = {}
  for (const e of (log || [])) {
    if (!e.date) continue
    const d = e.date.slice(0, 10)
    tssMap[d] = Math.min((tssMap[d] || 0) + (e.tss || 0), MAX_TSS_PER_SESSION)
  }

  // Iterate 28 days oldest→newest applying EWMA
  let atl = 0, ctl = 0
  for (let i = 27; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const tss = tssMap[key] || 0
    atl = λ_ACUTE   * tss + (1 - λ_ACUTE)   * atl
    ctl = λ_CHRONIC * tss + (1 - λ_CHRONIC) * ctl
  }

  if (ctl === 0) {
    return { ratio: null, status: 'insufficient', acute: 0, chronicWeekly: 0 }
  }

  const ratio  = Math.round((atl / ctl) * 100) / 100
  const status = ratio > 1.5 ? 'danger'
    : ratio > 1.3 ? 'caution'
    : ratio >= 0.8 ? 'optimal'
    : 'undertraining'

  return {
    ratio,
    status,
    acute:         Math.round(atl),
    chronicWeekly: Math.round(ctl),
  }
}

// ─── Banister model helpers ──────────────────────────────────────────────────
// g(t) = Σ TSS[d] × e^(−(t−d)/45)  — fitness impulse (unnormalized CTL)
// h(t) = Σ TSS[d] × e^(−(t−d)/15)  — fatigue impulse (unnormalized ATL)
// Computed incrementally: g(t) = g(t−1) × e^(−1/45) + TSS(t)
//
// Performance(t) = p₀ + k₁·g(t) − k₂·h(t)   (Banister 1975)
// With τ₁=45d (fitness) and τ₂=15d (fatigue) fixed at literature defaults.
// k₁, k₂, p₀ fitted by OLS from historical performance test data.

const DECAY_G = Math.exp(-1 / 45)
const DECAY_H = Math.exp(-1 / 15)

function buildImpulseMap(log) {
  const byDate = {}
  for (const e of (log || [])) {
    if (e.date) byDate[e.date] = (byDate[e.date] || 0) + (e.tss || 0)
  }
  return byDate
}

// Compute g and h at a specific target date by iterating the log
function impulseAt(byDate, targetDateStr) {
  const sortedDays = Object.keys(byDate).sort()
  if (!sortedDays.length) return { g: 0, h: 0 }
  const start  = new Date(sortedDays[0])
  const target = new Date(targetDateStr)
  let g = 0, h = 0
  for (let d = new Date(start); d <= target; d.setDate(d.getDate() + 1)) {
    const tss = byDate[d.toISOString().slice(0, 10)] || 0
    g = g * DECAY_G + tss
    h = h * DECAY_H + tss
  }
  return { g, h }
}

// 3×3 Gaussian elimination — returns [x0, x1, x2] or null if singular
function gauss3(A, b) {
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < 3; col++) {
    let pivot = col
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(M[row][col]) > Math.abs(M[pivot][col])) pivot = row
    }
    ;[M[col], M[pivot]] = [M[pivot], M[col]]
    if (Math.abs(M[col][col]) < 1e-12) return null
    for (let row = col + 1; row < 3; row++) {
      const f = M[row][col] / M[col][col]
      for (let j = col; j <= 3; j++) M[row][j] -= f * M[col][j]
    }
  }
  const x = new Array(3).fill(0)
  for (let i = 2; i >= 0; i--) {
    x[i] = M[i][3] / M[i][i]
    for (let j = i + 1; j < 3; j++) x[i] -= M[i][j] * x[j] / M[i][i]
  }
  return x
}

// ─── fitBanister ─────────────────────────────────────────────────────────────
// Fit k₁, k₂, p₀ by OLS from historical test results.
// Requires ≥ 3 results with { date, value } — value is any comparable metric
// (FTP, CP, 5K time as seconds, etc.). Values are normalized to 0–100 internally.
//
// @param {Array} log         - training log [{ date, tss }]
// @param {Array} testResults - performance tests [{ date, value }]
// @returns {{ k1, k2, p0, r2, minV, maxV }} | null
export function fitBanister(log, testResults) {
  const valid = (testResults || []).filter(t => t.date && typeof t.value === 'number')
  if (valid.length < 3) return null

  const byDate = buildImpulseMap(log)

  const vals  = valid.map(t => t.value)
  const minV  = Math.min(...vals)
  const maxV  = Math.max(...vals)
  const range = maxV - minV || 1
  const norm  = v => (v - minV) / range * 100

  // OLS with design row [g, h, 1]: P ≈ b1·g + b2·h + b3
  // Normal equations: (X^T X) β = X^T y
  // k1 = b1 (fitness), k2 = −b2 (fatigue cost), p0 = b3
  const n = valid.length
  let sG2=0, sH2=0, sGH=0, sG=0, sH=0, sGP=0, sHP=0, sP=0
  const rows = []

  for (const tr of valid) {
    const { g, h } = impulseAt(byDate, tr.date)
    const p = norm(tr.value)
    sG2 += g*g; sH2 += h*h; sGH += g*h
    sG  += g;   sH  += h;   sGP += g*p; sHP += h*p; sP += p
    rows.push({ g, h, p })
  }

  const A = [
    [sG2, sGH, sG],
    [sGH, sH2, sH],
    [sG,  sH,  n ],
  ]
  const b = [sGP, sHP, sP]

  const coef = gauss3(A, b)
  if (!coef) return null
  const [b1, b2, b3] = coef
  const k1 = b1, k2 = -b2, p0 = b3

  // R² on normalized values (clamped ≥ 0 — can go negative on near-collinear data)
  const pMean = sP / n
  const ssTot = rows.reduce((s, r) => s + (r.p - pMean) ** 2, 0)
  const ssRes = rows.reduce((s, r) => s + (r.p - (b1*r.g + b2*r.h + b3)) ** 2, 0)
  const r2    = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0

  return {
    k1: k1 || 0,
    k2: k2 || 0,
    p0: p0 || 0,
    r2: Math.round(r2 * 100) / 100,
    minV,
    maxV,
  }
}

// ─── predictBanister ─────────────────────────────────────────────────────────
// Project Banister performance for future days given a fitted model.
//
// @param {Array}  log        - historical training log
// @param {Object} fit        - result of fitBanister()
// @param {Array}  planned    - optional future TSS [{date, tss}]
// @param {number} days       - how many days forward to predict (default 90)
// @returns {Array<{date, predicted, g, h}>}  predicted is 0–100 (normalized)
export function predictBanister(log, fit, planned = [], days = 90) {
  if (!fit) return []

  const byDate = buildImpulseMap(log)
  for (const e of (planned || [])) {
    if (e.date) byDate[e.date] = (byDate[e.date] || 0) + (e.tss || 0)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Bring g, h up to today from the beginning of the log
  const sortedDays = Object.keys(byDate).sort()
  let g = 0, h = 0
  if (sortedDays.length) {
    const start = new Date(sortedDays[0])
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const tss = byDate[d.toISOString().slice(0, 10)] || 0
      g = g * DECAY_G + tss
      h = h * DECAY_H + tss
    }
  }

  const out = []
  for (let i = 1; i <= days; i++) {
    const d  = new Date(today)
    d.setDate(d.getDate() + i)
    const ds = d.toISOString().slice(0, 10)
    const tss = byDate[ds] || 0
    g = g * DECAY_G + tss
    h = h * DECAY_H + tss
    const raw     = fit.k1 * g - fit.k2 * h + fit.p0
    const clamped = Math.max(0, Math.min(100, raw))
    out.push({ date: ds, predicted: Math.round(clamped * 10) / 10, g: Math.round(g), h: Math.round(h) })
  }

  return out
}
