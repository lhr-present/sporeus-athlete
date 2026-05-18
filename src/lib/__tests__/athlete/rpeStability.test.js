// ─── rpeStability.test.js — pure-fn coverage ────────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  analyzeRpeStability,
  classifyStabilityBand,
  normalizeType,
  RPE_STABILITY_CITATION,
} from '../../athlete/rpeStability.js'

const TODAY = '2026-05-18'

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function session(daysAgo, type, rpe) {
  return { date: isoMinusDays(TODAY, daysAgo), type, rpe }
}

// ─── normalizeType ──────────────────────────────────────────────────────────
describe('normalizeType', () => {
  it('lowercases and trims', () => {
    expect(normalizeType('Easy')).toBe('easy')
    expect(normalizeType('EASY')).toBe('easy')
    expect(normalizeType('  Tempo  ')).toBe('tempo')
  })

  it('returns null for non-strings or empty values', () => {
    expect(normalizeType(null)).toBe(null)
    expect(normalizeType(undefined)).toBe(null)
    expect(normalizeType(123)).toBe(null)
    expect(normalizeType('')).toBe(null)
    expect(normalizeType('   ')).toBe(null)
  })
})

// ─── classifyStabilityBand ──────────────────────────────────────────────────
describe('classifyStabilityBand', () => {
  it('maps cv ≤ 0.15 → CALIBRATED', () => {
    expect(classifyStabilityBand(0)).toBe('CALIBRATED')
    expect(classifyStabilityBand(0.05)).toBe('CALIBRATED')
    expect(classifyStabilityBand(0.15)).toBe('CALIBRATED')
  })

  it('maps 0.15 < cv ≤ 0.30 → DEVELOPING', () => {
    expect(classifyStabilityBand(0.1500001)).toBe('DEVELOPING')
    expect(classifyStabilityBand(0.20)).toBe('DEVELOPING')
    expect(classifyStabilityBand(0.30)).toBe('DEVELOPING')
  })

  it('maps cv > 0.30 → MISCALIBRATED', () => {
    expect(classifyStabilityBand(0.31)).toBe('MISCALIBRATED')
    expect(classifyStabilityBand(0.5)).toBe('MISCALIBRATED')
    expect(classifyStabilityBand(1.0)).toBe('MISCALIBRATED')
  })

  it('falls through to MISCALIBRATED for NaN / negative', () => {
    expect(classifyStabilityBand(NaN)).toBe('MISCALIBRATED')
    expect(classifyStabilityBand(-0.1)).toBe('MISCALIBRATED')
  })
})

// ─── Null gating ────────────────────────────────────────────────────────────
describe('analyzeRpeStability — null gating', () => {
  it('returns null for null/empty/undefined log', () => {
    expect(analyzeRpeStability({ log: null, today: TODAY })).toBe(null)
    expect(analyzeRpeStability({ log: [], today: TODAY })).toBe(null)
    expect(analyzeRpeStability({ today: TODAY })).toBe(null)
  })

  it('returns null when only one type has ≥3 sessions', () => {
    const log = [
      session(1, 'easy', 4),
      session(3, 'easy', 4),
      session(5, 'easy', 4),
      session(7, 'tempo', 7), // only 2 tempos, group dropped
      session(9, 'tempo', 7),
    ]
    expect(analyzeRpeStability({ log, today: TODAY })).toBe(null)
  })

  it('returns null when each type has <3 sessions', () => {
    const log = [
      session(1, 'easy', 4),
      session(3, 'easy', 4),
      session(5, 'tempo', 7),
      session(7, 'tempo', 7),
    ]
    expect(analyzeRpeStability({ log, today: TODAY })).toBe(null)
  })

  it('returns null when sessions are outside the 28-day window', () => {
    const log = [
      session(40, 'easy', 4),
      session(45, 'easy', 4),
      session(50, 'easy', 4),
      session(55, 'tempo', 7),
      session(60, 'tempo', 7),
      session(65, 'tempo', 7),
    ]
    expect(analyzeRpeStability({ log, today: TODAY })).toBe(null)
  })

  it('ignores entries without type or rpe', () => {
    const log = [
      session(1, 'easy', 4),
      session(3, 'easy', 4),
      { date: isoMinusDays(TODAY, 5), rpe: 4 },              // no type
      { date: isoMinusDays(TODAY, 7), type: 'easy' },        // no rpe
      session(9, 'tempo', 7),
      session(11, 'tempo', 7),
    ]
    // easy has 2, tempo has 2 → null
    expect(analyzeRpeStability({ log, today: TODAY })).toBe(null)
  })
})

