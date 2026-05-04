// Coverage-gap sweep — src/lib/sport/swimming.js
// Tests CSS / T-pace / swim zones / sTSS based on Wakayoshi (1992).
import { describe, it, expect } from 'vitest'
import {
  criticalSwimSpeed,
  cssToSecPer100m,
  tPaceFromTT,
  swimmingZone,
  swimmingZones,
  swimTSS,
} from '../../sport/swimming.js'

// ─── criticalSwimSpeed — null / malformed inputs ────────────────────────────
describe('criticalSwimSpeed — null/malformed', () => {
  it('null inputs return null', () => {
    expect(criticalSwimSpeed(null, 160, 400, 340)).toBeNull()
    expect(criticalSwimSpeed(200, null, 400, 340)).toBeNull()
    expect(criticalSwimSpeed(200, 160, null, 340)).toBeNull()
    expect(criticalSwimSpeed(200, 160, 400, null)).toBeNull()
  })

  it('zero distances return null', () => {
    expect(criticalSwimSpeed(0, 160, 400, 340)).toBeNull()
    expect(criticalSwimSpeed(200, 160, 0, 340)).toBeNull()
  })

  it('d2 ≤ d1 returns null (cannot compute slope backwards)', () => {
    expect(criticalSwimSpeed(400, 340, 200, 160)).toBeNull()
    expect(criticalSwimSpeed(400, 340, 400, 350)).toBeNull()
  })

  it('non-positive time delta returns null', () => {
    expect(criticalSwimSpeed(200, 160, 400, 160)).toBeNull()
    expect(criticalSwimSpeed(200, 160, 400, 100)).toBeNull()
  })
})

// ─── criticalSwimSpeed — math ────────────────────────────────────────────────
describe('criticalSwimSpeed — computation', () => {
  it('400+200 standard test: (400-200)/(340-160) = 1.1111 m/s', () => {
    expect(criticalSwimSpeed(200, 160, 400, 340)).toBeCloseTo(1.1111, 4)
  })

  it('elite swimmer pace at ~1.6 m/s', () => {
    // 400m in 240s, 200m in 110s → 200/130 = 1.5385 m/s
    expect(criticalSwimSpeed(200, 110, 400, 240)).toBeCloseTo(1.5385, 3)
  })

  it('rounds to 4 decimal places', () => {
    const css = criticalSwimSpeed(200, 165, 400, 350)
    expect(css.toString().split('.')[1].length).toBeLessThanOrEqual(4)
  })

  it('absurdly fast result (>3 m/s) returns null (sanity guard)', () => {
    // 200m in 30s, 1000m in 60s → (800/30) = 26.7 m/s impossible
    expect(criticalSwimSpeed(200, 30, 1000, 60)).toBeNull()
  })
})

// ─── cssToSecPer100m ─────────────────────────────────────────────────────────
describe('cssToSecPer100m', () => {
  it('null/zero returns null', () => {
    expect(cssToSecPer100m(null)).toBeNull()
    expect(cssToSecPer100m(0)).toBeNull()
    expect(cssToSecPer100m(-1)).toBeNull()
  })

  it('1.5 m/s → 66.7 s/100m', () => {
    expect(cssToSecPer100m(1.5)).toBe(66.7)
  })

  it('1.0 m/s → 100 s/100m', () => {
    expect(cssToSecPer100m(1.0)).toBe(100)
  })

  it('rounds to 1 decimal', () => {
    expect(cssToSecPer100m(1.111)).toBe(90) // 100/1.111 = 90.009… → 90
  })
})

// ─── tPaceFromTT ─────────────────────────────────────────────────────────────
describe('tPaceFromTT', () => {
  it('null/zero inputs return null', () => {
    expect(tPaceFromTT(null, 900)).toBeNull()
    expect(tPaceFromTT(1000, null)).toBeNull()
    expect(tPaceFromTT(0, 900)).toBeNull()
    expect(tPaceFromTT(1000, 0)).toBeNull()
    expect(tPaceFromTT(-100, 900)).toBeNull()
    expect(tPaceFromTT(1000, -10)).toBeNull()
  })

  it('1000m / 900s → 90 s/100m', () => {
    expect(tPaceFromTT(1000, 900)).toBe(90)
  })

  it('1500m / 1350s → 90 s/100m', () => {
    expect(tPaceFromTT(1500, 1350)).toBe(90)
  })

  it('returns 1-decimal precision', () => {
    expect(tPaceFromTT(1000, 887)).toBe(88.7)
  })
})

