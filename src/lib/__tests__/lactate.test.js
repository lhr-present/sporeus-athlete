import { describe, it, expect } from 'vitest'
import { computeLactateDrift } from '../sport/lactate.js'

describe('computeLactateDrift', () => {
  it('returns stable/low for empty array', () => {
    const result = computeLactateDrift([])
    expect(result).toEqual({ trend: 'stable', deltaPercent: 0, confidence: 'low' })
  })

  it('returns confidence low for 2 sessions', () => {
    const sessions = [
      { date: '2024-01-01', lt2W: 200 },
      { date: '2024-02-01', lt2W: 210 },
    ]
    const result = computeLactateDrift(sessions)
    expect(result.confidence).toBe('low')
  })

  it('returns stable and medium confidence for 3 sessions with identical lt2W', () => {
    const sessions = [
      { date: '2024-01-01', lt2W: 250 },
      { date: '2024-02-01', lt2W: 250 },
      { date: '2024-03-01', lt2W: 250 },
    ]
    const result = computeLactateDrift(sessions)
    expect(result.trend).toBe('stable')
    expect(result.confidence).toBe('medium')
  })

  it('returns improving and high confidence for 6 sessions with clear upward trend', () => {
    const sessions = [
      { date: '2024-01-01', lt2W: 200 },
      { date: '2024-02-01', lt2W: 210 },
      { date: '2024-03-01', lt2W: 220 },
      { date: '2024-04-01', lt2W: 230 },
      { date: '2024-05-01', lt2W: 240 },
      { date: '2024-06-01', lt2W: 250 },
    ]
    const result = computeLactateDrift(sessions)
    expect(result.trend).toBe('improving')
    expect(result.confidence).toBe('high')
  })

  it('returns declining and high confidence for 6 sessions with clear downward trend', () => {
    const sessions = [
      { date: '2024-01-01', lt2W: 250 },
      { date: '2024-02-01', lt2W: 240 },
      { date: '2024-03-01', lt2W: 230 },
      { date: '2024-04-01', lt2W: 220 },
      { date: '2024-05-01', lt2W: 210 },
      { date: '2024-06-01', lt2W: 200 },
    ]
    const result = computeLactateDrift(sessions)
    expect(result.trend).toBe('declining')
    expect(result.confidence).toBe('high')
  })

  it('filters out null/undefined/zero lt2W values and uses only valid entries', () => {
    const sessions = [
      { date: '2024-01-01', lt2W: null },
      { date: '2024-02-01', lt2W: undefined },
      { date: '2024-03-01', lt2W: 0 },
      { date: '2024-04-01', lt2W: 200 },
      { date: '2024-05-01', lt2W: 210 },
    ]
    // Only 2 valid sessions → confidence low
    const result = computeLactateDrift(sessions)
    expect(result.confidence).toBe('low')
  })

  it('returns medium confidence for 5 valid sessions', () => {
    const sessions = [
      { date: '2024-01-01', lt2W: 210 },
      { date: '2024-02-01', lt2W: 212 },
      { date: '2024-03-01', lt2W: 211 },
      { date: '2024-04-01', lt2W: 213 },
      { date: '2024-05-01', lt2W: 212 },
    ]
    const result = computeLactateDrift(sessions)
    expect(result.confidence).toBe('medium')
  })
})
