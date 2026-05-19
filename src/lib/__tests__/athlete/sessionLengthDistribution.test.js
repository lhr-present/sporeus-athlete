// ─── sessionLengthDistribution.test.js — pure-fn coverage ───────────────────
//
// Covers null gates, INSUFFICIENT_DATA threshold, each band (NARROW_SHORT,
// NARROW_LONG, WIDE_RANGE, BALANCED), bin-boundary handling, percentile
// math accuracy, modeBinId tie-break, durationMin vs duration_min,
// invalid entries, custom windowDays, today as Date vs string.

import { describe, it, expect } from 'vitest'
import {
  analyzeSessionLengthDistribution,
  SESSION_LENGTH_DISTRIBUTION_CITATION,
} from '../../athlete/sessionLengthDistribution.js'

const TODAY = '2026-05-18'

// Return YYYY-MM-DD `n` days before TODAY (UTC).
function daysAgo(n, base = TODAY) {
  const d = new Date(base + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

// Build a log of N sessions each with the given durationMin, spaced one
// day apart starting from daysAgo(0).
function buildUniformLog(n, durationMin, opts = {}) {
  const log = []
  for (let i = 0; i < n; i++) {
    log.push({
      date: daysAgo(i % (opts.windowDays || 90)),
      durationMin,
      type: 'Easy',
    })
  }
  return log
}

// ────────────────────────────────────────────────────────────────────────────
describe('analyzeSessionLengthDistribution — null gate', () => {
  it('returns null when today is null', () => {
    expect(analyzeSessionLengthDistribution({ log: [], today: null })).toBeNull()
  })

  it('returns null when today is undefined', () => {
    expect(analyzeSessionLengthDistribution({ log: [], today: undefined })).toBeNull()
  })

  it('returns null when today is a number', () => {
    expect(analyzeSessionLengthDistribution({ log: [], today: 12345 })).toBeNull()
  })

  it('returns null when today string is unparseable', () => {
    expect(analyzeSessionLengthDistribution({ log: [], today: 'not-a-date' })).toBeNull()
  })

  it('returns null when today Date is invalid', () => {
    expect(analyzeSessionLengthDistribution({ log: [], today: new Date('not-a-date') })).toBeNull()
  })

  it('returns null when called with no args', () => {
    expect(analyzeSessionLengthDistribution()).toBeNull()
  })
})

describe('analyzeSessionLengthDistribution — INSUFFICIENT_DATA gate', () => {
  it('returns populated INSUFFICIENT_DATA result for an empty log', () => {
    const r = analyzeSessionLengthDistribution({ log: [], today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('INSUFFICIENT_DATA')
    expect(r.totalSessions).toBe(0)
    expect(r.bins).toHaveLength(7)
    expect(r.bins.every(b => b.count === 0 && b.share === 0)).toBe(true)
    expect(r.modeBinId).toBeNull()
    expect(r.citation).toBe(SESSION_LENGTH_DISTRIBUTION_CITATION)
  })

  it('returns INSUFFICIENT_DATA for log that is not an array', () => {
    const r = analyzeSessionLengthDistribution({ log: null, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('INSUFFICIENT_DATA')
    expect(r.totalSessions).toBe(0)
  })

  it('returns INSUFFICIENT_DATA with 14 sessions (boundary − 1)', () => {
    const log = buildUniformLog(14, 60)
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_DATA')
    expect(r.totalSessions).toBe(14)
  })

  it('promotes past INSUFFICIENT_DATA at 15 sessions (boundary)', () => {
    const log = buildUniformLog(15, 60)
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.band).not.toBe('INSUFFICIENT_DATA')
    expect(r.totalSessions).toBe(15)
  })
})

describe('analyzeSessionLengthDistribution — NARROW_SHORT band', () => {
  it('classifies as NARROW_SHORT when ≥80% of sessions are <45 min', () => {
    // 16 short (10 × 25min + 6 × 35min) + 4 longer = 20 total, 80% short.
    const log = [
      ...Array.from({ length: 10 }, (_, i) => ({ date: daysAgo(i), durationMin: 25 })),
      ...Array.from({ length: 6 },  (_, i) => ({ date: daysAgo(10 + i), durationMin: 35 })),
      ...Array.from({ length: 4 },  (_, i) => ({ date: daysAgo(16 + i), durationMin: 65 })),
    ]
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.band).toBe('NARROW_SHORT')
    expect(r.totalSessions).toBe(20)
  })

  it('does NOT classify as NARROW_SHORT when short share is 75%', () => {
    // 15 short + 5 longer = 20 total, 75% short.
    const log = [
      ...Array.from({ length: 15 }, (_, i) => ({ date: daysAgo(i), durationMin: 25 })),
      ...Array.from({ length: 5 },  (_, i) => ({ date: daysAgo(15 + i), durationMin: 65 })),
    ]
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.band).not.toBe('NARROW_SHORT')
  })
})

describe('analyzeSessionLengthDistribution — NARROW_LONG band', () => {
  it('classifies as NARROW_LONG when ≥60% of sessions are ≥90 min', () => {
    // 12 long (8 × 95min + 4 × 130min) + 8 shorter = 20 total, 60% long.
    const log = [
      ...Array.from({ length: 8 }, (_, i) => ({ date: daysAgo(i), durationMin: 95 })),
      ...Array.from({ length: 4 }, (_, i) => ({ date: daysAgo(8 + i), durationMin: 130 })),
      ...Array.from({ length: 8 }, (_, i) => ({ date: daysAgo(12 + i), durationMin: 60 })),
    ]
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.band).toBe('NARROW_LONG')
    expect(r.totalSessions).toBe(20)
  })

  it('does NOT classify as NARROW_LONG when long share is 55%', () => {
    // 11 long + 9 shorter = 20 total, 55% long.
    const log = [
      ...Array.from({ length: 11 }, (_, i) => ({ date: daysAgo(i), durationMin: 95 })),
      ...Array.from({ length: 9 },  (_, i) => ({ date: daysAgo(11 + i), durationMin: 60 })),
    ]
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.band).not.toBe('NARROW_LONG')
  })

  it('includes 180+ sessions in the long share', () => {
    // 12 sessions ≥90 (4 × 95, 4 × 130, 4 × 200) + 8 shorter = 20.
    const log = [
      ...Array.from({ length: 4 }, (_, i) => ({ date: daysAgo(i), durationMin: 95 })),
      ...Array.from({ length: 4 }, (_, i) => ({ date: daysAgo(4 + i), durationMin: 130 })),
      ...Array.from({ length: 4 }, (_, i) => ({ date: daysAgo(8 + i), durationMin: 200 })),
      ...Array.from({ length: 8 }, (_, i) => ({ date: daysAgo(12 + i), durationMin: 60 })),
    ]
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.band).toBe('NARROW_LONG')
  })
})

