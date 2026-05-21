// ─── overlookedSessionType.test.js — analyzeOverlookedSessionType unit tests ─
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  analyzeOverlookedSessionType,
  OVERLOOKED_SESSION_TYPE_CITATION,
} from '../../athlete/overlookedSessionType.js'

const TODAY = '2026-05-19'

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})
afterEach(() => {
  vi.setSystemTime(new Date())
})

// ─── helpers ────────────────────────────────────────────────────────────────
function addDaysIso(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function makeEntry(daysAgo, type) {
  return { date: addDaysIso(TODAY, -daysAgo), type }
}

/** Fill baseline with N sessions of a type spread across baseline window. */
function baselineSessions(types, today = TODAY, recentDays = 30) {
  const log = []
  for (let i = 0; i < types.length; i++) {
    log.push({ date: addDaysIso(today, -(recentDays + (i % 150) + 1)), type: types[i] })
  }
  return log
}

// ─── null gating ────────────────────────────────────────────────────────────
describe('analyzeOverlookedSessionType — null gating', () => {
  it('returns null when log is not an array', () => {
    expect(analyzeOverlookedSessionType({ log: null, today: TODAY })).toBeNull()
    expect(analyzeOverlookedSessionType({ log: 'nope', today: TODAY })).toBeNull()
    expect(analyzeOverlookedSessionType({ log: 42, today: TODAY })).toBeNull()
  })

  it('returns null when recentDays is invalid', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    expect(analyzeOverlookedSessionType({ log, today: TODAY, recentDays: 0 })).toBeNull()
    expect(analyzeOverlookedSessionType({ log, today: TODAY, recentDays: NaN })).toBeNull()
    expect(analyzeOverlookedSessionType({ log, today: TODAY, recentDays: -5 })).toBeNull()
  })

  it('returns null when baselineDays is invalid', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    expect(analyzeOverlookedSessionType({ log, today: TODAY, baselineDays: 0 })).toBeNull()
    expect(analyzeOverlookedSessionType({ log, today: TODAY, baselineDays: -5 })).toBeNull()
    expect(analyzeOverlookedSessionType({ log, today: TODAY, baselineDays: NaN })).toBeNull()
  })

  it('returns null when minBaselineCount is invalid', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    expect(analyzeOverlookedSessionType({ log, today: TODAY, minBaselineCount: 0 })).toBeNull()
    expect(analyzeOverlookedSessionType({ log, today: TODAY, minBaselineCount: -1 })).toBeNull()
    expect(analyzeOverlookedSessionType({ log, today: TODAY, minBaselineCount: NaN })).toBeNull()
  })

  it('returns null when today is an invalid string', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    expect(analyzeOverlookedSessionType({ log, today: 'not-a-date' })).toBeNull()
    expect(analyzeOverlookedSessionType({ log, today: '2026' })).toBeNull()
  })

  it('returns null when today is an invalid Date', () => {
    const log = baselineSessions(Array(12).fill('easy run'))
    expect(analyzeOverlookedSessionType({ log, today: new Date('garbage') })).toBeNull()
  })
})

