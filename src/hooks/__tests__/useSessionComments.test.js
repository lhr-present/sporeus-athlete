// @vitest-environment jsdom
// src/hooks/__tests__/useSessionComments.test.js
// E11 — Subscription lifecycle, optimistic updates, offline fallback.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  let subscribeCb = null
  let broadcastCbs = {}
  let pgChangesCb = null

  const channelStub = {
    on: vi.fn((_type, filter, cb) => {
      if (_type === 'broadcast' && filter?.event) {
        broadcastCbs[filter.event] = cb
      } else if (_type === 'postgres_changes') {
        pgChangesCb = cb
      }
      return channelStub
    }),
    subscribe: vi.fn(cb => { subscribeCb = cb; return channelStub }),
  }

  const chainMock = {
    from:   vi.fn(() => chainMock),
    select: vi.fn(() => chainMock),
    insert: vi.fn(() => chainMock),
    update: vi.fn(() => chainMock),
    upsert: vi.fn(() => chainMock),
    eq:     vi.fn(() => chainMock),
    order:  vi.fn(() => Promise.resolve({ data: [], error: null })),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
  }

  return {
    isReady:       vi.fn(() => true),
    channelFn:     vi.fn(() => channelStub),
    removeChannel: vi.fn(),
    chainMock,
    channelStub,
    reportStatus:  vi.fn(),
    removeStatus:  vi.fn(),
    computeBackoff: vi.fn(() => 50),
    postComment:   vi.fn(),
    editComment:   vi.fn(),
    deleteComment: vi.fn(),
    recordView:    vi.fn(() => Promise.resolve({ error: null })),
    get subscribeCb() { return subscribeCb },
    get broadcastCbs() { return broadcastCbs },
    get pgChangesCb() { return pgChangesCb },
    reset() {
      subscribeCb = null
      broadcastCbs = {}
      pgChangesCb = null
    },
  }
})

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn(() => ({
    setQueryData:    vi.fn(),
    invalidateQueries: vi.fn(),
  })),
}))

vi.mock('../../lib/supabase.js', () => ({
  isSupabaseReady: mocks.isReady,
  supabase: {
    channel: mocks.channelFn,
    removeChannel: mocks.removeChannel,
    from: mocks.chainMock.from,
  },
}))

vi.mock('../../lib/realtimeBackoff.js', () => ({ computeBackoff: mocks.computeBackoff }))
vi.mock('../../lib/realtimeStatus.js', () => ({
  reportStatus: mocks.reportStatus,
  removeStatus: mocks.removeStatus,
}))

vi.mock('../../lib/realtime/commentActions.js', () => ({
  postComment:       mocks.postComment,
  editComment:       mocks.editComment,
  deleteComment:     mocks.deleteComment,
  recordSessionView: mocks.recordView,
  newCommentId:      () => 'test-uuid-0000-4000-8000-000000000000',
}))

const { useSessionComments } = await import('../useSessionComments.js')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.reset()
  mocks.isReady.mockReturnValue(true)
  mocks.channelFn.mockReturnValue(mocks.channelStub)
  mocks.channelStub.on.mockImplementation((_type, filter, cb) => {
    if (_type === 'broadcast' && filter?.event) {
      mocks.broadcastCbs[filter.event] = cb
    } else if (_type === 'postgres_changes') {
      mocks._pgCb = cb
    }
    return mocks.channelStub
  })
  mocks.channelStub.subscribe.mockImplementation(cb => {
    mocks._subCb = cb
    return mocks.channelStub
  })
  mocks.recordView.mockResolvedValue({ error: null })
  // Default: no existing comments
  mocks.chainMock.order.mockResolvedValue({ data: [], error: null })
})

// ── Channel lifecycle ─────────────────────────────────────────────────────────

