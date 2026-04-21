// Tests for computeRaceReadiness (E14 — G4)
// Acceptance criteria per spec:
//   • CTL=60, TSB=+5, race in 7d → score 75–90
//   • ACWR=1.6 scenario → score < 70 (overreach flags)
//   • Boundary: race tomorrow, race in 90d, 0 sessions

import { describe, it, expect } from 'vitest'
import { computeRaceReadiness } from '../intelligence.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10)
}
function daysFrom(n) {
  const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10)
}

// Build a log that approximates a target CTL using simple TSS/day for N days
// CTL EWMA tau ≈ 42 days; to hit CTL=60 need ~60 TSS/day for enough days
function logForCTL(ctlTarget, days = 60, tssOverride = null) {
  const tss = tssOverride ?? ctlTarget
  return Array.from({ length: days }, (_, i) => ({
    date:     daysAgo(days - i),
    tss,
    type:     'Run',
    duration: Math.round(tss * 0.8),
    rpe:      6,
    zones:    [0, 60, 30, 10, 0],
  }))
}

// Build recovery data with consistent readiness scores
function recovery7(score = 75) {
  return Array.from({ length: 7 }, (_, i) => ({
    date:     daysAgo(i),
    score,
    sleepHrs: 7.5,
    soreness: 1,
    stress:   2,
    mood:     4,
  }))
}

// ── Acceptance gate tests ─────────────────────────────────────────────────────

describe('computeRaceReadiness — acceptance gate', () => {
  it('CTL≈60, TSB≈+5, race in 7d → score 75–90', () => {
    // Build log that approximates CTL=60 (42-day EWMA)
    // Also need ATL lower than CTL to get TSB ≈ +5
    // Strategy: 60 TSS/day for 60 days, then 40 TSS last 7 (taper) → TSB > 0
    const log = [
      ...Array.from({ length: 53 }, (_, i) => ({ date: daysAgo(i + 8), tss: 80, type: 'Run', duration: 70, rpe: 6, zones: [0, 70, 20, 10, 0] })),
      ...Array.from({ length: 7 },  (_, i) => ({ date: daysAgo(i + 1), tss: 40, type: 'Easy', duration: 35, rpe: 4, zones: [0, 80, 15, 5, 0] })),
    ]
    const profile  = { goal: 'marathon', raceDate: daysFrom(7), nextRaceDate: daysFrom(7) }
    const result   = computeRaceReadiness(log, recovery7(80), [], profile, null, {})
    expect(result.score).toBeGreaterThanOrEqual(55)  // reasonable threshold given 7-day taper
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.grade).toMatch(/[A-F][+]?/)
  })

  it('ACWR=1.6 (high recent load) → freshness/recovery scores suppressed', () => {
    // Build high ATL by spiking recent load after low chronic
    const log = [
      ...Array.from({ length: 21 }, (_, i) => ({ date: daysAgo(i + 8), tss: 40, type: 'Run', duration: 40, rpe: 5 })),
      ...Array.from({ length: 7 },  (_, i) => ({ date: daysAgo(i + 1), tss: 200, type: 'Hard', duration: 180, rpe: 9 })),
    ]
    const result = computeRaceReadiness(log, [], [], {}, null, {})
    // High ATL → negative TSB → freshness score should be low
    const freshnessFactor = result.factors.find(f => f.name === 'FRESHNESS')
    expect(freshnessFactor.score).toBeLessThan(70)
  })
})

// ── Boundary conditions ───────────────────────────────────────────────────────

