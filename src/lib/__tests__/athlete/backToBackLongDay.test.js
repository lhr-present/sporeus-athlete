// src/lib/__tests__/athlete/backToBackLongDay.test.js
//
// Pure-fn tests for analyzeBackToBackLongDay — Issurin 2010 / Daniels 2014 /
// Skorski 2019 back-to-back long-day pattern detector. Covers null gating,
// all 4 bands, ISO week conventions, 3-day streak counting, recovery flag
// boundary at TSS=100, custom thresholds + window sizes, mixed sports,
// duration aggregation, and non-finite input handling.

import { describe, it, expect } from 'vitest'
import {
  analyzeBackToBackLongDay,
  BACK_TO_BACK_LONG_DAY_CITATION,
} from '../../athlete/backToBackLongDay.js'

// 2026-05-17 is a Sunday → current ISO week is 2026-05-11..2026-05-17.
const TODAY = '2026-05-17'

// ─── helpers ────────────────────────────────────────────────────────────────

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function isoAddDays(iso, days) {
  return isoMinusDays(iso, -days)
}

function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

/** Build a back-to-back long-day pair entry on a given Monday-of-week offset. */
function buildPair({ startDate, day1Min = 120, day2Min = 100, sport1 = 'run', sport2 = 'run', followingTss = 0 }) {
  const out = [
    { date: startDate, duration_min: day1Min, sport: sport1, tss: 0 },
    { date: isoAddDays(startDate, 1), duration_min: day2Min, sport: sport2, tss: 0 },
  ]
  if (followingTss > 0) {
    // Split the followingTss across [+2, +3] days. Put it all on +2 for simplicity.
    out.push({ date: isoAddDays(startDate, 2), duration_min: 30, sport: 'easy', tss: followingTss })
  }
  return out
}

// ─── null / empty ───────────────────────────────────────────────────────────

describe('analyzeBackToBackLongDay — null / empty', () => {
  it('returns null when today is undefined', () => {
    expect(analyzeBackToBackLongDay({ log: [], today: undefined })).toBeNull()
  })

  it('returns null when today is a non-ISO string', () => {
    expect(analyzeBackToBackLongDay({ log: [], today: 'not-a-date' })).toBeNull()
    expect(analyzeBackToBackLongDay({ log: [], today: '' })).toBeNull()
  })

  it('returns null when today is an invalid Date', () => {
    expect(analyzeBackToBackLongDay({ log: [], today: new Date('invalid') })).toBeNull()
  })

  it('returns NONE band with empty occurrences for empty log', () => {
    const res = analyzeBackToBackLongDay({ log: [], today: TODAY })
    expect(res).not.toBeNull()
    expect(res.band).toBe('NONE')
    expect(res.occurrences).toEqual([])
    expect(res.totalOccurrences).toBe(0)
    expect(res.flaggedCount).toBe(0)
    expect(res.weeksWithB2B).toBe(0)
  })

  it('returns NONE band when log is null (not an array)', () => {
    const res = analyzeBackToBackLongDay({ log: null, today: TODAY })
    expect(res).not.toBeNull()
    expect(res.band).toBe('NONE')
    expect(res.occurrences).toEqual([])
  })

  it('includes citation in result', () => {
    const res = analyzeBackToBackLongDay({ log: [], today: TODAY })
    expect(res.citation).toBe(BACK_TO_BACK_LONG_DAY_CITATION)
  })
})

// ─── band classification ────────────────────────────────────────────────────

