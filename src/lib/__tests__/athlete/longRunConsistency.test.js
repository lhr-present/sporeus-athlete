// src/lib/__tests__/athlete/longRunConsistency.test.js
//
// Pure-fn tests for analyzeLongRunConsistency — Daniels 2014 / Pfitzinger 2014
// long-run duration consistency (CV across 12 ISO weeks) tracker.

import { describe, it, expect } from 'vitest'
import {
  analyzeLongRunConsistency,
  LONG_RUN_CONSISTENCY_CITATION,
} from '../../athlete/longRunConsistency.js'

// Wednesday — mondayOf('2026-05-13') = '2026-05-11'.
// 12 ISO weeks ending in the week containing today:
//   Mondays 2026-02-23 .. 2026-05-11 inclusive.
const TODAY = '2026-05-13'

const WEEK_MONDAYS = [
  '2026-02-23', '2026-03-02', '2026-03-09', '2026-03-16',
  '2026-03-23', '2026-03-30', '2026-04-06', '2026-04-13',
  '2026-04-20', '2026-04-27', '2026-05-04', '2026-05-11',
]

function longRun(date, durationMin, extras = {}) {
  return { date, durationMin, type: 'long run', ...extras }
}

// Place a single long run on Saturday (Monday + 5) of each week with the
// given durations. Pass null/0 to skip that week.
function buildLog(durationsPerWeek) {
  const log = []
  for (let i = 0; i < WEEK_MONDAYS.length; i++) {
    const dur = durationsPerWeek[i]
    if (!dur || dur <= 0) continue
    const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
    mon.setUTCDate(mon.getUTCDate() + 5) // Saturday
    const sat = mon.toISOString().slice(0, 10)
    log.push(longRun(sat, dur))
  }
  return log
}

// ─── null guards ────────────────────────────────────────────────────────────

