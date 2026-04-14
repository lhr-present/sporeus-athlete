import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  hasCurrentConsent,
  grantConsent,
  withdrawConsent,
  getStoredConsentVersion,
} from './consentVersion.js'

const store = {}
beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k])
  vi.stubGlobal('localStorage', {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v },
    removeItem: (k) => { delete store[k] },
  })
})

describe('consentVersion', () => {
  it('hasCurrentConsent returns false when nothing stored', () => {
    expect(hasCurrentConsent()).toBe(false)
  })

  it('hasCurrentConsent returns false when old boolean "true" stored (version mismatch)', () => {
    store['sporeus-consent-v1'] = 'true'
    expect(hasCurrentConsent()).toBe(false)
  })

  it('hasCurrentConsent returns true when current version string stored', () => {
    store['sporeus-consent-v1'] = '1.1'
    expect(hasCurrentConsent()).toBe(true)
  })

  it('grantConsent stores version string not boolean', () => {
    grantConsent()
    expect(store['sporeus-consent-v1']).toBe('1.1')
    expect(store['sporeus-consent-v1']).not.toBe('true')
  })

  it('withdrawConsent removes the key', () => {
    store['sporeus-consent-v1'] = '1.1'
    withdrawConsent()
    expect(store['sporeus-consent-v1']).toBeUndefined()
  })

  it('getStoredConsentVersion returns null when nothing stored', () => {
    expect(getStoredConsentVersion()).toBeNull()
  })
})
