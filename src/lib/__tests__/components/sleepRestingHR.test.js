// ─── src/lib/__tests__/components/sleepRestingHR.test.js — E50 tests ─────────
import { describe, it, expect } from 'vitest'
import {
  parseSleepHrs,
  parseRHR,
  sleepHistory,
  rhrHistory,
  computeSleepRHR,
} from '../../athlete/sleepRestingHR.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function makeEntry(daysBack, sleepHrs = '7.5', restingHR = '55') {
  return { date: daysAgo(daysBack), sleepHrs, restingHR }
}

// ── parseSleepHrs ─────────────────────────────────────────────────────────────

describe('parseSleepHrs', () => {
  it('parses valid float string', () => {
    expect(parseSleepHrs({ sleepHrs: '7.5' })).toBe(7.5)
  })

  it('returns null for empty string', () => {
    expect(parseSleepHrs({ sleepHrs: '' })).toBeNull()
  })

  it('returns null for value > 24', () => {
    expect(parseSleepHrs({ sleepHrs: '25' })).toBeNull()
  })

  it('returns null for zero', () => {
    expect(parseSleepHrs({ sleepHrs: '0' })).toBeNull()
  })

  it('returns null for negative', () => {
    expect(parseSleepHrs({ sleepHrs: '-1' })).toBeNull()
  })

  it('rounds to one decimal', () => {
    expect(parseSleepHrs({ sleepHrs: '7.123' })).toBe(7.1)
  })

  it('handles undefined entry gracefully', () => {
    expect(parseSleepHrs(undefined)).toBeNull()
    expect(parseSleepHrs(null)).toBeNull()
  })
})

// ── parseRHR ──────────────────────────────────────────────────────────────────

describe('parseRHR', () => {
  it('parses valid integer string', () => {
    expect(parseRHR({ restingHR: '52' })).toBe(52)
  })

  it('returns null for empty string', () => {
    expect(parseRHR({ restingHR: '' })).toBeNull()
  })

  it('returns null for value < 30', () => {
    expect(parseRHR({ restingHR: '25' })).toBeNull()
  })

  it('returns null for value > 120', () => {
    expect(parseRHR({ restingHR: '130' })).toBeNull()
  })

  it('accepts boundary values 30 and 120', () => {
    expect(parseRHR({ restingHR: '30'  })).toBe(30)
    expect(parseRHR({ restingHR: '120' })).toBe(120)
  })

  it('handles undefined entry gracefully', () => {
    expect(parseRHR(undefined)).toBeNull()
    expect(parseRHR(null)).toBeNull()
  })
})

// ── sleepHistory ──────────────────────────────────────────────────────────────

describe('sleepHistory', () => {
  it('filters to last 28 days only', () => {
    const recovery = [
      makeEntry(5,  '7'),
      makeEntry(30, '6'),  // outside window
    ]
    const result = sleepHistory(recovery, 28)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe(daysAgo(5))
  })

  it('filters out entries without valid sleepHrs', () => {
    const recovery = [
      makeEntry(3, '8'),
      { date: daysAgo(4), sleepHrs: '',    restingHR: '55' },
      { date: daysAgo(5), sleepHrs: '0',   restingHR: '55' },
      { date: daysAgo(6), sleepHrs: '25',  restingHR: '55' },
    ]
    const result = sleepHistory(recovery, 28)
    expect(result).toHaveLength(1)
  })

  it('sorts ascending by date', () => {
    const recovery = [
      makeEntry(1, '7'),
      makeEntry(5, '8'),
      makeEntry(3, '6.5'),
    ]
    const result = sleepHistory(recovery, 28)
    expect(result[0].date).toBe(daysAgo(5))
    expect(result[1].date).toBe(daysAgo(3))
    expect(result[2].date).toBe(daysAgo(1))
  })

  it('returns empty array when no valid entries', () => {
    expect(sleepHistory([], 28)).toEqual([])
    expect(sleepHistory(null, 28)).toEqual([])
  })
})

// ── rhrHistory ────────────────────────────────────────────────────────────────