describe('analyzeLongRunConsistency — null guards', () => {
  it('returns null for an empty log', () => {
    expect(analyzeLongRunConsistency({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null when log is not an array', () => {
    expect(analyzeLongRunConsistency({ log: null, today: TODAY })).toBeNull()
    expect(analyzeLongRunConsistency({ log: undefined, today: TODAY })).toBeNull()
    expect(analyzeLongRunConsistency({ log: 'not array', today: TODAY })).toBeNull()
  })

  it('returns null when today is missing or invalid', () => {
    expect(analyzeLongRunConsistency({ log: [], today: undefined })).toBeNull()
    expect(analyzeLongRunConsistency({ log: [], today: null })).toBeNull()
    expect(analyzeLongRunConsistency({ log: [], today: 12345 })).toBeNull()
    expect(analyzeLongRunConsistency({ log: [], today: 'bogus' })).toBeNull()
  })

  it('returns null when windowWeeks < 2', () => {
    const log = buildLog([90, 95, 100, 105, 110, 115, 0, 0, 0, 0, 0, 0])
    expect(
      analyzeLongRunConsistency({ log, today: TODAY, windowWeeks: 1 })
    ).toBeNull()
  })

  it('returns null when longRunMinThreshold ≤ 0 or non-finite', () => {
    const log = buildLog([90, 95, 100, 105, 110, 115, 0, 0, 0, 0, 0, 0])
    expect(
      analyzeLongRunConsistency({ log, today: TODAY, longRunMinThreshold: 0 })
    ).toBeNull()
    expect(
      analyzeLongRunConsistency({ log, today: TODAY, longRunMinThreshold: -5 })
    ).toBeNull()
    expect(
      analyzeLongRunConsistency({ log, today: TODAY, longRunMinThreshold: NaN })
    ).toBeNull()
  })

  it('returns null with fewer than 3 long-run weeks (truly nothing to show)', () => {
    // 2 long-run weeks → null
    const log = buildLog([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100, 110])
    expect(analyzeLongRunConsistency({ log, today: TODAY })).toBeNull()
  })

  it('returns null when only out-of-range long runs exist', () => {
    const log = [
      longRun('2025-09-01', 120),
      longRun('2025-10-01', 120),
      longRun('2025-11-01', 120),
    ]
    expect(analyzeLongRunConsistency({ log, today: TODAY })).toBeNull()
  })
})

// ─── INSUFFICIENT band (3-5 long-run weeks) ─────────────────────────────────

describe('analyzeLongRunConsistency — INSUFFICIENT band (3-5 long-run weeks)', () => {
  it('returns INSUFFICIENT for exactly 3 long-run weeks with zeroed metrics', () => {
    const log = buildLog([0, 0, 0, 0, 0, 0, 0, 0, 0, 100, 110, 120])
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('INSUFFICIENT')
    expect(r.longRunCount).toBe(3)
    expect(r.cv).toBe(0)
    expect(r.meanMin).toBe(0)
    expect(r.trendSlopePctPerWeek).toBe(0)
    expect(r.weeks).toHaveLength(12)
    expect(r.citation).toBe(LONG_RUN_CONSISTENCY_CITATION)
  })

  it('returns INSUFFICIENT for 5 long-run weeks', () => {
    const log = buildLog([0, 0, 0, 0, 0, 0, 0, 95, 100, 105, 110, 115])
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('INSUFFICIENT')
    expect(r.longRunCount).toBe(5)
  })

  it('returns CLASSIFIED (not INSUFFICIENT) at exactly 6 long-run weeks', () => {
    const log = buildLog([0, 0, 0, 0, 0, 0, 100, 100, 100, 100, 100, 100])
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).not.toBe('INSUFFICIENT')
    expect(r.longRunCount).toBe(6)
  })
})

// ─── STEADY band ────────────────────────────────────────────────────────────

describe('analyzeLongRunConsistency — STEADY band', () => {
  it('all 12 weeks at 100min → cv = 0 → STEADY', () => {
    const log = buildLog([
      100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100,
    ])
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('STEADY')
    expect(r.cv).toBe(0)
    expect(r.meanMin).toBe(100)
    expect(r.longRunCount).toBe(12)
    expect(r.trendSlopePctPerWeek).toBe(0)
  })

  it('low CV (< 0.15) with small jitter → STEADY', () => {
    // 100, 105, 95, 100, 105, 95, 100, 105, 95, 100, 105, 95
    // mean = 100, stdev ≈ 4.08, cv ≈ 0.0408 → STEADY
    const log = buildLog([
      100, 105, 95, 100, 105, 95, 100, 105, 95, 100, 105, 95,
    ])
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    expect(r.band).toBe('STEADY')
    expect(r.cv).toBeLessThan(0.15)
  })

  it('STEADY wins over slope when cv < 0.15 even with positive trend', () => {
    // 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106
    // mean = 100.5, stdev ≈ 3.45, cv ≈ 0.034 → STEADY (cv first).
    const log = buildLog([95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106])
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    expect(r.band).toBe('STEADY')
    expect(r.cv).toBeLessThan(0.15)
  })
})

// ─── PROGRESSIVE band ───────────────────────────────────────────────────────

describe('analyzeLongRunConsistency — PROGRESSIVE band', () => {
  it('rising durations with cv ≥ 0.15 and slope > +3%/week → PROGRESSIVE', () => {
    // 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170
    // mean = 115, range 60-170 → high CV (~0.275), strong positive slope.
    const log = buildLog([60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170])
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('PROGRESSIVE')
    expect(r.cv).toBeGreaterThanOrEqual(0.15)
    expect(r.trendSlopePctPerWeek).toBeGreaterThan(0.03)
  })
})

// ─── EROSIVE band ───────────────────────────────────────────────────────────

describe('analyzeLongRunConsistency — EROSIVE band', () => {
  it('falling durations with cv ≥ 0.15 and slope < -3%/week → EROSIVE', () => {
    // 170, 160, 150, 140, 130, 120, 110, 100, 90, 80, 70, 60
    // mean = 115, big spread → high CV, strong negative slope.
    const log = buildLog([170, 160, 150, 140, 130, 120, 110, 100, 90, 80, 70, 60])
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('EROSIVE')
    expect(r.cv).toBeGreaterThanOrEqual(0.15)
    expect(r.trendSlopePctPerWeek).toBeLessThan(-0.03)
  })

  it('mixed-duration descending series with high CV → EROSIVE', () => {
    // Variable durations with a clear downward trend.
    // CV across these 9 active weeks is high; 3 zero weeks pull slope further negative.
    const log = buildLog([180, 160, 170, 140, 130, 120, 90, 0, 0, 0, 100, 90])
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('EROSIVE')
    expect(r.cv).toBeGreaterThanOrEqual(0.15)
    expect(r.trendSlopePctPerWeek).toBeLessThan(-0.03)
  })
})

// ─── CHAOTIC band ───────────────────────────────────────────────────────────

describe('analyzeLongRunConsistency — CHAOTIC band', () => {
  it('high CV with near-flat slope → CHAOTIC', () => {
    // Alternating 90 / 180 produces high CV but ~0 slope when paired.
    // 90,180,90,180,90,180,90,180,90,180,90,180
    const log = buildLog([90, 180, 90, 180, 90, 180, 90, 180, 90, 180, 90, 180])
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('CHAOTIC')
    expect(r.cv).toBeGreaterThanOrEqual(0.15)
    expect(Math.abs(r.trendSlopePctPerWeek)).toBeLessThanOrEqual(0.03)
  })
})

// ─── threshold override ────────────────────────────────────────────────────

describe('analyzeLongRunConsistency — longRunMinThreshold override', () => {
  it('with default threshold=90 excludes a 75-min run', () => {
    // 12 weeks of 75-min runs — none qualify at threshold 90.
    const log = buildLog([75, 75, 75, 75, 75, 75, 75, 75, 75, 75, 75, 75])
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    expect(r).toBeNull() // longRunCount = 0 → null
  })

  it('with threshold=60 a 75-min run does qualify', () => {
    const log = buildLog([75, 75, 75, 75, 75, 75, 75, 75, 75, 75, 75, 75])
    const r = analyzeLongRunConsistency({
      log, today: TODAY, longRunMinThreshold: 60,
    })
    expect(r).not.toBeNull()
    expect(r.band).toBe('STEADY') // identical → cv = 0
    expect(r.longRunCount).toBe(12)
    expect(r.meanMin).toBe(75)
  })

  it('threshold sits exactly at duration (inclusive)', () => {
    const log = buildLog([90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90])
    const r = analyzeLongRunConsistency({
      log, today: TODAY, longRunMinThreshold: 90,
    })
    expect(r).not.toBeNull()
    expect(r.longRunCount).toBe(12)
  })
})

// ─── sport / type filter ───────────────────────────────────────────────────

describe('analyzeLongRunConsistency — running-only filter', () => {
  it('excludes cycling rides even if duration is high', () => {
    // 12 weeks of 180-min cycling rides → no qualifying long *runs*.
    const log = WEEK_MONDAYS.map(mon => {
      const d = new Date(mon + 'T00:00:00Z')
      d.setUTCDate(d.getUTCDate() + 5)
      return {
        date: d.toISOString().slice(0, 10),
        durationMin: 180,
        type: 'cycle',
      }
    })
    expect(analyzeLongRunConsistency({ log, today: TODAY })).toBeNull()
  })

  it('matches sport=running and type containing "run"', () => {
    const log = [
      { date: '2026-02-28', durationMin: 100, sport: 'running' },
      { date: '2026-03-07', durationMin: 100, sport: 'Run' },
      { date: '2026-03-14', durationMin: 100, type: 'easy run' },
      { date: '2026-03-21', durationMin: 100, type: 'Long Run' },
      { date: '2026-03-28', durationMin: 100, type: 'tempo run' },
      { date: '2026-04-04', durationMin: 100, type: 'TRAIL RUN' },
    ]
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.longRunCount).toBe(6)
    expect(r.band).toBe('STEADY')
  })

  it('ignores entries lacking type AND sport even if duration is high', () => {
    const log = [
      { date: '2026-02-28', durationMin: 120 }, // no type / sport
      { date: '2026-03-07', durationMin: 120 },
      { date: '2026-03-14', durationMin: 120 },
    ]
    expect(analyzeLongRunConsistency({ log, today: TODAY })).toBeNull()
  })
})

// ─── duration edge cases ───────────────────────────────────────────────────

describe('analyzeLongRunConsistency — duration edge cases', () => {
  it('ignores NaN / 0 / negative / missing durationMin', () => {
    const log = [
      { date: '2026-02-28', durationMin: NaN, type: 'run' },
      { date: '2026-03-07', durationMin: 0, type: 'run' },
      { date: '2026-03-14', durationMin: -30, type: 'run' },
      { date: '2026-03-21', type: 'run' }, // missing
      // 6 valid long runs to reach classification
      { date: '2026-03-28', durationMin: 100, type: 'run' },
      { date: '2026-04-04', durationMin: 100, type: 'run' },
      { date: '2026-04-11', durationMin: 100, type: 'run' },
      { date: '2026-04-18', durationMin: 100, type: 'run' },
      { date: '2026-04-25', durationMin: 100, type: 'run' },
      { date: '2026-05-02', durationMin: 100, type: 'run' },
    ]
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.longRunCount).toBe(6)
    expect(r.band).toBe('STEADY')
  })

  it('multiple long runs in the same week → uses LONGEST one', () => {
    // 6 weeks with 1 long run each (steady), plus week-2 has TWO long runs:
    // a 95min and a 150min — the 150 should win.
    const log = [
      { date: '2026-02-28', durationMin: 100, type: 'run' },
      // Week 2 = Mar 02-08: two long runs.
      { date: '2026-03-04', durationMin: 95, type: 'run' },
      { date: '2026-03-06', durationMin: 150, type: 'run' },
      { date: '2026-03-14', durationMin: 100, type: 'run' },
      { date: '2026-03-21', durationMin: 100, type: 'run' },
      { date: '2026-03-28', durationMin: 100, type: 'run' },
      { date: '2026-04-04', durationMin: 100, type: 'run' },
    ]
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    // week 02-23 → 100; week 03-02 → 150; weeks 03-09,16,23,30 → 100.
    const wk02 = r.weeks.find(w => w.weekStart === '2026-03-02')
    expect(wk02.longestRunMin).toBe(150)
  })

  it('also reads duration_min (snake_case fallback)', () => {
    const log = [
      { date: '2026-02-28', duration_min: 100, type: 'run' },
      { date: '2026-03-07', duration_min: 100, type: 'run' },
      { date: '2026-03-14', duration_min: 100, type: 'run' },
      { date: '2026-03-21', duration_min: 100, type: 'run' },
      { date: '2026-03-28', duration_min: 100, type: 'run' },
      { date: '2026-04-04', duration_min: 100, type: 'run' },
    ]
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.longRunCount).toBe(6)
  })
})

