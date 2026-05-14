// src/lib/athlete/raceRetrospective.js
//
// v9.120.0 — Post-race retrospective detector.
//
// v9.113.0 (Prompt DDD) introduced Mission 2's `race_committed` —
// athletes set a future race date and the system congratulated them.
// But when that date passed, nothing surfaced. The commitment fizzled.
// The system knew the race was important enough to track for taper
// warnings (v9.85.0) and race-week banners (v9.108.0) but lost
// interest the day after.
//
// This detector flags races whose date is between 1 and 7 days in
// the past — the natural "how did it go" window. The TodayView card
// uses it to surface a retrospective form: outcome (hit/missed/DNF)
// + optional result note. Submit emits `race_completed` attribution
// and (via localStorage gate) suppresses the card.
//
// Pure function. No I/O.

const MS_PER_DAY = 86400000

/**
 * @description Window in days after the race during which the
 *   retrospective is surfaced. After this window the card hides
 *   silently — the prompt becomes stale, and we don't want to
 *   harass an athlete who simply forgot to log.
 */
export const RACE_RETRO_WINDOW_DAYS = 7

/**
 * @description Detect whether profile.raceDate is in the
 *   retrospective window (1–7 days past). Returns null when no race
 *   is configured, the race is in the future, on race day itself,
 *   or more than 7 days ago.
 *
 *   Race day (daysSince === 0) is intentionally excluded — the
 *   athlete is presumably still at the event. Day 1+ is the earliest
 *   moment they could meaningfully reflect.
 *
 * @param {Object} profile
 * @param {string} [today]  ISO 'YYYY-MM-DD'; defaults to today UTC
 * @returns {{ raceDate: string, daysSince: number } | null}
 */
export function detectRaceRetrospective(profile, today) {
  const rd = profile?.raceDate
  if (!rd) return null
  const tToday = today || new Date().toISOString().slice(0, 10)
  // Compare at noon UTC to dodge TZ-edge bleed.
  const raceMs = new Date(String(rd).slice(0, 10) + 'T12:00:00Z').getTime()
  const todayMs = new Date(String(tToday).slice(0, 10) + 'T12:00:00Z').getTime()
  if (Number.isNaN(raceMs) || Number.isNaN(todayMs)) return null
  const daysSince = Math.floor((todayMs - raceMs) / MS_PER_DAY)
  if (daysSince < 1 || daysSince > RACE_RETRO_WINDOW_DAYS) return null
  return { raceDate: String(rd).slice(0, 10), daysSince }
}

/**
 * @description Canonical outcome keys. Kept in sync with the
 *   bilingual labels in TodayView's retrospective card. Closed set
 *   so attribution telemetry can aggregate cleanly.
 */
export const RACE_OUTCOMES = ['hit_goal', 'missed_goal', 'dnf']

/**
 * @description Returns the localStorage key that gates a one-shot
 *   retrospective submission. Keyed per raceDate so a new commitment
 *   resurfaces the prompt.
 */
export function retroLocalStorageKey(raceDate) {
  return `sporeus-race-retro-${String(raceDate).slice(0, 10)}`
}
