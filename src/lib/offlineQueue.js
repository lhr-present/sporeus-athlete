// ─── offlineQueue.js — Offline submission queue + sync status ─────────────────
// When a Supabase insert fails due to network error, entries are saved to
// IndexedDB (db.js). On app load and navigator.onLine events, the queue is
// flushed in order.
//
// Sync status: 'offline' | 'syncing' | 'synced'
// Exported: enqueuePendingLog, flushQueue, getSyncStatus, onSyncStatusChange

import { enqueue, dequeue, getAll } from './db.js'
import { supabase, isSupabaseReady } from './supabase.js'

let _status    = 'synced'
let _listeners = []

// ─── Status management ─────────────────────────────────────────────────────────
function setStatus(s) {
  if (_status === s) return
  _status = s
  _listeners.forEach(fn => fn(s))
}

export function getSyncStatus() { return _status }

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
    console.warn('[offlineQueue] enqueue failed:', e)
  }
}

// ─── Flush queue (retry all pending entries in insertion order) ────────────────
export async function flushQueue() {
  if (!isSupabaseReady()) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) { setStatus('offline'); return }

  const pending = await getAll()
  if (pending.length === 0) { setStatus('synced'); return }

  setStatus('syncing')

  let allOk = true
  for (const row of pending) {
    const { id, _queuedAt, ...entry } = row  // strip internal fields
    try {
      const { error } = await supabase
        .from('athlete_training_log')
        .upsert(entry, { onConflict: 'id' })
      if (!error) {
        await dequeue(id)
      } else {
        allOk = false
        break  // stop on first error — preserve order
      }
    } catch {
      allOk = false
      break
    }
  }

  setStatus(allOk ? 'synced' : 'offline')
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
