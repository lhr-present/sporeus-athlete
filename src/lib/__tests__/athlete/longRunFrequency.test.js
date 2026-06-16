// ─── longRunFrequency.test.js — pure-fn coverage ─────────────────────────────
//
// Covers:
//   - guards (null log, bad today, bad window/threshold)
//   - coverage gate (<3 of 6 months with any sessions → null)
//   - all three bands (STRONG_BASE / DEVELOPING / THIN)
//   - monthly bucket math (correct YYYY-MM keys, oldest first)
//   - custom longMinThreshold
//   - threshold semantics (>= threshold counts; < threshold does not)
//   - citation passthrough

import { describe, it, expect } from 'vitest'
import {
  analyzeLongRunFrequency,
  LONG_RUN_FREQUENCY_CITATION,
} from '../../athlete/longRunFrequency.js'

const TODAY = '2026-05-18'

describe('analyzeLongRunFrequency — guards', () => {
  it('returns null when log is not an array', () => {
    expect(analyzeLongRunFrequency({ log: null, today: TODAY })).toBeNull()
    expect(analyzeLongRunFrequency({ log: undefined, today: TODAY })).toBeNull()
    expect(analyzeLongRunFrequency({ log: 'nope', today: TODAY })).toBeNull()
    expect(analyzeLongRunFrequency({ log: 42, today: TODAY })).toBeNull()
  })

  it('returns null when today is missing or non-string', () => {
    expect(analyzeLongRunFrequency({ log: [], today: null })).toBeNull()
    expect(analyzeLongRunFrequency({ log: [], today: 12345 })).toBeNull()
    expect(analyzeLongRunFrequency({ log: [], today: '' })).toBeNull()
  })

  it('returns null when monthsWindow is invalid', () => {
    expect(analyzeLongRunFrequency({ log: [], today: TODAY, monthsWindow: 0 })).toBeNull()
    expect(analyzeLongRunFrequency({ log: [], today: TODAY, monthsWindow: -3 })).toBeNull()
    expect(analyzeLongRunFrequency({ log: [], today: TODAY, monthsWindow: NaN })).toBeNull()
  })

  it('returns null when longMinThreshold is invalid', () => {
    expect(analyzeLongRunFrequency({ log: [], today: TODAY, longMinThreshold: 0 })).toBeNull()
    expect(analyzeLongRunFrequency({ log: [], today: TODAY, longMinThreshold: -10 })).toBeNull()
    expect(analyzeLongRunFrequency({ log: [], today: TODAY, longMinThreshold: NaN })).toBeNull()
  })

  it('returns null for an empty log (no months with data)', () => {
    expect(analyzeLongRunFrequency({ log: [], today: TODAY })).toBeNull()
  })
})

describe('analyzeLongRunFrequency — coverage gate', () => {
  it('returns null when only 2 of 6 months have any sessions', () => {
    // Sessions only in May 2026 and Apr 2026 (today is May).
    const log = [
      { date: '2026-05-01', durationMin: 60 },
      { date: '2026-05-10', durationMin: 40 },
      { date: '2026-04-15', durationMin: 30 },
    ]
    const r = analyzeLongRunFrequency({ log, today: TODAY })
    expect(r).toBeNull()
  })

  it('returns a result when exactly 3 of 6 months have any sessions', () => {
    const log = [
      { date: '2026-05-01', durationMin: 60 },
      { date: '2026-04-15', durationMin: 40 },
      { date: '2026-03-20', durationMin: 30 },
    ]
    const r = analyzeLongRunFrequency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalLongSessions).toBe(0) // none ≥ 90 min
  })

  it('months with ZERO-duration entries do not count as data months', () => {
    // 3 months but with zero-duration entries — those don't count.
    const log = [
      { date: '2026-05-01', durationMin: 0 },
      { date: '2026-04-15', durationMin: 0 },
      { date: '2026-03-20', durationMin: 0 },
    ]
    const r = analyzeLongRunFrequency({ log, today: TODAY })
    expect(r).toBeNull()
  })
})

