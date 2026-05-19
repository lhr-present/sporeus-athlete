// ─── trainingAge.test.js — Lloyd 2015 long-term athletic development tests ──
//
// Covers: null/empty handling, the four stage bands
// (BEGINNER / DEVELOPING / ESTABLISHED / VETERAN), consistentWeeks
// math (>=3 sessions counts; <3 does not), edge cases (single-week
// log, partial-week edge), and the citation string.

import { describe, it, expect } from 'vitest'
import {
  analyzeTrainingAge,
  classifyDevelopmentStage,
  TRAINING_AGE_CITATION,
} from '../../athlete/trainingAge.js'

// 2026-05-18 is a Monday — anchor for ISO-week math.
const TODAY = '2026-05-18'

function makeSessionsOnDate(date, count = 1) {
  const out = []
  for (let i = 0; i < count; i++) {
    out.push({ date, type: 'run', tss: 50 })
  }
  return out
}

/**
 * Build a log where each of `weekCounts.length` ISO weeks
 * (oldest -> newest) relative to TODAY has `weekCounts[i]` sessions
 * placed on the Monday of that week.
 */
function makeWeeklyLog(weekCounts, today = TODAY) {
  const t = new Date(today + 'T12:00:00Z')
  const dow = t.getUTCDay()
  const offset = dow === 0 ? 6 : dow - 1
  const currentMonday = new Date(Date.UTC(
    t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - offset, 12, 0, 0, 0,
  ))
  const log = []
  const W = weekCounts.length
  for (let i = 0; i < W; i++) {
    const offsetWeeks = (W - 1) - i
    const monday = new Date(currentMonday)
    monday.setUTCDate(monday.getUTCDate() - offsetWeeks * 7)
    const date = monday.toISOString().slice(0, 10)
    log.push(...makeSessionsOnDate(date, weekCounts[i]))
  }
  return log
}

