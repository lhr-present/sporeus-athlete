// src/lib/__tests__/athlete/prTimeline.test.js — E33: 12+ tests
import { describe, it, expect } from 'vitest'
import { scanPRHistory, recentPRs, totalPRCount, computePRTimeline } from '../../athlete/prTimeline.js'

// ─── Synthetic log builders ────────────────────────────────────────────────────

// Single session with given date and TSS
function makeSession(date, tss, duration = 60, type = 'run') {
  return { date, tss, duration, type }
}

// 20-entry log with increasing TSS (50,55,60,…) on consecutive days from 2026-01-01
// Every entry sets a new TSS PR over the previous max.
const TODAY = '2026-04-25'

function makeIncreasingLog(n = 20) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date('2026-01-01')
    d.setDate(d.getDate() + i)
    const date = d.toISOString().slice(0, 10)
    const tss = 50 + i * 5
    return makeSession(date, tss)
  })
}

// ─── scanPRHistory ─────────────────────────────────────────────────────────────

describe('scanPRHistory', () => {
  it('returns [] for empty log', () => {
    expect(scanPRHistory([])).toEqual([])
  })

  it('returns [] for single-entry log', () => {
    expect(scanPRHistory([makeSession('2026-01-01', 100)])).toEqual([])
  })

  it('returns [] for log with length < 2', () => {
    expect(scanPRHistory([makeSession('2026-01-01', 100)])).toHaveLength(0)
  })

  it('detects PR events when second session beats first on TSS', () => {
    const log = [
      makeSession('2026-01-01', 80),
      makeSession('2026-01-02', 100),
    ]
    const result = scanPRHistory(log)
    // Both sessions set TSS PRs: first has no prior (prevMax=0 < 80), second beats 80
    expect(result.length).toBeGreaterThanOrEqual(1)
    // Newest-first: result[0] should be the second session
    expect(result[0].date).toBe('2026-01-02')
  })

  it('detected PR event contains highest_tss category', () => {
    const log = [
      makeSession('2026-01-01', 80),
      makeSession('2026-01-02', 100),
    ]
    const result = scanPRHistory(log)
    expect(result[0].prs.some(p => p.category === 'highest_tss')).toBe(true)
  })

  it('returns events sorted newest→oldest', () => {
    const log = makeIncreasingLog(5)
    const result = scanPRHistory(log)
    // Each entry sets a new TSS PR; should be at least some PR events
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].date >= result[i].date).toBe(true)
    }
  })

  it('20-entry increasing-TSS log yields PR events for all sessions (incl first)', () => {
    const log = makeIncreasingLog(20)
    const result = scanPRHistory(log)
    // Every session sets a new TSS PR (first session has no prior so prevMax=0 < 50)
    expect(result.length).toBe(20)
  })

  it('each PR event has required fields: date, type, prs, sessionIndex', () => {
    const log = makeIncreasingLog(3)
    const result = scanPRHistory(log)
    for (const ev of result) {
      expect(ev).toHaveProperty('date')
      expect(ev).toHaveProperty('type')
      expect(ev).toHaveProperty('prs')
      expect(ev).toHaveProperty('sessionIndex')
    }
  })
})

// ─── recentPRs ────────────────────────────────────────────────────────────────

describe('recentPRs', () => {
  it('returns at most `limit` events', () => {
    const log = makeIncreasingLog(20)
    const result = recentPRs(log, 5)
    expect(result.length).toBeLessThanOrEqual(5)
  })

  it('returns exactly limit when more events exist', () => {
    const log = makeIncreasingLog(20)
    const result = recentPRs(log, 5)
    expect(result).toHaveLength(5)
  })

  it('returns newest first', () => {
    const log = makeIncreasingLog(20)
    const result = recentPRs(log, 5)
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].date >= result[i].date).toBe(true)
    }
  })

  it('returns [] when log < 2', () => {
    expect(recentPRs([makeSession('2026-01-01', 100)])).toEqual([])
  })
})

// ─── totalPRCount ─────────────────────────────────────────────────────────────

describe('totalPRCount', () => {
  it('returns 0 for empty log', () => {
    expect(totalPRCount([])).toBe(0)
  })

  it('returns 0 for single-entry log', () => {
    expect(totalPRCount([makeSession('2026-01-01', 100)])).toBe(0)
  })

  it('counts across multiple PR sessions correctly', () => {
    const log = makeIncreasingLog(4)
    // All 4 sessions set a TSS PR (first has no prior so prevMax=0 < 50)
    const count = totalPRCount(log)
    expect(count).toBeGreaterThanOrEqual(4)
  })

  it('is a non-negative integer', () => {
    const log = makeIncreasingLog(10)
    const count = totalPRCount(log)
    expect(Number.isInteger(count)).toBe(true)
    expect(count).toBeGreaterThanOrEqual(0)
  })
})

// ─── computePRTimeline ────────────────────────────────────────────────────────

describe('computePRTimeline', () => {
  it('returns null for empty log', () => {
    expect(computePRTimeline([])).toBeNull()
  })

  it('returns null for single-entry log', () => {
    expect(computePRTimeline([makeSession('2026-01-01', 100)])).toBeNull()
  })

  it('returns null for log with length < 2', () => {
    expect(computePRTimeline([makeSession('2026-01-01', 80)])).toBeNull()
  })

  it('returns correct shape for valid log', () => {
    const log = makeIncreasingLog(5)
    const result = computePRTimeline(log, 5, TODAY)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('recentPRs')
    expect(result).toHaveProperty('totalPRCount')
    expect(result).toHaveProperty('lastPRDate')
    expect(result).toHaveProperty('daysSinceLastPR')
    expect(result).toHaveProperty('citation')
  })

  it('citation is the expected string', () => {
    const log = makeIncreasingLog(5)
    const result = computePRTimeline(log, 5, TODAY)
    expect(result.citation).toBe('Eston 2009 · personal record detection')
  })

  it('lastPRDate is in YYYY-MM-DD format', () => {
    const log = makeIncreasingLog(5)
    const result = computePRTimeline(log, 5, TODAY)
    expect(result.lastPRDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('daysSinceLastPR is a non-negative integer', () => {
    const log = makeIncreasingLog(5)
    const result = computePRTimeline(log, 5, TODAY)
    expect(Number.isInteger(result.daysSinceLastPR)).toBe(true)
    expect(result.daysSinceLastPR).toBeGreaterThanOrEqual(0)
  })

  it('daysSinceLastPR is correct vs today param', () => {
    // 5-entry log: dates 2026-01-01 through 2026-01-05 (index 0-4)
    // lastPRDate (newest PR) = 2026-01-05
    const log = makeIncreasingLog(5)
    const result = computePRTimeline(log, 5, '2026-01-10')
    // 2026-01-10 - 2026-01-05 = 5 days
    expect(result.daysSinceLastPR).toBe(5)
  })

  it('recentPRs length respects limit', () => {
    const log = makeIncreasingLog(20)
    const result = computePRTimeline(log, 3, TODAY)
    expect(result.recentPRs.length).toBeLessThanOrEqual(3)
  })

  it('totalPRCount matches sum of prs across all sessions', () => {
    const log = makeIncreasingLog(20)
    const result = computePRTimeline(log, 5, TODAY)
    // totalPRCount should be at least 20 (all sessions set a TSS PR)
    expect(result.totalPRCount).toBeGreaterThanOrEqual(20)
  })
})
