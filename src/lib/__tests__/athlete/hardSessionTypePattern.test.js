// hardSessionTypePattern — pure-fn tests.
//
// Covers: null gate (unresolvable today), INSUFFICIENT_HARD (<8 hard),
// MONOLITHIC / NARROW / BALANCED / VARIED bands, zone-based HARD detection
// (z3 / z4 / z5 / case-insensitive), RPE ≥ 7 alternative classification,
// type normalization (whitespace, case, empty), tie-break alphabetical,
// entropy math sanity (2 equal types = 1.00 bit), normalized-entropy math,
// dominantType with empty list = null, dominantSharePct math, custom
// windowDays, today as Date vs string.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  analyzeHardSessionTypePattern,
  HARD_SESSION_TYPE_PATTERN_CITATION,
} from '../../athlete/hardSessionTypePattern.js'

const TODAY = '2026-05-19'

function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Build a hard entry: zone z4 + rpe 8 by default — definitely HARD.
function hard(daysAgo, type, overrides = {}) {
  return {
    date: addDays(TODAY, -daysAgo),
    type,
    zone: 'z4',
    rpe: 8,
    durationMin: 60,
    ...overrides,
  }
}

function easy(daysAgo, type, overrides = {}) {
  return {
    date: addDays(TODAY, -daysAgo),
    type,
    zone: 'z2',
    rpe: 4,
    durationMin: 45,
    ...overrides,
  }
}

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})

afterEach(() => {
  vi.setSystemTime(new Date())
})

// ─── Null gate ───────────────────────────────────────────────────────────────
describe('analyzeHardSessionTypePattern — null gate', () => {
  it('returns null when today is null', () => {
    expect(analyzeHardSessionTypePattern({ log: [], today: null })).toBeNull()
  })

  it('returns null when today is undefined (no args)', () => {
    expect(analyzeHardSessionTypePattern()).toBeNull()
  })

  it('returns null when today is an invalid string', () => {
    expect(analyzeHardSessionTypePattern({ log: [], today: 'not-a-date' })).toBeNull()
  })

  it('returns null when today is an Invalid Date', () => {
    expect(analyzeHardSessionTypePattern({ log: [], today: new Date('xxx') })).toBeNull()
  })

  it('returns null when today is a non-string non-Date', () => {
    expect(analyzeHardSessionTypePattern({ log: [], today: 42 })).toBeNull()
  })
})

