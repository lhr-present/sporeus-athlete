// ─── planAdherence.test.js — E32: 12 tests ────────────────────────────────────
import { describe, it, expect } from 'vitest'
import { computePlanAdherence, computeAdherenceSummary } from '../../athlete/planAdherence.js'

// ─── Synthetic data builders ───────────────────────────────────────────────────
// Plan starts on 2026-01-05 (Monday), 4 weeks
function makePlan(numWeeks = 4, startDate = '2026-01-05') {
  const weeks = Array.from({ length: numWeeks }, (_, i) => ({
    week: i + 1,
    phase: 'Base',
    tss: 300,
    sessions: [],
    totalHours: '8.0',
    zonePct: [40, 40, 15, 5, 0],
  }))
  return { goal: 'test', generatedAt: startDate, weeks, level: 'intermediate', hoursPerWeek: 8 }
}

// Log entries: one entry per week for the given dates with tss value
function makeLog(entries) {
  return entries.map(([date, tss]) => ({ date, tss, type: 'run', duration: 60 }))
}

const TODAY = '2026-02-02'  // 4 weeks after 2026-01-05

// ─── computePlanAdherence ──────────────────────────────────────────────────────
describe('computePlanAdherence', () => {
  it('returns [] when plan is null', () => {
    expect(computePlanAdherence(null, {}, [], 8, TODAY)).toEqual([])
  })

  it('returns [] when plan has no weeks array', () => {
    expect(computePlanAdherence({ generatedAt: '2026-01-05' }, {}, [], 8, TODAY)).toEqual([])
  })

  it('returns [] when plan.weeks is empty', () => {
    expect(computePlanAdherence({ generatedAt: '2026-01-05', weeks: [] }, {}, [], 8, TODAY)).toEqual([])
  })

  it('returns correct weekStart dates for each plan week', () => {
    const plan = makePlan(4)
    const result = computePlanAdherence(plan, {}, [], 4, TODAY)
    expect(result).toHaveLength(4)
    expect(result[0].weekStart).toBe('2026-01-05')
    expect(result[1].weekStart).toBe('2026-01-12')
    expect(result[2].weekStart).toBe('2026-01-19')
    expect(result[3].weekStart).toBe('2026-01-26')
  })

  it('compliance is 0 when plan has weeks but log is empty', () => {
    const plan = makePlan(2)
    const result = computePlanAdherence(plan, {}, [], 8, TODAY)
    result.forEach(w => {
      expect(w.actualTSS).toBe(0)
      expect(w.compliance).toBe(0)
      expect(w.status).toBe('under')
    })
  })

  it('computes correct compliance when log matches planned TSS exactly', () => {
    const plan = makePlan(1)
    // One log entry on week-1 start date with exactly 300 TSS
    const log  = makeLog([['2026-01-05', 300]])
    const result = computePlanAdherence(plan, {}, log, 8, '2026-01-12')
    expect(result[0].compliance).toBe(100)
    expect(result[0].status).toBe('on_track')
    expect(result[0].actualTSS).toBe(300)
    expect(result[0].plannedTSS).toBe(300)
  })

  it('status is on_track when compliance is 95%', () => {
    const plan = makePlan(1)
    // 285 / 300 = 95%
    const log  = makeLog([['2026-01-07', 285]])
    const result = computePlanAdherence(plan, {}, log, 8, '2026-01-12')
    expect(result[0].compliance).toBe(95)
    expect(result[0].status).toBe('on_track')
  })

  it('status is under when compliance is 70%', () => {
    const plan = makePlan(1)
    // 210 / 300 = 70%
    const log  = makeLog([['2026-01-06', 210]])
    const result = computePlanAdherence(plan, {}, log, 8, '2026-01-12')
    expect(result[0].compliance).toBe(70)
    expect(result[0].status).toBe('under')
  })

  it('status is over when compliance is 120%', () => {
    const plan = makePlan(1)
    // 360 / 300 = 120%
    const log  = makeLog([['2026-01-08', 360]])
    const result = computePlanAdherence(plan, {}, log, 8, '2026-01-12')
    expect(result[0].compliance).toBe(120)
    expect(result[0].status).toBe('over')
  })

  it('compliance is clamped at 150 when actual far exceeds planned', () => {
    const plan = makePlan(1)
    // 1200 / 300 = 400% → clamped to 150
    const log  = makeLog([['2026-01-05', 1200]])
    const result = computePlanAdherence(plan, {}, log, 8, '2026-01-12')
    expect(result[0].compliance).toBe(150)
  })

  it('compliance is null and status is unknown when plannedTSS is 0', () => {
    const plan = {
      generatedAt: '2026-01-05',
      weeks: [{ week: 1, tss: 0, sessions: [] }],
    }
    const result = computePlanAdherence(plan, {}, [], 8, '2026-01-12')
    expect(result[0].compliance).toBeNull()
    expect(result[0].status).toBe('unknown')
  })

  it('only returns weeks that have started on or before today', () => {
    const plan = makePlan(4)  // 4 weeks starting 2026-01-05
    // today is end of week 2 only (2026-01-19 = start of week 3)
    const result = computePlanAdherence(plan, {}, [], 8, '2026-01-18')
    expect(result).toHaveLength(2)
    expect(result[0].weekStart).toBe('2026-01-05')
    expect(result[1].weekStart).toBe('2026-01-12')
  })

  it('respects the `weeks` limit and returns oldest→newest', () => {
    const plan = makePlan(4)
    const result = computePlanAdherence(plan, {}, [], 2, TODAY)
    expect(result).toHaveLength(2)
    // should be the last 2 weeks
    expect(result[0].weekStart).toBe('2026-01-19')
    expect(result[1].weekStart).toBe('2026-01-26')
  })
})

