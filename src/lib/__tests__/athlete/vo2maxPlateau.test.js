// ─── vo2maxPlateau.test.js — pure-fn coverage ────────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  detectVO2maxPlateau,
  VO2MAX_PLATEAU_CITATION,
} from '../../athlete/vo2maxPlateau.js'

// Helper — build a VO2max test entry.
const t = (date, value, type = 'VO2max') => ({
  date, type, value, unit: 'ml/kg/min',
})

describe('detectVO2maxPlateau — gates', () => {
  it('returns null for empty testResults', () => {
    expect(detectVO2maxPlateau({ testResults: [], today: '2026-05-17' })).toBeNull()
  })

  it('returns null when called with no args', () => {
    expect(detectVO2maxPlateau()).toBeNull()
  })

  it('returns null when fewer than minTests VO2max tests', () => {
    const testResults = [
      t('2026-01-01', 50),
      t('2026-02-01', 50.5),
    ]
    expect(detectVO2maxPlateau({ testResults, today: '2026-05-17' })).toBeNull()
  })

  it('returns null when tests span fewer than plateauWeeks', () => {
    // Three flat tests but only across 3 weeks → not enough span
    const testResults = [
      t('2026-04-01', 50.0),
      t('2026-04-10', 50.2),
      t('2026-04-22', 50.1),
    ]
    expect(detectVO2maxPlateau({ testResults, today: '2026-04-23' })).toBeNull()
  })

  it('filters out non-VO2max test results', () => {
    const testResults = [
      { date: '2026-01-01', type: 'LactateThreshold', value: 4.0 },
      { date: '2026-02-01', type: 'CP',               value: 280 },
      t('2026-01-15', 50.0),
      t('2026-03-01', 50.5),
    ]
    // Only 2 VO2max entries → null on minTests gate
    expect(detectVO2maxPlateau({ testResults, today: '2026-05-17' })).toBeNull()
  })
})

describe('detectVO2maxPlateau — plateau detection', () => {
  it('flags a flat plateau (50, 50.5, 49.8 over 8 weeks) as isPlateau=true with low variancePct', () => {
    const testResults = [
      t('2026-03-01', 50.0),
      t('2026-04-01', 50.5),
      t('2026-04-26', 49.8),
    ]
    const r = detectVO2maxPlateau({ testResults, today: '2026-06-15' })
    expect(r).not.toBeNull()
    expect(r.isPlateau).toBe(true)
    expect(r.recentTests).toHaveLength(3)
    expect(r.varianceMlKgMin).toBeCloseTo(0.7, 1)
    expect(r.variancePct).toBeLessThanOrEqual(2)
    expect(r.weekSpan).toBeGreaterThanOrEqual(6)
    expect(r.citation).toBe(VO2MAX_PLATEAU_CITATION)
  })

  it('does NOT flag plateau on rising progression (50 → 53 → 56)', () => {
    const testResults = [
      t('2026-01-01', 50),
      t('2026-02-15', 53),
      t('2026-04-01', 56),
    ]
    const r = detectVO2maxPlateau({ testResults, today: '2026-05-30' })
    expect(r).not.toBeNull()
    expect(r.isPlateau).toBe(false)
    expect(r.variancePct).toBeGreaterThan(2)
    expect(r.recommendation).toBeNull()
  })

  it('sorts out-of-order input chronologically before computing', () => {
    const testResults = [
      t('2026-04-26', 49.8),
      t('2026-03-01', 50.0),
      t('2026-04-01', 50.5),
    ]
    const r = detectVO2maxPlateau({ testResults, today: '2026-06-15' })
    expect(r).not.toBeNull()
    // recentTests must be oldest → newest after internal sort
    expect(r.recentTests.map(x => x.date)).toEqual([
      '2026-03-01',
      '2026-04-01',
      '2026-04-26',
    ])
    expect(r.isPlateau).toBe(true)
  })

  it('returns recommendation from {change-stimulus, deload-restart, add-hills} when plateau', () => {
    const testResults = [
      t('2026-03-01', 50.0),
      t('2026-04-01', 50.5),
      t('2026-04-26', 49.8),
    ]
    const r = detectVO2maxPlateau({ testResults, today: '2026-06-15' })
    expect(r.isPlateau).toBe(true)
    expect(['change-stimulus', 'deload-restart', 'add-hills']).toContain(r.recommendation)
  })

  it('accepts lowercase/variant VO2max type strings', () => {
    const testResults = [
      { date: '2026-03-01', type: 'vo2max',  value: 50.0 },
      { date: '2026-04-01', type: 'VO2 Max', value: 50.5 },
      { date: '2026-04-26', type: 'vo2-max', value: 49.8 },
    ]
    const r = detectVO2maxPlateau({ testResults, today: '2026-06-15' })
    expect(r).not.toBeNull()
    expect(r.isPlateau).toBe(true)
  })

  it('returns null when most recent test is too fresh (< plateauWeeks ago)', () => {
    const testResults = [
      t('2026-03-01', 50.0),
      t('2026-04-01', 50.5),
      t('2026-05-14', 49.8),
    ]
    // Today is 2026-05-17 — newest is 3 days ago, far less than 6 weeks
    const r = detectVO2maxPlateau({ testResults, today: '2026-05-17' })
    expect(r).toBeNull()
  })

  it('variancePct rounded to 1dp', () => {
    const testResults = [
      t('2026-03-01', 50.0),
      t('2026-04-01', 50.5),
      t('2026-04-26', 49.8),
    ]
    const r = detectVO2maxPlateau({ testResults, today: '2026-06-15' })
    // 0.7 / 50.1 * 100 ≈ 1.4
    expect(Number(r.variancePct.toFixed(1))).toBe(r.variancePct)
    expect(r.variancePct).toBeGreaterThan(0)
    expect(r.variancePct).toBeLessThan(2)
  })
})
