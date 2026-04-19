// src/lib/__tests__/offline/writeQueue.test.js — E4
// Write queue: enqueue, count, replay, dequeue, mark-failed
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { enqueueWrite, getPendingWrites, pendingWriteCount, replayWrites } from '../../offline/writeQueue.js'

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
  const db = {
    objectStoreNames: { contains: (n) => ['pending_logs', 'write_queue'].includes(n) },
    transaction(store, _mode) {
      const s = store === 'write_queue' ? makeStore(write_queue) : makeStore(pending_logs)
      return { objectStore: () => s }
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
  return { write_queue }
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

  it('replayWrites skips entries that exceeded MAX_ATTEMPTS', async () => {
    storeRef.write_queue.push({ id: 77, op: 'insert', table: 'training_log', payload: {}, _queuedAt: 1000, _attempts: 3, _lastError: 'prior error' })
    const mockSupabase = { from: vi.fn() }
    const result = await replayWrites(mockSupabase)
    expect(result.skipped).toBe(1)
    expect(mockSupabase.from).not.toHaveBeenCalled()
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