// ─── Type normalization — case-insensitive grouping ─────────────────────────
describe('analyzeRpeStability — type normalization', () => {
  it('groups "Easy", "easy", "EASY" together (case-insensitive)', () => {
    const log = [
      session(1, 'Easy', 4),
      session(3, 'easy', 4),
      session(5, 'EASY', 4),
      session(7, 'Tempo', 7),
      session(9, 'tempo', 7),
      session(11, 'TEMPO', 7),
    ]
    const r = analyzeRpeStability({ log, today: TODAY })
    expect(r).not.toBe(null)
    expect(r.groups.length).toBe(2)
    const easy = r.groups.find((g) => g.type === 'easy')
    const tempo = r.groups.find((g) => g.type === 'tempo')
    expect(easy.count).toBe(3)
    expect(tempo.count).toBe(3)
  })

  it('trims whitespace when grouping', () => {
    const log = [
      session(1, '  Easy  ', 4),
      session(3, 'easy', 4),
      session(5, 'EASY ', 4),
      session(7, 'tempo', 7),
      session(9, 'tempo', 7),
      session(11, 'tempo', 7),
    ]
    const r = analyzeRpeStability({ log, today: TODAY })
    expect(r.groups.find((g) => g.type === 'easy').count).toBe(3)
  })
})

// ─── CALIBRATED band ────────────────────────────────────────────────────────
describe('analyzeRpeStability — CALIBRATED band', () => {
  it('identical RPE within types → cv = 0 → CALIBRATED', () => {
    const log = [
      session(1, 'easy', 4),
      session(3, 'easy', 4),
      session(5, 'easy', 4),
      session(7, 'tempo', 7),
      session(9, 'tempo', 7),
      session(11, 'tempo', 7),
    ]
    const r = analyzeRpeStability({ log, today: TODAY })
    expect(r.band).toBe('CALIBRATED')
    expect(r.weightedCv).toBe(0)
    expect(r.totalSessions).toBe(6)
    expect(r.groups.length).toBe(2)
    expect(r.citation).toBe(RPE_STABILITY_CITATION)
    expect(r.citation).toBe('Foster 2001; Borg 1982')

    const easy = r.groups.find((g) => g.type === 'easy')
    expect(easy.count).toBe(3)
    expect(easy.meanRpe).toBe(4)
    expect(easy.stdRpe).toBe(0)
    expect(easy.cv).toBe(0)
  })

  it('cv math: mean 4, stdev 0.4714 (pop) → cv ≈ 0.118 → CALIBRATED', () => {
    // [4,4,4,5] → mean=4.25, stdev_pop = sqrt(((0.25^2)*3 + 0.75^2)/4) = sqrt((0.1875+0.5625)/4)
    //          = sqrt(0.1875) ≈ 0.4330; cv ≈ 0.4330/4.25 ≈ 0.1019 → CALIBRATED
    // Use a simpler verifiable case: [3,4,5] → mean=4, stdev_pop = sqrt((1+0+1)/3) = sqrt(2/3) ≈ 0.8165
    //   cv ≈ 0.2041 → DEVELOPING (so picking different values for CALIBRATED)
    // [5,5,5,5,6] → mean=5.2, var_pop = (0.04*4 + 0.64)/5 = (0.16+0.64)/5 = 0.16; stdev=0.4
    //   cv = 0.4/5.2 ≈ 0.0769 → CALIBRATED
    const log = [
      session(1, 'easy', 5),
      session(3, 'easy', 5),
      session(5, 'easy', 5),
      session(7, 'easy', 5),
      session(9, 'easy', 6),
      session(11, 'tempo', 7),
      session(13, 'tempo', 7),
      session(15, 'tempo', 7),
    ]
    const r = analyzeRpeStability({ log, today: TODAY })
    const easy = r.groups.find((g) => g.type === 'easy')
    expect(easy.meanRpe).toBeCloseTo(5.2, 5)
    expect(easy.stdRpe).toBeCloseTo(0.4, 5)
    expect(easy.cv).toBeCloseTo(0.4 / 5.2, 5)
    expect(r.band).toBe('CALIBRATED')
  })
})

