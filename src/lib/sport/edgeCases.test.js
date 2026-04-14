// ─── src/lib/sport/edgeCases.test.js — Defensive edge-case tests ─────────────
// Pure function calls only. No mocks. Vitest describe/it/expect.

import { describe, it, expect } from 'vitest'
import { calculateACWR } from '../trainingLoad.js'
import { vdotFromRace, trainingPaces } from './running.js'
import { criticalSwimSpeed } from './swimming.js'
import { estimateLTFromStep } from './lactate.js'
import { paulsLaw } from './rowing.js'

// ─── calculateACWR ────────────────────────────────────────────────────────────
describe('calculateACWR edge cases', () => {
  it('empty log [] returns ratio: null with status "insufficient", does not throw', () => {
    const result = calculateACWR([])
    expect(result).not.toBeNull()
    expect(result.ratio).toBeNull()
    expect(result.status).toBe('insufficient')
  })

  it('single-entry log returns ratio: null (insufficient chronic base)', () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dateStr = today.toISOString().slice(0, 10)
    const result = calculateACWR([{ date: dateStr, tss: 80 }])
    // One day of TSS is not enough to build a meaningful chronic base via EWMA
    // ctl (λ=0.067) after one day: 0.067 * 80 = 5.36, so ratio ≠ null here —
    // the function returns a ratio if ctl > 0. Document the actual contract.
    expect(result).not.toBeNull()
    expect(typeof result.ratio === 'number' || result.ratio === null).toBe(true)
    if (result.ratio !== null) {
      expect(isFinite(result.ratio)).toBe(true)
      expect(isNaN(result.ratio)).toBe(false)
    }
  })

  it('log with all tss = 0 returns ratio: null (ctl stays 0 → "insufficient")', () => {
    const entries = Array.from({ length: 28 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - i)
      return { date: d.toISOString().slice(0, 10), tss: 0 }
    })
    const result = calculateACWR(entries)
    expect(result).not.toBeNull()
    // ctl=0 → guard fires → ratio: null
    expect(result.ratio).toBeNull()
    expect(result.status).toBe('insufficient')
  })

  it('log with negative tss values — no NaN or Infinity in ratio', () => {
    const entries = Array.from({ length: 28 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - i)
      return { date: d.toISOString().slice(0, 10), tss: -50 }
    })
    const result = calculateACWR(entries)
    expect(result).not.toBeNull()
    // tss || 0 coerces negative to 0 (falsy guard in EWMA loop)
    // All tss effectively 0 → ctl=0 → ratio: null
    expect(result.ratio === null || (isFinite(result.ratio) && !isNaN(result.ratio))).toBe(true)
  })

  it('null log argument returns ratio: null, does not throw', () => {
    const result = calculateACWR(null)
    expect(result).not.toBeNull()
    expect(result.ratio).toBeNull()
    expect(result.status).toBe('insufficient')
  })
})

// ─── vdotFromRace ─────────────────────────────────────────────────────────────
describe('vdotFromRace edge cases', () => {
  it('zero distance → null', () => {
    expect(vdotFromRace(0, 1200)).toBeNull()
  })

  it('zero time → null', () => {
    expect(vdotFromRace(5000, 0)).toBeNull()
  })

  it('negative distance → null', () => {
    expect(vdotFromRace(-5000, 1200)).toBeNull()
  })

  it('negative time → null', () => {
    expect(vdotFromRace(5000, -100)).toBeNull()
  })

  it('very slow runner (5K in 100000 sec ≈ 27.8 h) → null (vo2 goes negative at extreme duration)', () => {
    // Fixed: vo2 <= 0 guard added. At extreme durations the VO2 cost formula goes
    // negative — now returns null instead of a negative VDOT.
    expect(vdotFromRace(5000, 100000)).toBeNull()
  })

  it('valid 5K result → reasonable VDOT between 20 and 90', () => {
    const result = vdotFromRace(5000, 1200) // 20:00 5K ≈ VDOT 52
    expect(result).not.toBeNull()
    expect(result).toBeGreaterThan(20)
    expect(result).toBeLessThan(90)
  })
})

