// src/lib/__tests__/offline/writeQueue.test.js — E4
// Write queue: enqueue, count, replay, dequeue, mark-failed
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { enqueueWrite, getPendingWrites, pendingWriteCount, replayWrites, getDeadLetterCount } from '../../offline/writeQueue.js'

// ─── Minimal IDB mock ─────────────────────────────────────────────────────────
// Uses Object.defineProperty setters so onsuccess fires after assignment (mimics
// how the real IDB event model works with async callbacks).

function asyncReq(resultFn) {
  const req = {}
  Object.defineProperty(req, 'onsuccess', {
    set(fn) { if (fn) { req.result = resultFn(); setTimeout(() => fn({ target: req }), 0) } },
    get() { return null }, configurable: true,
  })
  Object.defineProperty(req, 'onerror', {
    set() {}, get() { return null }, configurable: true,
  })
  return req
}

function makeStore(records) {
  return {
    add(item) {
      const id = Date.now() + Math.random()
      records.push({ ...item, id })
      return asyncReq(() => id)
    },
    count() { return asyncReq(() => records.length) },
    getAll() { return asyncReq(() => [...records]) },
    delete(id) { const i = records.findIndex(r => r.id === id); if (i >= 0) records.splice(i, 1); return asyncReq(() => undefined) },
    get(id) { return asyncReq(() => records.find(r => r.id === id)) },
    put(item) { const i = records.findIndex(r => r.id === item.id); if (i >= 0) records[i] = item; else records.push(item); return asyncReq(() => undefined) },
    createIndex() {},
  }
}

function mockIDB() {
  const pending_logs = []
  const write_queue = []
  const dead_letter = []
  const tables = { pending_logs, write_queue, dead_letter }
  const db = {
    objectStoreNames: { contains: (n) => ['pending_logs', 'write_queue', 'dead_letter'].includes(n) },
    transaction(store, _mode) {
      // store may be a single name or an array of names (multi-store tx).
      const names = Array.isArray(store) ? store : [store]
      const stores = {}
      for (const n of names) stores[n] = makeStore(tables[n] || pending_logs)
      const tx = {
        objectStore: (name) => stores[name] || makeStore(tables[name] || pending_logs),
      }
      // Fire oncomplete on the next tick so callers awaiting tx.oncomplete resolve.
      Object.defineProperty(tx, 'oncomplete', {
        set(fn) { if (fn) setTimeout(fn, 0) }, get() { return null }, configurable: true,
      })
      Object.defineProperty(tx, 'onerror', { set() {}, get() { return null }, configurable: true })
      Object.defineProperty(tx, 'onabort', { set() {}, get() { return null }, configurable: true })
      return tx
    }
  }
  vi.stubGlobal('indexedDB', {
    open: () => {
      const r = {}
      Object.defineProperty(r, 'onsuccess', {
        set(fn) { if (fn) { r.result = db; setTimeout(() => fn({ target: r }), 0) } },
        get() { return null }, configurable: true,
      })
      Object.defineProperty(r, 'onupgradeneeded', { set() {}, get() { return null }, configurable: true })
      Object.defineProperty(r, 'onerror', { set() {}, get() { return null }, configurable: true })
      Object.defineProperty(r, 'onblocked', { set() {}, get() { return null }, configurable: true })
      return r
    }
  })
  return { write_queue, dead_letter }
}

