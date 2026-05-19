// ─── paceByRpe.test.js — pure-fn coverage ───────────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  analyzePaceByRpe,
  formatPace,
  rpeToBand,
  PACE_BY_RPE_CITATION,
} from '../../athlete/paceByRpe.js'

const TODAY = '2026-05-18'

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function run(daysAgo, rpe, distanceKm, durationMin, overrides = {}) {
  return {
    date: isoMinusDays(TODAY, daysAgo),
    type: 'run',
    rpe,
    distanceKm,
    durationMin,
    ...overrides,
  }
}

// ─── rpeToBand ──────────────────────────────────────────────────────────────
describe('rpeToBand', () => {
  it('maps RPE 1-4 → EASY', () => {
    expect(rpeToBand(1)).toBe('EASY')
    expect(rpeToBand(2)).toBe('EASY')
    expect(rpeToBand(3)).toBe('EASY')
    expect(rpeToBand(4)).toBe('EASY')
  })

  it('maps RPE 5-6 → MODERATE', () => {
    expect(rpeToBand(5)).toBe('MODERATE')
    expect(rpeToBand(6)).toBe('MODERATE')
  })

  it('maps RPE 7-8 → HARD', () => {
    expect(rpeToBand(7)).toBe('HARD')
    expect(rpeToBand(8)).toBe('HARD')
  })

  it('maps RPE 9-10 → VERY_HARD', () => {
    expect(rpeToBand(9)).toBe('VERY_HARD')
    expect(rpeToBand(10)).toBe('VERY_HARD')
  })

  it('returns null for out-of-range or non-finite RPE', () => {
    expect(rpeToBand(0)).toBe(null)
    expect(rpeToBand(11)).toBe(null)
    expect(rpeToBand(-1)).toBe(null)
    expect(rpeToBand(NaN)).toBe(null)
    expect(rpeToBand(Infinity)).toBe(null)
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
    // 4.0833 * 60 ≈ 245s → 4:05
    expect(formatPace(4.0833)).toBe('4:05/km')
  })

  it('returns "--" for non-positive or non-finite values', () => {
    expect(formatPace(0)).toBe('--')
    expect(formatPace(-1)).toBe('--')
    expect(formatPace(NaN)).toBe('--')
    expect(formatPace(Infinity)).toBe('--')
  })
})

// ─── Null gating ────────────────────────────────────────────────────────────
describe('analyzePaceByRpe — null gating', () => {
  it('returns null for null/empty/undefined log', () => {
    expect(analyzePaceByRpe({ log: null, today: TODAY })).toBe(null)
    expect(analyzePaceByRpe({ log: [], today: TODAY })).toBe(null)
    expect(analyzePaceByRpe({ today: TODAY })).toBe(null)
  })

  it('returns null when overall sample count < 6', () => {
    const log = [
      run(1, 3, 10, 60),
      run(3, 4, 8, 48),
      run(5, 7, 5, 25),
      run(7, 8, 4, 20),
      run(9, 6, 6, 36),
      // only 5 samples
    ]
    expect(analyzePaceByRpe({ log, today: TODAY })).toBe(null)
  })

  it('returns null when fewer than 2 bands are populated', () => {
    // All sessions in EASY band — 6 samples but only 1 band
    const log = [
      run(1, 3, 10, 60),
      run(3, 4, 8, 48),
      run(5, 3, 10, 60),
      run(7, 4, 8, 48),
      run(9, 3, 10, 60),
      run(11, 4, 8, 48),
    ]
    expect(analyzePaceByRpe({ log, today: TODAY })).toBe(null)
  })

  it('ignores non-running sessions (cycling, swim)', () => {
    const log = [
      run(1, 3, 10, 60),
      run(3, 4, 8, 48),
      run(5, 3, 10, 60),
      // 3 non-running entries with otherwise-valid fields:
      { date: isoMinusDays(TODAY, 7), type: 'cycling', rpe: 7, distanceKm: 30, durationMin: 60 },
      { date: isoMinusDays(TODAY, 9), type: 'bike',    rpe: 8, distanceKm: 30, durationMin: 60 },
      { date: isoMinusDays(TODAY, 11), type: 'swim',   rpe: 6, distanceKm: 2,  durationMin: 40 },
    ]
    // Only 3 runs → < 6 samples → null
    expect(analyzePaceByRpe({ log, today: TODAY })).toBe(null)
  })

  it('ignores entries with missing/invalid distance, duration, or rpe', () => {
    const log = [
      run(1, 3, 10, 60),
      run(3, 4, 8, 48),
      run(5, 7, 5, 25),
      // Invalids — none counted:
      { date: isoMinusDays(TODAY, 7), type: 'run', rpe: 7, distanceKm: 0, durationMin: 30 },
      { date: isoMinusDays(TODAY, 8), type: 'run', rpe: 7, distanceKm: 5, durationMin: 0 },
      { date: isoMinusDays(TODAY, 9), type: 'run', rpe: null, distanceKm: 5, durationMin: 25 },
      { date: isoMinusDays(TODAY, 10), type: 'run', rpe: 'abc', distanceKm: 5, durationMin: 25 },
      { date: isoMinusDays(TODAY, 11), type: 'run', rpe: 7, distanceKm: -3, durationMin: 25 },
    ]
    // Only 3 valid runs (3 in EASY, 0 in MODERATE, 1 in HARD … wait, EASY=2, HARD=1) → 3 samples → null
    expect(analyzePaceByRpe({ log, today: TODAY })).toBe(null)
  })
})

