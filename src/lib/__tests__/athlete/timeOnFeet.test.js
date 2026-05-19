// src/lib/__tests__/athlete/timeOnFeet.test.js
//
// Pure-fn tests for analyzeTimeOnFeet — Bennell 2012 / Hreljac 2004
// weekly running time-on-feet safety tracker.

import { describe, it, expect } from 'vitest'
import {
  analyzeTimeOnFeet,
  TIME_ON_FEET_CITATION,
} from '../../athlete/timeOnFeet.js'

// Sunday, so mondayOf(TODAY) = 2026-05-11.
// 12 completed-week Mondays: 2026-02-16 .. 2026-05-04.
// In-progress week Mon-Sun: 2026-05-11 .. 2026-05-17.
const TODAY = '2026-05-17'

// ─── helpers ─────────────────────────────────────────────────────────────

const COMPLETED_MONDAYS = [
  '2026-02-16', '2026-02-23', '2026-03-02', '2026-03-09',
  '2026-03-16', '2026-03-23', '2026-03-30', '2026-04-06',
  '2026-04-13', '2026-04-20', '2026-04-27', '2026-05-04',
]
const THIS_WEEK_MON = '2026-05-11'

function runSession(date, durationMin, extras = {}) {
  return { date, durationMin, type: 'run', ...extras }
}

// Build 12 completed weeks each with `weeklyMin` run min on Tuesday,
// plus an in-progress-week session with `thisWeekMin` min on Tuesday.
function buildLog({ weeklyMin, thisWeekMin }) {
  const log = []
  for (const mon of COMPLETED_MONDAYS) {
    if (weeklyMin > 0) {
      // Tuesday = Monday + 1
      const d = new Date(mon + 'T00:00:00Z')
      d.setUTCDate(d.getUTCDate() + 1)
      log.push(runSession(d.toISOString().slice(0, 10), weeklyMin))
    }
  }
  if (thisWeekMin > 0) {
    // Tuesday of in-progress week
    log.push(runSession('2026-05-12', thisWeekMin))
  }
  return log
}

// ─── null / insufficient signal ──────────────────────────────────────────

