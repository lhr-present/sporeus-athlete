// ─── paceRange.test.js — pure-fn coverage ───────────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  analyzePaceRange,
  classifySpread,
  formatPace,
  formatSpread,
  PACE_RANGE_CITATION,
} from '../../athlete/paceRange.js'

const TODAY = '2026-05-18'

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function run(daysAgo, distanceKm, durationMin, overrides = {}) {
  return {
    date: isoMinusDays(TODAY, daysAgo),
    type: 'run',
    distanceKm,
    durationMin,
    ...overrides,
  }
}

// ─── classifySpread ─────────────────────────────────────────────────────────
describe('classifySpread', () => {
  it('spread ≥ 2.0 → WIDE_SPREAD', () => {
    expect(classifySpread(2.0)).toBe('WIDE_SPREAD')
    expect(classifySpread(2.5)).toBe('WIDE_SPREAD')
    expect(classifySpread(5.0)).toBe('WIDE_SPREAD')
  })

  it('1.0 ≤ spread < 2.0 → MODERATE_SPREAD', () => {
    expect(classifySpread(1.0)).toBe('MODERATE_SPREAD')
    expect(classifySpread(1.5)).toBe('MODERATE_SPREAD')
    expect(classifySpread(1.999)).toBe('MODERATE_SPREAD')
  })

  it('spread < 1.0 → NARROW_SPREAD', () => {
    expect(classifySpread(0)).toBe('NARROW_SPREAD')
    expect(classifySpread(0.5)).toBe('NARROW_SPREAD')
    expect(classifySpread(0.999)).toBe('NARROW_SPREAD')
  })

  it('boundary at 1.0 falls into MODERATE_SPREAD (not NARROW)', () => {
    expect(classifySpread(1.0)).toBe('MODERATE_SPREAD')
  })

  it('boundary at 2.0 falls into WIDE_SPREAD (not MODERATE)', () => {
    expect(classifySpread(2.0)).toBe('WIDE_SPREAD')
  })

  it('non-finite or negative defaults to NARROW_SPREAD', () => {
    expect(classifySpread(NaN)).toBe('NARROW_SPREAD')
    expect(classifySpread(Infinity)).toBe('NARROW_SPREAD')
    expect(classifySpread(-1)).toBe('NARROW_SPREAD')
  })
})

// ─── formatPace ─────────────────────────────────────────────────────────────
describe('formatPace', () => {
  it('formats 5.5 → "5:30/km"', () => {
    expect(formatPace(5.5)).toBe('5:30/km')
  })

  it('formats 4.916 → "4:55/km" (rounded)', () => {
    expect(formatPace(4.916)).toBe('4:55/km')
  })

  it('formats 6.0 → "6:00/km" (zero-padded seconds)', () => {
    expect(formatPace(6)).toBe('6:00/km')
  })

  it('formats 4.0833 → "4:05/km" (zero-padded seconds < 10)', () => {
    expect(formatPace(4.0833)).toBe('4:05/km')
  })

  it('returns "--" for non-positive or non-finite values', () => {
    expect(formatPace(0)).toBe('--')
    expect(formatPace(-1)).toBe('--')
    expect(formatPace(NaN)).toBe('--')
    expect(formatPace(Infinity)).toBe('--')
  })
})

// ─── formatSpread ───────────────────────────────────────────────────────────
describe('formatSpread', () => {
  it('formats 2.0 → "2:00/km"', () => {
    expect(formatSpread(2.0)).toBe('2:00/km')
  })

  it('formats 1.5 → "1:30/km"', () => {
    expect(formatSpread(1.5)).toBe('1:30/km')
  })

  it('formats 0.5 → "0:30/km" (zero-padded minutes)', () => {
    expect(formatSpread(0.5)).toBe('0:30/km')
  })

  it('formats 0 → "0:00/km" (no sign on zero spread)', () => {
    expect(formatSpread(0)).toBe('0:00/km')
  })

  it('returns "--" for negative or non-finite', () => {
    expect(formatSpread(-1)).toBe('--')
    expect(formatSpread(NaN)).toBe('--')
    expect(formatSpread(Infinity)).toBe('--')
  })

  it('does not emit a sign (it is a magnitude)', () => {
    expect(formatSpread(2.5)).toBe('2:30/km')
    expect(formatSpread(2.5)).not.toMatch(/[+-]/)
  })
})

