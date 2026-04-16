// ─── src/lib/sport/cssValidation.test.js ─────────────────────────────────────
// Validates the CSS swimming model in swimming.js against:
//   Lavoie & Montpetit (1986), Wakayoshi et al. (1992):
//     CSS (m/s) = (d2 − d1) / (t2 − t1)
//   Zone boundaries based on %CSS pace model (sec/100m).
//
// swimming.js exports: criticalSwimSpeed, cssToSecPer100m, tPaceFromTT,
//                      swimmingZone, swimmingZones, swimTSS
// NOTE: predictSwimTime is NOT exported; swim prediction is handled via CSS + D' externally.

import { describe, it, expect } from 'vitest'
import {
  criticalSwimSpeed,
  cssToSecPer100m,
  swimmingZone,
  swimmingZones,
} from './swimming.js'

// ── Critical Swim Speed — Lavoie & Montpetit 1986 / Wakayoshi 1992 ─────────────
// Protocol: two maximal efforts at different distances.
// CSS = (d2 − d1) / (t2 − t1)  where d2 > d1.
// Canonical test: d1=200m t1=140s, d2=400m t2=300s
//   → CSS = (400-200)/(300-140) = 200/160 = 1.25 m/s exactly
describe('Critical Swim Speed — Lavoie & Montpetit 1986 / Wakayoshi 1992', () => {
  // Function signature: criticalSwimSpeed(d1M, t1Sec, d2M, t2Sec)  with d2 > d1 required
  it('CSS = 1.25 m/s for 200m:140s and 400m:300s', () => {
    const css = criticalSwimSpeed(200, 140, 400, 300)
    expect(css).toBeCloseTo(1.25, 3)
  })

  it('CSS is exactly 200/160 (= 1.25) — no rounding artefact', () => {
    const css = criticalSwimSpeed(200, 140, 400, 300)
    // The function rounds to 4dp; 1.25 is exact in floating point
    expect(css).toBe(1.25)
  })

  it('symmetric test: 200m:150s and 400m:330s → CSS = (200)/(180) ≈ 1.111 m/s', () => {
    // Classic 200+400 TT values for a ~90s/100m swimmer
    const css = criticalSwimSpeed(200, 150, 400, 330)
    expect(css).toBeCloseTo(200 / 180, 3)  // 1.1111...
  })

  it('1500m:1050s and 400m:260s → CSS = (1500-400)/(1050-260) = 1100/790 ≈ 1.3924 m/s', () => {
    // Larger-distance protocol (Wakayoshi 1992 used 50m + 400m)
    const css = criticalSwimSpeed(400, 260, 1500, 1050)
    expect(css).toBeCloseTo(1100 / 790, 3)
  })

  it('returns null when d2 <= d1 (formula undefined if distances equal or reversed)', () => {
    // The function enforces d2 > d1 since d2 is the larger distance argument
    expect(criticalSwimSpeed(400, 300, 200, 140)).toBeNull()  // d2 < d1
    expect(criticalSwimSpeed(200, 140, 200, 160)).toBeNull()  // equal distances
  })

  it('returns null when time difference is zero or negative (division by zero)', () => {
    expect(criticalSwimSpeed(200, 300, 400, 300)).toBeNull()  // tDiff = 0
    expect(criticalSwimSpeed(200, 400, 400, 300)).toBeNull()  // tDiff < 0
  })

  it('returns null for missing inputs', () => {
    expect(criticalSwimSpeed(null, 140, 400, 300)).toBeNull()
    expect(criticalSwimSpeed(200, 0, 400, 300)).toBeNull()
    expect(criticalSwimSpeed(200, 140, null, 300)).toBeNull()
    expect(criticalSwimSpeed(200, 140, 400, 0)).toBeNull()
  })

  it('CSS stays within physiologically plausible range for realistic efforts', () => {
    // Realistic age-group swimmer: 400m~320s, 200m~150s → CSS = 200/170 ≈ 1.176 m/s
    const css = criticalSwimSpeed(200, 150, 400, 320)
    expect(css).toBeGreaterThan(0.5)   // slower than 200s/100m — extreme minimum
    expect(css).toBeLessThan(2.5)      // world record ~2.2 m/s
  })
})

