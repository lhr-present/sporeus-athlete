import { describe, it, expect } from 'vitest'
import {
  banisterDay, simulateBanister,
  runningTSS, powerTSS, swimTSS,
  scoreTrainingPlan, monteCarloOptimizer, peakFormWindow,
} from './simulation.js'

// ── banisterDay ───────────────────────────────────────────────────────────────
describe('banisterDay', () => {
  it('returns CTL/ATL/TSB object for valid inputs', () => {
    const r = banisterDay(50, 60, 100)
    expect(r).not.toBeNull()
    expect(typeof r.CTL).toBe('number')
    expect(typeof r.ATL).toBe('number')
    expect(typeof r.TSB).toBe('number')
  })

  it('TSB = CTL − ATL', () => {
    const r = banisterDay(50, 60, 100)
    expect(r.TSB).toBeCloseTo(r.CTL - r.ATL, 5)
  })

  it('high TSS day increases ATL more than CTL (tau2 < tau1)', () => {
    const r = banisterDay(50, 50, 200)
    expect(r.ATL).toBeGreaterThan(r.CTL)
  })

  it('rest day (TSS=0) decreases both ATL and CTL', () => {
    const r = banisterDay(60, 80, 0)
    expect(r.CTL).toBeLessThan(60)
    expect(r.ATL).toBeLessThan(80)
  })

  it('returns null for null inputs', () => {
    expect(banisterDay(null, 60, 100)).toBeNull()
    expect(banisterDay(50, null, 100)).toBeNull()
    expect(banisterDay(50, 60, null)).toBeNull()
  })

  it('honours custom tau1/tau2 parameters', () => {
    // With tau1=1 the new CTL should equal TSS entirely (1/1 = 1 weight)
    const r = banisterDay(50, 50, 100, 1, 1)
    expect(r.CTL).toBeCloseTo(100, 1)
    expect(r.ATL).toBeCloseTo(100, 1)
  })
})

// ── simulateBanister ──────────────────────────────────────────────────────────
describe('simulateBanister', () => {
  it('returns one entry per input day', () => {
    const tss  = [100, 80, 0, 120, 90, 0, 0]
    const result = simulateBanister(tss)
    expect(result).toHaveLength(7)
  })

  it('CTL increases with sustained load from zero baseline', () => {
    const tss = Array(42).fill(100)
    const result = simulateBanister(tss, 0, 0)
    expect(result[41].CTL).toBeGreaterThan(result[0].CTL)
  })

  it('null days treated as rest (TSS=0)', () => {
    const withNull  = simulateBanister([100, null, 100])
    const withZero  = simulateBanister([100, 0,    100])
    expect(withNull[2].CTL).toBeCloseTo(withZero[2].CTL, 5)
  })

  it('returns empty array for empty input', () => {
    expect(simulateBanister([])).toEqual([])
  })

  it('startCTL/startATL are used as initial state', () => {
    const result = simulateBanister([0], 80, 80)
    // After one rest day, CTL and ATL should both drop slightly
    expect(result[0].CTL).toBeLessThan(80)
    expect(result[0].ATL).toBeLessThan(80)
  })
})

// ── runningTSS ────────────────────────────────────────────────────────────────
describe('runningTSS', () => {
  it('returns 100 for 1h at threshold HR (IF=1.0)', () => {
    expect(runningTSS(3600, 160, 160)).toBe(100)
  })

  it('higher HR relative to threshold gives higher TSS', () => {
    const hard = runningTSS(3600, 175, 160)
    const easy = runningTSS(3600, 130, 160)
    expect(hard).toBeGreaterThan(100)
    expect(easy).toBeLessThan(100)
  })

  it('TSS scales with duration', () => {
    const t30 = runningTSS(1800, 160, 160)
    const t60 = runningTSS(3600, 160, 160)
    expect(t60).toBeCloseTo(t30 * 2, 0)
  })

  it('returns null for invalid inputs', () => {
    expect(runningTSS(null, 160, 160)).toBeNull()
    expect(runningTSS(3600, 0, 160)).toBeNull()
    expect(runningTSS(3600, 160, 0)).toBeNull()
  })
})

// ── powerTSS ──────────────────────────────────────────────────────────────────
describe('powerTSS', () => {
  it('returns 100 for 1h at FTP (IF=1.0)', () => {
    expect(powerTSS(3600, 250, 250)).toBe(100)
  })

  it('interval session above FTP gives TSS > 100/hr', () => {
    const hard = powerTSS(3600, 300, 250)
    expect(hard).toBeGreaterThan(100)
  })

  it('returns null for invalid inputs', () => {
    expect(powerTSS(null, 250, 250)).toBeNull()
    expect(powerTSS(3600, 0, 250)).toBeNull()
    expect(powerTSS(3600, 250, 0)).toBeNull()
  })
})

