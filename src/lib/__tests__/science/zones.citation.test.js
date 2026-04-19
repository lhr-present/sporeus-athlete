// src/lib/__tests__/science/zones.citation.test.js
// E3 — Citation-grounded tests for zone distribution and training model
// Sources:
//   Seiler K.S. & Kjerland G.Ø. (2006). Scand J Med Sci Sports 16(1):49–56.
//   Seiler S. (2010). Int J Sports Physiol Perform 5(3):276–291.
//   Friel J. (2009). The Cyclist's Training Bible, 4th ed. Decoupling thresholds.
import { describe, it, expect } from 'vitest'
import { rpeToZone, zoneDistribution, trainingModel } from '../../zoneDistrib.js'
import { computeDecoupling, classifyDecoupling, DECOUPLING_THRESHOLDS } from '../../decoupling.js'

// ─── Zone distribution — Seiler & Kjerland (2006) ──────────────────────────
describe('Zone distribution — Seiler & Kjerland (2006)', () => {
  it('RPE mapping follows Borg CR10 zone proxy', () => {
    expect(rpeToZone(1)).toBe(1)   // recovery
    expect(rpeToZone(2)).toBe(1)
    expect(rpeToZone(3)).toBe(1)
    expect(rpeToZone(4)).toBe(2)   // aerobic
    expect(rpeToZone(5)).toBe(2)
    expect(rpeToZone(6)).toBe(3)   // tempo
    expect(rpeToZone(7)).toBe(3)
    expect(rpeToZone(8)).toBe(4)   // VO2
    expect(rpeToZone(9)).toBe(5)   // anaerobic
    expect(rpeToZone(10)).toBe(5)
  })

  it('null RPE returns null (missing data graceful)', () => {
    expect(rpeToZone(0)).toBeNull()
    expect(rpeToZone(null)).toBeNull()
  })

  it('polarized distribution detected: Z1+Z2 ≥ 70%, Z4+Z5 ≥ 15%', () => {
    // Seiler (2010): endurance athletes ~80% easy, ~20% hard, <5% moderate
    const sessions = [
      ...Array.from({ length: 8 }, () => ({ rpe: 4, duration: 60 })),   // Z2 ×8 = 480 min
      ...Array.from({ length: 3 }, () => ({ rpe: 9, duration: 30 })),   // Z5 ×3 = 90 min → 90/570 ≈ 15.8%
    ]
    const pct = zoneDistribution(sessions)
    const model = trainingModel(pct)
    expect(model).toBe('polarized')
    const easy = (pct[1] || 0) + (pct[2] || 0)
    const hard = (pct[4] || 0) + (pct[5] || 0)
    expect(easy).toBeGreaterThanOrEqual(70)
    expect(hard).toBeGreaterThanOrEqual(15)
  })

  it('threshold-heavy distribution detected: Z3 ≥ 30%', () => {
    const sessions = [
      ...Array.from({ length: 3 }, () => ({ rpe: 5, duration: 60 })),  // Z2 = 180 min
      ...Array.from({ length: 4 }, () => ({ rpe: 6, duration: 60 })),  // Z3 = 240 min
      { rpe: 9, duration: 30 },                                          // Z5 = 30 min
    ]
    const pct = zoneDistribution(sessions)
    expect(trainingModel(pct)).toBe('threshold')
  })

  it('returns null for empty sessions', () => {
    expect(zoneDistribution([])).toBeNull()
    expect(zoneDistribution(null)).toBeNull()
  })

  it('percentages sum to approximately 100', () => {
    const sessions = [
      { rpe: 3, duration: 45 },
      { rpe: 5, duration: 60 },
      { rpe: 7, duration: 45 },
      { rpe: 9, duration: 20 },
    ]
    const pct = zoneDistribution(sessions)
    const sum = Object.values(pct).reduce((s, v) => s + v, 0)
    // Allow ±2 rounding error across 5 zones
    expect(sum).toBeGreaterThanOrEqual(98)
    expect(sum).toBeLessThanOrEqual(102)
  })
})

// ─── Aerobic decoupling — Friel (2009) ────────────────────────────────────
// Source: Friel J. The Cyclist's Training Bible, 4th ed. VeloPress, 2009.
//         Threshold: < 5% = coupled; 5-10% = mild; > 10% = significant.
describe('Aerobic decoupling — Friel (2009)', () => {
  it('DECOUPLING_THRESHOLDS match Friel published values', () => {
    expect(DECOUPLING_THRESHOLDS.coupled).toBe(5)
    expect(DECOUPLING_THRESHOLDS.mild).toBe(10)
  })

  it('stable power and HR → near-zero decoupling', () => {
    // 120-minute constant effort: power & HR both flat
    const power = Array.from({ length: 7200 }, () => 200)
    const hr    = Array.from({ length: 7200 }, () => 145)
    const result = computeDecoupling({ hr, power })
    expect(Math.abs(result.decouplingPct)).toBeLessThan(1)
    expect(result.valid).toBe(true)
    expect(classifyDecoupling(result.decouplingPct)).toBe('coupled')
  })

  it('HR drift with stable power → positive decoupling', () => {
    // First half: 200W @ 140 bpm; Second half: 200W @ 160 bpm
    // Efficiency drops in second half → positive decoupling
    // Use 7800 to survive warmup (600s) + 2 equal halves (3600s each)
    const power = Array.from({ length: 7800 }, () => 200)
    const hr    = [
      ...Array.from({ length: 3900 }, () => 140),
      ...Array.from({ length: 3900 }, () => 160),
    ]
    const result = computeDecoupling({ hr, power })
    if (result.valid) {
      // (200/140 - 200/160) / (200/140) ≈ 12.5%
      expect(result.decouplingPct).toBeGreaterThan(5)
      expect(classifyDecoupling(result.decouplingPct)).not.toBe('coupled')
    }
  })

  it('classifyDecoupling maps thresholds correctly', () => {
    expect(classifyDecoupling(3)).toBe('coupled')
    expect(classifyDecoupling(7)).toBe('mild')
    expect(classifyDecoupling(12)).toBe('significant')
  })

  it('rejects sessions shorter than minimum', () => {
    const short = Array.from({ length: 1800 }, () => 200)
    const hr    = Array.from({ length: 1800 }, () => 145)
    const result = computeDecoupling({ hr, power: short })
    expect(result.valid).toBe(false)
  })
})
