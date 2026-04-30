// ─── runningRaceReadiness.test.js — E45: 24 tests ────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  parseGoalDistanceM,
  peakWeeklyRunVolumeM,
  computeRunningRaceReadiness,
} from '../../athlete/runningRaceReadiness.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const TODAY = '2026-04-30'

function daysAgo(n) {
  const d = new Date(TODAY)
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function makeRunLog(count = 10, distanceM = 8000, durationMin = 45) {
  return Array.from({ length: count }, (_, i) => ({
    type: 'run',
    distanceM,
    duration: durationMin,
    date: daysAgo(i * 3),
    tss: 55,
  }))
}

// ─── 1. parseGoalDistanceM ─────────────────────────────────────────────────────
describe('parseGoalDistanceM', () => {
  it('returns 10000 for null / undefined (default)', () => {
    expect(parseGoalDistanceM(null)).toBe(10000)
    expect(parseGoalDistanceM(undefined)).toBe(10000)
    expect(parseGoalDistanceM('')).toBe(10000)
  })

  it('returns 42195 for marathon goal', () => {
    expect(parseGoalDistanceM('marathon')).toBe(42195)
    expect(parseGoalDistanceM('run a marathon')).toBe(42195)
  })

  it('returns 21097 for half marathon goal', () => {
    expect(parseGoalDistanceM('half marathon')).toBe(21097)
    expect(parseGoalDistanceM('21k')).toBe(21097)
  })

  it('returns 10000 for 10K goal', () => {
    expect(parseGoalDistanceM('10k')).toBe(10000)
    expect(parseGoalDistanceM('10 k race')).toBe(10000)
  })

  it('returns 5000 for 5K goal', () => {
    expect(parseGoalDistanceM('5k')).toBe(5000)
    expect(parseGoalDistanceM('5 k fun run')).toBe(5000)
  })

  it('returns 3000 for 3K goal', () => {
    expect(parseGoalDistanceM('3k')).toBe(3000)
  })

  it('returns 1000 for 1K goal', () => {
    expect(parseGoalDistanceM('1k')).toBe(1000)
  })

  it('defaults to 10000 for unknown goal string', () => {
    expect(parseGoalDistanceM('yoga challenge')).toBe(10000)
  })
})

// ─── 2. peakWeeklyRunVolumeM ──────────────────────────────────────────────────
describe('peakWeeklyRunVolumeM', () => {
  it('returns 0 for empty log', () => {
    expect(peakWeeklyRunVolumeM([], TODAY)).toBe(0)
  })

  it('returns 0 when no run sessions in log', () => {
    const bike = [{ type: 'bike', distanceM: 30000, duration: 60, date: daysAgo(3) }]
    expect(peakWeeklyRunVolumeM(bike, TODAY)).toBe(0)
  })

  it('returns 0 for runs outside 12-week window', () => {
    const old = [{ type: 'run', distanceM: 8000, duration: 45, date: '2020-01-01' }]
    expect(peakWeeklyRunVolumeM(old, TODAY)).toBe(0)
  })

  it('returns total distance when all runs in same month-bucket', () => {
    const log = [
      { type: 'run', distanceM: 10000, duration: 60, date: daysAgo(1) },
      { type: 'run', distanceM: 8000,  duration: 50, date: daysAgo(3) },
    ]
    const result = peakWeeklyRunVolumeM(log, TODAY)
    expect(result).toBe(18000)
  })

  it('detects runs via sport field', () => {
    const log = [{ sport: 'running', distanceM: 10000, duration: 55, date: daysAgo(2) }]
    const result = peakWeeklyRunVolumeM(log, TODAY)
    expect(result).toBeGreaterThan(0)
  })

  it('uses the today param correctly (old date excluded)', () => {
    // A session 200 days before TODAY is outside the 84-day window
    const d = new Date(TODAY)
    d.setDate(d.getDate() - 200)
    const veryOldLog = [{ type: 'run', distanceM: 5000, duration: 30, date: d.toISOString().slice(0, 10) }]
    const result = peakWeeklyRunVolumeM(veryOldLog, TODAY)
    expect(result).toBe(0)
  })
})

// ─── 3. computeRunningRaceReadiness ───────────────────────────────────────────
describe('computeRunningRaceReadiness', () => {
  it('returns null with fewer than 3 run sessions', () => {
    const log = makeRunLog(2)
    expect(computeRunningRaceReadiness(log, {}, TODAY)).toBeNull()
  })

  it('returns null when no run sessions at all', () => {
    expect(computeRunningRaceReadiness([], {}, TODAY)).toBeNull()
  })

  it('returns result shape for a valid log', () => {
    const log = makeRunLog(10)
    const result = computeRunningRaceReadiness(log, { goal: '10k' }, TODAY)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('score')
    expect(result).toHaveProperty('flags')
    expect(result).toHaveProperty('targetDistanceM', 10000)
    expect(result).toHaveProperty('peakWeeklyVolM')
    expect(result).toHaveProperty('daysToRace')
    expect(result).toHaveProperty('runSessionCount')
  })

  it('score is a number between 0 and 100', () => {
    const log = makeRunLog(10)
    const result = computeRunningRaceReadiness(log, {}, TODAY)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('daysToRace is computed correctly from nextRaceDate', () => {
    const log = makeRunLog(10)
    const profile = { nextRaceDate: '2026-05-30' }
    const result = computeRunningRaceReadiness(log, profile, TODAY)
    // 2026-05-30 minus 2026-04-30 = 30 days
    expect(result.daysToRace).toBe(30)
  })

  it('daysToRace is null when no race date', () => {
    const log = makeRunLog(10)
    const result = computeRunningRaceReadiness(log, {}, TODAY)
    expect(result.daysToRace).toBeNull()
  })

  it('flags is an array', () => {
    const log = makeRunLog(10)
    const result = computeRunningRaceReadiness(log, {}, TODAY)
    expect(Array.isArray(result.flags)).toBe(true)
  })

  it('runSessionCount equals number of run sessions', () => {
    const log = makeRunLog(8)
    const result = computeRunningRaceReadiness(log, {}, TODAY)
    expect(result.runSessionCount).toBe(8)
  })
})
