// src/lib/trainingLoad.test.js
import { describe, it, expect } from 'vitest'
import { calculatePMC, calculateACWR, fitBanister, predictBanister } from './trainingLoad.js'

// Helper: create a log entry daysAgo days in the past
function entry(daysAgo, tss) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return { date: d.toISOString().slice(0, 10), tss }
}

// ─── calculatePMC ─────────────────────────────────────────────────────────────
describe('calculatePMC', () => {
  it('returns an array even for empty log', () => {
    const series = calculatePMC([], 7, 0)
    expect(Array.isArray(series)).toBe(true)
    expect(series.length).toBe(7)  // daysBack=7 → 7 points (today−6 to today)
  })

  it('all values zero for empty log', () => {
    const series = calculatePMC([], 14, 0)
    series.forEach(p => {
      expect(p.tss).toBe(0)
      expect(p.ctl).toBe(0)
      expect(p.atl).toBe(0)
    })
  })

  it('CTL at 1 fitness time-constant ≈ 63% of steady-state (1 − e^{−1})', () => {
    // After 42 days of 100 TSS/day from 0: CTL = 100 × (1 − e^{−1}) ≈ 63.2
    const log = Array.from({ length: 42 }, (_, i) => entry(42 - i, 100))
    const series = calculatePMC(log, 42, 0)
    const last   = series[series.length - 1]
    expect(last.ctl).toBeGreaterThan(60)
    expect(last.ctl).toBeLessThan(66)
  })

  it('ATL rises faster than CTL (τATL=7 < τCTL=42)', () => {
    const log = Array.from({ length: 14 }, (_, i) => entry(14 - i, 100))
    const series = calculatePMC(log, 14, 0)
    const last   = series[series.length - 1]
    expect(last.atl).toBeGreaterThan(last.ctl)
  })

  it('TSB equals previous CTL minus previous ATL', () => {
    const log = Array.from({ length: 30 }, (_, i) => entry(30 - i, 80))
    const series = calculatePMC(log, 20, 0)
    for (let i = 1; i < series.length; i++) {
      const prev = series[i - 1]
      const curr = series[i]
      expect(curr.tsb).toBeCloseTo(prev.ctl - prev.atl, 0)
    }
  })

  it('isFuture=true for projected days and tss=0', () => {
    const series = calculatePMC([], 5, 5)
    const future = series.filter(p => p.isFuture)
    expect(future.length).toBe(5)
    future.forEach(p => {
      expect(p.isFuture).toBe(true)
      expect(p.tss).toBe(0)
    })
  })

  it('total array length equals daysBack + daysFuture', () => {
    const series = calculatePMC([], 30, 10)
    expect(series.length).toBe(40)
  })

  it('CTL increases monotonically with constant daily training (including today)', () => {
    // Include today (daysAgo=0) so the last point also has TSS=100, not 0
    const log = Array.from({ length: 61 }, (_, i) => entry(60 - i, 100))
    const series = calculatePMC(log, 60, 0)
    for (let i = 1; i < series.length; i++) {
      expect(series[i].ctl).toBeGreaterThanOrEqual(series[i - 1].ctl - 0.5)
    }
  })
})