// ─── DEVELOPING band ────────────────────────────────────────────────────────
describe('analyzeRpeStability — DEVELOPING band', () => {
  it('moderate within-type spread → DEVELOPING', () => {
    // easy: [3,4,5] → mean=4, stdev_pop=sqrt(2/3)≈0.8165, cv≈0.2041
    // tempo: [6,7,8] → mean=7, stdev_pop=sqrt(2/3)≈0.8165, cv≈0.1166
    // weighted cv = (3*0.2041 + 3*0.1166)/6 ≈ 0.1604 → DEVELOPING
    const log = [
      session(1, 'easy', 3),
      session(3, 'easy', 4),
      session(5, 'easy', 5),
      session(7, 'tempo', 6),
      session(9, 'tempo', 7),
      session(11, 'tempo', 8),
    ]
    const r = analyzeRpeStability({ log, today: TODAY })
    expect(r.band).toBe('DEVELOPING')
    expect(r.weightedCv).toBeGreaterThan(0.15)
    expect(r.weightedCv).toBeLessThanOrEqual(0.30)
  })

  it('weightedCv is count-weighted across groups (not simple mean)', () => {
    // easy: 6 sessions all at 4 → cv = 0
    // tempo: 3 sessions [5,7,9] → mean=7, stdev_pop=sqrt((4+0+4)/3)=sqrt(8/3)≈1.633, cv≈0.2333
    // simple mean of cvs = (0+0.2333)/2 = 0.1166 → CALIBRATED
    // weighted = (6*0 + 3*0.2333) / 9 = 0.0778 → CALIBRATED
    // Use a different mix so the distinction matters:
    // easy: 3 sessions [3,4,5] → cv ≈ 0.2041
    // tempo: 6 sessions all at 7 → cv = 0
    // simple mean = 0.1020 → CALIBRATED
    // weighted = (3*0.2041 + 6*0) / 9 ≈ 0.0680 → CALIBRATED
    const log = [
      session(1, 'easy', 3),
      session(3, 'easy', 4),
      session(5, 'easy', 5),
      session(7, 'tempo', 7),
      session(9, 'tempo', 7),
      session(11, 'tempo', 7),
      session(13, 'tempo', 7),
      session(15, 'tempo', 7),
      session(17, 'tempo', 7),
    ]
    const r = analyzeRpeStability({ log, today: TODAY })
    expect(r.totalSessions).toBe(9)
    // Weighted cv must equal (3 * easy.cv + 6 * 0) / 9
    const easy = r.groups.find((g) => g.type === 'easy')
    expect(r.weightedCv).toBeCloseTo((3 * easy.cv) / 9, 6)
    expect(r.band).toBe('CALIBRATED')
  })
})

// ─── MISCALIBRATED band ─────────────────────────────────────────────────────
describe('analyzeRpeStability — MISCALIBRATED band', () => {
  it('large within-type spread → MISCALIBRATED', () => {
    // easy: [2,5,8] → mean=5, stdev_pop=sqrt((9+0+9)/3)=sqrt(6)≈2.449, cv≈0.4899
    // tempo: [4,7,10] → mean=7, stdev_pop=sqrt((9+0+9)/3)≈2.449, cv≈0.3499
    // weighted cv = (3*0.4899 + 3*0.3499)/6 ≈ 0.4199 → MISCALIBRATED
    const log = [
      session(1, 'easy', 2),
      session(3, 'easy', 5),
      session(5, 'easy', 8),
      session(7, 'tempo', 4),
      session(9, 'tempo', 7),
      session(11, 'tempo', 10),
    ]
    const r = analyzeRpeStability({ log, today: TODAY })
    expect(r.band).toBe('MISCALIBRATED')
    expect(r.weightedCv).toBeGreaterThan(0.30)
  })
})

