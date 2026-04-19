// src/lib/coach/classifySession.js — E5: Session classifier
// Tags every training_log entry after insert.
// Pure function — no DB, no network, fully testable.
//
// Tags (mutually exclusive, priority ordered):
//   'test'           — formal protocol (FTP test, VO2max, CP, etc.)
//   'junk'           — too short to create training adaptation (< 20 min, RPE < 4)
//   'recovery'       — active recovery (duration < 45 min, RPE ≤ 4)
//   'planned_match'  — matches the plan target for this date (TSS within ±20%)
//   'planned_miss'   — plan had a session today but athlete didn't log, or logged but low
//   'unplanned_high' — significantly above plan target (> 140% TSS) or no plan + high load
//   'unplanned_low'  — athlete logged but significantly below plan (< 60% TSS)
//   'moderate'       — normal session within expected range, no plan context
//
// @param {Object} session  - training_log entry: { date, type, duration, rpe, tss, ... }
// @param {Object} [plan]   - coach_plans row for this athlete, or null
// @returns {{ tag: string, reason: string }}

const TEST_TYPES = new Set([
  'FTP Test', 'VO2max Test', 'CP Test', 'Ramp Test',
  '20-min Power Test', 'Cooper Test', '2000m Test', 'Lactate Test',
  '5K Time Trial', '10K Time Trial', 'Sprint Test', 'Field Test',
])

/**
 * Find the planned week and target TSS for a given date from coach_plans.
 * @param {Object} plan  - { weeks: [{weekLabel, tssEst, startDate, ...}], ... }
 * @param {string} date  - ISO date string 'YYYY-MM-DD'
 * @returns {{ targetTSS: number, weekLabel: string }|null}
 */
function findPlanWeek(plan, date) {
  if (!plan?.weeks?.length || !date) return null
  const d = new Date(date)
  for (const week of plan.weeks) {
    if (!week.startDate) continue
    const wStart = new Date(week.startDate)
    const wEnd = new Date(wStart)
    wEnd.setDate(wEnd.getDate() + 7)
    if (d >= wStart && d < wEnd) {
      return { targetTSS: week.tssEst || 0, weekLabel: week.weekLabel || '' }
    }
  }
  return null
}

/**
 * Classify a single training session.
 * @param {Object} session  - { date, type, duration, rpe, tss }
 * @param {Object} [plan]   - coach_plans row or null
 * @returns {{ tag: string, reason: string }}
 */
export function classifySession(session, plan = null) {
  if (!session || typeof session !== 'object') {
    return { tag: 'moderate', reason: 'No session data' }
  }

  const dur = Number(session.duration) || 0
  const rpe = Number(session.rpe) || 0
  const tss = Number(session.tss) || 0
  const type = session.type || ''

  // 1. Test session — highest priority
  if (TEST_TYPES.has(type)) {
    return { tag: 'test', reason: `${type} is a formal test protocol` }
  }

  // 2. Junk — too brief and too easy to produce any adaptation
  if (dur < 20 && rpe < 4) {
    return { tag: 'junk', reason: `${dur}min at RPE ${rpe} is below adaptation threshold (20min / RPE 4)` }
  }

  // 3. Active recovery — easy and short
  if (dur < 45 && rpe <= 4) {
    return { tag: 'recovery', reason: `${dur}min at RPE ${rpe} — active recovery intensity` }
  }

  // 4. Plan-context classification
  const planWeek = findPlanWeek(plan, session.date)
  if (planWeek && planWeek.targetTSS > 0) {
    // Per-session target is roughly 1/5 of weekly target (avg 5 sessions/week)
    const sessionTarget = planWeek.targetTSS / 5

    if (tss > 0 && sessionTarget > 0) {
      const sessionRatio = tss / sessionTarget
      if (sessionRatio >= 0.8 && sessionRatio <= 1.4) {
        return { tag: 'planned_match', reason: `TSS ${tss} is within ±40% of per-session target (${Math.round(sessionTarget)})` }
      }
      if (sessionRatio > 1.4) {
        return { tag: 'unplanned_high', reason: `TSS ${tss} is ${Math.round((sessionRatio - 1) * 100)}% above session target (${Math.round(sessionTarget)})` }
      }
      if (sessionRatio < 0.6) {
        return { tag: 'unplanned_low', reason: `TSS ${tss} is ${Math.round((1 - sessionRatio) * 100)}% below session target (${Math.round(sessionTarget)})` }
      }
    }
  }

  // 5. No plan context — classify by absolute load
  if (tss >= 150 || (dur >= 120 && rpe >= 7)) {
    return { tag: 'unplanned_high', reason: `High load session (TSS ${tss}, ${dur}min) without plan context` }
  }

  return { tag: 'moderate', reason: 'Normal training session' }
}

/**
 * Classify a missed planned session (athlete had a plan day with no session logged).
 * @param {{ targetTSS: number, weekLabel: string }} planDay
 * @returns {{ tag: 'planned_miss', reason: string }}
 */
export function classifyMiss(planDay) {
  return {
    tag: 'planned_miss',
    reason: `No session logged for ${planDay.weekLabel} (target: ${planDay.targetTSS} TSS/week)`,
  }
}

/**
 * Aggregate classification counts for a week of sessions.
 * @param {Array} sessions  - array of classified sessions { tag }
 * @returns {{ planned_match: number, planned_miss: number, unplanned_high: number, unplanned_low: number, test: number, recovery: number, junk: number, moderate: number, compliance: number }}
 */
export function aggregateWeekClassification(sessions) {
  const counts = {
    planned_match: 0, planned_miss: 0, unplanned_high: 0,
    unplanned_low: 0, test: 0, recovery: 0, junk: 0, moderate: 0,
  }
  for (const s of (sessions || [])) {
    if (s?.tag in counts) counts[s.tag]++
  }
  // compliance = planned_match / (planned_match + planned_miss + unplanned_low)
  const denominator = counts.planned_match + counts.planned_miss + counts.unplanned_low
  counts.compliance = denominator > 0
    ? Math.round((counts.planned_match / denominator) * 100)
    : null
  return counts
}
