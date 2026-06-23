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

  // ─── T3: failed recovery delete enqueues a {user_id,date} tombstone ─────────
  // The "issues a Supabase delete" test above hard-wires delete to SUCCEED, so it
  // never exercises the v9.361 anti-resurrection path: when the delete FAILS
  // (offline / RLS / 5xx), the row must be queued as a delete tombstone so it
  // reaches the server on reconnect — and because recovery rows have NO id, that
  // tombstone must be keyed on {user_id, date}, NOT {id}. A wrong/absent key
  // means the delete never replays and the wellness day RESURRECTS on next
  // hydration. This asserts the tombstone payload outcome, not just "delete was
  // called".
  it('enqueues a {user_id,date} delete tombstone (no id key) when a recovery delete FAILS', async () => {
    const initial = [
      { date: '2026-01-01', readiness: 7 },
      { date: '2026-01-02', readiness: 5 },
    ]
    const setLs = vi.fn((fnOrValue) => {
      if (typeof fnOrValue === 'function') fnOrValue(initial)
    })
    useLocalStorage.mockReturnValue([initial, setLs])

    // chain whose DELETE fails (eq().eq() resolves to an error). upsert succeeds.
    const chain = {
      select: vi.fn(() => chain),
      gte:    vi.fn(() => chain),
      order:  vi.fn(() => chain),
      limit:  vi.fn(() => Promise.resolve({ data: [], error: null })),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
      // hydration uses chain.eq → chain (chainable); the delete path needs the
      // FINAL .eq() to resolve to an error. Track call depth: delete().eq().eq().
      eq:     vi.fn(() => chain),
      delete: vi.fn(() => deleteChain),
      then:   (resolve) => resolve({ error: null }),
    }
    // delete().eq('user_id',..).eq('date',..) → resolves to an error
    const deleteChain = {
      eq: vi.fn(() => deleteChain),
      then: (resolve) => resolve({ error: { message: 'offline — delete failed' } }),
    }
    supabase.from.mockReturnValue(chain)

    const { result } = renderHook(() => useRecovery('user-1'))
    await waitFor(() => expect(chain.order).toHaveBeenCalled())

    // remove the 2026-01-02 day → triggers a delete that FAILS
    act(() => {
      result.current[1](prev => prev.filter(e => e.date !== '2026-01-02'))
    })

    await waitFor(() => expect(enqueuePendingLog).toHaveBeenCalled())
    expect(markSyncOffline).toHaveBeenCalled()

    // OUTCOME: the queued tombstone is a delete keyed on {user_id, date}.
    const tombstone = enqueuePendingLog.mock.calls
      .map(c => c[0])
      .find(p => p && p._op === 'delete' && p._table === 'recovery')
    expect(tombstone, 'a recovery delete tombstone must be enqueued on failure').toBeTruthy()
    expect(tombstone._key).toEqual({ user_id: 'user-1', date: '2026-01-02' })
    // It must NOT be keyed on id — recovery rows have no id; an {id} key never
    // matches and the row resurrects on next hydration.
    expect(tombstone._key).not.toHaveProperty('id')
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
