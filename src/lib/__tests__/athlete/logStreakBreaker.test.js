import { describe, it, expect } from 'vitest'
import {
  analyzeLogStreakBreaker,
  LOG_STREAK_BREAKER_CITATION,
} from '../../athlete/logStreakBreaker.js'

const TODAY = '2026-05-17'

function isoOffset(days, base = TODAY) {
  const d = new Date(base + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

describe('analyzeLogStreakBreaker — pure fn', () => {
  it('(a) returns null when both log and recovery are empty / missing', () => {
    expect(analyzeLogStreakBreaker({ log: [], recovery: [], today: TODAY })).toBeNull()
    expect(analyzeLogStreakBreaker({ log: null, recovery: null, today: TODAY })).toBeNull()
    expect(analyzeLogStreakBreaker({})).toBeNull()
    expect(analyzeLogStreakBreaker({ log: [{ date: 'bad' }], recovery: [], today: TODAY })).toBeNull()
  })

  it('(b) carries the citation through', () => {
    const r = analyzeLogStreakBreaker({
      log: [{ date: TODAY }],
      recovery: [],
      today: TODAY,
    })
    expect(r.citation).toBe(LOG_STREAK_BREAKER_CITATION)
  })

  it('classifies RECENT_BREAK when currentStreak < 3', () => {
    // One entry today only — current streak = 1.
    const r = analyzeLogStreakBreaker({
      log: [{ date: TODAY }],
      recovery: [],
      today: TODAY,
    })
    expect(r.status).toBe('RECENT_BREAK')
    expect(r.currentStreak).toBe(1)
    expect(r.longestGap).toBe(0)
    expect(r.totalLoggedDays).toBe(1)
    expect(r.gapStart).toBeNull()
    expect(r.gapEnd).toBeNull()
  })

  it('classifies RECENT_BREAK when current streak is 0 (no entry today, none yesterday)', () => {
    // Last entry 5 days ago — neither today nor yesterday has one.
    const r = analyzeLogStreakBreaker({
      log: [{ date: isoOffset(-5) }, { date: isoOffset(-6) }],
      recovery: [],
      today: TODAY,
    })
    expect(r.status).toBe('RECENT_BREAK')
    expect(r.currentStreak).toBe(0)
  })

  it('classifies STEADY when currentStreak in [3, 6]', () => {
    const log = []
    for (let i = 0; i < 5; i++) log.push({ date: isoOffset(-i) })
    const r = analyzeLogStreakBreaker({ log, recovery: [], today: TODAY })
    expect(r.status).toBe('STEADY')
    expect(r.currentStreak).toBe(5)
  })

  it('classifies ACTIVE when currentStreak ≥ 7 AND > longestGap / 2', () => {
    // 10-day current streak; no historical gap (consecutive days) → longestGap=0.
    const log = []
    for (let i = 0; i < 10; i++) log.push({ date: isoOffset(-i) })
    const r = analyzeLogStreakBreaker({ log, recovery: [], today: TODAY })
    expect(r.status).toBe('ACTIVE')
    expect(r.currentStreak).toBe(10)
    expect(r.longestGap).toBe(0)
  })

  it('classifies STEADY (NOT ACTIVE) when currentStreak ≥ 7 but ≤ longestGap/2', () => {
    // Current 7-day streak (today..-6); old island 50 days ago (-50) →
    // gap between -50 and -6 = 43 days. 7 vs 43/2=21.5 → STEADY.
    const log = []
    for (let i = 0; i < 7; i++) log.push({ date: isoOffset(-i) })
    log.push({ date: isoOffset(-50) })
    const r = analyzeLogStreakBreaker({ log, recovery: [], today: TODAY })
    expect(r.currentStreak).toBe(7)
    expect(r.longestGap).toBe(43)
    expect(r.status).toBe('STEADY')
  })

  it('computes longestGap and endpoints across a multi-month gap', () => {
    // Three islands: an old one (90 days ago), a middle one (40 days ago),
    // and a recent 4-day streak.
    const log = [
      { date: isoOffset(-90) },
      { date: isoOffset(-40) },
      { date: isoOffset(-3) },
      { date: isoOffset(-2) },
      { date: isoOffset(-1) },
      { date: TODAY },
    ]
    const r = analyzeLogStreakBreaker({ log, recovery: [], today: TODAY })
    // Gaps: -90→-40 = 49; -40→-3 = 36; consecutive within recent streak = 0.
    expect(r.longestGap).toBe(49)
    expect(r.gapStart).toBe(isoOffset(-90))
    expect(r.gapEnd).toBe(isoOffset(-40))
    // Current streak walks back from today through -3.
    expect(r.currentStreak).toBe(4)
    // 4 vs 49/2 = 24.5 → not ACTIVE (currentStreak < 7); STEADY.
    expect(r.status).toBe('STEADY')
  })

  it('walks current streak back from yesterday when today has no entry', () => {
    // Today missing; -1..-3 present → currentStreak = 3, status STEADY.
    const log = [
      { date: isoOffset(-1) },
      { date: isoOffset(-2) },
      { date: isoOffset(-3) },
    ]
    const r = analyzeLogStreakBreaker({ log, recovery: [], today: TODAY })
    expect(r.currentStreak).toBe(3)
    expect(r.status).toBe('STEADY')
  })

  it('current streak stops at the first historical gap', () => {
    // Today, -1 present, -2 MISSING, -3..-5 present → currentStreak = 2.
    const log = [
      { date: TODAY },
      { date: isoOffset(-1) },
      { date: isoOffset(-3) },
      { date: isoOffset(-4) },
      { date: isoOffset(-5) },
    ]
    const r = analyzeLogStreakBreaker({ log, recovery: [], today: TODAY })
    expect(r.currentStreak).toBe(2)
    // Gap between -5..-3 = 1; between -3 and -1 = 1 — longest gap = 1.
    expect(r.longestGap).toBe(1)
  })

  it('dedups when log and recovery share the same date', () => {
    // Same 3 dates in BOTH arrays → totalLoggedDays must be 3, not 6.
    const dates = [TODAY, isoOffset(-1), isoOffset(-2)]
    const log = dates.map(d => ({ date: d }))
    const recovery = dates.map(d => ({ date: d, score: 80 }))
    const r = analyzeLogStreakBreaker({ log, recovery, today: TODAY })
    expect(r.totalLoggedDays).toBe(3)
    expect(r.currentStreak).toBe(3)
  })

  it('combines log + recovery dates into one unique set', () => {
    // log: today and -3; recovery: -1 and -2 — together they form a 4-day
    // consecutive streak [today, -1, -2, -3].
    const log = [{ date: TODAY }, { date: isoOffset(-3) }]
    const recovery = [{ date: isoOffset(-1), score: 80 }, { date: isoOffset(-2), score: 80 }]
    const r = analyzeLogStreakBreaker({ log, recovery, today: TODAY })
    expect(r.totalLoggedDays).toBe(4)
    expect(r.currentStreak).toBe(4)
    expect(r.longestGap).toBe(0)
  })

  it('totalLoggedDays counts every unique calendar date', () => {
    const log = []
    for (let i = 0; i < 20; i++) log.push({ date: isoOffset(-i) })
    // Add a separated cluster
    log.push({ date: isoOffset(-50) })
    log.push({ date: isoOffset(-51) })
    const r = analyzeLogStreakBreaker({ log, recovery: [], today: TODAY })
    expect(r.totalLoggedDays).toBe(22)
  })

  it('skips malformed dates silently', () => {
    const log = [
      { date: TODAY },
      { date: 'not-a-date' },
      { date: null },
      { date: isoOffset(-1) },
    ]
    const r = analyzeLogStreakBreaker({ log, recovery: [], today: TODAY })
    expect(r.totalLoggedDays).toBe(2)
    expect(r.currentStreak).toBe(2)
  })

  it('endpoints are null when there is only a single logged day', () => {
    const r = analyzeLogStreakBreaker({
      log: [{ date: TODAY }],
      recovery: [],
      today: TODAY,
    })
    expect(r.longestGap).toBe(0)
    expect(r.gapStart).toBeNull()
    expect(r.gapEnd).toBeNull()
  })
})