describe('analyzeSessionLengthDistribution — WIDE_RANGE band', () => {
  it('classifies as WIDE_RANGE when ≥5 of 7 bins have count ≥ 1', () => {
    // Cover sub30, 30-44, 45-59, 60-89, 90-119 (5 bins) plus extras.
    const durations = [
      25, 25, 25,           // sub30 (3)
      35, 35,               // 30-44 (2)
      50, 50, 50,           // 45-59 (3)
      75, 75, 75, 75,       // 60-89 (4)
      100, 100, 100,        // 90-119 (3)
    ]
    const log = durations.map((d, i) => ({ date: daysAgo(i), durationMin: d }))
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.band).toBe('WIDE_RANGE')
    expect(r.bins.filter(b => b.count >= 1).length).toBeGreaterThanOrEqual(5)
  })

  it('classifies WIDE_RANGE when all 7 bins are populated', () => {
    const durations = [
      25, 25, 25,                 // sub30
      35, 35, 35,                 // 30-44
      50, 50,                     // 45-59
      75, 75,                     // 60-89
      100, 100,                   // 90-119
      130, 130,                   // 120-179
      200, 200,                   // 180+
    ]
    const log = durations.map((d, i) => ({ date: daysAgo(i), durationMin: d }))
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.band).toBe('WIDE_RANGE')
  })
})