// ─── Window filtering ───────────────────────────────────────────────────────
describe('analyzeRpeStability — windowing', () => {
  it('excludes sessions older than 28 days', () => {
    const log = [
      session(1, 'easy', 4),
      session(10, 'easy', 4),
      session(20, 'easy', 4),
      session(30, 'easy', 9),    // out of window
      session(5, 'tempo', 7),
      session(15, 'tempo', 7),
      session(25, 'tempo', 7),
    ]
    const r = analyzeRpeStability({ log, today: TODAY })
    expect(r).not.toBe(null)
    const easy = r.groups.find((g) => g.type === 'easy')
    expect(easy.count).toBe(3)              // the 30-day-old session was excluded
    expect(easy.stdRpe).toBe(0)             // all 4s remain
  })

  it('respects custom windowDays parameter', () => {
    const log = [
      session(1, 'easy', 4),
      session(3, 'easy', 4),
      session(5, 'easy', 4),
      session(10, 'easy', 4),
      session(7, 'tempo', 7),
      session(12, 'tempo', 7),
      session(20, 'tempo', 7),
    ]
    const r7 = analyzeRpeStability({ log, today: TODAY, windowDays: 7 })
    // easy in 7d window: daysAgo 1,3,5 = 3 sessions
    // tempo in 7d: daysAgo 7 = NOT in (cutoff > date, so date must be > cutoff)
    // tempo loses sessions → group dropped → only 1 valid group → null
    expect(r7).toBe(null)

    const r28 = analyzeRpeStability({ log, today: TODAY, windowDays: 28 })
    expect(r28).not.toBe(null)
    expect(r28.groups.length).toBe(2)
  })

  it('skips sessions with invalid dates', () => {
    const log = [
      { date: 'not-a-date', type: 'easy', rpe: 4 },
      { date: '', type: 'easy', rpe: 4 },
      session(1, 'easy', 4),
      session(3, 'easy', 4),
      session(5, 'easy', 4),
      session(7, 'tempo', 7),
      session(9, 'tempo', 7),
      session(11, 'tempo', 7),
    ]
    const r = analyzeRpeStability({ log, today: TODAY })
    expect(r.totalSessions).toBe(6)
  })

  it('rejects non-numeric / non-finite RPE values', () => {
    const log = [
      session(1, 'easy', 4),
      session(3, 'easy', 4),
      session(5, 'easy', 4),
      { date: isoMinusDays(TODAY, 7), type: 'easy', rpe: 'abc' },
      { date: isoMinusDays(TODAY, 9), type: 'easy', rpe: null },
      session(11, 'tempo', 7),
      session(13, 'tempo', 7),
      session(15, 'tempo', 7),
    ]
    const r = analyzeRpeStability({ log, today: TODAY })
    expect(r.groups.find((g) => g.type === 'easy').count).toBe(3)
  })

  it('coerces numeric-string RPE', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1), type: 'easy', rpe: '4' },
      { date: isoMinusDays(TODAY, 3), type: 'easy', rpe: '4' },
      { date: isoMinusDays(TODAY, 5), type: 'easy', rpe: '4' },
      session(7, 'tempo', 7),
      session(9, 'tempo', 7),
      session(11, 'tempo', 7),
    ]
    const r = analyzeRpeStability({ log, today: TODAY })
    expect(r).not.toBe(null)
    expect(r.totalSessions).toBe(6)
  })
})

// ─── Per-group cv math verification ─────────────────────────────────────────
describe('analyzeRpeStability — cv math', () => {
  it('returns cv=0 when meanRpe is 0 (no NaN leakage)', () => {
    const log = [
      session(1, 'easy', 0),
      session(3, 'easy', 0),
      session(5, 'easy', 0),
      session(7, 'tempo', 7),
      session(9, 'tempo', 7),
      session(11, 'tempo', 7),
    ]
    const r = analyzeRpeStability({ log, today: TODAY })
    const easy = r.groups.find((g) => g.type === 'easy')
    expect(easy.meanRpe).toBe(0)
    expect(easy.cv).toBe(0)
    expect(Number.isFinite(r.weightedCv)).toBe(true)
  })

  it('returns population stdev (not sample stdev)', () => {
    // [6, 7, 8] → mean=7. Population variance = ((1+0+1)/3) = 2/3 → stdev≈0.8165
    // Sample variance would be /2 = 1.0 → stdev=1.0 (would fail)
    const log = [
      session(1, 'easy', 6),
      session(3, 'easy', 7),
      session(5, 'easy', 8),
      session(7, 'tempo', 4),
      session(9, 'tempo', 4),
      session(11, 'tempo', 4),
    ]
    const r = analyzeRpeStability({ log, today: TODAY })
    const easy = r.groups.find((g) => g.type === 'easy')
    expect(easy.stdRpe).toBeCloseTo(Math.sqrt(2 / 3), 5)
  })
})
