// src/lib/__tests__/athlete/midweekHardDayFrequency.test.js
//
// Pure-function tests for analyzeMidweekHardDayFrequency — Foster 2017 /
// Bompa 2018 day-of-week hard-session distribution. Covers null gating,
// all four bands, dayCounts accuracy, dominantDay tie-break, midweekShare
// math, the TSS < 60 floor, multi-session-day max-TSS aggregation, ISO
// week boundary handling, custom windowWeeks, today as Date vs string,
// and non-finite TSS handling.

import { describe, it, expect } from 'vitest'
import {
  analyzeMidweekHardDayFrequency,
  MIDWEEK_HARD_DAY_FREQUENCY_CITATION,
} from '../../athlete/midweekHardDayFrequency.js'

// 2026-05-17 is a Sunday → current ISO week = 2026-05-11..2026-05-17.
// 8-week window = 2026-03-23 (Mon) .. 2026-05-17 (Sun) inclusive.
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

// Mon=0..Sun=6 → date string for that ISO weekday within the week
// containing TODAY, offset back by `weeksBack` weeks.
function dateForDow(dowIndex, weeksBack = 0, anchor = TODAY) {
  const mon = mondayOf(anchor)
  return isoAddDays(mon, dowIndex - weeksBack * 7)
}

function hardEntry(date, tss = 80) {
  return { date, tss }
}

// ─── null gating ─────────────────────────────────────────────────────────────

describe('analyzeMidweekHardDayFrequency — null gating', () => {
  it('returns null when today is undefined', () => {
    expect(analyzeMidweekHardDayFrequency({ log: [], today: undefined })).toBeNull()
  })

  it('returns null when today is null', () => {
    expect(analyzeMidweekHardDayFrequency({ log: [], today: null })).toBeNull()
  })

  it('returns null when today is a malformed string', () => {
    expect(analyzeMidweekHardDayFrequency({ log: [], today: 'not-a-date' })).toBeNull()
    expect(analyzeMidweekHardDayFrequency({ log: [], today: '2026/05/17' })).toBeNull()
  })

  it('returns null when today is an invalid Date', () => {
    expect(analyzeMidweekHardDayFrequency({ log: [], today: new Date('bogus') })).toBeNull()
  })

  it('accepts no args at all (today missing) → null', () => {
    expect(analyzeMidweekHardDayFrequency()).toBeNull()
  })
})

// ─── INSUFFICIENT_HARD band ──────────────────────────────────────────────────

describe('analyzeMidweekHardDayFrequency — INSUFFICIENT_HARD band', () => {
  it('classifies an empty log as INSUFFICIENT_HARD with zero counts', () => {
    const out = analyzeMidweekHardDayFrequency({ log: [], today: TODAY })
    expect(out).not.toBeNull()
    expect(out.band).toBe('INSUFFICIENT_HARD')
    expect(out.totalHardDays).toBe(0)
    expect(out.dominantDay).toBeNull()
    expect(out.midweekHardCount).toBe(0)
    expect(out.weekendHardCount).toBe(0)
    expect(out.midweekShare).toBe(0)
    expect(out.dayCounts).toEqual({ mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0 })
  })

  it('classifies as INSUFFICIENT_HARD when totalHardDays === 5 (just below threshold)', () => {
    const log = []
    for (let w = 0; w < 5; w++) {
      log.push(hardEntry(dateForDow(2, w))) // Wed week w → 5 hard days
    }
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.band).toBe('INSUFFICIENT_HARD')
    expect(out.totalHardDays).toBe(5)
    // midweekShare math still computed correctly even at INSUFFICIENT_HARD
    expect(out.midweekShare).toBe(1)
  })

  it('exits INSUFFICIENT_HARD at exactly 6 hard days', () => {
    const log = []
    for (let w = 0; w < 6; w++) {
      log.push(hardEntry(dateForDow(2, w))) // 6 Wed sessions
    }
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.totalHardDays).toBe(6)
    expect(out.band).not.toBe('INSUFFICIENT_HARD')
    expect(out.band).toBe('MIDWEEK_FOCUSED')
  })
})

// ─── MIDWEEK_FOCUSED band ────────────────────────────────────────────────────

