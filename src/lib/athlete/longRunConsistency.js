// ─── longRunConsistency.js — Long-Run Duration CV Tracker (12 ISO weeks) ─────
//
// Daniels (2014) and Pfitzinger (2014) both argue the weekly long run should
// grow PREDICTABLY across a build phase (then taper). Wild swings in long-run
// duration (one week 90 min, next 180 min, next 60 min) signal poor planning,
// life interruptions, or an unrecovered athlete — and they erode the chronic
// long-aerobic stimulus the long run is supposed to deliver.
//
// This module measures the *consistency* of long-run **durations** over the
// last 12 ISO weeks (Mon-Sun) ending in the week containing `today`. It is
// deliberately DIFFERENT from `longRunFrequency.js`, which measures how OFTEN
// long sessions occur per calendar month. Consistency = CV of durations.
//
// Pure function. No I/O. No React. No mutation of inputs.
//
// Algorithm:
//   1. Build the last `windowWeeks` ISO weeks (default 12).
//   2. For each week, find the LONGEST run (type or sport matches /run/i)
//      with durationMin ≥ `longRunMinThreshold` (default 90). Weeks with no
//      qualifying run contribute longestRunMin = 0.
//   3. Compute coefficient of variation (population stdev / mean) across
//      weeks WITH long runs only (skip zero weeks).
//   4. Compute linear regression slope of longestRunMin vs week index
//      (0..N-1) across ALL `windowWeeks`, normalized as (slope / mean across
//      all windowWeeks) to express growth as % of overall mean per week.
//   5. Classify into a band:
//        STEADY        cv < 0.15
//        PROGRESSIVE   cv ≥ 0.15 AND trendSlopePctPerWeek >  0.03
//        EROSIVE       cv ≥ 0.15 AND trendSlopePctPerWeek < -0.03
//        CHAOTIC       cv ≥ 0.15 AND |trendSlopePctPerWeek| ≤ 0.03
//        INSUFFICIENT  3 ≤ long-run weeks < 6
//
// Return shapes:
//   - null  when there are fewer than 3 weeks with any qualifying long run
//           (truly nothing to show).
//   - populated object with band='INSUFFICIENT' when 3 ≤ long-run weeks < 6
//     (encourage "log more long runs" UI without hiding the card).
//   - populated object with the appropriate band when ≥ 6 long-run weeks.
//
// Citations:
//   Daniels J. (2014). Daniels' Running Formula, 3rd ed. Human Kinetics.
//   Pfitzinger P., Douglas S. (2014). Advanced Marathoning, 3rd ed.
// ─────────────────────────────────────────────────────────────────────────────

export const LONG_RUN_CONSISTENCY_CITATION = 'Daniels 2014; Pfitzinger 2014'

const DEFAULT_WINDOW_WEEKS = 12
const DEFAULT_LONG_RUN_MIN_THRESHOLD = 90
const MIN_LONG_RUN_WEEKS_FOR_CLASSIFICATION = 6
const MIN_LONG_RUN_WEEKS_FOR_INSUFFICIENT = 3

const CV_STEADY_MAX = 0.15
const SLOPE_FLAT_BAND = 0.03 // ±3% of mean per week

const RUN_RE = /run/i

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────

function parseISO(dateStr) {
  return new Date(String(dateStr).slice(0, 10) + 'T00:00:00Z')
}

function addDaysStr(dateStr, days) {
  const d = parseISO(dateStr)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ISO day-of-week: Mon=1 .. Sun=7.
function isoDow(dateStr) {
  const d = parseISO(dateStr)
  const js = d.getUTCDay() // 0=Sun..6=Sat
  return js === 0 ? 7 : js
}

// Monday of the ISO week containing `dateStr` (returns YYYY-MM-DD).
function mondayOf(dateStr) {
  const dow = isoDow(dateStr)
  return addDaysStr(dateStr, -(dow - 1))
}

function todayString(today) {
  if (today instanceof Date && !Number.isNaN(today.getTime())) {
    return today.toISOString().slice(0, 10)
  }
  if (typeof today === 'string' && today.length >= 10) {
    return today.slice(0, 10)
  }
  return null
}

function entryDurationMin(entry) {
  // Prefer durationMin (canonical sporeus field); fall back to duration_min.
  const raw = entry?.durationMin ?? entry?.duration_min
  const d = Number(raw)
  return Number.isFinite(d) && d > 0 ? d : 0
}

function isRunningEntry(entry) {
  if (!entry) return false
  const type = typeof entry.type === 'string' ? entry.type : ''
  const sport = typeof entry.sport === 'string' ? entry.sport : ''
  return RUN_RE.test(type) || RUN_RE.test(sport)
}

function round4(n) {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 10000) / 10000
}

