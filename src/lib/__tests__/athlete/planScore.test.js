// ─── planScore.test.js — E48: 20 tests ───────────────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  extractWeeklyTSS,
  peakFormDate,
  computePlanScore,
} from '../../athlete/planScore.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makePlan(weeks) {
  return { generatedAt: '2026-04-01', weeks }
}

function makeWeeks(tssArr) {
  return tssArr.map(tss => ({ tss }))
}

const VALID_PLAN = makePlan(makeWeeks([200, 250, 300, 150]))  // 4 weeks with taper
const EMPTY_LOG  = []
const LOG_5      = Array.from({ length: 5 }, (_, i) => ({
  date: `2026-03-${String(20 + i).padStart(2, '0')}`,
  tss: 60,
  type: 'run',
}))

// ─── 1. extractWeeklyTSS ─────────────────────────────────────────────────────
describe('extractWeeklyTSS', () => {
  it('returns null for null plan', () => {
    expect(extractWeeklyTSS(null)).toBeNull()
  })

  it('returns null when weeks is not an array', () => {
    expect(extractWeeklyTSS({ weeks: null })).toBeNull()
    expect(extractWeeklyTSS({ weeks: 'bad' })).toBeNull()
  })

  it('returns null when fewer than 2 weeks', () => {
    expect(extractWeeklyTSS(makePlan([{ tss: 200 }]))).toBeNull()
    expect(extractWeeklyTSS(makePlan([]))).toBeNull()
  })

  it('returns array of numbers for valid plan', () => {
    const result = extractWeeklyTSS(VALID_PLAN)
    expect(Array.isArray(result)).toBe(true)
    expect(result.length).toBe(4)
    expect(result[0]).toBe(200)
    expect(result[2]).toBe(300)
  })

  it('handles uppercase TSS field', () => {
    const plan = makePlan([{ TSS: 180 }, { TSS: 220 }])
    const result = extractWeeklyTSS(plan)
    expect(result).toEqual([180, 220])
  })

  it('treats missing tss as 0', () => {
    const plan = makePlan([{ tss: 200 }, {}])
    const result = extractWeeklyTSS(plan)
    expect(result[1]).toBe(0)
  })
})

// ─── 2. peakFormDate ─────────────────────────────────────────────────────────
describe('peakFormDate', () => {
  it('returns null for null plan', () => {
    expect(peakFormDate(null, 7)).toBeNull()
  })

  it('returns null when peakDay is null or undefined', () => {
    expect(peakFormDate(VALID_PLAN, null)).toBeNull()
    expect(peakFormDate(VALID_PLAN, undefined)).toBeNull()
  })

  it('returns null when plan has no generatedAt', () => {
    expect(peakFormDate({ weeks: [] }, 7)).toBeNull()
  })

  it('computes correct date for peakDay = 1 (same as generatedAt)', () => {
    const result = peakFormDate({ generatedAt: '2026-04-01' }, 1)
    expect(result).toBe('2026-04-01')
  })

  it('computes correct date for peakDay = 7', () => {
    const result = peakFormDate({ generatedAt: '2026-04-01' }, 7)
    expect(result).toBe('2026-04-07')
  })

  it('works across month boundary', () => {
    const result = peakFormDate({ generatedAt: '2026-04-28' }, 5)
    expect(result).toBe('2026-05-02')
  })
})

// ─── 3. computePlanScore ─────────────────────────────────────────────────────
describe('computePlanScore', () => {
  it('returns null for null plan', () => {
    expect(computePlanScore(null, EMPTY_LOG)).toBeNull()
  })

  it('returns null when plan has fewer than 2 weeks', () => {
    expect(computePlanScore(makePlan([{ tss: 200 }]), EMPTY_LOG)).toBeNull()
  })

  it('returns result shape for a valid plan', () => {
    const result = computePlanScore(VALID_PLAN, EMPTY_LOG)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('score')
    expect(result).toHaveProperty('peakDay')
    expect(result).toHaveProperty('peakTSB')
    expect(result).toHaveProperty('weekCount', 4)
    expect(result).toHaveProperty('totalTSS', 900)
  })

  it('score is a number between 0 and 100', () => {
    const result = computePlanScore(VALID_PLAN, EMPTY_LOG)
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('totalTSS is sum of all week TSS values', () => {
    const result = computePlanScore(VALID_PLAN, EMPTY_LOG)
    expect(result.totalTSS).toBe(200 + 250 + 300 + 150)
  })

  it('works with a real log (non-empty)', () => {
    const result = computePlanScore(VALID_PLAN, LOG_5)
    expect(result).not.toBeNull()
    expect(result.score).toBeGreaterThanOrEqual(0)
  })

  it('peakDate is a valid ISO date string when peakDay is present', () => {
    const result = computePlanScore(VALID_PLAN, EMPTY_LOG)
    if (result.peakDay !== null) {
      expect(result.peakDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})
