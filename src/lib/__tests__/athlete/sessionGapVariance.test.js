// ─── sessionGapVariance.test.js — analyzeSessionGapVariance unit tests ───────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  analyzeSessionGapVariance,
  SESSION_GAP_VARIANCE_CITATION,
} from '../../athlete/sessionGapVariance.js'

const TODAY = '2026-05-19'

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  vi.setSystemTime(new Date())
})

// ─── Null / invalid input ────────────────────────────────────────────────────
describe('analyzeSessionGapVariance — null guards', () => {
  it('returns null when today is undefined', () => {
    expect(analyzeSessionGapVariance({ log: [] })).toBeNull()
  })

  it('returns null when today is an unparseable string', () => {
    expect(analyzeSessionGapVariance({ log: [], today: 'not-a-date' })).toBeNull()
  })

  it('returns null when today is an invalid Date', () => {
    expect(analyzeSessionGapVariance({ log: [], today: new Date('???') })).toBeNull()
  })

  it('returns null when today is a non-existent calendar day (Feb 30)', () => {
    expect(analyzeSessionGapVariance({ log: [], today: '2026-02-30' })).toBeNull()
  })

  it('returns null when windowDays <= 0', () => {
    expect(analyzeSessionGapVariance({ log: [], today: TODAY, windowDays: 0 })).toBeNull()
  })

  it('returns null when windowDays is NaN', () => {
    expect(analyzeSessionGapVariance({ log: [], today: TODAY, windowDays: NaN })).toBeNull()
  })
})

