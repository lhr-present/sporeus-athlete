// src/lib/__tests__/athlete/weeklyEnduranceTime.test.js
//
// Pure-fn tests for analyzeWeeklyEnduranceTime — Maffetone 2010 / Seiler 2010 /
// Stöggl 2014 absolute weekly aerobic-foundation (Z1+Z2) minutes tracker.

import { describe, it, expect } from 'vitest'
import {
  analyzeWeeklyEnduranceTime,
  WEEKLY_ENDURANCE_TIME_CITATION,
} from '../../athlete/weeklyEnduranceTime.js'

// Wednesday — Monday of the ISO week containing TODAY is 2026-05-11.
// 12 ISO weeks ending in the week containing today:
//   Mondays 2026-02-23 .. 2026-05-11 inclusive.
const TODAY = '2026-05-13'

const WEEK_MONDAYS = [
  '2026-02-23', '2026-03-02', '2026-03-09', '2026-03-16',
  '2026-03-23', '2026-03-30', '2026-04-06', '2026-04-13',
  '2026-04-20', '2026-04-27', '2026-05-04', '2026-05-11',
]

// Build a log placing N evenly-sized easy sessions on the Saturday of each
// week, with cumulative weekly minutes = durationsPerWeek[i]. Pass 0/null
// to skip that week.
function easyZ1Log(durationsPerWeek) {
  const log = []
  for (let i = 0; i < WEEK_MONDAYS.length; i++) {
    const dur = durationsPerWeek[i]
    if (!dur || dur <= 0) continue
    const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
    mon.setUTCDate(mon.getUTCDate() + 5) // Saturday
    log.push({
      date: mon.toISOString().slice(0, 10),
      durationMin: dur,
      zone: 'Z1',
    })
  }
  return log
}

// ─── null guards ────────────────────────────────────────────────────────────

describe('analyzeWeeklyEnduranceTime — null guards', () => {
  it('returns null for an empty log', () => {
    expect(analyzeWeeklyEnduranceTime({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null when log is not an array', () => {
    expect(analyzeWeeklyEnduranceTime({ log: null, today: TODAY })).toBeNull()
    expect(analyzeWeeklyEnduranceTime({ log: undefined, today: TODAY })).toBeNull()
    expect(analyzeWeeklyEnduranceTime({ log: 'not array', today: TODAY })).toBeNull()
  })

  it('returns null when today is missing or invalid', () => {
    expect(analyzeWeeklyEnduranceTime({ log: [], today: undefined })).toBeNull()
    expect(analyzeWeeklyEnduranceTime({ log: [], today: null })).toBeNull()
    expect(analyzeWeeklyEnduranceTime({ log: [], today: 12345 })).toBeNull()
    expect(analyzeWeeklyEnduranceTime({ log: [], today: 'bogus' })).toBeNull()
  })

  it('returns null when windowWeeks < 2', () => {
    const log = easyZ1Log([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    expect(
      analyzeWeeklyEnduranceTime({ log, today: TODAY, windowWeeks: 1 })
    ).toBeNull()
  })

  it('returns null with fewer than 6 weeks of classifiable load', () => {
    // 5 weeks with classifiable load → null.
    const log = easyZ1Log([0, 0, 0, 0, 0, 0, 0, 60, 60, 60, 60, 60])
    expect(analyzeWeeklyEnduranceTime({ log, today: TODAY })).toBeNull()
  })

  it('returns null when all entries are out of window', () => {
    const log = [
      { date: '2025-10-01', durationMin: 120, zone: 'Z1' },
      { date: '2025-11-01', durationMin: 120, zone: 'Z1' },
    ]
    expect(analyzeWeeklyEnduranceTime({ log, today: TODAY })).toBeNull()
  })

  it('returns null when entries have no zone and no rpe (unclassifiable)', () => {
    // 12 unclassifiable entries — should be skipped entirely.
    const log = []
    for (const ws of WEEK_MONDAYS) {
      const mon = new Date(ws + 'T00:00:00Z')
      mon.setUTCDate(mon.getUTCDate() + 5)
      log.push({
        date: mon.toISOString().slice(0, 10),
        durationMin: 60,
        // no zone, no rpe
      })
    }
    expect(analyzeWeeklyEnduranceTime({ log, today: TODAY })).toBeNull()
  })
})

// ─── BELOW_AMATEUR band ─────────────────────────────────────────────────────

describe('analyzeWeeklyEnduranceTime — BELOW_AMATEUR band', () => {
  it('classifies < 180 min/wk mean easy as BELOW_AMATEUR', () => {
    const log = easyZ1Log([90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90])
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('BELOW_AMATEUR')
    expect(r.meanEasyMinPerWeek).toBe(90)
  })

  it('classifies 179 min/wk just below the AMATEUR floor as BELOW_AMATEUR', () => {
    const log = easyZ1Log([179, 179, 179, 179, 179, 179, 179, 179, 179, 179, 179, 179])
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r.band).toBe('BELOW_AMATEUR')
  })
})

// ─── AMATEUR_BAND ───────────────────────────────────────────────────────────

describe('analyzeWeeklyEnduranceTime — AMATEUR_BAND', () => {
  it('classifies 180 min/wk exactly as AMATEUR_BAND (inclusive floor)', () => {
    const log = easyZ1Log([180, 180, 180, 180, 180, 180, 180, 180, 180, 180, 180, 180])
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r.band).toBe('AMATEUR_BAND')
    expect(r.meanEasyMinPerWeek).toBe(180)
  })

  it('classifies 270 min/wk (middle of band) as AMATEUR_BAND', () => {
    const log = easyZ1Log([270, 270, 270, 270, 270, 270, 270, 270, 270, 270, 270, 270])
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r.band).toBe('AMATEUR_BAND')
    expect(r.meanEasyMinPerWeek).toBe(270)
  })

  it('classifies 359 min/wk just below INTERMEDIATE as AMATEUR_BAND', () => {
    const log = easyZ1Log([359, 359, 359, 359, 359, 359, 359, 359, 359, 359, 359, 359])
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r.band).toBe('AMATEUR_BAND')
  })
})

// ─── INTERMEDIATE_BAND ──────────────────────────────────────────────────────

describe('analyzeWeeklyEnduranceTime — INTERMEDIATE_BAND', () => {
  it('classifies 360 min/wk exactly as INTERMEDIATE_BAND', () => {
    const log = easyZ1Log([360, 360, 360, 360, 360, 360, 360, 360, 360, 360, 360, 360])
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r.band).toBe('INTERMEDIATE_BAND')
    expect(r.meanEasyMinPerWeek).toBe(360)
  })

  it('classifies 480 min/wk (middle of band) as INTERMEDIATE_BAND', () => {
    const log = easyZ1Log([480, 480, 480, 480, 480, 480, 480, 480, 480, 480, 480, 480])
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r.band).toBe('INTERMEDIATE_BAND')
  })

  it('classifies 599 min/wk just below ADVANCED as INTERMEDIATE_BAND', () => {
    const log = easyZ1Log([599, 599, 599, 599, 599, 599, 599, 599, 599, 599, 599, 599])
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r.band).toBe('INTERMEDIATE_BAND')
  })
})

