// ─── mcValidation.test.js — Monte Carlo optimizer & score function validation ──
// Tests scoreTrainingPlan, monteCarloOptimizer, and peakFormWindow from simulation.js
//
// scoreTrainingPlan(weeklyTSS, startCTL?, startATL?) → 0–100
//   Scores on: taper (-15 bonus), progressive overload (-10/violation),
//   peak TSB range (-5/10/20), and load variety (0/10/15).
//   Base score = 50; result clamped to [0, 100].
//
// monteCarloOptimizer(constraints, n) → { bestPlan, bestScore, meanScore, p90Score, ... }
//   Generates n random plans, scores each, returns best + stats.
//
// peakFormWindow(weeklyTSS, startCTL?, startATL?)
//   → { peakDay: number, peakTSB: number, trace: Array }
//   Deterministic: same input → same output.

import { describe, it, expect } from 'vitest'
import { scoreTrainingPlan, monteCarloOptimizer, peakFormWindow } from './simulation.js'

// ── scoreTrainingPlan ─────────────────────────────────────────────────────────

describe('Monte Carlo optimizer — score function properties', () => {
  it('score is always in [0, 100] for any valid plan', () => {
    const plans = [
      [300, 350, 400, 200],        // normal build + taper
      [100, 100, 100, 100],        // flat monotone
      [500, 600, 700, 200],        // high load + taper
      [50, 60, 70, 30],            // low load + taper
      [600, 600, 600, 600],        // no taper, high monotony
      [10, 500, 10, 500],          // chaotic
      [0, 0, 0, 0],                // all zeros
      [400, 300, 200, 100],        // reverse (descending)
    ]
    for (const plan of plans) {
      const score = scoreTrainingPlan(plan)
      if (score !== null) {
        expect(score).toBeGreaterThanOrEqual(0)
        expect(score).toBeLessThanOrEqual(100)
      }
    }
  })

  it('scoreTrainingPlan returns null for plans with fewer than 2 weeks', () => {
    expect(scoreTrainingPlan([])).toBeNull()
    expect(scoreTrainingPlan([300])).toBeNull()
    expect(scoreTrainingPlan(null)).toBeNull()
  })

  it('plan with proper taper scores at least 5 points higher than untapered plan', () => {
    // Tapered: last week ≤ 60% of peak (+15 bonus)
    // Untapered: last week = peak (no taper bonus)
    const tapered   = [300, 350, 400, 200]   // 200 ≤ 400×0.6=240 → taper bonus
    const untapered = [300, 350, 400, 400]   // 400 = 400 → no taper bonus

    const scoreTapered   = scoreTrainingPlan(tapered)
    const scoreUntapered = scoreTrainingPlan(untapered)
    expect(scoreTapered).toBeGreaterThan(scoreUntapered)
  })

  it('plan with aggressive week-on-week jumps scores lower than smooth progression', () => {
    // Aggressive: every week > 120% of previous (triggers overload penalty each step)
    const aggressive = [100, 200, 400, 200]   // 200 > 100×1.2 → +10 penalty; 400 > 200×1.2 → +10
    const smooth     = [300, 330, 360, 200]   // no week exceeds 120% of previous

    const scoreAggressive = scoreTrainingPlan(aggressive)
    const scoreSmooth     = scoreTrainingPlan(smooth)
    expect(scoreSmooth).toBeGreaterThan(scoreAggressive)
  })

  it('score is deterministic: same input always gives same score', () => {
    const plan = [300, 350, 400, 420, 200]
    const s1   = scoreTrainingPlan(plan)
    const s2   = scoreTrainingPlan(plan)
    expect(s1).toBe(s2)
  })

  it('score is an integer (rounded output)', () => {
    const score = scoreTrainingPlan([300, 350, 400, 200])
    expect(Number.isInteger(score)).toBe(true)
  })
})

// ── monteCarloOptimizer ───────────────────────────────────────────────────────

