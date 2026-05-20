// src/lib/athlete/resetWeekEffect.js
//
// Reset Week Effect — did your last deload actually work?
//
// Bompa 2018 supercompensation theory predicts that after a properly
// executed deload week, an athlete should be able to handle MORE load
// than before (rebound). Issurin 2010 (block periodization) frames the
// deload week as the bridge between training blocks: it's not a rest, it
// is a re-priming. If the load AFTER the deload does NOT exceed the load
// BEFORE the deload, either the deload was too long/deep, the prior load
// was untenable, or recovery infrastructure (sleep, fuel) is missing.
//
// This card answers a different question than its siblings:
//   - MesocycleProgressionCard: do you have a 3:1 PATTERN at all?
//   - SupercompensationWindowCard: are you IN a supercomp window right now?
//   - DeloadCadenceCard: how OFTEN do you deload?
//   - ResetWeekEffectCard (this one): did your most-recent deload actually
//                                     produce a rebound?
//
// Scientific grounding:
//   - Bompa T. (2018) "Periodization: Theory and Methodology of Training"
//     — supercompensation curve after restorative microcycle.
//   - Issurin V. (2010) "New Horizons for the Methodology and Physiology
//     of Training Periodization" — block periodization deload mechanics.
//
// Pure function. No React, no I/O.

export const RESET_WEEK_EFFECT_CITATION = 'Bompa 2018; Issurin 2010'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_LOOKBACK_WEEKS = 13
const DELOAD_RATIO = 0.75            // matches MesocycleProgressionCard
const STRONG_BOUNCE_THRESHOLD = 0.10 // ≥ 10 % rebound = strong

// Resolve `today` (YYYY-MM-DD string or Date) to a YYYY-MM-DD UTC key.
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

function round2(x) {
  return Math.round(x * 100) / 100
}

function round4(x) {
  return Math.round(x * 10000) / 10000
}

/**
 * Analyze whether the most-recent deload week (within the lookback window)
 * produced a supercompensation rebound — i.e. is the mean TSS of the 2
 * weeks AFTER the deload greater than the mean of the 3 weeks BEFORE the
 * deload?
 *
 * Walk MOST recent → backwards from the previous fully-completed week
 * (i.e. skip the current partial week containing `today`) to find a
 * deload candidate. A week is a deload when:
 *   - It has 3 prior weeks (i-3, i-2, i-1) all with TSS > 0;
 *   - Its TSS is < 0.75 × mean(prior-three);
 *   - Its TSS itself is > 0 (a zero-TSS week is a break, not a deload).
 *
 * @param {{
 *   log: Array<{ date: string, tss?: number }>,
 *   today: string | Date,
 *   lookbackWeeks?: number,
 * }} args
 * @returns {{
 *   band: 'STRONG_BOUNCE' | 'MODEST_BOUNCE' | 'NO_BOUNCE' | 'NO_DELOAD_FOUND',
 *   deloadWeekStart: string | null,
 *   deloadWeekTss: number,
 *   preMeanTss: number,
 *   postMeanTss: number,
 *   bouncePct: number,
 *   weeksAfterDeloadAvailable: number,
 *   citation: string,
 * } | null}
 */
export function analyzeResetWeekEffect({ log, today, lookbackWeeks = DEFAULT_LOOKBACK_WEEKS } = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  const safeWindow = Math.max(
    4,
    Math.floor(Number(lookbackWeeks) || DEFAULT_LOOKBACK_WEEKS),
  )

  // Build the window: oldest first, newest (containing today) last.
  const currentMonday = isoMondayOf(todayIso)
  const weeks = []
  for (let i = safeWindow - 1; i >= 0; i--) {
    const weekStart = isoMinusDays(currentMonday, i * 7)
    weeks.push({ weekStart, tss: 0 })
  }

  const idxByWeekStart = Object.create(null)
  weeks.forEach((w, i) => { idxByWeekStart[w.weekStart] = i })

  const earliestWeekStart = weeks[0].weekStart
  // Exclusive end = Monday of week AFTER the current week.
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

  // The most-recent FULLY-COMPLETED week is the one BEFORE the current
  // partial week (which is weeks[safeWindow - 1] = the week containing
  // today). So we start the deload search at safeWindow - 2.
  const searchStart = safeWindow - 2

  let deloadIdx = -1

  for (let i = searchStart; i >= 3; i--) {
    const w = weeks[i]
    if (!(w.tss > 0)) continue // Zero-TSS = break, not deload.

    const p1 = weeks[i - 3].tss
    const p2 = weeks[i - 2].tss
    const p3 = weeks[i - 1].tss
    if (!(p1 > 0 && p2 > 0 && p3 > 0)) continue

    const priorMean = (p1 + p2 + p3) / 3
    if (!(priorMean > 0)) continue

    if (w.tss < DELOAD_RATIO * priorMean) {
      deloadIdx = i
      break
    }
  }

  if (deloadIdx < 0) {
    return {
      band: 'NO_DELOAD_FOUND',
      deloadWeekStart: null,
      deloadWeekTss: 0,
      preMeanTss: 0,
      postMeanTss: 0,
      bouncePct: 0,
      weeksAfterDeloadAvailable: 0,
      citation: RESET_WEEK_EFFECT_CITATION,
    }
  }

  const deloadWeek = weeks[deloadIdx]
  const preMeanRaw = (weeks[deloadIdx - 3].tss
                   + weeks[deloadIdx - 2].tss
                   + weeks[deloadIdx - 1].tss) / 3
  const preMeanTss = round2(preMeanRaw)

  // weeksAfterDeloadAvailable: how many completed weeks after the deload
  // exist within our window, EXCLUDING the current partial week.
  // The current partial week is at index `safeWindow - 1`. The last
  // completed week is at index `safeWindow - 2`. So available =
  // min(2, max(0, (safeWindow - 1) - 1 - deloadIdx))
  //       = min(2, max(0, safeWindow - 2 - deloadIdx)).
  const rawAvailable = safeWindow - 2 - deloadIdx
  const weeksAfterDeloadAvailable = Math.min(2, Math.max(0, rawAvailable))

  let postMeanRaw = 0
  if (weeksAfterDeloadAvailable === 1) {
    postMeanRaw = weeks[deloadIdx + 1].tss
  } else if (weeksAfterDeloadAvailable === 2) {
    postMeanRaw = (weeks[deloadIdx + 1].tss + weeks[deloadIdx + 2].tss) / 2
  }
  const postMeanTss = round2(postMeanRaw)

  let bouncePct = 0
  if (preMeanRaw > 0) {
    bouncePct = round4((postMeanRaw - preMeanRaw) / preMeanRaw)
  }

  let band
  if (bouncePct >= STRONG_BOUNCE_THRESHOLD) {
    band = 'STRONG_BOUNCE'
  } else if (bouncePct > 0) {
    band = 'MODEST_BOUNCE'
  } else {
    band = 'NO_BOUNCE'
  }

  return {
    band,
    deloadWeekStart: deloadWeek.weekStart,
    deloadWeekTss: Math.round(deloadWeek.tss),
    preMeanTss,
    postMeanTss,
    bouncePct,
    weeksAfterDeloadAvailable,
    citation: RESET_WEEK_EFFECT_CITATION,
  }
}