// ─── computeAdherenceSummary ───────────────────────────────────────────────────
describe('computeAdherenceSummary', () => {
  it('returns null when plan is null', () => {
    expect(computeAdherenceSummary(null, {}, [], 8, TODAY)).toBeNull()
  })

  it('returns null when plan.weeks is empty', () => {
    const plan = { generatedAt: '2026-01-05', weeks: [] }
    expect(computeAdherenceSummary(plan, {}, [], 8, TODAY)).toBeNull()
  })

  it('returns correct avgCompliance for fully-logged weeks', () => {
    const plan = makePlan(2)
    // Week 1: 300 TSS = 100%, Week 2: 150 TSS = 50%
    const log  = makeLog([['2026-01-05', 300], ['2026-01-12', 150]])
    const result = computeAdherenceSummary(plan, {}, log, 8, '2026-01-19')
    expect(result.avgCompliance).toBe(75) // (100 + 50) / 2
  })

  it('overallStatus is on_track when avgCompliance is 80–115%', () => {
    const plan = makePlan(1)
    const log  = makeLog([['2026-01-05', 285]])   // 95%
    const result = computeAdherenceSummary(plan, {}, log, 8, '2026-01-12')
    expect(result.overallStatus).toBe('on_track')
  })

  it('overallStatus is over when avgCompliance > 115%', () => {
    const plan = makePlan(1)
    const log  = makeLog([['2026-01-05', 360]])   // 120%
    const result = computeAdherenceSummary(plan, {}, log, 8, '2026-01-12')
    expect(result.overallStatus).toBe('over')
  })

  it('overallStatus is under when avgCompliance < 80%', () => {
    const plan = makePlan(1)
    const log  = makeLog([['2026-01-05', 210]])   // 70%
    const result = computeAdherenceSummary(plan, {}, log, 8, '2026-01-12')
    expect(result.overallStatus).toBe('under')
  })

  it('counts weeksOnTrack, weeksOver, weeksUnder correctly', () => {
    const plan = makePlan(3)
    // Week 1: 300 = 100% on_track, Week 2: 390 = 130% over, Week 3: 150 = 50% under
    const log = makeLog([
      ['2026-01-05', 300],
      ['2026-01-12', 390],
      ['2026-01-19', 150],
    ])
    const result = computeAdherenceSummary(plan, {}, log, 8, '2026-01-26')
    expect(result.weeksOnTrack).toBe(1)
    expect(result.weeksOver).toBe(1)
    expect(result.weeksUnder).toBe(1)
    expect(result.adherenceWeeks).toHaveLength(3)
  })
})
