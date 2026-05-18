// Altitude / hypoxic stimulus detector — pure-fn tests.
//
// Covers all 3 bands (HYPOXIC_STIMULUS / MODERATE / NONE), the null
// edge cases (too few sessions, zero elevation data, non-array log,
// invalid today), and verifies citation + weekly shape.

import { describe, it, expect } from 'vitest'
import {
  detectAltitudeStimulus,
  ALTITUDE_THRESHOLDS,
  ALTITUDE_STIMULUS_CITATION,
} from '../../athlete/altitudeStimulus.js'

const TODAY = '2026-05-14'

function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function climb(daysAgo, elevationGainM, extra = {}) {
  return {
    date: addDays(TODAY, -daysAgo),
    elevationGainM,
    durationMin: 90,
    type: 'Endurance',
    sport: 'cycling',
    ...extra,
  }
}

describe('detectAltitudeStimulus — guards', () => {
  it('returns null for non-array log', () => {
    expect(detectAltitudeStimulus({ log: null, today: TODAY })).toBeNull()
    expect(detectAltitudeStimulus({ log: undefined, today: TODAY })).toBeNull()
    expect(detectAltitudeStimulus({ log: 'oops', today: TODAY })).toBeNull()
  })

  it('returns null when called with no args', () => {
    expect(detectAltitudeStimulus()).toBeNull()
  })

  it('returns null for fewer than 7 sessions in the 28-day window', () => {
    const log = [
      climb(1, 600),
      climb(3, 600),
      climb(5, 600),
      climb(7, 600),
      climb(9, 600),
      climb(11, 600),
    ] // 6 sessions
    expect(detectAltitudeStimulus({ log, today: TODAY })).toBeNull()
  })

  it('returns null when 7+ sessions exist but no elevation data at all', () => {
    const log = []
    for (let i = 0; i < 8; i++) {
      log.push({
        date: addDays(TODAY, -i),
        durationMin: 60,
        type: 'Easy',
        sport: 'cycling',
      })
    }
    expect(detectAltitudeStimulus({ log, today: TODAY })).toBeNull()
  })

  it('returns null when elevationGainM is present but zero on every entry', () => {
    const log = []
    for (let i = 0; i < 8; i++) {
      log.push(climb(i, 0))
    }
    expect(detectAltitudeStimulus({ log, today: TODAY })).toBeNull()
  })

  it('returns null when today is malformed', () => {
    const log = []
    for (let i = 0; i < 8; i++) log.push(climb(i, 600))
    expect(detectAltitudeStimulus({ log, today: 'not-a-date' })).toBeNull()
  })

  it('ignores sessions older than the 28-day window', () => {
    const log = []
    for (let i = 0; i < 8; i++) log.push(climb(40 + i, 2000))
    // All sessions outside the window → 0 in-window sessions → null
    expect(detectAltitudeStimulus({ log, today: TODAY })).toBeNull()
  })
})

