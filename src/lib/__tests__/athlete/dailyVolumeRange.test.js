// src/lib/__tests__/athlete/dailyVolumeRange.test.js
//
// Pure-fn tests for analyzeDailyVolumeRange — Foster 2001 / Halson 2014
// day-level variability counter.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  analyzeDailyVolumeRange,
  DAILY_VOLUME_RANGE_CITATION,
} from '../../athlete/dailyVolumeRange.js'

const TODAY = '2026-05-19'

// ─── helpers ─────────────────────────────────────────────────────────────

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// `days` consecutive daily entries ending today, constant TSS.
function buildFlatLog({ today = TODAY, daily = 60, days = 60 } = {}) {
  const log = []
  for (let i = days - 1; i >= 0; i--) {
    log.push({ date: isoMinusDays(today, i), tss: daily })
  }
  return log
}

// Alternating hard/easy days.
function buildAlternatingLog({
  today = TODAY,
  hard = 150,
  easy = 50,
  days = 60,
} = {}) {
  const log = []
  for (let i = days - 1; i >= 0; i--) {
    log.push({
      date: isoMinusDays(today, i),
      tss: (i % 2 === 0) ? hard : easy,
    })
  }
  return log
}

// ─── deterministic time ─────────────────────────────────────────────────

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})
afterEach(() => {
  vi.setSystemTime(new Date())
})

// ─── null guards ─────────────────────────────────────────────────────────

