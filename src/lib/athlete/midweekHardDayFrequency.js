// ─── midweekHardDayFrequency.js — Day-of-week hard-session distribution ─────
//
// Tracks the distribution of HARD sessions across the days of the week over
// the last 8 ISO weeks (Mon-Sun). The headline metric is the share of hard
// days that fall in the mid-week slot (Tue-Wed-Thu) vs the weekend (Sat-Sun).
//
// Why this matters (distinct from HardDaySpacingCard, HardEasyAdherenceCard,
// WeekendVolumeShareCard, DayOfWeekAvailabilityCard):
//   - HardDaySpacingCard counts hard→hard adjacencies (mean spacing).
//   - HardEasyAdherenceCard counts weeks that respect the no-two-hard-days rule.
//   - WeekendVolumeShareCard tracks weekend % of total VOLUME (minutes).
//   - DayOfWeekAvailabilityCard tracks which days a session was logged.
//   - This module answers a different question: WHEN in the week do hard
//     sessions actually happen? Working athletes often skew hard sessions
//     to the weekend (the "weekend warrior" pattern); serious athletes
//     tend to fit hard sessions mid-week to preserve weekends for long
//     aerobic sessions.
//
// Scientific grounding:
//   - Foster 2017 — session distribution across the microcycle is as
//     important as session count when judging training quality.
//   - Bompa 2018 (Periodization, 6th ed.) — hard-day placement WITHIN the
//     microcycle drives both adaptation and recovery; mid-week quality
//     work is the canonical pattern for serious endurance athletes.
//
// Methodology:
//   - For each calendar day in the trailing 8-ISO-week window (Mon-Sun)
//     ending in the week containing `today`, compute dayMaxTss = max of
//     `entry.tss` (finite, > 0) for entries on that date.
//   - A day is HARD if dayMaxTss ≥ 60 (simple portable floor — the spec
//     deliberately doesn't CTL-scale here because we're comparing the
//     day-of-week pattern, not adherence).
//   - Tag each hard day by ISO weekday (Mon=0..Sun=6 → mon/tue/.../sun).
//   - midweekHardCount = tue + wed + thu.
//   - weekendHardCount = sat + sun.
//   - midweekShare = midweekHardCount / max(totalHardDays, 1), 4dp.
//   - dominantDay = key with max count. Tie-break: earliest in the week
//     (mon first). null when totalHardDays === 0.
//
// Bands:
//   INSUFFICIENT_HARD  — totalHardDays < 6 across the 8-week window.
//   MIDWEEK_FOCUSED    — midweekShare ≥ 0.50 (half or more of hard days
//                        happen Tue-Thu).
//   WEEKEND_WARRIOR    — weekendHardCount / max(totalHardDays, 1) ≥ 0.60.
//   BALANCED           — otherwise.
//   (Check INSUFFICIENT_HARD first; if MIDWEEK_FOCUSED and WEEKEND_WARRIOR
//    both qualify — rare since they're mostly disjoint — MIDWEEK_FOCUSED
//    wins because it's the rarer-and-more-positive pattern.)
//
// Returns null when `today` is unresolvable.
//
// Pure function. No React, no I/O.

export const MIDWEEK_HARD_DAY_FREQUENCY_CITATION = 'Foster 2017; Bompa 2018'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_WINDOW_WEEKS = 8
const HARD_TSS_FLOOR = 60
const MIN_HARD_DAYS = 6
const MIDWEEK_THRESHOLD = 0.50
const WEEKEND_THRESHOLD = 0.60

// Mon=0..Sun=6 → keys for the dayCounts object.
const DOW_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

// Resolve `today` (Date or YYYY-MM-DD string) to a YYYY-MM-DD UTC ISO key.
function resolveTodayIso(today) {
  if (today instanceof Date && !Number.isNaN(today.getTime())) {
    return today.toISOString().slice(0, 10)
  }
  if (typeof today === 'string' && today) {
    const key = today.slice(0, 10)
    if (ISO_RE.test(key)) return key
  }
  return null
}

// Return ISO date string (YYYY-MM-DD) for the Monday of the ISO week
// containing `iso`. Week boundary follows ISO 8601 (Monday-first).
function isoMondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7 // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// ISO weekday index for a date string: Mon=0..Sun=6.
function isoDowIndex(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  return (d.getUTCDay() + 6) % 7
}