// ─── ISO week boundary ─────────────────────────────────────────────────────

describe('analyzeLongRunConsistency — ISO week boundary', () => {
  it('Sunday counts to the ISO week starting that Monday', () => {
    // Week of 2026-02-23..2026-03-01 — Sunday is 2026-03-01.
    const log = [
      { date: '2026-03-01', durationMin: 120, type: 'run' }, // Sun
      // 5 more long runs for classification.
      { date: '2026-03-07', durationMin: 100, type: 'run' },
      { date: '2026-03-14', durationMin: 100, type: 'run' },
      { date: '2026-03-21', durationMin: 100, type: 'run' },
      { date: '2026-03-28', durationMin: 100, type: 'run' },
      { date: '2026-04-04', durationMin: 100, type: 'run' },
    ]
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    const wk0 = r.weeks.find(w => w.weekStart === '2026-02-23')
    expect(wk0.longestRunMin).toBe(120)
  })

  it('Monday counts to its own ISO week (not the previous one)', () => {
    const log = [
      { date: '2026-03-02', durationMin: 120, type: 'run' }, // Mon
      { date: '2026-03-09', durationMin: 100, type: 'run' },
      { date: '2026-03-16', durationMin: 100, type: 'run' },
      { date: '2026-03-23', durationMin: 100, type: 'run' },
      { date: '2026-03-30', durationMin: 100, type: 'run' },
      { date: '2026-04-06', durationMin: 100, type: 'run' },
    ]
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    const wk03 = r.weeks.find(w => w.weekStart === '2026-03-02')
    expect(wk03.longestRunMin).toBe(120)
    const wk0223 = r.weeks.find(w => w.weekStart === '2026-02-23')
    expect(wk0223.longestRunMin).toBe(0)
  })

  it('weeks array has windowWeeks entries with Mondays oldest-first', () => {
    const log = buildLog([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100])
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    expect(r.weeks).toHaveLength(12)
    expect(r.weeks.map(w => w.weekStart)).toEqual(WEEK_MONDAYS)
  })
})

