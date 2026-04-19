// src/lib/__tests__/science/decoupling.citation.test.js
// E12 — Citation-grounded tests for src/lib/decoupling.js
//
// All reference values are traceable to:
//   Friel J. (2009). The Cyclist's Training Bible, 4th ed. VeloPress.
//   Threshold: < 5% coupled; 5–10% mild; > 10% significant.
//
// Test data uses synthetic 1-Hz streams with known first/second half means
// so the expected decoupling% can be verified by hand.

import { describe, it, expect } from 'vitest'
import { computeDecoupling, classifyDecoupling, DECOUPLING_THRESHOLDS } from '../../decoupling.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a 1-Hz stream of `length` seconds.
 * firstHalf: constant value for first half; secondHalf: constant for rest.
 */
function buildStream(length, firstVal, secondVal) {
  const half = Math.floor(length / 2)
  return [
    ...Array(half).fill(firstVal),
    ...Array(length - half).fill(secondVal),
  ]
}

// 70-min effort after 10-min warmup → 60 min analysis window (default minDurationSec=3600)
const EFFORT_LEN = 70 * 60  // 4200 seconds total

// ── computeDecoupling — null guard ────────────────────────────────────────────

describe('computeDecoupling — invalid inputs (Friel 2009)', () => {
  it('returns valid=false when hr array is empty', () => {
    const r = computeDecoupling({ hr: [], power: [200] })
    expect(r.valid).toBe(false)
  })

  it('returns valid=false when no power and no speed', () => {
    const r = computeDecoupling({ hr: new Array(4200).fill(140) })
    expect(r.valid).toBe(false)
  })

  it('returns valid=false when effort is too short after warmup', () => {
    // 40-min effort, 10-min warmup → 30 min < minDurationSec 60 min default
    const len = 40 * 60
    const r = computeDecoupling({
      hr:    new Array(len).fill(140),
      power: new Array(len).fill(200),
    })
    expect(r.valid).toBe(false)
    expect(r.reason).toMatch(/too short/)
  })
})

// ── computeDecoupling — sport detection ──────────────────────────────────────

describe('computeDecoupling — sport detection (Friel 2009)', () => {
  it('detects cycling when power is provided', () => {
    const r = computeDecoupling({
      hr:    new Array(EFFORT_LEN).fill(140),
      power: new Array(EFFORT_LEN).fill(200),
    })
    expect(r.sport).toBe('cycling')
  })

  it('detects running when only speed is provided', () => {
    const r = computeDecoupling({
      hr:    new Array(EFFORT_LEN).fill(140),
      speed: new Array(EFFORT_LEN).fill(3.5),
    })
    expect(r.sport).toBe('running')
  })

  it('prefers power over speed when both provided', () => {
    const r = computeDecoupling({
      hr:    new Array(EFFORT_LEN).fill(140),
      power: new Array(EFFORT_LEN).fill(200),
      speed: new Array(EFFORT_LEN).fill(3.5),
    })
    expect(r.sport).toBe('cycling')
  })
})

// ── computeDecoupling — reference values (Friel 2009) ────────────────────────

