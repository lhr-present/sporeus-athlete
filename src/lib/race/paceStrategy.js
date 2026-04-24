// src/lib/race/paceStrategy.js
// Target splits from VDOT or explicit target time, with grade-adjusted pace.
// Source: Daniels J. (2013) Daniels' Running Formula, 3rd ed.

import { predictRaceTime } from '../sport/running.js'

// Daniels elevation adjustment constants
// Uphill:   +7.5 s/km per 1% grade  (≈ +12s/mile ÷ 1.609)
// Downhill: −5.0 s/km per 1% grade, capped at −2% (steeper = no extra benefit)
const UPHILL_S_PER_KM_PER_PCT   = 7.5
// Downhill constant is positive; negative grade × positive constant = negative (faster) adjustment
const DOWNHILL_S_PER_KM_PER_PCT = 5.0
const DOWNHILL_GRADE_CAP        = -2   // below this gradient, no further speedup

/**
 * Compute grade adjustment in s/km for a given gradient %.
 * @param {number} gradient_pct
 * @returns {number} seconds added per km (negative = faster on downhill)
 */
export function gradeAdjustment(gradient_pct) {
  if (!gradient_pct) return 0  // handles 0 and -0
  if (gradient_pct > 0) return gradient_pct * UPHILL_S_PER_KM_PER_PCT
  const effective = Math.max(gradient_pct, DOWNHILL_GRADE_CAP)
  return effective * DOWNHILL_S_PER_KM_PER_PCT  // negative × positive = negative
}

/**
 * Generate per-km target splits with optional grade adjustment.
 * @param {Object} opts
 * @param {number|null}  opts.vdot              - Daniels VDOT
 * @param {number}       opts.raceDistance_m    - Race distance in metres
 * @param {Array}        [opts.courseProfile]   - [{distance_m, gradient_pct}, ...] segments
 * @param {number|null}  [opts.targetTime_s]    - Override total target time in seconds
 * @returns {Object|null}
 */
export function computePaceStrategy({ vdot, raceDistance_m, courseProfile, targetTime_s }) {
  if (!raceDistance_m || raceDistance_m <= 0) return null

  let totalTime_s
  let basis

  if (targetTime_s != null && targetTime_s > 0) {
    totalTime_s = targetTime_s
    basis = 'target_time'
  } else if (vdot != null && vdot > 0) {
    totalTime_s = predictRaceTime(vdot, raceDistance_m)
    basis = 'vdot'
  } else {
    return null
  }

  if (!totalTime_s) return null

  const totalKm   = raceDistance_m / 1000
  const avgPace   = totalTime_s / totalKm  // s/km (flat, no elevation)
  const numSplits = Math.ceil(totalKm)

  // Build a gradient lookup: for each km segment, find the matching courseProfile segment
  function gradientForKm(kmIndex) {
    if (!courseProfile || courseProfile.length === 0) return 0
    const startM = kmIndex * 1000
    const endM   = Math.min((kmIndex + 1) * 1000, raceDistance_m)
    const midM   = (startM + endM) / 2
    // find the profile segment that contains midM
    let cumDist = 0
    for (const seg of courseProfile) {
      cumDist += seg.distance_m
      if (midM <= cumDist) return seg.gradient_pct || 0
    }
    return 0
  }

  let hillPenalty_s = 0
  let cumulative_s  = 0
  const splits = []

  for (let i = 0; i < numSplits; i++) {
    const isLastKm     = i === numSplits - 1
    const kmFraction   = isLastKm ? (totalKm - i) : 1.0
    const gradient     = gradientForKm(i)
    const adj          = gradeAdjustment(gradient) * kmFraction
    const target_s_km  = avgPace
    const grade_adj    = target_s_km + adj

    hillPenalty_s += adj
    cumulative_s  += grade_adj * kmFraction

    splits.push({
      km:                  i + 1,
      target_s_per_km:     Math.round(target_s_km),
      grade_adjusted_s_per_km: Math.round(grade_adj),
      cumulative_s:        Math.round(cumulative_s),
    })
  }

  return {
    splits,
    avgPace_s_per_km: Math.round(avgPace),
    basis,
    hillPenalty_s:    Math.round(hillPenalty_s),
    citation: 'Daniels J. (2013) Daniels\' Running Formula 3rd ed.',
  }
}
