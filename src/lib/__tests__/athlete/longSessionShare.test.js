// ─── longSessionShare.test.js — pure-fn tests for the long-session detector ─
import { describe, it, expect } from 'vitest'
import {
  computeLongSessionShare,
  LONG_SESSION_SHARE_CITATION,
} from '../../athlete/longSessionShare.js'

// 2026-05-17 is a Sunday. 4-week window = Mon 2026-04-20 → Sun 2026-05-17.
const TODAY = '2026-05-17'
const WEEKS = [
  '2026-04-20', // Mon week 1 (oldest)
  '2026-04-27', // Mon week 2
  '2026-05-04', // Mon week 3
  '2026-05-11', // Mon week 4 (current)
]

function entry(weekIdx, dayOffset, durationMin, extra = {}) {
  const base = new Date(WEEKS[weekIdx] + 'T00:00:00Z')
  base.setUTCDate(base.getUTCDate() + dayOffset)
  const date = base.toISOString().slice(0, 10)
  return { date, duration: durationMin, type: 'run', ...extra }
}

// Build a 4-week log where each week totals `weeklyTotal` minutes with the
// longest single session = `longestMin`. Filler = (weeklyTotal - longestMin)
// minutes split evenly across enough filler days so that EVERY filler day is
// strictly shorter than longestMin (otherwise the "long session" wouldn't be
// the longest of the week). We pick filler-count = max(3, ceil(filler /
// (longestMin - 1))) — bumps up day count when share is low (e.g. 15%).
function buildLog({ longestMin, weeklyTotal }) {
  const log = []
  const filler = weeklyTotal - longestMin
  const minDays = Math.max(3, Math.ceil(filler / Math.max(1, longestMin - 1)))
  const per = filler / minDays
  // dayOffsets: Mon=0 .. Sun=6. Use 0,1,2,3,4,5 (Mon-Sat) for fillers,
  // Sun (6) for the long. minDays will be ≤ 6 in practice.
  const fillerDays = [0, 1, 2, 3, 4, 5].slice(0, minDays)
  for (let w = 0; w < 4; w++) {
    for (const dow of fillerDays) log.push(entry(w, dow, per))
    log.push(entry(w, 6, longestMin)) // Sun = the long session
  }
  return log
}

describe('computeLongSessionShare — citation', () => {
  it('exports a Daniels + Coggan + Magness citation string', () => {
    expect(LONG_SESSION_SHARE_CITATION).toMatch(/Daniels 2014/)
    expect(LONG_SESSION_SHARE_CITATION).toMatch(/Coggan/)
    expect(LONG_SESSION_SHARE_CITATION).toMatch(/Magness 2017/)
  })
})

describe('computeLongSessionShare — null gates', () => {
  it('(a) empty log → null', () => {
    expect(computeLongSessionShare({ log: [], today: TODAY })).toBeNull()
    expect(computeLongSessionShare({ log: null, today: TODAY })).toBeNull()
    expect(computeLongSessionShare({ log: undefined, today: TODAY })).toBeNull()
  })

  it('(b) fewer than 2 weeks of data → null', () => {
    // All entries in one week → other 3 weeks have 0 total → returns null
    const log = [
      entry(3, 0, 30), entry(3, 2, 30), entry(3, 4, 30), entry(3, 6, 90),
    ]
    expect(computeLongSessionShare({ log, today: TODAY })).toBeNull()
  })

  it('returns null when today is missing or invalid', () => {
    const log = buildLog({ longestMin: 90, weeklyTotal: 300 })
    expect(computeLongSessionShare({ log, today: null })).toBeNull()
    expect(computeLongSessionShare({ log, today: undefined })).toBeNull()
  })

  it('returns null when any week in the window has zero duration', () => {
    // Weeks 0, 1, 3 have data; week 2 has nothing → null
    const log = [
      ...buildLog({ longestMin: 90, weeklyTotal: 300 }).filter(e => {
        // Drop all of week 2 (Mon 2026-05-04 → Sun 2026-05-10)
        return !(e.date >= '2026-05-04' && e.date <= '2026-05-10')
      }),
    ]
    expect(computeLongSessionShare({ log, today: TODAY })).toBeNull()
  })
})

describe('computeLongSessionShare — band classification', () => {
  it('(c) TARGET band: long is 30% of weekly total', () => {
    // longest = 90, total = 300 → share = 30%
    const log = buildLog({ longestMin: 90, weeklyTotal: 300 })
    const r = computeLongSessionShare({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('TARGET')
    expect(r.avgSharePct).toBeCloseTo(30, 1)
  })

  it('(d) TOO_SHORT band: long is 15% of weekly total', () => {
    // longest = 45, total = 300 → share = 15%
    const log = buildLog({ longestMin: 45, weeklyTotal: 300 })
    const r = computeLongSessionShare({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('TOO_SHORT')
    expect(r.avgSharePct).toBeCloseTo(15, 1)
  })

  it('(e) OVERWEIGHTED band: long is 40% of weekly total', () => {
    // longest = 120, total = 300 → share = 40%
    const log = buildLog({ longestMin: 120, weeklyTotal: 300 })
    const r = computeLongSessionShare({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('OVERWEIGHTED')
    expect(r.avgSharePct).toBeCloseTo(40, 1)
  })

  it('(f) ISOLATED band: long is 60% of weekly total', () => {
    // longest = 180, total = 300 → share = 60%
    const log = buildLog({ longestMin: 180, weeklyTotal: 300 })
    const r = computeLongSessionShare({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('ISOLATED')
    expect(r.avgSharePct).toBeCloseTo(60, 1)
  })

  it('(g) MODERATE band: long is 22% of weekly total', () => {
    // longest = 66, total = 300 → share = 22%
    const log = buildLog({ longestMin: 66, weeklyTotal: 300 })
    const r = computeLongSessionShare({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('MODERATE')
    expect(r.avgSharePct).toBeCloseTo(22, 1)
  })
})

describe('computeLongSessionShare — longestPerWeek', () => {
  it('(h) longestPerWeek length equals the weeks parameter', () => {
    const log = buildLog({ longestMin: 90, weeklyTotal: 300 })
    const r = computeLongSessionShare({ log, today: TODAY, weeks: 4 })
    expect(r).not.toBeNull()
    expect(r.longestPerWeek).toHaveLength(4)
    // Each entry has the expected fields
    for (const wk of r.longestPerWeek) {
      expect(typeof wk.weekStart).toBe('string')
      expect(wk.longestMin).toBe(90)
      expect(wk.totalMin).toBe(300)
      expect(wk.sharePct).toBeCloseTo(30, 1)
    }
    // weekStarts are sorted oldest → newest
    expect(r.longestPerWeek[0].weekStart).toBe('2026-04-20')
    expect(r.longestPerWeek[3].weekStart).toBe('2026-05-11')
  })

  it('honors a smaller weeks parameter', () => {
    const log = buildLog({ longestMin: 90, weeklyTotal: 300 })
    const r = computeLongSessionShare({ log, today: TODAY, weeks: 2 })
    expect(r).not.toBeNull()
    expect(r.longestPerWeek).toHaveLength(2)
    expect(r.longestPerWeek[0].weekStart).toBe('2026-05-04')
    expect(r.longestPerWeek[1].weekStart).toBe('2026-05-11')
  })
})