// ─── INSUFFICIENT_SESSIONS ────────────────────────────────────────────────────
describe('analyzeSessionGapVariance — INSUFFICIENT_SESSIONS', () => {
  it('returns INSUFFICIENT_SESSIONS on empty log', () => {
    const r = analyzeSessionGapVariance({ log: [], today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_SESSIONS')
    expect(r.sessionCount).toBe(0)
    expect(r.trainingDays).toEqual([])
    expect(r.gaps).toEqual([])
    expect(r.meanGapDays).toBe(0)
    expect(r.stdGapDays).toBe(0)
    expect(r.cv).toBe(0)
    expect(r.citation).toBe(SESSION_GAP_VARIANCE_CITATION)
  })

  it('returns INSUFFICIENT_SESSIONS when fewer than 6 training days', () => {
    const log = [
      { date: addDaysStr(TODAY, -1), tss: 50 },
      { date: addDaysStr(TODAY, -3), tss: 50 },
      { date: addDaysStr(TODAY, -5), tss: 50 },
      { date: addDaysStr(TODAY, -7), tss: 50 },
      { date: addDaysStr(TODAY, -9), tss: 50 },
    ]
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_SESSIONS')
    expect(r.sessionCount).toBe(5)
  })

  it('accepts undefined log without throwing', () => {
    const r = analyzeSessionGapVariance({ today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('INSUFFICIENT_SESSIONS')
  })
})

// ─── METRONOME band ──────────────────────────────────────────────────────────
describe('analyzeSessionGapVariance — METRONOME band', () => {
  it('classifies METRONOME for a perfectly every-other-day pattern (cv=0)', () => {
    // 8 sessions every 2 days → gaps all = 2 → cv = 0.
    const log = []
    for (let i = 0; i < 8; i++) {
      log.push({ date: addDaysStr(TODAY, -i * 2), tss: 50 })
    }
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    expect(r.band).toBe('METRONOME')
    expect(r.sessionCount).toBe(8)
    expect(r.meanGapDays).toBe(2)
    expect(r.stdGapDays).toBe(0)
    expect(r.cv).toBe(0)
    expect(r.gaps).toEqual([2, 2, 2, 2, 2, 2, 2])
  })

  it('classifies METRONOME for daily training (gap=1, cv=0)', () => {
    const log = []
    for (let i = 0; i < 10; i++) {
      log.push({ date: addDaysStr(TODAY, -i), tss: 30 })
    }
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    expect(r.band).toBe('METRONOME')
    expect(r.meanGapDays).toBe(1)
    expect(r.stdGapDays).toBe(0)
    expect(r.cv).toBe(0)
  })
})

// ─── STEADY band ──────────────────────────────────────────────────────────────
describe('analyzeSessionGapVariance — STEADY band', () => {
  it('classifies STEADY when cv is between 0.30 and 0.70', () => {
    // Gaps: 1, 2, 1, 2, 1, 2, 3 → mean ~1.71, mild spread → cv in steady range.
    const offsets = [0, 1, 3, 4, 6, 7, 9, 12]
    const log = offsets.map(o => ({ date: addDaysStr(TODAY, -o), tss: 50 }))
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    expect(r.sessionCount).toBe(8)
    expect(r.band).toBe('STEADY')
    expect(r.cv).toBeGreaterThanOrEqual(0.30)
    expect(r.cv).toBeLessThan(0.70)
  })
})

// ─── CHAOTIC band ────────────────────────────────────────────────────────────
describe('analyzeSessionGapVariance — CHAOTIC band', () => {
  it('classifies CHAOTIC for clustered-then-gap pattern', () => {
    // Three sessions in 3 days, then 8-day gap, then three more in 3 days.
    // Gaps: 1, 1, 8, 1, 1 → mean=2.4, very high spread → cv >= 0.70.
    const offsets = [0, 1, 2, 10, 11, 12]
    const log = offsets.map(o => ({ date: addDaysStr(TODAY, -o), tss: 50 }))
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    expect(r.sessionCount).toBe(6)
    expect(r.band).toBe('CHAOTIC')
    expect(r.cv).toBeGreaterThanOrEqual(0.70)
  })
})

// ─── Gap math ────────────────────────────────────────────────────────────────
describe('analyzeSessionGapVariance — gap math', () => {
  it('consecutive calendar days → gap = 1', () => {
    const log = []
    for (let i = 0; i < 7; i++) {
      log.push({ date: addDaysStr(TODAY, -i), tss: 40 })
    }
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    expect(r.gaps).toEqual([1, 1, 1, 1, 1, 1])
  })

  it('a 2-day off-period yields a gap of 2', () => {
    // train Mon, off Tue+Wed, train Thu... so the gap between Mon and Thu is 3?
    // Wait: gap = day-difference. Mon→Thu = 3 days. The spec says "2 days off
    // between = 2". That means train day1, off day2, train day3 → gap from
    // day1 to day3 = 2. So "2 days off between" actually means 1 day of rest
    // between two training days. We follow spec: consecutive days = 1,
    // 2 days off between = 2.
    // Setup: train on day0 and day2 (one day off in between).
    const log = []
    // training every 2 days = 1 rest day between → gap=2
    for (let i = 0; i < 6; i++) log.push({ date: addDaysStr(TODAY, -i * 2), tss: 40 })
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    expect(r.gaps.every(g => g === 2)).toBe(true)
  })

  it('multiple entries on same day count as one training day', () => {
    // 6 distinct training days, but with multi-entry days mixed in.
    const log = [
      { date: addDaysStr(TODAY, 0), tss: 50 },
      { date: addDaysStr(TODAY, 0), tss: 80 },       // double on day 0
      { date: addDaysStr(TODAY, 0), durationMin: 60 }, // triple on day 0
      { date: addDaysStr(TODAY, -2), tss: 50 },
      { date: addDaysStr(TODAY, -4), tss: 50 },
      { date: addDaysStr(TODAY, -6), tss: 50 },
      { date: addDaysStr(TODAY, -8), tss: 50 },
      { date: addDaysStr(TODAY, -10), tss: 50 },
    ]
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    expect(r.sessionCount).toBe(6)
    expect(r.trainingDays.length).toBe(6)
    expect(new Set(r.trainingDays).size).toBe(6)
  })

  it('sessionCount = number of unique training days only', () => {
    const log = [
      { date: addDaysStr(TODAY, -0), tss: 40 },
      { date: addDaysStr(TODAY, -0), tss: 40 }, // dup → 1
      { date: addDaysStr(TODAY, -2), tss: 40 },
      { date: addDaysStr(TODAY, -4), tss: 40 },
      { date: addDaysStr(TODAY, -6), tss: 40 },
      { date: addDaysStr(TODAY, -8), tss: 40 },
      { date: addDaysStr(TODAY, -10), tss: 40 },
    ]
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    expect(r.sessionCount).toBe(6)
  })
})

// ─── Training-day classification ─────────────────────────────────────────────
describe('analyzeSessionGapVariance — training-day classification', () => {
  it('tss=0, duration=0, distance=0 entries do NOT count as training', () => {
    const log = [
      { date: addDaysStr(TODAY, -1), tss: 0, duration_min: 0, distance_km: 0 },
      { date: addDaysStr(TODAY, -2), tss: 0, duration_min: 0, distance_km: 0 },
      { date: addDaysStr(TODAY, -3), tss: 0, duration_min: 0, distance_km: 0 },
      { date: addDaysStr(TODAY, -4), tss: 0, duration_min: 0, distance_km: 0 },
      { date: addDaysStr(TODAY, -5), tss: 0, duration_min: 0, distance_km: 0 },
      { date: addDaysStr(TODAY, -6), tss: 0, duration_min: 0, distance_km: 0 },
    ]
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    expect(r.sessionCount).toBe(0)
    expect(r.band).toBe('INSUFFICIENT_SESSIONS')
  })

  it('tss > 0 counts as training', () => {
    const log = []
    for (let i = 0; i < 7; i++) {
      log.push({ date: addDaysStr(TODAY, -i * 2), tss: 0.5 })
    }
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    expect(r.sessionCount).toBe(7)
  })

  it('durationMin (camelCase) > 0 counts as training', () => {
    const log = []
    for (let i = 0; i < 7; i++) {
      log.push({ date: addDaysStr(TODAY, -i * 2), durationMin: 30 })
    }
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    expect(r.sessionCount).toBe(7)
  })

  it('duration_min (snake_case) > 0 counts as training', () => {
    const log = []
    for (let i = 0; i < 7; i++) {
      log.push({ date: addDaysStr(TODAY, -i * 2), duration_min: 30 })
    }
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    expect(r.sessionCount).toBe(7)
  })

  it('distanceKm (camelCase) > 0 counts as training', () => {
    const log = []
    for (let i = 0; i < 7; i++) {
      log.push({ date: addDaysStr(TODAY, -i * 2), distanceKm: 5 })
    }
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    expect(r.sessionCount).toBe(7)
  })

  it('distance_km (snake_case) > 0 counts as training', () => {
    const log = []
    for (let i = 0; i < 7; i++) {
      log.push({ date: addDaysStr(TODAY, -i * 2), distance_km: 5 })
    }
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    expect(r.sessionCount).toBe(7)
  })

  it('any one positive field is sufficient to mark a training day', () => {
    const log = [
      { date: addDaysStr(TODAY, 0),  tss: 50 },
      { date: addDaysStr(TODAY, -2), durationMin: 45 },
      { date: addDaysStr(TODAY, -4), distance_km: 8 },
      { date: addDaysStr(TODAY, -6), tss: 30 },
      { date: addDaysStr(TODAY, -8), distance_km: 12 },
      { date: addDaysStr(TODAY, -10), duration_min: 60 },
    ]
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    expect(r.sessionCount).toBe(6)
  })
})

// ─── Window boundary / custom windowDays ─────────────────────────────────────
describe('analyzeSessionGapVariance — window boundary', () => {
  it('excludes entries outside the window', () => {
    const log = []
    // 6 in-window training days.
    for (let i = 0; i < 6; i++) {
      log.push({ date: addDaysStr(TODAY, -i * 2), tss: 40 })
    }
    // Far-past entries that should be ignored.
    log.push({ date: addDaysStr(TODAY, -200), tss: 40 })
    log.push({ date: addDaysStr(TODAY, -365), tss: 40 })
    const r = analyzeSessionGapVariance({ log, today: TODAY, windowDays: 30 })
    expect(r.sessionCount).toBe(6)
  })

  it('respects a custom windowDays', () => {
    const log = []
    // 6 sessions inside last 14 days
    for (let i = 0; i < 6; i++) {
      log.push({ date: addDaysStr(TODAY, -i * 2), tss: 40 })
    }
    // 1 session 20 days back (would be inside 30d but outside 14d)
    log.push({ date: addDaysStr(TODAY, -20), tss: 40 })
    const r = analyzeSessionGapVariance({ log, today: TODAY, windowDays: 14 })
    expect(r.sessionCount).toBe(6)
  })

  it('includes the today boundary date in the window', () => {
    const log = []
    log.push({ date: TODAY, tss: 50 })
    for (let i = 1; i < 6; i++) {
      log.push({ date: addDaysStr(TODAY, -i * 2), tss: 40 })
    }
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    expect(r.trainingDays).toContain(TODAY)
  })

  it('excludes a future-dated entry beyond today', () => {
    const log = []
    // 6 valid sessions
    for (let i = 0; i < 6; i++) {
      log.push({ date: addDaysStr(TODAY, -i * 2), tss: 40 })
    }
    log.push({ date: addDaysStr(TODAY, 5), tss: 50 }) // future
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    expect(r.trainingDays).not.toContain(addDaysStr(TODAY, 5))
    expect(r.sessionCount).toBe(6)
  })
})

// ─── today as Date vs string ─────────────────────────────────────────────────
describe('analyzeSessionGapVariance — today as Date or string', () => {
  it('accepts today as a string', () => {
    const log = []
    for (let i = 0; i < 6; i++) log.push({ date: addDaysStr(TODAY, -i * 2), tss: 40 })
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.sessionCount).toBe(6)
  })

  it('accepts today as a Date object', () => {
    const log = []
    for (let i = 0; i < 6; i++) log.push({ date: addDaysStr(TODAY, -i * 2), tss: 40 })
    const r = analyzeSessionGapVariance({ log, today: new Date(`${TODAY}T12:00:00Z`) })
    expect(r).not.toBeNull()
    expect(r.sessionCount).toBe(6)
  })

  it('produces equivalent results for Date and string today', () => {
    const log = []
    for (let i = 0; i < 6; i++) log.push({ date: addDaysStr(TODAY, -i * 2), tss: 40 })
    const a = analyzeSessionGapVariance({ log, today: TODAY })
    const b = analyzeSessionGapVariance({ log, today: new Date(`${TODAY}T12:00:00Z`) })
    expect(a.sessionCount).toBe(b.sessionCount)
    expect(a.meanGapDays).toBe(b.meanGapDays)
    expect(a.stdGapDays).toBe(b.stdGapDays)
    expect(a.cv).toBe(b.cv)
    expect(a.band).toBe(b.band)
  })
})

// ─── Rounding / shape ────────────────────────────────────────────────────────
describe('analyzeSessionGapVariance — output shape', () => {
  it('rounds meanGapDays and stdGapDays to 2 decimals', () => {
    const offsets = [0, 1, 3, 4, 6, 7, 9, 12]
    const log = offsets.map(o => ({ date: addDaysStr(TODAY, -o), tss: 50 }))
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    const meanStr = r.meanGapDays.toString()
    expect(meanStr.split('.')[1]?.length || 0).toBeLessThanOrEqual(2)
    const stdStr = r.stdGapDays.toString()
    expect(stdStr.split('.')[1]?.length || 0).toBeLessThanOrEqual(2)
  })

  it('rounds cv to 4 decimals', () => {
    const offsets = [0, 1, 3, 4, 6, 7, 9, 12]
    const log = offsets.map(o => ({ date: addDaysStr(TODAY, -o), tss: 50 }))
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    const cvStr = r.cv.toString()
    expect(cvStr.split('.')[1]?.length || 0).toBeLessThanOrEqual(4)
  })

  it('returns trainingDays sorted ascending', () => {
    // Shuffle the input
    const offsets = [10, 0, 6, 2, 8, 4]
    const log = offsets.map(o => ({ date: addDaysStr(TODAY, -o), tss: 40 }))
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    const sorted = [...r.trainingDays].sort()
    expect(r.trainingDays).toEqual(sorted)
  })

  it('always includes citation string', () => {
    const r1 = analyzeSessionGapVariance({ log: [], today: TODAY })
    const r2 = analyzeSessionGapVariance({ log: [{ date: TODAY, tss: 50 }], today: TODAY })
    expect(r1.citation).toBe(SESSION_GAP_VARIANCE_CITATION)
    expect(r2.citation).toBe(SESSION_GAP_VARIANCE_CITATION)
    expect(SESSION_GAP_VARIANCE_CITATION).toMatch(/Foster 2017/)
    expect(SESSION_GAP_VARIANCE_CITATION).toMatch(/Halson 2014/)
  })
})

// ─── Bad / malformed entries ─────────────────────────────────────────────────
describe('analyzeSessionGapVariance — bad entries', () => {
  it('ignores entries with no date', () => {
    const log = []
    log.push({ tss: 99 })
    log.push({ tss: 99, date: null })
    for (let i = 0; i < 6; i++) log.push({ date: addDaysStr(TODAY, -i * 2), tss: 40 })
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    expect(r.sessionCount).toBe(6)
  })

  it('ignores entries with malformed date strings', () => {
    const log = [{ date: 'banana', tss: 50 }, { date: '', tss: 50 }]
    for (let i = 0; i < 6; i++) log.push({ date: addDaysStr(TODAY, -i * 2), tss: 40 })
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    expect(r.sessionCount).toBe(6)
  })

  it('ignores null entries in log array', () => {
    const log = [null, undefined]
    for (let i = 0; i < 6; i++) log.push({ date: addDaysStr(TODAY, -i * 2), tss: 40 })
    const r = analyzeSessionGapVariance({ log, today: TODAY })
    expect(r.sessionCount).toBe(6)
  })
})
