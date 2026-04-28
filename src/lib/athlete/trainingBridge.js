// src/lib/athlete/trainingBridge.js — E82
// Generates a week-by-week key session plan from an analyzeRaceGoal result.
// Sessions always use CURRENT VDOT paces — correct periodization (Daniels 2014).
// Deload every 4th week (3:1 load:recovery ratio — Bompa 2015).
// Full session library (running + strength + drills + preventive) via sessionLibrary.
import { buildFullWeekPlan } from './sessionLibrary.js'

/**
 * Build week-by-week plan from analyzeRaceGoal result.
 * @param {Object} goalAnalysis  — return value of analyzeRaceGoal()
 * @param {string} planStartDate — 'YYYY-MM-DD'
 * @returns {Array<{weekNum, phase, phaseName, isDeload, sessions, weeklyTSS, startDate, endDate}>}
 */
export function buildTrainingPlan(goalAnalysis, planStartDate) {
  if (!goalAnalysis) return []

  const { phases, currentVdot } = goalAnalysis
  const maxHR = goalAnalysis?.predicted?.maxHR?.value ?? null

  const weeks = []
  let weekNum = 1
  const startDate = planStartDate
    ? new Date(planStartDate + 'T12:00:00Z')
    : new Date()

  for (const phase of phases) {
    for (let w = 1; w <= phase.weeks; w++) {
      const isDeload = w % 4 === 0
      const wdStart = new Date(startDate)
      wdStart.setUTCDate(startDate.getUTCDate() + (weekNum - 1) * 7)
      const wdEnd = new Date(wdStart)
      wdEnd.setUTCDate(wdStart.getUTCDate() + 6)

      const sessions = buildFullWeekPlan(
        isDeload ? 'Deload' : phase.name,
        currentVdot,
        w,
        maxHR,
      )

      weeks.push({
        weekNum,
        phase:     phase.name,
        phaseName: phase.name,
        phaseTr:   phase.tr,
        isDeload,
        tss:       isDeload ? Math.round(phase.tss * 0.60) : phase.tss,
        sessions,
        startDate: wdStart.toISOString().slice(0, 10),
        endDate:   wdEnd.toISOString().slice(0, 10),
        en:        isDeload ? 'Recovery week — reduce volume 40%, maintain frequency.' : phase.en,
        tr:        isDeload ? 'Toparlanma haftası — hacmi %40 azalt, sıklığı koru.' : phase.tr,
      })
      weekNum++
    }
  }

  return weeks
}

/**
 * Find the current week in the plan based on today's date.
 * @param {Array}  plan         — output of buildTrainingPlan()
 * @param {string} today        — 'YYYY-MM-DD'
 * @returns {{week, weekIdx}|null}
 */
export function getCurrentPlanWeek(plan, today = new Date().toISOString().slice(0, 10)) {
  if (!plan?.length) return null
  const idx = plan.findIndex(w => w.startDate <= today && w.endDate >= today)
  if (idx >= 0) return { week: plan[idx], weekIdx: idx }
  if (today < plan[0].startDate) return { week: plan[0], weekIdx: 0 }
  return { week: plan[plan.length - 1], weekIdx: plan.length - 1 }
}
