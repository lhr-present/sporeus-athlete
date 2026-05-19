// src/lib/__tests__/athlete/seasonAnchor.test.js
//
// Pure-fn tests for analyzeSeasonAnchor — Hägglund 2013 / Bompa 2018
// ramp-from-nadir tracker.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  analyzeSeasonAnchor,
  SEASON_ANCHOR_CITATION,
} from '../../athlete/seasonAnchor.js'

const TODAY = '2026-05-17'

// ─── helpers ─────────────────────────────────────────────────────────────

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function buildFlatLog({ today = TODAY, daily = 10, days = 200 } = {}) {
  const log = []
  for (let i = days - 1; i >= 0; i--) {
    log.push({ date: isoMinusDays(today, i), tss: daily })
  }
  return log
}

// Two-tier log: first `firstDays` at `firstDaily`, then remainder at
// `secondDaily`, ending at `today`. Total length = firstDays + secondDays.
function buildTwoTierLog({
  today = TODAY,
  firstDaily,
  firstDays,
  secondDaily,
  secondDays,
} = {}) {
  const total = firstDays + secondDays
  const log = []
  for (let i = total - 1; i >= 0; i--) {
    const ageDays = i
    const ordinal = total - 1 - ageDays   // 0-indexed from oldest
    const tss = ordinal < firstDays ? firstDaily : secondDaily
    log.push({ date: isoMinusDays(today, ageDays), tss })
  }
  return log
}

// ─── null / insufficient signal ──────────────────────────────────────────

