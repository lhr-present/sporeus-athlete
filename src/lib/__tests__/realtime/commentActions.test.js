// src/lib/__tests__/realtime/commentActions.test.js
// E11 — Unit tests for commentActions.js (mocked Supabase + writeQueue).

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock write queue ──────────────────────────────────────────────────────────
const mockEnqueue = vi.fn(() => Promise.resolve(1))

vi.mock('../../offline/writeQueue.js', () => ({
  enqueueWrite: mockEnqueue,
}))

// ── Supabase chain builder ────────────────────────────────────────────────────
function makeChain(returnVal) {
  const chain = {
    from:    vi.fn(() => chain),
    insert:  vi.fn(() => chain),
    update:  vi.fn(() => chain),
    upsert:  vi.fn(() => chain),
    delete:  vi.fn(() => chain),
    select:  vi.fn(() => chain),
    single:  vi.fn(() => Promise.resolve(returnVal)),
    eq:      vi.fn(() => chain),
    order:   vi.fn(() => chain),
    maybeSingle: vi.fn(() => Promise.resolve(returnVal)),
  }
  // Make the chain thenable for cases without .single()
  chain.then = (resolve) => resolve(returnVal)
  return chain
}

const { postComment, editComment, deleteComment, recordSessionView, getSessionViews } =
  await import('../../realtime/commentActions.js')

// ── postComment ───────────────────────────────────────────────────────────────

describe('postComment — validation', () => {
  it('rejects empty body', async () => {
    const sb = makeChain({ data: null, error: null })
    const { error } = await postComment(sb, 's1', 'u1', '')
    expect(error).toBeTruthy()
    expect(error.message).toMatch(/1.2000/)
  })

  it('rejects body longer than 2000 chars', async () => {
    const sb = makeChain({ data: null, error: null })
    const longBody = 'x'.repeat(2001)
    const { error } = await postComment(sb, 's1', 'u1', longBody)
    expect(error).toBeTruthy()
  })

  it('trims body before inserting', async () => {
    const inserted = { id: 'c1', session_id: 's1', author_id: 'u1', body: 'hello' }
    const sb = makeChain({ data: inserted, error: null })
    const { data, error } = await postComment(sb, 's1', 'u1', '  hello  ')
    expect(error).toBeNull()
    expect(data).toBeTruthy()
  })
})

describe('postComment — offline queue', () => {
  beforeEach(() => { mockEnqueue.mockClear() })

  it('enqueues write when "Failed to fetch" error', async () => {
    const offlineError = new Error('Failed to fetch')
    const sb = makeChain({ data: null, error: offlineError })
    const { queued } = await postComment(sb, 's1', 'u1', 'hello')
    expect(queued).toBe(true)
    expect(mockEnqueue).toHaveBeenCalledWith('insert', 'session_comments', expect.objectContaining({
      session_id: 's1',
      author_id:  'u1',
      body:       'hello',
    }))
  })

  it('does not enqueue when Supabase returns data successfully', async () => {
    const inserted = { id: 'c1', session_id: 's1', author_id: 'u1', body: 'hello' }
    const sb = makeChain({ data: inserted, error: null })
    const { queued } = await postComment(sb, 's1', 'u1', 'hello')
    expect(queued).toBe(false)
    expect(mockEnqueue).not.toHaveBeenCalled()
  })
})

describe('postComment — parentId', () => {
  it('includes parent_id when provided', async () => {
    let captured = null
    const sb = {
      from: vi.fn(() => sb),
      insert: vi.fn(p => { captured = p; return sb }),
      select: vi.fn(() => sb),
      single: vi.fn(() => Promise.resolve({ data: { id: 'c2', ...captured }, error: null })),
    }
    await postComment(sb, 's1', 'u1', 'reply body', 'parent-123')
    expect(captured).toMatchObject({ parent_id: 'parent-123' })
  })

  it('omits parent_id when null', async () => {
    let captured = null
    const sb = {
      from: vi.fn(() => sb),
      insert: vi.fn(p => { captured = p; return sb }),
      select: vi.fn(() => sb),
      single: vi.fn(() => Promise.resolve({ data: { id: 'c3', ...captured }, error: null })),
    }
    await postComment(sb, 's1', 'u1', 'top-level')
    expect(captured).not.toHaveProperty('parent_id')
  })
})

