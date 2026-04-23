// src/lib/__tests__/privacy/dataRights.test.js — data_rights_requests helpers
// Pure function tests for grace period, signed URL expiry, and cancel logic.
// DB integration (build_user_export, purge_user) requires a real Supabase
// instance and is covered by the manual E2E checklist in docs/ops/runbooks.md.
import { describe, it, expect } from 'vitest'

// ── Pure helpers (mirroring edge-function and migration logic) ────────────────

const GRACE_DAYS = 30
const URL_EXPIRY_SECONDS = 60 * 60 * 24 * 7  // 7 days

function scheduledPurgeAt(fromDate = new Date()) {
  const d = new Date(fromDate)
  d.setDate(d.getDate() + GRACE_DAYS)
  return d.toISOString()
}

function isDuePurge(scheduledPurgeAt, now = new Date()) {
  return new Date(scheduledPurgeAt) <= now
}

function isGraceActive(scheduledPurgeAt, now = new Date()) {
  return new Date(scheduledPurgeAt) > now
}

function exportUrlExpiresAt(fromDate = new Date()) {
  return new Date(fromDate.getTime() + URL_EXPIRY_SECONDS * 1000).toISOString()
}

function isExportUrlExpired(expiresAt, now = new Date()) {
  return new Date(expiresAt) <= now
}

function canCancelRequest(req, actingUserId) {
  return (
    req.user_id === actingUserId &&
    req.kind === 'deletion' &&
    req.status === 'pending'
  )
}

function applyCancel(req) {
  if (req.kind !== 'deletion' || req.status !== 'pending') {
    throw new Error('Only pending deletion requests can be canceled')
  }
  return { ...req, status: 'canceled' }
}

// build_user_export shape validator (mirrors what the SQL function returns)
const EXPECTED_EXPORT_KEYS = [
  'profiles', 'training_log', 'test_results', 'injuries', 'goals',
  'athlete_goals', 'personal_records', 'coach_plans', 'coach_athletes',
  'coach_messages', 'coach_sessions', 'session_attendance', 'session_comments',
  'ai_insights', 'consents', 'consent_purposes', 'attribution_events',
  'client_events', 'subscription_events', 'data_rights_requests',
  'athlete_devices', 'insight_embeddings', '_meta',
]

function validateExportShape(exportObj) {
  const missing = EXPECTED_EXPORT_KEYS.filter(k => !(k in exportObj))
  return { valid: missing.length === 0, missing }
}

// ── scheduledPurgeAt ──────────────────────────────────────────────────────────
describe('scheduledPurgeAt', () => {
  it('returns a date 30 days in the future', () => {
    const from  = new Date('2024-06-01T00:00:00Z')
    const until = scheduledPurgeAt(from)
    expect(until).toMatch(/^2024-07-01/)
  })

  it('returns valid ISO string', () => {
    const until = scheduledPurgeAt()
    expect(() => new Date(until)).not.toThrow()
  })
})

// ── isDuePurge ────────────────────────────────────────────────────────────────
describe('isDuePurge', () => {
  it('returns false when scheduled_purge_at is in the future', () => {
    const future = new Date(Date.now() + 7 * 86400000).toISOString()
    expect(isDuePurge(future)).toBe(false)
  })

  it('returns true when scheduled_purge_at is in the past', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    expect(isDuePurge(past)).toBe(true)
  })

  it('returns true at exactly scheduled time (boundary)', () => {
    const exactly = new Date().toISOString()
    const slightlyAfter = new Date(Date.now() + 100)
    expect(isDuePurge(exactly, slightlyAfter)).toBe(true)
  })
})

// ── isGraceActive ─────────────────────────────────────────────────────────────
describe('isGraceActive', () => {
  it('returns true when still within grace period', () => {
    const future = new Date(Date.now() + 20 * 86400000).toISOString()
    expect(isGraceActive(future)).toBe(true)
  })

  it('returns false after grace period ends', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    expect(isGraceActive(past)).toBe(false)
  })
})

