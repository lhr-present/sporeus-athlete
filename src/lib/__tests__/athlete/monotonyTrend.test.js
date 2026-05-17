// ─── monotonyTrend.test.js — 4-week monotony/strain trend unit tests ─────────
import { describe, it, expect } from 'vitest'
import {
  computeMonotonyTrend,
  classifyMonotonyBand,
  MONOTONY_TREND_CITATION,
} from '../../athlete/monotonyTrend.js'

// ─── Synthetic log generators ─────────────────────────────────────────────────

/**
 * Build a daily training log of `days` entries ending on `today` (inclusive).
 * Each day's TSS comes from `tssFor(i)` where i=0 is `today` and i=days-1 is
 * the oldest entry.
 */
function makeLog(days, today, tssFor) {
  const log = []
  const base = new Date(`${today}T00:00:00Z`)
  for (let i = 0; i < days; i++) {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() - i)
    log.push({
      date: d.toISOString().slice(0, 10),
      tss: tssFor(i),
      type: 'run',
    })
  }
  return log
}

const TODAY = '2026-04-26' // a Sunday → newest Mon–Sun week = 2026-04-20 → 2026-04-26

// ─── classifyMonotonyBand boundaries ──────────────────────────────────────────
describe('classifyMonotonyBand — band thresholds', () => {
  it('< 1.5 → LOW', () => {
    expect(classifyMonotonyBand(1.49)).toBe('LOW')
    expect(classifyMonotonyBand(0.5)).toBe('LOW')
  })
  it('1.5–1.99 → MODERATE', () => {
    expect(classifyMonotonyBand(1.5)).toBe('MODERATE')
    expect(classifyMonotonyBand(1.99)).toBe('MODERATE')
  })
  it('2.0–2.5 → HIGH', () => {
    expect(classifyMonotonyBand(2.0)).toBe('HIGH')
    expect(classifyMonotonyBand(2.5)).toBe('HIGH')
  })
  it('> 2.5 → VERY_HIGH', () => {
    expect(classifyMonotonyBand(2.51)).toBe('VERY_HIGH')
    expect(classifyMonotonyBand(10)).toBe('VERY_HIGH')
  })
  it('null/undefined/NaN → null', () => {
    expect(classifyMonotonyBand(null)).toBe(null)
    expect(classifyMonotonyBand(undefined)).toBe(null)
    expect(classifyMonotonyBand(NaN)).toBe(null)
  })
})

// ─── computeMonotonyTrend — null cases ────────────────────────────────────────
describe('computeMonotonyTrend — insufficient data', () => {
  it('empty log → null', () => {
    expect(computeMonotonyTrend({ log: [], today: TODAY })).toBeNull()
  })

  it('undefined log → null', () => {
    expect(computeMonotonyTrend({ today: TODAY })).toBeNull()
  })

  it('very small log (<7 entries) → null', () => {
    const log = makeLog(6, TODAY, () => 60)
    expect(computeMonotonyTrend({ log, today: TODAY })).toBeNull()
  })
})

// ─── computeMonotonyTrend — happy path ────────────────────────────────────────
describe('computeMonotonyTrend — band behaviour', () => {
  it('consistent daily TSS across the full 28-day window → HIGH or VERY_HIGH', () => {
    // 4 weeks of near-identical TSS with a tiny perturbation (computeMonotony
    // guards against stdev<1 by returning null, so we need stdev≥1 but small
    // relative to the mean to push monotony past 2.0). Six days at 60, one
    // day at 65 → mean ≈ 60.7, stdev ≈ 1.77, monotony ≈ 34 → VERY_HIGH.
    const log = makeLog(28, TODAY, i => (i % 7 === 0 ? 65 : 60))
    const r = computeMonotonyTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(['HIGH', 'VERY_HIGH']).toContain(r.band)
  })

  it('varied daily TSS (rest days mixed in) → LOW or MODERATE', () => {
    // Alternate hard/rest days → big stdev → low monotony
    const log = makeLog(28, TODAY, i => (i % 2 === 0 ? 120 : 0))
    const r = computeMonotonyTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(['LOW', 'MODERATE']).toContain(r.band)
  })
})

// ─── computeMonotonyTrend — trend array shape ─────────────────────────────────
describe('computeMonotonyTrend — trend array shape', () => {
  it('trend length defaults to 4', () => {
    const log = makeLog(35, TODAY, i => (i % 3 === 0 ? 80 : 40))
    const r = computeMonotonyTrend({ log, today: TODAY })
    expect(r.trend).toHaveLength(4)
  })

  it('trend length honours the `weeks` argument', () => {
    const log = makeLog(60, TODAY, i => (i % 3 === 0 ? 80 : 40))
    const r = computeMonotonyTrend({ log, today: TODAY, weeks: 6 })
    expect(r.trend).toHaveLength(6)
  })

  it('every trend entry exposes a `strain` field', () => {
    const log = makeLog(28, TODAY, i => (i % 4 === 0 ? 90 : 50))
    const r = computeMonotonyTrend({ log, today: TODAY })
    for (const w of r.trend) {
      expect(w).toHaveProperty('strain')
      // strain may be null when monotony is null, otherwise it must be a finite number
      if (w.strain !== null) expect(Number.isFinite(w.strain)).toBe(true)
    }
  })

  it('every trend entry exposes weekStart + weekTss + monotony', () => {
    const log = makeLog(28, TODAY, () => 50)
    const r = computeMonotonyTrend({ log, today: TODAY })
    for (const w of r.trend) {
      expect(w).toHaveProperty('weekStart')
      expect(w).toHaveProperty('weekTss')
      expect(w).toHaveProperty('monotony')
      expect(typeof w.weekStart).toBe('string')
      expect(w.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('trend weekStart dates are 7 days apart, oldest first', () => {
    const log = makeLog(28, TODAY, () => 50)
    const r = computeMonotonyTrend({ log, today: TODAY })
    for (let i = 1; i < r.trend.length; i++) {
      const prev = new Date(`${r.trend[i - 1].weekStart}T00:00:00Z`)
      const curr = new Date(`${r.trend[i].weekStart}T00:00:00Z`)
      const diffDays = (curr - prev) / 86400000
      expect(diffDays).toBe(7)
    }
  })

  it('latest equals the last trend entry monotony', () => {
    const log = makeLog(28, TODAY, i => (i % 5 === 0 ? 100 : 40))
    const r = computeMonotonyTrend({ log, today: TODAY })
    expect(r.latest).toBe(r.trend[r.trend.length - 1].monotony)
  })

  it('citation reads Foster 1998; Foster 2001', () => {
    const log = makeLog(28, TODAY, () => 50)
    const r = computeMonotonyTrend({ log, today: TODAY })
    expect(r.citation).toBe(MONOTONY_TREND_CITATION)
    expect(r.citation).toMatch(/Foster 1998/)
    expect(r.citation).toMatch(/Foster 2001/)
  })
})
