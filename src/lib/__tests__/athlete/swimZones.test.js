// ─── swimZones.test.js — E43: 24 tests ───────────────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  bestSwimPace,
  computeSwimZones,
  fmtPaceSecKm,
  recentSwimTSS,
} from '../../athlete/swimZones.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────
// 1000m in 1000s → pace = 100 s/100m (valid: 40–300)
const swim1000 = { type: 'swim', distanceM: 1000, duration: 1000 / 60, date: '2026-04-10' }
// 2000m in 1800s (30 min) → pace = 90 s/100m (valid)
const swim2000 = { type: 'swim', distanceM: 2000, duration: 30, date: '2026-04-15' }
// sport field instead of type
const swimSport = { sport: 'swimming', distanceM: 1500, duration: 22.5, date: '2026-04-12' }
// pace too fast: 100m in 10s → 10 s/100m (< 40 → invalid)
const tooFast = { type: 'swim', distanceM: 100, duration: 10 / 60, date: '2026-04-05' }
// pace too slow: 100m in 360s (6 min) → 360 s/100m (> 300 → invalid)
const tooSlow = { type: 'swim', distanceM: 100, duration: 6, date: '2026-04-06' }

// ─── 1. bestSwimPace ─────────────────────────────────────────────────────────
describe('bestSwimPace', () => {
  it('returns null for null or empty log', () => {
    expect(bestSwimPace(null)).toBeNull()
    expect(bestSwimPace([])).toBeNull()
  })

  it('returns null when no swim sessions', () => {
    const bike = { type: 'bike', distanceM: 5000, duration: 20, date: '2026-04-10' }
    expect(bestSwimPace([bike])).toBeNull()
  })

  it('returns null when pace is out of sanity range', () => {
    expect(bestSwimPace([tooFast])).toBeNull()
    expect(bestSwimPace([tooSlow])).toBeNull()
  })

  it('returns correct shape for a valid swim session', () => {
    const result = bestSwimPace([swim1000])
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('secPer100m')
    expect(result).toHaveProperty('sessionDate')
    expect(result).toHaveProperty('distanceM', 1000)
    expect(result).toHaveProperty('durationMin')
    expect(result.secPer100m).toBeCloseTo(100, 0)
  })

  it('picks the fastest (lowest sec/100m) session', () => {
    const result = bestSwimPace([swim1000, swim2000])
    // swim2000: pace = (30*60)/(2000/100) = 1800/20 = 90 s/100m (faster)
    expect(result.secPer100m).toBeCloseTo(90, 0)
    expect(result.distanceM).toBe(2000)
  })

  it('detects swim via sport field', () => {
    const result = bestSwimPace([swimSport])
    expect(result).not.toBeNull()
  })
})

// ─── 2. computeSwimZones ─────────────────────────────────────────────────────
describe('computeSwimZones', () => {
  it('returns null for null or empty log', () => {
    expect(computeSwimZones(null)).toBeNull()
    expect(computeSwimZones([])).toBeNull()
  })

  it('returns null when no valid swim pace', () => {
    expect(computeSwimZones([tooFast])).toBeNull()
  })

  it('returns correct shape for valid swim data', () => {
    const result = computeSwimZones([swim2000])
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('cssSecPer100m')
    expect(result).toHaveProperty('tPace')
    expect(result).toHaveProperty('zones')
    expect(result).toHaveProperty('bestDate')
    expect(result).toHaveProperty('sessionsScanned')
    expect(result.sessionsScanned).toBe(1)
  })

  it('zones is a non-empty array', () => {
    const result = computeSwimZones([swim2000])
    expect(Array.isArray(result.zones)).toBe(true)
    expect(result.zones.length).toBeGreaterThan(0)
  })

  it('cssSecPer100m equals the best pace found', () => {
    const result = computeSwimZones([swim1000, swim2000])
    // Best pace is swim2000 at 90 s/100m
    expect(result.cssSecPer100m).toBeCloseTo(90, 0)
  })

  it('counts all swim sessions in sessionsScanned', () => {
    const result = computeSwimZones([swim1000, swim2000, swimSport])
    expect(result.sessionsScanned).toBe(3)
  })
})

// ─── 3. fmtPaceSecKm ─────────────────────────────────────────────────────────
describe('fmtPaceSecKm', () => {
  it('formats 90 sec as 1:30', () => {
    expect(fmtPaceSecKm(90)).toBe('1:30')
  })

  it('formats 65.5 sec as 1:05 (rounds)', () => {
    expect(fmtPaceSecKm(65.5)).toBe('1:06')
  })

  it('formats 120 sec as 2:00', () => {
    expect(fmtPaceSecKm(120)).toBe('2:00')
  })

  it('pads seconds below 10', () => {
    expect(fmtPaceSecKm(61)).toBe('1:01')
  })

  it('handles 0 as 0:00', () => {
    expect(fmtPaceSecKm(0)).toBe('0:00')
  })
})

// ─── 4. recentSwimTSS ─────────────────────────────────────────────────────────
describe('recentSwimTSS', () => {
  const TODAY = '2026-04-30'

  it('returns [] for invalid CSS', () => {
    expect(recentSwimTSS([swim2000], 0, TODAY)).toEqual([])
    expect(recentSwimTSS([swim2000], -1, TODAY)).toEqual([])
  })

  it('returns [] for empty log', () => {
    expect(recentSwimTSS([], 90, TODAY)).toEqual([])
  })

  it('returns [] when sessions are outside 14-day window', () => {
    const oldSwim = { type: 'swim', distanceM: 2000, duration: 30, date: '2026-03-01' }
    expect(recentSwimTSS([oldSwim], 90, TODAY)).toEqual([])
  })

  it('returns sTSS entries for recent valid swim sessions', () => {
    const recentSwim = { type: 'swim', distanceM: 2000, duration: 30, date: '2026-04-25' }
    const result = recentSwimTSS([recentSwim], 90, TODAY)
    expect(result.length).toBe(1)
    expect(result[0]).toHaveProperty('date', '2026-04-25')
    expect(result[0]).toHaveProperty('sTSS')
    expect(result[0]).toHaveProperty('duration', 30)
    expect(result[0]).toHaveProperty('currentPace')
    expect(result[0].sTSS).toBeGreaterThan(0)
  })

  it('caps returned sessions at 5', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => ({
      type: 'swim',
      distanceM: 2000,
      duration: 30,
      date: `2026-04-${String(21 + i).padStart(2, '0')}`,
    }))
    const result = recentSwimTSS(sessions, 90, TODAY)
    expect(result.length).toBeLessThanOrEqual(5)
  })

  it('returns results sorted descending by date', () => {
    const sessions = [
      { type: 'swim', distanceM: 2000, duration: 30, date: '2026-04-22' },
      { type: 'swim', distanceM: 2000, duration: 30, date: '2026-04-28' },
    ]
    const result = recentSwimTSS(sessions, 90, TODAY)
    expect(result[0].date >= result[1].date).toBe(true)
  })
})
