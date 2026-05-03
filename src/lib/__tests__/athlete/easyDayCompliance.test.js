// E127 — easyDayCompliance lib tests
import { describe, it, expect } from 'vitest'
import { detectEasyDayCompliance } from '../../athlete/easyDayCompliance.js'

const TODAY = '2026-04-30'

// ── Helper: build a log relative to TODAY ────────────────────────────────────
function makeLog(entries) {
  return entries.map((e, i) => ({
    date: e.date || addDaysStr(TODAY, -i),
    type: e.type ?? 'recovery',
    duration: e.duration ?? 60,
    rpe: e.rpe,
    zones: e.zones,
    ...e,
  }))
}

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe('detectEasyDayCompliance', () => {
  it('returns safe defaults for null log', () => {
    const r = detectEasyDayCompliance(null, TODAY)
    expect(r.totalEasy).toBe(0)
    expect(r.driftSessions).toBe(0)
    expect(r.compliancePct).toBe(0)
    expect(r.band).toBe('poor')
    expect(r.reliable).toBe(false)
    expect(r.citation).toBeTruthy()
  })

  it('returns safe defaults for empty array', () => {
    const r = detectEasyDayCompliance([], TODAY)
    expect(r.totalEasy).toBe(0)
    expect(r.reliable).toBe(false)
  })

  it('returns reliable=false when totalEasy < 5', () => {
    const log = makeLog([
      { type: 'recovery', rpe: 3 },
      { type: 'easy', rpe: 4 },
      { type: 'recovery', rpe: 3 },
    ])
    const r = detectEasyDayCompliance(log, TODAY)
    expect(r.totalEasy).toBe(3)
    expect(r.reliable).toBe(false)
  })

  it('returns reliable=true at exactly 5 easy sessions', () => {
    const log = makeLog([
      { rpe: 3 }, { rpe: 4 }, { rpe: 3 }, { rpe: 4 }, { rpe: 3 },
    ])
    const r = detectEasyDayCompliance(log, TODAY)
    expect(r.totalEasy).toBe(5)
    expect(r.reliable).toBe(true)
  })

  it('100% compliance when all easy sessions have RPE 3 + Z2-only', () => {
    const log = makeLog(Array.from({ length: 10 }, () => ({
      type: 'recovery', rpe: 3, zones: [0, 60, 0, 0, 0],
    })))
    const r = detectEasyDayCompliance(log, TODAY)
    expect(r.compliancePct).toBe(100)
    expect(r.band).toBe('good')
    expect(r.driftSessions).toBe(0)
  })

  it('0% compliance when all easy sessions have RPE 7', () => {
    // Type is 'recovery' (label easy) but RPE=7 means drift
    const log = makeLog(Array.from({ length: 10 }, () => ({
      type: 'recovery', rpe: 7,
    })))
    const r = detectEasyDayCompliance(log, TODAY)
    expect(r.compliancePct).toBe(0)
    expect(r.band).toBe('poor')
    expect(r.driftSessions).toBe(10)
  })

  it('80% compliance with 8 compliant + 2 drift → band="good"', () => {
    const compliant = Array.from({ length: 8 }, () => ({ type: 'recovery', rpe: 3 }))
    const drift = [{ type: 'recovery', rpe: 7 }, { type: 'easy', rpe: 6 }]
    const r = detectEasyDayCompliance(makeLog([...compliant, ...drift]), TODAY)
    expect(r.compliancePct).toBe(80)
    expect(r.band).toBe('good')
  })

  it('boundary: exactly 80% → band="good" (>=80% rule)', () => {
    // 4 compliant + 1 drift = 80%
    const log = makeLog([
      { rpe: 3 }, { rpe: 3 }, { rpe: 3 }, { rpe: 3 }, { rpe: 7 },
    ])
    const r = detectEasyDayCompliance(log, TODAY)
    expect(r.compliancePct).toBe(80)
    expect(r.band).toBe('good')
  })

  it('boundary: 79% → band="moderate" (strict <80% for moderate)', () => {
    // 79 compliant + 21 drift = 79%
    const compliant = Array.from({ length: 79 }, (_, i) => ({
      date: addDaysStr(TODAY, -(i % 28)), type: 'recovery', rpe: 3,
    }))
    const drift = Array.from({ length: 21 }, (_, i) => ({
      date: addDaysStr(TODAY, -(i % 28)), type: 'recovery', rpe: 7,
    }))
    const r = detectEasyDayCompliance([...compliant, ...drift], TODAY)
    expect(r.compliancePct).toBe(79)
    expect(r.band).toBe('moderate')
  })

  it('boundary: exactly 60% → band="moderate" (>=60% rule)', () => {
    // 6 compliant + 4 drift = 60%
    const log = makeLog([
      { rpe: 3 }, { rpe: 3 }, { rpe: 3 }, { rpe: 3 }, { rpe: 3 }, { rpe: 3 },
      { rpe: 7 }, { rpe: 7 }, { rpe: 7 }, { rpe: 7 },
    ])
    const r = detectEasyDayCompliance(log, TODAY)
    expect(r.compliancePct).toBe(60)
    expect(r.band).toBe('moderate')
  })

  it('boundary: 59% → band="poor" (strict <60% for poor)', () => {
    // 59 compliant + 41 drift = 59%
    const compliant = Array.from({ length: 59 }, (_, i) => ({
      date: addDaysStr(TODAY, -(i % 28)), type: 'recovery', rpe: 3,
    }))
    const drift = Array.from({ length: 41 }, (_, i) => ({
      date: addDaysStr(TODAY, -(i % 28)), type: 'recovery', rpe: 7,
    }))
    const r = detectEasyDayCompliance([...compliant, ...drift], TODAY)
    expect(r.compliancePct).toBe(59)
    expect(r.band).toBe('poor')
  })

  it('detects drift via RPE>5 alone (no zone data)', () => {
    const log = makeLog([
      { type: 'recovery', rpe: 3 }, { type: 'recovery', rpe: 4 },
      { type: 'recovery', rpe: 3 }, { type: 'recovery', rpe: 4 },
      { type: 'recovery', rpe: 6 }, // drift via RPE
    ])
    const r = detectEasyDayCompliance(log, TODAY)
    expect(r.driftSessions).toBe(1)
  })

  it('detects drift via Z3+Z4+Z5 share > 20% (zones-only signal)', () => {
    // Type=recovery, no rpe, but zones show 30% hard
    const log = makeLog([
      { type: 'recovery', rpe: undefined, zones: [0, 70, 30, 0, 0] }, // drift
      { type: 'recovery', rpe: undefined, zones: [0, 60, 0, 0, 0] },
      { type: 'recovery', rpe: undefined, zones: [0, 60, 0, 0, 0] },
      { type: 'recovery', rpe: undefined, zones: [0, 60, 0, 0, 0] },
      { type: 'recovery', rpe: undefined, zones: [0, 60, 0, 0, 0] },
    ])
    // The first one has rpe=undefined but type=recovery → labeled easy
    // wait — we need rpe undefined AND type=recovery — type makes it labeled easy
    // For zones: 30/100 = 30% > 20% → drift
    const r = detectEasyDayCompliance(log, TODAY)
    expect(r.driftSessions).toBeGreaterThanOrEqual(1)
  })

  it('boundary: exactly 20% hard share is NOT drift (strict > rule)', () => {
    // type=recovery, rpe=4, zones with exactly 20% Z3 share
    const log = makeLog([
      { type: 'recovery', rpe: 4, zones: [0, 80, 20, 0, 0] }, // 20/100=20% exactly
      { type: 'recovery', rpe: 3 },
      { type: 'recovery', rpe: 3 },
      { type: 'recovery', rpe: 3 },
      { type: 'recovery', rpe: 3 },
    ])
    const r = detectEasyDayCompliance(log, TODAY)
    expect(r.driftSessions).toBe(0) // 20% exact is not drift
  })

  it('classifies type="recovery" as labeled-easy', () => {
    const log = makeLog([
      { type: 'recovery', rpe: 3 }, { type: 'recovery', rpe: 4 },
      { type: 'recovery', rpe: 3 }, { type: 'recovery', rpe: 4 },
      { type: 'recovery', rpe: 3 },
    ])
    const r = detectEasyDayCompliance(log, TODAY)
    expect(r.totalEasy).toBe(5)
  })

  it('classifies type="easy" as labeled-easy', () => {
    const log = makeLog([
      { type: 'easy', rpe: 3 }, { type: 'easy', rpe: 4 },
      { type: 'easy', rpe: 3 }, { type: 'easy', rpe: 4 },
      { type: 'easy', rpe: 3 },
    ])
    const r = detectEasyDayCompliance(log, TODAY)
    expect(r.totalEasy).toBe(5)
  })

  it('classifies entry.intent="recovery" as labeled-easy', () => {
    const log = makeLog([
      { type: 'misc', intent: 'recovery', rpe: 3 },
      { type: 'misc', intent: 'recovery', rpe: 3 },
      { type: 'misc', intent: 'recovery', rpe: 3 },
      { type: 'misc', intent: 'recovery', rpe: 3 },
      { type: 'misc', intent: 'recovery', rpe: 3 },
    ])
    const r = detectEasyDayCompliance(log, TODAY)
    expect(r.totalEasy).toBe(5)
  })

  it('classifies RPE<=4 alone as labeled-easy (no type/intent needed)', () => {
    const log = makeLog([
      { type: 'tempo', rpe: 4 }, // type=tempo but RPE=4 makes it easy
      { type: 'misc', rpe: 3 },
      { type: 'misc', rpe: 4 },
      { type: 'misc', rpe: 3 },
      { type: 'misc', rpe: 2 },
    ])
    const r = detectEasyDayCompliance(log, TODAY)
    expect(r.totalEasy).toBe(5)
  })

  it('does NOT classify RPE 5 as labeled-easy', () => {
    const log = makeLog([
      { type: 'misc', rpe: 5 }, { type: 'misc', rpe: 5 },
      { type: 'misc', rpe: 5 }, { type: 'misc', rpe: 5 }, { type: 'misc', rpe: 5 },
    ])
    const r = detectEasyDayCompliance(log, TODAY)
    expect(r.totalEasy).toBe(0)
  })

  it('caps driftDates at 5 entries (most recent first)', () => {
    const drifts = Array.from({ length: 10 }, (_, i) => ({
      date: addDaysStr(TODAY, -i),
      type: 'recovery',
      rpe: 7,
    }))
    const r = detectEasyDayCompliance(drifts, TODAY)
    expect(r.driftDates.length).toBe(5)
    // Most recent first — first entry should be TODAY
    expect(r.driftDates[0]).toBe(TODAY)
  })

  it('excludes sessions outside the 28-day window', () => {
    const old = { date: addDaysStr(TODAY, -50), type: 'recovery', rpe: 7 }
    const recent5 = Array.from({ length: 5 }, (_, i) => ({
      date: addDaysStr(TODAY, -i), type: 'recovery', rpe: 3,
    }))
    const r = detectEasyDayCompliance([old, ...recent5], TODAY)
    expect(r.totalEasy).toBe(5) // old one excluded
    expect(r.driftSessions).toBe(0)
  })

  it('result has all 9 expected keys', () => {
    const log = makeLog([{ type: 'recovery', rpe: 3 }])
    const r = detectEasyDayCompliance(log, TODAY)
    expect(r).toHaveProperty('totalEasy')
    expect(r).toHaveProperty('driftSessions')
    expect(r).toHaveProperty('compliancePct')
    expect(r).toHaveProperty('band')
    expect(r).toHaveProperty('driftDates')
    expect(r).toHaveProperty('message')
    expect(r).toHaveProperty('recommendation')
    expect(r).toHaveProperty('reliable')
    expect(r).toHaveProperty('citation')
  })

  it('bilingual: en + tr non-empty for moderate band', () => {
    const log = makeLog([
      { rpe: 3 }, { rpe: 3 }, { rpe: 3 }, { rpe: 3 }, { rpe: 3 },
      { rpe: 3 }, { rpe: 7 }, { rpe: 7 }, { rpe: 7 }, { rpe: 7 },
    ])
    const r = detectEasyDayCompliance(log, TODAY)
    expect(r.band).toBe('moderate')
    expect(r.message.en.length).toBeGreaterThan(0)
    expect(r.message.tr.length).toBeGreaterThan(0)
    expect(r.recommendation.en.length).toBeGreaterThan(0)
    expect(r.recommendation.tr.length).toBeGreaterThan(0)
  })

  it('bilingual: en + tr non-empty for poor band', () => {
    const log = makeLog([
      { rpe: 3 }, { rpe: 7 }, { rpe: 7 }, { rpe: 7 }, { rpe: 7 },
    ])
    const r = detectEasyDayCompliance(log, TODAY)
    expect(r.band).toBe('poor')
    expect(r.message.en.length).toBeGreaterThan(0)
    expect(r.message.tr.length).toBeGreaterThan(0)
    expect(r.recommendation.en.length).toBeGreaterThan(0)
    expect(r.recommendation.tr.length).toBeGreaterThan(0)
  })

  it('recommendation is empty for good band', () => {
    const log = makeLog(Array.from({ length: 10 }, () => ({ type: 'recovery', rpe: 3 })))
    const r = detectEasyDayCompliance(log, TODAY)
    expect(r.band).toBe('good')
    expect(r.recommendation.en).toBe('')
    expect(r.recommendation.tr).toBe('')
  })

  it('citation is "Seiler 2010; Stöggl & Sperlich 2014"', () => {
    const r = detectEasyDayCompliance([], TODAY)
    expect(r.citation).toBe('Seiler 2010; Stöggl & Sperlich 2014')
  })

  it('compliancePct is rounded to a whole number', () => {
    // 1 compliant + 2 drift = 33.33% — should round to 33
    const log = makeLog([
      { rpe: 3 }, { rpe: 7 }, { rpe: 7 },
    ])
    const r = detectEasyDayCompliance(log, TODAY)
    expect(Number.isInteger(r.compliancePct)).toBe(true)
    expect(r.compliancePct).toBe(33)
  })
})