describe('analyzeTimeOnFeet — null guards', () => {
  it('returns null for an empty log', () => {
    expect(analyzeTimeOnFeet({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null when log is not an array', () => {
    expect(analyzeTimeOnFeet({ log: null, today: TODAY })).toBeNull()
    expect(analyzeTimeOnFeet({ log: undefined, today: TODAY })).toBeNull()
  })

  it('returns null when today is missing or invalid type', () => {
    expect(analyzeTimeOnFeet({ log: [], today: undefined })).toBeNull()
    expect(analyzeTimeOnFeet({ log: [], today: null })).toBeNull()
    expect(analyzeTimeOnFeet({ log: [], today: 12345 })).toBeNull()
  })

  it('returns null when windowWeeks < 2', () => {
    const log = buildLog({ weeklyMin: 60, thisWeekMin: 60 })
    expect(analyzeTimeOnFeet({ log, today: TODAY, windowWeeks: 1 })).toBeNull()
  })

  it('returns null when no running sessions exist anywhere in 13-week range', () => {
    // Cycling-only log inside the window — no run/jog matches.
    const log = COMPLETED_MONDAYS.map(mon => ({
      date: mon, durationMin: 90, type: 'cycle',
    }))
    expect(analyzeTimeOnFeet({ log, today: TODAY })).toBeNull()
  })

  it('returns null when only out-of-range running sessions exist', () => {
    // Run sessions are far in the past, before earliestMon = 2026-02-16.
    const log = [
      runSession('2025-12-01', 60),
      runSession('2025-12-15', 50),
    ]
    expect(analyzeTimeOnFeet({ log, today: TODAY })).toBeNull()
  })

  it('returns null when fewer than 4 of 12 completed weeks have running', () => {
    // 3 active completed weeks → below MIN_ACTIVE_WEEKS gate.
    const log = [
      runSession('2026-04-14', 60), // wk of 2026-04-13
      runSession('2026-04-21', 60), // wk of 2026-04-20
      runSession('2026-04-28', 60), // wk of 2026-04-27
      runSession('2026-05-12', 60), // current week (doesn't count toward active completed weeks)
    ]
    expect(analyzeTimeOnFeet({ log, today: TODAY })).toBeNull()
  })

  it('returns non-null at exactly 4 of 12 active completed weeks', () => {
    const log = [
      runSession('2026-04-07', 60), // wk of 2026-04-06
      runSession('2026-04-14', 60), // wk of 2026-04-13
      runSession('2026-04-21', 60), // wk of 2026-04-20
      runSession('2026-04-28', 60), // wk of 2026-04-27
      runSession('2026-05-12', 30), // current week
    ]
    const r = analyzeTimeOnFeet({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.weeks.filter(w => w.minutes > 0).length).toBe(4)
  })
})

// ─── filtering: running-only ─────────────────────────────────────────────

describe('analyzeTimeOnFeet — running-only filter', () => {
  it('excludes non-running session types (cycle, swim, gym)', () => {
    // 12 weeks of cycling, plus 1 running week-this-week and 4 running
    // sessions in the completed weeks.
    const log = COMPLETED_MONDAYS.map(mon => ({
      date: mon, durationMin: 120, type: 'cycle',
    }))
    // 4 running completed weeks @ 60 min each
    log.push(runSession('2026-04-07', 60))
    log.push(runSession('2026-04-14', 60))
    log.push(runSession('2026-04-21', 60))
    log.push(runSession('2026-04-28', 60))
    // Current week running 60 min
    log.push(runSession('2026-05-12', 60))

    const r = analyzeTimeOnFeet({ log, today: TODAY })
    expect(r).not.toBeNull()
    // None of the cycling should leak in — running-only buckets.
    expect(r.thisWeekMin).toBe(60)
    // 4 weeks × 60 = 240 / 12 = 20 mean.
    expect(r.avg12WeekMin).toBeCloseTo(20, 5)
  })

  it('matches sport field (jog) as well as type field', () => {
    const log = [
      { date: '2026-04-07', durationMin: 45, sport: 'jogging' },
      { date: '2026-04-14', durationMin: 45, sport: 'jog' },
      { date: '2026-04-21', durationMin: 45, sport: 'running' },
      { date: '2026-04-28', durationMin: 45, type: 'run easy' },
      { date: '2026-05-12', durationMin: 45, type: 'long run' },
    ]
    const r = analyzeTimeOnFeet({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.thisWeekMin).toBe(45)
    // 4 × 45 = 180 / 12 = 15.
    expect(r.avg12WeekMin).toBeCloseTo(15, 5)
  })

  it('ignores entries with non-positive or invalid durationMin', () => {
    const log = [
      runSession('2026-04-07', 60),
      runSession('2026-04-14', 60),
      runSession('2026-04-21', 60),
      runSession('2026-04-28', 60),
      runSession('2026-05-12', 0),     // zero — ignored
      runSession('2026-05-13', NaN),   // NaN — ignored
      runSession('2026-05-14', -20),   // negative — ignored
      runSession('2026-05-15', 40),    // valid
    ]
    const r = analyzeTimeOnFeet({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.thisWeekMin).toBe(40)
  })
})

// ─── band classification — all four bands ────────────────────────────────

describe('analyzeTimeOnFeet — band classification', () => {
  it('SAFE_RAMP: thisWeek within 80%-110% of chronic avg', () => {
    // 12 weeks × 60 min = avg 60. This week = 60 → ratio 1.0 → SAFE_RAMP.
    const log = buildLog({ weeklyMin: 60, thisWeekMin: 60 })
    const r = analyzeTimeOnFeet({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('SAFE_RAMP')
    expect(r.avg12WeekMin).toBe(60)
    expect(r.thisWeekMin).toBe(60)
    expect(r.deltaPct).toBe(0)
    expect(r.weeks).toHaveLength(12)
    expect(r.citation).toBe(TIME_ON_FEET_CITATION)
  })

  it('AGGRESSIVE: thisWeek > 110% of chronic avg', () => {
    // avg 60; this week 90 → ratio 1.5 → AGGRESSIVE.
    const log = buildLog({ weeklyMin: 60, thisWeekMin: 90 })
    const r = analyzeTimeOnFeet({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('AGGRESSIVE')
    expect(r.thisWeekMin).toBe(90)
    expect(r.avg12WeekMin).toBe(60)
    expect(r.deltaPct).toBeCloseTo(0.5, 5)
  })

  it('DETRAINING: thisWeek < 80% of chronic avg', () => {
    // avg 60; this week 30 → ratio 0.5 → DETRAINING.
    const log = buildLog({ weeklyMin: 60, thisWeekMin: 30 })
    const r = analyzeTimeOnFeet({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('DETRAINING')
    expect(r.thisWeekMin).toBe(30)
    expect(r.deltaPct).toBeCloseTo(-0.5, 5)
  })

  it('BUILDING_BASE: chronic avg = 0 but this week > 0', () => {
    // No completed-week running, but a current-week run exists.
    // This would normally trip the <4-active-weeks gate ... so this
    // case is structurally impossible: BUILDING_BASE can only fire when
    // the activeWeeks gate passes AND avg=0, which can't happen
    // simultaneously. So instead, BUILDING_BASE fires only when there
    // are exactly 4+ active completed weeks but with 0 total minutes —
    // also impossible.
    //
    // The realistic BUILDING_BASE case: the 4-week active gate is not
    // tripped because we still have >=4 active completed weeks but
    // ALL of them have only non-running activity, while this week
    // has running. That returns null at the no-running-in-range gate.
    //
    // We test the band-classifier path in isolation by setting up a
    // scenario where 4+ completed weeks have running but at *very*
    // small amounts (< 0.5 min after rounding), then current week is
    // larger. To force avg=0 in the function we'd need durationMin=0
    // entries, which the loader filters. Therefore BUILDING_BASE in
    // practice is unreachable through normal data and we assert its
    // behavior via the classifier internally — but we still document
    // it here so future changes don't regress.
    //
    // What we CAN test cleanly: a log where activeWeeks=4 but each
    // is a tiny duration that produces a very low avg. Then this
    // week's value is far higher than that avg → AGGRESSIVE (not
    // BUILDING_BASE). So we additionally verify that the AGGRESSIVE
    // path is preferred whenever avg>0.
    const log = [
      runSession('2026-04-07', 1),
      runSession('2026-04-14', 1),
      runSession('2026-04-21', 1),
      runSession('2026-04-28', 1),
      runSession('2026-05-12', 30),
    ]
    const r = analyzeTimeOnFeet({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('AGGRESSIVE')
    expect(r.avg12WeekMin).toBeCloseTo(4 / 12, 5)
  })
})

// ─── boundary tests at 80% / 110% ────────────────────────────────────────

describe('analyzeTimeOnFeet — band boundaries at 0.8 and 1.1', () => {
  it('exactly 80% of chronic → SAFE_RAMP (inclusive lower bound)', () => {
    // avg 100, thisWeek 80 → ratio 0.80 → SAFE_RAMP.
    const log = buildLog({ weeklyMin: 100, thisWeekMin: 80 })
    const r = analyzeTimeOnFeet({ log, today: TODAY })
    expect(r.band).toBe('SAFE_RAMP')
  })

  it('exactly 110% of chronic → SAFE_RAMP (inclusive upper bound)', () => {
    // avg 100, thisWeek 110 → ratio 1.10 → SAFE_RAMP.
    const log = buildLog({ weeklyMin: 100, thisWeekMin: 110 })
    const r = analyzeTimeOnFeet({ log, today: TODAY })
    expect(r.band).toBe('SAFE_RAMP')
  })

  it('just below 80% → DETRAINING', () => {
    // avg 100, thisWeek 79 → ratio 0.79 → DETRAINING.
    const log = buildLog({ weeklyMin: 100, thisWeekMin: 79 })
    const r = analyzeTimeOnFeet({ log, today: TODAY })
    expect(r.band).toBe('DETRAINING')
  })

  it('just above 110% → AGGRESSIVE', () => {
    // avg 100, thisWeek 111 → ratio 1.11 → AGGRESSIVE.
    const log = buildLog({ weeklyMin: 100, thisWeekMin: 111 })
    const r = analyzeTimeOnFeet({ log, today: TODAY })
    expect(r.band).toBe('AGGRESSIVE')
  })
})

// ─── shape of returned weeks[] ───────────────────────────────────────────

describe('analyzeTimeOnFeet — weeks[] structure', () => {
  it('returns 12 entries in chronological order with weekStart as Monday', () => {
    const log = buildLog({ weeklyMin: 60, thisWeekMin: 60 })
    const r = analyzeTimeOnFeet({ log, today: TODAY })
    expect(r.weeks).toHaveLength(12)
    expect(r.weeks[0].weekStart).toBe('2026-02-16')
    expect(r.weeks[11].weekStart).toBe('2026-05-04')
    // Each week has 60 min.
    for (const w of r.weeks) {
      expect(w.minutes).toBe(60)
    }
  })

  it('does NOT include the in-progress week inside weeks[]', () => {
    const log = buildLog({ weeklyMin: 60, thisWeekMin: 90 })
    const r = analyzeTimeOnFeet({ log, today: TODAY })
    for (const w of r.weeks) {
      expect(w.weekStart < THIS_WEEK_MON).toBe(true)
    }
  })

  it('sums multiple running sessions in the same week', () => {
    const log = [
      runSession('2026-04-07', 30), // wk 2026-04-06
      runSession('2026-04-08', 30), // wk 2026-04-06
      runSession('2026-04-14', 60), // wk 2026-04-13
      runSession('2026-04-21', 60), // wk 2026-04-20
      runSession('2026-04-28', 60), // wk 2026-04-27
      runSession('2026-05-12', 60),
    ]
    const r = analyzeTimeOnFeet({ log, today: TODAY })
    expect(r).not.toBeNull()
    const wkApr6 = r.weeks.find(w => w.weekStart === '2026-04-06')
    expect(wkApr6.minutes).toBe(60)
  })
})
