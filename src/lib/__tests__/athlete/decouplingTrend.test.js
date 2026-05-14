// v9.123.0 — Decoupling trend analyzer tests.

import { describe, it, expect } from 'vitest'
import {
  analyzeDecouplingTrend,
  classifyDecouplingTrend,
  DECOUPLING_TREND_THRESHOLDS,
} from '../../athlete/decouplingTrend.js'

const TODAY = '2026-05-14'
function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
function aerobic(daysAgo, decouplingPct, rpe = 5) {
  return { date: addDays(TODAY, -daysAgo), rpe, tss: 60, type: 'Easy', decouplingPct }
}

describe('classifyDecouplingTrend', () => {
  it('good when avg < 5', () => {
    expect(classifyDecouplingTrend(3)).toBe('good')
    expect(classifyDecouplingTrend(4.9)).toBe('good')
  })
  it('mild when 5 <= avg < 10', () => {
    expect(classifyDecouplingTrend(5)).toBe('mild')
    expect(classifyDecouplingTrend(7.5)).toBe('mild')
    expect(classifyDecouplingTrend(9.9)).toBe('mild')
  })
  it('significant when avg >= 10', () => {
    expect(classifyDecouplingTrend(10)).toBe('significant')
    expect(classifyDecouplingTrend(15)).toBe('significant')
  })
  it('null for malformed input', () => {
    expect(classifyDecouplingTrend(null)).toBeNull()
    expect(classifyDecouplingTrend(NaN)).toBeNull()
    expect(classifyDecouplingTrend(undefined)).toBeNull()
  })
})

describe('analyzeDecouplingTrend — guards', () => {
  it('returns null flag for empty log', () => {
    const out = analyzeDecouplingTrend([], TODAY)
    expect(out.flag).toBeNull()
    expect(out.avgPct).toBeNull()
    expect(out.sampleCount).toBe(0)
  })
  it('tolerates non-array log', () => {
    expect(analyzeDecouplingTrend(null, TODAY).flag).toBeNull()
    expect(analyzeDecouplingTrend(undefined, TODAY).flag).toBeNull()
  })
  it('requires at least 2 samples to flag', () => {
    const log = [aerobic(1, 8)]
    const out = analyzeDecouplingTrend(log, TODAY)
    expect(out.flag).toBeNull()
    expect(out.sampleCount).toBe(1)
    expect(out.summary).toBeNull()
  })
})

describe('analyzeDecouplingTrend — filtering', () => {
  it('ignores entries outside the 14-day window', () => {
    const log = [
      aerobic(1, 12),
      aerobic(20, 12),  // outside window
    ]
    const out = analyzeDecouplingTrend(log, TODAY)
    expect(out.sampleCount).toBe(1)
    expect(out.flag).toBeNull()  // <2 samples
  })
  it('ignores entries without decouplingPct', () => {
    const log = [
      aerobic(1, 8),
      { date: addDays(TODAY, -3), rpe: 5, tss: 60 },  // no decoupling
    ]
    const out = analyzeDecouplingTrend(log, TODAY)
    expect(out.sampleCount).toBe(1)
  })
  it('ignores high-RPE (non-aerobic) sessions', () => {
    const log = [
      aerobic(1, 8),
      aerobic(3, 8, 8),  // rpe 8 — not aerobic
      aerobic(5, 8, 9),  // rpe 9 — not aerobic
    ]
    const out = analyzeDecouplingTrend(log, TODAY)
    expect(out.sampleCount).toBe(1)
  })
  it('includes RPE 6 (boundary case)', () => {
    const log = [aerobic(1, 8, 6), aerobic(3, 8, 6)]
    const out = analyzeDecouplingTrend(log, TODAY)
    expect(out.sampleCount).toBe(2)
  })
  it('ignores entries with invalid rpe', () => {
    const log = [
      aerobic(1, 8, 5),
      { date: addDays(TODAY, -3), tss: 60, decouplingPct: 8 },  // no rpe
    ]
    const out = analyzeDecouplingTrend(log, TODAY)
    expect(out.sampleCount).toBe(1)
  })
})

describe('analyzeDecouplingTrend — flag classification', () => {
  it('good when avg < 5 (and 2+ samples)', () => {
    const log = [aerobic(1, 3), aerobic(3, 4), aerobic(5, 2)]
    const out = analyzeDecouplingTrend(log, TODAY)
    expect(out.flag).toBe('good')
    expect(out.avgPct).toBe(3)
    expect(out.summary).toBeNull()  // good = silent
  })
  it('mild when avg 5–10', () => {
    const log = [aerobic(1, 6), aerobic(3, 7), aerobic(5, 8)]
    const out = analyzeDecouplingTrend(log, TODAY)
    expect(out.flag).toBe('mild')
    expect(out.summary?.en).toContain('mild aerobic insufficiency')
    expect(out.summary?.tr).toContain('hafif aerobik yetersizlik')
  })
  it('significant when avg >= 10', () => {
    const log = [aerobic(1, 12), aerobic(3, 15), aerobic(5, 11)]
    const out = analyzeDecouplingTrend(log, TODAY)
    expect(out.flag).toBe('significant')
    expect(out.summary?.en).toContain('significant decoupling')
    expect(out.summary?.tr).toContain('belirgin desenkronizasyon')
  })
})

describe('analyzeDecouplingTrend — output shape', () => {
  it('returns samples sorted by recency (input order preserved)', () => {
    const log = [
      aerobic(1, 8),
      aerobic(5, 6),
      aerobic(10, 9),
    ]
    const out = analyzeDecouplingTrend(log, TODAY)
    expect(out.samples).toHaveLength(3)
    expect(out.samples.every(s => Number.isFinite(s.decouplingPct))).toBe(true)
  })
  it('avgPct is a number when flagged', () => {
    const log = [aerobic(1, 8), aerobic(3, 6)]
    const out = analyzeDecouplingTrend(log, TODAY)
    expect(typeof out.avgPct).toBe('number')
    expect(out.avgPct).toBe(7)
  })
  it('summary includes sample count in EN and TR', () => {
    const log = [aerobic(1, 12), aerobic(3, 14)]
    const out = analyzeDecouplingTrend(log, TODAY)
    expect(out.summary.en).toContain('2 aerobic sessions')
    expect(out.summary.tr).toContain('Son 2 aerobik')
  })
})

describe('DECOUPLING_TREND_THRESHOLDS', () => {
  it('matches the Friel-method tiers', () => {
    expect(DECOUPLING_TREND_THRESHOLDS.coupled).toBe(5)
    expect(DECOUPLING_TREND_THRESHOLDS.mild).toBe(10)
  })
})
