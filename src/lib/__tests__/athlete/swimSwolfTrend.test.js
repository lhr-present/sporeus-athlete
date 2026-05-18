// ─── swimSwolfTrend.test.js — SWOLF trend pure-fn coverage ───────────────────
import { describe, it, expect } from 'vitest'
import {
  computeSwimSwolfTrend,
  SWOLF_TREND_CITATION,
} from '../../athlete/swimSwolfTrend.js'

const TODAY = '2026-05-15'

/** Build a swim entry with a direct swolf field. */
function swim(dateOffsetDays, swolf, extra = {}) {
  const base = new Date(TODAY + 'T00:00:00Z')
  base.setUTCDate(base.getUTCDate() - dateOffsetDays)
  return {
    type: 'swim',
    date: base.toISOString().slice(0, 10),
    swolf,
    ...extra,
  }
}

/** Build a swim entry without direct swolf — must be computed. */
function swimComputed(dateOffsetDays, { strokes, distance, duration, poolLength = 25 }, extra = {}) {
  const base = new Date(TODAY + 'T00:00:00Z')
  base.setUTCDate(base.getUTCDate() - dateOffsetDays)
  return {
    type: 'swim',
    date: base.toISOString().slice(0, 10),
    strokes,
    distance,
    duration,
    poolLength,
    ...extra,
  }
}

describe('computeSwimSwolfTrend — null cases', () => {
  it('returns null for empty log', () => {
    expect(computeSwimSwolfTrend({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null for null/undefined log', () => {
    expect(computeSwimSwolfTrend({ log: null, today: TODAY })).toBeNull()
    expect(computeSwimSwolfTrend({ today: TODAY })).toBeNull()
  })

  it('returns null when there are no swim sessions in the log', () => {
    const log = [
      { type: 'bike', date: '2026-05-10', tss: 60 },
      { type: 'run',  date: '2026-05-11', tss: 70 },
    ]
    expect(computeSwimSwolfTrend({ log, today: TODAY })).toBeNull()
  })

  it('returns null when fewer than 3 valid SWOLF entries', () => {
    const log = [
      swim(2,  55),
      swim(10, 56),
    ]
    expect(computeSwimSwolfTrend({ log, today: TODAY })).toBeNull()
  })

  it('returns null when valid entries are all outside the window', () => {
    const log = [
      swim(40, 55),
      swim(50, 56),
      swim(60, 57),
    ]
    expect(computeSwimSwolfTrend({ log, today: TODAY })).toBeNull()
  })

  it('skips low-RPE recovery entries — drops to 2 valid → null', () => {
    const log = [
      swim(2,  55),
      swim(10, 56, { rpe: 2 }), // skipped
      swim(20, 57, { rpe: 1 }), // skipped
    ]
    expect(computeSwimSwolfTrend({ log, today: TODAY })).toBeNull()
  })
})

describe('computeSwimSwolfTrend — trend classification', () => {
  it('improving when last week mean is at least 2 lower than first week mean', () => {
    const log = [
      // First week (~22-28 days ago) — higher SWOLF (~60)
      swim(26, 60), swim(24, 62), swim(22, 61),
      // Middle weeks
      swim(18, 58), swim(11, 56),
      // Last week (0-6 days ago) — lower SWOLF (~50)
      swim(5, 50), swim(2, 51), swim(1, 49),
    ]
    const r = computeSwimSwolfTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.trend).toBe('improving')
  })

  it('stable when first and last week means are within ±2', () => {
    const log = [
      swim(26, 55), swim(24, 56), swim(22, 55),
      swim(15, 56),
      swim(5,  55), swim(2,  56), swim(1,  55),
    ]
    const r = computeSwimSwolfTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.trend).toBe('stable')
  })

  it('declining when last week mean is at least 2 higher than first week mean', () => {
    const log = [
      // First week — lower SWOLF (~50)
      swim(26, 50), swim(24, 51), swim(22, 49),
      // Middle
      swim(15, 55),
      // Last week — higher SWOLF (~62)
      swim(5, 62), swim(2, 63), swim(1, 61),
    ]
    const r = computeSwimSwolfTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.trend).toBe('declining')
  })
})

describe('computeSwimSwolfTrend — shape + sources', () => {
  it('accepts entries with direct swolf field and returns the expected shape', () => {
    const log = [
      swim(20, 58),
      swim(10, 56),
      swim(2,  54),
    ]
    const r = computeSwimSwolfTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.n).toBe(3)
    expect(typeof r.avgSwolf).toBe('number')
    expect(r.avgSwolf).toBeCloseTo(56, 0)
    expect(['ELITE', 'COMPETITIVE', 'TRAINED', 'RECREATIONAL', 'BEGINNER']).toContain(r.band)
    expect(Array.isArray(r.weeklyMeans)).toBe(true)
    expect(r.weeklyMeans).toHaveLength(4)
    expect(r.citation).toBe(SWOLF_TREND_CITATION)
  })

  it('computes SWOLF from strokes + distance + duration + poolLength when direct value missing', () => {
    // 1000m, 25m pool, 60 lengths * 18 strokes = 720 strokes? Let's pick clean numbers.
    // 800m in 25m pool → 32 lengths.
    // strokes = 32 * 20 = 640 → strokes/length = 20
    // duration = 16 min → 16*60 = 960 s → seconds/length = 30
    // SWOLF = 20 + 30 = 50
    const log = [
      swimComputed(20, { strokes: 640, distance: 800, duration: 16, poolLength: 25 }),
      swimComputed(10, { strokes: 640, distance: 800, duration: 16, poolLength: 25 }),
      swimComputed(2,  { strokes: 640, distance: 800, duration: 16, poolLength: 25 }),
    ]
    const r = computeSwimSwolfTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.n).toBe(3)
    expect(r.avgSwolf).toBeCloseTo(50, 1)
    expect(r.band).toBe('COMPETITIVE')
  })

  it('classifies bands correctly for representative averages', () => {
    // Elite ~ 40
    const elite = [swim(20, 40), swim(10, 41), swim(2, 39)]
    expect(computeSwimSwolfTrend({ log: elite, today: TODAY })?.band).toBe('ELITE')
    // Trained ~ 60
    const trained = [swim(20, 60), swim(10, 60), swim(2, 60)]
    expect(computeSwimSwolfTrend({ log: trained, today: TODAY })?.band).toBe('TRAINED')
    // Beginner ~ 90
    const beginner = [swim(20, 90), swim(10, 92), swim(2, 88)]
    expect(computeSwimSwolfTrend({ log: beginner, today: TODAY })?.band).toBe('BEGINNER')
  })

  it('ignores entries with out-of-range SWOLF values', () => {
    const log = [
      swim(20, 55),
      swim(15, 56),
      swim(10, 1000), // out of range → dropped
      swim(5,  10),   // out of range → dropped
      swim(2,  57),
    ]
    const r = computeSwimSwolfTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.n).toBe(3)
  })

  it('recognises sport: "swimming" entries (not just type: "swim")', () => {
    const log = [
      { sport: 'swimming', date: '2026-05-01', swolf: 55 },
      { sport: 'swimming', date: '2026-05-08', swolf: 56 },
      { sport: 'swimming', date: '2026-05-13', swolf: 54 },
    ]
    const r = computeSwimSwolfTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.n).toBe(3)
  })
})
