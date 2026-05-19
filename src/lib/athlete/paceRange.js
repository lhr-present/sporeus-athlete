// ─── paceRange.js — Running Pace Spread (28d window) ────────────────────────
// Surfaces the SPREAD of running paces used over the last 28 days — fastest
// pace minus slowest pace. Reveals whether the athlete runs at varied
// intensities (good for polarized training) or essentially one pace
// (junk-mile pattern).
//
// Distinct from paceByRpe.js (median per RPE band, calibration view); this
// module collapses the picture to a single SPREAD metric (polarization view).
//
// Bands (spread = slowestPace − fastestPace, in min/km):
//   WIDE_SPREAD     — spread ≥ 2.0           (good polarization)
//   MODERATE_SPREAD — 1.0 ≤ spread < 2.0
//   NARROW_SPREAD   — spread < 1.0           (single-pace pattern)
//
// Cite: Daniels 2014 (Daniels' Running Formula — pace variety)
//       Seiler 2010 (What is best practice for training intensity dist.?)
//
// Pure module, no React.
// ─────────────────────────────────────────────────────────────────────────────

export const PACE_RANGE_CITATION = 'Daniels 2014; Seiler 2010'

export const PACE_RANGE_BANDS = {
  WIDE_SPREAD:     { min: 2.0, max: Infinity },
  MODERATE_SPREAD: { min: 1.0, max: 2.0 },
  NARROW_SPREAD:   { min: 0,   max: 1.0 },
}

// ─── Date helpers (UTC) ─────────────────────────────────────────────────────
function toDateStr(value) {
  if (typeof value !== 'string') return null
  if (value.length < 10) return null
  return value.slice(0, 10)
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// ─── Sport / type matching ──────────────────────────────────────────────────
const RUN_REGEX = /run|jog/i

function isRunningSession(entry) {
  if (!entry) return false
  if (typeof entry.type === 'string' && RUN_REGEX.test(entry.type)) return true
  if (typeof entry.sport === 'string' && RUN_REGEX.test(entry.sport)) return true
  return false
}

// ─── Median helper ──────────────────────────────────────────────────────────
function median(values) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length
  const mid = Math.floor(n / 2)
  if (n % 2 === 1) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

// ─── Spread → band classification ───────────────────────────────────────────
/**
 * Classify a pace spread (slowest − fastest, min/km) into one of the three
 * bands. Boundaries: spread ≥ 2.0 → WIDE_SPREAD, 1.0 ≤ spread < 2.0 →
 * MODERATE_SPREAD, spread < 1.0 → NARROW_SPREAD.
 *
 * @param {number} spread
 * @returns {'WIDE_SPREAD'|'MODERATE_SPREAD'|'NARROW_SPREAD'}
 */
export function classifySpread(spread) {
  if (!Number.isFinite(spread) || spread < 0) return 'NARROW_SPREAD'
  if (spread >= 2.0) return 'WIDE_SPREAD'
  if (spread >= 1.0) return 'MODERATE_SPREAD'
  return 'NARROW_SPREAD'
}

// ─── analyzePaceRange ───────────────────────────────────────────────────────
/**
 * Compute pace-range stats for running sessions in the window.
 *
 * Filtering: running sessions (type or sport matches /run|jog/i), within
 *   `windowDays`, with `distanceKm` > 0 AND `durationMin` > 0.
 * Per-session pace = durationMin / distanceKm (min/km).
 * Returns null when fewer than 5 qualifying runs in window.
 *
 * @param {{
 *   log: Array<{
 *     date?: string,
 *     type?: string,
 *     sport?: string,
 *     distanceKm?: number,
 *     durationMin?: number,
 *   }>,
 *   today?: string,
 *   windowDays?: number,
 * }} args
 * @returns {{
 *   band: 'WIDE_SPREAD'|'MODERATE_SPREAD'|'NARROW_SPREAD',
 *   spread: number,
 *   fastestPace: number,
 *   slowestPace: number,
 *   medianPace: number,
 *   sampleCount: number,
 *   citation: string,
 * } | null}
 */
export function analyzePaceRange({
  log,
  today = new Date().toISOString().slice(0, 10),
  windowDays = 28,
} = {}) {
  if (!Array.isArray(log) || log.length === 0) return null

  const todayStr = toDateStr(today) || new Date().toISOString().slice(0, 10)
  const cutoffStr = isoMinusDays(todayStr, Math.max(1, windowDays))

  const paces = []
  for (const entry of log) {
    if (!entry) continue
    if (!isRunningSession(entry)) continue

    const dateStr = toDateStr(entry.date)
    if (!dateStr) continue
    if (!(dateStr > cutoffStr && dateStr <= todayStr)) continue

    const distNum = Number(entry.distanceKm)
    if (!Number.isFinite(distNum) || distNum <= 0) continue

    const durNum = Number(entry.durationMin)
    if (!Number.isFinite(durNum) || durNum <= 0) continue

    const paceMinKm = durNum / distNum
    if (!Number.isFinite(paceMinKm) || paceMinKm <= 0) continue

    paces.push(paceMinKm)
  }

  if (paces.length < 5) return null

  const fastestPace = Math.min(...paces)
  const slowestPace = Math.max(...paces)
  const spread = slowestPace - fastestPace
  const medPace = median(paces)
  const band = classifySpread(spread)

  return {
    band,
    spread,
    fastestPace,
    slowestPace,
    medianPace: medPace,
    sampleCount: paces.length,
    citation: PACE_RANGE_CITATION,
  }
}

// ─── Pace formatter ─────────────────────────────────────────────────────────
/**
 * Format paceMinKm as `M:SS/km` (e.g. 5.5 → "5:30/km", 4.916 → "4:55/km").
 * Two-digit zero-padded seconds. Returns '--' for non-positive / non-finite
 * inputs.
 *
 * @param {number} paceMinKm
 * @returns {string}
 */
export function formatPace(paceMinKm) {
  if (!Number.isFinite(paceMinKm) || paceMinKm <= 0) return '--'
  const totalSeconds = Math.round(paceMinKm * 60)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`
}

/**
 * Format a pace spread (delta, min/km) as `M:SS/km` (no sign). Returns '--'
 * for non-finite / negative inputs.
 *
 * @param {number} spreadMinKm
 * @returns {string}
 */
export function formatSpread(spreadMinKm) {
  if (!Number.isFinite(spreadMinKm) || spreadMinKm < 0) return '--'
  const totalSeconds = Math.round(spreadMinKm * 60)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}/km`
}

export default analyzePaceRange
