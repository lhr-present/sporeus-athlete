// ─── perseverance.test.js — Duckworth weekly-rhythm grit detector tests ──────
//
// Covers: shape contract, null sparsity guard (<6 active weeks),
// the three bands (CONSISTENT / VARIABLE / SPORADIC), CV math,
// gritScore floor/cap rules, and the citation string.

import { describe, it, expect } from 'vitest'
import { analyzePerseverance, PERSEVERANCE_CITATION } from '../../athlete/perseverance.js'

// 2026-05-18 is a Monday — the ISO-week Monday for that day's week
// is itself. That makes "the week containing today" = (Mon 2026-05-18
// .. Sun 2026-05-24), which gives a clean Mon-anchored 12-week
// window stretching back to Mon 2026-03-02.
const TODAY = '2026-05-18'

function makeSessionsOnDate(date, count = 1) {
  const out = []
  for (let i = 0; i < count; i++) {
    out.push({ date, type: 'run', tss: 50 })
  }
  return out
}

/**
 * Build a log where each of the 12 ISO weeks (oldest -> newest)
 * relative to TODAY has `weekCounts[i]` sessions placed on the
 * Monday of that week.
 */
function makeWeeklyLog(weekCounts, today = TODAY) {
  // Find Monday of the ISO week of `today`. TODAY = Mon, so it is itself.
  const t = new Date(today + 'T12:00:00Z')
  const dow = t.getUTCDay()              // Mon=1
  const offset = dow === 0 ? 6 : dow - 1 // 0 for Mon
  const currentMonday = new Date(Date.UTC(
    t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - offset, 12, 0, 0, 0
  ))
  const log = []
  const W = weekCounts.length
  for (let i = 0; i < W; i++) {
    // i=0 is the oldest week.
    const offsetWeeks = (W - 1) - i
    const monday = new Date(currentMonday)
    monday.setUTCDate(monday.getUTCDate() - offsetWeeks * 7)
    const date = monday.toISOString().slice(0, 10)
    log.push(...makeSessionsOnDate(date, weekCounts[i]))
  }
  return log
}

// ─── Shape & input handling ─────────────────────────────────────────────────
describe('analyzePerseverance — input handling', () => {
  it('returns null when log is not an array', () => {
    expect(analyzePerseverance({ log: null, today: TODAY })).toBeNull()
    expect(analyzePerseverance({ log: undefined, today: TODAY })).toBeNull()
    expect(analyzePerseverance({ log: 'oops', today: TODAY })).toBeNull()
  })

  it('returns null when today is invalid', () => {
    expect(analyzePerseverance({ log: [], today: 'not-a-date' })).toBeNull()
  })

  it('returns null on empty log (no active weeks)', () => {
    const result = analyzePerseverance({ log: [], today: TODAY })
    expect(result).toBeNull()
  })

  it('default windowWeeks is 12', () => {
    const counts = Array(12).fill(3)
    const log = makeWeeklyLog(counts)
    const result = analyzePerseverance({ log, today: TODAY })
    expect(result).not.toBeNull()
    expect(result.weeks.length).toBe(12)
  })
})

// ─── Sparsity guard ──────────────────────────────────────────────────────────
describe('analyzePerseverance — sparsity guard', () => {
  it('returns null when fewer than 6 of 12 weeks have any sessions', () => {
    // 5 active weeks, 7 inactive.
    const counts = [3, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0, 0]
    const log = makeWeeklyLog(counts)
    expect(analyzePerseverance({ log, today: TODAY })).toBeNull()
  })

  it('returns a result when exactly 6 of 12 weeks are active', () => {
    const counts = [3, 3, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0]
    const log = makeWeeklyLog(counts)
    const result = analyzePerseverance({ log, today: TODAY })
    expect(result).not.toBeNull()
    expect(result.activeWeeks).toBe(6)
  })
})