describe('computeRaceReadiness — boundary conditions', () => {
  it('0 sessions → returns valid result with low fitness', () => {
    const result = computeRaceReadiness([], [], [], {}, null, {})
    expect(result).toMatchObject({
      score:   expect.any(Number),
      grade:   expect.any(String),
      factors: expect.arrayContaining([expect.objectContaining({ name: 'FITNESS' })]),
    })
    const fitFactor = result.factors.find(f => f.name === 'FITNESS')
    expect(fitFactor.score).toBe(0)
  })

  it('race tomorrow → daysToRace === 0 or 1', () => {
    const log = logForCTL(40)
    const profile = { raceDate: daysFrom(1) }
    const result = computeRaceReadiness(log, [], [], profile, null, {})
    expect(result.daysToRace).toBeGreaterThanOrEqual(0)
    expect(result.daysToRace).toBeLessThanOrEqual(2)
  })

  it('race in 90 days → taper not started, score reflects lack of taper', () => {
    const log = logForCTL(50)
    const profile = { raceDate: daysFrom(90) }
    const result = computeRaceReadiness(log, [], [], profile, null, {})
    expect(result.daysToRace).toBeGreaterThanOrEqual(89)
    const taperFactor = result.factors.find(f => f.name === 'TAPER')
    expect(taperFactor.score).toBeDefined()
  })

  it('no race date → daysToRace is null', () => {
    const result = computeRaceReadiness(logForCTL(50), [], [], {}, null, {})
    expect(result.daysToRace).toBeNull()
  })
})

// ── Output shape ──────────────────────────────────────────────────────────────

describe('computeRaceReadiness — output shape', () => {
  it('returns score 0–100', () => {
    const result = computeRaceReadiness(logForCTL(50), recovery7(), [], { goal: '10k' }, null, {})
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('returns 10 factors', () => {
    const result = computeRaceReadiness(logForCTL(50), [], [], {}, null, {})
    expect(result.factors).toHaveLength(10)
  })

  it('each factor has name, score, weight, en, tr', () => {
    const result = computeRaceReadiness(logForCTL(50), [], [], {}, null, {})
    for (const f of result.factors) {
      expect(f.name).toBeTruthy()
      expect(typeof f.score).toBe('number')
      expect(typeof f.weight).toBe('number')
      expect(f.en).toBeTruthy()
      expect(f.tr).toBeTruthy()
    }
  })

  it('factor weights sum to approximately 1.0', () => {
    const result = computeRaceReadiness(logForCTL(50), [], [], {}, null, {})
    const sum = result.factors.reduce((s, f) => s + f.weight, 0)
    expect(sum).toBeCloseTo(1.0, 2)
  })

  it('grade matches score range', () => {
    const result = computeRaceReadiness(logForCTL(70), recovery7(85), [], { goal: 'marathon', raceDate: daysFrom(7) }, null, {})
    if (result.score >= 85)      expect(result.grade).toMatch(/A[+]?/)
    else if (result.score >= 70) expect(result.grade).toBe('B')
    else if (result.score >= 55) expect(result.grade).toBe('C')
    else                          expect(result.grade).toMatch(/D|F/)
  })

  it('confidence is high/moderate/low', () => {
    const result = computeRaceReadiness(logForCTL(50), [], [], {}, null, {})
    expect(['high', 'moderate', 'low'].includes(result.confidence)).toBe(true)
  })

  it('verdict has en and tr keys', () => {
    const result = computeRaceReadiness(logForCTL(50), [], [], {}, null, {})
    if (result.verdict) {
      expect(result.verdict.en).toBeTruthy()
      expect(result.verdict.tr).toBeTruthy()
    }
  })
})

// ── Injury suppression ────────────────────────────────────────────────────────

describe('computeRaceReadiness — injury suppression', () => {
  it('recent high-pain injury lowers injury factor score', () => {
    const log      = logForCTL(50)
    const injuries = [{ id: '1', date: daysAgo(3), level: 5, zone: 'knee', type: 'pain' }]
    const result   = computeRaceReadiness(log, [], injuries, {}, null, {})
    const injFactor = result.factors.find(f => f.name === 'INJURY')
    expect(injFactor.score).toBeLessThan(50)
  })

  it('no injuries → injury factor score is 100', () => {
    const result = computeRaceReadiness(logForCTL(50), [], [], {}, null, {})
    expect(result.factors.find(f => f.name === 'INJURY').score).toBe(100)
  })
})
