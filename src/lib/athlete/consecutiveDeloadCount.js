// src/lib/athlete/consecutiveDeloadCount.js
//
// Consecutive Deload Count — count BACK-TO-BACK deload weeks (2+ in a row)
// in the last `windowWeeks` ISO weeks (Mon-Sun) ending in the week
// containing `today`.
//
// Scientific premise:
//   - Bompa (2018) — periodization theory: a SINGLE deload microcycle is
//     strategic supercompensation. Two or more consecutive deload weeks is
//     not periodization — it is usually life intrusion (illness, injury,
//     holiday) or unintended detraining drift ("just didn't get around to
//     training").
//   - Issurin (2010) — block periodization: residual fitness from a single
//     loading block can be preserved through a short unload; repeated
//     unloads collapse the block-residual envelope.
//   - Mujika (2010) — detraining onset begins within ~2 weeks of reduced
//     load. Two consecutive deload weeks is exactly the boundary at which
//     detraining starts to matter.
//
// Distinct from sibling cards:
//   - DeloadCadenceCard — deload FREQUENCY overall (one number).
//   - MesocycleProgressionCard — do you have a 3:1 PATTERN at all?
//   - ResetWeekEffectCard — did your LAST deload produce a rebound?
//   - HardWeekUnrestedCard — overreaching weeks NOT followed by recovery.
//   - ConsecutiveDeloadCountCard (this one) — count of back-to-back-deload
//     EVENTS (runs of length ≥ 2) + the longest such stretch.
//
// Algorithm (windowWeeks = 16 by default, deloadThresholdPct = 0.75):
//   1. Window = last `windowWeeks` ISO weeks (Mon-Sun) ending in the week
//      containing `today` (so the current week sits at the newest index).
//   2. For each week index i with i >= 3 (need 3 prior weeks):
//        priorMean = mean(weeks[i-3..i-1].tss)
//        if priorMean === 0 → NOT classifiable (skip — neither deload nor
//          normal — does not count toward the "classifiable" gate).
//        else if weeks[i].tss > 0 AND weeks[i].tss < priorMean *
//          deloadThresholdPct → DELOAD week. (TSS=0 is a break, not a deload.)
//        else → NORMAL week (still classifiable).
//   3. Walk classifiable weeks left→right and find maximal RUNS of
//      consecutive deload weeks. A "run" QUALIFIES as a back-to-back event
//      when its length ≥ 2. A run is broken by a NORMAL classifiable week,
//      by a non-classifiable week (priorMean=0), or by a TSS=0 break.
//   4. For each qualifying run:
//        startWeekStart / endWeekStart = first / last week's Monday,
//        lengthWeeks  = number of weeks in the run,
//        meanRunTss   = mean(TSS across run), rounded to int,
//        priorRefTss  = priorMean of the FIRST week of the run (the
//          reference 3-week mean that initially classified the run as a
//          deload), rounded to int.
//      Runs are returned oldest-first.
//   5. deloadWeeksTotal = count of ALL deload weeks in window
//      (singletons AND in-runs).
//   6. INSUFFICIENT_DATA gate: require >= 6 classifiable weeks (priorMean > 0).
//      Else return a populated INSUFFICIENT_DATA result with zeros.
//   7. Bands (when sufficient):
//        NO_RUNS          — totalRuns === 0
//        OCCASIONAL_RUN   — totalRuns <= 1
//        EXTENDED_RUN     — totalRuns > 1  OR  longestRunWeeks > 2
//
// Returns null when `today` is unresolvable.
//
// Pure function. No React, no I/O.

export const CONSECUTIVE_DELOAD_COUNT_CITATION = 'Bompa 2018; Mujika 2010'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_WINDOW_WEEKS = 16
const DEFAULT_DELOAD_THRESHOLD_PCT = 0.75
const MIN_CLASSIFIABLE_WEEKS = 6

// Resolve `today` (YYYY-MM-DD string or Date) to a YYYY-MM-DD UTC key.
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

// Monday (ISO-8601, Mon-anchored) of the week containing `iso`.
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

function classifyBand(totalRuns, longestRunWeeks) {
  if (totalRuns === 0) return 'NO_RUNS'
  if (totalRuns > 1 || longestRunWeeks > 2) return 'EXTENDED_RUN'
  return 'OCCASIONAL_RUN'
}

/**
 * @param {{
 *   log: Array<{date:string, tss?:number}>,
 *   today: string | Date,
 *   windowWeeks?: number,
 *   deloadThresholdPct?: number,
 * }} args
 * @returns {{
 *   band: 'NO_RUNS' | 'OCCASIONAL_RUN' | 'EXTENDED_RUN' | 'INSUFFICIENT_DATA',
 *   runs: Array<{
 *     startWeekStart: string,
 *     endWeekStart: string,
 *     lengthWeeks: number,
 *     meanRunTss: number,
 *     priorRefTss: number,
 *   }>,
 *   totalRuns: number,
 *   longestRunWeeks: number,
 *   deloadWeeksTotal: number,
 *   citation: string,
 * } | null}
 */
