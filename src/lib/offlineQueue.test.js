import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock db.js ───────────────────────────────────────────────────────────────
const _store = []
let   _idSeq = 1

vi.mock('./db.js', () => ({
  enqueue:  vi.fn(async entry => { const id = _idSeq++; _store.push({ id, ...entry }); return id }),
  dequeue:  vi.fn(async id    => { const i = _store.findIndex(r => r.id === id); if (i !== -1) _store.splice(i, 1) }),
  getAll:   vi.fn(async ()    => [..._store]),
  clearAll: vi.fn(async ()    => { _store.length = 0 }),
}))

// ─── Mock supabase.js ─────────────────────────────────────────────────────────
let _upsertError = null
vi.mock('./supabase.js', () => ({
  supabase: {
    from: () => ({
      upsert: vi.fn(async () => ({ error: _upsertError })),
    }),
  },
  isSupabaseReady: () => true,
}))

// ─── Mock write_queue (comment offline store) ─────────────────────────────────
// flushQueue now also drains this store via replayWrites (v9.388 wiring).
const wq = vi.hoisted(() => ({
  queuedWrites: 0,
  replayResult: { replayed: 0, failed: 0, skipped: 0 },
  replayWrites: vi.fn(),
}))
vi.mock('./offline/writeQueue.js', () => ({
  pendingWriteCount: vi.fn(async () => wq.queuedWrites),
  replayWrites: wq.replayWrites,
}))

import { enqueuePendingLog, flushQueue, getSyncStatus, onSyncStatusChange, isNetworkError, initOfflineSync, stopOfflineSync } from './offlineQueue.js'
import { enqueue, dequeue, getAll } from './db.js'

beforeEach(() => {
  _store.length = 0
  _idSeq = 1
  _upsertError = null
  vi.clearAllMocks()
  wq.queuedWrites = 0
  wq.replayResult = { replayed: 0, failed: 0, skipped: 0 }
  wq.replayWrites.mockImplementation(async () => wq.replayResult)
  // patch getAll mock to return fresh _store reference
  getAll.mockImplementation(async () => [..._store])
  enqueue.mockImplementation(async entry => { const id = _idSeq++; _store.push({ id, ...entry }); return id })
  dequeue.mockImplementation(async id => { const i = _store.findIndex(r => r.id === id); if (i !== -1) _store.splice(i, 1) })
})

// ─── Test 1: enqueuePendingLog saves entry to IndexedDB ───────────────────────
it('enqueuePendingLog saves entry to db', async () => {
  const entry = { date: '2026-04-12', tss: 80, type: 'Run' }
  await enqueuePendingLog(entry)
  expect(enqueue).toHaveBeenCalledWith(entry)
  expect(_store).toHaveLength(1)
  expect(_store[0].date).toBe('2026-04-12')
})

// ─── Test 2: flushQueue removes entries after successful upsert ───────────────
it('flushQueue dequeues entries on successful Supabase upsert', async () => {
  _store.push({ id: 1, date: '2026-04-12', tss: 80 })
  _store.push({ id: 2, date: '2026-04-11', tss: 60 })

  await flushQueue()

  expect(dequeue).toHaveBeenCalledWith(1)
  expect(dequeue).toHaveBeenCalledWith(2)
  expect(_store).toHaveLength(0)
})

// ─── Test 3: flushQueue keeps draining past a failed entry (v9.347.0) ──────────
// Pre-v9.347 this stopped on the first error, wedging every later entry behind
// one poison/failed row. Now it drains the rest and leaves only the failures.
it('flushQueue drains past a failed entry, leaving only the failed one queued', async () => {
  const { supabase } = await import('./supabase.js')
  supabase.from = vi.fn(() => ({
    // entry with tss 80 fails; the other succeeds
    upsert: vi.fn(async (entry) => ({ error: entry.tss === 80 ? { message: 'network failure' } : null })),
  }))

  _store.push({ id: 1, date: '2026-04-12', tss: 80 })  // fails
  _store.push({ id: 2, date: '2026-04-11', tss: 60 })  // succeeds

  await flushQueue()

  // The successful entry is dequeued even though an earlier one failed
  expect(dequeue).toHaveBeenCalledWith(2)
  expect(dequeue).not.toHaveBeenCalledWith(1)
  expect(_store).toHaveLength(1)
  expect(_store[0].id).toBe(1)
  expect(getSyncStatus()).toBe('offline')
})

