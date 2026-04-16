// ─── Power Curve Engine ───────────────────────────────────────────────────────
// calculateMMP, fitCriticalPower, detectIntervals, estimateFTP
// calculateWPrimeBalance → delegates to existing computeWPrime (formulas.js)
import { normalizedPower, computeWPrime } from './formulas.js'

export { computeWPrime as calculateWPrimeBalance }

// Durations used for power curve (seconds)
export const KEY_DURATIONS = [
  1, 2, 3, 5, 8, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300,
  360, 480, 600, 720, 900, 1200, 1500, 1800, 2700, 3600, 5400, 7200, 10800,
]

// ── Mean Maximal Power ────────────────────────────────────────────────────────
// O(n) per duration via sliding window rolling sum.
// Skips any window where < 90% of samples are non-zero.
// @param {number[]} stream  — 1-Hz power stream in watts
// @returns {Array<{duration:number, power:number}>}
export function calculateMMP(stream) {
  if (!stream || stream.length === 0) return []
  const n = stream.length
  const durations = KEY_DURATIONS.filter(d => d <= n)
  const result = []

  for (const d of durations) {
    let sum = 0
    let validCount = 0
    let maxAvg = 0

    // Initialize first window
    for (let i = 0; i < d; i++) {
      const p = stream[i] || 0
      sum += p
      if (p > 0) validCount++
    }
    if (validCount >= 0.9 * d) maxAvg = sum / d

    // Slide
    for (let i = d; i < n; i++) {
      const inc = stream[i] || 0
      const out = stream[i - d] || 0
      sum += inc - out
      if (inc > 0) validCount++
      if (out > 0) validCount--
      if (validCount >= 0.9 * d) {
        const avg = sum / d
        if (avg > maxAvg) maxAvg = avg
      }
    }

    if (maxAvg > 0) result.push({ duration: d, power: Math.round(maxAvg * 10) / 10 })
  }
  return result
}

// ── Critical Power Model Fit ──────────────────────────────────────────────────
// 2-param model: P(t) = W'/t + CP
// Linearised: y = CP + W'·x  where x = 1/t, y = P
// OLS via Σ equations. Uses durations 2–30 minutes for fit range.
// @returns {{cp:number, wPrime:number, r2:number}|null}
export function fitCriticalPower(mmps) {
  if (!mmps || mmps.length < 3) return null

  const pts = mmps.filter(p => p.duration >= 120 && p.duration <= 1800)
  if (pts.length < 3) return null

  const xs = pts.map(p => 1 / p.duration)
  const ys = pts.map(p => p.power)
  const n = pts.length

  const sumX  = xs.reduce((s, v) => s + v, 0)
  const sumY  = ys.reduce((s, v) => s + v, 0)
  const sumXY = xs.reduce((s, v, i) => s + v * ys[i], 0)
  const sumX2 = xs.reduce((s, v) => s + v * v, 0)

  const denom = n * sumX2 - sumX * sumX
  if (Math.abs(denom) < 1e-12) return null

  const wPrime = Math.round((n * sumXY - sumX * sumY) / denom)
  const cp     = Math.round((sumY - wPrime * sumX) / n)

  if (cp < 50 || cp > 600 || wPrime < 3000 || wPrime > 120000) return null

  // R²
  const yMean  = sumY / n
  const ssTot  = ys.reduce((s, v) => s + (v - yMean) ** 2, 0)
  const ssRes  = pts.reduce((s, p) => s + (p.power - (cp + wPrime / p.duration)) ** 2, 0)
  const r2     = Math.max(0, 1 - ssRes / ssTot)

  return { cp, wPrime, r2: Math.round(r2 * 1000) / 1000 }
}

// ── Interval Detection ────────────────────────────────────────────────────────
// Detects efforts where P ≥ threshold × CP for ≥ minDuration seconds.
// Merges gaps ≤ mergeSec apart. Returns intervals sorted by avgPower descending.
/**
 * @param {number[]} stream - 1-Hz power stream in watts
 * @param {number} cp - Critical Power threshold watts
 * @param {number} [threshold=0.85] - fraction of CP to qualify as effort
 * @param {number} [minDuration=20] - minimum effort duration in seconds
 * @param {number} [mergeSec=5] - max gap to merge adjacent efforts
 * @returns {Array<Object>} intervals sorted by avgPower descending
 */
export function detectIntervals(stream, cp, threshold = 0.85, minDuration = 20, mergeSec = 5) {
  if (!stream || stream.length === 0 || !cp) return []
  const limit = cp * threshold

  // Raw active runs
  const segs = []
  let start = -1
  for (let i = 0; i < stream.length; i++) {
    const on = (stream[i] || 0) >= limit
    if (on && start < 0) start = i
    if (!on && start >= 0) { segs.push({ start, end: i - 1 }); start = -1 }
  }
  if (start >= 0) segs.push({ start, end: stream.length - 1 })

  // Merge close gaps
  const merged = []
  for (const seg of segs) {
    if (merged.length > 0 && seg.start - merged[merged.length - 1].end <= mergeSec) {
      merged[merged.length - 1].end = seg.end
    } else {
      merged.push({ ...seg })
    }
  }

  const ZONE_BOUNDARIES = [
    { z: 'Z1', max: 0.55 }, { z: 'Z2', max: 0.75 }, { z: 'Z3', max: 0.90 },
    { z: 'Z4', max: 1.05 }, { z: 'Z5', max: 1.20 }, { z: 'Z6', max: Infinity },
  ]
  const getZone = ratio => ZONE_BOUNDARIES.find(b => ratio < b.max)?.z || 'Z6'

  return merged
    .filter(s => s.end - s.start + 1 >= minDuration)
    .map(s => {
      const slice = stream.slice(s.start, s.end + 1)
      const dur = slice.length
      const avg = Math.round(slice.reduce((a, b) => a + (b || 0), 0) / dur)
      const np  = slice.length >= 30 ? normalizedPower(slice) : avg
      return { start: s.start, end: s.end, durationSec: dur, avgPower: avg, np, zone: getZone(avg / cp) }
    })
    .sort((a, b) => b.avgPower - a.avgPower)
}

// ── FTP Estimate from MMP ─────────────────────────────────────────────────────
// Priority: 60-min MMP → 20-min × 0.95 → 8-min × 0.90
/**
 * @param {Array<{duration:number, power:number}>} mmps - mean maximal power array
 * @returns {number|null} estimated FTP watts or null if insufficient data
 */
export function estimateFTP(mmps) {
  if (!mmps || mmps.length === 0) return null
  const get = d => mmps.find(p => p.duration === d)?.power
  const p60 = get(3600); if (p60 > 0) return Math.round(p60)
  const p20 = get(1200); if (p20 > 0) return Math.round(p20 * 0.95)
  const p8  = get(480);  if (p8  > 0) return Math.round(p8  * 0.90)
  return null
}
