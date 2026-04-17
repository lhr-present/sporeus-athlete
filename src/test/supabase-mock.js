// ─── src/test/supabase-mock.js — Shared Supabase channel/broadcast mock ────────
// Import with vi.hoisted() in test files that need a channel mock.
//
// Usage in a test file:
//
//   import { buildChannelMock } from '../../test/supabase-mock.js'
//
//   const mocks = vi.hoisted(() => buildChannelMock())
//
//   vi.mock('../../lib/supabase.js', () => ({
//     isSupabaseReady: mocks.isReady,
//     supabase: mocks.supabase,
//   }))
//
//   beforeEach(() => mocks.reset())

import { vi } from 'vitest'

/**
 * Builds a minimal Supabase channel mock that:
 *  - Tracks .on() listeners by event name
 *  - Captures the subscribe callback
 *  - Exposes helpers to fire events and simulate status changes
 */
export function buildChannelMock() {
  // Listeners: Map<eventName, callback[]>
  const listeners = new Map()
  let subscribeCb = null

  const channelStub = {
    on: vi.fn((_type, filterOrEvent, cb) => {
      // Handles both broadcast and postgres_changes shapes:
      //   broadcast:        .on('broadcast', { event: 'foo' }, cb)
      //   postgres_changes: .on('postgres_changes', { event: 'INSERT', table: 'x' }, cb)
      const key = typeof filterOrEvent === 'object'
        ? (filterOrEvent.event ?? filterOrEvent.table ?? '_any')
        : String(filterOrEvent)
      if (!listeners.has(key)) listeners.set(key, [])
      listeners.get(key).push(cb)
      return channelStub
    }),
    subscribe: vi.fn((cb) => {
      subscribeCb = cb
      return channelStub
    }),
    send: vi.fn(() => Promise.resolve()),
    unsubscribe: vi.fn(),
  }

  const isReady = vi.fn(() => true)
  const removeChannel = vi.fn()
  const channelFn = vi.fn(() => channelStub)

  const supabase = {
    channel: channelFn,
    removeChannel,
    from: vi.fn(() => ({
      upsert: vi.fn(() => Promise.resolve({ error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  }

  /** Fire a named event (broadcast or postgres_changes) with given payload */
  function fireEvent(eventName, payload) {
    const cbs = listeners.get(eventName) || []
    cbs.forEach(cb => cb(payload))
  }

  /** Simulate a subscription status change (e.g. 'SUBSCRIBED', 'CHANNEL_ERROR') */
  function fireStatus(status, err) {
    if (subscribeCb) subscribeCb(status, err)
  }

  /** Reset all mocks between tests */
  function reset() {
    listeners.clear()
    subscribeCb = null
    vi.clearAllMocks()
    isReady.mockReturnValue(true)
    channelFn.mockReturnValue(channelStub)
    channelStub.on.mockImplementation((_type, filterOrEvent, cb) => {
      const key = typeof filterOrEvent === 'object'
        ? (filterOrEvent.event ?? filterOrEvent.table ?? '_any')
        : String(filterOrEvent)
      if (!listeners.has(key)) listeners.set(key, [])
      listeners.get(key).push(cb)
      return channelStub
    })
    channelStub.send.mockReturnValue(Promise.resolve())
  }

  return { supabase, isReady, channelStub, channelFn, removeChannel, listeners, fireEvent, fireStatus, reset }
}
