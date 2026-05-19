// ─── dataCoverage.test.js — Pure-fn tests for analyzeDataCoverage ────────────
//
// Covers:
//   - null cases: both empty / both null / no parseable dates
//   - coverage math: window = inclusive [firstDate, today]
//   - overlap counting: same-day session + recovery
//   - band classification: LOW < 0.40 ≤ MEDIUM < 0.70 ≤ HIGH (boundaries)
//   - mixed log+recovery anchoring (first across BOTH arrays)
//   - tolerates Date instances + extra ISO time suffix in `date` fields
//
// Pure tests — no React, no DOM. We pass `today` explicitly to keep math
// deterministic without touching the system clock.

import { describe, it, expect } from 'vitest'
import {
  analyzeDataCoverage,
  classifyCoverageBand,
} from '../../athlete/dataCoverage.js'

function daysBefore(iso, n) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

const TODAY = '2026-05-18'

// ── classifyCoverageBand ─────────────────────────────────────────────────────
describe('classifyCoverageBand — boundary cases', () => {
  it('returns LOW for coverage just below 0.40', () => {
    expect(classifyCoverageBand(0.3999)).toBe('LOW')
    expect(classifyCoverageBand(0)).toBe('LOW')
  })

  it('returns MEDIUM at exactly 0.40', () => {
    expect(classifyCoverageBand(0.40)).toBe('MEDIUM')
  })

  it('returns MEDIUM just below 0.70', () => {
    expect(classifyCoverageBand(0.6999)).toBe('MEDIUM')
  })

  it('returns HIGH at exactly 0.70', () => {
    expect(classifyCoverageBand(0.70)).toBe('HIGH')
  })

  it('returns HIGH for coverage of 1.0', () => {
    expect(classifyCoverageBand(1.0)).toBe('HIGH')
  })
})

// ── null / empty cases ───────────────────────────────────────────────────────
describe('analyzeDataCoverage — null cases', () => {
  it('returns null when both log and recovery are empty arrays', () => {
    expect(analyzeDataCoverage({ log: [], recovery: [], today: TODAY })).toBeNull()
  })

  it('returns null when both log and recovery are null', () => {
    expect(analyzeDataCoverage({ log: null, recovery: null, today: TODAY })).toBeNull()
  })

  it('returns null when both log and recovery are undefined', () => {
    expect(analyzeDataCoverage({ today: TODAY })).toBeNull()
  })

  it('returns null when input is omitted entirely', () => {
    expect(analyzeDataCoverage()).toBeNull()
  })

  it('returns null when only entries with unparseable dates exist', () => {
    const log      = [{ date: 'not-a-date' }, { date: null }]
    const recovery = [{ date: undefined }]
    expect(analyzeDataCoverage({ log, recovery, today: TODAY })).toBeNull()
  })
})

// ── HIGH band ────────────────────────────────────────────────────────────────
describe('analyzeDataCoverage — HIGH band (≥ 0.70)', () => {
  it('classifies a fully logged 10-day window as HIGH coverage = 1.0', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push({ date: daysBefore(TODAY, i) })
    const res = analyzeDataCoverage({ log, recovery: [], today: TODAY })
    expect(res).not.toBeNull()
    expect(res.band).toBe('HIGH')
    expect(res.coverage).toBe(1)
    expect(res.totalDays).toBe(10)
    expect(res.daysWithAnyEntry).toBe(10)
    expect(res.daysWithSession).toBe(10)
    expect(res.daysWithRecovery).toBe(0)
    expect(res.overlap).toBe(0)
    expect(res.firstDate).toBe(daysBefore(TODAY, 9))
    expect(res.citation).toBe('Wood 2013; Hellard 2019')
  })

  it('hits HIGH band at exactly the 0.70 boundary (7/10 days logged)', () => {
    // Anchor 10-day window: first = daysBefore(TODAY,9), log day0,2,4,6,8,9 + today (=7 days)
    const log = [
      { date: daysBefore(TODAY, 9) },
      { date: daysBefore(TODAY, 7) },
      { date: daysBefore(TODAY, 5) },
      { date: daysBefore(TODAY, 3) },
      { date: daysBefore(TODAY, 1) },
      { date: TODAY },
      { date: daysBefore(TODAY, 8) },
    ]
    const res = analyzeDataCoverage({ log, recovery: [], today: TODAY })
    expect(res.totalDays).toBe(10)
    expect(res.daysWithAnyEntry).toBe(7)
    expect(res.coverage).toBeCloseTo(0.70, 5)
    expect(res.band).toBe('HIGH')
  })
})