// ── editComment ───────────────────────────────────────────────────────────────

describe('editComment', () => {
  it('rejects empty body', async () => {
    const sb = makeChain({ data: null, error: null })
    const { error } = await editComment(sb, 'c1', '')
    expect(error).toBeTruthy()
  })

  it('calls update with edited_at set', async () => {
    let updatePayload = null
    const sb = {
      from:   vi.fn(() => sb),
      update: vi.fn(p => { updatePayload = p; return sb }),
      eq:     vi.fn(() => sb),
      select: vi.fn(() => sb),
      single: vi.fn(() => Promise.resolve({ data: { id: 'c1' }, error: null })),
    }
    await editComment(sb, 'c1', 'updated text')
    expect(updatePayload).toMatchObject({ body: 'updated text' })
    expect(updatePayload.edited_at).toBeTruthy()
  })
})

// ── deleteComment ─────────────────────────────────────────────────────────────

describe('deleteComment', () => {
  it('sets deleted_at (soft delete)', async () => {
    let updatePayload = null
    const sb = {
      from:   vi.fn(() => sb),
      update: vi.fn(p => { updatePayload = p; return sb }),
      eq:     vi.fn(() => Promise.resolve({ error: null })),
    }
    await deleteComment(sb, 'c1')
    expect(updatePayload).toHaveProperty('deleted_at')
    expect(updatePayload.deleted_at).not.toBeNull()
  })

  it('does not call db.delete() — enforces soft-delete-only contract', async () => {
    const deleteFn = vi.fn()
    const sb = {
      from:   vi.fn(() => sb),
      update: vi.fn(() => sb),
      eq:     vi.fn(() => Promise.resolve({ error: null })),
      delete: deleteFn,
    }
    await deleteComment(sb, 'c1')
    expect(deleteFn).not.toHaveBeenCalled()
  })
})

// ── recordSessionView ─────────────────────────────────────────────────────────

describe('recordSessionView', () => {
  it('is a no-op for null sessionId', async () => {
    const sb = makeChain({ error: null })
    const result = await recordSessionView(sb, null, 'u1')
    expect(result).toEqual({ error: null })
    expect(sb.from).not.toHaveBeenCalled()
  })

  it('is a no-op for null userId', async () => {
    const sb = makeChain({ error: null })
    await recordSessionView(sb, 's1', null)
    expect(sb.from).not.toHaveBeenCalled()
  })

  it('upserts with correct onConflict clause', async () => {
    let upsertOpts = null
    const sb = {
      from:   vi.fn(() => sb),
      upsert: vi.fn((_p, opts) => { upsertOpts = opts; return Promise.resolve({ error: null }) }),
    }
    await recordSessionView(sb, 's1', 'u1')
    expect(upsertOpts).toMatchObject({ onConflict: 'user_id,session_id' })
  })

  it('swallows network errors gracefully', async () => {
    const sb = {
      from:   vi.fn(() => sb),
      upsert: vi.fn(() => { throw new Error('Failed to fetch') }),
    }
    const { error } = await recordSessionView(sb, 's1', 'u1')
    expect(error).toBeNull()
  })
})

// ── getSessionViews ───────────────────────────────────────────────────────────

describe('getSessionViews', () => {
  it('returns empty array on no data', async () => {
    const sb = makeChain({ data: null, error: null })
    const { data } = await getSessionViews(sb, 's1')
    expect(data).toEqual([])
  })

  it('returns sorted data when available', async () => {
    const rows = [
      { user_id: 'u1', viewed_at: '2026-04-19T11:00:00Z' },
      { user_id: 'u2', viewed_at: '2026-04-19T12:00:00Z' },
    ]
    const sb = {
      from:   vi.fn(() => sb),
      select: vi.fn(() => sb),
      eq:     vi.fn(() => sb),
      order:  vi.fn(() => Promise.resolve({ data: rows, error: null })),
    }
    const { data } = await getSessionViews(sb, 's1')
    expect(data).toHaveLength(2)
    expect(data[0].user_id).toBe('u1')
  })
})
