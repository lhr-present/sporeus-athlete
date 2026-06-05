// src/lib/plan/trainingDays.js — training day-of-week preference (pure)
//
// The plan generator emits N sessions packed onto consecutive days (Mon-first):
// getTodayPlannedSession indexes a week's sessions by *weekday*, so a 5-day plan
// left Sat/Sun (index 5/6) undefined → "weekend always rest", wrong for athletes
// whose long run is on the weekend. This module lets a user choose WHICH weekdays
// they train; the chosen set is stored on the plan as `trainingDow` and the daily
// lookup maps today's weekday → the session ordinal for that day.
//
// Convention: ISO weekday index, Monday=0 … Sunday=6 (matches the
// `(getDay()+6)%7` used in getTodayPlannedSession).

export const DOW_LABELS = {
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  tr: ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'],
}

/**
 * Normalize a training-days value into a sorted, de-duplicated array of ISO
 * weekday indices (Mon=0…Sun=6). Accepts an array of numbers/strings.
 * Returns null when there is no usable preference (caller falls back to legacy
 * Mon-first behavior).
 * @param {*} value - e.g. [0,2,4] or ['0','2','4']
 * @returns {number[]|null}
 */
export function normalizeTrainingDow(value) {
  if (!Array.isArray(value)) return null
  const seen = new Set()
  for (const raw of value) {
    // Reject null/undefined/''/boolean explicitly — Number(null)===0 would
    // otherwise silently become Monday.
    if (raw === null || raw === undefined || raw === '' || typeof raw === 'boolean') continue
    const n = Math.floor(Number(raw))
    if (Number.isFinite(n) && n >= 0 && n <= 6) seen.add(n)
  }
  if (seen.size === 0) return null
  return [...seen].sort((a, b) => a - b)
}

/**
 * The default Mon-first day set for a given training-day COUNT — reproduces the
 * legacy packing (5 → [0,1,2,3,4]). Used when a count is known but no explicit
 * weekday preference is set.
 * @param {number} count
 * @returns {number[]|null}
 */
export function defaultDowForCount(count) {
  const n = Math.floor(Number(count))
  if (!Number.isFinite(n) || n < 1) return null
  return Array.from({ length: Math.min(7, n) }, (_, i) => i)
}

/**
 * Map today's ISO weekday to the session ordinal for a plan week, given the
 * plan's training-day set. Returns the index into week.sessions, or -1 if today
 * is a rest day (not in the set).
 * @param {number} isoDow - Monday=0…Sunday=6
 * @param {number[]} dow - sorted training-day set
 * @returns {number}
 */
export function sessionOrdinalForDay(isoDow, dow) {
  if (!Array.isArray(dow)) return -1
  return dow.indexOf(isoDow)
}