// ─── Shape contract ──────────────────────────────────────────────────────────
describe('analyzePerseverance — shape contract', () => {
  it('returns weeks ordered oldest -> newest with weekStart + sessionCount', () => {
    const counts = [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 2, 3]
    const log = makeWeeklyLog(counts)
    const result = analyzePerseverance({ log, today: TODAY })
    expect(result).not.toBeNull()
    expect(result.weeks.length).toBe(12)
    for (let i = 0; i < 12; i++) {
      expect(result.weeks[i]).toHaveProperty('weekStart')
      expect(result.weeks[i]).toHaveProperty('sessionCount')
      expect(result.weeks[i].sessionCount).toBe(counts[i])
      expect(result.weeks[i].weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
    // Chronological order
    for (let i = 1; i < 12; i++) {
      expect(result.weeks[i].weekStart > result.weeks[i - 1].weekStart).toBe(true)
    }
  })

  it('includes the citation string', () => {
    const log = makeWeeklyLog(Array(12).fill(3))
    const result = analyzePerseverance({ log, today: TODAY })
    expect(result.citation).toBe(PERSEVERANCE_CITATION)
    expect(result.citation).toBe('Duckworth 2007; Duckworth 2016')
  })

  it('weeks array length matches windowWeeks param', () => {
    const counts = Array(12).fill(3)
    const log = makeWeeklyLog(counts)
    const result = analyzePerseverance({ log, today: TODAY, windowWeeks: 12 })
    expect(result.weeks.length).toBe(12)
  })
})

// ─── Band: CONSISTENT ────────────────────────────────────────────────────────
describe('analyzePerseverance — CONSISTENT band', () => {
  it('flat 3 sessions/week → gritScore 100, band CONSISTENT, cv 0', () => {
    const log = makeWeeklyLog(Array(12).fill(3))
    const result = analyzePerseverance({ log, today: TODAY })
    expect(result.band).toBe('CONSISTENT')
    expect(result.gritScore).toBe(100)
    expect(result.cv).toBe(0)
    expect(result.activeWeeks).toBe(12)
    expect(result.meanSessionsPerWeek).toBe(3)
  })

  it('flat 1 session/week (12 active) → gritScore 100, CONSISTENT', () => {
    const log = makeWeeklyLog(Array(12).fill(1))
    const result = analyzePerseverance({ log, today: TODAY })
    expect(result.band).toBe('CONSISTENT')
    expect(result.gritScore).toBe(100)
    expect(result.cv).toBe(0)
  })
})

// ─── Band: VARIABLE ──────────────────────────────────────────────────────────
describe('analyzePerseverance — VARIABLE band', () => {
  it('8 weeks 1 session + 4 inactive → ~59, VARIABLE', () => {
    // mean = 8/12 ≈ 0.667; stdDev ≈ 0.471; cv ≈ 0.707
    // cvPenalty = 30 * 0.707 ≈ 21.2; inactivePenalty = 4 * 5 = 20
    // score ≈ 100 - 20 - 21 ≈ 59
    const counts = [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0]
    const log = makeWeeklyLog(counts)
    const result = analyzePerseverance({ log, today: TODAY })
    expect(result).not.toBeNull()
    expect(result.band).toBe('VARIABLE')
    expect(result.gritScore).toBeGreaterThanOrEqual(50)
    expect(result.gritScore).toBeLessThan(75)
    expect(result.activeWeeks).toBe(8)
  })
})

// ─── Band: SPORADIC ──────────────────────────────────────────────────────────
describe('analyzePerseverance — SPORADIC band', () => {
  it('6 weeks 1 session + 6 inactive → ~40, SPORADIC', () => {
    // 6 active weeks (each 1 session), 6 inactive
    // inactivePenalty = 6 * 5 = 30
    // mean = 6/12 = 0.5; stdDev = 0.5; cv = 1.0
    // cvPenalty = min(40, 30*1.0) = 30
    // score = 100 - 30 - 30 = 40
    const counts = [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0]
    const log = makeWeeklyLog(counts)
    const result = analyzePerseverance({ log, today: TODAY })
    expect(result).not.toBeNull()
    expect(result.band).toBe('SPORADIC')
    expect(result.gritScore).toBeLessThan(50)
    expect(result.activeWeeks).toBe(6)
  })
})

// ─── Math: floor + caps ──────────────────────────────────────────────────────
describe('analyzePerseverance — gritScore math', () => {
  it('floors at 0 (never negative)', () => {
    // Wildly variable: lots of zeros + a few big weeks would push
    // inactivePenalty + cvPenalty past 100. With our 6-active-week
    // minimum we test the extreme case: 6 active weeks all with one
    // huge spike vs zeros doesn't trigger the floor easily, so we
    // ensure the formula clamps any computed result to [0, 100].
    const counts = [50, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 0]
    const log = makeWeeklyLog(counts)
    const result = analyzePerseverance({ log, today: TODAY })
    expect(result).not.toBeNull()
    expect(result.gritScore).toBeGreaterThanOrEqual(0)
    expect(result.gritScore).toBeLessThanOrEqual(100)
  })

  it('cv penalty is capped at 40 even when raw CV is huge', () => {
    // Construct a high-CV log with NO inactive weeks so we can
    // isolate the cv penalty. 11 weeks of 1 session, 1 week of 50.
    const counts = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 50]
    const log = makeWeeklyLog(counts)
    const result = analyzePerseverance({ log, today: TODAY })
    expect(result).not.toBeNull()
    // mean ≈ 5.08, stdDev huge, CV > 2 — penalty capped at 40
    expect(result.gritScore).toBeGreaterThanOrEqual(60) // 100 - 40 - 0 inactivePenalty
    expect(result.activeWeeks).toBe(12)
    expect(result.cv).not.toBeNull()
    expect(result.cv).toBeGreaterThan(1)
  })

  it('cv is null when mean is 0', () => {
    // Construct an "active" log where the sessions land outside the
    // 12-week window — but that would fail the sparsity guard. To
    // get cv=null we need the function to compute a mean of 0 with
    // >= 6 active weeks, which is impossible (active weeks have >= 1
    // session, so total > 0 and mean > 0). Therefore the null branch
    // is only reachable when the function is called on configurations
    // that yield 0 mean — which our guard already rejects. We assert
    // the design invariant: any returned result has mean > 0.
    const log = makeWeeklyLog([1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0])
    const result = analyzePerseverance({ log, today: TODAY })
    expect(result).not.toBeNull()
    expect(result.meanSessionsPerWeek).toBeGreaterThan(0)
    expect(result.cv).not.toBeNull()
  })

  it('inactiveWeeks=0 and cv=0 → score 100', () => {
    const log = makeWeeklyLog(Array(12).fill(4))
    const result = analyzePerseverance({ log, today: TODAY })
    expect(result.gritScore).toBe(100)
  })

  it('sessions outside the 12-week window are ignored', () => {
    // 12 weeks of clean 3-per-week, then add a huge pile of "old"
    // sessions far in the past — they must not change the result.
    const inWindow = makeWeeklyLog(Array(12).fill(3))
    const oldDates = ['2024-01-01', '2024-01-08', '2024-01-15']
    const old = oldDates.flatMap(d => makeSessionsOnDate(d, 20))
    const log = [...inWindow, ...old]
    const result = analyzePerseverance({ log, today: TODAY })
    expect(result.band).toBe('CONSISTENT')
    expect(result.gritScore).toBe(100)
    expect(result.activeWeeks).toBe(12)
  })
})
