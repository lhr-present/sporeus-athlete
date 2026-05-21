// ─── highRpeLowTss.test.js — pure-fn coverage ───────────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  analyzeHighRpeLowTss,
  HIGH_RPE_LOW_TSS_CITATION,
} from '../../athlete/highRpeLowTss.js'

const TODAY = '2026-05-19'

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})

afterEach(() => {
  vi.setSystemTime(new Date())
})

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function entry(daysAgo, rpe, tss, extras = {}) {
  return { date: isoMinusDays(TODAY, daysAgo), rpe, tss, ...extras }
}

// Build a clean linear baseline: tss = 10 × rpe (so any recent rpe-r session
// with tss = 10r is a perfect match, deviation 0). We build 24 baseline
// sessions to clear the 20-session floor with margin.
function linearBaseline(startDaysAgo = 100) {
  const out = []
  // 24 baseline sessions, day-spread, rpe cycling 4..8, tss = 10 × rpe
  const rpes = [4, 5, 6, 7, 8]
  for (let i = 0; i < 24; i++) {
    const r = rpes[i % rpes.length]
    out.push(entry(startDaysAgo + i, r, r * 10))
  }
  return out
}

// ─── Null / undefined gates ─────────────────────────────────────────────────
describe('analyzeHighRpeLowTss — null gates', () => {
  it('returns null when today is unresolvable (empty string)', () => {
    expect(analyzeHighRpeLowTss({ log: [], today: '' })).toBe(null)
  })

  it('returns null when today is bad string', () => {
    expect(analyzeHighRpeLowTss({ log: [], today: 'not-a-date' })).toBe(null)
  })

  it('returns null when today is null', () => {
    expect(analyzeHighRpeLowTss({ log: [], today: null })).toBe(null)
  })

  it('returns null when today is an Invalid Date', () => {
    expect(analyzeHighRpeLowTss({ log: [], today: new Date('totally-broken') })).toBe(null)
  })

  it('defaults today to system date when omitted', () => {
    const r = analyzeHighRpeLowTss({ log: [] })
    expect(r).not.toBe(null)
    expect(r.band).toBe('INSUFFICIENT_DATA')
  })
})

