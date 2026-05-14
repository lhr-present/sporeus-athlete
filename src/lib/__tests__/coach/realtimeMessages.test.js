// src/lib/__tests__/coach/realtimeMessages.test.js
// v9.133 — Unit tests for realtimeMessages.js (mocked Supabase + writeQueue).

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockEnqueue = vi.fn(() => Promise.resolve(1))

vi.mock('../../offline/writeQueue.js', () => ({
  enqueueWrite: mockEnqueue,
}))

// Supabase chain builder — thenable so awaits resolve, single() for the
// .insert().select().single() path.
function makeChain(returnVal, terminalKey = 'then') {
  const chain = {
    from:    vi.fn(() => chain),
    insert:  vi.fn(() => chain),
    update:  vi.fn(() => chain),
    upsert:  vi.fn(() => chain),
    delete:  vi.fn(() => chain),
    select:  vi.fn(() => chain),
    single:  vi.fn(() => Promise.resolve(returnVal)),
    eq:      vi.fn(() => chain),
    in:      vi.fn(() => chain),
    is:      vi.fn(() => chain),
    order:   vi.fn(() => chain),
    limit:   vi.fn(() => chain),
  }
  chain.then = (resolve) => resolve(returnVal)
  if (terminalKey === 'single') {
    chain.single = vi.fn(() => Promise.resolve(returnVal))
  }
  return chain
}

const { fetchMessages, sendMessage, markReadByIds, countUnread, __MAX_BODY } =
  await import('../../coach/realtimeMessages.js')

// ── fetchMessages ─────────────────────────────────────────────────────────────