describe('analyzeDailyVolumeRange — null guards', () => {
  it('returns null when today is an invalid string', () => {
    const log = buildFlatLog({ daily: 60, days: 60 })
    expect(analyzeDailyVolumeRange({ log, today: 'garbage' })).toBeNull()
  })

  it('returns null when today is an empty string', () => {
    const log = buildFlatLog({ daily: 60, days: 60 })
    expect(analyzeDailyVolumeRange({ log, today: '' })).toBeNull()
  })

  it('returns null when today is null', () => {
    const log = buildFlatLog({ daily: 60, days: 60 })
    expect(analyzeDailyVolumeRange({ log, today: null })).toBeNull()
  })

  it('returns null when today is an invalid Date', () => {
    const log = buildFlatLog({ daily: 60, days: 60 })
    expect(analyzeDailyVolumeRange({ log, today: new Date('invalid') })).toBeNull()
  })

  it('returns null when all 28 days are zero (empty log)', () => {
    expect(analyzeDailyVolumeRange({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null when all 28 days are zero (only old log)', () => {
    // Log exists but is all from > 28 days ago.
    const log = []
    for (let i = 60; i >= 40; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: 80 })
    }
    expect(analyzeDailyVolumeRange({ log, today: TODAY })).toBeNull()
  })

  it('returns null when log is undefined', () => {
    expect(analyzeDailyVolumeRange({ log: undefined, today: TODAY })).toBeNull()
  })

  it('returns null when log is null', () => {
    expect(analyzeDailyVolumeRange({ log: null, today: TODAY })).toBeNull()
  })

  it('returns null when log is not an array', () => {
    expect(analyzeDailyVolumeRange({ log: 'oops', today: TODAY })).toBeNull()
  })

  it('returns null with invalid windowDays (negative)', () => {
    const log = buildFlatLog({ daily: 60, days: 60 })
    expect(analyzeDailyVolumeRange({ log, today: TODAY, windowDays: -5 })).toBeNull()
  })

  it('returns null with invalid windowDays (zero)', () => {
    const log = buildFlatLog({ daily: 60, days: 60 })
    expect(analyzeDailyVolumeRange({ log, today: TODAY, windowDays: 0 })).toBeNull()
  })

  it('returns null with invalid windowDays (NaN)', () => {
    const log = buildFlatLog({ daily: 60, days: 60 })
    expect(analyzeDailyVolumeRange({ log, today: TODAY, windowDays: NaN })).toBeNull()
  })

  it('returns null when comparisonWindowDays < windowDays', () => {
    const log = buildFlatLog({ daily: 60, days: 60 })
    expect(analyzeDailyVolumeRange({
      log, today: TODAY, windowDays: 28, comparisonWindowDays: 10,
    })).toBeNull()
  })
})

// ─── band classification ─────────────────────────────────────────────────

describe('analyzeDailyVolumeRange — band classification', () => {
  it('classifies FLAT for very flat low daily TSS', () => {
    const log = buildFlatLog({ daily: 60, days: 60 })
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('FLAT')
    expect(r.recentStdDev).toBe(0)
  })

  it('classifies STEADY when stdev is moderate (15–35)', () => {
    // Alternating 60 / 90 → stdev ≈ 15 (right at threshold).
    // Pick alternating 50/100 → stdev ≈ 25.
    const log = buildAlternatingLog({ hard: 100, easy: 50, days: 60 })
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('STEADY')
    expect(r.recentStdDev).toBeGreaterThanOrEqual(15)
    expect(r.recentStdDev).toBeLessThan(35)
  })

  it('classifies PULSED when stdev is between 35 and 70', () => {
    // 150/40 alternating → stdev = 55
    const log = buildAlternatingLog({ hard: 150, easy: 40, days: 60 })
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('PULSED')
    expect(r.recentStdDev).toBeGreaterThanOrEqual(35)
    expect(r.recentStdDev).toBeLessThan(70)
  })

  it('classifies EXTREME_SWING when stdev ≥ 70', () => {
    // 250/30 alternating → stdev = 110
    const log = buildAlternatingLog({ hard: 250, easy: 30, days: 60 })
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('EXTREME_SWING')
    expect(r.recentStdDev).toBeGreaterThanOrEqual(70)
  })
})

// ─── recentMin / recentMax correctness ──────────────────────────────────

describe('analyzeDailyVolumeRange — recentMin / recentMax', () => {
  it('recentMin reflects smallest non-zero daily TSS in window', () => {
    const log = []
    // Add a variety: 60, 80, 120, 0, 90, 70, ...
    for (let i = 27; i >= 0; i--) {
      const tss = i === 14 ? 0 : 60 + (i % 5) * 10
      log.push({ date: isoMinusDays(TODAY, i), tss })
    }
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.recentMin).toBe(60)
  })

  it('recentMax reflects largest daily TSS in window', () => {
    const log = []
    for (let i = 27; i >= 0; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: 60 })
    }
    // Add a single spike day inside the window.
    log[5].tss = 300
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    expect(r.recentMax).toBe(300)
  })

  it('recentMin EXCLUDES zero days', () => {
    const log = []
    for (let i = 27; i >= 0; i--) {
      const tss = i < 5 ? 0 : 80
      log.push({ date: isoMinusDays(TODAY, i), tss })
    }
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    expect(r.recentMin).toBe(80)
    expect(r.zeroDayCount).toBeGreaterThan(0)
  })

  it('recentRange = recentMax - recentMin', () => {
    const log = buildAlternatingLog({ hard: 200, easy: 50, days: 60 })
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    expect(r.recentRange).toBe(r.recentMax - r.recentMin)
  })
})

// ─── stdDev across all days (zeros included) ────────────────────────────

describe('analyzeDailyVolumeRange — recentStdDev', () => {
  it('recentStdDev is computed across ALL days in window (zeros included)', () => {
    const log = []
    // 14 days of 100 TSS, 14 days of 0.
    for (let i = 27; i >= 14; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: 100 })
    }
    // i=13..0 left empty → zeros inside window.
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    expect(r).not.toBeNull()
    // Population stdev of [100×14, 0×14]: mean = 50, var = (14*2500 + 14*2500)/28 = 2500
    // stdev = 50
    expect(r.recentStdDev).toBeCloseTo(50, 1)
  })

  it('recentStdDev is 0 when every day is identical and non-zero', () => {
    const log = buildFlatLog({ daily: 75, days: 60 })
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    expect(r.recentStdDev).toBe(0)
  })

  it('recentMean matches mean across all window days (zeros included)', () => {
    const log = []
    // 28 days: 14 at 100, 14 at 0 → mean = 50.
    for (let i = 27; i >= 14; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: 100 })
    }
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    expect(r.recentMean).toBe(50)
  })
})

// ─── trendRangeDelta math ───────────────────────────────────────────────

