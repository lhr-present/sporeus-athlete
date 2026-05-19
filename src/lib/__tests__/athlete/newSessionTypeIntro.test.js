// ─── newSessionTypeIntro.test.js — analyzeNewSessionTypeIntro unit tests ────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  analyzeNewSessionTypeIntro,
  NEW_SESSION_TYPE_INTRO_CITATION,
} from '../../athlete/newSessionTypeIntro.js'

const TODAY = '2026-05-19'

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})
afterEach(() => {
  vi.setSystemTime(new Date())
})

// ─── Date helpers (UTC) ─────────────────────────────────────────────────────
function addDaysIso(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function makeEntry(daysAgo, type) {
  return { date: addDaysIso(TODAY, -daysAgo), type }
}

/**
 * Build N baseline sessions in [today-103..today-14] (default 90d).
 * Skip recent window entirely.
 */
function baselineSessions(types, today = TODAY, recentDays = 14, baselineDays = 90) {
  const log = []
  const baselineEnd = addDaysIso(today, -recentDays)
  for (let i = 0; i < types.length; i++) {
    // Spread them across baseline window
    const offset = recentDays + (i % baselineDays)
    log.push({ date: addDaysIso(today, -offset), type: types[i] })
    // Touch baselineEnd to silence "unused" warnings
    if (!baselineEnd) throw new Error('bad config')
  }
  return log
}

// ─── Null / coverage gating ─────────────────────────────────────────────────
describe('analyzeNewSessionTypeIntro — null gating', () => {
  it('returns null when log is null', () => {
    expect(analyzeNewSessionTypeIntro({ log: null, today: TODAY })).toBeNull()
  })

  it('returns null when log is empty array', () => {
    expect(analyzeNewSessionTypeIntro({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null when log is not an array', () => {
    expect(analyzeNewSessionTypeIntro({ log: 'nope', today: TODAY })).toBeNull()
  })

  it('returns null when baseline has fewer than 10 sessions', () => {
    const log = []
    // Only 9 baseline sessions
    for (let i = 0; i < 9; i++) log.push(makeEntry(20 + i, 'easy run'))
    // 3 recent sessions of a "new" type
    log.push(makeEntry(2, 'hill repeats'))
    log.push(makeEntry(5, 'hill repeats'))
    expect(analyzeNewSessionTypeIntro({ log, today: TODAY })).toBeNull()
  })

  it('returns a result once baseline reaches 10 sessions', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(20 + i, 'easy run'))
    log.push(makeEntry(3, 'hill repeats'))
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('SINGLE_NOVEL')
  })

  it('returns null when recentDays is invalid', () => {
    const log = baselineSessions(['easy run', 'easy run', 'easy run', 'easy run', 'easy run', 'easy run', 'easy run', 'easy run', 'easy run', 'easy run'])
    expect(analyzeNewSessionTypeIntro({ log, today: TODAY, recentDays: 0 })).toBeNull()
    expect(analyzeNewSessionTypeIntro({ log, today: TODAY, recentDays: NaN })).toBeNull()
  })

  it('returns null when baselineDays is invalid', () => {
    const log = baselineSessions(Array(10).fill('easy run'))
    expect(analyzeNewSessionTypeIntro({ log, today: TODAY, baselineDays: 0 })).toBeNull()
    expect(analyzeNewSessionTypeIntro({ log, today: TODAY, baselineDays: -5 })).toBeNull()
  })
})

// ─── NO_NOVEL band ──────────────────────────────────────────────────────────
describe('analyzeNewSessionTypeIntro — NO_NOVEL', () => {
  it('returns NO_NOVEL when every recent type appears in baseline', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    log.push(makeEntry(3, 'easy run'))
    log.push(makeEntry(7, 'easy run'))
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY })
    expect(r.band).toBe('NO_NOVEL')
    expect(r.novelTypes).toEqual([])
  })

  it('returns NO_NOVEL when recent window has no sessions at all', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY })
    expect(r.band).toBe('NO_NOVEL')
    expect(r.recentTypesTotal).toBe(0)
    expect(r.baselineTypesTotal).toBe(1)
  })
})

// ─── SINGLE_NOVEL band ──────────────────────────────────────────────────────
describe('analyzeNewSessionTypeIntro — SINGLE_NOVEL', () => {
  it('flags exactly one novel type', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    log.push(makeEntry(3, 'hill repeats'))
    log.push(makeEntry(7, 'easy run'))
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY })
    expect(r.band).toBe('SINGLE_NOVEL')
    expect(r.novelTypes).toHaveLength(1)
    expect(r.novelTypes[0].type).toBe('hill repeats')
    expect(r.novelTypes[0].countInRecent).toBe(1)
  })

  it('countInRecent counts multiple occurrences of a single novel type', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    log.push(makeEntry(2, 'hill repeats'))
    log.push(makeEntry(5, 'hill repeats'))
    log.push(makeEntry(9, 'hill repeats'))
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY })
    expect(r.band).toBe('SINGLE_NOVEL')
    expect(r.novelTypes[0].countInRecent).toBe(3)
  })
})