// ─── Test 3b: per-table onConflict arbiter (v9.347.0 / audit #4) ──────────────
it('flushQueue dedups recovery on (user_id,date) and other tables on id', async () => {
  const conflicts = []
  const { supabase } = await import('./supabase.js')
  supabase.from = vi.fn((table) => ({
    upsert: vi.fn(async (_entry, opts) => { conflicts.push([table, opts?.onConflict]); return { error: null } }),
  }))

  _store.push({ id: 1, _table: 'recovery',     date: '2026-04-13', score: 80 })
  _store.push({ id: 2, _table: 'training_log', date: '2026-04-13', tss: 50 })

  await flushQueue()

  expect(conflicts).toContainEqual(['recovery', 'user_id,date'])
  expect(conflicts).toContainEqual(['training_log', 'id'])
})

// ─── Test 3c: delete tombstones replayed via delete().match() (v9.361.0) ──────
it('flushQueue replays a delete tombstone via delete().match() and dequeues', async () => {
  const calls = []
  const { supabase } = await import('./supabase.js')
  supabase.from = vi.fn((table) => ({
    delete: () => ({ match: async (key) => { calls.push([table, key]); return { error: null } } }),
    upsert: vi.fn(async () => ({ error: null })),
  }))

  _store.push({ id: 1, _queuedAt: Date.now(), _op: 'delete', _table: 'training_log', _key: { id: 'abc', user_id: 'u1' } })
  await flushQueue()

  expect(calls).toContainEqual(['training_log', { id: 'abc', user_id: 'u1' }])
  expect(dequeue).toHaveBeenCalledWith(1)
  expect(_store).toHaveLength(0)
})

// ─── Test 4: flushQueue sets status 'synced' when queue empty ─────────────────
it('flushQueue resolves synced status when nothing queued', async () => {
  const statuses = []
  const unsub = onSyncStatusChange(s => statuses.push(s))

  await flushQueue()

  unsub()
  // No 'syncing' event — jumped straight to synced (or stayed synced)
  expect(statuses.filter(s => s === 'syncing')).toHaveLength(0)
})

// ─── write_queue replay wiring (v9.388) ───────────────────────────────────────
it('flushQueue replays queued comment writes even when pending_logs is empty', async () => {
  wq.queuedWrites = 2
  wq.replayResult = { replayed: 2, failed: 0, skipped: 0 }
  await flushQueue()
  expect(wq.replayWrites).toHaveBeenCalledTimes(1)
  expect(getSyncStatus()).toBe('synced')
})

it('flushQueue stays offline when a comment write fails to replay', async () => {
  wq.queuedWrites = 1
  wq.replayResult = { replayed: 0, failed: 1, skipped: 0 }
  await flushQueue()
  expect(getSyncStatus()).toBe('offline')
})

// A poison entry that has exhausted MAX_ATTEMPTS is `skipped` by replayWrites and
// left in IndexedDB forever. flushQueue must NOT report 'synced' (green) while such
// dead writes exist — skipped surfaces as not-fully-synced.
it('flushQueue does NOT show synced when a comment write is skipped (exhausted attempts)', async () => {
  wq.queuedWrites = 1
  wq.replayResult = { replayed: 0, failed: 0, skipped: 1 }
  await flushQueue()
  expect(getSyncStatus()).not.toBe('synced')
  expect(getSyncStatus()).toBe('offline')
})

it('flushQueue does NOT call replayWrites when no comment writes are queued', async () => {
  await enqueuePendingLog({ date: '2026-04-12', tss: 80, _table: 'recovery' })
  await flushQueue()
  expect(wq.replayWrites).not.toHaveBeenCalled()
})

// ─── Test 5: onSyncStatusChange unsubscribe works ─────────────────────────────
it('onSyncStatusChange unsubscribe stops future notifications', async () => {
  const received = []
  const unsub = onSyncStatusChange(s => received.push(s))

  // Trigger a flush to get a 'synced' event (queue is empty at this point)
  await flushQueue()

  const countBefore = received.length

  // Unsubscribe, then trigger another flush
  unsub()
  await flushQueue()

  // No additional events after unsub
  expect(received.length).toBe(countBefore)
})

// ─── F3 new tests ─────────────────────────────────────────────────────────────

// Test 6: submit while offline → entry enqueued with correct _table
it('enqueuePendingLog persists _table metadata for routing', async () => {
  const entry = { date: '2026-04-13', score: 75, _table: 'wellness_logs' }
  await enqueuePendingLog(entry)
  expect(_store[0]._table).toBe('wellness_logs')
  expect(getSyncStatus()).toBe('offline')
})

// Test 7: flush routes to the correct table from _table field
it('flushQueue uses _table field to route to correct Supabase table', async () => {
  const calledTables = []
  const { supabase } = await import('./supabase.js')
  supabase.from = vi.fn(table => {
    calledTables.push(table)
    return { upsert: vi.fn(async () => ({ error: null })) }
  })

  _store.push({ id: 1, _queuedAt: Date.now(), _table: 'wellness_logs', date: '2026-04-13', score: 80 })
  await flushQueue()

  expect(calledTables).toContain('wellness_logs')
})