describe('detectAltitudeStimulus — NONE band', () => {
  it('classifies as NONE when only 1 week reaches 500m', () => {
    const log = [
      // Week 0 only: 600m total
      climb(1, 300),
      climb(2, 300),
      // Filler easy sessions across other weeks to clear 7-session gate
      climb(8,  50),
      climb(10, 50),
      climb(15, 50),
      climb(17, 50),
      climb(22, 50),
      climb(24, 50),
    ]
    const out = detectAltitudeStimulus({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.band).toBe('NONE')
    expect(out.citation).toBe(ALTITUDE_STIMULUS_CITATION)
    expect(out.weeks).toHaveLength(4)
    expect(out.totalAscent28d).toBe(300 + 300 + 50 * 6)
  })
})

describe('detectAltitudeStimulus — MODERATE band', () => {
  it('classifies as MODERATE when ≥2 weeks reach 500–1500m', () => {
    const log = [
      // Week 0: 800m
      climb(1, 400),
      climb(3, 400),
      // Week 1: 700m
      climb(8, 350),
      climb(10, 350),
      // Week 2: 50m (below moderate)
      climb(15, 50),
      // Week 3: 50m (below moderate)
      climb(22, 50),
      // Filler to reach >=7 sessions
      climb(5, 100),
    ]
    const out = detectAltitudeStimulus({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.band).toBe('MODERATE')
    expect(out.citation).toBe(ALTITUDE_STIMULUS_CITATION)
  })

  it('classifies as MODERATE when exactly 1 week hits 1500m but a 2nd is moderate', () => {
    // 1 high week + 1 moderate week = weeksWithSomeClimbing=2,
    // highWeeks=1 → NOT HYPOXIC_STIMULUS (needs 3) → MODERATE
    const log = [
      // Week 0: 1600m (high)
      climb(1, 800),
      climb(3, 800),
      // Week 1: 600m (moderate)
      climb(8, 600),
      // Weeks 2 + 3: flat-ish
      climb(15, 50),
      climb(17, 50),
      climb(22, 50),
      climb(24, 50),
    ]
    const out = detectAltitudeStimulus({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.band).toBe('MODERATE')
  })
})

describe('detectAltitudeStimulus — HYPOXIC_STIMULUS band', () => {
  it('classifies as HYPOXIC_STIMULUS when 3 of 4 weeks hit ≥1500m', () => {
    const log = [
      // Week 0: 1600m
      climb(1, 800),
      climb(3, 800),
      // Week 1: 1700m
      climb(8, 850),
      climb(10, 850),
      // Week 2: 1800m
      climb(15, 900),
      climb(17, 900),
      // Week 3: 200m (below threshold)
      climb(22, 200),
    ]
    const out = detectAltitudeStimulus({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.band).toBe('HYPOXIC_STIMULUS')
    expect(out.totalAscent28d).toBe(1600 + 1700 + 1800 + 200)
  })

  it('classifies as HYPOXIC_STIMULUS when all 4 weeks hit ≥1500m', () => {
    const log = [
      climb(1, 1600),
      climb(3, 100),
      climb(8, 1700),
      climb(10, 100),
      climb(15, 1800),
      climb(17, 100),
      climb(22, 1900),
      climb(24, 100),
    ]
    const out = detectAltitudeStimulus({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.band).toBe('HYPOXIC_STIMULUS')
  })
})

describe('detectAltitudeStimulus — output shape', () => {
  it('emits weeks in chronological order anchored to today', () => {
    const log = [
      climb(1, 800),
      climb(3, 800),
      climb(8, 850),
      climb(10, 850),
      climb(15, 900),
      climb(17, 900),
      climb(22, 200),
    ]
    const out = detectAltitudeStimulus({ log, today: TODAY })
    expect(out.weeks).toHaveLength(4)
    expect(out.weeks[0]).toMatchObject({
      weekStart: expect.any(String),
      totalAscentM: expect.any(Number),
      sessionCount: expect.any(Number),
    })
    // weekStart should be a valid YYYY-MM-DD string
    expect(out.weeks[0].weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Session counts should add up to the 7 in-window sessions
    const totalSessions = out.weeks.reduce((a, w) => a + w.sessionCount, 0)
    expect(totalSessions).toBe(7)
  })

  it('uses Lippl 2010 + Levine 1997 citation', () => {
    const log = []
    for (let i = 0; i < 8; i++) log.push(climb(i, 600))
    const out = detectAltitudeStimulus({ log, today: TODAY })
    expect(out.citation).toBe('Lippl 2010; Levine 1997')
  })

  it('exposes Lippl-proxy thresholds', () => {
    expect(ALTITUDE_THRESHOLDS.moderateWeekM).toBe(500)
    expect(ALTITUDE_THRESHOLDS.highWeekM).toBe(1500)
  })

  it('defaults today to current UTC date when omitted', () => {
    const todayIso = new Date().toISOString().slice(0, 10)
    const log = []
    for (let i = 0; i < 8; i++) {
      const d = new Date(todayIso + 'T12:00:00Z')
      d.setUTCDate(d.getUTCDate() - i)
      log.push({
        date: d.toISOString().slice(0, 10),
        elevationGainM: 600,
        durationMin: 90,
        type: 'Endurance',
        sport: 'cycling',
      })
    }
    const out = detectAltitudeStimulus({ log })
    expect(out).not.toBeNull()
    expect(out.weeks).toHaveLength(4)
  })
})