describe('analyzeLongRunFrequency — bands', () => {
  // Build a log of N long sessions evenly spread across the 6-month window
  // (Dec 2025, Jan, Feb, Mar, Apr, May 2026) so every month has data.
  function evenLongLog(perMonth) {
    const months = ['2025-12-05', '2026-01-05', '2026-02-05', '2026-03-05', '2026-04-05', '2026-05-05']
    const log = []
    for (const day of months) {
      for (let k = 0; k < perMonth; k++) {
        log.push({ date: day, durationMin: 95 })
      }
    }
    return log
  }

  it('classifies STRONG_BASE when avgPerMonth ≥ 3.0', () => {
    // 3 long sessions/month × 6 months = 18 total → 3.0 avg.
    const r = analyzeLongRunFrequency({ log: evenLongLog(3), today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalLongSessions).toBe(18)
    expect(r.avgPerMonth).toBe(3)
    expect(r.band).toBe('STRONG_BASE')
  })

  it('classifies STRONG_BASE when avgPerMonth = 3.0 exactly (≥ boundary)', () => {
    const r = analyzeLongRunFrequency({ log: evenLongLog(3), today: TODAY })
    expect(r.band).toBe('STRONG_BASE')
  })

  it('classifies DEVELOPING when 1.5 ≤ avgPerMonth < 3.0', () => {
    // 2 long sessions/month × 6 months = 12 → 2.0 avg.
    const r = analyzeLongRunFrequency({ log: evenLongLog(2), today: TODAY })
    expect(r.avgPerMonth).toBe(2)
    expect(r.band).toBe('DEVELOPING')
  })

  it('classifies DEVELOPING at the 1.5 boundary exactly', () => {
    // 1.5 × 6 = 9 → arrange as 1,2,1,2,1,2 across the months.
    const days = ['2025-12-05', '2026-01-05', '2026-02-05', '2026-03-05', '2026-04-05', '2026-05-05']
    const counts = [1, 2, 1, 2, 1, 2]
    const log = []
    days.forEach((day, idx) => {
      for (let k = 0; k < counts[idx]; k++) log.push({ date: day, durationMin: 95 })
    })
    const r = analyzeLongRunFrequency({ log, today: TODAY })
    expect(r.totalLongSessions).toBe(9)
    expect(r.avgPerMonth).toBe(1.5)
    expect(r.band).toBe('DEVELOPING')
  })

  it('classifies THIN when avgPerMonth < 1.5', () => {
    // 1 long session/month × 6 months = 6 → 1.0 avg.
    const r = analyzeLongRunFrequency({ log: evenLongLog(1), today: TODAY })
    expect(r.avgPerMonth).toBe(1)
    expect(r.band).toBe('THIN')
  })

  it('classifies THIN with only a few isolated long sessions', () => {
    const log = [
      { date: '2026-05-05', durationMin: 95 },
      { date: '2026-04-10', durationMin: 100 },
      // Plus short filler sessions to satisfy coverage gate.
      { date: '2026-03-10', durationMin: 30 },
      { date: '2026-02-08', durationMin: 25 },
      { date: '2026-01-12', durationMin: 30 },
      { date: '2025-12-12', durationMin: 30 },
    ]
    const r = analyzeLongRunFrequency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalLongSessions).toBe(2)
    // Rounded to 2 decimals: 2/6 = 0.3333… → 0.33
    expect(r.avgPerMonth).toBe(0.33)
    expect(r.band).toBe('THIN')
  })
})

