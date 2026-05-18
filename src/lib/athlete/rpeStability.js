// ─── rpeStability.js — Within-Session-Type RPE Stability ────────────────────
// Measures how CONSISTENTLY an athlete rates the same KIND of session (Easy,
// Tempo, Threshold, Long, etc.) across a rolling window. Distinct from
// sessionRPEDrift.js, which measures the gap between PLANNED intent and
// actual RPE (intent vs execution). This module measures WITHIN-TYPE RPE
// variance — pure subjective-effort CALIBRATION.
//
// For each normalized session type (≥3 sessions in the window):
//   count, mean RPE, population stdev, coefficient of variation (cv).
//
// Aggregate across types as a weighted mean of cv (weighted by session count).
//
// Cite: Foster 2001 "A new approach to monitoring exercise testing"
//       Borg 1982 "Psychophysical bases of perceived exertion"
//       Hampson 2001 "The influence of sensory cues on the perception of exertion"
//
// Pure module, no React.
// ─────────────────────────────────────────────────────────────────────────────

export const RPE_STABILITY_CITATION = 'Foster 2001; Borg 1982'

export const RPE_STABILITY_BANDS = {
  CALIBRATED:    { maxCv: 0.15 },
  DEVELOPING:    { maxCv: 0.30 },
  MISCALIBRATED: { maxCv: Infinity },
}

// ─── Date helpers ───────────────────────────────────────────────────────────
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

// ─── Type normalization ─────────────────────────────────────────────────────
/**
 * Normalize a session type to its grouping key.
 * Lowercases, trims whitespace. Case-insensitive grouping is the contract.
 * Returns null if the value is not a usable string.
 *
 * @param {*} type
 * @returns {string|null}
 */
export function normalizeType(type) {
  if (typeof type !== 'string') return null
  const trimmed = type.trim()
  if (!trimmed) return null
  return trimmed.toLowerCase()
}

// ─── Band classifier ────────────────────────────────────────────────────────
/**
 * Map a coefficient-of-variation value (≥0) to its band label.
 *
 * @param {number} cv
 * @returns {'CALIBRATED'|'DEVELOPING'|'MISCALIBRATED'}
 */
export function classifyStabilityBand(cv) {
  if (!Number.isFinite(cv) || cv < 0) return 'MISCALIBRATED'
  if (cv <= RPE_STABILITY_BANDS.CALIBRATED.maxCv) return 'CALIBRATED'
  if (cv <= RPE_STABILITY_BANDS.DEVELOPING.maxCv) return 'DEVELOPING'
  return 'MISCALIBRATED'
}

// ─── Stats helpers ──────────────────────────────────────────────────────────
function meanOf(values) {
  if (!values.length) return 0
  let sum = 0
  for (const v of values) sum += v
  return sum / values.length
}

function populationStdev(values, mean) {
  if (!values.length) return 0
  let sq = 0
  for (const v of values) {
    const d = v - mean
    sq += d * d
  }
  return Math.sqrt(sq / values.length)
}

// ─── analyzeRpeStability ────────────────────────────────────────────────────
/**
 * Compute within-session-type RPE stability over a rolling window.
 *
 * Filtering: sessions in the window where both `type` (string) AND `rpe`
 *   (finite number) are present.
 * Grouping: by normalized type (lowercased). Groups with <3 sessions are
 *   ignored.
 * Aggregation: weightedCv = Σ(count_i × cv_i) / Σ(count_i) across all
 *   surviving groups. cv_i = stdev_i / mean_i (0 when mean_i ≤ 0).
 *
 * Returns null when fewer than 2 valid groups remain — you need at least
 * two session types each with ≥3 samples to talk about stability.
 *
 * @param {{
 *   log: Array<{ date?: string, type?: string, rpe?: number }>,
 *   today?: string,
 *   windowDays?: number,
 * }} args
 * @returns {{
 *   band: 'CALIBRATED'|'DEVELOPING'|'MISCALIBRATED',
 *   weightedCv: number,
 *   groups: Array<{ type: string, count: number, meanRpe: number, stdRpe: number, cv: number }>,
 *   totalSessions: number,
 *   citation: string,
 * } | null}
 */
export function analyzeRpeStability({
  log,
  today = new Date().toISOString().slice(0, 10),
  windowDays = 28,
} = {}) {
  if (!Array.isArray(log) || log.length === 0) return null

  const todayStr = toDateStr(today) || new Date().toISOString().slice(0, 10)
  const cutoffStr = isoMinusDays(todayStr, Math.max(1, windowDays))

  // Group session RPEs by normalized type, with first-seen insertion order
  // preserved (Map keeps insertion order in JS).
  const buckets = new Map()

  for (const entry of log) {
    if (!entry) continue
    const dateStr = toDateStr(entry.date)
    if (!dateStr) continue
    if (!(dateStr > cutoffStr && dateStr <= todayStr)) continue

    const key = normalizeType(entry.type)
    if (!key) continue

    // Require rpe to be explicitly present (not null/undefined) before coercion.
    // Number(null) returns 0 and Number('') returns 0, neither of which is a
    // logged RPE — those entries should be skipped.
    if (entry.rpe == null || entry.rpe === '') continue
    const rpeNum = typeof entry.rpe === 'number' ? entry.rpe : Number(entry.rpe)
    if (!Number.isFinite(rpeNum)) continue

    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(rpeNum)
  }

  // Compute per-group stats, drop groups with <3 samples.
  const groups = []
  let totalCount = 0
  let weightedCvNumerator = 0

  for (const [type, values] of buckets) {
    if (values.length < 3) continue
    const meanRpe = meanOf(values)
    const stdRpe = populationStdev(values, meanRpe)
    const cv = meanRpe > 0 ? stdRpe / meanRpe : 0
    groups.push({
      type,
      count: values.length,
      meanRpe,
      stdRpe,
      cv,
    })
    totalCount += values.length
    weightedCvNumerator += values.length * cv
  }

  if (groups.length < 2) return null

  const weightedCv = totalCount > 0 ? weightedCvNumerator / totalCount : 0
  const band = classifyStabilityBand(weightedCv)

  return {
    band,
    weightedCv,
    groups,
    totalSessions: totalCount,
    citation: RPE_STABILITY_CITATION,
  }
}

export default analyzeRpeStability
