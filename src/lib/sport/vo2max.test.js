import { describe, it, expect } from 'vitest'
import { estimateVO2maxFromRun, estimateVO2maxCooper, findBestVO2maxSession } from './vo2max.js'

describe('estimateVO2maxCooper', () => {
  it('Cooper: 2400m → VO2max ≈ 42', () => {
    const result = estimateVO2maxCooper(2400)
    // (2400 - 504.9) / 44.73 ≈ 42.3
    expect(result).toBeCloseTo(42, 0)
  })

  it('returns null for 0 distance', () => {
    expect(estimateVO2maxCooper(0)).toBeNull()
  })

  it('returns null for null input', () => {
    expect(estimateVO2maxCooper(null)).toBeNull()
  })
})

describe('estimateVO2maxFromRun', () => {
  it('Daniels: 5000m in 1200s → physiological range 35–85', () => {
    const result = estimateVO2maxFromRun(5000, 1200)
    expect(result).toBeGreaterThan(35)
    expect(result).toBeLessThan(85)
  })

  it('returns null for null inputs', () => {
    expect(estimateVO2maxFromRun(null, 1200)).toBeNull()
    expect(estimateVO2maxFromRun(5000, null)).toBeNull()
  })

  it('returns null for zero duration', () => {
    expect(estimateVO2maxFromRun(5000, 0)).toBeNull()
  })
})

describe('findBestVO2maxSession', () => {
  it('returns null for empty log', () => {
    expect(findBestVO2maxSession([])).toBeNull()
  })

  it('returns object with vo2max in range and method=daniels for a valid run entry', () => {
    const today = new Date().toISOString().slice(0, 10)
    const log = [{ date: today, distance: 5000, duration: 1200, type: 'Easy Run' }]
    const result = findBestVO2maxSession(log)
    expect(result).not.toBeNull()
    expect(result.vo2max).toBeGreaterThan(35)
    expect(result.vo2max).toBeLessThan(85)
    expect(result.method).toBe('daniels')
  })
})
