// src/lib/athlete/volumeIntensityScissors.js
//
// Volume × Intensity Scissors — Issurin 2010 "block periodization" detector.
//
// Theory: as a periodization block transitions accumulation → transmutation
// → realization, weekly VOLUME should DECREASE while average INTENSITY
// INCREASES (high-volume base → low-volume race prep). Plotted together
// the two trend lines should "cross like scissors". The opposite pattern
// (volume up + intensity down) is a common but mis-periodized arrangement,
// and BOTH rising is an overreaching trajectory.
//
// Scientific grounding:
//   - Issurin 2010 — "New horizons for the methodology and physiology
//     of training periodization" — formal block-periodization theory
//     describing accumulation → transmutation → realization phases with
//     the inverse volume / intensity relationship.
//   - Stöggl 2014 — Frontiers in Physiology study on periodization
//     models in endurance, reinforcing intensity-rise-as-volume-falls
//     as a hallmark of effective race-prep blocks.
//
// Output bands (last-half-mean vs first-half-mean trend on each axis):
//   PROPER_SCISSORS — volumeTrendPct < -0.10 AND intensityTrendPct > +0.10
//   INVERTED        — volumeTrendPct > +0.10 AND intensityTrendPct < -0.10
//   BOTH_UP         — volumeTrendPct > +0.10 AND intensityTrendPct > +0.10
//   BOTH_DOWN       — volumeTrendPct < -0.10 AND intensityTrendPct < -0.10
//   NO_CHANGE       — otherwise (both trends within ±10%)
//
// Returns null when fewer than 6 of windowWeeks have non-zero volume, or
// fewer than 4 weeks have a measurable average intensity.
//
// Pure function. No React, no I/O.

export const VOLUME_INTENSITY_SCISSORS_CITATION = 'Issurin 2010; Stöggl 2014'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_WINDOW_WEEKS = 8
const MIN_VOLUME_WEEKS = 6
const MIN_INTENSITY_WEEKS = 4
const TREND_THRESHOLD = 0.10

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
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function round4(v) {
  return Math.round(v * 10000) / 10000
}

function round2(v) {
  return Math.round(v * 100) / 100
}

function mean(arr) {
  if (!arr.length) return 0
  let s = 0
  for (const v of arr) s += v
  return s / arr.length
}

function classifyBand(volTrend, intTrend) {
  const volUp = volTrend > TREND_THRESHOLD
  const volDown = volTrend < -TREND_THRESHOLD
  const intUp = intTrend > TREND_THRESHOLD
  const intDown = intTrend < -TREND_THRESHOLD
  if (volDown && intUp) return 'PROPER_SCISSORS'
  if (volUp && intDown) return 'INVERTED'
  if (volUp && intUp) return 'BOTH_UP'
  if (volDown && intDown) return 'BOTH_DOWN'
  return 'NO_CHANGE'
}

/**
 * Analyze volume × intensity scissors pattern across the last `windowWeeks`
 * ISO weeks ending in the week containing `today`.
 *
 * @param {{
 *   log: Array<{ date: string, duration_min?: number, tss?: number }>,
 *   today: string | Date,
 *   windowWeeks?: number,
 * }} args
 * @returns {{
 *   band: 'PROPER_SCISSORS' | 'INVERTED' | 'BOTH_UP' | 'BOTH_DOWN' | 'NO_CHANGE',
 *   weeks: Array<{ weekStart: string, totalMinutes: number, avgIntensity: number }>,
 *   volumeTrendPct: number,
 *   intensityTrendPct: number,
 *   citation: string,
 * } | null}
 */