// ─── Null gating ────────────────────────────────────────────────────────────
describe('analyzePaceRange — null gating', () => {
  it('returns null for null/empty/undefined log', () => {
    expect(analyzePaceRange({ log: null, today: TODAY })).toBe(null)
    expect(analyzePaceRange({ log: [], today: TODAY })).toBe(null)
    expect(analyzePaceRange({ today: TODAY })).toBe(null)
  })

  it('returns null when fewer than 5 qualifying runs in window', () => {
    const log = [
      run(1, 10, 60),
      run(3, 8, 48),
      run(5, 5, 25),
      run(7, 4, 20),
      // only 4 runs
    ]
    expect(analyzePaceRange({ log, today: TODAY })).toBe(null)
  })

  it('returns non-null at exactly 5 qualifying runs', () => {
    const log = [
      run(1, 10, 60),
      run(3, 8, 48),
      run(5, 5, 25),
      run(7, 4, 20),
      run(9, 6, 36),
    ]
    const r = analyzePaceRange({ log, today: TODAY })
    expect(r).not.toBe(null)
    expect(r.sampleCount).toBe(5)
  })

  it('ignores non-running sessions (cycling, swim)', () => {
    const log = [
      run(1, 10, 60),
      run(3, 8, 48),
      run(5, 5, 25),
      // non-running entries — not counted:
      { date: isoMinusDays(TODAY, 7), type: 'cycling', distanceKm: 30, durationMin: 60 },
      { date: isoMinusDays(TODAY, 9), type: 'bike',    distanceKm: 30, durationMin: 60 },
      { date: isoMinusDays(TODAY, 11), type: 'swim',   distanceKm: 2,  durationMin: 40 },
    ]
    // Only 3 runs → < 5 → null
    expect(analyzePaceRange({ log, today: TODAY })).toBe(null)
  })

  it('ignores entries with invalid distance', () => {
    const log = [
      run(1, 10, 60),
      run(3, 8, 48),
      // invalids:
      { date: isoMinusDays(TODAY, 5), type: 'run', distanceKm: 0,    durationMin: 30 },
      { date: isoMinusDays(TODAY, 7), type: 'run', distanceKm: -3,   durationMin: 25 },
      { date: isoMinusDays(TODAY, 9), type: 'run', distanceKm: null, durationMin: 25 },
      { date: isoMinusDays(TODAY, 11), type: 'run', distanceKm: 'x', durationMin: 25 },
    ]
    // 2 valid → < 5 → null
    expect(analyzePaceRange({ log, today: TODAY })).toBe(null)
  })

  it('ignores entries with invalid duration', () => {
    const log = [
      run(1, 10, 60),
      run(3, 8, 48),
      run(5, 5, 25),
      // invalids:
      { date: isoMinusDays(TODAY, 7), type: 'run', distanceKm: 5, durationMin: 0 },
      { date: isoMinusDays(TODAY, 9), type: 'run', distanceKm: 5, durationMin: -10 },
      { date: isoMinusDays(TODAY, 11), type: 'run', distanceKm: 5, durationMin: null },
    ]
    // 3 valid → < 5 → null
    expect(analyzePaceRange({ log, today: TODAY })).toBe(null)
  })
})

