// src/lib/__tests__/athlete/postLongRunNextDay.test.js
//
// Pure-fn tests for analyzePostLongRunNextDay — Daniels 2014 / Pfitzinger
// 2014 post-long-run next-day pattern detector. Covers null gating, all 4
// bands, classification boundaries, duration field variants, sport filter,
// custom thresholds + windows, ISO week edges, and Date vs string today.

import { describe, it, expect } from 'vitest'
import {
  analyzePostLongRunNextDay,
  POST_LONG_RUN_NEXT_DAY_CITATION,
} from '../../athlete/postLongRunNextDay.js'

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

/** Build a long-run entry + an optional next-day entry. */
function buildLongRun({ longRunDate, longRunMin = 120, sport = 'run', nextDayTss = 0, nextDayDurMin = 0, nextDaySport = 'easy' }) {
  const out = [
    { date: longRunDate, duration_min: longRunMin, sport, tss: 0 },
  ]
  if (nextDayTss > 0 || nextDayDurMin > 0) {
    out.push({
      date: isoAddDays(longRunDate, 1),
      duration_min: nextDayDurMin,
      sport: nextDaySport,
      tss: nextDayTss,
    })
  }
  return out
}

// ─── null / empty ───────────────────────────────────────────────────────────

describe('analyzePostLongRunNextDay — null / empty', () => {
  it('returns null when today is undefined', () => {
    expect(analyzePostLongRunNextDay({ log: [], today: undefined })).toBeNull()
  })

  it('returns null when today is a non-ISO string', () => {
    expect(analyzePostLongRunNextDay({ log: [], today: 'not-a-date' })).toBeNull()
    expect(analyzePostLongRunNextDay({ log: [], today: '' })).toBeNull()
  })

  it('returns null when today is an invalid Date', () => {
    expect(analyzePostLongRunNextDay({ log: [], today: new Date('invalid') })).toBeNull()
  })

  it('returns null for empty log (no long runs → nothing to show)', () => {
    expect(analyzePostLongRunNextDay({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null when log is null (not an array)', () => {
    expect(analyzePostLongRunNextDay({ log: null, today: TODAY })).toBeNull()
  })

  it('returns null when the log has entries but no long runs', () => {
    const monday = mondayOf(TODAY)
    const log = [
      { date: isoMinusDays(monday, 14), duration_min: 60, sport: 'run' },
      { date: isoMinusDays(monday, 7), duration_min: 45, sport: 'run' },
    ]
    expect(analyzePostLongRunNextDay({ log, today: TODAY })).toBeNull()
  })

  it('includes citation in result', () => {
    const monday = mondayOf(TODAY)
    const log = buildLongRun({ longRunDate: isoMinusDays(monday, 14) })
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res.citation).toBe(POST_LONG_RUN_NEXT_DAY_CITATION)
  })
})

// ─── band classification ────────────────────────────────────────────────────

describe('analyzePostLongRunNextDay — band classification', () => {
  it('INSUFFICIENT_LONG_RUNS band for exactly 1 long run', () => {
    const monday = mondayOf(TODAY)
    const log = buildLongRun({ longRunDate: isoMinusDays(monday, 14) })
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res.band).toBe('INSUFFICIENT_LONG_RUNS')
    expect(res.totalLongRuns).toBe(1)
  })

  it('INSUFFICIENT_LONG_RUNS band for 2 long runs', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 28) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 14) }),
    ]
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res.band).toBe('INSUFFICIENT_LONG_RUNS')
    expect(res.totalLongRuns).toBe(2)
  })

  it('INSUFFICIENT_LONG_RUNS band for 3 long runs', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 42) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 28) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 14) }),
    ]
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res.band).toBe('INSUFFICIENT_LONG_RUNS')
    expect(res.totalLongRuns).toBe(3)
  })

  it('IDEAL_RECOVERY band when ≥75% of next days are rest or easy (4 long runs, all rest)', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 49) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 35) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 21) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 7) }),
    ]
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res.band).toBe('IDEAL_RECOVERY')
    expect(res.totalLongRuns).toBe(4)
    expect(res.restDays).toBe(4)
    expect(res.restOrEasyShare).toBe(1)
  })

  it('IDEAL_RECOVERY band at exactly 75% rest+easy (3/4)', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 49) }), // rest
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 35), nextDayTss: 30, nextDayDurMin: 45 }), // easy
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 21), nextDayTss: 35, nextDayDurMin: 50 }), // easy
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 7), nextDayTss: 90, nextDayDurMin: 60 }),  // hard
    ]
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res.restDays).toBe(1)
    expect(res.easyDays).toBe(2)
    expect(res.hardDays).toBe(1)
    expect(res.restOrEasyShare).toBe(0.75)
    expect(res.band).toBe('IDEAL_RECOVERY')
  })

  it('AGGRESSIVE_FOLLOWUP band when ≥40% of next days are hard (4 long runs, 2 hard)', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 49), nextDayTss: 100, nextDayDurMin: 60 }), // hard
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 35), nextDayTss: 100, nextDayDurMin: 60 }), // hard
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 21), nextDayTss: 30, nextDayDurMin: 45 }),  // easy
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 7) }),                                      // rest
    ]
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res.hardDays).toBe(2)
    expect(res.band).toBe('AGGRESSIVE_FOLLOWUP')
  })

  it('AGGRESSIVE_FOLLOWUP band when ≥40% hard even with some rest (5 long runs, 2 hard)', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 56), nextDayTss: 100, nextDayDurMin: 60 }), // hard
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 42), nextDayTss: 100, nextDayDurMin: 60 }), // hard
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 28) }),                                     // rest
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 14), nextDayTss: 30, nextDayDurMin: 45 }),  // easy
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 7), nextDayTss: 60, nextDayDurMin: 60 }),   // moderate
    ]
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res.hardDays).toBe(2)
    expect(res.band).toBe('AGGRESSIVE_FOLLOWUP') // 2/5 = 0.40 → AGGRESSIVE
  })

  it('MIXED band when neither IDEAL nor AGGRESSIVE thresholds met', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 49), nextDayTss: 60, nextDayDurMin: 60 }),  // moderate
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 35), nextDayTss: 60, nextDayDurMin: 60 }),  // moderate
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 21), nextDayTss: 30, nextDayDurMin: 45 }),  // easy
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 7) }),                                      // rest
    ]
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    // restOrEasyShare = 2/4 = 0.5 (< 0.75)
    // hard share = 0/4 = 0 (< 0.40)
    expect(res.band).toBe('MIXED')
  })
})