// ─── today as Date vs string ───────────────────────────────────────────────

describe('analyzeLongRunConsistency — today input shape', () => {
  it('accepts today as a Date instance', () => {
    const log = buildLog([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100])
    const todayDate = new Date('2026-05-13T08:30:00Z')
    const r = analyzeLongRunConsistency({ log, today: todayDate })
    expect(r).not.toBeNull()
    expect(r.weeks.map(w => w.weekStart)).toEqual(WEEK_MONDAYS)
  })

  it('accepts today as a full ISO datetime string (slices to date)', () => {
    const log = buildLog([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100])
    const r = analyzeLongRunConsistency({
      log, today: '2026-05-13T15:45:00Z',
    })
    expect(r).not.toBeNull()
    expect(r.weeks).toHaveLength(12)
  })

  it('Date and string forms produce identical output', () => {
    const log = buildLog([60, 80, 100, 120, 140, 160, 180, 200, 90, 110, 130, 150])
    const a = analyzeLongRunConsistency({ log, today: '2026-05-13' })
    const b = analyzeLongRunConsistency({
      log, today: new Date('2026-05-13T00:00:00Z'),
    })
    expect(a).toEqual(b)
  })
})

// ─── windowWeeks override ──────────────────────────────────────────────────

describe('analyzeLongRunConsistency — windowWeeks override', () => {
  it('respects a non-default windowWeeks (e.g. 8)', () => {
    const log = buildLog([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100])
    const r = analyzeLongRunConsistency({ log, today: TODAY, windowWeeks: 8 })
    expect(r).not.toBeNull()
    expect(r.weeks).toHaveLength(8)
    // 8 most-recent Mondays.
    expect(r.weeks[0].weekStart).toBe('2026-03-23')
    expect(r.weeks[7].weekStart).toBe('2026-05-11')
  })
})

