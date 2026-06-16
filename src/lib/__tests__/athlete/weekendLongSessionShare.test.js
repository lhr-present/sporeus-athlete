// src/lib/__tests__/athlete/weekendLongSessionShare.test.js
//
// Pure-function tests for analyzeWeekendLongSessionShare — Foster 2017 /
// Bompa 2018 weekday-vs-weekend split of LONG sessions (≥90 min). Covers
// null gating, all four bands, longSessionsByDay accuracy, weekendShare
// math, the 90-min threshold (inclusive at exact 90), durationMin vs
// duration_min, custom longSessionMinThreshold, custom windowWeeks, ISO
// week boundary handling (Sunday → sun bucket), today as Date vs string,
// and non-finite duration handling.

import { describe, it, expect } from 'vitest'
import {
  analyzeWeekendLongSessionShare,
  WEEKEND_LONG_SESSION_SHARE_CITATION,
} from '../../athlete/weekendLongSessionShare.js'
import { sanitizeLogEntry } from '../../validate.js'

// 2026-05-17 is a Sunday → current ISO week = 2026-05-11..2026-05-17.
// 12-week window = 2026-02-23 (Mon) .. 2026-05-17 (Sun) inclusive.
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

function longEntry(date, durationMin = 120) {
  return { date, durationMin }
}

// ─── null gating ─────────────────────────────────────────────────────────────

describe('analyzeWeekendLongSessionShare — null gating', () => {
  it('returns null when today is undefined', () => {
    expect(analyzeWeekendLongSessionShare({ log: [], today: undefined })).toBeNull()
  })

  it('returns null when today is null', () => {
    expect(analyzeWeekendLongSessionShare({ log: [], today: null })).toBeNull()
  })

  it('returns null when today is a malformed string', () => {
    expect(analyzeWeekendLongSessionShare({ log: [], today: 'not-a-date' })).toBeNull()
    expect(analyzeWeekendLongSessionShare({ log: [], today: '2026/05/17' })).toBeNull()
  })

  it('returns null when today is an invalid Date', () => {
    expect(analyzeWeekendLongSessionShare({ log: [], today: new Date('bogus') })).toBeNull()
  })

  it('accepts no args at all (today missing) → null', () => {
    expect(analyzeWeekendLongSessionShare()).toBeNull()
  })
})

// ─── INSUFFICIENT_LONG_SESSIONS band ────────────────────────────────────────

describe('analyzeWeekendLongSessionShare — INSUFFICIENT_LONG_SESSIONS band', () => {
  it('classifies an empty log as INSUFFICIENT_LONG_SESSIONS with zero counts', () => {
    const out = analyzeWeekendLongSessionShare({ log: [], today: TODAY })
    expect(out).not.toBeNull()
    expect(out.band).toBe('INSUFFICIENT_LONG_SESSIONS')
    expect(out.longSessions).toBe(0)
    expect(out.weekdayLongCount).toBe(0)
    expect(out.weekendLongCount).toBe(0)
    expect(out.weekendShare).toBe(0)
    expect(out.longSessionsByDay).toEqual({
      mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0, sun: 0,
    })
  })

  it('classifies as INSUFFICIENT_LONG_SESSIONS when longSessions === 5 (just below threshold)', () => {
    const log = []
    for (let w = 0; w < 5; w++) {
      log.push(longEntry(dateForDow(5, w))) // 5 Sat
    }
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.band).toBe('INSUFFICIENT_LONG_SESSIONS')
    expect(out.longSessions).toBe(5)
    // weekendShare math still computed correctly
    expect(out.weekendShare).toBe(1)
  })

  it('exits INSUFFICIENT_LONG_SESSIONS at exactly 6 long sessions', () => {
    const log = []
    for (let w = 0; w < 6; w++) {
      log.push(longEntry(dateForDow(5, w))) // 6 Sat
    }
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.longSessions).toBe(6)
    expect(out.band).not.toBe('INSUFFICIENT_LONG_SESSIONS')
    expect(out.band).toBe('WEEKEND_DOMINANT')
  })
})

// ─── WEEKDAY_DOMINANT band ──────────────────────────────────────────────────

