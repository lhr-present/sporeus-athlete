import { describe, it, expect } from 'vitest'
import { validateConsentType, formatConsentRecord } from './consent.js'

describe('validateConsentType', () => {
  it('"data_processing" → true', () => {
    expect(validateConsentType('data_processing')).toBe(true)
  })

  it('"marketing" → true', () => {
    expect(validateConsentType('marketing')).toBe(true)
  })

  it('"invalid_type" → false', () => {
    expect(validateConsentType('invalid_type')).toBe(false)
  })
})

describe('formatConsentRecord', () => {
  it('returns object with correct fields for valid consent type', () => {
    const record = formatConsentRecord('user-123', 'data_processing', '1.0')
    expect(record).not.toBeNull()
    expect(record.user_id).toBe('user-123')
    expect(record.consent_type).toBe('data_processing')
    expect(record.version).toBe('1.0')
  })

  it('returns null for invalid consent type', () => {
    expect(formatConsentRecord('user-123', 'bad_type', '1.0')).toBeNull()
  })

  it('granted_at is an ISO string containing "T"', () => {
    const record = formatConsentRecord('user-123', 'health_data', '2.0')
    expect(typeof record.granted_at).toBe('string')
    expect(record.granted_at).toContain('T')
  })
})