// ─── INSUFFICIENT_HISTORY ───────────────────────────────────────────────────
describe('analyzeOverlookedSessionType — INSUFFICIENT_HISTORY', () => {
  it('returns INSUFFICIENT_HISTORY on empty log', () => {
    const r = analyzeOverlookedSessionType({ log: [], today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_HISTORY')
    expect(r.overlookedTypes).toEqual([])
    expect(r.baselineTypesTotal).toBe(0)
    expect(r.recentTypesTotal).toBe(0)
  })

  it('returns INSUFFICIENT_HISTORY when <10 baseline sessions', () => {
    const log = []
    for (let i = 0; i < 9; i++) log.push(makeEntry(40 + i, 'strength'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_HISTORY')
    expect(r.overlookedTypes).toEqual([])
  })

  it('crosses threshold once baseline reaches 10 sessions', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'strength'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    expect(r.band).not.toBe('INSUFFICIENT_HISTORY')
  })

  it('counts only baseline-window entries toward the 10-session gate', () => {
    const log = []
    // 6 in baseline + 5 in recent — should still be INSUFFICIENT_HISTORY
    for (let i = 0; i < 6; i++) log.push(makeEntry(40 + i, 'strength'))
    for (let i = 0; i < 5; i++) log.push(makeEntry(2 + i, 'easy run'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_HISTORY')
  })

  it('citation is present on INSUFFICIENT_HISTORY', () => {
    const r = analyzeOverlookedSessionType({ log: [], today: TODAY })
    expect(r.citation).toBe(OVERLOOKED_SESSION_TYPE_CITATION)
  })
})

// ─── COMPLETE_REPERTOIRE ────────────────────────────────────────────────────
describe('analyzeOverlookedSessionType — COMPLETE_REPERTOIRE', () => {
  it('returns COMPLETE_REPERTOIRE when every baseline type is still in recent', () => {
    const log = []
    for (let i = 0; i < 12; i++) log.push(makeEntry(40 + i, 'easy run'))
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    expect(r.band).toBe('COMPLETE_REPERTOIRE')
    expect(r.overlookedTypes).toEqual([])
  })

  it('returns COMPLETE_REPERTOIRE when baseline types fail the minBaselineCount gate', () => {
    const log = []
    // 10 sessions of "easy run" in baseline (covered in recent too)
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    // 2 sessions of "strength" — below default minBaselineCount=3
    log.push(makeEntry(80, 'strength'))
    log.push(makeEntry(90, 'strength'))
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    expect(r.band).toBe('COMPLETE_REPERTOIRE')
  })
})

// ─── MINOR_DROPS ────────────────────────────────────────────────────────────
describe('analyzeOverlookedSessionType — MINOR_DROPS', () => {
  it('flags exactly 1 dropped type as MINOR_DROPS', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    // 3 baseline sessions of strength, none in recent
    log.push(makeEntry(80, 'strength'))
    log.push(makeEntry(100, 'strength'))
    log.push(makeEntry(120, 'strength'))
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    expect(r.band).toBe('MINOR_DROPS')
    expect(r.overlookedTypes).toHaveLength(1)
    expect(r.overlookedTypes[0].type).toBe('strength')
    expect(r.overlookedTypes[0].baselineCount).toBe(3)
  })

  it('flags 2 dropped types as MINOR_DROPS', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    for (let i = 0; i < 3; i++) log.push(makeEntry(60 + i * 10, 'strength'))
    for (let i = 0; i < 3; i++) log.push(makeEntry(120 + i * 5, 'sprints'))
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    expect(r.band).toBe('MINOR_DROPS')
    expect(r.overlookedTypes).toHaveLength(2)
  })
})

// ─── MULTIPLE_DROPS ─────────────────────────────────────────────────────────
describe('analyzeOverlookedSessionType — MULTIPLE_DROPS', () => {
  it('flags ≥3 dropped types as MULTIPLE_DROPS', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    for (let i = 0; i < 3; i++) log.push(makeEntry(60 + i, 'strength'))
    for (let i = 0; i < 3; i++) log.push(makeEntry(70 + i, 'sprints'))
    for (let i = 0; i < 3; i++) log.push(makeEntry(90 + i, 'long run'))
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    expect(r.band).toBe('MULTIPLE_DROPS')
    expect(r.overlookedTypes).toHaveLength(3)
  })

  it('flags 4+ dropped types as MULTIPLE_DROPS', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    const dropped = ['strength', 'sprints', 'long run', 'hills', 'plyometrics']
    for (const t of dropped) {
      for (let i = 0; i < 3; i++) log.push(makeEntry(60 + i, t))
    }
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    expect(r.band).toBe('MULTIPLE_DROPS')
    expect(r.overlookedTypes.length).toBeGreaterThanOrEqual(3)
  })
})

// ─── Type normalization ────────────────────────────────────────────────────
describe('analyzeOverlookedSessionType — type normalization', () => {
  it('normalizes whitespace and casing', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'Easy Run'))
    // Same type but different casing recently — should NOT be flagged
    log.push({ date: addDaysIso(TODAY, -3), type: '  EASY RUN  ' })
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    expect(r.band).toBe('COMPLETE_REPERTOIRE')
  })

  it('lowercases overlooked type names in output', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    for (let i = 0; i < 3; i++) log.push(makeEntry(60 + i, 'STRENGTH'))
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    expect(r.overlookedTypes[0].type).toBe('strength')
  })

  it('skips entries with empty / non-string types', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    log.push({ date: addDaysIso(TODAY, -60), type: '   ' })
    log.push({ date: addDaysIso(TODAY, -70), type: '' })
    log.push({ date: addDaysIso(TODAY, -80), type: null })
    log.push({ date: addDaysIso(TODAY, -90), type: 42 })
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    expect(r.band).toBe('COMPLETE_REPERTOIRE')
  })
})

