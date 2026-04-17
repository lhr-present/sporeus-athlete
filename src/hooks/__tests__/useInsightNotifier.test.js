// @vitest-environment jsdom
// ─── useInsightNotifier.test.js ───────────────────────────────────────────────
// Tests: subscription lifecycle, INSERT filtering (kind guard),
//        toast enqueue shape, onInsight callback wiring, CHANNEL_ERROR handling.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useInsightNotifier } from '../useInsightNotifier.js'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const pgCbs = { INSERT: [] }
  let subscribeCb = null

  const channelStub = {
    on: vi.fn((_type, filter, cb) => {
      const key = filter?.event ?? '_any'
      if (!pgCbs[key]) pgCbs[key] = []
      pgCbs[key].push(cb)
      return channelStub
    }),
    subscribe: vi.fn((cb) => { subscribeCb = cb; return channelStub }),
  }

  return {
    isReady:     vi.fn(() => true),
    channel:     vi.fn(() => channelStub),
    remove:      vi.fn(),
    channelStub,
    pgCbs,
    fireInsert: (row) => {
      pgCbs.INSERT.forEach(cb => cb({ new: row }))
    },
    fireStatus: (status, err) => { if (subscribeCb) subscribeCb(status, err) },
  }
})

vi.mock('../../lib/supabase.js', () => ({
  isSupabaseReady: mocks.isReady,
  supabase: {
    channel: mocks.channel,
    removeChannel: mocks.remove,
  },
}))

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isReady.mockReturnValue(true)
  mocks.channel.mockReturnValue(mocks.channelStub)
  mocks.pgCbs.INSERT = []
  mocks.channelStub.on.mockImplementation((_type, filter, cb) => {
    const key = filter?.event ?? '_any'
    if (!mocks.pgCbs[key]) mocks.pgCbs[key] = []
    mocks.pgCbs[key].push(cb)
    return mocks.channelStub
  })
})

const USER_ID = 'user-abc'

function renderNotifier(overrides = {}) {
  const addToast  = vi.fn()
  const onInsight = vi.fn()
  const { result, unmount } = renderHook(() =>
    useInsightNotifier({ userId: USER_ID, addToast, onInsight, ...overrides })
  )
  return { result, unmount, addToast, onInsight }
}

describe('useInsightNotifier', () => {
  describe('subscription lifecycle', () => {
    it('subscribes when userId is provided', () => {
      renderNotifier()
      expect(mocks.channel).toHaveBeenCalledWith(`insight-notifier-${USER_ID}`)
    })

    it('does not subscribe when userId is null', () => {
      renderNotifier({ userId: null })
      expect(mocks.channel).not.toHaveBeenCalled()
    })

    it('does not subscribe when supabase not ready', () => {
      mocks.isReady.mockReturnValue(false)
      renderNotifier()
      expect(mocks.channel).not.toHaveBeenCalled()
    })

    it('removes channel on unmount', () => {
      const { unmount } = renderNotifier()
      unmount()
      expect(mocks.remove).toHaveBeenCalled()
    })
  })

  describe('INSERT handling', () => {
    it('enqueues a toast for kind=session_analysis', () => {
      const { addToast } = renderNotifier()
      const row = { id: 'ins-1', kind: 'session_analysis', athlete_id: USER_ID }
      act(() => mocks.fireInsert(row))
      expect(addToast).toHaveBeenCalledTimes(1)
      const toast = addToast.mock.calls[0][0]
      expect(toast.id).toBe(`insight-${row.id}`)
      expect(toast.type).toBe('info')
      expect(toast.duration).toBeGreaterThan(0)
    })

    it('ignores INSERT for other kinds', () => {
      const { addToast } = renderNotifier()
      act(() => mocks.fireInsert({ id: 'ins-2', kind: 'weekly_summary', athlete_id: USER_ID }))
      expect(addToast).not.toHaveBeenCalled()
    })

    it('includes VIEW action in toast when onInsight provided', () => {
      const { addToast, onInsight } = renderNotifier()
      const row = { id: 'ins-3', kind: 'session_analysis' }
      act(() => mocks.fireInsert(row))
      const toast = addToast.mock.calls[0][0]
      expect(toast.action).not.toBeNull()
      expect(toast.action.label).toBe('VIEW')
      toast.action.onClick()
      expect(onInsight).toHaveBeenCalledWith(row)
    })

    it('toast has no action when onInsight not provided', () => {
      const { addToast } = renderNotifier({ onInsight: undefined })
      act(() => mocks.fireInsert({ id: 'ins-4', kind: 'session_analysis' }))
      const toast = addToast.mock.calls[0][0]
      expect(toast.action).toBeNull()
    })
  })

  describe('CHANNEL_ERROR status', () => {
    it('does not throw on CHANNEL_ERROR', () => {
      renderNotifier()
      expect(() => {
        act(() => mocks.fireStatus('CHANNEL_ERROR', new Error('ws error')))
      }).not.toThrow()
    })
  })
})
