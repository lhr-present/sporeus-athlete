// ─── caffeineDose.test.js — Pre-session caffeine dose calculator ────────────
import { describe, it, expect } from 'vitest'
import { computeCaffeineDose, CAFFEINE_DOSE_CITATION } from '../../athlete/caffeineDose.js'

const hardSession = { type: 'intervals', duration: 60, rpe: 8 }
const easySession = { type: 'recovery',  duration: 45, rpe: 3 }
const longSession = { type: 'threshold', duration: 120, rpe: 7 }
const raceSession = { type: 'race day',  duration: 180, rpe: 9 }

describe('computeCaffeineDose — null gating', () => {
  it('(a) returns null when profile.weight is missing', () => {
    const r = computeCaffeineDose({ profile: {}, plannedSession: hardSession })
    expect(r).toBeNull()
  })

  it('(a2) returns null when profile is null', () => {
    const r = computeCaffeineDose({ profile: null, plannedSession: hardSession })
    expect(r).toBeNull()
  })

  it('(a3) returns null when weight is a string / non-positive / NaN', () => {
    expect(computeCaffeineDose({ profile: { weight: 'foo' }, plannedSession: hardSession })).toBeNull()
    expect(computeCaffeineDose({ profile: { weight: 0 },     plannedSession: hardSession })).toBeNull()
    expect(computeCaffeineDose({ profile: { weight: -5 },    plannedSession: hardSession })).toBeNull()
  })

  it('(b) returns null when plannedSession is missing', () => {
    const r = computeCaffeineDose({ profile: { weight: 70 }, plannedSession: null })
    expect(r).toBeNull()
  })

  it('(c) returns null for an easy session (RPE 3, recovery)', () => {
    const r = computeCaffeineDose({ profile: { weight: 70 }, plannedSession: easySession })
    expect(r).toBeNull()
  })
})

describe('computeCaffeineDose — dose math', () => {
  it('(d) 70 kg hard session — typical 350 mg, min/max within Burke 3-6 mg/kg band', () => {
    // 5 × 70 = 350 (already a multiple of 25). 3 × 70 = 210 → quantized 200.
    // 6 × 70 = 420 → quantized 425. Express the spec band tolerance instead
    // of exact 210 / 420 — the dose calculator quantizes to 25 mg increments.
    const r = computeCaffeineDose({ profile: { weight: 70 }, plannedSession: hardSession })
    expect(r).not.toBeNull()
    expect(r.doseTypicalMg).toBe(350)
    expect(r.doseMinMg).toBeGreaterThanOrEqual(175)
    expect(r.doseMinMg).toBeLessThanOrEqual(225)
    expect(r.doseMaxMg).toBeGreaterThanOrEqual(400)
    expect(r.doseMaxMg).toBeLessThanOrEqual(450)
  })

  it('(d2) 70 kg dose mg/kg breakdown matches Burke 3-5-6 band after 25mg quantize', () => {
    const r = computeCaffeineDose({ profile: { weight: 70 }, plannedSession: hardSession })
    // typical mg/kg should be ≈5 (clean), min ≈3, max ≈6 — within ±0.5 mg/kg of band
    expect(Math.abs(r.doseTypicalMg / 70 - 5)).toBeLessThan(0.5)
    expect(Math.abs(r.doseMinMg     / 70 - 3)).toBeLessThan(0.5)
    expect(Math.abs(r.doseMaxMg     / 70 - 6)).toBeLessThan(0.5)
  })

  it('(e) caffeineSensitivity=high caps typical at 3 mg/kg for a 60 kg athlete', () => {
    const r = computeCaffeineDose({
      profile: { weight: 60, caffeineSensitivity: 'high' },
      plannedSession: hardSession,
    })
    expect(r).not.toBeNull()
    // 3 × 60 = 180 → rounded to nearest 25 = 175 mg (still ≈3 mg/kg, capped)
    expect(r.doseTypicalMg).toBe(175)
    // Capped: typical equals min for high-sensitivity athletes (both ~3 mg/kg)
    expect(r.doseTypicalMg).toBeLessThanOrEqual(r.doseMinMg + 25)
  })

  it('(e2) caffeineSensitivity=low keeps the 5x typical dose', () => {
    const r = computeCaffeineDose({
      profile: { weight: 70, caffeineSensitivity: 'low' },
      plannedSession: hardSession,
    })
    expect(r.doseTypicalMg).toBe(350)   // 5 × 70 — unchanged
  })

  it('(f) long session (>90 min) sets longSessionSplit=true', () => {
    const r = computeCaffeineDose({ profile: { weight: 70 }, plannedSession: longSession })
    expect(r.longSessionSplit).toBe(true)
  })

  it('(f2) short hard session (≤90 min) sets longSessionSplit=false', () => {
    const r = computeCaffeineDose({ profile: { weight: 70 }, plannedSession: hardSession })
    expect(r.longSessionSplit).toBe(false)
  })

  it('(g) timingMinutesPre is 45 (mid of 30-60 window)', () => {
    const r = computeCaffeineDose({ profile: { weight: 70 }, plannedSession: hardSession })
    expect(r.timingMinutesPre).toBe(45)
  })

  it('(h) doses are quantized to 25 mg increments', () => {
    // Weights chosen so the unrounded product is not already a multiple of 25
    for (const w of [62, 67, 73, 81, 88]) {
      const r = computeCaffeineDose({ profile: { weight: w }, plannedSession: hardSession })
      expect(r.doseMinMg     % 25).toBe(0)
      expect(r.doseTypicalMg % 25).toBe(0)
      expect(r.doseMaxMg     % 25).toBe(0)
    }
  })
})

