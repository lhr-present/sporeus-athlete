// rowingPrediction.test.js — E51 tests for predict2000m + concept2VO2max
import { describe, test, expect } from 'vitest'
import { predict2000m, concept2VO2max } from '../../../lib/sport/rowing.js'

// ── predict2000m ──────────────────────────────────────────────────────────────

describe('predict2000m', () => {
  test('returns null on zero time', () => {
    expect(predict2000m(0, 2000)).toBeNull()
  })

  test('returns null on zero distance', () => {
    expect(predict2000m(400, 0)).toBeNull()
  })

  test('returns null on null inputs', () => {
    expect(predict2000m(null, null)).toBeNull()
  })

  test('2000m input returns a value close to the input time (scaling ~1)', () => {
    // Paul's Law with d1=2000, d2=2000 → ratio 1 → result = timeSec * 1^1.07 = timeSec
    const result = predict2000m(420, 2000)
    expect(result).not.toBeNull()
    expect(Math.round(result)).toBe(420)
  })

  test('1000m time projects to a longer 2000m time (Paul exponent >1)', () => {
    // 1000m at 200s → 2000m should take more than 200*2=400s due to exponent 1.07
    const result = predict2000m(200, 1000)
    expect(result).toBeGreaterThan(400)
  })

  test('5000m time projects to a shorter 2000m time', () => {
    // 5000m at 1200s → 2000m should be shorter than 1200*(2000/5000)=480 (due to exponent >1 → actually shorter)
    const result = predict2000m(1200, 5000)
    expect(result).toBeGreaterThan(0)
    expect(result).toBeLessThan(1200)
  })

  test('result is always positive for valid inputs', () => {
    const r1 = predict2000m(300, 1000)
    const r2 = predict2000m(600, 3000)
    const r3 = predict2000m(150, 500)
    expect(r1).toBeGreaterThan(0)
    expect(r2).toBeGreaterThan(0)
    expect(r3).toBeGreaterThan(0)
  })

  test('longer distance at same speed → shorter predicted 2000m vs naive linear', () => {
    // Paul exponent 1.07 means longer distances "cost" more, so 2000m predicts faster
    const from5k = predict2000m(1250, 5000)  // 1250s at 5k
    // Naive linear would give 1250*(2000/5000)=500s; exponent makes it slightly less
    expect(from5k).toBeLessThan(500)
    expect(from5k).toBeGreaterThan(0)
  })
})

// ── concept2VO2max ────────────────────────────────────────────────────────────

describe('concept2VO2max', () => {
  test('returns null on zero time', () => {
    expect(concept2VO2max(0, 75)).toBeNull()
  })

  test('returns null on null time', () => {
    expect(concept2VO2max(null, 75)).toBeNull()
  })

  test('returns a number for valid inputs', () => {
    const result = concept2VO2max(420, 75)
    expect(typeof result).toBe('number')
    expect(result).toBeGreaterThan(0)
  })

  test('faster time (lower seconds) → higher VO2max', () => {
    const fast = concept2VO2max(360, 75)   // 6:00 — fast
    const slow = concept2VO2max(480, 75)   // 8:00 — slow
    expect(fast).toBeGreaterThan(slow)
  })

  test('heavier athlete at same time → lower VO2max per kg', () => {
    const light = concept2VO2max(420, 60)  // 60 kg
    const heavy = concept2VO2max(420, 90)  // 90 kg
    expect(light).toBeGreaterThan(heavy)
  })

  test('world-class 2000m time (5:35 = 335s, 70 kg) → VO2max above 72', () => {
    const result = concept2VO2max(335, 70)
    expect(result).toBeGreaterThanOrEqual(72)
  })

  test('recreational time (8:00 = 480s, 80 kg) → VO2max in plausible range 30–50', () => {
    const result = concept2VO2max(480, 80)
    expect(result).toBeGreaterThanOrEqual(30)
    expect(result).toBeLessThanOrEqual(50)
  })

  test('result is rounded to 1 decimal place', () => {
    const result = concept2VO2max(420, 75)
    // Check that it has at most one decimal place
    const str = String(result)
    const decimalPart = str.includes('.') ? str.split('.')[1] : ''
    expect(decimalPart.length).toBeLessThanOrEqual(1)
  })

  test('zero body weight falls back to default 75 kg without returning null', () => {
    const withDefault = concept2VO2max(420, 0)
    const with75      = concept2VO2max(420, 75)
    // Both should return a number; default fallback to 75 means equal
    expect(typeof withDefault).toBe('number')
    expect(withDefault).toBe(with75)
  })
})

// ── integration: predict2000m then concept2VO2max pipeline ───────────────────

describe('predict2000m → concept2VO2max pipeline', () => {
  test('1000m session time + weight produces a valid VO2max estimate', () => {
    const predicted = predict2000m(220, 1000)  // ~475s predicted 2000m
    expect(predicted).not.toBeNull()
    const vo2 = concept2VO2max(predicted, 75)
    expect(typeof vo2).toBe('number')
    expect(vo2).toBeGreaterThan(0)
    expect(vo2).toBeLessThan(100)  // physiologically plausible ceiling
  })
})
