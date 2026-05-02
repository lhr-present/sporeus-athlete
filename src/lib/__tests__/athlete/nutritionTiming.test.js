// ─── nutritionTiming.test.js — E126: Nutrition Timing helper unit tests ─────
import { describe, it, expect } from 'vitest'
import { computeNutritionTiming } from '../../athlete/nutritionTiming.js'

const W70 = 70  // canonical 70kg athlete

// ─── Validation ─────────────────────────────────────────────────────────────
describe('computeNutritionTiming — validation', () => {
  it('returns null for null input', () => {
    expect(computeNutritionTiming(null)).toBeNull()
  })

  it('returns null for non-object input', () => {
    expect(computeNutritionTiming('nope')).toBeNull()
    expect(computeNutritionTiming(42)).toBeNull()
  })

  it('returns null for unknown intent', () => {
    expect(computeNutritionTiming({ intent: 'mystery', durationMin: 60, weightKg: 70 })).toBeNull()
  })

  it('returns null for missing intent', () => {
    expect(computeNutritionTiming({ durationMin: 60, weightKg: 70 })).toBeNull()
  })

  it('returns null for negative weight', () => {
    expect(computeNutritionTiming({ intent: 'steady', durationMin: 60, weightKg: -10 })).toBeNull()
  })

  it('returns null for zero weight', () => {
    expect(computeNutritionTiming({ intent: 'steady', durationMin: 60, weightKg: 0 })).toBeNull()
  })

  it('returns null for zero duration', () => {
    expect(computeNutritionTiming({ intent: 'steady', durationMin: 0, weightKg: 70 })).toBeNull()
  })

  it('returns null for negative duration', () => {
    expect(computeNutritionTiming({ intent: 'steady', durationMin: -30, weightKg: 70 })).toBeNull()
  })

  it('returns null for non-finite weight', () => {
    expect(computeNutritionTiming({ intent: 'steady', durationMin: 60, weightKg: NaN })).toBeNull()
    expect(computeNutritionTiming({ intent: 'steady', durationMin: 60, weightKg: Infinity })).toBeNull()
  })
})

// ─── Top-level shape ────────────────────────────────────────────────────────
describe('computeNutritionTiming — result shape', () => {
  it('returns all 5 top-level keys', () => {
    const r = computeNutritionTiming({ intent: 'steady', durationMin: 60, weightKg: 70 })
    expect(r).toHaveProperty('pre')
    expect(r).toHaveProperty('during')
    expect(r).toHaveProperty('post')
    expect(r).toHaveProperty('total')
    expect(r).toHaveProperty('citation')
  })

  it('citation is exactly "Burke 2014; Jeukendrup 2014"', () => {
    const r = computeNutritionTiming({ intent: 'steady', durationMin: 60, weightKg: 70 })
    expect(r.citation).toBe('Burke 2014; Jeukendrup 2014')
  })
})

// ─── Pre-workout banding by intent + duration ───────────────────────────────
describe('computeNutritionTiming — pre-workout carb bands', () => {
  it('recovery (low) → low pre-workout carb range (1-2 g/kg)', () => {
    const r = computeNutritionTiming({ intent: 'recovery', durationMin: 45, weightKg: W70 })
    // 1.0-2.0 g/kg → 70-140 g, mid 105g
    expect(r.pre.carbGrams.low).toBe(70)
    expect(r.pre.carbGrams.high).toBe(140)
    expect(r.pre.carbGrams.mid).toBe(Math.round(1.5 * 70))
  })

  it('intervals (RPE 8) at 60min → high carb range (RPE>=7 trumps duration)', () => {
    const r = computeNutritionTiming({ intent: 'intervals', durationMin: 60, weightKg: W70 })
    // intervals → default RPE 8 → high band (3-4 g/kg) → 210-280 g
    expect(r.pre.carbGrams.low).toBe(210)
    expect(r.pre.carbGrams.high).toBe(280)
  })

  it('long at 180min → high carb range, long during band', () => {
    const r = computeNutritionTiming({ intent: 'long', durationMin: 180, weightKg: W70 })
    // duration ≥ 90 → high band; 3-4 g/kg → 210-280
    expect(r.pre.carbGrams.low).toBe(210)
    expect(r.pre.carbGrams.high).toBe(280)
    // 180 min ≥ 150 → multi-source carbs band 60-90 g/h
    expect(r.during.carbGramsPerHour.low).toBe(60)
    expect(r.during.carbGramsPerHour.high).toBe(90)
  })

  it('tempo at 75min → mid band (2-3 g/kg)', () => {
    const r = computeNutritionTiming({ intent: 'tempo', durationMin: 75, weightKg: W70 })
    expect(r.pre.carbGrams.low).toBe(140)
    expect(r.pre.carbGrams.high).toBe(210)
  })

  it('explicit RPE override raises band (steady RPE 8 → high band)', () => {
    const r = computeNutritionTiming({ intent: 'steady', durationMin: 50, weightKg: W70, rpe: 8 })
    expect(r.pre.carbGrams.low).toBe(210)
  })
})