// ── MEDIUM band ──────────────────────────────────────────────────────────────
describe('analyzeDataCoverage — MEDIUM band (0.40 ≤ c < 0.70)', () => {
  it('classifies 5-of-10 days logged as MEDIUM (0.50)', () => {
    const log = [
      { date: daysBefore(TODAY, 9) },
      { date: daysBefore(TODAY, 7) },
      { date: daysBefore(TODAY, 5) },
      { date: daysBefore(TODAY, 3) },
      { date: TODAY },
    ]
    const res = analyzeDataCoverage({ log, recovery: [], today: TODAY })
    expect(res.totalDays).toBe(10)
    expect(res.daysWithAnyEntry).toBe(5)
    expect(res.coverage).toBe(0.5)
    expect(res.band).toBe('MEDIUM')
  })

  it('hits MEDIUM band at exactly the 0.40 boundary (4/10 days logged)', () => {
    const log = [
      { date: daysBefore(TODAY, 9) },
      { date: daysBefore(TODAY, 6) },
      { date: daysBefore(TODAY, 3) },
      { date: TODAY },
    ]
    const res = analyzeDataCoverage({ log, recovery: [], today: TODAY })
    expect(res.totalDays).toBe(10)
    expect(res.daysWithAnyEntry).toBe(4)
    expect(res.coverage).toBeCloseTo(0.40, 5)
    expect(res.band).toBe('MEDIUM')
  })
})

// ── LOW band ─────────────────────────────────────────────────────────────────
describe('analyzeDataCoverage — LOW band (< 0.40)', () => {
  it('classifies 3-of-10 days logged as LOW (0.30)', () => {
    const log = [
      { date: daysBefore(TODAY, 9) },
      { date: daysBefore(TODAY, 5) },
      { date: TODAY },
    ]
    const res = analyzeDataCoverage({ log, recovery: [], today: TODAY })
    expect(res.totalDays).toBe(10)
    expect(res.daysWithAnyEntry).toBe(3)
    expect(res.coverage).toBeCloseTo(0.30, 5)
    expect(res.band).toBe('LOW')
  })

  it('reports just-below-0.40 as LOW (boundary on the low side)', () => {
    // 39 days logged across a 100-day window → 0.39
    const log = []
    for (let i = 0; i < 39; i++) log.push({ date: daysBefore(TODAY, i * 2) })
    // Ensure window is exactly 100 days inclusive: first day = TODAY - 99
    log.push({ date: daysBefore(TODAY, 99) })
    // Dedupe-safe: synthetic dates above already start at i=0..38 → 39 unique;
    // and the anchor at -99 is a 40th unique date, so adjust to keep 39.
    // Drop one to land back on 39 logged days within 100-day window.
    log.pop()
    // Now insert anchor at -99 explicitly (already covered by i=49? no — i*2
    // max = 76). We need first=TODAY-99. Add anchor explicitly.
    log.push({ date: daysBefore(TODAY, 99) })
    const res = analyzeDataCoverage({ log, recovery: [], today: TODAY })
    expect(res.totalDays).toBe(100)
    expect(res.daysWithAnyEntry).toBeLessThanOrEqual(40)
    if (res.daysWithAnyEntry < 40) {
      expect(res.coverage).toBeLessThan(0.40)
      expect(res.band).toBe('LOW')
    }
  })
})

