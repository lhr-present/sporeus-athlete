import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadBatteryHistory,
  testName,
  computeBatteryProgress,
} from '../../athlete/batteryProgress.js'
import { compareBatteryResults } from '../../sport/testBattery.js'

// ─── localStorage mock ──────────────────────────────────────────────────────
const mockStorage = {}

vi.stubGlobal('localStorage', {
  getItem:  (k)    => mockStorage[k] ?? null,
  setItem:  (k, v) => { mockStorage[k] = v },
  removeItem: (k)  => { delete mockStorage[k] },
})

beforeEach(() => {
  // Clear mock storage before every test
  Object.keys(mockStorage).forEach(k => delete mockStorage[k])
})

// ─── loadBatteryHistory ──────────────────────────────────────────────────────
describe('loadBatteryHistory', () => {
  it('returns [] when localStorage key is missing', () => {
    expect(loadBatteryHistory()).toEqual([])
  })

  it('returns sorted (most recent first) array', () => {
    const data = [
      { date: '2026-01-15', results: { cooper_12min: 2800 } },
      { date: '2026-03-01', results: { cooper_12min: 3000 } },
      { date: '2026-02-10', results: { cooper_12min: 2900 } },
    ]
    mockStorage['sporeus-test-battery'] = JSON.stringify(data)
    const result = loadBatteryHistory()
    expect(result[0].date).toBe('2026-03-01')
    expect(result[1].date).toBe('2026-02-10')
    expect(result[2].date).toBe('2026-01-15')
  })

  it('handles JSON parse error → returns []', () => {
    mockStorage['sporeus-test-battery'] = 'not valid json{'
    expect(loadBatteryHistory()).toEqual([])
  })

  it('returns [] when stored value is not an array', () => {
    mockStorage['sporeus-test-battery'] = JSON.stringify({ date: '2026-01-01' })
    expect(loadBatteryHistory()).toEqual([])
  })

  it('returns [] when stored value is null string', () => {
    mockStorage['sporeus-test-battery'] = 'null'
    expect(loadBatteryHistory()).toEqual([])
  })
})

// ─── testName ────────────────────────────────────────────────────────────────
describe('testName', () => {
  it('returns human name for known testId: cooper_12min', () => {
    expect(testName('cooper_12min')).toBe('Cooper 12-Minute Run')
  })

  it('returns human name for known testId: step_test_3min', () => {
    expect(testName('step_test_3min')).toBe('3-Minute Step Test')
  })

  it('returns human name for known testId: squat_1rm', () => {
    expect(testName('squat_1rm')).toBe('Back Squat 1RM')
  })

  it('returns testId itself for unknown testId', () => {
    expect(testName('unknown_test_xyz')).toBe('unknown_test_xyz')
  })

  it('returns testId itself for empty string', () => {
    expect(testName('')).toBe('')
  })
})

