// ─── VO2max Progression ───────────────────────────────────────────────────────
// Builds per-week VO2max history from run log using estimateVO2maxTrend.
// Daniels 2013 · Lucia 2002

import { estimateVO2maxTrend } from '../vo2max.js'

// ── filterRunSessions ─────────────────────────────────────────────────────────
// Filter log to running sessions with usable data for VO2max estimation.
// A session is usable if: type includes 'run' (case-insensitive) AND hrAvg > 0 AND duration > 0
// Returns sorted oldest→newest.
export function filterRunSessions(log = []) {
  return (log || [])
    .filter(e =>
      e &&
      typeof e.type === 'string' &&
      e.type.toLowerCase().includes('run') &&
      (e.hrAvg || 0) > 0 &&
      (e.duration || 0) > 0
    )
    .sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0))
}

// ── weeklyRunStats ────────────────────────────────────────────────────────────
// Group run sessions by ISO week (Monday start), compute per-week median hrAvg and mean duration.
// Returns [{ isoWeek, sessionCount, medianHR, meanDurationMin }] sorted oldest→newest.
// Only includes weeks with >= 1 usable session.
export function weeklyRunStats(runSessions = []) {
  if (!runSessions || runSessions.length === 0) return []

  function isoWeek(dateStr) {
    const d = new Date(dateStr)
    const day = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - day)
    const y = d.getUTCFullYear()
    const jan1 = new Date(Date.UTC(y, 0, 1))
    return `${y}-W${String(Math.ceil((d - jan1) / 604800000)).padStart(2, '0')}`
  }

  const weekMap = {}
  for (const s of runSessions) {
    if (!s.date) continue
    const wk = isoWeek(s.date)
    if (!weekMap[wk]) weekMap[wk] = { isoWeek: wk, sessions: [] }
    weekMap[wk].sessions.push(s)
  }

  return Object.values(weekMap)
    .map(({ isoWeek: wk, sessions }) => {
      const hrs = sessions.map(s => s.hrAvg || 0).sort((a, b) => a - b)
      const mid = Math.floor(hrs.length / 2)
      const medianHR = hrs.length % 2 === 0
        ? (hrs[mid - 1] + hrs[mid]) / 2
        : hrs[mid]
      const meanDurationMin = sessions.reduce((acc, s) => acc + (s.duration || 0), 0) / sessions.length
      return {
        isoWeek: wk,
        sessionCount: sessions.length,
        medianHR: Math.round(medianHR * 10) / 10,
        meanDurationMin: Math.round(meanDurationMin * 10) / 10,
      }
    })
    .sort((a, b) => (a.isoWeek > b.isoWeek ? 1 : -1))
}

// ── buildVO2maxHistory ────────────────────────────────────────────────────────
// Build per-week VO2max estimates using estimateVO2maxTrend.
// Returns [] if runSessions.length < 5 (insufficient data).
// Slices to last `weeks` data points.
export function buildVO2maxHistory(runSessions = [], maxHR = 190, weeks = 8) {
  if (!runSessions || runSessions.length < 5) return []

  // estimateVO2maxTrend expects entries with date, type, duration, distance, hrAvg
  // Map hrAvg to the field name expected by estimateVO2maxTrend (avgHR)
  const mapped = runSessions.map(s => ({
    ...s,
    avgHR: s.avgHR !== undefined ? s.avgHR : s.hrAvg,
    distanceM: s.distanceM !== undefined ? s.distanceM : s.distance,
  }))

  const result = estimateVO2maxTrend(mapped, maxHR)
  return result.slice(-weeks)
}

// ── vo2maxTrendSlope ──────────────────────────────────────────────────────────
// OLS trend on an array of numeric vo2max values (assumed equally spaced weeks).
// Returns { slope, weeklyGain, improving: slope > 0.1, r2 }
// Returns null if values.length < 3
export function vo2maxTrendSlope(values = []) {
  if (!values || values.length < 3) return null

  const n = values.length
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, _sumY2 = 0

  for (let i = 0; i < n; i++) {
    sumX  += i
    sumY  += values[i]
    sumXY += i * values[i]
    sumX2 += i * i
    _sumY2 += values[i] * values[i]
  }

  const denom = n * sumX2 - sumX * sumX
  if (denom === 0) return null

  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n

  // R² calculation
  const yMean = sumY / n
  let ssTot = 0, ssRes = 0
  for (let i = 0; i < n; i++) {
    const yHat = slope * i + intercept
    ssTot += (values[i] - yMean) ** 2
    ssRes += (values[i] - yHat) ** 2
  }

  const r2 = ssTot === 0 ? 0 : Math.max(0, Math.min(1, 1 - ssRes / ssTot))

  return {
    slope:      Math.round(slope * 1000) / 1000,
    weeklyGain: Math.round(slope * 100) / 100,
    improving:  slope > 0.1,
    r2:         Math.round(r2 * 100) / 100,
  }
}

// ── computeVO2maxProgression ──────────────────────────────────────────────────
// Master function: returns full VO2max progression summary.
// Returns null if filterRunSessions(log).length < 5
export function computeVO2maxProgression(
  log = [],
  profile = {},
  _today = new Date().toISOString().slice(0, 10),
  weeks = 8
) {
  const runSessions = filterRunSessions(log)
  if (runSessions.length < 5) return null

  const maxHR = profile?.maxhr ? Number(profile.maxhr) : 190
  const history = buildVO2maxHistory(runSessions, maxHR, weeks)

  if (!history || history.length === 0) return null

  const values = history.map(h => h.vo2max)
  const trend = vo2maxTrendSlope(values)
  const currentVO2max = values[values.length - 1]

  return {
    history,
    trend,
    currentVO2max,
    maxHR,
    citation: 'Daniels 2013 · Lucia 2002',
  }
}
