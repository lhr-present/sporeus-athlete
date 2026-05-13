// @vitest-environment jsdom
// v9.104.0 (Prompt FF) — plan version tracking tests.

import { describe, it, expect, beforeEach } from 'vitest'
import { makeVersionTag, recordPlanVersion, readPlanHistory } from '../../plan/versionTracking.js'

const KEY = 'sporeus-plan-history'

describe('makeVersionTag', () => {
  it('produces a tag with kind only', () => {
    expect(makeVersionTag('starter')).toBe('9.104.0-starter')
    expect(makeVersionTag('deload')).toBe('9.104.0-deload')
  })
  it('appends suffix when provided', () => {
    expect(makeVersionTag('deload', 'w3')).toBe('9.104.0-deload-w3')
    expect(makeVersionTag('recalibrate', 'age')).toBe('9.104.0-recalibrate-age')
  })
  it('defaults missing kind to manual', () => {
    expect(makeVersionTag(null)).toBe('9.104.0-manual')
    expect(makeVersionTag()).toBe('9.104.0-manual')
  })
})

describe('recordPlanVersion', () => {
  beforeEach(() => { localStorage.clear() })

  it('mutates plan.versionTag on the passed plan', () => {
    const plan = { goal: 'Half Marathon', weeks: [{}, {}, {}] }
    recordPlanVersion(plan, 'starter')
    expect(plan.versionTag).toBe('9.104.0-starter')
  })

  it('writes a history entry with ts, weeks, goal', () => {
    const plan = { goal: '5K', weeks: [1, 2, 3, 4] }
    recordPlanVersion(plan, 'regen')
    const history = readPlanHistory()
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({
      versionTag: '9.104.0-regen',
      weeks: 4,
      goal: '5K',
    })
    expect(typeof history[0].ts).toBe('string')
  })

  it('appends multiple entries in order', () => {
    recordPlanVersion({ goal: '5K', weeks: [1] }, 'starter')
    recordPlanVersion({ goal: '5K', weeks: [1, 2] }, 'deload', 'w2')
    recordPlanVersion({ goal: '5K', weeks: [1, 2, 3] }, 'regen')
    const history = readPlanHistory()
    expect(history.map(h => h.versionTag)).toEqual([
      '9.104.0-starter',
      '9.104.0-deload-w2',
      '9.104.0-regen',
    ])
  })

  it('caps history at 5 entries (drops oldest)', () => {
    for (let i = 0; i < 8; i++) {
      recordPlanVersion({ goal: 'X', weeks: [] }, 'regen', `iter${i}`)
    }
    const history = readPlanHistory()
    expect(history).toHaveLength(5)
    expect(history[0].versionTag).toBe('9.104.0-regen-iter3')
    expect(history[4].versionTag).toBe('9.104.0-regen-iter7')
  })

  it('tolerates null plan', () => {
    expect(() => recordPlanVersion(null, 'starter')).not.toThrow()
    expect(readPlanHistory()).toEqual([])
  })

  it('handles missing weeks array', () => {
    const plan = { goal: 'X' }
    recordPlanVersion(plan, 'starter')
    expect(readPlanHistory()[0].weeks).toBe(0)
  })
})

describe('readPlanHistory', () => {
  beforeEach(() => { localStorage.clear() })

  it('returns empty array when nothing stored', () => {
    expect(readPlanHistory()).toEqual([])
  })

  it('returns empty array on malformed JSON', () => {
    localStorage.setItem(KEY, '{not json}')
    expect(readPlanHistory()).toEqual([])
  })

  it('returns empty array when stored value is not an array', () => {
    localStorage.setItem(KEY, JSON.stringify({ foo: 'bar' }))
    expect(readPlanHistory()).toEqual([])
  })
})
