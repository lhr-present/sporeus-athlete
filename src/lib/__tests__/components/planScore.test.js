// ─── src/lib/__tests__/components/planScore.test.js — E48 tests ──────────────
import { describe, it, expect } from 'vitest'
import {
  extractWeeklyTSS,
  peakFormDate,
  computePlanScore,
} from '../../athlete/planScore.js'
import { scoreTrainingPlan } from '../../sport/simulation.js'

// ── extractWeeklyTSS ──────────────────────────────────────────────────────────

describe('extractWeeklyTSS', () => {
  it('returns null when plan is null', () => {
    expect(extractWeeklyTSS(null)).toBeNull()
  })

  it('returns null when plan has no weeks array', () => {
    expect(extractWeeklyTSS({ generatedAt: '2026-01-01' })).toBeNull()
  })

  it('returns null when fewer than 2 weeks', () => {
    expect(extractWeeklyTSS({ weeks: [{ tss: 200 }] })).toBeNull()
  })

  it('maps plan.weeks to tss values (lowercase)', () => {
    const plan = { weeks: [{ tss: 200 }, { tss: 250 }, { tss: 180 }] }
    expect(extractWeeklyTSS(plan)).toEqual([200, 250, 180])
  })

  it('uses TSS (uppercase) when lowercase tss missing', () => {
    const plan = { weeks: [{ TSS: 300 }, { TSS: 350 }] }
    expect(extractWeeklyTSS(plan)).toEqual([300, 350])
  })

  it('treats missing tss/TSS as 0', () => {
    const plan = { weeks: [{ tss: 200 }, {}, { tss: 150 }] }
    expect(extractWeeklyTSS(plan)).toEqual([200, 0, 150])
  })

  it('returns array of correct length', () => {
    const plan = { weeks: [{ tss: 100 }, { tss: 120 }, { tss: 90 }, { tss: 80 }] }
    const result = extractWeeklyTSS(plan)
    expect(result).toHaveLength(4)
  })

  it('parses string tss values to floats', () => {
    const plan = { weeks: [{ tss: '200.5' }, { tss: '300' }] }
    const result = extractWeeklyTSS(plan)
    expect(result[0]).toBe(200.5)
    expect(result[1]).toBe(300)
  })
})

// ── peakFormDate ──────────────────────────────────────────────────────────────

describe('peakFormDate', () => {
  it('returns null when plan is null', () => {
    expect(peakFormDate(null, 5)).toBeNull()
  })

  it('returns null when generatedAt is missing', () => {
    expect(peakFormDate({ weeks: [] }, 5)).toBeNull()
  })

  it('returns null when peakDay is null', () => {
    expect(peakFormDate({ generatedAt: '2026-01-01' }, null)).toBeNull()
  })

  it('returns null when peakDay is 0', () => {
    expect(peakFormDate({ generatedAt: '2026-01-01' }, 0)).toBeNull()
  })

  it('adds peakDay-1 days to generatedAt for day 1', () => {
    const result = peakFormDate({ generatedAt: '2026-01-01' }, 1)
    expect(result).toBe('2026-01-01')
  })

  it('adds peakDay-1 days to generatedAt for day 7', () => {
    const result = peakFormDate({ generatedAt: '2026-01-01' }, 7)
    expect(result).toBe('2026-01-07')
  })

  it('returns correct ISO date string format YYYY-MM-DD', () => {
    const result = peakFormDate({ generatedAt: '2026-03-01' }, 28)
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result).toBe('2026-03-28')
  })

  it('crosses month boundary correctly', () => {
    const result = peakFormDate({ generatedAt: '2026-01-28' }, 7)
    expect(result).toBe('2026-02-03')
  })
})

// ── computePlanScore ──────────────────────────────────────────────────────────

describe('computePlanScore', () => {
  const goodPlan = {
    generatedAt: '2026-01-01',
    weeks: [
      { tss: 200 }, { tss: 240 }, { tss: 280 }, { tss: 200 },
      { tss: 320 }, { tss: 360 }, { tss: 250 }, { tss: 120 },
    ],
  }
  const emptyLog = []

  it('returns null when plan is null', () => {
    expect(computePlanScore(null, emptyLog)).toBeNull()
  })

  it('returns null when plan has fewer than 2 weeks', () => {
    const shortPlan = { generatedAt: '2026-01-01', weeks: [{ tss: 200 }] }
    expect(computePlanScore(shortPlan, emptyLog)).toBeNull()
  })

  it('returns an object with score, peakDay, peakDate for valid plan', () => {
    const result = computePlanScore(goodPlan, emptyLog)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('score')
    expect(result).toHaveProperty('peakDay')
    expect(result).toHaveProperty('peakDate')
  })

  it('score is in range 0-100', () => {
    const result = computePlanScore(goodPlan, emptyLog)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('totalTSS equals sum of weeklyTSS', () => {
    const result = computePlanScore(goodPlan, emptyLog)
    const expected = goodPlan.weeks.reduce((s, w) => s + w.tss, 0)
    expect(result.totalTSS).toBe(expected)
  })

  it('weekCount matches plan.weeks.length', () => {
    const result = computePlanScore(goodPlan, emptyLog)
    expect(result.weekCount).toBe(goodPlan.weeks.length)
  })

  it('peakDate is a valid ISO date string when peakDay is set', () => {
    const result = computePlanScore(goodPlan, emptyLog)
    if (result.peakDate) {
      expect(result.peakDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('works with log provided (does not throw)', () => {
    const log = [
      { date: '2025-12-01', tss: 150 },
      { date: '2025-12-08', tss: 200 },
    ]
    expect(() => computePlanScore(goodPlan, log)).not.toThrow()
  })
})

// ── scoreTrainingPlan integration ─────────────────────────────────────────────

describe('scoreTrainingPlan integration', () => {
  it('good taper plan (build then taper) scores >= 50', () => {
    // 6-week build + 2-week taper with peak load
    const weeklyTSS = [200, 240, 280, 320, 360, 260, 160, 100]
    const score = scoreTrainingPlan(weeklyTSS, 40, 45)
    expect(score).toBeGreaterThanOrEqual(50)
  })

  it('returns null for fewer than 2 weeks', () => {
    expect(scoreTrainingPlan([200])).toBeNull()
    expect(scoreTrainingPlan(null)).toBeNull()
  })

  it('score is capped at 100', () => {
    const tss = [100, 200, 300, 350, 300, 250, 200, 80]
    const score = scoreTrainingPlan(tss, 0, 0)
    expect(score).toBeLessThanOrEqual(100)
  })
})
