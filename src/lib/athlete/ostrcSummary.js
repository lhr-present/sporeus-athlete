// ─── ostrcSummary.js — OSTRC Injury Monitor analysis (pure functions) ──────────
// Reference: Clarsen et al. (2013) Br J Sports Med — OSTRC-Q2 weekly surveillance
// 4 questions × 0–25 each → total 0–100; risk tiers: none/minor/moderate/substantial
// ─────────────────────────────────────────────────────────────────────────────
import { ostrcRisk } from '../ostrc.js'

export const OSTRC_CITATION = 'Clarsen 2013 · Br J Sports Med'

/**
 * Parse OSTRC history from localStorage key 'sporeus-ostrc'.
 * Returns [] if missing, unparseable, or not an array.
 */
export function parseOSTRCHistory() {
  try {
    const raw = localStorage.getItem('sporeus-ostrc')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

/**
 * Analyse last `limit` OSTRC entries and return per-entry summary.
 * @param {Array<{week:string, date:string, total:number}>} history
 * @param {number} limit
 * @returns {Array<{week:string, date:string, score:number, risk:string}>}
 *   risk = ostrcRisk(total) → 'none'|'minor'|'moderate'|'substantial'
 *   Returns [] if history.length < 2
 */
export function ostrcAnalysis(history = [], limit = 8) {
  if (!Array.isArray(history) || history.length < 2) return []

  // Filter valid entries, sort oldest→newest, take last `limit`
  const sorted = [...history]
    .filter(e => e && e.week && e.date && typeof e.total === 'number')
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
    .slice(-limit)

  if (sorted.length < 2) return []

  return sorted.map(entry => ({
    week:  entry.week,
    date:  entry.date,
    score: entry.total,
    risk:  ostrcRisk(entry.total),
  }))
}

/**
 * Classify trend by comparing first-half mean score vs second-half mean score.
 * 'worsening' if second half mean > first half mean + 5
 * 'improving' if second half mean < first half mean - 5
 * 'stable' otherwise
 * null if analysis.length < 4
 * @param {Array<{score:number}>} analysis
 * @returns {'worsening'|'improving'|'stable'|null}
 */
export function ostrcTrend(analysis = []) {
  if (!Array.isArray(analysis) || analysis.length < 4) return null

  const mid        = Math.floor(analysis.length / 2)
  const firstHalf  = analysis.slice(0, mid)
  const secondHalf = analysis.slice(mid)

  const mean = arr => arr.reduce((s, e) => s + e.score, 0) / arr.length

  const firstMean  = mean(firstHalf)
  const secondMean = mean(secondHalf)
  const diff       = secondMean - firstMean

  if (diff > 5)  return 'worsening'
  if (diff < -5) return 'improving'
  return 'stable'
}

/**
 * Returns { latest, trend, analysis, citation } or null if history.length < 2.
 * @param {Array} history
 * @param {number} limit
 * @returns {{ latest: object, trend: string|null, analysis: Array, citation: string }|null}
 */
export function computeOSTRCSummary(history = [], limit = 8) {
  if (!Array.isArray(history) || history.length < 2) return null

  const analysis = ostrcAnalysis(history, limit)
  if (analysis.length < 2) return null

  const latest = analysis[analysis.length - 1]
  const trend  = ostrcTrend(analysis)

  return { latest, trend, analysis, citation: OSTRC_CITATION }
}
