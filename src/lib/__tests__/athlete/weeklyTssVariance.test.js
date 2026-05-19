// src/lib/__tests__/athlete/weeklyTssVariance.test.js
//
// Pure-fn tests for analyzeWeeklyTssVariance — Foster 2001 / Bourdon 2017
// between-week TSS variance tracker. Covers all 3 bands, null cases,
// CV math, and boundary cases at cv = 0.20 / 0.40.

import { describe, it, expect } from 'vitest'
import {
  analyzeWeeklyTssVariance,
  WEEKLY_TSS_VARIANCE_CITATION,
} from '../../athlete/weeklyTssVariance.js'

// 2026-05-17 is a Sunday → Monday of that week is 2026-05-11.
// The "current" Mon–Sun week is 2026-05-11 .. 2026-05-17.
const TODAY = '2026-05-17'

// ─── Helpers ────────────────────────────────────────────────────────────────

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

// Build a log of N entries, one per week, with the given weekly TSS amounts
// (oldest first). Session is parked mid-week (Wed = monday + 2 days).
function buildWeeklyLog({ today = TODAY, weeklyTss }) {
  const monday = mondayOf(today)
  const log = []
  for (let i = 0; i < weeklyTss.length; i++) {
    const weekStart = isoMinusDays(monday, (weeklyTss.length - 1 - i) * 7)
    const sessionDate = isoMinusDays(weekStart, -2)
    if (weeklyTss[i] > 0) {
      log.push({ date: sessionDate, tss: weeklyTss[i] })
    }
  }
  return log
}

// ─── null / insufficient signal ────────────────────────────────────────────

describe('analyzeWeeklyTssVariance — null / insufficient signals', () => {
  it('returns null when today is missing', () => {
    const res = analyzeWeeklyTssVariance({ log: [], today: undefined })
    expect(res).toBeNull()
  })

  it('returns null when today is not a valid ISO string', () => {
    expect(analyzeWeeklyTssVariance({ log: [], today: 'not-a-date' })).toBeNull()
    expect(analyzeWeeklyTssVariance({ log: [], today: '' })).toBeNull()
  })

  it('returns null when log is null', () => {
    const res = analyzeWeeklyTssVariance({ log: null, today: TODAY })
    expect(res).toBeNull()
  })

  it('returns null when log is empty', () => {
    const res = analyzeWeeklyTssVariance({ log: [], today: TODAY })
    expect(res).toBeNull()
  })

  it('returns null when fewer than 8 of 12 weeks have non-zero TSS', () => {
    // Only 7 of 12 weeks have load → below the 8-week minimum.
    const weekly = [0, 0, 0, 0, 0, 300, 300, 300, 300, 300, 300, 300]
    const res = analyzeWeeklyTssVariance({
      log: buildWeeklyLog({ weeklyTss: weekly }),
      today: TODAY,
    })
    expect(res).toBeNull()
  })

  it('returns a result once exactly 8 of 12 weeks carry TSS', () => {
    const weekly = [0, 0, 0, 0, 300, 300, 300, 300, 300, 300, 300, 300]
    const res = analyzeWeeklyTssVariance({
      log: buildWeeklyLog({ weeklyTss: weekly }),
      today: TODAY,
    })
    expect(res).not.toBeNull()
    expect(res.weeks).toHaveLength(12)
  })

  it('returns null when mean TSS is 0 (no valid sessions)', () => {
    // Sessions with non-numeric / negative TSS → ignored, mean stays 0.
    const monday = mondayOf(TODAY)
    const log = [
      { date: isoMinusDays(monday, -1), tss: 'invalid' },
      { date: isoMinusDays(monday, -2), tss: -50 },
    ]
    const res = analyzeWeeklyTssVariance({ log, today: TODAY })
    expect(res).toBeNull()
  })
})

// ─── CV math + band classification ──────────────────────────────────────────

