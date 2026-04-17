// @vitest-environment jsdom
// ─── useRealtimeSquadFeed.test.js — subscription lifecycle, MAX_FEED cap, backoff
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRealtimeSquadFeed } from '../useRealtimeSquadFeed.js'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const subscribeCb = { current: null }
  const pgCbs       = { training_log: [], recovery: [] }

  const channelStub = {
    on: vi.fn((_type, filter, cb) => {
      if (filter && filter.table) {
        const tbl = filter.table
        if (!pgCbs[tbl]) pgCbs[tbl] = []
        pgCbs[tbl].push(cb)
      }
      return channelStub
    }),
    subscribe: vi.fn((cb) => {
      subscribeCb.current = cb
      return channelStub
    }),
    _cbs: { subscribe: subscribeCb, pg: pgCbs },
  }

  // Simple chained builder for supabase.from()
  const chainMock = {
    select: () => chainMock,
    order:  () => chainMock,
    limit:  () => Promise.resolve({ data: [] }),
    gte:    () => chainMock,
    in:     () => chainMock,
  }

  return {
    isReady:      vi.fn(() => true),
    channel:      vi.fn(() => channelStub),
    remove:       vi.fn(),
    fromFn:       vi.fn(() => chainMock),
    channelStub,
    subscribeCb,
    pgCbs,
    trackEvent:   vi.fn(),
    reportStatus: vi.fn(),
    removeStatus: vi.fn(),
    computeBackoff: vi.fn(() => 100),
  }
})

vi.mock('../../lib/supabase.js', () => ({
  isSupabaseReady: mocks.isReady,
  supabase: {
    channel: mocks.channel,
    removeChannel: mocks.remove,
    from: mocks.fromFn,
  },
}))

vi.mock('../../lib/realtimeStatus.js', () => ({
  reportStatus: mocks.reportStatus,
  removeStatus: mocks.removeStatus,
}))

vi.mock('../../lib/telemetry.js', () => ({
  trackEvent: mocks.trackEvent,
}))

vi.mock('../../lib/realtimeBackoff.js', () => ({
  computeBackoff: mocks.computeBackoff,
}))

