import { describe, it, expect } from 'vitest'
import { addAdaptivePlanAdjustment } from '../sport/simulation.js'

describe('addAdaptivePlanAdjustment', () => {
  it('reduces remaining weeks by 10% after 2 weeks of under-performance (70%)', () => {
    const originalPlan = [100, 110, 120, 130, 140]
    // Weeks 0 and 1 performed at 70% (under 80% threshold)
    const actualTSS = [70, 77]
    const result = addAdaptivePlanAdjustment(originalPlan, actualTSS, 2)
    // Weeks 0 and 1 unchanged
    expect(result[0].tss).toBe(100)
    expect(result[1].tss).toBe(110)
    // Remaining weeks (2,3,4) reduced by 10%
    expect(result[2].tss).toBe(Math.round(120 * 0.90))
    expect(result[3].tss).toBe(Math.round(130 * 0.90))
    expect(result[4].tss).toBe(Math.round(140 * 0.90))
    expect(result[2]._adjusted).toBe(true)
    expect(result[2]._reason).toMatch(/under-performance/)
  })

  it('increases remaining weeks by ~8% after 2 weeks of over-performance (120%)', () => {
    const originalPlan = [100, 110, 120, 130, 140]
    // Weeks 0 and 1 performed at 120% (over 115% threshold)
    const actualTSS = [120, 133]
    const result = addAdaptivePlanAdjustment(originalPlan, actualTSS, 2)
    // Remaining weeks (2,3,4) increased by 8% (subject to cap)
    expect(result[2].tss).toBeGreaterThanOrEqual(Math.round(120 * 1.08) - 1)
    expect(result[2]._adjusted).toBe(true)
    expect(result[2]._reason).toMatch(/over-performance/)
  })

  it('caps increase so no week exceeds previous week * 1.3', () => {
    // Use a large jump to trigger the cap
    const originalPlan = [100, 100, 100, 1000]
    const actualTSS = [120, 120]
    const result = addAdaptivePlanAdjustment(originalPlan, actualTSS, 2)
    // Week 3 proposed = 1000 * 1.08 = 1080; prev week tss after adjustment matters
    // cap is prevTSS * 1.3 — just verify the cap logic holds
    for (let i = 1; i < result.length; i++) {
      const prev = result[i - 1].tss
      expect(result[i].tss).toBeLessThanOrEqual(Math.round(prev * 1.3) + 1)
    }
  })

  it('makes no adjustment when performance is within 80-115%', () => {
    const originalPlan = [100, 110, 120, 130]
    // Performed at 90% — within normal range
    const actualTSS = [90, 99]
    const result = addAdaptivePlanAdjustment(originalPlan, actualTSS, 2)
    expect(result[2]._adjusted).toBe(false)
    expect(result[3]._adjusted).toBe(false)
    expect(result[2].tss).toBe(120)
    expect(result[3].tss).toBe(130)
  })

  it('returns empty array for empty plan', () => {
    const result = addAdaptivePlanAdjustment([], [100, 110], 2)
    expect(result).toEqual([])
  })

  it('returns unchanged plan when fewer than 2 past weeks available', () => {
    const originalPlan = [100, 110, 120]
    // currentWeekIdx = 1 → only 1 past week, not enough to trigger adjustment
    const actualTSS = [70]
    const result = addAdaptivePlanAdjustment(originalPlan, actualTSS, 1)
    // Should return the plan without adjustments
    expect(result[1]._adjusted).toBe(false)
    expect(result[2]._adjusted).toBe(false)
  })
})
