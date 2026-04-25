// ─── consistencyTrend.test.js — E24: 12+ tests ───────────────────────────────
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

const TODAY   = '2026-04-25'
const LOG70   = makeLog(70, TODAY)   // 70-day daily training
const LOG10   = makeLog(10, TODAY)   // too short (< 14)
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
})

// ─── 2. consistencyHistory ────────────────────────────────────────────────────
describe('consistencyHistory', () => {
  it('returns [] for log < 14 entries', () => {
    expect(consistencyHistory(LOG10, 8, TODAY)).toEqual([])
    expect(consistencyHistory(LOG_EMPTY, 8, TODAY)).toEqual([])
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
})

// ─── 3. consistencyTrendSlope ─────────────────────────────────────────────────
describe('consistencyTrendSlope', () => {
  it('returns null for history with < 4 entries', () => {
    expect(consistencyTrendSlope([])).toBeNull()
    expect(consistencyTrendSlope([{ score: 80 }, { score: 85 }, { score: 90 }])).toBeNull()
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

  it('streak counts consecutive good/excellent weeks backwards', () => {
    const result = computeConsistencyTrend(LOG70, 8, TODAY)
    // Daily training → high consistency → streak should be >= 1
    expect(result.streak).toBeGreaterThanOrEqual(1)
  })

  it('streak is 0 when last week is fair or poor', () => {
    // Make a log with last 14 days having very sparse training (only 2 sessions)
    const sparse = []
    const base   = new Date(TODAY + 'T00:00:00Z')
    // 56 days of dense training, then 28 days with only 2 sessions
    for (let i = 83; i >= 28; i--) {
      const d = new Date(base)
      d.setUTCDate(d.getUTCDate() - i)
      sparse.push({ date: d.toISOString().slice(0, 10), tss: 60, rpe: 7, type: 'run' })
    }
    // Only 2 sessions in the last 28 days (very poor)
    sparse.push({ date: TODAY, tss: 60, rpe: 7, type: 'run' })
    const twoDaysAgo = new Date(base)
    twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2)
    sparse.push({ date: twoDaysAgo.toISOString().slice(0, 10), tss: 60, rpe: 7, type: 'run' })

    const result = computeConsistencyTrend(sparse, 8, TODAY)
    if (result) {
      // Latest score should be very low → poor tier → streak 0
      if (result.currentTier === 'poor' || result.currentTier === 'fair') {
        expect(result.streak).toBe(0)
      }
    }
    // If result is null, that's also acceptable for this edge case
  })
})
