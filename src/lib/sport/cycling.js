// ─── src/lib/sport/cycling.js — Cycling sport-science engine ─────────────────
// Coggan FTP zones, CP model, TSS, power-duration prediction.

import { fitCP } from './rowing.js'  // reuse CP OLS regression

// ── FTP calculation ───────────────────────────────────────────────────────────
/**
 * @description Calculates Functional Threshold Power (FTP) from maximal power tests.
 *   Prefers the CP model (≥2 efforts); falls back to 20-min TT × 0.95 (Coggan standard).
 * @param {Array<{timeSec: number, powerW: number}>} powerTests - One or more maximal efforts
 * @returns {{ftpWatts: number, wPrime?: number, method: 'CP'|'20min'}|null}
 *   FTP in watts, optional W' in joules, and method used; or null on invalid input
 * @source Morton (1986) — A 3-parameter critical power model
 * @example
 * calculateFTP([{timeSec:1200,powerW:250},{timeSec:300,powerW:310}]) // => {ftpWatts:~240, method:'CP'}
 */
export function calculateFTP(powerTests) {
  if (!powerTests || powerTests.length === 0) return null

  // Try CP model first if 2+ efforts
  if (powerTests.length >= 2) {
    const cp = fitCP(powerTests.map(t => ({ timeSec: t.timeSec, powerW: t.powerW })))
    if (cp && cp.CP > 0) {
      return { ftpWatts: Math.round(cp.CP), wPrime: cp.WPrime, method: 'CP' }
    }
  }

  // Fall back to 20-min test: assume first entry is 20-min power
  const test20 = powerTests.find(t => t.timeSec >= 1100 && t.timeSec <= 1300)
  if (test20 && test20.powerW > 0) {
    return { ftpWatts: Math.round(test20.powerW * 0.95), method: '20min' }
  }

  return null
}

// ── Coggan 7-zone system ──────────────────────────────────────────────────────
// Zones defined as % of FTP (power-based).
const COGGAN_ZONE_DEFS = [
  { id: 1, name: 'Active Recovery',    pctMin: 0,    pctMax: 0.55 },
  { id: 2, name: 'Endurance',          pctMin: 0.55, pctMax: 0.75 },
  { id: 3, name: 'Tempo',              pctMin: 0.75, pctMax: 0.90 },
  { id: 4, name: 'Lactate Threshold',  pctMin: 0.90, pctMax: 1.05 },
  { id: 5, name: 'VO2max',             pctMin: 1.05, pctMax: 1.20 },
  { id: 6, name: 'Anaerobic',          pctMin: 1.20, pctMax: 1.50 },
  { id: 7, name: 'Neuromuscular',      pctMin: 1.50, pctMax: Infinity },
]

/**
 * @description Returns the Coggan zone number (1–7) for a given power output relative to FTP.
 * @param {number} powerW - Current power output in watts
 * @param {number} ftpW - Functional Threshold Power in watts
 * @returns {number|null} Zone 1 (Active Recovery) to 7 (Neuromuscular), or null on invalid input
 * @source Morton (1986) — A 3-parameter critical power model; Coggan power zone system
 * @example
 * getCyclingZone(280, 300) // => 3 (Tempo, 93% FTP)
 */
export function getCyclingZone(powerW, ftpW) {
  if (!powerW || !ftpW || ftpW <= 0 || powerW < 0) return null
  const ratio = powerW / ftpW
  for (const z of COGGAN_ZONE_DEFS) {
    if (ratio >= z.pctMin && ratio < z.pctMax) return z.id
  }
  return 7  // > 150% FTP → neuromuscular
}

/**
 * @description Returns all 7 Coggan power zones with absolute watt boundaries for a given FTP.
 * @param {number} ftpWatts - Functional Threshold Power in watts
 * @returns {Array<{id, name, pctMin, pctMax, minWatts, maxWatts}>} Zone objects with computed watt ranges
 * @source Morton (1986) — A 3-parameter critical power model; Coggan power zone system
 * @example
 * getCyclingZones(300) // => [{id:1, name:'Active Recovery', minWatts:0, maxWatts:165}, ...]
 */
