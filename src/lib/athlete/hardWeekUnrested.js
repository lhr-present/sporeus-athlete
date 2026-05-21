// src/lib/athlete/hardWeekUnrested.js
//
// Hard Week Unrested — count overreaching weeks NOT followed by recovery.
//
// Scientific premise:
//   - Foster (2001) — session-RPE and TSS-based monotony/strain quantify
//     the dose of training stress; spikes vs prior load define the
//     overreaching event.
//   - Halson (2014) — functional overreaching is productive IF followed by
//     a recovery (deload) microcycle. Repeated overreaching without
//     unloading accumulates into non-functional overreaching and
//     overtraining.
//   - Bompa (2018) — periodization theory: every overreaching microcycle
//     should be paired with a restorative microcycle.
//
// Distinct from sibling cards:
//   - ResetWeekEffectCard — did your LAST deload produce a rebound?
//   - MesocycleProgressionCard — do you have a 3:1 PATTERN at all?
//   - DeloadCadenceCard — how often do you deload?
//   - CumulativeFatigueWindowsCard — overreaching dose in days.
//   - HardWeekUnrestedCard (this one) — count of specific overreaching
//     WEEKS that were NOT followed by a deload week.
//
// Algorithm (windowWeeks = 16 by default):
//   1. Window = last `windowWeeks` ISO weeks (Mon-Sun) ending in the week
//      containing `today` (so the current week sits at the newest index).
//   2. For each week index i with i >= 3 (need 3 prior weeks):
//        priorMean = mean(weeks[i-3..i-1].tss)
//        if priorMean === 0 → skip (no meaningful baseline)
//        if weeks[i].tss >= priorMean * hardThresholdPct → overreaching event
//   3. For each event, look at weeks[i+1]:
//        - if i+1 is the current partial week (newest index) → followUp=null
//        - if i+1 outside the window → followUp=null
//        - else followUp = weeks[i+1].tss
//      wasRested = followUp != null AND followUp < priorMean * deloadThresholdPct
//      (When followUp is null we can't verify rest → treat as unrested.)
//   4. Sort events oldest-first.
//   5. Bands by unrestedCount:
//        CLEAN              — totalHardWeeks === 0 OR unrestedCount === 0
//        OCCASIONAL_UNRESTED — unrestedCount <= 1
//        REPEATED_UNRESTED  — unrestedCount <= 3
//        CHRONIC_UNRESTED   — unrestedCount > 3
//
// Pure function. No React, no I/O.

export const HARD_WEEK_UNRESTED_CITATION = 'Foster 2001; Halson 2014; Bompa 2018'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_WINDOW_WEEKS = 16
const DEFAULT_HARD_THRESHOLD_PCT = 1.20
const DEFAULT_DELOAD_THRESHOLD_PCT = 0.80

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

function round4(x) {
  return Math.round(x * 10000) / 10000
}

function classifyBand(totalHardWeeks, unrestedCount) {
  if (totalHardWeeks === 0 || unrestedCount === 0) return 'CLEAN'
  if (unrestedCount <= 1) return 'OCCASIONAL_UNRESTED'
  if (unrestedCount <= 3) return 'REPEATED_UNRESTED'
  return 'CHRONIC_UNRESTED'
}

/**
 * @param {{
 *   log: Array<{date:string, tss?:number}>,
 *   today: string | Date,
 *   windowWeeks?: number,
 *   hardThresholdPct?: number,
 *   deloadThresholdPct?: number,
 * }} args
 * @returns {{
 *   band: 'CLEAN' | 'OCCASIONAL_UNRESTED' | 'REPEATED_UNRESTED' | 'CHRONIC_UNRESTED',
 *   events: Array<{
 *     hardWeekStart: string,
 *     hardWeekTss: number,
 *     priorMeanTss: number,
 *     spikePct: number,
 *     followUpWeekTss: number | null,
 *     wasRested: boolean,
 *   }>,
 *   totalHardWeeks: number,
 *   unrestedCount: number,
 *   unrestedRate: number,
 *   citation: string,
 * } | null}
 */
export function analyzeHardWeekUnrested({
  log,
  today,
  windowWeeks = DEFAULT_WINDOW_WEEKS,
  hardThresholdPct = DEFAULT_HARD_THRESHOLD_PCT,
  deloadThresholdPct = DEFAULT_DELOAD_THRESHOLD_PCT,
} = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  const safeWindow = Math.max(
    4,
    Math.floor(Number(windowWeeks) || DEFAULT_WINDOW_WEEKS),
  )
  const hardThr = Number(hardThresholdPct)
  const deloadThr = Number(deloadThresholdPct)
  const safeHardThr =
    Number.isFinite(hardThr) && hardThr > 0 ? hardThr : DEFAULT_HARD_THRESHOLD_PCT
  const safeDeloadThr =
    Number.isFinite(deloadThr) && deloadThr > 0 ? deloadThr : DEFAULT_DELOAD_THRESHOLD_PCT

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

  // The current partial week is the LAST index (safeWindow - 1).
  const currentIdx = safeWindow - 1

  const events = []

  for (let i = 3; i < safeWindow; i++) {
    // Skip the current partial week as a hard-week candidate — we
    // never want to flag an incomplete week as overreaching.
    if (i === currentIdx) continue

    const p1 = weeks[i - 3].tss
    const p2 = weeks[i - 2].tss
    const p3 = weeks[i - 1].tss
    const priorMean = (p1 + p2 + p3) / 3
    if (!(priorMean > 0)) continue

    const wkTss = weeks[i].tss
    if (!(wkTss >= priorMean * safeHardThr)) continue

    // Follow-up week — must be the next week, IN window, and NOT the
    // current partial week.
    let followUpWeekTss = null
    const nextIdx = i + 1
    if (nextIdx < safeWindow && nextIdx !== currentIdx) {
      followUpWeekTss = weeks[nextIdx].tss
    }

    let wasRested = false
    if (followUpWeekTss != null) {
      wasRested = followUpWeekTss < priorMean * safeDeloadThr
    }

    const spikePct = round4(wkTss / priorMean - 1)

    events.push({
      hardWeekStart: weeks[i].weekStart,
      hardWeekTss: Math.round(wkTss),
      priorMeanTss: Math.round(priorMean),
      spikePct,
      followUpWeekTss:
        followUpWeekTss == null ? null : Math.round(followUpWeekTss),
      wasRested,
    })
  }

  // events are already in oldest-first order by construction (loop i ascending).

  const totalHardWeeks = events.length
  const unrestedCount = events.reduce(
    (acc, ev) => acc + (ev.wasRested ? 0 : 1),
    0,
  )
  const unrestedRate = round4(unrestedCount / Math.max(totalHardWeeks, 1))
  const band = classifyBand(totalHardWeeks, unrestedCount)

  return {
    band,
    events,
    totalHardWeeks,
    unrestedCount,
    unrestedRate,
    citation: HARD_WEEK_UNRESTED_CITATION,
  }
}
