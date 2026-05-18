// ─── longestSessionTrend.test.js — pure-fn coverage ──────────────────────────
//
// Covers all 3 bands, sparse-week null gate, zero-week handling,
// peakWeek identification, and delta math edge cases.

import { describe, it, expect } from 'vitest'
import {
  analyzeLongestSessionTrend,
  LONGEST_SESSION_TREND_CITATION,
} from '../../athlete/longestSessionTrend.js'

const TODAY = '2026-05-18'  // Monday

// Helper — return YYYY-MM-DD `days` before TODAY (UTC).
function daysAgo(n, base = TODAY) {
  const d = new Date(base + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

// Build a log where each week (Mon-Sun, indexed 0 = oldest of the 12)
// gets a single session with the supplied longestMin. weekLongest is a
// 12-element array; null/0 means leave that week empty.
function buildWeeklyLog(weekLongest) {
  const log = []
  for (let i = 0; i < weekLongest.length; i++) {
    const min = weekLongest[i]
    if (!min) continue
    // Weeks count back: index 11 = the most-recent week (contains TODAY).
    const weeksBack = (weekLongest.length - 1) - i
    // Put the session on the Monday of that week to keep ISO-week math clean.
    const date = daysAgo(weeksBack * 7)
    log.push({ date, durationMin: min, type: 'Long Run' })
  }
  return log
}

describe('analyzeLongestSessionTrend — guards', () => {
  it('returns null when log is not an array', () => {
    expect(analyzeLongestSessionTrend({ log: null, today: TODAY })).toBeNull()
    expect(analyzeLongestSessionTrend({ log: undefined, today: TODAY })).toBeNull()
    expect(analyzeLongestSessionTrend({ log: 'nope', today: TODAY })).toBeNull()
  })

  it('returns null when today is missing or non-string', () => {
    expect(analyzeLongestSessionTrend({ log: [], today: null })).toBeNull()
    expect(analyzeLongestSessionTrend({ log: [], today: 12345 })).toBeNull()
  })

  it('returns null when fewer than 6 of 12 weeks have sessions (sparse)', () => {
    // Only 5 active weeks out of 12.
    const log = buildWeeklyLog([60, 0, 0, 60, 0, 60, 0, 0, 60, 0, 0, 60])
    const r = analyzeLongestSessionTrend({ log, today: TODAY })
    expect(r).toBeNull()
  })

  it('returns null for an empty log', () => {
    expect(analyzeLongestSessionTrend({ log: [], today: TODAY })).toBeNull()
  })
})

describe('analyzeLongestSessionTrend — GROWING band', () => {
  it('classifies as GROWING when recent third averages ≥10% above early third', () => {
    // Early third (idx 0..3): avg 60. Recent third (idx 9..11): avg 90 → delta = +0.5.
    const log = buildWeeklyLog([60, 60, 60, 60, 70, 75, 80, 85, 88, 90, 90, 90])
    const r = analyzeLongestSessionTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('GROWING')
    expect(r.delta).toBeCloseTo(0.5, 5)
    expect(r.earlyAvg).toBe(60)
    expect(r.recentAvg).toBe(90)
    expect(r.weeks).toHaveLength(12)
    expect(r.citation).toBe(LONGEST_SESSION_TREND_CITATION)
  })

  it('handles earlyAvg=0 with recentAvg>0 as STABLE (fresh base), not GROWING', () => {
    // First 4 weeks empty, recent 3 weeks have data → fresh base building.
    const log = buildWeeklyLog([0, 0, 0, 0, 30, 40, 50, 60, 70, 80, 85, 90])
    const r = analyzeLongestSessionTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('STABLE')
    expect(r.delta).toBeNull()
    expect(r.earlyAvg).toBe(0)
    expect(r.recentAvg).toBeGreaterThan(0)
  })
})

describe('analyzeLongestSessionTrend — STABLE band', () => {
  it('classifies as STABLE when |delta| < 10%', () => {
    // Early third avg 60, recent third avg 63 → delta = +0.05 (within ±10%).
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 62, 67])
    const r = analyzeLongestSessionTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('STABLE')
    expect(Math.abs(r.delta)).toBeLessThan(0.10)
  })

  it('classifies as STABLE for perfectly flat history', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    const r = analyzeLongestSessionTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('STABLE')
    expect(r.delta).toBe(0)
  })
})

describe('analyzeLongestSessionTrend — SHRINKING band', () => {
  it('classifies as SHRINKING when recent third ≥10% below early third', () => {
    // Early third avg 90, recent third avg 60 → delta = -0.333.
    const log = buildWeeklyLog([90, 90, 90, 90, 85, 80, 75, 70, 65, 60, 60, 60])
    const r = analyzeLongestSessionTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('SHRINKING')
    expect(r.delta).toBeLessThan(-0.10)
    expect(r.delta).toBeCloseTo(-0.333, 2)
  })
})

