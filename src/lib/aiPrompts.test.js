import { describe, it, expect } from 'vitest'
import { appendToneModifier, getFeedbackStats } from './aiPrompts.js'

describe('appendToneModifier', () => {
  it("'motivating' returns string containing 'encouraging'", () => {
    const result = appendToneModifier('motivating')
    expect(result.toLowerCase()).toContain('encouraging')
  })

  it("'clinical' returns string containing 'terminology'", () => {
    const result = appendToneModifier('clinical')
    expect(result.toLowerCase()).toContain('terminology')
  })

  it("'concise' returns string containing '15 words'", () => {
    const result = appendToneModifier('concise')
    expect(result).toContain('15 words')
  })

  it("empty string returns empty string", () => {
    const result = appendToneModifier('')
    expect(result).toBe('')
  })

  it('unknown tone returns empty string', () => {
    expect(appendToneModifier('aggressive')).toBe('')
    expect(appendToneModifier(undefined)).toBe('')
  })
})

describe('getFeedbackStats', () => {
  it('calculates ratio correctly from mixed positive and negative entries', () => {
    const entries = [
      { action: 'feedback', resource: 'ai_insights', details: { rating: 1 } },
      { action: 'feedback', resource: 'ai_insights', details: { rating: 1 } },
      { action: 'feedback', resource: 'ai_insights', details: { rating: -1 } },
      { action: 'view',     resource: 'ai_insights', details: { rating: 1 } },  // excluded (not feedback)
      { action: 'feedback', resource: 'training_log', details: { rating: 1 } }, // excluded (wrong resource)
    ]
    const result = getFeedbackStats(entries)
    expect(result.positive).toBe(2)
    expect(result.negative).toBe(1)
    expect(result.ratio).toBeCloseTo(0.67, 1)
  })

  it('returns zero ratio when no feedback entries exist', () => {
    const result = getFeedbackStats([])
    expect(result.positive).toBe(0)
    expect(result.negative).toBe(0)
    expect(result.ratio).toBe(0)
  })

  it('handles non-array input gracefully', () => {
    expect(getFeedbackStats(null)).toEqual({ positive: 0, negative: 0, ratio: 0 })
    expect(getFeedbackStats(undefined)).toEqual({ positive: 0, negative: 0, ratio: 0 })
  })

  it('returns ratio of 1 when all entries are positive', () => {
    const entries = [
      { action: 'feedback', resource: 'ai_insights', details: { rating: 1 } },
      { action: 'feedback', resource: 'ai_insights', details: { rating: 1 } },
    ]
    const result = getFeedbackStats(entries)
    expect(result.ratio).toBe(1)
    expect(result.negative).toBe(0)
  })

  it('returns ratio of 0 when all entries are negative', () => {
    const entries = [
      { action: 'feedback', resource: 'ai_insights', details: { rating: -1 } },
    ]
    const result = getFeedbackStats(entries)
    expect(result.ratio).toBe(0)
    expect(result.positive).toBe(0)
  })
})