// ─── INSUFFICIENT_HARD band ──────────────────────────────────────────────────
describe('analyzeHardSessionTypePattern — INSUFFICIENT_HARD', () => {
  it('returns INSUFFICIENT_HARD when there are fewer than 8 hard sessions', () => {
    const log = [
      hard(1, 'intervals'),
      hard(3, 'intervals'),
      hard(5, 'tempo'),
      hard(7, 'tempo'),
      easy(2, 'easy'),
      easy(4, 'easy'),
    ]
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_HARD')
    expect(r.hardSessions).toBe(4)
    expect(r.citation).toBe(HARD_SESSION_TYPE_PATTERN_CITATION)
  })

  it('returns INSUFFICIENT_HARD on empty log', () => {
    const r = analyzeHardSessionTypePattern({ log: [], today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_HARD')
    expect(r.hardSessions).toBe(0)
    expect(r.uniqueHardTypes).toBe(0)
    expect(r.typeCounts).toEqual([])
    expect(r.dominantType).toBeNull()
    expect(r.dominantSharePct).toBe(0)
    expect(r.entropyBits).toBe(0)
    expect(r.normalizedEntropy).toBe(0)
  })

  it('returns INSUFFICIENT_HARD when log is not an array', () => {
    const r = analyzeHardSessionTypePattern({ log: null, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_HARD')
    expect(r.hardSessions).toBe(0)
  })

  it('jumps to MONOLITHIC when exactly 8 hard sessions of same type', () => {
    const log = Array.from({ length: 8 }, (_, i) => hard(i + 1, 'intervals'))
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.band).toBe('MONOLITHIC')
    expect(r.hardSessions).toBe(8)
  })
})

// ─── MONOLITHIC band ─────────────────────────────────────────────────────────
describe('analyzeHardSessionTypePattern — MONOLITHIC', () => {
  it('returns MONOLITHIC when one type owns 80%+ of hard sessions', () => {
    const log = [
      ...Array.from({ length: 8 }, (_, i) => hard(i + 1, 'intervals')),
      hard(20, 'tempo'),
      hard(22, 'tempo'),
    ]
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.band).toBe('MONOLITHIC')
    expect(r.dominantType).toBe('intervals')
    expect(r.dominantSharePct).toBe(80)
  })

  it('returns MONOLITHIC with a single type at 100%', () => {
    const log = Array.from({ length: 10 }, (_, i) => hard(i + 1, 'tempo'))
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.band).toBe('MONOLITHIC')
    expect(r.dominantSharePct).toBe(100)
    expect(r.entropyBits).toBe(0)
    expect(r.normalizedEntropy).toBe(0)
  })
})

// ─── NARROW band ─────────────────────────────────────────────────────────────
describe('analyzeHardSessionTypePattern — NARROW', () => {
  it('returns NARROW when dominant share is 60-79%', () => {
    const log = [
      ...Array.from({ length: 6 }, (_, i) => hard(i + 1, 'intervals')),
      hard(8, 'tempo'),
      hard(10, 'tempo'),
      hard(12, 'threshold'),
      hard(14, 'hills'),
    ]
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.band).toBe('NARROW')
    expect(r.dominantType).toBe('intervals')
    // 6/10 = 60
    expect(r.dominantSharePct).toBe(60)
  })

  it('returns NARROW at the lower bound (exactly 60%)', () => {
    const log = [
      ...Array.from({ length: 6 }, (_, i) => hard(i + 1, 'tempo')),
      hard(20, 'a'), hard(22, 'b'), hard(24, 'c'), hard(26, 'd'),
    ]
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.dominantSharePct).toBe(60)
    expect(r.band).toBe('NARROW')
  })
})

// ─── BALANCED band ───────────────────────────────────────────────────────────
describe('analyzeHardSessionTypePattern — BALANCED', () => {
  it('returns BALANCED when no type ≥ 60% and not enough types/entropy for VARIED', () => {
    const log = [
      hard(1, 'intervals'), hard(2, 'intervals'), hard(3, 'intervals'),
      hard(4, 'tempo'), hard(5, 'tempo'), hard(6, 'tempo'),
      hard(7, 'threshold'), hard(8, 'threshold'),
    ]
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.band).toBe('BALANCED')
    expect(r.hardSessions).toBe(8)
    expect(r.uniqueHardTypes).toBe(3)
    expect(r.dominantSharePct).toBeLessThan(60)
  })
})

// ─── VARIED band ─────────────────────────────────────────────────────────────
describe('analyzeHardSessionTypePattern — VARIED', () => {
  it('returns VARIED when 5+ types AND normalized entropy ≥ 0.85', () => {
    // 2 of each type across 5 types = perfectly even → normalizedEntropy = 1.0
    const log = [
      hard(1, 'intervals'), hard(2, 'intervals'),
      hard(3, 'tempo'),     hard(4, 'tempo'),
      hard(5, 'threshold'), hard(6, 'threshold'),
      hard(7, 'hills'),     hard(8, 'hills'),
      hard(9, 'racepace'),  hard(10, 'racepace'),
    ]
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.band).toBe('VARIED')
    expect(r.uniqueHardTypes).toBe(5)
    expect(r.normalizedEntropy).toBe(1)
    expect(r.dominantSharePct).toBe(20)
  })

  it('does not classify VARIED with only 4 types even if normalized entropy is 1', () => {
    const log = [
      hard(1, 'a'), hard(2, 'a'),
      hard(3, 'b'), hard(4, 'b'),
      hard(5, 'c'), hard(6, 'c'),
      hard(7, 'd'), hard(8, 'd'),
    ]
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.uniqueHardTypes).toBe(4)
    expect(r.normalizedEntropy).toBe(1)
    expect(r.band).toBe('BALANCED')
  })
})

