// E131
import { describe, it, expect } from 'vitest'
import {
  detectMonotonyStrain,
  MONOTONY_STRAIN_CITATION,
} from '../../athlete/trainingMonotonyStrain.js'

const TODAY = '2026-05-04'

// ─── Helpers ────────────────────────────────────────────────────────────────
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Build a 7-day log from an array of daily TSS values, oldest-first.
 * tssValues[0] = today-6, tssValues[6] = today.
 * Days with TSS = 0 are omitted from the log (rest days, no entry).
 */
function makeWeekLog(tssValues, endDate = TODAY) {
  const log = []
  for (let i = 0; i < tssValues.length; i++) {
    const v = tssValues[i]
    if (v > 0) {
      log.push({ date: addDays(endDate, -(tssValues.length - 1 - i)), type: 'run', tss: v })
    }
  }
  return log
}

// ─── Empty / null inputs ────────────────────────────────────────────────────
describe('detectMonotonyStrain — empty / null inputs', () => {
  it('null log → safe defaults, reliable: false', () => {
    const r = detectMonotonyStrain(null, TODAY)
    expect(r.monotony).toBe(0)
    expect(r.strain).toBe(0)
    expect(r.weekTotalTSS).toBe(0)
    expect(r.daysWithLoad).toBe(0)
    expect(r.band).toBe('low')
    expect(r.reliable).toBe(false)
    expect(r.citation).toBe('Foster 2001 monotony/strain')
  })

  it('empty log → safe defaults, reliable: false', () => {
    const r = detectMonotonyStrain([], TODAY)
    expect(r.monotony).toBe(0)
    expect(r.strain).toBe(0)
    expect(r.weekTotalTSS).toBe(0)
    expect(r.daysWithLoad).toBe(0)
    expect(r.reliable).toBe(false)
  })

  it('non-array log (object) → safe defaults', () => {
    const r = detectMonotonyStrain({ foo: 'bar' }, TODAY)
    expect(r.monotony).toBe(0)
    expect(r.reliable).toBe(false)
  })
})

// ─── Reliability flag ───────────────────────────────────────────────────────
describe('detectMonotonyStrain — reliability', () => {
  it('1 entry in window → reliable: false', () => {
    const log = [{ date: TODAY, type: 'run', tss: 100 }]
    const r = detectMonotonyStrain(log, TODAY)
    expect(r.reliable).toBe(false)
  })

  it('4 distinct days in window → reliable: false', () => {
    const log = makeWeekLog([50, 50, 50, 50, 0, 0, 0])
    const r = detectMonotonyStrain(log, TODAY)
    expect(r.reliable).toBe(false)
  })

  it('exactly 5 distinct days in window → reliable: true', () => {
    const log = makeWeekLog([50, 50, 50, 50, 50, 0, 0])
    const r = detectMonotonyStrain(log, TODAY)
    expect(r.reliable).toBe(true)
  })

  it('7 distinct days → reliable: true', () => {
    const log = makeWeekLog([50, 50, 50, 50, 50, 50, 50])
    const r = detectMonotonyStrain(log, TODAY)
    expect(r.reliable).toBe(true)
  })
})

// ─── Monotony math ──────────────────────────────────────────────────────────
describe('detectMonotonyStrain — monotony calculation', () => {
  it('7 identical 50-TSS days → stdev=0 → monotony=0, low band', () => {
    const log = makeWeekLog([50, 50, 50, 50, 50, 50, 50])
    const r = detectMonotonyStrain(log, TODAY)
    expect(r.monotony).toBe(0)
    expect(r.band).toBe('low')
    expect(r.weekTotalTSS).toBe(350)
    expect(r.daysWithLoad).toBe(7)
  })

  it('all-zero log → monotony=0, low band, weekTotalTSS=0', () => {
    const r = detectMonotonyStrain([], TODAY)
    expect(r.monotony).toBe(0)
    expect(r.weekTotalTSS).toBe(0)
    expect(r.daysWithLoad).toBe(0)
    expect(r.band).toBe('low')
  })

  it('high variance week → low monotony, low band', () => {
    // (200,0,200,0,200,0,200): mean=114.3, large stdev
    const log = makeWeekLog([200, 0, 200, 0, 200, 0, 200])
    const r = detectMonotonyStrain(log, TODAY)
    expect(r.monotony).toBeLessThan(1.5)
    expect(r.band).toBe('low')
  })

  it('flat schedule with 2 rest days → monotony just under 1.5, low band', () => {
    // (100,100,100,100,100,0,0): monotony ≈ 1.46
    const log = makeWeekLog([100, 100, 100, 100, 100, 0, 0])
    const r = detectMonotonyStrain(log, TODAY)
    expect(r.monotony).toBeLessThan(1.5)
    expect(r.monotony).toBeGreaterThan(1.4)
    expect(r.band).toBe('low')
  })

  it('moderate-monotony pattern → moderate band', () => {
    // (100,30,100,30,100,30,100): mean=70, stdev≈37.42, monotony≈1.87
    const log = makeWeekLog([100, 30, 100, 30, 100, 30, 100])
    const r = detectMonotonyStrain(log, TODAY)
    expect(r.monotony).toBeGreaterThanOrEqual(1.5)
    expect(r.monotony).toBeLessThan(2.0)
    expect(r.band).toBe('moderate')
  })

  it('hard-uniform pattern (high mean, low stdev) → high band', () => {
    // (100,100,100,100,100,100,0): mean=85.7, stdev≈37.8, monotony≈2.27
    const log = makeWeekLog([100, 100, 100, 100, 100, 100, 0])
    const r = detectMonotonyStrain(log, TODAY)
    expect(r.monotony).toBeGreaterThanOrEqual(2.0)
    expect(r.band).toBe('high')
  })
})

