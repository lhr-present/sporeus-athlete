// ─── moodEnergyBalance.test.js — 28d mood × energy circumplex unit tests ────

import { describe, it, expect } from 'vitest'
import {
  analyzeMoodEnergyBalance,
  CITATION,
  MIN_SAMPLES,
  TREND_THRESHOLD,
  QUADRANT_THRESHOLD,
  DEFAULT_WINDOW_DAYS,
} from '../../athlete/moodEnergyBalance.js'

const TODAY = '2026-05-14'

function daysAgo(n) {
  const d = new Date(`${TODAY}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/** Build an entry. mood / energy default to 3 (neutral). */
function rec(n, { mood = 3, energy = 3 } = {}) {
  return { date: daysAgo(n), mood, energy }
}

/**
 * Build N entries spread across the early half (ageDays in [14, 27]) and
 * recent half (ageDays in [0, 13]). Half the entries fall in each window.
 * Each entry takes mood/energy values from supplied callbacks.
 */
function spread({ count, early, recent }) {
  const out = []
  const perHalf = Math.ceil(count / 2)
  // Recent half: ages 0..13
  for (let i = 0; i < perHalf; i++) {
    const age = i % 14
    out.push({ date: daysAgo(age), ...recent(i) })
  }
  // Early half: ages 14..27
  for (let i = 0; i < count - perHalf; i++) {
    const age = 14 + (i % 14)
    out.push({ date: daysAgo(age), ...early(i) })
  }
  return out
}

describe('analyzeMoodEnergyBalance — constants & schema', () => {
  it('exports the documented thresholds', () => {
    expect(TREND_THRESHOLD).toBe(0.3)
    expect(QUADRANT_THRESHOLD).toBe(3.5)
    expect(DEFAULT_WINDOW_DAYS).toBe(28)
    expect(MIN_SAMPLES).toBe(7)
    expect(CITATION).toBe('Lane 2007; Russell 1980')
  })
})

describe('analyzeMoodEnergyBalance — guards', () => {
  it('returns null for non-array recovery', () => {
    expect(analyzeMoodEnergyBalance({ recovery: null, today: TODAY })).toBeNull()
    expect(analyzeMoodEnergyBalance({ recovery: undefined, today: TODAY })).toBeNull()
    expect(analyzeMoodEnergyBalance({ recovery: 'oops', today: TODAY })).toBeNull()
  })

  it('returns null for empty recovery', () => {
    expect(analyzeMoodEnergyBalance({ recovery: [], today: TODAY })).toBeNull()
  })

  it('returns null when fewer than 7 valid entries are present', () => {
    const recovery = Array.from({ length: 6 }).map((_, i) => rec(i, { mood: 4, energy: 4 }))
    expect(analyzeMoodEnergyBalance({ recovery, today: TODAY })).toBeNull()
  })

  it('excludes entries missing mood or energy from the count', () => {
    const recovery = [
      ...Array.from({ length: 5 }).map((_, i) => rec(i, { mood: 4, energy: 4 })),
      // Missing energy → excluded
      { date: daysAgo(6), mood: 4 },
      // Missing mood → excluded
      { date: daysAgo(7), energy: 4 },
      // Invalid mood (out of 1-5) → excluded
      { date: daysAgo(8), mood: 0, energy: 4 },
      // Non-numeric → excluded
      { date: daysAgo(9), mood: 'nope', energy: 4 },
    ]
    expect(analyzeMoodEnergyBalance({ recovery, today: TODAY })).toBeNull()
  })

  it('excludes entries outside the 28-day window', () => {
    const recovery = [
      ...Array.from({ length: 5 }).map((_, i) => rec(i, { mood: 4, energy: 4 })),
      // Outside window — should not count toward MIN_SAMPLES
      rec(30, { mood: 4, energy: 4 }),
      rec(45, { mood: 4, energy: 4 }),
    ]
    expect(analyzeMoodEnergyBalance({ recovery, today: TODAY })).toBeNull()
  })

  it('excludes future-dated entries', () => {
    const recovery = [
      ...Array.from({ length: 6 }).map((_, i) => rec(i, { mood: 4, energy: 4 })),
      // Future-dated — excluded
      rec(-3, { mood: 4, energy: 4 }),
    ]
    expect(analyzeMoodEnergyBalance({ recovery, today: TODAY })).toBeNull()
  })

  it('tolerates malformed entries silently', () => {
    const recovery = [
      ...Array.from({ length: 7 }).map((_, i) => rec(i, { mood: 4, energy: 4 })),
      null,
      undefined,
      'string',
      { mood: 4, energy: 4 }, // no date
      { date: 'bad-date', mood: 4, energy: 4 },
    ]
    const out = analyzeMoodEnergyBalance({ recovery, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.sampleCount).toBe(7)
  })
})

describe('analyzeMoodEnergyBalance — quadrant classification (constant trend)', () => {
  it('VIGOROUS: avgMood ≥ 3.5 AND avgEnergy ≥ 3.5', () => {
    const recovery = spread({
      count: 14,
      early:  () => ({ mood: 4, energy: 4 }),
      recent: () => ({ mood: 4, energy: 4 }),
    })
    const out = analyzeMoodEnergyBalance({ recovery, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.quadrant).toBe('VIGOROUS')
    expect(out.trend).toBe('STABLE') // no delta between halves
    expect(out.avgMood).toBeCloseTo(4, 5)
    expect(out.avgEnergy).toBeCloseTo(4, 5)
  })

  it('CONTENT: avgMood ≥ 3.5 AND avgEnergy < 3.5', () => {
    const recovery = spread({
      count: 14,
      early:  () => ({ mood: 4, energy: 2 }),
      recent: () => ({ mood: 4, energy: 2 }),
    })
    const out = analyzeMoodEnergyBalance({ recovery, today: TODAY })
    expect(out.quadrant).toBe('CONTENT')
    expect(out.trend).toBe('STABLE')
  })

  it('EDGY: avgMood < 3.5 AND avgEnergy ≥ 3.5', () => {
    const recovery = spread({
      count: 14,
      early:  () => ({ mood: 2, energy: 4 }),
      recent: () => ({ mood: 2, energy: 4 }),
    })
    const out = analyzeMoodEnergyBalance({ recovery, today: TODAY })
    expect(out.quadrant).toBe('EDGY')
    expect(out.trend).toBe('STABLE')
  })

  it('FLAT: avgMood < 3.5 AND avgEnergy < 3.5', () => {
    const recovery = spread({
      count: 14,
      early:  () => ({ mood: 2, energy: 2 }),
      recent: () => ({ mood: 2, energy: 2 }),
    })
    const out = analyzeMoodEnergyBalance({ recovery, today: TODAY })
    expect(out.quadrant).toBe('FLAT')
    expect(out.trend).toBe('STABLE')
  })

  it('treats exactly 3.5 as the positive side of the boundary', () => {
    // mood = 3.5 (boundary), energy = 3.5 (boundary) → VIGOROUS
    const recovery = spread({
      count: 14,
      early:  () => ({ mood: 3.5, energy: 3.5 }),
      recent: () => ({ mood: 3.5, energy: 3.5 }),
    })
    const out = analyzeMoodEnergyBalance({ recovery, today: TODAY })
    expect(out.quadrant).toBe('VIGOROUS')
  })
})

describe('analyzeMoodEnergyBalance — trend classification', () => {
  it('RISING: aggregate delta ≥ +0.3 (recent half well above early half)', () => {
    const recovery = spread({
      count: 14,
      early:  () => ({ mood: 2, energy: 2 }),
      recent: () => ({ mood: 4, energy: 4 }),
    })
    const out = analyzeMoodEnergyBalance({ recovery, today: TODAY })
    expect(out.trend).toBe('RISING')
    expect(out.moodDelta).toBeCloseTo(2, 5)
    expect(out.energyDelta).toBeCloseTo(2, 5)
  })

  it('STABLE: |aggregate| < 0.3 (small drift in both halves)', () => {
    // Recent = 3.1 / 3.1, early = 3 / 3 → moodΔ = +0.1, energyΔ = +0.1 → agg = 0.1
    const recovery = spread({
      count: 14,
      early:  () => ({ mood: 3, energy: 3 }),
      recent: () => ({ mood: 3.1, energy: 3.1 }),
    })
    const out = analyzeMoodEnergyBalance({ recovery, today: TODAY })
    expect(out.trend).toBe('STABLE')
  })

  it('DECLINING: aggregate delta ≤ −0.3 (recent half well below early half)', () => {
    const recovery = spread({
      count: 14,
      early:  () => ({ mood: 4, energy: 4 }),
      recent: () => ({ mood: 2, energy: 2 }),
    })
    const out = analyzeMoodEnergyBalance({ recovery, today: TODAY })
    expect(out.trend).toBe('DECLINING')
    expect(out.moodDelta).toBeCloseTo(-2, 5)
    expect(out.energyDelta).toBeCloseTo(-2, 5)
  })

  it('classifies as RISING at exactly +0.3 aggregate', () => {
    // moodΔ = +0.3, energyΔ = +0.3 → agg = 0.3 (boundary)
    const recovery = spread({
      count: 14,
      early:  () => ({ mood: 3, energy: 3 }),
      recent: () => ({ mood: 3.3, energy: 3.3 }),
    })
    const out = analyzeMoodEnergyBalance({ recovery, today: TODAY })
    expect(out.trend).toBe('RISING')
  })

  it('classifies as DECLINING at exactly −0.3 aggregate', () => {
    const recovery = spread({
      count: 14,
      early:  () => ({ mood: 3.3, energy: 3.3 }),
      recent: () => ({ mood: 3, energy: 3 }),
    })
    const out = analyzeMoodEnergyBalance({ recovery, today: TODAY })
    expect(out.trend).toBe('DECLINING')
  })
})

describe('analyzeMoodEnergyBalance — output shape', () => {
  it('returns the documented field set with the citation', () => {
    const recovery = spread({
      count: 14,
      early:  () => ({ mood: 3, energy: 3 }),
      recent: () => ({ mood: 4, energy: 4 }),
    })
    const out = analyzeMoodEnergyBalance({ recovery, today: TODAY })
    expect(out).toMatchObject({
      trend: 'RISING',
      quadrant: expect.any(String),
      avgMood: expect.any(Number),
      avgEnergy: expect.any(Number),
      moodDelta: expect.any(Number),
      energyDelta: expect.any(Number),
      sampleCount: 14,
      citation: 'Lane 2007; Russell 1980',
    })
  })

  it('windowDays override narrows the analysis range', () => {
    const recovery = [
      // 7 entries all in last 5 days → within a 7d window
      ...Array.from({ length: 7 }).map((_, i) => rec(i, { mood: 4, energy: 4 })),
      // Plenty more outside the 7d window — would matter at 28d, not at 7d
      rec(20, { mood: 1, energy: 1 }),
      rec(25, { mood: 1, energy: 1 }),
    ]
    const out = analyzeMoodEnergyBalance({ recovery, today: TODAY, windowDays: 7 })
    expect(out).not.toBeNull()
    expect(out.sampleCount).toBe(7)
    expect(out.avgMood).toBeCloseTo(4, 5)
    expect(out.avgEnergy).toBeCloseTo(4, 5)
  })
})
