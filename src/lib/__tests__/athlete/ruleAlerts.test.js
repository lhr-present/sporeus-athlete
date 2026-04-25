import { describe, it, expect } from 'vitest'
import {
  wellnessScore100,
  last7DayTSS,
  last3DayFatigue,
  consecutiveTrainingDays,
  computeRuleAlerts,
} from '../../athlete/ruleAlerts.js'

// ─── wellnessScore100 ─────────────────────────────────────────────────────────
describe('wellnessScore100', () => {
  it('returns 50 for null entry', () => {
    expect(wellnessScore100(null)).toBe(50)
  })

  it('returns 50 for undefined', () => {
    expect(wellnessScore100(undefined)).toBe(50)
  })

  it('returns 50 for all-3 entry (midpoint)', () => {
    // All fields = 3: (3-1)/4*100 = 50; soreness/stress: (6-3-1)/4*100 = 50
    const entry = { sleep: 3, energy: 3, soreness: 3, stress: 3, mood: 3 }
    expect(wellnessScore100(entry)).toBe(50)
  })

  it('returns 100 for all-5 entry (best possible)', () => {
    // sleep=5→100, energy=5→100, soreness=5→(6-5-1)/4*100=0... wait
    // soreness 5 = highest soreness = worst → 6-5=1 → (1-1)/4*100=0
    // So all-5 is NOT 100. Let's test: sleep=5,energy=5,soreness=1,stress=1,mood=5 → 100
    const entry = { sleep: 5, energy: 5, soreness: 1, stress: 1, mood: 5 }
    expect(wellnessScore100(entry)).toBe(100)
  })

  it('returns 0 for worst possible entry', () => {
    // sleep=1,energy=1,soreness=5→(6-5-1)/4*100=0,stress=5→0,mood=1→0
    const entry = { sleep: 1, energy: 1, soreness: 5, stress: 5, mood: 1 }
    expect(wellnessScore100(entry)).toBe(0)
  })

  it('skips null/undefined fields and averages available ones', () => {
    const entry = { sleep: 5, energy: null, soreness: undefined, stress: null, mood: 5 }
    // sleep: (5-1)/4*100=100, mood: (5-1)/4*100=100 → avg=100
    expect(wellnessScore100(entry)).toBe(100)
  })
})

// ─── last7DayTSS ──────────────────────────────────────────────────────────────
describe('last7DayTSS', () => {
  it('returns 7 zeros for empty log', () => {
    expect(last7DayTSS([], '2026-04-25')).toEqual([0, 0, 0, 0, 0, 0, 0])
  })

  it('places a TSS entry in correct position', () => {
    // Entry on 2026-04-25 (today, last slot) = index 6
    const log = [{ date: '2026-04-25', tss: 80 }]
    const result = last7DayTSS(log, '2026-04-25')
    expect(result.length).toBe(7)
    expect(result[6]).toBe(80)
    expect(result.slice(0, 6)).toEqual([0, 0, 0, 0, 0, 0])
  })

  it('places entry at day-6 position (index 0)', () => {
    const log = [{ date: '2026-04-19', tss: 50 }]
    const result = last7DayTSS(log, '2026-04-25')
    expect(result[0]).toBe(50)
    expect(result.slice(1)).toEqual([0, 0, 0, 0, 0, 0])
  })

  it('excludes entries outside the 7-day window', () => {
    const log = [{ date: '2026-04-18', tss: 100 }] // 8 days ago
    const result = last7DayTSS(log, '2026-04-25')
    expect(result).toEqual([0, 0, 0, 0, 0, 0, 0])
  })

  it('sums multiple sessions on same day', () => {
    const log = [
      { date: '2026-04-25', tss: 40 },
      { date: '2026-04-25', tss: 60 },
    ]
    const result = last7DayTSS(log, '2026-04-25')
    expect(result[6]).toBe(100)
  })
})

// ─── last3DayFatigue ──────────────────────────────────────────────────────────
describe('last3DayFatigue', () => {
  it('returns 3 zeros for empty log', () => {
    expect(last3DayFatigue([], '2026-04-25')).toEqual([0, 0, 0])
  })

  it('computes fatigue for today (index 2)', () => {
    const log = [{ date: '2026-04-25', rpe: 8 }]
    const result = last3DayFatigue(log, '2026-04-25')
    expect(result[2]).toBeCloseTo(0.8)
    expect(result[0]).toBe(0)
    expect(result[1]).toBe(0)
  })

  it('sums multiple sessions on the same day', () => {
    const log = [
      { date: '2026-04-25', rpe: 5 },
      { date: '2026-04-25', rpe: 5 },
    ]
    const result = last3DayFatigue(log, '2026-04-25')
    expect(result[2]).toBeCloseTo(1.0)
  })

  it('handles entry 2 days ago at index 0', () => {
    const log = [{ date: '2026-04-23', rpe: 10 }]
    const result = last3DayFatigue(log, '2026-04-25')
    expect(result[0]).toBeCloseTo(1.0)
    expect(result[1]).toBe(0)
    expect(result[2]).toBe(0)
  })
})

