import { describe, it, expect } from 'vitest'
import { restqAnalysis, computeRESTQTrend, RESTQ_CITATION } from '../../athlete/restqTrend.js'

// ─── Helpers ────────────────────────────────────────────────────────────────
/**
 * Create a synthetic RESTQ history entry matching scoreRESTQ's return shape
 * plus the `date` field added by RESTQScreen.jsx.
 * Fields from scoreRESTQ: overall_stress, overall_recovery, balance, subscales,
 * interpretation, interpretationLabel, completeness
 */
function makeEntry(date, overall_stress, overall_recovery) {
  return {
    date,
    overall_stress,
    overall_recovery,
    balance: Math.round((overall_recovery - overall_stress) * 10) / 10,
    subscales: {},
    interpretation: 'adequate',
    interpretationLabel: { en: 'Adequate', tr: 'Yeterli' },
    completeness: 100,
  }
}

// ─── restqAnalysis: edge cases ───────────────────────────────────────────────
describe('restqAnalysis — empty input', () => {
  it('returns [] for empty array', () => {
    expect(restqAnalysis([])).toEqual([])
  })

  it('returns [] for single entry', () => {
    const h = [makeEntry('2026-01-01', 2.0, 4.0)]
    expect(restqAnalysis(h)).toEqual([])
  })

  it('returns [] for non-array input', () => {
    expect(restqAnalysis(null)).toEqual([])
    expect(restqAnalysis(undefined)).toEqual([])
  })
})

// ─── restqAnalysis: ≥2 entries ───────────────────────────────────────────────
describe('restqAnalysis — two or more entries', () => {
  it('returns correct srRatio for two entries', () => {
    const h = [
      makeEntry('2026-01-01', 2.0, 4.0),
      makeEntry('2026-01-08', 3.0, 3.6),
    ]
    const result = restqAnalysis(h)
    expect(result).toHaveLength(2)
    expect(result[0].stressScore).toBe(2.0)
    expect(result[0].recoveryScore).toBe(4.0)
    expect(result[0].srRatio).toBeCloseTo(2.0)
    expect(result[1].srRatio).toBeCloseTo(1.2)
  })

  it('sets srRatio to null when stressScore is 0', () => {
    const h = [
      makeEntry('2026-01-01', 0, 5.0),
      makeEntry('2026-01-08', 2.0, 3.0),
    ]
    const result = restqAnalysis(h)
    expect(result[0].srRatio).toBeNull()
    expect(result[0].status).toBe('ok')
  })

  it('sorts oldest to newest regardless of input order', () => {
    const h = [
      makeEntry('2026-03-01', 3.0, 3.0),
      makeEntry('2026-01-01', 2.0, 4.0),
    ]
    const result = restqAnalysis(h)
    expect(result[0].date).toBe('2026-01-01')
    expect(result[1].date).toBe('2026-03-01')
  })
})

// ─── restqAnalysis: status boundary conditions ───────────────────────────────
describe('restqAnalysis — status boundary conditions (Nederhof 2008)', () => {
  it('srRatio exactly 0.8 → warning (0.8–1.0 range, boundary inclusive)', () => {
    const h = [
      makeEntry('2026-01-01', 5.0, 4.0), // ratio = 0.8
      makeEntry('2026-01-08', 3.0, 4.5),
    ]
    const result = restqAnalysis(h)
    expect(result[0].srRatio).toBeCloseTo(0.8)
    expect(result[0].status).toBe('warning')
  })

  it('srRatio just below 0.8 → danger', () => {
    const h = [
      makeEntry('2026-01-01', 5.0, 3.9), // ratio ≈ 0.78
      makeEntry('2026-01-08', 3.0, 4.5),
    ]
    const result = restqAnalysis(h)
    expect(result[0].srRatio).toBeLessThan(0.8)
    expect(result[0].status).toBe('danger')
  })

  it('srRatio exactly 1.0 → ok (1.0–1.3 range, boundary inclusive)', () => {
    const h = [
      makeEntry('2026-01-01', 4.0, 4.0), // ratio = 1.0
      makeEntry('2026-01-08', 3.0, 4.5),
    ]
    const result = restqAnalysis(h)
    expect(result[0].srRatio).toBeCloseTo(1.0)
    expect(result[0].status).toBe('ok')
  })

  it('srRatio exactly 1.3 → ok (upper boundary)', () => {
    const h = [
      makeEntry('2026-01-01', 4.0, 5.2), // ratio = 1.3
      makeEntry('2026-01-08', 3.0, 4.5),
    ]
    const result = restqAnalysis(h)
    expect(result[0].srRatio).toBeCloseTo(1.3)
    expect(result[0].status).toBe('ok')
  })

  it('srRatio above 1.3 → good', () => {
    const h = [
      makeEntry('2026-01-01', 2.0, 3.0), // ratio = 1.5
      makeEntry('2026-01-08', 3.0, 4.5),
    ]
    const result = restqAnalysis(h)
    expect(result[0].srRatio).toBeCloseTo(1.5)
    expect(result[0].status).toBe('good')
  })
})