// ─── INSUFFICIENT_DATA shape ────────────────────────────────────────────────
describe('analyzeHighRpeLowTss — INSUFFICIENT_DATA', () => {
  it('returns populated INSUFFICIENT_DATA on empty log', () => {
    const r = analyzeHighRpeLowTss({ log: [], today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_DATA')
    expect(r.mismatches).toEqual([])
    expect(r.totalSessionsAnalyzed).toBe(0)
    expect(r.mismatchCount).toBe(0)
    expect(r.mismatchRate).toBe(0)
    expect(r.baselineSessionsUsed).toBe(0)
    expect(r.citation).toBe(HIGH_RPE_LOW_TSS_CITATION)
  })

  it('returns INSUFFICIENT_DATA with 19 baseline sessions (just under threshold)', () => {
    const log = []
    for (let i = 0; i < 19; i++) log.push(entry(100 + i, 5, 50))
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_DATA')
    expect(r.baselineSessionsUsed).toBe(19)
    expect(r.mismatches).toEqual([])
    expect(r.mismatchCount).toBe(0)
  })

  it('returns INSUFFICIENT_DATA when log only has recent sessions, no baseline', () => {
    const log = []
    for (let i = 0; i < 30; i++) log.push(entry(i, 5, 50))
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_DATA')
    expect(r.baselineSessionsUsed).toBe(0)
    // totalSessionsAnalyzed still gets populated for visibility
    expect(r.totalSessionsAnalyzed).toBe(30)
  })

  it('returns INSUFFICIENT_DATA when log is non-array (null)', () => {
    const r = analyzeHighRpeLowTss({ log: null, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_DATA')
    expect(r.totalSessionsAnalyzed).toBe(0)
  })
})

// ─── WELL_MATCHED band ──────────────────────────────────────────────────────
describe('analyzeHighRpeLowTss — WELL_MATCHED', () => {
  it('returns WELL_MATCHED with 0 mismatches when recent sessions follow baseline line', () => {
    const log = [
      ...linearBaseline(100), // 24 sessions
      // Recent sessions also on the line: tss = 10 × rpe → deviation 0
      entry(5, 5, 50),
      entry(10, 6, 60),
      entry(15, 7, 70),
      entry(20, 4, 40),
    ]
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.band).toBe('WELL_MATCHED')
    expect(r.mismatchCount).toBe(0)
    expect(r.mismatchRate).toBe(0)
    expect(r.totalSessionsAnalyzed).toBe(4)
    expect(r.baselineSessionsUsed).toBe(24)
  })

  it('returns WELL_MATCHED when mismatch rate is below 10%', () => {
    const log = [...linearBaseline(100)]
    // 12 matching + 1 mismatch = 1/13 ≈ 7.7% → WELL_MATCHED
    for (let i = 0; i < 12; i++) log.push(entry(i + 1, 5, 50))
    log.push(entry(15, 8, 10)) // RPE 8 expected ~80, got 10 → big mismatch
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.band).toBe('WELL_MATCHED')
    expect(r.mismatchCount).toBe(1)
    expect(r.totalSessionsAnalyzed).toBe(13)
    expect(r.mismatchRate).toBeCloseTo(1 / 13, 4)
  })
})

// ─── OCCASIONAL_MISMATCH band ───────────────────────────────────────────────
describe('analyzeHighRpeLowTss — OCCASIONAL_MISMATCH', () => {
  it('returns OCCASIONAL_MISMATCH for ~15% mismatch rate', () => {
    const log = [...linearBaseline(100)]
    // 8 normal + 2 mismatches = 2/10 = 20% → OCCASIONAL
    for (let i = 0; i < 8; i++) log.push(entry(i + 1, 5, 50))
    log.push(entry(20, 8, 10))
    log.push(entry(25, 7, 5))
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.band).toBe('OCCASIONAL_MISMATCH')
    expect(r.mismatchCount).toBe(2)
    expect(r.mismatchRate).toBeCloseTo(0.2, 4)
  })

  it('lands at OCCASIONAL_MISMATCH exactly at 10% (lower bound inclusive)', () => {
    const log = [...linearBaseline(100)]
    // 1/10 = 0.10 → OCCASIONAL (because <10% is WELL_MATCHED)
    for (let i = 0; i < 9; i++) log.push(entry(i + 1, 5, 50))
    log.push(entry(20, 8, 5))
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.mismatchRate).toBeCloseTo(0.1, 4)
    expect(r.band).toBe('OCCASIONAL_MISMATCH')
  })
})

// ─── PERSISTENT_FATIGUE band ────────────────────────────────────────────────
describe('analyzeHighRpeLowTss — PERSISTENT_FATIGUE', () => {
  it('returns PERSISTENT_FATIGUE for ≥ 25% mismatch rate', () => {
    const log = [...linearBaseline(100)]
    // 6 normal + 4 mismatches = 4/10 = 40% → PERSISTENT
    for (let i = 0; i < 6; i++) log.push(entry(i + 1, 5, 50))
    log.push(entry(20, 8, 5))
    log.push(entry(25, 7, 5))
    log.push(entry(30, 6, 5))
    log.push(entry(35, 8, 10))
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.band).toBe('PERSISTENT_FATIGUE')
    expect(r.mismatchCount).toBe(4)
    expect(r.mismatchRate).toBeCloseTo(0.4, 4)
  })

  it('lands at PERSISTENT_FATIGUE exactly at 25%', () => {
    const log = [...linearBaseline(100)]
    // 3 normal + 1 mismatch = 1/4 = 25% → PERSISTENT
    for (let i = 0; i < 3; i++) log.push(entry(i + 1, 5, 50))
    log.push(entry(20, 8, 5))
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.mismatchRate).toBeCloseTo(0.25, 4)
    expect(r.band).toBe('PERSISTENT_FATIGUE')
  })
})

