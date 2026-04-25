import { describe, it, expect } from 'vitest'
import { BLOCK_PHASES, generateBlockPlan } from '../sport/blockPeriodization.js'

describe('blockPeriodization', () => {
  it('BLOCK_PHASES has exactly 3 entries', () => {
    expect(BLOCK_PHASES).toHaveLength(3)
  })

  it('BLOCK_PHASES ids are accumulation, transmutation, realization in order', () => {
    expect(BLOCK_PHASES.map(p => p.id)).toEqual(['accumulation', 'transmutation', 'realization'])
  })

  it('generateBlockPlan returns array of length = totalWeeks', () => {
    const plan = generateBlockPlan({ weeklyHours: 8, totalWeeks: 10, baseTSS: 300 })
    expect(plan).toHaveLength(10)
  })

  it('every week object has { week, phase, phaseId, tssTarget, zoneEmphasis }', () => {
    const plan = generateBlockPlan({ weeklyHours: 8, totalWeeks: 10, baseTSS: 300 })
    for (const w of plan) {
      expect(w).toHaveProperty('week')
      expect(w).toHaveProperty('phase')
      expect(w).toHaveProperty('phaseId')
      expect(w).toHaveProperty('tssTarget')
      expect(w).toHaveProperty('zoneEmphasis')
    }
  })

  it('week 1 phaseId is accumulation', () => {
    const plan = generateBlockPlan({ weeklyHours: 8, totalWeeks: 10, baseTSS: 300 })
    expect(plan[0].phaseId).toBe('accumulation')
  })

  it('last week phaseId is realization', () => {
    const plan = generateBlockPlan({ weeklyHours: 8, totalWeeks: 10, baseTSS: 300 })
    expect(plan[plan.length - 1].phaseId).toBe('realization')
  })
})