describe('analyzeWeekendLongSessionShare — WEEKDAY_DOMINANT band', () => {
  it('classifies pure mid-week pattern as WEEKDAY_DOMINANT', () => {
    const log = []
    for (let w = 0; w < 6; w++) {
      log.push(longEntry(dateForDow(2, w))) // 6 Wed
    }
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.longSessions).toBe(6)
    expect(out.weekendLongCount).toBe(0)
    expect(out.weekendShare).toBe(0)
    expect(out.band).toBe('WEEKDAY_DOMINANT')
  })

  it('classifies as WEEKDAY_DOMINANT at exactly weekendShare = 0.30', () => {
    // 7 weekday + 3 weekend = 10 total → weekendShare = 0.30 exactly
    const log = []
    for (let w = 0; w < 7; w++) log.push(longEntry(dateForDow(3, w))) // 7 Thu
    for (let w = 0; w < 3; w++) log.push(longEntry(dateForDow(5, w))) // 3 Sat
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.longSessions).toBe(10)
    expect(out.weekendShare).toBe(0.3)
    expect(out.band).toBe('WEEKDAY_DOMINANT')
  })

  it('moves out of WEEKDAY_DOMINANT just above 0.30 share', () => {
    // 6 weekday + 4 weekend = 10 → weekendShare = 0.40
    const log = []
    for (let w = 0; w < 6; w++) log.push(longEntry(dateForDow(3, w)))
    for (let w = 0; w < 4; w++) log.push(longEntry(dateForDow(5, w)))
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.weekendShare).toBe(0.4)
    expect(out.band).toBe('MIXED')
  })
})

// ─── WEEKEND_DOMINANT band ──────────────────────────────────────────────────

describe('analyzeWeekendLongSessionShare — WEEKEND_DOMINANT band', () => {
  it('classifies pure Sat/Sun pattern as WEEKEND_DOMINANT', () => {
    const log = []
    for (let w = 0; w < 6; w++) {
      log.push(longEntry(dateForDow(5, w))) // 6 Sat
    }
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.longSessions).toBe(6)
    expect(out.weekendLongCount).toBe(6)
    expect(out.weekendShare).toBe(1)
    expect(out.band).toBe('WEEKEND_DOMINANT')
  })

  it('classifies at exactly 70% weekend share', () => {
    // 7 weekend + 3 weekday = 10 total → weekendShare = 0.70 exactly
    const log = []
    for (let w = 0; w < 3; w++) log.push(longEntry(dateForDow(5, w))) // 3 Sat
    for (let w = 0; w < 4; w++) log.push(longEntry(dateForDow(6, w))) // 4 Sun
    for (let w = 0; w < 3; w++) log.push(longEntry(dateForDow(2, w))) // 3 Wed
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.longSessions).toBe(10)
    expect(out.weekendLongCount).toBe(7)
    expect(out.weekendShare).toBe(0.7)
    expect(out.band).toBe('WEEKEND_DOMINANT')
  })

  it('does NOT classify as WEEKEND_DOMINANT just below 70%', () => {
    // 6 weekend + 4 weekday = 10 → weekendShare = 0.60
    const log = []
    for (let w = 0; w < 6; w++) log.push(longEntry(dateForDow(5, w))) // 6 Sat
    for (let w = 0; w < 4; w++) log.push(longEntry(dateForDow(2, w))) // 4 Wed
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.weekendShare).toBe(0.6)
    expect(out.band).toBe('MIXED')
  })
})

// ─── MIXED band ─────────────────────────────────────────────────────────────

describe('analyzeWeekendLongSessionShare — MIXED band', () => {
  it('classifies an even split as MIXED', () => {
    // 5 weekday + 5 weekend = 10 → weekendShare = 0.50
    const log = []
    for (let w = 0; w < 5; w++) {
      log.push(longEntry(dateForDow(2, w))) // Wed
      log.push(longEntry(dateForDow(5, w))) // Sat
    }
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.longSessions).toBe(10)
    expect(out.weekendShare).toBe(0.5)
    expect(out.band).toBe('MIXED')
  })
})

// ─── longSessionsByDay accuracy ─────────────────────────────────────────────