// ─── ADVANCED_BAND ──────────────────────────────────────────────────────────

describe('analyzeWeeklyEnduranceTime — ADVANCED_BAND', () => {
  it('classifies 600 min/wk exactly as ADVANCED_BAND', () => {
    const log = easyZ1Log([600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600])
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r.band).toBe('ADVANCED_BAND')
    expect(r.meanEasyMinPerWeek).toBe(600)
  })

  it('classifies 900 min/wk (elite) as ADVANCED_BAND', () => {
    const log = easyZ1Log([900, 900, 900, 900, 900, 900, 900, 900, 900, 900, 900, 900])
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r.band).toBe('ADVANCED_BAND')
  })
})

// ─── zone Z1/Z2 detection ───────────────────────────────────────────────────

describe('analyzeWeeklyEnduranceTime — zone Z1/Z2 detection', () => {
  it('treats zone="Z1" and zone="Z2" as easy regardless of case', () => {
    const log = []
    for (let i = 0; i < WEEK_MONDAYS.length; i++) {
      const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
      mon.setUTCDate(mon.getUTCDate() + 5)
      const sat = mon.toISOString().slice(0, 10)
      log.push({ date: sat, durationMin: 120, zone: i % 2 === 0 ? 'z1' : 'Z2' })
    }
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.meanEasyMinPerWeek).toBe(120)
    expect(r.easyShare).toBe(1)
  })

  it('classifies zone Z3+ entries as NOT easy', () => {
    const log = []
    for (let i = 0; i < WEEK_MONDAYS.length; i++) {
      const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
      mon.setUTCDate(mon.getUTCDate() + 5)
      const sat = mon.toISOString().slice(0, 10)
      log.push({ date: sat, durationMin: 60, zone: 'Z4' })
    }
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.meanEasyMinPerWeek).toBe(0)
    expect(r.meanTotalMinPerWeek).toBe(60)
    expect(r.easyShare).toBe(0)
    expect(r.band).toBe('BELOW_AMATEUR')
  })

  it('correctly handles a mixed Z2 + Z5 week', () => {
    const log = []
    // Week containing 2026-05-11: 120 min Z2 + 30 min Z5.
    log.push({ date: '2026-05-13', durationMin: 120, zone: 'Z2' })
    log.push({ date: '2026-05-14', durationMin: 30, zone: 'Z5' })
    // Pad 11 more weeks with 120 min Z2 each.
    for (let i = 0; i < 11; i++) {
      const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
      mon.setUTCDate(mon.getUTCDate() + 5)
      log.push({
        date: mon.toISOString().slice(0, 10),
        durationMin: 120,
        zone: 'Z2',
      })
    }
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r).not.toBeNull()
    // 11 weeks contribute 120 easy + 0 hard; final week contributes 120 easy + 30 hard.
    expect(r.weeks[11].easyMin).toBe(120)
    expect(r.weeks[11].totalMin).toBe(150)
  })
})

