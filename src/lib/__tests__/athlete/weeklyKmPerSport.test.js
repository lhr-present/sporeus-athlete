// weeklyKmPerSport.test.js — pure-fn tests for per-sport weekly km
//
// Covers: null-guard cases, the sport classifier, this-week vs
// 12-week-average math, sort order (avg desc), deltaPct boundary
// behavior at ±0.10, and exclusion of zero-zero sports.
//
// Tests pass `today` explicitly so they don't depend on a frozen
// system clock. The reference date 2026-05-20 (Wed) anchors the
// current ISO week to Mon 2026-05-18, leaving the previous 12 weeks
// running from Mon 2026-02-23 through Sun 2026-05-17 — easy to
// place sessions in.

import { describe, it, expect } from 'vitest'
import {
  analyzeWeeklyKmPerSport,
  classifySport,
} from '../../athlete/weeklyKmPerSport.js'

const TODAY = '2026-05-20' // Wednesday → ISO week starts Mon 2026-05-18

// ISO date string `n` days before TODAY (UTC-anchored).
function daysAgo(n) {
  const d = new Date(`${TODAY}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function entry({ daysBack, distanceKm, type = 'Run', sport }) {
  const e = { date: daysAgo(daysBack), distanceKm }
  if (type !== undefined) e.type = type
  if (sport !== undefined) e.sport = sport
  return e
}

describe('classifySport', () => {
  it('classifies bike-y strings via type or sport', () => {
    expect(classifySport({ type: 'Easy Bike' })).toBe('bike')
    expect(classifySport({ type: 'Cycling endurance' })).toBe('bike')
    expect(classifySport({ type: 'Long Ride' })).toBe('bike')
    expect(classifySport({ type: 'Spin class' })).toBe('bike')
    expect(classifySport({ sport: 'cycling' })).toBe('bike')
  })

  it('classifies swim, run, row, jog', () => {
    expect(classifySport({ type: 'Open water swim' })).toBe('swim')
    expect(classifySport({ type: 'Tempo Run' })).toBe('run')
    expect(classifySport({ type: 'Recovery Jog' })).toBe('run')
    expect(classifySport({ type: 'Erg row 5k' })).toBe('row')
    expect(classifySport({ sport: 'rowing' })).toBe('row')
  })

  it('falls back to "other" for unknown sports and empty input', () => {
    expect(classifySport({ type: 'Yoga' })).toBe('other')
    expect(classifySport({ type: 'Strength' })).toBe('other')
    expect(classifySport({})).toBe('other')
    expect(classifySport(null)).toBe('other')
  })

  it('prefers `sport` when present, falls back to `type`', () => {
    // Both fields together — sport wins because the entry has a
    // truthy sport string.
    expect(classifySport({ sport: 'cycling', type: 'Run' })).toBe('bike')
    // Empty sport defers to type.
    expect(classifySport({ sport: '', type: 'Run' })).toBe('run')
  })
})

describe('analyzeWeeklyKmPerSport — null guards', () => {
  it('returns null for an empty log', () => {
    expect(analyzeWeeklyKmPerSport({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null when log is not an array', () => {
    expect(analyzeWeeklyKmPerSport({ log: null, today: TODAY })).toBeNull()
    expect(analyzeWeeklyKmPerSport({ log: undefined, today: TODAY })).toBeNull()
  })

  it('returns null when no log entry has a positive distanceKm', () => {
    const log = [
      entry({ daysBack: 1, distanceKm: 0, type: 'Run' }),
      entry({ daysBack: 3, distanceKm: -5, type: 'Run' }),
      entry({ daysBack: 5, distanceKm: NaN, type: 'Bike' }),
    ]
    expect(analyzeWeeklyKmPerSport({ log, today: TODAY })).toBeNull()
  })

  it('returns null for an invalid today string', () => {
    const log = [entry({ daysBack: 1, distanceKm: 5, type: 'Run' })]
    expect(analyzeWeeklyKmPerSport({ log, today: 'not-a-date' })).toBeNull()
  })
})

describe('analyzeWeeklyKmPerSport — math', () => {
  it('computes thisWeekKm and avg12WeekKm correctly', () => {
    // Current week = Mon 2026-05-18 through TODAY (Wed 2026-05-20).
    // daysBack 0 → 2026-05-20 (this week, Wed).
    // daysBack 1 → 2026-05-19 (this week, Tue).
    // daysBack 2 → 2026-05-18 (this week, Mon).
    // daysBack 3 → 2026-05-17 (last week, Sun).
    // daysBack 10 → past, two weeks ago.
    const log = [
      // Run: 5 + 5 = 10 km this week.
      entry({ daysBack: 0, distanceKm: 5, type: 'Easy Run' }),
      entry({ daysBack: 2, distanceKm: 5, type: 'Long Run' }),
      // Run past 12 weeks: 4 sessions of 6 km each = 24 km total.
      entry({ daysBack: 3, distanceKm: 6, type: 'Run' }),
      entry({ daysBack: 10, distanceKm: 6, type: 'Run' }),
      entry({ daysBack: 20, distanceKm: 6, type: 'Run' }),
      entry({ daysBack: 30, distanceKm: 6, type: 'Run' }),
    ]
    const out = analyzeWeeklyKmPerSport({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.citation).toBe('Daniels 2014; Bompa 2018')
    expect(out.sports).toHaveLength(1)
    const run = out.sports[0]
    expect(run.key).toBe('run')
    expect(run.thisWeekKm).toBeCloseTo(10, 9)
    // avg = 24 / 12 = 2.0
    expect(run.avg12WeekKm).toBeCloseTo(2, 9)
    // delta = (10 - 2) / 2 = 4.0
    expect(run.deltaPct).toBeCloseTo(4, 9)
  })

  it('sorts sports by 12-week average descending', () => {
    const log = [
      // Run: avg dominates (50 km across past). This week: 5 km.
      entry({ daysBack: 0, distanceKm: 5, type: 'Run' }),
      entry({ daysBack: 10, distanceKm: 25, type: 'Run' }),
      entry({ daysBack: 20, distanceKm: 25, type: 'Run' }),
      // Bike: smaller past avg.
      entry({ daysBack: 0, distanceKm: 50, type: 'Bike' }),
      entry({ daysBack: 15, distanceKm: 30, type: 'Bike' }),
      // Swim: tiny past avg.
      entry({ daysBack: 25, distanceKm: 2, type: 'Swim' }),
    ]
    const out = analyzeWeeklyKmPerSport({ log, today: TODAY })
    expect(out).not.toBeNull()
    const order = out.sports.map(s => s.key)
    // Run avg = 50/12, Bike avg = 30/12, Swim avg = 2/12 → run, bike, swim.
    expect(order).toEqual(['run', 'bike', 'swim'])
  })

  it('deltaPct is null when avg12WeekKm is zero (new sport this week)', () => {
    const log = [
      // New sport — first session is this week, no history.
      entry({ daysBack: 0, distanceKm: 5, type: 'Erg row' }),
      // Other sport so the analyzer has work to do.
      entry({ daysBack: 10, distanceKm: 6, type: 'Run' }),
    ]
    const out = analyzeWeeklyKmPerSport({ log, today: TODAY })
    expect(out).not.toBeNull()
    const row = out.sports.find(s => s.key === 'row')
    expect(row).toBeDefined()
    expect(row.thisWeekKm).toBeCloseTo(5, 9)
    expect(row.avg12WeekKm).toBe(0)
    expect(row.deltaPct).toBeNull()
  })
})

describe('analyzeWeeklyKmPerSport — deltaPct boundary cases at ±0.10', () => {
  // We seed past-12-week total = 120 km → avg = 10 km/week. Then we
  // tune the current-week km to land exactly on the ±10% boundary.
  function buildLog(thisWeekKm) {
    return [
      entry({ daysBack: 0, distanceKm: thisWeekKm, type: 'Run' }),
      entry({ daysBack: 10, distanceKm: 60, type: 'Run' }),
      entry({ daysBack: 20, distanceKm: 60, type: 'Run' }),
    ]
  }

  it('returns deltaPct = +0.10 exactly when thisWeek = avg * 1.10', () => {
    const out = analyzeWeeklyKmPerSport({ log: buildLog(11), today: TODAY })
    expect(out.sports[0].deltaPct).toBeCloseTo(0.1, 9)
  })

  it('returns deltaPct = -0.10 exactly when thisWeek = avg * 0.90', () => {
    const out = analyzeWeeklyKmPerSport({ log: buildLog(9), today: TODAY })
    expect(out.sports[0].deltaPct).toBeCloseTo(-0.1, 9)
  })

  it('returns deltaPct > +0.10 just above the boundary', () => {
    const out = analyzeWeeklyKmPerSport({ log: buildLog(11.5), today: TODAY })
    expect(out.sports[0].deltaPct).toBeGreaterThan(0.1)
  })

  it('returns deltaPct < -0.10 just below the boundary', () => {
    const out = analyzeWeeklyKmPerSport({ log: buildLog(8.5), today: TODAY })
    expect(out.sports[0].deltaPct).toBeLessThan(-0.1)
  })
})

describe('analyzeWeeklyKmPerSport — exclusion of zero-zero sports', () => {
  it('excludes sports whose km falls entirely outside the 13-week window', () => {
    const log = [
      // Run inside window — should appear.
      entry({ daysBack: 5, distanceKm: 10, type: 'Run' }),
      // Bike outside the 13-week window (104+ days back) — should be ignored.
      entry({ daysBack: 200, distanceKm: 50, type: 'Bike' }),
    ]
    const out = analyzeWeeklyKmPerSport({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.sports.map(s => s.key)).toEqual(['run'])
  })

  it('does not include sports with zero distance and no positive entries', () => {
    const log = [
      // Real run.
      entry({ daysBack: 1, distanceKm: 7, type: 'Run' }),
      // Bike with non-positive distance — gets dropped, so bike never
      // appears in the bucket map at all (we check that the result is
      // a single-sport response).
      entry({ daysBack: 2, distanceKm: 0, type: 'Bike' }),
    ]
    const out = analyzeWeeklyKmPerSport({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.sports.map(s => s.key)).toEqual(['run'])
  })
})

describe('analyzeWeeklyKmPerSport — windowWeeks override', () => {
  it('uses a custom windowWeeks for the average', () => {
    // 4-week window: average over 4 completed weeks instead of 12.
    const log = [
      entry({ daysBack: 10, distanceKm: 8, type: 'Run' }),
      entry({ daysBack: 17, distanceKm: 8, type: 'Run' }),
      entry({ daysBack: 24, distanceKm: 8, type: 'Run' }),
      entry({ daysBack: 200, distanceKm: 999, type: 'Run' }), // outside 4-week window
    ]
    const out = analyzeWeeklyKmPerSport({ log, today: TODAY, windowWeeks: 4 })
    expect(out).not.toBeNull()
    // total past km inside 4-week window = 24, avg = 24/4 = 6
    expect(out.sports[0].avg12WeekKm).toBeCloseTo(6, 9)
  })
})