describe('analyzeLongRunFrequency — monthly bucket math', () => {
  it('returns 6 months oldest-first with correct YYYY-MM keys', () => {
    const log = [
      { date: '2025-12-05', durationMin: 30 },
      { date: '2026-01-05', durationMin: 30 },
      { date: '2026-02-05', durationMin: 30 },
      { date: '2026-03-05', durationMin: 30 },
      { date: '2026-04-05', durationMin: 30 },
      { date: '2026-05-05', durationMin: 30 },
    ]
    const r = analyzeLongRunFrequency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.months.map(m => m.month)).toEqual([
      '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05',
    ])
    expect(r.months.map(m => m.monthLabel)).toEqual([
      'DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY',
    ])
  })

  it('counts exactly one qualifying session per month bucket', () => {
    const log = [
      { date: '2026-05-01', durationMin: 95 },
      { date: '2026-05-15', durationMin: 100 },
      { date: '2026-04-10', durationMin: 120 },
      { date: '2026-03-05', durationMin: 90 }, // exactly the threshold → counts
      { date: '2026-02-05', durationMin: 30 }, // below threshold → does NOT count
      { date: '2026-01-12', durationMin: 95 },
      { date: '2025-12-12', durationMin: 30 }, // below threshold
    ]
    const r = analyzeLongRunFrequency({ log, today: TODAY })
    expect(r).not.toBeNull()
    const byMonth = Object.fromEntries(r.months.map(m => [m.month, m.count]))
    expect(byMonth['2026-05']).toBe(2)
    expect(byMonth['2026-04']).toBe(1)
    expect(byMonth['2026-03']).toBe(1)
    expect(byMonth['2026-02']).toBe(0)
    expect(byMonth['2026-01']).toBe(1)
    expect(byMonth['2025-12']).toBe(0)
    expect(r.totalLongSessions).toBe(5)
  })

  it('ignores entries outside the 6-month window', () => {
    const log = [
      // In-window sessions (3 months → satisfy coverage gate).
      { date: '2026-05-01', durationMin: 95 },
      { date: '2026-04-01', durationMin: 95 },
      { date: '2026-03-01', durationMin: 95 },
      // Way out-of-window — must NOT count.
      { date: '2025-06-01', durationMin: 95 },
      { date: '2024-12-01', durationMin: 95 },
      { date: '2027-01-01', durationMin: 95 }, // future, also ignored
    ]
    const r = analyzeLongRunFrequency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalLongSessions).toBe(3)
  })

  it('handles year boundary correctly (Dec→Jan transition)', () => {
    const log = [
      { date: '2025-12-15', durationMin: 95 },
      { date: '2026-01-15', durationMin: 95 },
      { date: '2026-02-15', durationMin: 95 },
    ]
    const r = analyzeLongRunFrequency({ log, today: TODAY })
    expect(r).not.toBeNull()
    const dec = r.months.find(m => m.month === '2025-12')
    const jan = r.months.find(m => m.month === '2026-01')
    expect(dec.count).toBe(1)
    expect(jan.count).toBe(1)
  })

  it('skips entries with malformed or missing date', () => {
    const log = [
      { date: '2026-05-01', durationMin: 95 },
      { date: '2026-04-01', durationMin: 95 },
      { date: '2026-03-01', durationMin: 95 },
      { date: null, durationMin: 95 },
      { durationMin: 95 },
      { date: 'not-a-date', durationMin: 95 },
    ]
    const r = analyzeLongRunFrequency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalLongSessions).toBe(3)
  })
})

describe('analyzeLongRunFrequency — custom longMinThreshold', () => {
  it('respects a higher custom threshold', () => {
    const log = [
      // 3 months with data — all sessions are 90 min.
      { date: '2026-05-05', durationMin: 90 },
      { date: '2026-04-05', durationMin: 90 },
      { date: '2026-03-05', durationMin: 90 },
    ]
    // With threshold=120, none of the 90-min sessions count.
    const r = analyzeLongRunFrequency({ log, today: TODAY, longMinThreshold: 120 })
    expect(r).not.toBeNull()
    expect(r.totalLongSessions).toBe(0)
    expect(r.longMinThreshold).toBe(120)
  })

  it('respects a lower custom threshold', () => {
    const log = [
      { date: '2026-05-05', durationMin: 45 },
      { date: '2026-04-05', durationMin: 45 },
      { date: '2026-03-05', durationMin: 45 },
      { date: '2026-02-05', durationMin: 45 },
      { date: '2026-01-05', durationMin: 45 },
      { date: '2025-12-05', durationMin: 45 },
    ]
    const r = analyzeLongRunFrequency({ log, today: TODAY, longMinThreshold: 40 })
    expect(r).not.toBeNull()
    expect(r.totalLongSessions).toBe(6)
    expect(r.avgPerMonth).toBe(1)
    expect(r.longMinThreshold).toBe(40)
  })
})

describe('analyzeLongRunFrequency — citation', () => {
  it('exposes the citation string', () => {
    const log = [
      { date: '2026-05-05', durationMin: 95 },
      { date: '2026-04-05', durationMin: 95 },
      { date: '2026-03-05', durationMin: 95 },
    ]
    const r = analyzeLongRunFrequency({ log, today: TODAY })
    expect(r.citation).toBe(LONG_RUN_FREQUENCY_CITATION)
    expect(r.citation).toMatch(/Daniels 2014/)
    expect(r.citation).toMatch(/Lydiard 1978/)
    expect(r.citation).toMatch(/Maffetone 2010/)
  })
})

// ─── sanitized `duration` field fallback (regression) ───────────────────────
describe('analyzeLongRunFrequency — duration field fallback', () => {
  it('counts long sessions stored as sanitized `duration` (minutes)', () => {
    const log = [
      { date: '2026-05-01', duration: 120 },
      { date: '2026-04-15', duration: 100 },
      { date: '2026-03-20', duration: 95 },
    ]
    const r = analyzeLongRunFrequency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalLongSessions).toBe(3)
  })
})
