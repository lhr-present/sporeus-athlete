// ─── seasonRestartCount.js — Comeback-frequency tracker (365d window) ────────
// Counts the number of "season restarts" — comeback events where the athlete
// resumed training after a gap of ≥ minGapDays (default 7) consecutive inactive
// days — across the trailing year. Each restart is a high-risk window because
// the body has detrained, and a year with many restarts signals that the
// athlete's training keeps fragmenting (travel, work, recurring injury, life).
//
// Distinct from streak / calendar-holes cards:
//   - StreakCard only knows the CURRENT streak.
//   - CalendarHolesCard counts gaps (≥3d) in 90 days, point-detail.
//   - This card counts COMEBACK EVENTS (≥7d gaps) over 365 DAYS, plus how long
//     each restart "held" before the next gap (the resilience pattern).
//
// Citations:
//   Hägglund M. et al. (2013). Injuries affect team performance negatively in
//     professional football: an 11-year follow-up of the UEFA Champions League
//     injury study. Br J Sports Med 47(12):738-742.
//   Gabbett T.J. (2016). The training-injury prevention paradox: should
//     athletes be training smarter and harder? Br J Sports Med 50(5):273-280.
// ─────────────────────────────────────────────────────────────────────────────

export const SEASON_RESTART_COUNT_CITATION = 'Hägglund 2013; Gabbett 2016'

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────
function toIso(value) {
  if (value == null) return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'string') {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!m) return null
    const y = Number(m[1])
    const mo = Number(m[2])
    const d = Number(m[3])
    if (
      !Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d) ||
      mo < 1 || mo > 12 || d < 1 || d > 31
    ) return null
    const dt = new Date(Date.UTC(y, mo - 1, d))
    if (Number.isNaN(dt.getTime())) return null
    if (
      dt.getUTCFullYear() !== y ||
      dt.getUTCMonth() !== mo - 1 ||
      dt.getUTCDate() !== d
    ) return null
    return dt.toISOString().slice(0, 10)
  }
  return null
}