// ─── computeRESTQTrend: trend classification ─────────────────────────────────
describe('computeRESTQTrend — trend classification', () => {
  it('returns null trend if fewer than 4 entries', () => {
    const h = [
      makeEntry('2026-01-01', 3.0, 3.0),
      makeEntry('2026-01-08', 3.0, 3.6),
      makeEntry('2026-01-15', 3.0, 4.0),
    ]
    const result = computeRESTQTrend(h)
    expect(result.trend).toBeNull()
  })

  it('detects improving trend when second half mean > first half mean + 0.1', () => {
    const h = [
      makeEntry('2026-01-01', 4.0, 2.0), // srRatio = 0.5
      makeEntry('2026-01-08', 4.0, 2.4), // srRatio = 0.6
      makeEntry('2026-01-15', 2.0, 4.0), // srRatio = 2.0
      makeEntry('2026-01-22', 2.0, 4.4), // srRatio = 2.2
    ]
    const result = computeRESTQTrend(h)
    expect(result.trend).toBe('improving')
  })

  it('detects declining trend when second half mean < first half mean - 0.1', () => {
    const h = [
      makeEntry('2026-01-01', 2.0, 4.0), // srRatio = 2.0
      makeEntry('2026-01-08', 2.0, 4.4), // srRatio = 2.2
      makeEntry('2026-01-15', 4.0, 2.0), // srRatio = 0.5
      makeEntry('2026-01-22', 4.0, 2.4), // srRatio = 0.6
    ]
    const result = computeRESTQTrend(h)
    expect(result.trend).toBe('declining')
  })

  it('detects stable trend when halves differ by ≤0.1', () => {
    const h = [
      makeEntry('2026-01-01', 3.0, 3.6), // srRatio = 1.2
      makeEntry('2026-01-08', 3.0, 3.6), // srRatio = 1.2
      makeEntry('2026-01-15', 3.0, 3.6), // srRatio = 1.2
      makeEntry('2026-01-22', 3.0, 3.6), // srRatio = 1.2
    ]
    const result = computeRESTQTrend(h)
    expect(result.trend).toBe('stable')
  })

  it('sets latest to last analysis entry', () => {
    const h = [
      makeEntry('2026-01-01', 3.0, 3.0),
      makeEntry('2026-01-08', 2.0, 4.0),
    ]
    const result = computeRESTQTrend(h)
    expect(result.latest).not.toBeNull()
    expect(result.latest.date).toBe('2026-01-08')
  })

  it('includes citation string', () => {
    const result = computeRESTQTrend([])
    expect(result.citation).toBe(RESTQ_CITATION)
  })

  it('full pipeline with mixed statuses returns correct structure', () => {
    const h = [
      makeEntry('2026-01-01', 5.0, 3.5), // danger (0.7)
      makeEntry('2026-01-08', 4.0, 3.5), // warning (0.875)
      makeEntry('2026-01-15', 3.0, 3.5), // ok (1.17)
      makeEntry('2026-01-22', 2.0, 3.5), // good (1.75)
    ]
    const result = computeRESTQTrend(h)
    expect(result.analysis).toHaveLength(4)
    expect(result.analysis[0].status).toBe('danger')
    expect(result.analysis[1].status).toBe('warning')
    expect(result.analysis[2].status).toBe('ok')
    expect(result.analysis[3].status).toBe('good')
    expect(result.trend).toBe('improving')
    expect(result.latest.status).toBe('good')
  })
})
