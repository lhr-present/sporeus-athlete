import { describe, it, expect } from 'vitest'
import { computeSeasonStats, topSportByVolume, weekMonday } from '../../athlete/seasonStats.js'

// ─── Helpers ────────────────────────────────────────────────────────────────
const YEAR = 2024

function makeEntry(date, overrides = {}) {
  return {
    date,
    sport: 'running',
    distance: 10000, // 10 km in metres
    duration: 60,    // 60 min (< 600 so treated as minutes)
    tss: 80,
    rpe: 7,
    ...overrides,
  }
}

// ─── weekMonday ──────────────────────────────────────────────────────────────
describe('weekMonday', () => {
  it('returns Monday for a Wednesday date', () => {
    expect(weekMonday('2024-01-03')).toBe('2024-01-01') // Wed → Mon
  })

  it('returns same day for a Monday', () => {
    expect(weekMonday('2024-01-01')).toBe('2024-01-01')
  })

  it('returns Monday for a Sunday', () => {
    expect(weekMonday('2024-01-07')).toBe('2024-01-01') // Sun → Mon
  })
})

// ─── Empty log ───────────────────────────────────────────────────────────────
describe('computeSeasonStats — empty log', () => {
  it('returns skeleton with all zeros and no crash', () => {
    const result = computeSeasonStats([], YEAR)
    expect(result.year).toBe(YEAR)
    expect(result.totalSessions).toBe(0)
    expect(result.totalDistanceKm).toBe(0)
    expect(result.totalDurationMin).toBe(0)
    expect(result.totalTSS).toBe(0)
    expect(result.avgSessionsPerWeek).toBe(0)
    expect(result.sportBreakdown).toEqual([])
    expect(result.bestWeek).toBeNull()
    expect(result.longestSession).toBeNull()
    expect(result.currentStreak).toBe(0)
    expect(result.maxStreak).toBe(0)
    expect(result.activeWeeks).toBe(0)
    expect(result.totalWeeks).toBeGreaterThan(0)
  })
})

// ─── Year filtering ──────────────────────────────────────────────────────────
describe('computeSeasonStats — year filtering', () => {
  it('counts sessions in the correct year and excludes other years', () => {
    const log = [
      makeEntry('2024-03-01'),
      makeEntry('2024-06-15'),
      makeEntry('2023-12-31'), // different year — excluded
      makeEntry('2025-01-02'), // different year — excluded
    ]
    const result = computeSeasonStats(log, 2024)
    expect(result.totalSessions).toBe(2)
  })

  it('returns zero sessions when all entries are from other years', () => {
    const log = [makeEntry('2023-05-01'), makeEntry('2025-07-10')]
    const result = computeSeasonStats(log, 2024)
    expect(result.totalSessions).toBe(0)
    expect(result.sportBreakdown).toHaveLength(0)
  })
})

// ─── Sport breakdown ─────────────────────────────────────────────────────────
describe('computeSeasonStats — sportBreakdown', () => {
  it('is sorted by sessions descending', () => {
    const log = [
      makeEntry('2024-01-01', { sport: 'cycling' }),
      makeEntry('2024-01-02', { sport: 'running' }),
      makeEntry('2024-01-03', { sport: 'running' }),
      makeEntry('2024-01-04', { sport: 'cycling' }),
      makeEntry('2024-01-05', { sport: 'cycling' }),
      makeEntry('2024-01-06', { sport: 'swimming' }),
    ]
    const result = computeSeasonStats(log, 2024)
    const sessions = result.sportBreakdown.map(s => s.sessions)
    for (let i = 0; i < sessions.length - 1; i++) {
      expect(sessions[i]).toBeGreaterThanOrEqual(sessions[i + 1])
    }
    expect(result.sportBreakdown[0].sport).toBe('cycling')
  })

  it('pct values sum to approximately 100 (allow ±1 for rounding)', () => {
    const log = [
      makeEntry('2024-01-01', { sport: 'running' }),
      makeEntry('2024-01-02', { sport: 'cycling' }),
      makeEntry('2024-01-03', { sport: 'swimming' }),
      makeEntry('2024-01-04', { sport: 'running' }),
    ]
    const result = computeSeasonStats(log, 2024)
    const sum = result.sportBreakdown.reduce((s, b) => s + b.pct, 0)
    expect(sum).toBeGreaterThanOrEqual(99)
    expect(sum).toBeLessThanOrEqual(101)
  })
})

// ─── Best week ───────────────────────────────────────────────────────────────
describe('computeSeasonStats — bestWeek', () => {
  it('returns the week with the highest TSS and correct weekStart', () => {
    const log = [
      makeEntry('2024-01-01', { tss: 50 }),  // week 2024-01-01
      makeEntry('2024-01-08', { tss: 200 }), // week 2024-01-08 — highest
      makeEntry('2024-01-09', { tss: 150 }), // same week 2024-01-08
      makeEntry('2024-01-15', { tss: 80 }),  // week 2024-01-15
    ]
    const result = computeSeasonStats(log, 2024)
    expect(result.bestWeek).not.toBeNull()
    expect(result.bestWeek.tss).toBe(350)
    expect(result.bestWeek.weekStart).toBe('2024-01-08')
  })
})

// ─── Longest session ─────────────────────────────────────────────────────────
describe('computeSeasonStats — longestSession', () => {
  it('returns the entry with the maximum durationMin', () => {
    const log = [
      makeEntry('2024-02-01', { duration: 45, sport: 'cycling', distance: 30000 }),
      makeEntry('2024-02-02', { duration: 120, sport: 'running', distance: 20000 }),
      makeEntry('2024-02-03', { duration: 30, sport: 'swimming', distance: 1000 }),
    ]
    const result = computeSeasonStats(log, 2024)
    expect(result.longestSession).not.toBeNull()
    expect(result.longestSession.durationMin).toBe(120)
    expect(result.longestSession.sport).toBe('running')
    expect(result.longestSession.date).toBe('2024-02-02')
  })
})