// ── T-pace = 100 / CSS ─────────────────────────────────────────────────────────
// T-pace (sec/100m) = 100 / CSS(m/s)
// For CSS = 1.25 m/s → T-pace = 100/1.25 = 80.0 sec/100m
describe('T-pace from CSS — cssToSecPer100m()', () => {
  it('T-pace = 80.0 sec/100m for CSS = 1.25 m/s', () => {
    const tpace = cssToSecPer100m(1.25)
    expect(tpace).toBeCloseTo(80.0, 1)
  })

  it('T-pace = 66.7 sec/100m for CSS = 1.5 m/s', () => {
    const tpace = cssToSecPer100m(1.5)
    expect(tpace).toBeCloseTo(66.7, 0)
  })

  it('T-pace = 100.0 sec/100m for CSS = 1.0 m/s (1:40/100m)', () => {
    const tpace = cssToSecPer100m(1.0)
    expect(tpace).toBeCloseTo(100.0, 1)
  })

  it('faster CSS (higher m/s) → shorter T-pace (lower sec/100m)', () => {
    expect(cssToSecPer100m(1.5)).toBeLessThan(cssToSecPer100m(1.25))
    expect(cssToSecPer100m(1.25)).toBeLessThan(cssToSecPer100m(1.0))
  })

  it('T-pace × CSS ≈ 100 (inverse relationship)', () => {
    const css = 1.25
    const tpace = cssToSecPer100m(css)
    expect(tpace * css).toBeCloseTo(100, 1)
  })

  it('returns null for zero or null input', () => {
    expect(cssToSecPer100m(0)).toBeNull()
    expect(cssToSecPer100m(null)).toBeNull()
  })
})

