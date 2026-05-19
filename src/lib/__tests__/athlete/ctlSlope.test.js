// src/lib/__tests__/athlete/ctlSlope.test.js
//
// Pure-fn tests for analyzeCtlSlope — Banister 1991 / Coggan 2010
// linear-regression slope of the trailing CTL series.

import { describe, it, expect } from 'vitest'
import {
  analyzeCtlSlope,
  CTL_SLOPE_CITATION,
} from '../../athlete/ctlSlope.js'

const TODAY = '2026-05-17'

// ─── helpers ─────────────────────────────────────────────────────────────

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function buildFlatLog({ today = TODAY, daily = 60, days = 300 } = {}) {
  const log = []
  for (let i = days - 1; i >= 0; i--) {
    log.push({ date: isoMinusDays(today, i), tss: daily })
  }
  return log
}

// Daily TSS varies linearly from `dailyStart` (oldest) → `dailyEnd` (today).
function buildLinearRampLog({
  today = TODAY,
  dailyStart,
  dailyEnd,
  days,
}) {
  const log = []
  for (let i = days - 1; i >= 0; i--) {
    const t = (days - 1 - i) / Math.max(1, days - 1)
    const tss = dailyStart + (dailyEnd - dailyStart) * t
    log.push({ date: isoMinusDays(today, i), tss })
  }
  return log
}

// ─── null / insufficient signal ──────────────────────────────────────────

