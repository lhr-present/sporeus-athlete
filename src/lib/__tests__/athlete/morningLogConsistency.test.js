// ─── morningLogConsistency.test.js — Wood 2013 / Lally 2010 habit tracker ───
import { describe, it, expect } from 'vitest'
import {
  analyzeMorningLogConsistency,
  classifyMorningLogBand,
  MORNING_LOG_THRESHOLDS,
} from '../../athlete/morningLogConsistency.js'

const TODAY = '2026-05-18'

function daysAgo(n, today = TODAY) {
  const d = new Date(today + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/**
 * Build N consecutive logged entries ending today (today = offset 0).
 */
function consecutive(n, fields = { sleepHrs: 7.5 }) {
  const out = []
  for (let i = 0; i < n; i++) {
    out.push({ date: daysAgo(i), ...fields })
  }
  return out
}

describe('classifyMorningLogBand', () => {
  it('returns HABITUATED at >= 0.80', () => {
    expect(classifyMorningLogBand(0.80)).toBe('HABITUATED')
    expect(classifyMorningLogBand(0.95)).toBe('HABITUATED')
    expect(classifyMorningLogBand(1)).toBe('HABITUATED')
  })

  it('returns DEVELOPING at [0.50, 0.80)', () => {
    expect(classifyMorningLogBand(0.50)).toBe('DEVELOPING')
    expect(classifyMorningLogBand(0.65)).toBe('DEVELOPING')
    expect(classifyMorningLogBand(0.7999)).toBe('DEVELOPING')
  })

  it('returns SPORADIC below 0.50', () => {
    expect(classifyMorningLogBand(0.49)).toBe('SPORADIC')
    expect(classifyMorningLogBand(0.10)).toBe('SPORADIC')
    expect(classifyMorningLogBand(0)).toBe('SPORADIC')
  })

  it('returns null on non-finite', () => {
    expect(classifyMorningLogBand(NaN)).toBeNull()
    expect(classifyMorningLogBand(Infinity)).toBeNull()
    expect(classifyMorningLogBand(undefined)).toBeNull()
  })

  it('exposes default thresholds', () => {
    expect(MORNING_LOG_THRESHOLDS.habituated).toBe(0.80)
    expect(MORNING_LOG_THRESHOLDS.developing).toBe(0.50)
  })
})

describe('analyzeMorningLogConsistency — guards', () => {
  it('returns null on empty array', () => {
    expect(analyzeMorningLogConsistency({ recovery: [], today: TODAY })).toBeNull()
  })

  it('returns null on null/undefined recovery', () => {
    expect(analyzeMorningLogConsistency({ recovery: null, today: TODAY })).toBeNull()
    expect(analyzeMorningLogConsistency({ recovery: undefined, today: TODAY })).toBeNull()
    expect(analyzeMorningLogConsistency({})).toBeNull()
  })

  it('returns null on non-array recovery', () => {
    expect(analyzeMorningLogConsistency({ recovery: 'nope', today: TODAY })).toBeNull()
    expect(analyzeMorningLogConsistency({ recovery: 42, today: TODAY })).toBeNull()
  })

  it('returns null when windowDays is invalid', () => {
    const r = consecutive(5)
    expect(analyzeMorningLogConsistency({ recovery: r, today: TODAY, windowDays: 0 })).toBeNull()
    expect(analyzeMorningLogConsistency({ recovery: r, today: TODAY, windowDays: -7 })).toBeNull()
    expect(analyzeMorningLogConsistency({ recovery: r, today: TODAY, windowDays: NaN })).toBeNull()
  })
})

describe('analyzeMorningLogConsistency — band classification', () => {
  it('classifies HABITUATED at 28/28 days', () => {
    const recovery = consecutive(28)
    const res = analyzeMorningLogConsistency({ recovery, today: TODAY })
    expect(res).not.toBeNull()
    expect(res.band).toBe('HABITUATED')
    expect(res.daysLogged).toBe(28)
    expect(res.completionRate).toBe(1)
    expect(res.windowDays).toBe(28)
    expect(res.currentStreak).toBe(28)
    expect(res.longestStreak).toBe(28)
    expect(res.citation).toBe('Wood 2013; Lally 2010')
  })

  it('classifies HABITUATED at exactly 80% (22.4 → 23 of 28)', () => {
    // 23 of 28 = 0.8214 → HABITUATED
    const recovery = consecutive(23)
    const res = analyzeMorningLogConsistency({ recovery, today: TODAY })
    expect(res.daysLogged).toBe(23)
    expect(res.band).toBe('HABITUATED')
  })

  it('classifies DEVELOPING at ~64% (18 of 28)', () => {
    const recovery = consecutive(18)
    const res = analyzeMorningLogConsistency({ recovery, today: TODAY })
    expect(res.daysLogged).toBe(18)
    expect(res.band).toBe('DEVELOPING')
    expect(res.completionRate).toBeCloseTo(18 / 28, 5)
  })

  it('classifies SPORADIC at 25% (7 of 28)', () => {
    const recovery = consecutive(7)
    const res = analyzeMorningLogConsistency({ recovery, today: TODAY })
    expect(res.daysLogged).toBe(7)
    expect(res.band).toBe('SPORADIC')
    expect(res.completionRate).toBeCloseTo(0.25, 5)
  })
})

describe('analyzeMorningLogConsistency — streak computation', () => {
  it('current streak counts back from today, ending at first gap', () => {
    // Days 0,1,2 logged; day 3 missing; days 4,5 logged.
    const recovery = [
      { date: daysAgo(0), sleepHrs: 7 },
      { date: daysAgo(1), sleepHrs: 7 },
      { date: daysAgo(2), sleepHrs: 7 },
      // gap at day 3
      { date: daysAgo(4), sleepHrs: 7 },
      { date: daysAgo(5), sleepHrs: 7 },
    ]
    const res = analyzeMorningLogConsistency({ recovery, today: TODAY })
    expect(res.daysLogged).toBe(5)
    expect(res.currentStreak).toBe(3)   // today, day-1, day-2
    expect(res.longestStreak).toBe(3)   // longest in window is also 3
  })

  it('current streak is 0 when today is not logged', () => {
    const recovery = [
      { date: daysAgo(1), sleepHrs: 7 },
      { date: daysAgo(2), sleepHrs: 7 },
      { date: daysAgo(3), sleepHrs: 7 },
    ]
    const res = analyzeMorningLogConsistency({ recovery, today: TODAY })
    expect(res.daysLogged).toBe(3)
    expect(res.currentStreak).toBe(0)
    expect(res.longestStreak).toBe(3)
  })

  it('longest streak finds the longest run in the window', () => {
    // 7-run earlier, 2-run recent (today + day-1)
    const recovery = []
    for (let i = 0; i < 2; i++) recovery.push({ date: daysAgo(i), sleepHrs: 7 })
    // gap on day 2
    for (let i = 4; i < 11; i++) recovery.push({ date: daysAgo(i), sleepHrs: 7 })
    const res = analyzeMorningLogConsistency({ recovery, today: TODAY })
    expect(res.daysLogged).toBe(9)
    expect(res.currentStreak).toBe(2)
    expect(res.longestStreak).toBe(7)
  })

  it('longest streak equals window size when all days are logged', () => {
    const recovery = consecutive(28)
    const res = analyzeMorningLogConsistency({ recovery, today: TODAY })
    expect(res.currentStreak).toBe(28)
    expect(res.longestStreak).toBe(28)
  })
})

describe('analyzeMorningLogConsistency — partial fields still count', () => {
  it('counts entries with only sleepHrs', () => {
    const recovery = [{ date: daysAgo(0), sleepHrs: 7.2 }]
    const res = analyzeMorningLogConsistency({ recovery, today: TODAY })
    expect(res.daysLogged).toBe(1)
    expect(res.currentStreak).toBe(1)
  })

  it('counts entries with only hrv', () => {
    const recovery = [{ date: daysAgo(0), hrv: 62 }]
    const res = analyzeMorningLogConsistency({ recovery, today: TODAY })
    expect(res.daysLogged).toBe(1)
  })

  it('counts entries with only restingHR', () => {
    const recovery = [{ date: daysAgo(0), restingHR: 48 }]
    const res = analyzeMorningLogConsistency({ recovery, today: TODAY })
    expect(res.daysLogged).toBe(1)
  })

  it('returns SPORADIC with daysLogged 0 when entries have no defined fields', () => {
    const recovery = [
      { date: daysAgo(0) },
      { date: daysAgo(1), sleepHrs: null, hrv: undefined, restingHR: '' },
    ]
    const res = analyzeMorningLogConsistency({ recovery, today: TODAY })
    expect(res).not.toBeNull()
    expect(res.daysLogged).toBe(0)
    expect(res.band).toBe('SPORADIC')
    expect(res.completionRate).toBe(0)
  })

  it('does NOT count entries with NaN-coerced field values', () => {
    const recovery = [
      { date: daysAgo(0), sleepHrs: 'abc' },
    ]
    const res = analyzeMorningLogConsistency({ recovery, today: TODAY })
    expect(res.daysLogged).toBe(0)
  })
})

describe('analyzeMorningLogConsistency — window + dedup', () => {
  it('ignores entries outside the window', () => {
    const recovery = [
      { date: daysAgo(0), sleepHrs: 7 },
      { date: daysAgo(40), sleepHrs: 7 },  // outside 28d window
      { date: daysAgo(100), sleepHrs: 7 },
    ]
    const res = analyzeMorningLogConsistency({ recovery, today: TODAY })
    expect(res.daysLogged).toBe(1)
  })

  it('counts duplicate entries on the same day only once', () => {
    const recovery = [
      { date: daysAgo(0), sleepHrs: 7 },
      { date: daysAgo(0), hrv: 62 },
      { date: daysAgo(0), restingHR: 50 },
    ]
    const res = analyzeMorningLogConsistency({ recovery, today: TODAY })
    expect(res.daysLogged).toBe(1)
    expect(res.currentStreak).toBe(1)
  })

  it('respects custom windowDays', () => {
    const recovery = consecutive(7)
    const res = analyzeMorningLogConsistency({ recovery, today: TODAY, windowDays: 7 })
    expect(res.windowDays).toBe(7)
    expect(res.daysLogged).toBe(7)
    expect(res.completionRate).toBe(1)
    expect(res.band).toBe('HABITUATED')
  })

  it('floors fractional windowDays', () => {
    const recovery = consecutive(14)
    const res = analyzeMorningLogConsistency({ recovery, today: TODAY, windowDays: 14.7 })
    expect(res.windowDays).toBe(14)
  })

  it('skips entries with bad dates', () => {
    const recovery = [
      { date: 'not-a-date', sleepHrs: 7 },
      { date: daysAgo(0), sleepHrs: 7 },
    ]
    const res = analyzeMorningLogConsistency({ recovery, today: TODAY })
    expect(res.daysLogged).toBe(1)
  })
})
