// ─── energySorenessDivergence.js — 28d energy × soreness wellness analyzer ──
//
// Pure analyzer that surfaces the wellness-quadrant inferred from the two
// most overload-sensitive Recovery-log fields: `energy` (perceived energy,
// 1-5 higher=better) and `soreness` (DOMS / muscle soreness, 1-5 higher=
// WORSE — reversed scale). Hooper (1995) and Saw (2016) frame these as
// primary, low-cost daily markers for catching overtraining and gauging
// recovery quality before objective HR/HRV trends shift.
//
// Quadrant classification (28-day means):
//
//   avgEnergy ≥ 3.5 AND avgSoreness ≤ 2.5 → THRIVING    (high energy, low soreness)
//   avgEnergy ≥ 3.5 AND avgSoreness > 2.5 → RECOVERING  (energy OK but body is sore)
//   avgEnergy < 3.5 AND avgSoreness ≤ 2.5 → DRAINED     (no energy but body fine)
//   avgEnergy < 3.5 AND avgSoreness > 2.5 → STRUGGLING  (no energy AND sore)
//
// A per-day "wellness index" `energy - soreness` (range -4..+4) is averaged
// across the window. Positive values mean the athlete is on the good side
// of the energy-vs-soreness ledger; negative values mean they are spending
// down recovery reserves.
//
// Returns null if fewer than 7 entries in the window have BOTH energy and
// soreness defined as integers in [1, 5] — we need a credible sample.
//
// Refs:
//   - Hooper S.L. & Mackinnon L.T. (1995) "Monitoring overtraining in
//     athletes: recommendations". Sports Med 20(5).
//   - Saw A.E., Main L.C., Gastin P.B. (2016) "Monitoring the athlete
//     training response: subjective self-reported measures trump commonly
//     used objective measures". Br J Sports Med 50(5).

/** Energy-side quadrant threshold (≥ this on the 1-5 Likert is "good energy"). */
export const ENERGY_THRESHOLD = 3.5

/** Soreness-side quadrant threshold (≤ this is "low soreness"; higher = worse). */
export const SORENESS_THRESHOLD = 2.5

/** Default window length (days). */
export const DEFAULT_WINDOW_DAYS = 28

/** Minimum entries with both energy & soreness filled before we publish. */
export const MIN_SAMPLES = 7

/** Citation string surfaced by the consuming card. */
export const CITATION = 'Hooper 1995; Saw 2016'

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

/** Today as YYYY-MM-DD in UTC. */
function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function mean(arr) {
  if (!arr.length) return null
  let s = 0
  for (const v of arr) s += v
  return s / arr.length
}

/**
 * Validate that a value is an INTEGER Likert in [1, 5]. The spec for this
 * analyzer is integers only (the recovery UI emits 1-5 buttons).
 */
function isLikertInt(v) {
  return Number.isFinite(v) && Number.isInteger(v) && v >= 1 && v <= 5
}

function classifyQuadrant(avgEnergy, avgSoreness) {
  if (!Number.isFinite(avgEnergy) || !Number.isFinite(avgSoreness)) return null
  const energyHi = avgEnergy >= ENERGY_THRESHOLD
  const sorenessLo = avgSoreness <= SORENESS_THRESHOLD
  if (energyHi && sorenessLo) return 'THRIVING'
  if (energyHi && !sorenessLo) return 'RECOVERING'
  if (!energyHi && sorenessLo) return 'DRAINED'
  return 'STRUGGLING'
}

/**
 * Analyze the 28-day energy × soreness wellness balance from a Recovery log.
 *
 * @param {{
 *   recovery: Array<{date: string, energy?: number, soreness?: number}>,
 *   today?: string,
 *   windowDays?: number,
 * }} args
 * @returns {null | {
 *   quadrant: 'THRIVING'|'RECOVERING'|'DRAINED'|'STRUGGLING',
 *   avgEnergy: number,
 *   avgSoreness: number,
 *   avgIndex: number,
 *   sampleCount: number,
 *   citation: string,
 * }}
 */
export function analyzeEnergySorenessDivergence({
  recovery,
  today,
  windowDays = DEFAULT_WINDOW_DAYS,
} = {}) {
  if (!Array.isArray(recovery)) return null
  const todayStr = (typeof today === 'string' && today.length >= 10)
    ? today.slice(0, 10)
    : todayIso()

  const entries = []
  for (const r of recovery) {
    if (!r || typeof r !== 'object') continue
    if (typeof r.date !== 'string') continue
    const energy = Number(r.energy)
    const soreness = Number(r.soreness)
    if (!isLikertInt(energy) || !isLikertInt(soreness)) continue
    const ageDays = daysBetween(todayStr, r.date)
    if (ageDays === null) continue
    if (ageDays < 0) continue           // future entries excluded
    if (ageDays >= windowDays) continue // outside window
    entries.push({ ageDays, energy, soreness })
  }

  if (entries.length < MIN_SAMPLES) return null

  const energies = entries.map(e => e.energy)
  const sorenesses = entries.map(e => e.soreness)
  const indices = entries.map(e => e.energy - e.soreness)

  const avgEnergy = mean(energies)
  const avgSoreness = mean(sorenesses)
  const avgIndex = mean(indices)

  const quadrant = classifyQuadrant(avgEnergy, avgSoreness)
  if (!quadrant) return null

  return {
    quadrant,
    avgEnergy,
    avgSoreness,
    avgIndex,
    sampleCount: entries.length,
    citation: CITATION,
  }
}
