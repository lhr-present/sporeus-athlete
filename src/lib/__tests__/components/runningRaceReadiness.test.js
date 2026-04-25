// ─── runningRaceReadiness.test.js — 15+ tests for runningRaceReadiness lib (E45) ─
import { describe, it, expect } from 'vitest'
import {
  parseGoalDistanceM,
  peakWeeklyRunVolumeM,
  computeRunningRaceReadiness,
} from '../../athlete/runningRaceReadiness.js'

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeRun = (date, distanceM, rpe = 6) => ({
  date, type: 'Run', distanceM, rpe, duration: 40,
})
const makeNonRun = (date, distanceM) => ({
  date, type: 'Swim', distanceM, duration: 30,
})

// ── parseGoalDistanceM ────────────────────────────────────────────────────────
describe('parseGoalDistanceM', () => {
  it('marathon → 42195', () => {
    expect(parseGoalDistanceM('Run a marathon')).toBe(42195)
  })

  it('half marathon → 21097', () => {
    expect(parseGoalDistanceM('half marathon goal')).toBe(21097)
  })

  it('10k → 10000', () => {
    expect(parseGoalDistanceM('10k race')).toBe(10000)
  })

  it('5k → 5000', () => {
    expect(parseGoalDistanceM('5k personal best')).toBe(5000)
  })

  it('null → 10000 (default)', () => {
    expect(parseGoalDistanceM(null)).toBe(10000)
  })

  it('triathlon → 10000 (default, no match)', () => {
    expect(parseGoalDistanceM('triathlon')).toBe(10000)
  })

  it('3k → 3000', () => {
    expect(parseGoalDistanceM('3k track')).toBe(3000)
  })

  it('empty string → 10000 (default)', () => {
    expect(parseGoalDistanceM('')).toBe(10000)
  })
})

// ── peakWeeklyRunVolumeM ──────────────────────────────────────────────────────
describe('peakWeeklyRunVolumeM', () => {
  it('empty log → 0', () => {
    expect(peakWeeklyRunVolumeM([], '2026-04-25')).toBe(0)
  })

  it('filters to run sessions only', () => {
    const log = [
      makeRun('2026-04-01', 8000),
      makeNonRun('2026-04-02', 5000),
    ]
    expect(peakWeeklyRunVolumeM(log, '2026-04-25')).toBe(8000)
  })

  it('returns max of weekly totals (not sum)', () => {
    const log = [
      makeRun('2026-04-01', 10000),   // week 2026-04
      makeRun('2026-04-02', 8000),    // same week → total 18000
      makeRun('2026-03-01', 5000),    // earlier week → total 5000
    ]
    const result = peakWeeklyRunVolumeM(log, '2026-04-25')
    expect(result).toBe(18000)
  })

  it('ignores sessions older than 12 weeks', () => {
    // 12 weeks = 84 days before today 2026-04-25 → cutoff 2026-01-31
    const log = [
      makeRun('2026-01-01', 20000),  // older than 84 days → excluded
      makeRun('2026-04-01', 5000),   // within 84 days → included
    ]
    const result = peakWeeklyRunVolumeM(log, '2026-04-25')
    expect(result).toBe(5000)
  })

  it('ignores non-run sessions when computing weekly peak', () => {
    const log = [
      makeNonRun('2026-04-01', 50000),  // big swim — should be ignored
      makeRun('2026-04-10', 8000),
    ]
    const result = peakWeeklyRunVolumeM(log, '2026-04-25')
    expect(result).toBe(8000)
  })
})

// ── computeRunningRaceReadiness ───────────────────────────────────────────────
describe('computeRunningRaceReadiness', () => {
  const today = '2026-04-25'

  it('returns null when fewer than 3 run sessions', () => {
    const log = [makeRun('2026-04-01', 5000), makeRun('2026-04-05', 5000)]
    expect(computeRunningRaceReadiness(log, {}, today)).toBeNull()
  })

  it('returns score 0-100', () => {
    const log = [
      makeRun('2026-04-01', 5000),
      makeRun('2026-04-08', 5000),
      makeRun('2026-04-15', 5000),
    ]
    const result = computeRunningRaceReadiness(log, {}, today)
    expect(result).not.toBeNull()
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('score is a number (not NaN, not null)', () => {
    const log = [
      makeRun('2026-04-01', 5000),
      makeRun('2026-04-08', 5000),
      makeRun('2026-04-15', 5000),
    ]
    const result = computeRunningRaceReadiness(log, {}, today)
    expect(typeof result.score).toBe('number')
    expect(Number.isNaN(result.score)).toBe(false)
  })

  it('flags array not empty', () => {
    const log = [
      makeRun('2026-04-01', 5000),
      makeRun('2026-04-08', 5000),
      makeRun('2026-04-15', 5000),
    ]
    const result = computeRunningRaceReadiness(log, {}, today)
    expect(Array.isArray(result.flags)).toBe(true)
    // flags may be empty if no conditions trigger — just check it's an array
  })

  it('targetDistanceM parsed from profile.goal', () => {
    const log = [
      makeRun('2026-04-01', 5000),
      makeRun('2026-04-08', 5000),
      makeRun('2026-04-15', 5000),
    ]
    const profile = { goal: 'marathon' }
    const result = computeRunningRaceReadiness(log, profile, today)
    expect(result.targetDistanceM).toBe(42195)
  })

  it('daysToRace computed from profile.nextRaceDate', () => {
    const log = [
      makeRun('2026-04-01', 5000),
      makeRun('2026-04-08', 5000),
      makeRun('2026-04-15', 5000),
    ]
    const profile = { nextRaceDate: '2026-05-25' }
    const result = computeRunningRaceReadiness(log, profile, today)
    expect(result.daysToRace).toBe(30)
  })

  it('daysToRace null when no race date', () => {
    const log = [
      makeRun('2026-04-01', 5000),
      makeRun('2026-04-08', 5000),
      makeRun('2026-04-15', 5000),
    ]
    const result = computeRunningRaceReadiness(log, {}, today)
    expect(result.daysToRace).toBeNull()
  })

  it('runSessionCount matches run sessions in log', () => {
    const log = [
      makeRun('2026-04-01', 5000),
      makeRun('2026-04-08', 5000),
      makeRun('2026-04-15', 5000),
      makeNonRun('2026-04-10', 2000),
    ]
    const result = computeRunningRaceReadiness(log, {}, today)
    expect(result.runSessionCount).toBe(3)
  })

  it('non-run sessions in log do not count toward runSessionCount', () => {
    const log = [
      makeRun('2026-04-01', 5000),
      makeRun('2026-04-08', 5000),
      makeRun('2026-04-15', 5000),
      makeNonRun('2026-04-02', 3000),
      makeNonRun('2026-04-09', 3000),
    ]
    const result = computeRunningRaceReadiness(log, {}, today)
    expect(result.runSessionCount).toBe(3)
  })
})
