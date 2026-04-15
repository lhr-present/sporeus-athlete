// src/lib/consistencyTests.test.js
import { describe, it, expect } from 'vitest'
import { calculateConsistency } from './trainingLoad.js'

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

describe('calculateConsistency', () => {
  it('10 consecutive daily sessions in 28-day window: pct ~36%, sessionDays = 10', () => {
    const log = Array.from({ length: 10 }, (_, i) => ({ date: daysAgo(i), tss: 50 }))
    const result = calculateConsistency(log, 28)
    expect(result).not.toBeNull()
    expect(result.sessionDays).toBe(10)
    expect(result.totalDays).toBe(28)
    expect(result.pct).toBe(Math.round((10 / 28) * 100)) // 36%
  })

  it('currentGap: last entry 3 days ago → currentGap = 3', () => {
    const log = [
      { date: daysAgo(3), tss: 80 },
      { date: daysAgo(10), tss: 60 },
    ]
    const result = calculateConsistency(log, 28)
    expect(result).not.toBeNull()
    expect(result.currentGap).toBe(3)
  })

  it('longestGap: sessions on day 27, 3, 2, 1 ago → longest gap between day-27 and day-3 = 23', () => {
    // sessions at daysAgo(27), daysAgo(3), daysAgo(2), daysAgo(1)
    // gap from daysAgo(27) to daysAgo(3) is 23 missing days (days 26..4)
    const log = [
      { date: daysAgo(27), tss: 70 },
      { date: daysAgo(3),  tss: 70 },
      { date: daysAgo(2),  tss: 70 },
      { date: daysAgo(1),  tss: 70 },
    ]
    const result = calculateConsistency(log, 28)
    expect(result).not.toBeNull()
    expect(result.longestGap).toBe(23)
  })

  it('returns null when log is empty', () => {
    expect(calculateConsistency([], 28)).toBeNull()
  })

  it('returns null when log has no entries within the window', () => {
    // All entries are older than 28 days
    const log = [
      { date: daysAgo(30), tss: 50 },
      { date: daysAgo(35), tss: 50 },
    ]
    expect(calculateConsistency(log, 28)).toBeNull()
  })
})
