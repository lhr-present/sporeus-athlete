// @vitest-environment jsdom
// ─── useSquadPresence.test.js — join/leave, opt-out, focus/blur lifecycle
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSquadPresence } from '../useSquadPresence.js'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const subscribeCb   = { current: null }
  const presenceCbs   = { sync: [], leave: [] }
  const trackPayload  = { current: null }

  const channelObj = {
    on: vi.fn((type, filter, cb) => {
      if (type === 'presence') presenceCbs[filter.event]?.push(cb)
      return channelObj
    }),
    subscribe: vi.fn((cb) => { subscribeCb.current = cb; return channelObj }),
    track: vi.fn(async (payload) => { trackPayload.current = payload }),
    untrack: vi.fn(async () => {}),
    presenceState: vi.fn(() => ({})),
    _subscribeCb: subscribeCb,
    _presenceCbs: presenceCbs,
    _trackPayload: trackPayload,
  }

  return {
    isReady: vi.fn(() => true),
    channel: vi.fn(() => channelObj),
    remove:  vi.fn(),
    channelObj,
    subscribeCb,
    presenceCbs,
    trackPayload,
    reportStatus: vi.fn(),
    removeStatus: vi.fn(),
  }
})

vi.mock('../../lib/supabase.js', () => ({
  isSupabaseReady: mocks.isReady,
  supabase: {
    channel: mocks.channel,
    removeChannel: mocks.remove,
  },
}))

vi.mock('../../lib/realtimeStatus.js', () => ({
  reportStatus: mocks.reportStatus,
  removeStatus: mocks.removeStatus,
}))

vi.mock('../../lib/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isReady.mockReturnValue(true)
  mocks.subscribeCb.current = null
  mocks.presenceCbs.sync  = []
  mocks.presenceCbs.leave = []
  mocks.trackPayload.current = null
  // Restore mock implementations after vi.clearAllMocks()
  mocks.channelObj.on.mockImplementation((type, filter, cb) => {
    if (type === 'presence') mocks.presenceCbs[filter.event]?.push(cb)
    return mocks.channelObj
  })
  mocks.channelObj.subscribe.mockImplementation((cb) => {
    mocks.subscribeCb.current = cb
    return mocks.channelObj
  })
  mocks.channelObj.track.mockImplementation(async (payload) => {
    mocks.trackPayload.current = payload
  })
  mocks.channelObj.untrack.mockImplementation(async () => {})
  mocks.channelObj.presenceState.mockReturnValue({})
  mocks.channel.mockReturnValue(mocks.channelObj)
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useSquadPresence — coach role', () => {
  it('subscribes to squad-presence channel', () => {
    renderHook(() => useSquadPresence({ coachId: 'c1', role: 'coach' }))
    expect(mocks.channel).toHaveBeenCalledWith(
      'squad-presence-c1',
      expect.objectContaining({ config: { presence: { key: '__coach__' } } })
    )
  })

  it('tracks coach payload on SUBSCRIBED', async () => {
    renderHook(() => useSquadPresence({ coachId: 'c1', role: 'coach' }))
    await act(async () => { await mocks.subscribeCb.current?.('SUBSCRIBED') })
    const payload = mocks.trackPayload.current
    expect(payload?.user_id).toBe('__coach__')
    expect(payload?.current_tab).toBe(true)
  })

  it('updates presenceMap on presence sync', async () => {
    mocks.channelObj.presenceState.mockReturnValue({
      'athlete-1': [{ online_at: '2026-04-17T10:00:00Z' }],
    })
    const { result } = renderHook(() => useSquadPresence({ coachId: 'c1', role: 'coach' }))
    await act(async () => { await mocks.subscribeCb.current?.('SUBSCRIBED') })
    act(() => { mocks.presenceCbs.sync[0]?.() })
    expect(result.current.presenceMap['athlete-1']).toMatchObject({ online: true })
  })

  it('marks athlete offline on leave event', async () => {
    // First set online
    mocks.channelObj.presenceState.mockReturnValue({
      'athlete-1': [{ online_at: '2026-04-17T10:00:00Z' }],
    })
    const { result } = renderHook(() => useSquadPresence({ coachId: 'c1', role: 'coach' }))
    await act(async () => { await mocks.subscribeCb.current?.('SUBSCRIBED') })
    act(() => { mocks.presenceCbs.sync[0]?.() })

    // Now trigger leave
    act(() => {
      mocks.presenceCbs.leave[0]?.({ leftPresences: [{ user_id: 'athlete-1' }] })
    })
    expect(result.current.presenceMap['athlete-1']?.online).toBe(false)
  })

  it('removes channel on unmount', () => {
    const { unmount } = renderHook(() => useSquadPresence({ coachId: 'c1', role: 'coach' }))
    unmount()
    expect(mocks.remove).toHaveBeenCalled()
  })

  it('calls removeStatus on unmount', () => {
    const { unmount } = renderHook(() => useSquadPresence({ coachId: 'c1', role: 'coach' }))
    unmount()
    expect(mocks.removeStatus).toHaveBeenCalledWith('squad-presence-c1')
  })
})