// ─── minBaselineCount filter ───────────────────────────────────────────────
describe('analyzeOverlookedSessionType — minBaselineCount filter', () => {
  it('excludes types under the minBaselineCount threshold', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    // Only 2 baseline strength sessions
    log.push(makeEntry(60, 'strength'))
    log.push(makeEntry(70, 'strength'))
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY, minBaselineCount: 3 })
    expect(r.overlookedTypes).toHaveLength(0)
    expect(r.band).toBe('COMPLETE_REPERTOIRE')
  })

  it('honors a custom minBaselineCount of 1', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    log.push(makeEntry(60, 'strength')) // only 1
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY, minBaselineCount: 1 })
    expect(r.overlookedTypes).toHaveLength(1)
    expect(r.overlookedTypes[0].type).toBe('strength')
    expect(r.overlookedTypes[0].baselineCount).toBe(1)
  })

  it('honors a custom minBaselineCount of 5', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    for (let i = 0; i < 4; i++) log.push(makeEntry(60 + i, 'strength'))
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY, minBaselineCount: 5 })
    expect(r.overlookedTypes).toHaveLength(0)
  })
})

// ─── lastSeen across full log ──────────────────────────────────────────────
describe('analyzeOverlookedSessionType — lastSeen across full log', () => {
  it('lastSeen uses the most-recent occurrence anywhere in the log', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    // Strength sessions at days -200, -150, -90 — last one is -90.
    log.push(makeEntry(200, 'strength'))
    log.push(makeEntry(150, 'strength'))
    log.push(makeEntry(90, 'strength'))
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    expect(r.overlookedTypes[0].lastSeen).toBe(addDaysIso(TODAY, -90))
    expect(r.overlookedTypes[0].daysSinceLastSeen).toBe(90)
  })

  it('lastSeen still uses the latest occurrence even if outside baseline window', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    // Strength: 3 in baseline plus one older sample further back than baselineDays.
    log.push(makeEntry(60, 'strength'))
    log.push(makeEntry(80, 'strength'))
    log.push(makeEntry(100, 'strength'))
    // An additional VERY old sample at day -400 — older than baseline.
    log.push(makeEntry(400, 'strength'))
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    // baselineCount counts only baseline window → 3 entries
    expect(r.overlookedTypes[0].baselineCount).toBe(3)
    // lastSeen is the most recent occurrence (60 days ago)
    expect(r.overlookedTypes[0].daysSinceLastSeen).toBe(60)
  })

  it('daysSinceLastSeen is non-negative', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    log.push(makeEntry(60, 'strength'))
    log.push(makeEntry(70, 'strength'))
    log.push(makeEntry(80, 'strength'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    expect(r.overlookedTypes[0].daysSinceLastSeen).toBeGreaterThanOrEqual(0)
  })
})