describe('analyzeWeekendLongSessionShare — longSessionsByDay accuracy', () => {
  it('counts each weekday correctly across the window', () => {
    const log = [
      longEntry(dateForDow(0, 0)), longEntry(dateForDow(0, 1)), // 2 Mon
      longEntry(dateForDow(1, 0)),                              // 1 Tue
      longEntry(dateForDow(2, 0)), longEntry(dateForDow(2, 1)), longEntry(dateForDow(2, 2)), // 3 Wed
      longEntry(dateForDow(3, 0)),                              // 1 Thu
      longEntry(dateForDow(4, 0)), longEntry(dateForDow(4, 1)), // 2 Fri
      longEntry(dateForDow(5, 0)),                              // 1 Sat
      longEntry(dateForDow(6, 0)),                              // 1 Sun
    ]
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.longSessionsByDay).toEqual({
      mon: 2, tue: 1, wed: 3, thu: 1, fri: 2, sat: 1, sun: 1,
    })
    expect(out.longSessions).toBe(11)
    expect(out.weekendLongCount).toBe(2)
    expect(out.weekdayLongCount).toBe(9)
  })

  it('Sunday session is keyed to "sun" (not the next week\'s Mon)', () => {
    const sundayDate = TODAY // explicit Sunday
    const log = [longEntry(sundayDate)]
    for (let w = 0; w < 5; w++) log.push(longEntry(dateForDow(2, w))) // pad
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.longSessionsByDay.sun).toBe(1)
    expect(out.longSessionsByDay.mon).toBe(0)
  })

  it('Monday session is keyed to "mon"', () => {
    const monday = '2026-05-11'
    const log = [longEntry(monday)]
    for (let w = 0; w < 5; w++) log.push(longEntry(dateForDow(5, w))) // pad
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.longSessionsByDay.mon).toBe(1)
  })
})

// ─── weekendShare math precision ────────────────────────────────────────────

describe('analyzeWeekendLongSessionShare — weekendShare math', () => {
  it('rounds weekendShare to 4 decimal places', () => {
    // 1 weekend out of 3 total → 0.3333...
    const log = [
      longEntry(dateForDow(5, 0)), // Sat
      longEntry(dateForDow(0, 0)), // Mon
      longEntry(dateForDow(2, 0)), // Wed
    ]
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.weekendShare).toBe(0.3333)
  })

  it('weekendShare === 0 when longSessions === 0 (no NaN)', () => {
    const out = analyzeWeekendLongSessionShare({ log: [], today: TODAY })
    expect(out.weekendShare).toBe(0)
    expect(Number.isFinite(out.weekendShare)).toBe(true)
  })

  it('weekendShare === 1 for pure weekend log', () => {
    const log = []
    for (let w = 0; w < 6; w++) log.push(longEntry(dateForDow(5, w))) // 6 Sat
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.weekendShare).toBe(1)
  })

  it('weekdayLongCount + weekendLongCount === longSessions', () => {
    const log = []
    for (let w = 0; w < 4; w++) {
      log.push(longEntry(dateForDow(2, w))) // Wed
      log.push(longEntry(dateForDow(5, w))) // Sat
    }
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.weekdayLongCount + out.weekendLongCount).toBe(out.longSessions)
  })
})

// ─── Threshold (90 min) behavior ────────────────────────────────────────────

describe('analyzeWeekendLongSessionShare — threshold floor', () => {
  it('ignores sessions with durationMin === 89 (below default floor)', () => {
    const log = []
    for (let w = 0; w < 8; w++) {
      log.push({ date: dateForDow(5, w), durationMin: 89 })
    }
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.longSessions).toBe(0)
    expect(out.band).toBe('INSUFFICIENT_LONG_SESSIONS')
  })

  it('includes sessions with durationMin === 90 exactly (floor is inclusive)', () => {
    const log = []
    for (let w = 0; w < 6; w++) {
      log.push({ date: dateForDow(5, w), durationMin: 90 })
    }
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.longSessions).toBe(6)
    expect(out.longSessionsByDay.sat).toBe(6)
  })
})

// ─── durationMin vs duration_min ────────────────────────────────────────────

describe('analyzeWeekendLongSessionShare — durationMin vs duration_min', () => {
  it('accepts duration_min (snake_case) when durationMin is absent', () => {
    const log = []
    for (let w = 0; w < 6; w++) {
      log.push({ date: dateForDow(5, w), duration_min: 100 })
    }
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.longSessions).toBe(6)
  })

  it('prefers durationMin (camelCase) when both fields are present', () => {
    // camelCase says "long" (120), snake_case says "short" (30) — camelCase wins → counted
    const log = []
    for (let w = 0; w < 6; w++) {
      log.push({ date: dateForDow(5, w), durationMin: 120, duration_min: 30 })
    }
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.longSessions).toBe(6)
  })

  it('falls back to duration_min only when durationMin is null/undefined', () => {
    const log = []
    for (let w = 0; w < 3; w++) {
      log.push({ date: dateForDow(5, w), durationMin: null, duration_min: 100 })
    }
    for (let w = 3; w < 6; w++) {
      log.push({ date: dateForDow(6, w), duration_min: 100 })
    }
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.longSessions).toBe(6)
  })
})

// ─── custom longSessionMinThreshold ─────────────────────────────────────────

