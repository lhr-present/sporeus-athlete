// ─── timeOnFeet.js — Weekly running "time on feet" safety tracker ───────────
//
// Weight-bearing impact exposure (running minutes per ISO week) is the
// single most predictive controllable risk factor for bone-stress
// injuries in runners. Bennell (2012) reviewed the bone-stress-injury
// literature and singled out weekly running-load history as the key
// modifiable input; Hreljac (2004) showed how rapid increases in impact
// exposure exceed bone-remodelling capacity and drive overuse injuries;
// Daniels (2014) operationalises the same principle through gradual
// long-run progression rules.
//
// This module:
//   1. Filters the training log to running sessions only
//      (type or sport matches /run|jog/i).
//   2. Buckets running durationMin per ISO week (Mon-Sun) across the
//      12 completed weeks immediately preceding the week containing
//      `today`, plus the current (in-progress) week.
//   3. Computes thisWeekMin (current week) and avg12WeekMin (mean of
//      the 12 completed weeks).
//   4. Classifies the current week vs the 12-week chronic average:
//        SAFE_RAMP     (green)  — within Gabbett 0.8–1.1× safe zone
//        AGGRESSIVE    (orange) — > 1.1× chronic average (bone-stress watch)
//        DETRAINING    (blue)   — < 0.8× chronic average (drop-off)
//        BUILDING_BASE (muted)  — chronic = 0 but this week > 0 (fresh log)
//
// Returns null when:
//   - The entire 13-week range contains no running sessions, OR
//   - Fewer than 4 of the 12 completed weeks contain any running
//     (too sparse to support an avg-based read).
//
// Pure function. No I/O. No React. No mutation of inputs.
//
// Citations:
//   Bennell K. (2012). Bone stress injuries in runners.
//   Hreljac A. (2004). Impact and overuse injuries in runners.
//     Med Sci Sports Exerc 36(5):845-849.
//   Daniels J. (2014). Daniels' Running Formula, 3rd ed.
// ─────────────────────────────────────────────────────────────────────────────

export const TIME_ON_FEET_CITATION = 'Bennell 2012; Hreljac 2004'

const WINDOW_WEEKS_DEFAULT = 12
const MIN_ACTIVE_WEEKS = 4
const SAFE_LOWER = 0.80   // 80% of chronic
const SAFE_UPPER = 1.10   // 110% of chronic

const RUN_RE = /run|jog/i

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
  const js = d.getUTCDay() // 0=Sun .. 6=Sat
  return js === 0 ? 7 : js
}

// Monday of the ISO week containing `dateStr` (returns YYYY-MM-DD).
function mondayOf(dateStr) {
  const dow = isoDow(dateStr)
  return addDaysStr(dateStr, -(dow - 1))
}

function entryDurationMin(entry) {
  const d = Number(entry?.durationMin)
  return Number.isFinite(d) && d > 0 ? d : 0
}

function isRunningEntry(entry) {
  if (!entry) return false
  const type = typeof entry.type === 'string' ? entry.type : ''
  const sport = typeof entry.sport === 'string' ? entry.sport : ''
  return RUN_RE.test(type) || RUN_RE.test(sport)
}

function classifyBand(thisWeekMin, avg12WeekMin) {
  if (avg12WeekMin <= 0) {
    return thisWeekMin > 0 ? 'BUILDING_BASE' : null
  }
  const ratio = thisWeekMin / avg12WeekMin
  if (ratio > SAFE_UPPER) return 'AGGRESSIVE'
  if (ratio < SAFE_LOWER) return 'DETRAINING'
  return 'SAFE_RAMP'
}

/**
 * Analyze weekly running "time on feet" exposure across the trailing
 * `windowWeeks` completed weeks plus the in-progress week containing
 * `today`.
 *
 * @param {object} args
 * @param {Array}  args.log               - log entries (need `date`, `durationMin`, `type`/`sport`)
 * @param {string} args.today             - YYYY-MM-DD reference date
 * @param {number} [args.windowWeeks=12]  - number of trailing completed weeks
 *
 * @returns {{
 *   band: 'SAFE_RAMP'|'AGGRESSIVE'|'DETRAINING'|'BUILDING_BASE',
 *   thisWeekMin: number,
 *   avg12WeekMin: number,
 *   deltaPct: number | null,
 *   weeks: Array<{ weekStart: string, minutes: number }>,
 *   citation: string
 * } | null}
 */
export function analyzeTimeOnFeet({ log, today, windowWeeks = WINDOW_WEEKS_DEFAULT } = {}) {
  if (!Array.isArray(log)) return null
  if (!today || typeof today !== 'string') return null
  if (!Number.isFinite(windowWeeks) || windowWeeks < 2) return null

  // Anchor weeks.
  // - `thisMon` = Monday of the in-progress week containing today.
  // - The 12 completed weeks immediately precede `thisMon`, i.e. their
  //   Mondays are (thisMon - 7d) .. (thisMon - 7*windowWeeks d).
  const thisMon = mondayOf(today)

  const completedWeekStarts = []
  for (let i = windowWeeks; i >= 1; i--) {
    completedWeekStarts.push(addDaysStr(thisMon, -i * 7))
  }
  const earliestMon = completedWeekStarts[0]
  const endSun = addDaysStr(thisMon, 6) // Sunday of in-progress week

  // Bucket completed weeks (Mon-Sun) by ISO Monday.
  const buckets = new Map()
  for (const ws of completedWeekStarts) buckets.set(ws, 0)
  let thisWeekMin = 0
  let anyRunningInRange = false

  for (const e of log) {
    if (!e || typeof e.date !== 'string') continue
    const d = String(e.date).slice(0, 10)
    if (d < earliestMon || d > endSun) continue
    if (!isRunningEntry(e)) continue
    const dur = entryDurationMin(e)
    if (dur <= 0) continue
    anyRunningInRange = true
    if (d >= thisMon) {
      thisWeekMin += dur
      continue
    }
    const ws = mondayOf(d)
    if (!buckets.has(ws)) continue
    buckets.set(ws, buckets.get(ws) + dur)
  }

  if (!anyRunningInRange) return null

  const weeks = completedWeekStarts.map(ws => ({
    weekStart: ws,
    minutes: buckets.get(ws) || 0,
  }))

  const activeWeeks = weeks.filter(w => w.minutes > 0).length
  if (activeWeeks < MIN_ACTIVE_WEEKS) return null

  const totalCompleted = weeks.reduce((s, w) => s + w.minutes, 0)
  const avg12WeekMin = totalCompleted / weeks.length

  const band = classifyBand(thisWeekMin, avg12WeekMin)
  if (!band) return null

  let deltaPct = null
  if (avg12WeekMin > 0) {
    deltaPct = (thisWeekMin - avg12WeekMin) / avg12WeekMin
  }

  return {
    band,
    thisWeekMin,
    avg12WeekMin,
    deltaPct,
    weeks,
    citation: TIME_ON_FEET_CITATION,
  }
}
