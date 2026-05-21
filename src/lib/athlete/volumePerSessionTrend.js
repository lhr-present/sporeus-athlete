// src/lib/athlete/volumePerSessionTrend.js
//
// Volume-per-Session Trend — weekly mean session duration tracked across
// the last 12 ISO weeks (Mon–Sun, ending in week of `today`) plus a
// linear-regression slope of that mean against week index.
//
// Why this exists (distinct from sessionLengthDistribution.js and
// longestSessionTrend.js):
//   - `sessionLengthDistribution.js` is a SNAPSHOT histogram of session
//     durations across the last 90 days — it answers "what is the SHAPE
//     of my session-length mix?" but not "is it MOVING?".
//   - `longestSessionTrend.js` tracks ONLY the longest session each week
//     — useful for long-run growth, but a single outlier can dominate.
//   - This module tracks the MEAN session duration per week (every
//     session counts) and its slope vs. week index. It answers the
//     specific question: "Are my typical sessions getting longer or
//     shorter over time?".
//
// Scientific grounding:
//   - Daniels J. (2014). Daniels' Running Formula, 3rd ed. — frames
//     volume growth as two orthogonal axes: session frequency and
//     session duration. They produce different adaptations.
//   - Pfitzinger P., Latter P. (2014). Advanced Marathoning, 3rd ed. —
//     prescribes weeks/blocks of progressively LONGER sessions as the
//     specific stimulus for capillary density, mitochondrial volume,
//     and fat-oxidation gains, distinct from adding extra short runs.
//
// Output bands (slope as fraction of overall mean session duration per week):
//   SHRINKING            — trendPctPerWeek < -0.02   (–2%/wk or worse)
//   STABLE               — -0.02 ≤ trendPctPerWeek < 0.02
//   GROWING              — 0.02 ≤ trendPctPerWeek < 0.05
//   AGGRESSIVE_GROWTH    — trendPctPerWeek ≥ 0.05    (≥5%/wk)
//   INSUFFICIENT_DATA    — fewer than 12 sessions across the window
//
// Pure function. No React, no I/O.

export const VOLUME_PER_SESSION_TREND_CITATION = 'Daniels 2014; Pfitzinger 2014'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const WINDOW_WEEKS = 12
const MIN_SESSIONS = 12
const SHRINK_CEIL = -0.02
const GROW_FLOOR = 0.02
const AGGRESSIVE_FLOOR = 0.05

// Resolve `today` (string YYYY-MM-DD or Date) to a YYYY-MM-DD UTC ISO key.
function resolveTodayIso(today) {
  if (today instanceof Date && !Number.isNaN(today.getTime())) {
    return today.toISOString().slice(0, 10)
  }
  if (typeof today === 'string' && today) {
    const key = today.slice(0, 10)
    if (ISO_RE.test(key)) return key
  }
  return null
}

function isoMondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  // getUTCDay → Sun=0..Sat=6; convert so Mon=0..Sun=6.
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function round2(v) {
  return Math.round(v * 100) / 100
}

function round4(v) {
  return Math.round(v * 10000) / 10000
}

function classifyBand(pct) {
  if (!Number.isFinite(pct)) return 'STABLE'
  if (pct < SHRINK_CEIL) return 'SHRINKING'
  if (pct >= AGGRESSIVE_FLOOR) return 'AGGRESSIVE_GROWTH'
  if (pct >= GROW_FLOOR) return 'GROWING'
  return 'STABLE'
}

// Simple OLS linear regression slope of y vs index 0..n-1. Returns 0
// when n < 2 or all x identical.
function regressionSlope(ys) {
  const n = ys.length
  if (n < 2) return 0
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0
  for (let i = 0; i < n; i++) {
    const y = Number(ys[i]) || 0
    sumX += i
    sumY += y
    sumXY += i * y
    sumXX += i * i
  }
  const denom = n * sumXX - sumX * sumX
  if (!denom) return 0
  return (n * sumXY - sumX * sumY) / denom
}