// ─── MULTIPLE_NOVEL band ────────────────────────────────────────────────────
describe('analyzeNewSessionTypeIntro — MULTIPLE_NOVEL', () => {
  it('flags 2+ novel types', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    log.push(makeEntry(2, 'hill repeats'))
    log.push(makeEntry(5, 'strength'))
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY })
    expect(r.band).toBe('MULTIPLE_NOVEL')
    expect(r.novelTypes).toHaveLength(2)
  })

  it('sorts novel types alphabetically', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    log.push(makeEntry(2, 'plyometrics'))
    log.push(makeEntry(3, 'hill repeats'))
    log.push(makeEntry(4, 'strength'))
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY })
    expect(r.novelTypes.map((n) => n.type)).toEqual([
      'hill repeats',
      'plyometrics',
      'strength',
    ])
  })
})

// ─── Type normalization ────────────────────────────────────────────────────
describe('analyzeNewSessionTypeIntro — type normalization', () => {
  it('normalizes whitespace + casing when matching baseline', () => {
    const log = baselineSessions(Array(12).fill('Easy Run'))
    // recent type with different casing/whitespace should be considered same
    log.push({ date: addDaysIso(TODAY, -3), type: '  EASY RUN  ' })
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY })
    expect(r.band).toBe('NO_NOVEL')
  })

  it('lowercases novel type names in output', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    log.push({ date: addDaysIso(TODAY, -3), type: 'Hill Repeats' })
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY })
    expect(r.novelTypes[0].type).toBe('hill repeats')
  })

  it('skips entries with empty string types', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    log.push({ date: addDaysIso(TODAY, -3), type: '   ' })
    log.push({ date: addDaysIso(TODAY, -5), type: '' })
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY })
    expect(r.band).toBe('NO_NOVEL')
  })

  it('skips entries with non-string types', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    log.push({ date: addDaysIso(TODAY, -3), type: null })
    log.push({ date: addDaysIso(TODAY, -5), type: 42 })
    log.push({ date: addDaysIso(TODAY, -7), type: { foo: 'bar' } })
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY })
    expect(r.band).toBe('NO_NOVEL')
  })
})

// ─── daysSinceFirst math ───────────────────────────────────────────────────
describe('analyzeNewSessionTypeIntro — daysSinceFirst', () => {
  it('uses earliest occurrence as firstSeen', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    log.push(makeEntry(2, 'hill repeats'))
    log.push(makeEntry(9, 'hill repeats'))
    log.push(makeEntry(5, 'hill repeats'))
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY })
    expect(r.novelTypes[0].firstSeen).toBe(addDaysIso(TODAY, -9))
    expect(r.novelTypes[0].daysSinceFirst).toBe(9)
  })

  it('daysSinceFirst is 0 when type was first introduced today', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    log.push(makeEntry(0, 'plyometrics'))
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY })
    expect(r.novelTypes[0].daysSinceFirst).toBe(0)
    expect(r.novelTypes[0].firstSeen).toBe(TODAY)
  })

  it('daysSinceFirst sits within recentDays-1 upper bound', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    log.push(makeEntry(13, 'plyometrics'))
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY })
    expect(r.novelTypes[0].daysSinceFirst).toBe(13)
  })
})

// ─── recentDays / baselineDays overrides ────────────────────────────────────
describe('analyzeNewSessionTypeIntro — window overrides', () => {
  it('respects shorter recentDays override', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    log.push(makeEntry(10, 'hill repeats')) // outside a 7d recent window
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY, recentDays: 7 })
    expect(r.band).toBe('NO_NOVEL')
  })

  it('respects longer recentDays override', () => {
    const log = baselineSessions(Array(12).fill('easy run'), TODAY, 21, 90)
    log.push(makeEntry(18, 'hill repeats')) // outside a 14d recent window, inside 21d
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY, recentDays: 21 })
    expect(r.band).toBe('SINGLE_NOVEL')
    expect(r.novelTypes[0].daysSinceFirst).toBe(18)
  })

  it('respects shorter baselineDays override', () => {
    const log = []
    // 10 baseline sessions but they all fall outside a 30d baseline window
    for (let i = 0; i < 10; i++) {
      log.push(makeEntry(60 + i, 'easy run'))
    }
    log.push(makeEntry(3, 'easy run'))
    // With baselineDays=30: baseline window is [today-43..today-14] which has 0 sessions → null
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY, baselineDays: 30 })
    expect(r).toBeNull()
  })
})