describe('analyzeBackToBackLongDay — band classification', () => {
  it('NONE band when no consecutive long days exist', () => {
    const monday = mondayOf(TODAY)
    const log = [
      { date: isoMinusDays(monday, 7), duration_min: 120, sport: 'run' },
      { date: isoMinusDays(monday, 5), duration_min: 100, sport: 'bike' }, // gap of 2 days → not back-to-back
    ]
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.band).toBe('NONE')
    expect(res.totalOccurrences).toBe(0)
  })

  it('OCCASIONAL band for 1 pair', () => {
    const monday = mondayOf(TODAY)
    const log = buildPair({ startDate: isoMinusDays(monday, 21) })
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.band).toBe('OCCASIONAL')
    expect(res.totalOccurrences).toBe(1)
  })

  it('OCCASIONAL band for 2 pairs in different weeks', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildPair({ startDate: isoMinusDays(monday, 56) }),
      ...buildPair({ startDate: isoMinusDays(monday, 28) }),
    ]
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.band).toBe('OCCASIONAL')
    expect(res.totalOccurrences).toBe(2)
    expect(res.weeksWithB2B).toBe(2)
  })

  it('OCCASIONAL band for 3 pairs', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildPair({ startDate: isoMinusDays(monday, 70) }),
      ...buildPair({ startDate: isoMinusDays(monday, 42) }),
      ...buildPair({ startDate: isoMinusDays(monday, 14) }),
    ]
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.band).toBe('OCCASIONAL')
    expect(res.totalOccurrences).toBe(3)
    expect(res.weeksWithB2B).toBe(3)
  })

  it('BLOCK_STYLE band for 5 clean pairs (no recovery flags)', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildPair({ startDate: isoMinusDays(monday, 70) }),
      ...buildPair({ startDate: isoMinusDays(monday, 56) }),
      ...buildPair({ startDate: isoMinusDays(monday, 42) }),
      ...buildPair({ startDate: isoMinusDays(monday, 28) }),
      ...buildPair({ startDate: isoMinusDays(monday, 14) }),
    ]
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.band).toBe('BLOCK_STYLE')
    expect(res.totalOccurrences).toBe(5)
    expect(res.flaggedCount).toBe(0)
  })

  it('EXCESSIVE band when ≥9 occurrences', () => {
    const monday = mondayOf(TODAY)
    const startOffsets = [77, 70, 63, 56, 49, 42, 35, 28, 21, 14]
    const log = []
    for (const off of startOffsets) {
      log.push(...buildPair({ startDate: isoMinusDays(monday, off) }))
    }
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.totalOccurrences).toBe(10)
    expect(res.band).toBe('EXCESSIVE')
  })

  it('EXCESSIVE band when >50% flagged (3 pairs, 2 flagged)', () => {
    const monday = mondayOf(TODAY)
    // 3 pairs, 2 with followingTwoDaysTss > 100.
    const log = [
      ...buildPair({ startDate: isoMinusDays(monday, 70), followingTss: 0 }),
      ...buildPair({ startDate: isoMinusDays(monday, 42), followingTss: 150 }),
      ...buildPair({ startDate: isoMinusDays(monday, 21), followingTss: 200 }),
    ]
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.totalOccurrences).toBe(3)
    expect(res.flaggedCount).toBe(2)
    expect(res.band).toBe('EXCESSIVE')
  })

  it('BLOCK_STYLE band when exactly 50% flagged (4 pairs, 2 flagged)', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildPair({ startDate: isoMinusDays(monday, 77), followingTss: 0 }),
      ...buildPair({ startDate: isoMinusDays(monday, 56), followingTss: 0 }),
      ...buildPair({ startDate: isoMinusDays(monday, 35), followingTss: 150 }),
      ...buildPair({ startDate: isoMinusDays(monday, 14), followingTss: 200 }),
    ]
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.totalOccurrences).toBe(4)
    expect(res.flaggedCount).toBe(2)
    expect(res.band).toBe('BLOCK_STYLE')
  })
})

// ─── 3-day streak counts as 2 adjacent pairs ────────────────────────────────

describe('analyzeBackToBackLongDay — streak counting', () => {
  it('3-day streak (Mon/Tue/Wed) records 2 adjacent pairs (Mon-Tue, Tue-Wed)', () => {
    const monday = mondayOf(TODAY)
    const start = isoMinusDays(monday, 21)
    const log = [
      { date: start, duration_min: 120, sport: 'run' },
      { date: isoAddDays(start, 1), duration_min: 110, sport: 'run' },
      { date: isoAddDays(start, 2), duration_min: 100, sport: 'bike' },
    ]
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.totalOccurrences).toBe(2)
    expect(res.occurrences[0].startDate).toBe(start)
    expect(res.occurrences[1].startDate).toBe(isoAddDays(start, 1))
  })

  it('4-day streak records 3 adjacent pairs', () => {
    const monday = mondayOf(TODAY)
    const start = isoMinusDays(monday, 21)
    const log = []
    for (let i = 0; i < 4; i++) {
      log.push({ date: isoAddDays(start, i), duration_min: 100, sport: 'run' })
    }
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.totalOccurrences).toBe(3)
  })
})

// ─── custom thresholds + window ─────────────────────────────────────────────

