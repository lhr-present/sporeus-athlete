// ─── trainingLoad.js — PMC + ACWR + Banister model + monotony/strain + TSB zones ─
// Pure JS — no React, no DOM, no localStorage.
// PMC uses TrainingPeaks impulse-response decay: K = 1 − e^(−1/τ)

import { BANISTER, ACWR } from './sport/constants.js'
// eslint-disable-next-line no-unused-vars
import './sport/types.js'

const K_CTL    = BANISTER.K_CTL          // ≈ 0.02353  fitness decay factor
const K_ATL    = BANISTER.K_ATL          // ≈ 0.13307  fatigue decay factor
const DECAY_CTL = 1 - K_CTL             // ≈ 0.97647
const DECAY_ATL = 1 - K_ATL             // ≈ 0.86693

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
// @param {TrainingEntry[]} log - training log entries
// @returns {ACWRResult|null}

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
  const status = ratio > ACWR.CAUTION_MAX ? 'danger'
    : ratio > ACWR.OPTIMAL_MAX ? 'caution'
    : ratio >= ACWR.OPTIMAL_MIN ? 'optimal'
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
// @param {TrainingEntry[]} log         - training log
// @param {Array<{date:string, value:number}>} testResults - performance tests
// @returns {{ k1:number, k2:number, p0:number, r2:number, minV:number, maxV:number }|null}
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

// ─── calculateConsistency ────────────────────────────────────────────────────
/**
 * @description Training density over the last N days — fraction of days with a logged session.
 * @param {TrainingEntry[]} log - Full training log
 * @param {number} [days=28] - Window size in days
 * @returns {{ sessionDays: number, totalDays: number, pct: number, longestGap: number, currentGap: number }|null}
 */
