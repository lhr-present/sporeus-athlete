import { describe, it, expect } from 'vitest'
import {
  paulsLaw, predict2000m, secToSplit, splitToVelocity, velocityToSplit, fmtSplit,
  concept2VO2max, rowingZone, rowingZones, fitCP,
  predict2000mFromMultipleTests,
} from './rowing.js'

// ── Paul's Law ────────────────────────────────────────────────────────────────
describe('paulsLaw', () => {
  it('predicts slower time for longer distance (exponent > 1)', () => {
    const t4k = paulsLaw(6 * 60, 2000, 4000)
    // Linearly it would be 12min; with 1.07 exponent it should be > 12min
    expect(t4k).toBeGreaterThan(12 * 60)
  })

  it('returns same time when distances are equal', () => {
    expect(paulsLaw(390, 2000, 2000)).toBeCloseTo(390, 0)
  })

  it('returns null for invalid inputs', () => {
    expect(paulsLaw(0, 2000, 4000)).toBeNull()
    expect(paulsLaw(390, 0, 4000)).toBeNull()
    expect(paulsLaw(390, 2000, 0)).toBeNull()
  })
})

// ── predict2000m ──────────────────────────────────────────────────────────────
describe('predict2000m', () => {
  it('predicts faster 2000m from a 5000m result (shorter = faster)', () => {
    // 5000m in 20 min → 2000m should be faster than 20 min × 2000/5000
    const pred = predict2000m(20 * 60, 5000)
    expect(pred).toBeLessThan(8 * 60)
    expect(pred).toBeGreaterThan(7 * 60)
  })

  it('returns exact input time when distance is already 2000m', () => {
    expect(predict2000m(390, 2000)).toBeCloseTo(390, 0)
  })
})

// ── Split conversions ─────────────────────────────────────────────────────────
describe('secToSplit', () => {
  it('computes correct split: 6:30/500m for 2000m in 26min', () => {
    const split = secToSplit(26 * 60, 2000)
    expect(split).toBeCloseTo(390, 0)  // 6.5 min = 390s
  })

  it('returns null for zero distance', () => {
    expect(secToSplit(390, 0)).toBeNull()
  })
})

describe('splitToVelocity / velocityToSplit', () => {
  it('round-trips correctly (split → velocity → split)', () => {
    const split = 120  // 2:00/500m
    const v     = splitToVelocity(split)
    const back  = velocityToSplit(v)
    expect(back).toBeCloseTo(split, 5)
  })

  it('returns null for zero or null inputs', () => {
    expect(splitToVelocity(0)).toBeNull()
    expect(velocityToSplit(0)).toBeNull()
  })
})

describe('fmtSplit', () => {
  it('formats 90 seconds as 1:30', () => {
    expect(fmtSplit(90)).toBe('1:30')
  })

  it('formats 120 seconds as 2:00', () => {
    expect(fmtSplit(120)).toBe('2:00')
  })

  it('returns "--:--" for null or zero', () => {
    expect(fmtSplit(null)).toBe('--:--')
    expect(fmtSplit(0)).toBe('--:--')
  })
})

// ── VO2max estimation ─────────────────────────────────────────────────────────
describe('concept2VO2max', () => {
  it('returns a positive number for a valid 2000m time', () => {
    const vo2 = concept2VO2max(6.5 * 60, 80)  // 6:30, 80kg
    expect(vo2).toBeGreaterThan(40)
    expect(vo2).toBeLessThan(80)
  })

  it('elite rower (~6:00 2000m, 80kg) has higher VO2 than recreational (7:00)', () => {
    const elite = concept2VO2max(6 * 60, 80)
    const rec   = concept2VO2max(7 * 60, 80)
    expect(elite).toBeGreaterThan(rec)
  })

  it('returns null for invalid inputs', () => {
    expect(concept2VO2max(0, 80)).toBeNull()
    expect(concept2VO2max(-1, 80)).toBeNull()
  })
})

// ── Rowing zones ──────────────────────────────────────────────────────────────
describe('rowingZone', () => {
  it('returns zone 5 when rowing at race pace (2k split)', () => {
    expect(rowingZone(120, 120)).toBe(5)
  })

  it('returns zone 1 (UT2) for very slow split', () => {
    const zone = rowingZone(180, 120)  // 50% slower than race pace
    expect(zone).toBe(1)
  })

  it('returns zone 7 (sprint) for significantly faster than race pace', () => {
    const zone = rowingZone(100, 120)  // 16.7% faster than race pace
    expect(zone).toBe(7)
  })

  it('returns null for invalid inputs', () => {
    expect(rowingZone(null, 120)).toBeNull()
    expect(rowingZone(120, 0)).toBeNull()
  })
})

describe('rowingZones', () => {
  it('returns 7 zones for a valid 2000m split', () => {
    const zones = rowingZones(120)
    expect(zones).toHaveLength(7)
    expect(zones[0].id).toBe(1)
    expect(zones[6].id).toBe(7)
  })

  it('each zone has splitMin and splitMax (except boundaries)', () => {
    const zones = rowingZones(120)
    // Zone 7 (fastest) has splitMin = null (no lower bound)
    const z7 = zones.find(z => z.id === 7)
    expect(z7.splitMin).toBeNull()
  })
})

// ── Critical Power ────────────────────────────────────────────────────────────
describe('fitCP', () => {
  it('returns { CP, WPrime } from two valid efforts', () => {
    // 3-min at 400W, 12-min at 300W
    const result = fitCP([
      { timeSec: 180, powerW: 400 },
      { timeSec: 720, powerW: 300 },
    ])
    expect(result).not.toBeNull()
    expect(result.CP).toBeGreaterThan(200)
    expect(result.WPrime).toBeGreaterThan(0)
  })

  it('returns null for fewer than 2 efforts', () => {
    expect(fitCP([{ timeSec: 180, powerW: 400 }])).toBeNull()
    expect(fitCP([])).toBeNull()
    expect(fitCP(null)).toBeNull()
  })
})

// ── Multi-test 2000m prediction ───────────────────────────────────────────────
describe('predict2000mFromMultipleTests', () => {
  it('returns predicted2000Sec for a single test', () => {
    const r = predict2000mFromMultipleTests([{ distanceM: 4000, timeSec: 14 * 60 }])
    expect(r).not.toBeNull()
    expect(r.predicted2000Sec).toBeGreaterThan(0)
    expect(r.confidenceInterval95).toBeNull()  // single test → no CI
  })

  it('returns mean prediction + CI for multiple tests', () => {
    const r = predict2000mFromMultipleTests([
      { distanceM: 2000, timeSec: 6 * 60 },
      { distanceM: 4000, timeSec: 14 * 60 },
      { distanceM: 6000, timeSec: 22 * 60 },
    ])
    expect(r.predicted2000Sec).toBeGreaterThan(0)
    expect(Array.isArray(r.confidenceInterval95)).toBe(true)
    expect(r.confidenceInterval95[0]).toBeLessThan(r.predicted2000Sec)
    expect(r.confidenceInterval95[1]).toBeGreaterThan(r.predicted2000Sec)
  })

  it('returns null for empty input', () => {
    expect(predict2000mFromMultipleTests([])).toBeNull()
    expect(predict2000mFromMultipleTests(null)).toBeNull()
  })
})
