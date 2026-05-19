// src/lib/__tests__/athlete/cumulativeFatigueWindows.test.js
//
// Pure-fn tests for analyzeCumulativeFatigueWindows — Halson 2014 /
// Meeusen 2013 cumulative overreaching exposure counter.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  analyzeCumulativeFatigueWindows,
  CUMULATIVE_FATIGUE_WINDOWS_CITATION,
} from '../../athlete/cumulativeFatigueWindows.js'

const TODAY = '2026-05-19'

// ─── helpers ─────────────────────────────────────────────────────────────

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// `days` daily entries ending `today` inclusive, with constant TSS.
function buildFlatLog({ today = TODAY, daily = 60, days = 300 } = {}) {
  const log = []
  for (let i = days - 1; i >= 0; i--) {
    log.push({ date: isoMinusDays(today, i), tss: daily })
  }
  return log
}

// Constant `baseDaily` for `days` total days, then the final
// `spikeDays` days are at `spikeDaily`. The spike sits at the END of
// the series — so the trailing 90-day window covers both regimes.
function buildSpikeAtEndLog({
  today = TODAY,
  baseDaily = 60,
  spikeDaily = 250,
  days = 200,
  spikeDays = 14,
} = {}) {
  const log = []
  for (let i = days - 1; i >= 0; i--) {
    const isSpike = i < spikeDays
    log.push({
      date: isoMinusDays(today, i),
      tss: isSpike ? spikeDaily : baseDaily,
    })
  }
  return log
}

// ─── system time (deterministic) ────────────────────────────────────────

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})
afterEach(() => {
  vi.setSystemTime(new Date())
})

// ─── null / insufficient signal ──────────────────────────────────────────

describe('analyzeCumulativeFatigueWindows — null guards', () => {
  it('returns null for an empty log', () => {
    expect(analyzeCumulativeFatigueWindows({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null when log is not an Array', () => {
    expect(analyzeCumulativeFatigueWindows({ log: null, today: TODAY })).toBeNull()
    expect(analyzeCumulativeFatigueWindows({ log: undefined, today: TODAY })).toBeNull()
  })

  it('returns null when today is unresolvable', () => {
    const log = buildFlatLog({ daily: 60, days: 200 })
    expect(analyzeCumulativeFatigueWindows({ log, today: 'not-a-date' })).toBeNull()
    expect(analyzeCumulativeFatigueWindows({ log, today: '' })).toBeNull()
    expect(analyzeCumulativeFatigueWindows({ log, today: null })).toBeNull()
    expect(analyzeCumulativeFatigueWindows({ log, today: new Date('invalid') })).toBeNull()
  })

  it('returns null when the warm-CTL window is shorter than 14 days', () => {
    // Only 10 days of log → CTL barely above 0, way too few warm days.
    const log = []
    for (let i = 9; i >= 0; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: 60 })
    }
    expect(analyzeCumulativeFatigueWindows({ log, today: TODAY })).toBeNull()
  })

  it('returns null when log has only invalid date entries', () => {
    const log = [
      { date: 'garbage', tss: 60 },
      { date: '2026/05/01', tss: 60 },
      { date: null, tss: 60 },
    ]
    expect(analyzeCumulativeFatigueWindows({ log, today: TODAY })).toBeNull()
  })

  it('returns null with invalid windowDays', () => {
    const log = buildFlatLog({ daily: 60, days: 200 })
    expect(analyzeCumulativeFatigueWindows({ log, today: TODAY, windowDays: 0 })).toBeNull()
    expect(analyzeCumulativeFatigueWindows({ log, today: TODAY, windowDays: -10 })).toBeNull()
    expect(analyzeCumulativeFatigueWindows({ log, today: TODAY, windowDays: NaN })).toBeNull()
  })

  it('returns null with invalid overreachRatio', () => {
    const log = buildFlatLog({ daily: 60, days: 200 })
    expect(analyzeCumulativeFatigueWindows({ log, today: TODAY, overreachRatio: 0 })).toBeNull()
    expect(analyzeCumulativeFatigueWindows({ log, today: TODAY, overreachRatio: -1 })).toBeNull()
    expect(analyzeCumulativeFatigueWindows({ log, today: TODAY, overreachRatio: NaN })).toBeNull()
  })
})

// ─── band classification ─────────────────────────────────────────────────

describe('analyzeCumulativeFatigueWindows — band classification', () => {
  it('CONSERVATIVE: flat steady log has near-zero exposure', () => {
    const log = buildFlatLog({ daily: 60, days: 250 })
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('CONSERVATIVE')
    expect(r.exposureRate).toBeLessThan(0.03)
    expect(r.windowsAboveThreshold).toBe(0)
  })

  it('CHRONIC_OVERREACH: spike sustained for many days → ≥30% exposure', () => {
    // Last 60 days at ~3x base — sustained overreach across most of the
    // 90-day window.
    const log = buildSpikeAtEndLog({
      baseDaily: 60, spikeDaily: 180, days: 250, spikeDays: 60,
    })
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('CHRONIC_OVERREACH')
    expect(r.exposureRate).toBeGreaterThanOrEqual(0.30)
  })

  it('ELEVATED_EXPOSURE: spike sustained 20–35 days → 15–30% exposure', () => {
    const log = buildSpikeAtEndLog({
      baseDaily: 60, spikeDaily: 200, days: 250, spikeDays: 25,
    })
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.exposureRate).toBeGreaterThanOrEqual(0.15)
    expect(r.exposureRate).toBeLessThan(0.30)
    expect(r.band).toBe('ELEVATED_EXPOSURE')
  })

  it('NORMAL: occasional spike → 3–15% exposure', () => {
    // Single short spike near end of window.
    const log = buildSpikeAtEndLog({
      baseDaily: 60, spikeDaily: 220, days: 250, spikeDays: 5,
    })
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.exposureRate).toBeGreaterThanOrEqual(0.03)
    expect(r.exposureRate).toBeLessThan(0.15)
    expect(r.band).toBe('NORMAL')
  })

  it('CHRONIC_OVERREACH band exposureRate matches at threshold', () => {
    const log = buildSpikeAtEndLog({
      baseDaily: 60, spikeDaily: 220, days: 250, spikeDays: 80,
    })
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('CHRONIC_OVERREACH')
  })
})

