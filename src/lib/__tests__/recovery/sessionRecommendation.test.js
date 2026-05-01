// ─── src/lib/__tests__/recovery/sessionRecommendation.test.js — E17 ──────────
// Unit tests for recommendSession.
// Pure-function tests across all four threshold bands + boundary + null inputs.

import { describe, it, expect } from 'vitest'
import {
  recommendSession,
  SESSION_REASONS,
  SESSION_CITATION,
} from '../../recovery/sessionRecommendation.js'

describe('recommendSession — band selection', () => {
  it('score < 40 → recovery', () => {
    expect(recommendSession(0).recommended).toBe('recovery')
    expect(recommendSession(20).recommended).toBe('recovery')
    expect(recommendSession(39).recommended).toBe('recovery')
    expect(recommendSession(39.99).recommended).toBe('recovery')
  })

  it('40 ≤ score < 60 → easy', () => {
    expect(recommendSession(40).recommended).toBe('easy')
    expect(recommendSession(50).recommended).toBe('easy')
    expect(recommendSession(59).recommended).toBe('easy')
    expect(recommendSession(59.9).recommended).toBe('easy')
  })

  it('60 ≤ score < 80 → planned', () => {
    expect(recommendSession(60).recommended).toBe('planned')
    expect(recommendSession(70).recommended).toBe('planned')
    expect(recommendSession(79).recommended).toBe('planned')
    expect(recommendSession(79.99).recommended).toBe('planned')
  })

  it('score ≥ 80 → push', () => {
    expect(recommendSession(80).recommended).toBe('push')
    expect(recommendSession(90).recommended).toBe('push')
    expect(recommendSession(100).recommended).toBe('push')
  })
})

describe('recommendSession — boundary scores', () => {
  it('exactly 40 is easy (lower bound inclusive)', () => {
    expect(recommendSession(40).recommended).toBe('easy')
  })
  it('exactly 60 is planned', () => {
    expect(recommendSession(60).recommended).toBe('planned')
  })
  it('exactly 80 is push', () => {
    expect(recommendSession(80).recommended).toBe('push')
  })
  it('39 is recovery, 40 is easy (transition)', () => {
    expect(recommendSession(39).recommended).toBe('recovery')
    expect(recommendSession(40).recommended).toBe('easy')
  })
  it('59 is easy, 60 is planned (transition)', () => {
    expect(recommendSession(59).recommended).toBe('easy')
    expect(recommendSession(60).recommended).toBe('planned')
  })
  it('79 is planned, 80 is push (transition)', () => {
    expect(recommendSession(79).recommended).toBe('planned')
    expect(recommendSession(80).recommended).toBe('push')
  })
})

describe('recommendSession — null / invalid input', () => {
  it('null score → easy with unknown reason', () => {
    const r = recommendSession(null)
    expect(r.recommended).toBe('easy')
    expect(r.reason).toBe(SESSION_REASONS.unknown)
    expect(r.score).toBeNull()
  })

  it('undefined score → easy with unknown reason', () => {
    const r = recommendSession(undefined)
    expect(r.recommended).toBe('easy')
    expect(r.score).toBeNull()
  })

  it('NaN score → easy with unknown reason', () => {
    const r = recommendSession(NaN)
    expect(r.recommended).toBe('easy')
    expect(r.score).toBeNull()
  })

  it('clamps out-of-range scores', () => {
    expect(recommendSession(-50).recommended).toBe('recovery')
    expect(recommendSession(150).recommended).toBe('push')
  })
})

describe('recommendSession — output contract', () => {
  it('returns required keys', () => {
    const r = recommendSession(70)
    expect(r).toHaveProperty('recommended')
    expect(r).toHaveProperty('reason')
    expect(r).toHaveProperty('citation')
    expect(r).toHaveProperty('score')
    expect(r).toHaveProperty('plannedKind')
  })

  it('reason has both en and tr strings', () => {
    const r = recommendSession(50)
    expect(r.reason).toHaveProperty('en')
    expect(r.reason).toHaveProperty('tr')
    expect(typeof r.reason.en).toBe('string')
    expect(typeof r.reason.tr).toBe('string')
    expect(r.reason.en.length).toBeGreaterThan(0)
    expect(r.reason.tr.length).toBeGreaterThan(0)
  })

  it('citation cites Plews 2013 + Foster 1998', () => {
    expect(SESSION_CITATION).toMatch(/Plews/)
    expect(SESSION_CITATION).toMatch(/Foster/)
    expect(recommendSession(60).citation).toBe(SESSION_CITATION)
  })
})

describe('recommendSession — planned session interaction', () => {
  it('planned kind is propagated to result', () => {
    const r = recommendSession(70, { kind: 'intervals' })
    expect(r.plannedKind).toBe('intervals')
  })

  it('null planned session → plannedKind null', () => {
    expect(recommendSession(70, null).plannedKind).toBeNull()
    expect(recommendSession(70).plannedKind).toBeNull()
  })

  it('high readiness + planned recovery → respects plan (no override)', () => {
    const r = recommendSession(95, { kind: 'recovery' })
    expect(r.recommended).toBe('planned')
  })

  it('high readiness + planned rest → respects plan', () => {
    const r = recommendSession(95, { kind: 'rest' })
    expect(r.recommended).toBe('planned')
  })

  it('high readiness + planned hard session → push', () => {
    const r = recommendSession(95, { kind: 'intervals' })
    expect(r.recommended).toBe('push')
  })

  it('low readiness + planned hard session → recovery (overrides plan)', () => {
    const r = recommendSession(20, { kind: 'intervals' })
    expect(r.recommended).toBe('recovery')
  })

  it('non-string planned.kind ignored safely', () => {
    const r = recommendSession(70, { kind: 42 })
    expect(r.recommended).toBe('planned')
    expect(r.plannedKind).toBeNull()
  })
})

describe('recommendSession — distinct reasons per band', () => {
  it('each band returns its own distinct reason text', () => {
    const recovery = recommendSession(20)
    const easy     = recommendSession(50)
    const planned  = recommendSession(70)
    const push     = recommendSession(90)
    expect(recovery.reason.en).not.toBe(easy.reason.en)
    expect(easy.reason.en).not.toBe(planned.reason.en)
    expect(planned.reason.en).not.toBe(push.reason.en)
  })
})
