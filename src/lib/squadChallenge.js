// ─── squadChallenge.js — Pure functions for Squad Monthly Challenge (E11) ──────
// No side effects — no localStorage access here, no Supabase calls.

/**
 * Create a new challenge object.
 * @param {{ title: string, metric: 'distance'|'duration'|'sessions', targetValue: number, startDate: string, endDate: string }} opts
 * @returns {{ id: string, title: string, metric: string, targetValue: number, startDate: string, endDate: string, createdAt: string }}
 */
export function createChallenge({ title, metric, targetValue, startDate, endDate }) {
  return {
    id: crypto.randomUUID(),
    title,
    metric,
    targetValue: Number(targetValue),
    startDate,
    endDate,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Compute an athlete's progress against a challenge.
 * @param {Array<Object>} sessions — log entries (each has date, distance, duration)
 * @param {{ metric: string, targetValue: number, startDate: string, endDate: string }} challenge
 * @returns {{ value: number, pct: number }}
 */
export function computeAthleteProgress(sessions, challenge) {
  const start = new Date(challenge.startDate)
  const end   = new Date(challenge.endDate)

  const inRange = sessions.filter(s => {
    const d = new Date(s.date)
    return d >= start && d <= end
  })

  let value = 0
  if (challenge.metric === 'distance') {
    value = inRange.reduce((sum, s) => sum + (Number(s.distance) || 0), 0)
  } else if (challenge.metric === 'duration') {
    // duration stored in minutes — convert to hours
    value = inRange.reduce((sum, s) => sum + (Number(s.duration) || 0), 0) / 60
  } else if (challenge.metric === 'sessions') {
    value = inRange.length
  }

  const pct = challenge.targetValue > 0
    ? Math.min(100, (value / challenge.targetValue) * 100)
    : 0

  return { value: Math.round(value * 100) / 100, pct: Math.round(pct * 10) / 10 }
}

/**
 * Sort a list of athlete progress records descending by value, assign rank.
 * @param {Array<{ athleteId: string, name: string, value: number }>} progressList
 * @returns {Array<{ athleteId: string, name: string, value: number, rank: number }>}
 */
export function rankAthletes(progressList) {
  return [...progressList]
    .sort((a, b) => b.value - a.value)
    .map((item, idx) => ({ ...item, rank: idx + 1 }))
}