describe('rhrHistory', () => {
  it('filters to last 28 days and filters invalid RHR', () => {
    const recovery = [
      makeEntry(5,  '7', '58'),
      makeEntry(30, '7', '60'),   // outside window
      { date: daysAgo(3), sleepHrs: '7', restingHR: '25' },  // invalid RHR
      { date: daysAgo(2), sleepHrs: '7', restingHR: ''   },  // empty RHR
    ]
    const result = rhrHistory(recovery, 28)
    expect(result).toHaveLength(1)
    expect(result[0].date).toBe(daysAgo(5))
  })

  it('sorts ascending by date', () => {
    const recovery = [
      makeEntry(1, '7', '55'),
      makeEntry(4, '7', '58'),
    ]
    const result = rhrHistory(recovery, 28)
    expect(result[0].date).toBe(daysAgo(4))
    expect(result[1].date).toBe(daysAgo(1))
  })
})

// ── computeSleepRHR ───────────────────────────────────────────────────────────

describe('computeSleepRHR', () => {
  it('returns null when no sleep or RHR data', () => {
    expect(computeSleepRHR([])).toBeNull()
    expect(computeSleepRHR(null)).toBeNull()
    expect(computeSleepRHR([{ date: daysAgo(1), sleepHrs: '', restingHR: '' }])).toBeNull()
  })

  it('returns avgSleep and sleepStatus', () => {
    const recovery = [makeEntry(1, '8'), makeEntry(2, '6')]
    const result = computeSleepRHR(recovery, 28)
    expect(result).not.toBeNull()
    expect(result.avgSleep).toBe(7)
    expect(result.sleepStatus).toBe('good')
  })

  it('returns avgRHR and latestRHR', () => {
    const recovery = [makeEntry(2, '7', '58'), makeEntry(1, '7', '52')]
    const result = computeSleepRHR(recovery, 28)
    expect(result.avgRHR).toBe(55)
    expect(result.latestRHR).toBe(52)
  })

  it('sleepStatus is "good" when avgSleep >= 7', () => {
    const recovery = [makeEntry(1, '7'), makeEntry(2, '8')]
    const result = computeSleepRHR(recovery, 28)
    expect(result.sleepStatus).toBe('good')
  })

  it('sleepStatus is "fair" when avgSleep in [6, 7)', () => {
    const recovery = [makeEntry(1, '6'), makeEntry(2, '6.5')]
    const result = computeSleepRHR(recovery, 28)
    expect(result.sleepStatus).toBe('fair')
  })

  it('sleepStatus is "low" when avgSleep < 6', () => {
    const recovery = [makeEntry(1, '5'), makeEntry(2, '5.5')]
    const result = computeSleepRHR(recovery, 28)
    expect(result.sleepStatus).toBe('low')
  })

  it('latestRHR is the last (most recent) RHR entry value', () => {
    const recovery = [
      makeEntry(10, '7', '60'),
      makeEntry(5,  '7', '55'),
      makeEntry(1,  '7', '48'),
    ]
    const result = computeSleepRHR(recovery, 28)
    expect(result.latestRHR).toBe(48)
  })

  it('rhrAvg7 uses last 7 RHR values', () => {
    const recovery = Array.from({ length: 9 }, (_, i) =>
      makeEntry(i + 1, '7', String(50 + i)),
    )
    const result = computeSleepRHR(recovery, 28)
    // last 7 rhrVals (ascending, so indices 2..8 in original = days 7..1)
    const last7 = [56, 55, 54, 53, 52, 51, 50]
    const expected = Math.round(last7.reduce((s, v) => s + v, 0) / 7)
    expect(result.rhrAvg7).toBe(expected)
  })

  it('includes sleepEntries and rhrEntries arrays', () => {
    const recovery = [makeEntry(1, '7.5', '55')]
    const result = computeSleepRHR(recovery, 28)
    expect(Array.isArray(result.sleepEntries)).toBe(true)
    expect(Array.isArray(result.rhrEntries)).toBe(true)
  })
})
