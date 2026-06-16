// @vitest-environment jsdom
// ─── useRealtimeSquad.test.js — subscription lifecycle, toast-timer tracking,
//     MAX_RETRY reconnect cap, clean-CLOSED handling ───────────────────────────
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRealtimeSquad } from '../useRealtimeSquad.js'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  const subscribeCb = { current: null }
  const pgCbs       = { recovery: [], training_log: [] }

  const channelStub = {
    on: vi.fn((_type, filter, cb) => {
      if (filter && filter.table) {
        const tbl = filter.table
        if (!pgCbs[tbl]) pgCbs[tbl] = []
        pgCbs[tbl].push(cb)
      }
      return channelStub
    }),
    subscribe: vi.fn((cb) => { subscribeCb.current = cb; return channelStub }),
  }

  return {
    isReady:        vi.fn(() => true),
    channel:        vi.fn(() => channelStub),
    remove:         vi.fn(),
    isFeatureGated: vi.fn(() => false),
    computeBackoff: vi.fn(() => 100),
    channelStub,
    subscribeCb,
    pgCbs,
  }
})

vi.mock('../../lib/supabase.js', () => ({
  isSupabaseReady: mocks.isReady,
  supabase: {
    channel: mocks.channel,
    removeChannel: mocks.remove,
  },
}))

vi.mock('../../lib/subscription.js', () => ({
  isFeatureGated: mocks.isFeatureGated,
}))

