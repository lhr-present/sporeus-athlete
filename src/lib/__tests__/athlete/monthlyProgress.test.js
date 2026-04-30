// src/lib/__tests__/athlete/monthlyProgress.test.js — E72
import { describe, it, expect } from 'vitest'
import { computeMonthlyProgress } from '../../athlete/monthlyProgress.js'

// Build a session with a given date and optional TSS/RPE
function session(date, tss = 50, rpe = 6) {
  return { date, tss, rpe, duration: 60 }
}

// Build n sessions in the given month (YYYY-MM), one per day starting from the 1st
function monthSessions(yearMonth, count, tss = 60, rpe = 6) {
  return Array.from({ length: count }, (_, i) => {
    const day = String(i + 1).padStart(2, '0')
    return session(`${yearMonth}-${day}`, tss, rpe)
  })
}

describe('computeMonthlyProgress — window guard', () => {
  it('returns null when today is not in 1st–7th of month', () => {
    const log = monthSessions('2026-03', 12)
    expect(computeMonthlyProgress(log, {}, '2026-04-08')).toBeNull()
    expect(computeMonthlyProgress(log, {}, '2026-04-15')).toBeNull()
    expect(computeMonthlyProgress(log, {}, '2026-04-30')).toBeNull()
  })

  it('returns non-null on 1st of month when prev month has enough data', () => {
    const log = monthSessions('2026-03', 10)
    const result = computeMonthlyProgress(log, {}, '2026-04-01')
    expect(result).not.toBeNull()
  })

  it('returns non-null on 7th of month', () => {
    const log = monthSessions('2026-03', 10)
    const result = computeMonthlyProgress(log, {}, '2026-04-07')
    expect(result).not.toBeNull()
  })

  it('returns null for empty log', () => {
    expect(computeMonthlyProgress([], {}, '2026-04-01')).toBeNull()
  })

  it('returns null when prev month has < 4 sessions', () => {
    const log = monthSessions('2026-03', 3)
    expect(computeMonthlyProgress(log, {}, '2026-04-01')).toBeNull()
  })
})

describe('computeMonthlyProgress — data shape', () => {
  const log = [
    ...monthSessions('2026-03', 8, 70, 6),
    ...monthSessions('2026-02', 6, 60, 5),
  ]

  it('returns correct session count', () => {
    const result = computeMonthlyProgress(log, {}, '2026-04-01')
    expect(result).not.toBeNull()
    expect(result.sessions).toBe(8)
  })

  it('returns correct totalTSS', () => {
    const result = computeMonthlyProgress(log, {}, '2026-04-01')
    expect(result.totalTSS).toBe(8 * 70)
  })

  it('returns correct avgRPE', () => {
    const result = computeMonthlyProgress(log, {}, '2026-04-01')
    expect(result.avgRPE).toBe(6)
  })

  it('has monthLabel with en and tr strings', () => {
    const result = computeMonthlyProgress(log, {}, '2026-04-01')
    expect(typeof result.monthLabel.en).toBe('string')
    expect(result.monthLabel.en).toContain('March')
    expect(typeof result.monthLabel.tr).toBe('string')
    expect(result.monthLabel.tr).toContain('Mart')
  })

  it('has ctlStart, ctlEnd, ctlDelta as numbers', () => {
    const result = computeMonthlyProgress(log, {}, '2026-04-01')
    expect(typeof result.ctlStart).toBe('number')
    expect(typeof result.ctlEnd).toBe('number')
    expect(result.ctlDelta).toBe(result.ctlEnd - result.ctlStart)
  })

  it('has bestWeek with label and tss', () => {
    const result = computeMonthlyProgress(log, {}, '2026-04-01')
    if (result.bestWeek) {
      expect(typeof result.bestWeek.label).toBe('string')
      expect(result.bestWeek.tss).toBeGreaterThan(0)
    }
  })

  it('has targetNextMonth with tssLow, tssHigh, targetCTL', () => {
    const result = computeMonthlyProgress(log, {}, '2026-04-01')
    expect(result.targetNextMonth.tssLow).toBeGreaterThan(0)
    expect(result.targetNextMonth.tssHigh).toBeGreaterThanOrEqual(result.targetNextMonth.tssLow)
    expect(result.targetNextMonth.targetCTL).toBeGreaterThan(0)
  })
})

describe('computeMonthlyProgress — year boundary (Dec → Jan)', () => {
  it('handles Dec → Jan year rollover', () => {
    const log = monthSessions('2025-12', 10)
    const result = computeMonthlyProgress(log, {}, '2026-01-03')
    expect(result).not.toBeNull()
    expect(result.monthLabel.en).toContain('December 2025')
    expect(result.monthLabel.tr).toContain('Aralık 2025')
  })
})

