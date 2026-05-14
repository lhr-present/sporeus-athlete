// src/lib/athlete/wellnessTrend.js
//
// v9.122.0 — Wellness 7-day vs prior-7-day trend analyzer.
//
// The 14-day sparkline (charts/WellnessSparkline.jsx) draws the lines
// but doesn't interpret them. Athletes who eyeball a chart often miss
// the *delta* — "sleep is fine each day in isolation" can hide
// "sleep has dropped 1.2 points across the week."
//
// This module computes per-field current-vs-prior 7-day averages and
// classifies each field as concerning when:
//   - the current-7 average is in the bad tier of the 1-5 scale, OR
//   - the week-over-week delta crosses a meaningful threshold
//
// The UI uses `anyConcerning` to gate a banner that surfaces the bad
// fields with bilingual one-line summaries. When nothing is
// concerning, no banner — silence is the absence of a problem.
//
// Pure function. No I/O.
//
// Scale convention (matches WELLNESS_FIELDS in lib/constants.js):
//   sleep, energy: 1 (poor) → 5 (great)  — higher is better
//   soreness:      1 (none) → 5 (severe) — lower is better

const MS_PER_DAY = 86400000
const WINDOW = 7

/**
 * @description Per-field thresholds. `concerningLow` / `concerningHigh`
 *   bound the bad tier of the 1-5 scale; `concerningDelta` is the
 *   week-over-week change considered meaningful regardless of absolute
 *   level. `worseDirection` says which way the field deteriorates.
 */
export const WELLNESS_FIELDS_META = [
  { key: 'sleep',    worseDirection: 'down', concerningLow: 2.5, concerningDelta: 0.8 },
  { key: 'energy',   worseDirection: 'down', concerningLow: 2.5, concerningDelta: 0.8 },
  { key: 'soreness', worseDirection: 'up',   concerningHigh: 3.5, concerningDelta: 0.8 },
]

function dayKey(iso) {
  if (!iso) return null
  const d = new Date(String(iso).slice(0, 10) + 'T12:00:00Z')
  if (Number.isNaN(d.getTime())) return null
  return Math.floor(d.getTime() / MS_PER_DAY)
}

function avg(values) {
  const nums = values.filter(v => Number.isFinite(v))
  if (nums.length === 0) return null
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/**
 * @description Compute the 7-day vs prior-7-day trend for the
 *   wellness fields. Returns per-field stats plus a top-level
 *   `anyConcerning` flag for callers that just want a render gate.
 *
 * @param {Array}  recovery - recovery entries (each {date, sleep, energy, soreness, ...})
 * @param {string} [today]  - 'YYYY-MM-DD'; defaults to today UTC
 * @returns {{
 *   anyConcerning: boolean,
 *   fields: Array<{
 *     key: string,
 *     current7Avg: number | null,
 *     prior7Avg:   number | null,
 *     delta:       number | null,     // current - prior (worse for soreness, better for sleep/energy)
 *     direction:   'up' | 'down' | 'flat' | null,
 *     concerning:  boolean,
 *     reason:      'avg-low' | 'avg-high' | 'declining' | 'rising' | null,
 *   }>,
 * }}
 */
export function analyzeWellnessTrend(recovery, today) {
  const tToday = today || new Date().toISOString().slice(0, 10)
  const todayKey = dayKey(tToday)
  const rows = Array.isArray(recovery) ? recovery : []

  // Bucket entries by day-key to the most recent value per day.
  const byDay = new Map()
  for (const r of rows) {
    const k = dayKey(r?.date)
    if (k === null) continue
    byDay.set(k, r)
  }

  const fields = WELLNESS_FIELDS_META.map(meta => {
    const currentVals = []
    const priorVals = []
    if (todayKey != null) {
      for (let i = 0; i < WINDOW; i++) {
        const cur = byDay.get(todayKey - i)
        const pri = byDay.get(todayKey - WINDOW - i)
        const c = Number(cur?.[meta.key])
        const p = Number(pri?.[meta.key])
        if (Number.isFinite(c)) currentVals.push(c)
        if (Number.isFinite(p)) priorVals.push(p)
      }
    }
    const current7Avg = avg(currentVals)
    const prior7Avg   = avg(priorVals)
    const delta = (current7Avg != null && prior7Avg != null)
      ? Number((current7Avg - prior7Avg).toFixed(2))
      : null

    let direction = null
    if (delta != null) {
      if (Math.abs(delta) < 0.2) direction = 'flat'
      else if (delta > 0)        direction = 'up'
      else                       direction = 'down'
    }

    let concerning = false
    let reason = null

    // Reason ordering: absolute-level first (more severe), then delta.
    if (current7Avg != null) {
      if (meta.worseDirection === 'down' && current7Avg <= meta.concerningLow) {
        concerning = true
        reason = 'avg-low'
      } else if (meta.worseDirection === 'up' && current7Avg >= meta.concerningHigh) {
        concerning = true
        reason = 'avg-high'
      }
    }
    if (!concerning && delta != null) {
      if (meta.worseDirection === 'down' && delta <= -meta.concerningDelta) {
        concerning = true
        reason = 'declining'
      } else if (meta.worseDirection === 'up' && delta >= meta.concerningDelta) {
        concerning = true
        reason = 'rising'
      }
    }

    return { key: meta.key, current7Avg, prior7Avg, delta, direction, concerning, reason }
  })

  return {
    anyConcerning: fields.some(f => f.concerning),
    fields,
  }
}
