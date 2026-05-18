// ─── checkInQuality.js — Check-In / Log Data Hygiene Tracker ────────────────
// Score the COMPLETENESS of recent session log entries — measuring "data
// hygiene" so the athlete knows whether their downstream insights are
// starved of context. Each session is scored 0–1 across four fields:
// rpe, tss, durationMin, heartRate. The aggregate average is classified into
// COMPLETE / PARTIAL / THIN bands. The single most-often-missing field across
// the window is surfaced as the "weakest link" so the athlete knows exactly
// what to fix in their next log entry.
//
// Cite: Halson 2014 "Monitoring training load to understand fatigue in
//       athletes" — frames data-quality / monitoring completeness as a
//       precondition for actionable load insights.
//
// Pure module, no React, fully deterministic on `today`.
// ─────────────────────────────────────────────────────────────────────────────

export const CHECK_IN_QUALITY_CITATION = 'Halson 2014'

export const QUALITY_FIELDS = ['rpe', 'tss', 'durationMin', 'heartRate']

export const QUALITY_BANDS = {
  COMPLETE: { min: 0.80 },
  PARTIAL:  { min: 0.50 },
  THIN:     { min: 0.00 },
}

// ─── Field presence check ───────────────────────────────────────────────────
/**
 * Returns true if a session-entry field is "present" for hygiene purposes.
 *  - rpe         → numeric (any finite number, including 0 is treated as
 *                  present — RPE 0 is unusual but explicitly logged)
 *  - tss         → numeric and > 0
 *  - durationMin → numeric and > 0
 *  - heartRate   → numeric and > 0
 *
 * @param {string} field
 * @param {*}      value
 * @returns {boolean}
 */
export function isFieldPresent(field, value) {
  if (value == null) return false
  const num = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(num)) return false
  if (field === 'rpe') {
    // Treat any finite numeric RPE as present (RPE can sit anywhere in 1–10
    // typically, but a logged 0 is still data).
    return true
  }
  return num > 0
}

// ─── Single-session completeness score ──────────────────────────────────────
/**
 * Compute a 0–1 completeness score for one session entry, plus the per-field
 * presence map used to aggregate fill-rates across a window.
 *
 * @param {object} entry
 * @returns {{ score: number, present: Record<string, boolean> }}
 */
export function scoreSessionCompleteness(entry) {
  const present = {}
  let hits = 0
  for (const field of QUALITY_FIELDS) {
    const ok = isFieldPresent(field, entry?.[field])
    present[field] = ok
    if (ok) hits += 1
  }
  // Each of 4 fields contributes +0.25
  return { score: hits / QUALITY_FIELDS.length, present }
}

// ─── Band classifier ────────────────────────────────────────────────────────
/**
 * Map an average-quality value [0..1] to a band label.
 * @param {number} avgQuality
 * @returns {'COMPLETE'|'PARTIAL'|'THIN'}
 */
export function classifyQualityBand(avgQuality) {
  if (!Number.isFinite(avgQuality)) return 'THIN'
  if (avgQuality >= QUALITY_BANDS.COMPLETE.min) return 'COMPLETE'
  if (avgQuality >= QUALITY_BANDS.PARTIAL.min)  return 'PARTIAL'
  return 'THIN'
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

// ─── analyzeCheckInQuality ──────────────────────────────────────────────────
/**
 * Aggregate completeness of recent session entries over a rolling window.
 *
 * @param {{
 *   log: Array<{
 *     date?: string,
 *     rpe?: number, tss?: number, durationMin?: number,
 *     heartRate?: number, notes?: string,
 *   }>,
 *   today?: string,
 *   windowDays?: number,
 * }} args
 * @returns {{
 *   band: 'COMPLETE'|'PARTIAL'|'THIN',
 *   avgQuality: number,
 *   sessionCount: number,
 *   weakestField: 'rpe'|'tss'|'durationMin'|'heartRate'|null,
 *   fieldFillRates: { rpe: number, tss: number, durationMin: number, heartRate: number },
 *   citation: string,
 * } | null}
 */
export function analyzeCheckInQuality({
  log,
  today = new Date().toISOString().slice(0, 10),
  windowDays = 14,
} = {}) {
  if (!Array.isArray(log) || log.length === 0) return null

  const todayStr = toDateStr(today) || new Date().toISOString().slice(0, 10)
  const cutoffStr = isoMinusDays(todayStr, Math.max(1, windowDays))

  // Filter sessions to those within the window (cutoff < date <= today).
  const inWindow = log.filter((entry) => {
    const dateStr = toDateStr(entry?.date)
    if (!dateStr) return false
    return dateStr > cutoffStr && dateStr <= todayStr
  })

  if (inWindow.length < 3) return null

  // Per-field hit counters.
  const fieldHits = { rpe: 0, tss: 0, durationMin: 0, heartRate: 0 }
  let totalScore = 0

  for (const entry of inWindow) {
    const { score, present } = scoreSessionCompleteness(entry)
    totalScore += score
    for (const field of QUALITY_FIELDS) {
      if (present[field]) fieldHits[field] += 1
    }
  }

  const sessionCount = inWindow.length
  const avgQuality = totalScore / sessionCount

  const fieldFillRates = {
    rpe:         fieldHits.rpe         / sessionCount,
    tss:         fieldHits.tss         / sessionCount,
    durationMin: fieldHits.durationMin / sessionCount,
    heartRate:   fieldHits.heartRate   / sessionCount,
  }

  // Weakest field = lowest fill rate (deterministic tie-break by QUALITY_FIELDS
  // order, which matches RPE → TSS → DURATION → HR display order). If every
  // field is at 100% fill, weakestField is null (nothing to surface).
  let weakestField = null
  let weakestRate = Infinity
  for (const field of QUALITY_FIELDS) {
    const rate = fieldFillRates[field]
    if (rate < weakestRate) {
      weakestRate = rate
      weakestField = field
    }
  }
  if (weakestRate >= 1) weakestField = null

  return {
    band: classifyQualityBand(avgQuality),
    avgQuality,
    sessionCount,
    weakestField,
    fieldFillRates,
    citation: CHECK_IN_QUALITY_CITATION,
  }
}

export default analyzeCheckInQuality
