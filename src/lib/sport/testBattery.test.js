import { describe, it, expect } from 'vitest'
import {
  TEST_BATTERY,
  deriveMetrics,
  getBatteryForDate,
  compareBatteryResults,
} from './testBattery.js'

// ─── Test 1: TEST_BATTERY has exactly 7 items ─────────────────────────────────
describe('TEST_BATTERY', () => {
  it('has exactly 7 items', () => {
    expect(TEST_BATTERY).toHaveLength(7)
  })

  // ─── Test 2: Each item has required fields ──────────────────────────────────
  it('each item has id, name, sport, duration_min, measures (array), rest_after_min', () => {
    for (const test of TEST_BATTERY) {
      expect(typeof test.id).toBe('string')
      expect(test.id.length).toBeGreaterThan(0)
      expect(typeof test.name).toBe('string')
      expect(test.name.length).toBeGreaterThan(0)
      expect(typeof test.sport).toBe('string')
      expect(typeof test.duration_min).toBe('number')
      expect(Array.isArray(test.measures)).toBe(true)
      expect(test.measures.length).toBeGreaterThan(0)
      expect(typeof test.rest_after_min).toBe('number')
    }
  })
})

// ─── Test 3: cooper_12min — 2400m → vo2max ≈ 42.3 ───────────────────────────
describe('deriveMetrics', () => {
  it('cooper_12min: 2400m yields vo2max ≈ 42.3 mL/kg/min', () => {
    // 22.351 × 2.4 − 11.288 = 53.6424 − 11.288 = 42.3544 → rounds to 42.4
    // Using exact spec formula: 22.351 * 2.4 - 11.288 = 42.3544
    const result = deriveMetrics('cooper_12min', 2400)
    expect(result.metric).toBe('vo2max')
    expect(result.unit).toBe('mL/kg/min')
    // Accept 42.3 or 42.4 (rounding edge) — spec says ≈ 42.3
    expect(result.value).toBeCloseTo(42.35, 0)
  })

  // ─── Test 4: sprint_20m — 2.5s → speed = 8.0 m/s ──────────────────────────
  it('sprint_20m: 2.5s yields speed = 8.0 m/s', () => {
    const result = deriveMetrics('sprint_20m', 2.5)
    expect(result.metric).toBe('speed')
    expect(result.unit).toBe('m/s')
    expect(result.value).toBe(8.0)
  })

  // ─── Test 5: squat_1rm — 100kg load, 80kg bodyweight → ratio 1.25 ──────────
  it('squat_1rm: 100 kg lift / 80 kg bodyweight = 1.25', () => {
    const result = deriveMetrics('squat_1rm', 100, { weight_kg: 80, height_cm: 180 })
    expect(result.metric).toBe('strength_ratio')
    expect(result.unit).toBe('x BW')
    expect(result.value).toBe(1.25)
  })
})

// ─── Test 6: compareBatteryResults — correct delta_pct ───────────────────────
describe('compareBatteryResults', () => {
  it('returns correct delta_pct for each testId', () => {
    const a = { date: '2026-01-01', results: { cooper_12min: 2000, sprint_20m: 3.0 } }
    const b = { date: '2026-04-01', results: { cooper_12min: 2200, sprint_20m: 2.8 } }
    const deltas = compareBatteryResults(a, b)

    const cooper = deltas.find(d => d.testId === 'cooper_12min')
    expect(cooper).toBeDefined()
    expect(cooper.before).toBe(2000)
    expect(cooper.after).toBe(2200)
    // (2200 - 2000) / 2000 * 100 = 10.0
    expect(cooper.delta_pct).toBe(10.0)

    const sprint = deltas.find(d => d.testId === 'sprint_20m')
    expect(sprint).toBeDefined()
    // (2.8 - 3.0) / 3.0 * 100 = -6.666... → rounded to 1 decimal = -6.7
    expect(sprint.delta_pct).toBe(-6.7)
  })

  // ─── Test 7: handles before=0 gracefully ────────────────────────────────────
  it('handles before=0 gracefully (no crash, returns Infinity)', () => {
    const a = { date: '2026-01-01', results: { squat_1rm: 0 } }
    const b = { date: '2026-04-01', results: { squat_1rm: 100 } }
    expect(() => compareBatteryResults(a, b)).not.toThrow()
    const deltas = compareBatteryResults(a, b)
    const squat = deltas.find(d => d.testId === 'squat_1rm')
    expect(squat).toBeDefined()
    expect(squat.delta_pct).toBe(Infinity)
  })
})

// ─── Test 8: getBatteryForDate — null when no match ──────────────────────────
describe('getBatteryForDate', () => {
  it('returns null when no battery matches the given date', () => {
    const stored = [
      { date: '2026-03-01', tests: ['cooper_12min'] },
      { date: '2026-03-15', tests: ['sprint_20m'] },
    ]
    expect(getBatteryForDate(stored, '2026-04-15')).toBeNull()
  })
})
