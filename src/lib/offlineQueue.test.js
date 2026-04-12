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

import { enqueuePendingLog, flushQueue, getSyncStatus, onSyncStatusChange, isNetworkError } from './offlineQueue.js'
import { enqueue, dequeue, getAll } from './db.js'

beforeEach(() => {
  _store.length = 0
  _idSeq = 1
  _upsertError = null
  vi.clearAllMocks()
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

// ─── Test 3: flushQueue stops on first Supabase error ─────────────────────────
it('flushQueue stops processing on Supabase error, leaves remaining entries', async () => {
  _store.push({ id: 1, date: '2026-04-12', tss: 80 })
  _store.push({ id: 2, date: '2026-04-11', tss: 60 })
  _upsertError = { message: 'network failure' }

  await flushQueue()

  // No entries should have been dequeued — first one failed
  expect(dequeue).not.toHaveBeenCalled()
  expect(_store).toHaveLength(2)
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