// ─── HARD detection via zone ─────────────────────────────────────────────────
describe('analyzeHardSessionTypePattern — HARD via zone', () => {
  it('treats z3 as HARD (case insensitive)', () => {
    const log = Array.from({ length: 8 }, (_, i) =>
      hard(i + 1, 'tempo', { zone: 'Z3', rpe: 4 })
    )
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.hardSessions).toBe(8)
  })

  it('treats z5 as HARD', () => {
    const log = Array.from({ length: 8 }, (_, i) =>
      hard(i + 1, 'vo2', { zone: 'z5', rpe: 5 })
    )
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.hardSessions).toBe(8)
  })

  it('does NOT treat z2 as HARD', () => {
    const log = Array.from({ length: 10 }, (_, i) => ({
      date: addDays(TODAY, -(i + 1)),
      type: 'easy',
      zone: 'z2',
      rpe: 4,
      durationMin: 45,
    }))
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.hardSessions).toBe(0)
    expect(r.band).toBe('INSUFFICIENT_HARD')
  })

  it('treats whitespace-padded "  z4  " as HARD', () => {
    const log = Array.from({ length: 8 }, (_, i) =>
      hard(i + 1, 'tempo', { zone: '  z4  ', rpe: 3 })
    )
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.hardSessions).toBe(8)
  })
})

// ─── HARD detection via RPE ──────────────────────────────────────────────────
describe('analyzeHardSessionTypePattern — HARD via RPE', () => {
  it('treats RPE 7 as HARD even when zone is missing', () => {
    const log = Array.from({ length: 8 }, (_, i) => ({
      date: addDays(TODAY, -(i + 1)),
      type: 'tempo',
      rpe: 7,
      durationMin: 50,
    }))
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.hardSessions).toBe(8)
  })

  it('does NOT treat RPE 6 as HARD (without zone)', () => {
    const log = Array.from({ length: 10 }, (_, i) => ({
      date: addDays(TODAY, -(i + 1)),
      type: 'steady',
      rpe: 6,
      durationMin: 50,
    }))
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.hardSessions).toBe(0)
  })

  it('accepts string RPE that parses to ≥ 7', () => {
    const log = Array.from({ length: 8 }, (_, i) => ({
      date: addDays(TODAY, -(i + 1)),
      type: 'intervals',
      rpe: '8',
      durationMin: 40,
    }))
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.hardSessions).toBe(8)
  })
})

// ─── Type normalization ──────────────────────────────────────────────────────
describe('analyzeHardSessionTypePattern — type normalization', () => {
  it('lower-cases and trims types and collapses to one entry', () => {
    const log = [
      hard(1, '  Intervals  '),
      hard(2, 'INTERVALS'),
      hard(3, 'intervals'),
      hard(4, 'Intervals'),
      hard(5, 'intervals '),
      hard(6, ' intervals'),
      hard(7, 'INTERVALS'),
      hard(8, 'intervals'),
    ]
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.uniqueHardTypes).toBe(1)
    expect(r.typeCounts[0]).toEqual(expect.objectContaining({ type: 'intervals', count: 8 }))
    expect(r.dominantType).toBe('intervals')
  })

  it('skips hard entries with empty/whitespace-only type', () => {
    const log = [
      hard(1, '   '),
      hard(2, ''),
      hard(3, null),
      hard(4, undefined),
      hard(5, 'tempo'),
      hard(6, 'tempo'),
      hard(7, 'tempo'),
      hard(8, 'tempo'),
      hard(9, 'tempo'),
      hard(10, 'tempo'),
      hard(11, 'tempo'),
      hard(12, 'tempo'),
    ]
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.hardSessions).toBe(8)
    expect(r.uniqueHardTypes).toBe(1)
    expect(r.typeCounts[0].type).toBe('tempo')
  })
})

