// src/lib/__tests__/athlete/veryEasyShare.test.js
//
// Pure-fn tests for analyzeVeryEasyShare — Maffetone 2010 / Seiler 2010
// RPE-based "very easy" (RPE ≤ 3) training-minute share over the last
// `windowDays` (default 30).

import { describe, it, expect } from 'vitest'
import {
  analyzeVeryEasyShare,
  VERY_EASY_SHARE_CITATION,
} from '../../athlete/veryEasyShare.js'

const TODAY = '2026-05-13'

// Build a single training entry on (today - daysAgo).
function entry({ daysAgo = 0, dur = 60, rpe, useSnake = false, dateOverride }) {
  const d = new Date(TODAY + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - daysAgo)
  const iso = d.toISOString().slice(0, 10)
  const out = { date: dateOverride ?? iso }
  if (useSnake) {
    out.duration_min = dur
  } else {
    out.durationMin = dur
  }
  if (rpe !== undefined) out.rpe = rpe
  return out
}

// ─── citation export ────────────────────────────────────────────────────────

describe('analyzeVeryEasyShare — citation export', () => {
  it('exports the Maffetone + Seiler citation', () => {
    expect(VERY_EASY_SHARE_CITATION).toBe('Maffetone 2010; Seiler 2010')
  })
})

// ─── null guards ────────────────────────────────────────────────────────────

describe('analyzeVeryEasyShare — null guards', () => {
  it('returns null when today is missing', () => {
    expect(analyzeVeryEasyShare({ log: [] })).toBeNull()
    expect(analyzeVeryEasyShare({ log: [], today: undefined })).toBeNull()
  })

  it('returns null when today is invalid', () => {
    expect(analyzeVeryEasyShare({ log: [], today: 'bogus' })).toBeNull()
    expect(analyzeVeryEasyShare({ log: [], today: 12345 })).toBeNull()
    expect(analyzeVeryEasyShare({ log: [], today: null })).toBeNull()
    expect(analyzeVeryEasyShare({ log: [], today: new Date('not-a-date') })).toBeNull()
  })
})

// ─── INSUFFICIENT_DATA (populated, not null) ───────────────────────────────

describe('analyzeVeryEasyShare — INSUFFICIENT_DATA', () => {
  it('returns populated INSUFFICIENT_DATA with zeros for empty log', () => {
    const out = analyzeVeryEasyShare({ log: [], today: TODAY })
    expect(out).not.toBeNull()
    expect(out.band).toBe('INSUFFICIENT_DATA')
    expect(out.veryEasyMin).toBe(0)
    expect(out.totalRatedMin).toBe(0)
    expect(out.veryEasyShare).toBe(0)
    expect(out.ratedSessionCount).toBe(0)
    expect(out.unratedSessionCount).toBe(0)
    expect(out.citation).toBe(VERY_EASY_SHARE_CITATION)
  })

  it('returns populated INSUFFICIENT_DATA when log is not an array', () => {
    const out = analyzeVeryEasyShare({ log: null, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.band).toBe('INSUFFICIENT_DATA')
    expect(out.totalRatedMin).toBe(0)
  })

  it('returns INSUFFICIENT_DATA when totalRatedMin is exactly 59 (< 60)', () => {
    const log = [entry({ daysAgo: 1, dur: 59, rpe: 2 })]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.band).toBe('INSUFFICIENT_DATA')
    expect(out.totalRatedMin).toBe(0) // zeroed out for INSUFFICIENT
    expect(out.veryEasyMin).toBe(0)
  })

  it('preserves unratedSessionCount in INSUFFICIENT_DATA payload', () => {
    const log = [
      entry({ daysAgo: 1, dur: 45, rpe: 2 }), // rated but < 60 total
      entry({ daysAgo: 2, dur: 30 }),         // unrated
      entry({ daysAgo: 3, dur: 40 }),         // unrated
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.band).toBe('INSUFFICIENT_DATA')
    expect(out.unratedSessionCount).toBe(2)
    expect(out.totalRatedMin).toBe(0)
  })

  it('returns INSUFFICIENT_DATA when veryEasyRpeMax is non-finite', () => {
    const out = analyzeVeryEasyShare({
      log: [entry({ daysAgo: 1, dur: 120, rpe: 2 })],
      today: TODAY,
      veryEasyRpeMax: NaN,
    })
    expect(out.band).toBe('INSUFFICIENT_DATA')
  })

  it('returns INSUFFICIENT_DATA when windowDays < 1', () => {
    const out = analyzeVeryEasyShare({
      log: [entry({ daysAgo: 0, dur: 120, rpe: 2 })],
      today: TODAY,
      windowDays: 0,
    })
    expect(out.band).toBe('INSUFFICIENT_DATA')
  })
})

