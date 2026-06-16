// src/lib/__tests__/athlete/trainingHourBudget.test.js
//
// Pure-fn tests for analyzeTrainingHourBudget — Hellard 2019 / Mujika 2014
// lifestyle hour-budget tracker (total weekly training hours over 12 weeks).

import { describe, it, expect } from 'vitest'
import {
  analyzeTrainingHourBudget,
  TRAINING_HOUR_BUDGET_CITATION,
} from '../../athlete/trainingHourBudget.js'
import { sanitizeLogEntry } from '../../validate.js'

// Wednesday — mondayOf('2026-05-13') = '2026-05-11'.
// 12 ISO weeks ending in the week containing today:
//   Mondays 2026-02-23 .. 2026-05-11 inclusive.
const TODAY = '2026-05-13'

const WEEK_MONDAYS = [
  '2026-02-23', '2026-03-02', '2026-03-09', '2026-03-16',
  '2026-03-23', '2026-03-30', '2026-04-06', '2026-04-13',
  '2026-04-20', '2026-04-27', '2026-05-04', '2026-05-11',
]

// Build a log placing a single session on the Saturday of each week with the
// given duration (minutes). 0/null skips the week.
function logFromDurations(durations, key = 'durationMin') {
  const log = []
  for (let i = 0; i < WEEK_MONDAYS.length; i++) {
    const dur = durations[i]
    if (!dur || dur <= 0) continue
    const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
    mon.setUTCDate(mon.getUTCDate() + 5) // Saturday
    log.push({
      date: mon.toISOString().slice(0, 10),
      [key]: dur,
    })
  }
  return log
}

// ─── null / today guards ───────────────────────────────────────────────────

describe('analyzeTrainingHourBudget — null / today guards', () => {
  it('returns null when today is missing', () => {
    expect(analyzeTrainingHourBudget({ log: [] })).toBeNull()
    expect(analyzeTrainingHourBudget({ log: [], today: undefined })).toBeNull()
    expect(analyzeTrainingHourBudget({ log: [], today: null })).toBeNull()
  })

  it('returns null when today is malformed', () => {
    expect(analyzeTrainingHourBudget({ log: [], today: 'bogus' })).toBeNull()
    expect(analyzeTrainingHourBudget({ log: [], today: '13-05-2026' })).toBeNull()
    expect(analyzeTrainingHourBudget({ log: [], today: 12345 })).toBeNull()
  })

  it('returns null for an invalid Date instance', () => {
    expect(analyzeTrainingHourBudget({ log: [], today: new Date('not-a-date') })).toBeNull()
  })
})

// ─── INSUFFICIENT_DATA band ────────────────────────────────────────────────

describe('analyzeTrainingHourBudget — INSUFFICIENT_DATA', () => {
  it('returns INSUFFICIENT_DATA with empty log', () => {
    const r = analyzeTrainingHourBudget({ log: [], today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('INSUFFICIENT_DATA')
    expect(r.meanHoursPerWeek).toBe(0)
    expect(r.maxHoursPerWeek).toBe(0)
    expect(r.totalHours).toBe(0)
    expect(r.trendDeltaPerWeek).toBe(0)
    expect(r.weeks.length).toBe(12)
  })

  it('returns INSUFFICIENT_DATA when log is null / undefined / non-array', () => {
    for (const log of [null, undefined, 'not-an-array', 42]) {
      const r = analyzeTrainingHourBudget({ log, today: TODAY })
      expect(r.band).toBe('INSUFFICIENT_DATA')
      expect(r.weeks.length).toBe(12)
    }
  })

  it('returns INSUFFICIENT_DATA when fewer than 6 weeks have any hours', () => {
    // Only 5 weeks have any duration → insufficient.
    const log = logFromDurations([0, 0, 0, 0, 0, 0, 0, 60, 60, 60, 60, 60])
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_DATA')
    expect(r.meanHoursPerWeek).toBe(0)
    expect(r.weeks.length).toBe(12)
  })

  it('still populates weeks[] in INSUFFICIENT_DATA state with the partial data', () => {
    const log = logFromDurations([0, 0, 0, 0, 0, 0, 0, 60, 60, 60, 60, 60])
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.weeks.map(w => w.weekStart)).toEqual(WEEK_MONDAYS)
    // last 5 weeks have 1h each, earlier 7 have 0
    const last5 = r.weeks.slice(-5).map(w => w.hours)
    expect(last5).toEqual([1, 1, 1, 1, 1])
    const first7 = r.weeks.slice(0, 7).map(w => w.hours)
    expect(first7.every(h => h === 0)).toBe(true)
  })
})

// ─── LIGHT band (mean < 4) ─────────────────────────────────────────────────

describe('analyzeTrainingHourBudget — LIGHT band', () => {
  it('returns LIGHT for mean ≈ 2h/wk', () => {
    // 120 min/wk = 2h/wk across all 12 weeks
    const log = logFromDurations(Array(12).fill(120))
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.band).toBe('LIGHT')
    expect(r.meanHoursPerWeek).toBe(2)
    expect(r.maxHoursPerWeek).toBe(2)
    expect(r.totalHours).toBe(24)
  })

  it('returns LIGHT for mean ≈ 3.5h/wk (just below 4)', () => {
    const log = logFromDurations(Array(12).fill(210)) // 3.5h/wk
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.band).toBe('LIGHT')
    expect(r.meanHoursPerWeek).toBe(3.5)
  })
})