// ─── F2: additional flush triggers (visibilitychange / focus / interval) ──────
// flushQueue only replayed on the 'online' event + startup, so a transiently
// failed flush sat until the next online edge. initOfflineSync now also flushes
// on visibilitychange (visible), focus, and a low-frequency interval — all gated
// on navigator.onLine — and stopOfflineSync tears every one down.
// This test file runs in the 'node' environment (no DOM), so synthesise minimal
// EventTarget-backed window/document/navigator stubs for the F2 listener tests.
describe('initOfflineSync — extra flush triggers (F2)', () => {
  let winTarget, docTarget

  beforeEach(() => {
    winTarget = new EventTarget()
    docTarget = new EventTarget()
    docTarget.visibilityState = 'visible'
    vi.stubGlobal('window', winTarget)
    vi.stubGlobal('document', docTarget)
    vi.stubGlobal('navigator', { onLine: true })
  })

  afterEach(() => {
    stopOfflineSync()   // always tear down so listeners/intervals don't leak across tests
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('flushes on visibilitychange when the tab becomes visible (online)', async () => {
    initOfflineSync()                       // startup flush happens here
    await Promise.resolve()
    getAll.mockClear()

    // jsdom: visibilityState defaults to 'visible'
    document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve(); await Promise.resolve()

    expect(getAll).toHaveBeenCalled()
  })

  it('flushes on window focus (online)', async () => {
    initOfflineSync()
    await Promise.resolve()
    getAll.mockClear()

    window.dispatchEvent(new Event('focus'))
    await Promise.resolve(); await Promise.resolve()

    expect(getAll).toHaveBeenCalled()
  })

  it('registers a low-frequency interval and flushes when its callback runs (online)', async () => {
    const setSpy = vi.spyOn(globalThis, 'setInterval')
    initOfflineSync()
    await Promise.resolve()

    // An interval was registered…
    expect(setSpy).toHaveBeenCalled()
    const [cb, ms] = setSpy.mock.calls[setSpy.mock.calls.length - 1]
    expect(ms).toBe(60000)

    // …and firing its callback (online) triggers a flush.
    getAll.mockClear()
    cb()
    await Promise.resolve(); await Promise.resolve()
    expect(getAll).toHaveBeenCalled()
    setSpy.mockRestore()
  })

  it('the interval callback does NOT flush when offline', async () => {
    const setSpy = vi.spyOn(globalThis, 'setInterval')
    initOfflineSync()
    await Promise.resolve()
    const [cb] = setSpy.mock.calls[setSpy.mock.calls.length - 1]

    vi.stubGlobal('navigator', { onLine: false })
    getAll.mockClear()
    cb()
    await Promise.resolve(); await Promise.resolve()
    expect(getAll).not.toHaveBeenCalled()
    setSpy.mockRestore()
  })

  it('stopOfflineSync clears the interval and removes visibility/focus listeners (no leak)', async () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval')
    initOfflineSync()
    await Promise.resolve()
    stopOfflineSync()
    expect(clearSpy).toHaveBeenCalled()
    getAll.mockClear()

    // After teardown the DOM triggers no longer reach flushQueue.
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))
    await Promise.resolve(); await Promise.resolve()
    expect(getAll).not.toHaveBeenCalled()
    clearSpy.mockRestore()
  })

  it('does not stack duplicate listeners on a second initOfflineSync', async () => {
    initOfflineSync()
    initOfflineSync()   // guarded — should be a no-op
    await Promise.resolve()
    getAll.mockClear()

    window.dispatchEvent(new Event('focus'))
    await Promise.resolve(); await Promise.resolve()

    // Single registration → flushQueue runs, getAll called (idempotency means
    // the count just needs to be the single-trigger amount, not doubled).
    expect(getAll).toHaveBeenCalledTimes(1)
  })
})

// Test 8: isNetworkError — network vs validation error discrimination
describe('isNetworkError', () => {
  it('returns true for fetch failures', () => {
    expect(isNetworkError(new Error('Failed to fetch'))).toBe(true)
    expect(isNetworkError(new Error('network request failed'))).toBe(true)
  })

  it('returns false for server/validation errors', () => {
    expect(isNetworkError(new Error('duplicate key value violates unique constraint'))).toBe(false)
    expect(isNetworkError(new Error('invalid input syntax'))).toBe(false)
    expect(isNetworkError(null)).toBe(false)
    expect(isNetworkError(undefined)).toBe(false)
  })
})
