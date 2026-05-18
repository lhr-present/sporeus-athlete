// src/lib/athlete/weeklyGoalVariance.js
//
// Weekly TSS Goal Variance — 8-week tracker for goal-setting adherence.
//
// Scientific grounding:
//   - Locke 2002 ("Building a practically useful theory of goal setting and
//     task motivation") — specific, measurable goals drive higher performance
//     than "do your best" framings; feedback loops on goal-progress are
//     necessary for sustained motivation.
//   - Latham 2002 — goals must be sufficiently challenging without being
//     impossible; chronic under- or over-attainment both degrade motivation
//     and outcome quality, so a periodic variance check supports re-anchoring.
//
// What this computes:
//   - For each of 8 calendar weeks ending in the week containing `today`,
//     sum every session's TSS.
//   - For each week, compute variance = (actualTss - goal) / goal.
//   - Aggregate avgVariance = mean of all 8 weekly variances.
//   - Classify the overall band:
//       ON_TARGET — |avgVariance| ≤ 0.10
//       UNDER     — avgVariance < -0.10
//       OVER      — avgVariance > +0.10
//
// Returns null when:
//   - profile.weeklyTssGoal is missing/<=0, OR
//   - fewer than 4 of the 8 weeks have any sessions (insufficient signal).
//
// Pure function. No React, no I/O.

export const WEEKLY_GOAL_VARIANCE_CITATION = 'Locke 2002; Latham 2002'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const ON_TARGET_TOLERANCE = 0.10
const WINDOW_WEEKS = 8
const MIN_WEEKS_WITH_SESSIONS = 4

function isValidIso(s) {
  return typeof s === 'string' && ISO_RE.test(s)
}

// Return ISO date string (YYYY-MM-DD) for the Monday of the week containing
// `iso`. Week boundary follows ISO 8601 (Monday-first).
function isoMondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  // getUTCDay → Sun=0..Sat=6; convert so Mon=0..Sun=6.
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function classifyBand(avgVariance) {
  if (!Number.isFinite(avgVariance)) return null
  if (avgVariance > ON_TARGET_TOLERANCE) return 'OVER'
  if (avgVariance < -ON_TARGET_TOLERANCE) return 'UNDER'
  return 'ON_TARGET'
}

/**
 * @param {{
 *   log: Array<{date:string, tss?:number}>,
 *   profile: {weeklyTssGoal?: number} | null | undefined,
 *   today: string,
 * }} args
 * @returns {{
 *   band: 'ON_TARGET' | 'UNDER' | 'OVER',
 *   avgVariance: number,
 *   weeklyTssGoal: number,
 *   weeks: Array<{ weekStart: string, actualTss: number, variance: number }>,
 *   citation: string,
 * } | null}
 */
export function analyzeWeeklyGoalVariance({ log, profile, today } = {}) {
  if (!isValidIso(today)) return null

  const goal = Number(profile && profile.weeklyTssGoal) || 0
  if (!Number.isFinite(goal) || goal <= 0) return null

  // Week containing `today` is the most recent (index 7); week 0 is the
  // earliest of the 8-week window.
  const currentMonday = isoMondayOf(today)
  const weeks = []
  for (let i = WINDOW_WEEKS - 1; i >= 0; i--) {
    const weekStart = isoMinusDays(currentMonday, i * 7)
    weeks.push({ weekStart, actualTss: 0 })
  }

  // Build a lookup: weekStart ISO → weeks index.
  const idxByWeekStart = {}
  weeks.forEach((w, i) => { idxByWeekStart[w.weekStart] = i })

  // Earliest and latest weekStart bounds for fast skip.
  const earliestWeekStart = weeks[0].weekStart
  // weekStart of the week AFTER the current week — anything ≥ this is out.
  const exclusiveEnd = isoMinusDays(currentMonday, -7)

  if (Array.isArray(log)) {
    for (const e of log) {
      if (!e || !e.date) continue
      const key = String(e.date).slice(0, 10)
      if (!ISO_RE.test(key)) continue
      if (key < earliestWeekStart) continue
      if (key >= exclusiveEnd) continue
      const wkStart = isoMondayOf(key)
      const idx = idxByWeekStart[wkStart]
      if (idx == null) continue
      const tss = Number(e.tss) || 0
      if (tss <= 0) continue
      weeks[idx].actualTss += tss
    }
  }

  // Count weeks with any sessions; require ≥ MIN_WEEKS_WITH_SESSIONS.
  const weeksWithSessions = weeks.reduce((n, w) => n + (w.actualTss > 0 ? 1 : 0), 0)
  if (weeksWithSessions < MIN_WEEKS_WITH_SESSIONS) return null

  // Compute per-week variance and aggregate average.
  const round3 = v => Math.round(v * 1000) / 1000
  const weeksWithVariance = weeks.map(w => {
    const variance = (w.actualTss - goal) / goal
    return {
      weekStart: w.weekStart,
      actualTss: Math.round(w.actualTss),
      variance: round3(variance),
    }
  })

  const sumVariance = weeksWithVariance.reduce((s, w) => s + w.variance, 0)
  const avgVariance = round3(sumVariance / WINDOW_WEEKS)
  const band = classifyBand(avgVariance)
  if (!band) return null

  return {
    band,
    avgVariance,
    weeklyTssGoal: goal,
    weeks: weeksWithVariance,
    citation: WEEKLY_GOAL_VARIANCE_CITATION,
  }
}
