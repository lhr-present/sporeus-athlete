// ─── weeklyEnduranceTime.js — Weekly Aerobic Foundation Volume Tracker ───────
//
// Maffetone (2010, MAF) and Seiler (2010, 80/20 polarized) both argue that
// the central driver of aerobic adaptation (mitochondrial density,
// capillarisation, fat-oxidation capacity, plasma volume expansion) is the
// **absolute volume** of easy aerobic work performed each week — not merely
// the share of training spent at easy intensities. A 30%-easy week of 4h
// total minutes (≈72 min easy) and an 80%-easy week of 12h total minutes
// (≈576 min easy) both look "polarized" through a share-only lens, but the
// second produces vastly more chronic aerobic stimulus.
//
// This module is intentionally DIFFERENT from the existing share-based
// zone cards (TimeInZoneCard, PolarizationComplianceCard,
// IntensityBalanceCard): those describe distribution across zones; this
// one tracks the absolute aerobic-base-building dose in minutes/week.
//
// Algorithm
// ─────────
//   1. Build the last `windowWeeks` ISO weeks (Mon-Sun, default 12), oldest
//      first, ending in the week containing `today`. Same convention as
//      `weeklyTssVariance.js`.
//   2. For each entry inside the window, compute its duration in minutes
//      and classify easy-or-not:
//        - If `entry.zone` is a string that trims to "z1" or "z2"
//          (case-insensitive)  → easy.
//        - Else if `entry.zone` trims to "z3"/"z4"/"z5"/etc → not easy.
//        - Else if `Number(entry.rpe)` is finite → easy when rpe ≤ 4.
//        - Else (no zone field, no rpe) → skip entry entirely (it does
//          not count toward totalMin either; we cannot classify it).
//   3. Per week:
//        easyMin  = sum of durations of easy entries
//        totalMin = sum of durations of all CLASSIFIABLE entries
//   4. Require ≥ 6 weeks with totalMin > 0 — else return null.
//   5. Aggregate:
//        meanEasyMinPerWeek  = mean easyMin across ALL `windowWeeks`
//        meanTotalMinPerWeek = mean totalMin across ALL `windowWeeks`
//        easyShare           = meanEasyMin / max(meanTotalMin, 1)   (4dp)
//        trendPctPerWeek     = lin-reg slope of easyMin vs week index
//                              0..N-1, normalized as slope / mean(easyMin)
//                              (4dp; 0 when mean is 0).
//   6. Band by `meanEasyMinPerWeek`:
//        BELOW_AMATEUR       <  180 min/wk  (< 3h)
//        AMATEUR_BAND        ≥  180 and < 360
//        INTERMEDIATE_BAND   ≥  360 and < 600
//        ADVANCED_BAND       ≥  600
//
// Pure function. No I/O. No React. No mutation of inputs.
//
// Citations:
//   Maffetone P. (2010). The Big Book of Endurance Training and Racing.
//   Seiler S. (2010). What is best practice for training intensity and
//     duration distribution in endurance athletes? IJSPP.
//   Stöggl T., Sperlich B. (2014). Polarized training has greater impact
//     on key endurance variables. Front. Physiol.
// ─────────────────────────────────────────────────────────────────────────────

export const WEEKLY_ENDURANCE_TIME_CITATION =
  'Maffetone 2010; Seiler 2010; Stöggl 2014'

const DEFAULT_WINDOW_WEEKS = 12
const MIN_NON_ZERO_WEEKS = 6

// Band thresholds in minutes/week of easy (Z1+Z2) work.
const AMATEUR_FLOOR = 180
const INTERMEDIATE_FLOOR = 360
const ADVANCED_FLOOR = 600

const RPE_EASY_MAX = 4
const ZONE_EASY_RE = /^z[12]$/i
const ZONE_HARD_RE = /^z[3-9][0-9]*$/i

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

// ─── Classification ──────────────────────────────────────────────────────────

function entryDurationMin(entry) {
  const raw = entry?.durationMin ?? entry?.duration_min ?? entry?.duration  // v9.483: canonical entries store minutes under `duration` (contract sweep A1 — card was dead without this)
  const d = Number(raw)
  return Number.isFinite(d) && d > 0 ? d : 0
}

