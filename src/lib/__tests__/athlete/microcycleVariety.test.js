// microcycleVariety — pure-fn tests.
//
// Covers: null gate (bad today), INSUFFICIENT_DATA (<4 training weeks),
// MONOTONOUS (mean ≤ 1.5), NARROW (≤ 2.5), BALANCED (≤ 4), WIDE_VARIETY
// (> 4), type normalization (whitespace/case/empty), uniqueTypes
// correctness with duplicates, sorted alphabetically, trendDeltaPerWeek
// positive/negative slope, empty weeks counted as 0 in regression,
// custom windowWeeks, ISO week boundary, today as Date vs string,
// citation export, rounding precision.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  analyzeMicrocycleVariety,
  MICROCYCLE_VARIETY_CITATION,
} from '../../athlete/microcycleVariety.js'

// 2026-05-17 is a Sunday → Monday of that week is 2026-05-11.
// The "current" Mon–Sun week is 2026-05-11..2026-05-17.
const TODAY = '2026-05-17'

// ─── Helpers ────────────────────────────────────────────────────────────────
function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

// Park an entry on the Wednesday of the week `weeksAgo` before TODAY.
function entryInWeek(weeksAgo, type, overrides = {}) {
  const monday = mondayOf(TODAY)
  const weekStart = isoMinusDays(monday, weeksAgo * 7)
  const date = isoMinusDays(weekStart, -2) // Wednesday
  return {
    date,
    type,
    durationMin: 60,
    ...overrides,
  }
}

// Build a log where each week (oldest first) carries a list of session types.
// e.g. buildWeeklyTypes([['easy','intervals'], [], ['easy']]) → 3 weeks.
function buildWeeklyTypes(byWeek) {
  const n = byWeek.length
  const log = []
  for (let i = 0; i < n; i++) {
    const weeksAgo = n - 1 - i
    for (const t of byWeek[i]) {
      log.push(entryInWeek(weeksAgo, t))
    }
  }
  return log
}

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})

afterEach(() => {
  vi.setSystemTime(new Date())
})

// ─── Citation export ────────────────────────────────────────────────────────
describe('analyzeMicrocycleVariety — citation', () => {
  it('exports the canonical Issurin 2010 / Bompa 2018 citation', () => {
    expect(MICROCYCLE_VARIETY_CITATION).toBe('Issurin 2010; Bompa 2018')
  })

  it('returns the same citation string on result objects', () => {
    const r = analyzeMicrocycleVariety({ log: [], today: TODAY })
    expect(r.citation).toBe(MICROCYCLE_VARIETY_CITATION)
  })
})

// ─── Null gate ──────────────────────────────────────────────────────────────
describe('analyzeMicrocycleVariety — null gate', () => {
  it('returns null when today is null', () => {
    expect(analyzeMicrocycleVariety({ log: [], today: null })).toBeNull()
  })

  it('returns null when today is undefined (no args)', () => {
    expect(analyzeMicrocycleVariety()).toBeNull()
  })

  it('returns null when today is an invalid ISO string', () => {
    expect(analyzeMicrocycleVariety({ log: [], today: 'not-a-date' })).toBeNull()
  })

  it('returns null when today is an empty string', () => {
    expect(analyzeMicrocycleVariety({ log: [], today: '' })).toBeNull()
  })

  it('returns null when today is an Invalid Date', () => {
    expect(analyzeMicrocycleVariety({ log: [], today: new Date('xxx') })).toBeNull()
  })

  it('returns null when today is a number', () => {
    expect(analyzeMicrocycleVariety({ log: [], today: 42 })).toBeNull()
  })
})

