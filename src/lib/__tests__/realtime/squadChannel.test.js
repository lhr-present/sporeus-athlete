// src/lib/__tests__/realtime/squadChannel.test.js
// E11 — Unit tests for squadChannel.js (mocked Supabase channel).

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
  let subscribeCb = null
  let presenceState = {}

  const channelStub = {
    on:         vi.fn(() => channelStub),
    subscribe:  vi.fn(cb => { subscribeCb = cb; return channelStub }),
    track:      vi.fn(() => Promise.resolve()),
    presenceState: vi.fn(() => presenceState),
    _fire:       (s) => subscribeCb?.(s),
    _setPresence: (s) => { presenceState = s },
    _pgCbs:      {},
  }

  // Track postgres_changes callbacks by table
  channelStub.on.mockImplementation((_type, filter, cb) => {
    if (filter?.table) {
      channelStub._pgCbs[filter.table] = cb
    }
    if (filter?.event === 'sync') {
      channelStub._pgCbs._presence_sync = cb
    }
    return channelStub
  })

  return {
    channelStub,
    channelFn:     vi.fn(() => channelStub),
    removeChannel: vi.fn(),
    reportStatus:  vi.fn(),
    removeStatus:  vi.fn(),
    computeBackoff: vi.fn(() => 50),
    get subscribeCb() { return subscribeCb },
    reset() { subscribeCb = null; presenceState = {} },
  }
})

vi.mock('../../../lib/realtimeBackoff.js', () => ({
  computeBackoff: mocks.computeBackoff,
}))

vi.mock('../../../lib/realtimeStatus.js', () => ({
  reportStatus: mocks.reportStatus,
  removeStatus: mocks.removeStatus,
}))

const { createSquadChannel } = await import('../../realtime/squadChannel.js')

const supabaseMock = {
  channel:       mocks.channelFn,
  removeChannel: mocks.removeChannel,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.reset()
  mocks.channelFn.mockReturnValue(mocks.channelStub)
  mocks.channelStub.on.mockImplementation((_type, filter, cb) => {
    if (filter?.table) mocks.channelStub._pgCbs[filter.table] = cb
    if (filter?.event === 'sync') mocks.channelStub._pgCbs._presence_sync = cb
    return mocks.channelStub
  })
  mocks.channelStub.subscribe.mockImplementation(cb => {
    mocks._subscribeCb = cb
    return mocks.channelStub
  })
})

// ── Lifecycle ─────────────────────────────────────────────────────────────────

describe('createSquadChannel — lifecycle', () => {
  it('creates channel with correct name', () => {
    const { unsubscribe } = createSquadChannel(supabaseMock, 'coach-1', {})
    expect(mocks.channelFn).toHaveBeenCalledWith('squad:coach-1')
    unsubscribe()
  })

  it('calls reportStatus "connecting" on subscribe', () => {
    const { unsubscribe } = createSquadChannel(supabaseMock, 'coach-1', {})
    expect(mocks.reportStatus).toHaveBeenCalledWith('squad-coach-1', 'connecting')
    unsubscribe()
  })

  it('calls removeStatus on unsubscribe', () => {
    const { unsubscribe } = createSquadChannel(supabaseMock, 'coach-1', {})
    unsubscribe()
    expect(mocks.removeStatus).toHaveBeenCalledWith('squad-coach-1')
  })

  it('calls removeChannel on unsubscribe', () => {
    const { unsubscribe } = createSquadChannel(supabaseMock, 'coach-1', {})
    unsubscribe()
    expect(mocks.removeChannel).toHaveBeenCalled()
  })

  it('ignores events after unsubscribe', () => {
    const onStatusChange = vi.fn()
    const { unsubscribe } = createSquadChannel(supabaseMock, 'coach-1', { onStatusChange })
    unsubscribe()
    onStatusChange.mockClear()
    // Simulate SUBSCRIBED after unsubscribe
    mocks._subscribeCb?.('SUBSCRIBED')
    expect(onStatusChange).not.toHaveBeenCalled()
  })
})

// ── Status reporting ──────────────────────────────────────────────────────────

