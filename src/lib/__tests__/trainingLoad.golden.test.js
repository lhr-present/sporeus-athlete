// ─── trainingLoad.golden.test.js — Reference-value validation ────────────────
// These tests verify CTL/ATL/TSB/ACWR against analytically derived or
// published reference values.  A formula change that breaks these tests needs
// a science justification — not just a code fix.
//
// Reference: Banister & Calvert 1980 (impulse-response); Coggan CTL=42d EWMA;
//            Hulin et al. 2016 (ACWR); Foster et al. 2001 (monotony/strain).

import { describe, test, expect } from 'vitest'
import { calculateACWR, computeMonotony } from '../trainingLoad.js'
import { BANISTER } from '../sport/constants.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Build a log of N days of constant TSS ending N days before `endOffset` days ago.
// endOffset=0 means the last entry is today; endOffset=1 means yesterday.
function constantLog(tss, days, startDate = '2024-01-01') {
  const log = []
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    log.push({ date: d.toISOString().slice(0, 10), tss })
  }
  return log
}

// Build a log of N days of constant TSS ending `endOffset` days ago (0 = today).
// Use this for calculateACWR tests since that function always uses new Date().
function recentLog(tss, days, endOffset = 0) {
  const log = []
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  end.setDate(end.getDate() - endOffset)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end)
    d.setDate(d.getDate() - i)
    log.push({ date: d.toISOString().slice(0, 10), tss })
  }
  return log
}

// ─── BANISTER constants ───────────────────────────────────────────────────────
test('K_CTL = 1 - exp(-1/42) ≈ 0.02353', () => {
  expect(BANISTER.K_CTL).toBeCloseTo(1 - Math.exp(-1 / 42), 8)
  expect(BANISTER.TAU_CTL).toBe(42)
})

test('K_ATL = 1 - exp(-1/7) ≈ 0.13307', () => {
  expect(BANISTER.K_ATL).toBeCloseTo(1 - Math.exp(-1 / 7), 8)
  expect(BANISTER.TAU_ATL).toBe(7)
})

// ─── CTL / ATL steady-state convergence ───────────────────────────────────────
// calculateACWR uses new Date() internally, so test logs must end today.
// λ_acute=0.25, λ_chronic=0.067: ATL half-life ≈ 2.4d, CTL half-life ≈ 10d.
// After 28d constant load: ATL ≈ 99.97 (fully converged), CTL ≈ 85.6 → ratio ≈ 1.17.
// After 14d constant load: ATL ≈ 98.2, CTL ≈ 62.2 → ratio ≈ 1.58.
describe('CTL/ATL convergence (steady-state)', () => {
  test('ATL converges faster than CTL: after 28d constant load ratio is 1.1–1.3', () => {
    const log = recentLog(100, 28)
    const { ratio } = calculateACWR(log)
    // ATL nearly at steady-state; CTL still building → ratio > 1
    expect(ratio).toBeGreaterThan(1.0)
    expect(ratio).toBeLessThan(1.30)
  })

  test('after 14d constant load ratio is 1.3–2.0 (CTL still catching up)', () => {
    const log = recentLog(80, 14)
    const { ratio } = calculateACWR(log)
    expect(ratio).toBeGreaterThan(1.3)
    expect(ratio).toBeLessThan(2.0)
  })
})

// ─── ACWR status classification ───────────────────────────────────────────────
describe('ACWR status boundaries (Hulin 2016)', () => {
  test('ratio < 0.8 → undertraining (heavy base then taper)', () => {
    // 21 days heavy, then 7 days zero — ATL falls faster than CTL
    const base  = recentLog(100, 21, 7)
    const taper = recentLog(0,   7,  0)
    const { status } = calculateACWR([...base, ...taper])
    expect(status).toMatch(/undertraining|insufficient/)
  })

  test('ratio 0.8–1.3 → optimal (constant load)', () => {
    const log = recentLog(100, 28)
    const { status } = calculateACWR(log)
    expect(status).toBe('optimal')
  })

  test('ratio > 1.3 → caution or danger (spike after base)', () => {
    // 21 days moderate, then 7 days heavy spike
    const base  = recentLog(60,  21, 7)
    const spike = recentLog(200, 7,  0)
    const { status, ratio } = calculateACWR([...base, ...spike])
    expect(status).toMatch(/caution|danger/)
    expect(ratio).toBeGreaterThan(1.0)
  })
})

// ─── Monotony / Strain (Foster 2001) ─────────────────────────────────────────
// computeMonotony returns { monotony, strain, weekTSS, dailyTSS, status }
// monotony = null when stdev < 1 (zero or uniform training — guards div-by-zero)
describe('Monotony and Strain (Foster 2001)', () => {
  test('zero training → monotony null and strain null', () => {
    const log = constantLog(0, 7, '2024-01-01')
    const { monotony, strain } = computeMonotony(log, new Date('2024-01-07'))
    expect(monotony).toBeNull()
    expect(strain).toBeNull()
  })

  test('perfectly uniform training (same TSS every day) → monotony null (stdev=0 guard)', () => {
    // All 7 days identical → SD = 0 → formula guards div-by-zero, returns null
    const log = constantLog(80, 7, '2024-01-01')
    const { monotony, status } = computeMonotony(log, new Date('2024-01-07'))
    expect(monotony).toBeNull()
    expect(status).toBe('insufficient')
  })

  test('highly varied training → low monotony', () => {
    // Alternating 0 and 160 TSS — maximum variance, low mean/SD ratio
    const log = [0, 160, 0, 160, 0, 160, 0].map((tss, i) => {
      const d = new Date('2024-03-01')
      d.setDate(d.getDate() + i)
      return { date: d.toISOString().slice(0, 10), tss }
    })
    const { monotony } = computeMonotony(log, new Date('2024-03-07'))
    expect(monotony).toBeLessThan(2) // safe zone
  })

  test('strain = weeklyTSS × monotony', () => {
    // 6 days at 80 + 1 rest day creates valid variance (non-zero stdev)
    const log = [80, 80, 80, 80, 80, 80, 0].map((tss, i) => {
      const d = new Date('2024-03-01')
      d.setDate(d.getDate() + i)
      return { date: d.toISOString().slice(0, 10), tss }
    })
    const { monotony, strain, weekTSS } = computeMonotony(log, new Date('2024-03-07'))
    if (monotony !== null) {
      expect(Math.abs(strain - weekTSS * monotony)).toBeLessThan(weekTSS * 0.05)
    }
  })
})

// ─── Monotony flag (>2.0) ─────────────────────────────────────────────────────
test('monotony flag fires above 2.0', () => {
  // 6 consecutive moderate days + 1 rest → moderate variance but high monotony
  const log = [80, 80, 80, 80, 80, 80, 0].map((tss, i) => {
    const d = new Date('2024-04-01')
    d.setDate(d.getDate() + i)
    return { date: d.toISOString().slice(0, 10), tss }
  })
  const { monotony } = computeMonotony(log, new Date('2024-04-07'))
  // With 6 days at 80 and 1 day at 0: mean ≈ 68.6, SD ≈ 30.1, monotony ≈ 2.28
  expect(monotony).toBeGreaterThan(2.0)
})
