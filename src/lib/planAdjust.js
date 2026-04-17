// ─── src/lib/planAdjust.js — Injury-driven plan volume adjustment ─────────────
// Pure math for computing and applying volume cuts to coach_plans.weeks.
// Mirrors adjust-coach-plan edge function logic for unit testing.

/**
 * Volume cut percentage by injury severity level (1–5).
 * Levels 1–2 = mild, level 3 = moderate, levels 4–5 = severe.
 */
export const VOLUME_CUT_BY_LEVEL = Object.freeze({
  1: 20,
  2: 20,
  3: 30,
  4: 40,
  5: 40,
})

/**
 * Return the volume cut percentage for a given injury severity level (1–5).
 * @param {number} level — injury level (1 = minimal, 5 = severe)
 * @returns {number} cut percentage (20, 30, or 40)
 */
export function volumeCutPct(level) {
  return VOLUME_CUT_BY_LEVEL[level] ?? 20
}

/**
 * Apply a volume reduction to all plan weeks that start within [fromDate, fromDate+toDays).
 * Reduces `duration` and `tss` on each session within affected weeks by `cutPct` percent.
 * Adds an auto-adjustment annotation to each affected session's notes.
 *
 * @param {object[]} weeks    — coach_plans.weeks JSONB array
 * @param {string}   fromDate — ISO date string (YYYY-MM-DD) where cut window starts
 * @param {number}   toDays   — number of days the cut window spans (usually 7)
 * @param {number}   cutPct   — percentage to cut (0–100)
 * @returns {object[]} — new weeks array with cuts applied (input not mutated)
 */
export function applyVolumeReduction(weeks, fromDate, toDays, cutPct) {
  if (!Array.isArray(weeks) || !fromDate || cutPct <= 0) return weeks
  const factor  = 1 - cutPct / 100
  const fromMs  = new Date(fromDate).getTime()
  const toMs    = fromMs + toDays * 86400_000

  return weeks.map(week => {
    const weekDateStr = week.start_date || week.date || week.weekStart || week.week_start || ''
    const weekMs      = new Date(weekDateStr).getTime()
    if (isNaN(weekMs) || weekMs < fromMs || weekMs >= toMs) return week

    const sessions = Array.isArray(week.sessions) ? week.sessions : []
    return {
      ...week,
      volume_adjusted: true,
      volume_cut_pct:  cutPct,
      sessions: sessions.map(s => ({
        ...s,
        duration: typeof s.duration === 'number' ? Math.round(s.duration * factor) : s.duration,
        tss:      typeof s.tss      === 'number' ? Math.round(s.tss      * factor) : s.tss,
        notes:    `[AUTO-ADJUSTED -${cutPct}% injury] ${s.notes || ''}`.trim(),
      })),
    }
  })
}
