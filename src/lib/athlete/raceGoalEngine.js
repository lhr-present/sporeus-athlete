// src/lib/athlete/raceGoalEngine.js — E80
// Derives all scientific training parameters from current + goal race performance.
// Non-measurable values are explicitly labeled PREDICTED / CALCULATED / DERIVED.
//
// References:
//   Daniels J. & Gilbert J. (1979). Oxygen Power.
//   Daniels J. (2014). Daniels' Running Formula, 3rd ed. Human Kinetics.
//   Tanaka H. et al. (2001). Age-predicted maximal HR revisited. JACC 37:153–156.
//   Gabbett T.J. (2016). ACWR and injury risk. BJSM 50:273–280.
import { vdotFromRace, predictRaceTime, trainingPaces } from '../sport/running.js'
import { calculatePMC } from '../trainingLoad.js'
import { fmtSec } from '../formulas.js'

const DISTANCE_LABELS = {
  5000:  '5K',
  10000: '10K',
  21097: 'Half Marathon',
  42195: 'Marathon',
}

function fmtPaceStr(secPerKm) {
  if (!secPerKm || secPerKm <= 0) return '—'
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

// Parse "MM:SS" or "H:MM:SS" → total seconds
export function parseMmSs(str) {
  if (!str) return NaN
  const parts = String(str).trim().split(':').map(Number)
  if (parts.some(isNaN)) return NaN
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return NaN
}

// Typical VDOT gain per 12-week block (Daniels 2014 ch.3 progression tables).
// Novice runners improve fastest; highly trained plateau.
function vdotGainPerBlock(vdot) {
  if (vdot < 35) return 3.5
  if (vdot < 45) return 2.5
  if (vdot < 55) return 1.5
  return 0.8
}

/**
 * Analyzes a race goal and returns all derived scientific parameters.
 * @param {number} currentTimeSec  Current race finish time in seconds
 * @param {number} goalTimeSec     Goal race finish time (must be faster than current)
 * @param {number} distanceM       Race distance in metres (default 10000)
 * @param {Object} profile         Athlete profile (age, maxhr, lthr, etc.)
 * @param {Array}  log             Training log (for CTL context)
 * @returns {Object|null}
 */
export function analyzeRaceGoal(
  currentTimeSec, goalTimeSec, distanceM = 10000, profile = {}, log = []
) {
  if (!currentTimeSec || !goalTimeSec || currentTimeSec <= 0 || goalTimeSec <= 0) return null
  if (goalTimeSec >= currentTimeSec) return null

  const currentVdot = vdotFromRace(distanceM, currentTimeSec)
  const goalVdot    = vdotFromRace(distanceM, goalTimeSec)
  if (!currentVdot || !goalVdot) return null

  const vdotGap      = Math.round((goalVdot - currentVdot) * 10) / 10
  const gainRate     = vdotGainPerBlock(currentVdot)
  const blocksNeeded = Math.max(1, Math.ceil(vdotGap / gainRate))
  const weeksToGoal  = blocksNeeded * 12

  const feasibility =
    vdotGap <= 3  ? 'achievable' :
    vdotGap <= 7  ? 'ambitious'  :
    vdotGap <= 12 ? 'stretch'    : 'extreme'

  const currentPacesRaw = trainingPaces(currentVdot)
  const goalPacesRaw    = trainingPaces(goalVdot)

  const formatPaces = raw => raw ? {
    E: fmtPaceStr(raw.E), M: fmtPaceStr(raw.M),
    T: fmtPaceStr(raw.T), I: fmtPaceStr(raw.I), R: fmtPaceStr(raw.R),
  } : null

  const currentPaces = formatPaces(currentPacesRaw)
  const goalPaces    = formatPaces(goalPacesRaw)

  // Physiological parameters — measured > calculated > predicted (in priority)
  const predicted = {}
  const age      = profile?.age   ? parseFloat(profile.age)   : null
  const hasMaxHR = profile?.maxhr && parseInt(profile.maxhr)  > 0
  const hasLTHR  = profile?.lthr  && parseInt(profile.lthr)   > 0

  if (hasMaxHR) {
    predicted.maxHR = { value: parseInt(profile.maxhr), label: 'MEASURED', method: 'from profile' }
  } else if (age) {
    predicted.maxHR = { value: Math.round(208 - 0.7 * age), label: 'PREDICTED', method: 'Tanaka 2001: 208−0.7×age' }
  }

  if (hasLTHR) {
    predicted.lthr = { value: parseInt(profile.lthr), label: 'MEASURED', method: 'from profile' }
  } else if (predicted.maxHR) {
    predicted.lthr = {
      value:  Math.round(predicted.maxHR.value * 0.87),
      label:  predicted.maxHR.label === 'MEASURED' ? 'CALCULATED' : 'PREDICTED',
      method: 'Friel: 87% maxHR = lactate threshold HR',
    }
  }

  if (predicted.maxHR) {
    predicted.thresholdHRRange = {
      low:    Math.round(predicted.maxHR.value * 0.88),
      high:   Math.round(predicted.maxHR.value * 0.92),
      label:  predicted.maxHR.label === 'MEASURED' ? 'CALCULATED' : 'PREDICTED',
      method: 'Coggan: 88–92% maxHR = threshold zone',
    }
  }

  if (currentPacesRaw?.T) {
    predicted.thresholdPace = {
      value:  fmtPaceStr(currentPacesRaw.T),
      label:  'DERIVED',
      method: 'Daniels T-pace = LT2 (lactate threshold pace)',
    }
  }

  // Weekly TSS target — CTL-based safe 5% ramp (Gabbett 2016 ACWR safety window)
  const pmc        = calculatePMC(log || [], 90, 0)
  const currentCTL = pmc.length ? Math.round(pmc[pmc.length - 1].ctl) : 0
  const safeWeeklyTSS = Math.round(Math.max(30, currentCTL > 0 ? currentCTL * 7 * 1.05 : 50))

  // Phase structure proportional to plan length
  const baseW  = Math.max(4, Math.round(weeksToGoal * 0.35))
  const buildW = Math.max(4, Math.round(weeksToGoal * 0.40))
  const peakW  = Math.max(2, Math.round(weeksToGoal * 0.15))
  const taperW = Math.max(2, weeksToGoal - baseW - buildW - peakW)

  const phases = [
    {
      name: 'Base',  tr: 'Taban',   weeks: baseW,
      tss: Math.round(safeWeeklyTSS * 0.80),
      en: `Easy aerobic runs at E-pace (${currentPaces?.E || '—'}). 1 long run/week. Build aerobic base.`,
      tr: `E-tempoda kolay koşu (${currentPaces?.E || '—'}). Haftada 1 uzun koşu. Aerobik taban inşası.`,
    },
    {
      name: 'Build', tr: 'Gelişim', weeks: buildW,
      tss: safeWeeklyTSS,
      en: `2×20 min at T-pace (${currentPaces?.T || '—'}). Marathon-pace long run. Quality twice/week.`,
      tr: `T-tempoda 2×20 dk (${currentPaces?.T || '—'}). Maraton-tempo uzun koşu. Haftada 2 kaliteli.`,
    },
    {
      name: 'Peak',  tr: 'Zirve',   weeks: peakW,
      tss: Math.round(safeWeeklyTSS * 1.10),
      en: `I-pace intervals (${currentPaces?.I || '—'}). Race-specific speed. Maximum load week.`,
      tr: `I-tempo aralıklar (${currentPaces?.I || '—'}). Yarış-spesifik hız. Maksimum yük haftası.`,
    },
    {
      name: 'Taper', tr: 'Azaltma', weeks: taperW,
      tss: Math.round(safeWeeklyTSS * 0.55),
      en: `Volume −40%. Keep 1 T-session. Race-simulation run. Arrive fresh.`,
      tr: `Hacim −%40. 1 T-seans koru. Yarış simülasyonu koşusu. Taze gir.`,
    },
  ]

  // VDOT checkpoints — one per 12-week block
  const checkpoints = []
  let runningVdot = currentVdot
  for (let b = 1; b <= blocksNeeded; b++) {
    runningVdot = Math.min(goalVdot, runningVdot + gainRate)
    const projTime = predictRaceTime(Math.round(runningVdot * 10) / 10, distanceM)
    checkpoints.push({
      block: b,
      weeks: b * 12,
      vdot:          Math.round(runningVdot * 10) / 10,
      projectedTime: projTime ? fmtSec(projTime) : '—',
    })
  }

  return {
    distanceM,
    distanceLabel:  DISTANCE_LABELS[distanceM] || `${(distanceM / 1000).toFixed(1)}K`,
    currentTimeSec, goalTimeSec,
    currentTimeStr: fmtSec(currentTimeSec),
    goalTimeStr:    fmtSec(goalTimeSec),
    currentVdot:    Math.round(currentVdot * 10) / 10,
    goalVdot:       Math.round(goalVdot * 10) / 10,
    vdotGap,
    weeksToGoal,
    feasibility,
    currentPaces,
    goalPaces,
    predicted,
    safeWeeklyTSS,
    currentCTL,
    phases,
    checkpoints,
  }
}