describe('computeDecoupling — reference values (Friel 2009)', () => {
  // Reference scenario: first-half ratio = 200/140 ≈ 1.4286
  //                     second-half ratio = 200/140 ≈ 1.4286
  //                     decoupling% = (1.4286 − 1.4286) / 1.4286 × 100 = 0%
  it('returns 0% when HR is constant (perfectly coupled — Friel < 5%)', () => {
    const r = computeDecoupling({
      hr:    new Array(EFFORT_LEN).fill(140),
      power: new Array(EFFORT_LEN).fill(200),
    })
    expect(r.valid).toBe(true)
    expect(r.decouplingPct).toBeCloseTo(0, 1)
  })

  // Reference scenario: HR drifts from 140 → 146 bpm at the stream midpoint.
  // After 10-min warmup trim, the analysis window is 3600s and the midpoint
  // transition falls within the first analysis half, so firstHr ≈ 141 (weighted)
  // and secondHr = 146.
  // first-half ratio  = 200 / 141 ≈ 1.4184
  // second-half ratio = 200 / 146 ≈ 1.3699
  // decoupling% ≈ 3.4%  → 'coupled' (Friel < 5%)
  it('computes < 5% for HR drift 140→146 (coupled, Friel < 5%)', () => {
    const hr    = buildStream(EFFORT_LEN, 140, 146)
    const power = new Array(EFFORT_LEN).fill(200)
    const r = computeDecoupling({ hr, power })
    expect(r.valid).toBe(true)
    expect(r.decouplingPct).toBeGreaterThan(0)
    expect(r.decouplingPct).toBeLessThan(5)
  })

  // Reference scenario: HR drifts 140 → 150 bpm (significant drift)
  // first-half ratio  = 200 / 140 ≈ 1.4286
  // second-half ratio = 200 / 150 ≈ 1.3333
  // decoupling% ≈ (1.4286 − 1.3333) / 1.4286 × 100 ≈ 6.67%  → 'mild'
  it('computes ~6.67% for HR drift 140→150 (mild drift, Friel 5–10%)', () => {
    const hr    = buildStream(EFFORT_LEN, 140, 150)
    const power = new Array(EFFORT_LEN).fill(200)
    const r = computeDecoupling({ hr, power })
    expect(r.valid).toBe(true)
    expect(r.decouplingPct).toBeGreaterThan(5)
    expect(r.decouplingPct).toBeLessThan(10)
  })

  // Reference scenario: HR drifts 135 → 160 bpm (severe drift)
  // first-half ratio  = 200 / 135 ≈ 1.4815
  // second-half ratio = 200 / 160 = 1.2500
  // decoupling% ≈ (1.4815 − 1.2500) / 1.4815 × 100 ≈ 15.62%  → 'significant'
  it('computes ~15.6% for HR drift 135→160 (significant, Friel > 10%)', () => {
    const hr    = buildStream(EFFORT_LEN, 135, 160)
    const power = new Array(EFFORT_LEN).fill(200)
    const r = computeDecoupling({ hr, power })
    expect(r.valid).toBe(true)
    expect(r.decouplingPct).toBeGreaterThan(10)
  })

  // Running: speed/HR ratio
  it('computes running decoupling via speed÷HR ratio', () => {
    const hr    = buildStream(EFFORT_LEN, 140, 148)
    const speed = new Array(EFFORT_LEN).fill(3.5)
    const r = computeDecoupling({ hr, speed })
    expect(r.valid).toBe(true)
    expect(r.sport).toBe('running')
    expect(r.decouplingPct).toBeGreaterThan(0)
  })
})

// ── classifyDecoupling — Friel (2009) thresholds ─────────────────────────────

describe('classifyDecoupling — Friel (2009) thresholds', () => {
  it('classifies 0% as coupled', () => {
    expect(classifyDecoupling(0)).toBe('coupled')
  })

  it('classifies 4.9% as coupled (boundary, Friel < 5%)', () => {
    expect(classifyDecoupling(4.9)).toBe('coupled')
  })

  it('classifies 5.0% as mild (boundary, Friel 5–10%)', () => {
    expect(classifyDecoupling(5.0)).toBe('mild')
  })

  it('classifies 9.9% as mild', () => {
    expect(classifyDecoupling(9.9)).toBe('mild')
  })

  it('classifies 10.0% as significant (Friel > 10%)', () => {
    expect(classifyDecoupling(10.0)).toBe('significant')
  })

  it('classifies 25% as significant', () => {
    expect(classifyDecoupling(25)).toBe('significant')
  })
})

// ── DECOUPLING_THRESHOLDS constant ───────────────────────────────────────────

describe('DECOUPLING_THRESHOLDS — Friel (2009)', () => {
  it('exports coupled=5 and mild=10', () => {
    expect(DECOUPLING_THRESHOLDS.coupled).toBe(5)
    expect(DECOUPLING_THRESHOLDS.mild).toBe(10)
  })

  it('is frozen (immutable)', () => {
    expect(Object.isFrozen(DECOUPLING_THRESHOLDS)).toBe(true)
  })
})