describe('analyzeWeeklyTssVariance — CV math', () => {
  it('cv = 0 when every week has the same TSS → STEADY', () => {
    const weekly = Array(12).fill(280)
    const res = analyzeWeeklyTssVariance({
      log: buildWeeklyLog({ weeklyTss: weekly }),
      today: TODAY,
    })
    expect(res).not.toBeNull()
    expect(res.meanTss).toBe(280)
    expect(res.stdTss).toBe(0)
    expect(res.cv).toBe(0)
    expect(res.band).toBe('STEADY')
    expect(res.citation).toBe(WEEKLY_TSS_VARIANCE_CITATION)
    expect(WEEKLY_TSS_VARIANCE_CITATION).toBe('Foster 2001; Bourdon 2017')
  })

  it('computes meanTss + stdTss with population stdev (divisor = N, not N-1)', () => {
    // 6 weeks at 250, 6 weeks at 350.
    // mean=300, variance = 50² = 2500, std=50, cv=50/300 ≈ 0.1667.
    const weekly = [250, 350, 250, 350, 250, 350, 250, 350, 250, 350, 250, 350]
    const res = analyzeWeeklyTssVariance({
      log: buildWeeklyLog({ weeklyTss: weekly }),
      today: TODAY,
    })
    expect(res).not.toBeNull()
    expect(res.meanTss).toBe(300)
    expect(res.stdTss).toBe(50)
    expect(res.cv).toBeCloseTo(0.1667, 3)
    expect(res.band).toBe('STEADY')
  })

  it('returns 12 weeks oldest→newest with correct weekStart anchors', () => {
    const weekly = Array(12).fill(280)
    const res = analyzeWeeklyTssVariance({
      log: buildWeeklyLog({ weeklyTss: weekly }),
      today: TODAY,
    })
    expect(res.weeks).toHaveLength(12)
    // Newest week = 2026-05-11 (Monday of TODAY's week).
    expect(res.weeks[11].weekStart).toBe('2026-05-11')
    // Oldest week = 11 weeks before that = 2026-02-23.
    expect(res.weeks[0].weekStart).toBe('2026-02-23')
    // Each week summed correctly.
    res.weeks.forEach(w => expect(w.tss).toBe(280))
  })

  it('accepts a Date object for `today`', () => {
    const weekly = Array(12).fill(300)
    const res = analyzeWeeklyTssVariance({
      log: buildWeeklyLog({ weeklyTss: weekly }),
      today: new Date(`${TODAY}T12:00:00Z`),
    })
    expect(res).not.toBeNull()
    expect(res.band).toBe('STEADY')
  })

  it('ignores sessions outside the 12-week window', () => {
    const monday = mondayOf(TODAY)
    // Build a steady 12-week log, then add a huge "ancient" session 30 weeks
    // back. That session must NOT affect the result.
    const log = buildWeeklyLog({ weeklyTss: Array(12).fill(280) })
    log.push({ date: isoMinusDays(monday, 30 * 7), tss: 5000 })
    const res = analyzeWeeklyTssVariance({ log, today: TODAY })
    expect(res.meanTss).toBe(280)
    expect(res.cv).toBe(0)
    expect(res.band).toBe('STEADY')
  })

  it('ignores future-dated sessions beyond the current week', () => {
    const monday = mondayOf(TODAY)
    const log = buildWeeklyLog({ weeklyTss: Array(12).fill(280) })
    // 3 weeks in the future → out of window.
    log.push({ date: isoMinusDays(monday, -21), tss: 9999 })
    const res = analyzeWeeklyTssVariance({ log, today: TODAY })
    expect(res.meanTss).toBe(280)
    expect(res.band).toBe('STEADY')
  })
})

// ─── Band boundary tests ────────────────────────────────────────────────────