// ─── Sort order ─────────────────────────────────────────────────────────────
describe('analyzeOverlookedSessionType — sort order', () => {
  it('sorts overlooked types by daysSinceLastSeen ascending (most-recent first)', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    // strength last seen 90 days ago
    log.push(makeEntry(90, 'strength'))
    log.push(makeEntry(120, 'strength'))
    log.push(makeEntry(150, 'strength'))
    // sprints last seen 60 days ago
    log.push(makeEntry(60, 'sprints'))
    log.push(makeEntry(100, 'sprints'))
    log.push(makeEntry(140, 'sprints'))
    // hills last seen 170 days ago
    log.push(makeEntry(170, 'hills'))
    log.push(makeEntry(175, 'hills'))
    log.push(makeEntry(180, 'hills'))
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    expect(r.overlookedTypes.map((o) => o.type)).toEqual(['sprints', 'strength', 'hills'])
  })

  it('tiebreaks alphabetically when daysSinceLastSeen ties', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    for (let i = 0; i < 3; i++) log.push(makeEntry(60 + i, 'strength'))
    for (let i = 0; i < 3; i++) log.push(makeEntry(60 + i, 'sprints'))
    log.push(makeEntry(3, 'easy run')) // keep easy run in recent so it isn't overlooked
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    // Both last seen 60 days ago → alpha order
    expect(r.overlookedTypes.map((o) => o.type)).toEqual(['sprints', 'strength'])
  })
})

// ─── window overrides ──────────────────────────────────────────────────────
describe('analyzeOverlookedSessionType — window overrides', () => {
  it('respects a shorter recentDays override (14d)', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    // strength last seen 20 days ago — outside a 14d recent window
    log.push(makeEntry(20, 'strength'))
    log.push(makeEntry(60, 'strength'))
    log.push(makeEntry(80, 'strength'))
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY, recentDays: 14 })
    // Strength at day -20 is NOT recent (14d window), so dropped.
    // Baseline window with recentDays=14, baselineDays=180 = [today-193..today-14] → captures the 3 strength sessions
    expect(r.overlookedTypes.find((o) => o.type === 'strength')).toBeDefined()
  })

  it('respects a longer recentDays override (60d) — type appears in recent', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    log.push(makeEntry(50, 'strength'))
    log.push(makeEntry(120, 'strength'))
    log.push(makeEntry(150, 'strength'))
    log.push(makeEntry(3, 'easy run'))
    // With recentDays=60: strength at day -50 is inside recent → NOT dropped.
    const r = analyzeOverlookedSessionType({ log, today: TODAY, recentDays: 60 })
    expect(r.overlookedTypes.find((o) => o.type === 'strength')).toBeUndefined()
  })

  it('respects a shorter baselineDays override (60d)', () => {
    const log = []
    for (let i = 0; i < 12; i++) log.push(makeEntry(40 + i, 'easy run'))
    // strength sessions at -200, -210 — outside a 60d baseline window
    log.push(makeEntry(200, 'strength'))
    log.push(makeEntry(210, 'strength'))
    log.push(makeEntry(220, 'strength'))
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY, baselineDays: 60 })
    // With baseline = [today-89..today-30] strength is not counted at all
    expect(r.overlookedTypes.find((o) => o.type === 'strength')).toBeUndefined()
  })

  it('respects a longer baselineDays override (360d)', () => {
    const log = []
    for (let i = 0; i < 12; i++) log.push(makeEntry(40 + i, 'easy run'))
    log.push(makeEntry(300, 'strength'))
    log.push(makeEntry(310, 'strength'))
    log.push(makeEntry(320, 'strength'))
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY, baselineDays: 360 })
    expect(r.overlookedTypes.find((o) => o.type === 'strength')).toBeDefined()
  })
})