describe('analyzeMidweekHardDayFrequency — MIDWEEK_FOCUSED band', () => {
  it('classifies pure Tue/Wed/Thu pattern as MIDWEEK_FOCUSED', () => {
    const log = []
    for (let w = 0; w < 8; w++) {
      log.push(hardEntry(dateForDow(1, w))) // Tue
      log.push(hardEntry(dateForDow(2, w))) // Wed
      log.push(hardEntry(dateForDow(3, w))) // Thu
    }
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.band).toBe('MIDWEEK_FOCUSED')
    expect(out.totalHardDays).toBe(24)
    expect(out.midweekHardCount).toBe(24)
    expect(out.weekendHardCount).toBe(0)
    expect(out.midweekShare).toBe(1)
  })

  it('classifies as MIDWEEK_FOCUSED at exactly midweekShare = 0.50', () => {
    // 6 midweek + 4 fri + 2 sat → 12 total, midweekShare = 0.50
    const log = []
    for (let w = 0; w < 6; w++) log.push(hardEntry(dateForDow(2, w))) // 6 Wed
    for (let w = 0; w < 4; w++) log.push(hardEntry(dateForDow(4, w))) // 4 Fri
    log.push(hardEntry(dateForDow(5, 0)))
    log.push(hardEntry(dateForDow(5, 1))) // 2 Sat
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.totalHardDays).toBe(12)
    expect(out.midweekShare).toBe(0.5)
    expect(out.band).toBe('MIDWEEK_FOCUSED')
  })

  it('MIDWEEK_FOCUSED wins over WEEKEND_WARRIOR when both qualify (corner case)', () => {
    // Build a contrived log where midweek share ≥ 0.50 AND weekend share ≥ 0.60.
    // With 10 hard days total: 5 midweek + 6 weekend would be 11 — overcounted.
    // We need a single day to count as both midweek and weekend, which is
    // impossible. So this branch is unreachable in practice. The TEST
    // documents that IF the bands were ever to overlap, MIDWEEK_FOCUSED
    // wins. We test the precedence by stub: keep midweek=0.5 and weekend
    // share also high. With 6 midweek + 4 weekend = 10 → midweek 0.6,
    // weekend 0.4 — only one qualifies; this is by design.
    //
    // The real assertion: the branch ordering is documented in code.
    // We assert MIDWEEK_FOCUSED renders for >= 0.50 even when weekend
    // share is significant.
    const log = []
    for (let w = 0; w < 5; w++) {
      log.push(hardEntry(dateForDow(2, w))) // 5 Wed
    }
    for (let w = 0; w < 4; w++) {
      log.push(hardEntry(dateForDow(6, w))) // 4 Sun
    }
    // 9 hard days, midweek = 5/9 ≈ 0.5556 (≥ 0.50), weekend = 4/9 ≈ 0.4444 (<0.60)
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.totalHardDays).toBe(9)
    expect(out.midweekShare).toBeCloseTo(0.5556, 3)
    expect(out.band).toBe('MIDWEEK_FOCUSED')
  })
})

// ─── WEEKEND_WARRIOR band ────────────────────────────────────────────────────