// ─── numeric precision contract ────────────────────────────────────────────

describe('analyzeLongRunConsistency — numeric precision', () => {
  it('cv is rounded to 4 decimal places', () => {
    const log = buildLog([100, 105, 95, 100, 105, 95, 100, 105, 95, 100, 105, 95])
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    // cv should have at most 4 decimal places.
    const cvStr = String(r.cv)
    const decimals = cvStr.includes('.') ? cvStr.split('.')[1].length : 0
    expect(decimals).toBeLessThanOrEqual(4)
  })

  it('meanMin is rounded to 2 decimal places', () => {
    const log = buildLog([100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111])
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    const meanStr = String(r.meanMin)
    const decimals = meanStr.includes('.') ? meanStr.split('.')[1].length : 0
    expect(decimals).toBeLessThanOrEqual(2)
  })

  it('trendSlopePctPerWeek is rounded to 4 decimal places', () => {
    const log = buildLog([60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170])
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    const s = String(r.trendSlopePctPerWeek)
    const decimals = s.includes('.') ? s.split('.')[1].length : 0
    expect(decimals).toBeLessThanOrEqual(4)
  })

  it('returns citation string on populated output', () => {
    const log = buildLog([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100])
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    expect(r.citation).toBe(LONG_RUN_CONSISTENCY_CITATION)
    expect(r.citation).toMatch(/Daniels 2014/)
    expect(r.citation).toMatch(/Pfitzinger 2014/)
  })
})

