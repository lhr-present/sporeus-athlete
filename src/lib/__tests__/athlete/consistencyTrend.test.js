// ─── consistencyTrend.test.js — E24: comprehensive unit tests ────────────────
import { describe, it, expect } from 'vitest'
import {
  classifyConsistency,
  consistencyHistory,
  consistencyTrendSlope,
  computeConsistencyTrend,
} from '../../athlete/consistencyTrend.js'

// ─── Synthetic log generator ──────────────────────────────────────────────────
/**
 * Generate `count` daily log entries ending on `today`.
 */
function makeLog(count = 70, today = '2026-04-25') {
  const log = []
  const base = new Date(today + 'T00:00:00Z')
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() - i)
    log.push({ date: d.toISOString().slice(0, 10), tss: 60, rpe: 7, type: 'run' })
  }
  return log
}

/**
 * Generate a sparse log: dense block of `denseDays` ending `gapDays` before `today`,
 * then only `sparseSessions` in the recent window.
 */
function makeSparseEndLog(denseDays = 60, gapDays = 28, sparseSessions = 2, today = '2026-04-25') {
  const log = []
  const base = new Date(today + 'T00:00:00Z')
  // Dense block from (denseDays + gapDays) days ago to gapDays ago
  for (let i = denseDays + gapDays - 1; i >= gapDays; i--) {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() - i)
    log.push({ date: d.toISOString().slice(0, 10), tss: 60, rpe: 7, type: 'run' })
  }
  // Sparse sessions in final gapDays window
  for (let s = 0; s < sparseSessions; s++) {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() - s)
    log.push({ date: d.toISOString().slice(0, 10), tss: 60, rpe: 7, type: 'run' })
  }
  return log
}

const TODAY     = '2026-04-25'
const FIXED_DAY = '2025-06-15'  // deterministic anchor date
const LOG70     = makeLog(70, TODAY)     // 70-day daily training
const LOG60_FD  = makeLog(60, FIXED_DAY) // 60-day daily training anchored to fixed date
const LOG10     = makeLog(10, TODAY)     // too short (< 14)
const LOG_EMPTY = []

// ─── 1. classifyConsistency ───────────────────────────────────────────────────
describe('classifyConsistency', () => {
  it('returns excellent for score >= 85', () => {
    expect(classifyConsistency(90)).toBe('excellent')
    expect(classifyConsistency(100)).toBe('excellent')
  })

  it('returns excellent at exact boundary 85', () => {
    expect(classifyConsistency(85)).toBe('excellent')
  })

  it('returns good for score >= 70 and < 85', () => {
    expect(classifyConsistency(70)).toBe('good')
    expect(classifyConsistency(80)).toBe('good')
    expect(classifyConsistency(84)).toBe('good')
  })

  it('returns fair for score >= 50 and < 70', () => {
    expect(classifyConsistency(50)).toBe('fair')
    expect(classifyConsistency(60)).toBe('fair')
    expect(classifyConsistency(69)).toBe('fair')
  })

  it('returns poor for score < 50', () => {
    expect(classifyConsistency(49)).toBe('poor')
    expect(classifyConsistency(0)).toBe('poor')
  })

  it('returns poor for negative score', () => {
    expect(classifyConsistency(-10)).toBe('poor')
  })

  it('tier boundaries are mutually exclusive', () => {
    const tiers = new Set([
      classifyConsistency(49),
      classifyConsistency(50),
      classifyConsistency(69),
      classifyConsistency(70),
      classifyConsistency(84),
      classifyConsistency(85),
    ])
    // 49→poor, 50→fair, 69→fair, 70→good, 84→good, 85→excellent
    expect(tiers.size).toBe(4)
  })
})