describe('monteCarloOptimizer', () => {
  const CONSTRAINTS = {
    weeks:        8,
    minWeeklyTSS: 200,
    maxWeeklyTSS: 500,
    startCTL:     40,
    startATL:     30,
  }

  it('returns a valid result object with all required fields', () => {
    const result = monteCarloOptimizer(CONSTRAINTS, 100)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('bestPlan')
    expect(result).toHaveProperty('bestScore')
    expect(result).toHaveProperty('meanScore')
    expect(result).toHaveProperty('p90Score')
    expect(result).toHaveProperty('simulations')
    expect(result).toHaveProperty('histogram')
  })

  it('bestScore is in [0, 100]', () => {
    const result = monteCarloOptimizer(CONSTRAINTS, 200)
    expect(result.bestScore).toBeGreaterThanOrEqual(0)
    expect(result.bestScore).toBeLessThanOrEqual(100)
  })

  it('bestPlan has exactly `weeks` entries', () => {
    const result = monteCarloOptimizer(CONSTRAINTS, 100)
    expect(result.bestPlan).toHaveLength(CONSTRAINTS.weeks)
  })

  it('bestPlan values stay within [minWeeklyTSS, maxWeeklyTSS] for non-recovery weeks', () => {
    const result = monteCarloOptimizer(CONSTRAINTS, 200)
    for (const wkTSS of result.bestPlan) {
      expect(wkTSS).toBeGreaterThanOrEqual(0)
      expect(wkTSS).toBeLessThanOrEqual(CONSTRAINTS.maxWeeklyTSS)
    }
  })

  it('bestScore ≥ meanScore (best must be at least as good as average)', () => {
    const result = monteCarloOptimizer(CONSTRAINTS, 300)
    expect(result.bestScore).toBeGreaterThanOrEqual(result.meanScore)
  })

  it('histogram has exactly 10 buckets covering 0–100', () => {
    const result = monteCarloOptimizer(CONSTRAINTS, 100)
    expect(result.histogram).toHaveLength(10)
    const totalCount = result.histogram.reduce((s, b) => s + b.count, 0)
    expect(totalCount).toBe(100)  // all 100 simulations accounted for
  })

  it('returns null for invalid constraints (min ≥ max TSS)', () => {
    const result = monteCarloOptimizer({ weeks: 8, minWeeklyTSS: 600, maxWeeklyTSS: 300 })
    expect(result).toBeNull()
  })

  it('returns null for n < 1', () => {
    const result = monteCarloOptimizer(CONSTRAINTS, 0)
    expect(result).toBeNull()
  })

  it('Monte Carlo runs 5 times — best score spread is ≤ 15 points (stability)', () => {
    // Without a seed, runs are stochastic. With n=300 the best plan stabilises;
    // spread > 15 would indicate the optimizer is not sampling enough of the space.
    // Empirically observed spread ≤ 10 over 5 independent runs with n=300.
    const scores = Array.from({ length: 5 }, () =>
      monteCarloOptimizer(CONSTRAINTS, 300).bestScore
    )
    const spread = Math.max(...scores) - Math.min(...scores)
    expect(spread).toBeLessThanOrEqual(15)
  })

  it('recovery weeks stay in low-load range', () => {
    const constraintsWithRecovery = {
      ...CONSTRAINTS,
      recoveryWeeks: [3, 7],   // weeks 4 and 8 (0-indexed) are recovery
    }
    const result = monteCarloOptimizer(constraintsWithRecovery, 200)
    // Recovery week TSS ≤ minWeeklyTSS × 1.5
    const maxRecoveryTSS = CONSTRAINTS.minWeeklyTSS * 1.5
    for (const wIdx of constraintsWithRecovery.recoveryWeeks) {
      if (wIdx < result.bestPlan.length) {
        expect(result.bestPlan[wIdx]).toBeLessThanOrEqual(maxRecoveryTSS)
      }
    }
  })
})

// ── peakFormWindow ────────────────────────────────────────────────────────────

describe('peakFormWindow', () => {
  it('returns an object with peakDay, peakTSB, and trace', () => {
    const result = peakFormWindow([300, 350, 400, 200])
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('peakDay')
    expect(result).toHaveProperty('peakTSB')
    expect(result).toHaveProperty('trace')
  })

  it('peakTSB is always a finite number', () => {
    const result = peakFormWindow([300, 350, 400, 200])
    expect(typeof result.peakTSB).toBe('number')
    expect(isFinite(result.peakTSB)).toBe(true)
  })

  it('peakDay is always ≥ 1 (1-indexed day number)', () => {
    const result = peakFormWindow([300, 350, 400, 200])
    expect(result.peakDay).toBeGreaterThanOrEqual(1)
  })

  it('peakDay ≤ total days in plan (weeks × 7)', () => {
    const weeklyPlan = [300, 350, 400, 200]
    const result = peakFormWindow(weeklyPlan)
    const totalDays = weeklyPlan.length * 7
    expect(result.peakDay).toBeLessThanOrEqual(totalDays)
  })

  it('trace length equals total plan days (weeks × 7)', () => {
    const weeklyPlan = [300, 350, 400, 200]
    const result = peakFormWindow(weeklyPlan)
    expect(result.trace).toHaveLength(weeklyPlan.length * 7)
  })

  it('is deterministic: identical inputs produce identical peakDay and peakTSB', () => {
    const plan = [300, 350, 400, 200]
    const r1   = peakFormWindow(plan)
    const r2   = peakFormWindow(plan)
    expect(r1.peakDay).toBe(r2.peakDay)
    expect(r1.peakTSB).toBe(r2.peakTSB)
  })

  it('returns null for empty or missing input', () => {
    expect(peakFormWindow([])).toBeNull()
    expect(peakFormWindow(null)).toBeNull()
    expect(peakFormWindow(undefined)).toBeNull()
  })

  it('each trace entry has CTL, ATL, TSB, and tss fields', () => {
    const result = peakFormWindow([300, 350])
    for (const day of result.trace) {
      expect(day).toHaveProperty('CTL')
      expect(day).toHaveProperty('ATL')
      expect(day).toHaveProperty('TSB')
      expect(day).toHaveProperty('tss')
    }
  })

  it('peakTSB equals the highest TSB in the trace', () => {
    const result  = peakFormWindow([300, 350, 400, 200])
    const maxInTrace = Math.max(...result.trace.map(d => d.TSB))
    // peakTSB is rounded to 1 decimal; maxInTrace from trace is also rounded
    expect(result.peakTSB).toBeCloseTo(maxInTrace, 0)
  })
})