// ─── ISO boundary handling ─────────────────────────────────────────────────
describe('analyzeOverlookedSessionType — date boundaries', () => {
  it('boundary day = today-recentDays is in baseline, not recent', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    // strength all in baseline + one at exactly day -30 (= today-recentDays)
    log.push({ date: addDaysIso(TODAY, -30), type: 'strength' })
    log.push(makeEntry(60, 'strength'))
    log.push(makeEntry(90, 'strength'))
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    // Day -30 → baseline (not recent) → strength counted as overlooked.
    expect(r.overlookedTypes.find((o) => o.type === 'strength')).toBeDefined()
  })

  it('boundary day = today-(recentDays-1) is in recent (inclusive)', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    log.push(makeEntry(60, 'strength'))
    log.push(makeEntry(90, 'strength'))
    log.push(makeEntry(120, 'strength'))
    log.push({ date: addDaysIso(TODAY, -29), type: 'strength' })
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    // Day -29 → recent → strength NOT overlooked.
    expect(r.overlookedTypes.find((o) => o.type === 'strength')).toBeUndefined()
  })

  it('accepts ISO date strings with a time component', () => {
    const log = []
    for (let i = 0; i < 10; i++) {
      log.push({ date: addDaysIso(TODAY, -(40 + i)) + 'T08:00:00Z', type: 'easy run' })
    }
    log.push({ date: addDaysIso(TODAY, -60) + 'T10:00:00Z', type: 'strength' })
    log.push({ date: addDaysIso(TODAY, -70) + 'T10:00:00Z', type: 'strength' })
    log.push({ date: addDaysIso(TODAY, -80) + 'T10:00:00Z', type: 'strength' })
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    expect(r.overlookedTypes.find((o) => o.type === 'strength')).toBeDefined()
  })

  it('skips entries with bogus date strings', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    log.push({ date: 'not-a-date', type: 'strength' })
    log.push({ date: '2026', type: 'strength' })
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    expect(r.overlookedTypes.find((o) => o.type === 'strength')).toBeUndefined()
  })
})

// ─── today input shapes ─────────────────────────────────────────────────────
describe('analyzeOverlookedSessionType — today input', () => {
  it('accepts a Date object as today', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    for (let i = 0; i < 3; i++) log.push(makeEntry(60 + i, 'strength'))
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({
      log,
      today: new Date(TODAY + 'T00:00:00Z'),
    })
    expect(r.overlookedTypes.find((o) => o.type === 'strength')).toBeDefined()
  })

  it('accepts a string as today', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    for (let i = 0; i < 3; i++) log.push(makeEntry(60 + i, 'strength'))
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    expect(r.overlookedTypes.find((o) => o.type === 'strength')).toBeDefined()
  })

  it('defaults to system today when not provided', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    for (let i = 0; i < 3; i++) log.push(makeEntry(60 + i, 'strength'))
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({ log })
    expect(r).not.toBeNull()
    expect(r.overlookedTypes.find((o) => o.type === 'strength')).toBeDefined()
  })
})

// ─── output shape + citation ────────────────────────────────────────────────
describe('analyzeOverlookedSessionType — output shape', () => {
  it('exports the citation constant', () => {
    expect(OVERLOOKED_SESSION_TYPE_CITATION).toBe('Bompa 2018; Issurin 2010')
  })

  it('result.citation matches the exported constant', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    expect(r.citation).toBe(OVERLOOKED_SESSION_TYPE_CITATION)
  })

  it('reports recentTypesTotal and baselineTypesTotal correctly', () => {
    const log = []
    for (let i = 0; i < 4; i++) log.push(makeEntry(40 + i, 'easy run'))
    for (let i = 0; i < 4; i++) log.push(makeEntry(60 + i, 'long run'))
    for (let i = 0; i < 4; i++) log.push(makeEntry(80 + i, 'strength'))
    log.push(makeEntry(3, 'easy run'))
    log.push(makeEntry(5, 'tempo'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    expect(r.baselineTypesTotal).toBe(3)
    expect(r.recentTypesTotal).toBe(2)
  })

  it('every overlookedType entry has the documented shape', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
    for (let i = 0; i < 3; i++) log.push(makeEntry(60 + i, 'strength'))
    log.push(makeEntry(3, 'easy run'))
    const r = analyzeOverlookedSessionType({ log, today: TODAY })
    const item = r.overlookedTypes[0]
    expect(item).toHaveProperty('type')
    expect(item).toHaveProperty('baselineCount')
    expect(item).toHaveProperty('lastSeen')
    expect(item).toHaveProperty('daysSinceLastSeen')
    expect(typeof item.type).toBe('string')
    expect(typeof item.baselineCount).toBe('number')
    expect(typeof item.lastSeen).toBe('string')
    expect(typeof item.daysSinceLastSeen).toBe('number')
  })
})