describe('analyzeMidweekHardDayFrequency — WEEKEND_WARRIOR band', () => {
  it('classifies pure Sat/Sun pattern as WEEKEND_WARRIOR', () => {
    const log = []
    for (let w = 0; w < 4; w++) {
      log.push(hardEntry(dateForDow(5, w))) // Sat
      log.push(hardEntry(dateForDow(6, w))) // Sun
    }
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.totalHardDays).toBe(8)
    expect(out.weekendHardCount).toBe(8)
    expect(out.midweekHardCount).toBe(0)
    expect(out.midweekShare).toBe(0)
    expect(out.band).toBe('WEEKEND_WARRIOR')
  })

  it('classifies at exactly 60% weekend share', () => {
    // 6 weekend + 4 fri = 10 total, weekend = 0.60 exactly, midweek = 0
    const log = []
    log.push(hardEntry(dateForDow(5, 0)))
    log.push(hardEntry(dateForDow(5, 1)))
    log.push(hardEntry(dateForDow(5, 2)))
    log.push(hardEntry(dateForDow(6, 0)))
    log.push(hardEntry(dateForDow(6, 1)))
    log.push(hardEntry(dateForDow(6, 2))) // 6 weekend
    for (let w = 0; w < 4; w++) log.push(hardEntry(dateForDow(4, w))) // 4 Fri
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.totalHardDays).toBe(10)
    expect(out.weekendHardCount).toBe(6)
    expect(out.midweekHardCount).toBe(0)
    expect(out.band).toBe('WEEKEND_WARRIOR')
  })

  it('does NOT classify as WEEKEND_WARRIOR at 59% weekend share (below threshold)', () => {
    // Not at floor: build 59/41 split via larger numbers? Easier: 10 weekend
    // + 7 fri = 17 → weekend = 10/17 ≈ 0.588 (< 0.60) and midweek = 0 < 0.50
    const log = []
    for (let w = 0; w < 5; w++) {
      log.push(hardEntry(dateForDow(5, w)))
      log.push(hardEntry(dateForDow(6, w)))
    }
    for (let w = 0; w < 7; w++) {
      log.push(hardEntry(dateForDow(4, w % 8))) // 7 Fri
    }
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.totalHardDays).toBe(17)
    expect(out.band).toBe('BALANCED')
  })
})

// ─── BALANCED band ──────────────────────────────────────────────────────────

describe('analyzeMidweekHardDayFrequency — BALANCED band', () => {
  it('classifies a mixed pattern with no strong skew as BALANCED', () => {
    // 2 Mon + 2 Wed + 2 Fri + 2 Sat = 8 hard days
    // midweek = 2/8 = 0.25 (<0.50), weekend = 2/8 = 0.25 (<0.60) → BALANCED
    const log = []
    for (let w = 0; w < 2; w++) {
      log.push(hardEntry(dateForDow(0, w))) // Mon
      log.push(hardEntry(dateForDow(2, w))) // Wed
      log.push(hardEntry(dateForDow(4, w))) // Fri
      log.push(hardEntry(dateForDow(5, w))) // Sat
    }
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.totalHardDays).toBe(8)
    expect(out.midweekShare).toBe(0.25)
    expect(out.band).toBe('BALANCED')
  })
})

// ─── dayCounts accuracy ─────────────────────────────────────────────────────

describe('analyzeMidweekHardDayFrequency — dayCounts accuracy', () => {
  it('counts each weekday correctly across the full window', () => {
    // Place 1 hard session on each day of the week in week 0, 2 on each
    // day in week 1, ..., 8 on each day in week 7? Too many. Just verify
    // a simple distribution.
    const log = [
      hardEntry(dateForDow(0, 0)), hardEntry(dateForDow(0, 1)), // 2 Mon
      hardEntry(dateForDow(1, 0)),                              // 1 Tue
      hardEntry(dateForDow(2, 0)), hardEntry(dateForDow(2, 1)), hardEntry(dateForDow(2, 2)), // 3 Wed
      hardEntry(dateForDow(3, 0)),                              // 1 Thu
      hardEntry(dateForDow(4, 0)), hardEntry(dateForDow(4, 1)), // 2 Fri
      hardEntry(dateForDow(5, 0)),                              // 1 Sat
      hardEntry(dateForDow(6, 0)),                              // 1 Sun
    ]
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.dayCounts).toEqual({
      mon: 2, tue: 1, wed: 3, thu: 1, fri: 2, sat: 1, sun: 1,
    })
    expect(out.totalHardDays).toBe(11)
    expect(out.midweekHardCount).toBe(5) // tue+wed+thu = 1+3+1
    expect(out.weekendHardCount).toBe(2) // sat+sun = 1+1
  })

  it('Sunday session is keyed to "sun" (not "mon" — ISO Sunday belongs to its own week)', () => {
    // Sunday of the current week (2026-05-17).
    const sundayDate = TODAY
    const log = []
    // Need 6+ hard days to escape INSUFFICIENT_HARD — add 5 Wed sessions
    // in different weeks plus the Sunday.
    for (let w = 0; w < 5; w++) log.push(hardEntry(dateForDow(2, w)))
    log.push(hardEntry(sundayDate))
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.dayCounts.sun).toBe(1)
    expect(out.dayCounts.mon).toBe(0)
  })
})

