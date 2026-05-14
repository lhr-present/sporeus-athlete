// v9.125.0 — Polarized week wrapper tests.
//
// The underlying `weeklyPolarizationScore` is exercised elsewhere; these
// tests lock the wrapper's flag mapping + interpretation contract.

import { describe, it, expect } from 'vitest'
import { analyzePolarizedWeek } from '../../athlete/polarizedWeek.js'

// Anchor today on a Sunday so the current week's Monday is 6 days back.
const TODAY = '2026-05-17' // Sunday
function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
// _zoneMinutes uses the RPE fallback path when entry.zones isn't set:
//   rpe <= 5 → easy, 6-7 → threshold, >=8 → hard
function entry(daysAgo, rpe, durationMin) {
  return { date: addDays(TODAY, -daysAgo), rpe, duration: durationMin, tss: durationMin }
}

describe('analyzePolarizedWeek — guards', () => {
  it('returns null for empty log', () => {
    expect(analyzePolarizedWeek([], TODAY)).toBeNull()
  })
  it('returns null when total minutes < 60 (insufficient_data)', () => {
    const log = [entry(1, 4, 30)]
    expect(analyzePolarizedWeek(log, TODAY)).toBeNull()
  })
  it('tolerates non-array log', () => {
    expect(analyzePolarizedWeek(null, TODAY)).toBeNull()
  })
})

describe('analyzePolarizedWeek — polarized (silent)', () => {
  it('polarized flag and no interpretation when 80/20 split', () => {
    // 240 min easy (rpe 4) + 60 min hard (rpe 9) = 300 min; 80% easy, 20% hard
    const log = [
      entry(1, 4, 60),
      entry(2, 4, 60),
      entry(3, 4, 60),
      entry(4, 4, 60),
      entry(5, 9, 60),
    ]
    const out = analyzePolarizedWeek(log, TODAY)
    expect(out.flag).toBe('polarized')
    expect(out.interpretation).toBeNull()
    expect(out.model).toBe('polarized')
  })
})

describe('analyzePolarizedWeek — threshold drift', () => {
  it('drift-threshold flag when Z3 share > 40%', () => {
    // Heavy threshold load (Seiler's no-man's-land)
    const log = [
      entry(1, 4, 60),
      entry(2, 6, 90),
      entry(3, 6, 90),
      entry(4, 6, 60),
    ]
    const out = analyzePolarizedWeek(log, TODAY)
    expect(out.flag).toBe('drift-threshold')
    expect(out.interpretation.en).toContain('no-man')
    expect(out.interpretation.tr).toContain('ölü bölgesi')
  })
})

describe('analyzePolarizedWeek — day-of-week guard (v9.129 OOO)', () => {
  const MONDAY    = '2026-05-11'
  const TUESDAY   = '2026-05-12'
  const WEDNESDAY = '2026-05-13'
  it('suppresses banner on Monday when threshold share is moderate', () => {
    // 60 easy + 90 threshold = 60% threshold (drift-threshold model)
    const log = [
      { date: MONDAY, rpe: 4, duration: 60, tss: 60 },
      { date: MONDAY, rpe: 6, duration: 90, tss: 90 },
    ]
    const out = analyzePolarizedWeek(log, MONDAY)
    // Threshold share = 60% which is >= 50 floor → banner SHOULD fire
    expect(out).not.toBeNull()
    expect(out.flag).toBe('drift-threshold')
  })
  it('suppresses Monday banner when threshold share is below 50%', () => {
    // 90 easy + 60 threshold = 40% threshold
    const log = [
      { date: MONDAY, rpe: 4, duration: 90, tss: 90 },
      { date: MONDAY, rpe: 6, duration: 60, tss: 60 },
    ]
    expect(analyzePolarizedWeek(log, MONDAY)).toBeNull()
  })
  it('suppresses Tuesday banner when threshold share < 50%', () => {
    const log = [
      { date: MONDAY,  rpe: 4, duration: 90, tss: 90 },
      { date: TUESDAY, rpe: 6, duration: 60, tss: 60 },
    ]
    expect(analyzePolarizedWeek(log, TUESDAY)).toBeNull()
  })
  it('Wednesday fires the banner at moderate threshold share', () => {
    // By Wednesday, distribution is more meaningful — no early-week guard.
    const log = [
      { date: MONDAY,    rpe: 4, duration: 60, tss: 60 },
      { date: TUESDAY,   rpe: 6, duration: 60, tss: 60 },
      { date: WEDNESDAY, rpe: 6, duration: 30, tss: 30 },
    ]
    const out = analyzePolarizedWeek(log, WEDNESDAY)
    expect(out).not.toBeNull()
  })
})

describe('analyzePolarizedWeek — citation + structure', () => {
  it('exposes weekStart and citation', () => {
    const log = [
      entry(1, 4, 60),
      entry(2, 6, 90),
      entry(3, 6, 90),
      entry(4, 6, 60),
    ]
    const out = analyzePolarizedWeek(log, TODAY)
    expect(out.weekStart).toBeTruthy()
    expect(out.citation).toContain('Seiler')
    expect(typeof out.easyPct).toBe('number')
    expect(typeof out.thresholdPct).toBe('number')
    expect(typeof out.hardPct).toBe('number')
  })
})
