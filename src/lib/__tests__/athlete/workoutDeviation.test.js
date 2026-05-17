// ─── workoutDeviation.test.js — pure-fn tests for the 28d adherence helper ────
import { describe, it, expect } from 'vitest'
import {
  computeWorkoutDeviation,
  WORKOUT_DEVIATION_CITATION,
} from '../../athlete/workoutDeviation.js'

// Build a plan with a constant per-day TSS so the 28-day planned total is
// fully deterministic. `generatedAt` is far enough back that the entire
// 28-day window before `today` falls inside the plan.
function mkPlan({ generatedAt = '2026-04-01', perDayTss = 50, weekCount = 8 } = {}) {
  const sessions = Array.from({ length: 7 }, () => ({
    type: 'Easy',
    duration: 60,
    tss: perDayTss,
  }))
  const weeks = Array.from({ length: weekCount }, (_, i) => ({
    week: i + 1,
    phase: 'Base',
    sessions: sessions.map(s => ({ ...s })),
    tss: perDayTss * 7,
  }))
  return { generatedAt, weeks }
}

// Build a log with `tssPerDay` TSS on every day of the 28-day window ending
// on `today` (inclusive). 28 days × tssPerDay = total actual TSS.
function mkLog({ today = '2026-04-28', windowDays = 28, tssPerDay = 50 } = {}) {
  const endMs = Date.UTC(
    +today.slice(0, 4),
    +today.slice(5, 7) - 1,
    +today.slice(8, 10),
  )
  const log = []
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(endMs - (windowDays - 1 - i) * 86400000)
    const iso = d.toISOString().slice(0, 10)
    log.push({ date: iso, tss: tssPerDay, type: 'Easy' })
  }
  return log
}

const TODAY = '2026-04-28'

describe('computeWorkoutDeviation — null guards', () => {
  it('(a) returns null when log is empty', () => {
    const r = computeWorkoutDeviation({ log: [], plan: mkPlan(), today: TODAY })
    expect(r).toBeNull()
  })

  it('(a2) returns null when log is missing entirely', () => {
    const r = computeWorkoutDeviation({ plan: mkPlan(), today: TODAY })
    expect(r).toBeNull()
  })

  it('(b) returns null when no plan', () => {
    const r = computeWorkoutDeviation({
      log: mkLog({ today: TODAY }),
      plan: null,
      today: TODAY,
    })
    expect(r).toBeNull()
  })

  it('(b2) returns null when plan has no weeks', () => {
    const r = computeWorkoutDeviation({
      log: mkLog({ today: TODAY }),
      plan: { generatedAt: '2026-04-01', weeks: [] },
      today: TODAY,
    })
    expect(r).toBeNull()
  })

  it('(c) returns null when plannedTss === 0 (all sessions zero-TSS)', () => {
    const plan = mkPlan({ perDayTss: 0 })
    const r = computeWorkoutDeviation({
      log: mkLog({ today: TODAY, tssPerDay: 50 }),
      plan,
      today: TODAY,
    })
    expect(r).toBeNull()
  })

  it('returns null when log has entries but none in 28d window', () => {
    const log = [{ date: '2025-01-01', tss: 200 }]
    const r = computeWorkoutDeviation({ log, plan: mkPlan(), today: TODAY })
    expect(r).toBeNull()
  })
})

