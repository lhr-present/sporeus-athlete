// src/lib/athlete/afterBigWeekRpe.js
//
// After-Big-Week RPE — surface the subjective effort pattern in the week(s)
// AFTER a high-volume week.
//
// Scientific premise:
//   - Halson (2014) — after functional overreaching, the SAME physiological
//     workload feels harder (elevated RPE) for several days. RPE returning
//     toward baseline within ~1 week is the canonical recovery signature;
//     RPE remaining elevated 2+ weeks signals accumulated fatigue / non-
//     functional overreaching.
//   - Foster (2001) — session-RPE is a valid global stressor measure and
//     tracks fatigue accumulation when load is held constant.
//
// Distinct from sibling cards:
//   - RpeStabilityCard       — within-type RPE variance (calibration).
//   - HighRpeLowTssCard      — RPE-TSS mismatch on a single session.
//   - SessionRPEDriftCard    — planned-vs-actual RPE drift.
//   - HardWeekUnrestedCard   — TSS overreaching events with no deload.
//   - AfterBigWeekRpeCard    — THIS — does RPE elevate after big weeks,
//                              and does it return to baseline by week 2?
//
// Algorithm (windowWeeks = 16 by default, bigWeekThresholdPct = 1.20):
//   1. Window = last `windowWeeks` ISO weeks (Mon-Sun) ending in the week
//      containing `today`. Index 0 is oldest, last index = current week.
//   2. For each week, compute:
//        tss     = sum of Number(entry.tss) over entries with date in week
//                  (only positive finite values).
//        meanRpe = mean of Number(entry.rpe) over entries with finite rpe
//                  in week. If no rpe entries → meanRpe = null.
//   3. For each week index i where i >= 3:
//        priorMeanTss = mean(weeks[i-3..i-1].tss)
//        if priorMeanTss === 0 → skip
//        if weeks[i].tss >= priorMeanTss * bigWeekThresholdPct → big week.
//   4. For each big week i, compute:
//        nextWeekMeanRpe   = weeks[i+1]?.meanRpe (null if outside window or
//                            no rpe data in that week)
//        twoWeeksOutMeanRpe = weeks[i+2]?.meanRpe (null if outside window
//                             or no rpe data)
//        bigWeekMeanRpe    = weeks[i].meanRpe (null if no rpe data)
//        rpeElevationPct   = (nextWeekMeanRpe - bigWeekMeanRpe) /
//                            max(bigWeekMeanRpe, 0.01); null when either
//                            side null. 4dp.
//   5. Aggregates (across big weeks):
//        meanRpeElevationPct = mean of non-null rpeElevationPct, 4dp.
//        meanRpeReturnAtWeek2 = mean of
//          (twoWeeksOutMeanRpe - bigWeekMeanRpe) / max(bigWeekMeanRpe, 0.01)
//          across big weeks where BOTH bigWeekMeanRpe AND twoWeeksOutMeanRpe
//          are non-null, 4dp.
//        bigWeekCount = number of detected big weeks.
//   6. Banding (only when bigWeekCount >= 3):
//        NO_RPE_RESPONSE      — |meanRpeElevationPct| < 0.05
//        NORMAL_RECOVERY      — meanRpeElevationPct > 0.05 AND
//                               meanRpeReturnAtWeek2 < meanRpeElevationPct
//        PROLONGED_ELEVATION  — meanRpeReturnAtWeek2 >= meanRpeElevationPct
//                               (week-2 still elevated as much or more)
//      Otherwise INSUFFICIENT_DATA.
//   7. Returns null when `today` is unresolvable.
//
// Pure function. No React, no I/O.

export const AFTER_BIG_WEEK_RPE_CITATION = 'Halson 2014; Foster 2001'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_WINDOW_WEEKS = 16
const DEFAULT_BIG_WEEK_THRESHOLD_PCT = 1.20
const MIN_BIG_WEEKS = 3
const NO_RESPONSE_BAND = 0.05

