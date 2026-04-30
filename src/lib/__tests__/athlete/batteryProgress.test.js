// ─── batteryProgress.test.js — 20 tests ──────────────────────────────────────
// Skips loadBatteryHistory() (reads localStorage).
// Tests: testName(), computeBatteryProgress()
import { describe, it, expect } from 'vitest'
import {
  testName,
  computeBatteryProgress,
} from '../../athlete/batteryProgress.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────
const battery1 = {
  date: '2026-03-01',
  results: {
    cooper_12min:    2800,
    step_test_3min:  90,
    sprint_20m:      3.0,
  },
}

const battery2 = {
  date: '2026-04-01',
  results: {
    cooper_12min:    3000,   // improved
    step_test_3min:  85,     // improved (lower = better HR)
    sprint_20m:      2.8,    // improved (faster = lower time)
  },
}

const singleBattery = [battery1]
const twoBatteries  = [battery1, battery2]  // ascending — sorted internally

// ─── 1. testName ─────────────────────────────────────────────────────────────
describe('testName', () => {
  it('returns the name for a known testId', () => {
    expect(testName('cooper_12min')).toBe('Cooper 12-Minute Run')
  })

  it('returns the name for step_test_3min', () => {
    expect(testName('step_test_3min')).toBe('3-Minute Step Test')
  })

  it('returns the name for erg_2km', () => {
    expect(testName('erg_2km')).toBe('2 km Rowing Ergometer')
  })

  it('returns the name for sprint_20m', () => {
    expect(testName('sprint_20m')).toBe('20-Metre Sprint')
  })

  it('falls back to testId for unknown tests', () => {
    expect(testName('unknown_test')).toBe('unknown_test')
  })

  it('falls back for empty string input', () => {
    expect(testName('')).toBe('')
  })
})

// ─── 2. computeBatteryProgress ───────────────────────────────────────────────
describe('computeBatteryProgress', () => {
  it('returns null for null or empty input', () => {
    expect(computeBatteryProgress(null)).toBeNull()
    expect(computeBatteryProgress([])).toBeNull()
  })

  it('returns result shape for a single battery', () => {
    const result = computeBatteryProgress(singleBattery)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('latestDate', '2026-03-01')
    expect(result).toHaveProperty('prevDate', null)
    expect(result).toHaveProperty('results')
    expect(result).toHaveProperty('sessionCount', 1)
  })

  it('results is an array of per-test items', () => {
    const result = computeBatteryProgress(singleBattery)
    expect(Array.isArray(result.results)).toBe(true)
    expect(result.results.length).toBe(3)
  })

  it('each result item has required fields', () => {
    const result = computeBatteryProgress(twoBatteries)
    const item = result.results[0]
    expect(item).toHaveProperty('testId')
    expect(item).toHaveProperty('name')
    expect(item).toHaveProperty('rawValue')
    expect(item).toHaveProperty('derived')
    expect(item).toHaveProperty('delta_pct')
  })

  it('name is a human-readable string', () => {
    const result = computeBatteryProgress(singleBattery)
    const cooperItem = result.results.find(r => r.testId === 'cooper_12min')
    expect(cooperItem.name).toBe('Cooper 12-Minute Run')
  })

  it('computes delta_pct for two sessions', () => {
    const result = computeBatteryProgress(twoBatteries)
    const cooperItem = result.results.find(r => r.testId === 'cooper_12min')
    // (3000 - 2800) / 2800 * 100 = 7.1%
    expect(cooperItem.delta_pct).toBeCloseTo(7.1, 0)
  })

  it('delta_pct is null for single-session (no previous)', () => {
    const result = computeBatteryProgress(singleBattery)
    result.results.forEach(r => {
      expect(r.delta_pct).toBeNull()
    })
  })

  it('latestDate is the most recent battery date', () => {
    const result = computeBatteryProgress(twoBatteries)
    expect(result.latestDate).toBe('2026-04-01')
  })

  it('prevDate is the second most recent date', () => {
    const result = computeBatteryProgress(twoBatteries)
    expect(result.prevDate).toBe('2026-03-01')
  })

  it('sessionCount equals number of batteries passed', () => {
    const result = computeBatteryProgress(twoBatteries)
    expect(result.sessionCount).toBe(2)
  })

  it('derived object has metric, value, unit fields', () => {
    const result = computeBatteryProgress(singleBattery)
    const item = result.results.find(r => r.testId === 'cooper_12min')
    expect(item.derived).toHaveProperty('metric')
    expect(item.derived).toHaveProperty('value')
    expect(item.derived).toHaveProperty('unit')
  })

  it('passes profile to deriveMetrics (squat ratio uses weight)', () => {
    const sqBattery = [{ date: '2026-04-01', results: { squat_1rm: 100 } }]
    const profile   = { weight_kg: 80 }
    const result    = computeBatteryProgress(sqBattery, profile)
    const squatItem = result.results.find(r => r.testId === 'squat_1rm')
    expect(squatItem.derived.value).toBeCloseTo(100 / 80, 2)
  })

  it('handles battery with no results gracefully', () => {
    const emptyResults = [{ date: '2026-04-01', results: {} }]
    const result = computeBatteryProgress(emptyResults)
    expect(result).not.toBeNull()
    expect(result.results).toEqual([])
  })

  it('sorts batteries descending so latest is first', () => {
    // Pass in reversed (oldest first) — should still pick the newest
    const reversed = [battery2, battery1]
    const result = computeBatteryProgress(reversed)
    expect(result.latestDate).toBe('2026-04-01')
    expect(result.prevDate).toBe('2026-03-01')
  })
})