describe('computeWorkoutDeviation — bands', () => {
  it('(d) perfect 100% adherence → band=EXCELLENT', () => {
    const r = computeWorkoutDeviation({
      log: mkLog({ today: TODAY, tssPerDay: 50 }),
      plan: mkPlan({ perDayTss: 50 }),
      today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.adherencePct).toBe(100)
    expect(r.band).toBe('EXCELLENT')
    expect(r.actualTss).toBe(50 * 28)
    expect(r.plannedTss).toBe(50 * 28)
  })

  it('(e) ~80% → band=GOOD', () => {
    // planned=50/day × 28 = 1400 ; actual=40/day × 28 = 1120 → 80%
    const r = computeWorkoutDeviation({
      log: mkLog({ today: TODAY, tssPerDay: 40 }),
      plan: mkPlan({ perDayTss: 50 }),
      today: TODAY,
    })
    expect(r.adherencePct).toBe(80)
    expect(r.band).toBe('GOOD')
  })

  it('(f) ~65% → band=MODERATE', () => {
    // 65/100 → 65%
    const r = computeWorkoutDeviation({
      log: mkLog({ today: TODAY, tssPerDay: 65 }),
      plan: mkPlan({ perDayTss: 100 }),
      today: TODAY,
    })
    expect(r.adherencePct).toBe(65)
    expect(r.band).toBe('MODERATE')
  })

  it('(g) 50% → band=POOR', () => {
    const r = computeWorkoutDeviation({
      log: mkLog({ today: TODAY, tssPerDay: 50 }),
      plan: mkPlan({ perDayTss: 100 }),
      today: TODAY,
    })
    expect(r.adherencePct).toBe(50)
    expect(r.band).toBe('POOR')
  })

  it('(h) 120% → band=SURPLUS', () => {
    // 120/100 → 120%
    const r = computeWorkoutDeviation({
      log: mkLog({ today: TODAY, tssPerDay: 120 }),
      plan: mkPlan({ perDayTss: 100 }),
      today: TODAY,
    })
    expect(r.adherencePct).toBe(120)
    expect(r.band).toBe('SURPLUS')
  })
})

describe('computeWorkoutDeviation — band edges', () => {
  it('90% sits at EXCELLENT boundary', () => {
    const r = computeWorkoutDeviation({
      log: mkLog({ today: TODAY, tssPerDay: 90 }),
      plan: mkPlan({ perDayTss: 100 }),
      today: TODAY,
    })
    expect(r.adherencePct).toBe(90)
    expect(r.band).toBe('EXCELLENT')
  })

  it('75% sits at GOOD boundary (below EXCELLENT)', () => {
    const r = computeWorkoutDeviation({
      log: mkLog({ today: TODAY, tssPerDay: 75 }),
      plan: mkPlan({ perDayTss: 100 }),
      today: TODAY,
    })
    expect(r.adherencePct).toBe(75)
    expect(r.band).toBe('GOOD')
  })

  it('60% sits at MODERATE boundary (below GOOD)', () => {
    const r = computeWorkoutDeviation({
      log: mkLog({ today: TODAY, tssPerDay: 60 }),
      plan: mkPlan({ perDayTss: 100 }),
      today: TODAY,
    })
    expect(r.adherencePct).toBe(60)
    expect(r.band).toBe('MODERATE')
  })

  it('110% stays EXCELLENT; 111% crosses into SURPLUS', () => {
    const r110 = computeWorkoutDeviation({
      log: mkLog({ today: TODAY, tssPerDay: 110 }),
      plan: mkPlan({ perDayTss: 100 }),
      today: TODAY,
    })
    expect(r110.adherencePct).toBe(110)
    expect(r110.band).toBe('EXCELLENT')
    // For 111% use a setup where rounding lands above 110.
    // 1110 vs 1000 = 111%. Use 28 days * 1000/28 ~ 35.71 → easier: scale plan.
    const planLarge = (() => {
      const p = {
        generatedAt: '2026-04-01',
        weeks: Array.from({ length: 5 }, () => ({
          sessions: Array.from({ length: 7 }, () => ({ tss: 1000 / 28, duration: 60, type: 'Easy' })),
        })),
      }
      return p
    })()
    const logLarge = mkLog({ today: TODAY, tssPerDay: 1110 / 28 })
    const r111 = computeWorkoutDeviation({ log: logLarge, plan: planLarge, today: TODAY })
    expect(r111.adherencePct).toBe(111)
    expect(r111.band).toBe('SURPLUS')
  })
})

describe('computeWorkoutDeviation — shape + citation', () => {
  it('exposes the Foster/Hopkins citation', () => {
    expect(WORKOUT_DEVIATION_CITATION).toBe('Foster 2001; Hopkins 2002')
    const r = computeWorkoutDeviation({
      log: mkLog({ today: TODAY }),
      plan: mkPlan(),
      today: TODAY,
    })
    expect(r.citation).toBe('Foster 2001; Hopkins 2002')
  })

  it('reports daysCounted equal to the windowDays when plan covers full window', () => {
    const r = computeWorkoutDeviation({
      log: mkLog({ today: TODAY }),
      plan: mkPlan(),
      today: TODAY,
    })
    expect(r.daysCounted).toBe(28)
  })

  it('honours custom windowDays (14)', () => {
    const r = computeWorkoutDeviation({
      log: mkLog({ today: TODAY, windowDays: 14, tssPerDay: 50 }),
      plan: mkPlan({ perDayTss: 50 }),
      today: TODAY,
      windowDays: 14,
    })
    expect(r.daysCounted).toBe(14)
    expect(r.plannedTss).toBe(50 * 14)
    expect(r.actualTss).toBe(50 * 14)
    expect(r.adherencePct).toBe(100)
  })
})
