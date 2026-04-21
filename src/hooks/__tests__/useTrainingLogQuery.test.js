// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
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
import { useTrainingLogQuery, trainingLogKey } from '../useTrainingLogQuery.js'

// ── Test wrapper ───────────────────────────────────────────────────────────────

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return ({ children }) => createElement(QueryClientProvider, { client: qc }, children)
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

  it('returns [data, setLog] tuple', () => {
    useLocalStorage.mockReturnValue([[], vi.fn()])
    const { result } = renderHook(() => useTrainingLogQuery(null), { wrapper: makeWrapper() })
    expect(Array.isArray(result.current)).toBe(true)
    expect(result.current).toHaveLength(2)
    expect(typeof result.current[1]).toBe('function')
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
})

describe('trainingLogKey', () => {
  it('uses guest key when userId is null', () => {
    expect(trainingLogKey(null)).toEqual(['training_log', 'guest'])
  })

  it('uses userId when provided', () => {
    expect(trainingLogKey('user-123')).toEqual(['training_log', 'user-123'])
  })
})
