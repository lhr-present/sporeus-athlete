// ─── checkInQuality.test.js — pure-fn coverage ──────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  analyzeCheckInQuality,
  classifyQualityBand,
  isFieldPresent,
  scoreSessionCompleteness,
  CHECK_IN_QUALITY_CITATION,
  QUALITY_FIELDS,
} from '../../athlete/checkInQuality.js'

const TODAY = '2026-05-18'

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function fullSession(daysAgo, overrides = {}) {
  return {
    date: isoMinusDays(TODAY, daysAgo),
    rpe: 6,
    tss: 80,
    durationMin: 60,
    heartRate: 140,
    ...overrides,
  }
}

// ─── isFieldPresent ─────────────────────────────────────────────────────────
describe('isFieldPresent', () => {
  it('treats numeric RPE (including 0) as present', () => {
    expect(isFieldPresent('rpe', 6)).toBe(true)
    expect(isFieldPresent('rpe', 0)).toBe(true)
  })

  it('rejects null/undefined/NaN/non-numeric strings', () => {
    expect(isFieldPresent('rpe', null)).toBe(false)
    expect(isFieldPresent('rpe', undefined)).toBe(false)
    expect(isFieldPresent('rpe', NaN)).toBe(false)
    expect(isFieldPresent('rpe', 'abc')).toBe(false)
  })

  it('requires tss, durationMin, heartRate to be > 0', () => {
    expect(isFieldPresent('tss', 0)).toBe(false)
    expect(isFieldPresent('tss', 50)).toBe(true)
    expect(isFieldPresent('durationMin', 0)).toBe(false)
    expect(isFieldPresent('durationMin', 30)).toBe(true)
    expect(isFieldPresent('heartRate', 0)).toBe(false)
    expect(isFieldPresent('heartRate', 140)).toBe(true)
  })

  it('coerces numeric strings', () => {
    expect(isFieldPresent('tss', '60')).toBe(true)
    expect(isFieldPresent('durationMin', '45')).toBe(true)
  })
})

// ─── scoreSessionCompleteness ───────────────────────────────────────────────
describe('scoreSessionCompleteness', () => {
  it('returns 1.0 when all 4 fields present', () => {
    const r = scoreSessionCompleteness({ rpe: 6, tss: 80, durationMin: 60, heartRate: 140 })
    expect(r.score).toBe(1)
    expect(r.present).toEqual({ rpe: true, tss: true, durationMin: true, heartRate: true })
  })

  it('returns 0.5 for half-filled session', () => {
    const r = scoreSessionCompleteness({ rpe: 6, durationMin: 60 })
    expect(r.score).toBe(0.5)
    expect(r.present.rpe).toBe(true)
    expect(r.present.tss).toBe(false)
    expect(r.present.durationMin).toBe(true)
    expect(r.present.heartRate).toBe(false)
  })

  it('returns 0 for empty session entry', () => {
    expect(scoreSessionCompleteness({}).score).toBe(0)
  })

  it('handles null safely', () => {
    expect(scoreSessionCompleteness(null).score).toBe(0)
  })
})

// ─── classifyQualityBand ────────────────────────────────────────────────────
describe('classifyQualityBand', () => {
  it('maps high avgQuality → COMPLETE', () => {
    expect(classifyQualityBand(1.0)).toBe('COMPLETE')
    expect(classifyQualityBand(0.85)).toBe('COMPLETE')
    expect(classifyQualityBand(0.80)).toBe('COMPLETE')
  })

  it('maps mid avgQuality → PARTIAL', () => {
    expect(classifyQualityBand(0.79)).toBe('PARTIAL')
    expect(classifyQualityBand(0.65)).toBe('PARTIAL')
    expect(classifyQualityBand(0.50)).toBe('PARTIAL')
  })

  it('maps low avgQuality → THIN', () => {
    expect(classifyQualityBand(0.49)).toBe('THIN')
    expect(classifyQualityBand(0.25)).toBe('THIN')
    expect(classifyQualityBand(0)).toBe('THIN')
  })

  it('falls through to THIN for NaN', () => {
    expect(classifyQualityBand(NaN)).toBe('THIN')
  })
})

