// ─── sleepRestingHR.test.js — E50: 22 tests ──────────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  parseSleepHrs,
  parseRHR,
  sleepHistory,
  rhrHistory,
  computeSleepRHR,
} from '../../athlete/sleepRestingHR.js'

// ── Date helpers (relative to today so window is always satisfied) ─────────────
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

// ─── 1. parseSleepHrs ─────────────────────────────────────────────────────────
describe('parseSleepHrs', () => {
  it('returns null for null / undefined input', () => {
    expect(parseSleepHrs(null)).toBeNull()
    expect(parseSleepHrs(undefined)).toBeNull()
    expect(parseSleepHrs({})).toBeNull()
  })

  it('returns null for sleepHrs = 0 or negative', () => {
    expect(parseSleepHrs({ sleepHrs: 0 })).toBeNull()
    expect(parseSleepHrs({ sleepHrs: -1 })).toBeNull()
  })

  it('returns null for sleepHrs >= 24', () => {
    expect(parseSleepHrs({ sleepHrs: 24 })).toBeNull()
    expect(parseSleepHrs({ sleepHrs: 25 })).toBeNull()
  })

  it('returns rounded value for valid sleep hours', () => {
    expect(parseSleepHrs({ sleepHrs: 7 })).toBe(7)
    expect(parseSleepHrs({ sleepHrs: '7.55' })).toBe(7.6)
    expect(parseSleepHrs({ sleepHrs: 6.1 })).toBe(6.1)
  })
})

// ─── 2. parseRHR ─────────────────────────────────────────────────────────────
describe('parseRHR', () => {
  it('returns null for null / undefined / empty input', () => {
    expect(parseRHR(null)).toBeNull()
    expect(parseRHR({})).toBeNull()
  })

  it('returns null when RHR < 30 or > 120', () => {
    expect(parseRHR({ restingHR: 29 })).toBeNull()
    expect(parseRHR({ restingHR: 121 })).toBeNull()
  })

  it('returns integer for valid RHR in range 30–120', () => {
    expect(parseRHR({ restingHR: 50 })).toBe(50)
    expect(parseRHR({ restingHR: '65' })).toBe(65)
    expect(parseRHR({ restingHR: 120 })).toBe(120)
    expect(parseRHR({ restingHR: 30 })).toBe(30)
  })
})

// ─── 3. sleepHistory ─────────────────────────────────────────────────────────
describe('sleepHistory', () => {
  it('returns [] for null or empty recovery', () => {
    expect(sleepHistory(null)).toEqual([])
    expect(sleepHistory([])).toEqual([])
  })

  it('filters entries outside the window', () => {
    const old  = { date: '2000-01-01', sleepHrs: 8 }
    const recent = { date: daysAgo(3), sleepHrs: 7 }
    const result = sleepHistory([old, recent])
    expect(result.length).toBe(1)
    expect(result[0].date).toBe(recent.date)
  })

  it('excludes entries without valid sleepHrs', () => {
    const entry = { date: daysAgo(1), sleepHrs: 0 }
    expect(sleepHistory([entry])).toEqual([])
  })

  it('returns entries sorted ascending by date', () => {
    const e1 = { date: daysAgo(5), sleepHrs: 7 }
    const e2 = { date: daysAgo(2), sleepHrs: 8 }
    const e3 = { date: daysAgo(10), sleepHrs: 6 }
    const result = sleepHistory([e2, e1, e3])
    expect(result[0].date).toBe(e3.date)
    expect(result[result.length - 1].date).toBe(e2.date)
  })
})

// ─── 4. rhrHistory ───────────────────────────────────────────────────────────
describe('rhrHistory', () => {
  it('returns [] for null or empty recovery', () => {
    expect(rhrHistory(null)).toEqual([])
    expect(rhrHistory([])).toEqual([])
  })

  it('excludes entries with invalid RHR', () => {
    const entry = { date: daysAgo(1), restingHR: 10 }  // < 30
    expect(rhrHistory([entry])).toEqual([])
  })

  it('includes valid entries within the window', () => {
    const e = { date: daysAgo(2), restingHR: 55 }
    expect(rhrHistory([e]).length).toBe(1)
  })
})

// ─── 5. computeSleepRHR ──────────────────────────────────────────────────────
describe('computeSleepRHR', () => {
  it('returns null when no valid data', () => {
    expect(computeSleepRHR(null)).toBeNull()
    expect(computeSleepRHR([])).toBeNull()
  })

  it('returns result shape with sleep-only data', () => {
    const recovery = [
      { date: daysAgo(1), sleepHrs: 7.5 },
      { date: daysAgo(2), sleepHrs: 8 },
    ]
    const result = computeSleepRHR(recovery)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('avgSleep')
    expect(result).toHaveProperty('sleepStatus')
    expect(result).toHaveProperty('avgRHR')
    expect(result).toHaveProperty('latestRHR')
    expect(result).toHaveProperty('days')
    expect(result.avgSleep).toBe(7.8)
    expect(result.sleepStatus).toBe('good')
  })

  it('classifies sleep as fair for 6–7 hours', () => {
    const recovery = [{ date: daysAgo(1), sleepHrs: 6.5 }]
    const result = computeSleepRHR(recovery)
    expect(result.sleepStatus).toBe('fair')
  })

  it('classifies sleep as low for < 6 hours', () => {
    const recovery = [{ date: daysAgo(1), sleepHrs: 5.5 }]
    const result = computeSleepRHR(recovery)
    expect(result.sleepStatus).toBe('low')
  })

  it('computes avgRHR correctly', () => {
    // sorted ascending by date → latestRHR = most recent = daysAgo(1) = 50
    const recovery = [
      { date: daysAgo(1), restingHR: 50 },
      { date: daysAgo(2), restingHR: 60 },
    ]
    const result = computeSleepRHR(recovery)
    expect(result.avgRHR).toBe(55)
    expect(result.latestRHR).toBe(50)   // daysAgo(1) is last after ascending sort
  })

  it('returns both sleep and RHR data when both present', () => {
    const recovery = [
      { date: daysAgo(1), sleepHrs: 8, restingHR: 52 },
      { date: daysAgo(3), sleepHrs: 7, restingHR: 56 },
    ]
    const result = computeSleepRHR(recovery)
    expect(result.avgSleep).toBeGreaterThan(0)
    expect(result.avgRHR).toBeGreaterThan(0)
    expect(result.rhrAvg7).toBeGreaterThan(0)
  })
})
