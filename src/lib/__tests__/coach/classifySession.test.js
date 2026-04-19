// src/lib/__tests__/coach/classifySession.test.js — E5
// 35 tests covering every tag, boundary conditions, plan context
import { describe, it, expect } from 'vitest'
import { classifySession, classifyMiss, aggregateWeekClassification } from '../../coach/classifySession.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const session = (overrides = {}) => ({
  date: '2026-04-19', type: 'Easy Run', duration: 60, rpe: 6, tss: 60,
  ...overrides,
})

const plan = (weeklyTSS = 500, startDate = '2026-04-14') => ({
  weeks: [{ startDate, weekLabel: 'Week 1', tssEst: weeklyTSS }]
})

// ─── Test sessions — formal test types ───────────────────────────────────────
describe('classifySession — test tag', () => {
  it('FTP Test → test', () => expect(classifySession(session({ type: 'FTP Test' })).tag).toBe('test'))
  it('VO2max Test → test', () => expect(classifySession(session({ type: 'VO2max Test' })).tag).toBe('test'))
  it('Ramp Test → test', () => expect(classifySession(session({ type: 'Ramp Test' })).tag).toBe('test'))
  it('CP Test → test', () => expect(classifySession(session({ type: 'CP Test' })).tag).toBe('test'))
  it('2000m Test → test', () => expect(classifySession(session({ type: '2000m Test' })).tag).toBe('test'))
  it('5K Time Trial → test', () => expect(classifySession(session({ type: '5K Time Trial' })).tag).toBe('test'))
  it('test takes priority even if duration short', () => {
    expect(classifySession(session({ type: 'FTP Test', duration: 10, rpe: 3 })).tag).toBe('test')
  })
})

// ─── Junk sessions ────────────────────────────────────────────────────────────
describe('classifySession — junk tag', () => {
  it('15min at RPE 3 → junk', () => expect(classifySession(session({ duration: 15, rpe: 3, tss: 10 })).tag).toBe('junk'))
  it('19min at RPE 1 → junk', () => expect(classifySession(session({ duration: 19, rpe: 1, tss: 5 })).tag).toBe('junk'))
  it('20min at RPE 3 NOT junk (at boundary)', () => expect(classifySession(session({ duration: 20, rpe: 3, tss: 15 })).tag).not.toBe('junk'))
  it('15min at RPE 5 NOT junk (RPE too high)', () => expect(classifySession(session({ duration: 15, rpe: 5, tss: 20 })).tag).not.toBe('junk'))
})

// ─── Recovery sessions ────────────────────────────────────────────────────────
describe('classifySession — recovery tag', () => {
  it('30min at RPE 3 → recovery', () => expect(classifySession(session({ duration: 30, rpe: 3, tss: 25 })).tag).toBe('recovery'))
  it('44min at RPE 4 → recovery', () => expect(classifySession(session({ duration: 44, rpe: 4, tss: 30 })).tag).toBe('recovery'))
  it('45min at RPE 4 NOT recovery (boundary — duration 45)', () => {
    expect(classifySession(session({ duration: 45, rpe: 4, tss: 40 })).tag).not.toBe('recovery')
  })
  it('30min at RPE 5 NOT recovery (RPE > 4)', () => {
    expect(classifySession(session({ duration: 30, rpe: 5, tss: 40 })).tag).not.toBe('recovery')
  })
})

// ─── Plan-matched sessions ────────────────────────────────────────────────────
describe('classifySession — planned_match tag', () => {
  it('TSS at 100% of session target → planned_match', () => {
    // Plan: 500 TSS/week → 100 TSS/session
    const result = classifySession(session({ tss: 100 }), plan(500))
    expect(result.tag).toBe('planned_match')
  })

  it('TSS at 120% of session target → planned_match (within ±40%)', () => {
    const result = classifySession(session({ tss: 120 }), plan(500))
    expect(result.tag).toBe('planned_match')
  })

  it('TSS at 80% of session target → planned_match (lower boundary)', () => {
    const result = classifySession(session({ tss: 80 }), plan(500))
    expect(result.tag).toBe('planned_match')
  })
})