function resolveTodayIso(today) {
  if (today instanceof Date) {
    if (Number.isNaN(today.getTime())) return null
    const y = today.getUTCFullYear()
    const m = String(today.getUTCMonth() + 1).padStart(2, '0')
    const d = String(today.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  if (typeof today === 'string' && today.length >= 10) {
    const key = today.slice(0, 10)
    if (!ISO_RE.test(key)) return null
    const ts = Date.parse(`${key}T00:00:00Z`)
    if (Number.isNaN(ts)) return null
    return key
  }
  return null
}

function isoMondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function round2(x) {
  return Math.round(x * 100) / 100
}

function round4(x) {
  return Math.round(x * 10000) / 10000
}

function classifyBand(bigWeekCount, meanRpeElevationPct, meanRpeReturnAtWeek2) {
  if (bigWeekCount < MIN_BIG_WEEKS) return 'INSUFFICIENT_DATA'
  if (Math.abs(meanRpeElevationPct) < NO_RESPONSE_BAND) return 'NO_RPE_RESPONSE'
  if (
    meanRpeElevationPct > NO_RESPONSE_BAND &&
    meanRpeReturnAtWeek2 < meanRpeElevationPct
  ) {
    return 'NORMAL_RECOVERY'
  }
  // PROLONGED_ELEVATION only applies when RPE actually rose after the big week
  // (positive elevation) and stayed up — not when both values are negative
  // (RPE fell), which is a recovery signal, not prolonged elevation.
  if (
    meanRpeElevationPct > NO_RESPONSE_BAND &&
    meanRpeReturnAtWeek2 >= meanRpeElevationPct
  ) {
    return 'PROLONGED_ELEVATION'
  }
  return 'NO_RPE_RESPONSE'
}

function emptyResult(band, citation) {
  return {
    band,
    bigWeeks: [],
    meanRpeElevationPct: 0,
    meanRpeReturnAtWeek2: 0,
    bigWeekCount: 0,
    citation,
  }
}

/**
 * @param {{
 *   log: Array<{date:string, tss?:number, rpe?:number|string}>,
 *   today: string | Date,
 *   windowWeeks?: number,
 *   bigWeekThresholdPct?: number,
 * }} args
 * @returns {{
 *   band: 'NORMAL_RECOVERY' | 'PROLONGED_ELEVATION' | 'NO_RPE_RESPONSE' | 'INSUFFICIENT_DATA',
 *   bigWeeks: Array<{
 *     weekStart: string,
 *     bigWeekMeanRpe: number,
 *     nextWeekMeanRpe: number | null,
 *     twoWeeksOutMeanRpe: number | null,
 *     rpeElevationPct: number | null,
 *   }>,
 *   meanRpeElevationPct: number,
 *   meanRpeReturnAtWeek2: number,
 *   bigWeekCount: number,
 *   citation: string,
 * } | null}
 */
export function analyzeAfterBigWeekRpe({
  log,
  today,
  windowWeeks = DEFAULT_WINDOW_WEEKS,
  bigWeekThresholdPct = DEFAULT_BIG_WEEK_THRESHOLD_PCT,
} = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  const safeWindow = Math.max(
    4,
    Math.floor(Number(windowWeeks) || DEFAULT_WINDOW_WEEKS),
  )
  const thr = Number(bigWeekThresholdPct)
  const safeThr =
    Number.isFinite(thr) && thr > 0 ? thr : DEFAULT_BIG_WEEK_THRESHOLD_PCT

  // Build window (oldest first → newest last).
  const currentMonday = isoMondayOf(todayIso)
  const weeks = []
  for (let i = safeWindow - 1; i >= 0; i--) {
    const weekStart = isoMinusDays(currentMonday, i * 7)
    weeks.push({ weekStart, tss: 0, rpeSum: 0, rpeCount: 0 })
  }

  const idxByWeekStart = Object.create(null)
  weeks.forEach((w, i) => {
    idxByWeekStart[w.weekStart] = i
  })

  const earliestWeekStart = weeks[0].weekStart
  const exclusiveEnd = isoMinusDays(currentMonday, -7) // Monday after current

  if (Array.isArray(log)) {
    for (const e of log) {
      if (!e || !e.date) continue
      const key = String(e.date).slice(0, 10)
      if (!ISO_RE.test(key)) continue
      if (key < earliestWeekStart) continue
      if (key >= exclusiveEnd) continue
      const wkStart = isoMondayOf(key)
      const idx = idxByWeekStart[wkStart]
      if (idx == null) continue
      const tss = Number(e.tss)
      if (Number.isFinite(tss) && tss > 0) {
        weeks[idx].tss += tss
      }
      const rpe = Number(e.rpe)
      if (Number.isFinite(rpe)) {
        weeks[idx].rpeSum += rpe
        weeks[idx].rpeCount += 1
      }
    }
  }

  // Compute meanRpe per week (null if no rpe entries).
  const meanRpe = weeks.map((w) =>
    w.rpeCount > 0 ? w.rpeSum / w.rpeCount : null,
  )

  const bigWeeks = []
  for (let i = 3; i < safeWindow; i++) {
    const p1 = weeks[i - 3].tss
    const p2 = weeks[i - 2].tss
    const p3 = weeks[i - 1].tss
    const priorMean = (p1 + p2 + p3) / 3
    if (!(priorMean > 0)) continue

    const wkTss = weeks[i].tss
    if (!(wkTss >= priorMean * safeThr)) continue

    const bigMean = meanRpe[i]
    const nextMean = i + 1 < safeWindow ? meanRpe[i + 1] : null
    const twoMean = i + 2 < safeWindow ? meanRpe[i + 2] : null

    let rpeElevationPct = null
    if (bigMean != null && nextMean != null) {
      const denom = Math.max(bigMean, 0.01)
      rpeElevationPct = round4((nextMean - bigMean) / denom)
    }

    bigWeeks.push({
      weekStart: weeks[i].weekStart,
      bigWeekMeanRpe: bigMean == null ? null : round2(bigMean),
      nextWeekMeanRpe: nextMean == null ? null : round2(nextMean),
      twoWeeksOutMeanRpe: twoMean == null ? null : round2(twoMean),
      rpeElevationPct,
    })
  }

  const bigWeekCount = bigWeeks.length

  if (bigWeekCount < MIN_BIG_WEEKS) {
    return emptyResult('INSUFFICIENT_DATA', AFTER_BIG_WEEK_RPE_CITATION)
  }

  // Aggregate meanRpeElevationPct over non-null rpeElevationPct entries.
  const elevationVals = bigWeeks
    .map((b) => b.rpeElevationPct)
    .filter((v) => v != null)
  const meanRpeElevationPct = elevationVals.length
    ? round4(elevationVals.reduce((a, b) => a + b, 0) / elevationVals.length)
    : 0

  // Aggregate meanRpeReturnAtWeek2 over big weeks with both sides non-null.
  const week2Vals = []
  for (const b of bigWeeks) {
    if (b.bigWeekMeanRpe == null || b.twoWeeksOutMeanRpe == null) continue
    const denom = Math.max(b.bigWeekMeanRpe, 0.01)
    week2Vals.push((b.twoWeeksOutMeanRpe - b.bigWeekMeanRpe) / denom)
  }
  const meanRpeReturnAtWeek2 = week2Vals.length
    ? round4(week2Vals.reduce((a, b) => a + b, 0) / week2Vals.length)
    : 0

  const band = classifyBand(bigWeekCount, meanRpeElevationPct, meanRpeReturnAtWeek2)

  return {
    band,
    bigWeeks,
    meanRpeElevationPct,
    meanRpeReturnAtWeek2,
    bigWeekCount,
    citation: AFTER_BIG_WEEK_RPE_CITATION,
  }
}
