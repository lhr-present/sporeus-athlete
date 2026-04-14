import { describe, it, expect } from 'vitest'
import { RECOVERY_PROTOCOLS, getRecommendedProtocols } from './recoveryProtocols.js'

describe('RECOVERY_PROTOCOLS', () => {
  it('has exactly 8 items', () => {
    expect(RECOVERY_PROTOCOLS).toHaveLength(8)
  })

  it('each protocol has id, name, duration, evidence_level, and steps as an array', () => {
    for (const protocol of RECOVERY_PROTOCOLS) {
      expect(protocol).toHaveProperty('id')
      expect(typeof protocol.id).toBe('string')
      expect(protocol).toHaveProperty('name')
      expect(typeof protocol.name).toBe('string')
      expect(protocol).toHaveProperty('duration')
      expect(protocol).toHaveProperty('evidence_level')
      expect(['strong', 'moderate', 'limited']).toContain(protocol.evidence_level)
      expect(protocol).toHaveProperty('steps')
      expect(Array.isArray(protocol.steps)).toBe(true)
      expect(protocol.steps.length).toBeGreaterThan(0)
    }
  })
})

describe('getRecommendedProtocols', () => {
  it('includes nutrition_window when sessionTSS > 80 and within 2 hours', () => {
    const result = getRecommendedProtocols(4, 100, 0.5)
    const ids = result.map(p => p.id)
    expect(ids).toContain('nutrition_window')
  })

  it('includes a cold or contrast protocol for low wellness score after 1+ hour', () => {
    const result = getRecommendedProtocols(2, 60, 3)
    const ids = result.map(p => p.id)
    const hasColdOrContrast =
      ids.includes('cold_water_immersion') || ids.includes('contrast_bathing')
    expect(hasColdOrContrast).toBe(true)
  })

  it('returns exactly 2 items without throwing when params are null', () => {
    let result
    expect(() => {
      result = getRecommendedProtocols(null, null, null)
    }).not.toThrow()
    expect(result).toHaveLength(2)
  })

  it('always returns 2 or 3 protocols for valid inputs', () => {
    const cases = [
      [5, 50, 1],
      [3, 90, 0.5],
      [1, 30, 10],
      [2, 110, 1.5],
    ]
    for (const [wellness, tss, hours] of cases) {
      const result = getRecommendedProtocols(wellness, tss, hours)
      expect(result.length).toBeGreaterThanOrEqual(2)
      expect(result.length).toBeLessThanOrEqual(3)
    }
  })
})