// ─── Regression sanity ──────────────────────────────────────────────────────
describe('analyzeHighRpeLowTss — regression sanity', () => {
  it('linear baseline + linear recent → 0 mismatches', () => {
    const log = [...linearBaseline(100)]
    // Recent perfectly on the line
    for (let i = 0; i < 10; i++) log.push(entry(i + 1, 5, 50))
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.mismatchCount).toBe(0)
    expect(r.band).toBe('WELL_MATCHED')
  })

  it('high recent TSS for the rpe → no mismatch (athlete crushing it is opposite signal)', () => {
    const log = [...linearBaseline(100)]
    // RPE 5 → expected ~50, athlete logs 80 → deviation negative → not a mismatch
    log.push(entry(5, 5, 80))
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.mismatchCount).toBe(0)
    expect(r.band).toBe('WELL_MATCHED')
  })

  it('zero-variance rpe baseline (flat) still produces predictions (b=0, a=mean)', () => {
    // 24 baseline sessions all at rpe 5, tss varies 40..60
    const log = []
    for (let i = 0; i < 24; i++) {
      const tss = 40 + (i % 21) // tss in [40..60]
      log.push(entry(100 + i, 5, tss))
    }
    // Recent: rpe 5 + tss 20 → expected ~mean baseline (~50) → big deviation
    log.push(entry(5, 5, 20))
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.baselineSessionsUsed).toBe(24)
    expect(r.mismatchCount).toBe(1)
    expect(r.mismatches[0].rpe).toBe(5)
    expect(r.mismatches[0].tss).toBe(20)
  })
})

// ─── Deviation threshold ────────────────────────────────────────────────────
describe('analyzeHighRpeLowTss — deviation threshold', () => {
  it('counts a session with deviation = 0.30 as a mismatch (inclusive)', () => {
    const log = [...linearBaseline(100)]
    // RPE 5 → expected 50. tss = 35 → deviation = (50-35)/50 = 0.30 exactly
    log.push(entry(5, 5, 35))
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.mismatches.length).toBe(1)
    expect(r.mismatches[0].deviation).toBeCloseTo(0.3, 4)
  })

  it('does NOT count a session with deviation = 0.29 as a mismatch', () => {
    const log = [...linearBaseline(100)]
    // RPE 5 → expected 50. tss = 35.5 → deviation = (50-35.5)/50 = 0.29
    log.push(entry(5, 5, 35.5))
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.mismatches.length).toBe(0)
    expect(r.mismatchCount).toBe(0)
  })

  it('does NOT count negative deviation (tss exceeded expectation)', () => {
    const log = [...linearBaseline(100)]
    // RPE 5 → expected 50. tss = 100 → deviation = -1.0
    log.push(entry(5, 5, 100))
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.mismatches.length).toBe(0)
  })

  it('rounds deviation to 4 decimal places', () => {
    const log = [...linearBaseline(100)]
    // Will give a non-trivial deviation; check 4dp
    log.push(entry(5, 5, 23))
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.mismatches.length).toBe(1)
    const d = r.mismatches[0].deviation
    // value should be exactly the 4dp-rounded number
    expect(Math.round(d * 10000)).toBe(d * 10000)
  })
})

// ─── Valid-session filter ───────────────────────────────────────────────────
describe('analyzeHighRpeLowTss — valid-session filter', () => {
  it('skips entries missing rpe', () => {
    const log = [...linearBaseline(100)]
    // 10 valid recent + 1 missing-rpe entry
    for (let i = 0; i < 10; i++) log.push(entry(i + 1, 5, 50))
    log.push({ date: isoMinusDays(TODAY, 5), tss: 50 }) // no rpe
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.totalSessionsAnalyzed).toBe(10)
  })

  it('skips entries missing tss', () => {
    const log = [...linearBaseline(100)]
    for (let i = 0; i < 10; i++) log.push(entry(i + 1, 5, 50))
    log.push({ date: isoMinusDays(TODAY, 5), rpe: 7 }) // no tss
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.totalSessionsAnalyzed).toBe(10)
  })

  it('skips entries with tss = 0', () => {
    const log = [...linearBaseline(100)]
    for (let i = 0; i < 10; i++) log.push(entry(i + 1, 5, 50))
    log.push(entry(5, 7, 0))
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.totalSessionsAnalyzed).toBe(10)
  })

  it('skips entries with negative tss', () => {
    const log = [...linearBaseline(100)]
    for (let i = 0; i < 10; i++) log.push(entry(i + 1, 5, 50))
    log.push(entry(5, 7, -10))
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.totalSessionsAnalyzed).toBe(10)
  })

  it('skips entries with rpe outside [1..10]', () => {
    const log = [...linearBaseline(100)]
    for (let i = 0; i < 10; i++) log.push(entry(i + 1, 5, 50))
    log.push(entry(5, 0, 50)) // rpe 0 → invalid
    log.push(entry(6, 11, 50)) // rpe 11 → invalid
    log.push(entry(7, 10, 50)) // rpe 10 → valid edge
    log.push(entry(8, 1, 50)) // rpe 1 → valid edge
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.totalSessionsAnalyzed).toBe(12) // 10 + 2 valid edge
  })

  it('skips entries with non-numeric rpe / tss', () => {
    const log = [...linearBaseline(100)]
    for (let i = 0; i < 10; i++) log.push(entry(i + 1, 5, 50))
    log.push(entry(5, 'foo', 50))
    log.push(entry(6, 7, 'bar'))
    log.push(entry(7, null, 50))
    log.push(entry(8, 7, null))
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.totalSessionsAnalyzed).toBe(10)
  })

  it('skips entries with missing or bad date', () => {
    const log = [...linearBaseline(100)]
    for (let i = 0; i < 10; i++) log.push(entry(i + 1, 5, 50))
    log.push({ rpe: 7, tss: 30 }) // no date
    log.push({ date: 'bad', rpe: 7, tss: 30 })
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.totalSessionsAnalyzed).toBe(10)
  })

  it('coerces numeric-string rpe and tss via Number()', () => {
    const log = [...linearBaseline(100)]
    log.push({ date: isoMinusDays(TODAY, 5), rpe: '7', tss: '5' })
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    // Expected ~70; tss=5 → big deviation → mismatch
    expect(r.totalSessionsAnalyzed).toBe(1)
    expect(r.mismatchCount).toBe(1)
  })
})

