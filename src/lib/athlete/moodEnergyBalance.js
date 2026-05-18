// ─── moodEnergyBalance.js — 28d mood × energy affect-circumplex analyzer ────
//
// Pure analyzer that surfaces the psychological affect dimensions tracked in
// the Recovery log — specifically `mood` (valence) and `energy` (arousal).
// The pairing implements Russell's (1980) circumplex model of affect: two
// orthogonal dimensions whose combination locates current emotional state
// in a 2-D quadrant. Lane (2007) and McAuley (2005) link sustained drops
// in either dimension to overload and reduced training adherence.
//
//   avgMood ≥ 3.5, avgEnergy ≥ 3.5 → VIGOROUS  (positive valence, high arousal)
//   avgMood ≥ 3.5, avgEnergy < 3.5 → CONTENT   (positive valence, low arousal)
//   avgMood < 3.5, avgEnergy ≥ 3.5 → EDGY      (negative valence, high arousal)
//   avgMood < 3.5, avgEnergy < 3.5 → FLAT      (negative valence, low arousal)
//
// The trend is the mean of (recentHalf − earlyHalf) for each axis across the
// 28-day window split at the 14-day midpoint:
//
//   aggregate ≥ +0.3 → RISING    (affect improving)
//   |aggregate| < 0.3 → STABLE
//   aggregate ≤ −0.3 → DECLINING (affect worsening)
//
// Returns null if fewer than 7 entries in the window have BOTH mood and
// energy defined — we need a credible sample before publishing a trend.
//
// Refs:
//   - Russell J.A. (1980) "A circumplex model of affect". JPSP 39(6).
//   - Lane A.M. (2007) "Mood and exercise". In: Mood and Human Performance.
//   - McAuley E. et al. (2005) "Physical activity and quality of life in
//     older adults: influence of efficacy and affect". Health Psychol 24(1).

/** Trend classification thresholds. */
export const TREND_THRESHOLD = 0.3

/** Affect-quadrant midpoint (1-5 Likert scale midpoint = 3). The spec sets
 *  3.5 as the "positive-side" threshold so a neutral 3 sits in the lower
 *  quadrant — matching Russell's framing of the midpoint as neutral, not
 *  positive. */
export const QUADRANT_THRESHOLD = 3.5

/** Default window length (days). */
export const DEFAULT_WINDOW_DAYS = 28

/** Minimum entries with both mood & energy filled before we publish. */
export const MIN_SAMPLES = 7

/** Citation string surfaced by the consuming card. */
export const CITATION = 'Lane 2007; Russell 1980'

/**
 * Coerce an ISO-date-like string (YYYY-MM-DD) to a UTC Date at noon.
 * Returns null on failure.
 * @param {string} iso
 */
function toDate(iso) {
  if (typeof iso !== 'string' || iso.length < 10) return null
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  return d
}

/**
 * Number of whole UTC-days between two ISO dates (a - b).
 * @param {string} aIso
 * @param {string} bIso
 */
function daysBetween(aIso, bIso) {
  const a = toDate(aIso)
  const b = toDate(bIso)
  if (!a || !b) return null
  const ms = a.getTime() - b.getTime()
  return Math.round(ms / 86_400_000)
}

/**
 * Today as YYYY-MM-DD in UTC. Used when caller omits `today`.
 */
function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function mean(arr) {
  if (!arr.length) return null
  let s = 0
  for (const v of arr) s += v
  return s / arr.length
}

function classifyTrend(aggregate) {
  if (!Number.isFinite(aggregate)) return null
  if (aggregate >= TREND_THRESHOLD) return 'RISING'
  if (aggregate <= -TREND_THRESHOLD) return 'DECLINING'
  return 'STABLE'
}

function classifyQuadrant(avgMood, avgEnergy) {
  if (!Number.isFinite(avgMood) || !Number.isFinite(avgEnergy)) return null
  const moodHi = avgMood >= QUADRANT_THRESHOLD
  const energyHi = avgEnergy >= QUADRANT_THRESHOLD
  if (moodHi && energyHi) return 'VIGOROUS'
  if (moodHi && !energyHi) return 'CONTENT'
  if (!moodHi && energyHi) return 'EDGY'
  return 'FLAT'
}

/**
 * Validate that a Likert value sits in [1, 5]. Falsy / non-finite returns false.
 * (We accept floats — some logs round to .5; e.g. `4.5`.)
 */
function isLikert(v) {
  return Number.isFinite(v) && v >= 1 && v <= 5
}

/**
 * Analyze the 28-day mood × energy balance from a Recovery log.
 *
 * @param {{
 *   recovery: Array<{date: string, mood?: number, energy?: number}>,
 *   today?: string,
 *   windowDays?: number,
 * }} args
 * @returns {null | {
 *   trend: 'RISING'|'STABLE'|'DECLINING',
 *   quadrant: 'VIGOROUS'|'CONTENT'|'EDGY'|'FLAT',
 *   avgMood: number,
 *   avgEnergy: number,
 *   moodDelta: number,
 *   energyDelta: number,
 *   sampleCount: number,
 *   citation: string,
 * }}
 */
export function analyzeMoodEnergyBalance({
  recovery,
  today,
  windowDays = DEFAULT_WINDOW_DAYS,
} = {}) {
  if (!Array.isArray(recovery)) return null
  const todayStr = (typeof today === 'string' && today.length >= 10)
    ? today.slice(0, 10)
    : todayIso()
  const halfWindow = Math.floor(windowDays / 2)

  // Filter to entries with both mood AND energy in window.
  const entries = []
  for (const r of recovery) {
    if (!r || typeof r !== 'object') continue
    if (typeof r.date !== 'string') continue
    const mood = Number(r.mood)
    const energy = Number(r.energy)
    if (!isLikert(mood) || !isLikert(energy)) continue
    const ageDays = daysBetween(todayStr, r.date)
    if (ageDays === null) continue
    if (ageDays < 0) continue           // future entries excluded
    if (ageDays >= windowDays) continue // outside window
    entries.push({ ageDays, mood, energy })
  }

  if (entries.length < MIN_SAMPLES) return null

  const moods = entries.map(e => e.mood)
  const energies = entries.map(e => e.energy)
  const avgMood = mean(moods)
  const avgEnergy = mean(energies)

  // Split window: recent half = ageDays < halfWindow (closer to today),
  //               early half = ageDays >= halfWindow.
  const recent = entries.filter(e => e.ageDays < halfWindow)
  const early = entries.filter(e => e.ageDays >= halfWindow)

  const recentMood = mean(recent.map(e => e.mood))
  const recentEnergy = mean(recent.map(e => e.energy))
  const earlyMood = mean(early.map(e => e.mood))
  const earlyEnergy = mean(early.map(e => e.energy))

  // Half-deltas: if either half is empty, fall back to 0 so the trend can
  // still classify as STABLE rather than null. (We've already cleared the
  // MIN_SAMPLES gate at the window level.)
  const moodDelta = (recentMood !== null && earlyMood !== null)
    ? recentMood - earlyMood
    : 0
  const energyDelta = (recentEnergy !== null && earlyEnergy !== null)
    ? recentEnergy - earlyEnergy
    : 0
  const aggregate = (moodDelta + energyDelta) / 2

  const trend = classifyTrend(aggregate)
  const quadrant = classifyQuadrant(avgMood, avgEnergy)
  if (!trend || !quadrant) return null

  return {
    trend,
    quadrant,
    avgMood,
    avgEnergy,
    moodDelta,
    energyDelta,
    sampleCount: entries.length,
    citation: CITATION,
  }
}
