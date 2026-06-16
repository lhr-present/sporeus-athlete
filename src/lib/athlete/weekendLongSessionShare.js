// ─── weekendLongSessionShare.js — Weekend share of LONG sessions ────────────
//
// Tracks the day-of-week distribution of *long* sessions (durationMin ≥ 90)
// across the last `windowWeeks` ISO weeks (Mon-Sun, default 12). The headline
// metric is `weekendShare` — the fraction of long sessions that fall on
// Sat or Sun.
//
// Why this matters (distinct from neighbouring cards):
//   - WeekendVolumeShareCard tracks weekend % of total VOLUME (all minutes).
//   - LongSessionShareCard tracks the % of WEEKLY MINUTES the long session
//     consumes (intra-week distribution).
//   - LongRunFrequencyCard counts run-specific long sessions per month.
//   - LongRunConsistencyCard tracks long-run cadence variance.
//   - This module answers a different question: of all the LONG sessions
//     the athlete does (any sport), what fraction happen on Sat/Sun?
//
// Scientific grounding:
//   - Foster 2017 — placement of long aerobic sessions inside the
//     microcycle is informative; 100% weekend long sessions = no flexibility
//     when life intervenes (rain, kids, work travel), 0% weekend long
//     sessions is unusual mid-week aerobic emphasis worth surfacing.
//   - Bompa 2018 (Periodization, 6th ed.) — amateur athletes typically
//     back-load long sessions to weekends because of work; the share
//     surfaces that pattern over a 12-week macro window.
//
// Methodology:
//   - Resolve `today` (Date or ISO string) to a UTC YYYY-MM-DD key.
//   - Window: Monday of the oldest week (inclusive) through Sunday of the
//     current week (inclusive). That's `windowWeeks` ISO weeks.
//   - A "long session" = entry with durationMin ≥ longSessionMinThreshold
//     (default 90). Both `durationMin` and `duration_min` are accepted;
//     camelCase wins when both are present.
//   - Tag each qualifying entry by ISO weekday (Mon=0..Sun=6 →
//     mon/tue/.../sun) and increment longSessionsByDay.
//   - longSessions = sum of longSessionsByDay.
//   - weekdayLongCount = mon + tue + wed + thu + fri.
//   - weekendLongCount = sat + sun.
//   - weekendShare = weekendLongCount / max(longSessions, 1), 4dp.
//
// Bands:
//   INSUFFICIENT_LONG_SESSIONS — longSessions < 6 across the window.
//   WEEKDAY_DOMINANT           — weekendShare ≤ 0.30.
//   WEEKEND_DOMINANT           — weekendShare ≥ 0.70.
//   MIXED                      — otherwise.
//
// Returns null when `today` is unresolvable.
//
// Pure function. No React, no I/O.

export const WEEKEND_LONG_SESSION_SHARE_CITATION = 'Foster 2017; Bompa 2018'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_WINDOW_WEEKS = 12
const DEFAULT_LONG_SESSION_MIN = 90
const MIN_LONG_SESSIONS = 6
const WEEKDAY_DOMINANT_THRESHOLD = 0.30
const WEEKEND_DOMINANT_THRESHOLD = 0.70

// Mon=0..Sun=6 → keys for the longSessionsByDay object.
const DOW_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const WEEKEND_KEYS = new Set(['sat', 'sun'])

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

// Read the entry's duration in minutes. sanitizeLogEntry emits `duration`, so
// prefer it; fall back to the legacy raw names (`durationMin`/`duration_min`)
// for unsanitized/imported entries.
function entryDurationMin(entry) {
  if (!entry) return 0
  const raw = entry.duration ?? entry.durationMin ?? entry.duration_min
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Compute the day-of-week distribution of LONG sessions across the last
 * `windowWeeks` ISO weeks (Mon-Sun) ending in the week containing `today`.
 *
 * @param {{
 *   log: Array<{ date: string, durationMin?: number, duration_min?: number }>,
 *   today: string | Date,
 *   windowWeeks?: number,
 *   longSessionMinThreshold?: number,
 * }} args
 * @returns {{
 *   band: 'WEEKDAY_DOMINANT' | 'MIXED' | 'WEEKEND_DOMINANT' | 'INSUFFICIENT_LONG_SESSIONS',
 *   longSessions: number,
 *   weekdayLongCount: number,
 *   weekendLongCount: number,
 *   weekendShare: number,
 *   longSessionsByDay: { mon: number, tue: number, wed: number, thu: number,
 *                       fri: number, sat: number, sun: number },
 *   citation: string,
 * } | null}
 */
export function analyzeWeekendLongSessionShare({
  log,
  today,
  windowWeeks = DEFAULT_WINDOW_WEEKS,
  longSessionMinThreshold = DEFAULT_LONG_SESSION_MIN,
} = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  const safeWindow = Math.max(
    1,
    Math.floor(Number(windowWeeks) || DEFAULT_WINDOW_WEEKS)
  )
  const safeThreshold = Number.isFinite(Number(longSessionMinThreshold)) && Number(longSessionMinThreshold) > 0
    ? Number(longSessionMinThreshold)
    : DEFAULT_LONG_SESSION_MIN

  // Window: Monday of the oldest week (inclusive) through Sunday of the
  // current week (inclusive). The exclusiveEnd is the Monday of the
  // week AFTER the current week.
  const currentMonday = isoMondayOf(todayIso)
  const earliestWeekStart = isoMinusDays(currentMonday, (safeWindow - 1) * 7)
  const exclusiveEnd = isoMinusDays(currentMonday, -7)

  const longSessionsByDay = { mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 }

  if (Array.isArray(log)) {
    for (const e of log) {
      if (!e || !e.date) continue
      const key = String(e.date).slice(0, 10)
      if (!ISO_RE.test(key)) continue
      if (key < earliestWeekStart) continue
      if (key >= exclusiveEnd) continue
      const dur = entryDurationMin(e)
      if (dur < safeThreshold) continue
      const idx = isoDowIndex(key)
      const dowKey = DOW_KEYS[idx]
      longSessionsByDay[dowKey] += 1
    }
  }

  const longSessions = DOW_KEYS.reduce((s, k) => s + longSessionsByDay[k], 0)
  const weekendLongCount = DOW_KEYS.reduce(
    (s, k) => s + (WEEKEND_KEYS.has(k) ? longSessionsByDay[k] : 0),
    0
  )
  const weekdayLongCount = longSessions - weekendLongCount

  const safeDenom = Math.max(longSessions, 1)
  const weekendShare = round4(weekendLongCount / safeDenom)

  // Band classification — INSUFFICIENT first; then weekday-dominant,
  // weekend-dominant, otherwise mixed.
  let band
  if (longSessions < MIN_LONG_SESSIONS) {
    band = 'INSUFFICIENT_LONG_SESSIONS'
  } else if (weekendShare <= WEEKDAY_DOMINANT_THRESHOLD) {
    band = 'WEEKDAY_DOMINANT'
  } else if (weekendShare >= WEEKEND_DOMINANT_THRESHOLD) {
    band = 'WEEKEND_DOMINANT'
  } else {
    band = 'MIXED'
  }

  return {
    band,
    longSessions,
    weekdayLongCount,
    weekendLongCount,
    weekendShare,
    longSessionsByDay,
    citation: WEEKEND_LONG_SESSION_SHARE_CITATION,
  }
}