// ─── Custom windowDays / baselineWindowDays ─────────────────────────────────
describe('analyzeHighRpeLowTss — custom windows', () => {
  it('respects custom windowDays (smaller recent window)', () => {
    const log = [...linearBaseline(100)]
    // mismatches at day 5 and day 40
    log.push(entry(5, 8, 5))
    log.push(entry(40, 8, 5))
    // windowDays = 10 → only the day-5 mismatch is "recent"
    const r = analyzeHighRpeLowTss({ log, today: TODAY, windowDays: 10 })
    expect(r.totalSessionsAnalyzed).toBe(1)
    expect(r.mismatchCount).toBe(1)
    expect(r.mismatches[0].date).toBe(isoMinusDays(TODAY, 5))
  })

  it('respects custom baselineWindowDays (smaller baseline → INSUFFICIENT_DATA)', () => {
    const log = [...linearBaseline(100)] // 24 baseline at days 100..123
    // baseline window of 5 days starting at day 90 includes nothing from the
    // baseline pool → 0 baseline
    const r = analyzeHighRpeLowTss({
      log, today: TODAY, windowDays: 90, baselineWindowDays: 5,
    })
    expect(r.band).toBe('INSUFFICIENT_DATA')
  })

  it('respects larger custom baselineWindowDays to pick up sessions further back', () => {
    const log = []
    // baseline sessions WAY back: day 200..223
    for (let i = 0; i < 24; i++) {
      const r = 4 + (i % 5)
      log.push(entry(200 + i, r, r * 10))
    }
    // With default baselineWindowDays=180 these wouldn't be picked up.
    // With baselineWindowDays=300, they will.
    const r = analyzeHighRpeLowTss({
      log, today: TODAY, windowDays: 90, baselineWindowDays: 300,
    })
    expect(r.baselineSessionsUsed).toBe(24)
  })
})

// ─── expectedTss floor ──────────────────────────────────────────────────────
describe('analyzeHighRpeLowTss — expectedTss floor', () => {
  it('clamps expectedTss to at least 1 to avoid divide-by-zero / negatives', () => {
    // Build a baseline where regression line goes negative for low rpe:
    // tss = 30 × rpe - 200 → at rpe 5, expected = -50
    const log = []
    for (let i = 0; i < 24; i++) {
      const r = 7 + (i % 4) // rpe 7..10
      const tss = 30 * r - 200
      log.push(entry(100 + i, r, tss))
    }
    // Recent: rpe = 5 → linear prediction = -50 → expectedTss clamped to 1
    log.push(entry(5, 5, 50))
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.totalSessionsAnalyzed).toBe(1)
    // tss 50, expected 1 → deviation = (1 - 50)/1 = -49 → not a mismatch
    expect(r.mismatchCount).toBe(0)
    expect(r.mismatches.length).toBe(0)
  })
})

