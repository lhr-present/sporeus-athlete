// src/lib/ostrc.js — OSTRC-Q2 weekly injury/illness surveillance (pure functions)
// Reference: Clarsen et al. (2020) update of OSTRC-Q2, Br J Sports Med
// 4 questions × 0–25 each → total 0–100

/** Sum of 4 OSTRC answers → total score 0–100 */
export function ostrcScore(answers) {
  return answers.reduce((sum, a) => sum + (a || 0), 0)
}

/**
 * Risk tier from total OSTRC score.
 *   0        → 'none'
 *   1–25     → 'minor'
 *   26–50    → 'moderate'
 *   51–100   → 'substantial'
 */
export function ostrcRisk(score) {
  if (score > 50) return 'substantial'
  if (score > 25) return 'moderate'
  if (score > 0)  return 'minor'
  return 'none'
}

/**
 * ISO 8601 week key for a Date, e.g. '2026-W15'.
 * Monday = start of week. Handles year boundary correctly.
 */
export function isoWeekKey(date = new Date()) {
  // Fully UTC-anchored. Previously this mixed setUTCHours (UTC) with getDate/
  // getDay/getFullYear + a local Date(y,0,4) constructor — for non-UTC users that
  // produced the wrong ISO week near week/year boundaries (the local getters read
  // a different calendar day than the UTC-zeroed instant).
  const d = new Date(date)
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + 3 - (d.getUTCDay() + 6) % 7)
  const week1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const weekNum = 1 + Math.round(
    ((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getUTCDay() + 6) % 7) / 7
  )
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