// ─── Strain math ────────────────────────────────────────────────────────────
describe('detectMonotonyStrain — strain calculation', () => {
  it('strain = weekTotal × monotony, integer rounded', () => {
    // Moderate pattern: weekTotal=490, monotony≈1.87, strain≈916
    const log = makeWeekLog([100, 30, 100, 30, 100, 30, 100])
    const r = detectMonotonyStrain(log, TODAY)
    const expectedStrain = Math.round(r.weekTotalTSS * r.monotony)
    // Allow ±1 tolerance because monotony is rounded to 0.01 in output
    expect(Math.abs(r.strain - expectedStrain)).toBeLessThanOrEqual(Math.ceil(r.weekTotalTSS * 0.005) + 1)
  })

  it('uniform 100 TSS week (stdev=0) → strain = 0 (since monotony=0)', () => {
    const log = makeWeekLog([100, 100, 100, 100, 100, 100, 100])
    const r = detectMonotonyStrain(log, TODAY)
    expect(r.weekTotalTSS).toBe(700)
    expect(r.monotony).toBe(0)
    expect(r.strain).toBe(0)
  })

  it('high band triggered by strain > 6000 even when monotony < 2', () => {
    // (700,200,700,200,700,200,700): monotony≈1.82, sum=3400, strain≈6178
    const log = makeWeekLog([700, 200, 700, 200, 700, 200, 700])
    const r = detectMonotonyStrain(log, TODAY)
    expect(r.monotony).toBeLessThan(2.0)
    expect(r.monotony).toBeGreaterThanOrEqual(1.5)
    expect(r.strain).toBeGreaterThan(6000)
    expect(r.band).toBe('high')
  })
})

// ─── Band boundaries ────────────────────────────────────────────────────────
describe('detectMonotonyStrain — band boundaries', () => {
  it('monotony just below 1.5 → low', () => {
    const log = makeWeekLog([100, 100, 100, 100, 100, 0, 0])
    const r = detectMonotonyStrain(log, TODAY)
    expect(r.band).toBe('low')
  })

  it('monotony in [1.5, 2.0) → moderate', () => {
    const log = makeWeekLog([100, 30, 100, 30, 100, 30, 100])
    const r = detectMonotonyStrain(log, TODAY)
    expect(r.band).toBe('moderate')
  })

  it('monotony at/above 2.0 → high', () => {
    // (90,30,90,30,90,30,90) → monotony ≈ 2.005
    const log = makeWeekLog([90, 30, 90, 30, 90, 30, 90])
    const r = detectMonotonyStrain(log, TODAY)
    expect(r.monotony).toBeGreaterThanOrEqual(2.0)
    expect(r.band).toBe('high')
  })
})

// ─── daysWithLoad / weekTotalTSS ────────────────────────────────────────────
describe('detectMonotonyStrain — counters', () => {
  it('daysWithLoad counts non-zero days only', () => {
    const log = makeWeekLog([100, 0, 50, 0, 75, 0, 0])
    const r = detectMonotonyStrain(log, TODAY)
    expect(r.daysWithLoad).toBe(3)
  })

  it('weekTotalTSS sums all TSS in window', () => {
    const log = makeWeekLog([10, 20, 30, 40, 50, 60, 70])
    const r = detectMonotonyStrain(log, TODAY)
    expect(r.weekTotalTSS).toBe(280)
  })

  it('two sessions same day → daily TSS combined', () => {
    const log = [
      { date: TODAY, type: 'bike', tss: 60 },
      { date: TODAY, type: 'run', tss: 40 },
      { date: addDays(TODAY, -1), type: 'run', tss: 50 },
    ]
    const r = detectMonotonyStrain(log, TODAY)
    expect(r.weekTotalTSS).toBe(150)
    expect(r.daysWithLoad).toBe(2)
  })
})