// ─── Unplanned high ───────────────────────────────────────────────────────────
describe('classifySession — unplanned_high tag', () => {
  it('TSS > 140% of session target → unplanned_high', () => {
    // Plan 500/week → 100/session; 150 = 150% = above 140%
    const result = classifySession(session({ tss: 150 }), plan(500))
    expect(result.tag).toBe('unplanned_high')
  })

  it('no plan + TSS >= 150 → unplanned_high', () => {
    expect(classifySession(session({ tss: 150 })).tag).toBe('unplanned_high')
  })

  it('no plan + 120min at RPE 7 → unplanned_high', () => {
    expect(classifySession(session({ duration: 120, rpe: 7, tss: 130 })).tag).toBe('unplanned_high')
  })
})

// ─── Unplanned low ────────────────────────────────────────────────────────────
describe('classifySession — unplanned_low tag', () => {
  it('TSS < 60% of session target → unplanned_low', () => {
    // Plan 500/week → 100/session; 55 = 55% = below 60%
    const result = classifySession(session({ tss: 55 }), plan(500))
    expect(result.tag).toBe('unplanned_low')
  })
})

// ─── Planned miss ─────────────────────────────────────────────────────────────
describe('classifyMiss', () => {
  it('returns planned_miss tag with reason', () => {
    const result = classifyMiss({ weekLabel: 'Week 3', targetTSS: 450 })
    expect(result.tag).toBe('planned_miss')
    expect(result.reason).toContain('Week 3')
    expect(result.reason).toContain('450')
  })
})

// ─── Aggregate classification ─────────────────────────────────────────────────
describe('aggregateWeekClassification', () => {
  it('counts each tag correctly', () => {
    const sessions = [
      { tag: 'planned_match' }, { tag: 'planned_match' }, { tag: 'planned_miss' },
      { tag: 'recovery' }, { tag: 'unplanned_high' },
    ]
    const agg = aggregateWeekClassification(sessions)
    expect(agg.planned_match).toBe(2)
    expect(agg.planned_miss).toBe(1)
    expect(agg.recovery).toBe(1)
    expect(agg.unplanned_high).toBe(1)
  })

  it('compliance = planned_match / (match + miss + low)', () => {
    const sessions = [
      { tag: 'planned_match' }, { tag: 'planned_match' }, { tag: 'planned_miss' },
    ]
    const agg = aggregateWeekClassification(sessions)
    // 2 / (2 + 1 + 0) = 67%
    expect(agg.compliance).toBe(67)
  })

  it('compliance null when no plan sessions', () => {
    const sessions = [{ tag: 'recovery' }, { tag: 'moderate' }]
    const agg = aggregateWeekClassification(sessions)
    expect(agg.compliance).toBeNull()
  })

  it('handles empty sessions gracefully', () => {
    const agg = aggregateWeekClassification([])
    expect(agg.planned_match).toBe(0)
    expect(agg.compliance).toBeNull()
  })

  it('handles null input', () => {
    expect(() => aggregateWeekClassification(null)).not.toThrow()
  })
})

// ─── Guard cases ──────────────────────────────────────────────────────────────
describe('classifySession — guard cases', () => {
  it('null session → moderate (no crash)', () => {
    expect(classifySession(null).tag).toBe('moderate')
  })

  it('session outside plan date range → no plan context applied', () => {
    // Plan starts 2026-04-14; session is 2026-01-01 — outside window
    const result = classifySession(session({ date: '2026-01-01', tss: 55 }), plan(500))
    expect(result.tag).not.toBe('unplanned_low')
  })

  it('plan with empty weeks array → falls through to load-based rules', () => {
    const emptyPlan = { weeks: [] }
    const result = classifySession(session({ tss: 150 }), emptyPlan)
    expect(result.tag).toBe('unplanned_high')
  })
})
