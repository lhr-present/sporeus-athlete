// src/lib/__tests__/privacy/privacyLifecycle.test.js — E8: Privacy lifecycle
// Tests for pure utility functions relating to GDPR/KVKK account lifecycle.
// Edge function integration tests require real Supabase — out of scope for unit suite.
import { describe, it, expect } from 'vitest'

// ── Deletion request validation helpers ───────────────────────────────────

const REQUIRED_PHRASE = 'DELETE my account'

function validateDeletionConfirmation(typed) {
  return typed === REQUIRED_PHRASE
}

function computeGraceUntil(fromDate = new Date()) {
  const d = new Date(fromDate)
  d.setDate(d.getDate() + 30)
  return d.toISOString()
}

function isGraceExpired(graceUntil, now = new Date()) {
  return new Date(graceUntil) <= now
}

function isGraceActive(graceUntil, now = new Date()) {
  return new Date(graceUntil) > now
}

// ── Export status helpers ──────────────────────────────────────────────────

function isExportUrlExpired(urlExpiresAt, now = new Date()) {
  return new Date(urlExpiresAt) <= now
}

function buildExportMeta(userId, tables) {
  return {
    exported_at: new Date().toISOString(),
    user_id:     userId,
    format:      'sporeus-export-v1',
    tables,
  }
}

// ── Consent purpose validation ─────────────────────────────────────────────

const VALID_PURPOSES = ['analytics', 'ai_processing', 'strava_sync', 'email_communications', 'health_data']

function isValidPurpose(purpose) {
  return VALID_PURPOSES.includes(purpose)
}

function defaultConsents() {
  return Object.fromEntries(VALID_PURPOSES.map(p => [p, true]))
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('validateDeletionConfirmation', () => {
  it('returns true only for exact phrase', () => {
    expect(validateDeletionConfirmation('DELETE my account')).toBe(true)
  })
  it('returns false for partial match', () => {
    expect(validateDeletionConfirmation('delete my account')).toBe(false)  // case-sensitive
    expect(validateDeletionConfirmation('DELETE my account ')).toBe(false) // trailing space
    expect(validateDeletionConfirmation('')).toBe(false)
    expect(validateDeletionConfirmation('DELETE')).toBe(false)
  })
  it('returns false for close-but-wrong phrases', () => {
    expect(validateDeletionConfirmation('Delete my account')).toBe(false)
    expect(validateDeletionConfirmation('DELETE MY ACCOUNT')).toBe(false)
  })
})

describe('computeGraceUntil', () => {
  it('returns a date 30 days in the future', () => {
    const from  = new Date('2024-06-01T00:00:00Z')
    const until = computeGraceUntil(from)
    expect(until).toMatch(/^2024-07-01/)
  })
  it('returns ISO string format', () => {
    const until = computeGraceUntil()
    expect(() => new Date(until)).not.toThrow()
  })
})

describe('isGraceExpired', () => {
  it('returns true when grace has passed', () => {
    const past = new Date('2020-01-01').toISOString()
    expect(isGraceExpired(past)).toBe(true)
  })
  it('returns false when grace is still active', () => {
    const future = new Date('2099-01-01').toISOString()
    expect(isGraceExpired(future)).toBe(false)
  })
})

describe('isGraceActive', () => {
  it('returns true when grace period has not expired', () => {
    const future = new Date('2099-01-01').toISOString()
    expect(isGraceActive(future)).toBe(true)
  })
  it('returns false when expired', () => {
    const past = new Date('2020-01-01').toISOString()
    expect(isGraceActive(past)).toBe(false)
  })
})

describe('isExportUrlExpired', () => {
  it('returns true for past URL', () => {
    const past = new Date('2020-01-01').toISOString()
    expect(isExportUrlExpired(past)).toBe(true)
  })
  it('returns false for future URL', () => {
    const future = new Date('2099-01-01').toISOString()
    expect(isExportUrlExpired(future)).toBe(false)
  })
})

describe('buildExportMeta', () => {
  it('includes required fields', () => {
    const meta = buildExportMeta('user-123', ['training_log', 'profiles'])
    expect(meta.user_id).toBe('user-123')
    expect(meta.format).toBe('sporeus-export-v1')
    expect(meta.tables).toContain('training_log')
    expect(typeof meta.exported_at).toBe('string')
  })
})

describe('consent purposes', () => {
  it('isValidPurpose accepts all defined purposes', () => {
    for (const p of VALID_PURPOSES) {
      expect(isValidPurpose(p)).toBe(true)
    }
  })
  it('isValidPurpose rejects unknown purposes', () => {
    expect(isValidPurpose('advertising')).toBe(false)
    expect(isValidPurpose('')).toBe(false)
    expect(isValidPurpose('ANALYTICS')).toBe(false)
  })
  it('defaultConsents sets all purposes to true', () => {
    const defaults = defaultConsents()
    expect(Object.keys(defaults)).toHaveLength(VALID_PURPOSES.length)
    for (const v of Object.values(defaults)) {
      expect(v).toBe(true)
    }
  })
  it('health_data is in VALID_PURPOSES (GDPR Art.9 explicit consent)', () => {
    expect(isValidPurpose('health_data')).toBe(true)
  })
  it('ai_processing is in VALID_PURPOSES', () => {
    expect(isValidPurpose('ai_processing')).toBe(true)
  })
})