function addDaysIso(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Activity check ──────────────────────────────────────────────────────────
function isActiveEntry(e) {
  if (!e || typeof e !== 'object') return false
  const tss = Number(e.tss)
  if (Number.isFinite(tss) && tss > 0) return true
  const dur = Number(e.duration_min ?? e.durationMin ?? e.duration)
  if (Number.isFinite(dur) && dur > 0) return true
  const dist = Number(e.distance_km ?? e.distanceKm ?? e.distance)
  if (Number.isFinite(dist) && dist > 0) return true
  return false
}

// ─── Band classification ─────────────────────────────────────────────────────
function classifyBand(totalRestarts, longestGap) {
  // CHRONIC_RESTART: >6 restarts OR longestGap >60 days
  // FRAGMENTED:      4-6 restarts (and not CHRONIC)
  // OCCASIONAL_BREAKS: 2-3 restarts (and not above)
  // CONSISTENT:      ≤1 restart AND longestGap ≤14
  // OCCASIONAL_BREAKS also catches "1 restart but longestGap >14"
  if (totalRestarts > 6 || longestGap > 60) return 'CHRONIC_RESTART'
  if (totalRestarts > 3) return 'FRAGMENTED'
  if (totalRestarts > 1) return 'OCCASIONAL_BREAKS'
  if (longestGap > 14) return 'OCCASIONAL_BREAKS'
  return 'CONSISTENT'
}

// ─── analyzeSeasonRestartCount ───────────────────────────────────────────────
/**
 * Count comeback events (restarts after ≥ minGapDays of inactivity) in the
 * trailing lookback window.
 *
 * @param {object} options
 * @param {Array}       options.log               training log entries
 * @param {Date|string} options.today             reference "today"
 * @param {number}      [options.lookbackDays=365]
 * @param {number}      [options.minGapDays=7]
 * @returns {{
 *   band: 'CONSISTENT'|'OCCASIONAL_BREAKS'|'FRAGMENTED'|'CHRONIC_RESTART',
 *   restarts: Array<{ restartDate, gapLengthDays, streakAfterDays }>,
 *   totalRestarts: number,
 *   longestStreakAfterRestart: number,
 *   longestGap: number,
 *   citation: string,
 * } | null}
 */
export function analyzeSeasonRestartCount({
  log,
  today,
  lookbackDays = 365,
  minGapDays = 7,
} = {}) {
  const todayIso = toIso(today)
  if (!todayIso) return null
  if (!Number.isFinite(lookbackDays) || lookbackDays <= 0) {
    return {
      band: 'CONSISTENT',
      restarts: [],
      totalRestarts: 0,
      longestStreakAfterRestart: 0,
      longestGap: 0,
      citation: SEASON_RESTART_COUNT_CITATION,
    }
  }
  if (!Number.isFinite(minGapDays) || minGapDays < 1) {
    return {
      band: 'CONSISTENT',
      restarts: [],
      totalRestarts: 0,
      longestStreakAfterRestart: 0,
      longestGap: 0,
      citation: SEASON_RESTART_COUNT_CITATION,
    }
  }

  const logArr = Array.isArray(log) ? log : []

  // Build active-day set (all dates with any active entry, anywhere in log).
  const activeSet = new Set()
  for (const e of logArr) {
    const dIso = toIso(e?.date)
    if (!dIso) continue
    if (isActiveEntry(e)) activeSet.add(dIso)
  }

  // Find earliest known active date (this anchors "history start" — gaps that
  // begin before this date are NOT real gaps, they are just the absence of
  // any data prior to the user joining the app).
  let earliestActiveIso = null
  for (const iso of activeSet) {
    if (earliestActiveIso === null || iso < earliestActiveIso) {
      earliestActiveIso = iso
    }
  }

  const windowStart = addDaysIso(todayIso, -(lookbackDays - 1))

  // Empty log / no activity ever → CONSISTENT, no restarts.
  if (earliestActiveIso === null) {
    return {
      band: 'CONSISTENT',
      restarts: [],
      totalRestarts: 0,
      longestStreakAfterRestart: 0,
      longestGap: 0,
      citation: SEASON_RESTART_COUNT_CITATION,
    }
  }

  // Walk the window day-by-day. A "restart" is an active day inside the window
  // such that the immediately preceding minGapDays days are all inactive AND
  // the gap span starts on/after earliestActiveIso (so the restart's gap is a
  // REAL gap, not "no data before the user existed").
  const restarts = []
  // Iterate over active days in chronological order, but restrict to the window.
  const activeInWindow = []
  for (const iso of activeSet) {
    if (iso >= windowStart && iso <= todayIso) {
      activeInWindow.push(iso)
    }
  }
  activeInWindow.sort()

  for (const restartDate of activeInWindow) {
    // Walk backward from the day before restartDate, counting consecutive
    // inactive days. Stop when we hit an active day or when we go past the
    // earliest active date.
    let gapLen = 0
    let cursor = addDaysIso(restartDate, -1)
    while (cursor >= earliestActiveIso && !activeSet.has(cursor)) {
      gapLen += 1
      cursor = addDaysIso(cursor, -1)
    }
    // If we walked off the back of history (cursor < earliestActiveIso) before
    // finding an active day, this is NOT a restart — it's just the start of
    // available data.
    if (!activeSet.has(cursor)) continue
    if (gapLen < minGapDays) continue

    // Compute streakAfterDays: # of consecutive active days starting at
    // restartDate, terminating at the next ≥minGapDays inactive run OR at
    // today (whichever comes first).
    let streakAfter = 0
    let walker = restartDate
    while (walker <= todayIso) {
      if (!activeSet.has(walker)) {
        // Check whether this gap is ≥ minGapDays
        let runLen = 0
        let runCursor = walker
        while (
          runCursor <= todayIso &&
          !activeSet.has(runCursor) &&
          runLen < minGapDays
        ) {
          runLen += 1
          runCursor = addDaysIso(runCursor, 1)
        }
        if (runLen >= minGapDays) break // terminating gap reached
        // Otherwise the gap was short — but the streak of CONSECUTIVE active
        // days terminated at the first inactive day, so we still stop.
        break
      }
      streakAfter += 1
      walker = addDaysIso(walker, 1)
    }

    restarts.push({
      restartDate,
      gapLengthDays: gapLen,
      streakAfterDays: streakAfter,
    })
  }

  // Sort oldest-first (already is from active-set sort, but make explicit).
  restarts.sort((a, b) =>
    a.restartDate < b.restartDate ? -1 :
    a.restartDate > b.restartDate ? 1 : 0
  )

  const totalRestarts = restarts.length
  const longestStreakAfterRestart = restarts.reduce(
    (m, r) => Math.max(m, r.streakAfterDays),
    0
  )
  const longestGap = restarts.reduce(
    (m, r) => Math.max(m, r.gapLengthDays),
    0
  )
  const band = classifyBand(totalRestarts, longestGap)

  return {
    band,
    restarts,
    totalRestarts,
    longestStreakAfterRestart,
    longestGap,
    citation: SEASON_RESTART_COUNT_CITATION,
  }
}