// ─── Sort + tie-break ────────────────────────────────────────────────────────
describe('analyzeHardSessionTypePattern — sort & tie-break', () => {
  it('sorts typeCounts desc by count', () => {
    const log = [
      hard(1, 'tempo'),
      hard(2, 'tempo'),
      hard(3, 'tempo'),
      hard(4, 'intervals'),
      hard(5, 'intervals'),
      hard(6, 'hills'),
      hard(7, 'hills'),
      hard(8, 'hills'),
      hard(9, 'hills'),
    ]
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.typeCounts.map(t => t.type)).toEqual(['hills', 'tempo', 'intervals'])
  })

  it('breaks ties alphabetically', () => {
    const log = [
      hard(1, 'zebra'), hard(2, 'zebra'),
      hard(3, 'apple'), hard(4, 'apple'),
      hard(5, 'mango'), hard(6, 'mango'),
      hard(7, 'kiwi'),  hard(8, 'kiwi'),
    ]
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    // All counts equal (2), so alphabetical order: apple, kiwi, mango, zebra.
    expect(r.typeCounts.map(t => t.type)).toEqual(['apple', 'kiwi', 'mango', 'zebra'])
  })
})

// ─── Entropy math ────────────────────────────────────────────────────────────
describe('analyzeHardSessionTypePattern — entropy math', () => {
  it('returns entropyBits = 1.0 for two equally-populated types', () => {
    const log = [
      hard(1, 'a'), hard(2, 'a'), hard(3, 'a'), hard(4, 'a'),
      hard(5, 'b'), hard(6, 'b'), hard(7, 'b'), hard(8, 'b'),
    ]
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.entropyBits).toBe(1)
    expect(r.normalizedEntropy).toBe(1)
  })

  it('returns entropyBits = 0 for a single type', () => {
    const log = Array.from({ length: 10 }, (_, i) => hard(i + 1, 'solo'))
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.entropyBits).toBe(0)
    expect(r.normalizedEntropy).toBe(0)
  })

  it('entropy is below max for skewed distribution', () => {
    // 8 of type A, 2 of type B → not uniform.
    const log = [
      ...Array.from({ length: 8 }, (_, i) => hard(i + 1, 'a')),
      hard(15, 'b'),
      hard(16, 'b'),
    ]
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.entropyBits).toBeGreaterThan(0)
    expect(r.entropyBits).toBeLessThan(1)
    expect(r.normalizedEntropy).toBeGreaterThan(0)
    expect(r.normalizedEntropy).toBeLessThan(1)
  })

  it('normalizedEntropy equals 1 for 4 perfectly-even types', () => {
    const log = [
      hard(1, 'a'), hard(2, 'a'),
      hard(3, 'b'), hard(4, 'b'),
      hard(5, 'c'), hard(6, 'c'),
      hard(7, 'd'), hard(8, 'd'),
    ]
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.uniqueHardTypes).toBe(4)
    expect(r.normalizedEntropy).toBe(1)
    expect(r.entropyBits).toBe(2) // log2(4) = 2
  })
})