describe('useSquadPresence — athlete role', () => {
  it('subscribes with athleteId as presence key', () => {
    renderHook(() => useSquadPresence({ coachId: 'c1', role: 'athlete', athleteId: 'a1' }))
    expect(mocks.channel).toHaveBeenCalledWith(
      'squad-presence-c1',
      expect.objectContaining({ config: { presence: { key: 'a1' } } })
    )
  })

  it('tracks athlete payload on SUBSCRIBED when showOnlineStatus=true', async () => {
    renderHook(() =>
      useSquadPresence({ coachId: 'c1', role: 'athlete', athleteId: 'a1', showOnlineStatus: true })
    )
    await act(async () => { await mocks.subscribeCb.current?.('SUBSCRIBED') })
    const payload = mocks.trackPayload.current
    expect(payload?.user_id).toBe('a1')
  })

  it('does NOT track when showOnlineStatus=false (athlete opt-out)', async () => {
    renderHook(() =>
      useSquadPresence({ coachId: 'c1', role: 'athlete', athleteId: 'a1', showOnlineStatus: false })
    )
    await act(async () => { await mocks.subscribeCb.current?.('SUBSCRIBED') })
    const payload = mocks.trackPayload.current
    expect(payload).toBeNull()
    expect(mocks.channelObj.track).not.toHaveBeenCalled()
  })

  it('does not subscribe when athleteId is missing', () => {
    renderHook(() => useSquadPresence({ coachId: 'c1', role: 'athlete' }))
    expect(mocks.channel).not.toHaveBeenCalled()
  })
})

describe('useSquadPresence — focus/blur lifecycle', () => {
  it('calls untrack on window blur', async () => {
    renderHook(() => useSquadPresence({ coachId: 'c1', role: 'coach' }))
    await act(async () => { await mocks.subscribeCb.current?.('SUBSCRIBED') })

    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    expect(mocks.channelObj.untrack).toHaveBeenCalled()
  })

  it('calls track on window focus', async () => {
    renderHook(() => useSquadPresence({ coachId: 'c1', role: 'coach' }))
    await act(async () => { await mocks.subscribeCb.current?.('SUBSCRIBED') })

    // First blur to untrack
    act(() => { window.dispatchEvent(new Event('blur')) })
    vi.clearAllMocks()

    // Then focus to re-track
    await act(async () => { window.dispatchEvent(new Event('focus')) })
    expect(mocks.channelObj.track).toHaveBeenCalled()
  })

  it('removes focus/blur listeners on unmount', async () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { unmount } = renderHook(() => useSquadPresence({ coachId: 'c1', role: 'coach' }))
    unmount()
    expect(removeSpy).toHaveBeenCalledWith('focus', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('blur',  expect.any(Function))
    removeSpy.mockRestore()
  })
})
