import { describe, it, expect } from 'vitest'
import { computeHRVReadiness, getAerobicThresholdFromDFA } from './hrv.js'

describe('computeHRVReadiness', () => {
  it('score=114 and band=High when recent > baseline by 14%', () => {
    const result = computeHRVReadiness(80, 70, 5)
    expect(result.score).toBe(114)
    expect(result.band).toBe('High')
  })

  it('score=100 and band=Normal when recent equals baseline', () => {
    const result = computeHRVReadiness(70, 70, 5)
    expect(result.score).toBe(100)
    expect(result.band).toBe('Normal')
  })

  it('score=86 and band=Low when recent is 14% below baseline', () => {
    const result = computeHRVReadiness(60, 70, 5)
    expect(result.score).toBe(86)
    expect(result.band).toBe('Low')
  })

  it('returns null when recentRMSSD is null', () => {
    expect(computeHRVReadiness(null, 70, 5)).toBeNull()
  })

  it('returns null when baselineRMSSD is 0 (invalid)', () => {
    expect(computeHRVReadiness(80, 0, 5)).toBeNull()
  })
})

describe('getAerobicThresholdFromDFA', () => {
  it('returns threshold_hr=155 with confidence=low when prev dfa1=0.80 (not > 0.80)', () => {
    const series = [
      { hr: 130, dfa1: 0.9 },
      { hr: 145, dfa1: 0.8 },
      { hr: 155, dfa1: 0.70 },
    ]
    const result = getAerobicThresholdFromDFA(series)
    expect(result.threshold_hr).toBe(155)
    expect(result.confidence).toBe('low')
  })

  it('returns threshold_hr=155 with confidence=high when prev dfa1=0.85 (> 0.80)', () => {
    const series = [
      { hr: 130, dfa1: 0.9 },
      { hr: 145, dfa1: 0.85 },
      { hr: 155, dfa1: 0.70 },
    ]
    const result = getAerobicThresholdFromDFA(series)
    expect(result.threshold_hr).toBe(155)
    expect(result.confidence).toBe('high')
  })

  it('returns null when fewer than 3 points', () => {
    expect(getAerobicThresholdFromDFA([{ hr: 130, dfa1: 0.9 }])).toBeNull()
  })
})
