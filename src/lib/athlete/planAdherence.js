// ─── lib/athlete/planAdherence.js — E32: Plan Adherence Tracker ──────────────
// Compute week-by-week planned vs actual TSS for last `weeks` plan weeks.
//
// Plan schema (from localStorage 'sporeus-plan'):
//   { generatedAt: 'YYYY-MM-DD', weeks: [{ week, phase, sessions, tss, ... }] }
//
// Week start dates are computed as: new Date(plan.generatedAt) + weekIndex * 7 days
//
// planStatus (from localStorage 'sporeus-plan-status') is keyed as `${weekIdx}-${dayIdx}`
// with values 'done' | 'modified' — it does NOT store TSS; actual TSS comes from log.

/**
 * Compute week-by-week planned vs actual TSS for last `weeks` plan weeks.
 *
 * @param {Object|null} plan        - plan object from localStorage (may be null)
 * @param {Object}      planStatus  - planStatus object from localStorage (may be {})
 * @param {Array}       log         - training log entries [{ date, tss }]
 * @param {number}      weeks       - how many recent plan weeks to return (default 8)
 * @param {string}      today       - 'YYYY-MM-DD' (default: current date)
 *
 * @returns {Array} [] if plan is null or plan.weeks is empty.
 *   Otherwise [{ weekStart, plannedTSS, actualTSS, compliance, status }] sorted oldest→newest.
 *   - compliance: (actualTSS / plannedTSS * 100) clamped [0, 150], or null if plannedTSS === 0
 *   - status: 'on_track' (80–115%), 'over' (>115%), 'under' (<80%), 'unknown' if compliance null
 */
export function computePlanAdherence(
  plan,
  planStatus,
  log = [],
  weeks = 8,
  today = new Date().toISOString().slice(0, 10),
) {
  if (!plan || !Array.isArray(plan.weeks) || plan.weeks.length === 0) return []

  const generatedAt = plan.generatedAt || plan.start_date
  if (!generatedAt) return []

  const planStart = new Date(generatedAt + 'T00:00:00Z')
  const todayMs   = new Date(today + 'T00:00:00Z').getTime()
  const totalPlanWeeks = plan.weeks.length

  // Determine which week index today falls in (0-based)
  const currentWeekIdx = Math.floor((todayMs - planStart.getTime()) / (7 * 86400000))

  // Collect all weeks that have started (weekIdx <= currentWeekIdx) and exist in plan
  const completedWeekIndices = []
  for (let wi = 0; wi < totalPlanWeeks; wi++) {
    const wStartMs = planStart.getTime() + wi * 7 * 86400000
    if (wStartMs <= todayMs) {
      completedWeekIndices.push(wi)
    }
  }

  // Take the last `weeks` of those
  const sliceStart = Math.max(0, completedWeekIndices.length - weeks)
  const selectedIndices = completedWeekIndices.slice(sliceStart)

  return selectedIndices.map(wi => {
    const weekStartDate = new Date(planStart.getTime() + wi * 7 * 86400000)
    const weekEndDate   = new Date(weekStartDate.getTime() + 7 * 86400000)
    const weekStartStr  = weekStartDate.toISOString().slice(0, 10)
    const weekEndStr    = weekEndDate.toISOString().slice(0, 10)

    const planWeek     = plan.weeks[wi]
    const plannedTSS   = planWeek?.tss || planWeek?.TSS || 0

    // Sum log TSS for dates in [weekStart, weekEnd)
    const actualTSS = (log || []).reduce((sum, e) => {
      const d = (e.date || '').slice(0, 10)
      if (d >= weekStartStr && d < weekEndStr) return sum + (e.tss || 0)
      return sum
    }, 0)

    let compliance = null
    let status     = 'unknown'

    if (plannedTSS > 0) {
      compliance = Math.min(150, Math.max(0, Math.round(actualTSS / plannedTSS * 100)))
      if      (compliance > 115) status = 'over'
      else if (compliance >= 80) status = 'on_track'
      else                       status = 'under'
    }

    return { weekStart: weekStartStr, plannedTSS, actualTSS: Math.round(actualTSS), compliance, status }
  })
}

/**
 * Returns a summary object, or null if no plan data.
 *
 * @returns {{ adherenceWeeks, avgCompliance, overallStatus, weeksOnTrack, weeksOver, weeksUnder } | null}
 *   - overallStatus: 'on_track' | 'over' | 'under' | null (if no data with compliance)
 */
export function computeAdherenceSummary(
  plan,
  planStatus,
  log = [],
  weeks = 8,
  today = new Date().toISOString().slice(0, 10),
) {
  const adherenceWeeks = computePlanAdherence(plan, planStatus, log, weeks, today)
  if (adherenceWeeks.length === 0) return null

  const withCompliance = adherenceWeeks.filter(w => w.compliance !== null)
  const avgCompliance  = withCompliance.length
    ? Math.round(withCompliance.reduce((s, w) => s + w.compliance, 0) / withCompliance.length)
    : null

  let overallStatus = null
  if (avgCompliance !== null) {
    if      (avgCompliance > 115) overallStatus = 'over'
    else if (avgCompliance >= 80) overallStatus = 'on_track'
    else                          overallStatus = 'under'
  }

  const weeksOnTrack = adherenceWeeks.filter(w => w.status === 'on_track').length
  const weeksOver    = adherenceWeeks.filter(w => w.status === 'over').length
  const weeksUnder   = adherenceWeeks.filter(w => w.status === 'under').length

  return { adherenceWeeks, avgCompliance, overallStatus, weeksOnTrack, weeksOver, weeksUnder }
}
