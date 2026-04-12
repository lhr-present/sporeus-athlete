// ─── db.js — Minimal IndexedDB wrapper (~40 lines, no Dexie) ─────────────────
// Store: pending_logs — offline wellness log inserts queued for retry.

const DB_NAME    = 'sporeus-offline'
const DB_VERSION = 1
const STORE      = 'pending_logs'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
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
    const req = store.add({ ...entry, _queuedAt: Date.now() })
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

export async function dequeue(id) {
  const db   = await openDB()
  const tx   = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  return new Promise((resolve, reject) => {
    const req = store.delete(id)
    req.onsuccess = () => resolve()
    req.onerror   = () => reject(req.error)
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
