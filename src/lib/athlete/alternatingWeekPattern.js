// src/lib/athlete/alternatingWeekPattern.js
//
// Alternating Week Pattern — detector for the Issurin 2010 variant of
// periodization where, instead of the canonical 3:1 build-to-deload
// quartet, the athlete oscillates between a HIGH-volume week and a LOW
// (recovery) week consistently. This rhythm is common with masters
// athletes and time-constrained schedules where stacking three rising
// build weeks is unrealistic but a steady high/low rhythm is.
//
// Distinct from `mesocycleProgression.js` (3:1 anchor), `deloadCadence.js`
// (deload frequency), and `resetWeekEffect.js` (post-deload bounce).
// This module asks ONLY: are consecutive weeks alternating between
// high-TSS and low-TSS?
//
// Scientific grounding:
//   - Issurin V. (2010) "New Horizons for the Methodology and Physiology
//     of Training Periodization" — alternating-week periodization
//     variant.
//   - Mujika I. (2014) "Olympic preparation of a world-class female
//     triathlete" — alternating high/low rhythm in masters / elite
//     time-constrained training.
//
// Output bands:
//   STRONG_ALTERNATION   — alternationScore ≥ 0.70
//   MODERATE_ALTERNATION — 0.40 ≤ alternationScore < 0.70
//   NO_ALTERNATION       — alternationScore < 0.40
//   INSUFFICIENT_DATA    — fewer than 6 weeks with TSS > 0 in window
//
// Pure function. No React, no I/O.

export const ALTERNATING_WEEK_PATTERN_CITATION = 'Issurin 2010; Mujika 2014'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const WINDOW_WEEKS = 8
const MIN_NON_ZERO_WEEKS = 6
const HIGH_RATIO = 1.10
const LOW_RATIO = 0.90
const STRONG_FLOOR = 0.70
const MODERATE_FLOOR = 0.40

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

function classifyRole(tss, meanTss) {
  if (!(meanTss > 0)) return 'NEUTRAL'
  if (tss >= meanTss * HIGH_RATIO) return 'HIGH'
  if (tss <= meanTss * LOW_RATIO) return 'LOW'
  return 'NEUTRAL'
}

function classifyBand(score) {
  if (!Number.isFinite(score)) return 'NO_ALTERNATION'
  if (score >= STRONG_FLOOR) return 'STRONG_ALTERNATION'
  if (score >= MODERATE_FLOOR) return 'MODERATE_ALTERNATION'
  return 'NO_ALTERNATION'
}

const round2 = v => Math.round(v * 100) / 100
const round4 = v => Math.round(v * 10000) / 10000

/**
 * Analyze the alternating high/low week rhythm across the last
 * `windowWeeks` ISO weeks (Mon–Sun) ending in the week containing
 * `today`.
 *
 * @param {{
 *   log: Array<{ date: string, tss?: number }>,
 *   today: string | Date,
 *   windowWeeks?: number,
 * }} args
 * @returns {{
 *   band: 'STRONG_ALTERNATION' | 'MODERATE_ALTERNATION' | 'NO_ALTERNATION' | 'INSUFFICIENT_DATA',
 *   weeks: Array<{ weekStart: string, tss: number, role: 'HIGH' | 'LOW' | 'NEUTRAL' }>,
 *   alternationScore: number,
 *   amplitudeRatio: number,
 *   highWeekCount: number,
 *   lowWeekCount: number,
 *   citation: string,
 * } | null}
 */
export function analyzeAlternatingWeekPattern({ log, today, windowWeeks = WINDOW_WEEKS } = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  const safeWindow = Math.max(1, Math.floor(Number(windowWeeks) || WINDOW_WEEKS))

  // Build the window: oldest week first, newest (containing today) last.
  const currentMonday = isoMondayOf(todayIso)
  const weeks = []
  for (let i = safeWindow - 1; i >= 0; i--) {
    const weekStart = isoMinusDays(currentMonday, i * 7)
    weeks.push({ weekStart, tss: 0 })
  }

  const idxByWeekStart = {}
  weeks.forEach((w, i) => { idxByWeekStart[w.weekStart] = i })

  const earliestWeekStart = weeks[0].weekStart
  // exclusive end = Monday of the week AFTER the current week
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

  const citation = ALTERNATING_WEEK_PATTERN_CITATION

  // Min-signal gate: require ≥ MIN_NON_ZERO_WEEKS weeks with TSS > 0.
  const nonZeroWeeks = weeks.reduce((n, w) => n + (w.tss > 0 ? 1 : 0), 0)
  if (nonZeroWeeks < MIN_NON_ZERO_WEEKS) {
    return {
      band: 'INSUFFICIENT_DATA',
      weeks: [],
      alternationScore: 0,
      amplitudeRatio: 0,
      highWeekCount: 0,
      lowWeekCount: 0,
      citation,
    }
  }

  // Mean TSS across the FULL window (zeros included).
  const totalTss = weeks.reduce((s, w) => s + w.tss, 0)
  const meanTss = totalTss / weeks.length

  // Tag each week as HIGH / LOW / NEUTRAL based on ±10 % bands.
  const tagged = weeks.map(w => ({
    weekStart: w.weekStart,
    tss: Math.round(w.tss),
    role: classifyRole(w.tss, meanTss),
  }))

  // Adjacent-pair alternation count: HIGH followed by LOW or LOW followed
  // by HIGH counts; NEUTRAL pairs do NOT alternate. Denominator is
  // max(windowWeeks - 1, 1) so a single-week window yields 0.
  let alternatingPairs = 0
  for (let i = 0; i < tagged.length - 1; i++) {
    const a = tagged[i].role
    const b = tagged[i + 1].role
    if ((a === 'HIGH' && b === 'LOW') || (a === 'LOW' && b === 'HIGH')) {
      alternatingPairs += 1
    }
  }
  const denom = Math.max(tagged.length - 1, 1)
  const alternationScore = round4(alternatingPairs / denom)

  // Amplitude ratio: mean(HIGH TSS) / max(mean(LOW TSS), 1). 0 when either
  // bucket is empty.
  const highTss = tagged.filter(w => w.role === 'HIGH').map(w => w.tss)
  const lowTss = tagged.filter(w => w.role === 'LOW').map(w => w.tss)
  const highWeekCount = highTss.length
  const lowWeekCount = lowTss.length

  let amplitudeRatio = 0
  if (highWeekCount > 0 && lowWeekCount > 0) {
    const meanHigh = highTss.reduce((s, v) => s + v, 0) / highWeekCount
    const meanLow = lowTss.reduce((s, v) => s + v, 0) / lowWeekCount
    amplitudeRatio = round2(meanHigh / Math.max(meanLow, 1))
  }

  const band = classifyBand(alternationScore)

  return {
    band,
    weeks: tagged,
    alternationScore,
    amplitudeRatio,
    highWeekCount,
    lowWeekCount,
    citation,
  }
}