// ─── classification boundaries ──────────────────────────────────────────────

describe('analyzePostLongRunNextDay — nextDay classification', () => {
  it('classifies nextDay as rest when tss=0 AND duration=0', () => {
    const monday = mondayOf(TODAY)
    const log = buildLongRun({ longRunDate: isoMinusDays(monday, 14) })
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res.longRuns[0].nextDay.kind).toBe('rest')
    expect(res.longRuns[0].nextDay.nextDayTss).toBe(0)
    expect(res.longRuns[0].nextDay.nextDayDurationMin).toBe(0)
  })

  it('classifies nextDay as easy when 0 < tss < 40 (tss=39)', () => {
    const monday = mondayOf(TODAY)
    const log = buildLongRun({
      longRunDate: isoMinusDays(monday, 14),
      nextDayTss: 39,
      nextDayDurMin: 45,
    })
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res.longRuns[0].nextDay.kind).toBe('easy')
    expect(res.longRuns[0].nextDay.nextDayTss).toBe(39)
  })

  it('classifies nextDay as moderate at tss=40 (lower boundary)', () => {
    const monday = mondayOf(TODAY)
    const log = buildLongRun({
      longRunDate: isoMinusDays(monday, 14),
      nextDayTss: 40,
      nextDayDurMin: 50,
    })
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res.longRuns[0].nextDay.kind).toBe('moderate')
  })

  it('classifies nextDay as moderate at tss=79 (upper boundary)', () => {
    const monday = mondayOf(TODAY)
    const log = buildLongRun({
      longRunDate: isoMinusDays(monday, 14),
      nextDayTss: 79,
      nextDayDurMin: 60,
    })
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res.longRuns[0].nextDay.kind).toBe('moderate')
  })

  it('classifies nextDay as hard at tss=80 (boundary)', () => {
    const monday = mondayOf(TODAY)
    const log = buildLongRun({
      longRunDate: isoMinusDays(monday, 14),
      nextDayTss: 80,
      nextDayDurMin: 60,
    })
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res.longRuns[0].nextDay.kind).toBe('hard')
  })

  it('classifies nextDay as easy when tss=0 but duration>0 (active recovery with no TSS)', () => {
    const monday = mondayOf(TODAY)
    const longRunDate = isoMinusDays(monday, 14)
    const log = [
      { date: longRunDate, duration_min: 120, sport: 'run' },
      { date: isoAddDays(longRunDate, 1), duration_min: 30, sport: 'walk' },
    ]
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res.longRuns[0].nextDay.kind).toBe('easy')
    expect(res.longRuns[0].nextDay.nextDayDurationMin).toBe(30)
  })

  it('sums multiple entries on the next day for tss + duration', () => {
    const monday = mondayOf(TODAY)
    const longRunDate = isoMinusDays(monday, 14)
    const log = [
      { date: longRunDate, duration_min: 120, sport: 'run' },
      { date: isoAddDays(longRunDate, 1), duration_min: 30, sport: 'easy', tss: 25 },
      { date: isoAddDays(longRunDate, 1), duration_min: 20, sport: 'core', tss: 20 },
    ]
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res.longRuns[0].nextDay.nextDayTss).toBe(45)
    expect(res.longRuns[0].nextDay.nextDayDurationMin).toBe(50)
    expect(res.longRuns[0].nextDay.kind).toBe('moderate') // 45 in [40,80)
  })
})

