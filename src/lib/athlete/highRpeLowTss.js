// ─── highRpeLowTss.js — High-RPE / Low-TSS Mismatch Fatigue Detector ────────
// When subjective effort (RPE) exceeds what the objective load (TSS) would
// predict, that's a recovery / illness / under-fueling signal. One mismatch
// is noise; a pattern across multiple sessions in the recent window is a
// real fatigue marker.
//
// Method (Foster 2017; Halson 2014):
//   1. Build a personal baseline by fitting an OLS regression
//      predictedTss = a + b × rpe across the athlete's earlier window.
//   2. For each recent session compute expectedTss = max(1, a + b × rpe).
//   3. deviation = (expectedTss - tss) / expectedTss. Positive deviation
//      means the athlete worked hard subjectively but the objective load
//      came in low — the classic fatigue / under-recovery footprint.
//   4. deviation ≥ 0.30 counts as a mismatch.
//   5. Band on mismatch RATE across the recent window (not just count, so
//      busy weeks and quiet weeks compare fairly).
//
// Distinct from sessionRPEDrift (plan-vs-actual) and rpeStability
// (within-type RPE variance). This module asks: is the body returning less
// objective load for the same subjective effort? That's the load-response
// signature of accumulated fatigue.
//
// Pure module, no React.
// ─────────────────────────────────────────────────────────────────────────────

export const HIGH_RPE_LOW_TSS_CITATION = 'Foster 2017; Halson 2014'

const MISMATCH_THRESHOLD = 0.30
const MIN_BASELINE_SESSIONS = 20

// ─── Date helpers (UTC) ─────────────────────────────────────────────────────
function toDateStr(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed.length < 10) return null
    const slice = trimmed.slice(0, 10)
    // Validate "YYYY-MM-DD" structure via Date round-trip
    const d = new Date(slice + 'T00:00:00Z')
    if (Number.isNaN(d.getTime())) return null
    return slice
  }
  return null
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function round4(value) {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 10000) / 10000
}

// ─── Validity / extraction ──────────────────────────────────────────────────
function extractValid(entry) {
  if (!entry || typeof entry !== 'object') return null
  const dateStr = toDateStr(entry.date)
  if (!dateStr) return null
  const rpe = Number(entry.rpe)
  if (!Number.isFinite(rpe)) return null
  if (rpe < 1 || rpe > 10) return null
  const tss = Number(entry.tss)
  if (!Number.isFinite(tss)) return null
  if (tss <= 0) return null
  return { date: dateStr, rpe, tss }
}

// ─── OLS regression: predictedTss = a + b × rpe ─────────────────────────────
function fitOLS(samples) {
  const n = samples.length
  if (n === 0) return { a: 0, b: 0 }
  let sumX = 0
  let sumY = 0
  for (const s of samples) {
    sumX += s.rpe
    sumY += s.tss
  }
  const meanX = sumX / n
  const meanY = sumY / n

  let num = 0
  let den = 0
  for (const s of samples) {
    const dx = s.rpe - meanX
    num += dx * (s.tss - meanY)
    den += dx * dx
  }
  // Zero variance in rpe → slope undefined; fall back to flat intercept.
  if (den === 0) return { a: meanY, b: 0 }
  const b = num / den
  const a = meanY - b * meanX
  return { a, b }
}

// ─── Band classifier ────────────────────────────────────────────────────────
function classifyBand(rate) {
  if (rate < 0.10) return 'WELL_MATCHED'
  if (rate < 0.25) return 'OCCASIONAL_MISMATCH'
  return 'PERSISTENT_FATIGUE'
}

