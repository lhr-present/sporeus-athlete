// Coverage-gap sweep — src/lib/sport/restq.js
// Tests RESTQ-Sport Short Form scoring (Kellmann & Kallus 2001).
import { describe, it, expect } from 'vitest'
import { RESTQ_ITEMS, scoreRESTQ, isRESTQDue } from '../../sport/restq.js'

// ─── Helpers ────────────────────────────────────────────────────────────────
function fillResponses(stressVal, recoveryVal) {
  const r = {}
  for (const item of RESTQ_ITEMS) {
    r[item.id] = item.type === 'stress' ? stressVal : recoveryVal
  }
  return r
}

// ─── RESTQ_ITEMS metadata ───────────────────────────────────────────────────
describe('RESTQ_ITEMS', () => {
  it('contains exactly 19 items', () => {
    expect(RESTQ_ITEMS).toHaveLength(19)
  })

  it('every item has id, subscale, type, text_en, text_tr', () => {
    for (const item of RESTQ_ITEMS) {
      expect(item.id).toBeTruthy()
      expect(item.subscale).toBeTruthy()
      expect(['stress', 'recovery']).toContain(item.type)
      expect(item.text_en).toBeTruthy()
      expect(item.text_tr).toBeTruthy()
    }
  })

  it('item ids are unique', () => {
    const ids = RESTQ_ITEMS.map(i => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('contains 9 stress items and 10 recovery items', () => {
    const stress   = RESTQ_ITEMS.filter(i => i.type === 'stress').length
    const recovery = RESTQ_ITEMS.filter(i => i.type === 'recovery').length
    expect(stress).toBe(9)
    expect(recovery).toBe(10)
    expect(stress + recovery).toBe(19)
  })

  it('subscales include both standard sets', () => {
    const subscales = new Set(RESTQ_ITEMS.map(i => i.subscale))
    expect(subscales.has('General Stress')).toBe(true)
    expect(subscales.has('Sleep Quality')).toBe(true)
    expect(subscales.has('Self-Efficacy')).toBe(true)
  })
})

// ─── scoreRESTQ — null / malformed ──────────────────────────────────────────
describe('scoreRESTQ — null / malformed', () => {
  it('null input returns incomplete shape with null aggregates', () => {
    const r = scoreRESTQ(null)
    expect(r.overall_stress).toBeNull()
    expect(r.overall_recovery).toBeNull()
    expect(r.balance).toBeNull()
    expect(r.interpretation).toBe('incomplete')
    expect(r.completeness).toBe(0)
  })

  it('non-object input (string) returns incomplete', () => {
    const r = scoreRESTQ('not-an-object')
    expect(r.interpretation).toBe('incomplete')
    expect(r.completeness).toBe(0)
  })

  it('empty object returns incomplete (0 answered < 10)', () => {
    const r = scoreRESTQ({})
    expect(r.interpretation).toBe('incomplete')
    expect(r.balance).toBeNull()
  })

  it('fewer than 10 valid answers returns incomplete', () => {
    const partial = { gs1: 2, gs2: 1, gs3: 2, es1: 1, es2: 1, pc1: 2, pc2: 2, le1: 1, le2: 1 } // 9 stress
    const r = scoreRESTQ(partial)
    expect(r.interpretation).toBe('incomplete')
    expect(r.completeness).toBeGreaterThan(0)
  })

  it('out-of-range values are excluded from aggregates', () => {
    const bad = { ...fillResponses(2, 5), gs1: 99, es1: -1, sg1: 'string' }
    const r = scoreRESTQ(bad)
    expect(r.completeness).toBeLessThan(100)
    // Scoring still runs because >=10 answered remain
    expect(r.interpretation).not.toBe('incomplete')
  })
})

// ─── scoreRESTQ — happy path ────────────────────────────────────────────────
describe('scoreRESTQ — interpretation tiers', () => {
  it('low stress + high recovery → well_recovered', () => {
    const r = scoreRESTQ(fillResponses(1, 5))
    expect(r.overall_stress).toBe(1)
    expect(r.overall_recovery).toBe(5)
    expect(r.balance).toBe(4)
    expect(r.interpretation).toBe('well_recovered')
    expect(r.interpretationLabel.en).toMatch(/Well-Recovered/)
    expect(r.interpretationLabel.tr).toMatch(/İyi Toparlanmış/)
  })

  it('balance ≥2 → well_recovered (boundary)', () => {
    const r = scoreRESTQ(fillResponses(2, 4))
    expect(r.balance).toBe(2)
    expect(r.interpretation).toBe('well_recovered')
  })

  it('balance 0–2 → adequate', () => {
    const r = scoreRESTQ(fillResponses(3, 4))
    expect(r.balance).toBe(1)
    expect(r.interpretation).toBe('adequate')
  })

  it('balance 0 → adequate (boundary)', () => {
    const r = scoreRESTQ(fillResponses(3, 3))
    expect(r.balance).toBe(0)
    expect(r.interpretation).toBe('adequate')
  })

  it('balance −1 to 0 → watch', () => {
    const r = scoreRESTQ(fillResponses(4, 3))
    expect(r.balance).toBe(-1)
    expect(r.interpretation).toBe('watch')
  })

  it('balance < −1 → overreaching_risk', () => {
    const r = scoreRESTQ(fillResponses(5, 1))
    expect(r.balance).toBe(-4)
    expect(r.interpretation).toBe('overreaching_risk')
    expect(r.interpretationLabel.en).toMatch(/Overreaching/)
  })

  it('completeness = 100 when all 19 answered', () => {
    const r = scoreRESTQ(fillResponses(2, 4))
    expect(r.completeness).toBe(100)
  })
})

// ─── scoreRESTQ — subscale shape ────────────────────────────────────────────
describe('scoreRESTQ — subscales', () => {
  it('returns one entry per unique subscale', () => {
    const r = scoreRESTQ(fillResponses(2, 4))
    const expectedSubscales = new Set(RESTQ_ITEMS.map(i => i.subscale))
    for (const name of expectedSubscales) {
      expect(r.subscales[name]).toBeDefined()
      expect(r.subscales[name].mean).toBeGreaterThanOrEqual(0)
      expect(r.subscales[name].mean).toBeLessThanOrEqual(6)
      expect(r.subscales[name].n).toBeGreaterThan(0)
      expect(['stress', 'recovery']).toContain(r.subscales[name].type)
    }
  })

  it('subscale mean rounded to 1 decimal', () => {
    const r = scoreRESTQ(fillResponses(2, 4))
    for (const sub of Object.values(r.subscales)) {
      const decimals = String(sub.mean).split('.')[1] || ''
      expect(decimals.length).toBeLessThanOrEqual(1)
    }
  })

  it('General Stress subscale has 3 items', () => {
    const r = scoreRESTQ(fillResponses(3, 3))
    expect(r.subscales['General Stress'].n).toBe(3)
  })
})

// ─── scoreRESTQ — value rounding ────────────────────────────────────────────
describe('scoreRESTQ — rounding', () => {
  it('overall scores rounded to 1 decimal', () => {
    const responses = fillResponses(2, 4)
    responses.gs1 = 3 // shift one stress item
    const r = scoreRESTQ(responses)
    const sd = String(r.overall_stress).split('.')[1] || ''
    const rd = String(r.overall_recovery).split('.')[1] || ''
    expect(sd.length).toBeLessThanOrEqual(1)
    expect(rd.length).toBeLessThanOrEqual(1)
  })

  it('balance value rounded to 1 decimal', () => {
    const r = scoreRESTQ(fillResponses(2, 4))
    const bd = String(r.balance).split('.')[1] || ''
    expect(bd.length).toBeLessThanOrEqual(1)
  })
})

// ─── isRESTQDue ─────────────────────────────────────────────────────────────
describe('isRESTQDue', () => {
  it('returns false when log < 14 entries (regardless of history)', () => {
    expect(isRESTQDue([], 0)).toBe(false)
    expect(isRESTQDue([], 13)).toBe(false)
    expect(isRESTQDue(null, 5)).toBe(false)
    expect(isRESTQDue([{ date: '2026-04-01' }], 13)).toBe(false)
  })

  it('null/empty history with sufficient log → true', () => {
    expect(isRESTQDue(null, 14)).toBe(true)
    expect(isRESTQDue([], 20)).toBe(true)
    expect(isRESTQDue(undefined, 14)).toBe(true)
  })

  it('recent history (< 28 days) → false', () => {
    const recent = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10)
    expect(isRESTQDue([{ date: recent }], 30)).toBe(false)
  })

  it('history older than default 28 days → true', () => {
    const old = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    expect(isRESTQDue([{ date: old }], 30)).toBe(true)
  })

  it('history exactly at 28-day boundary → true', () => {
    const old = new Date(Date.now() - 28 * 86400000).toISOString().slice(0, 10)
    expect(isRESTQDue([{ date: old }], 30)).toBe(true)
  })

  it('uses latest date in history', () => {
    const old      = new Date(Date.now() - 100 * 86400000).toISOString().slice(0, 10)
    const recent   = new Date(Date.now() - 5   * 86400000).toISOString().slice(0, 10)
    expect(isRESTQDue([{ date: old }, { date: recent }], 30)).toBe(false)
  })

  it('custom intervalDays parameter respected', () => {
    const at7days = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
    expect(isRESTQDue([{ date: at7days }], 30, 14)).toBe(false)
    expect(isRESTQDue([{ date: at7days }], 30, 7)).toBe(true)
  })
})