// ─── dominantDay logic ──────────────────────────────────────────────────────

describe('analyzeMidweekHardDayFrequency — dominantDay', () => {
  it('returns null when totalHardDays === 0', () => {
    const out = analyzeMidweekHardDayFrequency({ log: [], today: TODAY })
    expect(out.dominantDay).toBeNull()
  })

  it('picks the single weekday with most hard sessions', () => {
    const log = [
      hardEntry(dateForDow(2, 0)), hardEntry(dateForDow(2, 1)), hardEntry(dateForDow(2, 2)),
      hardEntry(dateForDow(2, 3)), hardEntry(dateForDow(2, 4)), // 5 Wed
      hardEntry(dateForDow(5, 0)),                              // 1 Sat
    ]
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.dominantDay).toBe('wed')
  })

  it('on a tie, picks the earliest day in the week (Mon wins over Sun)', () => {
    const log = [
      hardEntry(dateForDow(0, 0)), hardEntry(dateForDow(0, 1)), hardEntry(dateForDow(0, 2)), // 3 Mon
      hardEntry(dateForDow(6, 0)), hardEntry(dateForDow(6, 1)), hardEntry(dateForDow(6, 2)), // 3 Sun
    ]
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.dominantDay).toBe('mon')
  })

  it('on a 3-way tie, picks the earliest (Tue over Thu over Sat)', () => {
    const log = [
      hardEntry(dateForDow(1, 0)), hardEntry(dateForDow(1, 1)),  // 2 Tue
      hardEntry(dateForDow(3, 0)), hardEntry(dateForDow(3, 1)),  // 2 Thu
      hardEntry(dateForDow(5, 0)), hardEntry(dateForDow(5, 1)),  // 2 Sat
    ]
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.dominantDay).toBe('tue')
  })
})

// ─── midweekShare math precision ────────────────────────────────────────────

describe('analyzeMidweekHardDayFrequency — midweekShare math', () => {
  it('rounds midweekShare to 4 decimal places', () => {
    // 1 midweek out of 3 total → 0.3333...
    const log = [
      hardEntry(dateForDow(2, 0)),  // Wed midweek
      hardEntry(dateForDow(0, 0)),  // Mon
      hardEntry(dateForDow(5, 0)),  // Sat
    ]
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.midweekShare).toBe(0.3333)
  })

  it('midweekShare === 0 when totalHardDays === 0 (no NaN)', () => {
    const out = analyzeMidweekHardDayFrequency({ log: [], today: TODAY })
    expect(out.midweekShare).toBe(0)
    expect(Number.isFinite(out.midweekShare)).toBe(true)
  })

  it('midweekShare === 1 for pure midweek log', () => {
    const log = []
    for (let w = 0; w < 6; w++) log.push(hardEntry(dateForDow(1, w))) // 6 Tue
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.midweekShare).toBe(1)
  })
})

// ─── TSS floor behavior ─────────────────────────────────────────────────────

describe('analyzeMidweekHardDayFrequency — TSS < 60 not counted as hard', () => {
  it('ignores sessions with tss === 59', () => {
    const log = []
    for (let w = 0; w < 8; w++) {
      log.push({ date: dateForDow(2, w), tss: 59 }) // 8 Wed sessions, all below floor
    }
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.totalHardDays).toBe(0)
    expect(out.band).toBe('INSUFFICIENT_HARD')
  })

  it('includes sessions with tss === 60 exactly (floor is inclusive)', () => {
    const log = []
    for (let w = 0; w < 6; w++) {
      log.push({ date: dateForDow(2, w), tss: 60 })
    }
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.totalHardDays).toBe(6)
    expect(out.dayCounts.wed).toBe(6)
  })
})

// ─── Multi-session day → classify by max TSS ────────────────────────────────

describe('analyzeMidweekHardDayFrequency — multi-session day max-TSS', () => {
  it('one easy + one hard session on the same day counts as hard', () => {
    const log = [
      { date: dateForDow(2, 0), tss: 20 },  // easy
      { date: dateForDow(2, 0), tss: 90 },  // hard
    ]
    // Pad with 5 more midweek hard sessions to escape INSUFFICIENT_HARD
    for (let w = 1; w < 6; w++) log.push(hardEntry(dateForDow(2, w)))
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.dayCounts.wed).toBe(6)
    expect(out.totalHardDays).toBe(6)
  })

  it('two easy sessions on the same day stay EASY (max < 60)', () => {
    const log = [
      { date: dateForDow(2, 0), tss: 30 },
      { date: dateForDow(2, 0), tss: 40 },
    ]
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.dayCounts.wed).toBe(0)
  })
})