describe('analyzeBackToBackLongDay — custom thresholds + window', () => {
  it('custom longSessionMinThreshold=60 picks up 60+60 days that would not qualify at default 90', () => {
    const monday = mondayOf(TODAY)
    const start = isoMinusDays(monday, 21)
    const log = [
      { date: start, duration_min: 70, sport: 'run' },
      { date: isoAddDays(start, 1), duration_min: 60, sport: 'run' },
    ]
    // Default 90 → 0 pairs.
    expect(analyzeBackToBackLongDay({ log, today: TODAY }).totalOccurrences).toBe(0)
    // Custom 60 → 1 pair.
    const res = analyzeBackToBackLongDay({ log, today: TODAY, longSessionMinThreshold: 60 })
    expect(res.totalOccurrences).toBe(1)
    expect(res.occurrences[0].durationsMin).toEqual([70, 60])
  })

  it('custom windowWeeks=4 excludes pairs older than 4 weeks', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildPair({ startDate: isoMinusDays(monday, 56) }), // 8 weeks back — outside 4-week window
      ...buildPair({ startDate: isoMinusDays(monday, 14) }), // 2 weeks back — inside
    ]
    const res = analyzeBackToBackLongDay({ log, today: TODAY, windowWeeks: 4 })
    expect(res.totalOccurrences).toBe(1)
    expect(res.occurrences[0].startDate).toBe(isoMinusDays(monday, 14))
  })

  it('windowWeeks falls back to default when not finite', () => {
    const monday = mondayOf(TODAY)
    const log = buildPair({ startDate: isoMinusDays(monday, 14) })
    const resNaN = analyzeBackToBackLongDay({ log, today: TODAY, windowWeeks: NaN })
    expect(resNaN.totalOccurrences).toBe(1)
    const resZero = analyzeBackToBackLongDay({ log, today: TODAY, windowWeeks: 0 })
    expect(resZero.totalOccurrences).toBeGreaterThanOrEqual(0)
  })
})

// ─── ISO week boundaries + weeksWithB2B ─────────────────────────────────────

describe('analyzeBackToBackLongDay — ISO week boundary handling', () => {
  it('counts a pair that straddles Sunday→Monday as one occurrence (started on the Sunday)', () => {
    // 2026-05-17 is a Sunday — start on 2026-05-10 (Sunday), straddle to 2026-05-11 (Monday).
    const start = '2026-05-10'
    const log = [
      { date: start, duration_min: 120, sport: 'run' },
      { date: isoAddDays(start, 1), duration_min: 100, sport: 'run' },
    ]
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.totalOccurrences).toBe(1)
    expect(res.occurrences[0].startDate).toBe(start)
  })

  it('counts distinct ISO weeks correctly when multiple pairs land in the same Mon-anchored week', () => {
    // 2026-05-11 (Mon) + 2026-05-12 (Tue) → pair 1
    // 2026-05-12 (Tue) + 2026-05-13 (Wed) → pair 2
    // 2026-05-13 (Wed) + 2026-05-14 (Thu) → pair 3
    // All 3 pairs in the same ISO week (Mon 2026-05-11).
    const log = [
      { date: '2026-05-11', duration_min: 100, sport: 'run' },
      { date: '2026-05-12', duration_min: 100, sport: 'run' },
      { date: '2026-05-13', duration_min: 100, sport: 'bike' },
      { date: '2026-05-14', duration_min: 100, sport: 'bike' },
    ]
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.totalOccurrences).toBe(3)
    expect(res.weeksWithB2B).toBe(1)
  })

  it('counts distinct ISO weeks when pairs straddle a week boundary', () => {
    // Pair A: 2026-05-04 (Mon) + 2026-05-05 (Tue) → week Mon 2026-05-04
    // Pair B: 2026-05-11 (Mon) + 2026-05-12 (Tue) → week Mon 2026-05-11
    const log = [
      { date: '2026-05-04', duration_min: 100, sport: 'run' },
      { date: '2026-05-05', duration_min: 100, sport: 'run' },
      { date: '2026-05-11', duration_min: 100, sport: 'bike' },
      { date: '2026-05-12', duration_min: 100, sport: 'bike' },
    ]
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.totalOccurrences).toBe(2)
    expect(res.weeksWithB2B).toBe(2)
  })
})

// ─── per-day longest aggregation + sport detection ──────────────────────────

