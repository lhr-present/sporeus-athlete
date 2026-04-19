// src/lib/offline/writeQueue.js — E4: Offline write queue with replay
//
// Captures every mutation when offline, replays on reconnect.
// Conflict strategy: last-write-wins (LWW) — the replayed payload is the
// authoritative value; server rejects are logged but don't crash the queue.
//
// Uses IndexedDB via the existing sporeus-offline DB, adding a new store.
// Stored entries: { id, op, table, payload, _queuedAt, _attempts, _lastError }
// ops: 'insert' | 'update' | 'delete'

const DB_NAME    = 'sporeus-offline'
const DB_VERSION = 2          // bump from v1 (adds write_queue store)
const QUEUE_STORE = 'write_queue'
const PENDING_STORE = 'pending_logs'   // existing store — keep for compatibility

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      const db = e.target.result
      // Preserve existing store
      if (!db.objectStoreNames.contains(PENDING_STORE)) {
        db.createObjectStore(PENDING_STORE, { keyPath: 'id', autoIncrement: true })
      }
      // New write queue store
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const store = db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true })
        store.createIndex('by_table', 'table', { unique: false })
        store.createIndex('by_queued', '_queuedAt', { unique: false })
      }
    }
    req.onsuccess  = e => resolve(e.target.result)
    req.onerror    = e => reject(e.target.error)
    req.onblocked  = ()  => reject(new Error('IDB blocked — close other tabs'))
  })
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Enqueue a mutation for offline replay.
 * @param {'insert'|'update'|'delete'} op
 * @param {string} table  - e.g. 'training_log', 'recovery_log'
 * @param {Object} payload - full row for insert/update; { id } for delete
 * @returns {Promise<number>} - IDB key of the queued entry
 */
export async function enqueueWrite(op, table, payload) {
  const db = await openDB()
  const tx = db.transaction(QUEUE_STORE, 'readwrite')
  const store = tx.objectStore(QUEUE_STORE)
  return new Promise((resolve, reject) => {
    const req = store.add({
      op,
      table,
      payload,
      _queuedAt: Date.now(),
      _attempts: 0,
      _lastError: null,
    })
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

/**
 * Return all pending writes, oldest first.
 * @returns {Promise<Array>}
 */
export async function getPendingWrites() {
  const db = await openDB()
  const tx = db.transaction(QUEUE_STORE, 'readonly')
  const store = tx.objectStore(QUEUE_STORE)
  return new Promise((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => resolve((req.result || []).sort((a, b) => a._queuedAt - b._queuedAt))
    req.onerror   = () => reject(req.error)
  })
}

/** Count pending writes — used for the offline indicator. */
export async function pendingWriteCount() {
  const db = await openDB()
  const tx = db.transaction(QUEUE_STORE, 'readonly')
  const store = tx.objectStore(QUEUE_STORE)
  return new Promise((resolve, reject) => {
    const req = store.count()
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

/** Remove a successfully replayed entry. */
async function dequeueWrite(id) {
  const db = await openDB()
  const tx = db.transaction(QUEUE_STORE, 'readwrite')
  const store = tx.objectStore(QUEUE_STORE)
  return new Promise((resolve, reject) => {
    const req = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}

/** Mark an entry as failed (increments attempts, records error). */
async function markFailed(id, errorMsg) {
  const db = await openDB()
  const tx = db.transaction(QUEUE_STORE, 'readwrite')
  const store = tx.objectStore(QUEUE_STORE)
  return new Promise((resolve, reject) => {
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const entry = getReq.result
      if (!entry) return resolve()
      entry._attempts++
      entry._lastError = errorMsg
      const putReq = store.put(entry)
      putReq.onsuccess = () => resolve()
      putReq.onerror   = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

// ─── Replay ───────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 3

/**
 * Replay all pending writes against a supabase client.
 * Called when connectivity is restored (OfflineBanner / online event).
 *
 * @param {Object} supabase  - supabase-js client
 * @param {Function} [onProgress]  - called with { replayed, failed, skipped } after each entry
 * @returns {Promise<{ replayed: number, failed: number, skipped: number }>}
 */
export async function replayWrites(supabase, onProgress) {
  const pending = await getPendingWrites()
  let replayed = 0, failed = 0, skipped = 0

  for (const entry of pending) {
    if (entry._attempts >= MAX_ATTEMPTS) {
      skipped++
      onProgress?.({ replayed, failed, skipped })
      continue
    }

    try {
      let error = null

      if (entry.op === 'insert') {
        const res = await supabase.from(entry.table).insert(entry.payload)
        error = res.error
      } else if (entry.op === 'update') {
        const { id, ...rest } = entry.payload
        const res = await supabase.from(entry.table).update(rest).eq('id', id)
        error = res.error
      } else if (entry.op === 'delete') {
        const res = await supabase.from(entry.table).delete().eq('id', entry.payload.id)
        error = res.error
      }

      if (error) {
        await markFailed(entry.id, error.message)
        failed++
      } else {
        await dequeueWrite(entry.id)
        replayed++
      }
    } catch (err) {
      await markFailed(entry.id, err.message)
      failed++
    }

    onProgress?.({ replayed, failed, skipped })
  }

  return { replayed, failed, skipped }
}
