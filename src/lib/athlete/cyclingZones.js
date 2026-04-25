// ─── src/lib/athlete/cyclingZones.js — FTP derivation + Coggan zone computation ─
import { getCyclingZones, wattsPerKg, predictCyclingTime } from '../sport/cycling.js'

/**
 * Derives FTP from profile.ftp or test results.
 * @param {Array<{id,date,testId,value:string,unit}>} testResults
 * @param {{ftp?:number|string, [key:string]:any}} profile
 * @returns {{ftpWatts:number, method:string}|null}
 */
export function getFTPFromData(testResults, profile) {
  // 1. profile.ftp takes precedence
  const profileFTP = parseFloat(profile?.ftp)
  if (profileFTP > 0) {
    return { ftpWatts: profileFTP, method: 'profile' }
  }

  // 2. derive from testResults
  if (!Array.isArray(testResults) || testResults.length === 0) return null

  // Priority order: ftp20, ramp_test, cp_test
  const SUPPORTED = ['ftp20', 'ramp_test', 'cp_test']

  // Filter to supported test IDs and sort descending by date (most recent first)
  const relevant = testResults
    .filter(r => SUPPORTED.includes(r?.testId) && r?.value != null)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  if (relevant.length === 0) return null

  const best = relevant[0]
  const raw  = parseFloat(best.value)
  if (!isFinite(raw) || raw <= 0) return null

  if (best.testId === 'ftp20') {
    return { ftpWatts: Math.round(raw * 0.95), method: 'ftp20' }
  }
  if (best.testId === 'ramp_test') {
    return { ftpWatts: Math.round(raw * 0.75), method: 'ramp' }
  }
  if (best.testId === 'cp_test') {
    return { ftpWatts: parseFloat(raw.toFixed(0)) === raw ? Math.round(raw) : raw, method: 'cp' }
  }

  return null
}

// ── Route predictions ─────────────────────────────────────────────────────────
const STANDARD_ROUTES = [
  { label: '40km TT',          distanceKm: 40,   elevationM: 200,  icon: '→' },
  { label: 'Gran Fondo 120km', distanceKm: 120,  elevationM: 1500, icon: '↑' },
  { label: 'Alpe (14km)',      distanceKm: 13.8, elevationM: 1148, icon: '▲' },
]

/**
 * Computes route time predictions for standard cycling routes using predictCyclingTime.
 * @param {number} ftpWatts
 * @param {number} [bodyWeightKg=70]
 * @returns {Array<{label:string, icon:string, timeStr:string, speedKmh:number, power:number}>}
 */
export function computeCyclingPredictions(ftpWatts, bodyWeightKg = 70) {
  if (!ftpWatts || ftpWatts <= 0) return []
  return STANDARD_ROUTES.map(route => {
    const result = predictCyclingTime(ftpWatts, route.distanceKm, route.elevationM, bodyWeightKg)
    // predictCyclingTime returns seconds (number) or null
    if (result == null) return null
    const timeSeconds = typeof result === 'object' ? result.timeSeconds : result
    if (!timeSeconds || timeSeconds <= 0) return null

    const h = Math.floor(timeSeconds / 3600)
    const m = Math.floor((timeSeconds % 3600) / 60)
    const s = Math.round(timeSeconds % 60)
    const timeStr = h > 0
      ? `${h}h ${String(m).padStart(2, '0')}m`
      : `${m}:${String(s).padStart(2, '0')}`

    // Derive speedKmh and power from the time and distance
    const speedKmh = typeof result === 'object' && result.speedKmh != null
      ? Math.round(result.speedKmh * 10) / 10
      : Math.round((route.distanceKm / (timeSeconds / 3600)) * 10) / 10
    const power = typeof result === 'object' && result.power != null
      ? Math.round(result.power)
      : Math.round(ftpWatts * 0.9) // approx TT power ≈ 90% FTP

    return {
      label: route.label,
      icon:  route.icon,
      timeStr,
      speedKmh,
      power,
    }
  }).filter(Boolean)
}

/**
 * Computes all 7 Coggan power zones plus W/kg for a given athlete.
 * @param {Array} testResults
 * @param {{ftp?:number|string, weight_kg?:number|string, weight?:number|string, [key:string]:any}} profile
 * @returns {{ftpWatts:number, zones:Array, wperkg:number|null, method:string}|null}
 */
export function computeCyclingZones(testResults, profile) {
  const ftpResult = getFTPFromData(testResults, profile)
  if (!ftpResult) return null

  const zones    = getCyclingZones(ftpResult.ftpWatts)
  const weightKg = parseFloat(profile?.weight_kg || profile?.weight || 0)
  const wperkg   = weightKg > 0 ? wattsPerKg(ftpResult.ftpWatts, weightKg) : null

  return {
    ftpWatts: ftpResult.ftpWatts,
    zones,
    wperkg,
    method: ftpResult.method,
  }
}
