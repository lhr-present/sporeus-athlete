// lifetimeTotals pure-fn tests — Bandura 1997 training-capital totals.

import { describe, it, expect } from 'vitest'
import { analyzeLifetimeTotals } from '../../athlete/lifetimeTotals.js'

const TODAY = '2026-05-14'

function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function sess(daysAgo, overrides = {}) {
  return {
    date: addDays(TODAY, -daysAgo),
    durationMin: 60,
    distanceKm:  10,
    tss:         50,
    ...overrides,
  }
}

describe('analyzeLifetimeTotals — null cases', () => {
  it('returns null for empty log', () => {
    expect(analyzeLifetimeTotals({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null for missing log argument', () => {
    expect(analyzeLifetimeTotals({ today: TODAY })).toBeNull()
  })

  it('returns null for null log', () => {
    expect(analyzeLifetimeTotals({ log: null, today: TODAY })).toBeNull()
  })

  it('returns null for non-array log', () => {
    expect(analyzeLifetimeTotals({ log: 'not-an-array', today: TODAY })).toBeNull()
  })

  it('returns null when no entry has a parseable date', () => {
    const log = [
      { durationMin: 60, distanceKm: 10, tss: 50 },                // no date
      { date: 'garbage', durationMin: 30, distanceKm: 5, tss: 25 }, // unparseable
    ]
    expect(analyzeLifetimeTotals({ log, today: TODAY })).toBeNull()
  })

  it('returns null when called with no arguments', () => {
    expect(analyzeLifetimeTotals()).toBeNull()
  })
})

describe('analyzeLifetimeTotals — totals aggregation', () => {
  it('sums durationMin, distanceKm, tss and counts sessions', () => {
    const log = [
      sess(0,  { durationMin: 60, distanceKm: 10, tss: 50 }),
      sess(7,  { durationMin: 90, distanceKm: 15, tss: 80 }),
      sess(14, { durationMin: 45, distanceKm:  8, tss: 40 }),
    ]
    const out = analyzeLifetimeTotals({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.totalSessions).toBe(3)
    expect(out.totalMinutes).toBe(195)
    expect(out.totalHours).toBeCloseTo(195 / 60, 5)
    expect(out.totalDistanceKm).toBe(33)
    expect(out.totalTss).toBe(170)
    expect(out.citation).toBe('Bandura 1997')
  })

  it('treats missing numeric fields as 0 but still counts the session', () => {
    const log = [
      { date: addDays(TODAY, -5) }, // no metrics at all
      sess(2, { durationMin: 30, distanceKm: 5, tss: 20 }),
    ]
    const out = analyzeLifetimeTotals({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.totalSessions).toBe(2)
    expect(out.totalMinutes).toBe(30)
    expect(out.totalDistanceKm).toBe(5)
    expect(out.totalTss).toBe(20)
  })

  it('skips entries without a parseable date but still aggregates the rest', () => {
    const log = [
      { durationMin: 999, distanceKm: 999, tss: 999 },              // no date
      { date: 'bogus', durationMin: 999, distanceKm: 999, tss: 999 }, // bad date
      sess(3, { durationMin: 60, distanceKm: 10, tss: 50 }),
    ]
    const out = analyzeLifetimeTotals({ log, today: TODAY })
    expect(out.totalSessions).toBe(1)
    expect(out.totalMinutes).toBe(60)
    expect(out.totalDistanceKm).toBe(10)
    expect(out.totalTss).toBe(50)
  })
})

describe('analyzeLifetimeTotals — tenure math', () => {
  it('reports first and last session dates from the log', () => {
    const log = [
      sess(30),  // older
      sess(0),   // today
      sess(15),  // middle
    ]
    const out = analyzeLifetimeTotals({ log, today: TODAY })
    expect(out.firstSessionDate).toBe(addDays(TODAY, -30))
    expect(out.lastSessionDate).toBe(TODAY)
  })

  it('computes tenureDays inclusive between first session and today', () => {
    const log = [sess(30), sess(0)]
    const out = analyzeLifetimeTotals({ log, today: TODAY })
    // 30 days back + today inclusive = 31
    expect(out.tenureDays).toBe(31)
  })

  it('computes tenureYears to 2 decimal places', () => {
    // ~3.5 years = 1278 days; pick a single old session.
    const oldDate = addDays(TODAY, -1278)
    const log = [{ date: oldDate, durationMin: 60, distanceKm: 10, tss: 50 }]
    const out = analyzeLifetimeTotals({ log, today: TODAY })
    expect(out.tenureDays).toBe(1279)
    expect(out.tenureYears).toBeCloseTo(1279 / 365.25, 2)
    // sanity: ~3.5 years
    expect(out.tenureYears).toBeGreaterThan(3)
    expect(out.tenureYears).toBeLessThan(4)
  })

  it('computes tenureMonths to 1 decimal place', () => {
    const log = [sess(60), sess(0)] // ~2 months
    const out = analyzeLifetimeTotals({ log, today: TODAY })
    expect(out.tenureDays).toBe(61)
    expect(out.tenureMonths).toBeCloseTo(61 / 30.4375, 1)
  })
})

describe('analyzeLifetimeTotals — multi-year log', () => {
  it('handles a 5-year span correctly', () => {
    // 5 years ≈ 1826 days. Use 1826 to get tenureDays = 1827 inclusive.
    const log = [
      { date: addDays(TODAY, -1826), durationMin: 60, distanceKm: 10, tss: 50 },
      { date: addDays(TODAY, -900),  durationMin: 60, distanceKm: 10, tss: 50 },
      { date: addDays(TODAY, 0),     durationMin: 60, distanceKm: 10, tss: 50 },
    ]
    const out = analyzeLifetimeTotals({ log, today: TODAY })
    expect(out.totalSessions).toBe(3)
    expect(out.firstSessionDate).toBe(addDays(TODAY, -1826))
    expect(out.lastSessionDate).toBe(TODAY)
    expect(out.tenureDays).toBe(1827)
    expect(out.tenureYears).toBeGreaterThanOrEqual(5)
    expect(out.tenureYears).toBeLessThan(5.1)
  })
})

describe('analyzeLifetimeTotals — edge cases', () => {
  it('single session: first === last and tenureDays = 1 when session is today', () => {
    const log = [sess(0, { durationMin: 45, distanceKm: 8, tss: 35 })]
    const out = analyzeLifetimeTotals({ log, today: TODAY })
    expect(out.totalSessions).toBe(1)
    expect(out.firstSessionDate).toBe(TODAY)
    expect(out.lastSessionDate).toBe(TODAY)
    expect(out.tenureDays).toBe(1)
    expect(out.totalMinutes).toBe(45)
    expect(out.totalHours).toBeCloseTo(0.75, 5)
    expect(out.totalDistanceKm).toBe(8)
    expect(out.totalTss).toBe(35)
  })

  it('defaults to system clock when `today` is omitted (returns finite tenureDays)', () => {
    const log = [{ date: '2020-01-01', durationMin: 60, distanceKm: 10, tss: 50 }]
    const out = analyzeLifetimeTotals({ log })
    expect(out).not.toBeNull()
    expect(Number.isFinite(out.tenureDays)).toBe(true)
    expect(out.tenureDays).toBeGreaterThan(0)
    expect(out.firstSessionDate).toBe('2020-01-01')
  })

  it('accepts Date instances on entries', () => {
    const someDate = new Date('2026-01-01T08:00:00Z')
    const log = [{ date: someDate, durationMin: 60, distanceKm: 10, tss: 50 }]
    const out = analyzeLifetimeTotals({ log, today: TODAY })
    expect(out.firstSessionDate).toBe('2026-01-01')
  })
})