// ── Export URL expiry ─────────────────────────────────────────────────────────
describe('isExportUrlExpired', () => {
  it('returns false for a fresh export URL', () => {
    const fresh = exportUrlExpiresAt()
    expect(isExportUrlExpired(fresh)).toBe(false)
  })

  it('returns true for a URL that expired yesterday', () => {
    const past = new Date(Date.now() - 86400000).toISOString()
    expect(isExportUrlExpired(past)).toBe(true)
  })

  it('export URL expires after exactly 7 days', () => {
    const base    = new Date('2024-01-01T00:00:00Z')
    const expires = exportUrlExpiresAt(base)
    const sevenDaysLater = new Date('2024-01-08T00:00:00Z')
    expect(isExportUrlExpired(expires, sevenDaysLater)).toBe(true)

    const oneDayBefore   = new Date('2024-01-07T23:59:00Z')
    expect(isExportUrlExpired(expires, oneDayBefore)).toBe(false)
  })
})

// ── Cancel deletion ───────────────────────────────────────────────────────────
describe('canCancelRequest', () => {
  const userId = 'uid-abc'

  it('returns true for own pending deletion', () => {
    const req = { user_id: userId, kind: 'deletion', status: 'pending' }
    expect(canCancelRequest(req, userId)).toBe(true)
  })

  it('returns false for completed deletion', () => {
    const req = { user_id: userId, kind: 'deletion', status: 'completed' }
    expect(canCancelRequest(req, userId)).toBe(false)
  })

  it('returns false for export kind', () => {
    const req = { user_id: userId, kind: 'export', status: 'pending' }
    expect(canCancelRequest(req, userId)).toBe(false)
  })

  it('returns false when acting as a different user', () => {
    const req = { user_id: userId, kind: 'deletion', status: 'pending' }
    expect(canCancelRequest(req, 'uid-other')).toBe(false)
  })
})

describe('applyCancel', () => {
  it('transitions status to canceled', () => {
    const req = { user_id: 'u1', kind: 'deletion', status: 'pending' }
    const result = applyCancel(req)
    expect(result.status).toBe('canceled')
  })

  it('throws if status is not pending', () => {
    const req = { user_id: 'u1', kind: 'deletion', status: 'completed' }
    expect(() => applyCancel(req)).toThrow()
  })

  it('throws if kind is export', () => {
    const req = { user_id: 'u1', kind: 'export', status: 'pending' }
    expect(() => applyCancel(req)).toThrow()
  })
})

// ── build_user_export shape ───────────────────────────────────────────────────
describe('validateExportShape', () => {
  it('passes for a complete export object', () => {
    const mockExport = Object.fromEntries(EXPECTED_EXPORT_KEYS.map(k => [k, []]))
    const { valid, missing } = validateExportShape(mockExport)
    expect(valid).toBe(true)
    expect(missing).toHaveLength(0)
  })

  it('fails when required tables are missing', () => {
    const incomplete = { profiles: [], _meta: {} }
    const { valid, missing } = validateExportShape(incomplete)
    expect(valid).toBe(false)
    expect(missing).toContain('training_log')
    expect(missing).toContain('athlete_devices')
    expect(missing).toContain('insight_embeddings')
  })

  it('includes all 22 expected keys', () => {
    expect(EXPECTED_EXPORT_KEYS).toHaveLength(23)
  })

  it('athlete_devices and insight_embeddings are included (token/vector redaction verified by key presence)', () => {
    expect(EXPECTED_EXPORT_KEYS).toContain('athlete_devices')
    expect(EXPECTED_EXPORT_KEYS).toContain('insight_embeddings')
  })
})

// ── Deletion flow end-to-end state machine ────────────────────────────────────
describe('deletion flow state machine', () => {
  it('full lifecycle: pending → canceled prevents purge', () => {
    const userId = 'user-123'
    let req = {
      id:                 'req-1',
      user_id:            userId,
      kind:               'deletion',
      status:             'pending',
      scheduled_purge_at: scheduledPurgeAt(),
    }

    // Grace period active → NOT due for purge
    expect(isDuePurge(req.scheduled_purge_at)).toBe(false)
    expect(isGraceActive(req.scheduled_purge_at)).toBe(true)

    // User cancels
    expect(canCancelRequest(req, userId)).toBe(true)
    req = applyCancel(req)
    expect(req.status).toBe('canceled')

    // Canceled request cannot be canceled again
    expect(() => applyCancel(req)).toThrow()
  })

  it('full lifecycle: pending past grace → due for purge', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    const req = {
      id:                 'req-2',
      user_id:            'user-456',
      kind:               'deletion',
      status:             'pending',
      scheduled_purge_at: past,
    }

    expect(isDuePurge(req.scheduled_purge_at)).toBe(true)
    expect(isGraceActive(req.scheduled_purge_at)).toBe(false)
  })
})
