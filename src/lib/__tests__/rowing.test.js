import { describe, it, expect } from 'vitest'
import {
  splitPer500m,
  formatSplit,
  strokeEfficiency,
  classifyStrokeRate,
  rowingEfficiencyFactor,
} from '../sport/rowing.js'

describe('splitPer500m', () => {
  it('computes correct split for 2000m in 420s → 105s/500m', () => {
    expect(splitPer500m(2000, 420)).toBe(105)
  })

  it('returns null for zero distance (edge case)', () => {
    expect(splitPer500m(0, 100)).toBeNull()
  })
})

describe('formatSplit', () => {
  it('formats 105 seconds as "1:45.0"', () => {
    expect(formatSplit(105)).toBe('1:45.0')
  })

  it('formats 62.3 seconds as "1:02.3"', () => {
    expect(formatSplit(62.3)).toBe('1:02.3')
  })
})

describe('strokeEfficiency', () => {
  it('returns 10 m/stroke for 2000m / 200 strokes', () => {
    expect(strokeEfficiency(2000, 200)).toBe(10)
  })

  it('returns null for zero strokes', () => {
    expect(strokeEfficiency(2000, 0)).toBeNull()
  })
})

describe('classifyStrokeRate', () => {
  it('classifies 24 spm as threshold zone', () => {
    const result = classifyStrokeRate(24)
    expect(result.zone).toBe('threshold')
  })
})

describe('rowingEfficiencyFactor', () => {
  it('returns ~0.0307 for 2000m in 420s at 155 bpm', () => {
    // avgVelocity = 2000/420 ≈ 4.762 m/s; EF = 4.762/155 ≈ 0.03072
    const ef = rowingEfficiencyFactor(2000, 420, 155)
    expect(ef).toBeCloseTo(0.0307, 3)
  })

  it('returns null when avgHR is falsy', () => {
    expect(rowingEfficiencyFactor(2000, 420, 0)).toBeNull()
    expect(rowingEfficiencyFactor(2000, 420, null)).toBeNull()
  })
})
