// src/lib/__tests__/trainingLoad.consistency.test.js — E91

import { describe, it, expect } from 'vitest'
import { calculateConsistency } from '../trainingLoad.js'

// ─── Helper ───────────────────────────────────────────────────────────────────
// pattern: array of booleans, index 0 = furthest back, last index = most recent
// daysBack: shift the whole pattern further back by N days (0 = ends at today)
function makeRecentLog(pattern, daysBack = 0) {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const log = []
  pattern.forEach((hasSession, i) => {
    if (hasSession) {
      const d = new Date(today)
      d.setUTCDate(today.getUTCDate() - (pattern.length - 1 - i) - daysBack)
      log.push({ date: d.toISOString().slice(0, 10), tss: 80, type: 'run' })
    }
  })
  return log
}

// Returns a date string N days ago from today (UTC)
function daysAgo(n) {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('calculateConsistency', () => {
  // ── Null / empty guard ──────────────────────────────────────────────────────

  it('returns null for null log', () => {
    expect(calculateConsistency(null)).toBeNull()
  })

  it('returns null for empty array', () => {
    expect(calculateConsistency([])).toBeNull()
  })

  it('returns null when all entries are older than 28 days', () => {
    const log = [
      { date: daysAgo(29), tss: 80, type: 'run' },
      { date: daysAgo(35), tss: 60, type: 'run' },
    ]
    expect(calculateConsistency(log)).toBeNull()
  })

  // ── Result shape ────────────────────────────────────────────────────────────

  it('returns an object with all expected keys', () => {
    const log = makeRecentLog([true])
    const result = calculateConsistency(log)
    expect(result).toMatchObject({
      sessionDays: expect.any(Number),
      totalDays: expect.any(Number),
      pct: expect.any(Number),
      longestGap: expect.any(Number),
      currentGap: expect.any(Number),
    })
  })

  // ── Single session today ────────────────────────────────────────────────────

  it('single session today → sessionDays=1, currentGap=0, pct=Math.round(1/28*100)', () => {
    const log = makeRecentLog([true])
    const result = calculateConsistency(log)
    expect(result.sessionDays).toBe(1)
    expect(result.currentGap).toBe(0)
    expect(result.pct).toBe(Math.round((1 / 28) * 100))
  })

  // ── Full 28-day coverage ────────────────────────────────────────────────────

  it('28 sessions on 28 consecutive days → sessionDays=28, pct=100, longestGap=0, currentGap=0', () => {
    const pattern = Array(28).fill(true)
    const log = makeRecentLog(pattern)
    const result = calculateConsistency(log)
    expect(result.sessionDays).toBe(28)
    expect(result.pct).toBe(100)
    expect(result.longestGap).toBe(0)
    expect(result.currentGap).toBe(0)
  })

  // ── 14-day coverage (pattern ends today) ───────────────────────────────────

  it('daily sessions for the last 14 days → sessionDays=14, pct=50, longestGap=14', () => {
    // First 14 days no session, last 14 days session
    const pattern = [...Array(14).fill(false), ...Array(14).fill(true)]
    const log = makeRecentLog(pattern)
    const result = calculateConsistency(log)
    expect(result.sessionDays).toBe(14)
    expect(result.pct).toBe(50)
    // The 14 days without sessions at the start of the window form the longest gap
    expect(result.longestGap).toBe(14)
  })

  // ── Gap spanning most of the window ────────────────────────────────────────

  it('session on day 27 and today only → longestGap ≥ 26', () => {
    const log = [
      { date: daysAgo(27), tss: 80, type: 'run' },
      { date: daysAgo(0), tss: 80, type: 'run' },
    ]
    const result = calculateConsistency(log)
    // 26 days between day 27 and day 0 with no sessions
    expect(result.longestGap).toBeGreaterThanOrEqual(26)
  })

  // ── Weekly cadence (Monday only) ───────────────────────────────────────────

  it('session every 7th day for 4 weeks → longestGap = 6', () => {
    // Build 4 sessions, each exactly 7 days apart, ending today
    const log = [
      { date: daysAgo(21), tss: 80, type: 'run' },
      { date: daysAgo(14), tss: 80, type: 'run' },
      { date: daysAgo(7), tss: 80, type: 'run' },
      { date: daysAgo(0), tss: 80, type: 'run' },
    ]
    const result = calculateConsistency(log)
    expect(result.longestGap).toBe(6)
  })

  // ── currentGap variants ─────────────────────────────────────────────────────

  it('currentGap = 0 when session logged today', () => {
    const log = makeRecentLog([true])
    expect(calculateConsistency(log).currentGap).toBe(0)
  })

  it('currentGap = 1 when last session was yesterday', () => {
    const log = [{ date: daysAgo(1), tss: 80, type: 'run' }]
    expect(calculateConsistency(log).currentGap).toBe(1)
  })

  it('currentGap = 3 when last session was 3 days ago', () => {
    const log = [{ date: daysAgo(3), tss: 80, type: 'run' }]
    expect(calculateConsistency(log).currentGap).toBe(3)
  })

  // ── pct rounding ────────────────────────────────────────────────────────────

  it('pct = Math.round(sessionDays / totalDays * 100)', () => {
    // 5 sessions in 28-day window
    const pattern = [
      true, false, false, false, false, false,
      true, false, false, false, false, false,
      true, false, false, false, false, false,
      true, false, false, false, false, false,
      true, false, false, false,
    ]
    const log = makeRecentLog(pattern)
    const result = calculateConsistency(log)
    expect(result.pct).toBe(Math.round((result.sessionDays / result.totalDays) * 100))
  })

  // ── Multiple entries on same date count as ONE session day ─────────────────

  it('multiple entries on same date are counted as one session day', () => {
    const today = daysAgo(0)
    const log = [
      { date: today, tss: 80, type: 'run' },
      { date: today, tss: 40, type: 'swim' },
      { date: today, tss: 30, type: 'bike' },
    ]
    const result = calculateConsistency(log)
    expect(result.sessionDays).toBe(1)
  })

  // ── Custom days parameter ───────────────────────────────────────────────────

  it('custom days=14 window: totalDays=14, only entries within 14 days count', () => {
    // Sessions on day 13, 7, 0 — all within 14-day window
    // Session on day 15 — outside 14-day window (ignored)
    const log = [
      { date: daysAgo(15), tss: 80, type: 'run' }, // outside
      { date: daysAgo(13), tss: 80, type: 'run' },
      { date: daysAgo(7), tss: 80, type: 'run' },
      { date: daysAgo(0), tss: 80, type: 'run' },
    ]
    const result = calculateConsistency(log, 14)
    expect(result.totalDays).toBe(14)
    expect(result.sessionDays).toBe(3)
  })

  // ── totalDays always equals days param ─────────────────────────────────────

  it('totalDays always equals the days param', () => {
    const log = makeRecentLog([true, false, true])
    expect(calculateConsistency(log, 28).totalDays).toBe(28)
    expect(calculateConsistency(log, 14).totalDays).toBe(14)
    expect(calculateConsistency(log, 7).totalDays).toBe(7)
  })

  // ── Cutoff boundary: entry at exactly today - 28 days is included ───────────

  it('entry exactly at cutoff boundary (today - 28 days) is included', () => {
    // The filter is e.date >= cutoffStr where cutoff = today - days
    // So the entry at exactly today-28 days should be included
    const log = [{ date: daysAgo(28), tss: 80, type: 'run' }]
    const result = calculateConsistency(log)
    expect(result).not.toBeNull()
    expect(result.sessionDays).toBe(1)
  })

  // ── Entry just before cutoff is excluded ───────────────────────────────────

  it('entry one day before cutoff (today - 29 days) is excluded', () => {
    const log = [{ date: daysAgo(29), tss: 80, type: 'run' }]
    // Single entry outside window → null
    expect(calculateConsistency(log)).toBeNull()
  })

  // ── longestGap never exceeds days ──────────────────────────────────────────

  it('longestGap never exceeds the days param', () => {
    // Only one session far from today but still within window
    const log = [{ date: daysAgo(27), tss: 80, type: 'run' }]
    const result = calculateConsistency(log)
    expect(result.longestGap).toBeLessThanOrEqual(28)
  })

  it('longestGap never exceeds custom days param', () => {
    const log = [{ date: daysAgo(6), tss: 80, type: 'run' }]
    const result = calculateConsistency(log, 7)
    expect(result.longestGap).toBeLessThanOrEqual(7)
  })

  // ── Sessions clustered at the start of the window ──────────────────────────

  it('sessions clustered at start of window → longestGap is large', () => {
    // Sessions on days 28 and 27 only; 26 consecutive rest days follow
    const log = [
      { date: daysAgo(28), tss: 80, type: 'run' },
      { date: daysAgo(27), tss: 80, type: 'run' },
    ]
    const result = calculateConsistency(log)
    // Gap from day 26 down to day 0 = 27 consecutive non-session days
    expect(result.longestGap).toBeGreaterThanOrEqual(26)
  })

  // ── currentGap when all sessions are near start of window ──────────────────

  it('currentGap reflects days since most recent session regardless of position', () => {
    const log = [
      { date: daysAgo(20), tss: 80, type: 'run' },
      { date: daysAgo(21), tss: 80, type: 'run' },
    ]
    const result = calculateConsistency(log)
    expect(result.currentGap).toBe(20)
  })

  // ── Interaction: no entries in window → null (currentGap=days would be moot) ─

  it('entries exist but none within window → null (currentGap=days code path never reached)', () => {
    // All entries older than 28 days; the null guard fires first
    const log = [
      { date: daysAgo(30), tss: 80, type: 'run' },
      { date: daysAgo(40), tss: 80, type: 'run' },
    ]
    expect(calculateConsistency(log)).toBeNull()
  })

  // ── Default days param ──────────────────────────────────────────────────────

  it('default days param is 28 (totalDays=28 when not specified)', () => {
    const log = makeRecentLog([true])
    expect(calculateConsistency(log).totalDays).toBe(28)
  })

  // ── pct is integer (Math.round) ─────────────────────────────────────────────

  it('pct is always an integer (never a float)', () => {
    // 3 sessions in 28 days → 3/28 ≈ 10.71... → rounds to 11
    const log = [
      { date: daysAgo(0), tss: 80, type: 'run' },
      { date: daysAgo(9), tss: 80, type: 'run' },
      { date: daysAgo(18), tss: 80, type: 'run' },
    ]
    const result = calculateConsistency(log)
    expect(Number.isInteger(result.pct)).toBe(true)
    expect(result.pct).toBe(Math.round((3 / 28) * 100))
  })

  // ── Mixed in-window and out-of-window entries ──────────────────────────────

  it('out-of-window entries do not inflate sessionDays', () => {
    const log = [
      { date: daysAgo(50), tss: 80, type: 'run' }, // outside
      { date: daysAgo(60), tss: 80, type: 'run' }, // outside
      { date: daysAgo(5), tss: 80, type: 'run' },  // inside
    ]
    const result = calculateConsistency(log)
    expect(result.sessionDays).toBe(1)
  })

  // ── longestGap = 0 when every day has a session ────────────────────────────

  it('longestGap is 0 when every single day in the window has a session', () => {
    const pattern = Array(28).fill(true)
    const log = makeRecentLog(pattern)
    expect(calculateConsistency(log).longestGap).toBe(0)
  })

  // ── Session exactly 14 days ago with custom 14-day window ──────────────────

  it('session exactly at day 14 with days=14 window → included, currentGap=14', () => {
    const log = [{ date: daysAgo(14), tss: 80, type: 'run' }]
    const result = calculateConsistency(log, 14)
    expect(result).not.toBeNull()
    expect(result.sessionDays).toBe(1)
    expect(result.currentGap).toBe(14)
  })
})