// ─── 2. consistencyHistory ────────────────────────────────────────────────────
describe('consistencyHistory', () => {
  it('returns [] for log < 14 entries', () => {
    expect(consistencyHistory(LOG10, 8, TODAY)).toEqual([])
    expect(consistencyHistory(LOG_EMPTY, 8, TODAY)).toEqual([])
  })

  it('returns [] for log with exactly 13 entries', () => {
    const log13 = makeLog(13, TODAY)
    expect(consistencyHistory(log13, 8, TODAY)).toEqual([])
  })

  it('returns correct number of entries for sufficient log', () => {
    const hist = consistencyHistory(LOG70, 8, TODAY)
    expect(hist.length).toBeGreaterThan(0)
    expect(hist.length).toBeLessThanOrEqual(8)
  })

  it('all entries have isoWeek in YYYY-Www format', () => {
    const hist = consistencyHistory(LOG70, 8, TODAY)
    for (const h of hist) {
      expect(h.isoWeek).toMatch(/^\d{4}-W\d{2}$/)
    }
  })

  it('all entries have valid tier values', () => {
    const valid = new Set(['excellent', 'good', 'fair', 'poor'])
    const hist = consistencyHistory(LOG70, 8, TODAY)
    for (const h of hist) {
      expect(valid.has(h.tier)).toBe(true)
    }
  })

  it('entries are ordered oldest to newest', () => {
    const hist = consistencyHistory(LOG70, 8, TODAY)
    for (let i = 1; i < hist.length; i++) {
      expect(hist[i].isoWeek >= hist[i - 1].isoWeek).toBe(true)
    }
  })

  it('all entries have score between 0 and 100', () => {
    const hist = consistencyHistory(LOG70, 8, TODAY)
    for (const h of hist) {
      expect(h.score).toBeGreaterThanOrEqual(0)
      expect(h.score).toBeLessThanOrEqual(100)
    }
  })

  it('score is a number (not null/undefined)', () => {
    const hist = consistencyHistory(LOG70, 8, TODAY)
    for (const h of hist) {
      expect(typeof h.score).toBe('number')
      expect(Number.isFinite(h.score)).toBe(true)
    }
  })

  it('each entry has isoWeek, score, and tier keys', () => {
    const hist = consistencyHistory(LOG70, 8, TODAY)
    for (const h of hist) {
      expect(h).toHaveProperty('isoWeek')
      expect(h).toHaveProperty('score')
      expect(h).toHaveProperty('tier')
    }
  })

  it('today param controls the anchor — different today yields different week labels', () => {
    const hist1 = consistencyHistory(LOG70, 4, TODAY)
    const hist2 = consistencyHistory(LOG60_FD, 4, FIXED_DAY)
    // Latest isoWeek should differ because today differs
    const lastWeek1 = hist1[hist1.length - 1]?.isoWeek
    const lastWeek2 = hist2[hist2.length - 1]?.isoWeek
    expect(lastWeek1).not.toBe(lastWeek2)
  })

  it('fixed today produces deterministic output on repeated calls', () => {
    const hist1 = consistencyHistory(LOG60_FD, 8, FIXED_DAY)
    const hist2 = consistencyHistory(LOG60_FD, 8, FIXED_DAY)
    expect(hist1).toEqual(hist2)
  })

  it('weeks param controls output length (4 weeks)', () => {
    const hist4 = consistencyHistory(LOG70, 4, TODAY)
    expect(hist4.length).toBeLessThanOrEqual(4)
  })

  it('weeks param controls output length (12 weeks) with large log', () => {
    const log120 = makeLog(120, TODAY)
    const hist12 = consistencyHistory(log120, 12, TODAY)
    expect(hist12.length).toBeLessThanOrEqual(12)
    expect(hist12.length).toBeGreaterThan(0)
  })

  it('default weeks is 8', () => {
    const histDefault = consistencyHistory(LOG70, undefined, TODAY)
    const hist8 = consistencyHistory(LOG70, 8, TODAY)
    expect(histDefault).toEqual(hist8)
  })

  it('dense log produces high scores (near 100) for recent weeks', () => {
    const hist = consistencyHistory(LOG70, 8, TODAY)
    // With daily training for 70 days, recent weeks should have score >= 85 (excellent)
    const latest = hist[hist.length - 1]
    expect(latest.score).toBeGreaterThanOrEqual(85)
    expect(latest.tier).toBe('excellent')
  })

  it('tier is consistent with score classification', () => {
    const hist = consistencyHistory(LOG70, 8, TODAY)
    for (const h of hist) {
      expect(h.tier).toBe(classifyConsistency(h.score))
    }
  })

  it('isoWeek labels are unique within result', () => {
    const hist = consistencyHistory(LOG70, 8, TODAY)
    const weeks = hist.map(h => h.isoWeek)
    const unique = new Set(weeks)
    expect(unique.size).toBe(weeks.length)
  })
})

// ─── 3. consistencyTrendSlope ─────────────────────────────────────────────────
describe('consistencyTrendSlope', () => {
  it('returns null for history with < 4 entries', () => {
    expect(consistencyTrendSlope([])).toBeNull()
    expect(consistencyTrendSlope([{ score: 80 }, { score: 85 }, { score: 90 }])).toBeNull()
  })

  it('returns null for empty array', () => {
    expect(consistencyTrendSlope([])).toBeNull()
  })

  it('returns object with slope, weeklyChange, improving for 4+ entries', () => {
    const history = [
      { score: 60 }, { score: 65 }, { score: 70 }, { score: 80 },
    ]
    const result = consistencyTrendSlope(history)
    expect(result).not.toBeNull()
    expect(typeof result.slope).toBe('number')
    expect(typeof result.weeklyChange).toBe('number')
    expect(typeof result.improving).toBe('boolean')
  })

  it('improving is true when slope > 0.5', () => {
    // Strong upward trend
    const history = [{ score: 40 }, { score: 60 }, { score: 80 }, { score: 100 }]
    const result = consistencyTrendSlope(history)
    expect(result.improving).toBe(true)
    expect(result.slope).toBeGreaterThan(0.5)
  })

  it('improving is false when slope <= 0.5', () => {
    // Flat or downward
    const history = [{ score: 80 }, { score: 80 }, { score: 78 }, { score: 79 }]
    const result = consistencyTrendSlope(history)
    expect(result.improving).toBe(false)
  })

  it('slope is 0 for perfectly flat history (all same score)', () => {
    const history = [{ score: 70 }, { score: 70 }, { score: 70 }, { score: 70 }]
    const result = consistencyTrendSlope(history)
    expect(result.slope).toBe(0)
    expect(result.improving).toBe(false)
  })

  it('weeklyChange is rounded to 1 decimal', () => {
    const history = [{ score: 50 }, { score: 60 }, { score: 70 }, { score: 80 }]
    const result = consistencyTrendSlope(history)
    // weeklyChange = Math.round(slope * 10) / 10
    const expected = Math.round(result.slope * 10) / 10
    expect(result.weeklyChange).toBe(expected)
  })

  it('downward trend produces negative slope and improving=false', () => {
    const history = [{ score: 90 }, { score: 70 }, { score: 50 }, { score: 30 }]
    const result = consistencyTrendSlope(history)
    expect(result.slope).toBeLessThan(0)
    expect(result.improving).toBe(false)
  })

  it('accepts longer histories (8 entries)', () => {
    const history = [40, 45, 50, 55, 60, 65, 70, 75].map(s => ({ score: s }))
    const result = consistencyTrendSlope(history)
    expect(result).not.toBeNull()
    expect(result.improving).toBe(true)
  })
})

