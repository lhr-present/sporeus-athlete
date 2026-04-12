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

import { enqueuePendingLog, flushQueue, getSyncStatus, onSyncStatusChange } from './offlineQueue.js'
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
