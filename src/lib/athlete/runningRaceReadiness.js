// ─── src/lib/athlete/runningRaceReadiness.js — Running race readiness wrapper (E45) ─
import { raceReadiness } from '../sport/running.js'

// Parse goal string → target distance in metres
export function parseGoalDistanceM(goal) {
  if (!goal) return 10000  // default 10K
  const g = goal.toLowerCase()
  if (g.includes('marathon') && !g.includes('half')) return 42195
  if (g.includes('half') || g.includes('21')) return 21097
  if (g.includes('10k') || g.includes('10 k')) return 10000
  if (g.includes('5k') || g.includes('5 k')) return 5000
  if (g.includes('3k')) return 3000
  if (g.includes('1k') || g.includes('1 m')) return 1000
  return 10000  // default
}

// Peak weekly run volume in last 12 weeks (metres)
export function peakWeeklyRunVolumeM(log, today = new Date().toISOString().slice(0,10)) {
  const cutoff = new Date(today)
  cutoff.setDate(cutoff.getDate() - 84)  // 12 weeks
  const runSessions = log.filter(e => {
    const isRun = /run/i.test(e.type || '') || /run/i.test(e.sport || '')
    const inWindow = e.date >= cutoff.toISOString().slice(0,10)
    return isRun && inWindow && (e.distanceM || 0) > 0
  })
  if (runSessions.length === 0) return 0
  // Group by ISO week string
  const weekMap = {}
  for (const s of runSessions) {
    const wk = s.date.slice(0, 7)  // YYYY-MM key (approximate weekly bucket)
    weekMap[wk] = (weekMap[wk] || 0) + (s.distanceM || 0)
  }
  return Math.max(...Object.values(weekMap))
}

// Compute running race readiness
export function computeRunningRaceReadiness(log, profile, today = new Date().toISOString().slice(0,10)) {
  const runSessions = log.filter(e =>
    /run/i.test(e.type || '') || /run/i.test(e.sport || ''))
  if (runSessions.length < 3) return null  // need at least some data

  const targetDistanceM  = parseGoalDistanceM(profile?.goal)
  const peakWeeklyVolM   = peakWeeklyRunVolumeM(log, today)

  let daysToRace = null
  const raceDate = profile?.nextRaceDate || profile?.raceDate
  if (raceDate) {
    const d = new Date(raceDate)
    const t = new Date(today)
    daysToRace = Math.round((d - t) / 86400000)
  }

  const result = raceReadiness({
    recentLog: runSessions,
    targetDistanceM,
    peakWeeklyVolM,
    daysToRace: daysToRace ?? 60,  // default if no race date
  })

  return {
    score: result.score,
    flags: result.flags,
    targetDistanceM,
    peakWeeklyVolM,
    daysToRace,
    runSessionCount: runSessions.length,
  }
}
