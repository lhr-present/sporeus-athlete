// ─── monotonyTrend.js — 4-week monotony/strain trend wrapper ─────────────────
//
// Re-uses `computeMonotony` (Foster 1998; Foster 2001) from
// src/lib/trainingLoad.js to produce a rolling N-week trend of monotony
// and Foster strain values.
//
// Why this exists:
//   `computeMonotony` already powers the one-line TodayView warning,
//   but no card surfaces the 28-day MONOTONY TREND. A rising monotony
//   score is a leading indicator of overreaching/overtraining: an
//   athlete grinding similar daily loads (no recovery day variance)
//   has high monotony, and the canonical Foster strain product
//   (weekly load × monotony) peaks AFTER monotony rises. Watching the
//   monotony curve gives an earlier warning than watching strain.
//
// Band thresholds (Foster 1998; Foster 2001):
//   < 1.5         → LOW         (healthy day-to-day variance)
//   1.5 – 1.99    → MODERATE    (acceptable but worth watching)
//   2.0 – 2.5     → HIGH        (early-warning band)
//   > 2.5         → VERY_HIGH   (overreach risk, recovery day needed)
//
// Pure function — no React, no DOM, fully testable.

import { computeMonotony } from '../trainingLoad.js'

export const MONOTONY_TREND_CITATION = 'Foster 1998; Foster 2001'

const LOW_CEIL       = 1.5
const MODERATE_CEIL  = 2.0
const HIGH_CEIL      = 2.5

/**
 * Classify a monotony value into a band label.
 * Thresholds (Foster 1998; Foster 2001):
 *   < 1.5    → 'LOW'
 *   1.5–1.99 → 'MODERATE'
 *   2.0–2.5  → 'HIGH'
 *   > 2.5    → 'VERY_HIGH'
 * @param {number|null} monotony
 * @returns {'LOW'|'MODERATE'|'HIGH'|'VERY_HIGH'|null}
 */
export function classifyMonotonyBand(monotony) {
  if (monotony === null || monotony === undefined || Number.isNaN(monotony)) return null
  if (monotony < LOW_CEIL) return 'LOW'
  if (monotony < MODERATE_CEIL) return 'MODERATE'
  if (monotony <= HIGH_CEIL) return 'HIGH'
  return 'VERY_HIGH'
}

/**
 * Return YYYY-MM-DD for a Date in UTC.
 * @param {Date} d
 */
function isoDay(d) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Resolve the Monday (UTC) on or before the given date. Week start = Monday
 * per ISO 8601, matching the Mon–Sun convention specified by the task.
 * @param {Date} d
 * @returns {Date} UTC midnight on that Monday
 */
function mondayOnOrBefore(d) {
  const out = new Date(d)
  out.setUTCHours(0, 0, 0, 0)
  const day = out.getUTCDay() // 0=Sun, 1=Mon, …, 6=Sat
  const delta = day === 0 ? 6 : day - 1 // back up to Monday
  out.setUTCDate(out.getUTCDate() - delta)
  return out
}

/**
 * Coerce `today` into a UTC Date.
 * @param {string|Date|undefined} today
 */
function resolveToday(today) {
  if (today instanceof Date) {
    const d = new Date(today)
    d.setUTCHours(0, 0, 0, 0)
    return d
  }
  if (typeof today === 'string' && today) {
    const d = new Date(`${today.slice(0, 10)}T00:00:00Z`)
    if (!Number.isNaN(d.getTime())) return d
  }
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/**
 * Compute a rolling N-week monotony / Foster strain trend.
 *
 * For each of the most recent `weeks` Mon–Sun weeks (oldest first,
 * newest last) the function:
 *   1. Builds the Mon–Sun window for that week.
 *   2. Calls existing `computeMonotony` with `asOf = Sunday of that week`.
 *   3. Records `{ weekStart, weekTss, monotony, strain }`.
 *
 * @param {Object} args
 * @param {Array}  args.log    - training log entries [{ date, tss }]
 * @param {string|Date} [args.today] - reference "today"; defaults to now
 * @param {number} [args.weeks=4]    - how many trailing weeks to surface
 * @returns {{
 *   trend: Array<{ weekStart: string, weekTss: number, monotony: number|null, strain: number|null }>,
 *   latest: number|null,
 *   band: 'LOW'|'MODERATE'|'HIGH'|'VERY_HIGH'|null,
 *   citation: string,
 * } | null}
 */
export function computeMonotonyTrend({ log, today, weeks = 4 } = {}) {
  if (!Array.isArray(log) || log.length < 7) return null
  const safeWeeks = Math.max(1, Math.floor(weeks))

  const todayDate = resolveToday(today)
  // The newest week in the trend is the Mon–Sun week containing `today`.
  const newestMonday = mondayOnOrBefore(todayDate)

  const trend = []
  for (let i = safeWeeks - 1; i >= 0; i--) {
    const weekStart = new Date(newestMonday)
    weekStart.setUTCDate(weekStart.getUTCDate() - i * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 6) // Sunday of that week

    const r = computeMonotony(log, weekEnd)
    trend.push({
      weekStart: isoDay(weekStart),
      weekTss: r?.weekTSS ?? 0,
      monotony: r?.monotony ?? null,
      strain: r?.strain ?? null,
    })
  }

  const latest = trend.length > 0 ? trend[trend.length - 1].monotony : null
  const band = classifyMonotonyBand(latest)

  return {
    trend,
    latest,
    band,
    citation: MONOTONY_TREND_CITATION,
  }
}