// ─── Input handling ──────────────────────────────────────────────────────────
describe('analyzeTrainingAge — input handling', () => {
  it('returns null when log is not an array', () => {
    expect(analyzeTrainingAge({ log: null, today: TODAY })).toBeNull()
    expect(analyzeTrainingAge({ log: undefined, today: TODAY })).toBeNull()
    expect(analyzeTrainingAge({ log: 'oops', today: TODAY })).toBeNull()
  })

  it('returns null when log is empty', () => {
    expect(analyzeTrainingAge({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null when today is invalid', () => {
    const log = makeWeeklyLog([3])
    expect(analyzeTrainingAge({ log, today: 'not-a-date' })).toBeNull()
  })

  it('returns null when all entries have missing dates', () => {
    const log = [{ tss: 50 }, { date: null, tss: 30 }]
    expect(analyzeTrainingAge({ log, today: TODAY })).toBeNull()
  })

  it('ships the citation on every non-null return', () => {
    const log = makeWeeklyLog([3])
    const result = analyzeTrainingAge({ log, today: TODAY })
    expect(result.citation).toBe(TRAINING_AGE_CITATION)
    expect(result.citation).toBe('Bompa 2018; Tønnessen 2014; Lloyd 2015')
  })
})

// ─── Consistent-week math ────────────────────────────────────────────────────
describe('analyzeTrainingAge — consistent week math', () => {
  it('counts a week with exactly 3 sessions as consistent', () => {
    const log = makeWeeklyLog([3])
    const r = analyzeTrainingAge({ log, today: TODAY })
    expect(r.trainingAgeWeeks).toBe(1)
  })

  it('counts a week with 4 sessions as consistent', () => {
    const log = makeWeeklyLog([4])
    const r = analyzeTrainingAge({ log, today: TODAY })
    expect(r.trainingAgeWeeks).toBe(1)
  })

  it('does NOT count a week with 2 sessions as consistent', () => {
    const log = makeWeeklyLog([2])
    const r = analyzeTrainingAge({ log, today: TODAY })
    expect(r.trainingAgeWeeks).toBe(0)
  })

  it('does NOT count a week with 1 session as consistent', () => {
    const log = makeWeeklyLog([1])
    const r = analyzeTrainingAge({ log, today: TODAY })
    expect(r.trainingAgeWeeks).toBe(0)
  })

  it('sums consistent weeks across mixed history', () => {
    const counts = [3, 1, 4, 0, 5, 2, 3, 6] // consistent: 3,4,5,3,6 -> 5
    const log = makeWeeklyLog(counts)
    const r = analyzeTrainingAge({ log, today: TODAY })
    expect(r.trainingAgeWeeks).toBe(5)
    expect(r.totalWeeksTracked).toBe(8)
  })
})

// ─── Stage classification (4 bands) ─────────────────────────────────────────
describe('classifyDevelopmentStage — Lloyd 2015 bands', () => {
  it('BEGINNER for < 26 weeks', () => {
    expect(classifyDevelopmentStage(0)).toBe('BEGINNER')
    expect(classifyDevelopmentStage(1)).toBe('BEGINNER')
    expect(classifyDevelopmentStage(25)).toBe('BEGINNER')
  })

  it('DEVELOPING for 26..103', () => {
    expect(classifyDevelopmentStage(26)).toBe('DEVELOPING')
    expect(classifyDevelopmentStage(52)).toBe('DEVELOPING')
    expect(classifyDevelopmentStage(103)).toBe('DEVELOPING')
  })

  it('ESTABLISHED for 104..259', () => {
    expect(classifyDevelopmentStage(104)).toBe('ESTABLISHED')
    expect(classifyDevelopmentStage(150)).toBe('ESTABLISHED')
    expect(classifyDevelopmentStage(259)).toBe('ESTABLISHED')
  })

  it('VETERAN for >= 260', () => {
    expect(classifyDevelopmentStage(260)).toBe('VETERAN')
    expect(classifyDevelopmentStage(400)).toBe('VETERAN')
    expect(classifyDevelopmentStage(1000)).toBe('VETERAN')
  })
})

describe('analyzeTrainingAge — stage bands integration', () => {
  it('BEGINNER stage when 20 consistent weeks', () => {
    // 20 weeks with 3 sessions each = 20 consistent weeks (< 26).
    const log = makeWeeklyLog(Array(20).fill(3))
    const r = analyzeTrainingAge({ log, today: TODAY })
    expect(r.stage).toBe('BEGINNER')
    expect(r.trainingAgeWeeks).toBe(20)
  })

  it('DEVELOPING stage when 60 consistent weeks', () => {
    const log = makeWeeklyLog(Array(60).fill(3))
    const r = analyzeTrainingAge({ log, today: TODAY })
    expect(r.stage).toBe('DEVELOPING')
    expect(r.trainingAgeWeeks).toBe(60)
  })

  it('ESTABLISHED stage when 150 consistent weeks', () => {
    const log = makeWeeklyLog(Array(150).fill(3))
    const r = analyzeTrainingAge({ log, today: TODAY })
    expect(r.stage).toBe('ESTABLISHED')
    expect(r.trainingAgeWeeks).toBe(150)
  })

  it('VETERAN stage when 300 consistent weeks', () => {
    const log = makeWeeklyLog(Array(300).fill(3))
    const r = analyzeTrainingAge({ log, today: TODAY })
    expect(r.stage).toBe('VETERAN')
    expect(r.trainingAgeWeeks).toBe(300)
  })
})

// ─── Numeric conversions ─────────────────────────────────────────────────────
describe('analyzeTrainingAge — year/month conversions', () => {
  it('returns trainingAgeYears at 2dp precision', () => {
    const log = makeWeeklyLog(Array(52).fill(3))
    const r = analyzeTrainingAge({ log, today: TODAY })
    expect(r.trainingAgeYears).toBeCloseTo(1.0, 2)
  })

  it('returns trainingAgeMonths at 1dp precision', () => {
    const log = makeWeeklyLog(Array(26).fill(3))
    const r = analyzeTrainingAge({ log, today: TODAY })
    // 26 / 4.345 ≈ 5.98...
    expect(r.trainingAgeMonths).toBeGreaterThanOrEqual(5.9)
    expect(r.trainingAgeMonths).toBeLessThanOrEqual(6.1)
  })

  it('handles zero consistent weeks cleanly', () => {
    // 10 weeks of 1 session each — no consistent weeks.
    const log = makeWeeklyLog(Array(10).fill(1))
    const r = analyzeTrainingAge({ log, today: TODAY })
    expect(r.trainingAgeWeeks).toBe(0)
    expect(r.trainingAgeYears).toBe(0)
    expect(r.trainingAgeMonths).toBe(0)
    expect(r.consistencyRate).toBe(0)
    expect(r.stage).toBe('BEGINNER')
  })
})

// ─── totalWeeksTracked & consistencyRate ─────────────────────────────────────
describe('analyzeTrainingAge — coverage stats', () => {
  it('totalWeeksTracked spans first-week-Monday through today-week-Monday inclusive', () => {
    const log = makeWeeklyLog(Array(10).fill(3))
    const r = analyzeTrainingAge({ log, today: TODAY })
    expect(r.totalWeeksTracked).toBe(10)
  })

  it('consistencyRate = consistentWeeks / totalWeeksTracked', () => {
    // 5 consistent weeks out of 10 tracked.
    const counts = [3, 3, 3, 3, 3, 1, 1, 1, 1, 1]
    const log = makeWeeklyLog(counts)
    const r = analyzeTrainingAge({ log, today: TODAY })
    expect(r.totalWeeksTracked).toBe(10)
    expect(r.trainingAgeWeeks).toBe(5)
    expect(r.consistencyRate).toBe(0.5)
  })

  it('reaches consistencyRate of 1.0 when every week is consistent', () => {
    const log = makeWeeklyLog(Array(8).fill(3))
    const r = analyzeTrainingAge({ log, today: TODAY })
    expect(r.consistencyRate).toBe(1)
  })
})

// ─── Edge cases ──────────────────────────────────────────────────────────────
describe('analyzeTrainingAge — edge cases', () => {
  it('single-week log with 3 sessions: 1 tracked week, 1 consistent', () => {
    const log = makeWeeklyLog([3])
    const r = analyzeTrainingAge({ log, today: TODAY })
    expect(r.totalWeeksTracked).toBe(1)
    expect(r.trainingAgeWeeks).toBe(1)
    expect(r.stage).toBe('BEGINNER')
    expect(r.consistencyRate).toBe(1)
  })

  it('single-week log with 1 session: 1 tracked week, 0 consistent', () => {
    const log = makeWeeklyLog([1])
    const r = analyzeTrainingAge({ log, today: TODAY })
    expect(r.totalWeeksTracked).toBe(1)
    expect(r.trainingAgeWeeks).toBe(0)
    expect(r.consistencyRate).toBe(0)
  })

  it('partial-week edge: sessions across Sun and Mon land in their own ISO weeks', () => {
    // 2026-05-17 is the Sunday before the TODAY Monday.
    // 3 sessions on that Sunday should land in the prior ISO week.
    // 3 sessions on TODAY land in the current week.
    // Result: 2 consistent weeks tracked.
    const log = [
      ...makeSessionsOnDate('2026-05-17', 3),
      ...makeSessionsOnDate('2026-05-18', 3),
    ]
    const r = analyzeTrainingAge({ log, today: TODAY })
    expect(r.totalWeeksTracked).toBe(2)
    expect(r.trainingAgeWeeks).toBe(2)
  })

  it('multiple sessions on the same date count individually toward the threshold', () => {
    // 3 sessions all on the same Monday → 3 sessions in that one ISO
    // week → counts as consistent.
    const log = makeSessionsOnDate(TODAY, 3)
    const r = analyzeTrainingAge({ log, today: TODAY })
    expect(r.trainingAgeWeeks).toBe(1)
  })

  it('ignores entries with bad dates but counts the rest', () => {
    const log = [
      { date: 'garbage', tss: 50 },
      { tss: 50 },
      ...makeSessionsOnDate(TODAY, 3),
    ]
    const r = analyzeTrainingAge({ log, today: TODAY })
    expect(r.trainingAgeWeeks).toBe(1)
  })

  it('respects an injected today (deterministic without setSystemTime)', () => {
    // 30 weeks of 3 sessions ending at TODAY → DEVELOPING.
    const log = makeWeeklyLog(Array(30).fill(3))
    const r = analyzeTrainingAge({ log, today: TODAY })
    expect(r.stage).toBe('DEVELOPING')
    expect(r.trainingAgeWeeks).toBe(30)
  })
})
