// src/lib/athlete/weeklyTssVariance.js
//
// Weekly TSS Variance — coefficient of variation (CV) of weekly TSS sums
// across the last 12 completed ISO weeks (Mon–Sun) ending in the week
// containing `today`.
//
// Why this exists (distinct from `monotonyTrend.js`):
//   `monotonyTrend.js` measures WITHIN-week TSS monotony (low day-to-day
//   variability inside one week → overreaching risk). This module instead
//   measures BETWEEN-week TSS variability across 12 weeks: high CV means
//   a chaotic, inconsistent load progression, while a low CV signals a
//   steady, sustainable habit.
//
// Scientific grounding:
//   - Foster 2001 — sRPE-derived weekly TSS is the canonical training
//     load monitoring signal; its dispersion is a meaningful adherence
//     metric on top of mean load alone.
//   - Bourdon 2017 ("Monitoring athlete training loads — consensus
//     statement") — frames load variability and predictability as a
//     primary lens on training quality, alongside total volume.
//
// Output bands (between-week CV of weekly TSS):
//   STEADY    — cv < 0.20   (highly consistent, predictable habit)
//   MODERATE  — 0.20 ≤ cv < 0.40 (normal training swings)
//   CHAOTIC   — cv ≥ 0.40   (large week-to-week swings, smooth the plan)
//
// Returns null when fewer than 8 of the 12 weeks have non-zero TSS, or
// when mean TSS is 0 (CV undefined).
//
// Pure function. No React, no I/O.

export const WEEKLY_TSS_VARIANCE_CITATION = 'Foster 2001; Bourdon 2017'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const WINDOW_WEEKS = 12
const MIN_NON_ZERO_WEEKS = 8
const STEADY_CEIL = 0.20
const MODERATE_CEIL = 0.40

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

// Return ISO date string (YYYY-MM-DD) for the Monday of the week containing
// `iso`. Week boundary follows ISO 8601 (Monday-first).
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

function classifyBand(cv) {
  if (!Number.isFinite(cv)) return null
  if (cv < STEADY_CEIL) return 'STEADY'
  if (cv < MODERATE_CEIL) return 'MODERATE'
  return 'CHAOTIC'
}

/**
 * Compute the coefficient of variation of weekly TSS sums across the
 * last `windowWeeks` ISO weeks (Mon–Sun) ending in the week containing
 * `today`.
 *
 * @param {{
 *   log: Array<{ date: string, tss?: number }>,
 *   today: string | Date,
 *   windowWeeks?: number,
 * }} args
 * @returns {{
 *   band: 'STEADY' | 'MODERATE' | 'CHAOTIC',
 *   cv: number,
 *   meanTss: number,
 *   stdTss: number,
 *   weeks: Array<{ weekStart: string, tss: number }>,
 *   citation: string,
 * } | null}
 */
export function analyzeWeeklyTssVariance({ log, today, windowWeeks = WINDOW_WEEKS } = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  const safeWindow = Math.max(1, Math.floor(Number(windowWeeks) || WINDOW_WEEKS))

  // Build the window: oldest week first, newest (containing today) last.
  const currentMonday = isoMondayOf(todayIso)
  const weeks = []
  for (let i = safeWindow - 1; i >= 0; i--) {
    const weekStart = isoMinusDays(currentMonday, i * 7)
    weeks.push({ weekStart, tss: 0 })
  }

  // Fast lookup by weekStart ISO.
  const idxByWeekStart = {}
  weeks.forEach((w, i) => { idxByWeekStart[w.weekStart] = i })

  const earliestWeekStart = weeks[0].weekStart
  // Week START of the week AFTER the current week — any session date whose
  // own week-Monday is ≥ this is outside the window.
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
      const tss = Number(e.tss)
      if (!Number.isFinite(tss) || tss <= 0) continue
      weeks[idx].tss += tss
    }
  }

  // Minimum-signal gate: require ≥ MIN_NON_ZERO_WEEKS of `safeWindow`
  // weeks to carry any load. Always require ≥8 even if window changes,
  // unless the caller explicitly shrank the window below 8 (then require
  // 2/3 of the window).
  const nonZeroWeeks = weeks.reduce((n, w) => n + (w.tss > 0 ? 1 : 0), 0)
  const minRequired = safeWindow >= MIN_NON_ZERO_WEEKS
    ? MIN_NON_ZERO_WEEKS
    : Math.ceil(safeWindow * (2 / 3))
  if (nonZeroWeeks < minRequired) return null

  // Population mean + stdev across the FULL window (zeros count — that's
  // the point of a between-week dispersion metric).
  const round2 = v => Math.round(v * 100) / 100
  const round4 = v => Math.round(v * 10000) / 10000

  const sum = weeks.reduce((s, w) => s + w.tss, 0)
  const meanTss = sum / weeks.length

  if (!(meanTss > 0)) return null

  const sqDiff = weeks.reduce((s, w) => {
    const d = w.tss - meanTss
    return s + d * d
  }, 0)
  const stdTss = Math.sqrt(sqDiff / weeks.length)

  const cv = stdTss / meanTss

  const band = classifyBand(cv)
  if (!band) return null

  return {
    band,
    cv: round4(cv),
    meanTss: round2(meanTss),
    stdTss: round2(stdTss),
    weeks: weeks.map(w => ({ weekStart: w.weekStart, tss: Math.round(w.tss) })),
    citation: WEEKLY_TSS_VARIANCE_CITATION,
  }
}
