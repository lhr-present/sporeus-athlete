// ─── hrForRpe.js — Heart Rate × RPE Calibration (90d window) ────────────────
// Surfaces the athlete's median heart rate per RPE band over a trailing
// 90-day window. Together with PaceByRpe, this gives a complete RPE-anchor
// picture: "Easy = 130 bpm at 6:00/km, Hard = 162 bpm at 5:00/km".
//
// Bands:
//   EASY       — RPE 1-4
//   MODERATE   — RPE 5-6
//   HARD       — RPE 7-8
//   VERY_HARD  — RPE 9-10
//
// For each band: count + median HR (bpm). Median is more robust to outliers
// than mean — a single HRM spike does not distort the band anchor.
//
// Cite: Karvonen 1957 (heart-rate reserve method — original HR-intensity work)
//       Borg 1982 (Psychophysical bases of perceived exertion — RPE construct)
//       Buchheit 2014 (HRV and HR monitoring in endurance athletes — modern
//                      use of average session HR as an intensity anchor)
//
// Pure module, no React.
// ─────────────────────────────────────────────────────────────────────────────

export const HR_FOR_RPE_CITATION = 'Karvonen 1957; Borg 1982; Buchheit 2014'

export const HR_FOR_RPE_BANDS = [
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
  for (const band of HR_FOR_RPE_BANDS) {
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

// ─── analyzeHrForRpe ────────────────────────────────────────────────────────
/**
 * Compute heart-rate × RPE distribution across sessions in the window.
 *
 * Filtering: sessions within `windowDays`, with `rpe` defined + finite in
 *   [1, 10] and `avgHR` (sanitizer-emitted) > 0 (finite).
 * Grouping by RPE band (EASY 1-4, MODERATE 5-6, HARD 7-8, VERY_HARD 9-10).
 * Per-band: count, medianHR (median bpm).
 *
 * Returns null when overall sample count < 6 OR fewer than 2 bands contain
 *   any samples.
 *
 * @param {{
 *   log: Array<{
 *     date?: string,
 *     rpe?: number,
 *     avgHR?: number,
 *   }>,
 *   today?: string,
 *   windowDays?: number,
 * }} args
 * @returns {{
 *   bands: Array<{ name: string, rpeRange: string, count: number, medianHR: number }>,
 *   overallSampleCount: number,
 *   citation: string,
 * } | null}
 */
export function analyzeHrForRpe({
  log,
  today = new Date().toISOString().slice(0, 10),
  windowDays = 90,
} = {}) {
  if (!Array.isArray(log) || log.length === 0) return null

  const todayStr = toDateStr(today) || new Date().toISOString().slice(0, 10)
  const cutoffStr = isoMinusDays(todayStr, Math.max(1, windowDays))

  // Initialize per-band HR bucket (preserves canonical order EASY → VERY_HARD).
  const buckets = new Map()
  for (const band of HR_FOR_RPE_BANDS) buckets.set(band.name, [])

  for (const entry of log) {
    if (!entry) continue

    const dateStr = toDateStr(entry.date)
    if (!dateStr) continue
    if (!(dateStr > cutoffStr && dateStr <= todayStr)) continue

    if (entry.rpe == null || entry.rpe === '') continue
    const rpeNum = typeof entry.rpe === 'number' ? entry.rpe : Number(entry.rpe)
    if (!Number.isFinite(rpeNum)) continue

    // Stored entries carry average HR as `avgHR` (the FIT/GPX importer writes
    // `avgHR`; sanitizeLogEntry whitelists only `avgHR`). Read it first, with
    // fallbacks to the raw `heartRate`/`avg_hr` names for safety. Pre-fix this
    // read only `heartRate`, which no capture path produces → card was dead.
    const hrNum = Number(entry.avgHR ?? entry.heartRate ?? entry.avg_hr)
    if (!Number.isFinite(hrNum) || hrNum <= 0) continue

    const band = rpeToBand(rpeNum)
    if (!band) continue

    buckets.get(band).push(hrNum)
  }

  let overallSampleCount = 0
  let populatedBands = 0
  const bands = HR_FOR_RPE_BANDS.map((band) => {
    const hrs = buckets.get(band.name)
    const count = hrs.length
    if (count > 0) populatedBands += 1
    overallSampleCount += count
    return {
      name: band.name,
      rpeRange: band.rpeRange,
      count,
      medianHR: count > 0 ? median(hrs) : 0,
    }
  })

  if (overallSampleCount < 6) return null
  if (populatedBands < 2) return null

  return {
    bands,
    overallSampleCount,
    citation: HR_FOR_RPE_CITATION,
  }
}

export default analyzeHrForRpe