function round4(v) {
  return Math.round(v * 10000) / 10000
}

/**
 * Compute the distribution of HARD sessions across the days of the week
 * over the last `windowWeeks` ISO weeks (Mon-Sun) ending in the week
 * containing `today`.
 *
 * @param {{
 *   log: Array<{ date: string, tss?: number }>,
 *   today: string | Date,
 *   windowWeeks?: number,
 * }} args
 * @returns {{
 *   band: 'MIDWEEK_FOCUSED' | 'BALANCED' | 'WEEKEND_WARRIOR' | 'INSUFFICIENT_HARD',
 *   dayCounts: { mon: number, tue: number, wed: number, thu: number,
 *                fri: number, sat: number, sun: number },
 *   totalHardDays: number,
 *   midweekHardCount: number,
 *   weekendHardCount: number,
 *   midweekShare: number,
 *   dominantDay: 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun'|null,
 *   citation: string,
 * } | null}
 */
export function analyzeMidweekHardDayFrequency({ log, today, windowWeeks = DEFAULT_WINDOW_WEEKS } = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  const safeWindow = Math.max(1, Math.floor(Number(windowWeeks) || DEFAULT_WINDOW_WEEKS))

  // Window: Monday of the oldest week (inclusive) through Sunday of the
  // current week (inclusive). The exclusiveEnd is the Monday of the
  // week AFTER the current week.
  const currentMonday = isoMondayOf(todayIso)
  const earliestWeekStart = isoMinusDays(currentMonday, (safeWindow - 1) * 7)
  const exclusiveEnd = isoMinusDays(currentMonday, -7)

  // Per-date max TSS aggregation across all log entries in the window.
  const dayMaxTss = new Map()
  if (Array.isArray(log)) {
    for (const e of log) {
      if (!e || !e.date) continue
      const key = String(e.date).slice(0, 10)
      if (!ISO_RE.test(key)) continue
      if (key < earliestWeekStart) continue
      if (key >= exclusiveEnd) continue
      const tss = Number(e.tss)
      if (!Number.isFinite(tss) || tss <= 0) continue
      const prev = dayMaxTss.get(key) || 0
      if (tss > prev) dayMaxTss.set(key, tss)
    }
  }

  // dayCounts: # of HARD days (dayMaxTss ≥ 60) per ISO weekday.
  const dayCounts = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 }
  for (const [dateKey, maxTss] of dayMaxTss.entries()) {
    if (maxTss < HARD_TSS_FLOOR) continue
    const idx = isoDowIndex(dateKey)
    const key = DOW_KEYS[idx]
    dayCounts[key] += 1
  }

  const totalHardDays = DOW_KEYS.reduce((s, k) => s + dayCounts[k], 0)
  const midweekHardCount = dayCounts.tue + dayCounts.wed + dayCounts.thu
  const weekendHardCount = dayCounts.sat + dayCounts.sun

  const safeDenom = Math.max(totalHardDays, 1)
  const midweekShare = round4(midweekHardCount / safeDenom)
  const weekendShare = weekendHardCount / safeDenom

  // dominantDay: key with the highest count, earliest-in-the-week tie-break.
  let dominantDay = null
  if (totalHardDays > 0) {
    let bestCount = -1
    for (const k of DOW_KEYS) {
      if (dayCounts[k] > bestCount) {
        bestCount = dayCounts[k]
        dominantDay = k
      }
    }
    if (bestCount === 0) dominantDay = null
  }

  // Band classification — INSUFFICIENT_HARD first; MIDWEEK_FOCUSED wins
  // over WEEKEND_WARRIOR if both qualify.
  let band
  if (totalHardDays < MIN_HARD_DAYS) {
    band = 'INSUFFICIENT_HARD'
  } else if (midweekShare >= MIDWEEK_THRESHOLD) {
    band = 'MIDWEEK_FOCUSED'
  } else if (weekendShare >= WEEKEND_THRESHOLD) {
    band = 'WEEKEND_WARRIOR'
  } else {
    band = 'BALANCED'
  }

  return {
    band,
    dayCounts,
    totalHardDays,
    midweekHardCount,
    weekendHardCount,
    midweekShare,
    dominantDay,
    citation: MIDWEEK_HARD_DAY_FREQUENCY_CITATION,
  }
}
