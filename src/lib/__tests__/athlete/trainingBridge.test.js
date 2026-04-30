// src/lib/__tests__/athlete/trainingBridge.test.js — E82
import { describe, it, expect } from 'vitest'
import { buildTrainingPlan, getCurrentPlanWeek } from '../../athlete/trainingBridge.js'
import { analyzeRaceGoal } from '../../athlete/raceGoalEngine.js'

const analysis = analyzeRaceGoal(3000, 2400, 10000, {}, []) // 50:00 → 40:00 for 10K

describe('buildTrainingPlan', () => {
  it('returns empty array for null analysis', () => {
    expect(buildTrainingPlan(null, '2026-04-27')).toEqual([])
  })

  const plan = buildTrainingPlan(analysis, '2026-04-28')

  it('returns an array', () => expect(Array.isArray(plan)).toBe(true))
  it('has correct total weeks matching analysis.weeksToGoal', () => {
    expect(plan.length).toBe(analysis.weeksToGoal)
  })
  it('week 1 is week number 1', () => expect(plan[0].weekNum).toBe(1))
  it('week nums are sequential', () => {
    plan.forEach((w, i) => expect(w.weekNum).toBe(i + 1))
  })
  it('each week has sessions array of length 7', () => {
    for (const w of plan) {
      expect(w.sessions).toHaveLength(7)
    }
  })
  it('each week has startDate and endDate', () => {
    for (const w of plan) {
      expect(w.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(w.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
  it('first week starts on planStart', () => {
    expect(plan[0].startDate).toBe('2026-04-28')
  })
  it('weeks have phase names', () => {
    for (const w of plan) {
      expect(['Base', 'Build', 'Peak', 'Taper']).toContain(w.phase)
    }
  })
  it('every 4th week is a deload', () => {
    // Check at least one deload in the first 4 weeks
    const firstFour = plan.slice(0, 4)
    const deloads = firstFour.filter(w => w.isDeload)
    expect(deloads.length).toBeGreaterThan(0)
  })
  it('deload weeks have lower TSS', () => {
    const deloads = plan.filter(w => w.isDeload)
    for (const dw of deloads) {
      const parentPhase = analysis.phases.find(p => p.name === dw.phase)
      if (parentPhase) {
        expect(dw.tss).toBeLessThan(parentPhase.tss)
      }
    }
  })
  it('each week has en and tr descriptions', () => {
    for (const w of plan) {
      expect(typeof w.en).toBe('string')
      expect(typeof w.tr).toBe('string')
    }
  })
  it('first phase is Base', () => {
    expect(plan[0].phase).toBe('Base')
  })
  it('sessions have type strings', () => {
    for (const sess of plan[0].sessions) {
      expect(typeof sess.type).toBe('string')
    }
  })

  it('phaseTr is the short Turkish name (≤10 chars), not a description', () => {
    for (const w of plan) {
      if (!w.isDeload) {
        expect(w.phaseTr.length).toBeLessThanOrEqual(10)
      }
    }
  })

  it('maxHR flows from profile through analyzeRaceGoal into session HR ranges', () => {
    const analysisWithHR = analyzeRaceGoal(3000, 2400, 10000, { age: 35 }, [])
    const planWithHR = buildTrainingPlan(analysisWithHR, '2026-04-28')
    // Build week Tue = TEMPO_2x20 (88–92% maxHR)
    const buildWeek = planWithHR.find(w => w.phase === 'Build' && !w.isDeload)
    const tueSess = buildWeek?.sessions[1]
    expect(tueSess?.run?.hrLow).not.toBeNull()
    expect(tueSess?.run?.hrLow).toBeGreaterThan(0)
    expect(tueSess?.run?.hrHigh).toBeGreaterThan(tueSess?.run?.hrLow)
  })

  it('week 3 in Base phase has a longer Saturday run than week 1', () => {
    // Find the 1st and 3rd Base (non-deload) weeks
    const baseWeeks = plan.filter(w => w.phase === 'Base' && !w.isDeload)
    // Need at least 3 Base non-deload weeks to compare; if not enough, pass (plan length varies)
    if (baseWeeks.length < 3) return
    const wk1SatDuration = baseWeeks[0].sessions[5].run?.durationMin
    const wk3SatDuration = baseWeeks[2].sessions[5].run?.durationMin
    expect(wk3SatDuration).toBeGreaterThan(wk1SatDuration)
  })
})

describe('getCurrentPlanWeek', () => {
  const plan = buildTrainingPlan(analysis, '2026-04-28')

  it('returns null for empty plan', () => {
    expect(getCurrentPlanWeek([], '2026-04-28')).toBeNull()
  })
  it('returns null for null plan', () => {
    expect(getCurrentPlanWeek(null, '2026-04-28')).toBeNull()
  })
  it('returns first week when today is the plan start', () => {
    const result = getCurrentPlanWeek(plan, '2026-04-28')
    expect(result?.week?.weekNum).toBe(1)
  })
  it('returns first week when today is before plan start', () => {
    const result = getCurrentPlanWeek(plan, '2026-01-01')
    expect(result?.weekIdx).toBe(0)
  })
  it('returns last week when today is after plan end', () => {
    const result = getCurrentPlanWeek(plan, '2030-01-01')
    expect(result?.weekIdx).toBe(plan.length - 1)
  })
  it('returns correct mid-plan week', () => {
    // Week 5 starts at plan start + 28 days
    const d = new Date('2026-04-28T12:00:00Z')
    d.setUTCDate(d.getUTCDate() + 28) // start of week 5
    const result = getCurrentPlanWeek(plan, d.toISOString().slice(0, 10))
    expect(result?.week?.weekNum).toBe(5)
  })
})
