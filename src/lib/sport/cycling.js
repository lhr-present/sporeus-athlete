// ─── src/lib/sport/cycling.js — Cycling sport-science engine ─────────────────
// Coggan FTP zones, CP model, TSS, power-duration prediction.

import { fitCP } from './rowing.js'  // reuse CP OLS regression

// ── FTP calculation ───────────────────────────────────────────────────────────
// Supports two methods:
//   CP model  — from 2+ maximal efforts [{ timeSec, powerW }]
//   20-min TT — FTP = power20min × 0.95 (Coggan standard)
// Returns { ftpWatts, method: 'CP' | '20min' | null } or null on invalid input.
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

// Returns zone number (1–7) for a given power relative to FTP.
export function getCyclingZone(powerW, ftpW) {
  if (!powerW || !ftpW || ftpW <= 0 || powerW < 0) return null
  const ratio = powerW / ftpW
  for (const z of COGGAN_ZONE_DEFS) {
    if (ratio >= z.pctMin && ratio < z.pctMax) return z.id
  }
  return 7  // > 150% FTP → neuromuscular
}

// Returns full zone table with watt boundaries for a given FTP.
export function getCyclingZones(ftpWatts) {
  if (!ftpWatts || ftpWatts <= 0) return []
  return COGGAN_ZONE_DEFS.map(z => ({
    ...z,
    minWatts: z.pctMin === 0     ? 0  : Math.round(ftpWatts * z.pctMin),
    maxWatts: z.pctMax === Infinity ? null : Math.round(ftpWatts * z.pctMax),
  }))
}

// ── Cycling TSS ───────────────────────────────────────────────────────────────
// Standard Coggan TSS using normalized power (NP) as a proxy for average power.
// TSS = (durationSec × NP × IF) / (FTP × 3600) × 100
// Simplified: IF = avgNormalizedPower / FTP, TSS = (durationSec/3600) × IF² × 100
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
export function wattsPerKg(ftpWatts, bodyWeightKg) {
  if (!ftpWatts || !bodyWeightKg || bodyWeightKg <= 0) return null
  return Math.round((ftpWatts / bodyWeightKg) * 100) / 100
}