// ─── AMATEUR band (4 ≤ mean < 8) ───────────────────────────────────────────

describe('analyzeTrainingHourBudget — AMATEUR band', () => {
  it('returns AMATEUR for mean = 4h/wk (lower bound)', () => {
    const log = logFromDurations(Array(12).fill(240)) // 4h/wk
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.band).toBe('AMATEUR')
    expect(r.meanHoursPerWeek).toBe(4)
  })

  it('returns AMATEUR for mean ≈ 6h/wk', () => {
    const log = logFromDurations(Array(12).fill(360)) // 6h/wk
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.band).toBe('AMATEUR')
    expect(r.meanHoursPerWeek).toBe(6)
  })

  it('returns AMATEUR for mean ≈ 7.99h/wk (just below COMMITTED floor)', () => {
    const log = logFromDurations(Array(12).fill(478)) // 7.9667h/wk
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.band).toBe('AMATEUR')
  })
})

// ─── COMMITTED band (8 ≤ mean < 12) ────────────────────────────────────────

describe('analyzeTrainingHourBudget — COMMITTED band', () => {
  it('returns COMMITTED for mean = 8h/wk (lower bound)', () => {
    const log = logFromDurations(Array(12).fill(480)) // 8h/wk
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.band).toBe('COMMITTED')
    expect(r.meanHoursPerWeek).toBe(8)
  })

  it('returns COMMITTED for mean ≈ 10h/wk', () => {
    const log = logFromDurations(Array(12).fill(600)) // 10h/wk
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.band).toBe('COMMITTED')
    expect(r.meanHoursPerWeek).toBe(10)
  })

  it('returns COMMITTED for mean ≈ 11.9h/wk (just below NEAR_PRO floor)', () => {
    const log = logFromDurations(Array(12).fill(714)) // 11.9h/wk
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.band).toBe('COMMITTED')
  })
})

// ─── NEAR_PRO band (mean ≥ 12) ─────────────────────────────────────────────

describe('analyzeTrainingHourBudget — NEAR_PRO band', () => {
  it('returns NEAR_PRO for mean = 12h/wk (lower bound)', () => {
    const log = logFromDurations(Array(12).fill(720)) // 12h/wk
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.band).toBe('NEAR_PRO')
    expect(r.meanHoursPerWeek).toBe(12)
  })

  it('returns NEAR_PRO for mean ≈ 18h/wk (elite-pattern volume)', () => {
    const log = logFromDurations(Array(12).fill(1080)) // 18h/wk
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.band).toBe('NEAR_PRO')
    expect(r.meanHoursPerWeek).toBe(18)
    expect(r.maxHoursPerWeek).toBe(18)
  })
})

// ─── duration field aliasing ───────────────────────────────────────────────

describe('analyzeTrainingHourBudget — durationMin vs duration_min', () => {
  it('reads durationMin', () => {
    const log = logFromDurations(Array(12).fill(360), 'durationMin')
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.band).toBe('AMATEUR')
    expect(r.meanHoursPerWeek).toBe(6)
  })

  it('reads duration_min as fallback', () => {
    const log = logFromDurations(Array(12).fill(360), 'duration_min')
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.band).toBe('AMATEUR')
    expect(r.meanHoursPerWeek).toBe(6)
  })

  it('prefers durationMin when both are present', () => {
    const log = []
    for (let i = 0; i < WEEK_MONDAYS.length; i++) {
      const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
      mon.setUTCDate(mon.getUTCDate() + 5)
      log.push({
        date: mon.toISOString().slice(0, 10),
        durationMin: 360,    // 6h
        duration_min: 9999,  // ignored
      })
    }
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.meanHoursPerWeek).toBe(6)
  })
})

// ─── duration filtering ────────────────────────────────────────────────────

