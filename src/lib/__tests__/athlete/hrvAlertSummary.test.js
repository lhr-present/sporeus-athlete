// ── tests/athlete/hrvAlertSummary.test.js — E37 ────────────────────────────────
import { describe, it, expect } from 'vitest'
import { extractHRVSeries, computeHRVAlertState } from '../../athlete/hrvAlertSummary.js'

// ── Helpers ────────────────────────────────────────────────────────────────────
function makeRec(date, hrv) {
  return { date, hrv }
}

// Normal baseline: mean ~60, stddev ~4 so that current=58 is well within 2σ
const normalSeries = [
  makeRec('2024-01-01', 56),
  makeRec('2024-01-02', 64),
  makeRec('2024-01-03', 58),
  makeRec('2024-01-04', 62),
  makeRec('2024-01-05', 60),
  makeRec('2024-01-06', 60), // current — within 2σ of baseline
]

// Alert series: baseline ~60, current drops >2σ below
const alertSeries = [
  makeRec('2024-01-01', 62),
  makeRec('2024-01-02', 61),
  makeRec('2024-01-03', 60),
  makeRec('2024-01-04', 62),
  makeRec('2024-01-05', 61),
  makeRec('2024-01-06', 45), // current — well below 2σ
]

// Suppressed (sigma < -1.5 but >= -2.0)
const suppressedSeries = [
  makeRec('2024-01-01', 62),
  makeRec('2024-01-02', 60),
  makeRec('2024-01-03', 61),
  makeRec('2024-01-04', 60),
  makeRec('2024-01-05', 62),
  makeRec('2024-01-06', 55), // ~-1.7σ for this dataset
]

// ── extractHRVSeries ───────────────────────────────────────────────────────────
describe('extractHRVSeries', () => {
  it('returns empty array for no recovery data', () => {
    expect(extractHRVSeries([])).toEqual([])
    expect(extractHRVSeries()).toEqual([])
  })

  it('filters out null/zero hrv values', () => {
    const rec = [
      { date: '2024-01-01', hrv: null },
      { date: '2024-01-02', hrv: 0 },
      { date: '2024-01-03', hrv: 55 },
    ]
    const result = extractHRVSeries(rec)
    expect(result).toEqual([55])
  })

  it('filters out negative hrv values', () => {
    const rec = [
      { date: '2024-01-01', hrv: -5 },
      { date: '2024-01-02', hrv: 60 },
    ]
    expect(extractHRVSeries(rec)).toEqual([60])
  })

  it('sorts oldest to newest by date', () => {
    const rec = [
      { date: '2024-01-03', hrv: 70 },
      { date: '2024-01-01', hrv: 50 },
      { date: '2024-01-02', hrv: 60 },
    ]
    expect(extractHRVSeries(rec)).toEqual([50, 60, 70])
  })

  it('returns all valid hrv values when all are positive', () => {
    const result = extractHRVSeries(normalSeries)
    expect(result).toHaveLength(6)
    expect(result[0]).toBe(56)
    expect(result[result.length - 1]).toBe(60)
  })
})

// ── computeHRVAlertState — null cases ─────────────────────────────────────────
describe('computeHRVAlertState — null cases', () => {
  it('returns null for empty recovery', () => {
    expect(computeHRVAlertState([])).toBeNull()
    expect(computeHRVAlertState()).toBeNull()
  })

  it('returns null with fewer than 6 valid readings', () => {
    const rec = [
      makeRec('2024-01-01', 60),
      makeRec('2024-01-02', 62),
      makeRec('2024-01-03', 58),
      makeRec('2024-01-04', 61),
      makeRec('2024-01-05', 59),
    ]
    expect(computeHRVAlertState(rec)).toBeNull()
  })

  it('returns null when all hrv values are null', () => {
    const rec = Array.from({ length: 10 }, (_, i) => ({ date: `2024-01-0${i + 1}`, hrv: null }))
    expect(computeHRVAlertState(rec)).toBeNull()
  })
})

// ── computeHRVAlertState — shape ──────────────────────────────────────────────
describe('computeHRVAlertState — return shape', () => {
  it('returns correct fields for normal series', () => {
    const result = computeHRVAlertState(normalSeries)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('alert')
    expect(result).toHaveProperty('delta')
    expect(result).toHaveProperty('sigma')
    expect(result).toHaveProperty('mean')
    expect(result).toHaveProperty('stddev')
    expect(result).toHaveProperty('current')
    expect(result).toHaveProperty('status')
    expect(result).toHaveProperty('citation')
  })

  it('current equals last value in series', () => {
    const result = computeHRVAlertState(normalSeries)
    expect(result.current).toBe(60)
  })

  it('citation contains Plews 2012', () => {
    const result = computeHRVAlertState(normalSeries)
    expect(result.citation).toMatch(/Plews 2012/)
  })
})

// ── computeHRVAlertState — status logic ──────────────────────────────────────
describe('computeHRVAlertState — status logic', () => {
  it('normal series returns status=normal', () => {
    const result = computeHRVAlertState(normalSeries)
    expect(result.status).toBe('normal')
    expect(result.alert).toBe(false)
  })

  it('large drop returns status=alert', () => {
    const result = computeHRVAlertState(alertSeries)
    expect(result).not.toBeNull()
    expect(result.status).toBe('alert')
    expect(result.alert).toBe(true)
    expect(result.sigma).toBeLessThan(-2.0)
  })

  it('alert series has negative delta', () => {
    const result = computeHRVAlertState(alertSeries)
    expect(result.delta).toBeLessThan(0)
  })

  it('status is alert or suppressed or normal (exhaustive)', () => {
    const r = computeHRVAlertState(normalSeries)
    expect(['alert', 'suppressed', 'normal']).toContain(r.status)
  })
})
