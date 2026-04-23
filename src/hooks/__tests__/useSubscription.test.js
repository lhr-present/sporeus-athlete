// @vitest-environment jsdom
// ─── useSubscription.test.js ─────────────────────────────────────────────────
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSubscription } from '../useSubscription.js'

// ── Mocks ─────────────────────────────────────────────────────────────────────
const mocks = vi.hoisted(() => {
  let updateHandler = null

  const channelStub = {
    on: vi.fn((_event, _filter, handler) => {
      updateHandler = handler
      return channelStub
    }),
    subscribe: vi.fn(() => channelStub),
  }

  const supabaseMock = {
    channel:       vi.fn(() => channelStub),
    removeChannel: vi.fn(),
  }

  return { supabaseMock, channelStub, get updateHandler() { return updateHandler },
           set updateHandler(v) { updateHandler = v } }
})

vi.mock('../../lib/supabase.js', () => ({
  supabase: mocks.supabaseMock,
}))

beforeEach(() => {
  vi.clearAllMocks()
  mocks.updateHandler = null
  mocks.channelStub.on.mockImplementation((_e, _f, handler) => {
    mocks.updateHandler = handler
    return mocks.channelStub
  })
})

// ─────────────────────────────────────────────────────────────────────────────

describe('useSubscription', () => {
  it('does not subscribe when userId is null', () => {
    renderHook(() => useSubscription(null, vi.fn()))
    expect(mocks.supabaseMock.channel).not.toHaveBeenCalled()
  })

  it('subscribes to profiles UPDATE for the given userId', () => {
    const userId = '00000000-0000-0000-0000-000000000001'
    renderHook(() => useSubscription(userId, vi.fn()))
    expect(mocks.supabaseMock.channel).toHaveBeenCalledWith(`profile-sub:${userId}`)
    expect(mocks.channelStub.subscribe).toHaveBeenCalled()
  })

  it('calls onUpdate with relevant subscription fields on profiles UPDATE', () => {
    const userId   = '00000000-0000-0000-0000-000000000002'
    const onUpdate = vi.fn()
    renderHook(() => useSubscription(userId, onUpdate))

    act(() => {
      mocks.updateHandler?.({
        new: {
          id:                   userId,
          subscription_status:  'past_due',
          subscription_tier:    'coach',
          trial_ends_at:        null,
          grace_period_ends_at: '2026-04-26T03:00:00Z',
          subscription_end_date: null,
          email: 'test@sporeus.com', // extra field — must NOT appear in callback
        },
      })
    })

    expect(onUpdate).toHaveBeenCalledOnce()
    const payload = onUpdate.mock.calls[0][0]
    expect(payload.subscription_status).toBe('past_due')
    expect(payload.subscription_tier).toBe('coach')
    expect(payload.grace_period_ends_at).toBe('2026-04-26T03:00:00Z')
    expect(payload.email).toBeUndefined()
  })

  it('removes channel on unmount', () => {
    const userId = '00000000-0000-0000-0000-000000000003'
    const { unmount } = renderHook(() => useSubscription(userId, vi.fn()))
    unmount()
    expect(mocks.supabaseMock.removeChannel).toHaveBeenCalledWith(mocks.channelStub)
  })

  it('re-subscribes when userId changes', () => {
    const onUpdate = vi.fn()
    const { rerender } = renderHook(
      ({ uid }) => useSubscription(uid, onUpdate),
      { initialProps: { uid: 'uid-a' } }
    )
    rerender({ uid: 'uid-b' })
    expect(mocks.supabaseMock.channel).toHaveBeenCalledTimes(2)
    expect(mocks.supabaseMock.channel).toHaveBeenNthCalledWith(1, 'profile-sub:uid-a')
    expect(mocks.supabaseMock.channel).toHaveBeenNthCalledWith(2, 'profile-sub:uid-b')
  })
})
