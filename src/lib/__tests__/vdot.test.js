import { describe, it, expect } from 'vitest'
import { estimateVDOT, getTrainingPaces, predictTime } from '../vdot.js'

// ── estimateVDOT ──────────────────────────────────────────────────────────────

describe('estimateVDOT', () => {
  it('10K in 40 min → VDOT ≈ 43.2 (in range 42–44)', () => {
    const vdot = estimateVDOT(10000, 40 * 60)
    expect(vdot).toBeGreaterThanOrEqual(42)
    expect(vdot).toBeLessThanOrEqual(44)
  })

  it('10K in 40 min → exact value is 43.2', () => {
    expect(estimateVDOT(10000, 40 * 60)).toBe(43.2)
  })

  it('5K in 25 min → VDOT in range 32–35', () => {
    const vdot = estimateVDOT(5000, 25 * 60)
    expect(vdot).toBeGreaterThanOrEqual(32)
    expect(vdot).toBeLessThanOrEqual(35)
  })

  it('5K in 25 min → exact value is 33.3', () => {
    expect(estimateVDOT(5000, 25 * 60)).toBe(33.3)
  })

  it('marathon in 3:30:00 → VDOT in range 36–39', () => {
    const vdot = estimateVDOT(42195, 3 * 3600 + 30 * 60)
    expect(vdot).toBeGreaterThanOrEqual(36)
    expect(vdot).toBeLessThanOrEqual(39)
  })

  it('marathon in 3:30:00 → exact value is 37.2', () => {
    expect(estimateVDOT(42195, 3 * 3600 + 30 * 60)).toBe(37.2)
  })

  it('half-marathon in 1:50:00 → VDOT in range 33–36', () => {
    const vdot = estimateVDOT(21097, 110 * 60)
    expect(vdot).toBeGreaterThanOrEqual(33)
    expect(vdot).toBeLessThanOrEqual(36)
  })

  it('half-marathon in 1:50:00 → exact value is 34.6', () => {
    expect(estimateVDOT(21097, 110 * 60)).toBe(34.6)
  })

  it('returns null for null distance', () => {
    expect(estimateVDOT(null, 2400)).toBeNull()
  })

  it('returns null for zero time', () => {
    expect(estimateVDOT(10000, 0)).toBeNull()
  })

  it('returns null for negative time', () => {
    expect(estimateVDOT(10000, -100)).toBeNull()
  })

  it('non-standard distance (8000m, 32min) → returns a number via Riegel remap', () => {
    const vdot = estimateVDOT(8000, 32 * 60)
    expect(typeof vdot).toBe('number')
    expect(vdot).toBeGreaterThan(0)
  })

  it('non-standard distance (8000m, 32min) → exact value is 42.6', () => {
    expect(estimateVDOT(8000, 32 * 60)).toBe(42.6)
  })

  it('returns a number for a fast 5K (17 min)', () => {
    const vdot = estimateVDOT(5000, 17 * 60)
    expect(typeof vdot).toBe('number')
    expect(vdot).toBeGreaterThan(50)
  })

  it('returns null when distanceM is 0', () => {
    expect(estimateVDOT(0, 2400)).toBeNull()
  })

  it('returns null when timeS is undefined', () => {
    expect(estimateVDOT(10000, undefined)).toBeNull()
  })

  it('very slow 5K (40 min) → returns table minimum VDOT (30)', () => {
    const vdot = estimateVDOT(5000, 40 * 60)
    expect(vdot).toBe(30)
  })
})

// ── getTrainingPaces ──────────────────────────────────────────────────────────