describe('analyzeSessionLengthDistribution — BALANCED band', () => {
  it('classifies as BALANCED when 3-4 bins populated and not skewed', () => {
    // 4 bins populated (45-59, 60-89, 90-119, 120-179). No bin set
    // collects ≥80% short or ≥60% long.
    const durations = [
      50, 50, 50, 50,             // 45-59 (4) → 20%
      75, 75, 75, 75, 75, 75, 75, 75, // 60-89 (8) → 40%
      100, 100, 100, 100,         // 90-119 (4) → 20%
      130, 130, 130, 130,         // 120-179 (4) → 20%
    ]
    const log = durations.map((d, i) => ({ date: daysAgo(i), durationMin: d }))
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.band).toBe('BALANCED')
    expect(r.totalSessions).toBe(20)
    // Long share = 20%+20% = 40% < 60% threshold.
    // Short share = 0%.
    // Populated bins = 4, below WIDE_RANGE's 5-bin floor.
  })
})

describe('analyzeSessionLengthDistribution — bin boundaries', () => {
  it('places 30min in the 30-44 bin (not <30)', () => {
    const log = buildUniformLog(15, 30)
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    const subBin = r.bins.find(b => b.id === 'sub30')
    const s30Bin = r.bins.find(b => b.id === 's30to44')
    expect(subBin.count).toBe(0)
    expect(s30Bin.count).toBe(15)
  })

  it('places 45min in the 45-59 bin (not 30-44)', () => {
    const log = buildUniformLog(15, 45)
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.bins.find(b => b.id === 's30to44').count).toBe(0)
    expect(r.bins.find(b => b.id === 's45to59').count).toBe(15)
  })

  it('places 60min in the 60-89 bin (not 45-59)', () => {
    const log = buildUniformLog(15, 60)
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.bins.find(b => b.id === 's45to59').count).toBe(0)
    expect(r.bins.find(b => b.id === 's60to89').count).toBe(15)
  })

  it('places 90min in the 90-119 bin (not 60-89)', () => {
    const log = buildUniformLog(15, 90)
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.bins.find(b => b.id === 's60to89').count).toBe(0)
    expect(r.bins.find(b => b.id === 's90to119').count).toBe(15)
  })

  it('places 120min in the 120-179 bin (not 90-119)', () => {
    const log = buildUniformLog(15, 120)
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.bins.find(b => b.id === 's90to119').count).toBe(0)
    expect(r.bins.find(b => b.id === 's120to179').count).toBe(15)
  })

  it('places 180min in the 180+ bin (not 120-179)', () => {
    const log = buildUniformLog(15, 180)
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.bins.find(b => b.id === 's120to179').count).toBe(0)
    expect(r.bins.find(b => b.id === 'sup180').count).toBe(15)
  })

  it('places 29min in the <30 bin', () => {
    const log = buildUniformLog(15, 29)
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.bins.find(b => b.id === 'sub30').count).toBe(15)
  })

  it('places a 600min ultra in the 180+ bin', () => {
    const log = [
      ...buildUniformLog(14, 60),
      { date: daysAgo(60), durationMin: 600 },
    ]
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.bins.find(b => b.id === 'sup180').count).toBe(1)
    expect(r.totalSessions).toBe(15)
  })
})

describe('analyzeSessionLengthDistribution — quartile math', () => {
  it('computes q25/q50/q75 correctly for the 1..15 sequence (odd count)', () => {
    // Sorted: 1..15. medianMin = 8, q25 = (1 + 14*0.25)→3.5, q75→11.5.
    const durations = Array.from({ length: 15 }, (_, i) => i + 1)
    const log = durations.map((d, i) => ({ date: daysAgo(i), durationMin: d }))
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.q25Min).toBe(4.5)  // method-7: (15-1)*0.25 = 3.5 → 1 + 3.5 = 4.5
    expect(r.medianMin).toBe(8)
    expect(r.q75Min).toBe(11.5) // (15-1)*0.75 = 10.5 → 1 + 10.5 = 11.5
    expect(r.iqrMin).toBe(7)    // 11.5 − 4.5
  })

  it('computes percentile correctly for an even-count distribution', () => {
    // Sorted: 1..16. method-7: q50 = 1 + 15*0.5 = 8.5.
    const durations = Array.from({ length: 16 }, (_, i) => i + 1)
    const log = durations.map((d, i) => ({ date: daysAgo(i), durationMin: d }))
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.medianMin).toBe(8.5)
    expect(r.q25Min).toBe(4.8)  // 1 + 15*0.25 = 4.75 → round1 → 4.8
    expect(r.q75Min).toBe(12.3) // 1 + 15*0.75 = 12.25 → round1 → 12.3
  })

  it('handles a single-value log: q25 == median == q75 == that value', () => {
    const log = Array.from({ length: 15 }, (_, i) => ({
      date: daysAgo(i),
      durationMin: 60,
    }))
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.q25Min).toBe(60)
    expect(r.medianMin).toBe(60)
    expect(r.q75Min).toBe(60)
    expect(r.iqrMin).toBe(0)
  })

  it('handles a two-value log inside the window (still INSUFFICIENT_DATA)', () => {
    // Only 2 sessions → INSUFFICIENT_DATA, but stats still compute.
    const log = [
      { date: daysAgo(0), durationMin: 40 },
      { date: daysAgo(1), durationMin: 80 },
    ]
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_DATA')
    expect(r.q25Min).toBe(50)  // 40 + (80-40)*0.25
    expect(r.medianMin).toBe(60)
    expect(r.q75Min).toBe(70)
  })

  it('returns 0 for all percentiles when no sessions collected', () => {
    const r = analyzeSessionLengthDistribution({ log: [], today: TODAY })
    expect(r.q25Min).toBe(0)
    expect(r.medianMin).toBe(0)
    expect(r.q75Min).toBe(0)
    expect(r.iqrMin).toBe(0)
  })
})