// ─── computeBatteryProgress ──────────────────────────────────────────────────
describe('computeBatteryProgress', () => {
  it('returns null for empty array', () => {
    expect(computeBatteryProgress([])).toBeNull()
  })

  it('returns null when storedBatteries is not an array', () => {
    expect(computeBatteryProgress(null)).toBeNull()
    expect(computeBatteryProgress(undefined)).toBeNull()
  })

  it('returns results for single session (no deltas, delta_pct null)', () => {
    const data = [{ date: '2026-04-01', results: { cooper_12min: 2800 } }]
    const result = computeBatteryProgress(data)
    expect(result).not.toBeNull()
    expect(result.results).toHaveLength(1)
    expect(result.results[0].delta_pct).toBeNull()
  })

  it('prevDate is null for single session', () => {
    const data = [{ date: '2026-04-01', results: { cooper_12min: 2800 } }]
    const result = computeBatteryProgress(data)
    expect(result.prevDate).toBeNull()
  })

  it('latestDate reflects the most recent session', () => {
    const data = [
      { date: '2026-01-01', results: { cooper_12min: 2800 } },
      { date: '2026-04-15', results: { cooper_12min: 3100 } },
    ]
    const result = computeBatteryProgress(data)
    expect(result.latestDate).toBe('2026-04-15')
  })

  it('prevDate reflects second most recent session', () => {
    const data = [
      { date: '2026-01-01', results: { cooper_12min: 2800 } },
      { date: '2026-04-15', results: { cooper_12min: 3100 } },
    ]
    const result = computeBatteryProgress(data)
    expect(result.prevDate).toBe('2026-01-01')
  })

  it('sessionCount reflects total number of stored batteries', () => {
    const data = [
      { date: '2026-01-01', results: { cooper_12min: 2800 } },
      { date: '2026-02-01', results: { cooper_12min: 2900 } },
      { date: '2026-03-01', results: { cooper_12min: 3000 } },
    ]
    const result = computeBatteryProgress(data)
    expect(result.sessionCount).toBe(3)
  })

  it('delta_pct positive when test result improved', () => {
    // cooper_12min: before=2800, after=3000 → delta_pct = (3000-2800)/2800 * 100 = 7.1
    const data = [
      { date: '2026-01-01', results: { cooper_12min: 2800 } },
      { date: '2026-04-01', results: { cooper_12min: 3000 } },
    ]
    const result = computeBatteryProgress(data)
    const cooperRow = result.results.find(r => r.testId === 'cooper_12min')
    expect(cooperRow.delta_pct).toBeGreaterThan(0)
    expect(cooperRow.delta_pct).toBeCloseTo(7.1, 1)
  })

  it('delta_pct negative when test result declined', () => {
    // cooper_12min: before=3000, after=2800 → delta_pct ≈ -6.7
    const data = [
      { date: '2026-01-01', results: { cooper_12min: 3000 } },
      { date: '2026-04-01', results: { cooper_12min: 2800 } },
    ]
    const result = computeBatteryProgress(data)
    const cooperRow = result.results.find(r => r.testId === 'cooper_12min')
    expect(cooperRow.delta_pct).toBeLessThan(0)
  })

  it('deltas are computed for 2 sessions', () => {
    const data = [
      { date: '2026-01-01', results: { cooper_12min: 2800, sprint_20m: 3.2 } },
      { date: '2026-04-01', results: { cooper_12min: 3000, sprint_20m: 3.0 } },
    ]
    const result = computeBatteryProgress(data)
    expect(result.results).toHaveLength(2)
    result.results.forEach(r => {
      expect(r.delta_pct).not.toBeNull()
    })
  })

  it('includes derived metrics for each test result', () => {
    const data = [{ date: '2026-04-01', results: { cooper_12min: 3000 } }]
    const result = computeBatteryProgress(data)
    const cooperRow = result.results[0]
    expect(cooperRow.derived).toBeDefined()
    expect(cooperRow.derived.metric).toBe('vo2max')
    expect(cooperRow.derived.unit).toBe('mL/kg/min')
    expect(typeof cooperRow.derived.value).toBe('number')
  })

  it('derived vo2max correct for cooper_12min 3000m', () => {
    // Cooper formula: 22.351 * 3.0 − 11.288 = 55.8
    const data = [{ date: '2026-04-01', results: { cooper_12min: 3000 } }]
    const result = computeBatteryProgress(data)
    expect(result.results[0].derived.value).toBeCloseTo(55.8, 1)
  })

  it('includes test name for each result', () => {
    const data = [{ date: '2026-04-01', results: { step_test_3min: 88 } }]
    const result = computeBatteryProgress(data)
    expect(result.results[0].name).toBe('3-Minute Step Test')
  })
})

// ─── compareBatteryResults pass-through ──────────────────────────────────────
describe('compareBatteryResults pass-through', () => {
  it('handles testId present in both sessions', () => {
    const a = { date: '2026-01-01', results: { cooper_12min: 2800 } }
    const b = { date: '2026-04-01', results: { cooper_12min: 3000 } }
    const result = compareBatteryResults(a, b)
    expect(result).toHaveLength(1)
    expect(result[0].testId).toBe('cooper_12min')
    expect(result[0].before).toBe(2800)
    expect(result[0].after).toBe(3000)
    expect(result[0].delta_pct).toBeCloseTo(7.1, 1)
  })

  it('handles testId only in second session (new test, before=0)', () => {
    const a = { date: '2026-01-01', results: {} }
    const b = { date: '2026-04-01', results: { cooper_12min: 3000 } }
    const result = compareBatteryResults(a, b)
    expect(result).toHaveLength(1)
    expect(result[0].before).toBe(0)
    expect(result[0].delta_pct).toBe(Infinity)
  })

  it('handles testId only in first session (dropped test)', () => {
    const a = { date: '2026-01-01', results: { cooper_12min: 2800 } }
    const b = { date: '2026-04-01', results: {} }
    const result = compareBatteryResults(a, b)
    expect(result).toHaveLength(1)
    expect(result[0].after).toBe(0)
    expect(result[0].delta_pct).toBe(-100)
  })

  it('returns [] for null inputs', () => {
    expect(compareBatteryResults(null, null)).toEqual([])
    expect(compareBatteryResults(undefined, null)).toEqual([])
  })
})