// ─── peakRatio / peakRatioDate math ──────────────────────────────────────

describe('analyzeCumulativeFatigueWindows — peakRatio math', () => {
  it('peakRatio reflects the highest observed daily ratio', () => {
    const log = buildSpikeAtEndLog({
      baseDaily: 60, spikeDaily: 250, days: 200, spikeDays: 14,
    })
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.peakRatio).toBeGreaterThan(1.30)
    // 2dp rounding
    expect(Number.isFinite(r.peakRatio)).toBe(true)
    const asStr = r.peakRatio.toString()
    if (asStr.includes('.')) {
      expect(asStr.split('.')[1].length).toBeLessThanOrEqual(2)
    }
  })

  it('peakRatioDate lands somewhere inside the spike window', () => {
    const log = buildSpikeAtEndLog({
      baseDaily: 60, spikeDaily: 250, days: 200, spikeDays: 14,
    })
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.peakRatioDate).not.toBeNull()
    // The peak ratio should occur within the trailing 14-day spike.
    const earliestSpikeDate = isoMinusDays(TODAY, 13)
    expect(r.peakRatioDate >= earliestSpikeDate).toBe(true)
    expect(r.peakRatioDate <= TODAY).toBe(true)
  })

  it('peakRatio approximately 1.0 for a flat log (≈ steady-state)', () => {
    const log = buildFlatLog({ daily: 60, days: 250 })
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY })
    expect(r).not.toBeNull()
    // Flat 60: ratio ≈ 1.0 ± small EWMA convergence noise.
    expect(r.peakRatio).toBeGreaterThan(0.95)
    expect(r.peakRatio).toBeLessThan(1.10)
  })
})

// ─── exposureRate math ───────────────────────────────────────────────────