describe('analyzeWeekendLongSessionShare — custom longSessionMinThreshold', () => {
  it('respects a smaller threshold (60 min)', () => {
    const log = []
    for (let w = 0; w < 6; w++) {
      log.push({ date: dateForDow(5, w), durationMin: 75 })
    }
    const out = analyzeWeekendLongSessionShare({
      log, today: TODAY, longSessionMinThreshold: 60,
    })
    expect(out.longSessions).toBe(6)
  })

  it('respects a larger threshold (180 min)', () => {
    const log = []
    for (let w = 0; w < 8; w++) {
      log.push({ date: dateForDow(5, w), durationMin: 120 }) // below 180
    }
    const out = analyzeWeekendLongSessionShare({
      log, today: TODAY, longSessionMinThreshold: 180,
    })
    expect(out.longSessions).toBe(0)
    expect(out.band).toBe('INSUFFICIENT_LONG_SESSIONS')
  })
})

// ─── custom windowWeeks ─────────────────────────────────────────────────────

describe('analyzeWeekendLongSessionShare — custom windowWeeks', () => {
  it('respects a smaller windowWeeks=4', () => {
    // Place 1 long Sat in each of 8 weeks; only the last 4 should count.
    const log = []
    for (let w = 0; w < 8; w++) log.push(longEntry(dateForDow(5, w)))
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY, windowWeeks: 4 })
    expect(out.longSessions).toBe(4)
  })

  it('respects a larger windowWeeks=16', () => {
    const log = []
    for (let w = 0; w < 16; w++) log.push(longEntry(dateForDow(5, w)))
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY, windowWeeks: 16 })
    expect(out.longSessions).toBe(16)
  })

  it('default windowWeeks is 12', () => {
    const log = []
    for (let w = 0; w < 14; w++) log.push(longEntry(dateForDow(5, w)))
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.longSessions).toBe(12) // 12-week window default
  })

  it('clamps zero windowWeeks to at least 1 week', () => {
    const log = [longEntry(dateForDow(5, 0))]
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY, windowWeeks: 0 })
    expect(out).not.toBeNull()
    expect(out.longSessions).toBe(1)
  })
})

// ─── ISO week boundary handling ─────────────────────────────────────────────

describe('analyzeWeekendLongSessionShare — ISO week boundary', () => {
  it('excludes sessions older than the 12-week window', () => {
    // 12-week window starts 2026-02-23. Anything earlier is out.
    const log = [
      longEntry('2026-02-22'),
      longEntry('2026-02-21'),
      longEntry('2026-02-15'),
    ]
    for (let w = 0; w < 6; w++) log.push(longEntry(dateForDow(5, w))) // pad
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.longSessions).toBe(6)
  })

  it('excludes sessions in the future (after current week)', () => {
    const log = [
      longEntry('2026-05-18'), // Mon of next week
      longEntry('2026-06-01'),
    ]
    for (let w = 0; w < 6; w++) log.push(longEntry(dateForDow(5, w)))
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.longSessions).toBe(6)
  })

  it('includes session on the earliest day of the window (2026-02-23 Mon)', () => {
    const log = [longEntry('2026-02-23')]
    for (let w = 0; w < 5; w++) log.push(longEntry(dateForDow(5, w)))
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.longSessionsByDay.mon).toBe(1)
  })

  it('Sunday at end of window (2026-05-17) keys to "sun"', () => {
    const log = [longEntry('2026-05-17')]
    for (let w = 0; w < 5; w++) log.push(longEntry(dateForDow(2, w))) // pad weekday
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.longSessionsByDay.sun).toBe(1)
  })
})

// ─── today as Date vs string ────────────────────────────────────────────────

describe('analyzeWeekendLongSessionShare — today input types', () => {
  it('accepts today as a Date object', () => {
    const log = []
    for (let w = 0; w < 6; w++) log.push(longEntry(dateForDow(5, w)))
    const out = analyzeWeekendLongSessionShare({
      log,
      today: new Date('2026-05-17T12:00:00Z'),
    })
    expect(out.longSessions).toBe(6)
  })

  it('accepts today as an ISO string with a time component', () => {
    const log = []
    for (let w = 0; w < 6; w++) log.push(longEntry(dateForDow(5, w)))
    const out = analyzeWeekendLongSessionShare({
      log,
      today: '2026-05-17T08:30:00Z',
    })
    expect(out.longSessions).toBe(6)
  })

  it('accepts today as a plain YYYY-MM-DD string', () => {
    const log = [longEntry(dateForDow(5, 0))]
    const out = analyzeWeekendLongSessionShare({ log, today: '2026-05-17' })
    expect(out).not.toBeNull()
    expect(out.longSessions).toBe(1)
  })
})