describe('writeQueue', () => {
  let storeRef

  beforeEach(() => {
    storeRef = mockIDB()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('enqueueWrite adds an entry with expected shape', async () => {
    await enqueueWrite('insert', 'training_log', { id: 'abc', tss: 80 })
    expect(storeRef.write_queue).toHaveLength(1)
    const entry = storeRef.write_queue[0]
    expect(entry.op).toBe('insert')
    expect(entry.table).toBe('training_log')
    expect(entry.payload.id).toBe('abc')
    expect(entry._attempts).toBe(0)
    expect(typeof entry._queuedAt).toBe('number')
  })

  it('pendingWriteCount returns queue length', async () => {
    await enqueueWrite('insert', 'training_log', { id: 'x1' })
    await enqueueWrite('delete', 'training_log', { id: 'x2' })
    const n = await pendingWriteCount()
    expect(n).toBe(2)
  })

  it('getPendingWrites returns entries sorted oldest first', async () => {
    // Manually seed two entries with known timestamps
    storeRef.write_queue.push({ id: 2, op: 'insert', table: 'training_log', payload: {}, _queuedAt: 2000, _attempts: 0 })
    storeRef.write_queue.push({ id: 1, op: 'insert', table: 'training_log', payload: {}, _queuedAt: 1000, _attempts: 0 })
    const all = await getPendingWrites()
    expect(all[0]._queuedAt).toBe(1000)
    expect(all[1]._queuedAt).toBe(2000)
  })

  it('replayWrites calls supabase insert and dequeues on success', async () => {
    storeRef.write_queue.push({ id: 99, op: 'insert', table: 'training_log', payload: { id: 'row1', tss: 80 }, _queuedAt: 1000, _attempts: 0, _lastError: null })
    const mockSupabase = {
      from: vi.fn(() => ({
        // payload carries an id → replay routes through upsert (F3 idempotent insert)
        upsert: vi.fn(() => Promise.resolve({ error: null })),
        insert: vi.fn(() => Promise.resolve({ error: null })),
        update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
        delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
      }))
    }
    const result = await replayWrites(mockSupabase)
    expect(result.replayed).toBe(1)
    expect(result.failed).toBe(0)
    expect(storeRef.write_queue).toHaveLength(0)
  })

  it('replayWrites marks failed and does not dequeue on supabase error', async () => {
    storeRef.write_queue.push({ id: 88, op: 'insert', table: 'training_log', payload: { id: 'row2' }, _queuedAt: 1000, _attempts: 0, _lastError: null })
    const mockSupabase = {
      from: vi.fn(() => ({
        upsert: vi.fn(() => Promise.resolve({ error: { message: 'network error' } })),
        insert: vi.fn(() => Promise.resolve({ error: { message: 'network error' } })),
        update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
        delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
      }))
    }
    const result = await replayWrites(mockSupabase)
    expect(result.failed).toBe(1)
    expect(result.replayed).toBe(0)
    // Entry still in queue with incremented _attempts
    expect(storeRef.write_queue[0]._attempts).toBe(1)
    expect(storeRef.write_queue[0]._lastError).toBe('network error')
  })

  it('replayWrites dead-letters entries that exceeded MAX_ATTEMPTS and drains the active queue', async () => {
    storeRef.write_queue.push({ id: 77, op: 'insert', table: 'training_log', payload: {}, _queuedAt: 1000, _attempts: 3, _lastError: 'prior error' })
    const mockSupabase = { from: vi.fn() }
    const result = await replayWrites(mockSupabase)
    expect(result.skipped).toBe(1)
    expect(mockSupabase.from).not.toHaveBeenCalled()
    // Poison entry must be removed from the active queue so it can drain to synced …
    expect(storeRef.write_queue).toHaveLength(0)
    // … and parked in the dead-letter store with a timestamp.
    expect(storeRef.dead_letter).toHaveLength(1)
    expect(storeRef.dead_letter[0].id).toBe(77)
    expect(typeof storeRef.dead_letter[0]._deadLetteredAt).toBe('number')
    // getDeadLetterCount surfaces it for the UI.
    const dlCount = await getDeadLetterCount()
    expect(dlCount).toBe(1)
  })

  it('a poison entry does not block a healthy entry from replaying, leaving the active queue empty', async () => {
    storeRef.write_queue.push({ id: 77, op: 'insert', table: 'training_log', payload: {}, _queuedAt: 1000, _attempts: 3, _lastError: 'prior error' })
    storeRef.write_queue.push({ id: 78, op: 'insert', table: 'training_log', payload: { id: 'good' }, _queuedAt: 2000, _attempts: 0, _lastError: null })
    const mockSupabase = {
      from: vi.fn(() => ({
        upsert: vi.fn(() => Promise.resolve({ error: null })),
        insert: vi.fn(() => Promise.resolve({ error: null })),
      }))
    }
    const result = await replayWrites(mockSupabase)
    expect(result.replayed).toBe(1)
    expect(result.skipped).toBe(1)
    // Active queue fully drained: healthy replayed, poison dead-lettered.
    expect(storeRef.write_queue).toHaveLength(0)
    expect(storeRef.dead_letter).toHaveLength(1)
  })

  // ─── F3: idempotent insert replay (upsert-on-id) ────────────────────────────
  it('replayWrites uses upsert(onConflict:id, ignoreDuplicates) for an insert WITH an id', async () => {
    storeRef.write_queue.push({ id: 42, op: 'insert', table: 'session_comments', payload: { id: 'uuid-1', body: 'hi' }, _queuedAt: 1000, _attempts: 0, _lastError: null })
    let upsertArgs = null
    const insertFn = vi.fn(() => Promise.resolve({ error: null }))
    const mockSupabase = {
      from: vi.fn(() => ({
        upsert: vi.fn((payload, opts) => { upsertArgs = { payload, opts }; return Promise.resolve({ error: null }) }),
        insert: insertFn,
      }))
    }
    const result = await replayWrites(mockSupabase)
    expect(result.replayed).toBe(1)
    expect(insertFn).not.toHaveBeenCalled()
    expect(upsertArgs.opts).toMatchObject({ onConflict: 'id', ignoreDuplicates: true })
    expect(storeRef.write_queue).toHaveLength(0)
  })

  it('replayWrites: a re-applied insert is a no-op success when the row already committed (no phantom failure)', async () => {
    // Row landed server-side but local dequeue failed → entry still queued.
    // ignoreDuplicates upsert returns no error → dequeued, not dead-lettered.
    storeRef.write_queue.push({ id: 43, op: 'insert', table: 'session_comments', payload: { id: 'dup-uuid', body: 'already there' }, _queuedAt: 1000, _attempts: 0, _lastError: null })
    const mockSupabase = {
      from: vi.fn(() => ({
        // Postgres returns no rows + no error for ignoreDuplicates on conflict.
        upsert: vi.fn(() => Promise.resolve({ data: [], error: null })),
        insert: vi.fn(() => Promise.resolve({ error: { message: 'duplicate key value violates unique constraint' } })),
      }))
    }
    const result = await replayWrites(mockSupabase)
    expect(result.replayed).toBe(1)
    expect(result.failed).toBe(0)
    expect(storeRef.write_queue).toHaveLength(0)
    expect(storeRef.dead_letter).toHaveLength(0)
  })

  it('replayWrites keeps plain .insert() for an insert WITHOUT an id', async () => {
    storeRef.write_queue.push({ id: 44, op: 'insert', table: 'training_log', payload: { tss: 80 }, _queuedAt: 1000, _attempts: 0, _lastError: null })
    const upsertFn = vi.fn(() => Promise.resolve({ error: null }))
    const insertFn = vi.fn(() => Promise.resolve({ error: null }))
    const mockSupabase = {
      from: vi.fn(() => ({ upsert: upsertFn, insert: insertFn }))
    }
    const result = await replayWrites(mockSupabase)
    expect(result.replayed).toBe(1)
    expect(insertFn).toHaveBeenCalledTimes(1)
    expect(upsertFn).not.toHaveBeenCalled()
  })

  it('replayWrites calls onProgress callback', async () => {
    storeRef.write_queue.push({ id: 55, op: 'delete', table: 'training_log', payload: { id: 'del1' }, _queuedAt: 1000, _attempts: 0, _lastError: null })
    const mockSupabase = {
      from: vi.fn(() => ({
        delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: null })) })),
      }))
    }
    const progress = []
    await replayWrites(mockSupabase, p => progress.push({ ...p }))
    expect(progress).toHaveLength(1)
    expect(progress[0].replayed).toBe(1)
  })
})