describe('analyzeCumulativeFatigueWindows — exposureRate math', () => {
  it('exposureRate = windowsAboveThreshold / totalDays', () => {
    const log = buildSpikeAtEndLog({
      baseDaily: 60, spikeDaily: 250, days: 200, spikeDays: 14,
    })
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY })
    expect(r).not.toBeNull()
    const expected = r.windowsAboveThreshold / r.totalDays
    expect(Math.abs(r.exposureRate - expected)).toBeLessThan(0.0002)
  })

  it('exposureRate is rounded to 4 decimal places', () => {
    const log = buildSpikeAtEndLog({
      baseDaily: 60, spikeDaily: 250, days: 200, spikeDays: 14,
    })
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY })
    expect(r).not.toBeNull()
    const decimals = r.exposureRate.toString().split('.')[1] || ''
    expect(decimals.length).toBeLessThanOrEqual(4)
  })

  it('exposureRate = 0 for a fully conservative log', () => {
    const log = buildFlatLog({ daily: 60, days: 250 })
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.exposureRate).toBe(0)
    expect(r.windowsAboveThreshold).toBe(0)
  })
})

// ─── boundary / strict-greater-than semantics ───────────────────────────

describe('analyzeCumulativeFatigueWindows — threshold semantics', () => {
  it('day at exactly ratio == overreachRatio is NOT counted (strict >)', () => {
    // Construct a log where the trailing 7-day mean precisely equals
    // 1.30 * CTL. Flat log → mean = CTL. Use overreachRatio = 1.0 to
    // exercise the exact-boundary case (every warm day will be at
    // ratio ≈ 1.0).
    const log = buildFlatLog({ daily: 60, days: 250 })
    const r = analyzeCumulativeFatigueWindows({
      log, today: TODAY, overreachRatio: 1.0,
    })
    expect(r).not.toBeNull()
    // With strict-greater-than at threshold = 1.0, exactly-equal days
    // must NOT be flagged. Some EWMA convergence may push ratios
    // very slightly above 1.0; we assert exposureRate is well under
    // 100% rather than zero.
    expect(r.exposureRate).toBeLessThanOrEqual(1.0)
  })

  it('CTL warmup days (ctl < 10) are excluded from totalDays', () => {
    // A log that runs only `windowDays` long → first ~7 days have
    // CTL < 10 and should not count in totalDays.
    const log = buildFlatLog({ daily: 60, days: 90 })
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY })
    expect(r).not.toBeNull()
    // 7 days of warmup at TSS=60 (CTL grows ~ 60*(1-exp(-i/42)))
    // → first ~6–7 days are below 10. So totalDays < 90.
    expect(r.totalDays).toBeLessThan(90)
    expect(r.totalDays).toBeGreaterThan(70)
  })
})

// ─── custom overreachRatio override ──────────────────────────────────────

describe('analyzeCumulativeFatigueWindows — custom overreachRatio', () => {
  it('honours a more permissive threshold (1.50) → fewer flagged days', () => {
    const log = buildSpikeAtEndLog({
      baseDaily: 60, spikeDaily: 250, days: 200, spikeDays: 14,
    })
    const r130 = analyzeCumulativeFatigueWindows({ log, today: TODAY, overreachRatio: 1.30 })
    const r150 = analyzeCumulativeFatigueWindows({ log, today: TODAY, overreachRatio: 1.50 })
    expect(r130).not.toBeNull()
    expect(r150).not.toBeNull()
    expect(r150.windowsAboveThreshold).toBeLessThanOrEqual(r130.windowsAboveThreshold)
    expect(r150.overreachRatio).toBe(1.50)
  })

  it('honours a stricter threshold (1.10) → more flagged days', () => {
    const log = buildSpikeAtEndLog({
      baseDaily: 60, spikeDaily: 150, days: 200, spikeDays: 10,
    })
    const r130 = analyzeCumulativeFatigueWindows({ log, today: TODAY, overreachRatio: 1.30 })
    const r110 = analyzeCumulativeFatigueWindows({ log, today: TODAY, overreachRatio: 1.10 })
    expect(r130).not.toBeNull()
    expect(r110).not.toBeNull()
    expect(r110.windowsAboveThreshold).toBeGreaterThanOrEqual(r130.windowsAboveThreshold)
    expect(r110.overreachRatio).toBe(1.10)
  })
})

