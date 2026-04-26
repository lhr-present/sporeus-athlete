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