describe('computeMonthlyProgress — avgRPE edge cases', () => {
  it('returns null avgRPE when no sessions have RPE > 0', () => {
    const log = Array.from({ length: 6 }, (_, i) => ({
      date: `2026-03-${String(i + 1).padStart(2, '0')}`,
      tss: 60,
      rpe: 0,
      duration: 60,
    }))
    const result = computeMonthlyProgress(log, {}, '2026-04-01')
    expect(result).not.toBeNull()
    expect(result.avgRPE).toBeNull()
  })

  it('averages only sessions that have rpe > 0', () => {
    const log = [
      ...monthSessions('2026-03', 4, 50, 0), // no RPE
      { date: '2026-03-05', tss: 50, rpe: 8, duration: 60 },
      { date: '2026-03-06', tss: 50, rpe: 6, duration: 60 },
    ]
    const result = computeMonthlyProgress(log, {}, '2026-04-01')
    expect(result).not.toBeNull()
    // only the two rpe>0 sessions count: (8+6)/2 = 7
    expect(result.avgRPE).toBe(7)
  })
})

describe('computeMonthlyProgress — exact 4-session threshold', () => {
  it('returns non-null with exactly 4 sessions', () => {
    const log = monthSessions('2026-03', 4)
    const result = computeMonthlyProgress(log, {}, '2026-04-01')
    expect(result).not.toBeNull()
    expect(result.sessions).toBe(4)
  })

  it('returns null with exactly 3 sessions (below threshold)', () => {
    const log = monthSessions('2026-03', 3)
    expect(computeMonthlyProgress(log, {}, '2026-04-01')).toBeNull()
  })
})

describe('computeMonthlyProgress — month isolation', () => {
  it('only counts sessions from the previous calendar month', () => {
    const log = [
      ...monthSessions('2026-03', 6, 80),   // previous month (checked)
      ...monthSessions('2026-02', 10, 60),  // two months ago (ignored)
      ...monthSessions('2026-04', 5, 90),   // current month (ignored)
    ]
    const result = computeMonthlyProgress(log, {}, '2026-04-05')
    expect(result).not.toBeNull()
    expect(result.sessions).toBe(6)
    expect(result.totalTSS).toBe(6 * 80)
  })

  it('ignores sessions from future months', () => {
    const log = [
      ...monthSessions('2026-03', 5, 70),
      { date: '2026-05-01', tss: 100, rpe: 7, duration: 60 },
    ]
    const result = computeMonthlyProgress(log, {}, '2026-04-02')
    expect(result).not.toBeNull()
    expect(result.sessions).toBe(5)
  })
})

describe('computeMonthlyProgress — targetNextMonth', () => {
  it('tssHigh >= tssLow always', () => {
    const log = monthSessions('2026-03', 8, 100, 7)
    const result = computeMonthlyProgress(log, {}, '2026-04-03')
    expect(result.targetNextMonth.tssHigh).toBeGreaterThanOrEqual(result.targetNextMonth.tssLow)
  })

  it('targetCTL is ctlEnd + 5', () => {
    const log = monthSessions('2026-03', 8, 100, 7)
    const result = computeMonthlyProgress(log, {}, '2026-04-03')
    expect(result.targetNextMonth.targetCTL).toBe(result.ctlEnd + 5)
  })
})

describe('computeMonthlyProgress — bestWeek', () => {
  it('bestWeek tss equals the highest single-week TSS in the previous month', () => {
    // 2026-03-02 is Monday; days 2-8 form a clean Mon-Sun week, tss=200 each = 1400
    // days 9-15 form the next week, tss=50 each = 350
    const highWeek = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-03-${String(i + 2).padStart(2, '0')}`,
      tss: 200,
      rpe: 7,
      duration: 60,
    }))
    const lowWeek = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-03-${String(i + 9).padStart(2, '0')}`,
      tss: 50,
      rpe: 5,
      duration: 45,
    }))
    const log = [...highWeek, ...lowWeek]
    const result = computeMonthlyProgress(log, {}, '2026-04-01')
    expect(result).not.toBeNull()
    expect(result.bestWeek.tss).toBe(7 * 200)
  })

  it('bestWeek label is a non-empty string', () => {
    const log = monthSessions('2026-03', 8)
    const result = computeMonthlyProgress(log, {}, '2026-04-01')
    expect(typeof result.bestWeek.label).toBe('string')
    expect(result.bestWeek.label.length).toBeGreaterThan(0)
  })
})
