// ─── sessionDensity.test.js — analyzeSessionDensity unit tests ──────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { analyzeSessionDensity, SESSION_DENSITY_CITATION } from '../../athlete/sessionDensity.js'

// Reference date: Monday 2026-05-18
// 28-day window (inclusive of today): 2026-04-21 .. 2026-05-18
const TODAY = '2026-05-18'

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const session = (date, extras = {}) => ({ date, type: 'run', duration: 60, rpe: 5, ...extras })

// ─── Empty / null / sparse inputs ───────────────────────────────────────────
describe('analyzeSessionDensity — null / sparse inputs', () => {
  it('returns null for null log', () => {
    expect(analyzeSessionDensity({ log: null, today: TODAY })).toBeNull()
  })

  it('returns null for empty array log', () => {
    expect(analyzeSessionDensity({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null for non-array log', () => {
    expect(analyzeSessionDensity({ log: 'nope', today: TODAY })).toBeNull()
  })

  it('returns null when fewer than 5 active days in window', () => {
    const log = []
    for (let i = 0; i < 4; i++) log.push(session(addDays(TODAY, -i)))
    const r = analyzeSessionDensity({ log, today: TODAY })
    expect(r).toBeNull()
  })

  it('returns null when totalSessions === 0 (all dates out of window)', () => {
    const log = [
      session(addDays(TODAY, -60)),
      session(addDays(TODAY, -50)),
      session(addDays(TODAY, -40)),
      session(addDays(TODAY, -35)),
      session(addDays(TODAY, -30)),
    ]
    const r = analyzeSessionDensity({ log, today: TODAY })
    expect(r).toBeNull()
  })

  it('returns null when entries have no date field', () => {
    const log = [{ type: 'run' }, { type: 'bike' }, { type: 'swim' }, {}, {}, {}]
    const r = analyzeSessionDensity({ log, today: TODAY })
    expect(r).toBeNull()
  })

  it('ignores entries outside the 28-day window', () => {
    const log = []
    // 5 inside window
    for (let i = 0; i < 5; i++) log.push(session(addDays(TODAY, -i)))
    // 3 outside (older than 28 days)
    log.push(session(addDays(TODAY, -30)))
    log.push(session(addDays(TODAY, -45)))
    log.push(session(addDays(TODAY, -60)))
    const r = analyzeSessionDensity({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalSessions).toBe(5)
    expect(r.activeDays).toBe(5)
  })
})

// ─── SINGLE_FOCUSED band (density < 1.10) ────────────────────────────────────
describe('analyzeSessionDensity — SINGLE_FOCUSED band', () => {
  it('classifies pure 1-per-day pattern as SINGLE_FOCUSED, density = 1.0', () => {
    const log = []
    for (let i = 0; i < 20; i++) log.push(session(addDays(TODAY, -i)))
    const r = analyzeSessionDensity({ log, today: TODAY })
    expect(r.band).toBe('SINGLE_FOCUSED')
    expect(r.density).toBeCloseTo(1.0, 6)
    expect(r.totalSessions).toBe(20)
    expect(r.activeDays).toBe(20)
    expect(r.doubleDays).toBe(0)
    expect(r.doubleRate).toBe(0)
  })

  it('classifies sparse-doubles (≤10% rate) as SINGLE_FOCUSED', () => {
    // 20 days, 2 doubles → 22 sessions / 20 days = 1.10 → boundary EXACT
    // We want < 1.10, so use 1 double + 20 days → 21 / 20 = 1.05
    const log = []
    for (let i = 0; i < 20; i++) log.push(session(addDays(TODAY, -i)))
    // Add a second session on day 0 → one double
    log.push(session(TODAY, { type: 'bike' }))
    const r = analyzeSessionDensity({ log, today: TODAY })
    expect(r.band).toBe('SINGLE_FOCUSED')
    expect(r.density).toBeCloseTo(21 / 20, 6)
    expect(r.doubleDays).toBe(1)
    expect(r.doubleRate).toBeCloseTo(0.05, 6)
  })
})

// ─── MIXED_DENSITY band (1.10 ≤ density < 1.40) ──────────────────────────────
describe('analyzeSessionDensity — MIXED_DENSITY band', () => {
  it('classifies density exactly 1.10 as MIXED_DENSITY (lower boundary)', () => {
    // 10 days, 1 double → 11 / 10 = 1.10
    const log = []
    for (let i = 0; i < 10; i++) log.push(session(addDays(TODAY, -i)))
    log.push(session(TODAY, { type: 'bike' }))
    const r = analyzeSessionDensity({ log, today: TODAY })
    expect(r.density).toBeCloseTo(1.10, 6)
    expect(r.band).toBe('MIXED_DENSITY')
  })

  it('classifies density 1.25 as MIXED_DENSITY (middle)', () => {
    // 20 days, 5 doubles → 25 / 20 = 1.25
    const log = []
    for (let i = 0; i < 20; i++) log.push(session(addDays(TODAY, -i)))
    for (let i = 0; i < 5; i++) log.push(session(addDays(TODAY, -i), { type: 'bike' }))
    const r = analyzeSessionDensity({ log, today: TODAY })
    expect(r.density).toBeCloseTo(1.25, 6)
    expect(r.band).toBe('MIXED_DENSITY')
    expect(r.doubleDays).toBe(5)
    expect(r.doubleRate).toBeCloseTo(0.25, 6)
    expect(r.totalSessions).toBe(25)
    expect(r.activeDays).toBe(20)
  })
})

// ─── DOUBLE_HEAVY band (density ≥ 1.40) ──────────────────────────────────────
describe('analyzeSessionDensity — DOUBLE_HEAVY band', () => {
  it('classifies density exactly 1.40 as DOUBLE_HEAVY (lower boundary)', () => {
    // 10 days, 4 doubles → 14 / 10 = 1.40
    const log = []
    for (let i = 0; i < 10; i++) log.push(session(addDays(TODAY, -i)))
    for (let i = 0; i < 4; i++) log.push(session(addDays(TODAY, -i), { type: 'bike' }))
    const r = analyzeSessionDensity({ log, today: TODAY })
    expect(r.density).toBeCloseTo(1.40, 6)
    expect(r.band).toBe('DOUBLE_HEAVY')
  })

  it('classifies density 2.0 (every day doubled) as DOUBLE_HEAVY', () => {
    const log = []
    for (let i = 0; i < 14; i++) {
      log.push(session(addDays(TODAY, -i)))
      log.push(session(addDays(TODAY, -i), { type: 'bike' }))
    }
    const r = analyzeSessionDensity({ log, today: TODAY })
    expect(r.density).toBeCloseTo(2.0, 6)
    expect(r.band).toBe('DOUBLE_HEAVY')
    expect(r.doubleDays).toBe(14)
    expect(r.doubleRate).toBeCloseTo(1.0, 6)
  })
})

// ─── Double-day counting (same-date dedup) ──────────────────────────────────
describe('analyzeSessionDensity — double-day counting', () => {
  it('counts a day with 2 sessions as 1 double day', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(session(addDays(TODAY, -i)))
    log.push(session(TODAY, { type: 'bike' }))
    const r = analyzeSessionDensity({ log, today: TODAY })
    expect(r.activeDays).toBe(10)
    expect(r.totalSessions).toBe(11)
    expect(r.doubleDays).toBe(1)
  })

  it('counts a day with 3 sessions as 1 double day (not 3)', () => {
    // 3 sessions on 5 distinct days, plus 4 more single-session days → 9 days, 13 sessions
    const log = []
    for (let i = 0; i < 5; i++) {
      log.push(session(addDays(TODAY, -i)))
      log.push(session(addDays(TODAY, -i), { type: 'bike' }))
      log.push(session(addDays(TODAY, -i), { type: 'swim' }))
    }
    for (let i = 5; i < 9; i++) log.push(session(addDays(TODAY, -i)))
    const r = analyzeSessionDensity({ log, today: TODAY })
    expect(r.activeDays).toBe(9)
    expect(r.totalSessions).toBe(19)  // 5*3 + 4
    expect(r.doubleDays).toBe(5)
  })

  it('two duplicate entries on the same date still count as 1 active day', () => {
    const log = []
    for (let i = 0; i < 5; i++) {
      log.push(session(addDays(TODAY, -i)))
      log.push(session(addDays(TODAY, -i)))  // dup-shaped entry
    }
    const r = analyzeSessionDensity({ log, today: TODAY })
    expect(r.activeDays).toBe(5)
    expect(r.totalSessions).toBe(10)
    expect(r.doubleDays).toBe(5)
    expect(r.density).toBeCloseTo(2.0, 6)
    expect(r.band).toBe('DOUBLE_HEAVY')
  })
})

// ─── Density math + return shape ────────────────────────────────────────────
describe('analyzeSessionDensity — return shape & math', () => {
  it('returns the canonical 7-field shape with citation', () => {
    const log = []
    for (let i = 0; i < 8; i++) log.push(session(addDays(TODAY, -i)))
    const r = analyzeSessionDensity({ log, today: TODAY })
    expect(Object.keys(r).sort()).toEqual(
      ['activeDays', 'band', 'citation', 'density', 'doubleDays', 'doubleRate', 'totalSessions'].sort()
    )
    expect(r.citation).toBe(SESSION_DENSITY_CITATION)
    expect(r.citation).toBe('Bompa 2018; Mujika 2014')
  })

  it('density = totalSessions / activeDays exactly', () => {
    const log = []
    for (let i = 0; i < 7; i++) log.push(session(addDays(TODAY, -i)))
    for (let i = 0; i < 3; i++) log.push(session(addDays(TODAY, -i), { type: 'bike' }))
    const r = analyzeSessionDensity({ log, today: TODAY })
    expect(r.totalSessions).toBe(10)
    expect(r.activeDays).toBe(7)
    expect(r.density).toBeCloseTo(10 / 7, 6)
  })

  it('defaults today to current date when omitted', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-18T12:00:00Z'))
    try {
      const log = []
      for (let i = 0; i < 8; i++) log.push(session(addDays('2026-05-18', -i)))
      const r = analyzeSessionDensity({ log })  // no today
      expect(r).not.toBeNull()
      expect(r.activeDays).toBe(8)
    } finally {
      vi.useRealTimers()
    }
  })

  it('honors a custom windowDays parameter', () => {
    const log = []
    // 10 sessions over the last 10 days
    for (let i = 0; i < 10; i++) log.push(session(addDays(TODAY, -i)))
    // 10 more sessions 15..24 days back
    for (let i = 15; i < 25; i++) log.push(session(addDays(TODAY, -i)))
    // Default 28-day window → all 20 days in
    const r28 = analyzeSessionDensity({ log, today: TODAY })
    expect(r28.activeDays).toBe(20)
    // 7-day window → only the 7 most recent
    const r7 = analyzeSessionDensity({ log, today: TODAY, windowDays: 7 })
    expect(r7.activeDays).toBe(7)
  })
})
