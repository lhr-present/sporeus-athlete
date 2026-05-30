// @vitest-environment jsdom
// v9.357.0 — locks two deliberate useAuth invariants the audit flagged as untested:
//   1. upsertProfile must NEVER write display_name (the handle_new_user trigger
//      owns it; writing it here would clobber the user's Google display name).
//   2. TOKEN_REFRESHED must NOT trigger a profile upsert (only SIGNED_IN does) —
//      doing so during the auth-lock refresh would deadlock.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => ({
  authCb: null,
  upsert: vi.fn(() => Promise.resolve({ error: null })),
  single: vi.fn(() => Promise.resolve({ data: null, error: { code: 'PGRST116' } })),
  clearAllAppData: vi.fn(),
  clearOfflineQueue: vi.fn(() => Promise.resolve()),
}))

vi.mock('../../lib/supabase.js', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((cb) => {
        h.authCb = cb
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      }),
      signOut: vi.fn(() => Promise.resolve()),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      single: h.single,
      upsert: h.upsert,
    })),
  },
  sbQuery: vi.fn((_label, fn) => fn()),
}))
vi.mock('../../lib/sentry.js', () => ({ setUser: vi.fn(), clearUser: vi.fn() }))
vi.mock('../../lib/logger.js', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }))
vi.mock('../../lib/storage/local.js', () => ({ clearAllAppData: h.clearAllAppData }))
vi.mock('../../lib/db.js', () => ({ clearAll: h.clearOfflineQueue }))

import { useAuth } from '../useAuth.js'

const SESSION = { user: { id: 'u-1', email: 'athlete@example.com' } }

describe('useAuth', () => {
  beforeEach(() => { vi.clearAllMocks(); h.authCb = null; localStorage.clear() })

  it('upserts profile on SIGNED_IN WITHOUT display_name, conflict on id', async () => {
    renderHook(() => useAuth())
    await waitFor(() => expect(h.authCb).toBeTypeOf('function'))

    await act(async () => { h.authCb('SIGNED_IN', SESSION) })
    await waitFor(() => expect(h.upsert).toHaveBeenCalled())

    const [payload, opts] = h.upsert.mock.calls[0]
    expect(payload).not.toHaveProperty('display_name')   // the invariant
    expect(payload.id).toBe('u-1')
    expect(payload.email).toBe('athlete@example.com')
    expect(payload).toHaveProperty('language')
    expect(opts).toEqual({ onConflict: 'id' })
  })

  it('does NOT upsert on TOKEN_REFRESHED', async () => {
    renderHook(() => useAuth())
    await waitFor(() => expect(h.authCb).toBeTypeOf('function'))

    await act(async () => { h.authCb('TOKEN_REFRESHED', SESSION) })
    // give any (incorrect) async upsert a chance to fire
    await new Promise(r => setTimeout(r, 20))
    expect(h.upsert).not.toHaveBeenCalled()
  })

  it('clears local data + offline queue on SIGNED_OUT (preserving language)', async () => {
    renderHook(() => useAuth())
    await waitFor(() => expect(h.authCb).toBeTypeOf('function'))

    await act(async () => { h.authCb('SIGNED_OUT', { user: null }) })
    expect(h.clearAllAppData).toHaveBeenCalledWith(['sporeus-lang'])
    expect(h.clearOfflineQueue).toHaveBeenCalled()
  })

  it('does NOT clear data on a guest INITIAL_SESSION with no user', async () => {
    renderHook(() => useAuth())
    await waitFor(() => expect(h.authCb).toBeTypeOf('function'))

    await act(async () => { h.authCb('INITIAL_SESSION', { user: null }) })
    expect(h.clearAllAppData).not.toHaveBeenCalled()  // guest localStorage must survive
  })
})
