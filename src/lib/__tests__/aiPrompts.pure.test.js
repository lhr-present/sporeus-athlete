// src/lib/__tests__/aiPrompts.pure.test.js — E104
import { describe, it, expect } from 'vitest'
import { appendToneModifier, getFeedbackStats } from '../aiPrompts.js'

// ── appendToneModifier ────────────────────────────────────────────────────────
describe('appendToneModifier', () => {
  it('returns motivating string for "motivating"', () => {
    const r = appendToneModifier('motivating')
    expect(r.length).toBeGreaterThan(10)
    expect(r.toLowerCase()).toContain('motivat')
  })

  it('is case-insensitive for motivating', () => {
    expect(appendToneModifier('MOTIVATING')).toBe(appendToneModifier('motivating'))
  })

  it('returns clinical string for "clinical"', () => {
    const r = appendToneModifier('clinical')
    expect(r.length).toBeGreaterThan(10)
    expect(r.toLowerCase()).toMatch(/terminolog|precise|science/)
  })

  it('is case-insensitive for clinical', () => {
    expect(appendToneModifier('Clinical')).toBe(appendToneModifier('clinical'))
  })

  it('returns concise string for "concise"', () => {
    const r = appendToneModifier('concise')
    expect(r.length).toBeGreaterThan(5)
    expect(r.toLowerCase()).toMatch(/word|15|under|short|summary/)
  })

  it('is case-insensitive for concise', () => {
    expect(appendToneModifier('CONCISE')).toBe(appendToneModifier('concise'))
  })

  it('returns empty string for unknown tone', () => {
    expect(appendToneModifier('aggressive')).toBe('')
    expect(appendToneModifier('friendly')).toBe('')
  })

  it('returns empty string for null', () => {
    expect(appendToneModifier(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(appendToneModifier(undefined)).toBe('')
  })

  it('returns empty string for empty string', () => {
    expect(appendToneModifier('')).toBe('')
  })

  it('trims whitespace before matching', () => {
    expect(appendToneModifier('  motivating  ')).toBe(appendToneModifier('motivating'))
  })

  it('all three known tones return distinct non-empty strings', () => {
    const m = appendToneModifier('motivating')
    const c = appendToneModifier('clinical')
    const s = appendToneModifier('concise')
    expect(m).not.toBe(c)
    expect(c).not.toBe(s)
    expect(m).not.toBe(s)
  })
})

// ── getFeedbackStats ──────────────────────────────────────────────────────────
describe('getFeedbackStats', () => {
  it('returns zeros for null input', () => {
    expect(getFeedbackStats(null)).toEqual({ positive: 0, negative: 0, ratio: 0 })
  })

  it('returns zeros for undefined input', () => {
    expect(getFeedbackStats(undefined)).toEqual({ positive: 0, negative: 0, ratio: 0 })
  })

  it('returns zeros for non-array input', () => {
    expect(getFeedbackStats('string')).toEqual({ positive: 0, negative: 0, ratio: 0 })
    expect(getFeedbackStats(42)).toEqual({ positive: 0, negative: 0, ratio: 0 })
  })

  it('returns zeros for empty array', () => {
    expect(getFeedbackStats([])).toEqual({ positive: 0, negative: 0, ratio: 0 })
  })

  it('counts positive feedback (rating=1)', () => {
    const entries = [
      { action: 'feedback', resource: 'ai_insights', details: { rating: 1 } },
      { action: 'feedback', resource: 'ai_insights', details: { rating: 1 } },
    ]
    const r = getFeedbackStats(entries)
    expect(r.positive).toBe(2)
    expect(r.negative).toBe(0)
  })

  it('counts negative feedback (rating=-1)', () => {
    const entries = [
      { action: 'feedback', resource: 'ai_insights', details: { rating: -1 } },
    ]
    const r = getFeedbackStats(entries)
    expect(r.positive).toBe(0)
    expect(r.negative).toBe(1)
  })

  it('ratio = positive / (positive + negative), rounded to 2dp', () => {
    const entries = [
      { action: 'feedback', resource: 'ai_insights', details: { rating: 1 } },
      { action: 'feedback', resource: 'ai_insights', details: { rating: 1 } },
      { action: 'feedback', resource: 'ai_insights', details: { rating: -1 } },
    ]
    const r = getFeedbackStats(entries)
    expect(r.positive).toBe(2)
    expect(r.negative).toBe(1)
    expect(r.ratio).toBeCloseTo(0.67, 2)
  })

  it('ratio is 1 when all feedback is positive', () => {
    const entries = [
      { action: 'feedback', resource: 'ai_insights', details: { rating: 1 } },
    ]
    expect(getFeedbackStats(entries).ratio).toBe(1)
  })

  it('ratio is 0 when all feedback is negative', () => {
    const entries = [
      { action: 'feedback', resource: 'ai_insights', details: { rating: -1 } },
    ]
    expect(getFeedbackStats(entries).ratio).toBe(0)
  })

  it('ignores entries with wrong action', () => {
    const entries = [
      { action: 'view', resource: 'ai_insights', details: { rating: 1 } },
      { action: 'feedback', resource: 'ai_insights', details: { rating: 1 } },
    ]
    expect(getFeedbackStats(entries).positive).toBe(1)
  })

  it('ignores entries with wrong resource', () => {
    const entries = [
      { action: 'feedback', resource: 'training_log', details: { rating: 1 } },
      { action: 'feedback', resource: 'ai_insights', details: { rating: 1 } },
    ]
    expect(getFeedbackStats(entries).positive).toBe(1)
  })

  it('ignores entries with no details', () => {
    const entries = [
      { action: 'feedback', resource: 'ai_insights' },
      { action: 'feedback', resource: 'ai_insights', details: { rating: 1 } },
    ]
    expect(getFeedbackStats(entries).positive).toBe(1)
  })

  it('ignores null entries in array', () => {
    const entries = [
      null,
      { action: 'feedback', resource: 'ai_insights', details: { rating: 1 } },
    ]
    expect(getFeedbackStats(entries).positive).toBe(1)
  })

  it('result always has positive, negative, ratio keys', () => {
    const r = getFeedbackStats([])
    expect(r).toHaveProperty('positive')
    expect(r).toHaveProperty('negative')
    expect(r).toHaveProperty('ratio')
  })

  it('ratio is 0 when no matching entries (no div-by-zero)', () => {
    const entries = [
      { action: 'view', resource: 'training_log', details: { rating: 1 } },
    ]
    expect(getFeedbackStats(entries).ratio).toBe(0)
  })
})