// ─── ISO week boundary handling ─────────────────────────────────────────────

describe('analyzeMidweekHardDayFrequency — ISO week boundary', () => {
  it('Sunday belongs to "sun" key (not start of next week)', () => {
    const sunday = '2026-05-17' // explicit Sunday
    const log = [hardEntry(sunday)]
    for (let w = 0; w < 5; w++) log.push(hardEntry(dateForDow(2, w))) // pad
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.dayCounts.sun).toBe(1)
  })

  it('Monday belongs to "mon" key', () => {
    const monday = '2026-05-11' // Monday of current week
    const log = [hardEntry(monday)]
    for (let w = 0; w < 5; w++) log.push(hardEntry(dateForDow(2, w))) // pad
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.dayCounts.mon).toBe(1)
  })

  it('excludes sessions older than the 8-week window', () => {
    // Window starts 2026-03-23. A session on 2026-03-22 is outside.
    const log = [
      hardEntry('2026-03-22'),
      hardEntry('2026-03-21'),
      hardEntry('2026-03-16'),
    ]
    for (let w = 0; w < 6; w++) log.push(hardEntry(dateForDow(2, w)))
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.totalHardDays).toBe(6)
  })

  it('excludes sessions in the future (after current week)', () => {
    const log = [
      hardEntry('2026-05-18'), // Mon of next week
      hardEntry('2026-06-01'),
    ]
    for (let w = 0; w < 6; w++) log.push(hardEntry(dateForDow(2, w)))
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.totalHardDays).toBe(6)
  })

  it('includes session on the earliest day of the window (2026-03-23 Mon)', () => {
    const log = [hardEntry('2026-03-23')]
    for (let w = 0; w < 5; w++) log.push(hardEntry(dateForDow(2, w)))
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.dayCounts.mon).toBe(1)
  })
})

// ─── custom windowWeeks ─────────────────────────────────────────────────────

describe('analyzeMidweekHardDayFrequency — custom windowWeeks', () => {
  it('respects a smaller windowWeeks=4', () => {
    // Place 1 hard Wed in each of 8 weeks; only the last 4 should count.
    const log = []
    for (let w = 0; w < 8; w++) log.push(hardEntry(dateForDow(2, w)))
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY, windowWeeks: 4 })
    expect(out.totalHardDays).toBe(4)
  })

  it('respects a larger windowWeeks=12', () => {
    const log = []
    for (let w = 0; w < 12; w++) log.push(hardEntry(dateForDow(2, w)))
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY, windowWeeks: 12 })
    expect(out.totalHardDays).toBe(12)
  })

  it('clamps non-finite windowWeeks to default (8)', () => {
    const log = []
    for (let w = 0; w < 10; w++) log.push(hardEntry(dateForDow(2, w)))
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY, windowWeeks: NaN })
    expect(out.totalHardDays).toBe(8) // default window
  })

  it('clamps zero windowWeeks to at least 1 week', () => {
    const log = [hardEntry(dateForDow(2, 0))]
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY, windowWeeks: 0 })
    expect(out).not.toBeNull()
    expect(out.totalHardDays).toBe(1)
  })
})

// ─── today as Date vs string ────────────────────────────────────────────────

describe('analyzeMidweekHardDayFrequency — today input types', () => {
  it('accepts today as a Date object', () => {
    const log = []
    for (let w = 0; w < 8; w++) log.push(hardEntry(dateForDow(2, w)))
    const out = analyzeMidweekHardDayFrequency({
      log,
      today: new Date('2026-05-17T12:00:00Z'),
    })
    expect(out.totalHardDays).toBe(8)
  })

  it('accepts today as an ISO string with a time component', () => {
    const log = []
    for (let w = 0; w < 8; w++) log.push(hardEntry(dateForDow(2, w)))
    const out = analyzeMidweekHardDayFrequency({
      log,
      today: '2026-05-17T08:30:00Z',
    })
    expect(out.totalHardDays).toBe(8)
  })

  it('accepts today as a YYYY-MM-DD string', () => {
    const log = [hardEntry(dateForDow(2, 0))]
    const out = analyzeMidweekHardDayFrequency({ log, today: '2026-05-17' })
    expect(out).not.toBeNull()
    expect(out.totalHardDays).toBe(1)
  })
})

