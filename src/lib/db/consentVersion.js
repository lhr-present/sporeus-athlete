// ─── consentVersion.js — Consent version management ──────────────────────────
// Checks if the stored consent matches the current CONSENT_VERSION.
// Old format: stored as boolean 'true'
// New format: stored as version string '1.1'

import { CONSENT_VERSION } from '../constants.js'
import { logger } from '../logger.js'

const CONSENT_KEY = 'sporeus-consent-v1'

// Returns true if user has consented to the current version.
export function hasCurrentConsent() {
  try {
    const stored = localStorage.getItem(CONSENT_KEY)
    if (!stored) return false
    // Old boolean format — re-consent required for version upgrade
    if (stored === 'true' || stored === 'false') return false
    return stored === CONSENT_VERSION
  } catch (e) { logger.warn('localStorage:', e.message); return false }
}

// Stores consent for the current version.
export function grantConsent() {
  try {
    localStorage.setItem(CONSENT_KEY, CONSENT_VERSION)
  } catch (e) { logger.warn('localStorage:', e.message) }
}

// Clears consent (withdraw).
export function withdrawConsent() {
  try {
    localStorage.removeItem(CONSENT_KEY)
    localStorage.removeItem('sporeus-marketing-consent')
  } catch (e) { logger.warn('localStorage:', e.message) }
}

// Returns the stored consent value (raw string or null).
export function getStoredConsentVersion() {
  try { return localStorage.getItem(CONSENT_KEY) } catch { return null }
}
