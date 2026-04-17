// @vitest-environment jsdom
// ─── useSessionAttendance.test.js ─────────────────────────────────────────────
// Tests: initial fetch, realtime aggregation, popAnim pulse, backoff on error,
//        enabled=false guard, cleanup on unmount.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSessionAttendance } from '../useSessionAttendance.js'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const pgCbs = { '*': [] }
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
    fireEvent: async (payload = {}) => {
      const cbs = pgCbs['*'] || pgCbs['_any'] || []
      for (const cb of cbs) await cb(payload)
    },
    fireStatus: (status, err) => { if (subscribeCb) subscribeCb(status, err) },
  }
})

const getAttendanceMock  = vi.fn()
const aggAttendanceMock  = vi.fn()
const computeBackoffMock = vi.fn(() => 50)

vi.mock('../../lib/supabase.js', () => ({
  isSupabaseReady: mocks.isReady,
  supabase: {
    channel: mocks.channel,
    removeChannel: mocks.remove,
  },
}))

vi.mock('../../lib/db/coachSessions.js', () => ({
  getSessionAttendance: (...args) => getAttendanceMock(...args),
  aggregateAttendance:  (...args) => aggAttendanceMock(...args),
}))

vi.mock('../../lib/realtimeBackoff.js', () => ({
  computeBackoff: (...args) => computeBackoffMock(...args),
}))

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const SESSION_ID = 'session-xyz'
const ROWS       = [
  { status: 'confirmed' }, { status: 'confirmed' },
  { status: 'declined' },  { status: 'pending' },
]
const AGGREGATED = { confirmed: 2, declined: 1, pending: 1, total: 4 }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isReady.mockReturnValue(true)
  mocks.channel.mockReturnValue(mocks.channelStub)
  mocks.pgCbs['*'] = []
  mocks.channelStub.on.mockImplementation((_type, filter, cb) => {
    const key = filter?.event ?? '_any'
    if (!mocks.pgCbs[key]) mocks.pgCbs[key] = []
    mocks.pgCbs[key].push(cb)
    return mocks.channelStub
  })
  getAttendanceMock.mockResolvedValue({ data: ROWS, error: null })
  aggAttendanceMock.mockReturnValue(AGGREGATED)
  computeBackoffMock.mockReturnValue(50)
})

describe('useSessionAttendance', () => {
  describe('initial state + fetch', () => {
    it('starts with null attendance and false popAnim', () => {
      const { result } = renderHook(() => useSessionAttendance({ sessionId: SESSION_ID }))
      expect(result.current.attendance).toBeNull()
      expect(result.current.popAnim).toBe(false)
    })

    it('populates attendance after initial fetch', async () => {
      const { result } = renderHook(() => useSessionAttendance({ sessionId: SESSION_ID }))
      await waitFor(() => expect(result.current.attendance).not.toBeNull())
      expect(result.current.attendance).toEqual(AGGREGATED)
      expect(getAttendanceMock).toHaveBeenCalledWith(SESSION_ID)
    })

    it('does not fetch when enabled=false', () => {
      renderHook(() => useSessionAttendance({ sessionId: SESSION_ID, enabled: false }))
      expect(getAttendanceMock).not.toHaveBeenCalled()
      expect(mocks.channel).not.toHaveBeenCalled()
    })

    it('does not fetch when sessionId is empty', () => {
      renderHook(() => useSessionAttendance({ sessionId: '' }))
      expect(getAttendanceMock).not.toHaveBeenCalled()
    })

    it('does not fetch when supabase not ready', () => {
      mocks.isReady.mockReturnValue(false)
      renderHook(() => useSessionAttendance({ sessionId: SESSION_ID }))
      expect(getAttendanceMock).not.toHaveBeenCalled()
    })
  })

  describe('realtime subscription', () => {
    it('subscribes to the correct channel', async () => {
      renderHook(() => useSessionAttendance({ sessionId: SESSION_ID }))
      await waitFor(() => expect(mocks.channel).toHaveBeenCalled())
      expect(mocks.channel).toHaveBeenCalledWith(`session-attendance-${SESSION_ID}`)
    })

    it('re-fetches on postgres_changes event', async () => {
      const UPDATED = { confirmed: 3, declined: 1, pending: 0, total: 4 }
      const { result } = renderHook(() => useSessionAttendance({ sessionId: SESSION_ID }))
      await waitFor(() => expect(result.current.attendance).not.toBeNull())

      getAttendanceMock.mockResolvedValueOnce({ data: [...ROWS, { status: 'confirmed' }], error: null })
      aggAttendanceMock.mockReturnValueOnce(UPDATED)

      await act(async () => { await mocks.fireEvent({}) })
      await waitFor(() => expect(result.current.attendance).toEqual(UPDATED))
    })

    it('removes channel on unmount', async () => {
      const { unmount } = renderHook(() => useSessionAttendance({ sessionId: SESSION_ID }))
      await waitFor(() => expect(mocks.channel).toHaveBeenCalled())
      unmount()
      expect(mocks.remove).toHaveBeenCalled()
    })
  })

  describe('CHANNEL_ERROR — backoff reconnect', () => {
    it('calls computeBackoff on CHANNEL_ERROR', async () => {
      renderHook(() => useSessionAttendance({ sessionId: SESSION_ID }))
      await waitFor(() => expect(mocks.channel).toHaveBeenCalled())
      act(() => mocks.fireStatus('CHANNEL_ERROR', new Error('ws fail')))
      await waitFor(() => expect(computeBackoffMock).toHaveBeenCalled())
    })

    it('calls computeBackoff on TIMED_OUT', async () => {
      renderHook(() => useSessionAttendance({ sessionId: SESSION_ID }))
      await waitFor(() => expect(mocks.channel).toHaveBeenCalled())
      act(() => mocks.fireStatus('TIMED_OUT'))
      await waitFor(() => expect(computeBackoffMock).toHaveBeenCalled())
    })
  })
})