// ─── non-finite TSS handling ────────────────────────────────────────────────

describe('analyzeMidweekHardDayFrequency — non-finite / invalid TSS', () => {
  it('ignores entries with tss === undefined', () => {
    const log = [{ date: dateForDow(2, 0) }, { date: dateForDow(2, 1) }]
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.totalHardDays).toBe(0)
  })

  it('ignores entries with tss === null', () => {
    const log = [{ date: dateForDow(2, 0), tss: null }]
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.totalHardDays).toBe(0)
  })

  it('ignores entries with tss === 0', () => {
    const log = [{ date: dateForDow(2, 0), tss: 0 }]
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.totalHardDays).toBe(0)
  })

  it('ignores entries with negative tss', () => {
    const log = [{ date: dateForDow(2, 0), tss: -10 }]
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.totalHardDays).toBe(0)
  })

  it('ignores entries with NaN/Infinity tss', () => {
    const log = [
      { date: dateForDow(2, 0), tss: NaN },
      { date: dateForDow(2, 1), tss: Infinity },
    ]
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.totalHardDays).toBe(0)
  })

  it('ignores entries with malformed date strings', () => {
    const log = [
      { date: 'not-a-date', tss: 90 },
      { date: '2026/05/13', tss: 90 },
      { date: '', tss: 90 },
    ]
    for (let w = 0; w < 6; w++) log.push(hardEntry(dateForDow(2, w)))
    const out = analyzeMidweekHardDayFrequency({ log, today: TODAY })
    expect(out.totalHardDays).toBe(6)
  })

  it('handles log === undefined gracefully', () => {
    const out = analyzeMidweekHardDayFrequency({ today: TODAY })
    expect(out).not.toBeNull()
    expect(out.totalHardDays).toBe(0)
    expect(out.band).toBe('INSUFFICIENT_HARD')
  })

  it('handles log === null gracefully', () => {
    const out = analyzeMidweekHardDayFrequency({ log: null, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.totalHardDays).toBe(0)
  })

  it('handles non-array log gracefully', () => {
    const out = analyzeMidweekHardDayFrequency({ log: { not: 'an array' }, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.totalHardDays).toBe(0)
  })
})

// ─── shape + citation contract ──────────────────────────────────────────────

describe('analyzeMidweekHardDayFrequency — return shape + citation', () => {
  it('return value includes the citation string', () => {
    const out = analyzeMidweekHardDayFrequency({ log: [], today: TODAY })
    expect(out.citation).toBe(MIDWEEK_HARD_DAY_FREQUENCY_CITATION)
    expect(out.citation).toMatch(/Foster 2017/)
    expect(out.citation).toMatch(/Bompa 2018/)
  })

  it('return value has the documented shape', () => {
    const out = analyzeMidweekHardDayFrequency({ log: [], today: TODAY })
    expect(out).toHaveProperty('band')
    expect(out).toHaveProperty('dayCounts')
    expect(out).toHaveProperty('totalHardDays')
    expect(out).toHaveProperty('midweekHardCount')
    expect(out).toHaveProperty('weekendHardCount')
    expect(out).toHaveProperty('midweekShare')
    expect(out).toHaveProperty('dominantDay')
    expect(out).toHaveProperty('citation')
    expect(out.dayCounts).toHaveProperty('mon')
    expect(out.dayCounts).toHaveProperty('sun')
  })

  it('isoAddDays sanity check for dateForDow helper', () => {
    // Quick self-check: dateForDow(0, 0) should be the Monday of the
    // current week, and dateForDow(6, 0) should be the Sunday.
    expect(dateForDow(0, 0)).toBe('2026-05-11')
    expect(dateForDow(6, 0)).toBe('2026-05-17')
  })
})
