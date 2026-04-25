// VDOT trajectory analysis and personal-best projection.
// Source: Daniels J. & Gilbert J. (1979) Oxygen Power: Performance Tables for Distance Runners. Tafnews Press.

import { vdotFromRace, predictRaceTime } from '../sport/running.js'

const CITATION = "Daniels J. & Gilbert J. (1979) Oxygen Power: Performance Tables for Distance Runners. Tafnews Press."

const STANDARD_DISTANCES = [
  { m: 5000,   label: '5K' },
  { m: 10000,  label: '10K' },
  { m: 21097,  label: 'Half Marathon' },
  { m: 42195,  label: 'Marathon' },
]

// Returns ISO week string e.g. "2024-W03" for deduplication
function isoWeek(dateStr) {
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return null
  // ISO week: Thursday-based, week 1 contains Jan 4
  const tmp = new Date(d)
  tmp.setHours(0, 0, 0, 0)
  // Set to nearest Thursday: current date + 4 - current day number
  tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7))
  const yearStart = new Date(tmp.getFullYear(), 0, 1)
  const weekNo = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7)
  return `${tmp.getFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

export function extractVdotHistory(log = [], testResults = []) {
  const points = []

  // Source 1: training log race entries
  for (const entry of log) {
    const sport = entry.sport_type || entry.sport || ''
    if (sport !== 'running') continue
    const distance = entry.distance || 0
    if (distance <= 0) continue
    let duration = entry.duration || 0
    if (duration <= 0) continue
    const isRace = entry.is_race === true || entry.sessionType === 'race' || entry.type === 'race'
    if (!isRace) continue
    // Convert minutes to seconds if needed
    const durationSec = duration <= 600 ? duration * 60 : duration
    const vdot = vdotFromRace(distance, durationSec)
    if (!vdot || vdot <= 0) continue
    const date = entry.date
    if (!date) continue
    points.push({ date, vdot, source: 'race_log' })
  }

  // Source 2: test results
  for (const entry of testResults) {
    const type = (entry.type || '').toLowerCase()
    const isVdotTest = type.includes('vdot') || type.includes('run') || type.includes('5k') || type.includes('10k')
    if (!isVdotTest) continue
    let vdot = null
    if (entry.vdot > 0) {
      vdot = entry.vdot
    } else if (entry.distance > 0 && entry.time > 0) {
      vdot = vdotFromRace(entry.distance, entry.time)
    }
    if (!vdot || vdot <= 0) continue
    const date = entry.date
    if (!date) continue
    points.push({ date, vdot, source: 'test_result' })
  }

  // Deduplicate by ISO week: keep highest VDOT per week
  const weekMap = new Map()
  for (const p of points) {
    const week = isoWeek(p.date)
    if (!week) continue
    if (!weekMap.has(week) || p.vdot > weekMap.get(week).vdot) {
      weekMap.set(week, p)
    }
  }

  if (weekMap.size < 2) return []

  // Sort oldest to newest
  const result = [...weekMap.values()].sort((a, b) => new Date(a.date) - new Date(b.date))
  return result
}

export function fitVdotTrend(history = []) {
  if (!history || history.length < 2) return null

  const t0 = new Date(history[0].date).getTime()
  const xs = history.map(p => (new Date(p.date).getTime() - t0) / 86400000) // days
  const ys = history.map(p => p.vdot)
  const n = xs.length

  const sumX  = xs.reduce((a, b) => a + b, 0)
  const sumY  = ys.reduce((a, b) => a + b, 0)
  const sumXX = xs.reduce((a, x) => a + x * x, 0)
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0)

  const denom = n * sumXX - sumX * sumX
  let slope, intercept
  if (Math.abs(denom) < 1e-12) {
    slope = 0
    intercept = sumY / n
  } else {
    slope = (n * sumXY - sumX * sumY) / denom
    intercept = (sumY - slope * sumX) / n
  }

  // R²
  const yMean  = sumY / n
  const SStot  = ys.reduce((a, y) => a + (y - yMean) ** 2, 0)
  const SSres  = xs.reduce((a, x, i) => a + (ys[i] - (intercept + slope * x)) ** 2, 0)
  let rSquared = SStot < 1e-12 ? 1 : 1 - SSres / SStot
  rSquared = Math.max(0, Math.min(1, rSquared))

  return {
    slope,
    intercept,
    rSquared,
    currentVdot: ys[ys.length - 1],
    weeklyGain: slope * 7,
    citation: CITATION,
  }
}

export function projectPBs(currentVdot, trend, distances = STANDARD_DISTANCES) {
  if (!currentVdot || !trend) return []

  const projectedVdot = currentVdot + trend.weeklyGain * 12

  return distances.map(d => {
    const currentTime_s   = predictRaceTime(currentVdot, d.m)
    const projectedTime_s = predictRaceTime(projectedVdot, d.m)
    const deltaSeconds    = currentTime_s !== null && projectedTime_s !== null
      ? currentTime_s - projectedTime_s
      : null
    const currentPace_s_per_km = currentTime_s !== null ? currentTime_s / (d.m / 1000) : null
    const weeksToPB = trend.slope <= 0 ? null : 0

    return {
      distanceM:          d.m,
      label:              d.label,
      currentTime_s,
      currentPace_s_per_km,
      projectedTime_s,
      deltaSeconds,
      weeksToPB,
      citation: CITATION,
    }
  })
}
