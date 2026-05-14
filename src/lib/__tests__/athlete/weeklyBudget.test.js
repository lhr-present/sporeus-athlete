// v9.127.0 — Weekly TSS budget tests.

import { describe, it, expect } from 'vitest'
import { analyzeWeeklyBudget } from '../../athlete/weeklyBudget.js'

// 2026-05-11 is a Monday in real calendar; 2026-05-14 is Thursday.
const MONDAY    = '2026-05-11'
const THURSDAY  = '2026-05-14'
const SUNDAY    = '2026-05-17'

describe('analyzeWeeklyBudget — guards', () => {
  it('returns null when no target', () => {
    expect(analyzeWeeklyBudget({ weekTSS: 100, weekTSSTarget: 0, today: MONDAY })).toBeNull()
    expect(analyzeWeeklyBudget({ weekTSS: 100, weekTSSTarget: null, today: MONDAY })).toBeNull()
  })
  it('returns null for malformed today', () => {
    expect(analyzeWeeklyBudget({ weekTSS: 100, weekTSSTarget: 500, today: 'bad' })).toBeNull()
  })
  it('handles no args', () => {
    expect(analyzeWeeklyBudget()).toBeNull()
  })
})

describe('analyzeWeeklyBudget — status', () => {
  it('on-pace when spent matches expected within tolerance', () => {
    // Thursday end = 4/7 ≈ 57%. Spend 60% → +3% delta, on-pace
    const out = analyzeWeeklyBudget({ weekTSS: 300, weekTSSTarget: 500, today: THURSDAY })
    expect(out.spentPct).toBe(60)
    expect(out.expectedPct).toBe(57)
    expect(out.status).toBe('on-pace')
    expect(out.summary).toBeNull()
  })
  it('ahead when spent exceeds expected by >15pp', () => {
    // Monday end = 14%. Spend 50% → +36pp, ahead
    const out = analyzeWeeklyBudget({ weekTSS: 250, weekTSSTarget: 500, today: MONDAY })
    expect(out.status).toBe('ahead')
    expect(out.summary.en).toContain('Ahead of pace')
    expect(out.summary.tr).toContain('önündesin')
  })
  it('behind when spent below expected by >15pp', () => {
    // Sunday end = 100%. Spend 20% → -80pp, behind
    const out = analyzeWeeklyBudget({ weekTSS: 100, weekTSSTarget: 500, today: SUNDAY })
    expect(out.status).toBe('behind')
    expect(out.summary.en).toContain('Behind pace')
    expect(out.summary.tr).toContain('gerisindesin')
  })
})

describe('analyzeWeeklyBudget — paceDelta', () => {
  it('paceDelta = spentPct - expectedPct', () => {
    const out = analyzeWeeklyBudget({ weekTSS: 250, weekTSSTarget: 500, today: THURSDAY })
    expect(out.paceDelta).toBe(out.spentPct - out.expectedPct)
  })
})

describe('analyzeWeeklyBudget — day-of-week mapping', () => {
  it('Monday expected ≈ 14%', () => {
    const out = analyzeWeeklyBudget({ weekTSS: 0, weekTSSTarget: 500, today: MONDAY })
    expect(out.expectedPct).toBe(14)
  })
  it('Sunday expected = 100%', () => {
    const out = analyzeWeeklyBudget({ weekTSS: 0, weekTSSTarget: 500, today: SUNDAY })
    expect(out.expectedPct).toBe(100)
  })
})

describe('analyzeWeeklyBudget — output shape', () => {
  it('always returns target, spent, spentPct fields', () => {
    const out = analyzeWeeklyBudget({ weekTSS: 200, weekTSSTarget: 500, today: THURSDAY })
    expect(out.target).toBe(500)
    expect(out.spent).toBe(200)
    expect(out.spentPct).toBe(40)
  })
})