// ─── analyzeHighRpeLowTss ───────────────────────────────────────────────────
/**
 * Detect a "high RPE for low TSS" fatigue pattern across the recent window.
 *
 * Windowing:
 *   recent   = [today − (windowDays − 1) .. today]
 *   baseline = [today − (windowDays + baselineWindowDays − 1) .. today − windowDays]
 *
 * Validity:
 *   `Number(entry.rpe)` finite and in [1..10] AND `Number(entry.tss)` finite > 0.
 *
 * Baseline:
 *   OLS fit predictedTss = a + b × rpe on baseline valid sessions.
 *   < MIN_BASELINE_SESSIONS (20) → return populated INSUFFICIENT_DATA result.
 *
 * Recent:
 *   For each valid recent session:
 *     expectedTss = max(1, a + b × rpe)
 *     deviation   = (expectedTss − tss) / expectedTss   (4dp)
 *     mismatch    = deviation ≥ 0.30
 *
 * Bands (mismatch rate = mismatches / max(recent valid, 1)):
 *   WELL_MATCHED         < 10%
 *   OCCASIONAL_MISMATCH  10–25%
 *   PERSISTENT_FATIGUE   ≥ 25%
 *
 * @param {{
 *   log: Array,
 *   today?: string | Date,
 *   windowDays?: number,
 *   baselineWindowDays?: number,
 * }} args
 * @returns {{
 *   band: 'WELL_MATCHED'|'OCCASIONAL_MISMATCH'|'PERSISTENT_FATIGUE'|'INSUFFICIENT_DATA',
 *   mismatches: Array<{
 *     date: string,
 *     rpe: number,
 *     tss: number,
 *     expectedTss: number,
 *     deviation: number,
 *   }>,
 *   totalSessionsAnalyzed: number,
 *   mismatchCount: number,
 *   mismatchRate: number,
 *   baselineSessionsUsed: number,
 *   citation: string,
 * } | null}
 */
export function analyzeHighRpeLowTss({
  log,
  today,
  windowDays = 90,
  baselineWindowDays = 180,
} = {}) {
  const todayStr = toDateStr(today === undefined ? new Date() : today)
  if (!todayStr) return null

  if (!Array.isArray(log) || log.length === 0) {
    return {
      band: 'INSUFFICIENT_DATA',
      mismatches: [],
      totalSessionsAnalyzed: 0,
      mismatchCount: 0,
      mismatchRate: 0,
      baselineSessionsUsed: 0,
      citation: HIGH_RPE_LOW_TSS_CITATION,
    }
  }

  const wDays = Math.max(1, Math.floor(Number(windowDays) || 90))
  const bDays = Math.max(1, Math.floor(Number(baselineWindowDays) || 180))

  const recentStart = isoMinusDays(todayStr, wDays - 1)
  const baselineEnd = isoMinusDays(todayStr, wDays)
  const baselineStart = isoMinusDays(todayStr, wDays + bDays - 1)

  const recentSamples = []
  const baselineSamples = []

  for (const entry of log) {
    const v = extractValid(entry)
    if (!v) continue
    if (v.date >= recentStart && v.date <= todayStr) {
      recentSamples.push(v)
    } else if (v.date >= baselineStart && v.date <= baselineEnd) {
      baselineSamples.push(v)
    }
  }

  const baselineSessionsUsed = baselineSamples.length
  const totalSessionsAnalyzed = recentSamples.length

  if (baselineSessionsUsed < MIN_BASELINE_SESSIONS) {
    return {
      band: 'INSUFFICIENT_DATA',
      mismatches: [],
      totalSessionsAnalyzed,
      mismatchCount: 0,
      mismatchRate: 0,
      baselineSessionsUsed,
      citation: HIGH_RPE_LOW_TSS_CITATION,
    }
  }

  const { a, b } = fitOLS(baselineSamples)

  const mismatches = []
  for (const s of recentSamples) {
    const expectedRaw = a + b * s.rpe
    const expectedTss = Math.max(1, expectedRaw)
    const deviation = round4((expectedTss - s.tss) / expectedTss)
    if (deviation >= MISMATCH_THRESHOLD) {
      mismatches.push({
        date: s.date,
        rpe: s.rpe,
        tss: s.tss,
        expectedTss,
        deviation,
      })
    }
  }

  // Oldest-first
  mismatches.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0))

  const mismatchCount = mismatches.length
  const mismatchRate = round4(mismatchCount / Math.max(totalSessionsAnalyzed, 1))
  const band = classifyBand(mismatchRate)

  return {
    band,
    mismatches,
    totalSessionsAnalyzed,
    mismatchCount,
    mismatchRate,
    baselineSessionsUsed,
    citation: HIGH_RPE_LOW_TSS_CITATION,
  }
}

export default analyzeHighRpeLowTss