describe('analyzeCtlSlope — null guards', () => {
  it('returns null for an empty log', () => {
    expect(analyzeCtlSlope({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null when log spans fewer than 28 days of history', () => {
    // 14 days of entries ending today — below the MIN_LOG_DAYS gate.
    const log = []
    for (let i = 13; i >= 0; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: 60 })
    }
    expect(analyzeCtlSlope({ log, today: TODAY })).toBeNull()
  })

  it('returns null for invalid today', () => {
    const log = buildFlatLog({ daily: 60, days: 100 })
    expect(analyzeCtlSlope({ log, today: 'not-a-date' })).toBeNull()
  })

  it('returns null when windowDays < 2', () => {
    const log = buildFlatLog({ daily: 60, days: 100 })
    expect(analyzeCtlSlope({ log, today: TODAY, windowDays: 1 })).toBeNull()
  })

  it('returns null when log entries are not Array', () => {
    expect(analyzeCtlSlope({ log: null, today: TODAY })).toBeNull()
  })
})

// ─── band classification — all four bands ───────────────────────────────

describe('analyzeCtlSlope — band classification', () => {
  it('PLATEAU: constant daily TSS yields near-zero slope', () => {
    const log = buildFlatLog({ daily: 60, days: 300 })
    const r = analyzeCtlSlope({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(Math.abs(r.slopePerWeek)).toBeLessThan(0.5)
    expect(r.band).toBe('PLATEAU')
    // recentCtl should have converged to ~60.
    expect(r.recentCtl).toBeGreaterThan(58)
    expect(r.recentCtl).toBeLessThan(62)
  })

  it('STEADY_UP: gentle linear ramp → slopePerWeek in [0.5, 3.0)', () => {
    // Simulation: ramp 40→80 over 200 days → slopePerWeek ≈ +1.48.
    const log = buildLinearRampLog({
      dailyStart: 40, dailyEnd: 80, days: 200,
    })
    const r = analyzeCtlSlope({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.slopePerWeek).toBeGreaterThanOrEqual(0.5)
    expect(r.slopePerWeek).toBeLessThan(3.0)
    expect(r.band).toBe('STEADY_UP')
  })

  it('CLIMBING: steep ramp → slopePerWeek ≥ +3.0', () => {
    // Simulation: ramp 30→150 over 120 days → slopePerWeek ≈ +6.86.
    const log = buildLinearRampLog({
      dailyStart: 30, dailyEnd: 150, days: 120,
    })
    const r = analyzeCtlSlope({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.slopePerWeek).toBeGreaterThanOrEqual(3.0)
    expect(r.band).toBe('CLIMBING')
  })

  it('DECLINING: negative ramp → slopePerWeek ≤ -0.5', () => {
    // Simulation: ramp 100→40 over 200 days → slopePerWeek ≈ -1.85.
    const log = buildLinearRampLog({
      dailyStart: 100, dailyEnd: 40, days: 200,
    })
    const r = analyzeCtlSlope({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.slopePerWeek).toBeLessThanOrEqual(-0.5)
    expect(r.band).toBe('DECLINING')
  })
})

// ─── linear regression math ──────────────────────────────────────────────

describe('analyzeCtlSlope — regression math', () => {
  it('constant TSS produces near-zero slope (PLATEAU)', () => {
    const log = buildFlatLog({ daily: 80, days: 300 })
    const r = analyzeCtlSlope({ log, today: TODAY })
    expect(r).not.toBeNull()
    // slope is TSS/day; with daily TSS=80 stable, CTL is stable at ~80
    // so the regression slope must be ~0.
    expect(Math.abs(r.slope)).toBeLessThan(0.01)
    expect(Math.abs(r.slopePerWeek)).toBeLessThan(0.1)
    expect(r.recentCtl).toBeGreaterThan(78)
    expect(r.recentCtl).toBeLessThan(82)
  })

  it('monotonic upward ramp → positive slope', () => {
    const log = buildLinearRampLog({
      dailyStart: 30, dailyEnd: 150, days: 120,
    })
    const r = analyzeCtlSlope({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.slope).toBeGreaterThan(0)
    expect(r.slopePerWeek).toBeGreaterThan(0)
    // recentCtl must exceed intercept on a rising series.
    expect(r.recentCtl).toBeGreaterThan(r.intercept)
  })

  it('monotonic downward ramp → negative slope', () => {
    const log = buildLinearRampLog({
      dailyStart: 100, dailyEnd: 40, days: 200,
    })
    const r = analyzeCtlSlope({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.slope).toBeLessThan(0)
    expect(r.slopePerWeek).toBeLessThan(0)
    expect(r.recentCtl).toBeLessThan(r.intercept)
  })

  it('slopePerWeek === slope * 7 (rounded)', () => {
    const log = buildLinearRampLog({
      dailyStart: 40, dailyEnd: 80, days: 200,
    })
    const r = analyzeCtlSlope({ log, today: TODAY })
    expect(r).not.toBeNull()
    // Allow tiny rounding because slope is rounded to 2dp and
    // slopePerWeek to 1dp independently.
    expect(Math.abs(r.slopePerWeek - r.slope * 7)).toBeLessThan(0.1)
  })
})

// ─── windowDays override ─────────────────────────────────────────────────

describe('analyzeCtlSlope — windowDays override', () => {
  it('echoes default windowDays (42)', () => {
    const log = buildFlatLog({ daily: 60, days: 300 })
    const r = analyzeCtlSlope({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.windowDays).toBe(42)
  })

  it('honors a custom windowDays (14)', () => {
    const log = buildFlatLog({ daily: 60, days: 300 })
    const r = analyzeCtlSlope({ log, today: TODAY, windowDays: 14 })
    expect(r).not.toBeNull()
    expect(r.windowDays).toBe(14)
  })

  it('honors a custom windowDays (84) — wider regression smooths noise', () => {
    const log = buildFlatLog({ daily: 60, days: 300 })
    const r = analyzeCtlSlope({ log, today: TODAY, windowDays: 84 })
    expect(r).not.toBeNull()
    expect(r.windowDays).toBe(84)
    // Constant TSS still produces PLATEAU at any window.
    expect(r.band).toBe('PLATEAU')
  })

  it('clamps windowDays to available history when log is shorter than the window', () => {
    // 40 days of log (≥ MIN_LOG_DAYS=28) with default windowDays=42
    // should still produce a result, using the available 40-day span.
    const log = buildFlatLog({ daily: 60, days: 40 })
    const r = analyzeCtlSlope({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.windowDays).toBe(40)
  })
})

// ─── metadata ────────────────────────────────────────────────────────────

describe('analyzeCtlSlope — metadata', () => {
  it('exposes Banister 1991 / Coggan 2010 citation', () => {
    const log = buildFlatLog({ daily: 60, days: 200 })
    const r = analyzeCtlSlope({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.citation).toBe(CTL_SLOPE_CITATION)
    expect(r.citation).toMatch(/Banister 1991/)
    expect(r.citation).toMatch(/Coggan 2010/)
  })

  it('returns all expected fields with finite numbers', () => {
    const log = buildLinearRampLog({
      dailyStart: 40, dailyEnd: 80, days: 200,
    })
    const r = analyzeCtlSlope({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(Number.isFinite(r.slope)).toBe(true)
    expect(Number.isFinite(r.slopePerWeek)).toBe(true)
    expect(Number.isFinite(r.intercept)).toBe(true)
    expect(Number.isFinite(r.recentCtl)).toBe(true)
    expect(typeof r.band).toBe('string')
    expect(typeof r.windowDays).toBe('number')
  })
})
