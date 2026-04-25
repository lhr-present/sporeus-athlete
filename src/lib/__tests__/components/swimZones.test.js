// ─── swimZones.test.js — 15+ tests for bestSwimPace + computeSwimZones + fmtPaceSecKm + recentSwimTSS ──
import { describe, it, expect } from 'vitest'
import { bestSwimPace, computeSwimZones, fmtPaceSecKm, recentSwimTSS } from '../../athlete/swimZones.js'

// ── Helpers ──────────────────────────────────────────────────────────────────
const makeSwim = (id, date, distanceM, durationMin) => ({
  id, date, type: 'Swim', distanceM, duration: durationMin,
})
const makeRunSession = (id, date) => ({
  id, date, type: 'Run', distanceM: 10000, duration: 60,
})

// ── sessionPaceSecPer100m (tested via bestSwimPace) ──────────────────────────
// We expose internal behaviour through bestSwimPace by passing single-item logs.

describe('sessionPaceSecPer100m (via bestSwimPace)', () => {
  it('correct pace from valid session: 1000m in 15min → 90 sec/100m', () => {
    // pace = (15*60) / (1000/100) = 900/10 = 90
    const result = bestSwimPace([makeSwim('a', '2026-04-01', 1000, 15)])
    expect(result?.secPer100m).toBe(90)
  })

  it('null when distanceM=0', () => {
    const result = bestSwimPace([makeSwim('a', '2026-04-01', 0, 15)])
    expect(result).toBeNull()
  })

  it('null when distanceM is missing', () => {
    const result = bestSwimPace([{ id: 'a', date: '2026-04-01', type: 'Swim', duration: 15 }])
    expect(result).toBeNull()
  })

  it('null when duration=0', () => {
    const result = bestSwimPace([makeSwim('a', '2026-04-01', 1000, 0)])
    expect(result).toBeNull()
  })

  it('null when pace <40 (sanity fail — distance too large relative to time)', () => {
    // pace = (1 * 60) / (500 / 100) = 60 / 5 = 12 sec/100m → below 40, rejected
    const result = bestSwimPace([makeSwim('a', '2026-04-01', 500, 1)])
    expect(result).toBeNull()
  })

  it('null when pace >300 (sanity fail — too slow)', () => {
    // pace = (100 * 60) / (100 / 100) = 6000 / 1 = 6000 sec/100m → rejected
    const result = bestSwimPace([makeSwim('a', '2026-04-01', 100, 100)])
    expect(result).toBeNull()
  })
})

// ── bestSwimPace ──────────────────────────────────────────────────────────────
describe('bestSwimPace', () => {
  it('returns fastest (lowest sec/100m) from multiple swim sessions', () => {
    const log = [
      makeSwim('a', '2026-03-01', 1000, 16),  // pace = 96 s/100m (slower)
      makeSwim('b', '2026-04-01', 1000, 15),  // pace = 90 s/100m (faster)
      makeSwim('c', '2026-02-01', 1000, 18),  // pace = 108 s/100m (slowest)
    ]
    const result = bestSwimPace(log)
    expect(result?.secPer100m).toBe(90)
    expect(result?.sessionDate).toBe('2026-04-01')
  })

  it('null when log is empty', () => {
    expect(bestSwimPace([])).toBeNull()
  })

  it('null when no swim sessions', () => {
    const log = [makeRunSession('r1', '2026-04-01'), makeRunSession('r2', '2026-03-01')]
    expect(bestSwimPace(log)).toBeNull()
  })

  it('null when all swim sessions missing distanceM', () => {
    const log = [
      { id: 'a', date: '2026-04-01', type: 'Swim', duration: 30 },
      { id: 'b', date: '2026-04-02', type: 'Swim', duration: 45 },
    ]
    expect(bestSwimPace(log)).toBeNull()
  })

  it('non-swim sessions filtered out — only swim sessions count', () => {
    const log = [
      makeRunSession('r1', '2026-04-01'),
      makeSwim('s1', '2026-04-02', 1500, 22.5), // pace = 90
    ]
    const result = bestSwimPace(log)
    expect(result?.secPer100m).toBe(90)
    expect(result?.distanceM).toBe(1500)
  })

  it('detects swim session by sport field (not just type)', () => {
    const log = [{ id: 'a', date: '2026-04-01', sport: 'Open Water Swimming', distanceM: 1000, duration: 15 }]
    const result = bestSwimPace(log)
    expect(result?.secPer100m).toBe(90)
  })

  it('returns correct distanceM and durationMin on best session', () => {
    const log = [makeSwim('a', '2026-04-01', 2000, 30)] // 90 s/100m
    const result = bestSwimPace(log)
    expect(result?.distanceM).toBe(2000)
    expect(result?.durationMin).toBe(30)
  })
})