// ─── Linear scaling with body mass ──────────────────────────────────────────
describe('computeNutritionTiming — weight scaling', () => {
  it('pre carb grams scale linearly with weight (50/70/90 kg)', () => {
    const r50 = computeNutritionTiming({ intent: 'long', durationMin: 180, weightKg: 50 })
    const r70 = computeNutritionTiming({ intent: 'long', durationMin: 180, weightKg: 70 })
    const r90 = computeNutritionTiming({ intent: 'long', durationMin: 180, weightKg: 90 })
    // High band (3 g/kg low) → 150 / 210 / 270
    expect(r50.pre.carbGrams.low).toBe(150)
    expect(r70.pre.carbGrams.low).toBe(210)
    expect(r90.pre.carbGrams.low).toBe(270)
  })

  it('post carb scales 1.1 g/kg with body mass', () => {
    const r50 = computeNutritionTiming({ intent: 'steady', durationMin: 60, weightKg: 50 })
    const r70 = computeNutritionTiming({ intent: 'steady', durationMin: 60, weightKg: 70 })
    const r90 = computeNutritionTiming({ intent: 'steady', durationMin: 60, weightKg: 90 })
    expect(r50.post.carbGrams).toBe(Math.round(1.1 * 50))
    expect(r70.post.carbGrams).toBe(Math.round(1.1 * 70))
    expect(r90.post.carbGrams).toBe(Math.round(1.1 * 90))
  })

  it('pre fluid scales at 6 ml/kg', () => {
    const r70 = computeNutritionTiming({ intent: 'steady', durationMin: 60, weightKg: 70 })
    expect(r70.pre.fluidMl).toBe(Math.round(6 * 70))
  })
})

// ─── During-session bands ───────────────────────────────────────────────────
describe('computeNutritionTiming — during-session carb bands', () => {
  it('during.carbGramsPerHour is null for sub-30-min sessions', () => {
    const r = computeNutritionTiming({ intent: 'recovery', durationMin: 25, weightKg: W70 })
    expect(r.during.carbGramsPerHour).toBeNull()
  })

  it('30-60min returns brief band (0-30 g/h)', () => {
    const r = computeNutritionTiming({ intent: 'steady', durationMin: 45, weightKg: W70 })
    expect(r.during.carbGramsPerHour).not.toBeNull()
    expect(r.during.carbGramsPerHour.low).toBe(0)
    expect(r.during.carbGramsPerHour.high).toBe(30)
  })

  it('60-150min returns medium band (30-60 g/h)', () => {
    const r = computeNutritionTiming({ intent: 'steady', durationMin: 90, weightKg: W70 })
    expect(r.during.carbGramsPerHour.low).toBe(30)
    expect(r.during.carbGramsPerHour.high).toBe(60)
  })

  it('150min+ returns long band (60-90 g/h)', () => {
    const r = computeNutritionTiming({ intent: 'long', durationMin: 200, weightKg: W70 })
    expect(r.during.carbGramsPerHour.low).toBe(60)
    expect(r.during.carbGramsPerHour.high).toBe(90)
  })
})

// ─── Sodium + fluid + heat ──────────────────────────────────────────────────
describe('computeNutritionTiming — fluid + sodium', () => {
  it('sodium during-session is in 300-700 mg/h band', () => {
    const r = computeNutritionTiming({ intent: 'steady', durationMin: 90, weightKg: W70 })
    expect(r.during.sodiumMgPerHour).toBeGreaterThanOrEqual(300)
    expect(r.during.sodiumMgPerHour).toBeLessThanOrEqual(700)
  })

  it('heat stress raises during fluid by 25%', () => {
    const cool = computeNutritionTiming({ intent: 'long', durationMin: 120, weightKg: W70, heatStress: false })
    const hot  = computeNutritionTiming({ intent: 'long', durationMin: 120, weightKg: W70, heatStress: true })
    expect(hot.during.fluidMlPerHour).toBe(Math.round(cool.during.fluidMlPerHour * 1.25))
  })

  it('fluid in normal conditions is in 400-800 ml/h band', () => {
    const r = computeNutritionTiming({ intent: 'steady', durationMin: 90, weightKg: W70 })
    expect(r.during.fluidMlPerHour).toBeGreaterThanOrEqual(400)
    expect(r.during.fluidMlPerHour).toBeLessThanOrEqual(800)
  })
})