// ─── duration field variants ────────────────────────────────────────────────

describe('analyzePostLongRunNextDay — duration field handling', () => {
  it('accepts durationMin (camelCase)', () => {
    const monday = mondayOf(TODAY)
    const log = [
      { date: isoMinusDays(monday, 14), durationMin: 120, sport: 'run' },
    ]
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res).not.toBeNull()
    expect(res.totalLongRuns).toBe(1)
    expect(res.longRuns[0].longRunMin).toBe(120)
  })

  it('accepts duration_min (snake_case)', () => {
    const monday = mondayOf(TODAY)
    const log = [
      { date: isoMinusDays(monday, 14), duration_min: 120, sport: 'run' },
    ]
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res).not.toBeNull()
    expect(res.totalLongRuns).toBe(1)
    expect(res.longRuns[0].longRunMin).toBe(120)
  })

  it('prefers durationMin when both are present', () => {
    const monday = mondayOf(TODAY)
    const log = [
      { date: isoMinusDays(monday, 14), durationMin: 95, duration_min: 50, sport: 'run' },
    ]
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res.longRuns[0].longRunMin).toBe(95)
  })

  it('ignores non-finite duration values', () => {
    const monday = mondayOf(TODAY)
    const log = [
      { date: isoMinusDays(monday, 14), duration_min: 'invalid', sport: 'run' },
      { date: isoMinusDays(monday, 7), duration_min: NaN, sport: 'run' },
    ]
    expect(analyzePostLongRunNextDay({ log, today: TODAY })).toBeNull()
  })
})

// ─── sport filter ───────────────────────────────────────────────────────────

