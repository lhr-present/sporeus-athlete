// ─── src/lib/__tests__/athlete/sleepConsistency.test.js ──────────────────────
// Unit tests for analyzeSleepConsistency (28-day sleep-duration variance).
import { describe, it, expect } from 'vitest'
import {
  analyzeSleepConsistency,
  SLEEP_CONSISTENCY_CITATION,
} from '../../athlete/sleepConsistency.js'

const TODAY = '2026-05-17'

// Build a recovery array ending at `endISO` with the given hours (oldest first).
function buildRecovery(hoursList, endISO = TODAY) {
  const end = new Date(endISO + 'T00:00:00Z')
  const out = []
  const n = hoursList.length
  for (let i = 0; i < n; i++) {
    const d = new Date(end.getTime())
    d.setUTCDate(d.getUTCDate() - (n - 1 - i))
    out.push({
      date: d.toISOString().slice(0, 10),
      sleepHrs: hoursList[i],
    })
  }
  return out
}

// Population stdev helper for cross-checking the math.
function popStdev(arr) {
  const n = arr.length
  const mean = arr.reduce((a, b) => a + b, 0) / n
  const variance = arr.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / n
  return Math.sqrt(variance)
}

describe('analyzeSleepConsistency — null inputs', () => {
  it('returns null when recovery is missing', () => {
    expect(analyzeSleepConsistency({ recovery: undefined, today: TODAY })).toBeNull()
    expect(analyzeSleepConsistency({ recovery: null, today: TODAY })).toBeNull()
  })

  it('returns null when recovery is an empty array', () => {
    expect(analyzeSleepConsistency({ recovery: [], today: TODAY })).toBeNull()
  })

  it('returns null when fewer than 7 valid sleepHrs entries exist', () => {
    // Only 6 valid entries within the 28d window
    const recovery = buildRecovery([7, 7, 7, 7, 7, 7])
    expect(analyzeSleepConsistency({ recovery, today: TODAY })).toBeNull()
  })

  it('returns null when all sleepHrs are zero / invalid', () => {
    const recovery = buildRecovery([0, 0, 0, 0, 0, 0, 0, 0])
    expect(analyzeSleepConsistency({ recovery, today: TODAY })).toBeNull()
  })

  it('returns null when sleepHrs are all out-of-range (NaN / >=24 / negative)', () => {
    const recovery = buildRecovery([NaN, NaN, 25, 30, -5, null, undefined, 'bogus'])
    expect(analyzeSleepConsistency({ recovery, today: TODAY })).toBeNull()
  })

  it('returns null when entries are outside the 28-day window', () => {
    const recovery = [
      { date: '2025-01-01', sleepHrs: 7 },
      { date: '2025-01-02', sleepHrs: 7 },
      { date: '2025-01-03', sleepHrs: 7 },
      { date: '2025-01-04', sleepHrs: 7 },
      { date: '2025-01-05', sleepHrs: 7 },
      { date: '2025-01-06', sleepHrs: 7 },
      { date: '2025-01-07', sleepHrs: 7 },
    ]
    expect(analyzeSleepConsistency({ recovery, today: TODAY })).toBeNull()
  })
})

