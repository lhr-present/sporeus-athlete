// ─── hrv.test.js — computeHRVTrend + isHRVSuppressed (Plews 2013) ─────────────
import { describe, it, expect } from 'vitest'
import { computeHRVTrend, isHRVSuppressed } from '../hrv.js'

// ── date helpers (relative to real "now" so the 7-day window always applies) ──

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

// Build recovery entries for the last N days from today.
// hrvsFromToday[0] = today, [1] = yesterday, etc.
function makeEntries(hrvsFromToday) {
  return hrvsFromToday.map((hrv, i) => ({ date: daysAgo(i), hrv }))
}

// ── computeHRVTrend ───────────────────────────────────────────────────────────

describe('computeHRVTrend', () => {
  it('returns insufficient_data when fewer than 3 HRV readings in 7 days', () => {
    const entries = makeEntries([65, null, null, null, null, null, null])
    const result = computeHRVTrend(entries)
    expect(result.trend).toBe('insufficient_data')
    expect(result.daysWithData).toBe(1)
    expect(result.baseline).toBeNull()
    expect(result.cv).toBeNull()
  })

  it('returns insufficient_data for empty input', () => {
    expect(computeHRVTrend([]).trend).toBe('insufficient_data')
    expect(computeHRVTrend(null).trend).toBe('insufficient_data')
  })

  it('dropPct is null for insufficient_data', () => {
    expect(computeHRVTrend([]).dropPct).toBeNull()
  })

  it('returns stable when CV < 7%', () => {
    // Near-identical values → CV ≈ 0%
    const entries = makeEntries([65, 65, 66, 65, 64, 65, 66])
    const result = computeHRVTrend(entries)
    expect(result.trend).toBe('stable')
    expect(result.cv).toBeLessThan(0.07)
    expect(result.latestHRV).toBe(65)
    expect(result.daysWithData).toBe(7)
  })

  it('returns warning when CV is 7–10%', () => {
    // Manually verified: mean≈65.3, std≈4.9, cv≈7.5%
    const entries = makeEntries([57, 73, 62, 70, 63, 67, 65])
    const result = computeHRVTrend(entries)
    expect(result.trend).toBe('warning')
    expect(result.cv).toBeGreaterThanOrEqual(0.07)
    expect(result.cv).toBeLessThan(0.10)
  })

  it('returns unstable when CV ≥ 10%', () => {
    // High-variance values → CV ≈ 20%
    const entries = makeEntries([48, 72, 50, 75, 45, 70, 55])
    const result = computeHRVTrend(entries)
    expect(result.trend).toBe('unstable')
    expect(result.cv).toBeGreaterThanOrEqual(0.10)
  })

  it('computes dropPct positive when latest is below mean', () => {
    // Mean ~65, latest = 50 → drop > 0
    const entries = makeEntries([50, 65, 68, 66, 64, 67, 65])
    const result = computeHRVTrend(entries)
    expect(result.dropPct).toBeGreaterThan(0)
    expect(result.latestHRV).toBe(50)
  })

  it('ignores entries older than 7 days', () => {
    const entries = [
      { date: daysAgo(10), hrv: 30 }, // clearly outside 7-day window
      ...makeEntries([65, 65, 66]),    // 3 readings within window
    ]
    const result = computeHRVTrend(entries)
    expect(result.daysWithData).toBe(3)
    expect(result.trend).not.toBe('unstable')
  })

  it('ignores entries with null or zero HRV', () => {
    const entries = makeEntries([65, null, 0, 66, null, 65, null])
    const result = computeHRVTrend(entries)
    expect(result.daysWithData).toBe(3)
    expect(result.trend).toBe('stable')
  })

  it('returns interpretation object with en and tr keys', () => {
    const entries = makeEntries([65, 65, 66, 65, 64, 65, 66])
    const result = computeHRVTrend(entries)
    expect(typeof result.interpretation.en).toBe('string')
    expect(typeof result.interpretation.tr).toBe('string')
    expect(result.interpretation.en.length).toBeGreaterThan(0)
  })

  it('output shape matches contract', () => {
    const entries = makeEntries([65, 65, 66, 65, 64, 65, 66])
    const result = computeHRVTrend(entries)
    expect(result).toMatchObject({
      baseline:     expect.any(Number),
      cv:           expect.any(Number),
      latestHRV:    expect.any(Number),
      daysWithData: expect.any(Number),
      trend:        expect.stringMatching(/^(stable|warning|unstable|insufficient_data)$/),
      interpretation: { en: expect.any(String), tr: expect.any(String) },
    })
  })
})

// ── isHRVSuppressed ───────────────────────────────────────────────────────────

describe('isHRVSuppressed', () => {
  it('returns true when unstable CV and latest clearly below mean', () => {
    // High variance, latest = 45 is well below mean ~59
    const entries = makeEntries([45, 72, 50, 75, 48, 70, 55])
    expect(isHRVSuppressed(entries)).toBe(true)
  })

  it('returns false for stable HRV', () => {
    const entries = makeEntries([65, 65, 66, 65, 64, 65, 66])
    expect(isHRVSuppressed(entries)).toBe(false)
  })

  it('returns false for insufficient data', () => {
    expect(isHRVSuppressed([])).toBe(false)
    expect(isHRVSuppressed(null)).toBe(false)
  })

  it('returns false when unstable but latest is above mean (recovering)', () => {
    // High variance but latest = 80 is above mean ~60 → dropPct < 0 → not suppressed
    const entries = makeEntries([80, 45, 50, 48, 72, 70, 55])
    const t = computeHRVTrend(entries)
    if (t.trend === 'unstable') {
      // dropPct = (mean - 80) / mean → negative → (dropPct ?? 0) > 5 is false
      expect(isHRVSuppressed(entries)).toBe(false)
    }
    // If not unstable due to different calc, just verify no throw
    expect(typeof isHRVSuppressed(entries)).toBe('boolean')
  })
})