// ─── isolation: out-of-range entries do not pollute ─────────────────────────

describe('analyzeLongRunConsistency — out-of-range isolation', () => {
  it('ignores long runs older than the earliest Monday', () => {
    const log = [
      // Far past — ignored.
      { date: '2025-01-15', durationMin: 250, type: 'run' },
      { date: '2025-06-01', durationMin: 250, type: 'run' },
      // In-range.
      { date: '2026-02-28', durationMin: 100, type: 'run' },
      { date: '2026-03-07', durationMin: 100, type: 'run' },
      { date: '2026-03-14', durationMin: 100, type: 'run' },
      { date: '2026-03-21', durationMin: 100, type: 'run' },
      { date: '2026-03-28', durationMin: 100, type: 'run' },
      { date: '2026-04-04', durationMin: 100, type: 'run' },
    ]
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.longRunCount).toBe(6)
    expect(r.meanMin).toBe(100)
  })

  it('ignores entries after the latest Sunday of the window', () => {
    // Window ends Sunday 2026-05-17.
    const log = [
      { date: '2026-02-28', durationMin: 100, type: 'run' },
      { date: '2026-03-07', durationMin: 100, type: 'run' },
      { date: '2026-03-14', durationMin: 100, type: 'run' },
      { date: '2026-03-21', durationMin: 100, type: 'run' },
      { date: '2026-03-28', durationMin: 100, type: 'run' },
      { date: '2026-04-04', durationMin: 100, type: 'run' },
      // Future — ignored.
      { date: '2026-06-01', durationMin: 300, type: 'run' },
    ]
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.longRunCount).toBe(6)
    expect(r.meanMin).toBe(100)
  })

  it('does not mutate the input log', () => {
    const original = [
      { date: '2026-02-28', durationMin: 100, type: 'run' },
      { date: '2026-03-07', durationMin: 105, type: 'run' },
      { date: '2026-03-14', durationMin: 95, type: 'run' },
      { date: '2026-03-21', durationMin: 100, type: 'run' },
      { date: '2026-03-28', durationMin: 110, type: 'run' },
      { date: '2026-04-04', durationMin: 90, type: 'run' },
    ]
    const snapshot = JSON.parse(JSON.stringify(original))
    analyzeLongRunConsistency({ log: original, today: TODAY })
    expect(original).toEqual(snapshot)
  })
})

// ─── weeks shape consistency across bands ──────────────────────────────────

describe('analyzeLongRunConsistency — weeks shape', () => {
  it('returns exactly windowWeeks entries even for INSUFFICIENT band', () => {
    const log = buildLog([0, 0, 0, 0, 0, 0, 0, 0, 0, 100, 110, 120])
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    expect(r.weeks).toHaveLength(12)
    expect(r.weeks.filter(w => w.longestRunMin > 0)).toHaveLength(3)
  })

  it('weeks entries each have the { weekStart, longestRunMin } shape', () => {
    const log = buildLog([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100])
    const r = analyzeLongRunConsistency({ log, today: TODAY })
    for (const w of r.weeks) {
      expect(typeof w.weekStart).toBe('string')
      expect(w.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(typeof w.longestRunMin).toBe('number')
    }
  })
})