// ─── Running matcher ────────────────────────────────────────────────────────
describe('analyzePaceByRpe — running session matching', () => {
  it('matches via type field — "run", "running", "Long Run", "Tempo Run"', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1), type: 'run',       rpe: 3, distanceKm: 10, durationMin: 60 },
      { date: isoMinusDays(TODAY, 3), type: 'Running',   rpe: 4, distanceKm: 8,  durationMin: 48 },
      { date: isoMinusDays(TODAY, 5), type: 'Long Run',  rpe: 5, distanceKm: 18, durationMin: 108 },
      { date: isoMinusDays(TODAY, 7), type: 'Tempo Run', rpe: 7, distanceKm: 10, durationMin: 50 },
      { date: isoMinusDays(TODAY, 9), type: 'jog',       rpe: 3, distanceKm: 5,  durationMin: 32 },
      { date: isoMinusDays(TODAY, 11), type: 'easy jog', rpe: 4, distanceKm: 6,  durationMin: 38 },
    ]
    const r = analyzePaceByRpe({ log, today: TODAY })
    expect(r).not.toBe(null)
    expect(r.overallSampleCount).toBe(6)
  })

  it('matches via sport field when type is non-running', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1), sport: 'running', type: 'workout', rpe: 3, distanceKm: 10, durationMin: 60 },
      { date: isoMinusDays(TODAY, 3), sport: 'run',     type: 'workout', rpe: 4, distanceKm: 8,  durationMin: 48 },
      { date: isoMinusDays(TODAY, 5), sport: 'running', type: 'workout', rpe: 5, distanceKm: 10, durationMin: 60 },
      { date: isoMinusDays(TODAY, 7), sport: 'running', type: 'workout', rpe: 6, distanceKm: 10, durationMin: 55 },
      { date: isoMinusDays(TODAY, 9), sport: 'running', type: 'workout', rpe: 7, distanceKm: 10, durationMin: 50 },
      { date: isoMinusDays(TODAY, 11), sport: 'running', type: 'workout', rpe: 8, distanceKm: 5, durationMin: 22 },
    ]
    const r = analyzePaceByRpe({ log, today: TODAY })
    expect(r).not.toBe(null)
    expect(r.overallSampleCount).toBe(6)
  })
})

// ─── Band grouping — boundary checks ────────────────────────────────────────
describe('analyzePaceByRpe — band boundaries', () => {
  it('RPE 4 → EASY, RPE 5 → MODERATE', () => {
    const log = [
      run(1, 4, 10, 60),  // EASY (4)
      run(3, 4, 10, 62),
      run(5, 4, 10, 64),
      run(7, 5, 10, 50),  // MODERATE (5)
      run(9, 5, 10, 52),
      run(11, 5, 10, 54),
    ]
    const r = analyzePaceByRpe({ log, today: TODAY })
    expect(r).not.toBe(null)
    const easy = r.bands.find((b) => b.name === 'EASY')
    const moderate = r.bands.find((b) => b.name === 'MODERATE')
    expect(easy.count).toBe(3)
    expect(moderate.count).toBe(3)
  })

  it('RPE 6 → MODERATE, RPE 7 → HARD', () => {
    const log = [
      run(1, 6, 10, 55),  // MODERATE (6)
      run(3, 6, 10, 56),
      run(5, 6, 10, 57),
      run(7, 7, 10, 48),  // HARD (7)
      run(9, 7, 10, 49),
      run(11, 7, 10, 50),
    ]
    const r = analyzePaceByRpe({ log, today: TODAY })
    expect(r).not.toBe(null)
    const moderate = r.bands.find((b) => b.name === 'MODERATE')
    const hard = r.bands.find((b) => b.name === 'HARD')
    expect(moderate.count).toBe(3)
    expect(hard.count).toBe(3)
  })

  it('RPE 8 → HARD, RPE 9 → VERY_HARD', () => {
    const log = [
      run(1, 8, 5, 23),   // HARD (8)
      run(3, 8, 5, 24),
      run(5, 8, 5, 25),
      run(7, 9, 3, 12),   // VERY_HARD (9)
      run(9, 9, 3, 13),
      run(11, 9, 3, 14),
    ]
    const r = analyzePaceByRpe({ log, today: TODAY })
    expect(r).not.toBe(null)
    const hard = r.bands.find((b) => b.name === 'HARD')
    const veryHard = r.bands.find((b) => b.name === 'VERY_HARD')
    expect(hard.count).toBe(3)
    expect(veryHard.count).toBe(3)
  })

  it('RPE 10 → VERY_HARD', () => {
    const log = [
      run(1, 3, 10, 60),
      run(3, 3, 10, 60),
      run(5, 3, 10, 60),
      run(7, 10, 3, 11),
      run(9, 10, 3, 12),
      run(11, 10, 3, 13),
    ]
    const r = analyzePaceByRpe({ log, today: TODAY })
    expect(r).not.toBe(null)
    const veryHard = r.bands.find((b) => b.name === 'VERY_HARD')
    expect(veryHard.count).toBe(3)
  })
})