describe('analyzeTrainingHourBudget — duration filtering', () => {
  it('ignores entries with durationMin = 0', () => {
    const log = []
    for (let i = 0; i < WEEK_MONDAYS.length; i++) {
      const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
      mon.setUTCDate(mon.getUTCDate() + 5)
      log.push({ date: mon.toISOString().slice(0, 10), durationMin: 0 })
    }
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_DATA')
  })

  it('ignores entries with negative durationMin', () => {
    const log = []
    for (let i = 0; i < WEEK_MONDAYS.length; i++) {
      const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
      mon.setUTCDate(mon.getUTCDate() + 5)
      log.push({ date: mon.toISOString().slice(0, 10), durationMin: -30 })
    }
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_DATA')
  })

  it('ignores entries with non-finite durationMin (NaN / Infinity / string)', () => {
    const log = []
    for (let i = 0; i < WEEK_MONDAYS.length; i++) {
      const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
      mon.setUTCDate(mon.getUTCDate() + 5)
      log.push({ date: mon.toISOString().slice(0, 10), durationMin: NaN })
      log.push({ date: mon.toISOString().slice(0, 10), durationMin: Infinity })
      log.push({ date: mon.toISOString().slice(0, 10), durationMin: 'sixty' })
    }
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_DATA')
  })

  it('sums sub-1-hour sessions correctly', () => {
    // Two 30-min sessions per week → 1h/wk → LIGHT
    const log = []
    for (let i = 0; i < WEEK_MONDAYS.length; i++) {
      const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
      mon.setUTCDate(mon.getUTCDate() + 5)
      log.push({ date: mon.toISOString().slice(0, 10), durationMin: 30 })
      log.push({ date: mon.toISOString().slice(0, 10), durationMin: 30 })
    }
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.band).toBe('LIGHT')
    expect(r.meanHoursPerWeek).toBe(1)
    expect(r.weeks.every(w => w.hours === 1)).toBe(true)
  })

  it('ignores entries with no/invalid date', () => {
    const log = [
      { date: null, durationMin: 600 },
      { date: 'bogus', durationMin: 600 },
      { date: '2026-13-99', durationMin: 600 },
      { durationMin: 600 },
    ]
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_DATA')
  })
})

// ─── mean includes zeros ───────────────────────────────────────────────────

describe('analyzeTrainingHourBudget — meanHoursPerWeek includes zeros', () => {
  it('divides by full window size, not by non-zero weeks', () => {
    // 6 weeks of 8h (= COMMITTED if averaged alone) and 6 weeks of 0
    // → mean across 12 weeks = 4h → AMATEUR
    const log = logFromDurations([0, 0, 0, 0, 0, 0, 480, 480, 480, 480, 480, 480])
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.meanHoursPerWeek).toBe(4)
    expect(r.band).toBe('AMATEUR')
    expect(r.maxHoursPerWeek).toBe(8)
    expect(r.totalHours).toBe(48)
  })
})

// ─── trendDeltaPerWeek (linear regression slope) ───────────────────────────

describe('analyzeTrainingHourBudget — trendDeltaPerWeek', () => {
  it('has positive slope when hours grow week over week', () => {
    // Ramp: 60, 120, 180, ... 720 (1h, 2h, ..., 12h)
    const durations = []
    for (let i = 1; i <= 12; i++) durations.push(i * 60)
    const log = logFromDurations(durations)
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    // Perfectly linear with slope 1.0 h/week index.
    expect(r.trendDeltaPerWeek).toBeCloseTo(1, 4)
  })

  it('has negative slope when hours decline week over week', () => {
    // Reverse ramp: 12h, 11h, ..., 1h
    const durations = []
    for (let i = 12; i >= 1; i--) durations.push(i * 60)
    const log = logFromDurations(durations)
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.trendDeltaPerWeek).toBeCloseTo(-1, 4)
  })

  it('has slope = 0 when hours are flat', () => {
    const log = logFromDurations(Array(12).fill(360))
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.trendDeltaPerWeek).toBe(0)
  })

  it('rounds trend to 4dp', () => {
    // A non-round slope: 60, 80, 100, ... evenly spaced by 20 min
    const durations = []
    for (let i = 0; i < 12; i++) durations.push(60 + i * 20)
    const log = logFromDurations(durations)
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    // 20 min/week index = 0.3333... h/week index
    expect(r.trendDeltaPerWeek).toBeCloseTo(0.3333, 3)
    // Make sure it's truly 4dp-rounded (no extra digits)
    const str = String(r.trendDeltaPerWeek)
    const decimals = str.includes('.') ? str.split('.')[1].length : 0
    expect(decimals).toBeLessThanOrEqual(4)
  })
})