export function analyzeVolumeIntensityScissors({
  log,
  today,
  windowWeeks = DEFAULT_WINDOW_WEEKS,
} = {}) {
  const todayIso = resolveTodayIso(today)
  if (!todayIso) return null

  const safeWindow = Math.max(2, Math.floor(Number(windowWeeks) || DEFAULT_WINDOW_WEEKS))

  // Build the window: oldest week first, newest (containing today) last.
  const currentMonday = isoMondayOf(todayIso)
  const buckets = []
  for (let i = safeWindow - 1; i >= 0; i--) {
    const weekStart = isoMinusDays(currentMonday, i * 7)
    buckets.push({
      weekStart,
      totalMinutes: 0,
      // For duration-weighted intensity: sum(perSessionIntensity * duration)
      // and sum(duration) — we divide at the end.
      weightedIntensityNumerator: 0,
      intensityDurationSum: 0,
    })
  }

  const idxByWeekStart = {}
  buckets.forEach((b, i) => { idxByWeekStart[b.weekStart] = i })

  const earliestWeekStart = buckets[0].weekStart
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

      const duration = Number(e.duration_min ?? e.duration)  // v9.483: canonical key fallback (contract sweep A1)
      if (Number.isFinite(duration) && duration > 0) {
        buckets[idx].totalMinutes += duration

        const tss = Number(e.tss)
        if (Number.isFinite(tss) && tss > 0) {
          // Per-session intensity = (tss / duration_min) × 60 (intensity factor² scaled).
          // Duration-weight when aggregating into the weekly bucket.
          const perSessionIntensity = (tss / duration) * 60
          buckets[idx].weightedIntensityNumerator += perSessionIntensity * duration
          buckets[idx].intensityDurationSum += duration
        }
      }
    }
  }

  // Resolve weekly aggregates.
  const weeks = buckets.map(b => {
    const avgIntensity = b.intensityDurationSum > 0
      ? b.weightedIntensityNumerator / b.intensityDurationSum
      : 0
    return {
      weekStart: b.weekStart,
      totalMinutes: round2(b.totalMinutes),
      avgIntensity: round2(avgIntensity),
    }
  })

  // Gating: require ≥6 weeks with totalMinutes > 0 AND ≥4 weeks with avgIntensity > 0.
  const volumeWeeks = weeks.reduce((n, w) => n + (w.totalMinutes > 0 ? 1 : 0), 0)
  const intensityWeeks = weeks.reduce((n, w) => n + (w.avgIntensity > 0 ? 1 : 0), 0)

  // Scale minimums to window size when caller shrinks below defaults.
  const minVol = safeWindow >= DEFAULT_WINDOW_WEEKS
    ? MIN_VOLUME_WEEKS
    : Math.max(2, Math.ceil(safeWindow * (MIN_VOLUME_WEEKS / DEFAULT_WINDOW_WEEKS)))
  const minInt = safeWindow >= DEFAULT_WINDOW_WEEKS
    ? MIN_INTENSITY_WEEKS
    : Math.max(2, Math.ceil(safeWindow * (MIN_INTENSITY_WEEKS / DEFAULT_WINDOW_WEEKS)))

  if (volumeWeeks < minVol) return null
  if (intensityWeeks < minInt) return null

  // Split window in half.
  const half = Math.floor(safeWindow / 2)
  const firstHalf = weeks.slice(0, half)
  const lastHalf = weeks.slice(safeWindow - half)

  const firstHalfMeanVol = mean(firstHalf.map(w => w.totalMinutes))
  const lastHalfMeanVol = mean(lastHalf.map(w => w.totalMinutes))
  const firstHalfMeanInt = mean(firstHalf.map(w => w.avgIntensity))
  const lastHalfMeanInt = mean(lastHalf.map(w => w.avgIntensity))

  const volumeTrendPct = firstHalfMeanVol > 0
    ? (lastHalfMeanVol - firstHalfMeanVol) / firstHalfMeanVol
    : 0
  const intensityTrendPct = firstHalfMeanInt > 0
    ? (lastHalfMeanInt - firstHalfMeanInt) / firstHalfMeanInt
    : 0

  const roundedVol = round4(volumeTrendPct)
  const roundedInt = round4(intensityTrendPct)

  const band = classifyBand(roundedVol, roundedInt)

  return {
    band,
    weeks,
    volumeTrendPct: roundedVol,
    intensityTrendPct: roundedInt,
    citation: VOLUME_INTENSITY_SCISSORS_CITATION,
  }
}