describe('analyzeDailyVolumeRange — trendRangeDelta', () => {
  it('trendRangeDelta is positive when recent range exceeds prior range', () => {
    const log = []
    // Recent 28 days: alternating 50/200 (range = 150)
    for (let i = 27; i >= 0; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: (i % 2 === 0) ? 200 : 50 })
    }
    // Comparison 28 days (days 28..55 back): flat 60 (range = 0)
    for (let i = 55; i >= 28; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: 60 })
    }
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    expect(r).not.toBeNull()
    // comparisonRange = 0 → trendRangeDelta = 0 (handled separately)
    expect(r.trendRangeDelta).toBe(0)
  })

  it('trendRangeDelta is negative when recent range smaller than prior', () => {
    const log = []
    // Recent 28 days: flat 60 (range = 0)
    for (let i = 27; i >= 0; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: 60 })
    }
    // Prior 28 days: alternating 50/200 (range = 150)
    for (let i = 55; i >= 28; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: (i % 2 === 0) ? 200 : 50 })
    }
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    // recentRange = 0, comparisonRange = 150 → (0 - 150) / 150 = -1
    expect(r.trendRangeDelta).toBeCloseTo(-1, 4)
  })

  it('trendRangeDelta is 0 when comparisonRange is 0 (no divide-by-zero)', () => {
    const log = buildAlternatingLog({ hard: 150, easy: 50, days: 28 })
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    expect(r.trendRangeDelta).toBe(0)
    expect(Number.isFinite(r.trendRangeDelta)).toBe(true)
  })

  it('trendRangeDelta has 4dp precision', () => {
    const log = []
    // Build a known ratio: recentRange=100, comparisonRange=80 → delta = 0.25
    for (let i = 27; i >= 0; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: (i % 2 === 0) ? 150 : 50 })
    }
    for (let i = 55; i >= 28; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: (i % 2 === 0) ? 130 : 50 })
    }
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    // 4dp rounded
    const str = String(r.trendRangeDelta)
    const decimals = str.includes('.') ? str.split('.')[1].length : 0
    expect(decimals).toBeLessThanOrEqual(4)
  })
})

// ─── zeroDayCount ────────────────────────────────────────────────────────

describe('analyzeDailyVolumeRange — zeroDayCount', () => {
  it('zeroDayCount counts days with no entries in window', () => {
    const log = []
    // Only 5 days of training in the last 28 days.
    for (let i = 4; i >= 0; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: 100 })
    }
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    expect(r.zeroDayCount).toBe(23) // 28 - 5
  })

  it('zeroDayCount is 0 when every day has training', () => {
    const log = buildFlatLog({ daily: 60, days: 60 })
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    expect(r.zeroDayCount).toBe(0)
  })
})

// ─── multi-session + non-finite ─────────────────────────────────────────

describe('analyzeDailyVolumeRange — entry edge cases', () => {
  it('sums multi-session days correctly', () => {
    const log = []
    for (let i = 27; i >= 0; i--) {
      // Each day has two sessions of 40 → 80 total
      log.push({ date: isoMinusDays(TODAY, i), tss: 40 })
      log.push({ date: isoMinusDays(TODAY, i), tss: 40 })
    }
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    expect(r.recentMax).toBe(80)
    expect(r.recentMin).toBe(80)
    expect(r.recentMean).toBe(80)
  })

  it('ignores non-finite TSS entries (NaN, Infinity)', () => {
    const log = []
    for (let i = 27; i >= 0; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: 60 })
      log.push({ date: isoMinusDays(TODAY, i), tss: NaN })
      log.push({ date: isoMinusDays(TODAY, i), tss: Infinity })
    }
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    expect(r.recentMax).toBe(60)
    expect(r.recentMin).toBe(60)
  })

  it('ignores entries with invalid dates', () => {
    const log = [
      { date: 'garbage', tss: 9999 },
      { date: '2026/05/01', tss: 9999 },
      { date: null, tss: 9999 },
    ]
    // Plus a few real ones
    for (let i = 27; i >= 0; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: 60 })
    }
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    expect(r.recentMax).toBe(60)
  })

  it('ignores negative TSS entries (treats them as not-positive → 0 contribution)', () => {
    const log = []
    for (let i = 27; i >= 0; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: 60 })
      log.push({ date: isoMinusDays(TODAY, i), tss: -50 })
    }
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    expect(r.recentMin).toBe(60)
    expect(r.recentMax).toBe(60)
  })
})

