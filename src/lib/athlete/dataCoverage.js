// ─── dataCoverage.js — Lifetime logging coverage analyzer ─────────────────────
//
// Surfaces what fraction of days since the user's first log entry have AT
// LEAST ONE log entry (session OR recovery). Habit-formation research
// (Wood 2013) shows that consistent daily logging is the single strongest
// predictor of long-term behavior maintenance; Hellard 2019 frames it as
// "data fidelity" — sparse logging leaves trend analytics under-powered.
//
// Pure function. No React. Deterministic given (log, recovery, today).
//
// Citations:
//   Wood W. & Neal D.T. (2013) "The habitual consumer", J. Consumer Psych.
//   Hellard P. et al. (2019) "Modelling the relationships between training,
//     anxiety, and fatigue in elite athletes", PLOS ONE.

/**
 * Coerce an entry's date field to an ISO 'YYYY-MM-DD' string.
 * Accepts either a string (already ISO) or a Date instance. Returns null
 * for unparseable input.
 *
 * @param {string|Date|undefined} d
 * @returns {string|null}
 */
function toIsoDate(d) {
  if (!d) return null
  if (typeof d === 'string') {
    // Match a leading YYYY-MM-DD; tolerate trailing time/zone.
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(d)
    return m ? m[1] : null
  }
  if (d instanceof Date && !isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10)
  }
  return null
}

/**
 * Inclusive day-count between two 'YYYY-MM-DD' strings (UTC midnight).
 * Returns 1 when the two dates are the same day; 0 when first > last.
 *
 * @param {string} firstStr
 * @param {string} lastStr
 * @returns {number}
 */
function inclusiveDayCount(firstStr, lastStr) {
  const first = new Date(firstStr + 'T00:00:00Z')
  const last  = new Date(lastStr  + 'T00:00:00Z')
  if (isNaN(first.getTime()) || isNaN(last.getTime())) return 0
  const diffMs = last.getTime() - first.getTime()
  if (diffMs < 0) return 0
  return Math.floor(diffMs / 86400000) + 1
}

/**
 * Build a Set of unique ISO date strings from an array of entries.
 * Each entry's `.date` is normalized via toIsoDate.
 *
 * @param {Array<{date: any}>|null|undefined} entries
 * @returns {Set<string>}
 */
function uniqueDateSet(entries) {
  const out = new Set()
  if (!Array.isArray(entries)) return out
  for (const e of entries) {
    if (!e) continue
    const iso = toIsoDate(e.date)
    if (iso) out.add(iso)
  }
  return out
}

/**
 * Classify a coverage ratio (0..1) into a band.
 *
 *   coverage ≥ 0.70 → HIGH    (green)
 *   0.40 ≤ c < 0.70 → MEDIUM  (blue)
 *   coverage < 0.40 → LOW     (orange)
 *
 * @param {number} coverage
 * @returns {'HIGH'|'MEDIUM'|'LOW'}
 */
export function classifyCoverageBand(coverage) {
  if (coverage >= 0.70) return 'HIGH'
  if (coverage >= 0.40) return 'MEDIUM'
  return 'LOW'
}

/**
 * Analyze lifetime data coverage across log + recovery streams.
 *
 * Returns null when BOTH `log` and `recovery` are empty/null — no
 * meaningful "first log entry" exists to anchor the lifetime window.
 *
 * @param {{
 *   log?:      Array<{date: any}>|null,
 *   recovery?: Array<{date: any}>|null,
 *   today?:    string|Date,
 * }} input
 * @returns {{
 *   band: 'HIGH'|'MEDIUM'|'LOW',
 *   coverage: number,
 *   totalDays: number,
 *   daysWithAnyEntry: number,
 *   daysWithSession: number,
 *   daysWithRecovery: number,
 *   overlap: number,
 *   firstDate: string,
 *   citation: string,
 * }|null}
 */
export function analyzeDataCoverage({ log, recovery, today } = {}) {
  const logEmpty      = !Array.isArray(log)      || log.length === 0
  const recoveryEmpty = !Array.isArray(recovery) || recovery.length === 0
  if (logEmpty && recoveryEmpty) return null

  const sessionDates  = uniqueDateSet(log)
  const recoveryDates = uniqueDateSet(recovery)

  // If, after normalization, no parseable dates exist on either side,
  // return null — there's nothing to anchor a coverage window to.
  if (sessionDates.size === 0 && recoveryDates.size === 0) return null

  // todayStr: derive from input; fall back to system clock.
  const todayStr = toIsoDate(today) ||
    (today === undefined ? new Date().toISOString().slice(0, 10) : null)
  if (!todayStr) return null

  // firstDate = earliest date across BOTH arrays. We sort lexicographically
  // because ISO 'YYYY-MM-DD' strings sort chronologically.
  const allDates = new Set([...sessionDates, ...recoveryDates])
  let firstDate = null
  for (const d of allDates) {
    if (firstDate === null || d < firstDate) firstDate = d
  }
  if (!firstDate) return null

  // Cap firstDate at today (defensive against future-dated entries).
  if (firstDate > todayStr) firstDate = todayStr

  // Build the unique-dates set within the [firstDate, today] window.
  const inWindow = new Set()
  for (const d of allDates) {
    if (d >= firstDate && d <= todayStr) inWindow.add(d)
  }

  // Per-stream counts, restricted to the same window for symmetry.
  let daysWithSession  = 0
  for (const d of sessionDates)  if (d >= firstDate && d <= todayStr) daysWithSession++
  let daysWithRecovery = 0
  for (const d of recoveryDates) if (d >= firstDate && d <= todayStr) daysWithRecovery++

  // Overlap = dates present in BOTH streams (within window).
  let overlap = 0
  for (const d of sessionDates) {
    if (d >= firstDate && d <= todayStr && recoveryDates.has(d)) overlap++
  }

  const totalDays = inclusiveDayCount(firstDate, todayStr)
  if (totalDays <= 0) return null

  const daysWithAnyEntry = inWindow.size
  const coverage = daysWithAnyEntry / totalDays
  const band = classifyCoverageBand(coverage)

  return {
    band,
    coverage,
    totalDays,
    daysWithAnyEntry,
    daysWithSession,
    daysWithRecovery,
    overlap,
    firstDate,
    citation: 'Wood 2013; Hellard 2019',
  }
}