// ── computeSwimZones ──────────────────────────────────────────────────────────
describe('computeSwimZones', () => {
  it('null when log is empty', () => {
    expect(computeSwimZones([])).toBeNull()
  })

  it('null when no valid swim sessions', () => {
    const log = [makeRunSession('r1', '2026-04-01')]
    expect(computeSwimZones(log)).toBeNull()
  })

  it('returns cssSecPer100m, zones, and sessionsScanned', () => {
    const log = [makeSwim('s1', '2026-04-01', 1000, 15)] // 90 s/100m
    const result = computeSwimZones(log)
    expect(result).not.toBeNull()
    expect(result.cssSecPer100m).toBe(90)
    expect(result.sessionsScanned).toBe(1)
    expect(Array.isArray(result.zones)).toBe(true)
  })

  it('zones has 6 entries', () => {
    const log = [makeSwim('s1', '2026-04-01', 1000, 15)]
    const result = computeSwimZones(log)
    expect(result?.zones).toHaveLength(6)
  })

  it('zone paceMin/paceMax are in correct sec/100m values for CSS=90', () => {
    // CSS = 90 s/100m
    // Z2 Aerobic: pctMin=1.10 → paceMin=99.0, pctMax=1.20 → paceMax=108.0
    const log = [makeSwim('s1', '2026-04-01', 1000, 15)]
    const result = computeSwimZones(log)
    const z2 = result?.zones.find(z => z.id === 2)
    expect(z2?.paceMin).toBeCloseTo(99, 0)
    expect(z2?.paceMax).toBeCloseTo(108, 0)
  })

  it('Z1 Recovery has null paceMax (no upper limit — slower than 120% CSS)', () => {
    const log = [makeSwim('s1', '2026-04-01', 1000, 15)]
    const result = computeSwimZones(log)
    const z1 = result?.zones.find(z => z.id === 1)
    expect(z1?.paceMax).toBeNull()
  })

  it('bestDate is set from best session date', () => {
    const log = [
      makeSwim('a', '2026-03-01', 1000, 16),
      makeSwim('b', '2026-04-01', 1000, 15), // fastest
    ]
    const result = computeSwimZones(log)
    expect(result?.bestDate).toBe('2026-04-01')
  })

  it('sessionsScanned counts only swim sessions', () => {
    const log = [
      makeSwim('s1', '2026-04-01', 1000, 15),
      makeSwim('s2', '2026-03-01', 1000, 16),
      makeRunSession('r1', '2026-04-02'),
    ]
    const result = computeSwimZones(log)
    expect(result?.sessionsScanned).toBe(2)
  })
})

// ── recentSwimTSS ─────────────────────────────────────────────────────────────

describe('recentSwimTSS', () => {
  // today anchor for deterministic tests
  const today = '2026-04-25'

  // Swim session 5 days before today — within 14-day window
  const recentSwim = {
    id: 's1', date: '2026-04-20', type: 'Swim',
    duration: 30, distanceM: 1500,  // pace = (30*60)/(1500/100) = 1800/15 = 120 s/100m
  }
  // Swim session 20 days before today — outside 14-day window
  const oldSwim = {
    id: 's2', date: '2026-04-05', type: 'Swim',
    duration: 30, distanceM: 1500,
  }
  // CSS = 90 s/100m (faster than session pace 120 s/100m → IF < 1)

  it('returns empty array when cssSecPer100m is 0', () => {
    expect(recentSwimTSS([recentSwim], 0, today)).toEqual([])
  })

  it('returns empty array when cssSecPer100m is null', () => {
    expect(recentSwimTSS([recentSwim], null, today)).toEqual([])
  })

  it('returns empty array when no swim sessions in last 14 days', () => {
    const result = recentSwimTSS([oldSwim], 90, today)
    expect(result).toEqual([])
  })

  it('returns sTSS for valid swim session in last 14 days', () => {
    const result = recentSwimTSS([recentSwim], 90, today)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe('2026-04-20')
    expect(typeof result[0].sTSS).toBe('number')
    expect(result[0].sTSS).toBeGreaterThan(0)
  })

  it('filters out sessions with pace <40 or >300 s/100m', () => {
    // pace = (1*60)/(500/100) = 60/5 = 12 s/100m → below 40 → rejected
    const tooFast = { id: 'sf', date: '2026-04-20', type: 'Swim', duration: 1, distanceM: 500 }
    // pace = (100*60)/(100/100) = 6000/1 = 6000 s/100m → above 300 → rejected
    const tooSlow = { id: 'ss', date: '2026-04-20', type: 'Swim', duration: 100, distanceM: 100 }
    expect(recentSwimTSS([tooFast], 90, today)).toEqual([])
    expect(recentSwimTSS([tooSlow], 90, today)).toEqual([])
  })

  it('returns at most 5 sessions', () => {
    const sessions = Array.from({ length: 8 }, (_, i) => ({
      id: `s${i}`,
      date: `2026-04-${String(14 + i).padStart(2, '0')}`,
      type: 'Swim',
      duration: 30,
      distanceM: 1500,
    }))
    const result = recentSwimTSS(sessions, 90, today)
    expect(result.length).toBeLessThanOrEqual(5)
  })

  it('results sorted by date descending', () => {
    const sessions = [
      { id: 's1', date: '2026-04-15', type: 'Swim', duration: 30, distanceM: 1500 },
      { id: 's2', date: '2026-04-20', type: 'Swim', duration: 30, distanceM: 1500 },
      { id: 's3', date: '2026-04-18', type: 'Swim', duration: 30, distanceM: 1500 },
    ]
    const result = recentSwimTSS(sessions, 90, today)
    expect(result[0].date).toBe('2026-04-20')
    expect(result[1].date).toBe('2026-04-18')
    expect(result[2].date).toBe('2026-04-15')
  })
})

// ── fmtPaceSecKm ──────────────────────────────────────────────────────────────
describe('fmtPaceSecKm', () => {
  it('90 → "1:30"', () => {
    expect(fmtPaceSecKm(90)).toBe('1:30')
  })

  it('65 → "1:05"', () => {
    expect(fmtPaceSecKm(65)).toBe('1:05')
  })

  it('120 → "2:00"', () => {
    expect(fmtPaceSecKm(120)).toBe('2:00')
  })

  it('60 → "1:00"', () => {
    expect(fmtPaceSecKm(60)).toBe('1:00')
  })

  it('75.5 rounds to 76 → "1:16"', () => {
    expect(fmtPaceSecKm(75.5)).toBe('1:16')
  })
})