describe('analyzeSessionLengthDistribution — modeBinId', () => {
  it('returns null modeBinId for an empty log', () => {
    const r = analyzeSessionLengthDistribution({ log: [], today: TODAY })
    expect(r.modeBinId).toBeNull()
  })

  it('identifies the most-populated bin as modeBinId', () => {
    // Heavy 60-89: 10 sessions, lighter elsewhere.
    const log = [
      ...Array.from({ length: 10 }, (_, i) => ({ date: daysAgo(i), durationMin: 70 })),
      ...Array.from({ length: 3 },  (_, i) => ({ date: daysAgo(10 + i), durationMin: 100 })),
      ...Array.from({ length: 2 },  (_, i) => ({ date: daysAgo(13 + i), durationMin: 40 })),
    ]
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.modeBinId).toBe('s60to89')
  })

  it('breaks ties by picking the earliest bin in BINS order', () => {
    // Two bins with 5 sessions each: sub30 (earliest) vs 60-89.
    const log = [
      ...Array.from({ length: 5 }, (_, i) => ({ date: daysAgo(i), durationMin: 25 })),
      ...Array.from({ length: 5 }, (_, i) => ({ date: daysAgo(5 + i), durationMin: 70 })),
      ...Array.from({ length: 5 }, (_, i) => ({ date: daysAgo(10 + i), durationMin: 100 })),
    ]
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.modeBinId).toBe('sub30')
  })
})

describe('analyzeSessionLengthDistribution — field & sanitisation', () => {
  it('reads duration_min when durationMin is absent', () => {
    const log = Array.from({ length: 15 }, (_, i) => ({
      date: daysAgo(i),
      duration_min: 70,
    }))
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.totalSessions).toBe(15)
    expect(r.bins.find(b => b.id === 's60to89').count).toBe(15)
  })

  it('prefers durationMin when both durationMin and duration_min present', () => {
    const log = Array.from({ length: 15 }, (_, i) => ({
      date: daysAgo(i),
      durationMin: 70,
      duration_min: 200,
    }))
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.bins.find(b => b.id === 's60to89').count).toBe(15)
    expect(r.bins.find(b => b.id === 'sup180').count).toBe(0)
  })

  it('ignores durationMin = 0', () => {
    const log = [
      ...Array.from({ length: 15 }, (_, i) => ({ date: daysAgo(i), durationMin: 60 })),
      { date: daysAgo(20), durationMin: 0, type: 'Junk' },
    ]
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.totalSessions).toBe(15)
  })

  it('ignores negative or non-numeric durationMin', () => {
    const log = [
      ...Array.from({ length: 15 }, (_, i) => ({ date: daysAgo(i), durationMin: 60 })),
      { date: daysAgo(20), durationMin: -5, type: 'Junk' },
      { date: daysAgo(21), durationMin: 'abc', type: 'Junk' },
      { date: daysAgo(22), durationMin: null, type: 'Junk' },
    ]
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.totalSessions).toBe(15)
  })

  it('ignores entries with no date or non-string date', () => {
    const log = [
      ...Array.from({ length: 15 }, (_, i) => ({ date: daysAgo(i), durationMin: 60 })),
      { date: null, durationMin: 60 },
      { date: 12345, durationMin: 60 },
      { durationMin: 60 },
    ]
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.totalSessions).toBe(15)
  })

  it('ignores entries outside the 90-day window', () => {
    const log = [
      ...Array.from({ length: 15 }, (_, i) => ({ date: daysAgo(i), durationMin: 60 })),
      { date: daysAgo(200), durationMin: 999, type: 'Ancient' },
    ]
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.totalSessions).toBe(15)
    expect(r.bins.find(b => b.id === 'sup180').count).toBe(0)
  })

  it('skips null/undefined entries in the log array', () => {
    const log = [
      ...Array.from({ length: 15 }, (_, i) => ({ date: daysAgo(i), durationMin: 60 })),
      null,
      undefined,
    ]
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.totalSessions).toBe(15)
  })
})