describe('getTrainingPaces', () => {
  it('VDOT 50 → returns object with required keys', () => {
    const paces = getTrainingPaces(50)
    expect(paces).not.toBeNull()
    expect(paces).toHaveProperty('easy')
    expect(paces).toHaveProperty('marathon')
    expect(paces).toHaveProperty('threshold')
    expect(paces).toHaveProperty('interval')
    expect(paces).toHaveProperty('rep')
  })

  it('VDOT 50 → exact pace values match table', () => {
    const paces = getTrainingPaces(50)
    expect(paces.easy).toBe(290)
    expect(paces.marathon).toBe(267)
    expect(paces.threshold).toBe(239)
    expect(paces.interval).toBe(213)
    expect(paces.rep).toBe(196)
  })

  it('VDOT 50 → all pace values are positive integers', () => {
    const paces = getTrainingPaces(50)
    for (const key of ['easy', 'marathon', 'threshold', 'interval', 'rep']) {
      expect(Number.isInteger(paces[key])).toBe(true)
      expect(paces[key]).toBeGreaterThan(0)
    }
  })

  it('VDOT 50 → easy pace is slowest (highest sec/km)', () => {
    const paces = getTrainingPaces(50)
    expect(paces.easy).toBeGreaterThan(paces.marathon)
    expect(paces.marathon).toBeGreaterThan(paces.threshold)
    expect(paces.threshold).toBeGreaterThan(paces.interval)
    expect(paces.interval).toBeGreaterThan(paces.rep)
  })

  it('VDOT 0 → returns null (falsy vdot guard)', () => {
    expect(getTrainingPaces(0)).toBeNull()
  })

  it('VDOT null → returns null', () => {
    expect(getTrainingPaces(null)).toBeNull()
  })

  it('VDOT below 30 is clamped to 30 (returns table min row)', () => {
    const pacesAt20 = getTrainingPaces(20)
    const pacesAt30 = getTrainingPaces(30)
    // Clamped values should equal VDOT 30 row
    expect(pacesAt20).toEqual(pacesAt30)
  })

  it('VDOT above 85 is clamped to 85 (returns table max row)', () => {
    const pacesAt100 = getTrainingPaces(100)
    const pacesAt85  = getTrainingPaces(85)
    expect(pacesAt100).toEqual(pacesAt85)
  })

  it('VDOT 30 → exact values from table first row', () => {
    const paces = getTrainingPaces(30)
    expect(paces.easy).toBe(454)
    expect(paces.rep).toBe(318)
  })

  it('VDOT 85 → exact values from table last row', () => {
    const paces = getTrainingPaces(85)
    expect(paces.easy).toBe(182)
    expect(paces.rep).toBe(115)
  })

  it('higher VDOT → faster (lower) easy pace than lower VDOT', () => {
    const paces50 = getTrainingPaces(50)
    const paces60 = getTrainingPaces(60)
    expect(paces60.easy).toBeLessThan(paces50.easy)
  })

  it('fractional VDOT (50.5) → interpolated values between 50 and 51 rows', () => {
    const paces50 = getTrainingPaces(50)
    const paces51 = getTrainingPaces(51)
    const pacesHalf = getTrainingPaces(50.5)
    expect(pacesHalf.easy).toBeGreaterThanOrEqual(paces51.easy)
    expect(pacesHalf.easy).toBeLessThanOrEqual(paces50.easy)
  })
})

// ── predictTime ───────────────────────────────────────────────────────────────

describe('predictTime', () => {
  it('VDOT 50 marathon → returns 9232 seconds', () => {
    expect(predictTime(50, 42195)).toBe(9232)
  })

  it('VDOT 50 5K → returns 1035 seconds', () => {
    expect(predictTime(50, 5000)).toBe(1035)
  })

  it('5K time is less than marathon time for same VDOT', () => {
    expect(predictTime(50, 5000)).toBeLessThan(predictTime(50, 42195))
  })

  it('10K time is between 5K and half-marathon times', () => {
    const t5k = predictTime(50, 5000)
    const t10k = predictTime(50, 10000)
    const tHM = predictTime(50, 21097)
    expect(t10k).toBeGreaterThan(t5k)
    expect(t10k).toBeLessThan(tHM)
  })

  it('null VDOT → returns null', () => {
    expect(predictTime(null, 5000)).toBeNull()
  })

  it('null distance → returns null', () => {
    expect(predictTime(50, null)).toBeNull()
  })

  it('returns a positive integer for all standard distances at VDOT 50', () => {
    for (const dist of [5000, 10000, 21097, 42195]) {
      const t = predictTime(50, dist)
      expect(Number.isInteger(t)).toBe(true)
      expect(t).toBeGreaterThan(0)
    }
  })

  it('non-standard distance (8000m) → returns a positive number via Riegel', () => {
    const t = predictTime(50, 8000)
    expect(t).toBeGreaterThan(0)
    expect(Number.isInteger(t)).toBe(true)
  })

  it('non-standard 8000m time is between 5K and 10K times', () => {
    const t5k = predictTime(50, 5000)
    const t8k  = predictTime(50, 8000)
    const t10k = predictTime(50, 10000)
    expect(t8k).toBeGreaterThan(t5k)
    expect(t8k).toBeLessThan(t10k)
  })

  it('higher VDOT predicts faster time for same distance', () => {
    expect(predictTime(60, 42195)).toBeLessThan(predictTime(50, 42195))
  })

  it('VDOT below 30 is clamped: predictTime(20, 5000) equals predictTime(30, 5000)', () => {
    expect(predictTime(20, 5000)).toBe(predictTime(30, 5000))
  })

  it('VDOT above 85 is clamped: predictTime(100, 5000) equals predictTime(85, 5000)', () => {
    expect(predictTime(100, 5000)).toBe(predictTime(85, 5000))
  })

  it('VDOT 50 half-marathon → positive integer', () => {
    const t = predictTime(50, 21097)
    expect(Number.isInteger(t)).toBe(true)
    expect(t).toBeGreaterThan(predictTime(50, 10000))
    expect(t).toBeLessThan(predictTime(50, 42195))
  })
})
