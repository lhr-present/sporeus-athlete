// ─── trainingHourBudget.js — Weekly Training-Hour Budget Tracker ─────────────
//
// Many serious amateur athletes' training is gated by life, not by physiology:
// 8-10 hours/week is the upper limit of what fits sustainably on top of work
// + family obligations; 12+ hours/week is the upper limit of amateur capacity
// before it starts mirroring elite training loads (Hellard 2019 — elite /
// sub-elite training-load analysis). Knowing the total weekly training hours
// — irrespective of zone, sport, or intensity — is the most practical
// "can I sustain this?" lens.
//
// This module is intentionally DIFFERENT from the existing share / zone /
// km-per-sport / TSS-target cards:
//   - WeeklyEnduranceTimeCard tracks easy Z1+Z2 minutes/week (aerobic dose).
//   - WeeklyTssGoalCard tracks weekly TSS against a user-set goal.
//   - WeeklyKmPerSportCard tracks weekly kilometers per sport.
// THIS card tracks the LIFESTYLE-CONSTRAINT perspective: total hours of
// training per week, no matter what zone or sport, over a 12-week window.
//
// Algorithm
// ─────────
//   1. Build the last `windowWeeks` ISO weeks (Mon-Sun, default 12), oldest
//      first, ending in the week containing `today`. Same convention as
//      `weeklyTssVariance.js` / `weeklyEnduranceTime.js`.
//   2. For each entry inside the window with finite durationMin > 0
//      (reading `entry.durationMin ?? entry.duration_min`), accumulate to
//      that week's hours = durationMin / 60.
//   3. Require ≥ 6 weeks with hours > 0 — else return a populated
//      INSUFFICIENT_DATA result with all stats 0 and weeks[] still populated.
//   4. Aggregate (only with sufficient data):
//        meanHoursPerWeek   = mean of hours across ALL `windowWeeks` (zeros
//                             included) (2dp).
//        maxHoursPerWeek    = max in window (2dp).
//        totalHours         = sum over the window (2dp).
//        trendDeltaPerWeek  = linear regression slope of hours vs week
//                             index 0..N-1 (4dp). 0 if N ≤ 1.
//   5. Band by `meanHoursPerWeek`:
//        LIGHT      mean < 4       (recreational / casual)
//        AMATEUR    4 ≤ mean < 8   (typical recreational athlete)
//        COMMITTED  8 ≤ mean < 12  (serious amateur — top of sustainable
//                                   on top of work / family)
//        NEAR_PRO   mean ≥ 12      (extraordinary commitment — verging on
//                                   elite training load)
//
// Returns `null` only when `today` is unresolvable.
//
// Pure function. No I/O. No React. No mutation of inputs.
//
// Citations:
//   Hellard P. et al. (2019). Elite swimmers' training patterns in the
//     25 weeks prior to their season's best performances. IJSPP.
//   Mujika I. (2014). Olympic preparation of a world-class female
//     triathlete. IJSPP.
// ─────────────────────────────────────────────────────────────────────────────

export const TRAINING_HOUR_BUDGET_CITATION = 'Hellard 2019; Mujika 2014'

const DEFAULT_WINDOW_WEEKS = 12
const MIN_NON_ZERO_WEEKS = 6

// Band thresholds in hours/week.
const AMATEUR_FLOOR = 4
const COMMITTED_FLOOR = 8
const NEAR_PRO_FLOOR = 12

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

// ─── Date helpers (UTC) ──────────────────────────────────────────────────────

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

// Monday (UTC) of the ISO week containing `iso` (YYYY-MM-DD).
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

// ─── Rounding helpers ────────────────────────────────────────────────────────

function round2(n) {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function round4(n) {
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 10000) / 10000
}

// ─── Band classification ─────────────────────────────────────────────────────

function classifyBand(meanHoursPerWeek) {
  if (!Number.isFinite(meanHoursPerWeek)) return 'LIGHT'
  if (meanHoursPerWeek < AMATEUR_FLOOR) return 'LIGHT'
  if (meanHoursPerWeek < COMMITTED_FLOOR) return 'AMATEUR'
  if (meanHoursPerWeek < NEAR_PRO_FLOOR) return 'COMMITTED'
  return 'NEAR_PRO'
}

