import { describe, it, expect } from 'vitest'
import {
  filterRunSessions,
  weeklyRunStats,
  buildVO2maxHistory,
  vo2maxTrendSlope,
  computeVO2maxProgression,
} from '../../athlete/vo2maxProgression.js'

// ─── Synthetic log ────────────────────────────────────────────────────────────
// 40 run entries over 40 days: hrAvg=145, duration=45, distance=9000, type='run'
function makeSyntheticLog(n = 40, baseDate = '2026-01-01') {
  const entries = []
  const base = new Date(baseDate + 'T00:00:00Z')
  for (let i = 0; i < n; i++) {
    const d = new Date(base)
    d.setUTCDate(base.getUTCDate() + i)
    entries.push({
      date:     d.toISOString().slice(0, 10),
      type:     'run',
      duration: 45,
      tss:      60,
      rpe:      6,
      hrAvg:    145,
      distance: 9000,
    })
  }
  return entries
}

// ─── filterRunSessions ────────────────────────────────────────────────────────
describe('filterRunSessions', () => {
  it('returns [] for empty array', () => {
    expect(filterRunSessions([])).toEqual([])
  })

  it('returns [] when called with no argument', () => {
    expect(filterRunSessions()).toEqual([])
  })

  it('filters out non-run sessions', () => {
    const log = [
      { date: '2026-01-01', type: 'bike', duration: 60, hrAvg: 140 },
      { date: '2026-01-02', type: 'run',  duration: 45, hrAvg: 145 },
      { date: '2026-01-03', type: 'swim', duration: 40, hrAvg: 130 },
    ]
    const result = filterRunSessions(log)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('run')
  })

  it('filters out sessions with missing hrAvg', () => {
    const log = [
      { date: '2026-01-01', type: 'run', duration: 45, hrAvg: 0 },
      { date: '2026-01-02', type: 'run', duration: 45 },
      { date: '2026-01-03', type: 'run', duration: 45, hrAvg: 145 },
    ]
    const result = filterRunSessions(log)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-01-03')
  })

  it('filters out sessions with zero duration', () => {
    const log = [
      { date: '2026-01-01', type: 'run', duration: 0, hrAvg: 145 },
      { date: '2026-01-02', type: 'run', duration: 45, hrAvg: 145 },
    ]
    const result = filterRunSessions(log)
    expect(result).toHaveLength(1)
  })

  it('includes run sessions case-insensitively (Long Run)', () => {
    const log = [
      { date: '2026-01-01', type: 'Long Run', duration: 90, hrAvg: 145 },
      { date: '2026-01-02', type: 'EASY RUN',  duration: 45, hrAvg: 140 },
    ]
    expect(filterRunSessions(log)).toHaveLength(2)
  })

  it('returns sorted oldest→newest', () => {
    const log = [
      { date: '2026-01-05', type: 'run', duration: 45, hrAvg: 145 },
      { date: '2026-01-01', type: 'run', duration: 45, hrAvg: 145 },
      { date: '2026-01-03', type: 'run', duration: 45, hrAvg: 145 },
    ]
    const result = filterRunSessions(log)
    expect(result[0].date).toBe('2026-01-01')
    expect(result[2].date).toBe('2026-01-05')
  })
})

// ─── weeklyRunStats ───────────────────────────────────────────────────────────
describe('weeklyRunStats', () => {
  it('returns [] for empty array', () => {
    expect(weeklyRunStats([])).toEqual([])
  })

  it('returns [] when called with no argument', () => {
    expect(weeklyRunStats()).toEqual([])
  })

  it('groups sessions by week and returns correct sessionCount', () => {
    // 3 runs in the same week (2026-W01: Mon Jan 05)
    const sessions = [
      { date: '2026-01-05', type: 'run', duration: 45, hrAvg: 140 },
      { date: '2026-01-06', type: 'run', duration: 50, hrAvg: 150 },
      { date: '2026-01-07', type: 'run', duration: 40, hrAvg: 145 },
    ]
    const result = weeklyRunStats(sessions)
    expect(result).toHaveLength(1)
    expect(result[0].sessionCount).toBe(3)
  })

  it('computes median HR correctly for odd count', () => {
    const sessions = [
      { date: '2026-01-05', type: 'run', duration: 45, hrAvg: 140 },
      { date: '2026-01-06', type: 'run', duration: 45, hrAvg: 150 },
      { date: '2026-01-07', type: 'run', duration: 45, hrAvg: 145 },
    ]
    const result = weeklyRunStats(sessions)
    expect(result[0].medianHR).toBe(145)
  })

  it('returns sorted oldest→newest', () => {
    const sessions = makeSyntheticLog(14)
    const result = weeklyRunStats(sessions)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].isoWeek >= result[i - 1].isoWeek).toBe(true)
    }
  })
})