export function calculateConsistency(log, days = 28) {
  if (!log || log.length === 0) return null
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  const recent = log.filter(e => e.date >= cutoffStr)
  if (recent.length === 0) return null

  // Build a Set of dates that had a session
  const sessionDates = new Set(recent.map(e => e.date))

  // Count session days and find gaps
  let longestGap = 0
  let gapCount = 0

  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const ds = d.toISOString().slice(0, 10)
    if (!sessionDates.has(ds)) {
      gapCount++
    } else {
      if (gapCount > longestGap) longestGap = gapCount
      gapCount = 0
    }
  }
  if (gapCount > longestGap) longestGap = gapCount

  // currentGap = days since last session
  const today = new Date().toISOString().slice(0, 10)
  const sortedDates = [...sessionDates].sort()
  const lastSessionDate = sortedDates[sortedDates.length - 1]
  const msPerDay = 86400000
  const currentGapDays = lastSessionDate
    ? Math.floor((new Date(today) - new Date(lastSessionDate)) / msPerDay)
    : days

  const sessionDays = sessionDates.size
  return {
    sessionDays,
    totalDays: days,
    pct: Math.round((sessionDays / days) * 100),
    longestGap,
    currentGap: currentGapDays,
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

// ─── generateWeeklyRecap ─────────────────────────────────────────────────────
/**
 * @description Generates a factual weekly recap for display on Monday mornings.
 * Returns null if not Monday, or if fewer than 7 log entries exist.
 * @param {TrainingEntry[]} log
 * @returns {{ sessions: number, totalTSS: number, ctlDelta: number, atlDelta: number, avgRPE: number|null, dominantType: string|null, comparedToAvg: { tssRatio: number, sessionRatio: number }, weekLabel: string }|null}
 */
export function generateWeeklyRecap(log) {
  if (!log || log.length < 7) return null
  const now = new Date()
  if (now.getDay() !== 1) return null // 1 = Monday

  // Last 7 days = last week
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - 7)
  const weekStartStr = weekStart.toISOString().slice(0, 10)
  const todayStr = now.toISOString().slice(0, 10)

  const lastWeek = log.filter(e => e.date >= weekStartStr && e.date < todayStr)
  if (lastWeek.length === 0) return null

  const totalTSS = lastWeek.reduce((s, e) => s + (e.tss || 0), 0)
  const sessions = lastWeek.length
  const avgRPE = lastWeek.some(e => e.rpe)
    ? Math.round((lastWeek.reduce((s, e) => s + (e.rpe || 0), 0) / lastWeek.filter(e => e.rpe).length) * 10) / 10
    : null

  // Dominant session type
  const typeCounts = {}
  lastWeek.forEach(e => { if (e.type) typeCounts[e.type] = (typeCounts[e.type] || 0) + 1 })
  const dominantType = Object.keys(typeCounts).length > 0
    ? Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0][0]
    : null

  // CTL delta — compare CTL now vs 7 days ago using EWMA
  const K_CTL_R = 1 - Math.exp(-1 / 42)
  const K_ATL_R = 1 - Math.exp(-1 / 7)
  const sorted = [...log].sort((a, b) => a.date.localeCompare(b.date))
  let ctl = 0, atl = 0, ctl7 = null, atl7 = null
  const sevenDaysAgo = weekStartStr
  sorted.forEach(e => {
    if (e.date === sevenDaysAgo) { ctl7 = ctl; atl7 = atl }
    ctl = ctl * (1 - K_CTL_R) + (e.tss || 0) * K_CTL_R
    atl = atl * (1 - K_ATL_R) + (e.tss || 0) * K_ATL_R
  })
  const ctlDelta = ctl7 !== null ? Math.round((ctl - ctl7) * 10) / 10 : 0
  const atlDelta = atl7 !== null ? Math.round((atl - atl7) * 10) / 10 : 0

  // Compare to 28-day average (4 prior weeks)
  const fourWeeksAgo = new Date(weekStart)
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
  const prior28 = log.filter(e => e.date >= fourWeeksAgo.toISOString().slice(0, 10) && e.date < weekStartStr)
  const avgWeeklyTSS = prior28.length > 0 ? prior28.reduce((s, e) => s + (e.tss || 0), 0) / 4 : null
  const avgWeeklySessions = prior28.length > 0 ? prior28.length / 4 : null
  const tssRatio = avgWeeklyTSS && avgWeeklyTSS > 0 ? Math.round((totalTSS / avgWeeklyTSS) * 100) / 100 : null
  const sessionRatio = avgWeeklySessions && avgWeeklySessions > 0 ? Math.round((sessions / avgWeeklySessions) * 100) / 100 : null

  // ISO week number for dismiss key
  const jan1 = new Date(now.getFullYear(), 0, 1)
  const weekNum = Math.ceil(((now - jan1) / 86400000 + jan1.getDay() + 1) / 7)
  const weekLabel = `WK ${weekNum}`

  return {
    sessions,
    totalTSS: Math.round(totalTSS),
    ctlDelta,
    atlDelta,
    avgRPE,
    dominantType,
    comparedToAvg: { tssRatio, sessionRatio },
    weekLabel,
  }
}

// ─── Training Monotony & Strain (Foster et al. 1998) ────────────────────────
// Reference: Foster C. (1998). "Monitoring training in athletes with reference
// to overtraining syndrome." Med Sci Sports Exerc 30(7):1164–1168.
//
// monotony = mean7dTSS / stdev7dTSS
// strain   = sum7dTSS × monotony
//
// Risk thresholds (Foster 1998):
//   monotony > 2.0 → high illness / overreach risk
//   strain > 6000  → high cumulative stress (sport-scaled; use relative to athlete baseline)
//
// Requires at least 7 days of data to be meaningful.
// Days with no session are included as 0 TSS (critical for monotony calc).
//
// @param {Array} log - training log entries [{ date, tss }]
// @param {Date}  [asOf] - reference date (defaults to today)
// @returns {{ monotony: number|null, strain: number|null, weekTSS: number,
//             dailyTSS: number[], status: 'low'|'moderate'|'high'|'insufficient' }}