vi.mock('../../lib/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ATHLETES = [
  { athlete_id: 'a1', display_name: 'Alice' },
  { athlete_id: 'a2', display_name: 'Bob' },
]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isReady.mockReturnValue(true)
  mocks.computeBackoff.mockReturnValue(100)
  mocks.subscribeCb.current = null
  mocks.pgCbs.training_log = []
  mocks.pgCbs.recovery = []
  mocks.channel.mockReturnValue(mocks.channelStub)
  mocks.channelStub.on.mockImplementation((_type, filter, cb) => {
    if (filter && filter.table) {
      const tbl = filter.table
      if (!mocks.pgCbs[tbl]) mocks.pgCbs[tbl] = []
      mocks.pgCbs[tbl].push(cb)
    }
    return mocks.channelStub
  })
  mocks.channelStub.subscribe.mockImplementation((cb) => {
    mocks.subscribeCb.current = cb
    return mocks.channelStub
  })
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useRealtimeSquadFeed', () => {
  it('creates channel on mount with correct name', () => {
    renderHook(() => useRealtimeSquadFeed({ coachId: 'coach-1', athletes: ATHLETES }))
    expect(mocks.channel).toHaveBeenCalledWith('squad-feed-coach-1')
  })

  it('returns empty feedEvents initially', () => {
    const { result } = renderHook(() =>
      useRealtimeSquadFeed({ coachId: 'coach-1', athletes: ATHLETES })
    )
    expect(result.current.feedEvents).toHaveLength(0)
  })

  it('sets feedStatus live on SUBSCRIBED', () => {
    const { result } = renderHook(() =>
      useRealtimeSquadFeed({ coachId: 'coach-1', athletes: ATHLETES })
    )
    act(() => { mocks.subscribeCb.current?.('SUBSCRIBED') })
    expect(result.current.feedStatus).toBe('live')
  })

  it('tracks subscribe telemetry on SUBSCRIBED', () => {
    renderHook(() =>
      useRealtimeSquadFeed({ coachId: 'coach-1', athletes: ATHLETES })
    )
    act(() => { mocks.subscribeCb.current?.('SUBSCRIBED') })
    expect(mocks.trackEvent).toHaveBeenCalledWith('realtime', 'subscribe', 'squad-feed')
  })

  it('tracks unsubscribe telemetry on unmount', () => {
    const { unmount } = renderHook(() =>
      useRealtimeSquadFeed({ coachId: 'coach-1', athletes: ATHLETES })
    )
    unmount()
    expect(mocks.trackEvent).toHaveBeenCalledWith('realtime', 'unsubscribe', 'squad-feed')
  })

  it('removes channel on unmount', () => {
    const { unmount } = renderHook(() =>
      useRealtimeSquadFeed({ coachId: 'coach-1', athletes: ATHLETES })
    )
    unmount()
    expect(mocks.remove).toHaveBeenCalled()
  })

  it('appends session event with correct athlete name', () => {
    const { result } = renderHook(() =>
      useRealtimeSquadFeed({ coachId: 'coach-1', athletes: ATHLETES })
    )
    act(() => { mocks.subscribeCb.current?.('SUBSCRIBED') })
    act(() => {
      mocks.pgCbs.training_log[0]?.({ new: {
        id: 'row-1', user_id: 'a1', type: 'run', tss: 80, created_at: new Date().toISOString(),
      }})
    })
    expect(result.current.feedEvents).toHaveLength(1)
    expect(result.current.feedEvents[0].kind).toBe('session')
    expect(result.current.feedEvents[0].label).toContain('Alice')
    expect(result.current.feedEvents[0].label).toContain('80 TSS')
  })

  it('appends recovery event', () => {
    const { result } = renderHook(() =>
      useRealtimeSquadFeed({ coachId: 'coach-1', athletes: ATHLETES })
    )
    act(() => { mocks.subscribeCb.current?.('SUBSCRIBED') })
    act(() => {
      mocks.pgCbs.recovery[0]?.({ new: {
        id: 'rec-1', user_id: 'a2', score: 78, created_at: new Date().toISOString(),
      }})
    })
    expect(result.current.feedEvents[0].kind).toBe('recovery')
    expect(result.current.feedEvents[0].label).toContain('Bob')
  })

  it('caps feedEvents at MAX_FEED (50)', () => {
    const { result } = renderHook(() =>
      useRealtimeSquadFeed({ coachId: 'coach-1', athletes: ATHLETES })
    )
    act(() => { mocks.subscribeCb.current?.('SUBSCRIBED') })
    act(() => {
      for (let i = 0; i < 60; i++) {
        mocks.pgCbs.training_log[0]?.({ new: {
          id: `row-${i}`, user_id: 'a1', type: 'run', created_at: new Date().toISOString(),
        }})
      }
    })
    expect(result.current.feedEvents).toHaveLength(50)
  })

  it('sets feedStatus reconnecting on CHANNEL_ERROR', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() =>
      useRealtimeSquadFeed({ coachId: 'coach-1', athletes: ATHLETES })
    )
    act(() => { mocks.subscribeCb.current?.('CHANNEL_ERROR') })
    expect(result.current.feedStatus).toBe('reconnecting')
    vi.useRealTimers()
  })

  it('calls computeBackoff on CHANNEL_ERROR', () => {
    vi.useFakeTimers()
    renderHook(() =>
      useRealtimeSquadFeed({ coachId: 'coach-1', athletes: ATHLETES })
    )
    act(() => { mocks.subscribeCb.current?.('CHANNEL_ERROR') })
    expect(mocks.computeBackoff).toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('does not subscribe when enabled=false', () => {
    renderHook(() =>
      useRealtimeSquadFeed({ coachId: 'coach-1', athletes: ATHLETES, enabled: false })
    )
    expect(mocks.channel).not.toHaveBeenCalled()
  })

  it('does not subscribe when athletes is empty', () => {
    renderHook(() =>
      useRealtimeSquadFeed({ coachId: 'coach-1', athletes: [] })
    )
    expect(mocks.channel).not.toHaveBeenCalled()
  })

  it('reports live status to realtimeStatus module', () => {
    renderHook(() =>
      useRealtimeSquadFeed({ coachId: 'coach-1', athletes: ATHLETES })
    )
    act(() => { mocks.subscribeCb.current?.('SUBSCRIBED') })
    expect(mocks.reportStatus).toHaveBeenCalledWith('squad-feed-coach-1', 'live')
  })

  it('removes status from registry on unmount', () => {
    const { unmount } = renderHook(() =>
      useRealtimeSquadFeed({ coachId: 'coach-1', athletes: ATHLETES })
    )
    unmount()
    expect(mocks.removeStatus).toHaveBeenCalledWith('squad-feed-coach-1')
  })
})