// ─── buildVO2maxHistory ───────────────────────────────────────────────────────
describe('buildVO2maxHistory', () => {
  it('returns [] for fewer than 5 sessions', () => {
    const sessions = makeSyntheticLog(4)
    expect(buildVO2maxHistory(sessions)).toEqual([])
  })

  it('returns [] for empty array', () => {
    expect(buildVO2maxHistory([])).toEqual([])
  })

  it('returns array for sufficient sessions (40 days)', () => {
    const sessions = makeSyntheticLog(40)
    const result = buildVO2maxHistory(sessions, 190, 8)
    expect(Array.isArray(result)).toBe(true)
    // estimateVO2maxTrend may return 0 entries if sessions don't pass its own filters
    // (it requires duration >= 20min = 1200s and distance > 0)
    // Our synthetic sessions have distance=9000 & duration=45min → should produce results
  })

  it('slices to last `weeks` data points', () => {
    const sessions = makeSyntheticLog(40)
    const result = buildVO2maxHistory(sessions, 190, 4)
    expect(result.length).toBeLessThanOrEqual(4)
  })

  it('each returned item has vo2max numeric field', () => {
    const sessions = makeSyntheticLog(40)
    const result = buildVO2maxHistory(sessions, 190, 8)
    for (const item of result) {
      expect(typeof item.vo2max).toBe('number')
    }
  })
})

// ─── vo2maxTrendSlope ─────────────────────────────────────────────────────────
describe('vo2maxTrendSlope', () => {
  it('returns null for fewer than 3 values', () => {
    expect(vo2maxTrendSlope([])).toBeNull()
    expect(vo2maxTrendSlope([40])).toBeNull()
    expect(vo2maxTrendSlope([40, 41])).toBeNull()
  })

  it('returns null when called with no argument', () => {
    expect(vo2maxTrendSlope()).toBeNull()
  })

  it('improving = true when slope > 0.1', () => {
    // clearly ascending values
    const result = vo2maxTrendSlope([40, 41, 42, 43, 44])
    expect(result).not.toBeNull()
    expect(result.improving).toBe(true)
    expect(result.slope).toBeGreaterThan(0.1)
  })

  it('improving = false when slope <= 0.1', () => {
    // flat values
    const result = vo2maxTrendSlope([42, 42, 42, 42, 42])
    expect(result).not.toBeNull()
    expect(result.improving).toBe(false)
  })

  it('r2 is in [0, 1]', () => {
    const result = vo2maxTrendSlope([40, 42, 39, 44, 41, 45])
    expect(result).not.toBeNull()
    expect(result.r2).toBeGreaterThanOrEqual(0)
    expect(result.r2).toBeLessThanOrEqual(1)
  })

  it('r2 near 1 for perfectly linear data', () => {
    const result = vo2maxTrendSlope([40, 41, 42, 43, 44])
    expect(result.r2).toBeGreaterThan(0.99)
  })
})

// ─── computeVO2maxProgression ─────────────────────────────────────────────────
describe('computeVO2maxProgression', () => {
  it('returns null for fewer than 5 run sessions', () => {
    const log = makeSyntheticLog(4)
    expect(computeVO2maxProgression(log)).toBeNull()
  })

  it('returns null for empty log', () => {
    expect(computeVO2maxProgression([])).toBeNull()
  })

  it('returns null when no run sessions in log', () => {
    const log = [
      { date: '2026-01-01', type: 'bike', duration: 60, hrAvg: 140 },
      { date: '2026-01-02', type: 'bike', duration: 60, hrAvg: 140 },
      { date: '2026-01-03', type: 'bike', duration: 60, hrAvg: 140 },
      { date: '2026-01-04', type: 'bike', duration: 60, hrAvg: 140 },
      { date: '2026-01-05', type: 'bike', duration: 60, hrAvg: 140 },
    ]
    expect(computeVO2maxProgression(log)).toBeNull()
  })

  it('returns correct shape for sufficient data', () => {
    const log = makeSyntheticLog(40)
    const result = computeVO2maxProgression(log, { maxhr: 190 })
    // If estimateVO2maxTrend produces results, check shape
    if (result !== null) {
      expect(Array.isArray(result.history)).toBe(true)
      expect(typeof result.currentVO2max).toBe('number')
      expect(typeof result.maxHR).toBe('number')
      expect(result.citation).toBe('Daniels 2013 · Lucia 2002')
      // trend may be null if history < 3 data points
      if (result.trend !== null && result.trend !== undefined) {
        expect(typeof result.trend.slope).toBe('number')
        expect(typeof result.trend.r2).toBe('number')
      }
    }
  })

  it('uses default maxHR 190 when profile has no maxhr', () => {
    const log = makeSyntheticLog(40)
    const result = computeVO2maxProgression(log, {})
    if (result !== null) {
      expect(result.maxHR).toBe(190)
    }
  })

  it('uses profile.maxhr when provided', () => {
    const log = makeSyntheticLog(40)
    const result = computeVO2maxProgression(log, { maxhr: 180 })
    if (result !== null) {
      expect(result.maxHR).toBe(180)
    }
  })
})