// ─── today as Date / string ─────────────────────────────────────────────────
describe('analyzeHighRpeLowTss — today input types', () => {
  it('accepts today as Date object', () => {
    const log = [...linearBaseline(100), entry(5, 5, 50)]
    const r = analyzeHighRpeLowTss({ log, today: new Date(TODAY + 'T12:00:00Z') })
    expect(r).not.toBe(null)
    expect(r.baselineSessionsUsed).toBe(24)
  })

  it('accepts today as string', () => {
    const log = [...linearBaseline(100), entry(5, 5, 50)]
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r).not.toBe(null)
    expect(r.baselineSessionsUsed).toBe(24)
  })

  it('accepts today with timestamp suffix', () => {
    const log = [...linearBaseline(100), entry(5, 5, 50)]
    const r = analyzeHighRpeLowTss({ log, today: TODAY + 'T08:30:00Z' })
    expect(r).not.toBe(null)
    expect(r.baselineSessionsUsed).toBe(24)
  })
})

// ─── Mismatch sort order ────────────────────────────────────────────────────
describe('analyzeHighRpeLowTss — sort order', () => {
  it('returns mismatches sorted oldest-first', () => {
    const log = [...linearBaseline(100)]
    log.push(entry(5, 8, 5))
    log.push(entry(40, 8, 5))
    log.push(entry(20, 8, 5))
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.mismatchCount).toBe(3)
    const dates = r.mismatches.map(m => m.date)
    expect(dates[0]).toBe(isoMinusDays(TODAY, 40))
    expect(dates[1]).toBe(isoMinusDays(TODAY, 20))
    expect(dates[2]).toBe(isoMinusDays(TODAY, 5))
  })
})

// ─── Mismatch shape ─────────────────────────────────────────────────────────
describe('analyzeHighRpeLowTss — mismatch object shape', () => {
  it('each mismatch carries date, rpe, tss, expectedTss, deviation', () => {
    const log = [...linearBaseline(100), entry(5, 5, 10)]
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.mismatchCount).toBe(1)
    const m = r.mismatches[0]
    expect(m).toHaveProperty('date')
    expect(m).toHaveProperty('rpe')
    expect(m).toHaveProperty('tss')
    expect(m).toHaveProperty('expectedTss')
    expect(m).toHaveProperty('deviation')
    expect(m.date).toBe(isoMinusDays(TODAY, 5))
    expect(m.rpe).toBe(5)
    expect(m.tss).toBe(10)
    expect(m.expectedTss).toBeGreaterThan(0)
    expect(m.deviation).toBeGreaterThanOrEqual(0.30)
  })
})

// ─── Citation passthrough ───────────────────────────────────────────────────
describe('analyzeHighRpeLowTss — citation', () => {
  it('exposes the Foster 2017 / Halson 2014 citation on every result', () => {
    const empty = analyzeHighRpeLowTss({ log: [], today: TODAY })
    const populated = analyzeHighRpeLowTss({
      log: [...linearBaseline(100), entry(5, 5, 50)],
      today: TODAY,
    })
    expect(empty.citation).toBe('Foster 2017; Halson 2014')
    expect(populated.citation).toBe('Foster 2017; Halson 2014')
    expect(HIGH_RPE_LOW_TSS_CITATION).toBe('Foster 2017; Halson 2014')
  })
})

// ─── mismatchRate rounding ──────────────────────────────────────────────────
describe('analyzeHighRpeLowTss — mismatchRate rounding', () => {
  it('rounds mismatchRate to 4 decimal places', () => {
    const log = [...linearBaseline(100)]
    // 2 mismatches in 7 recent → 2/7 ≈ 0.285714...
    for (let i = 0; i < 5; i++) log.push(entry(i + 1, 5, 50))
    log.push(entry(10, 8, 5))
    log.push(entry(15, 8, 5))
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.totalSessionsAnalyzed).toBe(7)
    expect(r.mismatchCount).toBe(2)
    // 0.2857 (rounded to 4dp)
    expect(r.mismatchRate).toBe(0.2857)
  })

  it('returns mismatchRate = 0 when no valid recent sessions', () => {
    const log = [...linearBaseline(100)] // baseline only, no recent
    const r = analyzeHighRpeLowTss({ log, today: TODAY })
    expect(r.totalSessionsAnalyzed).toBe(0)
    expect(r.mismatchCount).toBe(0)
    expect(r.mismatchRate).toBe(0)
    expect(r.band).toBe('WELL_MATCHED')
  })
})