describe('useSessionComments — lifecycle', () => {
  it('creates channel for sessionId', () => {
    renderHook(() => useSessionComments('sess-1', 'user-1'))
    expect(mocks.channelFn).toHaveBeenCalledWith('session:sess-1')
  })

  it('does not subscribe when sessionId is null', () => {
    renderHook(() => useSessionComments(null, 'user-1'))
    expect(mocks.channelFn).not.toHaveBeenCalled()
  })

  it('records session view on mount', () => {
    renderHook(() => useSessionComments('sess-1', 'user-1'))
    expect(mocks.recordView).toHaveBeenCalledWith(
      expect.anything(), 'sess-1', 'user-1'
    )
  })

  it('removes channel on unmount', () => {
    const { unmount } = renderHook(() => useSessionComments('sess-1', 'user-1'))
    unmount()
    expect(mocks.removeChannel).toHaveBeenCalled()
  })

  it('removes status from registry on unmount', () => {
    const { unmount } = renderHook(() => useSessionComments('sess-1', 'user-1'))
    unmount()
    expect(mocks.removeStatus).toHaveBeenCalledWith('session-comments-sess-1')
  })
})

// ── Status transitions ────────────────────────────────────────────────────────

describe('useSessionComments — status', () => {
  it('sets status to "live" on SUBSCRIBED', () => {
    const { result } = renderHook(() => useSessionComments('sess-1', 'user-1'))
    act(() => { mocks._subCb?.('SUBSCRIBED') })
    expect(result.current.status).toBe('live')
  })

  it('sets status to "reconnecting" on CHANNEL_ERROR', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useSessionComments('sess-1', 'user-1'))
    act(() => { mocks._subCb?.('CHANNEL_ERROR') })
    expect(result.current.status).toBe('reconnecting')
    vi.useRealTimers()
  })
})

// ── Typing indicator ──────────────────────────────────────────────────────────

describe('useSessionComments — typing indicator', () => {
  it('adds user to typingUsers on typing broadcast', () => {
    const { result } = renderHook(() => useSessionComments('sess-1', 'user-1'))
    act(() => {
      mocks.broadcastCbs['typing']?.({ payload: { userId: 'coach-1', isTyping: true } })
    })
    expect(result.current.typingUsers).toContain('coach-1')
  })

  it('removes user from typingUsers on isTyping=false', () => {
    const { result } = renderHook(() => useSessionComments('sess-1', 'user-1'))
    act(() => {
      mocks.broadcastCbs['typing']?.({ payload: { userId: 'coach-1', isTyping: true } })
    })
    act(() => {
      mocks.broadcastCbs['typing']?.({ payload: { userId: 'coach-1', isTyping: false } })
    })
    expect(result.current.typingUsers).not.toContain('coach-1')
  })
})

// ── Optimistic post ───────────────────────────────────────────────────────────

describe('useSessionComments — postComment optimistic', () => {
  it('adds optimistic row immediately before server reply', async () => {
    // Freeze fetchComments so it never resolves and can't overwrite state
    mocks.chainMock.order.mockReturnValue(new Promise(() => {}))
    let resolvePost
    mocks.postComment.mockReturnValue(new Promise(r => { resolvePost = r }))

    const { result } = renderHook(() => useSessionComments('sess-1', 'user-1'))

    // Trigger postComment — optimistic row added synchronously before await
    act(() => { result.current.postComment('hello') })

    // Optimistic row should be visible immediately
    expect(result.current.comments.some(c => c._optimistic && c.body === 'hello')).toBe(true)

    // Resolve with confirmed data
    await act(async () => {
      resolvePost({
        data: { id: 'c-real', body: 'hello', session_id: 'sess-1', author_id: 'user-1', created_at: new Date().toISOString() },
        error: null, queued: false,
      })
    })

    // Optimistic row replaced by real row
    expect(result.current.comments.some(c => c._optimistic)).toBe(false)
    expect(result.current.comments.some(c => c.id === 'c-real')).toBe(true)
  })

  it('removes optimistic row on error', async () => {
    // Freeze fetchComments so it never resolves
    mocks.chainMock.order.mockReturnValue(new Promise(() => {}))
    mocks.postComment.mockResolvedValue({ data: null, error: new Error('fail'), queued: false })

    const { result } = renderHook(() => useSessionComments('sess-1', 'user-1'))
    await act(async () => { await result.current.postComment('bad post') })

    expect(result.current.comments.some(c => c._optimistic)).toBe(false)
  })

  it('keeps optimistic row when queued=true', async () => {
    // Freeze fetchComments so it never resolves
    mocks.chainMock.order.mockReturnValue(new Promise(() => {}))
    mocks.postComment.mockResolvedValue({ data: null, error: null, queued: true })

    const { result } = renderHook(() => useSessionComments('sess-1', 'user-1'))
    await act(async () => { await result.current.postComment('offline post') })

    expect(result.current.comments.some(c => c._optimistic && c.body === 'offline post')).toBe(true)
  })
})

