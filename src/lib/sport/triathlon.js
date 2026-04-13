// ─── src/lib/sport/triathlon.js — Triathlon multi-sport science engine ────────
// Multi-discipline TSS, brick fatigue, combined zone system.

import { swimTSS as _swimTSS }                from './swimming.js'
import { calculateCyclingTSS, getCyclingZones } from './cycling.js'
import { runningTSS, powerTSS }                from './simulation.js'
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
// Returns zones for all three disciplines.
// ftpWatts: bike FTP; vdot: running VDOT; cssSecPer100m: swim CSS pace
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

export function getDistanceProfile(key) {
  return TRIATHLON_DISTANCES[key] || null
}
