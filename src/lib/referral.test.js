import { describe, it, expect } from 'vitest'
import { generateReferralCode } from './referral.js'

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
