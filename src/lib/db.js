// ─── db.js — Minimal IndexedDB wrapper (~40 lines, no Dexie) ─────────────────
// Store: pending_logs — offline wellness log inserts queued for retry.
//
// IMPORTANT: this module and src/lib/offline/writeQueue.js BOTH open the same
// 'sporeus-offline' database. They must declare the SAME DB_VERSION, and every
// onupgradeneeded handler must create EVERY store — because whichever module
// opens the DB first at a new version runs the only upgrade transaction; if it
// knows about fewer stores than the other, the missing store is never created
// and the other module throws on access. (Previously db.js was v1 / writeQueue
// v2, so opening order decided whether you hit a VersionError and the offline
// queue silently broke.) Keep this handler in sync with writeQueue.js.
// v3 added the 'dead_letter' store (poison writes parked out of the active queue).

const DB_NAME            = 'sporeus-offline'
const DB_VERSION         = 3
const STORE              = 'pending_logs'
const QUEUE_STORE        = 'write_queue'   // owned by writeQueue.js — created here too so order can't matter
const DEAD_LETTER_STORE  = 'dead_letter'   // owned by writeQueue.js — created here too so order can't matter

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const store = db.createObjectStore(QUEUE_STORE, { keyPath: 'id', autoIncrement: true })
        store.createIndex('by_table', 'table', { unique: false })
        store.createIndex('by_queued', '_queuedAt', { unique: false })
      }
      if (!db.objectStoreNames.contains(DEAD_LETTER_STORE)) {
        db.createObjectStore(DEAD_LETTER_STORE, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = e => resolve(e.target.result)
    req.onerror   = e => reject(e.target.error)
  })
}

export async function enqueue(entry) {
  const db   = await openDB()
  const tx   = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  return new Promise((resolve, reject) => {
    let newKey
    const req = store.add({ ...entry, _queuedAt: Date.now() })
    req.onsuccess = () => { newKey = req.result }
    // Resolve only when the transaction durably commits (a later abort must not look like success).
    tx.oncomplete = () => resolve(newKey)
    tx.onerror    = () => reject(tx.error)
    tx.onabort    = () => reject(tx.error)
  })
}

export async function dequeue(id) {
  const db   = await openDB()
  const tx   = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  return new Promise((resolve, reject) => {
    store.delete(id)
    // Resolve only when the delete durably commits — otherwise a flushed item could reappear.
    tx.oncomplete = () => resolve()
    tx.onerror    = () => reject(tx.error)
    tx.onabort    = () => reject(tx.error)
  })
}

export async function getAll() {
  const db   = await openDB()
  const tx   = db.transaction(STORE, 'readonly')
  const store = tx.objectStore(STORE)
  return new Promise((resolve, reject) => {
    const req = store.getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror   = () => reject(req.error)
  })
}

export async function clearAll() {
  const db   = await openDB()
  const tx   = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  return new Promise((resolve, reject) => {
    const req = store.clear()
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
  })
}