// ─── RPE fallback ───────────────────────────────────────────────────────────

describe('analyzeWeeklyEnduranceTime — RPE fallback when zone absent', () => {
  it('treats rpe ≤ 4 as easy when no zone field is present', () => {
    const log = []
    for (let i = 0; i < WEEK_MONDAYS.length; i++) {
      const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
      mon.setUTCDate(mon.getUTCDate() + 5)
      log.push({
        date: mon.toISOString().slice(0, 10),
        durationMin: 180,
        rpe: 3, // easy
      })
    }
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.meanEasyMinPerWeek).toBe(180)
    expect(r.band).toBe('AMATEUR_BAND')
  })

  it('treats rpe ≥ 5 as NOT easy when no zone field is present', () => {
    const log = []
    for (let i = 0; i < WEEK_MONDAYS.length; i++) {
      const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
      mon.setUTCDate(mon.getUTCDate() + 5)
      log.push({
        date: mon.toISOString().slice(0, 10),
        durationMin: 60,
        rpe: 7,
      })
    }
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.meanEasyMinPerWeek).toBe(0)
    expect(r.meanTotalMinPerWeek).toBe(60)
    expect(r.band).toBe('BELOW_AMATEUR')
  })

  it('treats rpe = 4 as easy (boundary inclusive)', () => {
    const log = []
    for (let i = 0; i < WEEK_MONDAYS.length; i++) {
      const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
      mon.setUTCDate(mon.getUTCDate() + 5)
      log.push({
        date: mon.toISOString().slice(0, 10),
        durationMin: 200,
        rpe: 4,
      })
    }
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r.meanEasyMinPerWeek).toBe(200)
    expect(r.easyShare).toBe(1)
  })

  it('treats rpe = 5 as NOT easy (boundary exclusive)', () => {
    const log = []
    for (let i = 0; i < WEEK_MONDAYS.length; i++) {
      const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
      mon.setUTCDate(mon.getUTCDate() + 5)
      log.push({
        date: mon.toISOString().slice(0, 10),
        durationMin: 80,
        rpe: 5,
      })
    }
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r.meanEasyMinPerWeek).toBe(0)
    expect(r.meanTotalMinPerWeek).toBe(80)
  })

  it('prefers zone over rpe when both present', () => {
    const log = []
    for (let i = 0; i < WEEK_MONDAYS.length; i++) {
      const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
      mon.setUTCDate(mon.getUTCDate() + 5)
      log.push({
        date: mon.toISOString().slice(0, 10),
        durationMin: 200,
        zone: 'Z5', // hard
        rpe: 2,     // would be easy if used
      })
    }
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r.meanEasyMinPerWeek).toBe(0)
    expect(r.meanTotalMinPerWeek).toBe(200)
  })
})

// ─── skip unclassifiable entries ────────────────────────────────────────────

