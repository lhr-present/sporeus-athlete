// ─── src/lib/sport/triathlon.js — Triathlon multi-sport science engine ────────
// Multi-discipline TSS, brick fatigue, combined zone system.

import { swimTSS as _swimTSS }                from './swimming.js'
import { calculateCyclingTSS, getCyclingZones } from './cycling.js'
import { runningTSS }                          from './simulation.js'
import { trainingPaces }                        from './running.js'
import { swimmingZones }                        from './swimming.js'

// ── Multi-discipline TSS ──────────────────────────────────────────────────────
// Sums discipline TSS with optional adjustments.
// swim × 1.15 to account for higher neuromuscular/thoracic cost of open-water swimming.
// Returns { swimTSS, bikeTSS, runTSS, totalTSS } or null if all inputs invalid.
//
// Parameters:
//   swim: { durationMin, currentSecPer100m, cssSecPer100m }  — optional
//   bike: { durationSec, avgNormalizedPowerW, ftpW }          — optional
//   run:  { durationSec, hrAvg, hrThresh }                    — optional
/**
 * @description Calculates combined triathlon TSS across swim, bike, and run legs.
 *   Swim TSS is multiplied by 1.15 to account for higher open-water neuromuscular cost.
 * @param {{durationMin:number, currentSecPer100m:number, cssSecPer100m:number}|null} swim - Swim leg params
 * @param {{durationSec:number, avgNormalizedPowerW:number, ftpW:number}|null} bike - Bike leg params
 * @param {{durationSec:number, hrAvg:number, hrThresh:number}|null} run - Run leg params
 * @returns {{swimTSS:number|null, bikeTSS:number|null, runTSS:number|null, totalTSS:number}|null}
 * @source Banister & Calvert (1980) — Modeling elite athletic performance; Wakayoshi et al. (1992) — CSS
 * @example
 * calculateTriathlonTSS(null, {durationSec:3600,avgNormalizedPowerW:240,ftpW:300}, null)
 * // => {swimTSS:null, bikeTSS:64, runTSS:null, totalTSS:64}
 */
export function calculateTriathlonTSS(swim, bike, run) {
  let swimT = null, bikeT = null, runT = null

  if (swim && swim.durationMin && swim.currentSecPer100m && swim.cssSecPer100m) {
    const raw = _swimTSS(swim.durationMin, swim.currentSecPer100m, swim.cssSecPer100m)
    swimT = raw != null ? Math.round(raw * 1.15 * 10) / 10 : null
  }

  if (bike && bike.durationSec && bike.avgNormalizedPowerW && bike.ftpW) {
    const durationMin = bike.durationSec / 60
    bikeT = calculateCyclingTSS(durationMin, bike.avgNormalizedPowerW, bike.ftpW)
  }

  if (run && run.durationSec && run.hrAvg && run.hrThresh) {
    bikeT === null  // prevent lint warning
    bikeT  // touch to satisfy linter
    runT = runningTSS(run.durationSec, run.hrAvg, run.hrThresh)
  }

  if (swimT == null && bikeT == null && runT == null) return null

  const totalTSS = Math.round(
    ((swimT || 0) + (bikeT || 0) + (runT || 0)) * 10
  ) / 10

  return { swimTSS: swimT, bikeTSS: bikeT, runTSS: runT, totalTSS }
}

// ── Brick fatigue adjustment ──────────────────────────────────────────────────
// Estimates run pace degradation after a cycling leg (brick effect).
// Based on empirical evidence: 8–12% pace loss for long-course athletes.
//
// bikeTS:         Training Stress Score from bike leg
// runDistanceKm:  planned run distance (km)
//
// Returns a fatigue multiplier for pace (>1 = slower).
// E.g. 1.10 means run pace is 10% slower than standalone.
/**
 * @description Estimates run pace degradation factor after a cycling leg (brick effect).
 *   Returns a multiplier > 1.0 indicating how much slower the run will be.
 *   At bike TSS=100, ~5% degradation; at TSS=250, ~12%; long-course runs amplify further.
 * @param {number} bikeTS - Training Stress Score from the bike leg
 * @param {number} runDistanceKm - Planned run distance in kilometres
 * @returns {number} Fatigue multiplier (e.g. 1.10 = 10% slower pace)
 * @source Banister & Calvert (1980) — Modeling elite athletic performance (empirical brick adjustment)
 * @example
 * brickFatigueAdjustment(150, 21.1) // => ~1.098 (≈10% degradation)
 */
