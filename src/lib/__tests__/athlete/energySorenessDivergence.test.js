// ─── energySorenessDivergence.test.js — 28d wellness analyzer unit tests ───

import { describe, it, expect } from 'vitest'
import {
  analyzeEnergySorenessDivergence,
  CITATION,
  MIN_SAMPLES,
  ENERGY_THRESHOLD,
  SORENESS_THRESHOLD,
  DEFAULT_WINDOW_DAYS,
} from '../../athlete/energySorenessDivergence.js'

const TODAY = '2026-05-14'

function daysAgo(n) {
  const d = new Date(`${TODAY}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function rec(n, { energy = 3, soreness = 3 } = {}) {
  return { date: daysAgo(n), energy, soreness }
}

/** Build N entries spread across the 28-day window, ages 0..(N-1) clipped to 27. */
function buildSeries(count, mkVals) {
  const out = []
  for (let i = 0; i < count; i++) {
    const age = Math.min(i, 27)
    out.push({ date: daysAgo(age), ...mkVals(i) })
  }
  return out
}

describe('analyzeEnergySorenessDivergence — constants & schema', () => {
  it('exports the documented thresholds and citation', () => {
    expect(ENERGY_THRESHOLD).toBe(3.5)
    expect(SORENESS_THRESHOLD).toBe(2.5)
    expect(DEFAULT_WINDOW_DAYS).toBe(28)
    expect(MIN_SAMPLES).toBe(7)
    expect(CITATION).toBe('Hooper 1995; Saw 2016')
  })
})

describe('analyzeEnergySorenessDivergence — guards', () => {
  it('returns null for non-array recovery', () => {
    expect(analyzeEnergySorenessDivergence({ recovery: null, today: TODAY })).toBeNull()
    expect(analyzeEnergySorenessDivergence({ recovery: undefined, today: TODAY })).toBeNull()
    expect(analyzeEnergySorenessDivergence({ recovery: 'oops', today: TODAY })).toBeNull()
  })

  it('returns null for empty recovery', () => {
    expect(analyzeEnergySorenessDivergence({ recovery: [], today: TODAY })).toBeNull()
  })

  it('returns null when fewer than 7 valid entries are present', () => {
    const recovery = Array.from({ length: 6 }).map((_, i) =>
      rec(i, { energy: 4, soreness: 2 }),
    )
    expect(analyzeEnergySorenessDivergence({ recovery, today: TODAY })).toBeNull()
  })

  it('excludes entries with partial fields (energy or soreness missing)', () => {
    const recovery = [
      ...Array.from({ length: 5 }).map((_, i) => rec(i, { energy: 4, soreness: 2 })),
      // Missing soreness → excluded
      { date: daysAgo(6), energy: 4 },
      // Missing energy → excluded
      { date: daysAgo(7), soreness: 2 },
      // Out-of-range (0) → excluded
      { date: daysAgo(8), energy: 0, soreness: 2 },
      // Out-of-range (6) → excluded
      { date: daysAgo(9), energy: 4, soreness: 6 },
      // Non-integer (Likert int-only) → excluded
      { date: daysAgo(10), energy: 3.5, soreness: 2 },
      // Non-numeric → excluded
      { date: daysAgo(11), energy: 'nope', soreness: 2 },
    ]
    expect(analyzeEnergySorenessDivergence({ recovery, today: TODAY })).toBeNull()
  })

  it('excludes entries outside the 28-day window', () => {
    const recovery = [
      ...Array.from({ length: 5 }).map((_, i) => rec(i, { energy: 4, soreness: 2 })),
      rec(30, { energy: 4, soreness: 2 }),
      rec(60, { energy: 4, soreness: 2 }),
    ]
    expect(analyzeEnergySorenessDivergence({ recovery, today: TODAY })).toBeNull()
  })

  it('excludes future-dated entries', () => {
    const recovery = [
      ...Array.from({ length: 6 }).map((_, i) => rec(i, { energy: 4, soreness: 2 })),
      rec(-3, { energy: 4, soreness: 2 }),
    ]
    expect(analyzeEnergySorenessDivergence({ recovery, today: TODAY })).toBeNull()
  })

  it('tolerates malformed entries silently', () => {
    const recovery = [
      ...Array.from({ length: 7 }).map((_, i) => rec(i, { energy: 4, soreness: 2 })),
      null,
      undefined,
      'string',
      { energy: 4, soreness: 2 }, // no date
      { date: 'bad-date', energy: 4, soreness: 2 },
    ]
    const out = analyzeEnergySorenessDivergence({ recovery, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.sampleCount).toBe(7)
  })
})

describe('analyzeEnergySorenessDivergence — quadrant classification', () => {
  it('THRIVING: avgEnergy ≥ 3.5 AND avgSoreness ≤ 2.5', () => {
    const recovery = buildSeries(14, () => ({ energy: 4, soreness: 2 }))
    const out = analyzeEnergySorenessDivergence({ recovery, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.quadrant).toBe('THRIVING')
    expect(out.avgEnergy).toBeCloseTo(4, 5)
    expect(out.avgSoreness).toBeCloseTo(2, 5)
    expect(out.avgIndex).toBeCloseTo(2, 5)
  })

  it('RECOVERING: avgEnergy ≥ 3.5 AND avgSoreness > 2.5', () => {
    const recovery = buildSeries(14, () => ({ energy: 4, soreness: 4 }))
    const out = analyzeEnergySorenessDivergence({ recovery, today: TODAY })
    expect(out.quadrant).toBe('RECOVERING')
    expect(out.avgEnergy).toBeCloseTo(4, 5)
    expect(out.avgSoreness).toBeCloseTo(4, 5)
    expect(out.avgIndex).toBeCloseTo(0, 5)
  })

  it('DRAINED: avgEnergy < 3.5 AND avgSoreness ≤ 2.5', () => {
    const recovery = buildSeries(14, () => ({ energy: 2, soreness: 2 }))
    const out = analyzeEnergySorenessDivergence({ recovery, today: TODAY })
    expect(out.quadrant).toBe('DRAINED')
    expect(out.avgEnergy).toBeCloseTo(2, 5)
    expect(out.avgSoreness).toBeCloseTo(2, 5)
    expect(out.avgIndex).toBeCloseTo(0, 5)
  })

  it('STRUGGLING: avgEnergy < 3.5 AND avgSoreness > 2.5', () => {
    const recovery = buildSeries(14, () => ({ energy: 2, soreness: 4 }))
    const out = analyzeEnergySorenessDivergence({ recovery, today: TODAY })
    expect(out.quadrant).toBe('STRUGGLING')
    expect(out.avgEnergy).toBeCloseTo(2, 5)
    expect(out.avgSoreness).toBeCloseTo(4, 5)
    expect(out.avgIndex).toBeCloseTo(-2, 5)
  })
})

describe('analyzeEnergySorenessDivergence — boundary cases', () => {
  it('classifies energy=3 (just below 3.5) as the "low energy" side', () => {
    // avgEnergy = 3 (< 3.5), avgSoreness = 2 (≤ 2.5) → DRAINED
    const recovery = buildSeries(14, () => ({ energy: 3, soreness: 2 }))
    const out = analyzeEnergySorenessDivergence({ recovery, today: TODAY })
    expect(out.quadrant).toBe('DRAINED')
  })

  it('classifies energy=4 + soreness=3 as RECOVERING (soreness > 2.5)', () => {
    const recovery = buildSeries(14, () => ({ energy: 4, soreness: 3 }))
    const out = analyzeEnergySorenessDivergence({ recovery, today: TODAY })
    expect(out.quadrant).toBe('RECOVERING')
  })

  it('classifies avg-energy at exactly 3.5 as the "good" side (≥ threshold)', () => {
    // Mix energy 3 and 4 to get mean of 3.5 (integers only).
    const recovery = [
      ...Array.from({ length: 7 }).map((_, i) => rec(i, { energy: 4, soreness: 2 })),
      ...Array.from({ length: 7 }).map((_, i) => rec(i + 7, { energy: 3, soreness: 2 })),
    ]
    const out = analyzeEnergySorenessDivergence({ recovery, today: TODAY })
    expect(out.avgEnergy).toBeCloseTo(3.5, 5)
    expect(out.quadrant).toBe('THRIVING')
  })

  it('classifies avg-soreness at exactly 2.5 as the "low" side (≤ threshold)', () => {
    // Mix soreness 2 and 3 to get mean of 2.5.
    const recovery = [
      ...Array.from({ length: 7 }).map((_, i) => rec(i, { energy: 4, soreness: 3 })),
      ...Array.from({ length: 7 }).map((_, i) => rec(i + 7, { energy: 4, soreness: 2 })),
    ]
    const out = analyzeEnergySorenessDivergence({ recovery, today: TODAY })
    expect(out.avgSoreness).toBeCloseTo(2.5, 5)
    expect(out.quadrant).toBe('THRIVING')
  })
})

describe('analyzeEnergySorenessDivergence — avgIndex math', () => {
  it('computes avgIndex as mean of per-day (energy − soreness)', () => {
    // Day-by-day indexes: 4-1=3, 3-2=1, 5-2=3, 3-3=0, 4-4=0, 2-3=-1, 5-4=1
    // Mean = (3+1+3+0+0-1+1)/7 = 7/7 = 1.0
    const recovery = [
      { date: daysAgo(0), energy: 4, soreness: 1 },
      { date: daysAgo(1), energy: 3, soreness: 2 },
      { date: daysAgo(2), energy: 5, soreness: 2 },
      { date: daysAgo(3), energy: 3, soreness: 3 },
      { date: daysAgo(4), energy: 4, soreness: 4 },
      { date: daysAgo(5), energy: 2, soreness: 3 },
      { date: daysAgo(6), energy: 5, soreness: 4 },
    ]
    const out = analyzeEnergySorenessDivergence({ recovery, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.avgIndex).toBeCloseTo(1, 5)
    // Mean(E) = (4+3+5+3+4+2+5)/7 = 26/7 ≈ 3.714
    // Mean(S) = (1+2+2+3+4+3+4)/7 = 19/7 ≈ 2.714
    // Avg-of-(E-S) == Mean(E) - Mean(S) for equal-weighted entries.
    expect(out.avgEnergy - out.avgSoreness).toBeCloseTo(out.avgIndex, 5)
  })

  it('handles a positive avgIndex (good side of ledger)', () => {
    const recovery = buildSeries(10, () => ({ energy: 5, soreness: 1 }))
    const out = analyzeEnergySorenessDivergence({ recovery, today: TODAY })
    expect(out.avgIndex).toBeCloseTo(4, 5)
  })

  it('handles a negative avgIndex (bad side of ledger)', () => {
    const recovery = buildSeries(10, () => ({ energy: 1, soreness: 5 }))
    const out = analyzeEnergySorenessDivergence({ recovery, today: TODAY })
    expect(out.avgIndex).toBeCloseTo(-4, 5)
    expect(out.quadrant).toBe('STRUGGLING')
  })
})

describe('analyzeEnergySorenessDivergence — output shape & windowDays', () => {
  it('returns the documented field set with the citation', () => {
    const recovery = buildSeries(14, () => ({ energy: 4, soreness: 2 }))
    const out = analyzeEnergySorenessDivergence({ recovery, today: TODAY })
    expect(out).toMatchObject({
      quadrant: 'THRIVING',
      avgEnergy: expect.any(Number),
      avgSoreness: expect.any(Number),
      avgIndex: expect.any(Number),
      sampleCount: 14,
      citation: 'Hooper 1995; Saw 2016',
    })
  })

  it('windowDays override narrows the analysis range', () => {
    const recovery = [
      // 7 entries in last 5 days → fits a 7d window
      ...Array.from({ length: 7 }).map((_, i) => rec(i, { energy: 4, soreness: 2 })),
      // Outside the 7d window — would change the average at 28d
      rec(20, { energy: 1, soreness: 5 }),
      rec(25, { energy: 1, soreness: 5 }),
    ]
    const out = analyzeEnergySorenessDivergence({
      recovery,
      today: TODAY,
      windowDays: 7,
    })
    expect(out).not.toBeNull()
    expect(out.sampleCount).toBe(7)
    expect(out.avgEnergy).toBeCloseTo(4, 5)
    expect(out.avgSoreness).toBeCloseTo(2, 5)
  })
})
