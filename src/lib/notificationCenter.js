// ─── notificationCenter.js — In-app notification store (localStorage) ───────
// Replaces Telegram as the primary notification delivery channel.
// All notifications persist across sessions; max 50 entries, newest first.

const STORAGE_KEY = 'sporeus-notifications'
const MAX_ENTRIES = 50

// ── Internal helpers ──────────────────────────────────────────────────────────
function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

function save(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // QuotaExceededError — silently skip
  }
}

// ── addNotification ───────────────────────────────────────────────────────────
// type: 'training' | 'analytics' | 'warning' | 'achievement' | 'coach'
// Returns the new notification object.
export function addNotification(type, title, body, metadata = {}) {
  const items = load()
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const entry = {
    id,
    type:      type || 'analytics',
    title:     String(title || '').slice(0, 120),
    body:      String(body  || '').slice(0, 400),
    metadata,
    read:      false,
    createdAt: new Date().toISOString(),
  }
  const updated = [entry, ...items].slice(0, MAX_ENTRIES)
  save(updated)
  return entry
}

// ── getNotifications ──────────────────────────────────────────────────────────
// Returns array newest-first.
export function getNotifications() {
  return load()
}

// ── markRead ──────────────────────────────────────────────────────────────────
export function markRead(id) {
  const items = load().map(n => n.id === id ? { ...n, read: true } : n)
  save(items)
}

// ── markAllRead ───────────────────────────────────────────────────────────────
export function markAllRead() {
  const items = load().map(n => ({ ...n, read: true }))
  save(items)
}

// ── clearAll ──────────────────────────────────────────────────────────────────
export function clearAll() {
  save([])
}

// ── getUnreadCount ────────────────────────────────────────────────────────────
export function getUnreadCount() {
  return load().filter(n => !n.read).length
}
