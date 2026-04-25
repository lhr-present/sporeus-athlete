// ─── cyclingZones.test.js — 15+ tests for getFTPFromData + computeCyclingZones ──
import { describe, it, expect } from 'vitest'
import { getFTPFromData, computeCyclingZones } from '../../athlete/cyclingZones.js'

// ── Helpers ──────────────────────────────────────────────────────────────────
const makeTest = (testId, value, date = '2026-04-25') => ({
  id: `t-${testId}`, date, testId, value: String(value), unit: 'W',
})

// ── getFTPFromData ────────────────────────────────────────────────────────────
describe('getFTPFromData', () => {
  it('profile.ftp positive number → ftpWatts + method profile', () => {
    const result = getFTPFromData([], { ftp: 280 })
    expect(result).toEqual({ ftpWatts: 280, method: 'profile' })
  })

  it('profile.ftp as string → parsed and returned', () => {
    const result = getFTPFromData([], { ftp: '265' })
    expect(result).toEqual({ ftpWatts: 265, method: 'profile' })
  })

  it('profile.ftp=0 → falls through to testResults', () => {
    const result = getFTPFromData([], { ftp: 0 })
    expect(result).toBeNull()
  })

  it('profile.ftp falsy → falls through to testResults (null if empty)', () => {
    const result = getFTPFromData([], { ftp: null })
    expect(result).toBeNull()
  })

  it('testResults ftp20 → FTP = round(value × 0.95)', () => {
    const result = getFTPFromData([makeTest('ftp20', '300')], {})
    expect(result).toEqual({ ftpWatts: 285, method: 'ftp20' })
  })

  it('testResults ftp20 rounding: 310 × 0.95 = 294.5 → 295', () => {
    const result = getFTPFromData([makeTest('ftp20', '310')], {})
    expect(result?.ftpWatts).toBe(295)
    expect(result?.method).toBe('ftp20')
  })

  it('testResults ramp_test → FTP = round(value × 0.75)', () => {
    const result = getFTPFromData([makeTest('ramp_test', '400')], {})
    expect(result).toEqual({ ftpWatts: 300, method: 'ramp' })
  })

  it('testResults cp_test → FTP = parseFloat(value) directly', () => {
    const result = getFTPFromData([makeTest('cp_test', '270')], {})
    expect(result?.ftpWatts).toBe(270)
    expect(result?.method).toBe('cp')
  })

  it('most recent test wins when multiple tests exist (different dates)', () => {
    const tests = [
      makeTest('ftp20', '200', '2026-01-01'),
      makeTest('ftp20', '300', '2026-04-01'),
      makeTest('ftp20', '250', '2026-02-01'),
    ]
    const result = getFTPFromData(tests, {})
    // most recent is 2026-04-01, 300 × 0.95 = 285
    expect(result?.ftpWatts).toBe(285)
  })

  it('most recent across different testId types picks newest overall', () => {
    const tests = [
      makeTest('cp_test', '250', '2026-03-01'),
      makeTest('ramp_test', '400', '2026-04-20'),
    ]
    const result = getFTPFromData(tests, {})
    // ramp_test 2026-04-20 is newest → 400 × 0.75 = 300
    expect(result?.ftpWatts).toBe(300)
    expect(result?.method).toBe('ramp')
  })

  it('empty testResults → null', () => {
    expect(getFTPFromData([], {})).toBeNull()
  })

  it('null testResults → null', () => {
    expect(getFTPFromData(null, {})).toBeNull()
  })

  it('profile with only weight (no FTP) → null', () => {
    expect(getFTPFromData([], { weight_kg: 70 })).toBeNull()
  })

  it('testResults with unknown testId → null', () => {
    const tests = [makeTest('unknown_test', '300')]
    expect(getFTPFromData(tests, {})).toBeNull()
  })
})

// ── computeCyclingZones ───────────────────────────────────────────────────────
describe('computeCyclingZones', () => {
  it('returns null when no FTP available', () => {
    expect(computeCyclingZones([], {})).toBeNull()
  })

  it('returns 7 zones', () => {
    const result = computeCyclingZones([], { ftp: 300 })
    expect(result?.zones).toHaveLength(7)
  })

  it('zones have correct structure (id, name, minWatts, maxWatts)', () => {
    const result = computeCyclingZones([], { ftp: 300 })
    const z1 = result?.zones[0]
    expect(z1).toMatchObject({ id: 1, name: 'Active Recovery', minWatts: 0 })
  })

  it('Z1 minWatts is always 0', () => {
    const result = computeCyclingZones([], { ftp: 250 })
    expect(result?.zones[0].minWatts).toBe(0)
  })

  it('Z7 maxWatts is null (Neuromuscular — no upper limit)', () => {
    const result = computeCyclingZones([], { ftp: 300 })
    expect(result?.zones[6].maxWatts).toBeNull()
  })

  it('FTP=300 → Z4 (Lactate Threshold) = 270W–315W', () => {
    const result = computeCyclingZones([], { ftp: 300 })
    const z4 = result?.zones.find(z => z.id === 4)
    expect(z4?.minWatts).toBe(270)
    expect(z4?.maxWatts).toBe(315)
  })

  it('FTP=300 → Z1 maxWatts = 165 (55% of 300)', () => {
    const result = computeCyclingZones([], { ftp: 300 })
    const z1 = result?.zones[0]
    expect(z1?.maxWatts).toBe(165)
  })

  it('wperkg calculated correctly: FTP=300, weight=75 → 4.00', () => {
    const result = computeCyclingZones([], { ftp: 300, weight_kg: 75 })
    expect(result?.wperkg).toBe(4.00)
  })

  it('wperkg uses weight field as fallback', () => {
    const result = computeCyclingZones([], { ftp: 280, weight: 70 })
    expect(result?.wperkg).toBe(4.00)
  })

  it('wperkg is null when no weight provided', () => {
    const result = computeCyclingZones([], { ftp: 300 })
    expect(result?.wperkg).toBeNull()
  })

  it('wperkg is null when weight=0', () => {
    const result = computeCyclingZones([], { ftp: 300, weight_kg: 0 })
    expect(result?.wperkg).toBeNull()
  })

  it('method=profile when profile.ftp is set', () => {
    const result = computeCyclingZones([], { ftp: 300 })
    expect(result?.method).toBe('profile')
  })

  it('method=ftp20 when derived from ftp20 test', () => {
    const result = computeCyclingZones([makeTest('ftp20', '300')], {})
    expect(result?.method).toBe('ftp20')
  })

  it('ftpWatts returned in result', () => {
    const result = computeCyclingZones([], { ftp: 250 })
    expect(result?.ftpWatts).toBe(250)
  })

  it('FTP=200 spot check: Z5 VO2max = 210W–240W', () => {
    const result = computeCyclingZones([], { ftp: 200 })
    const z5 = result?.zones.find(z => z.id === 5)
    expect(z5?.minWatts).toBe(210) // 200 × 1.05
    expect(z5?.maxWatts).toBe(240) // 200 × 1.20
  })
})
