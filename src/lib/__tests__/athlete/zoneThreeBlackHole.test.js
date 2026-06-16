// Z3 Black Hole — lib tests
// Window = 8 ISO weeks ending in the week of `today`.
// today = '2026-04-30' (Thu) → currentMonday = '2026-04-27'
// → window oldest Monday = '2026-03-09'.
import { describe, it, expect } from 'vitest'
import {
  analyzeZoneThreeBlackHole,
  ZONE_THREE_BLACK_HOLE_CITATION,
} from '../../athlete/zoneThreeBlackHole.js'
import { sanitizeLogEntry } from '../../validate.js'

const TODAY = '2026-04-30'
const OLDEST_MONDAY = '2026-03-09'

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function entry(date, durationMin, extras = {}) {
  return { date, durationMin, ...extras }
}

// ─── Null gates ─────────────────────────────────────────────────────────────
describe('analyzeZoneThreeBlackHole — null gates', () => {
  it('returns null when today is missing or unresolvable', () => {
    expect(analyzeZoneThreeBlackHole({ log: [], today: null })).toBeNull()
    expect(analyzeZoneThreeBlackHole({ log: [], today: '' })).toBeNull()
    expect(analyzeZoneThreeBlackHole({ log: [], today: 'not-a-date' })).toBeNull()
    expect(analyzeZoneThreeBlackHole({ log: [], today: undefined })).toBeNull()
  })

  it('returns null when today is an invalid Date', () => {
    expect(analyzeZoneThreeBlackHole({ log: [], today: new Date('not-a-date') })).toBeNull()
  })

  it('returns a populated result (not null) when log is empty but today is valid', () => {
    const r = analyzeZoneThreeBlackHole({ log: [], today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('INSUFFICIENT_HARD_VOLUME')
    expect(r.totalZ3Min).toBe(0)
    expect(r.totalHardMin).toBe(0)
    expect(r.z3ToHardRatio).toBeNull()
    expect(r.z3SharePct).toBe(0)
    expect(r.weeks).toHaveLength(8)
  })
})

// ─── INSUFFICIENT_HARD_VOLUME ───────────────────────────────────────────────
describe('analyzeZoneThreeBlackHole — INSUFFICIENT_HARD_VOLUME', () => {
  it('flags INSUFFICIENT_HARD_VOLUME when Z3+HARD < 60 min in the window', () => {
    const log = [
      entry(OLDEST_MONDAY, 30, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 7), 20, { zone: 'Z4' }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_HARD_VOLUME')
    expect(r.totalZ3Min).toBe(30)
    expect(r.totalHardMin).toBe(20)
  })

  it('flags INSUFFICIENT_HARD_VOLUME when total is exactly 59 min', () => {
    const log = [
      entry(OLDEST_MONDAY, 30, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 29, { zone: 'Z4' }),
    ]
    expect(analyzeZoneThreeBlackHole({ log, today: TODAY }).band)
      .toBe('INSUFFICIENT_HARD_VOLUME')
  })

  it('does NOT flag INSUFFICIENT when total is exactly 60 min', () => {
    const log = [
      entry(OLDEST_MONDAY, 30, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 30, { zone: 'Z4' }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.band).not.toBe('INSUFFICIENT_HARD_VOLUME')
  })
})

// ─── Band classification ────────────────────────────────────────────────────
describe('analyzeZoneThreeBlackHole — band classification', () => {
  it('classifies POLARIZED when Z3 share < 25%', () => {
    // 20 min Z3 + 80 min HARD → share = 20%
    const log = [
      entry(OLDEST_MONDAY, 20, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 80, { zone: 'Z4' }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.band).toBe('POLARIZED')
    expect(r.z3SharePct).toBe(20)
  })

  it('classifies POLARIZED at boundary 24.99%', () => {
    // 24 min Z3 + 76 min HARD → 24%
    const log = [
      entry(OLDEST_MONDAY, 24, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 76, { zone: 'Z4' }),
    ]
    expect(analyzeZoneThreeBlackHole({ log, today: TODAY }).band).toBe('POLARIZED')
  })

  it('classifies BALANCED at boundary 25%', () => {
    // 25 min Z3 + 75 min HARD → 25%
    const log = [
      entry(OLDEST_MONDAY, 25, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 75, { zone: 'Z4' }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.band).toBe('BALANCED')
    expect(r.z3SharePct).toBe(25)
  })

  it('classifies BALANCED in the middle of the range', () => {
    // 40 min Z3 + 60 min HARD → 40%
    const log = [
      entry(OLDEST_MONDAY, 40, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 60, { zone: 'Z4' }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.band).toBe('BALANCED')
  })

  it('classifies BALANCED just under boundary 59.99%', () => {
    // 59 min Z3 + 41 min HARD → 59%
    const log = [
      entry(OLDEST_MONDAY, 59, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 41, { zone: 'Z4' }),
    ]
    expect(analyzeZoneThreeBlackHole({ log, today: TODAY }).band).toBe('BALANCED')
  })

  it('classifies BLACK_HOLE at boundary 60%', () => {
    // 60 min Z3 + 40 min HARD → 60%
    const log = [
      entry(OLDEST_MONDAY, 60, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 40, { zone: 'Z4' }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.band).toBe('BLACK_HOLE')
    expect(r.z3SharePct).toBe(60)
  })

  it('classifies BLACK_HOLE when Z3 dominates (90%)', () => {
    // 90 min Z3 + 10 min HARD → 90%
    const log = [
      entry(OLDEST_MONDAY, 90, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 10, { zone: 'Z4' }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.band).toBe('BLACK_HOLE')
    expect(r.z3SharePct).toBe(90)
  })
})

// ─── Zone string parsing ────────────────────────────────────────────────────
describe('analyzeZoneThreeBlackHole — zone string parsing', () => {
  it('matches lowercase z3 as Z3', () => {
    const log = [
      entry(OLDEST_MONDAY, 100, { zone: 'z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 100, { zone: 'z4' }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.totalZ3Min).toBe(100)
    expect(r.totalHardMin).toBe(100)
  })

  it('matches uppercase Z3 as Z3', () => {
    const log = [
      entry(OLDEST_MONDAY, 50, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 50, { zone: 'Z5' }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.totalZ3Min).toBe(50)
    expect(r.totalHardMin).toBe(50)
  })

  it('matches Z4 and Z5 as HARD (combined)', () => {
    const log = [
      entry(OLDEST_MONDAY, 30, { zone: 'Z4' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 40, { zone: 'Z5' }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.totalHardMin).toBe(70)
    expect(r.totalZ3Min).toBe(0)
  })

  it('skips Z1 and Z2 (easy zones) entirely', () => {
    const log = [
      entry(OLDEST_MONDAY, 200, { zone: 'Z1' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 200, { zone: 'Z2' }),
      entry(addDaysStr(OLDEST_MONDAY, 2), 30, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 3), 30, { zone: 'Z4' }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.totalZ3Min).toBe(30)
    expect(r.totalHardMin).toBe(30)
  })

  it('trims and handles mixed case (  Z3  )', () => {
    const log = [
      entry(OLDEST_MONDAY, 50, { zone: '  Z3  ' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 50, { zone: 'z4' }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.totalZ3Min).toBe(50)
    expect(r.totalHardMin).toBe(50)
  })
})

// ─── RPE fallback ───────────────────────────────────────────────────────────
describe('analyzeZoneThreeBlackHole — RPE fallback', () => {
  it('classifies RPE 5 as Z3', () => {
    const log = [
      entry(OLDEST_MONDAY, 100, { rpe: 5 }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 50, { rpe: 7 }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.totalZ3Min).toBe(100)
    expect(r.totalHardMin).toBe(50)
  })

  it('classifies RPE 6 as Z3', () => {
    const log = [
      entry(OLDEST_MONDAY, 80, { rpe: 6 }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 50, { rpe: 8 }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.totalZ3Min).toBe(80)
    expect(r.totalHardMin).toBe(50)
  })

  it('classifies RPE 7 as HARD', () => {
    const log = [
      entry(OLDEST_MONDAY, 70, { rpe: 7 }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 30, { rpe: 5 }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.totalHardMin).toBe(70)
    expect(r.totalZ3Min).toBe(30)
  })

  it('classifies RPE 9 and 10 as HARD', () => {
    const log = [
      entry(OLDEST_MONDAY, 40, { rpe: 9 }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 40, { rpe: 10 }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.totalHardMin).toBe(80)
    expect(r.totalZ3Min).toBe(0)
  })

  it('skips RPE 4 and below (treated as easy / not counted)', () => {
    const log = [
      entry(OLDEST_MONDAY, 300, { rpe: 1 }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 300, { rpe: 4 }),
      entry(addDaysStr(OLDEST_MONDAY, 2), 50, { rpe: 6 }),
      entry(addDaysStr(OLDEST_MONDAY, 3), 50, { rpe: 8 }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.totalZ3Min).toBe(50)
    expect(r.totalHardMin).toBe(50)
  })

  it('zone takes precedence over RPE (z3 + rpe=8 → Z3)', () => {
    const log = [
      entry(OLDEST_MONDAY, 60, { zone: 'Z3', rpe: 8 }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 60, { zone: 'Z4', rpe: 5 }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.totalZ3Min).toBe(60)
    expect(r.totalHardMin).toBe(60)
  })
})

// ─── Unclassifiable / skipped entries ───────────────────────────────────────
describe('analyzeZoneThreeBlackHole — unclassifiable entries', () => {
  it('skips entries with no zone and no rpe', () => {
    const log = [
      entry(OLDEST_MONDAY, 1000), // no zone, no rpe → skip
      entry(addDaysStr(OLDEST_MONDAY, 1), 50, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 2), 50, { zone: 'Z4' }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.totalZ3Min).toBe(50)
    expect(r.totalHardMin).toBe(50)
  })

  it('skips entries with durationMin <= 0', () => {
    const log = [
      entry(OLDEST_MONDAY, 0, { zone: 'Z3' }),         // 0 → skip
      entry(addDaysStr(OLDEST_MONDAY, 1), -5, { zone: 'Z4' }), // negative → skip
      entry(addDaysStr(OLDEST_MONDAY, 2), 50, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 3), 50, { zone: 'Z4' }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.totalZ3Min).toBe(50)
    expect(r.totalHardMin).toBe(50)
  })

  it('skips entries with non-finite durationMin', () => {
    const log = [
      { date: OLDEST_MONDAY, durationMin: NaN, zone: 'Z3' },
      { date: addDaysStr(OLDEST_MONDAY, 1), durationMin: 'abc', zone: 'Z4' },
      entry(addDaysStr(OLDEST_MONDAY, 2), 60, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 3), 60, { zone: 'Z4' }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.totalZ3Min).toBe(60)
    expect(r.totalHardMin).toBe(60)
  })
})

// ─── Ratio math ─────────────────────────────────────────────────────────────
describe('analyzeZoneThreeBlackHole — ratio math', () => {
  it('z3ToHardRatio is null when totalHardMin === 0', () => {
    const log = [
      entry(OLDEST_MONDAY, 100, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 50, { zone: 'Z3' }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.z3ToHardRatio).toBeNull()
    expect(r.totalHardMin).toBe(0)
    expect(r.totalZ3Min).toBe(150)
  })

  it('computes ratio = 1.4 when z3=70, hard=50', () => {
    const log = [
      entry(OLDEST_MONDAY, 70, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 50, { zone: 'Z4' }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.z3ToHardRatio).toBe(1.4)
  })

  it('computes ratio = 0.5 when z3=30, hard=60', () => {
    const log = [
      entry(OLDEST_MONDAY, 30, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 60, { zone: 'Z4' }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.z3ToHardRatio).toBe(0.5)
  })
})

// ─── Share % math ───────────────────────────────────────────────────────────
describe('analyzeZoneThreeBlackHole — share % math', () => {
  it('rounds share % to 2 decimal places', () => {
    // 1 min Z3 + 2 min Z4 → 33.3333…% but window < 60 → still INSUFFICIENT
    // Use 21 + 42 = 63 (>=60). 21/63 = 0.3333… → 33.33
    const log = [
      entry(OLDEST_MONDAY, 21, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 42, { zone: 'Z4' }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.z3SharePct).toBe(33.33)
  })

  it('share % is 0 when both totals are 0', () => {
    const r = analyzeZoneThreeBlackHole({ log: [], today: TODAY })
    expect(r.z3SharePct).toBe(0)
  })

  it('share % is 100 when only Z3 is logged', () => {
    const log = [
      entry(OLDEST_MONDAY, 100, { zone: 'Z3' }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.z3SharePct).toBe(100)
  })
})

// ─── durationMin vs duration_min ────────────────────────────────────────────
describe('analyzeZoneThreeBlackHole — durationMin vs duration_min', () => {
  it('accepts durationMin', () => {
    const log = [
      { date: OLDEST_MONDAY, durationMin: 50, zone: 'Z3' },
      { date: addDaysStr(OLDEST_MONDAY, 1), durationMin: 50, zone: 'Z4' },
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.totalZ3Min).toBe(50)
    expect(r.totalHardMin).toBe(50)
  })

  it('accepts duration_min as fallback', () => {
    const log = [
      { date: OLDEST_MONDAY, duration_min: 50, zone: 'Z3' },
      { date: addDaysStr(OLDEST_MONDAY, 1), duration_min: 50, zone: 'Z4' },
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.totalZ3Min).toBe(50)
    expect(r.totalHardMin).toBe(50)
  })

  it('prefers durationMin over duration_min when both present', () => {
    const log = [
      { date: OLDEST_MONDAY, durationMin: 80, duration_min: 999, zone: 'Z3' },
      { date: addDaysStr(OLDEST_MONDAY, 1), durationMin: 20, duration_min: 1, zone: 'Z4' },
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.totalZ3Min).toBe(80)
    expect(r.totalHardMin).toBe(20)
  })
})

// ─── Custom windowWeeks ─────────────────────────────────────────────────────
describe('analyzeZoneThreeBlackHole — custom windowWeeks', () => {
  it('respects custom windowWeeks=4 (only 4 weeks returned)', () => {
    const log = [
      entry(OLDEST_MONDAY, 60, { zone: 'Z3' }), // 2026-03-09 — outside 4w window
      entry(addDaysStr(OLDEST_MONDAY, 7 * 5), 60, { zone: 'Z3' }), // inside 4w window
      entry(addDaysStr(OLDEST_MONDAY, 7 * 6), 60, { zone: 'Z4' }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY, windowWeeks: 4 })
    expect(r.weeks).toHaveLength(4)
    expect(r.totalZ3Min).toBe(60) // first Z3 entry excluded
    expect(r.totalHardMin).toBe(60)
  })

  it('respects windowWeeks=12 (returns 12 weeks)', () => {
    const r = analyzeZoneThreeBlackHole({ log: [], today: TODAY, windowWeeks: 12 })
    expect(r.weeks).toHaveLength(12)
  })

  it('defaults to 8 weeks when windowWeeks is omitted', () => {
    const r = analyzeZoneThreeBlackHole({ log: [], today: TODAY })
    expect(r.weeks).toHaveLength(8)
  })

  it('coerces invalid windowWeeks to default (8)', () => {
    const r = analyzeZoneThreeBlackHole({ log: [], today: TODAY, windowWeeks: 'abc' })
    expect(r.weeks).toHaveLength(8)
  })
})

// ─── ISO week boundary ──────────────────────────────────────────────────────
describe('analyzeZoneThreeBlackHole — ISO week boundary', () => {
  it('current Monday is the last week in the window', () => {
    // TODAY = '2026-04-30' (Thu) → currentMonday = '2026-04-27'
    const log = [entry('2026-04-27', 60, { zone: 'Z3' })] // Mon of current week
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.weeks[r.weeks.length - 1].weekStart).toBe('2026-04-27')
    expect(r.weeks[r.weeks.length - 1].z3Min).toBe(60)
  })

  it('Sunday belongs to the same ISO week as the preceding Monday', () => {
    // Sunday 2026-05-03 belongs to week 2026-04-27 (still in window).
    const log = [entry('2026-05-03', 60, { zone: 'Z3' })]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    // But 2026-05-03 > TODAY. The window cutoff is currentMonday + 7 exclusive,
    // i.e. <= '2026-05-04'. Sunday 2026-05-03 falls within window.
    const lastWeek = r.weeks[r.weeks.length - 1]
    expect(lastWeek.weekStart).toBe('2026-04-27')
    expect(lastWeek.z3Min).toBe(60)
  })

  it('excludes entries older than the oldest week (windowWeeks=8)', () => {
    const beforeWindow = addDaysStr(OLDEST_MONDAY, -1) // 2026-03-08 = Sunday belongs to 2026-03-02 week → outside
    const log = [
      entry(beforeWindow, 200, { zone: 'Z3' }),
      entry(OLDEST_MONDAY, 30, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 30, { zone: 'Z4' }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.totalZ3Min).toBe(30)
    expect(r.totalHardMin).toBe(30)
  })

  it('weeks are ordered oldest first', () => {
    const r = analyzeZoneThreeBlackHole({ log: [], today: TODAY })
    expect(r.weeks[0].weekStart).toBe('2026-03-09')
    expect(r.weeks[7].weekStart).toBe('2026-04-27')
  })
})

// ─── today as Date vs string ────────────────────────────────────────────────
describe('analyzeZoneThreeBlackHole — today input forms', () => {
  it('accepts today as a Date object', () => {
    const r = analyzeZoneThreeBlackHole({ log: [], today: new Date(TODAY + 'T12:00:00Z') })
    expect(r).not.toBeNull()
    expect(r.weeks).toHaveLength(8)
    expect(r.weeks[7].weekStart).toBe('2026-04-27')
  })

  it('accepts today as an ISO string', () => {
    const r = analyzeZoneThreeBlackHole({ log: [], today: TODAY })
    expect(r).not.toBeNull()
    expect(r.weeks[7].weekStart).toBe('2026-04-27')
  })

  it('accepts longer ISO strings (slices first 10 chars)', () => {
    const r = analyzeZoneThreeBlackHole({ log: [], today: TODAY + 'T15:30:00Z' })
    expect(r).not.toBeNull()
    expect(r.weeks[7].weekStart).toBe('2026-04-27')
  })
})

// ─── Shape + citation ───────────────────────────────────────────────────────
describe('analyzeZoneThreeBlackHole — shape & citation', () => {
  it('returns the documented shape', () => {
    const log = [
      entry(OLDEST_MONDAY, 30, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 30, { zone: 'Z4' }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r).toHaveProperty('band')
    expect(r).toHaveProperty('weeks')
    expect(r).toHaveProperty('totalZ3Min')
    expect(r).toHaveProperty('totalHardMin')
    expect(r).toHaveProperty('z3ToHardRatio')
    expect(r).toHaveProperty('z3SharePct')
    expect(r).toHaveProperty('citation')
  })

  it('exports the correct citation constant', () => {
    expect(ZONE_THREE_BLACK_HOLE_CITATION).toBe('Seiler 2010; Stöggl 2014')
  })

  it('result.citation equals the exported constant', () => {
    const r = analyzeZoneThreeBlackHole({ log: [], today: TODAY })
    expect(r.citation).toBe(ZONE_THREE_BLACK_HOLE_CITATION)
  })

  it('each week entry has the expected shape', () => {
    const r = analyzeZoneThreeBlackHole({ log: [], today: TODAY })
    for (const w of r.weeks) {
      expect(w).toHaveProperty('weekStart')
      expect(w).toHaveProperty('z3Min')
      expect(w).toHaveProperty('hardMin')
      expect(typeof w.weekStart).toBe('string')
      expect(typeof w.z3Min).toBe('number')
      expect(typeof w.hardMin).toBe('number')
    }
  })
})

// ─── Per-week aggregation ───────────────────────────────────────────────────
describe('analyzeZoneThreeBlackHole — per-week aggregation', () => {
  it('aggregates multiple sessions in the same day correctly', () => {
    const log = [
      entry(OLDEST_MONDAY, 20, { zone: 'Z3' }),
      entry(OLDEST_MONDAY, 30, { zone: 'Z3' }),
      entry(OLDEST_MONDAY, 40, { zone: 'Z4' }),
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.weeks[0].z3Min).toBe(50)
    expect(r.weeks[0].hardMin).toBe(40)
  })

  it('distributes sessions across distinct weeks correctly', () => {
    const log = [
      entry(OLDEST_MONDAY, 60, { zone: 'Z3' }),                       // wk 0
      entry(addDaysStr(OLDEST_MONDAY, 7), 60, { zone: 'Z4' }),        // wk 1
      entry(addDaysStr(OLDEST_MONDAY, 14), 60, { zone: 'Z5' }),       // wk 2
    ]
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r.weeks[0].z3Min).toBe(60)
    expect(r.weeks[0].hardMin).toBe(0)
    expect(r.weeks[1].z3Min).toBe(0)
    expect(r.weeks[1].hardMin).toBe(60)
    expect(r.weeks[2].z3Min).toBe(0)
    expect(r.weeks[2].hardMin).toBe(60)
  })
})

// ─── Round-trip through sanitizeLogEntry (dead-card regression guard) ────────
// The sanitizer strips `zone` and renames `durationMin` → `duration`. Pre-fix
// the card summed `e.durationMin`, so it counted 0 minutes on every real
// (sanitized) entry while raw-field tests passed. After sanitization the entry
// has no `zone`, so classification falls back to `rpe` (preserved) and reads
// the emitted `duration`. This proves the card produces real non-null buckets.
describe('analyzeZoneThreeBlackHole — sanitized round-trip', () => {
  it('counts z3/hard minutes from sanitizer-emitted duration + rpe (zone stripped)', () => {
    // The app stores `duration`; build entries with it directly (the `entry()`
    // helper uses the legacy `durationMin`, which the sanitizer ignores). zone
    // is intentionally omitted because the sanitizer would strip it anyway, so
    // classification falls back to rpe (Z3 = rpe 5-6, HARD = rpe ≥7).
    const raw = [
      { date: OLDEST_MONDAY,               duration: 60, rpe: 5 }, // Z3
      { date: addDaysStr(OLDEST_MONDAY, 1), duration: 60, rpe: 6 }, // Z3
      { date: addDaysStr(OLDEST_MONDAY, 2), duration: 60, rpe: 8 }, // HARD
    ]
    const log = raw.map(sanitizeLogEntry)
    expect(log[0].zone).toBeUndefined()
    expect(log[0].durationMin).toBeUndefined()
    expect(log[0].duration).toBe(60)
    const r = analyzeZoneThreeBlackHole({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalZ3Min).toBe(120)
    expect(r.totalHardMin).toBe(60)
    expect(r.band).not.toBe('INSUFFICIENT_HARD_VOLUME')
  })
})