// ─── non-finite duration handling ───────────────────────────────────────────

describe('analyzeWeekendLongSessionShare — non-finite / invalid duration', () => {
  it('ignores entries with no duration field at all', () => {
    const log = [{ date: dateForDow(5, 0) }, { date: dateForDow(5, 1) }]
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.longSessions).toBe(0)
  })

  it('ignores entries with durationMin === 0', () => {
    const log = [{ date: dateForDow(5, 0), durationMin: 0 }]
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.longSessions).toBe(0)
  })

  it('ignores entries with negative durationMin', () => {
    const log = [{ date: dateForDow(5, 0), durationMin: -10 }]
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.longSessions).toBe(0)
  })

  it('ignores entries with NaN/Infinity durationMin', () => {
    const log = [
      { date: dateForDow(5, 0), durationMin: NaN },
      { date: dateForDow(5, 1), durationMin: Infinity },
    ]
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.longSessions).toBe(0)
  })

  it('ignores entries with malformed date strings', () => {
    const log = [
      { date: 'not-a-date', durationMin: 120 },
      { date: '2026/05/13', durationMin: 120 },
      { date: '', durationMin: 120 },
    ]
    for (let w = 0; w < 6; w++) log.push(longEntry(dateForDow(5, w)))
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out.longSessions).toBe(6)
  })

  it('handles log === undefined gracefully', () => {
    const out = analyzeWeekendLongSessionShare({ today: TODAY })
    expect(out).not.toBeNull()
    expect(out.longSessions).toBe(0)
    expect(out.band).toBe('INSUFFICIENT_LONG_SESSIONS')
  })

  it('handles log === null gracefully', () => {
    const out = analyzeWeekendLongSessionShare({ log: null, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.longSessions).toBe(0)
  })

  it('handles non-array log gracefully', () => {
    const out = analyzeWeekendLongSessionShare({ log: { not: 'an array' }, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.longSessions).toBe(0)
  })
})

// ─── shape + citation contract ──────────────────────────────────────────────

describe('analyzeWeekendLongSessionShare — return shape + citation', () => {
  it('return value includes the citation string', () => {
    const out = analyzeWeekendLongSessionShare({ log: [], today: TODAY })
    expect(out.citation).toBe(WEEKEND_LONG_SESSION_SHARE_CITATION)
    expect(out.citation).toMatch(/Foster 2017/)
    expect(out.citation).toMatch(/Bompa 2018/)
  })

  it('return value has the documented shape', () => {
    const out = analyzeWeekendLongSessionShare({ log: [], today: TODAY })
    expect(out).toHaveProperty('band')
    expect(out).toHaveProperty('longSessions')
    expect(out).toHaveProperty('weekdayLongCount')
    expect(out).toHaveProperty('weekendLongCount')
    expect(out).toHaveProperty('weekendShare')
    expect(out).toHaveProperty('longSessionsByDay')
    expect(out).toHaveProperty('citation')
    expect(out.longSessionsByDay).toHaveProperty('mon')
    expect(out.longSessionsByDay).toHaveProperty('sun')
  })

  it('dateForDow helper sanity check', () => {
    expect(dateForDow(0, 0)).toBe('2026-05-11') // Mon of current week
    expect(dateForDow(6, 0)).toBe('2026-05-17') // Sun of current week
  })
})

// ─── Round-trip through sanitizeLogEntry (dead-card regression guard) ────────
// The sanitizer renames `durationMin` → `duration`. Pre-fix entryDurationMin
// only read `durationMin`/`duration_min`, so every real (sanitized) entry
// looked like a 0-minute session and no long sessions were counted, while
// raw-field tests passed. Round-tripping proves the card reads `duration`.
describe('analyzeWeekendLongSessionShare — sanitized round-trip', () => {
  it('counts long sessions from sanitizer-emitted `duration` (not raw durationMin)', () => {
    // The app stores `duration`; remap the helper's legacy `durationMin` to it
    // before sanitizing so the log matches what is actually persisted.
    const raw = []
    for (let w = 0; w < 6; w++) {
      const { durationMin, ...rest } = longEntry(dateForDow(5, w)) // Sat, 120min
      raw.push({ ...rest, duration: durationMin })
    }
    const log = raw.map(sanitizeLogEntry)
    expect(log[0].durationMin).toBeUndefined()
    expect(log[0].duration).toBe(120)
    const out = analyzeWeekendLongSessionShare({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.longSessions).toBe(6)
    expect(out.band).not.toBe('INSUFFICIENT_LONG_SESSIONS')
  })
})