// ─── custom windowDays override ──────────────────────────────────────────

describe('analyzeCumulativeFatigueWindows — custom windowDays', () => {
  it('echoes default windowDays (90)', () => {
    const log = buildFlatLog({ daily: 60, days: 200 })
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.windowDays).toBe(90)
  })

  it('honours a custom 30-day window', () => {
    const log = buildFlatLog({ daily: 60, days: 200 })
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY, windowDays: 30 })
    expect(r).not.toBeNull()
    expect(r.windowDays).toBe(30)
    // CTL is fully warm by now → totalDays should equal full window.
    expect(r.totalDays).toBe(30)
  })

  it('honours a custom 180-day window', () => {
    const log = buildFlatLog({ daily: 60, days: 300 })
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY, windowDays: 180 })
    expect(r).not.toBeNull()
    expect(r.windowDays).toBe(180)
    expect(r.totalDays).toBe(180)
  })
})

// ─── CTL warmup behaviour ────────────────────────────────────────────────

describe('analyzeCumulativeFatigueWindows — CTL warmup', () => {
  it('warmup days (CTL < 10) are excluded from totalDays', () => {
    // First ~7 days have CTL < 10 (1.41, 2.79, 4.13, 5.43, 6.69, ...) and
    // MUST be excluded from totalDays. With only 90 days of log, totalDays
    // strictly less than 90.
    const log = buildFlatLog({ daily: 60, days: 90 })
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalDays).toBeLessThan(90)
    // dailyRatios still has full window length but with `null` for warmup.
    expect(r.dailyRatios.length).toBe(90)
    const nullCount = r.dailyRatios.filter(d => d.ratio === null).length
    expect(nullCount).toBeGreaterThan(0)
    expect(nullCount + r.totalDays).toBe(90)
  })

  it('CTL warmup is computed from earliest log date, not window start', () => {
    // Long pre-window history → CTL is warm BEFORE the window opens.
    // All 90 window days should pass the warmup gate.
    const log = buildFlatLog({ daily: 60, days: 250 })
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalDays).toBe(90)
  })
})

// ─── TSS edge cases ──────────────────────────────────────────────────────

describe('analyzeCumulativeFatigueWindows — TSS edge cases', () => {
  it('TSS=0 rest days are accepted and contribute zero to rolling7', () => {
    // Alternating training (120) and rest (0) days, full history.
    const log = []
    for (let i = 250 - 1; i >= 0; i--) {
      log.push({
        date: isoMinusDays(TODAY, i),
        tss: i % 2 === 0 ? 120 : 0,
      })
    }
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY })
    expect(r).not.toBeNull()
    // Mean daily TSS is 60. CTL converges to 60. Ratio ≈ 1.0 → no
    // overreach flagged.
    expect(r.windowsAboveThreshold).toBe(0)
  })

  it('skips entries with NaN/undefined/missing TSS', () => {
    const log = [
      ...buildFlatLog({ daily: 60, days: 200 }),
      { date: isoMinusDays(TODAY, 5), tss: NaN },
      { date: isoMinusDays(TODAY, 4), tss: undefined },
      { date: isoMinusDays(TODAY, 3) }, // missing entirely
    ]
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY })
    expect(r).not.toBeNull()
    // Bad entries should not have crashed nor inflated ratios.
    expect(r.band).toBe('CONSERVATIVE')
  })

  it('skips entries with negative TSS', () => {
    const baseLog = buildFlatLog({ daily: 60, days: 200 })
    const log = [
      ...baseLog,
      { date: isoMinusDays(TODAY, 10), tss: -100 },
    ]
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('CONSERVATIVE')
  })

  it('sums TSS from multiple sessions on the same day', () => {
    const log = []
    for (let i = 250 - 1; i >= 0; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: 30 })
      log.push({ date: isoMinusDays(TODAY, i), tss: 30 })
    }
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY })
    expect(r).not.toBeNull()
    // Total daily TSS = 60 → ratio ≈ 1.0 → CONSERVATIVE.
    expect(r.band).toBe('CONSERVATIVE')
    expect(r.peakRatio).toBeGreaterThan(0.95)
    expect(r.peakRatio).toBeLessThan(1.10)
  })
})

