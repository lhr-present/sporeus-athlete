// ─── goalTracker.js — Goal progress tracking and projection utilities ──────────

/**
 * @description Calculates goal completion percentage, days remaining, and a simple status label
 *   based on linear progress from the goal's starting value to its target.
 * @param {{type:string, current:number, target:number, deadline:string}} goal - Goal definition object
 * @param {number} currentValue - Latest measured value for the goal metric
 * @returns {{pct:number, daysLeft:number, status:'on_track'|'behind'|'impossible'}}
 * @example
 * getGoalProgress({current:50,target:60,deadline:'2026-05-01'}, 55)
 * // => {pct:50, daysLeft:~16, status:'on_track'}
 */
export function getGoalProgress(goal, currentValue) {
  const range = goal.target - goal.current
  const pct = range === 0
    ? 100
    : Math.min(100, Math.round((currentValue - goal.current) / range * 100))

  const daysLeft = Math.ceil((new Date(goal.deadline) - new Date()) / 86400000)

  let status
  if (daysLeft <= 0) {
    status = 'impossible'
  } else if (pct >= 100) {
    status = 'on_track'
  } else {
    // rough heuristic: are we at least halfway by halfway point?
    // use simple on_track/behind based on linear expected progress
    const totalDays = Math.ceil(
      (new Date(goal.deadline) - new Date(goal.current !== undefined ? Date.now() : Date.now())) / 86400000
    )
    // fall back to: on_track if pct > 0, behind otherwise
    status = pct > 0 ? 'on_track' : 'behind'
  }

  return { pct, daysLeft, status }
}

/**
 * @description Projects the ISO date on which the athlete will reach a target value
 *   given a constant weekly improvement rate.
 * @param {number} currentValue - Current measured value
 * @param {number} weeklyRate - Expected improvement per week (must be > 0)
 * @param {number} targetValue - Goal target value
 * @returns {string|null} ISO date string 'YYYY-MM-DD', or null if weeklyRate ≤ 0
 * @example
 * projectAchievementDate(50, 1, 60) // => ~'2026-06-23' (10 weeks from today)
 */
export function projectAchievementDate(currentValue, weeklyRate, targetValue) {
  if (weeklyRate <= 0) return null
  const weeks = (targetValue - currentValue) / weeklyRate
  return new Date(Date.now() + weeks * 7 * 86400000).toISOString().slice(0, 10)
}

/**
 * @description Computes the weekly improvement rate from dated performance data points
 *   using ordinary least squares linear regression.
 * @param {Array<{date:string, value:number}>} dataPoints - At least 2 dated measurements
 * @returns {number} Improvement per week (OLS slope), or 0 if fewer than 2 valid points
 * @example
 * calcWeeklyRate([{date:'2026-01-01',value:50},{date:'2026-02-01',value:54}])
 * // => ~1.0 (approx 1 unit/week)
 */
export function calcWeeklyRate(dataPoints) {
  if (!dataPoints || dataPoints.length < 2) return 0

  // Convert dates to week-units from the earliest date
  const t0 = new Date(dataPoints[0].date).getTime()
  const points = dataPoints.map(p => ({
    x: (new Date(p.date).getTime() - t0) / (7 * 86400000),
    y: p.value,
  }))

  const n = points.length
  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0)

  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return 0

  return (n * sumXY - sumX * sumY) / denom
}

/**
 * @description Evaluates whether the athlete is on track, behind, or the goal is impossible
 *   by comparing the projected achievement date to the deadline.
 * @param {{type:string, current:number, target:number, deadline:string}} goal - Goal definition object
 * @param {number} currentValue - Current measured value
 * @param {number} weeklyRate - Weekly improvement rate (from calcWeeklyRate)
 * @returns {{status:'on_track'|'behind'|'impossible', message:string}}
 * @example
 * getGoalStatus({target:60,deadline:'2026-06-01'}, 52, 1.0)
 * // => {status:'on_track', message:'On track — projected 2026-05-20'}
 */
export function getGoalStatus(goal, currentValue, weeklyRate) {
  const daysLeft = Math.ceil((new Date(goal.deadline) - new Date()) / 86400000)

  if (daysLeft <= 0) {
    return { status: 'impossible', message: 'Deadline passed' }
  }

  if (weeklyRate <= 0 && goal.target > currentValue) {
    return { status: 'behind', message: 'No improvement trend detected' }
  }

  const needed = (goal.target - currentValue) / (daysLeft / 7)

  const projDate = projectAchievementDate(currentValue, weeklyRate, goal.target)

  if (projDate !== null && projDate <= goal.deadline) {
    return { status: 'on_track', message: 'On track — projected ' + projDate }
  }

  if (weeklyRate > 0 && needed / weeklyRate > 3) {
    return { status: 'impossible', message: 'Target too aggressive for timeline' }
  }

  return {
    status: 'behind',
    message: 'Need ' + Math.round(needed * 10) / 10 + ' improvement/week',
  }
}
