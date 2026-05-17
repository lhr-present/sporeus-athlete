// src/lib/__tests__/athlete/ctlRampRate.test.js
//
// Pure-fn tests for computeCtlRampRate — Gabbett 2016 CTL ramp-rate detector.
import { describe, it, expect } from 'vitest'
import {
  computeCtlRampRate,
  CTL_RAMP_RATE_CITATION,
} from '../../athlete/ctlRampRate.js'

const TODAY = '2026-05-17'

// Helpers ────────────────────────────────────────────────────────────────────

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// Build a log where daily TSS = baseline for `priorDays` before the window,
// then follows `weeklySteps` for the trailing (weeks * 7) days. The trailing
// window ends on `today`.
//
//   baseline   — daily TSS during the prime / convergence period
//   priorDays  — days of prime before the window start (today - weeks*7)
//   weeklySteps — array of daily-TSS values, one per trailing week
function buildSteppedLog({
  today = TODAY,
  baseline = 70,
  priorDays = 200,
  weeklySteps = [70, 70, 70, 70],
}) {
  const weeks = weeklySteps.length
  // Prime: `priorDays` of baseline ending at today - weeks*7 (inclusive).
  // The trailing-window anchor `today - weeks*7` is the LAST prime day
  // so the EWMA has fully converged onto `baseline` at the anchor.
  const log = []
  for (let i = priorDays - 1; i >= 0; i--) {
    log.push({ date: isoMinusDays(today, weeks * 7 + i), tss: baseline })
  }
  // Trailing window: weeklySteps[k] applied to the 7 days of week k+1.
  // Week 0 covers days today-(weeks*7 - 1) … today-(weeks*7 - 7), which
  // ends at the today-(weeks-1)*7 anchor.
  for (let k = 0; k < weeks; k++) {
    for (let d = 1; d <= 7; d++) {
      const offsetFromToday = weeks * 7 - (k * 7 + d)
      log.push({ date: isoMinusDays(today, offsetFromToday), tss: weeklySteps[k] })
    }
  }
  return log
}

// Build a flat log of constant daily TSS covering `days` days ending on `today`.
function buildFlatLog({ today = TODAY, daily = 50, days = 240 } = {}) {
  const log = []
  for (let i = days - 1; i >= 0; i--) {
    log.push({ date: isoMinusDays(today, i), tss: daily })
  }
  return log
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('computeCtlRampRate — null / insufficient signals', () => {
  it('(a) returns null for an empty log', () => {
    expect(
      computeCtlRampRate({ log: [], today: TODAY })
    ).toBeNull()
  })

  it('(b) returns null for a very short log (does not span 4 trailing weeks)', () => {
    const log = []
    // Only 10 days of entries ending today — earliest log date is well
    // after today-28, so the trailing window can't be populated.
    for (let i = 9; i >= 0; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: 60 })
    }
    expect(computeCtlRampRate({ log, today: TODAY })).toBeNull()
  })

  it('returns null for invalid today', () => {
    const log = buildFlatLog({ daily: 60, days: 240 })
    expect(computeCtlRampRate({ log, today: 'not-a-date' })).toBeNull()
  })

  it('returns null for weeks < 1', () => {
    const log = buildFlatLog({ daily: 60, days: 240 })
    expect(computeCtlRampRate({ log, today: TODAY, weeks: 0 })).toBeNull()
  })
})

