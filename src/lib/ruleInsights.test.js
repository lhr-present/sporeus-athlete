import { describe, it, expect } from 'vitest'
import {
  getReadinessLabel,
  getLoadTrendAlert,
  getMonotonyWarning,
  getFatigueAccumulation,
  getMissedRestWarning,
  getAthleteInsights,
} from './ruleInsights.js'

// ─── getReadinessLabel ────────────────────────────────────────────────────────
describe('getReadinessLabel', () => {
  it('returns high when ACWR > 1.5', () => {
    const r = getReadinessLabel(1.6, 70)
    expect(r.level).toBe('high')
    expect(r.message).toMatch(/1\.60/)
  })

  it('returns high when wellness < 40 regardless of ACWR', () => {
    const r = getReadinessLabel(1.0, 35)
    expect(r.level).toBe('high')
    expect(r.message).toMatch(/35\/100/)
  })

  it('returns moderate when ACWR between 1.3 and 1.5', () => {
    const r = getReadinessLabel(1.4, 70)
    expect(r.level).toBe('moderate')
  })

  it('returns moderate when wellness between 40 and 60', () => {
    const r = getReadinessLabel(1.0, 55)
    expect(r.level).toBe('moderate')
  })

  it('returns low when ACWR < 0.8 and wellness >= 70', () => {
    const r = getReadinessLabel(0.6, 80)
    expect(r.level).toBe('low')
    expect(r.message).toMatch(/0\.60/)
  })

  it('returns optimal for ACWR 0.8–1.3 and wellness >= 60', () => {
    const r = getReadinessLabel(1.1, 75)
    expect(r.level).toBe('optimal')
  })

  it('handles null inputs gracefully (defaults acwr=1.0, well=50 → moderate)', () => {
    const r = getReadinessLabel(null, null)
    expect(r.level).toBe('moderate')  // well=50 < 60 triggers moderate
  })
})

// ─── getLoadTrendAlert ────────────────────────────────────────────────────────
describe('getLoadTrendAlert', () => {
  it('flags when second half >10% higher than first half', () => {
    // first 3 days: 100 each = 300; last 4 days: 120 each = 480 → +60% spike
    const r = getLoadTrendAlert([100, 100, 100, 120, 120, 120, 120])
    expect(r.flag).toBe(true)
    expect(r.message).toMatch(/60%/)
  })

  it('does not flag when change is within 10%', () => {
    // first 3: 100 each = 300; last 4: 105 each = 420 → +40% — wait that's wrong
    // first 3: 100 each = 300; last 4: 77 each = 308 → +2.7%
    const r = getLoadTrendAlert([100, 100, 100, 77, 77, 77, 77])
    expect(r.flag).toBe(false)
  })

  it('returns no-flag when week1 is zero (insufficient data)', () => {
    const r = getLoadTrendAlert([0, 0, 0, 100, 100, 100, 100])
    expect(r.flag).toBe(false)
    expect(r.message).toMatch(/Insufficient/)
  })

  it('handles empty array', () => {
    const r = getLoadTrendAlert([])
    expect(r.flag).toBe(false)
  })

  it('handles null input', () => {
    const r = getLoadTrendAlert(null)
    expect(r.flag).toBe(false)
  })
})

// ─── getMonotonyWarning ───────────────────────────────────────────────────────
describe('getMonotonyWarning', () => {
  it('flags monotony > 2.0', () => {
    // all same → sd=0 → infinity monotony
    const r = getMonotonyWarning([100, 100, 100, 100, 100, 100, 100])
    expect(r.flag).toBe(true)
  })

  it('flags when calculated monotony exceeds 2.0', () => {
    // mean=100, small variation → high monotony
    const r = getMonotonyWarning([99, 100, 101, 100, 100, 99, 101])
    expect(r.flag).toBe(true)
    expect(r.message).toMatch(/Monotony/)
  })

  it('does not flag varied training load', () => {
    // high variation: 0, 200, 0, 200, 0, 200, 0
    const r = getMonotonyWarning([0, 200, 0, 200, 0, 200, 0])
    expect(r.flag).toBe(false)
  })

  it('does not flag all-zero loads (mean=0)', () => {
    const r = getMonotonyWarning([0, 0, 0, 0, 0, 0, 0])
    expect(r.flag).toBe(false)
    expect(r.message).toMatch(/not applicable/)
  })

  it('handles array shorter than 2 elements', () => {
    const r = getMonotonyWarning([100])
    expect(r.flag).toBe(false)
    expect(r.message).toMatch(/Not enough/)
  })
})