describe('analyzeWeeklyEnduranceTime — skip when neither zone nor rpe', () => {
  it('skips entries with no zone and no rpe (does not count toward totalMin)', () => {
    const log = []
    // 6 classifiable easy weeks + 6 unclassifiable.
    for (let i = 0; i < WEEK_MONDAYS.length; i++) {
      const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
      mon.setUTCDate(mon.getUTCDate() + 5)
      const sat = mon.toISOString().slice(0, 10)
      if (i < 6) {
        log.push({ date: sat, durationMin: 200, zone: 'Z2' })
      } else {
        log.push({ date: sat, durationMin: 300 }) // unclassifiable
      }
    }
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r).not.toBeNull()
    // Only the first 6 weeks count → meanEasy = (6 * 200) / 12 = 100.
    expect(r.meanEasyMinPerWeek).toBe(100)
    expect(r.meanTotalMinPerWeek).toBe(100)
  })

  it('skips entries with non-finite rpe and no zone', () => {
    const log = []
    for (let i = 0; i < WEEK_MONDAYS.length; i++) {
      const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
      mon.setUTCDate(mon.getUTCDate() + 5)
      const sat = mon.toISOString().slice(0, 10)
      log.push({ date: sat, durationMin: 200, rpe: 'lol' })
    }
    // All entries skipped → no classifiable weeks.
    expect(analyzeWeeklyEnduranceTime({ log, today: TODAY })).toBeNull()
  })
})

// ─── durationMin vs duration_min ────────────────────────────────────────────

describe('analyzeWeeklyEnduranceTime — durationMin vs duration_min', () => {
  it('reads duration_min when durationMin is absent', () => {
    const log = []
    for (let i = 0; i < WEEK_MONDAYS.length; i++) {
      const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
      mon.setUTCDate(mon.getUTCDate() + 5)
      log.push({
        date: mon.toISOString().slice(0, 10),
        duration_min: 240,
        zone: 'Z2',
      })
    }
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.meanEasyMinPerWeek).toBe(240)
  })

  it('prefers durationMin over duration_min when both present', () => {
    const log = []
    for (let i = 0; i < WEEK_MONDAYS.length; i++) {
      const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
      mon.setUTCDate(mon.getUTCDate() + 5)
      log.push({
        date: mon.toISOString().slice(0, 10),
        durationMin: 300,
        duration_min: 60,
        zone: 'Z2',
      })
    }
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r.meanEasyMinPerWeek).toBe(300)
  })

  it('skips entries with non-finite or ≤ 0 duration', () => {
    const log = []
    // 12 valid easy weeks
    for (let i = 0; i < WEEK_MONDAYS.length; i++) {
      const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
      mon.setUTCDate(mon.getUTCDate() + 5)
      log.push({
        date: mon.toISOString().slice(0, 10),
        durationMin: 200,
        zone: 'Z2',
      })
    }
    // Garbage entries that should be silently skipped.
    log.push({ date: '2026-05-12', durationMin: 0, zone: 'Z2' })
    log.push({ date: '2026-05-12', durationMin: -5, zone: 'Z2' })
    log.push({ date: '2026-05-12', durationMin: NaN, zone: 'Z2' })

    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r.meanEasyMinPerWeek).toBe(200)
  })
})

// ─── easyShare math ─────────────────────────────────────────────────────────

describe('analyzeWeeklyEnduranceTime — easyShare math', () => {
  it('returns easyShare ≈ 0.8 when 80% of weekly minutes are easy', () => {
    const log = []
    for (let i = 0; i < WEEK_MONDAYS.length; i++) {
      const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
      mon.setUTCDate(mon.getUTCDate() + 5)
      const sat = mon.toISOString().slice(0, 10)
      log.push({ date: sat, durationMin: 240, zone: 'Z2' }) // easy
      log.push({ date: sat, durationMin: 60,  zone: 'Z4' }) // hard
    }
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r.meanEasyMinPerWeek).toBe(240)
    expect(r.meanTotalMinPerWeek).toBe(300)
    expect(r.easyShare).toBeCloseTo(0.8, 4)
  })

  it('returns easyShare 0 when no easy entries exist', () => {
    const log = []
    for (let i = 0; i < WEEK_MONDAYS.length; i++) {
      const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
      mon.setUTCDate(mon.getUTCDate() + 5)
      log.push({
        date: mon.toISOString().slice(0, 10),
        durationMin: 60,
        zone: 'Z5',
      })
    }
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r.easyShare).toBe(0)
  })
})

// ─── trendPctPerWeek math ───────────────────────────────────────────────────

describe('analyzeWeeklyEnduranceTime — trendPctPerWeek math', () => {
  it('returns a positive trend on a steady ramp', () => {
    const log = easyZ1Log([100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210])
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.trendPctPerWeek).toBeGreaterThan(0)
  })

  it('returns a negative trend on a steady decline', () => {
    const log = easyZ1Log([210, 200, 190, 180, 170, 160, 150, 140, 130, 120, 110, 100])
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r.trendPctPerWeek).toBeLessThan(0)
  })

  it('returns near-zero trend on a flat profile', () => {
    const log = easyZ1Log([200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200])
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(Math.abs(r.trendPctPerWeek)).toBeLessThan(1e-6)
  })
})