describe('analyzeWeeklyTssVariance — band boundaries', () => {
  it('STEADY just below the cv = 0.20 boundary', () => {
    // 6@250 / 6@350 → cv ≈ 0.1667 < 0.20 → STEADY.
    const weekly = [250, 350, 250, 350, 250, 350, 250, 350, 250, 350, 250, 350]
    const res = analyzeWeeklyTssVariance({
      log: buildWeeklyLog({ weeklyTss: weekly }),
      today: TODAY,
    })
    expect(res.band).toBe('STEADY')
  })

  it('MODERATE exactly at cv = 0.20 (boundary is inclusive on the MODERATE side)', () => {
    // 6@240 / 6@360 → mean=300, std=60, cv = 60/300 = 0.20 exactly → MODERATE.
    const weekly = [240, 360, 240, 360, 240, 360, 240, 360, 240, 360, 240, 360]
    const res = analyzeWeeklyTssVariance({
      log: buildWeeklyLog({ weeklyTss: weekly }),
      today: TODAY,
    })
    expect(res.meanTss).toBe(300)
    expect(res.stdTss).toBe(60)
    expect(res.cv).toBeCloseTo(0.20, 4)
    expect(res.band).toBe('MODERATE')
  })

  it('MODERATE just below cv = 0.40', () => {
    // 6@200 / 6@400 → mean=300, std=100, cv ≈ 0.3333 < 0.40 → MODERATE.
    const weekly = [200, 400, 200, 400, 200, 400, 200, 400, 200, 400, 200, 400]
    const res = analyzeWeeklyTssVariance({
      log: buildWeeklyLog({ weeklyTss: weekly }),
      today: TODAY,
    })
    expect(res.meanTss).toBe(300)
    expect(res.stdTss).toBe(100)
    expect(res.cv).toBeCloseTo(0.3333, 3)
    expect(res.band).toBe('MODERATE')
  })

  it('CHAOTIC exactly at cv = 0.40 (boundary is inclusive on the CHAOTIC side)', () => {
    // 6@180 / 6@420 → mean=300, std=120, cv = 120/300 = 0.40 exactly → CHAOTIC.
    const weekly = [180, 420, 180, 420, 180, 420, 180, 420, 180, 420, 180, 420]
    const res = analyzeWeeklyTssVariance({
      log: buildWeeklyLog({ weeklyTss: weekly }),
      today: TODAY,
    })
    expect(res.meanTss).toBe(300)
    expect(res.stdTss).toBe(120)
    expect(res.cv).toBeCloseTo(0.40, 4)
    expect(res.band).toBe('CHAOTIC')
  })

  it('CHAOTIC well above cv = 0.40', () => {
    // 6@100 / 6@500 → mean=300, std=200, cv ≈ 0.6667 → CHAOTIC.
    const weekly = [100, 500, 100, 500, 100, 500, 100, 500, 100, 500, 100, 500]
    const res = analyzeWeeklyTssVariance({
      log: buildWeeklyLog({ weeklyTss: weekly }),
      today: TODAY,
    })
    expect(res.meanTss).toBe(300)
    expect(res.stdTss).toBe(200)
    expect(res.cv).toBeCloseTo(0.6667, 3)
    expect(res.band).toBe('CHAOTIC')
  })
})

// ─── Window-size override + multiple sessions per week ──────────────────────

describe('analyzeWeeklyTssVariance — extras', () => {
  it('sums multiple sessions within the same week', () => {
    const monday = mondayOf(TODAY)
    const log = []
    // 12 weeks of 100 + 200 = 300 TSS each → mean=300, cv=0 → STEADY.
    for (let i = 11; i >= 0; i--) {
      const weekStart = isoMinusDays(monday, i * 7)
      log.push({ date: isoMinusDays(weekStart, -1), tss: 100 })
      log.push({ date: isoMinusDays(weekStart, -3), tss: 200 })
    }
    const res = analyzeWeeklyTssVariance({ log, today: TODAY })
    expect(res.meanTss).toBe(300)
    expect(res.cv).toBe(0)
    expect(res.band).toBe('STEADY')
  })

  it('respects a custom `windowWeeks` parameter', () => {
    // 6-week window. Min-non-zero falls to ceil(6 * 2/3) = 4.
    // 5 of 6 weeks loaded at 300 TSS → mean=250, std=√(5/6·50² + 1/6·250²)
    // → cv → some band. We just assert the shape & that windowWeeks
    // is honored.
    const weekly = [0, 300, 300, 300, 300, 300]
    const res = analyzeWeeklyTssVariance({
      log: buildWeeklyLog({ weeklyTss: weekly }),
      today: TODAY,
      windowWeeks: 6,
    })
    expect(res).not.toBeNull()
    expect(res.weeks).toHaveLength(6)
  })
})
