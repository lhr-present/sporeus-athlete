// ── athlete/vdotBenchmark.js — E36 VDOT age/gender percentile benchmark ───────
// Source: Daniels 2013 Running Formula + age-graded normative data

import { RUNNING_VDOT_NORMS } from '../sport/normativeTables.js'
import { extractVdotHistory } from '../race/vdotTrend.js'

const CITATION = 'Daniels 2013 · running normative data'

/**
 * Map an age number to the correct ageGroup string.
 * Returns null if age < 10 or > 120.
 * @param {number|string} age
 * @returns {string|null}
 */
export function ageToGroup(age) {
  const n = Number(age)
  if (!isFinite(n) || n < 10 || n > 120) return null
  if (n < 30) return '18-29'
  if (n < 40) return '30-39'
  if (n < 50) return '40-49'
  if (n < 60) return '50-59'
  return '60+'
}

/**
 * Find the norm row matching ageGroup and gender.
 * gender is normalised to 'male' or 'female' (default 'male').
 * Returns the norm row or null if not found.
 * @param {string} ageGroup
 * @param {string} gender
 * @returns {object|null}
 */
export function lookupVDOTNorm(ageGroup, gender) {
  if (!ageGroup) return null
  const g = gender === 'female' ? 'female' : 'male'
  const row = RUNNING_VDOT_NORMS.find(r => r.ageGroup === ageGroup && r.gender === g)
  return row || null
}

/**
 * Given an athlete's VDOT and the norm row, return their percentile tier.
 * @param {number} vdot
 * @param {object} norm  — { vdot: { p25, p50, p75, p90 } }
 * @returns {{ percentile: string, label_en: string, label_tr: string, color: string }}
 */
export function classifyVDOT(vdot, norm) {
  if (vdot == null || !norm || !norm.vdot) return null
  const { p50, p75, p90 } = norm.vdot

  if (vdot >= p90) {
    return { percentile: 'top10',        label_en: 'TOP 10%',        label_tr: 'İLK %10',      color: '#5bc25b' }
  }
  if (vdot >= p75) {
    return { percentile: 'top25',        label_en: 'TOP 25%',        label_tr: 'İLK %25',      color: '#0064ff' }
  }
  if (vdot >= p50) {
    return { percentile: 'median',       label_en: 'ABOVE MEDIAN',   label_tr: 'MEDYAN ÜSTÜ',  color: '#f5c542' }
  }
  return   { percentile: 'below_median', label_en: 'BELOW MEDIAN',   label_tr: 'MEDYAN ALTI',  color: '#888'    }
}

/**
 * Master: returns full benchmark context or null.
 * @param {Array} log
 * @param {Array} testResults
 * @param {object} profile   — { age, gender }
 * @returns {object|null}
 */
export function computeVDOTBenchmark(log = [], testResults = [], profile = {}) {
  const history = extractVdotHistory(log, testResults)
  if (!history || history.length < 1) return null

  const currentVdot = history.at(-1)?.vdot ?? null
  if (currentVdot == null) return null

  const ageGroup = ageToGroup(profile.age)
  if (!ageGroup) return null

  const gender = profile.gender === 'female' ? 'female' : 'male'
  const normRow = lookupVDOTNorm(ageGroup, gender)
  if (!normRow) return null

  const tier = classifyVDOT(currentVdot, normRow)
  if (!tier) return null

  // nextTier: gap to the next percentile threshold
  let nextTier = null
  const { p50, p75, p90 } = normRow.vdot
  if (tier.percentile === 'below_median') {
    nextTier = { label: 'ABOVE MEDIAN', vdotNeeded: p50 - currentVdot }
  } else if (tier.percentile === 'median') {
    nextTier = { label: 'TOP 25%',      vdotNeeded: p75 - currentVdot }
  } else if (tier.percentile === 'top25') {
    nextTier = { label: 'TOP 10%',      vdotNeeded: p90 - currentVdot }
  }
  // top10 → null (already at top)

  return {
    currentVdot,
    ageGroup,
    gender,
    norm: normRow.vdot,          // { p25, p50, p75, p90 }
    tier,
    nextTier,
    citation: CITATION,
  }
}
