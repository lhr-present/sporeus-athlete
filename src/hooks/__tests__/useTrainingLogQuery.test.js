// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement } from 'react'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../../lib/supabase.js', () => ({
  supabase:        { from: vi.fn() },
  isSupabaseReady: vi.fn(() => false),
  sbQuery:         vi.fn(async (_, fn) => fn()),
}))

vi.mock('../useLocalStorage.js', () => ({
  useLocalStorage: vi.fn(() => [[], vi.fn()]),
}))

// Mock useSupabaseData — exports the transform functions too
vi.mock('../useSupabaseData.js', () => ({
  logRowToEntry: vi.fn(r => r),
  logEntryToRow: vi.fn(e => e),
  useTrainingLog: vi.fn(() => [[], vi.fn()]),
  useRecovery:    vi.fn(() => [[], vi.fn()]),
  useInjuries:    vi.fn(() => [[], vi.fn()]),
  useTestResults: vi.fn(() => [[], vi.fn()]),
  useRaceResults: vi.fn(() => [[], vi.fn()]),
}))

import { useLocalStorage } from '../useLocalStorage.js'
import { supabase, isSupabaseReady } from '../../lib/supabase.js'
import { useTrainingLogQuery, trainingLogKey } from '../useTrainingLogQuery.js'

// ── Test wrapper ───────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return ({ children }) => createElement(QueryClientProvider, { client: qc }, children)
}

// ── Helper to build a Supabase chain mock returning given rows ─────────────────

function makeSupabaseMock(rows) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    order:  vi.fn().mockReturnThis(),
    range:  vi.fn().mockResolvedValue({ data: rows, error: null }),
  }
  supabase.from.mockReturnValue(chain)
  return chain
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('useTrainingLogQuery — offline (no Supabase)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns localStorage data immediately as initialData', () => {
    const mockData = [{ id: '1', date: '2026-01-01', type: 'Easy Run', duration: 45, tss: 40, rpe: 6 }]
    useLocalStorage.mockReturnValue([mockData, vi.fn()])
    const { result } = renderHook(() => useTrainingLogQuery(null), { wrapper: makeWrapper() })
    const [log] = result.current
    expect(log).toEqual(mockData)
  })

  it('returns [data, setLog] tuple (backward compat)', () => {
    useLocalStorage.mockReturnValue([[], vi.fn()])
    const { result } = renderHook(() => useTrainingLogQuery(null), { wrapper: makeWrapper() })
    expect(Array.isArray(result.current)).toBe(true)
    expect(result.current.length).toBe(2)
    expect(typeof result.current[1]).toBe('function')
  })

  it('exposes fetchNextPage, hasMore, isLoadingMore on the returned array', () => {
    useLocalStorage.mockReturnValue([[], vi.fn()])
    const { result } = renderHook(() => useTrainingLogQuery(null), { wrapper: makeWrapper() })
    expect(typeof result.current.fetchNextPage).toBe('function')
    expect(typeof result.current.hasMore).toBe('boolean')
    expect(typeof result.current.isLoadingMore).toBe('boolean')
  })

  it('setLog with array value persists to localStorage', () => {
    const setLsMock = vi.fn()
    useLocalStorage.mockReturnValue([[], setLsMock])
    const { result } = renderHook(() => useTrainingLogQuery(null), { wrapper: makeWrapper() })
    const newList = [{ id: '3', date: '2026-01-03', type: 'Swim' }]

    act(() => { result.current[1](newList) })

    expect(setLsMock).toHaveBeenCalledWith(newList)
  })

  it('setLog with function applies to current data', () => {
    const setLsMock = vi.fn()
    useLocalStorage.mockReturnValue([[], setLsMock])
    const { result } = renderHook(() => useTrainingLogQuery(null), { wrapper: makeWrapper() })
    const newEntry = { id: '2', date: '2026-01-02', type: 'Ride' }

    act(() => { result.current[1](prev => [...prev, newEntry]) })

    expect(setLsMock).toHaveBeenCalled()
  })

  it('accepts object signature { userId, pageSize }', () => {
    useLocalStorage.mockReturnValue([[], vi.fn()])
    const { result } = renderHook(() => useTrainingLogQuery({ userId: null, pageSize: 25 }), { wrapper: makeWrapper() })
    expect(Array.isArray(result.current)).toBe(true)
    expect(result.current.length).toBe(2)
  })
})

describe('trainingLogKey', () => {
  it('uses guest key when userId is null', () => {
    expect(trainingLogKey(null)).toEqual(['training_log', 'guest'])
  })

  it('uses userId when provided', () => {
    expect(trainingLogKey('user-123')).toEqual(['training_log', 'user-123'])
  })
})

describe('useTrainingLogQuery — pagination (with Supabase)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isSupabaseReady.mockReturnValue(true)
  })

  it('hasMore is true when server returns exactly pageSize rows', async () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({ id: String(i), date: '2026-01-01', type: 'Run', duration: 30, rpe: 5, tss: 40 }))
    makeSupabaseMock(rows)
    useLocalStorage.mockReturnValue([[], vi.fn()])

    const { result } = renderHook(() => useTrainingLogQuery({ userId: 'u1', pageSize: 50 }), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.hasMore).toBe(true))
  })

  it('hasMore is false when server returns fewer than pageSize rows', async () => {
    const rows = Array.from({ length: 49 }, (_, i) => ({ id: String(i), date: '2026-01-01', type: 'Run', duration: 30, rpe: 5, tss: 40 }))
    makeSupabaseMock(rows)
    useLocalStorage.mockReturnValue([[], vi.fn()])

    const { result } = renderHook(() => useTrainingLogQuery({ userId: 'u1', pageSize: 50 }), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.hasMore).toBe(false))
  })

  it('fetchNextPage appends rows to allEntries', async () => {
    const page1 = Array.from({ length: 50 }, (_, i) => ({ id: String(i), date: '2026-01-01', type: 'Run', duration: 30, rpe: 5, tss: 40 }))
    const page2 = [{ id: '50', date: '2025-06-01', type: 'Ride', duration: 45, rpe: 6, tss: 55 }]

    const chain = {
      select: vi.fn().mockReturnThis(),
      eq:     vi.fn().mockReturnThis(),
      order:  vi.fn().mockReturnThis(),
      range:  vi.fn()
        .mockResolvedValueOnce({ data: page1, error: null })  // initial load
        .mockResolvedValueOnce({ data: page2, error: null }), // fetchNextPage
    }
    supabase.from.mockReturnValue(chain)
    useLocalStorage.mockReturnValue([[], vi.fn()])

    const { result } = renderHook(() => useTrainingLogQuery({ userId: 'u1', pageSize: 50 }), { wrapper: makeWrapper() })

    // Wait for initial load
    await waitFor(() => expect(result.current[0]).toHaveLength(50))
    expect(result.current.hasMore).toBe(true)

    // Trigger next page
    await act(async () => { await result.current.fetchNextPage() })

    await waitFor(() => expect(result.current[0]).toHaveLength(51))
    // After page2 (1 row < 50), hasMore should be false
    expect(result.current.hasMore).toBe(false)
  })

  it('isLoadingMore is false when not loading', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: String(i), date: '2026-01-01', type: 'Run', duration: 30, rpe: 5, tss: 40 }))
    makeSupabaseMock(rows)
    useLocalStorage.mockReturnValue([[], vi.fn()])

    const { result } = renderHook(() => useTrainingLogQuery({ userId: 'u1', pageSize: 50 }), { wrapper: makeWrapper() })

    await waitFor(() => expect(result.current.isLoadingMore).toBe(false))
  })
})