describe('analyzeBackToBackLongDay — daily aggregation', () => {
  it('durationsMin reflects the MAX duration per day (not sum)', () => {
    const monday = mondayOf(TODAY)
    const start = isoMinusDays(monday, 14)
    const log = [
      // Day 1: two sessions, 95 and 60 — longest is 95.
      { date: start, duration_min: 95, sport: 'run' },
      { date: start, duration_min: 60, sport: 'easy' },
      // Day 2: two sessions, 100 and 30 — longest is 100.
      { date: isoAddDays(start, 1), duration_min: 30, sport: 'easy' },
      { date: isoAddDays(start, 1), duration_min: 100, sport: 'bike' },
    ]
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.totalOccurrences).toBe(1)
    expect(res.occurrences[0].durationsMin).toEqual([95, 100])
  })

  it('sportPair reflects the sport of each day\'s LONGEST session', () => {
    const monday = mondayOf(TODAY)
    const start = isoMinusDays(monday, 14)
    const log = [
      { date: start, duration_min: 95, sport: 'run' },
      { date: start, duration_min: 60, sport: 'easy' },
      { date: isoAddDays(start, 1), duration_min: 100, sport: 'bike' },
      { date: isoAddDays(start, 1), duration_min: 50, sport: 'swim' },
    ]
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.occurrences[0].sportPair).toEqual(['run', 'bike'])
  })

  it('falls back to entry.type when entry.sport is missing', () => {
    const monday = mondayOf(TODAY)
    const start = isoMinusDays(monday, 14)
    const log = [
      { date: start, duration_min: 120, type: 'long-run' },
      { date: isoAddDays(start, 1), duration_min: 100, type: 'long-ride' },
    ]
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.occurrences[0].sportPair).toEqual(['long-run', 'long-ride'])
  })

  it('ignores non-finite duration_min entries', () => {
    const monday = mondayOf(TODAY)
    const start = isoMinusDays(monday, 14)
    const log = [
      { date: start, duration_min: 'invalid', sport: 'run' },
      { date: start, duration_min: 120, sport: 'run' },
      { date: isoAddDays(start, 1), duration_min: NaN, sport: 'easy' },
      { date: isoAddDays(start, 1), duration_min: 100, sport: 'bike' },
    ]
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.totalOccurrences).toBe(1)
    expect(res.occurrences[0].durationsMin).toEqual([120, 100])
  })

  it('ignores zero / negative duration_min entries', () => {
    const monday = mondayOf(TODAY)
    const start = isoMinusDays(monday, 14)
    const log = [
      { date: start, duration_min: 0, sport: 'rest' },
      { date: isoAddDays(start, 1), duration_min: -50, sport: 'bad' },
    ]
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.totalOccurrences).toBe(0)
  })
})

// ─── followingTwoDaysTss + flaggedNoRecovery ────────────────────────────────