// ─── currentStreak ───────────────────────────────────────────────────────────
describe('computeSeasonStats — currentStreak', () => {
  it('counts 3 consecutive days ending today as streak 3', () => {
    const today = new Date().toISOString().slice(0, 10)
    const year = parseInt(today.slice(0, 4), 10)
    const d1 = new Date(today + 'T00:00:00Z')
    d1.setUTCDate(d1.getUTCDate() - 2)
    const d2 = new Date(today + 'T00:00:00Z')
    d2.setUTCDate(d2.getUTCDate() - 1)
    const log = [
      makeEntry(d1.toISOString().slice(0, 10)),
      makeEntry(d2.toISOString().slice(0, 10)),
      makeEntry(today),
    ]
    const result = computeSeasonStats(log, year)
    expect(result.currentStreak).toBe(3)
  })

  it('breaks streak at a gap in the log', () => {
    const today = new Date().toISOString().slice(0, 10)
    const year = parseInt(today.slice(0, 4), 10)
    // sessions today and 3 days ago (gap yesterday and 2 days ago)
    const d3ago = new Date(today + 'T00:00:00Z')
    d3ago.setUTCDate(d3ago.getUTCDate() - 3)
    const log = [
      makeEntry(d3ago.toISOString().slice(0, 10)),
      makeEntry(today),
    ]
    const result = computeSeasonStats(log, year)
    expect(result.currentStreak).toBe(1)
  })
})

// ─── maxStreak ───────────────────────────────────────────────────────────────
describe('computeSeasonStats — maxStreak', () => {
  it('finds the longest consecutive-day streak in the year', () => {
    const log = [
      makeEntry('2024-03-01'),
      makeEntry('2024-03-02'),
      makeEntry('2024-03-03'), // streak of 3
      makeEntry('2024-03-10'), // isolated
      makeEntry('2024-03-11'),
      makeEntry('2024-03-12'),
      makeEntry('2024-03-13'), // streak of 4
    ]
    const result = computeSeasonStats(log, 2024)
    expect(result.maxStreak).toBe(4)
  })
})

// ─── avgSessionsPerWeek ──────────────────────────────────────────────────────
describe('computeSeasonStats — avgSessionsPerWeek', () => {
  it('equals totalSessions / totalWeeks within rounding', () => {
    const log = [
      makeEntry('2024-01-01'),
      makeEntry('2024-01-08'),
      makeEntry('2024-01-15'),
    ]
    const result = computeSeasonStats(log, 2024)
    const expected = parseFloat((result.totalSessions / result.totalWeeks).toFixed(1))
    expect(result.avgSessionsPerWeek).toBe(expected)
  })
})

// ─── distance unit conversion ─────────────────────────────────────────────────
describe('computeSeasonStats — distance conversion', () => {
  it('converts distance from metres to km (distance/1000)', () => {
    const log = [makeEntry('2024-04-01', { distance: 21097 })] // half marathon in metres
    const result = computeSeasonStats(log, 2024)
    expect(result.totalDistanceKm).toBeCloseTo(21.1, 0)
    expect(result.sportBreakdown[0].distanceKm).toBeCloseTo(21.1, 0)
  })

  it('uses 0 distanceKm for entries with distance <= 0', () => {
    const log = [makeEntry('2024-04-02', { distance: 0 })]
    const result = computeSeasonStats(log, 2024)
    expect(result.totalDistanceKm).toBe(0)
  })
})

// ─── duration stored in seconds ──────────────────────────────────────────────
describe('computeSeasonStats — duration normalization', () => {
  it('converts seconds to minutes when duration > 600 (stored in seconds)', () => {
    const log = [makeEntry('2024-05-01', { duration: 3600 })] // 3600s = 60 min
    const result = computeSeasonStats(log, 2024)
    expect(result.totalDurationMin).toBe(60)
  })

  it('keeps value as minutes when duration <= 600', () => {
    const log = [makeEntry('2024-05-02', { duration: 90 })] // 90 min
    const result = computeSeasonStats(log, 2024)
    expect(result.totalDurationMin).toBe(90)
  })
})

// ─── topSportByVolume ────────────────────────────────────────────────────────
describe('topSportByVolume', () => {
  it('returns sport with highest distanceKm', () => {
    const stats = {
      sportBreakdown: [
        { sport: 'running', sessions: 3, distanceKm: 30, durationMin: 180, pct: 60 },
        { sport: 'cycling', sessions: 2, distanceKm: 80, durationMin: 120, pct: 40 },
      ],
    }
    expect(topSportByVolume(stats)).toBe('cycling')
  })

  it('falls back to highest sessions when all distanceKm are 0', () => {
    const stats = {
      sportBreakdown: [
        { sport: 'running', sessions: 5, distanceKm: 0, durationMin: 300, pct: 71.4 },
        { sport: 'cycling', sessions: 2, distanceKm: 0, durationMin: 120, pct: 28.6 },
      ],
    }
    expect(topSportByVolume(stats)).toBe('running')
  })

  it('returns general when sportBreakdown is empty', () => {
    const stats = computeSeasonStats([], YEAR)
    expect(topSportByVolume(stats)).toBe('general')
  })

  it('returns general when called with null/undefined stats', () => {
    expect(topSportByVolume(null)).toBe('general')
    expect(topSportByVolume(undefined)).toBe('general')
  })
})