// ─── custom windowWeeks ─────────────────────────────────────────────────────

describe('analyzeWeeklyEnduranceTime — custom windowWeeks', () => {
  it('respects a custom windowWeeks value', () => {
    const log = easyZ1Log([240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240])
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY, windowWeeks: 8 })
    expect(r).not.toBeNull()
    expect(r.weeks.length).toBe(8)
    expect(r.meanEasyMinPerWeek).toBe(240)
  })

  it('truncates window so older weeks are dropped', () => {
    const log = easyZ1Log([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 500])
    // 12-wk mean easy = ((11*100)+500)/12 = 133.33...
    const r12 = analyzeWeeklyEnduranceTime({ log, today: TODAY, windowWeeks: 12 })
    expect(r12.meanEasyMinPerWeek).toBeCloseTo(133.33, 1)
    // 6-wk window pulls the high week forward.
    const r6 = analyzeWeeklyEnduranceTime({ log, today: TODAY, windowWeeks: 6 })
    expect(r6.weeks.length).toBe(6)
    // last 6 weeks contain 5 weeks of 100 + 1 of 500 → mean = 166.67
    expect(r6.meanEasyMinPerWeek).toBeCloseTo(166.67, 1)
  })
})

// ─── ISO week boundary ──────────────────────────────────────────────────────

describe('analyzeWeeklyEnduranceTime — ISO week boundary', () => {
  it('Sunday entries fall into the week starting that prior Monday', () => {
    const log = []
    // Sunday 2026-05-17 is the last day of the ISO week starting 2026-05-11.
    log.push({ date: '2026-05-17', durationMin: 250, zone: 'Z2' })
    // Pad 11 more weeks.
    for (let i = 0; i < 11; i++) {
      const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
      mon.setUTCDate(mon.getUTCDate() + 5)
      log.push({
        date: mon.toISOString().slice(0, 10),
        durationMin: 100,
        zone: 'Z2',
      })
    }
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r).not.toBeNull()
    // The Sunday session lands in the final week (weekStart 2026-05-11).
    expect(r.weeks[11].easyMin).toBe(250)
  })

  it('excludes entries from after the current ISO week', () => {
    const log = easyZ1Log([200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200])
    // Next-week Monday 2026-05-18 should be excluded.
    log.push({ date: '2026-05-18', durationMin: 999, zone: 'Z2' })
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r.meanEasyMinPerWeek).toBe(200)
  })
})

// ─── today as Date vs string ────────────────────────────────────────────────

describe('analyzeWeeklyEnduranceTime — today as Date vs string', () => {
  it('accepts a Date for today and produces identical output to ISO string', () => {
    const log = easyZ1Log([220, 220, 220, 220, 220, 220, 220, 220, 220, 220, 220, 220])
    const a = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    const b = analyzeWeeklyEnduranceTime({
      log,
      today: new Date(TODAY + 'T12:00:00Z'),
    })
    expect(b).not.toBeNull()
    expect(b.band).toBe(a.band)
    expect(b.meanEasyMinPerWeek).toBe(a.meanEasyMinPerWeek)
    expect(b.weeks.map(w => w.weekStart)).toEqual(a.weeks.map(w => w.weekStart))
  })
})

// ─── shape / citation ───────────────────────────────────────────────────────

describe('analyzeWeeklyEnduranceTime — output shape', () => {
  it('returns the expected output shape with citation', () => {
    const log = easyZ1Log([240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240])
    const r = analyzeWeeklyEnduranceTime({ log, today: TODAY })
    expect(r).toMatchObject({
      band: expect.any(String),
      weeks: expect.any(Array),
      meanEasyMinPerWeek: expect.any(Number),
      meanTotalMinPerWeek: expect.any(Number),
      easyShare: expect.any(Number),
      trendPctPerWeek: expect.any(Number),
      citation: WEEKLY_ENDURANCE_TIME_CITATION,
    })
    expect(r.weeks.length).toBe(12)
    for (const w of r.weeks) {
      expect(w).toMatchObject({
        weekStart: expect.any(String),
        easyMin: expect.any(Number),
        totalMin: expect.any(Number),
      })
    }
  })

  it('exposes WEEKLY_ENDURANCE_TIME_CITATION constant', () => {
    expect(WEEKLY_ENDURANCE_TIME_CITATION).toMatch(/Maffetone 2010/)
    expect(WEEKLY_ENDURANCE_TIME_CITATION).toMatch(/Seiler 2010/)
    expect(WEEKLY_ENDURANCE_TIME_CITATION).toMatch(/Stöggl 2014/)
  })
})