// ─── analyzeCheckInQuality — null gating ────────────────────────────────────
describe('analyzeCheckInQuality — null gating', () => {
  it('returns null for null/empty log', () => {
    expect(analyzeCheckInQuality({ log: null, today: TODAY })).toBe(null)
    expect(analyzeCheckInQuality({ log: [], today: TODAY })).toBe(null)
    expect(analyzeCheckInQuality({ today: TODAY })).toBe(null)
  })

  it('returns null when fewer than 3 sessions inside the 14-day window', () => {
    const log = [
      fullSession(1),
      fullSession(5),
    ]
    expect(analyzeCheckInQuality({ log, today: TODAY })).toBe(null)
  })

  it('returns null when sessions are too old (outside 14-day window)', () => {
    const log = [
      fullSession(20),
      fullSession(25),
      fullSession(30),
    ]
    expect(analyzeCheckInQuality({ log, today: TODAY })).toBe(null)
  })

  it('ignores entries with invalid dates', () => {
    const log = [
      { date: 'not-a-date', rpe: 6, tss: 80, durationMin: 60, heartRate: 140 },
      { date: '', rpe: 6 },
      fullSession(1),
      fullSession(2),
    ]
    // Only 2 valid sessions in window → null
    expect(analyzeCheckInQuality({ log, today: TODAY })).toBe(null)
  })
})

// ─── analyzeCheckInQuality — COMPLETE band ──────────────────────────────────
describe('analyzeCheckInQuality — COMPLETE band', () => {
  it('all-fields-filled across 4 sessions → COMPLETE @ 100%', () => {
    const log = [fullSession(1), fullSession(3), fullSession(5), fullSession(7)]
    const r = analyzeCheckInQuality({ log, today: TODAY })
    expect(r).not.toBe(null)
    expect(r.band).toBe('COMPLETE')
    expect(r.avgQuality).toBe(1)
    expect(r.sessionCount).toBe(4)
    expect(r.weakestField).toBe(null)   // tied at 100% across the board
    expect(r.fieldFillRates).toEqual({ rpe: 1, tss: 1, durationMin: 1, heartRate: 1 })
    expect(r.citation).toBe('Halson 2014')
    expect(r.citation).toBe(CHECK_IN_QUALITY_CITATION)
  })

  it('one missing field across 5 sessions still classifies as COMPLETE', () => {
    // 5 sessions, only HR missing on all of them: avgQuality = 0.75 → PARTIAL,
    // so here we drop HR from just one of 5 sessions (avg = 0.95) → COMPLETE.
    const log = [
      fullSession(1),
      fullSession(3),
      fullSession(5),
      fullSession(7),
      fullSession(9, { heartRate: 0 }),
    ]
    const r = analyzeCheckInQuality({ log, today: TODAY })
    expect(r.band).toBe('COMPLETE')
    expect(r.weakestField).toBe('heartRate')
    expect(r.fieldFillRates.heartRate).toBeCloseTo(0.8, 5)
  })
})

