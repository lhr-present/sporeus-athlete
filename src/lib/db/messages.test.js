// ─── db/messages.test.js — Unit tests for the messages data-access layer ──────
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock at the Supabase system boundary before any imports from the module under test
vi.mock('../supabase.js', () => ({
  isSupabaseReady: vi.fn(() => true),
  supabase: {
    from:    vi.fn(),
    channel: vi.fn(),
  },
}))

import { isSupabaseReady, supabase } from '../supabase.js'
import {
  buildChannelId,
  getMessages,
  markReadById,
  markReadMany,
  insertMessage,
  subscribeToMessages,
} from './messages.js'

// ── Chain builder ──────────────────────────────────────────────────────────────
// Builds a thenable chain that mimics the Supabase query-builder fluent API.
// All chaining methods (select, eq, in, …) return the same chain object.
// `await chain` resolves with `result` because of the .then() implementation.
function makeQueryChain(result = { data: null, error: null }) {
  const chain = {}
  for (const m of ['select','eq','in','order','limit','update','insert','upsert']) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (res, rej) => Promise.resolve(result).then(res, rej)
  return chain
}

function makeChannelChain() {
  const chan = { on: vi.fn(), subscribe: vi.fn().mockReturnValue('sub-handle') }
  chan.on.mockReturnValue(chan)
  return chan
}

beforeEach(() => {
  vi.clearAllMocks()
  isSupabaseReady.mockReturnValue(true)
})

// ── buildChannelId ─────────────────────────────────────────────────────────────
describe('buildChannelId', () => {
  it('produces deterministic channel name', () => {
    expect(buildChannelId('coach1', 'athlete2')).toBe('msg-coach1-athlete2')
  })

  it('is order-sensitive (coach first, athlete second)', () => {
    expect(buildChannelId('a', 'b')).not.toBe(buildChannelId('b', 'a'))
  })
})

// ── getMessages ────────────────────────────────────────────────────────────────
describe('getMessages', () => {
  it('returns NOT_CONFIGURED when Supabase is not ready', async () => {
    isSupabaseReady.mockReturnValue(false)
    const { data, error } = await getMessages('c1', 'a1')
    expect(data).toBeNull()
    expect(error).toBeInstanceOf(Error)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('queries messages with correct filters and ordering', async () => {
    const rows = [{ id: '1', body: 'hi', sent_at: '2026-01-01T10:00:00Z' }]
    const chain = makeQueryChain({ data: rows, error: null })
    supabase.from.mockReturnValue(chain)

    const { data, error } = await getMessages('c1', 'a1')

    expect(error).toBeNull()
    expect(data).toEqual(rows)
    expect(supabase.from).toHaveBeenCalledWith('messages')
    expect(chain.select).toHaveBeenCalledWith('*')
    expect(chain.eq).toHaveBeenCalledWith('coach_id', 'c1')
    expect(chain.eq).toHaveBeenCalledWith('athlete_id', 'a1')
    expect(chain.order).toHaveBeenCalledWith('sent_at', { ascending: true })
    expect(chain.limit).toHaveBeenCalledWith(100)
  })

  it('surfaces query errors', async () => {
    const chain = makeQueryChain({ data: null, error: new Error('timeout') })
    supabase.from.mockReturnValue(chain)

    const { data, error } = await getMessages('c1', 'a1')
    expect(error).toBeInstanceOf(Error)
    expect(data).toBeNull()
  })
})

// ── markReadById ───────────────────────────────────────────────────────────────
describe('markReadById', () => {
  it('returns NOT_CONFIGURED when Supabase is not ready', async () => {
    isSupabaseReady.mockReturnValue(false)
    const { data, error } = await markReadById('msg-123')
    expect(error).toBeInstanceOf(Error)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('updates read_at for the given message id', async () => {
    const chain = makeQueryChain({ data: null, error: null })
    supabase.from.mockReturnValue(chain)

    const before = Date.now()
    await markReadById('msg-abc')
    const after = Date.now()

    expect(supabase.from).toHaveBeenCalledWith('messages')
    expect(chain.update).toHaveBeenCalledOnce()
    const updateArg = chain.update.mock.calls[0][0]
    expect(updateArg).toHaveProperty('read_at')
    const ts = new Date(updateArg.read_at).getTime()
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
    expect(chain.eq).toHaveBeenCalledWith('id', 'msg-abc')
  })
})

// ── markReadMany ───────────────────────────────────────────────────────────────
describe('markReadMany', () => {
  it('early-returns silently for empty ids array', async () => {
    const { data, error } = await markReadMany([])
    expect(data).toBeNull()
    expect(error).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('early-returns silently when Supabase not ready (even with ids)', async () => {
    isSupabaseReady.mockReturnValue(false)
    const { data, error } = await markReadMany(['id1', 'id2'])
    expect(data).toBeNull()
    expect(error).toBeNull()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('bulk-updates read_at using .in() for provided ids', async () => {
    const chain = makeQueryChain({ data: null, error: null })
    supabase.from.mockReturnValue(chain)

    await markReadMany(['id1', 'id2', 'id3'])

    expect(supabase.from).toHaveBeenCalledWith('messages')
    expect(chain.update).toHaveBeenCalledOnce()
    expect(chain.in).toHaveBeenCalledWith('id', ['id1', 'id2', 'id3'])
  })
})

// ── insertMessage ──────────────────────────────────────────────────────────────
describe('insertMessage', () => {
  it('returns NOT_CONFIGURED when Supabase is not ready', async () => {
    isSupabaseReady.mockReturnValue(false)
    const { data, error } = await insertMessage({ coachId: 'c', athleteId: 'a', encryptedBody: 'x' })
    expect(error).toBeInstanceOf(Error)
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('inserts with correct shape and sender_role=coach', async () => {
    const chain = makeQueryChain({ data: null, error: null })
    supabase.from.mockReturnValue(chain)

    await insertMessage({ coachId: 'c1', athleteId: 'a1', encryptedBody: 'enc-text' })

    expect(supabase.from).toHaveBeenCalledWith('messages')
    expect(chain.insert).toHaveBeenCalledWith({
      coach_id:    'c1',
      athlete_id:  'a1',
      sender_role: 'coach',
      body:        'enc-text',
    })
  })
})

// ── subscribeToMessages ────────────────────────────────────────────────────────
describe('subscribeToMessages', () => {
  it('returns null when Supabase is not ready', () => {
    isSupabaseReady.mockReturnValue(false)
    const result = subscribeToMessages('c1', 'a1', vi.fn())
    expect(result).toBeNull()
    expect(supabase.channel).not.toHaveBeenCalled()
  })

  it('subscribes on the correct channel with postgres_changes filter', () => {
    const chan = makeChannelChain()
    supabase.channel.mockReturnValue(chan)
    const handler = vi.fn()

    const result = subscribeToMessages('c1', 'a1', handler)

    expect(supabase.channel).toHaveBeenCalledWith('msg-c1-a1')
    expect(chan.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: 'coach_id=eq.c1' },
      handler,
    )
    expect(chan.subscribe).toHaveBeenCalledOnce()
    expect(result).toBe('sub-handle')
  })
})