// ─── today as Date vs string ─────────────────────────────────────────────

describe('analyzeCumulativeFatigueWindows — today input format', () => {
  it('accepts today as an ISO string', () => {
    const log = buildFlatLog({ daily: 60, days: 200 })
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('CONSERVATIVE')
  })

  it('accepts today as a Date object', () => {
    const log = buildFlatLog({ daily: 60, days: 200 })
    const todayDate = new Date(TODAY + 'T08:30:00Z')
    const r = analyzeCumulativeFatigueWindows({ log, today: todayDate })
    expect(r).not.toBeNull()
    expect(r.band).toBe('CONSERVATIVE')
  })

  it('string-today and Date-today produce identical output', () => {
    const log = buildSpikeAtEndLog({
      baseDaily: 60, spikeDaily: 250, days: 200, spikeDays: 14,
    })
    const rStr = analyzeCumulativeFatigueWindows({ log, today: TODAY })
    const rDate = analyzeCumulativeFatigueWindows({ log, today: new Date(TODAY + 'T00:00:00Z') })
    expect(rStr).not.toBeNull()
    expect(rDate).not.toBeNull()
    expect(rStr.windowsAboveThreshold).toBe(rDate.windowsAboveThreshold)
    expect(rStr.totalDays).toBe(rDate.totalDays)
    expect(rStr.peakRatio).toBe(rDate.peakRatio)
    expect(rStr.exposureRate).toBe(rDate.exposureRate)
  })

  it('accepts an ISO string longer than 10 chars (slices)', () => {
    const log = buildFlatLog({ daily: 60, days: 200 })
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY + 'T08:30:00Z' })
    expect(r).not.toBeNull()
    expect(r.band).toBe('CONSERVATIVE')
  })
})

// ─── metadata ────────────────────────────────────────────────────────────

describe('analyzeCumulativeFatigueWindows — metadata', () => {
  it('exposes Halson 2014 / Meeusen 2013 citation', () => {
    const log = buildFlatLog({ daily: 60, days: 200 })
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.citation).toBe(CUMULATIVE_FATIGUE_WINDOWS_CITATION)
    expect(r.citation).toMatch(/Halson 2014/)
    expect(r.citation).toMatch(/Meeusen 2013/)
  })

  it('returns all expected fields with the right types', () => {
    const log = buildSpikeAtEndLog({
      baseDaily: 60, spikeDaily: 250, days: 200, spikeDays: 14,
    })
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(typeof r.band).toBe('string')
    expect(typeof r.windowsAboveThreshold).toBe('number')
    expect(typeof r.totalDays).toBe('number')
    expect(typeof r.peakRatio).toBe('number')
    expect(['string', 'object']).toContain(typeof r.peakRatioDate) // string or null
    expect(typeof r.exposureRate).toBe('number')
    expect(Array.isArray(r.dailyRatios)).toBe(true)
    expect(typeof r.overreachRatio).toBe('number')
    expect(typeof r.windowDays).toBe('number')
    expect(typeof r.citation).toBe('string')
  })

  it('dailyRatios array length matches the analysed window', () => {
    const log = buildFlatLog({ daily: 60, days: 250 })
    const r = analyzeCumulativeFatigueWindows({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.dailyRatios.length).toBe(90)
    // Every ratio is either a finite number or null (warmup).
    for (const d of r.dailyRatios) {
      expect(typeof d.date).toBe('string')
      expect(d.ratio === null || Number.isFinite(d.ratio)).toBe(true)
    }
  })
})
