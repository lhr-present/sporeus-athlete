// v9.122.0 — Wellness trend analyzer tests.

import { describe, it, expect } from 'vitest'
import { analyzeWellnessTrend } from '../../athlete/wellnessTrend.js'

const TODAY = '2026-05-14'
function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
function row(daysAgo, vals) {
  return { date: addDays(TODAY, -daysAgo), ...vals }
}

describe('analyzeWellnessTrend — guards', () => {
  it('returns empty stats when recovery is empty', () => {
    const out = analyzeWellnessTrend([], TODAY)
    expect(out.anyConcerning).toBe(false)
    expect(out.fields).toHaveLength(3)
    for (const f of out.fields) {
      expect(f.current7Avg).toBeNull()
      expect(f.prior7Avg).toBeNull()
      expect(f.delta).toBeNull()
      expect(f.concerning).toBe(false)
    }
  })
  it('tolerates null/undefined inputs', () => {
    expect(analyzeWellnessTrend(null, TODAY).anyConcerning).toBe(false)
    expect(analyzeWellnessTrend(undefined, TODAY).anyConcerning).toBe(false)
  })
  it('tolerates malformed entries', () => {
    const out = analyzeWellnessTrend([
      { date: 'not-a-date', sleep: 5 },
      { sleep: 4 },  // no date
      null,
    ], TODAY)
    expect(out.anyConcerning).toBe(false)
  })
})

describe('analyzeWellnessTrend — averaging', () => {
  it('computes current-7 average from days 0..6', () => {
    const recovery = Array.from({ length: 7 }, (_, i) => row(i, { sleep: 4 }))
    const out = analyzeWellnessTrend(recovery, TODAY)
    const sleep = out.fields.find(f => f.key === 'sleep')
    expect(sleep.current7Avg).toBe(4)
  })
  it('computes prior-7 average from days 7..13', () => {
    const recovery = Array.from({ length: 7 }, (_, i) => row(i + 7, { sleep: 2 }))
    const out = analyzeWellnessTrend(recovery, TODAY)
    const sleep = out.fields.find(f => f.key === 'sleep')
    expect(sleep.prior7Avg).toBe(2)
    expect(sleep.current7Avg).toBeNull()  // no current data
  })
  it('skips missing days without breaking the average', () => {
    // Only 3 of 7 current days have data
    const recovery = [
      row(0, { sleep: 5 }),
      row(2, { sleep: 5 }),
      row(4, { sleep: 5 }),
    ]
    const out = analyzeWellnessTrend(recovery, TODAY)
    expect(out.fields.find(f => f.key === 'sleep').current7Avg).toBe(5)
  })
})

describe('analyzeWellnessTrend — sleep concerning', () => {
  it('flags concerning when current7Avg <= 2.5', () => {
    const recovery = Array.from({ length: 7 }, (_, i) => row(i, { sleep: 2 }))
    const out = analyzeWellnessTrend(recovery, TODAY)
    const sleep = out.fields.find(f => f.key === 'sleep')
    expect(sleep.concerning).toBe(true)
    expect(sleep.reason).toBe('avg-low')
  })
  it('flags declining when delta <= -0.8 even if avg ok', () => {
    const recovery = [
      ...Array.from({ length: 7 }, (_, i) => row(i, { sleep: 3 })),         // current 3
      ...Array.from({ length: 7 }, (_, i) => row(i + 7, { sleep: 4.5 })),    // prior 4.5
    ]
    const out = analyzeWellnessTrend(recovery, TODAY)
    const sleep = out.fields.find(f => f.key === 'sleep')
    expect(sleep.delta).toBe(-1.5)
    expect(sleep.concerning).toBe(true)
    expect(sleep.reason).toBe('declining')
  })
  it('NOT concerning when stable and acceptable', () => {
    const recovery = [
      ...Array.from({ length: 7 }, (_, i) => row(i, { sleep: 4 })),
      ...Array.from({ length: 7 }, (_, i) => row(i + 7, { sleep: 4 })),
    ]
    const out = analyzeWellnessTrend(recovery, TODAY)
    expect(out.fields.find(f => f.key === 'sleep').concerning).toBe(false)
  })
})

describe('analyzeWellnessTrend — soreness inverted scale', () => {
  it('flags concerning when current7Avg >= 3.5 (high soreness)', () => {
    const recovery = Array.from({ length: 7 }, (_, i) => row(i, { soreness: 4 }))
    const out = analyzeWellnessTrend(recovery, TODAY)
    const s = out.fields.find(f => f.key === 'soreness')
    expect(s.concerning).toBe(true)
    expect(s.reason).toBe('avg-high')
  })
  it('flags rising when delta >= +0.8 (worsening direction)', () => {
    const recovery = [
      ...Array.from({ length: 7 }, (_, i) => row(i, { soreness: 3 })),       // current 3
      ...Array.from({ length: 7 }, (_, i) => row(i + 7, { soreness: 1.5 })), // prior 1.5
    ]
    const out = analyzeWellnessTrend(recovery, TODAY)
    const s = out.fields.find(f => f.key === 'soreness')
    expect(s.delta).toBe(1.5)
    expect(s.concerning).toBe(true)
    expect(s.reason).toBe('rising')
  })
  it('NOT concerning when soreness low and stable', () => {
    const recovery = Array.from({ length: 14 }, (_, i) => row(i, { soreness: 1.5 }))
    const out = analyzeWellnessTrend(recovery, TODAY)
    expect(out.fields.find(f => f.key === 'soreness').concerning).toBe(false)
  })
})

describe('analyzeWellnessTrend — direction', () => {
  it('flat when |delta| < 0.2', () => {
    const recovery = [
      ...Array.from({ length: 7 }, (_, i) => row(i, { sleep: 3 })),
      ...Array.from({ length: 7 }, (_, i) => row(i + 7, { sleep: 3.1 })),
    ]
    const out = analyzeWellnessTrend(recovery, TODAY)
    expect(out.fields.find(f => f.key === 'sleep').direction).toBe('flat')
  })
  it('down when current is lower than prior', () => {
    const recovery = [
      ...Array.from({ length: 7 }, (_, i) => row(i, { sleep: 2 })),
      ...Array.from({ length: 7 }, (_, i) => row(i + 7, { sleep: 4 })),
    ]
    const out = analyzeWellnessTrend(recovery, TODAY)
    expect(out.fields.find(f => f.key === 'sleep').direction).toBe('down')
  })
  it('up when current is higher than prior', () => {
    const recovery = [
      ...Array.from({ length: 7 }, (_, i) => row(i, { sleep: 5 })),
      ...Array.from({ length: 7 }, (_, i) => row(i + 7, { sleep: 3 })),
    ]
    const out = analyzeWellnessTrend(recovery, TODAY)
    expect(out.fields.find(f => f.key === 'sleep').direction).toBe('up')
  })
})

describe('analyzeWellnessTrend — anyConcerning aggregation', () => {
  it('true when any field is concerning', () => {
    const recovery = Array.from({ length: 7 }, (_, i) => row(i, {
      sleep: 4, energy: 4, soreness: 4,  // soreness too high
    }))
    expect(analyzeWellnessTrend(recovery, TODAY).anyConcerning).toBe(true)
  })
  it('false when all fields are healthy', () => {
    const recovery = Array.from({ length: 7 }, (_, i) => row(i, {
      sleep: 4, energy: 4, soreness: 2,
    }))
    expect(analyzeWellnessTrend(recovery, TODAY).anyConcerning).toBe(false)
  })
})