// ─── INSUFFICIENT_DATA band ────────────────────────────────────────────────
describe('analyzeMicrocycleVariety — INSUFFICIENT_DATA', () => {
  it('returns INSUFFICIENT_DATA on empty log', () => {
    const r = analyzeMicrocycleVariety({ log: [], today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_DATA')
    expect(r.trainingWeekCount).toBe(0)
    expect(r.meanUniqueTypesPerWeek).toBe(0)
    expect(r.weeks).toHaveLength(12)
  })

  it('returns INSUFFICIENT_DATA when fewer than 4 weeks carry sessions', () => {
    // Only 3 of 12 weeks have a session.
    const log = [
      entryInWeek(0, 'easy'),
      entryInWeek(2, 'tempo'),
      entryInWeek(5, 'intervals'),
    ]
    const r = analyzeMicrocycleVariety({ log, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_DATA')
    expect(r.trainingWeekCount).toBe(3)
  })

  it('escapes INSUFFICIENT_DATA at exactly 4 training weeks', () => {
    const log = [
      entryInWeek(0, 'easy'),
      entryInWeek(1, 'easy'),
      entryInWeek(2, 'easy'),
      entryInWeek(3, 'easy'),
    ]
    const r = analyzeMicrocycleVariety({ log, today: TODAY })
    expect(r.band).not.toBe('INSUFFICIENT_DATA')
    expect(r.trainingWeekCount).toBe(4)
  })
})

// ─── MONOTONOUS band ───────────────────────────────────────────────────────
describe('analyzeMicrocycleVariety — MONOTONOUS', () => {
  it('returns MONOTONOUS when every training week has exactly 1 type', () => {
    // 5 weeks each with one "easy" session.
    const log = [0, 1, 2, 3, 4].map(w => entryInWeek(w, 'easy'))
    const r = analyzeMicrocycleVariety({ log, today: TODAY })
    expect(r.band).toBe('MONOTONOUS')
    expect(r.meanUniqueTypesPerWeek).toBe(1)
  })

  it('returns MONOTONOUS at exactly mean = 1.5 (boundary, inclusive)', () => {
    // 4 weeks: [1, 2, 1, 2] uniqueTypes → mean 1.5.
    const log = [
      ...[0].map(w => entryInWeek(w, 'easy')),                    // 1 type
      ...['easy', 'tempo'].map(t => entryInWeek(1, t)),           // 2 types
      ...[2].map(w => entryInWeek(w, 'easy')),                    // 1 type
      ...['easy', 'tempo'].map(t => entryInWeek(3, t)),           // 2 types
    ]
    const r = analyzeMicrocycleVariety({ log, today: TODAY })
    expect(r.meanUniqueTypesPerWeek).toBe(1.5)
    expect(r.band).toBe('MONOTONOUS')
  })
})

// ─── NARROW band ───────────────────────────────────────────────────────────
describe('analyzeMicrocycleVariety — NARROW', () => {
  it('returns NARROW when mean is just above 1.5', () => {
    // 5 weeks: [2, 2, 2, 1, 1] uniqueTypes → mean 1.6.
    const log = [
      ...['easy', 'tempo'].map(t => entryInWeek(0, t)),
      ...['easy', 'tempo'].map(t => entryInWeek(1, t)),
      ...['easy', 'tempo'].map(t => entryInWeek(2, t)),
      entryInWeek(3, 'easy'),
      entryInWeek(4, 'easy'),
    ]
    const r = analyzeMicrocycleVariety({ log, today: TODAY })
    expect(r.meanUniqueTypesPerWeek).toBe(1.6)
    expect(r.band).toBe('NARROW')
  })

  it('returns NARROW at exactly mean = 2.5 (boundary)', () => {
    // 4 weeks: [3, 3, 2, 2] uniqueTypes → mean 2.5.
    const log = [
      ...['easy', 'tempo', 'long'].map(t => entryInWeek(0, t)),
      ...['easy', 'tempo', 'long'].map(t => entryInWeek(1, t)),
      ...['easy', 'tempo'].map(t => entryInWeek(2, t)),
      ...['easy', 'tempo'].map(t => entryInWeek(3, t)),
    ]
    const r = analyzeMicrocycleVariety({ log, today: TODAY })
    expect(r.meanUniqueTypesPerWeek).toBe(2.5)
    expect(r.band).toBe('NARROW')
  })
})

// ─── BALANCED band ─────────────────────────────────────────────────────────
describe('analyzeMicrocycleVariety — BALANCED', () => {
  it('returns BALANCED when mean is just above 2.5', () => {
    // 4 weeks all with 3 types → mean 3.
    const types = ['easy', 'tempo', 'long']
    const log = [0, 1, 2, 3].flatMap(w => types.map(t => entryInWeek(w, t)))
    const r = analyzeMicrocycleVariety({ log, today: TODAY })
    expect(r.meanUniqueTypesPerWeek).toBe(3)
    expect(r.band).toBe('BALANCED')
  })

  it('returns BALANCED at exactly mean = 4 (boundary)', () => {
    const types = ['easy', 'tempo', 'long', 'intervals']
    const log = [0, 1, 2, 3].flatMap(w => types.map(t => entryInWeek(w, t)))
    const r = analyzeMicrocycleVariety({ log, today: TODAY })
    expect(r.meanUniqueTypesPerWeek).toBe(4)
    expect(r.band).toBe('BALANCED')
  })
})

// ─── WIDE_VARIETY band ─────────────────────────────────────────────────────
describe('analyzeMicrocycleVariety — WIDE_VARIETY', () => {
  it('returns WIDE_VARIETY when mean > 4', () => {
    const types = ['easy', 'tempo', 'long', 'intervals', 'strength']
    const log = [0, 1, 2, 3].flatMap(w => types.map(t => entryInWeek(w, t)))
    const r = analyzeMicrocycleVariety({ log, today: TODAY })
    expect(r.meanUniqueTypesPerWeek).toBe(5)
    expect(r.band).toBe('WIDE_VARIETY')
  })
})

// ─── Type normalization ────────────────────────────────────────────────────
describe('analyzeMicrocycleVariety — type normalization', () => {
  it('treats whitespace + case differences as the same type', () => {
    const log = [
      entryInWeek(0, 'Easy'),
      entryInWeek(0, '  easy  '),
      entryInWeek(0, 'EASY'),
      entryInWeek(1, 'easy'),
      entryInWeek(2, 'easy'),
      entryInWeek(3, 'easy'),
    ]
    const r = analyzeMicrocycleVariety({ log, today: TODAY })
    // Week 0 should have 1 unique type, not 3.
    const wk0 = r.weeks[r.weeks.length - 1]
    expect(wk0.uniqueTypes).toBe(1)
    expect(wk0.types).toEqual(['easy'])
    expect(wk0.sessionCount).toBe(3)
  })

  it('skips empty / missing types from the type set but keeps sessionCount', () => {
    const log = [
      entryInWeek(0, ''),                 // empty
      entryInWeek(0, '   '),              // whitespace only
      entryInWeek(0, null),               // null
      entryInWeek(0, undefined),          // undefined
      entryInWeek(0, 'easy'),
      entryInWeek(1, 'easy'),
      entryInWeek(2, 'easy'),
      entryInWeek(3, 'easy'),
    ]
    const r = analyzeMicrocycleVariety({ log, today: TODAY })
    const wk0 = r.weeks[r.weeks.length - 1]
    expect(wk0.uniqueTypes).toBe(1)
    expect(wk0.types).toEqual(['easy'])
    expect(wk0.sessionCount).toBe(5) // sessions logged even if mis-typed
  })

  it('returns types[] sorted alphabetically', () => {
    const log = [
      entryInWeek(0, 'Zen'),
      entryInWeek(0, 'Alpha'),
      entryInWeek(0, 'Middle'),
      entryInWeek(1, 'easy'),
      entryInWeek(2, 'easy'),
      entryInWeek(3, 'easy'),
    ]
    const r = analyzeMicrocycleVariety({ log, today: TODAY })
    const wk0 = r.weeks[r.weeks.length - 1]
    expect(wk0.types).toEqual(['alpha', 'middle', 'zen'])
  })

  it('counts duplicate types only once in uniqueTypes', () => {
    const log = [
      entryInWeek(0, 'easy'),
      entryInWeek(0, 'easy'),
      entryInWeek(0, 'easy'),
      entryInWeek(0, 'tempo'),
      entryInWeek(1, 'easy'),
      entryInWeek(2, 'easy'),
      entryInWeek(3, 'easy'),
    ]
    const r = analyzeMicrocycleVariety({ log, today: TODAY })
    const wk0 = r.weeks[r.weeks.length - 1]
    expect(wk0.uniqueTypes).toBe(2)
    expect(wk0.sessionCount).toBe(4)
    expect(wk0.types).toEqual(['easy', 'tempo'])
  })
})

// ─── meanUniqueTypesPerWeek ────────────────────────────────────────────────
describe('analyzeMicrocycleVariety — meanUniqueTypesPerWeek math', () => {
  it('only averages weeks with sessions (skips empty weeks)', () => {
    // 4 training weeks with 3 uniqueTypes each; 8 empty weeks.
    const types = ['easy', 'tempo', 'long']
    const log = [0, 1, 2, 3].flatMap(w => types.map(t => entryInWeek(w, t)))
    const r = analyzeMicrocycleVariety({ log, today: TODAY })
    expect(r.trainingWeekCount).toBe(4)
    // Empty weeks should not drag the mean down.
    expect(r.meanUniqueTypesPerWeek).toBe(3)
  })

  it('returns 0 mean when trainingWeekCount is 0', () => {
    const r = analyzeMicrocycleVariety({ log: [], today: TODAY })
    expect(r.meanUniqueTypesPerWeek).toBe(0)
  })

  it('rounds meanUniqueTypesPerWeek to 2 decimal places', () => {
    // 4 training weeks: [1, 2, 1, 2] uniqueTypes (already covered) →
    // exercise a non-trivial decimal: 3 weeks [1, 1, 2] would be 1.333…
    // but we need ≥4 training weeks; use [1, 1, 1, 2] → 5/4 = 1.25.
    const log = [
      entryInWeek(0, 'easy'),
      entryInWeek(1, 'easy'),
      entryInWeek(2, 'easy'),
      ...['easy', 'tempo'].map(t => entryInWeek(3, t)),
    ]
    const r = analyzeMicrocycleVariety({ log, today: TODAY })
    expect(r.meanUniqueTypesPerWeek).toBe(1.25)
  })
})

// ─── trendDeltaPerWeek (linear regression) ─────────────────────────────────
describe('analyzeMicrocycleVariety — trendDeltaPerWeek slope', () => {
  it('produces a positive slope when uniqueTypes increases over the window', () => {
    // 12 weeks: 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3 (oldest → newest).
    const byWeek = [
      ['a'], ['a'], ['a'], ['a'],
      ['a', 'b'], ['a', 'b'], ['a', 'b'], ['a', 'b'],
      ['a', 'b', 'c'], ['a', 'b', 'c'], ['a', 'b', 'c'], ['a', 'b', 'c'],
    ]
    const log = buildWeeklyTypes(byWeek)
    const r = analyzeMicrocycleVariety({ log, today: TODAY })
    expect(r.trendDeltaPerWeek).toBeGreaterThan(0)
  })

  it('produces a negative slope when uniqueTypes decreases over the window', () => {
    const byWeek = [
      ['a', 'b', 'c'], ['a', 'b', 'c'], ['a', 'b', 'c'], ['a', 'b', 'c'],
      ['a', 'b'], ['a', 'b'], ['a', 'b'], ['a', 'b'],
      ['a'], ['a'], ['a'], ['a'],
    ]
    const log = buildWeeklyTypes(byWeek)
    const r = analyzeMicrocycleVariety({ log, today: TODAY })
    expect(r.trendDeltaPerWeek).toBeLessThan(0)
  })

  it('produces a slope ~0 when uniqueTypes is constant', () => {
    const byWeek = Array.from({ length: 12 }, () => ['a', 'b'])
    const log = buildWeeklyTypes(byWeek)
    const r = analyzeMicrocycleVariety({ log, today: TODAY })
    expect(Math.abs(r.trendDeltaPerWeek)).toBeLessThan(0.001)
  })

  it('treats empty weeks as 0 in the regression (drags slope downward)', () => {
    // Newest 6 weeks have 2 types; oldest 6 weeks are empty.
    // Y vector: [0,0,0,0,0,0,2,2,2,2,2,2] → strong positive slope.
    const byWeek = [
      [], [], [], [], [], [],
      ['a', 'b'], ['a', 'b'], ['a', 'b'], ['a', 'b'], ['a', 'b'], ['a', 'b'],
    ]
    const log = buildWeeklyTypes(byWeek)
    const r = analyzeMicrocycleVariety({ log, today: TODAY })
    expect(r.trendDeltaPerWeek).toBeGreaterThan(0.1)
    // trainingWeekCount only counts the 6 weeks with sessions.
    expect(r.trainingWeekCount).toBe(6)
    // Mean is computed only across the 6 non-empty weeks (= 2.00).
    expect(r.meanUniqueTypesPerWeek).toBe(2)
  })

  it('returns slope = 0 when safeWindow is 1', () => {
    const log = [entryInWeek(0, 'easy')]
    const r = analyzeMicrocycleVariety({ log, today: TODAY, windowWeeks: 1 })
    expect(r.trendDeltaPerWeek).toBe(0)
  })

  it('rounds trendDeltaPerWeek to 4 decimal places', () => {
    const byWeek = [
      ['a'], ['a'], ['a'], ['a'],
      ['a', 'b'], ['a', 'b'], ['a', 'b'], ['a', 'b'],
      ['a', 'b', 'c'], ['a', 'b', 'c'], ['a', 'b', 'c'], ['a', 'b', 'c'],
    ]
    const log = buildWeeklyTypes(byWeek)
    const r = analyzeMicrocycleVariety({ log, today: TODAY })
    // Value should be a finite number with at most 4 fractional digits.
    const decimals = r.trendDeltaPerWeek.toString().split('.')[1] || ''
    expect(decimals.length).toBeLessThanOrEqual(4)
  })
})

// ─── windowWeeks customisation ─────────────────────────────────────────────
describe('analyzeMicrocycleVariety — custom windowWeeks', () => {
  it('respects a 6-week window', () => {
    const r = analyzeMicrocycleVariety({ log: [], today: TODAY, windowWeeks: 6 })
    expect(r.weeks).toHaveLength(6)
  })

  it('clamps non-positive windowWeeks up to 1', () => {
    const r = analyzeMicrocycleVariety({ log: [], today: TODAY, windowWeeks: 0 })
    expect(r.weeks).toHaveLength(1)
  })

  it('falls back to the default 12 when windowWeeks is NaN', () => {
    const r = analyzeMicrocycleVariety({ log: [], today: TODAY, windowWeeks: NaN })
    expect(r.weeks).toHaveLength(12)
  })

  it('only counts sessions inside the custom window', () => {
    // Session 8 weeks ago should NOT count under a 4-week window.
    const log = [
      entryInWeek(0, 'easy'),
      entryInWeek(1, 'easy'),
      entryInWeek(2, 'easy'),
      entryInWeek(3, 'easy'),
      entryInWeek(8, 'tempo'),
    ]
    const r = analyzeMicrocycleVariety({ log, today: TODAY, windowWeeks: 4 })
    expect(r.trainingWeekCount).toBe(4)
    // No tempo session inside the 4-week window.
    const allTypes = r.weeks.flatMap(w => w.types)
    expect(allTypes).not.toContain('tempo')
  })
})

// ─── ISO week boundaries ───────────────────────────────────────────────────
describe('analyzeMicrocycleVariety — ISO week boundary', () => {
  it('weekStart fields are Mondays', () => {
    const r = analyzeMicrocycleVariety({ log: [], today: TODAY })
    for (const w of r.weeks) {
      const d = new Date(w.weekStart + 'T00:00:00Z')
      expect(d.getUTCDay()).toBe(1) // Monday
    }
  })

  it('newest weekStart is the Monday of the week containing today', () => {
    const r = analyzeMicrocycleVariety({ log: [], today: TODAY })
    expect(r.weeks[r.weeks.length - 1].weekStart).toBe('2026-05-11')
  })

  it('weekStarts are spaced exactly 7 days apart and ordered oldest → newest', () => {
    const r = analyzeMicrocycleVariety({ log: [], today: TODAY })
    for (let i = 1; i < r.weeks.length; i++) {
      const prev = new Date(r.weeks[i - 1].weekStart + 'T00:00:00Z')
      const curr = new Date(r.weeks[i].weekStart + 'T00:00:00Z')
      const diff = (curr - prev) / (24 * 60 * 60 * 1000)
      expect(diff).toBe(7)
    }
  })

  it('counts a Sunday entry as belonging to the same ISO week as the Monday', () => {
    // Monday of current week: 2026-05-11. Sunday: 2026-05-17 (=TODAY).
    const log = [
      { date: '2026-05-17', type: 'easy', durationMin: 60 },
      // …plus enough training weeks to escape INSUFFICIENT_DATA.
      entryInWeek(1, 'easy'),
      entryInWeek(2, 'easy'),
      entryInWeek(3, 'easy'),
    ]
    const r = analyzeMicrocycleVariety({ log, today: TODAY })
    const currentWeek = r.weeks[r.weeks.length - 1]
    expect(currentWeek.weekStart).toBe('2026-05-11')
    expect(currentWeek.sessionCount).toBe(1)
    expect(currentWeek.uniqueTypes).toBe(1)
  })

  it('excludes a session from next week (after today)', () => {
    // 1 day after TODAY → next ISO week.
    const next = '2026-05-18'
    const log = [
      { date: next, type: 'easy', durationMin: 60 },
      entryInWeek(0, 'easy'),
      entryInWeek(1, 'easy'),
      entryInWeek(2, 'easy'),
      entryInWeek(3, 'easy'),
    ]
    const r = analyzeMicrocycleVariety({ log, today: TODAY })
    // The current-week bar should reflect only the entry parked at weeksAgo=0.
    const currentWeek = r.weeks[r.weeks.length - 1]
    expect(currentWeek.sessionCount).toBe(1)
  })
})

// ─── today as Date vs string ───────────────────────────────────────────────
describe('analyzeMicrocycleVariety — today input shapes', () => {
  it('accepts today as an ISO string', () => {
    const r = analyzeMicrocycleVariety({ log: [], today: TODAY })
    expect(r).not.toBeNull()
    expect(r.weeks).toHaveLength(12)
  })

  it('accepts today as a Date object and produces identical weekStarts', () => {
    const a = analyzeMicrocycleVariety({ log: [], today: TODAY })
    const b = analyzeMicrocycleVariety({
      log: [],
      today: new Date(TODAY + 'T12:00:00Z'),
    })
    expect(a.weeks.map(w => w.weekStart)).toEqual(b.weeks.map(w => w.weekStart))
  })

  it('accepts a longer ISO timestamp string by slicing to YYYY-MM-DD', () => {
    const r = analyzeMicrocycleVariety({
      log: [],
      today: TODAY + 'T18:00:00.000Z',
    })
    expect(r).not.toBeNull()
    expect(r.weeks[r.weeks.length - 1].weekStart).toBe('2026-05-11')
  })
})

// ─── Bad log inputs ────────────────────────────────────────────────────────
describe('analyzeMicrocycleVariety — bad log inputs', () => {
  it('treats non-array log as empty (no throw)', () => {
    const r = analyzeMicrocycleVariety({ log: null, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.trainingWeekCount).toBe(0)
  })

  it('skips entries without a date field', () => {
    const log = [
      { type: 'easy', durationMin: 60 },           // missing date
      { date: null, type: 'easy' },                // null date
      { date: 'bad-format', type: 'easy' },        // unparseable
      entryInWeek(0, 'easy'),
      entryInWeek(1, 'easy'),
      entryInWeek(2, 'easy'),
      entryInWeek(3, 'easy'),
    ]
    const r = analyzeMicrocycleVariety({ log, today: TODAY })
    expect(r.trainingWeekCount).toBe(4)
  })

  it('skips entries strictly older than the window', () => {
    const log = [
      entryInWeek(20, 'easy'), // far outside
      entryInWeek(0, 'easy'),
      entryInWeek(1, 'easy'),
      entryInWeek(2, 'easy'),
      entryInWeek(3, 'easy'),
    ]
    const r = analyzeMicrocycleVariety({ log, today: TODAY })
    expect(r.trainingWeekCount).toBe(4)
  })
})
