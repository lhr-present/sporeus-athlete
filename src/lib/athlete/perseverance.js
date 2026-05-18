// src/lib/athlete/perseverance.js
//
// Perseverance — long-term weekly-rhythm grit detector.
//
// Background:
//   Duckworth A.L. et al. (2007) "Grit: Perseverance and passion for
//   long-term goals" and Duckworth (2016) "Grit: The power of passion
//   and perseverance" established that sustained engagement with a
//   long-term pursuit — not intensity in any single session — predicts
//   high achievement. For an endurance athlete, the day-to-day
//   manifestation is a steady weekly training rhythm: showing up
//   week after week, even with modest sessions, compounds aerobic
//   base far more reliably than burst-then-gap patterns.
//
//   The Sporeus library already tracks day-level streaks and a
//   consistency-percentage rolling score. Those measure short-term
//   adherence. Perseverance instead measures the *coefficient of
//   variation* of weekly session-count over 12 ISO weeks — surfacing
//   whether the athlete maintains a steady rhythm or trains in
//   bursts/gaps.
//
// The detector:
//   - groups sessions into ISO-week buckets (Mon-Sun) for the 12
//     completed weeks ending in the week containing `today`
//   - computes mean / stdDev / CV of weekly session counts
//   - penalises inactive weeks (0 sessions) and high CV
//   - bands the resulting gritScore as CONSISTENT / VARIABLE / SPORADIC
//   - returns null when fewer than 6 of the 12 weeks have any
//     sessions (too sparse to compute meaningful grit)
//
// Pure function. No I/O. No React. No external imports.

const MS_PER_DAY = 86400000
const WEEK_DAYS = 7
const DEFAULT_WINDOW_WEEKS = 12
const MIN_ACTIVE_WEEKS = 6

/**
 * @description Citation marker shipped on every non-null return so
 *   downstream consumers can render attribution without hard-coding
 *   the literal in component code.
 */
export const PERSEVERANCE_CITATION = 'Duckworth 2007; Duckworth 2016'

function dayMs(iso) {
  if (!iso) return null
  const s = String(iso).slice(0, 10)
  const d = new Date(s + 'T12:00:00Z')
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

function isoFromMs(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * @description Return the UTC ms timestamp of the Monday at 12:00 UTC
 *   for the ISO week containing the given ms timestamp. ISO weeks run
 *   Mon-Sun.
 */
function isoWeekMondayMs(ms) {
  const d = new Date(ms)
  // getUTCDay: Sun=0, Mon=1, ... Sat=6. ISO Monday offset:
  //   Mon -> 0, Tue -> 1, ..., Sun -> 6
  const dow = d.getUTCDay()
  const offset = dow === 0 ? 6 : dow - 1
  // Snap to noon-UTC of the Monday of the same ISO week.
  const monday = new Date(Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate() - offset,
    12, 0, 0, 0,
  ))
  return monday.getTime()
}

/**
 * @description Analyse perseverance / weekly-rhythm grit from a log.
 *
 * @param {{ log: Array, today?: string, windowWeeks?: number }} args
 * @returns {{
 *   band:                  'CONSISTENT' | 'VARIABLE' | 'SPORADIC',
 *   gritScore:             number,
 *   weeks:                 Array<{ weekStart: string, sessionCount: number }>,
 *   meanSessionsPerWeek:   number,
 *   cv:                    number | null,
 *   activeWeeks:           number,
 *   citation:              string,
 * } | null}
 */
export function analyzePerseverance({ log, today, windowWeeks = DEFAULT_WINDOW_WEEKS } = {}) {
  if (!Array.isArray(log)) return null
  const W = Number.isFinite(windowWeeks) && windowWeeks > 0
    ? Math.floor(windowWeeks)
    : DEFAULT_WINDOW_WEEKS

  const tToday = today || new Date().toISOString().slice(0, 10)
  const todayMs = dayMs(tToday)
  if (todayMs == null) return null

  // Anchor: the Monday of the ISO week containing `today` is the start
  // of the most recent (current) window-week. We aggregate the last W
  // completed-or-current weeks ending in the week containing today.
  const currentWeekMondayMs = isoWeekMondayMs(todayMs)

  // Build W week buckets, ordered chronologically (oldest -> newest).
  // weeks[W-1] is the week containing today.
  const buckets = []
  for (let i = W - 1; i >= 0; i--) {
    const startMs = currentWeekMondayMs - (i * WEEK_DAYS * MS_PER_DAY)
    const endMs   = startMs + (WEEK_DAYS * MS_PER_DAY) - 1
    buckets.push({
      weekStart: isoFromMs(startMs),
      startMs,
      endMs,
      sessionCount: 0,
    })
  }

  const windowStartMs = buckets[0].startMs
  const windowEndMs   = buckets[buckets.length - 1].endMs

  for (const e of log) {
    const dMs = dayMs(e?.date)
    if (dMs == null || dMs < windowStartMs || dMs > windowEndMs) continue
    // Find the week bucket this session falls in.
    for (const bk of buckets) {
      if (dMs >= bk.startMs && dMs <= bk.endMs) {
        bk.sessionCount += 1
        break
      }
    }
  }

  const activeWeeks   = buckets.filter(b => b.sessionCount >= 1).length
  const inactiveWeeks = W - activeWeeks

  // Sparsity guard: too sparse to compute meaningful grit.
  if (activeWeeks < MIN_ACTIVE_WEEKS) return null

  const counts = buckets.map(b => b.sessionCount)
  const mean   = counts.reduce((a, b) => a + b, 0) / W
  const meanSessionsPerWeek = Math.round(mean * 100) / 100

  let cv = null
  if (mean > 0) {
    const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / W
    const stdDev = Math.sqrt(variance)
    cv = stdDev / mean
  }

  const cvForScore = cv == null ? 0 : cv
  const cvPenalty  = Math.min(40, 30 * cvForScore)
  const inactivePenalty = 5 * inactiveWeeks
  const gritScore = Math.round(Math.max(0, 100 - inactivePenalty - cvPenalty))

  let band
  if (gritScore >= 75) band = 'CONSISTENT'
  else if (gritScore >= 50) band = 'VARIABLE'
  else band = 'SPORADIC'

  // Public week shape — drop internal startMs/endMs anchors.
  const publicWeeks = buckets.map(b => ({
    weekStart:    b.weekStart,
    sessionCount: b.sessionCount,
  }))

  return {
    band,
    gritScore,
    weeks: publicWeeks,
    meanSessionsPerWeek,
    cv: cv == null ? null : Math.round(cv * 1000) / 1000,
    activeWeeks,
    citation: PERSEVERANCE_CITATION,
  }
}