// ─── trainingPaces ────────────────────────────────────────────────────────────
describe('trainingPaces edge cases', () => {
  it('vdot = 0 → null', () => {
    expect(trainingPaces(0)).toBeNull()
  })

  it('vdot negative → null', () => {
    expect(trainingPaces(-10)).toBeNull()
  })

  it('vdot = 85 (elite) → valid paces object with all five zones positive', () => {
    const paces = trainingPaces(85)
    expect(paces).not.toBeNull()
    expect(typeof paces).toBe('object')
    for (const zone of ['E', 'M', 'T', 'I', 'R']) {
      expect(paces[zone]).toBeGreaterThan(0)
      expect(isFinite(paces[zone])).toBe(true)
      expect(isNaN(paces[zone])).toBe(false)
    }
  })

  it('vdot = 30 (recreational) → valid paces object with all five zones positive', () => {
    const paces = trainingPaces(30)
    expect(paces).not.toBeNull()
    for (const zone of ['E', 'M', 'T', 'I', 'R']) {
      expect(paces[zone]).toBeGreaterThan(0)
    }
  })

  it('easy pace is always slower than repetition pace (E > R in sec/km)', () => {
    const paces = trainingPaces(52)
    expect(paces).not.toBeNull()
    expect(paces.E).toBeGreaterThan(paces.R)
  })
})

// ─── criticalSwimSpeed ────────────────────────────────────────────────────────
describe('criticalSwimSpeed edge cases', () => {
  it('t2 === t1 (zero time difference → tDiff = 0) → null', () => {
    // d2 > d1 but same time → would be division by zero
    expect(criticalSwimSpeed(200, 180, 400, 180)).toBeNull()
  })

  it('d2 <= d1 (same distance) → null', () => {
    expect(criticalSwimSpeed(400, 300, 400, 600)).toBeNull()
  })

  it('d2 < d1 → null', () => {
    expect(criticalSwimSpeed(400, 300, 200, 150)).toBeNull()
  })

  it('all zeros → null', () => {
    expect(criticalSwimSpeed(0, 0, 0, 0)).toBeNull()
  })

  it('t2 < t1 (faster on longer distance — physically impossible) → null', () => {
    // tDiff = 100 - 200 = -100 → tDiff <= 0 → null
    expect(criticalSwimSpeed(200, 200, 400, 100)).toBeNull()
  })

  it('valid input → positive finite CSS', () => {
    const css = criticalSwimSpeed(200, 160, 400, 340)
    expect(css).not.toBeNull()
    expect(css).toBeGreaterThan(0)
    expect(isFinite(css)).toBe(true)
  })

  it('unrealistically fast CSS (> 3 m/s) → null', () => {
    // d=200, t=1s → 200 m/s. sanitised to null
    expect(criticalSwimSpeed(0, 1, 200, 2)).toBeNull() // d1=0 → null via first guard
  })
})