describe('analyzeBackToBackLongDay — recovery flag math', () => {
  it('followingTwoDaysTss sums TSS on [start+2, start+3]', () => {
    const monday = mondayOf(TODAY)
    const start = isoMinusDays(monday, 21)
    const log = [
      { date: start, duration_min: 120, sport: 'run', tss: 50 },
      { date: isoAddDays(start, 1), duration_min: 100, sport: 'bike', tss: 60 },
      { date: isoAddDays(start, 2), duration_min: 45, sport: 'easy', tss: 40 },
      { date: isoAddDays(start, 3), duration_min: 30, sport: 'easy', tss: 35 },
      { date: isoAddDays(start, 4), duration_min: 60, sport: 'tempo', tss: 80 }, // outside +2/+3 window
    ]
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.occurrences[0].followingTwoDaysTss).toBe(75) // 40 + 35
    expect(res.occurrences[0].flaggedNoRecovery).toBe(false) // 75 ≤ 100
  })

  it('flaggedNoRecovery is FALSE at exactly 100 TSS (boundary not flagged)', () => {
    const monday = mondayOf(TODAY)
    const start = isoMinusDays(monday, 21)
    const log = [
      { date: start, duration_min: 120, sport: 'run' },
      { date: isoAddDays(start, 1), duration_min: 100, sport: 'run' },
      { date: isoAddDays(start, 2), duration_min: 45, sport: 'easy', tss: 50 },
      { date: isoAddDays(start, 3), duration_min: 45, sport: 'easy', tss: 50 },
    ]
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.occurrences[0].followingTwoDaysTss).toBe(100)
    expect(res.occurrences[0].flaggedNoRecovery).toBe(false)
  })

  it('flaggedNoRecovery is TRUE just above 100 TSS', () => {
    const monday = mondayOf(TODAY)
    const start = isoMinusDays(monday, 21)
    const log = [
      { date: start, duration_min: 120, sport: 'run' },
      { date: isoAddDays(start, 1), duration_min: 100, sport: 'run' },
      { date: isoAddDays(start, 2), duration_min: 60, sport: 'tempo', tss: 60 },
      { date: isoAddDays(start, 3), duration_min: 60, sport: 'tempo', tss: 50 },
    ]
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.occurrences[0].followingTwoDaysTss).toBe(110)
    expect(res.occurrences[0].flaggedNoRecovery).toBe(true)
  })

  it('flaggedCount matches the count of flagged occurrences', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildPair({ startDate: isoMinusDays(monday, 70), followingTss: 0 }),
      ...buildPair({ startDate: isoMinusDays(monday, 42), followingTss: 150 }),
      ...buildPair({ startDate: isoMinusDays(monday, 14), followingTss: 0 }),
    ]
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.totalOccurrences).toBe(3)
    expect(res.flaggedCount).toBe(1)
  })

  it('ignores non-finite tss values in recovery window', () => {
    const monday = mondayOf(TODAY)
    const start = isoMinusDays(monday, 21)
    const log = [
      { date: start, duration_min: 120, sport: 'run' },
      { date: isoAddDays(start, 1), duration_min: 100, sport: 'run' },
      { date: isoAddDays(start, 2), duration_min: 45, sport: 'easy', tss: 'invalid' },
      { date: isoAddDays(start, 3), duration_min: 45, sport: 'easy', tss: NaN },
    ]
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.occurrences[0].followingTwoDaysTss).toBe(0)
    expect(res.occurrences[0].flaggedNoRecovery).toBe(false)
  })
})

// ─── today as Date vs string ────────────────────────────────────────────────

describe('analyzeBackToBackLongDay — today parameter forms', () => {
  it('accepts today as a Date object', () => {
    const monday = mondayOf(TODAY)
    const log = buildPair({ startDate: isoMinusDays(monday, 14) })
    const todayDate = new Date(TODAY + 'T12:00:00Z')
    const res = analyzeBackToBackLongDay({ log, today: todayDate })
    expect(res).not.toBeNull()
    expect(res.totalOccurrences).toBe(1)
  })

  it('produces identical results for today as Date vs ISO string', () => {
    const monday = mondayOf(TODAY)
    const log = buildPair({ startDate: isoMinusDays(monday, 14) })
    const a = analyzeBackToBackLongDay({ log, today: TODAY })
    const b = analyzeBackToBackLongDay({ log, today: new Date(TODAY + 'T00:00:00Z') })
    expect(a.totalOccurrences).toBe(b.totalOccurrences)
    expect(a.band).toBe(b.band)
  })

  it('accepts an ISO datetime string and slices to date', () => {
    const monday = mondayOf(TODAY)
    const log = buildPair({ startDate: isoMinusDays(monday, 14) })
    const res = analyzeBackToBackLongDay({ log, today: TODAY + 'T18:30:00Z' })
    expect(res).not.toBeNull()
    expect(res.totalOccurrences).toBe(1)
  })
})

// ─── window edge cases ──────────────────────────────────────────────────────

describe('analyzeBackToBackLongDay — window edges', () => {
  it('excludes a pair whose start is before the window', () => {
    const monday = mondayOf(TODAY)
    // 13 weeks back — outside default 12-week window.
    const log = buildPair({ startDate: isoMinusDays(monday, 91) })
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.totalOccurrences).toBe(0)
  })

  it('ignores malformed date strings', () => {
    const log = [
      { date: 'banana', duration_min: 200, sport: 'run' },
      { date: '2026-13-99', duration_min: 200, sport: 'run' },
    ]
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.totalOccurrences).toBe(0)
  })

  it('ignores entries missing a date field', () => {
    const log = [
      { duration_min: 200, sport: 'run' },
      { date: null, duration_min: 200, sport: 'run' },
    ]
    const res = analyzeBackToBackLongDay({ log, today: TODAY })
    expect(res.totalOccurrences).toBe(0)
  })
})
