// ─── logStreakBreaker.js — Streak vs Longest Logging Gap Analyzer ──────────
//
// Surfaces the LONGEST historical "no-logging gap" the athlete has ever had,
// alongside their CURRENT active logging streak. Distinct from
// streakDetector.js / recoveryStreak.js / trainingStreak.js (which all focus
// on the running streak only) — this one frames the streak relative to the
// worst break the athlete has already moved past, so the athlete can see:
//
//   "My current 12-day streak is bigger than half of the longest break
//    (8 days) I've ever broken through — momentum is compounding."
//
// vs.
//
//   "I'm 1 day in. My longest break was 30 days — I've come back before."
//
// Both framings beat raw streak counters at retention. The longest gap is
// a "story anchor" the athlete can compare against — Wood 2013's habit
// formation work shows people overweight recent slips and underweight the
// recovery that follows; Duckworth 2007 (grit) shows resilience signals
// are most motivating when paired with concrete past evidence of bounce-back.
//
// Data model: combine `log` and `recovery` arrays into one deduped set of
// ISO date strings. Either signal counts as a "log day" — if the athlete
// touched the app to record a workout OR a recovery check, the day counts.
//
// Gap definition: between any two consecutive logged days A and B, the
// gap = (B - A - 1) days of silence. The longest such gap, along with its
// endpoints, is what the card surfaces. A 1-day adjacency (B = A + 1) has
// gap = 0 (no break).
//
// Status classification (paired with the card's color/copy):
//   ACTIVE       — currentStreak >= 7 AND currentStreak > longestGap/2.
//                  "You're beating past breaks."
//   STEADY       — currentStreak >= 3 (but not ACTIVE).
//                  "Active streak holding."
//   RECENT_BREAK — currentStreak < 3.
//                  "Just lapsed."
//
// Pure function. No I/O.

export const LOG_STREAK_BREAKER_CITATION = 'Wood 2013; Duckworth 2007'

const MS_PER_DAY = 86400000

/**
 * @description Convert a YYYY-MM-DD-prefixed ISO string to a stable day-key
 *   (number of days since epoch, UTC noon anchor to avoid DST artifacts).
 *   Returns null on malformed input.
 */
function dayKey(iso) {
  if (typeof iso !== 'string' || iso.length < 10) return null
  const d = new Date(iso.slice(0, 10) + 'T12:00:00Z')
  const t = d.getTime()
  if (Number.isNaN(t)) return null
  return Math.floor(t / MS_PER_DAY)
}

function keyToISO(k) {
  return new Date(k * MS_PER_DAY).toISOString().slice(0, 10)
}

/**
 * @description Combine log + recovery entries into a deduped sorted list of
 *   day-keys (ascending). Malformed dates are skipped silently.
 */
function uniqueDayKeys(log, recovery) {
  const set = new Set()
  const push = (arr) => {
    if (!Array.isArray(arr)) return
    for (const e of arr) {
      const k = dayKey(e?.date)
      if (k !== null) set.add(k)
    }
  }
  push(log)
  push(recovery)
  return [...set].sort((a, b) => a - b)
}

/**
 * @description Analyze logging consistency: current streak vs longest
 *   historical gap (no-logging window). Returns null when there are no
 *   log/recovery entries at all.
 *
 * @param {Object} args
 * @param {Array}  args.log      - training log entries (each `{ date, ... }`)
 * @param {Array}  args.recovery - recovery entries (each `{ date, ... }`)
 * @param {string} [args.today]  - 'YYYY-MM-DD'; defaults to today UTC
 *
 * @returns {{
 *   status:          'ACTIVE' | 'STEADY' | 'RECENT_BREAK',
 *   currentStreak:   number,
 *   longestGap:      number,
 *   gapStart:        string | null,
 *   gapEnd:          string | null,
 *   totalLoggedDays: number,
 *   citation:        string,
 * } | null}
 */
export function analyzeLogStreakBreaker({ log, recovery, today } = {}) {
  const keys = uniqueDayKeys(log, recovery)
  if (keys.length === 0) return null

  const totalLoggedDays = keys.length

  // ── Longest gap between consecutive logged days ────────────────────────────
  // gap = (next - prev - 1); endpoints are the framing dates the athlete
  // last logged before and first logged after the silence.
  let longestGap = 0
  let gapStartKey = null
  let gapEndKey = null
  for (let i = 1; i < keys.length; i++) {
    const prev = keys[i - 1]
    const next = keys[i]
    const gap = next - prev - 1
    if (gap > longestGap) {
      longestGap = gap
      gapStartKey = prev
      gapEndKey = next
    }
  }

  // ── Current streak — consecutive days back from today (inclusive) ──────────
  // Today is inclusive when present. If today has no entry, allow a 1-day
  // grace by starting from yesterday (matches the morning-of-the-day window
  // before the athlete logs — same convention as trainingStreak / recoveryStreak).
  const todayISO = (typeof today === 'string' && today.length >= 10)
    ? today.slice(0, 10)
    : new Date().toISOString().slice(0, 10)
  const todayKey = dayKey(todayISO)
  if (todayKey === null) {
    // Should not normally happen — fall back to "no streak" framing.
    return {
      status: 'RECENT_BREAK',
      currentStreak: 0,
      longestGap,
      gapStart: gapStartKey !== null ? keyToISO(gapStartKey) : null,
      gapEnd:   gapEndKey   !== null ? keyToISO(gapEndKey)   : null,
      totalLoggedDays,
      citation: LOG_STREAK_BREAKER_CITATION,
    }
  }

  const keySet = new Set(keys)
  let cursor = todayKey
  if (!keySet.has(cursor)) cursor -= 1
  let currentStreak = 0
  while (keySet.has(cursor)) {
    currentStreak += 1
    cursor -= 1
  }

  // ── Status classification ──────────────────────────────────────────────────
  let status
  if (currentStreak >= 7 && currentStreak > longestGap / 2) {
    status = 'ACTIVE'
  } else if (currentStreak >= 3) {
    status = 'STEADY'
  } else {
    status = 'RECENT_BREAK'
  }

  return {
    status,
    currentStreak,
    longestGap,
    gapStart: gapStartKey !== null ? keyToISO(gapStartKey) : null,
    gapEnd:   gapEndKey   !== null ? keyToISO(gapEndKey)   : null,
    totalLoggedDays,
    citation: LOG_STREAK_BREAKER_CITATION,
  }
}
