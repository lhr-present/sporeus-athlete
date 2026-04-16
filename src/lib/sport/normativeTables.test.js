// ─── sport/normativeTables.test.js — Normative table tests ────────────────────
import { describe, it, expect } from 'vitest'
import {
  getFTPNorm,
  getVO2maxNorm,
  getCTLNorm,
} from './normativeTables.js'

// ── getFTPNorm ────────────────────────────────────────────────────────────────

describe('getFTPNorm', () => {
  it('returns percentile within 0–100 for all cycling male rows', () => {
    const testValues = [1.0, 2.0, 2.8, 3.5, 4.5, 6.0]
    for (const v of testValues) {
      const { percentile } = getFTPNorm('cycling', 'male', v)
      expect(percentile).toBeGreaterThanOrEqual(0)
      expect(percentile).toBeLessThanOrEqual(100)
    }
  })

  it('is monotonically non-decreasing as FTP/kg increases', () => {
    const values = [1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5]
    let prev = -1
    for (const v of values) {
      const { percentile } = getFTPNorm('cycling', 'male', v)
      expect(percentile).toBeGreaterThanOrEqual(prev)
      prev = percentile
    }
  })

  it('returns correct category for a trained male cyclist at 3.2 w/kg', () => {
    const { category } = getFTPNorm('cycling', 'male', 3.2)
    expect(category).toBe('Trained')
  })

  it('returns correct category for elite male cyclist at 5.5 w/kg', () => {
    const { category } = getFTPNorm('cycling', 'male', 5.5)
    expect(category).toBe('Elite')
  })

  it('handles female triathlon correctly', () => {
    const { percentile, category } = getFTPNorm('triathlon', 'female', 2.5)
    expect(percentile).toBeGreaterThanOrEqual(0)
    expect(percentile).toBeLessThanOrEqual(100)
    expect(typeof category).toBe('string')
  })

  it('returns Unknown for missing sport', () => {
    const result = getFTPNorm('swimming', 'male', 3.0)
    expect(result.category).toBe('Unknown')
    expect(result.percentile).toBe(0)
  })
})

// ── getVO2maxNorm ─────────────────────────────────────────────────────────────

describe('getVO2maxNorm', () => {
  it('returns percentile within 0–100 for all sport/age combos', () => {
    const sports = ['running', 'cycling', 'rowing', 'swimming']
    const ages   = [22, 35, 45, 55, 65]
    for (const sport of sports) {
      for (const age of ages) {
        const { percentile } = getVO2maxNorm(sport, age, 'male', 45)
        expect(percentile).toBeGreaterThanOrEqual(0)
        expect(percentile).toBeLessThanOrEqual(100)
      }
    }
  })

  it('is monotonically non-decreasing as VO2max increases', () => {
    const values = [25, 30, 35, 40, 45, 50, 55, 60]
    let prev = -1
    for (const v of values) {
      const { percentile } = getVO2maxNorm('running', 30, 'male', v)
      expect(percentile).toBeGreaterThanOrEqual(prev)
      prev = percentile
    }
  })

  it('returns Good for a 35yo male runner at 45 mL/kg/min', () => {
    const { category } = getVO2maxNorm('running', 35, 'male', 45)
    expect(category).toBe('Good')
  })

  it('handles age 65 → 60+ bracket', () => {
    const { percentile } = getVO2maxNorm('cycling', 65, 'male', 35)
    expect(percentile).toBeGreaterThan(0)
  })
})

// ── getCTLNorm ────────────────────────────────────────────────────────────────

describe('getCTLNorm', () => {
  it('returns Typical when CTL is within typical range', () => {
    const { status } = getCTLNorm('cycling', 'amateur', 65)
    expect(status).toBe('Typical')
  })

  it('returns Building when CTL is below typical range', () => {
    const { status } = getCTLNorm('cycling', 'amateur', 30)
    expect(status).toBe('Building')
  })

  it('returns High when CTL is above typical but below peak', () => {
    const { status } = getCTLNorm('cycling', 'amateur', 90)
    expect(status).toBe('High')
  })

  it('returns typical and peak arrays with 2 elements each', () => {
    const { typical, peak } = getCTLNorm('running', 'masters', 60)
    expect(typical).toHaveLength(2)
    expect(peak).toHaveLength(2)
  })

  it('returns Unknown for missing sport/level combo', () => {
    const { status } = getCTLNorm('badminton', 'elite', 50)
    expect(status).toBe('Unknown')
  })
})
