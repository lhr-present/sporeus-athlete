// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../../lib/supabase.js', () => ({
  supabase:        {
    from: vi.fn(() => ({
      select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })) })) })),
      update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
    })),
  },
  isSupabaseReady: vi.fn(() => false),
  sbQuery:         vi.fn(async (_, fn) => fn()),
}))

vi.mock('../../lib/logger.js', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
}))

vi.mock('../useLocalStorage.js', () => ({
  useLocalStorage: vi.fn(() => [{}, vi.fn()]),
}))

import { useLocalStorage } from '../useLocalStorage.js'
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

describe('profileKey', () => {
  it('uses guest key when userId is null', () => {
    expect(profileKey(null)).toEqual(['profile', 'guest'])
  })

  it('uses userId when provided', () => {
    expect(profileKey('abc-123')).toEqual(['profile', 'abc-123'])
  })
})