describe('analyzeSleepConsistency — band classification', () => {
  it('classifies TIGHT when stdev < 0.75h (within 45min variation)', () => {
    // All 7 nights identical → σ = 0
    const recovery = buildRecovery([7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5])
    const out = analyzeSleepConsistency({ recovery, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.band).toBe('TIGHT')
    expect(out.stdSleepHrs).toBe(0)
    expect(out.avgSleepHrs).toBe(7.5)
    expect(out.shortestHrs).toBe(7.5)
    expect(out.longestHrs).toBe(7.5)
    expect(out.sampleCount).toBe(7)
    expect(out.citation).toBe(SLEEP_CONSISTENCY_CITATION)
  })

  it('classifies TIGHT for small (~0.5h) variation', () => {
    // [7, 7.5, 8, 7, 7.5, 8, 7] — σ ≈ 0.41
    const hours = [7, 7.5, 8, 7, 7.5, 8, 7]
    const recovery = buildRecovery(hours)
    const out = analyzeSleepConsistency({ recovery, today: TODAY })
    expect(out.band).toBe('TIGHT')
    expect(out.stdSleepHrs).toBeLessThan(0.75)
  })

  it('classifies LOOSE for moderate variation (~1h)', () => {
    // Mixed: [6, 8, 7, 9, 6, 8, 7, 9] → σ ≈ 1.12
    const hours = [6, 8, 7, 9, 6, 8, 7, 9]
    const recovery = buildRecovery(hours)
    const out = analyzeSleepConsistency({ recovery, today: TODAY })
    expect(out.band).toBe('LOOSE')
    expect(out.stdSleepHrs).toBeGreaterThanOrEqual(0.75)
    expect(out.stdSleepHrs).toBeLessThan(1.5)
  })

  it('classifies ERRATIC for wide variation (≥1.5h)', () => {
    // Wild: [4, 10, 5, 9, 4.5, 9.5, 5, 10] → σ ≈ 2.4
    const hours = [4, 10, 5, 9, 4.5, 9.5, 5, 10]
    const recovery = buildRecovery(hours)
    const out = analyzeSleepConsistency({ recovery, today: TODAY })
    expect(out.band).toBe('ERRATIC')
    expect(out.stdSleepHrs).toBeGreaterThanOrEqual(1.5)
    expect(out.shortestHrs).toBe(4)
    expect(out.longestHrs).toBe(10)
  })

  it('boundary: σ exactly 0.75 should be LOOSE (not TIGHT)', () => {
    // Construct values with σ = 0.75 exactly: [v, v, ...] with population
    // stdev of 0.75. Easiest: 8 values of {mean ± 0.75} alternating.
    // mean=7.5, half at 8.25, half at 6.75 → σ = 0.75
    const hours = [8.25, 6.75, 8.25, 6.75, 8.25, 6.75, 8.25, 6.75]
    expect(popStdev(hours)).toBeCloseTo(0.75, 6)
    const recovery = buildRecovery(hours)
    const out = analyzeSleepConsistency({ recovery, today: TODAY })
    expect(out.band).toBe('LOOSE')
  })

  it('boundary: σ exactly 1.5 should be ERRATIC (not LOOSE)', () => {
    // mean=7.5, half at 9.0, half at 6.0 → σ = 1.5
    const hours = [9, 6, 9, 6, 9, 6, 9, 6]
    expect(popStdev(hours)).toBeCloseTo(1.5, 6)
    const recovery = buildRecovery(hours)
    const out = analyzeSleepConsistency({ recovery, today: TODAY })
    expect(out.band).toBe('ERRATIC')
  })
})

describe('analyzeSleepConsistency — stdev / range math', () => {
  it('mean and stdev match a manual population stdev calc', () => {
    const hours = [6, 7, 8, 9, 6, 7, 8, 9, 7, 8]
    const recovery = buildRecovery(hours)
    const out = analyzeSleepConsistency({ recovery, today: TODAY })
    const expectedMean = hours.reduce((a, b) => a + b, 0) / hours.length
    const expectedStdev = popStdev(hours)
    expect(out.avgSleepHrs).toBeCloseTo(Math.round(expectedMean * 10) / 10, 1)
    expect(out.stdSleepHrs).toBeCloseTo(expectedStdev, 1)
  })

  it('reports shortest and longest nights correctly', () => {
    const hours = [4.5, 7, 7, 7, 7, 7, 7, 9]
    const recovery = buildRecovery(hours)
    const out = analyzeSleepConsistency({ recovery, today: TODAY })
    expect(out.shortestHrs).toBe(4.5)
    expect(out.longestHrs).toBe(9)
  })

  it('sampleCount equals the number of valid entries (ignores garbage)', () => {
    // 8 valid + 3 garbage → sampleCount should be 8
    const recovery = [
      { date: '2026-05-10', sleepHrs: 7 },
      { date: '2026-05-11', sleepHrs: 7.5 },
      { date: '2026-05-12', sleepHrs: 8 },
      { date: '2026-05-13', sleepHrs: 6.5 },
      { date: '2026-05-14', sleepHrs: 7 },
      { date: '2026-05-15', sleepHrs: 7.5 },
      { date: '2026-05-16', sleepHrs: 8 },
      { date: '2026-05-17', sleepHrs: 7 },
      // Garbage
      { date: '2026-05-09', sleepHrs: 'bogus' },
      { date: '2026-05-08', sleepHrs: 30 },
      { sleepHrs: 7 }, // no date
    ]
    const out = analyzeSleepConsistency({ recovery, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.sampleCount).toBe(8)
  })

  it('accepts sleepHours (long-form) as a fallback field', () => {
    const recovery = [
      { date: '2026-05-11', sleepHours: 7 },
      { date: '2026-05-12', sleepHours: 8 },
      { date: '2026-05-13', sleepHours: 6 },
      { date: '2026-05-14', sleepHours: 7 },
      { date: '2026-05-15', sleepHours: 8 },
      { date: '2026-05-16', sleepHours: 6 },
      { date: '2026-05-17', sleepHours: 7 },
    ]
    const out = analyzeSleepConsistency({ recovery, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.sampleCount).toBe(7)
  })

  it('de-dupes multiple entries on the same date (latest wins)', () => {
    // Same date, two entries — should collapse to one sample.
    const recovery = [
      ...buildRecovery([7, 7, 7, 7, 7, 7, 7]),
      { date: TODAY, sleepHrs: 4 }, // latest write — replaces TODAY's 7
    ]
    const out = analyzeSleepConsistency({ recovery, today: TODAY })
    expect(out.sampleCount).toBe(7)
    expect(out.shortestHrs).toBe(4)
  })

  it('respects custom windowDays', () => {
    // 14 entries spanning 14 days; windowDays=7 should keep only the last 7
    const recovery = buildRecovery([4, 4, 4, 4, 4, 4, 4, 8, 8, 8, 8, 8, 8, 8])
    const out7 = analyzeSleepConsistency({ recovery, today: TODAY, windowDays: 7 })
    expect(out7.sampleCount).toBe(7)
    expect(out7.avgSleepHrs).toBe(8)
    expect(out7.shortestHrs).toBe(8)

    const out28 = analyzeSleepConsistency({ recovery, today: TODAY, windowDays: 28 })
    expect(out28.sampleCount).toBe(14)
    expect(out28.shortestHrs).toBe(4)
    expect(out28.longestHrs).toBe(8)
  })

  it('uses system clock when `today` is omitted', () => {
    // Just verify it doesn't crash and returns a sensible object when
    // given enough valid recent-ish data anchored at the current date.
    const now = new Date()
    now.setUTCHours(0, 0, 0, 0)
    const recovery = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getTime())
      d.setUTCDate(d.getUTCDate() - i)
      recovery.push({ date: d.toISOString().slice(0, 10), sleepHrs: 7.5 })
    }
    const out = analyzeSleepConsistency({ recovery })
    expect(out).not.toBeNull()
    expect(out.sampleCount).toBe(7)
    expect(out.band).toBe('TIGHT')
  })
})