// ── swimTSS ───────────────────────────────────────────────────────────────────
describe('swimTSS (simulation)', () => {
  it('returns 100 for 60 min at CSS pace', () => {
    expect(swimTSS(60, 70, 70)).toBe(100)
  })

  it('returns null for invalid inputs', () => {
    expect(swimTSS(null, 70, 70)).toBeNull()
    expect(swimTSS(60, 0, 70)).toBeNull()
    expect(swimTSS(60, 70, 0)).toBeNull()
  })
})

// ── scoreTrainingPlan ─────────────────────────────────────────────────────────
describe('scoreTrainingPlan', () => {
  it('returns a number between 0 and 100', () => {
    const plan = [200, 250, 300, 180, 350, 400, 450, 200]
    const score = scoreTrainingPlan(plan)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('plan with taper gets higher score than plan without taper', () => {
    const withTaper    = [200, 250, 300, 350, 400, 250, 150, 100]  // last week low
    const withoutTaper = [200, 250, 300, 350, 400, 380, 390, 400]  // no taper
    expect(scoreTrainingPlan(withTaper)).toBeGreaterThan(scoreTrainingPlan(withoutTaper))
  })

  it('returns null for plans with fewer than 2 weeks', () => {
    expect(scoreTrainingPlan([300])).toBeNull()
    expect(scoreTrainingPlan(null)).toBeNull()
  })
})

// ── monteCarloOptimizer ───────────────────────────────────────────────────────
describe('monteCarloOptimizer', () => {
  it('returns bestPlan array of correct length', () => {
    const result = monteCarloOptimizer({ weeks: 8, minWeeklyTSS: 200, maxWeeklyTSS: 600 }, 100)
    expect(result).not.toBeNull()
    expect(result.bestPlan).toHaveLength(8)
  })

  it('bestScore is in 0–100 range', () => {
    const result = monteCarloOptimizer({ weeks: 6, minWeeklyTSS: 150, maxWeeklyTSS: 500 }, 50)
    expect(result.bestScore).toBeGreaterThanOrEqual(0)
    expect(result.bestScore).toBeLessThanOrEqual(100)
  })

  it('returns simulations count matching n parameter', () => {
    const result = monteCarloOptimizer({ weeks: 4, minWeeklyTSS: 100, maxWeeklyTSS: 400 }, 200)
    expect(result.simulations).toBe(200)
  })

  it('bestScore ≥ meanScore (by definition of "best")', () => {
    const result = monteCarloOptimizer({ weeks: 6, minWeeklyTSS: 100, maxWeeklyTSS: 500 }, 100)
    expect(result.bestScore).toBeGreaterThanOrEqual(result.meanScore)
  })

  it('recovery weeks get lower TSS than non-recovery weeks on average', () => {
    const result = monteCarloOptimizer({
      weeks: 4,
      minWeeklyTSS: 200,
      maxWeeklyTSS: 600,
      recoveryWeeks: [1],  // week index 1 is recovery
    }, 50)
    expect(result.bestPlan[1]).toBeLessThan(result.bestPlan[0])
  })

  it('returns null for invalid constraints', () => {
    expect(monteCarloOptimizer({ weeks: 0, minWeeklyTSS: 100, maxWeeklyTSS: 500 }, 10)).toBeNull()
    expect(monteCarloOptimizer({ weeks: 4, minWeeklyTSS: 500, maxWeeklyTSS: 100 }, 10)).toBeNull()
  })
})

// ── peakFormWindow ────────────────────────────────────────────────────────────
describe('peakFormWindow', () => {
  it('returns peakDay, peakTSB, and trace', () => {
    // Build-then-taper plan: heavy weeks then two light weeks
    const plan = [400, 450, 500, 150, 80]
    const r = peakFormWindow(plan)
    expect(r).not.toBeNull()
    expect(r.peakDay).toBeGreaterThan(0)
    expect(typeof r.peakTSB).toBe('number')
    expect(Array.isArray(r.trace)).toBe(true)
    expect(r.trace).toHaveLength(plan.length * 7)
  })

  it('peak form day falls in taper window (last 2 weeks of 6-week plan)', () => {
    const plan = [300, 350, 400, 450, 200, 100]
    const r = peakFormWindow(plan)
    // peak form should be in last 2 weeks = days 29–42
    expect(r.peakDay).toBeGreaterThan(28)
  })

  it('returns null for empty plan', () => {
    expect(peakFormWindow([])).toBeNull()
    expect(peakFormWindow(null)).toBeNull()
  })
})