// ─── Running matcher ────────────────────────────────────────────────────────
describe('analyzePaceRange — running session matching', () => {
  it('matches via type field — "run", "Running", "Long Run", "Tempo Run", "jog"', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1), type: 'run',       distanceKm: 10, durationMin: 60 },
      { date: isoMinusDays(TODAY, 3), type: 'Running',   distanceKm: 8,  durationMin: 48 },
      { date: isoMinusDays(TODAY, 5), type: 'Long Run',  distanceKm: 18, durationMin: 108 },
      { date: isoMinusDays(TODAY, 7), type: 'Tempo Run', distanceKm: 10, durationMin: 50 },
      { date: isoMinusDays(TODAY, 9), type: 'jog',       distanceKm: 5,  durationMin: 32 },
    ]
    const r = analyzePaceRange({ log, today: TODAY })
    expect(r).not.toBe(null)
    expect(r.sampleCount).toBe(5)
  })

  it('matches via sport field when type is non-running', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1), sport: 'running', type: 'workout', distanceKm: 10, durationMin: 60 },
      { date: isoMinusDays(TODAY, 3), sport: 'run',     type: 'workout', distanceKm: 8,  durationMin: 48 },
      { date: isoMinusDays(TODAY, 5), sport: 'running', type: 'workout', distanceKm: 10, durationMin: 55 },
      { date: isoMinusDays(TODAY, 7), sport: 'running', type: 'workout', distanceKm: 10, durationMin: 50 },
      { date: isoMinusDays(TODAY, 9), sport: 'running', type: 'workout', distanceKm: 5,  durationMin: 22 },
    ]
    const r = analyzePaceRange({ log, today: TODAY })
    expect(r).not.toBe(null)
    expect(r.sampleCount).toBe(5)
  })
})

// ─── Spread math + fastest/slowest identification ───────────────────────────
describe('analyzePaceRange — spread math + fastest/slowest', () => {
  it('fastestPace is the smallest paceMinKm; slowestPace the largest', () => {
    // Paces: 4:00, 5:00, 6:00, 6:30, 7:00 → fastest=4.0, slowest=7.0, spread=3.0
    const log = [
      run(1, 5, 20),   // 4:00/km
      run(3, 10, 50),  // 5:00/km
      run(5, 10, 60),  // 6:00/km
      run(7, 10, 65),  // 6:30/km
      run(9, 10, 70),  // 7:00/km
    ]
    const r = analyzePaceRange({ log, today: TODAY })
    expect(r).not.toBe(null)
    expect(r.fastestPace).toBeCloseTo(4.0, 5)
    expect(r.slowestPace).toBeCloseTo(7.0, 5)
    expect(r.spread).toBeCloseTo(3.0, 5)
  })

  it('medianPace is the median of all paces', () => {
    // 5 paces: 4.0, 5.0, 6.0, 6.5, 7.0 → median = 6.0
    const log = [
      run(1, 5, 20),
      run(3, 10, 50),
      run(5, 10, 60),
      run(7, 10, 65),
      run(9, 10, 70),
    ]
    const r = analyzePaceRange({ log, today: TODAY })
    expect(r.medianPace).toBeCloseTo(6.0, 5)
  })

  it('medianPace for even count averages two middle values', () => {
    // 6 paces: 4.0, 5.0, 6.0, 6.5, 7.0, 8.0 → median = (6.0 + 6.5)/2 = 6.25
    const log = [
      run(1, 5, 20),    // 4
      run(3, 10, 50),   // 5
      run(5, 10, 60),   // 6
      run(7, 10, 65),   // 6.5
      run(9, 10, 70),   // 7
      run(11, 5, 40),   // 8
    ]
    const r = analyzePaceRange({ log, today: TODAY })
    expect(r.medianPace).toBeCloseTo(6.25, 5)
  })

  it('spread is zero when all runs land on the same pace', () => {
    const log = [
      run(1, 10, 55),
      run(3, 10, 55),
      run(5, 10, 55),
      run(7, 10, 55),
      run(9, 10, 55),
    ]
    const r = analyzePaceRange({ log, today: TODAY })
    expect(r.spread).toBeCloseTo(0, 5)
    expect(r.fastestPace).toBeCloseTo(5.5, 5)
    expect(r.slowestPace).toBeCloseTo(5.5, 5)
    expect(r.band).toBe('NARROW_SPREAD')
  })
})

