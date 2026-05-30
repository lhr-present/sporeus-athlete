// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('../../lib/supabase.js', () => ({
  supabase:        { from: vi.fn() },
  isSupabaseReady: vi.fn(() => true),
}))

vi.mock('../useLocalStorage.js', () => ({
  useLocalStorage: vi.fn(() => [[], vi.fn()]),
}))

vi.mock('../../lib/offlineQueue.js', () => ({
  enqueuePendingLog: vi.fn(),
  markSyncOffline:   vi.fn(),
}))

import { useLocalStorage } from '../useLocalStorage.js'
import { supabase, isSupabaseReady } from '../../lib/supabase.js'
import { enqueuePendingLog, markSyncOffline } from '../../lib/offlineQueue.js'
import { useRecovery } from '../useSupabaseData.js'

// A chainable + awaitable Supabase mock. order() resolves the hydration read;
// the chain itself is thenable so `await delete().eq().eq()` resolves.
function makeChain(hydrateRows = []) {
  const chain = {
    select: vi.fn(() => chain),
    eq:     vi.fn(() => chain),
    gte:    vi.fn(() => chain),
    order:  vi.fn(() => chain),
    limit:  vi.fn(() => Promise.resolve({ data: hydrateRows, error: null })),
    upsert: vi.fn(() => Promise.resolve({ error: null })),
    delete: vi.fn(() => chain),
    then:   (resolve) => resolve({ error: null }),
  }
  supabase.from.mockReturnValue(chain)
  return chain
}

describe('useRecovery — delete propagation', () => {
  beforeEach(() => { vi.clearAllMocks(); isSupabaseReady.mockReturnValue(true) })

  it('issues a Supabase delete on (user_id, date) when a recovery day is removed', async () => {
    const initial = [
      { date: '2026-01-01', readiness: 7 },
      { date: '2026-01-02', readiness: 5 },
    ]
    // setDataLS mock invokes the updater with the prior stored value
    const setLs = vi.fn((fnOrValue) => {
      if (typeof fnOrValue === 'function') fnOrValue(initial)
    })
    useLocalStorage.mockReturnValue([initial, setLs])

    const chain = makeChain([])
    const { result } = renderHook(() => useRecovery('user-1'))

    // let hydration's order().then() flip hydrating.current back to false
    await waitFor(() => expect(chain.order).toHaveBeenCalled())

    // remove the 2026-01-02 day
    act(() => {
      result.current[1](prev => prev.filter(e => e.date !== '2026-01-02'))
    })

    await waitFor(() => expect(chain.delete).toHaveBeenCalledTimes(1))
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(chain.eq).toHaveBeenCalledWith('date', '2026-01-02')
  })

  it('does not delete when an entry is only added', async () => {
    const initial = [{ date: '2026-01-01', readiness: 7 }]
    const setLs = vi.fn((fnOrValue) => {
      if (typeof fnOrValue === 'function') fnOrValue(initial)
    })
    useLocalStorage.mockReturnValue([initial, setLs])

    const chain = makeChain([])
    const { result } = renderHook(() => useRecovery('user-1'))
    await waitFor(() => expect(chain.order).toHaveBeenCalled())

    act(() => {
      result.current[1](prev => [...prev, { date: '2026-01-03', readiness: 8 }])
    })

    await waitFor(() => expect(chain.upsert).toHaveBeenCalled())
    expect(chain.delete).not.toHaveBeenCalled()
  })

  it('enqueues for retry and marks offline when an upsert fails', async () => {
    const initial = [{ date: '2026-01-01', readiness: 7 }]
    const setLs = vi.fn((fnOrValue) => {
      if (typeof fnOrValue === 'function') fnOrValue(initial)
    })
    useLocalStorage.mockReturnValue([initial, setLs])

    // chain whose upsert returns an error
    const chain = {
      select: vi.fn(() => chain),
      eq:     vi.fn(() => chain),
      gte:    vi.fn(() => chain),
      order:  vi.fn(() => chain),
      limit:  vi.fn(() => Promise.resolve({ data: [], error: null })),
      upsert: vi.fn(() => Promise.resolve({ error: { message: 'RLS denied' } })),
      delete: vi.fn(() => chain),
      then:   (resolve) => resolve({ error: null }),
    }
    supabase.from.mockReturnValue(chain)

    const { result } = renderHook(() => useRecovery('user-1'))
    await waitFor(() => expect(chain.order).toHaveBeenCalled())

    act(() => {
      result.current[1](prev => [...prev, { date: '2026-01-03', readiness: 8 }])
    })

    await waitFor(() => expect(enqueuePendingLog).toHaveBeenCalled())
    expect(markSyncOffline).toHaveBeenCalled()
    // the failed row is queued with its table tag for replay
    expect(enqueuePendingLog).toHaveBeenCalledWith(expect.objectContaining({ _table: 'recovery' }))
  })
})
