import { describe, it, expect, vi } from 'vitest'

// Mock Supabase before importing auditLog
vi.mock('../supabase.js', () => ({
  supabase: null,  // null → not configured path
}))

import { logAction, getMyAuditLog } from './auditLog.js'

describe('logAction — NOT_CONFIGURED guard', () => {
  it('returns NOT_CONFIGURED error when supabase is null', async () => {
    const result = await logAction('read', 'sessions', 'abc-123')
    expect(result.data).toBeNull()
    expect(result.error?.message).toMatch(/not configured/i)
  })

  it('accepts all valid action types without throwing', async () => {
    for (const action of ['read','insert','update','delete','export','erase']) {
      const result = await logAction(action, 'sessions')
      expect(result).toHaveProperty('error')  // may be error (not configured) but does not throw
    }
  })
})

describe('getMyAuditLog — NOT_CONFIGURED guard', () => {
  it('returns NOT_CONFIGURED error when supabase is null', async () => {
    const result = await getMyAuditLog('user-xyz')
    expect(result.data).toBeNull()
    expect(result.error?.message).toMatch(/not configured/i)
  })

  it('accepts custom limit without throwing', async () => {
    const result = await getMyAuditLog('user-xyz', 100)
    expect(result).toHaveProperty('error')
  })
})