// ─── custom windowWeeks ────────────────────────────────────────────────────

describe('analyzeTrainingHourBudget — custom windowWeeks', () => {
  it('honors windowWeeks = 6', () => {
    const log = logFromDurations(Array(12).fill(360)) // 6h/wk everywhere
    const r = analyzeTrainingHourBudget({ log, today: TODAY, windowWeeks: 6 })
    expect(r.weeks.length).toBe(6)
    // last 6 mondays
    expect(r.weeks.map(w => w.weekStart)).toEqual(WEEK_MONDAYS.slice(-6))
    expect(r.meanHoursPerWeek).toBe(6)
    expect(r.band).toBe('AMATEUR')
  })

  it('honors windowWeeks = 4', () => {
    const log = logFromDurations(Array(12).fill(720)) // 12h/wk everywhere
    // Window of 4 < 6 minimum non-zero weeks gate — but all 4 weeks have
    // hours, and the gate is on the literal threshold ≥ 6; with only 4
    // weeks total in window, max possible nonZero is 4 → INSUFFICIENT_DATA.
    const r = analyzeTrainingHourBudget({ log, today: TODAY, windowWeeks: 4 })
    expect(r.weeks.length).toBe(4)
    expect(r.band).toBe('INSUFFICIENT_DATA')
  })

  it('defaults to 12 when windowWeeks is not a number', () => {
    const log = logFromDurations(Array(12).fill(360))
    const r = analyzeTrainingHourBudget({ log, today: TODAY, windowWeeks: NaN })
    expect(r.weeks.length).toBe(12)
  })

  it('floors fractional windowWeeks', () => {
    const log = logFromDurations(Array(12).fill(360))
    const r = analyzeTrainingHourBudget({ log, today: TODAY, windowWeeks: 8.7 })
    expect(r.weeks.length).toBe(8)
  })
})

// ─── ISO week boundary ─────────────────────────────────────────────────────

describe('analyzeTrainingHourBudget — ISO week boundary', () => {
  it('weeks start on Monday and end on Sunday (ISO 8601)', () => {
    // Place a Sunday-of-week-12 session: 2026-05-17 sits in week starting
    // 2026-05-11. Also a Monday-of-week-12 session on 2026-05-11.
    const log = [
      { date: '2026-05-11', durationMin: 60 }, // Mon → week 2026-05-11
      { date: '2026-05-17', durationMin: 60 }, // Sun → week 2026-05-11
      // Sessions on the Sunday BEFORE: 2026-05-10 → week 2026-05-04.
      { date: '2026-05-10', durationMin: 60 },
      // And the rest just to satisfy the >=6 weeks gate.
      { date: '2026-03-02', durationMin: 60 },
      { date: '2026-03-09', durationMin: 60 },
      { date: '2026-03-16', durationMin: 60 },
      { date: '2026-03-23', durationMin: 60 },
    ]
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.band).not.toBe('INSUFFICIENT_DATA')
    const wkByStart = {}
    r.weeks.forEach(w => { wkByStart[w.weekStart] = w.hours })
    // 2026-05-11 week should have BOTH Mon (60) and Sun (60) sessions → 2h.
    expect(wkByStart['2026-05-11']).toBe(2)
    // 2026-05-04 week should have the Sunday-before session → 1h.
    expect(wkByStart['2026-05-04']).toBe(1)
  })

  it('excludes sessions before the oldest week in the window', () => {
    // Session on 2026-02-22 (Sunday) belongs to the week starting
    // 2026-02-16 → BEFORE earliestWeekStart 2026-02-23 → excluded.
    const log = [
      { date: '2026-02-22', durationMin: 600 },
      ...logFromDurations(Array(12).fill(360)),
    ]
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    // The 360 baseline alone gives meanHoursPerWeek = 6.
    expect(r.meanHoursPerWeek).toBe(6)
  })

  it('excludes sessions in the week AFTER the current week', () => {
    // 2026-05-18 (Mon) is the next ISO week → excluded.
    const log = [
      { date: '2026-05-18', durationMin: 9999 },
      ...logFromDurations(Array(12).fill(360)),
    ]
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.meanHoursPerWeek).toBe(6)
  })
})

// ─── today input forms ────────────────────────────────────────────────────