// ─── getFatigueAccumulation ───────────────────────────────────────────────────
describe('getFatigueAccumulation', () => {
  it('flags when avg fatigue score < 2.5', () => {
    const r = getFatigueAccumulation([2, 2, 2])
    expect(r.flag).toBe(true)
    expect(r.message).toMatch(/2\.0\/5/)
  })

  it('does not flag when avg >= 2.5', () => {
    const r = getFatigueAccumulation([3, 4, 3])
    expect(r.flag).toBe(false)
  })

  it('handles empty array', () => {
    const r = getFatigueAccumulation([])
    expect(r.flag).toBe(false)
    expect(r.message).toMatch(/No fatigue/)
  })

  it('filters out out-of-range values', () => {
    // Only [3, 4] valid; avg = 3.5 → no flag
    const r = getFatigueAccumulation([0, 3, 4, 6])
    expect(r.flag).toBe(false)
  })
})

// ─── getMissedRestWarning ─────────────────────────────────────────────────────
describe('getMissedRestWarning', () => {
  it('flags 6+ consecutive training days', () => {
    const r = getMissedRestWarning(6)
    expect(r.flag).toBe(true)
    expect(r.message).toMatch(/6 consecutive/)
  })

  it('flags 7 consecutive days', () => {
    const r = getMissedRestWarning(7)
    expect(r.flag).toBe(true)
  })

  it('does not flag 5 consecutive days', () => {
    const r = getMissedRestWarning(5)
    expect(r.flag).toBe(false)
  })

  it('does not flag 0 (rest day)', () => {
    const r = getMissedRestWarning(0)
    expect(r.flag).toBe(false)
    expect(r.message).toMatch(/Rest day/)
  })

  it('handles null input gracefully (defaults to 0)', () => {
    const r = getMissedRestWarning(null)
    expect(r.flag).toBe(false)
  })
})

// ─── getAthleteInsights ───────────────────────────────────────────────────────
describe('getAthleteInsights', () => {
  it('returns empty array for null input', () => {
    expect(getAthleteInsights(null)).toEqual([])
    expect(getAthleteInsights(undefined)).toEqual([])
  })

  it('returns sorted alerts with high severity first', () => {
    const data = {
      acwr: 1.8,            // high readiness
      wellnessAvg: 80,
      loads7days: [100, 100, 100, 120, 120, 120, 120], // load trend flag
      fatigueScores3days: [1, 1, 1],  // fatigue flag
      consecutiveTrainingDays: 7,     // rest flag
    }
    const alerts = getAthleteInsights(data)
    expect(alerts.length).toBeGreaterThan(0)
    // First alert should be high severity (ACWR 1.8)
    expect(alerts[0].severity).toBe('high')
  })

  it('includes readiness regardless of flag value', () => {
    const data = {
      acwr: 1.1,
      wellnessAvg: 75,
      loads7days: [100, 100, 100, 100, 100, 100, 100],
      fatigueScores3days: [4, 4, 4],
      consecutiveTrainingDays: 3,
    }
    const alerts = getAthleteInsights(data)
    const readiness = alerts.find(a => a.key === 'readiness')
    expect(readiness).toBeDefined()
  })

  it('each alert has required fields', () => {
    const data = {
      acwr: 1.0,
      wellnessAvg: 70,
      loads7days: [100, 50, 150, 80, 200, 30, 100],
      fatigueScores3days: [3, 4, 3],
      consecutiveTrainingDays: 2,
    }
    const alerts = getAthleteInsights(data)
    for (const a of alerts) {
      expect(a).toHaveProperty('key')
      expect(a).toHaveProperty('flag')
      expect(a).toHaveProperty('severity')
      expect(a).toHaveProperty('message')
      expect(a).toHaveProperty('action')
      expect(a).toHaveProperty('color')
    }
  })
})