// ─── Band classification — boundary cases ───────────────────────────────────
describe('analyzePaceRange — band classification', () => {
  it('WIDE_SPREAD when spread ≥ 2.0 min/km', () => {
    // 5:00 → 7:30 → spread 2.5
    const log = [
      run(1, 10, 50),   // 5:00/km
      run(3, 10, 60),
      run(5, 10, 65),
      run(7, 10, 70),
      run(9, 10, 75),   // 7:30/km
    ]
    const r = analyzePaceRange({ log, today: TODAY })
    expect(r.spread).toBeCloseTo(2.5, 5)
    expect(r.band).toBe('WIDE_SPREAD')
  })

  it('MODERATE_SPREAD when 1.0 ≤ spread < 2.0', () => {
    // 5:00 → 6:30 → spread 1.5
    const log = [
      run(1, 10, 50),
      run(3, 10, 55),
      run(5, 10, 60),
      run(7, 10, 62),
      run(9, 10, 65),
    ]
    const r = analyzePaceRange({ log, today: TODAY })
    expect(r.spread).toBeCloseTo(1.5, 5)
    expect(r.band).toBe('MODERATE_SPREAD')
  })

  it('NARROW_SPREAD when spread < 1.0', () => {
    // 5:30 → 6:00 → spread 0.5
    const log = [
      run(1, 10, 55),
      run(3, 10, 56),
      run(5, 10, 57),
      run(7, 10, 58),
      run(9, 10, 60),
    ]
    const r = analyzePaceRange({ log, today: TODAY })
    expect(r.spread).toBeCloseTo(0.5, 5)
    expect(r.band).toBe('NARROW_SPREAD')
  })

  it('boundary: exactly 1.0 → MODERATE_SPREAD (inclusive of low edge)', () => {
    // 5:00 → 6:00 → spread 1.0
    const log = [
      run(1, 10, 50),
      run(3, 10, 53),
      run(5, 10, 55),
      run(7, 10, 58),
      run(9, 10, 60),
    ]
    const r = analyzePaceRange({ log, today: TODAY })
    expect(r.spread).toBeCloseTo(1.0, 5)
    expect(r.band).toBe('MODERATE_SPREAD')
  })

  it('boundary: exactly 2.0 → WIDE_SPREAD (inclusive of low edge)', () => {
    // 5:00 → 7:00 → spread 2.0
    const log = [
      run(1, 10, 50),
      run(3, 10, 55),
      run(5, 10, 60),
      run(7, 10, 65),
      run(9, 10, 70),
    ]
    const r = analyzePaceRange({ log, today: TODAY })
    expect(r.spread).toBeCloseTo(2.0, 5)
    expect(r.band).toBe('WIDE_SPREAD')
  })

  it('just below 1.0 → NARROW_SPREAD', () => {
    // 5:00 → 5:59 → spread ≈ 0.983
    const log = [
      run(1, 10, 50),     // 5:00
      run(3, 10, 52),
      run(5, 10, 55),
      run(7, 10, 57),
      run(9, 10, 59.9),   // ≈ 5:59.9/km
    ]
    const r = analyzePaceRange({ log, today: TODAY })
    expect(r.spread).toBeLessThan(1.0)
    expect(r.band).toBe('NARROW_SPREAD')
  })

  it('just below 2.0 → MODERATE_SPREAD', () => {
    // 5:00 → 6:59 → spread ≈ 1.983
    const log = [
      run(1, 10, 50),
      run(3, 10, 55),
      run(5, 10, 60),
      run(7, 10, 65),
      run(9, 10, 69.9),
    ]
    const r = analyzePaceRange({ log, today: TODAY })
    expect(r.spread).toBeLessThan(2.0)
    expect(r.band).toBe('MODERATE_SPREAD')
  })
})