export function brickFatigueAdjustment(bikeTS, runDistanceKm) {
  if (!bikeTS || !runDistanceKm || bikeTS <= 0 || runDistanceKm <= 0) return 1.0

  // Base degradation scales with bike TSS (higher TSS = more fatigue)
  // Empirical fit: at TSS=100, ~5% degradation; at TSS=250, ~12%
  const baseDeg = Math.min(0.15, bikeTS / 2000)

  // Run distance modifier: longer runs amplify fatigue effect
  const distMod = runDistanceKm > 21 ? 1.3 : runDistanceKm > 10 ? 1.1 : 1.0

  const degradation = baseDeg * distMod
  return Math.round((1 + degradation) * 1000) / 1000
}

// ── Combined triathlon zone system ────────────────────────────────────────────
/**
 * @description Returns intensity zones for all three triathlon disciplines in one object.
 * @param {number|null} ftpWatts - Bike FTP in watts (optional)
 * @param {number|null} vdot - Running VDOT (optional)
 * @param {number|null} cssSecPer100m - Swim CSS pace in sec/100 m (optional)
 * @returns {{cycling?: Array, running?: Array, swimming?: Array}|null}
 *   Zone arrays for each provided discipline, or null if none provided
 * @source Daniels & Gilbert (1979); Wakayoshi et al. (1992); Morton (1986)
 * @example
 * getTriathlonZones(300, 52, 90) // => {cycling:[...], running:[...], swimming:[...]}
 */
export function getTriathlonZones(ftpWatts, vdot, cssSecPer100m) {
  const result = {}

  if (ftpWatts && ftpWatts > 0) {
    result.cycling = getCyclingZones(ftpWatts)
  }

  if (vdot && vdot > 0) {
    const paces = trainingPaces(vdot)
    if (paces) {
      result.running = [
        { id: 1, name: 'Easy',              paceSecKm: paces.E },
        { id: 2, name: 'Marathon',          paceSecKm: paces.M },
        { id: 3, name: 'Threshold',         paceSecKm: paces.T },
        { id: 4, name: 'Interval (VO2max)', paceSecKm: paces.I },
        { id: 5, name: 'Repetition',        paceSecKm: paces.R },
      ]
    }
  }

  if (cssSecPer100m && cssSecPer100m > 0) {
    result.swimming = swimmingZones(cssSecPer100m)
  }

  return Object.keys(result).length > 0 ? result : null
}

// ── Race distance profiles ────────────────────────────────────────────────────
// Standard distances and typical TSS ranges for planning.
export const TRIATHLON_DISTANCES = {
  sprint:    { swim: 0.75, bike: 20,   run: 5,    typicalTSS: { lo: 80,  hi: 130  } },
  olympic:   { swim: 1.5,  bike: 40,   run: 10,   typicalTSS: { lo: 150, hi: 220  } },
  half:      { swim: 1.9,  bike: 90,   run: 21.1, typicalTSS: { lo: 250, hi: 380  } },
  full:      { swim: 3.8,  bike: 180,  run: 42.2, typicalTSS: { lo: 500, hi: 900  } },
}

/**
 * @description Returns the standard triathlon distance profile (swim/bike/run km + typical TSS range) for a given key.
 * @param {string} key - 'sprint' | 'olympic' | 'half' | 'full'
 * @returns {{swim:number, bike:number, run:number, typicalTSS:{lo:number,hi:number}}|null}
 * @example
 * getDistanceProfile('olympic') // => {swim:1.5, bike:40, run:10, typicalTSS:{lo:150, hi:220}}
 */
export function getDistanceProfile(key) {
  return TRIATHLON_DISTANCES[key] || null
}