describe('computeCaffeineDose — hard session detection', () => {
  it('detects "intervals" type as hard', () => {
    const r = computeCaffeineDose({
      profile: { weight: 70 },
      plannedSession: { type: 'intervals', duration: 60, rpe: 5 },
    })
    expect(r).not.toBeNull()
  })

  it('detects "vo2" type as hard', () => {
    const r = computeCaffeineDose({
      profile: { weight: 70 },
      plannedSession: { type: 'vo2max', duration: 60, rpe: 5 },
    })
    expect(r).not.toBeNull()
  })

  it('detects "tempo" type as hard', () => {
    const r = computeCaffeineDose({
      profile: { weight: 70 },
      plannedSession: { type: 'Tempo', duration: 60, rpe: 5 },
    })
    expect(r).not.toBeNull()
  })

  it('detects race day as hard', () => {
    const r = computeCaffeineDose({ profile: { weight: 70 }, plannedSession: raceSession })
    expect(r).not.toBeNull()
  })

  it('detects RPE ≥ 7 as hard even when type is generic', () => {
    const r = computeCaffeineDose({
      profile: { weight: 70 },
      plannedSession: { type: 'endurance', duration: 60, rpe: 7 },
    })
    expect(r).not.toBeNull()
  })
})

describe('computeCaffeineDose — citation + shape', () => {
  it('returns the Burke / Stear / IOC citation string', () => {
    const r = computeCaffeineDose({ profile: { weight: 70 }, plannedSession: hardSession })
    expect(r.citation).toBe(CAFFEINE_DOSE_CITATION)
    expect(r.citation).toMatch(/Burke 2017/)
    expect(r.citation).toMatch(/IOC 2018/)
  })

  it('returns the matched session as eligibleSession', () => {
    const r = computeCaffeineDose({ profile: { weight: 70 }, plannedSession: hardSession })
    expect(r.eligibleSession).toBe(hardSession)
  })

  it('respects the 100-600 mg clamp at extreme weights', () => {
    const tiny  = computeCaffeineDose({ profile: { weight: 30 }, plannedSession: hardSession })
    const giant = computeCaffeineDose({ profile: { weight: 200 }, plannedSession: hardSession })
    expect(tiny.doseMinMg).toBeGreaterThanOrEqual(100)
    expect(giant.doseMaxMg).toBeLessThanOrEqual(600)
  })
})