describe('analyzePostLongRunNextDay — sport filter', () => {
  it('does NOT count a 120-min cycling session as a long run', () => {
    const monday = mondayOf(TODAY)
    const log = [
      { date: isoMinusDays(monday, 14), duration_min: 120, sport: 'cycling' },
    ]
    expect(analyzePostLongRunNextDay({ log, today: TODAY })).toBeNull()
  })

  it('does NOT count a swim session', () => {
    const monday = mondayOf(TODAY)
    const log = [
      { date: isoMinusDays(monday, 14), duration_min: 120, sport: 'swim' },
    ]
    expect(analyzePostLongRunNextDay({ log, today: TODAY })).toBeNull()
  })

  it('accepts run match in entry.type when sport is missing', () => {
    const monday = mondayOf(TODAY)
    const log = [
      { date: isoMinusDays(monday, 14), duration_min: 120, type: 'long-run' },
    ]
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res).not.toBeNull()
    expect(res.totalLongRuns).toBe(1)
  })

  it('case-insensitive run match in sport', () => {
    const monday = mondayOf(TODAY)
    const log = [
      { date: isoMinusDays(monday, 14), duration_min: 120, sport: 'RUNNING' },
    ]
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res.totalLongRuns).toBe(1)
  })

  it('ignores running sessions shorter than the threshold', () => {
    const monday = mondayOf(TODAY)
    const log = [
      { date: isoMinusDays(monday, 14), duration_min: 89, sport: 'run' },
      { date: isoMinusDays(monday, 7), duration_min: 60, sport: 'run' },
    ]
    expect(analyzePostLongRunNextDay({ log, today: TODAY })).toBeNull()
  })

  it('exactly 90 min qualifies as a long run (>= threshold)', () => {
    const monday = mondayOf(TODAY)
    const log = [
      { date: isoMinusDays(monday, 14), duration_min: 90, sport: 'run' },
    ]
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res).not.toBeNull()
    expect(res.totalLongRuns).toBe(1)
  })
})

// ─── custom thresholds + window ─────────────────────────────────────────────

describe('analyzePostLongRunNextDay — custom thresholds + window', () => {
  it('custom longRunMinThreshold=60 picks up 75-min runs that would not qualify at default 90', () => {
    const monday = mondayOf(TODAY)
    const log = [
      { date: isoMinusDays(monday, 14), duration_min: 75, sport: 'run' },
    ]
    expect(analyzePostLongRunNextDay({ log, today: TODAY })).toBeNull()
    const res = analyzePostLongRunNextDay({ log, today: TODAY, longRunMinThreshold: 60 })
    expect(res).not.toBeNull()
    expect(res.totalLongRuns).toBe(1)
  })

  it('custom windowWeeks=4 excludes a long run older than 4 weeks', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 56) }), // 8 weeks back — outside 4w
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 14) }), // 2 weeks back — inside
    ]
    const res = analyzePostLongRunNextDay({ log, today: TODAY, windowWeeks: 4 })
    expect(res.totalLongRuns).toBe(1)
    expect(res.longRuns[0].longRunDate).toBe(isoMinusDays(monday, 14))
  })

  it('windowWeeks falls back to default when not finite', () => {
    const monday = mondayOf(TODAY)
    const log = buildLongRun({ longRunDate: isoMinusDays(monday, 14) })
    const res = analyzePostLongRunNextDay({ log, today: TODAY, windowWeeks: NaN })
    expect(res).not.toBeNull()
    expect(res.totalLongRuns).toBe(1)
  })
})

// ─── ISO week boundary ──────────────────────────────────────────────────────

