// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  planSignature,
  isDuplicatePlanSend,
  recordPlanSend,
  COACH_PLAN_DEDUP_TTL_MS,
} from '../coachPlanDedup.js'

describe('planSignature', () => {
  const base = {
    coachId: 'SP-abc123',
    athleteId: 'ath-001',
    planName: 'Marathon Block',
    planGoal: 'Marathon',
    startDate: '2026-06-01',
    weeks: Array.from({ length: 12 }, (_, i) => ({ week: i + 1 })),
    planLevel: 'Intermediate',
  }

  it('produces a stable string for the same input', () => {
    expect(planSignature(base)).toBe(planSignature(base))
  })

  it('differs when athlete changes', () => {
    expect(planSignature(base)).not.toBe(planSignature({ ...base, athleteId: 'ath-002' }))
  })

  it('differs when goal changes', () => {
    expect(planSignature(base)).not.toBe(planSignature({ ...base, planGoal: 'Half Marathon' }))
  })

  it('differs when number of weeks changes', () => {
    expect(planSignature(base)).not.toBe(planSignature({ ...base, weeks: base.weeks.slice(0, 8) }))
  })

  it('trims whitespace from planName', () => {
    expect(planSignature({ ...base, planName: '  Marathon Block  ' })).toBe(planSignature(base))
  })

  it('treats missing weeks as length 0', () => {
    const sig = planSignature({ ...base, weeks: undefined })
    expect(sig).toContain('|0|')
  })
})

describe('isDuplicatePlanSend + recordPlanSend', () => {
  beforeEach(() => {
    try { localStorage.clear() } catch (_) {}
  })

  it('returns false when no record exists', () => {
    expect(isDuplicatePlanSend('ath-001', 'sig-abc')).toBe(false)
  })

  it('returns true when the same signature was recorded within the TTL', () => {
    const now = Date.now()
    recordPlanSend('ath-001', 'sig-abc', now)
    expect(isDuplicatePlanSend('ath-001', 'sig-abc', now + 1000)).toBe(true)
  })

  it('returns false when the recorded signature has aged past TTL', () => {
    const now = Date.now()
    recordPlanSend('ath-001', 'sig-abc', now)
    expect(isDuplicatePlanSend('ath-001', 'sig-abc', now + COACH_PLAN_DEDUP_TTL_MS + 1)).toBe(false)
  })

  it('returns false for a different signature even within TTL', () => {
    const now = Date.now()
    recordPlanSend('ath-001', 'sig-abc', now)
    expect(isDuplicatePlanSend('ath-001', 'sig-xyz', now + 1000)).toBe(false)
  })

  it('returns false for a different athlete', () => {
    const now = Date.now()
    recordPlanSend('ath-001', 'sig-abc', now)
    expect(isDuplicatePlanSend('ath-002', 'sig-abc', now + 1000)).toBe(false)
  })

  it('tolerates corrupt localStorage JSON without throwing', () => {
    localStorage.setItem('sporeus-coach-plan-last-sig-ath-001', '{garbage')
    expect(() => isDuplicatePlanSend('ath-001', 'sig-abc')).not.toThrow()
    expect(isDuplicatePlanSend('ath-001', 'sig-abc')).toBe(false)
  })

  it('isDuplicatePlanSend returns false for missing args (defensive)', () => {
    expect(isDuplicatePlanSend('', 'sig')).toBe(false)
    expect(isDuplicatePlanSend('ath', '')).toBe(false)
    expect(isDuplicatePlanSend(null, 'sig')).toBe(false)
  })

  it('recordPlanSend is a no-op for missing args', () => {
    expect(() => recordPlanSend('', 'sig')).not.toThrow()
    expect(() => recordPlanSend('ath', '')).not.toThrow()
    expect(localStorage.getItem('sporeus-coach-plan-last-sig-')).toBeNull()
  })
})

describe('end-to-end: rapid double send is blocked', () => {
  beforeEach(() => { try { localStorage.clear() } catch (_) {} })

  it('first send succeeds, second send within 60s is suppressed', () => {
    const sig = planSignature({
      coachId: 'SP-abc', athleteId: 'ath-1', planName: 'X',
      planGoal: '5K', startDate: '2026-06-01',
      weeks: Array.from({ length: 8 }, (_, i) => ({ week: i + 1 })),
      planLevel: 'Beginner',
    })
    const t0 = 1000000
    expect(isDuplicatePlanSend('ath-1', sig, t0)).toBe(false)        // first send: allowed
    recordPlanSend('ath-1', sig, t0)
    expect(isDuplicatePlanSend('ath-1', sig, t0 + 5_000)).toBe(true)  // 5s later: blocked
    expect(isDuplicatePlanSend('ath-1', sig, t0 + 30_000)).toBe(true) // 30s later: blocked
    expect(isDuplicatePlanSend('ath-1', sig, t0 + 61_000)).toBe(false)// 61s later: allowed again
  })
})
