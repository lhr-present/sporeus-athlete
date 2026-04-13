import { describe, it, expect } from 'vitest'
import {
  criticalSwimSpeed, cssToSecPer100m, tPaceFromTT,
  swimmingZone, swimmingZones, swimTSS,
} from './swimming.js'

// ── Critical Swim Speed ───────────────────────────────────────────────────────
describe('criticalSwimSpeed', () => {
  it('returns CSS in m/s from 200m and 400m TTs', () => {
    // 400m in 5:30 (330s), 200m in 2:30 (150s)
    const css = criticalSwimSpeed(200, 150, 400, 330)
    expect(css).toBeGreaterThan(0.8)  // realistic elite-ish swimmer
    expect(css).toBeLessThan(2.5)
  })

  it('returns null when d2 <= d1', () => {
    expect(criticalSwimSpeed(400, 330, 200, 150)).toBeNull()  // d2 < d1
    expect(criticalSwimSpeed(200, 150, 200, 150)).toBeNull()  // equal distances
  })

  it('returns null for invalid inputs', () => {
    expect(criticalSwimSpeed(null, 150, 400, 330)).toBeNull()
    expect(criticalSwimSpeed(200, 0, 400, 330)).toBeNull()
  })
})

// ── CSS to sec/100m ───────────────────────────────────────────────────────────
describe('cssToSecPer100m', () => {
  it('converts 1.5 m/s to ~66.7 sec/100m', () => {
    const t = cssToSecPer100m(1.5)
    expect(t).toBeCloseTo(66.7, 0)
  })

  it('returns null for zero or null', () => {
    expect(cssToSecPer100m(0)).toBeNull()
    expect(cssToSecPer100m(null)).toBeNull()
  })
})

// ── T-pace from TT ────────────────────────────────────────────────────────────
describe('tPaceFromTT', () => {
  it('computes 1:10/100m from 1000m in 7:00', () => {
    const pace = tPaceFromTT(1000, 7 * 60)
    expect(pace).toBeCloseTo(42, 0)  // 7*60/1000*100 = 42 sec/100m
  })

  it('returns null for invalid inputs', () => {
    expect(tPaceFromTT(0, 420)).toBeNull()
    expect(tPaceFromTT(1000, 0)).toBeNull()
  })
})

// ── Swimming zones ────────────────────────────────────────────────────────────
describe('swimmingZone', () => {
  it('returns zone 3 (CSS) when swimming at CSS pace', () => {
    expect(swimmingZone(70, 70)).toBe(3)  // pace = CSS pace, ratio = 1.0
  })

  it('returns zone 1 (Recovery) for very slow pace', () => {
    expect(swimmingZone(100, 70)).toBe(1)  // 43% slower → ratio 1.43 > 1.20
  })

  it('returns zone 6 (Anaerobic) for very fast pace', () => {
    expect(swimmingZone(55, 70)).toBe(6)  // 21% faster → ratio 0.79 < 0.85
  })

  it('returns null for invalid inputs', () => {
    expect(swimmingZone(null, 70)).toBeNull()
    expect(swimmingZone(70, 0)).toBeNull()
  })
})

describe('swimmingZones', () => {
  it('returns 6 zones for a valid CSS pace', () => {
    const zones = swimmingZones(70)
    expect(zones).toHaveLength(6)
    expect(zones[0].id).toBe(1)
    expect(zones[5].id).toBe(6)
  })

  it('returns empty array for invalid CSS pace', () => {
    expect(swimmingZones(0)).toEqual([])
    expect(swimmingZones(null)).toEqual([])
  })
})

// ── Swim TSS ──────────────────────────────────────────────────────────────────
describe('swimTSS', () => {
  it('returns 100 for 1h at CSS pace (IF=1.0)', () => {
    // cssSecPer100m = 70, currentSecPer100m = 70 → IF = 1.0, 60min → TSS = 100
    expect(swimTSS(60, 70, 70)).toBe(100)
  })

  it('faster pace gives higher TSS per hour', () => {
    const hard = swimTSS(60, 60, 70)  // faster than CSS → IF > 1.0
    const easy = swimTSS(60, 80, 70)  // slower than CSS → IF < 1.0
    expect(hard).toBeGreaterThan(100)
    expect(easy).toBeLessThan(100)
  })

  it('TSS scales linearly with duration', () => {
    const t30 = swimTSS(30, 70, 70)
    const t60 = swimTSS(60, 70, 70)
    expect(t60).toBeCloseTo(t30 * 2, 0)
  })

  it('returns null for invalid inputs', () => {
    expect(swimTSS(null, 70, 70)).toBeNull()
    expect(swimTSS(60, 0, 70)).toBeNull()
    expect(swimTSS(60, 70, 0)).toBeNull()
  })
})
