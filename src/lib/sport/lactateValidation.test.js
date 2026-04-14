// ─── lactateValidation.test.js — D-max lactate threshold validation ────────────
// Cheng et al. 1992 D-max method implemented in lactate.js
// Exports tested: estimateLTFromStep

import { describe, it, expect } from 'vitest'
import { estimateLTFromStep } from './lactate.js'

// Classic J-shaped lactate curve (6 steps, well within D-max range).
// Numerical verification: cubic polynomial fitted to these points; D-max scan
// over 200 interior points yields lt2 ≈ 253.8 W (within 240–310 W).
const CLASSIC_CURVE = [
  { load: 100, lactate: 1.2 },
  { load: 150, lactate: 1.4 },
  { load: 200, lactate: 1.7 },
  { load: 250, lactate: 2.3 },
  { load: 300, lactate: 3.8 },
  { load: 350, lactate: 6.5 },
]

describe('D-max lactate threshold — Cheng et al. 1992', () => {
  it('D-max LT2 falls between 240–310 W for classic J-shaped curve', () => {
    const result = estimateLTFromStep(CLASSIC_CURVE)
    expect(result.error).toBeUndefined()
    // result.lt2 is the D-max threshold (same as result.lt)
    const lt2 = result.lt2 ?? result.lt
    expect(lt2).toBeGreaterThanOrEqual(240)
    expect(lt2).toBeLessThanOrEqual(310)
  })

  it('returns numeric ltLactate at the threshold load', () => {
    const result = estimateLTFromStep(CLASSIC_CURVE)
    expect(typeof result.ltLactate).toBe('number')
    expect(result.ltLactate).toBeGreaterThan(0)
  })

  it('returns a curve array with ≥ 2 points for chart rendering', () => {
    const result = estimateLTFromStep(CLASSIC_CURVE)
    expect(Array.isArray(result.curve)).toBe(true)
    expect(result.curve.length).toBeGreaterThanOrEqual(2)
  })

  it('LT1 (aerobic threshold) is less than LT2 (D-max) for J-shaped curve', () => {
    const result = estimateLTFromStep(CLASSIC_CURVE)
    if (result.lt1 !== null && result.lt2 !== null) {
      expect(result.lt1).toBeLessThan(result.lt2)
    }
  })

  it('collinear input (straight line, 3 points) does not crash — returns error gracefully', () => {
    // validateSteps requires ≥ 4 points; 3-point input returns {lt: null, error: ...}
    // The function must NOT throw — it returns a safe error object instead.
    let result
    expect(() => {
      result = estimateLTFromStep([
        { load: 100, lactate: 1.0 },
        { load: 200, lactate: 2.0 },
        { load: 300, lactate: 3.0 },
      ])
    }).not.toThrow()
    // Result should be a safe error object (lt: null) rather than an exception
    expect(result).toBeDefined()
    expect(result.lt).toBeNull()
    expect(typeof result.error).toBe('string')
  })

  it('collinear 4-point input (no curve inflection) does not crash', () => {
    // 4 collinear points satisfy minimum count but produce a near-degenerate cubic.
    // D-max will be near zero but the function must return a valid object, not throw.
    expect(() => {
      estimateLTFromStep([
        { load: 100, lactate: 1.0 },
        { load: 200, lactate: 2.0 },
        { load: 300, lactate: 3.0 },
        { load: 400, lactate: 4.0 },
      ])
    }).not.toThrow()
  })

  it('returns null for empty / missing input', () => {
    expect(estimateLTFromStep([]).lt).toBeNull()
    expect(estimateLTFromStep(null).lt).toBeNull()
    expect(estimateLTFromStep(undefined).lt).toBeNull()
  })

  it('D-max load is within the tested load range', () => {
    const result = estimateLTFromStep(CLASSIC_CURVE)
    const lt2 = result.lt2 ?? result.lt
    // Must be between first and last step load (100–350 W)
    expect(lt2).toBeGreaterThan(100)
    expect(lt2).toBeLessThan(350)
  })

  it('returns dmax (perpendicular distance) as a positive number', () => {
    const result = estimateLTFromStep(CLASSIC_CURVE)
    expect(typeof result.dmax).toBe('number')
    expect(result.dmax).toBeGreaterThan(0)
  })
})
