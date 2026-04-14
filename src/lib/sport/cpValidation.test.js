// ─── cpValidation.test.js — Critical Power & Paul's Law validation ────────────
// Morton 1986 hyperbolic CP model and Paul's Law (British Rowing exponent 1.07)
// Exports tested: fitCP, paulsLaw from rowing.js

import { describe, it, expect } from 'vitest'
import { fitCP, paulsLaw } from './rowing.js'

// ── Helper: build fitCP input from (durationSec, totalWork) pairs ──────────────
// fitCP expects [{ timeSec, powerW }]; convert from {durationSec, totalWork}
function fromWork(pts) {
  return pts.map(({ durationSec, totalWork }) => ({
    timeSec: durationSec,
    powerW:  totalWork / durationSec,
  }))
}

// Three points on the W = CP×t + W' hyperbola:
//   180s → 72000 J  (400 W)
//   480s → 148800 J (310 W)
//  1200s → 324000 J (270 W)
// OLS regression on these points yields:
//   CP ≈ 246.4 W   (sumXY formula; verified numerically)
//   W' ≈ 28847 J
//   r²  ≈ 0.9999   (points lie very close to the fitted line)
const THREE_POINT_EFFORTS = [
  { durationSec: 180,  totalWork: 72000  },
  { durationSec: 480,  totalWork: 148800 },
  { durationSec: 1200, totalWork: 324000 },
]

describe('Critical Power model — Morton 1986 hyperbolic CP', () => {
  it('fitCP returns CP ≈ 246 W (±5) for three-point hyperbolic input', () => {
    // toBeCloseTo(246, 0) uses tolerance 0.5 — too tight for rounded output.
    // fitCP returns CP rounded to one decimal; actual = 246.4 W.
    // We use a manual ±5 W assertion to match the ±10 intent in the spec
    // while reflecting the true regression result (not the illustrative 255 W).
    const result = fitCP(fromWork(THREE_POINT_EFFORTS))
    expect(result).not.toBeNull()
    expect(result.CP).toBeGreaterThanOrEqual(241)
    expect(result.CP).toBeLessThanOrEqual(251)
  })

  it("fitCP returns W' ≈ 28847 J (±2000) for same input", () => {
    const result = fitCP(fromWork(THREE_POINT_EFFORTS))
    expect(result).not.toBeNull()
    // toBeCloseTo(28847, -3) → tolerance = 10^3 / 2 = 500 J — too tight for ±2000 intent.
    // Use explicit range: [26847, 30847]
    expect(result.WPrime).toBeGreaterThanOrEqual(26847)
    expect(result.WPrime).toBeLessThanOrEqual(30847)
  })

  it('r² ≥ 0.99 for points on hyperbolic curve', () => {
    // fitCP does not expose r² — compute it manually from the returned CP / W'
    const input  = fromWork(THREE_POINT_EFFORTS)
    const result = fitCP(input)
    expect(result).not.toBeNull()

    const { CP, WPrime } = result
    const xs    = input.map(e => e.timeSec)
    const ys    = input.map(e => e.powerW * e.timeSec)   // total work
    const yMean = ys.reduce((a, b) => a + b, 0) / ys.length
    const ssTot = ys.reduce((a, y) => a + (y - yMean) ** 2, 0)
    const ssRes = ys.reduce((a, y, i) => {
      const yHat = CP * xs[i] + WPrime
      return a + (y - yHat) ** 2
    }, 0)
    const r2 = 1 - ssRes / ssTot
    expect(r2).toBeGreaterThanOrEqual(0.99)
  })

  it('fitCP returns null for fewer than 2 points', () => {
    expect(fitCP([])).toBeNull()
    expect(fitCP([{ timeSec: 300, powerW: 300 }])).toBeNull()
  })

  it('fitCP returns null for invalid input (null / undefined)', () => {
    expect(fitCP(null)).toBeNull()
    expect(fitCP(undefined)).toBeNull()
  })

  it('CP and WPrime are both positive for valid input', () => {
    const result = fitCP(fromWork(THREE_POINT_EFFORTS))
    expect(result.CP).toBeGreaterThan(0)
    expect(result.WPrime).toBeGreaterThan(0)
  })
})

describe("Paul's Law — rowing time prediction", () => {
  it('same-distance prediction returns same time (identity)', () => {
    // paulsLaw(t, d, d) = t × (d/d)^1.07 = t × 1 = t
    const t = paulsLaw(440, 2000, 2000)
    expect(t).toBeCloseTo(440, 0)
  })

  it('paulsLaw(440, 2000, 5000) ≈ 1173 s (±5 s)', () => {
    // t2 = 440 × (5000/2000)^1.07 = 440 × 2.5^1.07 ≈ 1172.87 s
    // toBeCloseTo(1173, -1) → tolerance = 10^1 / 2 = 5 s ✓
    const t = paulsLaw(440, 2000, 5000)
    expect(t).toBeCloseTo(1173, -1)
  })

  it('paulsLaw(440, 2000, 500) — shorter distance gives shorter time', () => {
    // 500m should be much faster than 440 s (the 2000m time)
    const t = paulsLaw(440, 2000, 500)
    expect(t).toBeGreaterThan(0)
    expect(t).toBeLessThan(440)
  })

  it('paulsLaw returns null for zero or missing distances', () => {
    expect(paulsLaw(440, 0, 2000)).toBeNull()
    expect(paulsLaw(440, 2000, 0)).toBeNull()
    expect(paulsLaw(0, 2000, 5000)).toBeNull()
    expect(paulsLaw(null, 2000, 5000)).toBeNull()
  })

  it('scaling is monotone: longer distance → longer time', () => {
    const t2000 = paulsLaw(440, 2000, 2000)
    const t5000 = paulsLaw(440, 2000, 5000)
    const t500  = paulsLaw(440, 2000, 500)
    expect(t500).toBeLessThan(t2000)
    expect(t2000).toBeLessThan(t5000)
  })
})
