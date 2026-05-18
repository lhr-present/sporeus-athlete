// src/lib/athlete/morningLogConsistency.js
//
// Morning-log consistency analyzer.
//
// Surfaces how reliably the athlete has logged a morning recovery entry
// (sleep / HRV / RHR) across the last N days. The recovery side of the
// system is only as good as its inputs — sporadic logging produces
// sporadic insight quality. This analyzer turns the meta-signal
// (did you actually fill the form?) into a habit-formation feedback
// loop.
//
// Citations:
//   Wood W. & Neal D.T. (2013) "The Habits of Health and Wellness:
//     Understanding the Psychology of Habit." Curr. Dir. Psychol. Sci.
//   Lally P. et al. (2010) "How are habits formed: Modelling habit
//     formation in the real world." Eur. J. Soc. Psychol. 40, 998–1009.
//
// Pure function. No I/O. No React.

const MS_PER_DAY = 86400000

/**
 * @description Default classification thresholds (completion ratio).
 *   Aligns with Lally 2010's "automaticity plateau" observations —
 *   once a behavior hits ~80% completion in a fixed cue window, it
 *   has crossed into habituated territory; below 50% the behavior
 *   has not yet acquired contextual cuing.
 */
export const MORNING_LOG_THRESHOLDS = Object.freeze({
  habituated: 0.80,
  developing: 0.50,
})

function dayMs(iso) {
  if (!iso) return null
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z')
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

function isoFromMs(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * @description Does this recovery entry count as "logged"? Yes when at
 *   least one of the three core morning fields has a defined finite
 *   numeric value. We intentionally accept partial entries — habit
 *   reinforcement should reward the act of showing up, not penalize
 *   the day the chest strap was missing.
 */
function isLogged(entry) {
  if (!entry || typeof entry !== 'object') return false
  const fields = ['sleepHrs', 'hrv', 'restingHR']
  for (const f of fields) {
    const v = entry[f]
    if (v === null || v === undefined || v === '') continue
    const n = Number(v)
    if (Number.isFinite(n)) return true
  }
  return false
}

/**
 * @description Classify a completion rate into a habit-formation band.
 * @param {number} rate - 0..1
 * @returns {'HABITUATED'|'DEVELOPING'|'SPORADIC'|null}
 */
export function classifyMorningLogBand(rate) {
  if (!Number.isFinite(rate)) return null
  if (rate >= MORNING_LOG_THRESHOLDS.habituated) return 'HABITUATED'
  if (rate >= MORNING_LOG_THRESHOLDS.developing) return 'DEVELOPING'
  return 'SPORADIC'
}

/**
 * @description Analyze morning-log consistency across a recent window.
 *
 * @param {{
 *   recovery: Array<{ date?: string, sleepHrs?: number, hrv?: number, restingHR?: number }>,
 *   today?:   string,  // 'YYYY-MM-DD', defaults to today UTC
 *   windowDays?: number, // defaults to 28
 * }} args
 * @returns {{
 *   band:           'HABITUATED'|'DEVELOPING'|'SPORADIC',
 *   daysLogged:     number,
 *   completionRate: number,
 *   currentStreak:  number,
 *   longestStreak:  number,
 *   windowDays:     number,
 *   citation:       string,
 * } | null}
 */
export function analyzeMorningLogConsistency({
  recovery,
  today,
  windowDays = 28,
} = {}) {
  if (!Array.isArray(recovery) || recovery.length === 0) return null
  if (!Number.isFinite(windowDays) || windowDays <= 0) return null
  // Coerce non-integer counts to a sensible integer to avoid off-by-fractional
  // surprises downstream.
  const win = Math.floor(windowDays)
  if (win <= 0) return null

  const tToday = today || new Date().toISOString().slice(0, 10)
  const todayMs = dayMs(tToday)
  if (todayMs == null) return null

  // Build a set of ISO days that count as "logged".
  const loggedDays = new Set()
  for (const e of recovery) {
    if (!isLogged(e)) continue
    const dMs = dayMs(e?.date)
    if (dMs == null) continue
    loggedDays.add(isoFromMs(dMs))
  }

  // Walk the window from today backward. day[0] = today, day[win-1] = oldest.
  let daysLogged = 0
  let currentStreak = 0
  let longestStreak = 0
  let runningStreak = 0
  let currentStreakStillRunning = true

  for (let i = 0; i < win; i++) {
    const dayIso = isoFromMs(todayMs - i * MS_PER_DAY)
    const logged = loggedDays.has(dayIso)
    if (logged) {
      daysLogged += 1
      runningStreak += 1
      if (runningStreak > longestStreak) longestStreak = runningStreak
      if (currentStreakStillRunning) currentStreak = runningStreak
    } else {
      runningStreak = 0
      currentStreakStillRunning = false
    }
  }

  const completionRate = daysLogged / win
  const band = classifyMorningLogBand(completionRate)
  if (!band) return null

  return {
    band,
    daysLogged,
    completionRate,
    currentStreak,
    longestStreak,
    windowDays: win,
    citation: 'Wood 2013; Lally 2010',
  }
}
