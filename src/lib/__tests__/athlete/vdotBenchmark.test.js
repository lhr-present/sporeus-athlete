// ── tests/athlete/vdotBenchmark.test.js — E36 ─────────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  ageToGroup,
  lookupVDOTNorm,
  classifyVDOT,
  computeVDOTBenchmark,
} from '../../athlete/vdotBenchmark.js'

// ── Synthetic log: two distinct ISO weeks, running races with known pace ───────
// 5K in 22:00 (1320s) → vdotFromRace(5000, 1320) ≈ 41
// 5K in 21:00 (1260s) → slightly higher VDOT
const makeRaceEntry = (date, durationSec) => ({
  sport_type: 'running',
  distance: 5000,
  duration: durationSec,   // > 600 so no *60 conversion
  is_race: true,
  date,
})

const syntheticLog = [
  makeRaceEntry('2024-01-08', 1320), // week 2
  makeRaceEntry('2024-01-15', 1260), // week 3 — different week, higher VDOT
]

const profile35m = { age: 35, gender: 'male' }
const profile35f = { age: 35, gender: 'female' }

// ── ageToGroup ─────────────────────────────────────────────────────────────────
describe('ageToGroup', () => {
  it('maps age 18 → 18-29', () => expect(ageToGroup(18)).toBe('18-29'))
  it('maps age 29 → 18-29 (upper boundary of band)', () => expect(ageToGroup(29)).toBe('18-29'))
  it('maps age 30 → 30-39 (boundary switch)', () => expect(ageToGroup(30)).toBe('30-39'))
  it('maps age 35 → 30-39', () => expect(ageToGroup(35)).toBe('30-39'))
  it('maps age 45 → 40-49', () => expect(ageToGroup(45)).toBe('40-49'))
  it('maps age 55 → 50-59', () => expect(ageToGroup(55)).toBe('50-59'))
  it('maps age 60 → 60+', () => expect(ageToGroup(60)).toBe('60+'))
  it('maps age 75 → 60+', () => expect(ageToGroup(75)).toBe('60+'))
  it('returns null for age 5 (too young)', () => expect(ageToGroup(5)).toBeNull())
  it('returns null for age 0', () => expect(ageToGroup(0)).toBeNull())
  it('returns null for age 125 (too old)', () => expect(ageToGroup(125)).toBeNull())
  it('accepts string age "35"', () => expect(ageToGroup('35')).toBe('30-39'))
})

// ── lookupVDOTNorm ─────────────────────────────────────────────────────────────
describe('lookupVDOTNorm', () => {
  it('returns correct row for 30-39 male', () => {
    const row = lookupVDOTNorm('30-39', 'male')
    expect(row).not.toBeNull()
    expect(row.vdot.p50).toBe(45)
  })

  it('returns correct row for 18-29 female', () => {
    const row = lookupVDOTNorm('18-29', 'female')
    expect(row).not.toBeNull()
    expect(row.vdot.p90).toBe(58)
  })

  it('returns correct row for 60+ male', () => {
    const row = lookupVDOTNorm('60+', 'male')
    expect(row).not.toBeNull()
    expect(row.vdot.p25).toBe(26)
  })

  it('defaults to male when gender is undefined', () => {
    const row = lookupVDOTNorm('40-49', undefined)
    expect(row.gender).toBe('male')
  })

  it('returns null for missing ageGroup', () => {
    expect(lookupVDOTNorm(null, 'male')).toBeNull()
  })

  it('returns null for unknown ageGroup string', () => {
    expect(lookupVDOTNorm('70-79', 'male')).toBeNull()
  })
})

// ── classifyVDOT ───────────────────────────────────────────────────────────────
describe('classifyVDOT', () => {
  // 30-39 male: p25=37, p50=45, p75=53, p90=62
  const norm = { vdot: { p25: 37, p50: 45, p75: 53, p90: 62 } }

  it('classifies top10 at p90 boundary (vdot === p90)', () => {
    const t = classifyVDOT(62, norm)
    expect(t.percentile).toBe('top10')
    expect(t.color).toBe('#5bc25b')
  })

  it('classifies top10 above p90', () => {
    expect(classifyVDOT(70, norm).percentile).toBe('top10')
  })

  it('classifies top25 at p75 boundary', () => {
    const t = classifyVDOT(53, norm)
    expect(t.percentile).toBe('top25')
    expect(t.color).toBe('#0064ff')
  })

  it('classifies top25 between p75 and p90', () => {
    expect(classifyVDOT(58, norm).percentile).toBe('top25')
  })

  it('classifies median at p50 boundary', () => {
    const t = classifyVDOT(45, norm)
    expect(t.percentile).toBe('median')
    expect(t.color).toBe('#f5c542')
  })

  it('classifies median between p50 and p75', () => {
    expect(classifyVDOT(50, norm).percentile).toBe('median')
  })

  it('classifies below_median when vdot < p50', () => {
    const t = classifyVDOT(40, norm)
    expect(t.percentile).toBe('below_median')
    expect(t.color).toBe('#888')
  })

  it('includes label_en and label_tr', () => {
    const t = classifyVDOT(40, norm)
    expect(t.label_en).toBeTruthy()
    expect(t.label_tr).toBeTruthy()
  })
})

