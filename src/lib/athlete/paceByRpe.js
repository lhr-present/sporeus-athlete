// ─── paceByRpe.js — Pace × RPE Calibration (90d window) ─────────────────────
// Shows the athlete's actual running pace distribution per RPE band. Reveals
// "this athlete runs Easy at 6:00/km, Tempo at 4:50/km" — calibrating
// subjective effort against actual execution. Distinct from RpeStabilityCard
// (within-type RPE variance) and easyDayCompliance.js.
//
// Bands:
//   EASY       — RPE 1-4
//   MODERATE   — RPE 5-6
//   HARD       — RPE 7-8
//   VERY_HARD  — RPE 9-10
//
// For each band: count + median pace (min/km). Median is more robust to
// outliers than mean.
//
// Cite: Daniels 2014 (Daniels' Running Formula — VDOT pace tables)
//       Borg 1982 (Psychophysical bases of perceived exertion — RPE)
//
// Pure module, no React.
// ─────────────────────────────────────────────────────────────────────────────

export const PACE_BY_RPE_CITATION = 'Daniels 2014; Borg 1982'

export const PACE_BY_RPE_BANDS = [
  { name: 'EASY',      rpeRange: '1-4',  minRpe: 1, maxRpe: 4 },
  { name: 'MODERATE',  rpeRange: '5-6',  minRpe: 5, maxRpe: 6 },
  { name: 'HARD',      rpeRange: '7-8',  minRpe: 7, maxRpe: 8 },
  { name: 'VERY_HARD', rpeRange: '9-10', minRpe: 9, maxRpe: 10 },
]

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

// ─── Band assignment ────────────────────────────────────────────────────────
/**
 * Map a numeric RPE (1-10) to its band name. Returns null when the value
 * falls outside the [1, 10] range or is not finite.
 *
 * @param {number} rpe
 * @returns {'EASY'|'MODERATE'|'HARD'|'VERY_HARD'|null}
 */
export function rpeToBand(rpe) {
  if (!Number.isFinite(rpe)) return null
  for (const band of PACE_BY_RPE_BANDS) {
    if (rpe >= band.minRpe && rpe <= band.maxRpe) return band.name
  }
  return null
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

// ─── analyzePaceByRpe ───────────────────────────────────────────────────────
/**
 * Compute pace × RPE distribution across running sessions in the window.
 *
 * Filtering: running sessions (type or sport matches /run|jog/i), within
 *   `windowDays`, with `rpe` defined + finite, `distanceKm` > 0, `durationMin`
 *   > 0.
 * Per-session pace = durationMin / distanceKm (min/km).
 * Grouping by RPE band (EASY 1-4, MODERATE 5-6, HARD 7-8, VERY_HARD 9-10).
 * Per-band: count, medianPace (median min/km).
 *
 * Returns null when overall sample count < 6 OR fewer than 2 bands contain
 *   any samples.
 *
 * @param {{
 *   log: Array<{
 *     date?: string,
 *     type?: string,
 *     sport?: string,
 *     rpe?: number,
 *     distanceKm?: number,
 *     durationMin?: number,
 *   }>,
 *   today?: string,
 *   windowDays?: number,
 * }} args
 * @returns {{
 *   bands: Array<{ name: string, rpeRange: string, count: number, medianPace: number }>,
 *   overallSampleCount: number,
 *   citation: string,
 * } | null}
 */
export function analyzePaceByRpe({
  log,
  today = new Date().toISOString().slice(0, 10),
  windowDays = 90,
} = {}) {
  if (!Array.isArray(log) || log.length === 0) return null

  const todayStr = toDateStr(today) || new Date().toISOString().slice(0, 10)
  const cutoffStr = isoMinusDays(todayStr, Math.max(1, windowDays))

  // Initialize per-band pace bucket (preserves canonical order EASY → VERY_HARD).
  const buckets = new Map()
  for (const band of PACE_BY_RPE_BANDS) buckets.set(band.name, [])

  for (const entry of log) {
    if (!entry) continue
    if (!isRunningSession(entry)) continue

    const dateStr = toDateStr(entry.date)
    if (!dateStr) continue
    if (!(dateStr > cutoffStr && dateStr <= todayStr)) continue

    if (entry.rpe == null || entry.rpe === '') continue
    const rpeNum = typeof entry.rpe === 'number' ? entry.rpe : Number(entry.rpe)
    if (!Number.isFinite(rpeNum)) continue

    const distNum = Number(entry.distanceKm)
    if (!Number.isFinite(distNum) || distNum <= 0) continue

    const durNum = Number(entry.durationMin)
    if (!Number.isFinite(durNum) || durNum <= 0) continue

    const band = rpeToBand(rpeNum)
    if (!band) continue

    const paceMinKm = durNum / distNum
    buckets.get(band).push(paceMinKm)
  }

  let overallSampleCount = 0
  let populatedBands = 0
  const bands = PACE_BY_RPE_BANDS.map((band) => {
    const paces = buckets.get(band.name)
    const count = paces.length
    if (count > 0) populatedBands += 1
    overallSampleCount += count
    return {
      name: band.name,
      rpeRange: band.rpeRange,
      count,
      medianPace: count > 0 ? median(paces) : 0,
    }
  })

  if (overallSampleCount < 6) return null
  if (populatedBands < 2) return null

  return {
    bands,
    overallSampleCount,
    citation: PACE_BY_RPE_CITATION,
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

export default analyzePaceByRpe
