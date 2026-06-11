import { describe, it, expect, vi, beforeEach } from 'vitest'

// Controllable Supabase mock for the mutation paths.
const state = vi.hoisted(() => ({
  selectResult: { data: { coach_id: 'c1', uses_count: 0 }, error: null },
  updateResult: { error: null },
  insertResult: { error: null },
}))

vi.mock('./supabase.js', () => {
  const updateChain = { eq: vi.fn(() => Promise.resolve(state.updateResult)) }
  const chain = {
    from:        vi.fn(() => chain),
    select:      vi.fn(() => chain),
    eq:          vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve(state.selectResult)),
    update:      vi.fn(() => updateChain),
    insert:      vi.fn(() => Promise.resolve(state.insertResult)),
  }
  return { supabase: chain, isSupabaseReady: () => true }
})

const { generateReferralCode, applyReferralCode } = await import('./referral.js')

describe('generateReferralCode', () => {
  it('returns the same code for the same coachId (deterministic)', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000'
    expect(generateReferralCode(id)).toBe(generateReferralCode(id))
  })

  it('returns different codes for different coachIds', () => {
    const a = generateReferralCode('uuid-aaa')
    const b = generateReferralCode('uuid-bbb')
    expect(a).not.toBe(b)
  })

  it('returns a string starting with "SP-" followed by 8 uppercase hex chars', () => {
    const code = generateReferralCode('some-coach-id')
    expect(code).toMatch(/^SP-[0-9A-F]{8}$/)
  })

  it('does not throw for empty or undefined input', () => {
    expect(() => generateReferralCode('')).not.toThrow()
    expect(() => generateReferralCode(undefined)).not.toThrow()
  })
})

describe('applyReferralCode — surfaces mutation failures', () => {
  beforeEach(() => {
    state.selectResult = { data: { coach_id: 'c1', uses_count: 0 }, error: null }
    state.updateResult = { error: null }
    state.insertResult = { error: null }
  })

  it('returns success when the increment write succeeds', async () => {
    const r = await applyReferralCode('SP-ABCD1234', 'org1')
    expect(r.success).toBe(true)
    expect(r.coach_id).toBe('c1')
  })

  it('returns failure (not silent success) when the increment write errors', async () => {
    state.updateResult = { error: { message: 'permission denied' } }
    const r = await applyReferralCode('SP-ABCD1234', 'org1')
    expect(r.success).toBe(false)
    expect(r.error).toMatch(/permission denied/)
  })

  it('still succeeds if only the milestone reward insert fails', async () => {
    state.selectResult = { data: { coach_id: 'c1', uses_count: 2 }, error: null } // → newCount 3 triggers reward
    state.insertResult = { error: { message: 'reward table down' } }
    const r = await applyReferralCode('SP-ABCD1234', 'org1')
    expect(r.success).toBe(true) // the referral itself was recorded
  })
})
