import { describe, it, expect } from 'vitest'
import {
  calculateTriathlonTSS, brickFatigueAdjustment, getTriathlonZones,
  TRIATHLON_DISTANCES, getDistanceProfile,
} from './triathlon.js'

// ── calculateTriathlonTSS ─────────────────────────────────────────────────────
describe('calculateTriathlonTSS', () => {
  it('returns null when all disciplines are null', () => {
    expect(calculateTriathlonTSS(null, null, null)).toBeNull()
  })

  it('returns correct swim-only TSS with 1.15× multiplier', () => {
    // swim at CSS pace for 60 min → base sTSS = 100, multiplied by 1.15
    const r = calculateTriathlonTSS(
      { durationMin: 60, currentSecPer100m: 70, cssSecPer100m: 70 },
      null, null,
    )
    expect(r).not.toBeNull()
    expect(r.swimTSS).toBeCloseTo(115, 0)
    expect(r.bikeTSS).toBeNull()
    expect(r.runTSS).toBeNull()
  })

  it('sums all three disciplines', () => {
    const r = calculateTriathlonTSS(
      { durationMin: 30, currentSecPer100m: 70, cssSecPer100m: 70 },
      { durationSec: 3600, avgNormalizedPowerW: 250, ftpW: 250 },
      { durationSec: 3600, hrAvg: 160, hrThresh: 160 },
    )
    expect(r.totalTSS).toBeGreaterThan(200)  // all three combined
    expect(r.swimTSS).toBeGreaterThan(0)
    expect(r.bikeTSS).toBeGreaterThan(0)
    expect(r.runTSS).toBeGreaterThan(0)
  })

  it('total TSS = sum of all non-null disciplines', () => {
    const r = calculateTriathlonTSS(
      null,
      { durationSec: 3600, avgNormalizedPowerW: 250, ftpW: 250 },
      { durationSec: 1800, hrAvg: 160, hrThresh: 160 },
    )
    const sum = (r.bikeTSS || 0) + (r.runTSS || 0)
    expect(r.totalTSS).toBeCloseTo(sum, 0)
  })
})

// ── brickFatigueAdjustment ────────────────────────────────────────────────────
describe('brickFatigueAdjustment', () => {
  it('returns 1.0 for zero bike TSS', () => {
    expect(brickFatigueAdjustment(0, 10)).toBe(1.0)
    expect(brickFatigueAdjustment(null, 10)).toBe(1.0)
  })

  it('returns multiplier > 1.0 for positive bike TSS', () => {
    const m = brickFatigueAdjustment(150, 10)
    expect(m).toBeGreaterThan(1.0)
  })

  it('longer run amplifies the fatigue adjustment', () => {
    const shortRun = brickFatigueAdjustment(150, 5)
    const longRun  = brickFatigueAdjustment(150, 21)
    expect(longRun).toBeGreaterThan(shortRun)
  })

  it('degradation is capped (max ~15% + modifier)', () => {
    // Very high TSS should not give absurd multiplier
    const m = brickFatigueAdjustment(2000, 42)
    expect(m).toBeLessThan(1.30)
  })
})

// ── getTriathlonZones ─────────────────────────────────────────────────────────
describe('getTriathlonZones', () => {
  it('returns zones for all three disciplines when all inputs provided', () => {
    const z = getTriathlonZones(250, 50, 70)
    expect(z).not.toBeNull()
    expect(z.cycling).toBeDefined()
    expect(z.running).toBeDefined()
    expect(z.swimming).toBeDefined()
  })

  it('returns only cycling zones when only FTP provided', () => {
    const z = getTriathlonZones(250, null, null)
    expect(z.cycling).toBeDefined()
    expect(z.running).toBeUndefined()
    expect(z.swimming).toBeUndefined()
  })

  it('returns null when all inputs are null', () => {
    expect(getTriathlonZones(null, null, null)).toBeNull()
  })

  it('cycling zones array has 7 zones', () => {
    const z = getTriathlonZones(300, null, null)
    expect(z.cycling).toHaveLength(7)
  })
})

// ── TRIATHLON_DISTANCES / getDistanceProfile ──────────────────────────────────
describe('TRIATHLON_DISTANCES', () => {
  it('has 4 distance profiles', () => {
    expect(Object.keys(TRIATHLON_DISTANCES)).toHaveLength(4)
  })

  it('full distance has longer swim/bike/run than sprint', () => {
    expect(TRIATHLON_DISTANCES.full.bike).toBeGreaterThan(TRIATHLON_DISTANCES.sprint.bike)
    expect(TRIATHLON_DISTANCES.full.run).toBeGreaterThan(TRIATHLON_DISTANCES.sprint.run)
  })
})

describe('getDistanceProfile', () => {
  it('returns the correct profile for "olympic"', () => {
    const p = getDistanceProfile('olympic')
    expect(p).not.toBeNull()
    expect(p.swim).toBe(1.5)
    expect(p.run).toBe(10)
  })

  it('returns null for unknown key', () => {
    expect(getDistanceProfile('ultraman')).toBeNull()
  })
})