// ── Edit / delete ─────────────────────────────────────────────────────────────

describe('useSessionComments — editComment', () => {
  it('updates comment body locally on success', async () => {
    mocks.chainMock.order.mockResolvedValue({
      data: [{ id: 'c1', body: 'original', session_id: 'sess-1', author_id: 'user-1', created_at: new Date().toISOString() }],
      error: null,
    })
    mocks.editComment.mockResolvedValue({ data: { id: 'c1', body: 'updated' }, error: null })

    const { result } = renderHook(() => useSessionComments('sess-1', 'user-1'))
    await act(async () => {}) // wait for fetch

    await act(async () => { await result.current.editComment('c1', 'updated') })
    expect(result.current.comments.find(c => c.id === 'c1')?.body).toBe('updated')
  })
})

describe('useSessionComments — UPDATE echo ordering', () => {
  const NEWER = '2026-06-17T12:00:05.000Z'
  const OLDER = '2026-06-17T12:00:01.000Z'

  it('drops a stale-edited_at UPDATE echo (keeps the newer edit)', async () => {
    mocks.chainMock.order.mockResolvedValue({
      data: [{
        id: 'c1', body: 'newer edit', edited_at: NEWER,
        session_id: 'sess-1', author_id: 'user-1', created_at: '2026-06-17T12:00:00.000Z',
      }],
      error: null,
    })
    const { result } = renderHook(() => useSessionComments('sess-1', 'user-1'))
    await act(async () => {})   // wait for initial fetch

    // A delayed/older echo arrives — must NOT revert the fresher local body.
    act(() => {
      mocks._pgCb?.({ eventType: 'UPDATE', new: { id: 'c1', body: 'older edit', edited_at: OLDER }, old: {} })
    })
    expect(result.current.comments.find(c => c.id === 'c1')?.body).toBe('newer edit')
  })

  it('applies a newer UPDATE echo over an older local row', async () => {
    mocks.chainMock.order.mockResolvedValue({
      data: [{
        id: 'c1', body: 'older edit', edited_at: OLDER,
        session_id: 'sess-1', author_id: 'user-1', created_at: '2026-06-17T12:00:00.000Z',
      }],
      error: null,
    })
    const { result } = renderHook(() => useSessionComments('sess-1', 'user-1'))
    await act(async () => {})

    act(() => {
      mocks._pgCb?.({ eventType: 'UPDATE', new: { id: 'c1', body: 'newer edit', edited_at: NEWER }, old: {} })
    })
    expect(result.current.comments.find(c => c.id === 'c1')?.body).toBe('newer edit')
  })
})

describe('useSessionComments — deleteComment', () => {
  it('sets deleted_at locally on success', async () => {
    mocks.chainMock.order.mockResolvedValue({
      data: [{ id: 'c1', body: 'text', session_id: 'sess-1', author_id: 'user-1', created_at: new Date().toISOString() }],
      error: null,
    })
    mocks.deleteComment.mockResolvedValue({ error: null })

    const { result } = renderHook(() => useSessionComments('sess-1', 'user-1'))
    await act(async () => {})

    await act(async () => { await result.current.deleteComment('c1') })
    expect(result.current.comments.find(c => c.id === 'c1')?.deleted_at).toBeTruthy()
  })
})
