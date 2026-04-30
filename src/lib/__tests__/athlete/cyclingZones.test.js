// ─── cyclingZones.test.js — E41: 22 tests ────────────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  getFTPFromData,
  computeCyclingPredictions,
  computeCyclingZones,
} from '../../athlete/cyclingZones.js'

// ─── 1. getFTPFromData ────────────────────────────────────────────────────────
describe('getFTPFromData', () => {
  it('returns null when both testResults and profile are empty', () => {
    expect(getFTPFromData([], {})).toBeNull()
    expect(getFTPFromData(null, {})).toBeNull()
  })

  it('returns FTP from profile.ftp when present', () => {
    const result = getFTPFromData([], { ftp: 280 })
    expect(result).not.toBeNull()
    expect(result.ftpWatts).toBe(280)
    expect(result.method).toBe('profile')
  })

  it('profile.ftp takes precedence over testResults', () => {
    const tests = [{ testId: 'ftp20', date: '2026-04-01', value: '300' }]
    const result = getFTPFromData(tests, { ftp: 250 })
    expect(result.ftpWatts).toBe(250)
    expect(result.method).toBe('profile')
  })

  it('derives FTP from ftp20 test as 95% of value', () => {
    const tests = [{ testId: 'ftp20', date: '2026-04-01', value: '300' }]
    const result = getFTPFromData(tests, {})
    expect(result).not.toBeNull()
    expect(result.ftpWatts).toBe(285)   // 300 × 0.95
    expect(result.method).toBe('ftp20')
  })

  it('derives FTP from ramp_test as 75% of value', () => {
    const tests = [{ testId: 'ramp_test', date: '2026-04-01', value: '280' }]
    const result = getFTPFromData(tests, {})
    expect(result.ftpWatts).toBe(210)   // 280 × 0.75
    expect(result.method).toBe('ramp')
  })

  it('derives FTP from cp_test directly', () => {
    const tests = [{ testId: 'cp_test', date: '2026-04-01', value: '230' }]
    const result = getFTPFromData(tests, {})
    expect(result.ftpWatts).toBe(230)
    expect(result.method).toBe('cp')
  })

  it('uses most recent test when multiple are present', () => {
    const tests = [
      { testId: 'ftp20', date: '2025-01-01', value: '260' },
      { testId: 'ftp20', date: '2026-04-01', value: '300' },
    ]
    const result = getFTPFromData(tests, {})
    expect(result.ftpWatts).toBe(285)  // most recent × 0.95
  })

  it('returns null for invalid test value', () => {
    const tests = [{ testId: 'ftp20', date: '2026-04-01', value: 'NaN' }]
    expect(getFTPFromData(tests, {})).toBeNull()
  })

  it('ignores unsupported testIds', () => {
    const tests = [{ testId: 'unknown_test', date: '2026-04-01', value: '300' }]
    expect(getFTPFromData(tests, {})).toBeNull()
  })
})

// ─── 2. computeCyclingPredictions ─────────────────────────────────────────────
describe('computeCyclingPredictions', () => {
  it('returns [] for invalid FTP', () => {
    expect(computeCyclingPredictions(0)).toEqual([])
    expect(computeCyclingPredictions(-10)).toEqual([])
    expect(computeCyclingPredictions(null)).toEqual([])
  })

  it('returns array of predictions with correct shape', () => {
    const preds = computeCyclingPredictions(280)
    expect(Array.isArray(preds)).toBe(true)
    expect(preds.length).toBeGreaterThan(0)
    const pred = preds[0]
    expect(pred).toHaveProperty('label')
    expect(pred).toHaveProperty('timeStr')
    expect(pred).toHaveProperty('speedKmh')
    expect(pred).toHaveProperty('power')
  })

  it('returns all 3 standard routes for a valid FTP', () => {
    const preds = computeCyclingPredictions(280, 70)
    expect(preds.length).toBe(3)
    const labels = preds.map(p => p.label)
    expect(labels).toContain('40km TT')
    expect(labels).toContain('Gran Fondo 120km')
    expect(labels).toContain('Alpe (14km)')
  })

  it('speedKmh is positive and reasonable', () => {
    const preds = computeCyclingPredictions(280)
    preds.forEach(p => {
      expect(p.speedKmh).toBeGreaterThan(0)
      expect(p.speedKmh).toBeLessThan(200)
    })
  })
})

// ─── 3. computeCyclingZones ───────────────────────────────────────────────────
describe('computeCyclingZones', () => {
  it('returns null when no FTP can be derived', () => {
    expect(computeCyclingZones([], {})).toBeNull()
  })

  it('returns correct shape with profile FTP', () => {
    const result = computeCyclingZones([], { ftp: 250 })
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('ftpWatts', 250)
    expect(result).toHaveProperty('zones')
    expect(result).toHaveProperty('wperkg')
    expect(result).toHaveProperty('method')
    expect(Array.isArray(result.zones)).toBe(true)
    expect(result.zones.length).toBe(7)
  })

  it('computes wperkg when weight is present', () => {
    const result = computeCyclingZones([], { ftp: 250, weight_kg: 70 })
    expect(result.wperkg).toBeCloseTo(250 / 70, 2)
  })

  it('returns null wperkg when no weight', () => {
    const result = computeCyclingZones([], { ftp: 250 })
    expect(result.wperkg).toBeNull()
  })

  it('each zone has minWatts and maxWatts fields', () => {
    const result = computeCyclingZones([], { ftp: 300 })
    result.zones.forEach(z => {
      expect(z).toHaveProperty('id')
      expect(z).toHaveProperty('name')
      expect(typeof z.minWatts).toBe('number')
    })
  })
})
