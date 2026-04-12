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
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(
    ((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7
  )
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