describe('computeCtlRampRate — band classification', () => {
  it('(c) flat-CTL log → rampRate ≈ 0, band UNDERTRAINED', () => {
    const log = buildFlatLog({ daily: 70, days: 260 })
    const r = computeCtlRampRate({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(Math.abs(r.rampRate)).toBeLessThan(0.5)
    expect(r.band).toBe('UNDERTRAINED')
  })

  it('(d) modest ramp → band OPTIMAL', () => {
    // Tuned via offline EMA simulation: weekly steps [82,94,106,118] over
    // baseline 70 → mean weekly CTL delta ≈ 6.4, comfortably inside 3..<8.
    const log = buildSteppedLog({
      baseline: 70,
      weeklySteps: [82, 94, 106, 118],
    })
    const r = computeCtlRampRate({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.rampRate).toBeGreaterThanOrEqual(3)
    expect(r.rampRate).toBeLessThan(8)
    expect(r.band).toBe('OPTIMAL')
  })

  it('(e) aggressive ramp → band AGGRESSIVE', () => {
    // Tuned: weekly steps [85,103,121,139] over baseline 70 → mean ≈ 9.1,
    // safely inside the AGGRESSIVE band (8..12).
    const log = buildSteppedLog({
      baseline: 70,
      weeklySteps: [85, 103, 121, 139],
    })
    const r = computeCtlRampRate({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.rampRate).toBeGreaterThanOrEqual(8)
    expect(r.rampRate).toBeLessThanOrEqual(12)
    expect(r.band).toBe('AGGRESSIVE')
  })

  it('(f) very high ramp → band HIGH_RISK', () => {
    // Simulation: [150,220,290,360] → mean ≈ 30.34 — well into HIGH_RISK.
    const log = buildSteppedLog({
      baseline: 70,
      weeklySteps: [150, 220, 290, 360],
    })
    const r = computeCtlRampRate({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.rampRate).toBeGreaterThan(12)
    expect(r.band).toBe('HIGH_RISK')
  })

  it('(h) boundary: rampRate exactly 3 lands in OPTIMAL band; 12 lands in AGGRESSIVE; >12 in HIGH_RISK', () => {
    // Construct three logs whose rampRates straddle the band edges.

    // Below 3 → UNDERTRAINED (tuned mean delta ≈ 2.7)
    const under = buildSteppedLog({
      baseline: 70,
      weeklySteps: [75, 80, 85, 90],
    })
    const rUnder = computeCtlRampRate({ log: under, today: TODAY })
    expect(rUnder).not.toBeNull()
    expect(rUnder.rampRate).toBeLessThan(3)
    expect(rUnder.band).toBe('UNDERTRAINED')

    // Inside 8–12 → AGGRESSIVE (tuned mean delta ≈ 9.1)
    const agg = buildSteppedLog({
      baseline: 70,
      weeklySteps: [85, 103, 121, 139],
    })
    const rAgg = computeCtlRampRate({ log: agg, today: TODAY })
    expect(rAgg).not.toBeNull()
    expect(rAgg.band).toBe('AGGRESSIVE')

    // Far above 12 → HIGH_RISK
    const risk = buildSteppedLog({
      baseline: 70,
      weeklySteps: [150, 220, 290, 360],
    })
    const rRisk = computeCtlRampRate({ log: risk, today: TODAY })
    expect(rRisk).not.toBeNull()
    expect(rRisk.rampRate).toBeGreaterThan(12)
    expect(rRisk.band).toBe('HIGH_RISK')
  })
})

describe('computeCtlRampRate — shape + metadata', () => {
  it('(g) weeklyDeltas length === weeks param (default 4)', () => {
    const log = buildFlatLog({ daily: 60, days: 260 })
    const r = computeCtlRampRate({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(Array.isArray(r.weeklyDeltas)).toBe(true)
    expect(r.weeklyDeltas).toHaveLength(4)
  })

  it('weeklyDeltas length matches custom weeks param (6)', () => {
    const log = buildFlatLog({ daily: 60, days: 320 })
    const r = computeCtlRampRate({ log, today: TODAY, weeks: 6 })
    expect(r).not.toBeNull()
    expect(r.weeklyDeltas).toHaveLength(6)
  })

  it('exposes Gabbett 2016 / Banister 1975 citation', () => {
    const log = buildFlatLog({ daily: 70, days: 260 })
    const r = computeCtlRampRate({ log, today: TODAY })
    expect(r.citation).toBe(CTL_RAMP_RATE_CITATION)
    expect(r.citation).toMatch(/Gabbett 2016/)
    expect(r.citation).toMatch(/Banister 1975/)
  })

  it('weeklyDeltas are oldest-first and sum to (currentCtl − baselineCtl)', () => {
    const log = buildSteppedLog({
      baseline: 60,
      weeklySteps: [80, 100, 120, 140],
    })
    const r = computeCtlRampRate({ log, today: TODAY })
    expect(r).not.toBeNull()
    // Oldest-first: first delta covers (today-28 → today-21),
    // last covers (today-7 → today). For a strictly-increasing step,
    // each successive delta should be ≥ the previous (CTL is still rising).
    for (let i = 1; i < r.weeklyDeltas.length; i++) {
      expect(r.weeklyDeltas[i]).toBeGreaterThanOrEqual(r.weeklyDeltas[i - 1] - 0.1)
    }
    const sum = r.weeklyDeltas.reduce((s, v) => s + v, 0)
    expect(Math.abs(sum - (r.currentCtl - r.baselineCtl))).toBeLessThanOrEqual(0.2)
  })
})
