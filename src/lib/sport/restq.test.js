import { describe, it, expect } from 'vitest'
import { RESTQ_ITEMS, scoreRESTQ, isRESTQDue } from './restq.js'

// ── RESTQ_ITEMS structure ─────────────────────────────────────────────────────

describe('RESTQ_ITEMS', () => {
  it('has exactly 19 items', () => {
    expect(RESTQ_ITEMS).toHaveLength(19)
  })

  it('each item has id, subscale, type (stress|recovery), text_en, text_tr', () => {
    for (const item of RESTQ_ITEMS) {
      expect(item.id).toBeTruthy()
      expect(item.subscale).toBeTruthy()
      expect(['stress', 'recovery']).toContain(item.type)
      expect(item.text_en).toBeTruthy()
      expect(item.text_tr).toBeTruthy()
    }
  })

  it('has exactly 9 stress and 10 recovery items', () => {
    const stressCount   = RESTQ_ITEMS.filter(i => i.type === 'stress').length
    const recoveryCount = RESTQ_ITEMS.filter(i => i.type === 'recovery').length
    expect(stressCount).toBe(9)
    expect(recoveryCount).toBe(10)
  })
})

// ── scoreRESTQ ────────────────────────────────────────────────────────────────

/** Build a complete response object with uniform value for all items */
function uniformResponses(val) {
  return Object.fromEntries(RESTQ_ITEMS.map(i => [i.id, val]))
}

describe('scoreRESTQ — complete response', () => {
  it('well_recovered when recovery >> stress (stress=1, recovery=5)', () => {
    const responses = {}
    for (const item of RESTQ_ITEMS) responses[item.id] = item.type === 'stress' ? 1 : 5
    const result = scoreRESTQ(responses)
    expect(result.overall_stress).toBeCloseTo(1, 1)
    expect(result.overall_recovery).toBeCloseTo(5, 1)
    expect(result.balance).toBeCloseTo(4, 0)
    expect(result.interpretation).toBe('well_recovered')
    expect(result.completeness).toBe(100)
  })

  it('overreaching_risk when stress >> recovery (stress=5, recovery=1)', () => {
    const responses = {}
    for (const item of RESTQ_ITEMS) responses[item.id] = item.type === 'stress' ? 5 : 1
    const result = scoreRESTQ(responses)
    expect(result.balance).toBeLessThan(-1)
    expect(result.interpretation).toBe('overreaching_risk')
  })

  it('adequate when stress ≈ recovery (all items = 3)', () => {
    const result = scoreRESTQ(uniformResponses(3))
    expect(result.balance).toBeCloseTo(0, 1)
    expect(['adequate', 'watch']).toContain(result.interpretation)
  })

  it('returns subscales keyed by subscale name', () => {
    const result = scoreRESTQ(uniformResponses(3))
    expect(result.subscales['General Stress']).toBeDefined()
    expect(result.subscales['Overall Recovery']).toBeDefined()
    expect(result.subscales['Sleep Quality']).toBeDefined()
  })
})

describe('scoreRESTQ — incomplete response', () => {
  it('returns interpretation=incomplete for null input', () => {
    const result = scoreRESTQ(null)
    expect(result.interpretation).toBe('incomplete')
    expect(result.balance).toBeNull()
  })

  it('returns completeness < 100 when some items missing', () => {
    const partial = { gs1: 3, gs2: 2, gs3: 4 }
    const result = scoreRESTQ(partial)
    expect(result.completeness).toBeLessThan(100)
    expect(result.interpretation).toBe('incomplete')
  })
})

// ── isRESTQDue ────────────────────────────────────────────────────────────────

describe('isRESTQDue', () => {
  it('returns true if no history exists and log >= 14', () => {
    expect(isRESTQDue([], 20)).toBe(true)
    expect(isRESTQDue(null, 20)).toBe(true)
  })

  it('returns false if log < 14', () => {
    expect(isRESTQDue([], 10)).toBe(false)
    expect(isRESTQDue(null, 0)).toBe(false)
  })

  it('returns false if last RESTQ was < 28 days ago', () => {
    const recent = new Date()
    recent.setDate(recent.getDate() - 10)
    const history = [{ date: recent.toISOString().slice(0, 10) }]
    expect(isRESTQDue(history, 20)).toBe(false)
  })

  it('returns true if last RESTQ was >= 28 days ago', () => {
    const old = new Date()
    old.setDate(old.getDate() - 30)
    const history = [{ date: old.toISOString().slice(0, 10) }]
    expect(isRESTQDue(history, 20)).toBe(true)
  })
})