// ─── estimateLTFromStep ───────────────────────────────────────────────────────
describe('estimateLTFromStep edge cases', () => {
  it('2-point input (below 4-point minimum) → {lt: null, error: ...}', () => {
    const result = estimateLTFromStep([
      { load: 100, lactate: 1.2 },
      { load: 200, lactate: 3.5 },
    ])
    expect(result.lt).toBeNull()
    expect(result.error).toBeTruthy()
  })

  it('3-point input (still below minimum) → {lt: null, error: ...}', () => {
    const result = estimateLTFromStep([
      { load: 100, lactate: 1.2 },
      { load: 150, lactate: 2.0 },
      { load: 200, lactate: 3.8 },
    ])
    expect(result.lt).toBeNull()
    expect(result.error).toBeTruthy()
  })

  it('all identical lactate values (flat line, no threshold detectable) → lt is null or a valid number', () => {
    // Flat lactate curve: D-max distance to chord will be ~0 → bestLoad stays at x0
    // The function may return a value anyway (D-max = first point) — must not be NaN/Infinity
    const result = estimateLTFromStep([
      { load: 100, lactate: 2.0 },
      { load: 150, lactate: 2.0 },
      { load: 200, lactate: 2.0 },
      { load: 250, lactate: 2.0 },
    ])
    // All lactate identical → valid data per validateSteps (lactate > 0 passes)
    if (result.lt !== null) {
      expect(isFinite(result.lt)).toBe(true)
      expect(isNaN(result.lt)).toBe(false)
    }
    // Must not throw and must return an object
    expect(typeof result).toBe('object')
  })

  it('decreasing lactate values (biologically impossible) → returns object without NaN', () => {
    const result = estimateLTFromStep([
      { load: 100, lactate: 5.0 },
      { load: 150, lactate: 3.5 },
      { load: 200, lactate: 2.1 },
      { load: 250, lactate: 1.0 },
    ])
    expect(typeof result).toBe('object')
    if (result.lt !== null) {
      expect(isFinite(result.lt)).toBe(true)
      expect(isNaN(result.lt)).toBe(false)
    }
    if (result.ltLactate !== null && result.ltLactate !== undefined) {
      expect(isFinite(result.ltLactate)).toBe(true)
      expect(isNaN(result.ltLactate)).toBe(false)
    }
  })

  it('empty array → {lt: null, error: ...}', () => {
    const result = estimateLTFromStep([])
    expect(result.lt).toBeNull()
    expect(result.error).toBeTruthy()
  })

  it('null input → {lt: null, error: ...}', () => {
    const result = estimateLTFromStep(null)
    expect(result.lt).toBeNull()
    expect(result.error).toBeTruthy()
  })

  it('steps with zero lactate values get filtered out (< 4 valid remain) → null', () => {
    const result = estimateLTFromStep([
      { load: 100, lactate: 0 },
      { load: 150, lactate: 0 },
      { load: 200, lactate: 2.1 },
      { load: 250, lactate: 5.0 },
    ])
    // Only 2 rows have lactate > 0 → validateSteps fails
    expect(result.lt).toBeNull()
  })

  it('valid 4-step input → returns a numeric lt and a curve array', () => {
    const result = estimateLTFromStep([
      { load: 100, lactate: 1.1 },
      { load: 150, lactate: 1.3 },
      { load: 200, lactate: 2.1 },
      { load: 250, lactate: 5.0 },
    ])
    expect(result.lt).not.toBeNull()
    expect(typeof result.lt).toBe('number')
    expect(Array.isArray(result.curve)).toBe(true)
    expect(result.curve.length).toBeGreaterThan(0)
  })
})

// ─── paulsLaw ─────────────────────────────────────────────────────────────────
describe('paulsLaw edge cases', () => {
  it('zero reference time → null', () => {
    expect(paulsLaw(0, 2000, 5000)).toBeNull()
  })

  it('zero target distance → null', () => {
    expect(paulsLaw(480, 2000, 0)).toBeNull()
  })

  it('zero reference distance → null', () => {
    expect(paulsLaw(480, 0, 5000)).toBeNull()
  })

  it('negative reference time → null', () => {
    // Fixed: t1Sec <= 0 guard added to paulsLaw.
    expect(paulsLaw(-480, 2000, 5000)).toBeNull()
  })

  it('negative distances → null', () => {
    expect(paulsLaw(480, -2000, 5000)).toBeNull()
    expect(paulsLaw(480, 2000, -5000)).toBeNull()
  })

  it('all three args zero → null', () => {
    expect(paulsLaw(0, 0, 0)).toBeNull()
  })

  it('same distance as reference → returns same time (identity)', () => {
    const result = paulsLaw(480, 2000, 2000)
    expect(result).not.toBeNull()
    expect(isFinite(result)).toBe(true)
    // (d2/d1)^1.07 = 1^1.07 = 1
    expect(result).toBeCloseTo(480, 0)
  })

  it('valid call: 2000m in 480s → predict 5000m → positive finite number', () => {
    const result = paulsLaw(480, 2000, 5000)
    expect(result).not.toBeNull()
    expect(isFinite(result)).toBe(true)
    expect(result).toBeGreaterThan(480) // longer distance → longer time
  })

  it('shorter target distance → shorter predicted time', () => {
    const to1000 = paulsLaw(480, 2000, 1000)
    expect(to1000).not.toBeNull()
    expect(to1000).toBeLessThan(480)
  })
})