// ── computeVDOTBenchmark ───────────────────────────────────────────────────────
describe('computeVDOTBenchmark', () => {
  it('returns null when log has no qualifying race entries', () => {
    expect(computeVDOTBenchmark([], [], profile35m)).toBeNull()
  })

  it('returns null when age < 10', () => {
    expect(computeVDOTBenchmark(syntheticLog, [], { age: 8, gender: 'male' })).toBeNull()
  })

  it('returns null when age is missing', () => {
    expect(computeVDOTBenchmark(syntheticLog, [], { gender: 'male' })).toBeNull()
  })

  it('returns correct tier for known VDOT/age (35yo male ≈ VDOT 43)', () => {
    const result = computeVDOTBenchmark(syntheticLog, [], profile35m)
    expect(result).not.toBeNull()
    expect(result.ageGroup).toBe('30-39')
    expect(result.gender).toBe('male')
    expect(result.currentVdot).toBeGreaterThan(0)
    // p50 for 30-39 male = 45; synthetic ~41-43 → below_median or median
    expect(['below_median', 'median']).toContain(result.tier.percentile)
  })

  it('includes norm object with p25/p50/p75/p90', () => {
    const result = computeVDOTBenchmark(syntheticLog, [], profile35m)
    expect(result.norm).toHaveProperty('p25')
    expect(result.norm).toHaveProperty('p50')
    expect(result.norm).toHaveProperty('p75')
    expect(result.norm).toHaveProperty('p90')
  })

  it('includes citation string', () => {
    const result = computeVDOTBenchmark(syntheticLog, [], profile35m)
    expect(result.citation).toMatch(/Daniels/)
  })

  it('nextTier is null for top10 tier', () => {
    // 60+ male: p90=47 — inject a high-VDOT test result
    const _highLog = [
      makeRaceEntry('2024-01-08', 600),  // very fast — high VDOT (durationSec ≤ 600 triggers *60 → 600*60=36000s — NO: 600 exact means *60, so use 601)
      makeRaceEntry('2024-01-15', 601),
    ]
    // Use testResults with explicit vdot instead
    const testResults = [
      { type: 'vdot_test', vdot: 55, date: '2024-01-08' },
      { type: 'vdot_test', vdot: 60, date: '2024-01-15' },
    ]
    const result = computeVDOTBenchmark([], testResults, { age: 65, gender: 'male' })
    // 60+ male p90=47; vdot 60 >= 47 → top10 → nextTier null
    expect(result).not.toBeNull()
    expect(result.tier.percentile).toBe('top10')
    expect(result.nextTier).toBeNull()
  })

  it('nextTier gives vdotNeeded for below_median', () => {
    const result = computeVDOTBenchmark(syntheticLog, [], profile35m)
    if (result && result.tier.percentile === 'below_median') {
      expect(result.nextTier).not.toBeNull()
      expect(result.nextTier.vdotNeeded).toBeGreaterThan(0)
      expect(result.nextTier.label).toBe('ABOVE MEDIAN')
    } else if (result) {
      // If median: nextTier → TOP 25%
      expect(result.nextTier?.label).toBe('TOP 25%')
    }
  })

  it('uses female norms when gender=female', () => {
    const result = computeVDOTBenchmark(syntheticLog, [], profile35f)
    expect(result.gender).toBe('female')
    // 30-39 female p50=38; 30-39 male p50=45 — female norm is lower
    expect(result.norm.p50).toBe(38)
  })

  it('works with testResults containing explicit vdot', () => {
    const testResults = [
      { type: 'vdot_test', vdot: 50, date: '2024-01-08' },
      { type: 'vdot_test', vdot: 53, date: '2024-01-15' },
    ]
    const result = computeVDOTBenchmark([], testResults, profile35m)
    expect(result).not.toBeNull()
    expect(result.currentVdot).toBe(53)
    expect(result.tier.percentile).toBe('top25') // 53 >= p75(53) for 30-39 male
  })
})
