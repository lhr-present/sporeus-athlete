// ─── vdot.js — Daniels VDOT estimation and training paces ────────────────────
import table from '../data/vdotTable.json'

// ── Helpers ───────────────────────────────────────────────────────────────────

function secToMinSec(s) {
  const m = Math.floor(s / 60)
  const sec = String(Math.round(s % 60)).padStart(2, '0')
  return `${m}:${sec}`
}

// Peter Riegel race time model: T2 = T1 × (D2/D1)^1.06
function riegelTime(knownDistM, knownTimeS, targetDistM) {
  return knownTimeS * Math.pow(targetDistM / knownDistM, 1.06)
}

// ── Core lookup ───────────────────────────────────────────────────────────────

// Estimate VDOT from a race result using Daniels table interpolation.
// distanceM: race distance in metres, timeS: finish time in seconds.
export function estimateVDOT(distanceM, timeS) {
  if (!distanceM || !timeS || timeS <= 0) return null

  // Map known distances to table keys
  const DIST_MAP = [
    { key: '5k',          m: 5000 },
    { key: '10k',         m: 10000 },
    { key: 'halfMarathon',m: 21097 },
    { key: 'marathon',    m: 42195 },
  ]

  // Find closest race distance key (within 20%)
  const closest = DIST_MAP.reduce((best, d) => {
    const diff = Math.abs(d.m - distanceM)
    return diff < Math.abs(best.m - distanceM) ? d : best
  }, DIST_MAP[0])

  // Convert actual distance to equivalent time at closest standard distance
  const equivTimeS = closest.m === distanceM
    ? timeS
    : riegelTime(distanceM, timeS, closest.m)

  // Binary search through table for matching VDOT
  for (let i = 0; i < table.length - 1; i++) {
    const curr = table[i].raceTimes[closest.key]
    const next = table[i + 1].raceTimes[closest.key]
    if (equivTimeS <= curr && equivTimeS >= next) {
      // Linear interpolation
      const frac = (curr - equivTimeS) / (curr - next)
      return Math.round((table[i].vdot + frac) * 10) / 10
    }
  }

  // Out of range
  if (equivTimeS > table[0].raceTimes[closest.key]) return table[0].vdot
  return table[table.length - 1].vdot
}

// Return training paces (sec/km) for a given VDOT.
export function getTrainingPaces(vdot) {
  if (!vdot) return null

  const clamped = Math.max(30, Math.min(85, vdot))
  const lower   = Math.floor(clamped)
  const upper   = Math.ceil(clamped)
  const frac    = clamped - lower

  const rowLow  = table.find(r => r.vdot === lower) || table[0]
  const rowHigh = table.find(r => r.vdot === upper) || table[table.length - 1]

  const interp = key => Math.round(rowLow.paces[key] + frac * (rowHigh.paces[key] - rowLow.paces[key]))

  return {
    easy:      interp('easy'),
    marathon:  interp('marathon'),
    threshold: interp('threshold'),
    interval:  interp('interval'),
    rep:       interp('rep'),
  }
}

// Predict finish time (seconds) for a target distance using VDOT table.
export function predictTime(vdot, targetDistanceM) {
  if (!vdot || !targetDistanceM) return null

  const STANDARD = [
    { key: '5k', m: 5000 },
    { key: '10k', m: 10000 },
    { key: 'halfMarathon', m: 21097 },
    { key: 'marathon', m: 42195 },
  ]

  // Exact match in table
  const exact = STANDARD.find(d => Math.abs(d.m - targetDistanceM) < 100)
  const clamped = Math.max(30, Math.min(85, vdot))
  const lower   = Math.floor(clamped)
  const upper   = Math.ceil(clamped)
  const frac    = clamped - lower
  const rowLow  = table.find(r => r.vdot === lower) || table[0]
  const rowHigh = table.find(r => r.vdot === upper) || table[table.length - 1]

  if (exact) {
    const t = rowLow.raceTimes[exact.key] + frac * (rowHigh.raceTimes[exact.key] - rowLow.raceTimes[exact.key])
    return Math.round(t)
  }

  // Non-standard distance: use Riegel from 10k equivalent
  const t10k = rowLow.raceTimes['10k'] + frac * (rowHigh.raceTimes['10k'] - rowLow.raceTimes['10k'])
  return Math.round(riegelTime(10000, t10k, targetDistanceM))
}