// ─── swimmingZone — boundaries ───────────────────────────────────────────────
describe('swimmingZone', () => {
  it('null/zero CSS returns null', () => {
    expect(swimmingZone(100, null)).toBeNull()
    expect(swimmingZone(100, 0)).toBeNull()
    expect(swimmingZone(null, 90)).toBeNull()
  })

  it('Z1 recovery (≥120% CSS pace = 20%+ slower)', () => {
    expect(swimmingZone(120, 100)).toBe(1) // 1.20 boundary
    expect(swimmingZone(150, 100)).toBe(1)
  })

  it('Z2 aerobic (110–120% CSS pace)', () => {
    expect(swimmingZone(110, 100)).toBe(2)
    expect(swimmingZone(115, 100)).toBe(2)
  })

  it('Z3 CSS (100–110% CSS pace)', () => {
    expect(swimmingZone(100, 100)).toBe(3)
    expect(swimmingZone(105, 100)).toBe(3)
  })

  it('Z4 threshold (95–100% CSS pace = slightly faster)', () => {
    expect(swimmingZone(95, 100)).toBe(4)
    expect(swimmingZone(99, 100)).toBe(4)
  })

  it('Z5 VO2max (85–95% CSS pace)', () => {
    expect(swimmingZone(85, 100)).toBe(5)
    expect(swimmingZone(94, 100)).toBe(5)
  })

  it('Z6 anaerobic (<85% CSS pace = much faster)', () => {
    expect(swimmingZone(80, 100)).toBe(6)
    expect(swimmingZone(50, 100)).toBe(6)
  })

  it('extremely slow falls back to Z1', () => {
    // Above max threshold of 1.20 → falls into Z1 (Infinity bound)
    expect(swimmingZone(500, 100)).toBe(1)
  })
})

// ─── swimmingZones — array shape ─────────────────────────────────────────────
describe('swimmingZones', () => {
  it('null/zero CSS returns []', () => {
    expect(swimmingZones(null)).toEqual([])
    expect(swimmingZones(0)).toEqual([])
    expect(swimmingZones(-50)).toEqual([])
  })

  it('returns 6 zones for valid CSS', () => {
    const zones = swimmingZones(90)
    expect(zones).toHaveLength(6)
    expect(zones.map(z => z.id)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('Z1 has null pace bounds (open-ended slower)', () => {
    const zones = swimmingZones(90)
    const z1 = zones.find(z => z.id === 1)
    expect(z1.paceMin).toBeNull()
    expect(z1.paceMax).toBeNull()
  })

  it('zone names present and correct', () => {
    const zones = swimmingZones(90)
    expect(zones.find(z => z.id === 3).name).toBe('CSS')
    expect(zones.find(z => z.id === 5).name).toBe('VO2max')
    expect(zones.find(z => z.id === 6).name).toBe('Anaerobic')
  })

  it('pace boundaries scale linearly with CSS pace', () => {
    const zones = swimmingZones(90)
    const z3 = zones.find(z => z.id === 3) // CSS: 100–110%
    expect(z3.paceMin).toBe(90)   // 90 × 1.00
    expect(z3.paceMax).toBe(99)   // 90 × 1.10
  })
})

// ─── swimTSS — math correctness ──────────────────────────────────────────────
describe('swimTSS', () => {
  it('null/zero inputs return null', () => {
    expect(swimTSS(null, 90, 100)).toBeNull()
    expect(swimTSS(60, null, 100)).toBeNull()
    expect(swimTSS(60, 90, null)).toBeNull()
    expect(swimTSS(60, 90, 0)).toBeNull()
    expect(swimTSS(60, 0, 100)).toBeNull()
    expect(swimTSS(60, -90, 100)).toBeNull()
  })

  it('60 min @ CSS pace yields TSS=100 (definitional)', () => {
    expect(swimTSS(60, 100, 100)).toBe(100)
  })

  it('faster than CSS yields > 100 (higher IF)', () => {
    // IF = 100/90 = 1.111, IF² = 1.235 → 60/60 × 1.235 × 100 ≈ 123
    expect(swimTSS(60, 90, 100)).toBe(123)
  })

  it('slower than CSS yields < 100', () => {
    // IF = 100/120 = 0.833, IF² = 0.694 → 69
    expect(swimTSS(60, 120, 100)).toBe(69)
  })

  it('30-min @ CSS yields TSS=50', () => {
    expect(swimTSS(30, 100, 100)).toBe(50)
  })

  it('returns integer (rounded)', () => {
    const result = swimTSS(45, 95, 100)
    expect(Number.isInteger(result)).toBe(true)
  })
})