// ─── Boundary handling ─────────────────────────────────────────────────────
describe('analyzeNewSessionTypeIntro — date boundaries', () => {
  it('includes recent-window start date as recent (inclusive)', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    // Day -13 (today - 13) is the recentStart for recentDays=14
    log.push(makeEntry(13, 'plyometrics'))
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY })
    expect(r.band).toBe('SINGLE_NOVEL')
  })

  it('treats day exactly = -recentDays as baseline (not recent)', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    // Day -14 — at the boundary, in baseline, not recent
    log.push({ date: addDaysIso(TODAY, -14), type: 'plyometrics' })
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY })
    // plyometrics is now part of baseline → NO_NOVEL
    expect(r.band).toBe('NO_NOVEL')
  })

  it('today-dated entries count in the recent window', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    log.push(makeEntry(0, 'hill repeats'))
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY })
    expect(r.band).toBe('SINGLE_NOVEL')
    expect(r.novelTypes[0].firstSeen).toBe(TODAY)
  })

  it('skips entries with invalid date strings', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    log.push({ date: 'not-a-date', type: 'plyometrics' })
    log.push({ date: '2026', type: 'plyometrics' })
    log.push({ date: null, type: 'plyometrics' })
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY })
    expect(r.band).toBe('NO_NOVEL')
  })

  it('handles ISO date with time component (slices to YYYY-MM-DD)', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    log.push({ date: addDaysIso(TODAY, -3) + 'T14:23:00Z', type: 'plyometrics' })
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY })
    expect(r.band).toBe('SINGLE_NOVEL')
    expect(r.novelTypes[0].firstSeen).toBe(addDaysIso(TODAY, -3))
  })
})

// ─── today input shapes ─────────────────────────────────────────────────────
describe('analyzeNewSessionTypeIntro — today input', () => {
  it('accepts Date object as today', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    log.push(makeEntry(3, 'plyometrics'))
    const r = analyzeNewSessionTypeIntro({ log, today: new Date(TODAY + 'T00:00:00Z') })
    expect(r.band).toBe('SINGLE_NOVEL')
  })

  it('defaults to system today when not provided', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    log.push(makeEntry(3, 'plyometrics'))
    const r = analyzeNewSessionTypeIntro({ log })
    expect(r.band).toBe('SINGLE_NOVEL')
  })

  it('falls back to system today for invalid Date', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    log.push(makeEntry(3, 'plyometrics'))
    const r = analyzeNewSessionTypeIntro({ log, today: new Date('not-a-date') })
    expect(r).not.toBeNull()
  })
})

// ─── Sport names with punctuation ──────────────────────────────────────────
describe('analyzeNewSessionTypeIntro — sport names with hyphens and spaces', () => {
  it('treats hyphenated names as distinct types', () => {
    const log = baselineSessions(Array(12).fill('long-run'))
    log.push(makeEntry(3, 'hill-repeats'))
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY })
    expect(r.band).toBe('SINGLE_NOVEL')
    expect(r.novelTypes[0].type).toBe('hill-repeats')
  })

  it('preserves internal spaces in type name', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    log.push(makeEntry(3, 'tempo intervals'))
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY })
    expect(r.novelTypes[0].type).toBe('tempo intervals')
  })
})

// ─── recentTypesTotal / baselineTypesTotal ─────────────────────────────────
describe('analyzeNewSessionTypeIntro — totals', () => {
  it('reports distinct counts in both windows', () => {
    const log = []
    for (let i = 0; i < 4; i++) log.push(makeEntry(20 + i, 'easy run'))
    for (let i = 0; i < 4; i++) log.push(makeEntry(30 + i, 'long run'))
    for (let i = 0; i < 4; i++) log.push(makeEntry(40 + i, 'tempo'))
    log.push(makeEntry(3, 'easy run'))
    log.push(makeEntry(5, 'hill repeats'))
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY })
    expect(r.baselineTypesTotal).toBe(3)
    expect(r.recentTypesTotal).toBe(2)
  })

  it('citation matches exported constant', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    const r = analyzeNewSessionTypeIntro({ log, today: TODAY })
    expect(r.citation).toBe(NEW_SESSION_TYPE_INTRO_CITATION)
    expect(r.citation).toBe('Gabbett 2016; Hulin 2014')
  })
})
