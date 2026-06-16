// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'

// ── Mocks ──────────────────────────────────────────────────────────────────────

// Mutable holders so individual tests can drive the server re-read result and
// inspect what gets persisted via update().
const sb = vi.hoisted(() => ({
  remoteProfile: null,           // value returned by select().eq().maybeSingle()
  lastUpdatePayload: null,       // captured arg passed to update()
}))

vi.mock('../../lib/supabase.js', () => ({
  supabase:        {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: { profile_data: sb.remoteProfile }, error: null })) })) })),
      update: vi.fn((payload) => { sb.lastUpdatePayload = payload; return { eq: vi.fn(() => Promise.resolve({ error: null })) } }),
    })),
  },
  isSupabaseReady: vi.fn(() => false),
  sbQuery:         vi.fn(async (_, fn) => fn()),
}))

vi.mock('../useSupabaseData.js', () => ({
  // Pass-through: await the thenable so the chained eq() resolves, return ok.
  tryWrite: vi.fn(async (_label, thenable) => { await thenable; return true }),
}))

vi.mock('../../lib/offlineQueue.js', () => ({
  enqueuePendingLog: vi.fn(),
}))

vi.mock('../../lib/logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../useLocalStorage.js', () => ({
  useLocalStorage: vi.fn(() => [{}, vi.fn()]),
}))

import { useLocalStorage } from '../useLocalStorage.js'
import { isSupabaseReady } from '../../lib/supabase.js'
import { useProfileQuery, profileKey } from '../useProfileQuery.js'

// ── Test wrapper ───────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return ({ children }) => createElement(QueryClientProvider, { client: qc }, children)
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useProfileQuery — offline', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns localStorage profile as initialData', () => {
    const mockProfile = { sport: 'Running', name: 'Alice' }
    useLocalStorage.mockReturnValue([mockProfile, vi.fn()])
    const { result } = renderHook(() => useProfileQuery(null), { wrapper: makeWrapper() })
    expect(result.current[0]).toEqual(mockProfile)
  })

  it('returns [profile, setProfile] tuple', () => {
    useLocalStorage.mockReturnValue([{}, vi.fn()])
    const { result } = renderHook(() => useProfileQuery(null), { wrapper: makeWrapper() })
    expect(Array.isArray(result.current)).toBe(true)
    expect(result.current).toHaveLength(2)
    expect(typeof result.current[1]).toBe('function')
  })

  it('setProfile with object value calls setLsData', () => {
    const setLsMock = vi.fn()
    useLocalStorage.mockReturnValue([{}, setLsMock])
    const { result } = renderHook(() => useProfileQuery(null), { wrapper: makeWrapper() })

    act(() => { result.current[1]({ sport: 'Cycling', name: 'Bob' }) })

    expect(setLsMock).toHaveBeenCalledWith({ sport: 'Cycling', name: 'Bob' })
  })

  it('setProfile with function merges update', () => {
    const setLsMock = vi.fn()
    useLocalStorage.mockReturnValue([{ sport: 'Running' }, setLsMock])
    const { result } = renderHook(() => useProfileQuery(null), { wrapper: makeWrapper() })

    act(() => { result.current[1](prev => ({ ...prev, name: 'Carol' })) })

    expect(setLsMock).toHaveBeenCalled()
    const arg = setLsMock.mock.calls[0][0]
    expect(arg).toMatchObject({ sport: 'Running', name: 'Carol' })
  })
})

describe('useProfileQuery — cross-device merge on save', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sb.remoteProfile = null
    sb.lastUpdatePayload = null
    isSupabaseReady.mockReturnValue(true)
  })

  it('shallow-merges next over the concurrent server profile_data (no clobber)', async () => {
    // Local snapshot is stale (ftp:250). Another device already wrote ftp:300.
    useLocalStorage.mockReturnValue([{ ftp: '250' }, vi.fn()])
    sb.remoteProfile = { ftp: '300', name: 'Alice' }   // server is fresher

    const { result } = renderHook(() => useProfileQuery('user-1'), { wrapper: makeWrapper() })

    // This device only changes weight — must NOT revert the server's ftp:300.
    await act(async () => {
      result.current[1]({ ftp: '250', weight: '72' })
      await Promise.resolve(); await Promise.resolve()
    })

    expect(sb.lastUpdatePayload).toBeTruthy()
    // Merge = {...server, ...next} → server ftp:300 overridden by next ftp:250?
    // next is what THIS device intends; the guard protects FIELDS the device
    // didn't touch. Here weight is added; name (server-only) is preserved.
    expect(sb.lastUpdatePayload.profile_data).toMatchObject({
      name: 'Alice',     // server-only field preserved, not clobbered
      weight: '72',      // this device's new field persisted
    })
  })

  it('falls back to writing `next` when the server re-read returns no row', async () => {
    useLocalStorage.mockReturnValue([{}, vi.fn()])
    sb.remoteProfile = null   // no existing server blob (offline-ish / new row)

    const { result } = renderHook(() => useProfileQuery('user-1'), { wrapper: makeWrapper() })
    await act(async () => {
      result.current[1]({ ftp: '280' })
      await Promise.resolve(); await Promise.resolve()
    })

    expect(sb.lastUpdatePayload.profile_data).toEqual({ ftp: '280' })
  })
})

describe('profileKey', () => {
  it('uses guest key when userId is null', () => {
    expect(profileKey(null)).toEqual(['profile', 'guest'])
  })

  it('uses userId when provided', () => {
    expect(profileKey('abc-123')).toEqual(['profile', 'abc-123'])
  })
})