// ─── Median computation ─────────────────────────────────────────────────────
describe('analyzePaceByRpe — median pace', () => {
  it('odd-count median picks the middle value', () => {
    // EASY: 3 runs at pace 6.0, 5.5, 7.0 → sorted [5.5, 6.0, 7.0] → median 6.0
    const log = [
      run(1, 3, 10, 60),   // 6.0 min/km
      run(3, 3, 10, 55),   // 5.5 min/km
      run(5, 3, 10, 70),   // 7.0 min/km
      run(7, 7, 10, 48),
      run(9, 7, 10, 50),
      run(11, 7, 10, 52),
    ]
    const r = analyzePaceByRpe({ log, today: TODAY })
    const easy = r.bands.find((b) => b.name === 'EASY')
    expect(easy.medianPace).toBeCloseTo(6.0, 5)
  })

  it('even-count median is average of two middle values', () => {
    // EASY: 4 runs paces 5.0, 5.5, 6.0, 7.0 → median = (5.5 + 6.0)/2 = 5.75
    const log = [
      run(1, 3, 10, 50),
      run(3, 3, 10, 55),
      run(5, 3, 10, 60),
      run(7, 3, 10, 70),
      run(9, 7, 10, 48),
      run(11, 7, 10, 50),
    ]
    const r = analyzePaceByRpe({ log, today: TODAY })
    const easy = r.bands.find((b) => b.name === 'EASY')
    expect(easy.medianPace).toBeCloseTo(5.75, 5)
  })

  it('median is robust to outliers (vs mean)', () => {
    // 5 runs at ~6:00 + 1 outlier at 12:00 — median still ≈ 6.0; mean would be ~7.0
    const log = [
      run(1, 3, 10, 60),
      run(3, 3, 10, 60),
      run(5, 3, 10, 60),
      run(7, 3, 10, 60),
      run(9, 3, 10, 60),
      run(11, 3, 10, 120),    // outlier 12:00/km — slow stroll/walk
      run(13, 7, 10, 50),
      run(15, 7, 10, 50),
      run(17, 7, 10, 50),
    ]
    const r = analyzePaceByRpe({ log, today: TODAY })
    const easy = r.bands.find((b) => b.name === 'EASY')
    // 6 values: [6,6,6,6,6,12] → median = (6+6)/2 = 6.0
    expect(easy.medianPace).toBeCloseTo(6.0, 5)
  })
})