describe('fetchMessages', () => {
  it('returns error when supabase/coachId/athleteId missing', async () => {
    const { error } = await fetchMessages(null, 'c1', 'a1')
    expect(error).toBeTruthy()
    const r2 = await fetchMessages({}, '', 'a1')
    expect(r2.error).toBeTruthy()
  })

  it('queries DESC + limit, returns chronological (oldest first)', async () => {
    const desc = [
      { id: 'm3', created_at: '2026-01-03T00:00:00Z' },
      { id: 'm2', created_at: '2026-01-02T00:00:00Z' },
      { id: 'm1', created_at: '2026-01-01T00:00:00Z' },
    ]
    const sb = makeChain({ data: desc, error: null })
    const { data, error } = await fetchMessages(sb, 'c1', 'a1', 50)
    expect(error).toBeNull()
    expect(data.map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
    expect(sb.from).toHaveBeenCalledWith('coach_messages')
    expect(sb.limit).toHaveBeenCalledWith(50)
    expect(sb.order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  it('returns [] on supabase error', async () => {
    const sb = makeChain({ data: null, error: new Error('boom') })
    const { data, error } = await fetchMessages(sb, 'c1', 'a1')
    expect(data).toEqual([])
    expect(error).toBeTruthy()
  })

  it('returns [] when supabase returns null data', async () => {
    const sb = makeChain({ data: null, error: null })
    const { data, error } = await fetchMessages(sb, 'c1', 'a1')
    expect(data).toEqual([])
    expect(error).toBeNull()
  })

  it('defaults to limit 100', async () => {
    const sb = makeChain({ data: [], error: null })
    await fetchMessages(sb, 'c1', 'a1')
    expect(sb.limit).toHaveBeenCalledWith(100)
  })
})

// ── sendMessage — validation ──────────────────────────────────────────────────

describe('sendMessage — validation', () => {
  it('rejects missing identifiers', async () => {
    const { error } = await sendMessage(null, 'c1', 'a1', 'coach', 'hi')
    expect(error).toBeTruthy()
    const r2 = await sendMessage({}, '', 'a1', 'coach', 'hi')
    expect(r2.error).toBeTruthy()
  })

  it('rejects bad sender value', async () => {
    const sb = makeChain({ data: null, error: null })
    const { error } = await sendMessage(sb, 'c1', 'a1', 'admin', 'hi')
    expect(error.message).toMatch(/sender/)
  })

  it('rejects empty body', async () => {
    const sb = makeChain({ data: null, error: null })
    const { error } = await sendMessage(sb, 'c1', 'a1', 'coach', '   ')
    expect(error.message).toMatch(/1.4000/)
  })

  it('rejects oversize body', async () => {
    const sb = makeChain({ data: null, error: null })
    const huge = 'x'.repeat(__MAX_BODY + 1)
    const { error } = await sendMessage(sb, 'c1', 'a1', 'coach', huge)
    expect(error).toBeTruthy()
  })

  it('trims whitespace before insert', async () => {
    const inserted = { id: 'm1', body: 'hello' }
    const sb = makeChain({ data: inserted, error: null })
    const { data, error } = await sendMessage(sb, 'c1', 'a1', 'coach', '  hello  ')
    expect(error).toBeNull()
    expect(data).toBeTruthy()
    expect(sb.insert).toHaveBeenCalledWith(expect.objectContaining({
      coach_id:   'c1',
      athlete_id: 'a1',
      sender:     'coach',
      body:       'hello',
    }))
  })
})

// ── sendMessage — offline queue ───────────────────────────────────────────────

describe('sendMessage — offline queue', () => {
  beforeEach(() => { mockEnqueue.mockClear() })

  it('enqueues write on Failed to fetch', async () => {
    const sb = makeChain({ data: null, error: new Error('Failed to fetch') })
    const { queued, error } = await sendMessage(sb, 'c1', 'a1', 'athlete', 'hi')
    expect(queued).toBe(true)
    expect(error).toBeNull()
    expect(mockEnqueue).toHaveBeenCalledWith('insert', 'coach_messages', expect.objectContaining({
      coach_id:   'c1',
      athlete_id: 'a1',
      sender:     'athlete',
      body:       'hi',
    }))
  })

  it('enqueues write when thrown error is offline-shaped', async () => {
    const sb = {
      from: vi.fn(() => {
        throw new Error('NetworkError when attempting to fetch')
      }),
    }
    const { queued } = await sendMessage(sb, 'c1', 'a1', 'athlete', 'hi')
    expect(queued).toBe(true)
    expect(mockEnqueue).toHaveBeenCalled()
  })

  it('does not enqueue on a non-network error', async () => {
    const sb = makeChain({ data: null, error: new Error('row-level security policy') })
    const { queued, error } = await sendMessage(sb, 'c1', 'a1', 'coach', 'hi')
    expect(queued).toBe(false)
    expect(error).toBeTruthy()
    expect(mockEnqueue).not.toHaveBeenCalled()
  })
})

// ── markReadByIds ─────────────────────────────────────────────────────────────

describe('markReadByIds', () => {
  it('no-ops on empty input', async () => {
    const sb = makeChain({ data: [], error: null })
    const r = await markReadByIds(sb, [])
    expect(r.count).toBe(0)
    expect(r.error).toBeNull()
    expect(sb.from).not.toHaveBeenCalled()
  })

  it('no-ops when supabase missing', async () => {
    const r = await markReadByIds(null, ['m1'])
    expect(r.count).toBe(0)
    expect(r.error).toBeNull()
  })

  it('counts rows updated (only rows still unread)', async () => {
    const updated = [{ id: 'm1' }, { id: 'm2' }]
    const sb = makeChain({ data: updated, error: null })
    const r = await markReadByIds(sb, ['m1', 'm2', 'm3'])
    expect(r.count).toBe(2)
    expect(sb.update).toHaveBeenCalledWith(expect.objectContaining({
      read_at: expect.any(String),
    }))
    expect(sb.in).toHaveBeenCalledWith('id', ['m1', 'm2', 'm3'])
    expect(sb.is).toHaveBeenCalledWith('read_at', null)
  })

  it('surfaces supabase errors', async () => {
    const sb = makeChain({ data: null, error: new Error('rls') })
    const r = await markReadByIds(sb, ['m1'])
    expect(r.error).toBeTruthy()
    expect(r.count).toBe(0)
  })
})

// ── countUnread ───────────────────────────────────────────────────────────────

describe('countUnread', () => {
  it('errors when identifiers missing', async () => {
    const r = await countUnread(null, 'c1', 'a1', 'coach')
    expect(r.error).toBeTruthy()
  })

  it('errors on bad viewerSide', async () => {
    const sb = makeChain({ count: 0, error: null })
    const r = await countUnread(sb, 'c1', 'a1', 'spectator')
    expect(r.error.message).toMatch(/viewerSide/)
  })

  it('counts other-side unread when viewer is coach', async () => {
    const sb = makeChain({ count: 4, error: null })
    const r = await countUnread(sb, 'c1', 'a1', 'coach')
    expect(r.count).toBe(4)
    expect(sb.eq).toHaveBeenCalledWith('sender', 'athlete')
    expect(sb.is).toHaveBeenCalledWith('read_at', null)
  })

  it('counts other-side unread when viewer is athlete', async () => {
    const sb = makeChain({ count: 2, error: null })
    const r = await countUnread(sb, 'c1', 'a1', 'athlete')
    expect(r.count).toBe(2)
    expect(sb.eq).toHaveBeenCalledWith('sender', 'coach')
  })

  it('returns 0 when count is null', async () => {
    const sb = makeChain({ count: null, error: null })
    const r = await countUnread(sb, 'c1', 'a1', 'coach')
    expect(r.count).toBe(0)
  })
})