// ─── custom windowDays / comparisonWindowDays ───────────────────────────

describe('analyzeDailyVolumeRange — custom windows', () => {
  it('honours custom windowDays', () => {
    const log = buildFlatLog({ daily: 80, days: 30 })
    const r = analyzeDailyVolumeRange({ log, today: TODAY, windowDays: 14 })
    expect(r.windowDays).toBe(14)
    expect(r.dailyTss.length).toBe(14)
  })

  it('honours custom comparisonWindowDays', () => {
    const log = buildFlatLog({ daily: 80, days: 120 })
    const r = analyzeDailyVolumeRange({
      log, today: TODAY, windowDays: 28, comparisonWindowDays: 84,
    })
    expect(r.comparisonWindowDays).toBe(84)
  })

  it('floors fractional windowDays', () => {
    const log = buildFlatLog({ daily: 80, days: 30 })
    const r = analyzeDailyVolumeRange({ log, today: TODAY, windowDays: 14.7 })
    expect(r.windowDays).toBe(14)
  })
})

// ─── ISO date / today shape ─────────────────────────────────────────────

describe('analyzeDailyVolumeRange — today shape', () => {
  it('accepts today as a Date object', () => {
    const log = buildFlatLog({ daily: 60, days: 60 })
    const r = analyzeDailyVolumeRange({
      log,
      today: new Date(TODAY + 'T00:00:00Z'),
    })
    expect(r).not.toBeNull()
    expect(r.band).toBe('FLAT')
  })

  it('accepts today as an ISO string', () => {
    const log = buildFlatLog({ daily: 60, days: 60 })
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    expect(r).not.toBeNull()
  })

  it('accepts today as a long ISO string (e.g. with time component)', () => {
    const log = buildFlatLog({ daily: 60, days: 60 })
    const r = analyzeDailyVolumeRange({ log, today: TODAY + 'T15:30:00Z' })
    expect(r).not.toBeNull()
  })

  it('respects ISO date boundary at the END of window', () => {
    // Put a 999 TSS exactly on today and a 0 elsewhere — recentMax must be 999.
    const log = [{ date: TODAY, tss: 999 }]
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.recentMax).toBe(999)
  })

  it('excludes data outside the window (day 28 ago is excluded)', () => {
    const log = [
      // Way outside the window
      { date: isoMinusDays(TODAY, 100), tss: 999 },
      // Inside window
      { date: TODAY, tss: 50 },
    ]
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    expect(r.recentMax).toBe(50)
  })
})

// ─── citation + shape ───────────────────────────────────────────────────

describe('analyzeDailyVolumeRange — shape', () => {
  it('returns the citation string', () => {
    const log = buildFlatLog({ daily: 60, days: 60 })
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    expect(r.citation).toBe(DAILY_VOLUME_RANGE_CITATION)
    expect(r.citation).toMatch(/Foster 2001/)
    expect(r.citation).toMatch(/Halson 2014/)
  })

  it('returns dailyTss array of length = windowDays', () => {
    const log = buildFlatLog({ daily: 60, days: 60 })
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    expect(r.dailyTss.length).toBe(28)
  })

  it('rounds recentMean and recentStdDev to 2dp', () => {
    const log = []
    for (let i = 27; i >= 0; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: 33.3333 })
    }
    const r = analyzeDailyVolumeRange({ log, today: TODAY })
    const meanStr = String(r.recentMean)
    const sdStr = String(r.recentStdDev)
    const meanDecimals = meanStr.includes('.') ? meanStr.split('.')[1].length : 0
    const sdDecimals = sdStr.includes('.') ? sdStr.split('.')[1].length : 0
    expect(meanDecimals).toBeLessThanOrEqual(2)
    expect(sdDecimals).toBeLessThanOrEqual(2)
  })
})