// ─── Window filtering ───────────────────────────────────────────────────────
describe('analyzePaceByRpe — windowing', () => {
  it('excludes sessions older than 90 days', () => {
    const log = [
      run(1, 3, 10, 60),
      run(10, 3, 10, 60),
      run(20, 3, 10, 60),
      run(91, 3, 10, 30),   // out of window (would skew pace if included)
      run(100, 3, 10, 30),  // out of window
      run(7, 7, 10, 50),
      run(15, 7, 10, 50),
      run(25, 7, 10, 50),
    ]
    const r = analyzePaceByRpe({ log, today: TODAY })
    expect(r).not.toBe(null)
    expect(r.overallSampleCount).toBe(6)
    const easy = r.bands.find((b) => b.name === 'EASY')
    expect(easy.count).toBe(3)
    expect(easy.medianPace).toBeCloseTo(6.0, 5)
  })

  it('respects custom windowDays parameter', () => {
    const log = [
      run(1, 3, 10, 60),
      run(3, 3, 10, 60),
      run(5, 3, 10, 60),
      run(40, 7, 10, 50),   // outside 30d window
      run(45, 7, 10, 50),
      run(50, 7, 10, 50),
    ]
    const r30 = analyzePaceByRpe({ log, today: TODAY, windowDays: 30 })
    // After 30d filter: 3 EASY runs → 1 populated band → null
    expect(r30).toBe(null)

    const r90 = analyzePaceByRpe({ log, today: TODAY, windowDays: 90 })
    expect(r90).not.toBe(null)
    expect(r90.overallSampleCount).toBe(6)
  })

  it('skips sessions with invalid dates', () => {
    const log = [
      { date: 'not-a-date', type: 'run', rpe: 3, distanceKm: 10, durationMin: 60 },
      { date: '',           type: 'run', rpe: 3, distanceKm: 10, durationMin: 60 },
      run(1, 3, 10, 60),
      run(3, 3, 10, 60),
      run(5, 3, 10, 60),
      run(7, 7, 10, 50),
      run(9, 7, 10, 50),
      run(11, 7, 10, 50),
    ]
    const r = analyzePaceByRpe({ log, today: TODAY })
    expect(r).not.toBe(null)
    expect(r.overallSampleCount).toBe(6)
  })
})

// ─── Result shape / zero-sample bands ───────────────────────────────────────
describe('analyzePaceByRpe — result shape', () => {
  it('always returns all 4 bands in canonical order, zero-sample bands have count=0/medianPace=0', () => {
    // Populate only EASY + HARD
    const log = [
      run(1, 3, 10, 60),
      run(3, 3, 10, 60),
      run(5, 3, 10, 60),
      run(7, 7, 10, 50),
      run(9, 7, 10, 50),
      run(11, 7, 10, 50),
    ]
    const r = analyzePaceByRpe({ log, today: TODAY })
    expect(r).not.toBe(null)
    expect(r.bands.length).toBe(4)
    expect(r.bands.map((b) => b.name)).toEqual(['EASY', 'MODERATE', 'HARD', 'VERY_HARD'])

    const moderate = r.bands.find((b) => b.name === 'MODERATE')
    expect(moderate.count).toBe(0)
    expect(moderate.medianPace).toBe(0)
    expect(moderate.rpeRange).toBe('5-6')

    const veryHard = r.bands.find((b) => b.name === 'VERY_HARD')
    expect(veryHard.count).toBe(0)
    expect(veryHard.medianPace).toBe(0)
    expect(veryHard.rpeRange).toBe('9-10')

    expect(r.citation).toBe(PACE_BY_RPE_CITATION)
    expect(r.citation).toBe('Daniels 2014; Borg 1982')
  })

  it('coerces numeric-string fields (rpe, distanceKm, durationMin)', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1), type: 'run', rpe: '3', distanceKm: '10', durationMin: '60' },
      { date: isoMinusDays(TODAY, 3), type: 'run', rpe: '3', distanceKm: '10', durationMin: '60' },
      { date: isoMinusDays(TODAY, 5), type: 'run', rpe: '3', distanceKm: '10', durationMin: '60' },
      { date: isoMinusDays(TODAY, 7), type: 'run', rpe: '7', distanceKm: '10', durationMin: '50' },
      { date: isoMinusDays(TODAY, 9), type: 'run', rpe: '7', distanceKm: '10', durationMin: '50' },
      { date: isoMinusDays(TODAY, 11), type: 'run', rpe: '7', distanceKm: '10', durationMin: '50' },
    ]
    const r = analyzePaceByRpe({ log, today: TODAY })
    expect(r).not.toBe(null)
    expect(r.overallSampleCount).toBe(6)
    const easy = r.bands.find((b) => b.name === 'EASY')
    expect(easy.count).toBe(3)
    expect(easy.medianPace).toBeCloseTo(6.0, 5)
  })

  it('skips entries with out-of-range RPE (0, 11)', () => {
    const log = [
      run(1, 3, 10, 60),
      run(3, 3, 10, 60),
      run(5, 3, 10, 60),
      run(7, 7, 10, 50),
      run(9, 7, 10, 50),
      run(11, 7, 10, 50),
      { date: isoMinusDays(TODAY, 13), type: 'run', rpe: 11, distanceKm: 10, durationMin: 50 }, // invalid
      { date: isoMinusDays(TODAY, 15), type: 'run', rpe: 0,  distanceKm: 10, durationMin: 60 }, // invalid
    ]
    const r = analyzePaceByRpe({ log, today: TODAY })
    expect(r).not.toBe(null)
    expect(r.overallSampleCount).toBe(6)
  })
})