describe('analyzePostLongRunNextDay — window edges', () => {
  it('excludes a long run before the window start', () => {
    const monday = mondayOf(TODAY)
    const log = buildLongRun({ longRunDate: isoMinusDays(monday, 91) }) // 13 weeks back
    expect(analyzePostLongRunNextDay({ log, today: TODAY })).toBeNull()
  })

  it('includes a long run on windowEnd (Sunday) — and uses its next-day entry which is outside the window', () => {
    // windowEnd = Sunday 2026-05-17. Long run on 2026-05-17, next-day entry on 2026-05-18 (outside window proper).
    const longRunDate = '2026-05-17'
    const log = [
      { date: longRunDate, duration_min: 120, sport: 'run' },
      { date: isoAddDays(longRunDate, 1), duration_min: 30, sport: 'easy', tss: 25 },
    ]
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res).not.toBeNull()
    expect(res.totalLongRuns).toBe(1)
    expect(res.longRuns[0].nextDay.nextDayTss).toBe(25)
    expect(res.longRuns[0].nextDay.kind).toBe('easy')
  })

  it('nextDay outside log = 0 TSS = rest', () => {
    // Long run on Sunday windowEnd; no entry on 2026-05-18.
    const longRunDate = '2026-05-17'
    const log = [
      { date: longRunDate, duration_min: 120, sport: 'run' },
    ]
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res.longRuns[0].nextDay.kind).toBe('rest')
    expect(res.longRuns[0].nextDay.nextDayTss).toBe(0)
  })

  it('ignores malformed date strings', () => {
    const log = [
      { date: 'banana', duration_min: 200, sport: 'run' },
      { date: '2026-13-99', duration_min: 200, sport: 'run' },
    ]
    expect(analyzePostLongRunNextDay({ log, today: TODAY })).toBeNull()
  })

  it('ignores entries missing a date field', () => {
    const log = [
      { duration_min: 200, sport: 'run' },
      { date: null, duration_min: 200, sport: 'run' },
    ]
    expect(analyzePostLongRunNextDay({ log, today: TODAY })).toBeNull()
  })

  it('sorts longRuns oldest-first', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 7) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 49) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 21) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 35) }),
    ]
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    const dates = res.longRuns.map(lr => lr.longRunDate)
    const sorted = [...dates].sort()
    expect(dates).toEqual(sorted)
  })
})

// ─── today as Date vs string ────────────────────────────────────────────────

describe('analyzePostLongRunNextDay — today parameter forms', () => {
  it('accepts today as a Date object', () => {
    const monday = mondayOf(TODAY)
    const log = buildLongRun({ longRunDate: isoMinusDays(monday, 14) })
    const todayDate = new Date(TODAY + 'T12:00:00Z')
    const res = analyzePostLongRunNextDay({ log, today: todayDate })
    expect(res).not.toBeNull()
    expect(res.totalLongRuns).toBe(1)
  })

  it('produces identical results for today as Date vs ISO string', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 49) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 35) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 21) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 7) }),
    ]
    const a = analyzePostLongRunNextDay({ log, today: TODAY })
    const b = analyzePostLongRunNextDay({ log, today: new Date(TODAY + 'T00:00:00Z') })
    expect(a.totalLongRuns).toBe(b.totalLongRuns)
    expect(a.band).toBe(b.band)
    expect(a.restOrEasyShare).toBe(b.restOrEasyShare)
  })

  it('accepts an ISO datetime string and slices to date', () => {
    const monday = mondayOf(TODAY)
    const log = buildLongRun({ longRunDate: isoMinusDays(monday, 14) })
    const res = analyzePostLongRunNextDay({ log, today: TODAY + 'T18:30:00Z' })
    expect(res).not.toBeNull()
    expect(res.totalLongRuns).toBe(1)
  })
})

// ─── tallies + restOrEasyShare rounding ─────────────────────────────────────

describe('analyzePostLongRunNextDay — tallies + share rounding', () => {
  it('counts rest / easy / moderate / hard from the longRuns list', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 49) }),                                          // rest
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 35), nextDayTss: 20, nextDayDurMin: 40 }),       // easy
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 21), nextDayTss: 50, nextDayDurMin: 50 }),       // moderate
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 7), nextDayTss: 100, nextDayDurMin: 60 }),       // hard
    ]
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res.restDays).toBe(1)
    expect(res.easyDays).toBe(1)
    expect(res.moderateDays).toBe(1)
    expect(res.hardDays).toBe(1)
  })

  it('restOrEasyShare is rounded to 4 decimal places', () => {
    const monday = mondayOf(TODAY)
    // 7 long runs, 5 rest+easy → 5/7 = 0.71428571...
    const log = [
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 70) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 63) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 56) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 49), nextDayTss: 20, nextDayDurMin: 40 }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 42), nextDayTss: 30, nextDayDurMin: 45 }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 21), nextDayTss: 100, nextDayDurMin: 60 }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 7), nextDayTss: 100, nextDayDurMin: 60 }),
    ]
    const res = analyzePostLongRunNextDay({ log, today: TODAY })
    expect(res.totalLongRuns).toBe(7)
    expect(res.restOrEasyShare).toBe(0.7143)
  })
})