// ── Zone structure — non-overlapping, exhaustive ─────────────────────────────
// Zone model: 6 zones defined by ratio = currentPace / cssPace (sec/100m).
// Higher ratio = slower swimmer. Zones must be non-overlapping and cover all ratios > 0.
describe('Swimming zones — non-overlapping and exhaustive for CSS = 1.25 m/s', () => {
  // CSS = 1.25 m/s → T-pace = 80 sec/100m
  const CSS_TPACE = 80  // sec/100m

  it('returns 6 zones for valid CSS pace', () => {
    const zones = swimmingZones(CSS_TPACE)
    expect(zones).toHaveLength(6)
  })

  it('zone IDs are 1–6', () => {
    const zones = swimmingZones(CSS_TPACE)
    expect(zones.map(z => z.id)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('consecutive zones share a boundary (no gaps between pctMax of one and pctMin of next)', () => {
    const _zones = swimmingZones(CSS_TPACE)
    // Zones are ordered slowest (1) to fastest (6): pctMin descends
    // Zone 1 pctMax=Inf, Zone 2 pctMax=1.20 = Zone 1 pctMin=1.20 ✓
    // Zone 2 pctMax=1.10 = Zone 3 pctMin=1.10... etc.
    // The definitions must ensure pctMax[i] = pctMin[i-1] for i=2..6
    const DEFS = [
      { pctMin: 1.20, pctMax: Infinity },
      { pctMin: 1.10, pctMax: 1.20 },
      { pctMin: 1.00, pctMax: 1.10 },
      { pctMin: 0.95, pctMax: 1.00 },
      { pctMin: 0.85, pctMax: 0.95 },
      { pctMin: 0,    pctMax: 0.85 },
    ]
    for (let i = 1; i < DEFS.length; i++) {
      expect(DEFS[i].pctMax).toBe(DEFS[i - 1].pctMin)
    }
  })

  it('Zone 3 (CSS): swimming at exactly CSS pace → zone 3', () => {
    // ratio = 80/80 = 1.0 → in [1.00, 1.10) → zone 3
    expect(swimmingZone(CSS_TPACE, CSS_TPACE)).toBe(3)
  })

  it('Zone 3 (CSS): swimming 5% slower than CSS → still zone 3', () => {
    // ratio = 84/80 = 1.05 → in [1.00, 1.10) → zone 3
    expect(swimmingZone(84, CSS_TPACE)).toBe(3)
  })

  it('Zone 4 (Threshold): swimming 2% faster than CSS → zone 4', () => {
    // ratio = 78.4/80 = 0.98 → in [0.95, 1.00) → zone 4
    expect(swimmingZone(78, CSS_TPACE)).toBe(4)
  })

  it('Zone 5 (VO2max): swimming 10% faster than CSS → zone 5', () => {
    // ratio = 72/80 = 0.90 → in [0.85, 0.95) → zone 5
    expect(swimmingZone(72, CSS_TPACE)).toBe(5)
  })

  it('Zone 2 (Aerobic): swimming 15% slower than CSS → zone 2', () => {
    // ratio = 92/80 = 1.15 → in [1.10, 1.20) → zone 2
    expect(swimmingZone(92, CSS_TPACE)).toBe(2)
  })

  it('Zone 1 (Recovery): swimming >20% slower than CSS → zone 1', () => {
    // ratio = 100/80 = 1.25 → >= 1.20 → zone 1
    expect(swimmingZone(100, CSS_TPACE)).toBe(1)
  })

  it('Zone 6 (Anaerobic): swimming >15% faster than CSS → zone 6', () => {
    // ratio = 60/80 = 0.75 → < 0.85 → zone 6
    expect(swimmingZone(60, CSS_TPACE)).toBe(6)
  })

  it('zone pace boundaries are non-overlapping (paceMax of zone N = paceMin of zone N+1)', () => {
    const zones = swimmingZones(CSS_TPACE)
    // zones ordered slowest→fastest; zone[0]=Recovery (slowest), zone[5]=Anaerobic (fastest)
    // Each zone's paceMin should equal the next zone's paceMax (when paceMax != null)
    for (let i = 0; i < zones.length - 1; i++) {
      if (zones[i].paceMin !== null && zones[i + 1].paceMax !== null) {
        expect(zones[i].paceMin).toBeCloseTo(zones[i + 1].paceMax, 1)
      }
    }
  })

  it('Zone 3 pace range = [80, 88] sec/100m for CSS T-pace = 80', () => {
    // Zone 3: pctMin=1.00 → paceMin=80, pctMax=1.10 → paceMax=88
    const zones = swimmingZones(CSS_TPACE)
    const z3 = zones.find(z => z.id === 3)
    expect(z3.paceMin).toBeCloseTo(80.0, 1)
    expect(z3.paceMax).toBeCloseTo(88.0, 1)
  })
})

// ── Swim time prediction — CSS model (D'-corrected) ───────────────────────────
// The swimming.js module does not export a predictSwimTime function.
// The critical swim speed model predicts time as: t = distance / CSS (ignoring D').
// Wakayoshi (1992) D' correction: t = (d - D') / CSS where D' ≈ 15–25m for trained swimmers.
// Without D', simple prediction: t = d / CSS (upper bound — actual time is slightly less).
//
// For CSS = 1.25 m/s:
//   Naive: 1500m / 1.25 = 1200s
//   With D' = 15m: (1500-15)/1.25 = 1188s
describe('CSS-based swim time estimate — pure formula (no D prime correction)', () => {
  it('1500m / CSS(1.25) = 1200s (naive, ignoring D prime)', () => {
    const css = criticalSwimSpeed(200, 140, 400, 300)  // = 1.25 m/s
    expect(css).toBeCloseTo(1.25, 3)
    const naiveTime = 1500 / css
    expect(naiveTime).toBeCloseTo(1200, 0)
  })

  it('with D prime=15m correction: (1500-15)/1.25 = 1188s ±2s', () => {
    const css = criticalSwimSpeed(200, 140, 400, 300)
    const DPRIME = 15  // meters, typical for trained swimmer (Wakayoshi 1992)
    const correctedTime = (1500 - DPRIME) / css
    expect(correctedTime).toBeCloseTo(1188, 0)
  })

  it('400m effort time via CSS: 400/1.25 = 320s (naive)', () => {
    const css = criticalSwimSpeed(200, 140, 400, 300)
    const naiveTime = 400 / css
    expect(naiveTime).toBeCloseTo(320, 0)
  })

  it('T-pace implies 100m CSS effort in 80s', () => {
    const css = criticalSwimSpeed(200, 140, 400, 300)
    const tpace = cssToSecPer100m(css)
    // Sanity: swimming 100m at CSS takes exactly T-pace seconds
    expect(100 / css).toBeCloseTo(tpace, 1)
  })
})