// ─── 4. computeConsistencyTrend ───────────────────────────────────────────────
describe('computeConsistencyTrend', () => {
  it('returns null for log.length < 14', () => {
    expect(computeConsistencyTrend(LOG10, 8, TODAY)).toBeNull()
    expect(computeConsistencyTrend(LOG_EMPTY, 8, TODAY)).toBeNull()
  })

  it('returns correct shape for sufficient log', () => {
    const result = computeConsistencyTrend(LOG70, 8, TODAY)
    expect(result).not.toBeNull()
    expect(Array.isArray(result.weeks)).toBe(true)
    expect(typeof result.currentScore).toBe('number')
    expect(typeof result.currentTier).toBe('string')
    expect(typeof result.improving).toBe('boolean')
    expect(typeof result.streak).toBe('number')
    expect(result.citation).toBe('Bangsbo 2006 · Issurin 2008')
  })

  it('currentScore matches last entry in weeks array', () => {
    const result = computeConsistencyTrend(LOG70, 8, TODAY)
    const lastWeek = result.weeks[result.weeks.length - 1]
    expect(result.currentScore).toBe(lastWeek.score)
  })

  it('currentTier matches currentScore classification', () => {
    const result = computeConsistencyTrend(LOG70, 8, TODAY)
    expect(result.currentTier).toBe(classifyConsistency(result.currentScore))
  })

  it('streak counts consecutive good/excellent weeks backwards', () => {
    const result = computeConsistencyTrend(LOG70, 8, TODAY)
    // Daily training → high consistency → streak should be >= 1
    expect(result.streak).toBeGreaterThanOrEqual(1)
  })

  it('streak is 0 when last week is fair or poor', () => {
    const sparse = makeSparseEndLog(60, 28, 2, TODAY)
    const result = computeConsistencyTrend(sparse, 8, TODAY)
    if (result && (result.currentTier === 'poor' || result.currentTier === 'fair')) {
      expect(result.streak).toBe(0)
    }
    // null result is also acceptable for extreme sparsity
  })

  it('streak is non-negative integer', () => {
    const result = computeConsistencyTrend(LOG70, 8, TODAY)
    expect(result.streak).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(result.streak)).toBe(true)
  })

  it('trendSlope is null when fewer than 4 valid weeks computed', () => {
    // Only 15 days → may produce fewer than 4 qualifying weeks
    const log15 = makeLog(15, TODAY)
    const result = computeConsistencyTrend(log15, 8, TODAY)
    if (result && result.weeks.length < 4) {
      expect(result.trendSlope).toBeNull()
    }
  })

  it('trendSlope has slope/weeklyChange/improving when weeks >= 4', () => {
    const result = computeConsistencyTrend(LOG70, 8, TODAY)
    if (result && result.trendSlope) {
      expect(typeof result.trendSlope.slope).toBe('number')
      expect(typeof result.trendSlope.weeklyChange).toBe('number')
      expect(typeof result.trendSlope.improving).toBe('boolean')
    }
  })

  it('improving flag matches trendSlope.improving', () => {
    const result = computeConsistencyTrend(LOG70, 8, TODAY)
    if (result.trendSlope) {
      expect(result.improving).toBe(result.trendSlope.improving)
    } else {
      expect(result.improving).toBe(false)
    }
  })

  it('citation is always the same string', () => {
    const result = computeConsistencyTrend(LOG70, 8, TODAY)
    expect(result.citation).toBe('Bangsbo 2006 · Issurin 2008')
  })

  it('dense daily log gives excellent tier for current week', () => {
    const result = computeConsistencyTrend(LOG70, 8, TODAY)
    expect(result.currentTier).toBe('excellent')
  })
})
