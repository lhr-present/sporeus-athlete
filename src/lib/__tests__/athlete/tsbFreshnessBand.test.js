import { describe, it, expect } from 'vitest'
import {
  classifyTsbFreshness,
  bandForTsb,
  TSB_FRESHNESS_CITATION,
} from '../../athlete/tsbFreshnessBand.js'

const TODAY = '2026-05-17'

function isoOffset(days, base = TODAY) {
  const d = new Date(base + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Helper: build a log of `n` daily sessions at the given tss, ending
// `offsetDaysFromToday` days ago. offset=0 means the last session was today.
function dailyBlock({ days, tss, lastOffset = 0 }) {
  const out = []
  for (let i = days - 1; i >= 0; i--) {
    out.push({ date: isoOffset(-i - lastOffset), tss })
  }
  return out
}

describe('bandForTsb — pure threshold classification', () => {
  it('classifies TSB > +25 as VERY_FRESH', () => {
    expect(bandForTsb(30)).toBe('VERY_FRESH')
    expect(bandForTsb(26)).toBe('VERY_FRESH')
  })

  it('classifies +5 < TSB ≤ +25 as FRESH', () => {
    expect(bandForTsb(10)).toBe('FRESH')
    expect(bandForTsb(25)).toBe('FRESH')
    expect(bandForTsb(6)).toBe('FRESH')
  })

  it('classifies −10 < TSB ≤ +5 as NEUTRAL', () => {
    expect(bandForTsb(0)).toBe('NEUTRAL')
    expect(bandForTsb(5)).toBe('NEUTRAL')
    expect(bandForTsb(-9)).toBe('NEUTRAL')
  })

  it('classifies −20 < TSB ≤ −10 as FATIGUED', () => {
    expect(bandForTsb(-15)).toBe('FATIGUED')
    expect(bandForTsb(-10)).toBe('FATIGUED')
    expect(bandForTsb(-19)).toBe('FATIGUED')
  })

  it('classifies TSB ≤ −20 as VERY_FATIGUED', () => {
    expect(bandForTsb(-25)).toBe('VERY_FATIGUED')
    expect(bandForTsb(-20)).toBe('VERY_FATIGUED')
    expect(bandForTsb(-100)).toBe('VERY_FATIGUED')
  })
})

describe('classifyTsbFreshness — pure fn', () => {
  it('returns null for an empty log', () => {
    expect(classifyTsbFreshness({ log: [], today: TODAY })).toBeNull()
    expect(classifyTsbFreshness({ log: null, today: TODAY })).toBeNull()
    expect(classifyTsbFreshness({ today: TODAY })).toBeNull()
  })

  it('returns the canonical citation', () => {
    const log = dailyBlock({ days: 10, tss: 50 })
    const r = classifyTsbFreshness({ log, today: TODAY })
    expect(r.citation).toBe(TSB_FRESHNESS_CITATION)
    expect(r.citation).toMatch(/Banister 1975/)
    expect(r.citation).toMatch(/Coggan & Allen 2010/)
  })

  it('classifies a long high-load block followed by full rest as VERY_FRESH', () => {
    // 60 days of high TSS (builds CTL), then 21 days of rest → ATL≈0, CTL≫0.
    const block  = dailyBlock({ days: 60, tss: 150, lastOffset: 21 })
    const r = classifyTsbFreshness({ log: block, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.currentTsb).toBeGreaterThan(25)
    expect(r.band).toBe('VERY_FRESH')
  })

  it('classifies a sharp recent overload as VERY_FATIGUED', () => {
    // Acute overload: 7 days of very high TSS with no prior history.
    // ATL ramps faster than CTL → large negative TSB.
    const block = dailyBlock({ days: 7, tss: 250 })
    const r = classifyTsbFreshness({ log: block, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.currentTsb).toBeLessThan(-20)
    expect(r.band).toBe('VERY_FATIGUED')
  })

  it('classifies steady moderate load as NEUTRAL', () => {
    // Long steady load → CTL ≈ ATL → TSB ≈ 0.
    const block = dailyBlock({ days: 120, tss: 60 })
    const r = classifyTsbFreshness({ log: block, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('NEUTRAL')
    expect(Math.abs(r.currentTsb)).toBeLessThan(10)
  })

  it('reports rising trend when TSB(today) > TSB(7d ago)', () => {
    // Heavy block ending 7 days ago → ATL was at peak fatigue 7d ago,
    // has decayed substantially since. TSB rises from deeply negative
    // toward positive across that window.
    const block = dailyBlock({ days: 30, tss: 200, lastOffset: 7 })
    const r = classifyTsbFreshness({ log: block, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.trend7d).toBe('rising')
  })

  it('reports falling trend when TSB(today) < TSB(7d ago)', () => {
    // Light old base → heavy recent block. ATL outpaces CTL recently,
    // TSB drops over the past 7 days.
    const oldLight  = dailyBlock({ days: 30, tss: 30,  lastOffset: 30 })
    const recent    = dailyBlock({ days: 10, tss: 250 })
    const r = classifyTsbFreshness({ log: [...oldLight, ...recent], today: TODAY })
    expect(r).not.toBeNull()
    expect(r.trend7d).toBe('falling')
  })

  it('returns tsbHistory bounded by trendDays (default 28)', () => {
    const block = dailyBlock({ days: 90, tss: 70 })
    const r = classifyTsbFreshness({ log: block, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.tsbHistory.length).toBeLessThanOrEqual(28)
    // History is in chronological order, last entry is today.
    expect(r.tsbHistory[r.tsbHistory.length - 1].date).toBe(TODAY)
    expect(r.tsbHistory[r.tsbHistory.length - 1].tsb).toBe(r.currentTsb)
  })

  it('respects a custom trendDays argument', () => {
    const block = dailyBlock({ days: 90, tss: 70 })
    const r = classifyTsbFreshness({ log: block, today: TODAY, trendDays: 14 })
    expect(r).not.toBeNull()
    expect(r.tsbHistory.length).toBeLessThanOrEqual(14)
  })

  it('returns a numeric currentTsb and a defined band for any non-empty log', () => {
    const block = dailyBlock({ days: 21, tss: 80 })
    const r = classifyTsbFreshness({ log: block, today: TODAY })
    expect(r).not.toBeNull()
    expect(Number.isFinite(r.currentTsb)).toBe(true)
    expect(['VERY_FRESH', 'FRESH', 'NEUTRAL', 'FATIGUED', 'VERY_FATIGUED']).toContain(r.band)
    expect(['rising', 'falling', 'stable']).toContain(r.trend7d)
  })
})
