// ─── restqTrend.js — RESTQ Stress/Recovery Ratio Trend Analysis ───────────────
// Based on Kellmann & Kallus (2001) RESTQ-Sport and Nederhof et al. (2008)
// srRatio = recoveryScore / stressScore — Nederhof (2008) overtraining criterion
// ─────────────────────────────────────────────────────────────────────────────

export const RESTQ_CITATION = 'Kellmann & Kallus 2001 · Nederhof 2008'

/**
 * Read and parse RESTQ history from localStorage key 'sporeus-restq-history'.
 * Returns [] if missing, unparseable, or not an array.
 */
export function parseRESTQHistory() {
  try {
    const raw = localStorage.getItem('sporeus-restq-history')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

/**
 * Analyse last `limit` RESTQ entries and return per-entry stats.
 * @param {Array<{date:string, overall_stress:number|null, overall_recovery:number|null}>} history
 * @param {number} limit
 * @returns {Array<{date:string, stressScore:number, recoveryScore:number, srRatio:number|null, status:string}>}
 */
export function restqAnalysis(history = [], limit = 8) {
  if (!Array.isArray(history) || history.length < 2) return []

  // Sort oldest→newest, then take last `limit`
  const sorted = [...history]
    .filter(e => e && e.date && e.overall_stress != null && e.overall_recovery != null)
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0)
    .slice(-limit)

  if (sorted.length < 2) return []

  return sorted.map(entry => {
    const stressScore   = entry.overall_stress
    const recoveryScore = entry.overall_recovery
    const srRatio       = stressScore === 0 ? null : Math.round((recoveryScore / stressScore) * 100) / 100

    let status
    if (srRatio === null) {
      status = 'ok'
    } else if (srRatio < 0.8) {
      status = 'danger'
    } else if (srRatio < 1.0) {
      status = 'warning'
    } else if (srRatio <= 1.3) {
      status = 'ok'
    } else {
      status = 'good'
    }

    return { date: entry.date, stressScore, recoveryScore, srRatio, status }
  })
}

/**
 * Compute overall RESTQ trend from history.
 * @param {Array} history
 * @param {number} limit
 * @returns {{ latest: object|null, trend: 'improving'|'stable'|'declining'|null, analysis: Array, citation: string }}
 */
export function computeRESTQTrend(history = [], limit = 8) {
  const analysis = restqAnalysis(history, limit)
  const latest   = analysis.length > 0 ? analysis[analysis.length - 1] : null

  let trend = null
  if (analysis.length >= 4) {
    const mid       = Math.floor(analysis.length / 2)
    const firstHalf = analysis.slice(0, mid)
    const secondHalf = analysis.slice(mid)

    const validRatios = arr => arr.map(e => e.srRatio).filter(r => r !== null)
    const mean = arr => arr.reduce((s, v) => s + v, 0) / arr.length

    const firstValid  = validRatios(firstHalf)
    const secondValid = validRatios(secondHalf)

    if (firstValid.length > 0 && secondValid.length > 0) {
      const firstMean  = mean(firstValid)
      const secondMean = mean(secondValid)
      const diff       = secondMean - firstMean

      if (diff > 0.1) {
        trend = 'improving'
      } else if (diff < -0.1) {
        trend = 'declining'
      } else {
        trend = 'stable'
      }
    }
  }

  return { latest, trend, analysis, citation: RESTQ_CITATION }
}
