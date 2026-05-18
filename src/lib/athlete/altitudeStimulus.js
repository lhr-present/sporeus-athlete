// src/lib/athlete/altitudeStimulus.js
//
// Altitude / climbing stimulus detector — surfaces sustained vertical
// load as a hypoxic-stimulus proxy.
//
// Background:
//   - Lippl et al. (2010) "Hypobaric hypoxia causes body weight reduction
//     in obese subjects" demonstrated measurable physiological response
//     to sustained elevated exposure. We use weekly total ascent as a
//     pragmatic surrogate when athletes lack altitude sensors.
//   - Levine & Stray-Gundersen (1997) "Living high–training low" and
//     Chapman (1998) established that repeated hypoxic stimulus drives
//     bone-marrow EPO response and red-cell expansion.
//
// The detector aggregates `elevationGainM` per week over the last 28
// days (4 weeks) and classifies the overall band:
//   HYPOXIC_STIMULUS — ≥3 of 4 weeks reach the 1500m "high-climbing"
//                       threshold (sustained hypoxic load)
//   MODERATE         — ≥2 weeks in the 500–1500m moderate range
//   NONE             — fewer than 2 weeks reach 500m
//
// Return value is `null` when there are fewer than 7 sessions in the
// 28-day window, or when no week has any elevation data at all — the
// signal cannot be inferred in those cases.
//
// Pure function. No I/O. No React. No external imports.

const MS_PER_DAY = 86400000
const WINDOW_DAYS = 28
const WEEK_DAYS = 7
const WEEKS_IN_WINDOW = 4
const MIN_SESSIONS = 7

/**
 * @description Weekly ascent thresholds (meters of vertical gain).
 *   The 1500m "high" threshold is a Lippl-proxy: a week that
 *   accumulates that much vertical typically reflects multi-hour
 *   exposure to elevated terrain, the regime where hypoxic adaptation
 *   becomes plausible. 500m is the lower "some climbing" cutoff —
 *   below this we treat the week as flat training.
 */
export const ALTITUDE_THRESHOLDS = Object.freeze({
  moderateWeekM: 500,
  highWeekM:     1500,
})

/**
 * @description Citation marker shipped on every non-null return so
 *   downstream consumers (UI footer, exports) can render attribution
 *   without hard-coding the literal in component code.
 */
export const ALTITUDE_STIMULUS_CITATION = 'Lippl 2010; Levine 1997'

function dayMs(iso) {
  if (!iso) return null
  const s = String(iso).slice(0, 10)
  const d = new Date(s + 'T12:00:00Z')
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

function isoFromMs(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * @description Detect altitude / hypoxic stimulus from a training log.
 *
 * @param {{ log: Array, today?: string }} args
 * @returns {{
 *   band:           'HYPOXIC_STIMULUS' | 'MODERATE' | 'NONE',
 *   weeks:          Array<{ weekStart: string, totalAscentM: number, sessionCount: number }>,
 *   totalAscent28d: number,
 *   citation:       string,
 * } | null}
 */
export function detectAltitudeStimulus({ log, today } = {}) {
  if (!Array.isArray(log)) return null

  const tToday = today || new Date().toISOString().slice(0, 10)
  const todayMs = dayMs(tToday)
  if (todayMs == null) return null

  // Anchor each week to a fixed day-of-window so they line up
  // deterministically with the input `today`.
  //   week 0 = today  ..  today − 6
  //   week 1 = today−7 .. today−13
  //   week 2 = today−14 .. today−20
  //   week 3 = today−21 .. today−27
  const weeks = []
  for (let w = 0; w < WEEKS_IN_WINDOW; w++) {
    const endMs   = todayMs - (w * WEEK_DAYS * MS_PER_DAY)
    const startMs = endMs - ((WEEK_DAYS - 1) * MS_PER_DAY)
    weeks.push({
      weekStart: isoFromMs(startMs),
      startMs,
      endMs,
      totalAscentM: 0,
      sessionCount: 0,
    })
  }

  const windowCutoffMs = todayMs - (WINDOW_DAYS - 1) * MS_PER_DAY

  let totalSessionsInWindow = 0
  let anyElevationDataPresent = false

  for (const e of log) {
    const dMs = dayMs(e?.date)
    if (dMs == null || dMs < windowCutoffMs || dMs > todayMs) continue
    totalSessionsInWindow += 1

    // Find the week bucket this session falls in.
    for (const wk of weeks) {
      if (dMs >= wk.startMs && dMs <= wk.endMs) {
        wk.sessionCount += 1
        const gain = Number(e?.elevationGainM)
        if (Number.isFinite(gain) && gain > 0) {
          wk.totalAscentM += gain
          anyElevationDataPresent = true
        }
        break
      }
    }
  }

  if (totalSessionsInWindow < MIN_SESSIONS) return null
  if (!anyElevationDataPresent) return null

  const totalAscent28d = weeks.reduce((a, w) => a + w.totalAscentM, 0)

  const highWeeks     = weeks.filter(w => w.totalAscentM >= ALTITUDE_THRESHOLDS.highWeekM).length
  const moderateWeeks = weeks.filter(w =>
    w.totalAscentM >= ALTITUDE_THRESHOLDS.moderateWeekM &&
    w.totalAscentM <  ALTITUDE_THRESHOLDS.highWeekM
  ).length
  const weeksWithSomeClimbing = weeks.filter(w => w.totalAscentM >= ALTITUDE_THRESHOLDS.moderateWeekM).length

  let band
  if (highWeeks >= 3) {
    band = 'HYPOXIC_STIMULUS'
  } else if (weeksWithSomeClimbing >= 2) {
    band = 'MODERATE'
  } else {
    band = 'NONE'
  }
  // (moderateWeeks is captured for callers who want it; band logic uses
  //  weeksWithSomeClimbing so a week ≥1500m still counts toward the
  //  ≥2-weeks-with-climbing threshold when HYPOXIC_STIMULUS isn't hit.)
  void moderateWeeks

  // Public weekly shape — drop the internal startMs/endMs anchors.
  const publicWeeks = weeks.map(w => ({
    weekStart:    w.weekStart,
    totalAscentM: w.totalAscentM,
    sessionCount: w.sessionCount,
  }))

  return {
    band,
    weeks: publicWeeks,
    totalAscent28d,
    citation: ALTITUDE_STIMULUS_CITATION,
  }
}