// ─── calculateACWR ────────────────────────────────────────────────────────────
describe('calculateACWR', () => {
  it('returns null ratio for empty log', () => {
    const r = calculateACWR([])
    expect(r.ratio).toBeNull()
    expect(r.status).toBe('insufficient')
  })

  it('status is optimal for equal acute and chronic load', () => {
    // 28 days of 100 TSS/day — ACWR ≈ 1.0 (±0.2 for timezone boundary effects)
    const log = Array.from({ length: 28 }, (_, i) => entry(27 - i, 100))
    const r = calculateACWR(log)
    expect(r.ratio).toBeGreaterThanOrEqual(0.9)
    expect(r.ratio).toBeLessThanOrEqual(1.3)
    expect(r.status).toBe('optimal')
  })

  it('status is danger when ACWR > 1.5', () => {
    // Low chronic base: 21 days of 10 TSS, then 7 days of 300 TSS
    const low  = Array.from({ length: 21 }, (_, i) => entry(27 - i, 10))
    const high = Array.from({ length: 7  }, (_, i) => entry(6 - i,  300))
    const r = calculateACWR([...low, ...high])
    expect(r.ratio).toBeGreaterThan(1.5)
    expect(r.status).toBe('danger')
  })

  it('status is undertraining when ACWR < 0.8', () => {
    // High chronic, very low acute: 21 days of 200 TSS, 7 days of rest
    const base = Array.from({ length: 21 }, (_, i) => entry(27 - i, 200))
    const rest = Array.from({ length: 7 },  (_, i) => entry(6 - i,  0))
    const r = calculateACWR([...base, ...rest])
    expect(r.ratio).toBeLessThan(0.8)
    expect(r.status).toBe('undertraining')
  })
})

// ─── fitBanister ──────────────────────────────────────────────────────────────
describe('fitBanister', () => {
  it('returns null for fewer than 3 test results', () => {
    expect(fitBanister([], [])).toBeNull()
    expect(fitBanister([], [{ date: '2026-01-01', value: 250 }])).toBeNull()
    expect(fitBanister([], [
      { date: '2026-01-01', value: 250 },
      { date: '2026-02-01', value: 260 },
    ])).toBeNull()
  })

  it('returns fit object with correct shape when ≥ 3 results', () => {
    // Variable training: alternating 4-week build (120 TSS) and 1-week rest (0) blocks
    // This creates meaningful g/h variation so the system is not near-singular
    const log = Array.from({ length: 180 }, (_, i) => {
      const weekInCycle = Math.floor((180 - i) / 7) % 5
      return entry(180 - i, weekInCycle < 4 ? 120 : 0)
    })
    const testResults = [
      { date: log[59].date,  value: 250 },
      { date: log[119].date, value: 270 },
      { date: log[159].date, value: 280 },
    ]
    const fit = fitBanister(log, testResults)
    expect(fit).not.toBeNull()
    expect(fit).toHaveProperty('k1')
    expect(fit).toHaveProperty('k2')
    expect(fit).toHaveProperty('p0')
    expect(fit).toHaveProperty('r2')
    expect(fit.r2).toBeGreaterThanOrEqual(0)
    expect(fit.r2).toBeLessThanOrEqual(1)
  })
})

// ─── predictBanister ─────────────────────────────────────────────────────────
describe('predictBanister', () => {
  it('returns empty array when fit is null', () => {
    expect(predictBanister([], null, [], 30)).toEqual([])
  })

  it('returns correct number of prediction points', () => {
    const log = Array.from({ length: 180 }, (_, i) => {
      const wk = Math.floor((180 - i) / 7) % 5
      return entry(180 - i, wk < 4 ? 120 : 0)
    })
    const testResults = [
      { date: log[59].date,  value: 250 },
      { date: log[119].date, value: 270 },
      { date: log[159].date, value: 280 },
    ]
    const fit = fitBanister(log, testResults)
    const pred = predictBanister(log, fit, [], 30)
    expect(pred.length).toBe(30)
  })

  it('predicted values are within 0–100 range', () => {
    const log = Array.from({ length: 180 }, (_, i) => {
      const wk = Math.floor((180 - i) / 7) % 5
      return entry(180 - i, wk < 4 ? 120 : 0)
    })
    const testResults = [
      { date: log[59].date,  value: 250 },
      { date: log[119].date, value: 270 },
      { date: log[159].date, value: 280 },
    ]
    const fit = fitBanister(log, testResults)
    const pred = predictBanister(log, fit, [], 20)
    pred.forEach(p => {
      expect(p.predicted).toBeGreaterThanOrEqual(0)
      expect(p.predicted).toBeLessThanOrEqual(100)
    })
  })
})