// Returns 'easy', 'hard', or null (skip — unclassifiable).
function classifyEntry(entry) {
  if (entry && typeof entry.zone === 'string') {
    const z = entry.zone.trim()
    if (z) {
      if (ZONE_EASY_RE.test(z)) return 'easy'
      if (ZONE_HARD_RE.test(z)) return 'hard'
    }
  }
  if (entry && entry.rpe !== undefined && entry.rpe !== null) {
    const r = Number(entry.rpe)
    if (Number.isFinite(r)) {
      return r <= RPE_EASY_MAX ? 'easy' : 'hard'
    }
  }
  return null
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

function classifyBand(meanEasyMinPerWeek) {
  if (!Number.isFinite(meanEasyMinPerWeek) || meanEasyMinPerWeek < AMATEUR_FLOOR) {
    return 'BELOW_AMATEUR'
  }
  if (meanEasyMinPerWeek < INTERMEDIATE_FLOOR) return 'AMATEUR_BAND'
  if (meanEasyMinPerWeek < ADVANCED_FLOOR) return 'INTERMEDIATE_BAND'
  return 'ADVANCED_BAND'
}

/**
 * Analyze absolute weekly minutes spent in aerobic-foundation zones (Z1+Z2)
 * across the last `windowWeeks` ISO weeks (Mon-Sun) ending in the week
 * containing `today`.
 *
 * @param {object} args
 * @param {Array}  args.log                - training_log entries
 *                                           (need `date`, `durationMin`/
 *                                           `duration_min`, and either
 *                                           `zone` or `rpe`)
 * @param {string|Date} args.today         - reference date
 * @param {number} [args.windowWeeks=12]   - ISO weeks (≥ 2)
 *
 * @returns {{
 *   band: 'BELOW_AMATEUR'|'AMATEUR_BAND'|'INTERMEDIATE_BAND'|'ADVANCED_BAND',
 *   weeks: Array<{ weekStart: string, easyMin: number, totalMin: number }>,
 *   meanEasyMinPerWeek: number,
 *   meanTotalMinPerWeek: number,
 *   easyShare: number,
 *   trendPctPerWeek: number,
 *   citation: string,
 * } | null}
 *
 * Returns null when log is invalid, today is invalid, windowWeeks < 2, or
 * fewer than 6 weeks in the window carry any classifiable load.
 */
export function analyzeWeeklyEnduranceTime({
  log,
  today,
  windowWeeks = DEFAULT_WINDOW_WEEKS,
} = {}) {
  if (!Array.isArray(log)) return null

  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  const safeWindow = Math.floor(Number(windowWeeks))
  if (!Number.isFinite(safeWindow) || safeWindow < 2) return null

  // Build the window: oldest week first, newest (containing today) last.
  const currentMonday = isoMondayOf(todayIso)
  const weeks = []
  for (let i = safeWindow - 1; i >= 0; i--) {
    const weekStart = isoMinusDays(currentMonday, i * 7)
    weeks.push({ weekStart, easyMin: 0, totalMin: 0 })
  }

  const idxByWeekStart = {}
  weeks.forEach((w, i) => { idxByWeekStart[w.weekStart] = i })

  const earliestWeekStart = weeks[0].weekStart
  // Week START of the week AFTER the current week — any session whose
  // own week-Monday is ≥ this is outside the window.
  const exclusiveEnd = isoMinusDays(currentMonday, -7)

  for (const e of log) {
    if (!e || typeof e.date !== 'string') continue
    const key = String(e.date).slice(0, 10)
    if (!ISO_RE.test(key)) continue
    if (key < earliestWeekStart) continue
    if (key >= exclusiveEnd) continue

    const dur = entryDurationMin(e)
    if (dur <= 0) continue

    const cls = classifyEntry(e)
    if (cls == null) continue

    const wkStart = isoMondayOf(key)
    const idx = idxByWeekStart[wkStart]
    if (idx == null) continue

    weeks[idx].totalMin += dur
    if (cls === 'easy') weeks[idx].easyMin += dur
  }

  const nonZeroWeeks = weeks.reduce(
    (n, w) => n + (w.totalMin > 0 ? 1 : 0),
    0
  )
  if (nonZeroWeeks < MIN_NON_ZERO_WEEKS) return null

  // Means across ALL weeks (zeros included — the point is dose per week).
  const n = weeks.length
  const sumEasy = weeks.reduce((s, w) => s + w.easyMin, 0)
  const sumTotal = weeks.reduce((s, w) => s + w.totalMin, 0)
  const meanEasy = sumEasy / n
  const meanTotal = sumTotal / n

  const easyShare = meanEasy / Math.max(meanTotal, 1)

  // Linear regression slope of easyMin vs week index (0..N-1), normalized
  // by mean(easyMin) so callers see %-of-mean-per-week growth/decline.
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (let i = 0; i < n; i++) {
    const x = i
    const y = weeks[i].easyMin
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
  const trendPctPerWeek = meanEasy > 0 ? slope / meanEasy : 0

  const band = classifyBand(meanEasy)

  return {
    band,
    weeks: weeks.map(w => ({
      weekStart: w.weekStart,
      easyMin: round2(w.easyMin),
      totalMin: round2(w.totalMin),
    })),
    meanEasyMinPerWeek: round2(meanEasy),
    meanTotalMinPerWeek: round2(meanTotal),
    easyShare: round4(easyShare),
    trendPctPerWeek: round4(trendPctPerWeek),
    citation: WEEKLY_ENDURANCE_TIME_CITATION,
  }
}
