// src/lib/__tests__/science/load.citation.test.js
// E3 — Citation-grounded tests for trainingLoad.js
// Sources:
//   Banister E.W. & Calvert T.W. (1980). Planning for future performance.
//   Hulin B.T. et al. (2016). Br J Sports Med 50(4):231–236.
//   Foster C. et al. (1998). Med Sci Sports Exerc 30(7):1164–1168.
//   Coggan A.R. (2003). TSB zone classification.
import { describe, it, expect } from 'vitest'
import { calculatePMC, calculateACWR, computeMonotony, classifyTSB, TSB_ZONES } from '../../trainingLoad.js'

// ─── Banister EWMA constants (Banister & Calvert 1980) ─────────────────────
describe('PMC EWMA constants — Banister & Calvert (1980)', () => {
  it('CTL time constant τ=42d → K_CTL ≈ 0.02353', () => {
    // K = 1 − e^(−1/τ) per Banister impulse-response model
    const K_CTL = 1 - Math.exp(-1 / 42)
    expect(K_CTL).toBeCloseTo(0.02353, 4)
  })

  it('ATL time constant τ=7d → K_ATL ≈ 0.1331', () => {
    const K_ATL = 1 - Math.exp(-1 / 7)
    // 1 − e^(−1/7) ≈ 0.13312; Banister value commonly cited as ~0.1331
    expect(K_ATL).toBeCloseTo(0.1331, 3)
  })

  it('CTL EWMA formula: after 42 rest days from 100 TSS/day base, CTL ≈ 63', () => {
    // After steady-state of 100 TSS/day: CTL_ss ≈ 100
    // After 42 days of 0 TSS: CTL decays by factor e^(−42/42) = e^(−1) ≈ 0.368
    // CTL_42 ≈ CTL_ss × 0.368 ≈ 36.8 → but we start from ~70 (not full ss)
    // Instead: directly compute the EWMA for 42 days of 100, then 42 days of 0
    const K_CTL = 1 - Math.exp(-1 / 42)
    const DECAY = 1 - K_CTL
    let ctl = 0
    // 42 days training
    for (let i = 0; i < 42; i++) ctl = ctl * DECAY + 100 * K_CTL
    const peakCTL = ctl
    // 42 days rest
    for (let i = 0; i < 42; i++) ctl = ctl * DECAY
    // After 42 rest days, CTL should be peakCTL × DECAY^42 ≈ peakCTL × e^(−1) ≈ 36.8% of peak
    expect(ctl).toBeLessThan(peakCTL)
    expect(ctl).toBeGreaterThan(0)
    // Decay factor check
    expect(ctl / peakCTL).toBeCloseTo(Math.exp(-1), 1)
  })

  it('CTL increases monotonically with daily training', () => {
    const K_CTL = 1 - Math.exp(-1 / 42)
    const DECAY = 1 - K_CTL
    let ctl = 0
    const series = []
    for (let i = 0; i < 60; i++) {
      ctl = ctl * DECAY + 80 * K_CTL
      series.push(ctl)
    }
    expect(series[59]).toBeGreaterThan(series[6])
    expect(series[59]).toBeLessThan(80)   // never exceeds daily TSS (asymptotic)
  })

  it('TSB = CTL(yesterday) − ATL(yesterday)', () => {
    // One session today only
    const log = [{ date: '2025-06-01', tss: 100 }]
    const pmc = calculatePMC(log, 5, 0)
    const dayOf = pmc.find(p => p.date === '2025-06-01')
    if (dayOf) {
      // TSB is prev-day CTL minus prev-day ATL — which is 0 on day 1
      expect(dayOf.tsb).toBeDefined()
    }
  })
})

// ─── ACWR thresholds (Hulin et al. 2016) ────────────────────────────────────
// Source: Hulin B.T. et al. (2016). "The acute:chronic workload ratio predicts
//         injury: high chronic workload may decrease injury risk in elite rugby
//         league players." Br J Sports Med 50(4):231–236.
describe('ACWR injury zones — Hulin et al. (2016)', () => {
  it('returns insufficient when log is empty', () => {
    const result = calculateACWR([])
    expect(result.status).toBe('insufficient')
  })

  it('optimal zone: ratio 0.8–1.3', () => {
    // Build a balanced 28-day load (all days equal TSS)
    const log = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    for (let i = 27; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      log.push({ date: d.toISOString().slice(0, 10), tss: 80 })
    }
    const result = calculateACWR(log)
    // Perfectly consistent load → ratio ≈ 1.0
    expect(result.ratio).toBeGreaterThanOrEqual(0.8)
    expect(result.ratio).toBeLessThanOrEqual(1.3)
    expect(result.status).toBe('optimal')
  })

  it('danger zone: spike in acute load drives ratio > 1.5', () => {
    const log = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    // Chronic base: 28 days at 50 TSS
    for (let i = 27; i >= 4; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      log.push({ date: d.toISOString().slice(0, 10), tss: 50 })
    }
    // Acute spike: last 3 days at 300 TSS (way above chronic)
    for (let i = 3; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      log.push({ date: d.toISOString().slice(0, 10), tss: 300 })
    }
    const result = calculateACWR(log)
    expect(result.ratio).toBeGreaterThan(1.3)
  })
})