// ─── Window filtering ───────────────────────────────────────────────────────
describe('detectMonotonyStrain — window filtering', () => {
  it('entries older than 7 days are ignored', () => {
    const log = [
      { date: addDays(TODAY, -10), type: 'run', tss: 500 }, // outside window
      { date: addDays(TODAY, -8), type: 'run', tss: 500 },  // outside window
      { date: addDays(TODAY, -1), type: 'run', tss: 50 },
      { date: TODAY, type: 'run', tss: 50 },
    ]
    const r = detectMonotonyStrain(log, TODAY)
    expect(r.weekTotalTSS).toBe(100)
    expect(r.daysWithLoad).toBe(2)
  })

  it('entries dated after today are ignored', () => {
    const log = [
      { date: addDays(TODAY, 1), type: 'run', tss: 999 },
      { date: addDays(TODAY, 5), type: 'run', tss: 999 },
      { date: TODAY, type: 'run', tss: 100 },
    ]
    const r = detectMonotonyStrain(log, TODAY)
    expect(r.weekTotalTSS).toBe(100)
    expect(r.daysWithLoad).toBe(1)
  })

  it('exact start of window (today-6) is included', () => {
    const log = [
      { date: addDays(TODAY, -6), type: 'run', tss: 50 },
      { date: addDays(TODAY, -7), type: 'run', tss: 999 }, // just outside
    ]
    const r = detectMonotonyStrain(log, TODAY)
    expect(r.weekTotalTSS).toBe(50)
    expect(r.daysWithLoad).toBe(1)
  })
})

// ─── Bilingual messages ─────────────────────────────────────────────────────
describe('detectMonotonyStrain — bilingual messages', () => {
  it('low band has EN + TR messages, empty recommendation', () => {
    const log = makeWeekLog([200, 0, 200, 0, 200, 0, 200])
    const r = detectMonotonyStrain(log, TODAY)
    expect(r.band).toBe('low')
    expect(r.message.en.length).toBeGreaterThan(0)
    expect(r.message.tr.length).toBeGreaterThan(0)
    expect(r.recommendation.en).toBe('')
    expect(r.recommendation.tr).toBe('')
  })

  it('moderate band has EN + TR messages and recommendation', () => {
    const log = makeWeekLog([100, 30, 100, 30, 100, 30, 100])
    const r = detectMonotonyStrain(log, TODAY)
    expect(r.band).toBe('moderate')
    expect(r.message.en).toMatch(/Monotony rising/)
    expect(r.message.tr).toMatch(/Monotonluk/)
    expect(r.recommendation.en.length).toBeGreaterThan(0)
    expect(r.recommendation.tr.length).toBeGreaterThan(0)
  })

  it('high band has EN + TR messages and recovery recommendation', () => {
    const log = makeWeekLog([100, 100, 100, 100, 100, 100, 0])
    const r = detectMonotonyStrain(log, TODAY)
    expect(r.band).toBe('high')
    expect(r.message.en).toMatch(/Overtraining risk/)
    expect(r.message.tr).toMatch(/Aşırı antrenman/)
    expect(r.recommendation.en).toMatch(/recovery/i)
    expect(r.recommendation.tr).toMatch(/toparlanma/)
  })
})

// ─── Citation + return shape ────────────────────────────────────────────────
describe('detectMonotonyStrain — return shape', () => {
  it('citation field is "Foster 2001 monotony/strain"', () => {
    const r = detectMonotonyStrain([], TODAY)
    expect(r.citation).toBe('Foster 2001 monotony/strain')
    expect(MONOTONY_STRAIN_CITATION).toBe('Foster 2001 monotony/strain')
  })

  it('result has all 9 expected keys', () => {
    const r = detectMonotonyStrain([], TODAY)
    const keys = Object.keys(r).sort()
    expect(keys).toEqual([
      'band',
      'citation',
      'daysWithLoad',
      'message',
      'monotony',
      'recommendation',
      'reliable',
      'strain',
      'weekTotalTSS',
    ])
  })

  it('monotony is rounded to 0.01', () => {
    const log = makeWeekLog([100, 30, 100, 30, 100, 30, 100])
    const r = detectMonotonyStrain(log, TODAY)
    const decimals = (r.monotony.toString().split('.')[1] || '').length
    expect(decimals).toBeLessThanOrEqual(2)
  })

  it('strain is an integer', () => {
    const log = makeWeekLog([100, 30, 100, 30, 100, 30, 100])
    const r = detectMonotonyStrain(log, TODAY)
    expect(Number.isInteger(r.strain)).toBe(true)
  })
})