describe('analyzeSeasonAnchor — null guards', () => {
  it('returns null for an empty log', () => {
    expect(analyzeSeasonAnchor({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null for null log', () => {
    expect(analyzeSeasonAnchor({ log: null, today: TODAY })).toBeNull()
  })

  it('returns null when log spans < 56 days of history', () => {
    const log = buildFlatLog({ daily: 50, days: 30 })
    expect(analyzeSeasonAnchor({ log, today: TODAY })).toBeNull()
  })

  it('returns null for invalid today string', () => {
    const log = buildFlatLog({ daily: 50, days: 200 })
    expect(analyzeSeasonAnchor({ log, today: 'not-a-date' })).toBeNull()
  })

  it('returns null for an impossible calendar date', () => {
    const log = buildFlatLog({ daily: 50, days: 200 })
    expect(analyzeSeasonAnchor({ log, today: '2026-02-31' })).toBeNull()
  })

  it('returns null for lookbackDays < 29', () => {
    const log = buildFlatLog({ daily: 50, days: 200 })
    expect(analyzeSeasonAnchor({ log, today: TODAY, lookbackDays: 14 })).toBeNull()
  })

  it('returns null when log has only zero-TSS days but is too short', () => {
    const log = buildFlatLog({ daily: 0, days: 30 })
    expect(analyzeSeasonAnchor({ log, today: TODAY })).toBeNull()
  })

  it('returns null for missing today', () => {
    const log = buildFlatLog({ daily: 50, days: 200 })
    expect(analyzeSeasonAnchor({ log })).toBeNull()
  })
})

// ─── band classification ─────────────────────────────────────────────────

describe('analyzeSeasonAnchor — band classification', () => {
  it('AT_ANCHOR: completely flat log → ramp ratio 1.00', () => {
    const log = buildFlatLog({ daily: 10, days: 200 })
    const r = analyzeSeasonAnchor({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('AT_ANCHOR')
    expect(r.rampRatio).toBeCloseTo(1.0, 2)
    expect(r.anchor4wTss).toBe(280)
    expect(r.currentLast4wTss).toBe(280)
  })

  it('EARLY_RAMP: ratio in [1.10, 1.60)', () => {
    // First 100 days @ daily=5 (rolling=140), then 100 days @ daily=7 (rolling=196).
    // ratio = 196/140 = 1.40
    const log = buildTwoTierLog({
      firstDaily: 5, firstDays: 100, secondDaily: 7, secondDays: 100,
    })
    const r = analyzeSeasonAnchor({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('EARLY_RAMP')
    expect(r.rampRatio).toBeGreaterThanOrEqual(1.10)
    expect(r.rampRatio).toBeLessThan(1.60)
  })

  it('BUILDING: ratio in [1.60, 2.50)', () => {
    // First 100 days @ daily=5 (rolling=140), then 100 days @ daily=10 (rolling=280).
    // ratio = 280/140 = 2.00 (peak excluding today ≈ 280 too, but BUILDING wins
    // because ratio < 2.50).
    const log = buildTwoTierLog({
      firstDaily: 5, firstDays: 100, secondDaily: 10, secondDays: 100,
    })
    const r = analyzeSeasonAnchor({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('BUILDING')
    expect(r.rampRatio).toBeGreaterThanOrEqual(1.60)
    expect(r.rampRatio).toBeLessThan(2.50)
  })

  it('PEAK_BLOCK: ratio >= 2.50 AND current within 5% of peak', () => {
    // First 100 days @ daily=10 (rolling=280), then 60 days @ daily=30 (rolling=840).
    // ratio = 840/280 = 3.00. Yesterday's rolling = today's (sustained high) → near peak.
    const log = buildTwoTierLog({
      firstDaily: 10, firstDays: 100, secondDaily: 30, secondDays: 60,
    })
    const r = analyzeSeasonAnchor({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('PEAK_BLOCK')
    expect(r.rampRatio).toBeGreaterThanOrEqual(2.50)
    expect(r.currentLast4wTss).toBeGreaterThanOrEqual(0.95 * r.peak4wTss)
  })

  it('ABOVE_HISTORY: current > historical peak (sudden spike)', () => {
    // 150 days @ daily=10 (rolling=280), then 28 days @ daily=40.
    // Today rolling = 40*28 = 1120. Yesterday's rolling = 27×40 + 10 = 1090.
    // peak (excluding today) = 1090 < 1120 = current → ABOVE_HISTORY.
    const log = buildTwoTierLog({
      firstDaily: 10, firstDays: 150, secondDaily: 40, secondDays: 28,
    })
    const r = analyzeSeasonAnchor({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('ABOVE_HISTORY')
    expect(r.currentLast4wTss).toBeGreaterThan(r.peak4wTss)
  })
})

// ─── anchor selection ───────────────────────────────────────────────────

describe('analyzeSeasonAnchor — anchorDate selection', () => {
  it('earliest tie wins for anchorDate (flat log → first valid window day)', () => {
    const log = buildFlatLog({ daily: 10, days: 200 })
    const r = analyzeSeasonAnchor({ log, today: TODAY, lookbackDays: 180 })
    expect(r).not.toBeNull()
    // With a 200-day log, earliestValid = log_start + 27 = today - 172.
    // That's later than the 180-day window start (today-179), so
    // walkStart = today - 172 and the first window-end day = today - 172.
    expect(r.anchorDate).toBe(isoMinusDays(TODAY, 172))
  })

  it('peakDate latest-tie-wins (excluding today)', () => {
    // Sustained flat log @ daily=10 for 200 days. Excluding today, every other
    // day in the search window has rolling=280. Latest tie wins → yesterday.
    const log = buildFlatLog({ daily: 10, days: 200 })
    const r = analyzeSeasonAnchor({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.peakDate).toBe(isoMinusDays(TODAY, 1))
  })

  it('anchorDate sits before peakDate when ramping up', () => {
    const log = buildTwoTierLog({
      firstDaily: 5, firstDays: 100, secondDaily: 12, secondDays: 100,
    })
    const r = analyzeSeasonAnchor({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.anchorDate < r.peakDate).toBe(true)
  })
})

// ─── custom lookback / today as Date ────────────────────────────────────

describe('analyzeSeasonAnchor — input variants', () => {
  it('accepts custom lookbackDays', () => {
    const log = buildFlatLog({ daily: 10, days: 300 })
    const r = analyzeSeasonAnchor({ log, today: TODAY, lookbackDays: 120 })
    expect(r).not.toBeNull()
    expect(r.band).toBe('AT_ANCHOR')
  })

  it('accepts today as a Date object', () => {
    const log = buildFlatLog({ daily: 10, days: 200 })
    const r = analyzeSeasonAnchor({
      log,
      today: new Date(TODAY + 'T12:00:00Z'),
    })
    expect(r).not.toBeNull()
    expect(r.currentLast4wTss).toBe(280)
  })

  it('today as Date matches today as ISO string', () => {
    const log = buildFlatLog({ daily: 10, days: 200 })
    const a = analyzeSeasonAnchor({ log, today: TODAY })
    const b = analyzeSeasonAnchor({
      log, today: new Date(TODAY + 'T00:00:00Z'),
    })
    expect(a).toEqual(b)
  })

  it('returns null for invalid Date', () => {
    const log = buildFlatLog({ daily: 10, days: 200 })
    expect(analyzeSeasonAnchor({ log, today: new Date('invalid') })).toBeNull()
  })

  it('returns null for number `today`', () => {
    const log = buildFlatLog({ daily: 10, days: 200 })
    expect(analyzeSeasonAnchor({ log, today: 12345 })).toBeNull()
  })
})

// ─── data shape ─────────────────────────────────────────────────────────

describe('analyzeSeasonAnchor — data shape', () => {
  it('returns all required fields as finite numbers / strings', () => {
    const log = buildFlatLog({ daily: 10, days: 200 })
    const r = analyzeSeasonAnchor({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(typeof r.band).toBe('string')
    expect(typeof r.anchorDate).toBe('string')
    expect(typeof r.peakDate).toBe('string')
    expect(Number.isInteger(r.anchor4wTss)).toBe(true)
    expect(Number.isInteger(r.currentLast4wTss)).toBe(true)
    expect(Number.isInteger(r.peak4wTss)).toBe(true)
    expect(Number.isInteger(r.daysSinceAnchor)).toBe(true)
    expect(Number.isFinite(r.rampRatio)).toBe(true)
  })

  it('exposes Hägglund 2013 / Bompa 2018 citation', () => {
    const log = buildFlatLog({ daily: 10, days: 200 })
    const r = analyzeSeasonAnchor({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.citation).toBe(SEASON_ANCHOR_CITATION)
    expect(r.citation).toMatch(/Hägglund 2013/)
    expect(r.citation).toMatch(/Bompa 2018/)
  })

  it('rampRatio is rounded to 2dp', () => {
    const log = buildTwoTierLog({
      firstDaily: 5, firstDays: 100, secondDaily: 7, secondDays: 100,
    })
    const r = analyzeSeasonAnchor({ log, today: TODAY })
    expect(r).not.toBeNull()
    // 196/140 = 1.40 exactly, so toFixed(2) = '1.40'
    expect(r.rampRatio.toFixed(2)).toBe('1.40')
  })

  it('daysSinceAnchor matches anchorDate offset from today', () => {
    const log = buildFlatLog({ daily: 10, days: 200 })
    const r = analyzeSeasonAnchor({ log, today: TODAY })
    expect(r).not.toBeNull()
    // Earliest valid window-end day for a 200-day log = today - 172.
    expect(r.daysSinceAnchor).toBe(172)
  })

  it('anchor4wTss <= currentLast4wTss for monotone ramp', () => {
    const log = buildTwoTierLog({
      firstDaily: 5, firstDays: 100, secondDaily: 10, secondDays: 100,
    })
    const r = analyzeSeasonAnchor({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.anchor4wTss).toBeLessThanOrEqual(r.currentLast4wTss)
  })
})

// ─── edge cases ─────────────────────────────────────────────────────────

describe('analyzeSeasonAnchor — edge cases', () => {
  it('all-zero-TSS log with sufficient history returns all-zero stats', () => {
    const log = buildFlatLog({ daily: 0, days: 200 })
    const r = analyzeSeasonAnchor({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.anchor4wTss).toBe(0)
    expect(r.currentLast4wTss).toBe(0)
    expect(r.peak4wTss).toBe(0)
    // 0 / max(0,1) = 0, but band logic with rampRatio < 1.10 → AT_ANCHOR.
    expect(r.band).toBe('AT_ANCHOR')
  })

  it('sparse log with gaps still produces a result', () => {
    // Sessions only every other day for 200 days @ tss=20.
    const log = []
    for (let i = 199; i >= 0; i -= 2) {
      log.push({ date: isoMinusDays(TODAY, i), tss: 20 })
    }
    const r = analyzeSeasonAnchor({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.anchor4wTss).toBeGreaterThan(0)
    expect(r.currentLast4wTss).toBeGreaterThan(0)
  })

  it('ignores non-ISO date entries gracefully', () => {
    const log = buildFlatLog({ daily: 10, days: 200 })
    log.push({ date: 'garbage', tss: 9999 })
    log.push({ date: null, tss: 9999 })
    log.push({ date: '2026/05/01', tss: 9999 })
    const r = analyzeSeasonAnchor({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.currentLast4wTss).toBe(280)
  })

  it('ignores non-finite tss entries gracefully', () => {
    const log = buildFlatLog({ daily: 10, days: 200 })
    log.push({ date: TODAY, tss: NaN })
    log.push({ date: TODAY, tss: 'not-a-number' })
    log.push({ date: TODAY, tss: undefined })
    const r = analyzeSeasonAnchor({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.currentLast4wTss).toBe(280)
  })

  it('sums multiple sessions on the same day', () => {
    // Two sessions on each day, total = 20 daily.
    const log = []
    for (let i = 199; i >= 0; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: 10 })
      log.push({ date: isoMinusDays(TODAY, i), tss: 10 })
    }
    const r = analyzeSeasonAnchor({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.currentLast4wTss).toBe(560)
  })

  it('accepts ISO with time suffix on entry dates', () => {
    const log = buildFlatLog({ daily: 10, days: 200 })
    // Mutate dates to have time suffix; the function should slice to YYYY-MM-DD.
    const richLog = log.map(e => ({ date: e.date + 'T12:00:00Z', tss: e.tss }))
    const r = analyzeSeasonAnchor({ log: richLog, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.currentLast4wTss).toBe(280)
  })

  it('handles a log that ends before today (no recent sessions)', () => {
    // 200 days of training ending 10 days before TODAY.
    const log = []
    for (let i = 209; i >= 10; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: 10 })
    }
    const r = analyzeSeasonAnchor({ log, today: TODAY })
    expect(r).not.toBeNull()
    // currentLast4wTss reflects the trailing 28d with the last 10 days empty.
    expect(r.currentLast4wTss).toBeLessThan(280)
  })
})

// ─── system-time determinism ────────────────────────────────────────────

describe('analyzeSeasonAnchor — system time stability', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-05-17T12:00:00Z'))
  })
  afterEach(() => {
    vi.setSystemTime(new Date())
  })

  it('produces identical output on rerun with the same inputs', () => {
    const log = buildFlatLog({ daily: 10, days: 200 })
    const a = analyzeSeasonAnchor({ log, today: TODAY })
    const b = analyzeSeasonAnchor({ log, today: TODAY })
    expect(a).toEqual(b)
  })

  it('current matches the trailing 28-day sum directly', () => {
    const log = buildTwoTierLog({
      firstDaily: 5, firstDays: 100, secondDaily: 9, secondDays: 100,
    })
    const r = analyzeSeasonAnchor({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.currentLast4wTss).toBe(9 * 28)
  })

  it('anchor reflects the trailing 28-day sum of the earliest valid window', () => {
    const log = buildTwoTierLog({
      firstDaily: 5, firstDays: 100, secondDaily: 9, secondDays: 100,
    })
    const r = analyzeSeasonAnchor({ log, today: TODAY })
    expect(r).not.toBeNull()
    // The lowest 28-day window sits entirely in the early daily=5 region: 140.
    expect(r.anchor4wTss).toBe(5 * 28)
  })
})