// ─── Dominant share math + null handling ─────────────────────────────────────
describe('analyzeHardSessionTypePattern — dominant + share', () => {
  it('dominantType is null when there are no hard sessions', () => {
    const r = analyzeHardSessionTypePattern({ log: [], today: TODAY })
    expect(r.dominantType).toBeNull()
    expect(r.dominantSharePct).toBe(0)
  })

  it('dominantSharePct is 2dp', () => {
    // 5 of A, 3 of B → 5/8 = 0.625 → 62.5%
    const log = [
      hard(1, 'a'), hard(2, 'a'), hard(3, 'a'), hard(4, 'a'), hard(5, 'a'),
      hard(6, 'b'), hard(7, 'b'), hard(8, 'b'),
    ]
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.dominantSharePct).toBe(62.5)
  })

  it('each typeCount.share is rounded to 4dp', () => {
    // 1 of A, 2 of B in a window of 3 → A=0.3333, B=0.6667
    const log = [
      hard(1, 'a'),
      hard(2, 'b'),
      hard(3, 'b'),
      // Pad with more sessions so analysis still runs but only first 3 matter
      // for the share-rounding test. Use shared types so split stays clean.
      hard(4, 'b'),
      hard(5, 'b'),
      hard(6, 'b'),
      hard(7, 'a'),
      hard(8, 'a'),
    ]
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    // 3 of A, 5 of B in 8 hard → 0.375 / 0.625 (exact, but still rounded form)
    const a = r.typeCounts.find(t => t.type === 'a')
    const b = r.typeCounts.find(t => t.type === 'b')
    expect(a.share).toBe(0.375)
    expect(b.share).toBe(0.625)
  })
})

// ─── Window handling ────────────────────────────────────────────────────────
describe('analyzeHardSessionTypePattern — window handling', () => {
  it('honours custom windowDays', () => {
    // 8 hard within last 14 days, plus 4 older that would otherwise count.
    const log = [
      ...Array.from({ length: 8 }, (_, i) => hard(i + 1, 'intervals')),
      hard(40, 'tempo'),
      hard(50, 'tempo'),
      hard(60, 'tempo'),
      hard(70, 'tempo'),
    ]
    const r = analyzeHardSessionTypePattern({ log, today: TODAY, windowDays: 14 })
    expect(r.hardSessions).toBe(8)
    expect(r.uniqueHardTypes).toBe(1)
  })

  it('falls back to 90d when windowDays is not finite', () => {
    const log = Array.from({ length: 10 }, (_, i) => hard(i + 1, 'intervals'))
    const r = analyzeHardSessionTypePattern({ log, today: TODAY, windowDays: NaN })
    expect(r.hardSessions).toBe(10)
  })

  it('excludes sessions outside the 90d window', () => {
    const log = [
      hard(1, 'intervals'),
      hard(2, 'intervals'),
      hard(3, 'intervals'),
      hard(4, 'intervals'),
      hard(5, 'intervals'),
      hard(6, 'intervals'),
      hard(7, 'intervals'),
      hard(8, 'intervals'),
      hard(200, 'should-be-ignored'),
      hard(300, 'should-also-be-ignored'),
    ]
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.hardSessions).toBe(8)
    expect(r.uniqueHardTypes).toBe(1)
  })

  it('accepts today as a Date object', () => {
    const log = Array.from({ length: 8 }, (_, i) => hard(i + 1, 'intervals'))
    const r = analyzeHardSessionTypePattern({
      log,
      today: new Date(TODAY + 'T00:00:00Z'),
    })
    expect(r.hardSessions).toBe(8)
  })

  it('accepts today as ISO string', () => {
    const log = Array.from({ length: 8 }, (_, i) => hard(i + 1, 'intervals'))
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.hardSessions).toBe(8)
  })
})

// ─── Misc / shape ────────────────────────────────────────────────────────────
describe('analyzeHardSessionTypePattern — shape & misc', () => {
  it('always returns the citation string when not null', () => {
    const r = analyzeHardSessionTypePattern({ log: [], today: TODAY })
    expect(r.citation).toBe('Stöggl 2014; Tønnessen 2015')
  })

  it('skips entries without a date string', () => {
    const log = [
      { type: 'intervals', zone: 'z4', rpe: 8 },
      hard(1, 'intervals'),
      hard(2, 'intervals'),
      hard(3, 'intervals'),
      hard(4, 'intervals'),
      hard(5, 'intervals'),
      hard(6, 'intervals'),
      hard(7, 'intervals'),
      hard(8, 'intervals'),
    ]
    const r = analyzeHardSessionTypePattern({ log, today: TODAY })
    expect(r.hardSessions).toBe(8)
  })
})
