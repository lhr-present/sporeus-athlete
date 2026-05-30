// ─── offlineQueue.js — Offline submission queue + sync status ─────────────────
// When a Supabase insert fails due to network error, entries are saved to
// IndexedDB (db.js). On app load and navigator.onLine events, the queue is
// flushed in order.
//
// Sync status: 'offline' | 'syncing' | 'synced'
// Exported: enqueuePendingLog, flushQueue, getSyncStatus, onSyncStatusChange

import { enqueue, dequeue, getAll } from './db.js'
import { supabase, isSupabaseReady } from './supabase.js'
import { logger } from './logger.js'

let _status    = 'synced'
let _listeners = []

// ─── Status management ─────────────────────────────────────────────────────────
function setStatus(s) {
  if (_status === s) return
  _status = s
  _listeners.forEach(fn => fn(s))
}

export function getSyncStatus() { return _status }

// Mark sync as offline from outside the queue (e.g. a background write in
// useSupabaseData failed). Idempotent via setStatus's equality guard.
export function markSyncOffline() { setStatus('offline') }

// Dedup target per table. Recovery rows have no `id` — their unique key is
// (user_id, date); everything else dedups on the row `id` PK. Replaying with
// the wrong arbiter throws unique_violation and wedges the queue.
const ONCONFLICT_BY_TABLE = {
  recovery: 'user_id,date',
}
function conflictFor(table) { return ONCONFLICT_BY_TABLE[table] || 'id' }

export function onSyncStatusChange(fn) {
  _listeners.push(fn)
  return () => { _listeners = _listeners.filter(l => l !== fn) }  // unsubscribe
}

// ─── Enqueue a failed log entry ────────────────────────────────────────────────
export async function enqueuePendingLog(entry) {
  try {
    await enqueue(entry)
    setStatus('offline')
  } catch (e) {
    logger.warn('[offlineQueue] enqueue failed:', e.message)
  }
}

// ─── Flush queue (retry all pending entries in insertion order) ────────────────
// Each entry may carry a `_table` field specifying its target table.
// Defaults to 'recovery' (the primary use case — daily wellness check-ins).
export async function flushQueue() {
  if (!isSupabaseReady()) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) { setStatus('offline'); return }

  const pending = await getAll()
  if (pending.length === 0) { setStatus('synced'); return }

  setStatus('syncing')

  let allOk = true
  for (const row of pending) {
    const { id, _queuedAt, _table, ...entry } = row  // strip internal queue metadata
    const table = _table || 'recovery'
    try {
      const { error } = await supabase
        .from(table)
        .upsert(entry, { onConflict: conflictFor(table) })
      if (!error) {
        await dequeue(id)
      } else {
        // Leave this row queued for the next flush, but keep draining the
        // rest — one poison/failed row must not block every other entry.
        allOk = false
      }
    } catch {
      allOk = false
    }
  }

  setStatus(allOk ? 'synced' : 'offline')
}

// ── isNetworkError — distinguish network failures from server/validation errors ─
export function isNetworkError(error) {
  if (!error) return false
  const msg = (error.message || '').toLowerCase()
  // Network errors: fetch failed, no connection, etc.
  return msg.includes('failed to fetch') || msg.includes('network') ||
         msg.includes('offline') || msg.includes('connection') ||
         (typeof error.code === 'number' && error.code === 0) ||
         (typeof navigator !== 'undefined' && !navigator.onLine)
}

// ─── Wire navigator.onLine events (call once on app start) ────────────────────
export function initOfflineSync() {
  if (typeof window === 'undefined') return

  const handleOnline  = () => flushQueue()
  const handleOffline = () => setStatus('offline')

  window.addEventListener('online',  handleOnline)
  window.addEventListener('offline', handleOffline)

  if (!navigator.onLine) setStatus('offline')

  // Flush on startup in case there are queued entries from a prior session
  flushQueue()
}
