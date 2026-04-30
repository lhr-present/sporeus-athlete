// E98
import { describe, it, expect } from 'vitest'
import {
  RECOVERY_PROTOCOLS,
  getRecommendedProtocols,
} from '../recoveryProtocols.js'

// ─── RECOVERY_PROTOCOLS constant ─────────────────────────────────────────────
describe('RECOVERY_PROTOCOLS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(RECOVERY_PROTOCOLS)).toBe(true)
    expect(RECOVERY_PROTOCOLS.length).toBeGreaterThan(0)
  })

  it('has exactly 8 protocols', () => {
    expect(RECOVERY_PROTOCOLS).toHaveLength(8)
  })

  it('every protocol has required fields: id, name, text_en, text_tr, duration, evidence_level, steps, source', () => {
    const required = ['id', 'name', 'text_en', 'text_tr', 'duration', 'evidence_level', 'steps', 'source']
    for (const p of RECOVERY_PROTOCOLS) {
      for (const field of required) {
        expect(p, `protocol ${p.id} missing field ${field}`).toHaveProperty(field)
      }
    }
  })

  it('every protocol has a non-empty steps array', () => {
    for (const p of RECOVERY_PROTOCOLS) {
      expect(Array.isArray(p.steps), `${p.id} steps not array`).toBe(true)
      expect(p.steps.length, `${p.id} has empty steps`).toBeGreaterThan(0)
    }
  })

  it('evidence_level is one of strong / moderate / limited', () => {
    const valid = new Set(['strong', 'moderate', 'limited'])
    for (const p of RECOVERY_PROTOCOLS) {
      expect(valid.has(p.evidence_level), `${p.id} has invalid evidence_level "${p.evidence_level}"`).toBe(true)
    }
  })

  it('all protocol IDs are unique', () => {
    const ids = RECOVERY_PROTOCOLS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('includes nutrition_window protocol', () => {
    const ids = RECOVERY_PROTOCOLS.map(p => p.id)
    expect(ids).toContain('nutrition_window')
  })

  it('includes cold_water_immersion protocol', () => {
    const ids = RECOVERY_PROTOCOLS.map(p => p.id)
    expect(ids).toContain('cold_water_immersion')
  })

  it('includes sleep_hygiene protocol', () => {
    const ids = RECOVERY_PROTOCOLS.map(p => p.id)
    expect(ids).toContain('sleep_hygiene')
  })

  it('includes active_recovery protocol', () => {
    const ids = RECOVERY_PROTOCOLS.map(p => p.id)
    expect(ids).toContain('active_recovery')
  })

  it('nutrition_window is at index 0 (used as null-guard fallback)', () => {
    expect(RECOVERY_PROTOCOLS[0].id).toBe('nutrition_window')
  })

  it('active_recovery is at index 3 (used as null-guard fallback)', () => {
    expect(RECOVERY_PROTOCOLS[3].id).toBe('active_recovery')
  })

  it('nutrition_window has evidence_level strong', () => {
    const p = RECOVERY_PROTOCOLS.find(x => x.id === 'nutrition_window')
    expect(p.evidence_level).toBe('strong')
  })

  it('breathing_478 has evidence_level limited', () => {
    const p = RECOVERY_PROTOCOLS.find(x => x.id === 'breathing_478')
    expect(p.evidence_level).toBe('limited')
  })
})

// ─── getRecommendedProtocols ──────────────────────────────────────────────────
describe('getRecommendedProtocols — null / undefined guards', () => {
  it('returns array when all params are null', () => {
    const result = getRecommendedProtocols(null, null, null)
    expect(Array.isArray(result)).toBe(true)
  })

  it('returns exactly 2 protocols when all params are null', () => {
    expect(getRecommendedProtocols(null, null, null)).toHaveLength(2)
  })

  it('returns nutrition_window + active_recovery when all params null', () => {
    const result = getRecommendedProtocols(null, null, null)
    expect(result[0].id).toBe('nutrition_window')
    expect(result[1].id).toBe('active_recovery')
  })

  it('returns fallback when wellnessScore is null only', () => {
    const result = getRecommendedProtocols(null, 100, 1)
    expect(result[0].id).toBe('nutrition_window')
    expect(result[1].id).toBe('active_recovery')
  })

  it('returns fallback when sessionTSS is null only', () => {
    const result = getRecommendedProtocols(3, null, 1)
    expect(result[0].id).toBe('nutrition_window')
    expect(result[1].id).toBe('active_recovery')
  })

  it('returns fallback when hoursSinceSession is null only', () => {
    const result = getRecommendedProtocols(3, 100, null)
    expect(result[0].id).toBe('nutrition_window')
    expect(result[1].id).toBe('active_recovery')
  })

  it('returns fallback when all are undefined', () => {
    const result = getRecommendedProtocols(undefined, undefined, undefined)
    expect(result[0].id).toBe('nutrition_window')
  })
})

