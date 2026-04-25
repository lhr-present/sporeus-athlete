// ─── strainHistory.js — 8-week rolling monotony + strain history (Foster 1998) ─
// Reference: Foster C. (1998). "Monitoring training in athletes with reference
// to overtraining syndrome." Med Sci Sports Exerc 30(7):1164–1168.
// ─────────────────────────────────────────────────────────────────────────────

import { computeMonotony } from '../trainingLoad.js'

export const FOSTER_CITATION = 'Foster 1998 · Med Sci Sports Exerc 30(7):1164'

// Foster 1998 thresholds
export const MONOTONY_HIGH_THRESHOLD = 2.0
export const STRAIN_HIGH_THRESHOLD   = 6000

// ─── toISOWeekString ──────────────────────────────────────────────────────────
/**
 * Return the ISO week string ('YYYY-Www') for a given Date.
 */
function toISOWeekString(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7 // 1=Mon … 7=Sun
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
  const y = d.getUTCFullYear()
  return `${y}-W${String(weekNo).padStart(2, '0')}`
}

// ─── sundayEndingWeek ─────────────────────────────────────────────────────────
/**
 * Given a Date that is inside a week, return the Sunday (end of that ISO week).
 * ISO week: Mon–Sun, so Sunday is the last day.
 */
function sundayEndingWeek(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0=Sun, 1=Mon … 6=Sat
  const daysUntilSunday = day === 0 ? 0 : 7 - day
  d.setDate(d.getDate() + daysUntilSunday)
  return d
}

// ─── classifyStrainWeek ───────────────────────────────────────────────────────
/**
 * Classify a week given its monotony and strain values.
 *
 * Returns:
 *   'high_monotony' if monotony >= 2.0  (takes priority)
 *   'high_strain'   if strain  >= 6000
 *   'ok'            if both below thresholds and monotony > 0
 *   'low_load'      if monotony === null or monotony === 0
 *
 * @param {number|null} monotony
 * @param {number|null} strain
 * @returns {'high_monotony'|'high_strain'|'ok'|'low_load'}
 */
export function classifyStrainWeek(monotony, strain) {
  if (monotony === null || monotony === 0) return 'low_load'
  if (monotony >= MONOTONY_HIGH_THRESHOLD) return 'high_monotony'
  if (strain !== null && strain >= STRAIN_HIGH_THRESHOLD) return 'high_strain'
  return 'ok'
}

// ─── computeStrainHistory ─────────────────────────────────────────────────────
/**
 * Compute 8-week rolling monotony + strain history.
 *
 * For each of the last `weeks` ISO weeks (ending on the Sunday of that week),
 * calls computeMonotony(log, sundayOfThatWeek) where sundayOfThatWeek is a Date.
 *
 * @param {Array}  log   - training log entries [{ date, tss }]
 * @param {number} weeks - number of weeks to compute (default 8)
 * @param {string} today - 'YYYY-MM-DD' reference date
 * @returns {Array<{isoWeek:string, monotony:number|null, strain:number|null, weekTSS:number, status:string}>}
 *          sorted oldest→newest; returns [] if log.length < 7
 */
export function computeStrainHistory(
  log = [],
  weeks = 8,
  today = new Date().toISOString().slice(0, 10),
) {
  if (log.length < 7) return []

  // Anchor: Sunday of the ISO week containing today
  const todayDate = new Date(today + 'T00:00:00')
  const anchorSunday = sundayEndingWeek(todayDate)

  const result = []

  for (let w = weeks - 1; w >= 0; w--) {
    // Sunday for week w weeks back from the anchor
    const sunday = new Date(anchorSunday)
    sunday.setDate(sunday.getDate() - w * 7)

    const isoWeek = toISOWeekString(sunday)

    // Slice the log up to and including this Sunday
    const sundayStr = sunday.toISOString().slice(0, 10)
    const slicedLog = log.filter(e => e.date <= sundayStr)

    const { monotony, strain, weekTSS } = computeMonotony(slicedLog, sunday)

    result.push({
      isoWeek,
      monotony,
      strain,
      weekTSS,
      status: classifyStrainWeek(monotony, strain),
    })
  }

  return result
}

// ─── computeStrainReport ─────────────────────────────────────────────────────
/**
 * Compute a summary report across the 8-week history.
 *
 * @param {Array}  log    - training log entries
 * @param {number} nWeeks - number of weeks (default 8)
 * @param {string} today  - 'YYYY-MM-DD' reference date
 * @returns {{ weeks, maxMonotony, maxStrain, hasHighMonotony, hasHighStrain, citation }|null}
 *          null if log.length < 7
 */
export function computeStrainReport(
  log = [],
  nWeeks = 8,
  today = new Date().toISOString().slice(0, 10),
) {
  if (log.length < 7) return null

  const weeks = computeStrainHistory(log, nWeeks, today)

  const monotonyValues = weeks.map(w => w.monotony).filter(v => v !== null)
  const strainValues   = weeks.map(w => w.strain).filter(v => v !== null)

  const maxMonotony = monotonyValues.length > 0 ? Math.max(...monotonyValues) : null
  const maxStrain   = strainValues.length   > 0 ? Math.max(...strainValues)   : null

  const hasHighMonotony = weeks.some(w => w.monotony !== null && w.monotony >= MONOTONY_HIGH_THRESHOLD)
  const hasHighStrain   = weeks.some(w => w.strain   !== null && w.strain   >= STRAIN_HIGH_THRESHOLD)

  return {
    weeks,
    maxMonotony,
    maxStrain,
    hasHighMonotony,
    hasHighStrain,
    citation: FOSTER_CITATION,
  }
}
