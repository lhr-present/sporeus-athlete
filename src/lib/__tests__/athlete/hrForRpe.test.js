// ─── hrForRpe.test.js — pure-fn coverage ────────────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  analyzeHrForRpe,
  rpeToBand,
  HR_FOR_RPE_CITATION,
} from '../../athlete/hrForRpe.js'

const TODAY = '2026-05-18'

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function sess(daysAgo, rpe, heartRate, overrides = {}) {
  return {
    date: isoMinusDays(TODAY, daysAgo),
    rpe,
    heartRate,
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

// ─── Null gating ────────────────────────────────────────────────────────────
describe('analyzeHrForRpe — null gating', () => {
  it('returns null for null/empty/undefined log', () => {
    expect(analyzeHrForRpe({ log: null, today: TODAY })).toBe(null)
    expect(analyzeHrForRpe({ log: [], today: TODAY })).toBe(null)
    expect(analyzeHrForRpe({ today: TODAY })).toBe(null)
  })

  it('returns null when overall sample count < 6', () => {
    const log = [
      sess(1, 3, 130),
      sess(3, 4, 138),
      sess(5, 7, 160),
      sess(7, 8, 168),
      sess(9, 6, 148),
      // only 5 samples
    ]
    expect(analyzeHrForRpe({ log, today: TODAY })).toBe(null)
  })

  it('returns null when fewer than 2 bands are populated', () => {
    // All sessions in EASY band — 6 samples but only 1 band
    const log = [
      sess(1, 3, 130),
      sess(3, 4, 132),
      sess(5, 3, 134),
      sess(7, 4, 136),
      sess(9, 3, 128),
      sess(11, 4, 138),
    ]
    expect(analyzeHrForRpe({ log, today: TODAY })).toBe(null)
  })

  it('ignores entries with heartRate of 0 or missing', () => {
    const log = [
      sess(1, 3, 130),
      sess(3, 4, 132),
      sess(5, 7, 162),
      // Invalids — none counted:
      sess(7, 7, 0),
      sess(8, 7, null),
      sess(9, 7, undefined),
      sess(10, 7, -10),
      sess(11, 7, 'abc'),
    ]
    // Only 3 valid sessions → < 6 → null
    expect(analyzeHrForRpe({ log, today: TODAY })).toBe(null)
  })

  it('ignores entries with missing/invalid rpe', () => {
    const log = [
      sess(1, 3, 130),
      sess(3, 4, 132),
      sess(5, 7, 162),
      sess(7, null, 165),
      sess(9, '', 168),
      sess(11, 'abc', 170),
      sess(13, NaN, 170),
    ]
    // Only 3 valid sessions → null
    expect(analyzeHrForRpe({ log, today: TODAY })).toBe(null)
  })
})

// ─── Band grouping — boundary checks ────────────────────────────────────────
describe('analyzeHrForRpe — band boundaries', () => {
  it('RPE 4 → EASY, RPE 5 → MODERATE', () => {
    const log = [
      sess(1, 4, 138),
      sess(3, 4, 140),
      sess(5, 4, 142),
      sess(7, 5, 148),
      sess(9, 5, 150),
      sess(11, 5, 152),
    ]
    const r = analyzeHrForRpe({ log, today: TODAY })
    expect(r).not.toBe(null)
    const easy = r.bands.find((b) => b.name === 'EASY')
    const moderate = r.bands.find((b) => b.name === 'MODERATE')
    expect(easy.count).toBe(3)
    expect(moderate.count).toBe(3)
  })

  it('RPE 6 → MODERATE, RPE 7 → HARD', () => {
    const log = [
      sess(1, 6, 152),
      sess(3, 6, 154),
      sess(5, 6, 156),
      sess(7, 7, 160),
      sess(9, 7, 162),
      sess(11, 7, 164),
    ]
    const r = analyzeHrForRpe({ log, today: TODAY })
    expect(r).not.toBe(null)
    const moderate = r.bands.find((b) => b.name === 'MODERATE')
    const hard = r.bands.find((b) => b.name === 'HARD')
    expect(moderate.count).toBe(3)
    expect(hard.count).toBe(3)
  })

  it('RPE 8 → HARD, RPE 9 → VERY_HARD', () => {
    const log = [
      sess(1, 8, 168),
      sess(3, 8, 170),
      sess(5, 8, 172),
      sess(7, 9, 178),
      sess(9, 9, 180),
      sess(11, 9, 182),
    ]
    const r = analyzeHrForRpe({ log, today: TODAY })
    expect(r).not.toBe(null)
    const hard = r.bands.find((b) => b.name === 'HARD')
    const veryHard = r.bands.find((b) => b.name === 'VERY_HARD')
    expect(hard.count).toBe(3)
    expect(veryHard.count).toBe(3)
  })

  it('RPE 10 → VERY_HARD', () => {
    const log = [
      sess(1, 3, 130),
      sess(3, 3, 132),
      sess(5, 3, 134),
      sess(7, 10, 185),
      sess(9, 10, 187),
      sess(11, 10, 189),
    ]
    const r = analyzeHrForRpe({ log, today: TODAY })
    expect(r).not.toBe(null)
    const veryHard = r.bands.find((b) => b.name === 'VERY_HARD')
    expect(veryHard.count).toBe(3)
  })
})

// ─── Median computation ─────────────────────────────────────────────────────
describe('analyzeHrForRpe — median HR', () => {
  it('odd-count median picks the middle value', () => {
    // EASY: 3 sessions at HR 130, 125, 140 → sorted [125, 130, 140] → median 130
    const log = [
      sess(1, 3, 130),
      sess(3, 3, 125),
      sess(5, 3, 140),
      sess(7, 7, 162),
      sess(9, 7, 164),
      sess(11, 7, 166),
    ]
    const r = analyzeHrForRpe({ log, today: TODAY })
    const easy = r.bands.find((b) => b.name === 'EASY')
    expect(easy.medianHR).toBeCloseTo(130, 5)
  })

  it('even-count median is average of two middle values', () => {
    // EASY: 4 HRs 120, 130, 140, 150 → median = (130 + 140)/2 = 135
    const log = [
      sess(1, 3, 120),
      sess(3, 3, 130),
      sess(5, 3, 140),
      sess(7, 3, 150),
      sess(9, 7, 162),
      sess(11, 7, 164),
    ]
    const r = analyzeHrForRpe({ log, today: TODAY })
    const easy = r.bands.find((b) => b.name === 'EASY')
    expect(easy.medianHR).toBeCloseTo(135, 5)
  })

  it('median is robust to outliers (vs mean)', () => {
    // 5 sessions at ~130 + 1 outlier at 220 — median ≈ 130; mean would skew up
    const log = [
      sess(1, 3, 130),
      sess(3, 3, 130),
      sess(5, 3, 130),
      sess(7, 3, 130),
      sess(9, 3, 130),
      sess(11, 3, 220),  // HRM spike outlier
      sess(13, 7, 162),
      sess(15, 7, 162),
      sess(17, 7, 162),
    ]
    const r = analyzeHrForRpe({ log, today: TODAY })
    const easy = r.bands.find((b) => b.name === 'EASY')
    // 6 values: [130,130,130,130,130,220] → median = (130+130)/2 = 130
    expect(easy.medianHR).toBeCloseTo(130, 5)
  })
})

// ─── Window filtering ───────────────────────────────────────────────────────
describe('analyzeHrForRpe — windowing', () => {
  it('excludes sessions older than 90 days', () => {
    const log = [
      sess(1, 3, 130),
      sess(10, 3, 130),
      sess(20, 3, 130),
      sess(91, 3, 200),   // out of window — would skew median if included
      sess(100, 3, 220),  // out of window
      sess(7, 7, 162),
      sess(15, 7, 162),
      sess(25, 7, 162),
    ]
    const r = analyzeHrForRpe({ log, today: TODAY })
    expect(r).not.toBe(null)
    expect(r.overallSampleCount).toBe(6)
    const easy = r.bands.find((b) => b.name === 'EASY')
    expect(easy.count).toBe(3)
    expect(easy.medianHR).toBeCloseTo(130, 5)
  })

  it('respects custom windowDays parameter', () => {
    const log = [
      sess(1, 3, 130),
      sess(3, 3, 130),
      sess(5, 3, 130),
      sess(40, 7, 162),  // outside 30d window
      sess(45, 7, 162),
      sess(50, 7, 162),
    ]
    const r30 = analyzeHrForRpe({ log, today: TODAY, windowDays: 30 })
    // After 30d filter: 3 EASY sessions → 1 populated band → null
    expect(r30).toBe(null)

    const r90 = analyzeHrForRpe({ log, today: TODAY, windowDays: 90 })
    expect(r90).not.toBe(null)
    expect(r90.overallSampleCount).toBe(6)
  })

  it('skips sessions with invalid dates', () => {
    const log = [
      { date: 'not-a-date', rpe: 3, heartRate: 130 },
      { date: '',           rpe: 3, heartRate: 130 },
      sess(1, 3, 130),
      sess(3, 3, 130),
      sess(5, 3, 130),
      sess(7, 7, 162),
      sess(9, 7, 162),
      sess(11, 7, 162),
    ]
    const r = analyzeHrForRpe({ log, today: TODAY })
    expect(r).not.toBe(null)
    expect(r.overallSampleCount).toBe(6)
  })
})

// ─── Result shape / zero-sample bands ───────────────────────────────────────
describe('analyzeHrForRpe — result shape', () => {
  it('always returns all 4 bands in canonical order, zero-sample bands have count=0/medianHR=0', () => {
    // Populate only EASY + HARD
    const log = [
      sess(1, 3, 130),
      sess(3, 3, 130),
      sess(5, 3, 130),
      sess(7, 7, 162),
      sess(9, 7, 162),
      sess(11, 7, 162),
    ]
    const r = analyzeHrForRpe({ log, today: TODAY })
    expect(r).not.toBe(null)
    expect(r.bands.length).toBe(4)
    expect(r.bands.map((b) => b.name)).toEqual(['EASY', 'MODERATE', 'HARD', 'VERY_HARD'])

    const moderate = r.bands.find((b) => b.name === 'MODERATE')
    expect(moderate.count).toBe(0)
    expect(moderate.medianHR).toBe(0)
    expect(moderate.rpeRange).toBe('5-6')

    const veryHard = r.bands.find((b) => b.name === 'VERY_HARD')
    expect(veryHard.count).toBe(0)
    expect(veryHard.medianHR).toBe(0)
    expect(veryHard.rpeRange).toBe('9-10')

    expect(r.citation).toBe(HR_FOR_RPE_CITATION)
    expect(r.citation).toBe('Karvonen 1957; Borg 1982; Buchheit 2014')
  })

  it('coerces numeric-string fields (rpe, heartRate)', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1), rpe: '3', heartRate: '130' },
      { date: isoMinusDays(TODAY, 3), rpe: '3', heartRate: '130' },
      { date: isoMinusDays(TODAY, 5), rpe: '3', heartRate: '130' },
      { date: isoMinusDays(TODAY, 7), rpe: '7', heartRate: '162' },
      { date: isoMinusDays(TODAY, 9), rpe: '7', heartRate: '162' },
      { date: isoMinusDays(TODAY, 11), rpe: '7', heartRate: '162' },
    ]
    const r = analyzeHrForRpe({ log, today: TODAY })
    expect(r).not.toBe(null)
    expect(r.overallSampleCount).toBe(6)
    const easy = r.bands.find((b) => b.name === 'EASY')
    expect(easy.count).toBe(3)
    expect(easy.medianHR).toBeCloseTo(130, 5)
  })

  it('skips entries with out-of-range RPE (0, 11)', () => {
    const log = [
      sess(1, 3, 130),
      sess(3, 3, 130),
      sess(5, 3, 130),
      sess(7, 7, 162),
      sess(9, 7, 162),
      sess(11, 7, 162),
      sess(13, 11, 162),  // invalid
      sess(15, 0, 130),   // invalid
    ]
    const r = analyzeHrForRpe({ log, today: TODAY })
    expect(r).not.toBe(null)
    expect(r.overallSampleCount).toBe(6)
  })
})