/**
 * Compute weekly mean session duration over the last `windowWeeks` ISO
 * weeks and its linear-regression slope (minutes per week).
 *
 * @param {{
 *   log: Array<{ date: string, durationMin?: number, duration_min?: number }>,
 *   today: string | Date,
 *   windowWeeks?: number,
 * }} args
 * @returns {{
 *   band: 'SHRINKING' | 'STABLE' | 'GROWING' | 'AGGRESSIVE_GROWTH' | 'INSUFFICIENT_DATA',
 *   weeks: Array<{ weekStart: string, meanSessionMin: number, sessionCount: number }>,
 *   overallMeanSessionMin: number,
 *   trendSlopeMinPerWeek: number,
 *   trendPctPerWeek: number,
 *   sessionCountTotal: number,
 *   citation: string,
 * } | null}
 */
export function analyzeVolumePerSessionTrend({ log, today, windowWeeks = WINDOW_WEEKS } = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  const safeWindow = Math.max(1, Math.floor(Number(windowWeeks) || WINDOW_WEEKS))

  // Build the window: oldest week first, newest (containing today) last.
  const currentMonday = isoMondayOf(todayIso)
  const weeks = []
  for (let i = safeWindow - 1; i >= 0; i--) {
    const weekStart = isoMinusDays(currentMonday, i * 7)
    weeks.push({ weekStart, sumMin: 0, sessionCount: 0 })
  }

  const idxByWeekStart = {}
  weeks.forEach((w, i) => { idxByWeekStart[w.weekStart] = i })

  const earliestWeekStart = weeks[0].weekStart
  const exclusiveEnd = isoMinusDays(currentMonday, -7)

  if (Array.isArray(log)) {
    for (const e of log) {
      if (!e || !e.date) continue
      const key = String(e.date).slice(0, 10)
      if (!ISO_RE.test(key)) continue
      if (key < earliestWeekStart) continue
      if (key >= exclusiveEnd) continue
      const wkStart = isoMondayOf(key)
      const idx = idxByWeekStart[wkStart]
      if (idx == null) continue
      const raw = e.durationMin != null ? e.durationMin : e.duration_min
      const min = Number(raw)
      if (!Number.isFinite(min) || min <= 0) continue
      weeks[idx].sumMin += min
      weeks[idx].sessionCount += 1
    }
  }

  const sessionCountTotal = weeks.reduce((n, w) => n + w.sessionCount, 0)
  const sumAllMin = weeks.reduce((s, w) => s + w.sumMin, 0)
  const overallMeanSessionMin = round2(sumAllMin / Math.max(sessionCountTotal, 1))

  const weekRows = weeks.map(w => ({
    weekStart: w.weekStart,
    meanSessionMin: w.sessionCount > 0 ? round2(w.sumMin / w.sessionCount) : 0,
    sessionCount: w.sessionCount,
  }))

  if (sessionCountTotal < MIN_SESSIONS) {
    return {
      band: 'INSUFFICIENT_DATA',
      weeks: weekRows,
      overallMeanSessionMin,
      trendSlopeMinPerWeek: 0,
      trendPctPerWeek: 0,
      sessionCountTotal,
      citation: VOLUME_PER_SESSION_TREND_CITATION,
    }
  }

  const slope = regressionSlope(weekRows.map(r => r.meanSessionMin))
  const trendSlopeMinPerWeek = round2(slope)
  const denom = Math.max(overallMeanSessionMin, 1)
  const trendPctPerWeek = round4(trendSlopeMinPerWeek / denom)

  const band = classifyBand(trendPctPerWeek)

  return {
    band,
    weeks: weekRows,
    overallMeanSessionMin,
    trendSlopeMinPerWeek,
    trendPctPerWeek,
    sessionCountTotal,
    citation: VOLUME_PER_SESSION_TREND_CITATION,
  }
}