describe('analyzeSessionLengthDistribution — windowDays + today format', () => {
  it('honours a custom windowDays argument', () => {
    // A session 60 days ago is excluded when windowDays = 30.
    const log = [
      ...Array.from({ length: 15 }, (_, i) => ({ date: daysAgo(i), durationMin: 60 })),
      { date: daysAgo(60), durationMin: 200, type: 'Old' },
    ]
    const r = analyzeSessionLengthDistribution({ log, today: TODAY, windowDays: 30 })
    expect(r.totalSessions).toBe(15)
    expect(r.bins.find(b => b.id === 'sup180').count).toBe(0)
  })

  it('accepts today as a Date object', () => {
    const log = buildUniformLog(15, 60)
    const r = analyzeSessionLengthDistribution({
      log,
      today: new Date(TODAY + 'T12:00:00Z'),
    })
    expect(r.totalSessions).toBe(15)
    expect(r.band).not.toBe('INSUFFICIENT_DATA')
  })

  it('accepts today as a YYYY-MM-DD string', () => {
    const log = buildUniformLog(15, 60)
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    expect(r.totalSessions).toBe(15)
    expect(r.band).not.toBe('INSUFFICIENT_DATA')
  })

  it('accepts today as a longer ISO string and truncates to YYYY-MM-DD', () => {
    const log = buildUniformLog(15, 60)
    const r = analyzeSessionLengthDistribution({
      log,
      today: '2026-05-18T12:34:56.789Z',
    })
    expect(r.totalSessions).toBe(15)
    expect(r.band).not.toBe('INSUFFICIENT_DATA')
  })

  it('falls back to default windowDays when windowDays is invalid', () => {
    const log = buildUniformLog(15, 60)
    const r = analyzeSessionLengthDistribution({
      log,
      today: TODAY,
      windowDays: -10,
    })
    expect(r.totalSessions).toBe(15)
  })
})

describe('analyzeSessionLengthDistribution — bin shape', () => {
  it('always returns 7 bins, in canonical order with correct labels', () => {
    const r = analyzeSessionLengthDistribution({ log: [], today: TODAY })
    expect(r.bins.map(b => b.label)).toEqual([
      '<30', '30-44', '45-59', '60-89', '90-119', '120-179', '180+',
    ])
    expect(r.bins.map(b => b.id)).toEqual([
      'sub30', 's30to44', 's45to59', 's60to89', 's90to119', 's120to179', 'sup180',
    ])
  })

  it('bin shares are 4-decimal floats summing to ~1 when populated', () => {
    const log = buildUniformLog(20, 60)
    const r = analyzeSessionLengthDistribution({ log, today: TODAY })
    const sum = r.bins.reduce((s, b) => s + b.share, 0)
    expect(sum).toBeCloseTo(1.0, 4)
    expect(r.bins.find(b => b.id === 's60to89').share).toBe(1.0)
  })

  it('returns citation string Issurin 2010; Bompa 2018', () => {
    const r = analyzeSessionLengthDistribution({ log: [], today: TODAY })
    expect(r.citation).toBe('Issurin 2010; Bompa 2018')
    expect(r.citation).toBe(SESSION_LENGTH_DISTRIBUTION_CITATION)
  })
})
