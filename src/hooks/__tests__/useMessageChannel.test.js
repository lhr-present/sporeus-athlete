// @vitest-environment jsdom
// ─── useMessageChannel.test.js ────────────────────────────────────────────────
// Tests: subscription lifecycle, typing indicator throttle/expiry,
//        read broadcast, own-event filter, DB upsert on sendRead.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMessageChannel } from '../useMessageChannel.js'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const broadcastCbs = {}   // event → callback[]
  let subscribeCb    = null

  const channelStub = {
    on: vi.fn((_type, filter, cb) => {
      const key = filter?.event ?? '_any'
      if (!broadcastCbs[key]) broadcastCbs[key] = []
      broadcastCbs[key].push(cb)
      return channelStub
    }),
    subscribe: vi.fn((cb) => { subscribeCb = cb; return channelStub }),
    send:      vi.fn(() => Promise.resolve()),
  }

  const upsertMock = vi.fn(() => Promise.resolve({ error: null }))
  const fromMock   = vi.fn(() => ({ upsert: upsertMock }))

  return {
    isReady:     vi.fn(() => true),
    channel:     vi.fn(() => channelStub),
    remove:      vi.fn(),
    channelStub,
    broadcastCbs,
    upsertMock,
    fromMock,
    getSubscribeCb: () => subscribeCb,
    fire: (event, payload) => {
      const cbs = broadcastCbs[event] || []
      cbs.forEach(cb => cb({ payload }))
    },
    fireStatus: (status, err) => { if (subscribeCb) subscribeCb(status, err) },
  }
})

vi.mock('../../lib/supabase.js', () => ({
  isSupabaseReady: mocks.isReady,
  supabase: {
    channel: mocks.channel,
    removeChannel: mocks.remove,
    from: mocks.fromMock,
  },
}))

vi.mock('../../lib/db/messages.js', () => ({
  buildChannelId: (coachId, athleteId) => `msg-${coachId}-${athleteId}`,
}))

vi.mock('../../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// Reset between tests
beforeEach(() => {
  vi.clearAllMocks()
  mocks.isReady.mockReturnValue(true)
  mocks.channel.mockReturnValue(mocks.channelStub)
  mocks.channelStub.send.mockReturnValue(Promise.resolve())
  Object.keys(mocks.broadcastCbs).forEach(k => { mocks.broadcastCbs[k] = [] })
  mocks.channelStub.on.mockImplementation((_type, filter, cb) => {
    const key = filter?.event ?? '_any'
    if (!mocks.broadcastCbs[key]) mocks.broadcastCbs[key] = []
    mocks.broadcastCbs[key].push(cb)
    return mocks.channelStub
  })
})

const COACH_ID   = 'coach-1'
const ATHLETE_ID = 'athlete-2'
const USER_ID    = COACH_ID

function renderMessageChannel(overrides = {}) {
  const onTyping = vi.fn()
  const onRead   = vi.fn()
  const { result, unmount } = renderHook(() =>
    useMessageChannel({ coachId: COACH_ID, athleteId: ATHLETE_ID, userId: USER_ID, onTyping, onRead, ...overrides })
  )
  return { result, unmount, onTyping, onRead }
}

describe('useMessageChannel', () => {
  describe('subscription lifecycle', () => {
    it('subscribes to the correct channel on mount', () => {
      renderMessageChannel()
      expect(mocks.channel).toHaveBeenCalledWith(
        expect.stringContaining(`msg-${COACH_ID}-${ATHLETE_ID}`)
      )
      expect(mocks.channelStub.subscribe).toHaveBeenCalled()
    })

    it('does not subscribe when coachId is empty', () => {
      renderHook(() => useMessageChannel({ coachId: '', athleteId: ATHLETE_ID, userId: USER_ID }))
      expect(mocks.channel).not.toHaveBeenCalled()
    })

    it('does not subscribe when supabase not ready', () => {
      mocks.isReady.mockReturnValue(false)
      renderMessageChannel()
      expect(mocks.channel).not.toHaveBeenCalled()
    })

    it('removes channel on unmount', () => {
      const { unmount } = renderMessageChannel()
      unmount()
      expect(mocks.remove).toHaveBeenCalled()
    })
  })

  describe('typing indicator — inbound', () => {
    it('calls onTyping(true) when partner sends typing_start', () => {
      const { onTyping } = renderMessageChannel()
      mocks.fireStatus('SUBSCRIBED')
      act(() => mocks.fire('typing_start', { user_id: 'other-user' }))
      expect(onTyping).toHaveBeenCalledWith(true)
    })

    it('ignores own typing_start event', () => {
      const { onTyping } = renderMessageChannel()
      mocks.fireStatus('SUBSCRIBED')
      act(() => mocks.fire('typing_start', { user_id: USER_ID }))
      expect(onTyping).not.toHaveBeenCalled()
    })

    it('calls onTyping(false) when partner sends typing_stop', () => {
      const { onTyping } = renderMessageChannel()
      mocks.fireStatus('SUBSCRIBED')
      act(() => {
        mocks.fire('typing_start', { user_id: 'other-user' })
        mocks.fire('typing_stop',  { user_id: 'other-user' })
      })
      expect(onTyping).toHaveBeenCalledWith(false)
    })
  })

  describe('read receipt — inbound', () => {
    it('calls onRead when partner emits read', () => {
      const { onRead } = renderMessageChannel()
      mocks.fireStatus('SUBSCRIBED')
      act(() => mocks.fire('read', { user_id: 'other-user' }))
      expect(onRead).toHaveBeenCalled()
    })

    it('ignores own read event', () => {
      const { onRead } = renderMessageChannel()
      mocks.fireStatus('SUBSCRIBED')
      act(() => mocks.fire('read', { user_id: USER_ID }))
      expect(onRead).not.toHaveBeenCalled()
    })
  })

  describe('outbound actions', () => {
    it('sendTypingStart broadcasts typing_start', async () => {
      const { result } = renderMessageChannel()
      mocks.fireStatus('SUBSCRIBED')
      await act(async () => result.current.sendTypingStart())
      expect(mocks.channelStub.send).toHaveBeenCalledWith(expect.objectContaining({
        event: 'typing_start',
        payload: expect.objectContaining({ user_id: USER_ID }),
      }))
    })

    it('sendTypingStop broadcasts typing_stop', async () => {
      const { result } = renderMessageChannel()
      mocks.fireStatus('SUBSCRIBED')
      await act(async () => result.current.sendTypingStop())
      expect(mocks.channelStub.send).toHaveBeenCalledWith(expect.objectContaining({
        event: 'typing_stop',
      }))
    })

    it('sendRead broadcasts read and upserts message_reads', async () => {
      const { result } = renderMessageChannel()
      mocks.fireStatus('SUBSCRIBED')
      await act(async () => result.current.sendRead())
      expect(mocks.channelStub.send).toHaveBeenCalledWith(expect.objectContaining({
        event: 'read',
        payload: expect.objectContaining({ user_id: USER_ID }),
      }))
      expect(mocks.fromMock).toHaveBeenCalledWith('message_reads')
    })

    it('sendTypingStart throttles: second call within 2s is ignored', async () => {
      const { result } = renderMessageChannel()
      mocks.fireStatus('SUBSCRIBED')
      await act(async () => {
        result.current.sendTypingStart()
        result.current.sendTypingStart()
      })
      expect(mocks.channelStub.send).toHaveBeenCalledTimes(1)
    })
  })
})