// ─── analyzeCheckInQuality — PARTIAL band ───────────────────────────────────
describe('analyzeCheckInQuality — PARTIAL band', () => {
  it('half-filled sessions → PARTIAL', () => {
    // Each session has only rpe + durationMin → score 0.5 each.
    const log = [
      { date: isoMinusDays(TODAY, 1), rpe: 6, durationMin: 60 },
      { date: isoMinusDays(TODAY, 3), rpe: 5, durationMin: 45 },
      { date: isoMinusDays(TODAY, 5), rpe: 7, durationMin: 90 },
      { date: isoMinusDays(TODAY, 7), rpe: 6, durationMin: 50 },
    ]
    const r = analyzeCheckInQuality({ log, today: TODAY })
    expect(r.band).toBe('PARTIAL')
    expect(r.avgQuality).toBe(0.5)
    expect(r.sessionCount).toBe(4)
    expect(r.fieldFillRates.rpe).toBe(1)
    expect(r.fieldFillRates.durationMin).toBe(1)
    expect(r.fieldFillRates.tss).toBe(0)
    expect(r.fieldFillRates.heartRate).toBe(0)
    // tie between tss=0 and heartRate=0 → first one wins = 'tss'
    expect(r.weakestField).toBe('tss')
  })

  it('weakestField identifies the *least*-filled column, not just any zero', () => {
    // RPE always present; TSS always present; durationMin missing on 3 of 4;
    // heartRate missing on 1 of 4.
    // Per-field fill rates: rpe=1, tss=1, durationMin=0.25, heartRate=0.75
    const log = [
      { date: isoMinusDays(TODAY, 1), rpe: 6, tss: 80, durationMin: 60, heartRate: 140 },
      { date: isoMinusDays(TODAY, 3), rpe: 5, tss: 70, heartRate: 138 },
      { date: isoMinusDays(TODAY, 5), rpe: 7, tss: 90, heartRate: 142 },
      { date: isoMinusDays(TODAY, 7), rpe: 6, tss: 75 },
    ]
    const r = analyzeCheckInQuality({ log, today: TODAY })
    expect(r.weakestField).toBe('durationMin')
    expect(r.fieldFillRates.durationMin).toBeCloseTo(0.25, 5)
    expect(r.fieldFillRates.heartRate).toBeCloseTo(0.75, 5)
  })
})

// ─── analyzeCheckInQuality — THIN band ──────────────────────────────────────
describe('analyzeCheckInQuality — THIN band', () => {
  it('only rpe present → THIN', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1), rpe: 6 },
      { date: isoMinusDays(TODAY, 3), rpe: 7 },
      { date: isoMinusDays(TODAY, 5), rpe: 5 },
    ]
    const r = analyzeCheckInQuality({ log, today: TODAY })
    expect(r.band).toBe('THIN')
    expect(r.avgQuality).toBe(0.25)
    expect(r.sessionCount).toBe(3)
    expect(r.weakestField).toBe('tss')   // tss/durationMin/heartRate all 0; tss first by order
  })

  it('completely empty entries score 0 → THIN', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1) },
      { date: isoMinusDays(TODAY, 3) },
      { date: isoMinusDays(TODAY, 5) },
    ]
    const r = analyzeCheckInQuality({ log, today: TODAY })
    expect(r.band).toBe('THIN')
    expect(r.avgQuality).toBe(0)
  })
})

// ─── analyzeCheckInQuality — windowing ──────────────────────────────────────
describe('analyzeCheckInQuality — window filtering', () => {
  it('excludes sessions older than windowDays', () => {
    const log = [
      fullSession(1),     // in
      fullSession(7),     // in
      fullSession(13),    // in
      fullSession(20),    // out (14d window)
      fullSession(40),    // out
    ]
    const r = analyzeCheckInQuality({ log, today: TODAY })
    expect(r.sessionCount).toBe(3)
    expect(r.band).toBe('COMPLETE')
  })

  it('respects custom windowDays parameter', () => {
    const log = [
      fullSession(1),
      fullSession(3),
      fullSession(5),
      fullSession(10),
      fullSession(20),    // out for 7d window, in for 30d
    ]
    const r7 = analyzeCheckInQuality({ log, today: TODAY, windowDays: 7 })
    expect(r7.sessionCount).toBe(3)
    const r30 = analyzeCheckInQuality({ log, today: TODAY, windowDays: 30 })
    expect(r30.sessionCount).toBe(5)
  })

  it('excludes future-dated sessions when they fall after today', () => {
    const log = [
      fullSession(1),
      fullSession(3),
      fullSession(5),
      { ...fullSession(-2), rpe: 6 },   // 2 days in the future
    ]
    // future-dated entries actually pass the window filter (date > cutoff and
    // date <= today is false for future dates → excluded)
    const r = analyzeCheckInQuality({ log, today: TODAY })
    expect(r.sessionCount).toBe(3)
  })
})

// ─── QUALITY_FIELDS export sanity check ─────────────────────────────────────
describe('QUALITY_FIELDS constant', () => {
  it('exports the canonical 4-field list in display order', () => {
    expect(QUALITY_FIELDS).toEqual(['rpe', 'tss', 'durationMin', 'heartRate'])
  })
})