describe('analyzeLongestSessionTrend — peakWeek identification', () => {
  it('identifies the week containing the largest single longestMin as peakWeek', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 120, 60, 60, 60, 60, 60, 60])
    const r = analyzeLongestSessionTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.peakMin).toBe(120)
    // Week index 5 (six-from-most-recent) → 6 weeks back from this Monday.
    expect(r.peakWeek).toBe(daysAgo(6 * 7))
  })

  it('only counts the longest session per week (multiple per week → max)', () => {
    // TODAY (2026-05-18) is a Monday → daysAgo(0,1,2) within the same
    // Mon-Sun week would be Mon/Sun-prev/Sat-prev. We bump the cluster
    // to weeksBack=0 + a few days ahead inside the week instead.
    const monThis = daysAgo(0)
    const tueThis = (() => {
      const d = new Date(`${TODAY}T00:00:00Z`)
      d.setUTCDate(d.getUTCDate() + 1)
      return d.toISOString().slice(0, 10)
    })()
    const wedThis = (() => {
      const d = new Date(`${TODAY}T00:00:00Z`)
      d.setUTCDate(d.getUTCDate() + 2)
      return d.toISOString().slice(0, 10)
    })()
    const log = [
      // Three sessions in the most-recent (current) week — only max counts.
      { date: monThis, durationMin: 30, type: 'Easy' },
      { date: tueThis, durationMin: 90, type: 'Long' },
      { date: wedThis, durationMin: 60, type: 'Tempo' },
      // Filler across the other 11 weeks at 50 min.
      ...Array.from({ length: 11 }, (_, k) => ({
        date: daysAgo((k + 1) * 7),
        durationMin: 50,
        type: 'Easy',
      })),
    ]
    const r = analyzeLongestSessionTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    // Recent week's longestMin must be 90 (not 30/60).
    expect(r.weeks[r.weeks.length - 1].longestMin).toBe(90)
    expect(r.peakMin).toBe(90)
  })
})

describe('analyzeLongestSessionTrend — zero-week handling', () => {
  it('reports longestMin=0 for empty weeks but still classifies when ≥6 are active', () => {
    // 6 of 12 weeks active — right at the boundary.
    const log = buildWeeklyLog([60, 0, 60, 0, 60, 0, 60, 0, 60, 0, 60, 0])
    const r = analyzeLongestSessionTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    const empties = r.weeks.filter(w => w.longestMin === 0)
    expect(empties.length).toBe(6)
    const filled = r.weeks.filter(w => w.longestMin > 0)
    expect(filled.length).toBe(6)
  })

  it('ignores zero/negative/non-numeric durationMin entries', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    log.push({ date: daysAgo(0), durationMin: 0, type: 'Junk' })
    log.push({ date: daysAgo(0), durationMin: -5, type: 'Junk' })
    log.push({ date: daysAgo(0), durationMin: 'abc', type: 'Junk' })
    const r = analyzeLongestSessionTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.weeks[r.weeks.length - 1].longestMin).toBe(60)
  })

  it('ignores entries outside the 12-week window', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    // Way-old session that would dwarf everything if counted.
    log.push({ date: daysAgo(20 * 7), durationMin: 999, type: 'Ancient' })
    const r = analyzeLongestSessionTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.peakMin).toBe(60)
  })
})

describe('analyzeLongestSessionTrend — delta math', () => {
  it('returns delta=null when earlyAvg=0 and recentAvg>0 (fresh base)', () => {
    const log = buildWeeklyLog([0, 0, 0, 0, 30, 40, 50, 60, 70, 80, 85, 90])
    const r = analyzeLongestSessionTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.delta).toBeNull()
    expect(r.band).toBe('STABLE')
  })

  it('returns the correct delta for a fully-populated growth pattern', () => {
    // Early 4 weeks: 50,50,50,50 → avg 50.
    // Recent 3 weeks: 100,100,100 → avg 100. delta = +1.0.
    const log = buildWeeklyLog([50, 50, 50, 50, 60, 70, 80, 90, 95, 100, 100, 100])
    const r = analyzeLongestSessionTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.earlyAvg).toBe(50)
    expect(r.recentAvg).toBe(100)
    expect(r.delta).toBeCloseTo(1.0, 5)
    expect(r.band).toBe('GROWING')
  })

  it('returns the correct delta exactly at the +0.10 GROWING threshold', () => {
    // Early avg 100, recent avg 110 → delta = +0.10 → GROWING.
    const log = buildWeeklyLog([100, 100, 100, 100, 100, 100, 100, 100, 100, 110, 110, 110])
    const r = analyzeLongestSessionTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.delta).toBeCloseTo(0.10, 5)
    expect(r.band).toBe('GROWING')
  })

  it('returns the correct delta exactly at the -0.10 SHRINKING threshold', () => {
    // Early avg 100, recent avg 90 → delta = -0.10 → SHRINKING.
    const log = buildWeeklyLog([100, 100, 100, 100, 100, 100, 100, 100, 100, 90, 90, 90])
    const r = analyzeLongestSessionTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.delta).toBeCloseTo(-0.10, 5)
    expect(r.band).toBe('SHRINKING')
  })
})

describe('analyzeLongestSessionTrend — shape contract', () => {
  it('returns 12 weeks chronologically with weekStart ISO dates', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    const r = analyzeLongestSessionTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.weeks).toHaveLength(12)
    // Chronological order — each weekStart is ≥ previous.
    for (let i = 1; i < r.weeks.length; i++) {
      expect(r.weeks[i].weekStart > r.weeks[i - 1].weekStart).toBe(true)
    }
    // weekStart strings are 10 chars (YYYY-MM-DD).
    for (const w of r.weeks) {
      expect(w.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('exposes the expected return-object keys', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    const r = analyzeLongestSessionTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(Object.keys(r).sort()).toEqual(
      ['band', 'citation', 'delta', 'earlyAvg', 'peakMin', 'peakWeek', 'recentAvg', 'weeks'].sort()
    )
    expect(r.citation).toBe('Daniels 2014; Lydiard 1978')
  })
})
