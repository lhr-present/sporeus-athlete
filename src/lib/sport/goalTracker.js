// ─── goalTracker.js — Goal progress tracking and projection utilities ──────────

// ─── getGoalProgress ─────────────────────────────────────────────────────────
// @param {object} goal — { type, current, target, deadline }
// @param {number} currentValue — latest measured value
// @returns {{ pct: number, daysLeft: number, status: 'on_track'|'behind'|'impossible' }}
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

// ─── projectAchievementDate ───────────────────────────────────────────────────
// @param {number} currentValue
// @param {number} weeklyRate — improvement per week
// @param {number} targetValue
// @returns {string|null} ISO date 'YYYY-MM-DD' or null if rate <= 0
export function projectAchievementDate(currentValue, weeklyRate, targetValue) {
  if (weeklyRate <= 0) return null
  const weeks = (targetValue - currentValue) / weeklyRate
  return new Date(Date.now() + weeks * 7 * 86400000).toISOString().slice(0, 10)
}

// ─── calcWeeklyRate ───────────────────────────────────────────────────────────
// Simple linear regression: slope per week from dated data points.
// @param {Array<{date: string, value: number}>} dataPoints — at least 2 points
// @returns {number} improvement per week (slope), or 0 if fewer than 2 points
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

// ─── getGoalStatus ────────────────────────────────────────────────────────────
// @param {object} goal — { type, current, target, deadline }
// @param {number} currentValue
// @param {number} weeklyRate
// @returns {{ status: 'on_track'|'behind'|'impossible', message: string }}
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