describe('createSquadChannel — status callbacks', () => {
  it('fires onStatusChange("live") on SUBSCRIBED', () => {
    const onStatusChange = vi.fn()
    const { unsubscribe } = createSquadChannel(supabaseMock, 'coach-1', { onStatusChange })
    mocks._subscribeCb?.('SUBSCRIBED')
    expect(onStatusChange).toHaveBeenCalledWith('live')
    unsubscribe()
  })

  it('fires onStatusChange("reconnecting") on CHANNEL_ERROR', () => {
    vi.useFakeTimers()
    const onStatusChange = vi.fn()
    const { unsubscribe } = createSquadChannel(supabaseMock, 'coach-1', { onStatusChange })
    mocks._subscribeCb?.('CHANNEL_ERROR')
    expect(onStatusChange).toHaveBeenCalledWith('reconnecting')
    vi.useRealTimers()
    unsubscribe()
  })

  it('calls computeBackoff on CHANNEL_ERROR', () => {
    vi.useFakeTimers()
    const { unsubscribe } = createSquadChannel(supabaseMock, 'coach-1', {})
    mocks._subscribeCb?.('CHANNEL_ERROR')
    expect(mocks.computeBackoff).toHaveBeenCalled()
    vi.useRealTimers()
    unsubscribe()
  })

  it('fires onStatusChange("disconnected") on CLOSED', () => {
    const onStatusChange = vi.fn()
    const { unsubscribe } = createSquadChannel(supabaseMock, 'coach-1', { onStatusChange })
    mocks._subscribeCb?.('CLOSED')
    expect(onStatusChange).toHaveBeenCalledWith('disconnected')
    unsubscribe()
  })
})

// ── postgres_changes callbacks ────────────────────────────────────────────────

describe('createSquadChannel — change callbacks', () => {
  it('subscribes to training_log changes', () => {
    const { unsubscribe } = createSquadChannel(supabaseMock, 'coach-1', {})
    const tables = mocks.channelStub.on.mock.calls
      .filter(c => c[0] === 'postgres_changes')
      .map(c => c[1]?.table)
    expect(tables).toContain('training_log')
    unsubscribe()
  })

  it('subscribes to session_comments changes', () => {
    const { unsubscribe } = createSquadChannel(supabaseMock, 'coach-1', {})
    const tables = mocks.channelStub.on.mock.calls
      .filter(c => c[0] === 'postgres_changes')
      .map(c => c[1]?.table)
    expect(tables).toContain('session_comments')
    unsubscribe()
  })

  it('fires onTrainingLog callback when training_log changes', () => {
    const onTrainingLog = vi.fn()
    const { unsubscribe } = createSquadChannel(supabaseMock, 'coach-1', { onTrainingLog })
    const cb = mocks.channelStub._pgCbs['training_log']
    cb?.({ eventType: 'INSERT', new: { id: 'tl-1' } })
    expect(onTrainingLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'INSERT' }))
    unsubscribe()
  })

  it('fires onComment callback when session_comments changes', () => {
    const onComment = vi.fn()
    const { unsubscribe } = createSquadChannel(supabaseMock, 'coach-1', { onComment })
    const cb = mocks.channelStub._pgCbs['session_comments']
    cb?.({ eventType: 'INSERT', new: { id: 'c-1' } })
    expect(onComment).toHaveBeenCalled()
    unsubscribe()
  })
})

// ── Presence ──────────────────────────────────────────────────────────────────

describe('createSquadChannel — presence', () => {
  it('returns trackPresence function', () => {
    const { trackPresence, unsubscribe } = createSquadChannel(supabaseMock, 'coach-1', {})
    expect(typeof trackPresence).toBe('function')
    unsubscribe()
  })

  it('calls channel.track with userId and viewingSessionId', () => {
    mocks._subscribeCb?.('SUBSCRIBED')   // make channel active
    const { trackPresence, unsubscribe } = createSquadChannel(supabaseMock, 'coach-1', {})
    trackPresence('u1', 's1')
    expect(mocks.channelStub.track).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', viewingSessionId: 's1', role: 'coach' })
    )
    unsubscribe()
  })

  it('is a no-op after unsubscribe', () => {
    const { trackPresence, unsubscribe } = createSquadChannel(supabaseMock, 'coach-1', {})
    unsubscribe()
    mocks.channelStub.track.mockClear()
    trackPresence('u1', 's1')
    expect(mocks.channelStub.track).not.toHaveBeenCalled()
  })
})