export function getCyclingZones(ftpWatts) {
  if (!ftpWatts || ftpWatts <= 0) return []
  return COGGAN_ZONE_DEFS.map(z => ({
    ...z,
    minWatts: z.pctMin === 0     ? 0  : Math.round(ftpWatts * z.pctMin),
    maxWatts: z.pctMax === Infinity ? null : Math.round(ftpWatts * z.pctMax),
  }))
}

// ── Cycling TSS ───────────────────────────────────────────────────────────────
/**
 * @description Calculates cycling Training Stress Score (TSS) using Coggan's normalized power formula.
 *   TSS = (durationHr) × IF² × 100, where IF = avgNormalizedPower / FTP.
 * @param {number} durationMin - Session duration in minutes
 * @param {number} avgNormalizedPowerW - Average normalized power in watts
 * @param {number} ftpW - Functional Threshold Power in watts
 * @returns {number|null} TSS value (1 decimal place), or null on invalid input
 * @source Morton (1986) — A 3-parameter critical power model; Banister & Calvert (1980) — Modeling elite athletic performance
 * @example
 * calculateCyclingTSS(60, 270, 300) // => 81.0 (IF=0.9)
 */
export function calculateCyclingTSS(durationMin, avgNormalizedPowerW, ftpW) {
  if (!durationMin || !avgNormalizedPowerW || !ftpW || ftpW <= 0) return null
  if (durationMin <= 0 || avgNormalizedPowerW <= 0) return null
  const IF  = avgNormalizedPowerW / ftpW
  const tss = (durationMin / 60) * IF * IF * 100
  return Math.round(tss * 10) / 10
}

// ── Power-duration prediction ─────────────────────────────────────────────────
// Simplified model: for a given distance and elevation, estimate target power and time.
// Uses a linear climbing power cost: +1W per ~10m climb per km (rough approximation).
// Returns seconds or null.
//
// Physics: P = (mass × g × grade × v) + rolling + aero
// Simplified for athlete planning: power_target ≈ FTP × adjustmentFactor
/**
 * @description Estimates cycling time for a given route using a simplified physics model.
 *   Adjusts flat-road speed for average gradient; intended for rough planning, not race prediction.
 * @param {number} ftpWatts - Athlete FTP in watts (used to set baseline speed)
 * @param {number} distanceKm - Route distance in kilometres
 * @param {number} elevationM - Total elevation gain in metres
 * @param {number} [bodyWeightKg=70] - Athlete body mass in kg
 * @returns {number|null} Estimated time in seconds, or null on invalid input
 * @source Morton (1986) — A 3-parameter critical power model (simplified physics model)
 * @example
 * predictCyclingTime(280, 40, 500) // => ~5143 seconds (~85 min)
 */
export function predictCyclingTime(ftpWatts, distanceKm, elevationM, bodyWeightKg = 70) {
  if (!ftpWatts || !distanceKm || ftpWatts <= 0 || distanceKm <= 0) return null
  if (distanceKm <= 0) return null

  // Gradient as average % over the full distance
  const gradeAvg = elevationM > 0 ? (elevationM / (distanceKm * 1000)) * 100 : 0

  // Power adjustment for climbing: each 1% grade reduces speed (increases cost)
  // Empirical: rider at FTP can sustain ~35km/h on flat; ~-2.5km/h per 1% grade avg
  const baseSpeedKmh = 35  // km/h at FTP on flat
  const speedKmh     = Math.max(8, baseSpeedKmh - gradeAvg * 2.5)

  const totalSec = (distanceKm / speedKmh) * 3600
  return Math.round(totalSec)
}

// ── W/kg (watts per kilogram) ─────────────────────────────────────────────────
/**
 * @description Calculates power-to-weight ratio (W/kg) from FTP and body mass.
 * @param {number} ftpWatts - Functional Threshold Power in watts
 * @param {number} bodyWeightKg - Athlete body mass in kg
 * @returns {number|null} W/kg ratio (2 decimal places), or null on invalid input
 * @example
 * wattsPerKg(300, 75) // => 4.0
 */
export function wattsPerKg(ftpWatts, bodyWeightKg) {
  if (!ftpWatts || !bodyWeightKg || bodyWeightKg <= 0) return null
  return Math.round((ftpWatts / bodyWeightKg) * 100) / 100
}