export function analyzeConsecutiveDeloadCount({
  log,
  today,
  windowWeeks = DEFAULT_WINDOW_WEEKS,
  deloadThresholdPct = DEFAULT_DELOAD_THRESHOLD_PCT,
} = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  const safeWindow = Math.max(
    4,
    Math.floor(Number(windowWeeks) || DEFAULT_WINDOW_WEEKS),
  )
  const thr = Number(deloadThresholdPct)
  const safeThr =
    Number.isFinite(thr) && thr > 0 ? thr : DEFAULT_DELOAD_THRESHOLD_PCT

  // Build the window: oldest first, newest (containing today) last.
  const currentMonday = isoMondayOf(todayIso)
  const weeks = []
  for (let i = safeWindow - 1; i >= 0; i--) {
    const weekStart = isoMinusDays(currentMonday, i * 7)
    weeks.push({ weekStart, tss: 0 })
  }

  const idxByWeekStart = Object.create(null)
  weeks.forEach((w, i) => {
    idxByWeekStart[w.weekStart] = i
  })

  const earliestWeekStart = weeks[0].weekStart
  // Exclusive end = Monday of the week AFTER the current week.
  const exclusiveEnd = isoMinusDays(currentMonday, -7)

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
      if (!Number.isFinite(tss) || tss <= 0) continue
      weeks[idx].tss += tss
    }
  }

  // Per-week classification: 'deload' | 'normal' | 'unclassifiable'.
  // Also stash priorMean for the first week of each run.
  const classifications = new Array(safeWindow).fill('unclassifiable')
  const priorMeans = new Array(safeWindow).fill(0)
  let classifiableCount = 0

  for (let i = 3; i < safeWindow; i++) {
    const p1 = weeks[i - 3].tss
    const p2 = weeks[i - 2].tss
    const p3 = weeks[i - 1].tss
    const priorMean = (p1 + p2 + p3) / 3
    if (!(priorMean > 0)) continue
    priorMeans[i] = priorMean
    classifiableCount += 1
    const wkTss = weeks[i].tss
    if (wkTss > 0 && wkTss < priorMean * safeThr) {
      classifications[i] = 'deload'
    } else {
      classifications[i] = 'normal'
    }
  }

  // INSUFFICIENT_DATA gate.
  if (classifiableCount < MIN_CLASSIFIABLE_WEEKS) {
    return {
      band: 'INSUFFICIENT_DATA',
      runs: [],
      totalRuns: 0,
      longestRunWeeks: 0,
      deloadWeeksTotal: 0,
      citation: CONSECUTIVE_DELOAD_COUNT_CITATION,
    }
  }

  // Walk and gather maximal runs of consecutive deload weeks.
  // A run is a sequence of contiguous indices with classification === 'deload'.
  // Any non-deload classification (normal OR unclassifiable) breaks a run.
  const allRuns = []
  let cursor = 0
  while (cursor < safeWindow) {
    if (classifications[cursor] !== 'deload') {
      cursor += 1
      continue
    }
    const startIdx = cursor
    while (cursor < safeWindow && classifications[cursor] === 'deload') {
      cursor += 1
    }
    const endIdx = cursor - 1
    allRuns.push({ startIdx, endIdx })
  }

  // deloadWeeksTotal = singletons + in-runs (all 'deload' classifications).
  const deloadWeeksTotal = allRuns.reduce(
    (acc, r) => acc + (r.endIdx - r.startIdx + 1),
    0,
  )

  // Qualifying runs: length >= 2.
  const qualifying = allRuns.filter(
    r => r.endIdx - r.startIdx + 1 >= 2,
  )

  const runs = qualifying.map(r => {
    const len = r.endIdx - r.startIdx + 1
    let sum = 0
    for (let i = r.startIdx; i <= r.endIdx; i++) sum += weeks[i].tss
    const meanRunTss = Math.round(sum / len)
    const priorRefTss = Math.round(priorMeans[r.startIdx])
    return {
      startWeekStart: weeks[r.startIdx].weekStart,
      endWeekStart: weeks[r.endIdx].weekStart,
      lengthWeeks: len,
      meanRunTss,
      priorRefTss,
    }
  })

  const totalRuns = runs.length
  const longestRunWeeks = runs.reduce(
    (m, r) => (r.lengthWeeks > m ? r.lengthWeeks : m),
    0,
  )

  const band = classifyBand(totalRuns, longestRunWeeks)

  return {
    band,
    runs,
    totalRuns,
    longestRunWeeks,
    deloadWeeksTotal,
    citation: CONSECUTIVE_DELOAD_COUNT_CITATION,
  }
}