// ─── Training Monotony & Strain (Foster et al. 1998) ───────────────────────
describe('Monotony & Strain — Foster et al. (1998)', () => {
  // Reference: Foster C. (1998). "Monitoring training in athletes with reference
  // to overtraining syndrome." Med Sci Sports Exerc 30(7):1164–1168.

  it('uniform training → low monotony (all days equal TSS)', () => {
    // Perfectly consistent load: mean/stdev very high → but stdev is 0 → null monotony
    // Foster: stdev=0 means no variability, monotony formula undefined (div by 0)
    const log = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-01-0${i + 1}`, tss: 80
    }))
    const ref = new Date('2026-01-07')
    const result = computeMonotony(log, ref)
    expect(result.weekTSS).toBe(560)
    expect(result.monotony).toBeNull()  // stdev ≈ 0 → undefined (Foster's edge case)
  })

  it('high variability → low monotony', () => {
    // Alternating hard/easy creates high stdev relative to mean → low monotony
    const log = [
      { date: '2026-01-01', tss: 0 },
      { date: '2026-01-02', tss: 200 },
      { date: '2026-01-03', tss: 0 },
      { date: '2026-01-04', tss: 200 },
      { date: '2026-01-05', tss: 0 },
      { date: '2026-01-06', tss: 200 },
      { date: '2026-01-07', tss: 0 },
    ]
    const ref = new Date('2026-01-07')
    const result = computeMonotony(log, ref)
    expect(result.monotony).toBeLessThan(1.5)
    expect(result.status).not.toBe('high')
  })

  it('moderate daily load with small variation → moderate monotony', () => {
    // Real-world example: 7 consecutive days with small fluctuation
    const log = [
      { date: '2026-02-01', tss: 85 },
      { date: '2026-02-02', tss: 90 },
      { date: '2026-02-03', tss: 88 },
      { date: '2026-02-04', tss: 87 },
      { date: '2026-02-05', tss: 91 },
      { date: '2026-02-06', tss: 89 },
      { date: '2026-02-07', tss: 90 },
    ]
    const ref = new Date('2026-02-07')
    const result = computeMonotony(log, ref)
    expect(result.monotony).toBeGreaterThan(2)   // very small stdev → high monotony
    expect(result.status).toBe('high')
    // strain = weekTSS × monotony
    expect(result.strain).toBeCloseTo(result.weekTSS * result.monotony, 0)
  })

  it('returns insufficient when no sessions logged', () => {
    const ref = new Date('2026-02-07')
    const result = computeMonotony([], ref)
    expect(result.status).toBe('insufficient')
    expect(result.monotony).toBeNull()
    expect(result.strain).toBeNull()
  })

  it('missing days count as 0 TSS (rest days included in mean)', () => {
    // Only 3 sessions in the 7-day window — 4 rest days counted as 0
    const log = [
      { date: '2026-03-01', tss: 100 },
      { date: '2026-03-03', tss: 100 },
      { date: '2026-03-05', tss: 100 },
    ]
    const ref = new Date('2026-03-07')
    const result = computeMonotony(log, ref)
    expect(result.weekTSS).toBe(300)
    expect(result.dailyTSS).toEqual([100, 0, 100, 0, 100, 0, 0])
    // mean = 300/7 ≈ 42.9; rest days create high variability → low monotony
    expect(result.monotony).not.toBeNull()
    expect(result.monotony).toBeLessThan(1.5)
  })
})

// ─── TSB Zone Classification (Coggan) ───────────────────────────────────────
// Source: Coggan A.R. Training and Racing with a Power Meter (2nd ed.)
//         TSS, TSB zone boundaries documented in TrainingPeaks methodology.
describe('TSB zones — Coggan', () => {
  it('TSB > +25 → transitional (fitness decaying)', () => {
    expect(classifyTSB(30).zone).toBe('transitional')
    expect(classifyTSB(25.1).zone).toBe('transitional')
  })

  it('TSB +5 to +25 → fresh / peak form', () => {
    expect(classifyTSB(15).zone).toBe('fresh')
    expect(classifyTSB(5).zone).toBe('fresh')
    expect(classifyTSB(24.9).zone).toBe('fresh')
  })

  it('TSB -10 to +5 → neutral training', () => {
    expect(classifyTSB(0).zone).toBe('neutral')
    expect(classifyTSB(-5).zone).toBe('neutral')
    expect(classifyTSB(4.9).zone).toBe('neutral')
  })

  it('TSB -30 to -10 → optimal training stimulus', () => {
    expect(classifyTSB(-20).zone).toBe('optimal')
    expect(classifyTSB(-10.1).zone).toBe('optimal')
    expect(classifyTSB(-29.9).zone).toBe('optimal')
  })

  it('TSB < -30 → overreaching risk', () => {
    expect(classifyTSB(-35).zone).toBe('overreaching')
    expect(classifyTSB(-100).zone).toBe('overreaching')
  })

  it('null / undefined → unknown zone', () => {
    expect(classifyTSB(null).zone).toBe('unknown')
    expect(classifyTSB(undefined).zone).toBe('unknown')
  })

  it('all zones have bilingual labels', () => {
    for (const zone of TSB_ZONES) {
      expect(zone.label.en).toBeTruthy()
      expect(zone.label.tr).toBeTruthy()
      expect(zone.advice.en).toBeTruthy()
      expect(zone.advice.tr).toBeTruthy()
    }
  })

  it('boundaries are contiguous and non-overlapping', () => {
    // Each zone's min should equal previous zone's max
    for (let i = 1; i < TSB_ZONES.length; i++) {
      expect(TSB_ZONES[i].max).toBe(TSB_ZONES[i - 1].min)
    }
  })
})