vi.mock('../../lib/realtimeBackoff.js', () => ({
  computeBackoff: mocks.computeBackoff,
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

const AUTH_USER = { id: 'coach-1' }
const ATHLETES  = [
  { athlete_id: 'a1', display_name: 'Alice' },
  { athlete_id: 'a2', display_name: 'Bob' },
]

beforeEach(() => {
  vi.clearAllMocks()
  mocks.isReady.mockReturnValue(true)
  mocks.isFeatureGated.mockReturnValue(false)
  mocks.computeBackoff.mockReturnValue(100)
  mocks.subscribeCb.current = null
  mocks.pgCbs.recovery = []
  mocks.pgCbs.training_log = []
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

describe('useRealtimeSquad', () => {
  it('subscribes with the coach-scoped channel name', () => {
    renderHook(() => useRealtimeSquad({ authUser: AUTH_USER, isDemo: false, athletes: ATHLETES }))
    expect(mocks.channel).toHaveBeenCalledWith('rt-squad-coach-1')
  })

  it('does not subscribe in demo mode', () => {
    renderHook(() => useRealtimeSquad({ authUser: AUTH_USER, isDemo: true, athletes: ATHLETES }))
    expect(mocks.channel).not.toHaveBeenCalled()
  })

  it('does not subscribe when realtime feature is gated', () => {
    mocks.isFeatureGated.mockReturnValue(true)
    renderHook(() => useRealtimeSquad({ authUser: AUTH_USER, isDemo: false, athletes: ATHLETES }))
    expect(mocks.channel).not.toHaveBeenCalled()
  })

  it('sets rtStatus live on SUBSCRIBED', () => {
    const { result } = renderHook(() =>
      useRealtimeSquad({ authUser: AUTH_USER, isDemo: false, athletes: ATHLETES }))
    act(() => { mocks.subscribeCb.current?.('SUBSCRIBED') })
    expect(result.current.rtStatus).toBe('live')
  })

  describe('toast timer (recovery INSERT)', () => {
    it('shows a toast on recovery INSERT then clears it after 6s via a tracked timer', () => {
      const onUpdate = vi.fn()
      const { result } = renderHook(() =>
        useRealtimeSquad({ authUser: AUTH_USER, isDemo: false, athletes: ATHLETES, onUpdate }))
      vi.useFakeTimers()
      act(() => { mocks.subscribeCb.current?.('SUBSCRIBED') })

      act(() => {
        mocks.pgCbs.recovery[0]?.({ new: { user_id: 'a1', date: '2026-06-16', soreness: 3 } })
      })
      expect(result.current.rtToast).toContain('Alice')
      expect(onUpdate).toHaveBeenCalledWith('a1', '2026-06-16', expect.any(Object))

      act(() => { vi.advanceTimersByTime(6000) })
      expect(result.current.rtToast).toBe('')
      vi.useRealTimers()
    })

    it('does not throw / setState after unmount when toast timer is pending', () => {
      const { result, unmount } = renderHook(() =>
        useRealtimeSquad({ authUser: AUTH_USER, isDemo: false, athletes: ATHLETES }))
      vi.useFakeTimers()
      act(() => { mocks.subscribeCb.current?.('SUBSCRIBED') })
      act(() => {
        mocks.pgCbs.recovery[0]?.({ new: { user_id: 'a2', date: '2026-06-16', soreness: 1 } })
      })
      expect(result.current.rtToast).toContain('Bob')

      // Unmount before the 6s timer fires; cleanup must clear it (no late setState).
      act(() => { unmount() })
      expect(() => { act(() => { vi.advanceTimersByTime(6000) }) }).not.toThrow()
      vi.useRealTimers()
    })

    it('rapid recovery events do not stack untracked timers (latest wins)', () => {
      const { result } = renderHook(() =>
        useRealtimeSquad({ authUser: AUTH_USER, isDemo: false, athletes: ATHLETES }))
      vi.useFakeTimers()
      act(() => { mocks.subscribeCb.current?.('SUBSCRIBED') })

      act(() => {
        mocks.pgCbs.recovery[0]?.({ new: { user_id: 'a1', date: '2026-06-16', soreness: 2 } })
      })
      act(() => { vi.advanceTimersByTime(3000) })
      act(() => {
        mocks.pgCbs.recovery[0]?.({ new: { user_id: 'a2', date: '2026-06-16', soreness: 4 } })
      })
      expect(result.current.rtToast).toContain('Bob')

      // The first timer (would have fired at 6000) was cleared; only the second
      // timer (fires at 3000+6000) governs clearing.
      act(() => { vi.advanceTimersByTime(3000) })   // t=6000 from start — first timer's slot
      expect(result.current.rtToast).toContain('Bob')   // still visible
      act(() => { vi.advanceTimersByTime(3000) })   // t=9000 — second timer fires
      expect(result.current.rtToast).toBe('')
      vi.useRealTimers()
    })
  })

  describe('reconnect cap (MAX_RETRY)', () => {
    it('schedules a reconnect on CHANNEL_ERROR while under the cap', () => {
      const { result } = renderHook(() =>
        useRealtimeSquad({ authUser: AUTH_USER, isDemo: false, athletes: ATHLETES }))
      vi.useFakeTimers()
      act(() => { mocks.subscribeCb.current?.('CHANNEL_ERROR') })
      expect(result.current.rtStatus).toBe('reconnecting')
      expect(mocks.computeBackoff).toHaveBeenCalled()
      vi.useRealTimers()
    })

    it('stops scheduling and releases the channel after MAX_RETRY (8) failures', () => {
      const { result } = renderHook(() =>
        useRealtimeSquad({ authUser: AUTH_USER, isDemo: false, athletes: ATHLETES }))
      vi.useFakeTimers()

      // Drive 8 error→reconnect cycles. Each reconnect re-subscribes; fire the
      // error on the freshly-registered callback each time.
      for (let i = 0; i < 8; i++) {
        act(() => { mocks.subscribeCb.current?.('CHANNEL_ERROR') })
        act(() => { vi.advanceTimersByTime(100) })  // run the scheduled connect()
      }
      mocks.remove.mockClear()

      // 9th failure: retry budget exhausted → disconnect + removeChannel, no new timer.
      mocks.computeBackoff.mockClear()
      act(() => { mocks.subscribeCb.current?.('CHANNEL_ERROR') })
      expect(result.current.rtStatus).toBe('disconnected')
      expect(mocks.computeBackoff).not.toHaveBeenCalled()
      expect(mocks.remove).toHaveBeenCalled()
      vi.useRealTimers()
    })

    it('resets the retry counter on SUBSCRIBED', () => {
      renderHook(() =>
        useRealtimeSquad({ authUser: AUTH_USER, isDemo: false, athletes: ATHLETES }))
      vi.useFakeTimers()
      // Two errors, then a successful subscribe resets the counter.
      act(() => { mocks.subscribeCb.current?.('CHANNEL_ERROR') })
      act(() => { vi.advanceTimersByTime(100) })
      act(() => { mocks.subscribeCb.current?.('SUBSCRIBED') })

      // After reset, a single error should still schedule (computeBackoff(0)).
      mocks.computeBackoff.mockClear()
      act(() => { mocks.subscribeCb.current?.('CHANNEL_ERROR') })
      expect(mocks.computeBackoff).toHaveBeenCalledWith(0)
      vi.useRealTimers()
    })

    it('does not auto-reconnect on a clean CLOSED', () => {
      const { result } = renderHook(() =>
        useRealtimeSquad({ authUser: AUTH_USER, isDemo: false, athletes: ATHLETES }))
      vi.useFakeTimers()
      mocks.computeBackoff.mockClear()
      act(() => { mocks.subscribeCb.current?.('CLOSED') })
      expect(result.current.rtStatus).toBe('disconnected')
      expect(mocks.computeBackoff).not.toHaveBeenCalled()
      vi.useRealTimers()
    })
  })

  describe('roster membership changes (athleteIdsKey)', () => {
    // Capture the recovery-table filter string passed to channel.on().
    function lastRecoveryFilter() {
      const calls = mocks.channelStub.on.mock.calls.filter(
        ([, f]) => f && f.table === 'recovery'
      )
      return calls.length ? calls[calls.length - 1][1].filter : null
    }

    it('re-subscribes with the new filter on a same-length roster SWAP', () => {
      const initial = [
        { athlete_id: 'a1', display_name: 'Alice' },
        { athlete_id: 'b1', display_name: 'Bob' },
      ]
      const { rerender } = renderHook(
        ({ athletes }) => useRealtimeSquad({ authUser: AUTH_USER, isDemo: false, athletes }),
        { initialProps: { athletes: initial } }
      )
      expect(lastRecoveryFilter()).toBe('user_id=in.(a1,b1)')
      const channelCallsBefore = mocks.channel.mock.calls.length

      // Swap B → C: SAME length, different membership.
      const swapped = [
        { athlete_id: 'a1', display_name: 'Alice' },
        { athlete_id: 'c1', display_name: 'Carol' },
      ]
      act(() => { rerender({ athletes: swapped }) })

      // Effect re-ran (new channel) with the corrected id filter.
      expect(mocks.channel.mock.calls.length).toBeGreaterThan(channelCallsBefore)
      expect(lastRecoveryFilter()).toBe('user_id=in.(a1,c1)')
    })

    it('does NOT re-subscribe when the roster is unchanged (only re-ordered)', () => {
      const initial = [
        { athlete_id: 'a1', display_name: 'Alice' },
        { athlete_id: 'b1', display_name: 'Bob' },
      ]
      const { rerender } = renderHook(
        ({ athletes }) => useRealtimeSquad({ authUser: AUTH_USER, isDemo: false, athletes }),
        { initialProps: { athletes: initial } }
      )
      const channelCallsBefore = mocks.channel.mock.calls.length

      // New array, same members, different order → sorted key is identical.
      const reordered = [
        { athlete_id: 'b1', display_name: 'Bob' },
        { athlete_id: 'a1', display_name: 'Alice' },
      ]
      act(() => { rerender({ athletes: reordered }) })

      expect(mocks.channel.mock.calls.length).toBe(channelCallsBefore)
    })
  })

  it('removes the channel on unmount', () => {
    const { unmount } = renderHook(() =>
      useRealtimeSquad({ authUser: AUTH_USER, isDemo: false, athletes: ATHLETES }))
    unmount()
    expect(mocks.remove).toHaveBeenCalled()
  })
})