// ─── Windowing ──────────────────────────────────────────────────────────────
describe('analyzePaceRange — windowing', () => {
  it('excludes sessions older than 28 days', () => {
    const log = [
      run(1, 10, 60),
      run(5, 10, 55),
      run(10, 10, 50),
      run(20, 10, 65),
      run(27, 10, 70),
      // Out of window — would massively expand spread if included:
      run(29, 5, 15),    // 3:00/km
      run(40, 10, 90),   // 9:00/km
    ]
    const r = analyzePaceRange({ log, today: TODAY })
    expect(r).not.toBe(null)
    expect(r.sampleCount).toBe(5)
    // 5:00 → 7:00 in-window
    expect(r.fastestPace).toBeCloseTo(5.0, 5)
    expect(r.slowestPace).toBeCloseTo(7.0, 5)
  })

  it('respects custom windowDays parameter', () => {
    const log = [
      run(1, 10, 60),
      run(3, 10, 55),
      run(5, 10, 50),
      run(40, 10, 70),   // outside 28d default but inside 90d
      run(45, 10, 75),
    ]
    const r28 = analyzePaceRange({ log, today: TODAY, windowDays: 28 })
    expect(r28).toBe(null)   // only 3 in default window

    const r90 = analyzePaceRange({ log, today: TODAY, windowDays: 90 })
    expect(r90).not.toBe(null)
    expect(r90.sampleCount).toBe(5)
  })

  it('skips sessions with invalid date strings', () => {
    const log = [
      { date: 'not-a-date', type: 'run', distanceKm: 10, durationMin: 60 },
      { date: '',           type: 'run', distanceKm: 10, durationMin: 60 },
      { date: null,         type: 'run', distanceKm: 10, durationMin: 60 },
      run(1, 10, 60),
      run(3, 10, 55),
      run(5, 10, 50),
      run(7, 10, 45),
      run(9, 10, 40),
    ]
    const r = analyzePaceRange({ log, today: TODAY })
    expect(r).not.toBe(null)
    expect(r.sampleCount).toBe(5)
  })
})

// ─── Result shape + citation ────────────────────────────────────────────────
describe('analyzePaceRange — result shape', () => {
  it('returns the expected fields with the citation string', () => {
    const log = [
      run(1, 10, 60),
      run(3, 10, 55),
      run(5, 10, 50),
      run(7, 10, 65),
      run(9, 10, 70),
    ]
    const r = analyzePaceRange({ log, today: TODAY })
    expect(r).toMatchObject({
      band: expect.any(String),
      spread: expect.any(Number),
      fastestPace: expect.any(Number),
      slowestPace: expect.any(Number),
      medianPace: expect.any(Number),
      sampleCount: 5,
      citation: PACE_RANGE_CITATION,
    })
    expect(r.citation).toBe('Daniels 2014; Seiler 2010')
  })

  it('coerces numeric-string distanceKm / durationMin', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1), type: 'run', distanceKm: '10', durationMin: '60' },
      { date: isoMinusDays(TODAY, 3), type: 'run', distanceKm: '10', durationMin: '55' },
      { date: isoMinusDays(TODAY, 5), type: 'run', distanceKm: '10', durationMin: '50' },
      { date: isoMinusDays(TODAY, 7), type: 'run', distanceKm: '10', durationMin: '45' },
      { date: isoMinusDays(TODAY, 9), type: 'run', distanceKm: '10', durationMin: '40' },
    ]
    const r = analyzePaceRange({ log, today: TODAY })
    expect(r).not.toBe(null)
    expect(r.sampleCount).toBe(5)
    expect(r.fastestPace).toBeCloseTo(4.0, 5)
    expect(r.slowestPace).toBeCloseTo(6.0, 5)
  })
})

// ─── sanitized `duration` field fallback (regression) ───────────────────────
describe('analyzePaceRange — duration field fallback', () => {
  it('computes pace from sanitized `duration` (minutes) when durationMin absent', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1),  type: 'run', distanceKm: 10, duration: 40 }, // 4.0
      { date: isoMinusDays(TODAY, 3),  type: 'run', distanceKm: 10, duration: 45 },
      { date: isoMinusDays(TODAY, 5),  type: 'run', distanceKm: 10, duration: 50 },
      { date: isoMinusDays(TODAY, 7),  type: 'run', distanceKm: 10, duration: 55 },
      { date: isoMinusDays(TODAY, 9),  type: 'run', distanceKm: 10, duration: 60 }, // 6.0
    ]
    const r = analyzePaceRange({ log, today: TODAY })
    expect(r).not.toBe(null)
    expect(r.sampleCount).toBe(5)
    expect(r.fastestPace).toBeCloseTo(4.0, 5)
    expect(r.slowestPace).toBeCloseTo(6.0, 5)
  })
})
