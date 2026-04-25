// ─── src/lib/athlete/planScore.js — E48: Plan Score helpers ──────────────────
// Wraps scoreTrainingPlan + peakFormWindow from simulation.js for Dashboard use.
// Source: Banister & Calvert (1980) — Modeling elite athletic performance

import { scoreTrainingPlan, peakFormWindow } from '../sport/simulation.js'
import { calcLoad } from '../formulas.js'

/**
 * Extract weekly TSS array from a plan object.
 * Returns null if plan is missing, has no weeks, or fewer than 2 weeks.
 * @param {object|null} plan
 * @returns {number[]|null}
 */
export function extractWeeklyTSS(plan) {
  if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length < 2) return null
  return plan.weeks.map(w => parseFloat(w.tss || w.TSS || 0))
}

/**
 * Compute the calendar date string for a given peak day (1-indexed) in the plan.
 * @param {object|null} plan - must have generatedAt: 'YYYY-MM-DD'
 * @param {number|null} peakDay - 1-indexed day number within simulation
 * @returns {string|null} ISO date 'YYYY-MM-DD' or null
 */
export function peakFormDate(plan, peakDay) {
  if (!plan?.generatedAt || !peakDay) return null
  const d = new Date(plan.generatedAt)
  d.setDate(d.getDate() + peakDay - 1)
  return d.toISOString().slice(0, 10)
}

/**
 * Compute the full plan score result from a plan and training log.
 * @param {object|null} plan
 * @param {Array} log - training log entries (passed to calcLoad)
 * @returns {{score:number, peakDay:number|null, peakTSB:number|null, peakDate:string|null, weekCount:number, totalTSS:number}|null}
 */
export function computePlanScore(plan, log) {
  const weeklyTSS = extractWeeklyTSS(plan)
  if (!weeklyTSS) return null
  const { ctl: startCTL, atl: startATL } = calcLoad(log || [])
  const score = scoreTrainingPlan(weeklyTSS, startCTL, startATL)
  const peak  = peakFormWindow(weeklyTSS, startCTL, startATL)
  if (score === null && !peak) return null
  return {
    score,                                // 0–100
    peakDay:   peak?.peakDay ?? null,
    peakTSB:   peak?.peakTSB ?? null,
    peakDate:  peakFormDate(plan, peak?.peakDay),
    weekCount: weeklyTSS.length,
    totalTSS:  Math.round(weeklyTSS.reduce((s, v) => s + v, 0)),
  }
}