// ─── INSUFFICIENT_BASE (< 30%) ─────────────────────────────────────────────

describe('analyzeVeryEasyShare — INSUFFICIENT_BASE', () => {
  it('classifies INSUFFICIENT_BASE for 20% very-easy share', () => {
    // 60 min very-easy + 240 min hard = 300 min total; 60/300 = 0.20
    const log = [
      entry({ daysAgo: 1, dur: 60, rpe: 2 }),
      entry({ daysAgo: 2, dur: 60, rpe: 6 }),
      entry({ daysAgo: 3, dur: 60, rpe: 6 }),
      entry({ daysAgo: 4, dur: 60, rpe: 6 }),
      entry({ daysAgo: 5, dur: 60, rpe: 6 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.band).toBe('INSUFFICIENT_BASE')
    expect(out.veryEasyShare).toBe(0.2)
    expect(out.veryEasyMin).toBe(60)
    expect(out.totalRatedMin).toBe(300)
    expect(out.ratedSessionCount).toBe(5)
  })

  it('classifies INSUFFICIENT_BASE for 0% very-easy share (all hard)', () => {
    const log = [
      entry({ daysAgo: 1, dur: 60, rpe: 7 }),
      entry({ daysAgo: 2, dur: 60, rpe: 7 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.band).toBe('INSUFFICIENT_BASE')
    expect(out.veryEasyShare).toBe(0)
    expect(out.veryEasyMin).toBe(0)
    expect(out.totalRatedMin).toBe(120)
  })

  it('classifies INSUFFICIENT_BASE just below 30% (0.299)', () => {
    // 299 very-easy + 701 hard = 1000; share 0.299
    const log = [
      entry({ daysAgo: 1, dur: 299, rpe: 2 }),
      entry({ daysAgo: 2, dur: 701, rpe: 6 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.band).toBe('INSUFFICIENT_BASE')
    expect(out.veryEasyShare).toBe(0.299)
  })
})

// ─── BUILDING_BASE (30-55%) ────────────────────────────────────────────────

describe('analyzeVeryEasyShare — BUILDING_BASE', () => {
  it('classifies BUILDING_BASE at exactly 30%', () => {
    // 300 + 700 = 1000; share 0.30 → BUILDING (≥ 0.30)
    const log = [
      entry({ daysAgo: 1, dur: 300, rpe: 2 }),
      entry({ daysAgo: 2, dur: 700, rpe: 6 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.band).toBe('BUILDING_BASE')
    expect(out.veryEasyShare).toBe(0.3)
  })

  it('classifies BUILDING_BASE at 45%', () => {
    const log = [
      entry({ daysAgo: 1, dur: 90, rpe: 3 }),
      entry({ daysAgo: 2, dur: 110, rpe: 6 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.band).toBe('BUILDING_BASE')
    expect(out.veryEasyShare).toBe(0.45)
  })

  it('classifies BUILDING_BASE just below 55% (0.549)', () => {
    const log = [
      entry({ daysAgo: 1, dur: 549, rpe: 2 }),
      entry({ daysAgo: 2, dur: 451, rpe: 6 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.band).toBe('BUILDING_BASE')
    expect(out.veryEasyShare).toBe(0.549)
  })
})

// ─── STRONG_BASE (55-80%) ──────────────────────────────────────────────────

describe('analyzeVeryEasyShare — STRONG_BASE', () => {
  it('classifies STRONG_BASE at exactly 55%', () => {
    const log = [
      entry({ daysAgo: 1, dur: 550, rpe: 3 }),
      entry({ daysAgo: 2, dur: 450, rpe: 6 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.band).toBe('STRONG_BASE')
    expect(out.veryEasyShare).toBe(0.55)
  })

  it('classifies STRONG_BASE at 70%', () => {
    const log = [
      entry({ daysAgo: 1, dur: 70, rpe: 2 }),
      entry({ daysAgo: 2, dur: 30, rpe: 7 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.band).toBe('STRONG_BASE')
    expect(out.veryEasyShare).toBe(0.7)
  })

  it('classifies STRONG_BASE at exactly 80% (inclusive upper bound)', () => {
    const log = [
      entry({ daysAgo: 1, dur: 80, rpe: 2 }),
      entry({ daysAgo: 2, dur: 20, rpe: 6 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.band).toBe('STRONG_BASE')
    expect(out.veryEasyShare).toBe(0.8)
  })
})

// ─── EXCESSIVE_EASY (> 80%) ────────────────────────────────────────────────

describe('analyzeVeryEasyShare — EXCESSIVE_EASY', () => {
  it('classifies EXCESSIVE_EASY just above 80% (0.81)', () => {
    const log = [
      entry({ daysAgo: 1, dur: 81, rpe: 2 }),
      entry({ daysAgo: 2, dur: 19, rpe: 6 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.band).toBe('EXCESSIVE_EASY')
    expect(out.veryEasyShare).toBe(0.81)
  })

  it('classifies EXCESSIVE_EASY at 100% (all very-easy)', () => {
    const log = [
      entry({ daysAgo: 1, dur: 60, rpe: 2 }),
      entry({ daysAgo: 2, dur: 60, rpe: 3 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.band).toBe('EXCESSIVE_EASY')
    expect(out.veryEasyShare).toBe(1)
    expect(out.veryEasyMin).toBe(120)
    expect(out.totalRatedMin).toBe(120)
  })
})

// ─── RPE boundary handling ─────────────────────────────────────────────────

describe('analyzeVeryEasyShare — RPE boundaries', () => {
  it('counts RPE exactly 3 as very-easy', () => {
    const log = [
      entry({ daysAgo: 1, dur: 120, rpe: 3 }),
      entry({ daysAgo: 2, dur: 30, rpe: 8 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.veryEasyMin).toBe(120)
    expect(out.totalRatedMin).toBe(150)
  })

  it('does NOT count RPE 4 as very-easy', () => {
    const log = [
      entry({ daysAgo: 1, dur: 120, rpe: 4 }),
      entry({ daysAgo: 2, dur: 30, rpe: 2 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.veryEasyMin).toBe(30) // only the rpe=2 session
    expect(out.totalRatedMin).toBe(150)
  })

  it('counts RPE 1 as very-easy', () => {
    const log = [entry({ daysAgo: 1, dur: 120, rpe: 1 })]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.veryEasyMin).toBe(120)
    expect(out.totalRatedMin).toBe(120)
  })

  it('counts RPE 10 as rated (not very-easy)', () => {
    const log = [
      entry({ daysAgo: 1, dur: 120, rpe: 10 }),
      entry({ daysAgo: 2, dur: 30, rpe: 2 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.veryEasyMin).toBe(30)
    expect(out.totalRatedMin).toBe(150)
    expect(out.ratedSessionCount).toBe(2)
  })

  it('rejects RPE 0 and RPE 11 as invalid (counted as unrated)', () => {
    const log = [
      entry({ daysAgo: 1, dur: 60, rpe: 0 }),
      entry({ daysAgo: 2, dur: 60, rpe: 11 }),
      entry({ daysAgo: 3, dur: 60, rpe: 2 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.unratedSessionCount).toBe(2)
    // Only the rpe=2 session is rated (rpe 0 and 11 are invalid).
    expect(out.ratedSessionCount).toBe(1)
    // totalRatedMin = 60 >= MIN_RATED_MIN (60) → sufficient.
    expect(out.totalRatedMin).toBe(60)
    expect(out.veryEasyMin).toBe(60)
    expect(out.band).toBe('EXCESSIVE_EASY') // 60/60 = 1.0 > 0.80
  })
})

// ─── Invalid RPE → unratedSessionCount ─────────────────────────────────────

describe('analyzeVeryEasyShare — invalid RPE handling', () => {
  it('treats missing rpe as unrated', () => {
    const log = [
      entry({ daysAgo: 1, dur: 60 }), // no rpe
      entry({ daysAgo: 2, dur: 120, rpe: 2 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.unratedSessionCount).toBe(1)
    expect(out.ratedSessionCount).toBe(1)
    expect(out.totalRatedMin).toBe(120)
  })

  it('treats null rpe as unrated', () => {
    const log = [
      entry({ daysAgo: 1, dur: 60, rpe: null }),
      entry({ daysAgo: 2, dur: 120, rpe: 2 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.unratedSessionCount).toBe(1)
    expect(out.totalRatedMin).toBe(120)
  })

  it('treats string rpe like "abc" as unrated', () => {
    const log = [
      entry({ daysAgo: 1, dur: 60, rpe: 'abc' }),
      entry({ daysAgo: 2, dur: 120, rpe: 2 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.unratedSessionCount).toBe(1)
  })

  it('treats NaN rpe as unrated', () => {
    const log = [
      entry({ daysAgo: 1, dur: 60, rpe: NaN }),
      entry({ daysAgo: 2, dur: 120, rpe: 2 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.unratedSessionCount).toBe(1)
  })

  it('parses numeric string rpe like "2" as valid', () => {
    const log = [
      entry({ daysAgo: 1, dur: 120, rpe: '2' }),
      entry({ daysAgo: 2, dur: 60, rpe: '7' }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.unratedSessionCount).toBe(0)
    expect(out.ratedSessionCount).toBe(2)
    expect(out.veryEasyMin).toBe(120)
    expect(out.totalRatedMin).toBe(180)
  })
})

// ─── durationMin vs duration_min ───────────────────────────────────────────

describe('analyzeVeryEasyShare — duration field handling', () => {
  it('reads camelCase durationMin', () => {
    const log = [
      entry({ daysAgo: 1, dur: 90, rpe: 2 }),
      entry({ daysAgo: 2, dur: 30, rpe: 7 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.totalRatedMin).toBe(120)
    expect(out.veryEasyMin).toBe(90)
  })

  it('reads snake_case duration_min', () => {
    const log = [
      entry({ daysAgo: 1, dur: 90, rpe: 2, useSnake: true }),
      entry({ daysAgo: 2, dur: 30, rpe: 7, useSnake: true }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.totalRatedMin).toBe(120)
    expect(out.veryEasyMin).toBe(90)
  })

  it('prefers camelCase when both fields exist', () => {
    const log = [
      {
        date: '2026-05-12',
        durationMin: 100,
        duration_min: 999,
        rpe: 2,
      },
      entry({ daysAgo: 2, dur: 60, rpe: 7 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.totalRatedMin).toBe(160)
    expect(out.veryEasyMin).toBe(100)
  })

  it('ignores durationMin = 0', () => {
    const log = [
      entry({ daysAgo: 1, dur: 0, rpe: 2 }),
      entry({ daysAgo: 2, dur: 120, rpe: 2 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.ratedSessionCount).toBe(1)
    expect(out.totalRatedMin).toBe(120)
  })

  it('ignores negative durationMin', () => {
    const log = [
      entry({ daysAgo: 1, dur: -30, rpe: 2 }),
      entry({ daysAgo: 2, dur: 120, rpe: 2 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.ratedSessionCount).toBe(1)
    expect(out.totalRatedMin).toBe(120)
  })

  it('ignores non-numeric duration (NaN)', () => {
    const log = [
      { date: '2026-05-12', durationMin: 'abc', rpe: 2 },
      entry({ daysAgo: 2, dur: 120, rpe: 2 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.totalRatedMin).toBe(120)
  })
})

// ─── windowDays custom ─────────────────────────────────────────────────────

describe('analyzeVeryEasyShare — custom windowDays', () => {
  it('respects windowDays=7 — entries 8d ago excluded', () => {
    const log = [
      entry({ daysAgo: 8, dur: 999, rpe: 2 }),  // outside 7d window
      entry({ daysAgo: 1, dur: 60, rpe: 2 }),
      entry({ daysAgo: 2, dur: 60, rpe: 7 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY, windowDays: 7 })
    expect(out.totalRatedMin).toBe(120)
    expect(out.veryEasyMin).toBe(60)
  })

  it('respects windowDays=90 — much older entries included', () => {
    const log = [
      entry({ daysAgo: 60, dur: 60, rpe: 2 }),
      entry({ daysAgo: 70, dur: 60, rpe: 2 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY, windowDays: 90 })
    expect(out.totalRatedMin).toBe(120)
    expect(out.veryEasyMin).toBe(120)
  })

  it('treats entry exactly windowDays-1 ago as inside window (inclusive)', () => {
    // windowDays=30 → start = today - 29 days. daysAgo=29 included.
    const log = [
      entry({ daysAgo: 29, dur: 60, rpe: 2 }),
      entry({ daysAgo: 30, dur: 60, rpe: 2 }), // OUT
      entry({ daysAgo: 0,  dur: 60, rpe: 2 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.totalRatedMin).toBe(120)
  })
})

// ─── veryEasyRpeMax custom ─────────────────────────────────────────────────

describe('analyzeVeryEasyShare — custom veryEasyRpeMax', () => {
  it('stricter threshold veryEasyRpeMax=2 excludes RPE 3 sessions', () => {
    const log = [
      entry({ daysAgo: 1, dur: 60, rpe: 2 }),
      entry({ daysAgo: 2, dur: 60, rpe: 3 }),
      entry({ daysAgo: 3, dur: 60, rpe: 7 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY, veryEasyRpeMax: 2 })
    expect(out.veryEasyMin).toBe(60)
    expect(out.totalRatedMin).toBe(180)
  })

  it('looser threshold veryEasyRpeMax=5 includes RPE 4 and 5', () => {
    const log = [
      entry({ daysAgo: 1, dur: 60, rpe: 4 }),
      entry({ daysAgo: 2, dur: 60, rpe: 5 }),
      entry({ daysAgo: 3, dur: 60, rpe: 7 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY, veryEasyRpeMax: 5 })
    expect(out.veryEasyMin).toBe(120)
    expect(out.totalRatedMin).toBe(180)
  })
})

// ─── multi-session day ─────────────────────────────────────────────────────

describe('analyzeVeryEasyShare — multi-session per day', () => {
  it('counts every session independently when multiple share a date', () => {
    const log = [
      entry({ daysAgo: 1, dur: 30, rpe: 2 }),
      entry({ daysAgo: 1, dur: 45, rpe: 2 }),
      entry({ daysAgo: 1, dur: 60, rpe: 8 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.ratedSessionCount).toBe(3)
    expect(out.veryEasyMin).toBe(75)
    expect(out.totalRatedMin).toBe(135)
  })
})

// ─── ISO date boundary ─────────────────────────────────────────────────────

describe('analyzeVeryEasyShare — ISO date boundary', () => {
  it('includes entry on today itself', () => {
    const log = [
      entry({ daysAgo: 0, dur: 120, rpe: 2 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.totalRatedMin).toBe(120)
  })

  it('excludes entries in the future', () => {
    const log = [
      { date: '2026-05-14', durationMin: 120, rpe: 2 }, // future
      { date: '2026-05-13', durationMin: 60, rpe: 2 },
      { date: '2026-05-12', durationMin: 60, rpe: 7 },
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.totalRatedMin).toBe(120)
    expect(out.veryEasyMin).toBe(60)
  })

  it('handles entries with date including time/Z suffix (slices to 10 chars)', () => {
    const log = [
      { date: '2026-05-12T08:30:00Z', durationMin: 120, rpe: 2 },
      { date: '2026-05-11T18:00:00.000Z', durationMin: 60, rpe: 7 },
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.totalRatedMin).toBe(180)
    expect(out.veryEasyMin).toBe(120)
  })

  it('rejects bad date strings', () => {
    const log = [
      { date: 'not-a-date', durationMin: 60, rpe: 2 },
      { date: '20260512', durationMin: 60, rpe: 2 },
      entry({ daysAgo: 1, dur: 120, rpe: 2 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.totalRatedMin).toBe(120)
  })

  it('skips entries with non-string dates', () => {
    const log = [
      { date: null, durationMin: 60, rpe: 2 },
      { date: undefined, durationMin: 60, rpe: 2 },
      { date: 20260512, durationMin: 60, rpe: 2 },
      entry({ daysAgo: 1, dur: 120, rpe: 2 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.totalRatedMin).toBe(120)
  })
})

// ─── today as Date vs ISO string ───────────────────────────────────────────

describe('analyzeVeryEasyShare — today input types', () => {
  it('accepts today as Date object', () => {
    const log = [entry({ daysAgo: 1, dur: 120, rpe: 2 })]
    const out = analyzeVeryEasyShare({
      log,
      today: new Date(TODAY + 'T12:00:00Z'),
    })
    expect(out.totalRatedMin).toBe(120)
  })

  it('accepts today as ISO string', () => {
    const log = [entry({ daysAgo: 1, dur: 120, rpe: 2 })]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.totalRatedMin).toBe(120)
  })

  it('Date vs string produce identical results', () => {
    const log = [
      entry({ daysAgo: 1, dur: 90, rpe: 2 }),
      entry({ daysAgo: 5, dur: 60, rpe: 7 }),
    ]
    const a = analyzeVeryEasyShare({ log, today: TODAY })
    const b = analyzeVeryEasyShare({
      log,
      today: new Date(TODAY + 'T00:00:00Z'),
    })
    expect(a).toEqual(b)
  })
})

// ─── share precision ───────────────────────────────────────────────────────

describe('analyzeVeryEasyShare — share precision', () => {
  it('rounds veryEasyShare to 4 decimal places', () => {
    // 100/300 = 0.3333... → 0.3333
    const log = [
      entry({ daysAgo: 1, dur: 100, rpe: 2 }),
      entry({ daysAgo: 2, dur: 200, rpe: 7 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.veryEasyShare).toBe(0.3333)
  })

  it('returns exact 0 when no very-easy minutes', () => {
    const log = [
      entry({ daysAgo: 1, dur: 60, rpe: 7 }),
      entry({ daysAgo: 2, dur: 60, rpe: 8 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.veryEasyShare).toBe(0)
  })

  it('returns exact 1 when all minutes very-easy', () => {
    const log = [
      entry({ daysAgo: 1, dur: 60, rpe: 1 }),
      entry({ daysAgo: 2, dur: 60, rpe: 3 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.veryEasyShare).toBe(1)
  })
})

// ─── ratedSessionCount / unratedSessionCount correctness ───────────────────

describe('analyzeVeryEasyShare — session counts', () => {
  it('rated count includes ALL rated sessions (easy and hard)', () => {
    const log = [
      entry({ daysAgo: 1, dur: 30, rpe: 2 }),
      entry({ daysAgo: 2, dur: 30, rpe: 3 }),
      entry({ daysAgo: 3, dur: 30, rpe: 7 }),
      entry({ daysAgo: 4, dur: 30, rpe: 9 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.ratedSessionCount).toBe(4)
  })

  it('unrated count separate from rated count', () => {
    const log = [
      entry({ daysAgo: 1, dur: 60, rpe: 2 }),
      entry({ daysAgo: 2, dur: 60, rpe: 2 }),
      entry({ daysAgo: 3, dur: 60 }),         // unrated
      entry({ daysAgo: 4, dur: 60, rpe: null }), // unrated
      entry({ daysAgo: 5, dur: 60, rpe: 'bad' }), // unrated
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.ratedSessionCount).toBe(2)
    expect(out.unratedSessionCount).toBe(3)
  })

  it('zero-duration sessions do NOT count toward unrated either', () => {
    const log = [
      entry({ daysAgo: 1, dur: 0 }),     // skipped entirely
      entry({ daysAgo: 2, dur: 60, rpe: 2 }),
      entry({ daysAgo: 3, dur: 60, rpe: 2 }),
    ]
    const out = analyzeVeryEasyShare({ log, today: TODAY })
    expect(out.unratedSessionCount).toBe(0)
    expect(out.ratedSessionCount).toBe(2)
  })
})