export function computeMonotony(log, asOf = new Date()) {
  const ref = new Date(asOf)
  ref.setHours(0, 0, 0, 0)

  // Build daily TSS for the 7 days ending on ref (inclusive)
  const tssMap = {}
  for (const e of (log || [])) {
    if (!e.date) continue
    tssMap[e.date.slice(0, 10)] = (tssMap[e.date.slice(0, 10)] || 0) + (e.tss || 0)
  }

  const localDate = (d) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  const dailyTSS = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(ref)
    d.setDate(d.getDate() - i)
    dailyTSS.push(tssMap[localDate(d)] || 0)
  }

  const totalLogged = dailyTSS.reduce((s, v) => s + v, 0)
  if (totalLogged === 0) {
    return { monotony: null, strain: null, weekTSS: 0, dailyTSS, status: 'insufficient' }
  }

  const mean = totalLogged / 7
  const variance = dailyTSS.reduce((s, v) => s + (v - mean) ** 2, 0) / 7
  const stdev = Math.sqrt(variance)

  const monotony = stdev < 1 ? null : Math.round((mean / stdev) * 100) / 100
  const strain   = monotony !== null ? Math.round(totalLogged * monotony) : null

  const status = monotony === null ? 'insufficient'
    : monotony > 2.0 ? 'high'
    : monotony > 1.5 ? 'moderate'
    : 'low'

  return {
    monotony,
    strain,
    weekTSS: Math.round(totalLogged),
    dailyTSS,
    status,
  }
}

// ─── TSB Zone Classification (Coggan) ────────────────────────────────────────
// Reference: Coggan A. (2003). "Using TrainingPeaks to guide training."
// Adapted from: Coggan A. Training and Racing with a Power Meter (2nd ed.).
//
// TSB (Training Stress Balance) = CTL(yesterday) − ATL(yesterday)
//
// Zones:
//   > +25           → 'transitional'   — fitness decaying rapidly, under-training
//   +5 to +25       → 'fresh'          — optimal race form window
//   −10 to +5       → 'neutral'        — maintenance; normal training week
//   −30 to −10      → 'optimal'        — ideal training stimulus zone
//   < −30           → 'overreaching'   — cumulative fatigue; injury/illness risk
//
// @param {number} tsb - Training Stress Balance value
// @returns {{ zone: string, label: { en: string, tr: string }, color: string,
//             advice: { en: string, tr: string } }}

export const TSB_ZONES = Object.freeze([
  {
    zone: 'transitional',
    min: 25, max: Infinity,
    color: '#888',
    label:  { en: 'Transitional', tr: 'Geçiş' },
    advice: {
      en: 'Fitness is decaying — return to training soon to avoid detraining.',
      tr: 'Form düşüyor — antrenmanları atlamaktan kaçın, antrenman kaybına uğramazsınız.',
    },
  },
  {
    zone: 'fresh',
    min: 5, max: 25,
    color: '#5bc25b',
    label:  { en: 'Fresh / Peak Form', tr: 'Taze / Form' },
    advice: {
      en: 'Optimal form window for racing or testing. TSB +5 to +25 (Coggan).',
      tr: 'Yarış veya test için optimal form penceresi. TSB +5 ile +25 arası (Coggan).',
    },
  },
  {
    zone: 'neutral',
    min: -10, max: 5,
    color: '#0064ff',
    label:  { en: 'Neutral', tr: 'Nötr' },
    advice: {
      en: 'Normal training week. Fitness building at a manageable fatigue level.',
      tr: 'Normal antrenman haftası. Sürdürülebilir yorgunlukla form artıyor.',
    },
  },
  {
    zone: 'optimal',
    min: -30, max: -10,
    color: '#ff6600',
    label:  { en: 'Optimal Training Stress', tr: 'Optimal Antrenman Stresi' },
    advice: {
      en: 'Classic training zone — strong adaptations. Monitor recovery scores closely.',
      tr: 'Klasik antrenman zonu — güçlü adaptasyonlar. Toparlanma skorlarını yakından izle.',
    },
  },
  {
    zone: 'overreaching',
    min: -Infinity, max: -30,
    color: '#cc0000',
    label:  { en: 'Overreaching Risk', tr: 'Aşırı Yorgunluk Riski' },
    advice: {
      en: 'TSB below −30. High overreaching risk. Reduce load immediately (Coggan).',
      tr: 'TSB −30 altında. Aşırı yüklenme riski yüksek. Yükü hemen azalt (Coggan).',
    },
  },
])

// @param {number} tsb - TSB value (can be fractional)
// @returns {{ zone, label, color, advice }}
export function classifyTSB(tsb) {
  if (tsb == null || !isFinite(tsb)) {
    return { zone: 'unknown', label: { en: 'No data', tr: 'Veri yok' }, color: '#555', advice: { en: '', tr: '' } }
  }
  for (const z of TSB_ZONES) {
    if (tsb >= z.min && tsb < z.max) return z
  }
  return TSB_ZONES[TSB_ZONES.length - 1]  // overreaching catch-all
}