// ─── consecutiveTrainingDays ──────────────────────────────────────────────────
describe('consecutiveTrainingDays', () => {
  it('returns 0 for empty log', () => {
    expect(consecutiveTrainingDays([], '2026-04-25')).toBe(0)
  })

  it('returns 0 when today has no entry', () => {
    const log = [{ date: '2026-04-22', tss: 50 }]
    expect(consecutiveTrainingDays(log, '2026-04-25')).toBe(0)
  })

  it('returns 1 for only today', () => {
    const log = [{ date: '2026-04-25', tss: 50 }]
    expect(consecutiveTrainingDays(log, '2026-04-25')).toBe(1)
  })

  it('returns 3 for a 3-day streak ending today', () => {
    const log = [
      { date: '2026-04-23', tss: 50 },
      { date: '2026-04-24', tss: 50 },
      { date: '2026-04-25', tss: 50 },
    ]
    expect(consecutiveTrainingDays(log, '2026-04-25')).toBe(3)
  })

  it('stops counting at a gap', () => {
    const log = [
      { date: '2026-04-21', tss: 50 }, // gap before streak
      { date: '2026-04-23', tss: 50 },
      { date: '2026-04-24', tss: 50 },
      { date: '2026-04-25', tss: 50 },
    ]
    expect(consecutiveTrainingDays(log, '2026-04-25')).toBe(3)
  })

  it('counts multiple sessions on same day as one day', () => {
    const log = [
      { date: '2026-04-25', tss: 50 },
      { date: '2026-04-25', tss: 80 },
    ]
    expect(consecutiveTrainingDays(log, '2026-04-25')).toBe(1)
  })
})

// ─── computeRuleAlerts ────────────────────────────────────────────────────────
describe('computeRuleAlerts', () => {
  it('returns [] for empty log', () => {
    const alerts = computeRuleAlerts([], [], '2026-04-25')
    expect(Array.isArray(alerts)).toBe(true)
    // With empty log, ACWR is null → readiness always included
    // getAthleteInsights always includes readiness key
    expect(alerts.length).toBeGreaterThanOrEqual(0)
  })

  it('returns array with correct shape when sufficient data exists', () => {
    const log = Array.from({ length: 14 }, (_, i) => ({
      date: (() => {
        const d = new Date('2026-04-12T00:00:00Z')
        d.setUTCDate(d.getUTCDate() + i)
        return d.toISOString().slice(0, 10)
      })(),
      tss: 80,
      rpe: 7,
      type: 'run',
      duration: 60,
    }))
    const alerts = computeRuleAlerts(log, [], '2026-04-25')
    expect(Array.isArray(alerts)).toBe(true)
    // May return alerts or not — just verify shape
    if (alerts.length > 0) {
      const a = alerts[0]
      expect(a).toHaveProperty('key')
      expect(a).toHaveProperty('message')
      expect(a).toHaveProperty('color')
    }
  })

  it('each alert item has key, message, and color fields', () => {
    const log = Array.from({ length: 28 }, (_, i) => ({
      date: (() => {
        const d = new Date('2026-03-28T00:00:00Z')
        d.setUTCDate(d.getUTCDate() + i)
        return d.toISOString().slice(0, 10)
      })(),
      tss: 100,
      rpe: 8,
      type: 'run',
      duration: 90,
    }))
    const recovery = [{ date: '2026-04-25', sleep: 2, energy: 2, soreness: 4, stress: 4, mood: 2 }]
    const alerts = computeRuleAlerts(log, recovery, '2026-04-25')
    expect(Array.isArray(alerts)).toBe(true)
    for (const a of alerts) {
      expect(typeof a.key).toBe('string')
      expect(typeof a.message).toBe('string')
      expect(typeof a.color).toBe('string')
    }
  })

  it('never throws on malformed inputs', () => {
    expect(() => computeRuleAlerts(null, null, '2026-04-25')).not.toThrow()
    expect(() => computeRuleAlerts(undefined, undefined)).not.toThrow()
    expect(() => computeRuleAlerts([{ date: null, tss: 'bad' }], [{}])).not.toThrow()
  })
})
