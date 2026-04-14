// ─── acwrProof.test.js — Mathematical proof tests for EWMA CTL/ATL model ─────
// Verifies trainingLoad.js against Hulin et al. 2016 / TrainingPeaks PMC spec.
//
// Constants confirmed from trainingLoad.js source (lines 5-8):
//   K_CTL    = 1 - Math.exp(-1 / 42)   // ≈ 0.02353  (τ=42d fitness)
//   K_ATL    = 1 - Math.exp(-1 / 7)    // ≈ 0.13307  (τ=7d  fatigue)
//   DECAY_CTL = 1 - K_CTL              // ≈ 0.97647
//   DECAY_ATL = 1 - K_ATL              // ≈ 0.86693
//
// Update formula (lines 45-46):
//   ctl = prevCTL * DECAY_CTL + tss * K_CTL   ← correct TrainingPeaks EWMA
//   atl = prevATL * DECAY_ATL + tss * K_ATL   ← correct
//
// Note: calculateACWR() uses different lambdas (λ_ACUTE=0.25, λ_CHRONIC=0.067)
// for a short 28-day ACWR window per Hulin et al.  The PMC CTL/ATL model
// (τ=42/7) lives in calculatePMC().  These proof tests use calculatePMC.
//
// trainingLoad.js does not export a standalone "array→CTL" helper, so these
// tests build date-keyed logs and call calculatePMC directly.

import { describe, it, expect } from 'vitest'
import { calculatePMC } from '../trainingLoad.js'

// ── Helper: build a log of `n` consecutive days at constant `tss` ─────────────
// Entries end `trailingRestDays` days before today (default 0 = ends today).
function makeLog(n, tss, trailingRestDays = 0) {
  const anchor = new Date()
  anchor.setHours(0, 0, 0, 0)
  const log = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(anchor)
    d.setDate(d.getDate() - trailingRestDays - i)
    log.push({ date: d.toISOString().slice(0, 10), tss })
  }
  return log
}

// ── Test 1 — Steady-state convergence at τ=42 ─────────────────────────────────
// At exactly one time-constant (42 days from CTL=0) with W=100 TSS/day:
//   CTL(42) = W × (1 − e^{−42/42}) = 100 × (1 − e^{−1}) ≈ 63.21
// This is the standard "63.2% of asymptote at t=τ" property of all EWMA/RC filters.
// Tolerance ±1.0.
describe('ACWR Proof Test 1 — Steady-state convergence at τ', () => {
  it('CTL after 42 days at 100 TSS/day from zero ≈ 63.2 (= 100 × (1 − e^{−1}))', () => {
    const log    = makeLog(42, 100)
    const series = calculatePMC(log, 42, 0)
    const last   = series[series.length - 1]

    const expected = 100 * (1 - Math.exp(-1))  // ≈ 63.21
    expect(last.ctl).toBeGreaterThan(expected - 1.0)
    expect(last.ctl).toBeLessThan(expected + 1.0)
  })
})

// ── Test 2 — CTL decay after complete rest ────────────────────────────────────
// Zero-TSS EWMA update: CTL(t) = CTL(t-1) × (1 − K_CTL) = CTL(t-1) × e^{−1/42}
// After d rest days from initial CTL₀:  CTL(d) = CTL₀ × e^{−d/42}
//
// Setup: run 600 build days at ~60 TSS so CTL is near its asymptote (≈60).
// Then add 14 zero-TSS days; CTL should decay to ≈ 60 × e^{−14/42} ≈ 42.99.
// Tolerance ±1.0.
describe('ACWR Proof Test 2 — CTL decay after rest', () => {
  it('CTL decays from ~60 to ~43 after 14 rest days (= 60 × e^{−14/42})', () => {
    const BUILD_DAYS = 600    // >> 6×τ so CTL ≈ asymptote (60)
    const REST_DAYS  = 14

    // Build-phase log ends 14 days ago; no entries for the last 14 days (→ TSS=0)
    const log    = makeLog(BUILD_DAYS, 60, REST_DAYS)
    // Ask for REST_DAYS+1 history so today is the last point
    const series = calculatePMC(log, REST_DAYS + 1, 0)
    const last   = series[series.length - 1]

    const expected = 60 * Math.exp(-14 / 42)  // ≈ 42.99
    expect(last.ctl).toBeGreaterThan(expected - 1.0)
    expect(last.ctl).toBeLessThan(expected + 1.0)
  })
})

// ── Test 3 — Steady-state ACWR (ATL/CTL) ≈ 1.0 ───────────────────────────────
// When both ATL and CTL have converged to the same constant-TSS asymptote,
// ATL → W and CTL → W, so ATL/CTL → 1.0.
// ATL converges 6× faster (τ=7 vs 42), so after a long steady period both
// values equal approximately W; ratio must be within 0.05 of 1.0.
// Using 400 build days at 100 TSS to ensure both channels fully saturated.
describe('ACWR Proof Test 3 — Steady-state ATL/CTL ratio ≈ 1.0', () => {
  it('ATL/CTL within 0.05 of 1.0 after 400 days at constant 100 TSS/day', () => {
    const log    = makeLog(400, 100)
    const series = calculatePMC(log, 1, 0)   // just need today's snapshot
    const last   = series[series.length - 1]

    // Both ATL and CTL should be very close to 100 (the asymptote),
    // so their ratio approaches 1.0.  calculatePMC rounds to 1dp.
    const ratio = last.atl / last.ctl
    expect(ratio).toBeGreaterThan(0.95)
    expect(ratio).toBeLessThan(1.05)
  })
})