// ─── Post-workout boundaries ────────────────────────────────────────────────
describe('computeNutritionTiming — post-workout', () => {
  it('post carb at mid of 1.0-1.2 g/kg band', () => {
    const r = computeNutritionTiming({ intent: 'steady', durationMin: 60, weightKg: W70 })
    // 1.1 * 70 = 77
    expect(r.post.carbGrams).toBe(77)
    // verify within boundaries
    expect(r.post.carbGrams).toBeGreaterThanOrEqual(Math.round(1.0 * W70))
    expect(r.post.carbGrams).toBeLessThanOrEqual(Math.round(1.2 * W70))
  })

  it('post protein at 0.3 g/kg → ~21g for 70kg', () => {
    const r = computeNutritionTiming({ intent: 'steady', durationMin: 60, weightKg: W70 })
    expect(r.post.proteinGrams).toBe(Math.round(0.3 * 70))
  })
})

// ─── Total estimates ────────────────────────────────────────────────────────
describe('computeNutritionTiming — total estimates', () => {
  it('total carb/fluid/sodium are positive integers for valid input', () => {
    const r = computeNutritionTiming({ intent: 'long', durationMin: 180, weightKg: W70 })
    expect(r.total.carbGrams).toBeGreaterThan(0)
    expect(r.total.fluidMl).toBeGreaterThan(0)
    expect(r.total.sodiumMg).toBeGreaterThan(0)
    expect(Number.isInteger(r.total.carbGrams)).toBe(true)
    expect(Number.isInteger(r.total.fluidMl)).toBe(true)
    expect(Number.isInteger(r.total.sodiumMg)).toBe(true)
  })

  it('total includes pre.mid + during.mid × hours + post', () => {
    // tempo at 75min → RPE 6, 60-90min window → mid pre band (2.5 g/kg).
    // Duration < 90 keeps it out of the high band.
    const r = computeNutritionTiming({ intent: 'tempo', durationMin: 75, weightKg: W70 })
    // pre.mid = 2.5 * 70 = 175
    // during band 60-150min → mid 45 g/h × (75/60) hours = 56.25 → rounded after sum
    // post = 1.1 * 70 = 77
    const expected = Math.round(175 + 45 * (75 / 60) + 77)
    expect(r.total.carbGrams).toBe(expected)
  })
})

// ─── Integer rounding everywhere ────────────────────────────────────────────
describe('computeNutritionTiming — integer rounding', () => {
  it('all numeric outputs are integers (no decimals)', () => {
    const r = computeNutritionTiming({ intent: 'tempo', durationMin: 65, weightKg: 73 })
    const ints = [
      r.pre.carbGrams.low, r.pre.carbGrams.mid, r.pre.carbGrams.high,
      r.pre.fluidMl,
      r.during.fluidMlPerHour, r.during.sodiumMgPerHour,
      r.during.carbGramsPerHour.low, r.during.carbGramsPerHour.mid, r.during.carbGramsPerHour.high,
      r.post.carbGrams, r.post.proteinGrams,
      r.total.carbGrams, r.total.fluidMl, r.total.sodiumMg,
    ]
    for (const n of ints) {
      expect(Number.isInteger(n)).toBe(true)
    }
  })
})

// ─── Bilingual notes ────────────────────────────────────────────────────────
describe('computeNutritionTiming — bilingual notes', () => {
  it('pre/during/post notes have non-empty en + tr strings', () => {
    const r = computeNutritionTiming({ intent: 'steady', durationMin: 90, weightKg: W70 })
    for (const seg of ['pre', 'during', 'post']) {
      expect(r[seg].note.en.length).toBeGreaterThan(0)
      expect(r[seg].note.tr.length).toBeGreaterThan(0)
    }
  })

  it('during note for <30min mentions water-only (en) / sadece su (tr)', () => {
    const r = computeNutritionTiming({ intent: 'recovery', durationMin: 25, weightKg: W70 })
    expect(r.during.note.en.toLowerCase()).toMatch(/water/)
    expect(r.during.note.tr.toLowerCase()).toMatch(/sadece su/)
  })

  it('during note for 150min+ references glucose+fructose mix', () => {
    const r = computeNutritionTiming({ intent: 'long', durationMin: 200, weightKg: W70 })
    expect(r.during.note.en.toLowerCase()).toMatch(/glucose\+fructose|glucose/)
    expect(r.during.note.tr.toLowerCase()).toMatch(/glukoz/)
  })
})
