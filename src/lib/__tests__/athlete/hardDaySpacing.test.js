// Hard-Day Spacing Compliance — lib tests
import { describe, it, expect } from 'vitest'
import {
  detectHardDaySpacing,
  HARD_DAY_SPACING_CITATION,
} from '../../athlete/hardDaySpacing.js'

const TODAY = '2026-04-30'

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Build log entries — caller supplies explicit dates relative to TODAY.
function entry(daysAgo, overrides = {}) {
  return {
    date: addDaysStr(TODAY, -daysAgo),
    type: overrides.type ?? 'intervals',
    duration: overrides.duration ?? 45,
    rpe: overrides.rpe ?? 8,
    zones: overrides.zones,
    intent: overrides.intent,
    ...overrides,
    // Ensure the spread doesn't overwrite our explicit date.
    date: addDaysStr(TODAY, -daysAgo),
  }
}

describe('detectHardDaySpacing', () => {
  it('returns safe defaults for null log', () => {
    const r = detectHardDaySpacing(null, TODAY)
    expect(r.totalHard).toBe(0)
    expect(r.violations).toBe(0)
    expect(r.compliancePct).toBe(0)
    expect(r.band).toBe('poor')
    expect(r.reliable).toBe(false)
  })

  it('returns safe defaults for undefined log', () => {
    const r = detectHardDaySpacing(undefined, TODAY)
    expect(r.totalHard).toBe(0)
    expect(r.reliable).toBe(false)
  })

  it('returns safe defaults for empty array', () => {
    const r = detectHardDaySpacing([], TODAY)
    expect(r.totalHard).toBe(0)
    expect(r.compliancePct).toBe(0)
  })

  it('includes citation in returned object', () => {
    const r = detectHardDaySpacing([], TODAY)
    expect(r.citation).toBe(HARD_DAY_SPACING_CITATION)
    expect(r.citation).toMatch(/Lambert|Foster|Seiler/)
  })

  it('returns 100% compliance with no hard sessions', () => {
    const log = [
      entry(2, { type: 'recovery', rpe: 3 }),
      entry(4, { type: 'easy', rpe: 4 }),
      entry(6, { type: 'endurance', rpe: 4 }),
    ]
    const r = detectHardDaySpacing(log, TODAY)
    expect(r.totalHard).toBe(0)
    expect(r.compliancePct).toBe(100)
    expect(r.band).toBe('good')
    expect(r.message.en).toMatch(/No hard sessions/i)
  })

  it('detects a single back-to-back hard pair', () => {
    const log = [
      entry(5, { type: 'intervals', rpe: 8 }),
      entry(4, { type: 'threshold', rpe: 8 }),
      entry(0, { type: 'recovery', rpe: 3 }),
    ]
    const r = detectHardDaySpacing(log, TODAY)
    expect(r.totalHard).toBe(2)
    expect(r.violations).toBe(1)
    expect(r.compliancePct).toBe(50)
    expect(r.band).toBe('poor')
  })

  it('counts no violation when hard sessions are 2+ days apart', () => {
    const log = [
      entry(7, { type: 'intervals', rpe: 8 }),
      entry(4, { type: 'threshold', rpe: 8 }),
      entry(1, { type: 'vo2', rpe: 9 }),
    ]
    const r = detectHardDaySpacing(log, TODAY)
    expect(r.totalHard).toBe(3)
    expect(r.violations).toBe(0)
    expect(r.compliancePct).toBe(100)
    expect(r.band).toBe('good')
  })

  it('classifies session as hard by RPE >= 7 even with easy type label', () => {
    const log = [
      entry(3, { type: 'recovery', rpe: 8 }),
      entry(2, { type: 'easy', rpe: 8 }),
    ]
    const r = detectHardDaySpacing(log, TODAY)
    expect(r.totalHard).toBe(2)
    expect(r.violations).toBe(1)
  })

  it('classifies session as hard by type regex (tempo)', () => {
    const log = [
      entry(2, { type: 'Bike Tempo', rpe: 6 }),
      entry(1, { type: 'tempo', rpe: 5 }),
    ]
    const r = detectHardDaySpacing(log, TODAY)
    expect(r.totalHard).toBe(2)
    expect(r.violations).toBe(1)
  })

  it('classifies session as hard by intent', () => {
    const log = [
      entry(3, { type: 'run', intent: 'intervals', rpe: 5 }),
      entry(2, { type: 'run', intent: 'race', rpe: 5 }),
      entry(0, { type: 'run', intent: 'recovery', rpe: 3 }),
    ]
    const r = detectHardDaySpacing(log, TODAY)
    expect(r.totalHard).toBe(2)
    expect(r.violations).toBe(1)
  })

  it('classifies session as hard by zone shares > 50% Z3+Z4+Z5', () => {
    const log = [
      entry(3, { type: 'ride', rpe: 5, zones: [10, 10, 30, 30, 10] }), // 70% Z3+
      entry(2, { type: 'ride', rpe: 5, zones: [5, 5, 20, 30, 40] }),    // 90% Z3+
    ]
    const r = detectHardDaySpacing(log, TODAY)
    expect(r.totalHard).toBe(2)
    expect(r.violations).toBe(1)
  })

  it('treats zones object shape {Z1..Z5} the same as array', () => {
    const log = [
      entry(3, { type: 'ride', rpe: 5, zones: { Z1: 10, Z2: 10, Z3: 30, Z4: 30, Z5: 10 } }),
      entry(2, { type: 'ride', rpe: 5, zones: { Z1: 5, Z2: 5, Z3: 20, Z4: 30, Z5: 40 } }),
    ]
    const r = detectHardDaySpacing(log, TODAY)
    expect(r.totalHard).toBe(2)
    expect(r.violations).toBe(1)
  })

  it('multiple hard sessions on the same calendar day count as one hard day', () => {
    const log = [
      entry(2, { type: 'intervals', rpe: 8 }),
      entry(2, { type: 'threshold', rpe: 8 }),
      entry(0, { type: 'recovery', rpe: 3 }),
    ]
    const r = detectHardDaySpacing(log, TODAY)
    expect(r.totalHard).toBe(1)
    expect(r.violations).toBe(0)
  })

  it('detects 3 consecutive hard days as 2 violations', () => {
    const log = [
      entry(5, { type: 'intervals', rpe: 8 }),
      entry(4, { type: 'threshold', rpe: 8 }),
      entry(3, { type: 'vo2', rpe: 9 }),
    ]
    const r = detectHardDaySpacing(log, TODAY)
    expect(r.totalHard).toBe(3)
    expect(r.violations).toBe(2)
    expect(r.compliancePct).toBe(33)
    expect(r.band).toBe('poor')
  })

  it('produces moderate band when compliance is 60-79%', () => {
    // 5 hard sessions, 1 violation pair → 80% would be good, so make it 1 violation out of 5 = 80%; need 60-79%.
    // 5 hard sessions, 2 violations → 60% → moderate
    const log = [
      entry(10, { type: 'intervals', rpe: 8 }),
      entry(9, { type: 'threshold', rpe: 8 }),  // violation #1
      entry(6, { type: 'tempo', rpe: 7 }),
      entry(5, { type: 'vo2', rpe: 9 }),         // violation #2
      entry(2, { type: 'intervals', rpe: 8 }),
    ]
    const r = detectHardDaySpacing(log, TODAY)
    expect(r.totalHard).toBe(5)
    expect(r.violations).toBe(2)
    expect(r.compliancePct).toBe(60)
    expect(r.band).toBe('moderate')
  })

  it('produces good band at exactly 80% compliance', () => {
    const log = [
      entry(15, { type: 'intervals', rpe: 8 }),
      entry(14, { type: 'threshold', rpe: 8 }), // 1 violation
      entry(11, { type: 'tempo', rpe: 7 }),
      entry(8, { type: 'vo2', rpe: 9 }),
      entry(4, { type: 'intervals', rpe: 8 }),
    ]
    const r = detectHardDaySpacing(log, TODAY)
    expect(r.totalHard).toBe(5)
    expect(r.violations).toBe(1)
    expect(r.compliancePct).toBe(80)
    expect(r.band).toBe('good')
  })

  it('reliable=true when totalHard >= 4', () => {
    const log = [
      entry(15, { type: 'intervals', rpe: 8 }),
      entry(12, { type: 'threshold', rpe: 8 }),
      entry(8, { type: 'tempo', rpe: 7 }),
      entry(4, { type: 'vo2', rpe: 9 }),
    ]
    const r = detectHardDaySpacing(log, TODAY)
    expect(r.totalHard).toBe(4)
    expect(r.reliable).toBe(true)
  })

  it('reliable=false when totalHard < 4', () => {
    const log = [
      entry(10, { type: 'intervals', rpe: 8 }),
      entry(5, { type: 'threshold', rpe: 8 }),
      entry(1, { type: 'tempo', rpe: 7 }),
    ]
    const r = detectHardDaySpacing(log, TODAY)
    expect(r.totalHard).toBe(3)
    expect(r.reliable).toBe(false)
  })

  it('filters entries outside the 28-day window', () => {
    const log = [
      entry(40, { type: 'intervals', rpe: 8 }), // outside
      entry(39, { type: 'threshold', rpe: 8 }), // outside
      entry(5, { type: 'vo2', rpe: 9 }),
    ]
    const r = detectHardDaySpacing(log, TODAY)
    expect(r.totalHard).toBe(1)
    expect(r.violations).toBe(0)
  })

  it('returns violation dates as the later date of each pair', () => {
    const log = [
      entry(5, { type: 'intervals', rpe: 8 }),
      entry(4, { type: 'threshold', rpe: 8 }),
    ]
    const r = detectHardDaySpacing(log, TODAY)
    expect(r.violationDates).toHaveLength(1)
    // The "later" date of (5d ago, 4d ago) is 4d ago.
    expect(r.violationDates[0]).toBe(addDaysStr(TODAY, -4))
  })

  it('caps violation dates at the 5 most-recent pairs', () => {
    // Build 7 consecutive hard days → 6 violations
    const log = []
    for (let d = 7; d >= 1; d--) log.push(entry(d, { type: 'intervals', rpe: 8 }))
    const r = detectHardDaySpacing(log, TODAY)
    expect(r.totalHard).toBe(7)
    expect(r.violations).toBe(6)
    expect(r.violationDates).toHaveLength(5)
  })

  it('handles entries with missing date gracefully', () => {
    const log = [
      { type: 'intervals', rpe: 8 }, // no date — filtered
      entry(5, { type: 'intervals', rpe: 8 }),
      entry(4, { type: 'threshold', rpe: 8 }),
    ]
    const r = detectHardDaySpacing(log, TODAY)
    expect(r.totalHard).toBe(2)
    expect(r.violations).toBe(1)
  })

  it('handles entries with non-numeric RPE without crash', () => {
    const log = [
      entry(5, { type: 'intervals', rpe: 'eight' }), // type-based hard
      entry(4, { type: 'threshold', rpe: null }),    // type-based hard
    ]
    const r = detectHardDaySpacing(log, TODAY)
    expect(r.totalHard).toBe(2)
    expect(r.violations).toBe(1)
  })

  it('returns bilingual EN+TR message strings', () => {
    const log = [
      entry(5, { type: 'intervals', rpe: 8 }),
      entry(4, { type: 'threshold', rpe: 8 }),
    ]
    const r = detectHardDaySpacing(log, TODAY)
    expect(r.message.en).toBeTruthy()
    expect(r.message.tr).toBeTruthy()
    expect(r.message.tr).not.toBe(r.message.en)
    expect(r.recommendation.en).toBeTruthy()
    expect(r.recommendation.tr).toBeTruthy()
  })

  it('moderate band recommendation differs from poor band recommendation', () => {
    const moderateLog = [
      entry(20, { type: 'intervals', rpe: 8 }),
      entry(19, { type: 'threshold', rpe: 8 }), // violation #1
      entry(15, { type: 'tempo', rpe: 7 }),
      entry(11, { type: 'vo2', rpe: 9 }),
      entry(4, { type: 'intervals', rpe: 8 }),
    ]
    const moderate = detectHardDaySpacing(moderateLog, TODAY)
    expect(moderate.band).toBe('good') // 1 violation/5 = 80% → good

    // Make it actual moderate: 2 violations / 5 = 60%
    const moderateLog2 = [
      entry(20, { type: 'intervals', rpe: 8 }),
      entry(19, { type: 'threshold', rpe: 8 }),
      entry(15, { type: 'tempo', rpe: 7 }),
      entry(14, { type: 'vo2', rpe: 9 }),
      entry(4, { type: 'intervals', rpe: 8 }),
    ]
    const r = detectHardDaySpacing(moderateLog2, TODAY)
    expect(r.band).toBe('moderate')
    expect(r.recommendation.en).toMatch(/easy|rest/i)
  })

  it('poor band recommendation suggests week restructure', () => {
    const log = [
      entry(5, { type: 'intervals', rpe: 8 }),
      entry(4, { type: 'threshold', rpe: 8 }),
      entry(3, { type: 'vo2', rpe: 9 }),
    ]
    const r = detectHardDaySpacing(log, TODAY)
    expect(r.band).toBe('poor')
    expect(r.recommendation.en).toMatch(/restructure|48h|hard day/i)
  })

  it('does not double-count same-day double hard sessions as a violation', () => {
    // Two hard sessions on the same day, then an easy day, then another hard.
    // Same-day pair must not be a violation (they collapse to one hard day).
    const log = [
      entry(5, { type: 'intervals', rpe: 8 }),
      entry(5, { type: 'tempo', rpe: 7 }),
      entry(2, { type: 'threshold', rpe: 8 }),
    ]
    const r = detectHardDaySpacing(log, TODAY)
    expect(r.totalHard).toBe(2)
    expect(r.violations).toBe(0)
    expect(r.band).toBe('good')
  })

  it('uses provided today reference for the 28d window', () => {
    const customToday = '2026-03-15'
    const log = [
      { date: '2026-03-10', type: 'intervals', rpe: 8 },
      { date: '2026-03-09', type: 'threshold', rpe: 8 },
    ]
    const r = detectHardDaySpacing(log, customToday)
    expect(r.totalHard).toBe(2)
    expect(r.violations).toBe(1)
  })

  it('classifies "Sweet Spot" type as hard', () => {
    const log = [
      entry(5, { type: 'Sweet Spot Ride', rpe: 6 }),
      entry(4, { type: 'Sweet-Spot Bike', rpe: 6 }),
    ]
    const r = detectHardDaySpacing(log, TODAY)
    expect(r.totalHard).toBe(2)
    expect(r.violations).toBe(1)
  })

  it('returns shape with all expected keys', () => {
    const r = detectHardDaySpacing([], TODAY)
    expect(r).toHaveProperty('totalHard')
    expect(r).toHaveProperty('violations')
    expect(r).toHaveProperty('compliancePct')
    expect(r).toHaveProperty('band')
    expect(r).toHaveProperty('violationDates')
    expect(r).toHaveProperty('message')
    expect(r).toHaveProperty('recommendation')
    expect(r).toHaveProperty('reliable')
    expect(r).toHaveProperty('citation')
  })
})
