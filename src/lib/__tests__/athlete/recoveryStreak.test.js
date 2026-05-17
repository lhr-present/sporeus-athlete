import { describe, it, expect } from 'vitest'
import {
  computeRecoveryStreak,
  RECOVERY_STREAK_CITATION,
} from '../../athlete/recoveryStreak.js'

const TODAY = '2026-05-17'

function isoOffset(days) {
  const d = new Date(TODAY + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

describe('computeRecoveryStreak — pure fn', () => {
  it('(a) returns null on empty / missing input', () => {
    expect(computeRecoveryStreak({ recovery: [], today: TODAY })).toBeNull()
    expect(computeRecoveryStreak({ recovery: null, today: TODAY })).toBeNull()
    expect(computeRecoveryStreak({})).toBeNull()
  })

  it('(b) single ≥70 day today → currentStreak = 1', () => {
    const r = computeRecoveryStreak({
      recovery: [{ date: TODAY, score: 75 }],
      today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.currentStreak).toBe(1)
    expect(r.longestStreak90d).toBe(1)
    expect(r.threshold).toBe(70)
    expect(r.citation).toBe(RECOVERY_STREAK_CITATION)
    expect(r.lastBreakDate).toBeNull()
  })

  it('(c) 7 consecutive ≥70 days → currentStreak = 7', () => {
    const recovery = []
    for (let i = 0; i < 7; i++) {
      recovery.push({ date: isoOffset(-i), score: 80 })
    }
    const r = computeRecoveryStreak({ recovery, today: TODAY })
    expect(r.currentStreak).toBe(7)
    expect(r.longestStreak90d).toBe(7)
    expect(r.lastBreakDate).toBeNull()
  })

  it('(d) low score today breaks the streak (currentStreak = 0 even with prior good days)', () => {
    const recovery = []
    // 5 prior good days
    for (let i = 1; i <= 5; i++) recovery.push({ date: isoOffset(-i), score: 85 })
    // Today low
    recovery.push({ date: TODAY, score: 55 })
    const r = computeRecoveryStreak({ recovery, today: TODAY })
    expect(r.currentStreak).toBe(0)
    // Longest run in window was 5 prior good days
    expect(r.longestStreak90d).toBe(5)
    expect(r.lastBreakDate).toBe(TODAY)
  })

  it('(e) gap day (missing entry yesterday) breaks the current streak', () => {
    // Today good, yesterday MISSING, day-before good
    const recovery = [
      { date: TODAY,         score: 80 },
      // yesterday missing
      { date: isoOffset(-2), score: 80 },
      { date: isoOffset(-3), score: 80 },
    ]
    const r = computeRecoveryStreak({ recovery, today: TODAY })
    // Only today contributes — yesterday's absence ends the streak.
    expect(r.currentStreak).toBe(1)
    // The 2-day run (-2, -3) is the longest historical run; today is also 1.
    expect(r.longestStreak90d).toBe(2)
  })

  it('(f) longestStreak90d > currentStreak after an intervening break', () => {
    const recovery = []
    // Old 10-day run: days -20 .. -11 (all good)
    for (let i = 11; i <= 20; i++) recovery.push({ date: isoOffset(-i), score: 90 })
    // Break: day -10 low
    recovery.push({ date: isoOffset(-10), score: 40 })
    // Recent 3-day run: today, -1, -2 (good)
    recovery.push({ date: isoOffset(-2), score: 85 })
    recovery.push({ date: isoOffset(-1), score: 85 })
    recovery.push({ date: TODAY,         score: 85 })
    // Fill the rest with low/missing — leave -9..-3 missing so the
    // current run is exactly 3 (today, -1, -2).
    const r = computeRecoveryStreak({ recovery, today: TODAY })
    expect(r.currentStreak).toBe(3)
    expect(r.longestStreak90d).toBe(10)
    expect(r.lastBreakDate).toBe(isoOffset(-10))
  })

  it('(g) custom threshold respected (threshold = 80)', () => {
    // 3 days at 75 — would qualify at threshold 70, but NOT at 80
    const recovery = [
      { date: TODAY,         score: 75 },
      { date: isoOffset(-1), score: 75 },
      { date: isoOffset(-2), score: 75 },
    ]
    const rLow = computeRecoveryStreak({ recovery, today: TODAY, threshold: 70 })
    expect(rLow.currentStreak).toBe(3)
    expect(rLow.threshold).toBe(70)

    const rHigh = computeRecoveryStreak({ recovery, today: TODAY, threshold: 80 })
    expect(rHigh.currentStreak).toBe(0)
    expect(rHigh.threshold).toBe(80)
    // Each day < threshold counts as a break event; lastBreakDate = today
    expect(rHigh.lastBreakDate).toBe(TODAY)
  })

  it('(h) lookbackDays bounds longestStreak90d (longest must fit inside window)', () => {
    const recovery = []
    // 10-day run ending 5 days ago — fully outside a 3-day lookback
    for (let i = 5; i <= 14; i++) recovery.push({ date: isoOffset(-i), score: 90 })
    // Bridge so the recent 3 days are also good
    recovery.push({ date: isoOffset(-2), score: 85 })
    recovery.push({ date: isoOffset(-1), score: 85 })
    recovery.push({ date: TODAY,         score: 85 })

    const rWide = computeRecoveryStreak({ recovery, today: TODAY, lookbackDays: 90 })
    expect(rWide.longestStreak90d).toBe(10)

    const rNarrow = computeRecoveryStreak({ recovery, today: TODAY, lookbackDays: 3 })
    // Window is [today-2 .. today] — only the recent 3-day run fits
    expect(rNarrow.longestStreak90d).toBe(3)
  })

  it('buckets multiple entries on the same date → latest by index wins', () => {
    // Today has two entries: first 85 (good), then 50 (low). Latest = 50.
    const recovery = [
      { date: TODAY,         score: 85 },
      { date: isoOffset(-1), score: 80 },
      { date: TODAY,         score: 50 }, // overrides earlier today
    ]
    const r = computeRecoveryStreak({ recovery, today: TODAY })
    expect(r.currentStreak).toBe(0)
    expect(r.lastBreakDate).toBe(TODAY)
  })

  it('today missing but yesterday good → currentStreak walks back from yesterday', () => {
    const recovery = [
      { date: isoOffset(-1), score: 80 },
      { date: isoOffset(-2), score: 80 },
      { date: isoOffset(-3), score: 80 },
    ]
    const r = computeRecoveryStreak({ recovery, today: TODAY })
    expect(r.currentStreak).toBe(3)
  })

  it('skips entries with malformed dates or non-numeric scores', () => {
    const recovery = [
      { date: TODAY,           score: 80 },
      { date: 'not-a-date',    score: 90 },
      { date: isoOffset(-1),   score: 'NaN' },
      { date: isoOffset(-2),   score: 75 },
    ]
    const r = computeRecoveryStreak({ recovery, today: TODAY })
    // Today (80) good; -1 has non-numeric → treated as null → breaks run
    expect(r.currentStreak).toBe(1)
  })
})
