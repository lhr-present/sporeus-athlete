// ─── yearOverYear.test.js — pure-fn unit tests ─────────────────────────────
// Covers:
//   - all 3 bands (AHEAD / MATCHING / BEHIND)
//   - null cases: empty log, no last-year data (< 10 sessions), no this-year data
//   - delta math (sessions / minutes / tss)
//   - partial-data fallback (some deltas null → aggregate uses remaining)
import { describe, it, expect } from 'vitest'
import { analyzeYearOverYear } from '../../athlete/yearOverYear.js'

const TODAY = '2026-05-19'

/**
 * Build N evenly-spaced sessions inside a calendar window.
 * @param {string} from   'YYYY-MM-DD' inclusive
 * @param {string} to     'YYYY-MM-DD' inclusive
 * @param {number} count  number of sessions to generate
 * @param {{ durationMin?: number, tss?: number }} per-session payload
 */
function buildWindow(from, to, count, { durationMin = 60, tss = 50 } = {}) {
  const start = new Date(from + 'T00:00:00Z').getTime()
  const end   = new Date(to   + 'T00:00:00Z').getTime()
  const span  = Math.max(1, end - start)
  const out = []
  for (let i = 0; i < count; i++) {
    const t = start + Math.round((i / Math.max(1, count - 1)) * span)
    const d = new Date(t).toISOString().slice(0, 10)
    out.push({ date: d, durationMin, tss })
  }
  return out
}

describe('analyzeYearOverYear — null gates', () => {
  it('returns null for empty/missing log', () => {
    expect(analyzeYearOverYear({ log: [], today: TODAY })).toBeNull()
    expect(analyzeYearOverYear({ log: undefined, today: TODAY })).toBeNull()
    expect(analyzeYearOverYear({})).toBeNull()
  })

  it('returns null when last-year window has < 10 sessions', () => {
    const log = [
      ...buildWindow('2025-01-05', '2025-05-19', 9),  // last year YTD = 9 (< 10)
      ...buildWindow('2026-01-05', '2026-05-19', 20), // plenty this year
    ]
    expect(analyzeYearOverYear({ log, today: TODAY })).toBeNull()
  })

  it('returns null when this-year window has 0 sessions', () => {
    const log = buildWindow('2025-01-05', '2025-05-19', 30) // last year only
    expect(analyzeYearOverYear({ log, today: TODAY })).toBeNull()
  })
})

describe('analyzeYearOverYear — band classification', () => {
  it('classifies AHEAD when volume is +30%', () => {
    const log = [
      ...buildWindow('2025-01-05', '2025-05-19', 50, { durationMin: 60, tss: 50 }),
      // +30% on all three metrics → 65 sessions, 65*60min, 65*50 tss
      ...buildWindow('2026-01-05', '2026-05-19', 65, { durationMin: 60, tss: 50 }),
    ]
    const r = analyzeYearOverYear({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('AHEAD')
    expect(r.aggregateTrend).toBeGreaterThanOrEqual(0.10)
    expect(r.citation).toBe('Issurin 2010; Tønnessen 2014')
  })

  it('classifies MATCHING when volume is roughly equal (~+2%)', () => {
    const log = [
      ...buildWindow('2025-01-05', '2025-05-19', 50, { durationMin: 60, tss: 50 }),
      ...buildWindow('2026-01-05', '2026-05-19', 51, { durationMin: 60, tss: 50 }),
    ]
    const r = analyzeYearOverYear({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('MATCHING')
    expect(Math.abs(r.aggregateTrend)).toBeLessThan(0.10)
  })

  it('classifies BEHIND when volume is -30%', () => {
    const log = [
      ...buildWindow('2025-01-05', '2025-05-19', 50, { durationMin: 60, tss: 50 }),
      ...buildWindow('2026-01-05', '2026-05-19', 35, { durationMin: 60, tss: 50 }),
    ]
    const r = analyzeYearOverYear({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('BEHIND')
    expect(r.aggregateTrend).toBeLessThanOrEqual(-0.10)
  })
})

describe('analyzeYearOverYear — delta math', () => {
  it('computes per-metric deltas correctly', () => {
    // Last year: 50 sessions × 60min × 50 TSS
    // This year: 60 sessions × 90min × 100 TSS
    //   → sessions delta = +0.2
    //   → minutes  delta = +0.8 (60*90 / 50*60 - 1)
    //   → tss      delta = +1.4 (60*100 / 50*50 - 1)
    const log = [
      ...buildWindow('2025-01-05', '2025-05-19', 50, { durationMin: 60, tss: 50 }),
      ...buildWindow('2026-01-05', '2026-05-19', 60, { durationMin: 90, tss: 100 }),
    ]
    const r = analyzeYearOverYear({ log, today: TODAY })
    expect(r).not.toBeNull()

    expect(r.thisYear.sessions).toBe(60)
    expect(r.lastYear.sessions).toBe(50)

    expect(r.thisYear.minutes).toBe(60 * 90)
    expect(r.lastYear.minutes).toBe(50 * 60)

    expect(r.thisYear.tss).toBe(60 * 100)
    expect(r.lastYear.tss).toBe(50 * 50)

    expect(r.deltas.sessions).toBeCloseTo(0.2, 5)
    expect(r.deltas.minutes).toBeCloseTo(0.8, 5)
    expect(r.deltas.tss).toBeCloseTo(1.4, 5)

    // Aggregate = mean of three deltas
    const expectedAgg = (0.2 + 0.8 + 1.4) / 3
    expect(r.aggregateTrend).toBeCloseTo(expectedAgg, 5)
    expect(r.band).toBe('AHEAD')
  })

  it('respects same-calendar-day cutoff for last year', () => {
    // Last year sessions: 25 inside YTD window, 25 after May 19 → only first 25 count.
    const log = [
      ...buildWindow('2025-01-05', '2025-05-19', 25, { durationMin: 60, tss: 50 }),
      ...buildWindow('2025-05-20', '2025-12-31', 25, { durationMin: 60, tss: 50 }),
      ...buildWindow('2026-01-05', '2026-05-19', 25, { durationMin: 60, tss: 50 }),
    ]
    const r = analyzeYearOverYear({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.lastYear.sessions).toBe(25)
    expect(r.thisYear.sessions).toBe(25)
    expect(r.band).toBe('MATCHING')
  })
})

describe('analyzeYearOverYear — partial-data fallback', () => {
  it('falls back to mean of available deltas when one denominator is 0', () => {
    // Construct a log where last-year TSS = 0 (every session has tss=0),
    // but durations and counts are non-zero. The TSS delta should be null,
    // and the aggregate should fall back to the mean of sessions + minutes deltas.
    const log = [
      ...buildWindow('2025-01-05', '2025-05-19', 50, { durationMin: 60, tss: 0 }),
      ...buildWindow('2026-01-05', '2026-05-19', 75, { durationMin: 60, tss: 0 }),
    ]
    const r = analyzeYearOverYear({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.deltas.tss).toBeNull()
    expect(r.deltas.sessions).toBeCloseTo(0.5, 5)
    expect(r.deltas.minutes).toBeCloseTo(0.5, 5)
    // Aggregate must use the two non-null deltas (mean = 0.5)
    expect(r.aggregateTrend).toBeCloseTo(0.5, 5)
    expect(r.band).toBe('AHEAD')
  })

  it('uses default today when not provided (sanity check shape)', () => {
    // Just ensure it doesn't throw and returns either null or a shaped object.
    const log = [{ date: '2025-06-01', durationMin: 60, tss: 50 }]
    const out = analyzeYearOverYear({ log })
    expect(out === null || typeof out === 'object').toBe(true)
  })
})