describe('getRecommendedProtocols — Rule 1: recent hard session', () => {
  it('includes nutrition_window when TSS > 80 and hours < 2', () => {
    // wellness high enough to not trigger low-wellness rules
    const result = getRecommendedProtocols(4, 100, 0.5)
    expect(result.map(p => p.id)).toContain('nutrition_window')
  })

  it('includes nutrition_window at exact boundary TSS=81 hours=1', () => {
    const result = getRecommendedProtocols(4, 81, 1)
    expect(result.map(p => p.id)).toContain('nutrition_window')
  })

  it('does NOT include nutrition_window when TSS <= 80', () => {
    const result = getRecommendedProtocols(4, 80, 0.5)
    expect(result.map(p => p.id)).not.toContain('nutrition_window')
  })

  it('does NOT include nutrition_window when hours >= 2', () => {
    const result = getRecommendedProtocols(4, 120, 2)
    expect(result.map(p => p.id)).not.toContain('nutrition_window')
  })
})

describe('getRecommendedProtocols — Rule 2: low wellness', () => {
  it('includes cold_water_immersion when wellness < 3 and hours > 1', () => {
    const result = getRecommendedProtocols(2, 50, 2)
    expect(result.map(p => p.id)).toContain('cold_water_immersion')
  })

  it('includes contrast_bathing when wellness < 3 and hours > 1', () => {
    const result = getRecommendedProtocols(2, 50, 2)
    expect(result.map(p => p.id)).toContain('contrast_bathing')
  })

  it('does NOT trigger low-wellness rule when wellness >= 3', () => {
    const result = getRecommendedProtocols(3, 50, 2)
    expect(result.map(p => p.id)).not.toContain('cold_water_immersion')
  })

  it('does NOT trigger low-wellness rule when hours <= 1', () => {
    const result = getRecommendedProtocols(1, 50, 1)
    expect(result.map(p => p.id)).not.toContain('cold_water_immersion')
  })

  it('low wellness + recent hard session picks nutrition_window first, then CWI', () => {
    const result = getRecommendedProtocols(1, 100, 1.5)
    const ids = result.map(p => p.id)
    expect(ids[0]).toBe('nutrition_window')
    expect(ids).toContain('cold_water_immersion')
  })
})

describe('getRecommendedProtocols — output shape', () => {
  it('always returns 2–3 protocol objects', () => {
    const cases = [
      [4, 50, 0.5],
      [4, 100, 0.5],
      [2, 50, 2],
      [1, 100, 1.5],
      [4, 50, 10],
    ]
    for (const [w, t, h] of cases) {
      const result = getRecommendedProtocols(w, t, h)
      expect(result.length, `params(${w},${t},${h})`).toBeGreaterThanOrEqual(2)
      expect(result.length, `params(${w},${t},${h})`).toBeLessThanOrEqual(3)
    }
  })

  it('never returns duplicate protocols', () => {
    const cases = [
      [1, 100, 1.5],
      [2, 50, 9],
      [4, 100, 1],
      [3, 100, 0.5],
    ]
    for (const [w, t, h] of cases) {
      const result = getRecommendedProtocols(w, t, h)
      const ids = result.map(p => p.id)
      expect(new Set(ids).size, `duplicates for (${w},${t},${h}): [${ids}]`).toBe(ids.length)
    }
  })

  it('always returns protocol objects (not strings or nulls)', () => {
    const result = getRecommendedProtocols(4, 50, 0.5)
    for (const p of result) {
      expect(typeof p).toBe('object')
      expect(p).not.toBeNull()
      expect(p.id).toBeDefined()
    }
  })

  it('returned protocols are from RECOVERY_PROTOCOLS (reference equality)', () => {
    const validIds = new Set(RECOVERY_PROTOCOLS.map(p => p.id))
    const result = getRecommendedProtocols(3, 50, 4)
    for (const p of result) {
      expect(validIds.has(p.id)).toBe(true)
    }
  })
})

describe('getRecommendedProtocols — active_recovery as default filler', () => {
  it('includes active_recovery when no strong rules apply and list < 3', () => {
    // high wellness, low TSS, moderate hours — only active_recovery should fill
    const result = getRecommendedProtocols(5, 30, 4)
    expect(result.map(p => p.id)).toContain('active_recovery')
  })
})

describe('getRecommendedProtocols — boundary conditions', () => {
  it('wellnessScore = 2.9 triggers low-wellness rule', () => {
    const result = getRecommendedProtocols(2.9, 50, 2)
    expect(result.map(p => p.id)).toContain('cold_water_immersion')
  })

  it('wellnessScore = 3.0 does NOT trigger low-wellness rule', () => {
    const result = getRecommendedProtocols(3.0, 50, 2)
    expect(result.map(p => p.id)).not.toContain('cold_water_immersion')
  })

  it('hoursSinceSession = 0.5 with TSS=100 triggers nutrition_window', () => {
    const result = getRecommendedProtocols(4, 100, 0.5)
    expect(result.map(p => p.id)).toContain('nutrition_window')
  })

  it('hoursSinceSession = 2.0 does NOT trigger nutrition_window (not < 2)', () => {
    const result = getRecommendedProtocols(4, 100, 2.0)
    expect(result.map(p => p.id)).not.toContain('nutrition_window')
  })
})