/**
 * Analyze total weekly training hours across the last `windowWeeks` ISO weeks
 * (Mon-Sun) ending in the week containing `today`.
 *
 * @param {object} args
 * @param {Array}  args.log               - training_log entries
 *                                          (need `date`, `durationMin` or
 *                                          `duration_min`)
 * @param {string|Date} args.today        - reference date
 * @param {number} [args.windowWeeks=12]  - ISO weeks
 *
 * @returns {{
 *   band: 'LIGHT'|'AMATEUR'|'COMMITTED'|'NEAR_PRO'|'INSUFFICIENT_DATA',
 *   weeks: Array<{ weekStart: string, hours: number }>,
 *   meanHoursPerWeek: number,
 *   maxHoursPerWeek: number,
 *   totalHours: number,
 *   trendDeltaPerWeek: number,
 *   citation: string,
 * } | null}
 *
 * Returns `null` only when `today` is unresolvable. Returns a populated
 * INSUFFICIENT_DATA result (all stats 0, weeks[] still populated) when
 * fewer than 6 weeks in the window carry any duration.
 */
export function analyzeTrainingHourBudget({
  log,
  today,
  windowWeeks = DEFAULT_WINDOW_WEEKS,
} = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  const safeWindow = Math.max(1, Math.floor(Number(windowWeeks) || DEFAULT_WINDOW_WEEKS))

  // Build the window: oldest week first, newest (containing today) last.
  const currentMonday = isoMondayOf(todayIso)
  const weeks = []
  for (let i = safeWindow - 1; i >= 0; i--) {
    const weekStart = isoMinusDays(currentMonday, i * 7)
    weeks.push({ weekStart, hours: 0 })
  }

  const idxByWeekStart = {}
  weeks.forEach((w, i) => { idxByWeekStart[w.weekStart] = i })

  const earliestWeekStart = weeks[0].weekStart
  // Week START of the week AFTER the current week — any session whose
  // own week-Monday is ≥ this is outside the window.
  const exclusiveEnd = isoMinusDays(currentMonday, -7)

  if (Array.isArray(log)) {
    for (const e of log) {
      if (!e || typeof e.date !== 'string') continue
      const key = String(e.date).slice(0, 10)
      if (!ISO_RE.test(key)) continue
      if (key < earliestWeekStart) continue
      if (key >= exclusiveEnd) continue

      // sanitizeLogEntry emits `duration` (minutes); prefer it, then fall back
      // to the legacy raw names for unsanitized entries.
      const raw = e.duration ?? e.durationMin ?? e.duration_min
      const dur = Number(raw)
      if (!Number.isFinite(dur) || dur <= 0) continue

      const wkStart = isoMondayOf(key)
      const idx = idxByWeekStart[wkStart]
      if (idx == null) continue

      weeks[idx].hours += dur / 60
    }
  }

  // Round per-week hours to 2dp for consumer stability.
  const roundedWeeks = weeks.map(w => ({
    weekStart: w.weekStart,
    hours: round2(w.hours),
  }))

  const nonZeroWeeks = weeks.reduce(
    (n, w) => n + (w.hours > 0 ? 1 : 0),
    0
  )

  if (nonZeroWeeks < MIN_NON_ZERO_WEEKS) {
    return {
      band: 'INSUFFICIENT_DATA',
      weeks: roundedWeeks,
      meanHoursPerWeek: 0,
      maxHoursPerWeek: 0,
      totalHours: 0,
      trendDeltaPerWeek: 0,
      citation: TRAINING_HOUR_BUDGET_CITATION,
    }
  }

  const n = weeks.length
  const sumHours = weeks.reduce((s, w) => s + w.hours, 0)
  const meanHours = sumHours / n
  const maxHours = weeks.reduce((m, w) => (w.hours > m ? w.hours : m), 0)

  // Linear regression slope of hours vs week index (0..N-1).
  let slope = 0
  if (n > 1) {
    let sumX = 0
    let sumY = 0
    let sumXY = 0
    let sumXX = 0
    for (let i = 0; i < n; i++) {
      const x = i
      const y = weeks[i].hours
      sumX += x
      sumY += y
      sumXY += x * y
      sumXX += x * x
    }
    const denom = n * sumXX - sumX * sumX
    if (denom !== 0) {
      slope = (n * sumXY - sumX * sumY) / denom
    }
  }

  const band = classifyBand(meanHours)

  return {
    band,
    weeks: roundedWeeks,
    meanHoursPerWeek: round2(meanHours),
    maxHoursPerWeek: round2(maxHours),
    totalHours: round2(sumHours),
    trendDeltaPerWeek: round4(slope),
    citation: TRAINING_HOUR_BUDGET_CITATION,
  }
}