function round2(n) {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function classifyBand({ longRunCount, cv, trendSlopePctPerWeek }) {
  if (longRunCount < MIN_LONG_RUN_WEEKS_FOR_CLASSIFICATION) return 'INSUFFICIENT'
  if (cv < CV_STEADY_MAX) return 'STEADY'
  if (trendSlopePctPerWeek > SLOPE_FLAT_BAND) return 'PROGRESSIVE'
  if (trendSlopePctPerWeek < -SLOPE_FLAT_BAND) return 'EROSIVE'
  return 'CHAOTIC'
}

/**
 * Analyze long-run duration consistency across the last `windowWeeks`
 * ISO weeks (Mon-Sun) ending in the week containing `today`.
 *
 * @param {object} args
 * @param {Array}  args.log                          - training_log entries
 *                                                     (need `date`, `durationMin`/`duration_min`,
 *                                                     `type`/`sport`)
 * @param {string|Date} args.today                   - reference date
 * @param {number} [args.windowWeeks=12]             - ISO weeks (≥ 2)
 * @param {number} [args.longRunMinThreshold=90]     - minimum durationMin to
 *                                                     qualify as a long run
 *
 * @returns {{
 *   band: 'STEADY'|'PROGRESSIVE'|'EROSIVE'|'CHAOTIC'|'INSUFFICIENT',
 *   weeks: Array<{ weekStart: string, longestRunMin: number }>,
 *   cv: number,
 *   meanMin: number,
 *   longRunCount: number,
 *   trendSlopePctPerWeek: number,
 *   citation: string
 * } | null}
 *
 * Returns null when log is invalid, today is invalid, params are out of
 * range, or fewer than 3 weeks have any qualifying long run.
 */
export function analyzeLongRunConsistency({
  log,
  today,
  windowWeeks = DEFAULT_WINDOW_WEEKS,
  longRunMinThreshold = DEFAULT_LONG_RUN_MIN_THRESHOLD,
} = {}) {
  if (!Array.isArray(log)) return null

  const todayStr = todayString(today)
  if (!todayStr) return null
  const parsed = parseISO(todayStr)
  if (Number.isNaN(parsed.getTime())) return null

  if (!Number.isFinite(windowWeeks) || windowWeeks < 2) return null
  if (!Number.isFinite(longRunMinThreshold) || longRunMinThreshold <= 0) return null

  // Build last `windowWeeks` ISO Mondays ending in the week containing `today`.
  // Oldest first. The last entry is the Monday of the week containing today.
  const thisMon = mondayOf(todayStr)
  const weekStarts = []
  for (let i = windowWeeks - 1; i >= 0; i--) {
    weekStarts.push(addDaysStr(thisMon, -i * 7))
  }
  const earliestMon = weekStarts[0]
  const latestSun = addDaysStr(thisMon, 6)

  // For each week store the longest qualifying run duration (default 0).
  const buckets = new Map()
  for (const ws of weekStarts) buckets.set(ws, 0)

  for (const e of log) {
    if (!e || typeof e.date !== 'string') continue
    const d = String(e.date).slice(0, 10)
    if (d < earliestMon || d > latestSun) continue
    if (!isRunningEntry(e)) continue
    const dur = entryDurationMin(e)
    if (dur < longRunMinThreshold) continue
    const ws = mondayOf(d)
    if (!buckets.has(ws)) continue
    const prev = buckets.get(ws)
    if (dur > prev) buckets.set(ws, dur)
  }

  const weeks = weekStarts.map(ws => ({
    weekStart: ws,
    longestRunMin: buckets.get(ws) || 0,
  }))

  const longRunWeeks = weeks.filter(w => w.longestRunMin > 0)
  const longRunCount = longRunWeeks.length

  // Fewer than 3 long-run weeks → truly nothing to show.
  if (longRunCount < MIN_LONG_RUN_WEEKS_FOR_INSUFFICIENT) return null

  // Mean across weeks WITH long runs (for CV) and mean across ALL weeks
  // (for normalising the regression slope).
  const meanLongRunOnly = longRunWeeks.reduce((s, w) => s + w.longestRunMin, 0) / longRunCount
  const meanAllWeeks = weeks.reduce((s, w) => s + w.longestRunMin, 0) / weeks.length

  // Population standard deviation across long-run weeks.
  let variance = 0
  for (const w of longRunWeeks) {
    const diff = w.longestRunMin - meanLongRunOnly
    variance += diff * diff
  }
  variance /= longRunCount
  const stdev = Math.sqrt(variance)
  const cv = meanLongRunOnly > 0 ? stdev / meanLongRunOnly : 0

  // Simple linear regression slope of longestRunMin vs week index (0..N-1).
  // Use ALL `windowWeeks` (zero weeks included) so dropouts pull the slope
  // negative when training fades.
  const n = weeks.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (let i = 0; i < n; i++) {
    const x = i
    const y = weeks[i].longestRunMin
    sumX += x
    sumY += y
    sumXY += x * y
    sumXX += x * x
  }
  const denom = n * sumXX - sumX * sumX
  let slope = 0
  if (denom !== 0) {
    slope = (n * sumXY - sumX * sumY) / denom
  }
  const trendSlopePctPerWeek =
    meanAllWeeks > 0 ? slope / meanAllWeeks : 0

  // INSUFFICIENT branch: 3-5 long-run weeks. Spec requires cv=0, meanMin=0,
  // longRunCount=actual count, trendSlopePctPerWeek=0.
  if (longRunCount < MIN_LONG_RUN_WEEKS_FOR_CLASSIFICATION) {
    return {
      band: 'INSUFFICIENT',
      weeks,
      cv: 0,
      meanMin: 0,
      longRunCount,
      trendSlopePctPerWeek: 0,
      citation: LONG_RUN_CONSISTENCY_CITATION,
    }
  }

  const band = classifyBand({
    longRunCount,
    cv,
    trendSlopePctPerWeek,
  })

  return {
    band,
    weeks,
    cv: round4(cv),
    meanMin: round2(meanLongRunOnly),
    longRunCount,
    trendSlopePctPerWeek: round4(trendSlopePctPerWeek),
    citation: LONG_RUN_CONSISTENCY_CITATION,
  }
}
