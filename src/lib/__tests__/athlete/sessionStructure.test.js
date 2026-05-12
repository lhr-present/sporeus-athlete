// src/lib/__tests__/athlete/sessionStructure.test.js
//
// v9.88.0 — Tests for deriveSessionStructure
import { describe, it, expect } from 'vitest'
import { deriveSessionStructure } from '../../athlete/sessionStructure.js'

describe('deriveSessionStructure', () => {
  it('returns null for null/undefined input', () => {
    expect(deriveSessionStructure(null)).toBeNull()
    expect(deriveSessionStructure(undefined)).toBeNull()
  })

  it('returns null when type is missing', () => {
    expect(deriveSessionStructure({ duration: 60 })).toBeNull()
    expect(deriveSessionStructure({ type: null, duration: 60 })).toBeNull()
  })

  it('returns null for non-interval session types', () => {
    expect(deriveSessionStructure({ type: 'Easy run', duration: 60 })).toBeNull()
    expect(deriveSessionStructure({ type: 'Long run', duration: 120 })).toBeNull()
    expect(deriveSessionStructure({ type: 'Recovery run', duration: 30 })).toBeNull()
    expect(deriveSessionStructure({ type: 'Rest', duration: 0 })).toBeNull()
  })

  it('returns null for tempo without NxM pattern', () => {
    // Plain "Tempo 30min" — single sustained block, not interval reps
    expect(deriveSessionStructure({ type: 'Tempo run', duration: 50 })).toBeNull()
    expect(deriveSessionStructure({ type: 'Tempo 30min', duration: 50 })).toBeNull()
  })

  it('parses Threshold NxM minutes', () => {
    const out = deriveSessionStructure({ type: 'Threshold 2x20', duration: 70 })
    expect(out).not.toBeNull()
    expect(out.estimate).toBe(true)
    expect(out.blocks).toHaveLength(3)
    const [wu, rep, cd] = out.blocks
    expect(wu.kind).toBe('wu')
    expect(rep.kind).toBe('rep')
    expect(rep.count).toBe(2)
    expect(rep.durationMin).toBe(20)
    expect(rep.zone).toBe('Z4')
    expect(rep.recoveryMin).toBe(1.5)
    expect(rep.label.en).toBe('threshold')
    expect(rep.label.tr).toBe('eşik')
    expect(cd.kind).toBe('cd')
    // WU + reps + recovery + CD ≈ total duration
    expect(wu.durationMin + rep.count * rep.durationMin + (rep.count - 1) * rep.recoveryMin + cd.durationMin).toBeCloseTo(70, 0)
  })

  it('parses VO2max NxM with equal-time recovery', () => {
    const out = deriveSessionStructure({ type: 'VO2max 5x3', duration: 55 })
    expect(out).not.toBeNull()
    const [, rep] = out.blocks
    expect(rep.count).toBe(5)
    expect(rep.durationMin).toBe(3)
    expect(rep.zone).toBe('Z5')
    // VO2 recovery = rep duration (3 min)
    expect(rep.recoveryMin).toBe(3)
  })

  it('parses Intervals NxM meters → minutes via 250 m/min heuristic', () => {
    const out = deriveSessionStructure({ type: 'Intervals 6x800m', duration: 60 })
    expect(out).not.toBeNull()
    const [, rep] = out.blocks
    expect(rep.count).toBe(6)
    // 800 m / 250 m·min⁻¹ ≈ 3 min
    expect(rep.durationMin).toBe(3)
    expect(rep.zone).toBe('Z5')
  })

  it('parses cruise intervals (Threshold variant)', () => {
    const out = deriveSessionStructure({ type: 'Cruise intervals 4x10', duration: 60 })
    expect(out).not.toBeNull()
    const [, rep] = out.blocks
    expect(rep.count).toBe(4)
    expect(rep.durationMin).toBe(10)
    expect(rep.zone).toBe('Z4')
  })

  it('parses race-pace NxM with 2 min recovery', () => {
    const out = deriveSessionStructure({ type: 'Race-pace 3x10', duration: 50 })
    expect(out).not.toBeNull()
    const [, rep] = out.blocks
    expect(rep.count).toBe(3)
    expect(rep.recoveryMin).toBe(2)
  })

  it('rejects unreasonable rep counts', () => {
    expect(deriveSessionStructure({ type: 'Threshold 0x20', duration: 60 })).toBeNull()
    expect(deriveSessionStructure({ type: 'Threshold 50x20', duration: 60 })).toBeNull()
  })

  it('handles zero duration without crashing (WU/CD = 0)', () => {
    const out = deriveSessionStructure({ type: 'Threshold 2x20', duration: 0 })
    expect(out).not.toBeNull()
    const [wu, , cd] = out.blocks
    expect(wu.durationMin).toBe(0)
    expect(cd.durationMin).toBe(0)
  })

  it('clamps WU to 10–20 min when total budget is generous', () => {
    const out = deriveSessionStructure({ type: 'Threshold 2x20', duration: 200 })
    expect(out).not.toBeNull()
    const [wu] = out.blocks
    expect(wu.durationMin).toBeLessThanOrEqual(20)
    expect(wu.durationMin).toBeGreaterThanOrEqual(10)
  })

  it('emits bilingual labels for WU and CD', () => {
    const out = deriveSessionStructure({ type: 'VO2max 5x3', duration: 50 })
    const [wu, , cd] = out.blocks
    expect(wu.label.en).toBe('WU easy')
    expect(wu.label.tr).toBe('Isınma kolay')
    expect(cd.label.en).toBe('CD easy')
    expect(cd.label.tr).toBe('Soğuma kolay')
  })

  it('matches longest keyword first (vo2max before vo2)', () => {
    // Both 'vo2' and 'vo2max' substrings exist in 'VO2max ...'
    const out = deriveSessionStructure({ type: 'VO2max 5x3', duration: 50 })
    // Both map to the same effort but the order matters for label.tr
    expect(out.blocks[1].label.tr).toBe('VO2max')
  })

  it('parses short-rep strides in seconds', () => {
    const out = deriveSessionStructure({ type: 'Intervals 8x30s', duration: 35 })
    expect(out).not.toBeNull()
    const [, rep] = out.blocks
    expect(rep.count).toBe(8)
    expect(rep.durationMin).toBeCloseTo(0.5, 2)  // 30 s = 0.5 min
  })

  it('rejects out-of-range seconds (e.g. typo "8x500s")', () => {
    expect(deriveSessionStructure({ type: 'Intervals 8x500s', duration: 60 })).toBeNull()
  })

  it('handles case variants like THRESHOLD 2X20', () => {
    const out = deriveSessionStructure({ type: 'THRESHOLD 2X20', duration: 60 })
    expect(out).not.toBeNull()
    expect(out.blocks[1].zone).toBe('Z4')
  })
})