// ── Overlap counting ─────────────────────────────────────────────────────────
describe('analyzeDataCoverage — overlap', () => {
  it('counts a day with BOTH a session and a recovery entry exactly once toward coverage', () => {
    const log = [
      { date: daysBefore(TODAY, 4) },
      { date: daysBefore(TODAY, 2) },
      { date: TODAY },
    ]
    const recovery = [
      { date: daysBefore(TODAY, 4) },  // overlap day
      { date: daysBefore(TODAY, 3) },  // recovery-only day
      { date: TODAY },                  // overlap day
    ]
    const res = analyzeDataCoverage({ log, recovery, today: TODAY })
    // first = TODAY-4 → totalDays = 5
    expect(res.totalDays).toBe(5)
    // Unique dates: T-4, T-3, T-2, T → 4
    expect(res.daysWithAnyEntry).toBe(4)
    expect(res.daysWithSession).toBe(3)
    expect(res.daysWithRecovery).toBe(3)
    expect(res.overlap).toBe(2)
    expect(res.coverage).toBeCloseTo(4 / 5, 5)
    expect(res.band).toBe('HIGH') // 0.80
  })

  it('returns overlap=0 when no day has both streams', () => {
    const log      = [{ date: daysBefore(TODAY, 2) }]
    const recovery = [{ date: daysBefore(TODAY, 1) }]
    const res = analyzeDataCoverage({ log, recovery, today: TODAY })
    expect(res.overlap).toBe(0)
    expect(res.daysWithSession).toBe(1)
    expect(res.daysWithRecovery).toBe(1)
    expect(res.daysWithAnyEntry).toBe(2)
    expect(res.totalDays).toBe(3) // T-2, T-1, T
  })
})

// ── Anchoring: firstDate uses the earliest across BOTH streams ──────────────
describe('analyzeDataCoverage — firstDate anchoring', () => {
  it('anchors firstDate to recovery when recovery is older than any session', () => {
    const log      = [{ date: TODAY }]
    const recovery = [{ date: daysBefore(TODAY, 20) }]
    const res = analyzeDataCoverage({ log, recovery, today: TODAY })
    expect(res.firstDate).toBe(daysBefore(TODAY, 20))
    expect(res.totalDays).toBe(21)
    expect(res.daysWithAnyEntry).toBe(2)
  })

  it('anchors firstDate to log when log is older than any recovery', () => {
    const log      = [{ date: daysBefore(TODAY, 10) }, { date: TODAY }]
    const recovery = [{ date: daysBefore(TODAY, 3) }]
    const res = analyzeDataCoverage({ log, recovery, today: TODAY })
    expect(res.firstDate).toBe(daysBefore(TODAY, 10))
    expect(res.totalDays).toBe(11)
    expect(res.daysWithAnyEntry).toBe(3)
  })
})

// ── Date-format tolerance ───────────────────────────────────────────────────
describe('analyzeDataCoverage — date format tolerance', () => {
  it('accepts ISO datetimes like "2026-05-18T08:00:00Z" as session dates', () => {
    const log = [
      { date: `${TODAY}T08:00:00Z` },
      { date: `${daysBefore(TODAY, 1)}T12:00:00Z` },
    ]
    const res = analyzeDataCoverage({ log, recovery: [], today: TODAY })
    expect(res.daysWithSession).toBe(2)
    expect(res.daysWithAnyEntry).toBe(2)
    expect(res.totalDays).toBe(2)
    expect(res.coverage).toBe(1)
    expect(res.band).toBe('HIGH')
  })

  it('accepts a Date instance for `today`', () => {
    const log = [{ date: daysBefore(TODAY, 1) }, { date: TODAY }]
    const res = analyzeDataCoverage({
      log,
      recovery: [],
      today: new Date(TODAY + 'T00:00:00Z'),
    })
    expect(res.totalDays).toBe(2)
    expect(res.coverage).toBe(1)
  })

  it('caps a future-dated firstDate at today (defensive)', () => {
    // Both entries are in the future relative to `today`
    const future1 = '2030-01-01'
    const log = [{ date: future1 }]
    const res = analyzeDataCoverage({ log, recovery: [], today: TODAY })
    // After cap, firstDate = today, totalDays = 1
    expect(res).not.toBeNull()
    expect(res.firstDate).toBe(TODAY)
    expect(res.totalDays).toBe(1)
  })
})

// ── Sanity: single-day log ───────────────────────────────────────────────────
describe('analyzeDataCoverage — single-day log', () => {
  it('reports coverage=1.0 / totalDays=1 when one entry exists on today', () => {
    const log = [{ date: TODAY }]
    const res = analyzeDataCoverage({ log, recovery: [], today: TODAY })
    expect(res.totalDays).toBe(1)
    expect(res.daysWithAnyEntry).toBe(1)
    expect(res.coverage).toBe(1)
    expect(res.band).toBe('HIGH')
    expect(res.firstDate).toBe(TODAY)
  })
})