describe('analyzeTrainingHourBudget — today as Date vs string', () => {
  it('accepts today as a Date instance', () => {
    const log = logFromDurations(Array(12).fill(360))
    const r = analyzeTrainingHourBudget({
      log,
      today: new Date('2026-05-13T12:00:00Z'),
    })
    expect(r).not.toBeNull()
    expect(r.meanHoursPerWeek).toBe(6)
    expect(r.weeks.map(w => w.weekStart)).toEqual(WEEK_MONDAYS)
  })

  it('accepts today as an ISO string with time component', () => {
    const log = logFromDurations(Array(12).fill(360))
    const r = analyzeTrainingHourBudget({
      log,
      today: '2026-05-13T23:59:59Z',
    })
    expect(r).not.toBeNull()
    expect(r.meanHoursPerWeek).toBe(6)
  })

  it('produces the same result for Date vs string today', () => {
    const log = logFromDurations(Array(12).fill(360))
    const a = analyzeTrainingHourBudget({ log, today: TODAY })
    const b = analyzeTrainingHourBudget({
      log,
      today: new Date('2026-05-13T00:00:00Z'),
    })
    expect(a).toEqual(b)
  })
})

// ─── citation ──────────────────────────────────────────────────────────────

describe('analyzeTrainingHourBudget — citation', () => {
  it('returns the Hellard 2019; Mujika 2014 citation', () => {
    const log = logFromDurations(Array(12).fill(360))
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.citation).toBe('Hellard 2019; Mujika 2014')
    expect(TRAINING_HOUR_BUDGET_CITATION).toBe('Hellard 2019; Mujika 2014')
  })

  it('returns citation even in INSUFFICIENT_DATA state', () => {
    const r = analyzeTrainingHourBudget({ log: [], today: TODAY })
    expect(r.citation).toBe('Hellard 2019; Mujika 2014')
  })
})

// ─── shape / rounding ─────────────────────────────────────────────────────

describe('analyzeTrainingHourBudget — shape and rounding', () => {
  it('rounds per-week hours to 2dp', () => {
    // 25-minute sessions = 0.4166...h
    const log = []
    for (let i = 0; i < WEEK_MONDAYS.length; i++) {
      const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
      mon.setUTCDate(mon.getUTCDate() + 5)
      log.push({ date: mon.toISOString().slice(0, 10), durationMin: 25 })
    }
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    for (const w of r.weeks) {
      const decimals = String(w.hours).includes('.')
        ? String(w.hours).split('.')[1].length
        : 0
      expect(decimals).toBeLessThanOrEqual(2)
    }
  })

  it('exposes weeks oldest-first', () => {
    const log = logFromDurations(Array(12).fill(360))
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.weeks.map(w => w.weekStart)).toEqual(WEEK_MONDAYS)
  })

  it('returns the full expected shape', () => {
    const log = logFromDurations(Array(12).fill(360))
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(Object.keys(r).sort()).toEqual([
      'band',
      'citation',
      'maxHoursPerWeek',
      'meanHoursPerWeek',
      'totalHours',
      'trendDeltaPerWeek',
      'weeks',
    ])
  })
})

// ─── stat correctness sanity ──────────────────────────────────────────────

describe('analyzeTrainingHourBudget — stat correctness', () => {
  it('reports the correct maxHoursPerWeek when one week peaks', () => {
    const durs = Array(12).fill(360)
    durs[5] = 900 // 15h spike
    const log = logFromDurations(durs)
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.maxHoursPerWeek).toBe(15)
  })

  it('reports totalHours = sum of weekly hours', () => {
    const log = logFromDurations(Array(12).fill(360)) // 6h × 12 = 72h
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r.totalHours).toBe(72)
  })
})

// ─── Round-trip through sanitizeLogEntry (dead-card regression guard) ────────
// The sanitizer renames `durationMin` → `duration`. Pre-fix this card only
// read `durationMin`/`duration_min`, so it computed 0 hours on every real
// (sanitized) entry while raw-field tests passed. Building the log THROUGH the
// sanitizer proves the card reads the emitted `duration` and would catch a
// future regression that renames/strips it.
describe('analyzeTrainingHourBudget — sanitized round-trip', () => {
  it('computes hours from sanitizer-emitted `duration` (not raw durationMin)', () => {
    // The app stores the canonical `duration` field; sanitizeLogEntry reads it
    // and ignores the legacy `durationMin`. Build the log with `duration`.
    const raw = logFromDurations(Array(12).fill(360), 'duration')
    const log = raw.map(sanitizeLogEntry)
    // Sanity: only `duration` survives; legacy durationMin is absent.
    expect(log[0].durationMin).toBeUndefined()
    expect(log[0].duration).toBe(360)
    const r = analyzeTrainingHourBudget({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalHours).toBe(72)
  })
})
