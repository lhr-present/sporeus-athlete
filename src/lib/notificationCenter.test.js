import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  addNotification,
  getNotifications,
  markRead,
  markAllRead,
  clearAll,
  getUnreadCount,
} from './notificationCenter.js'

// ─── localStorage mock for Node environment ───────────────────────────────────
const store = {}
const localStorageMock = {
  getItem:    k => store[k] ?? null,
  setItem:    (k, v) => { store[k] = String(v) },
  removeItem: k => { delete store[k] },
  clear:      () => { Object.keys(store).forEach(k => delete store[k]) },
}
vi.stubGlobal('localStorage', localStorageMock)

const KEY = 'sporeus-notifications'

beforeEach(() => {
  localStorage.clear()
})

describe('addNotification', () => {
  it('stores a notification with correct fields', () => {
    const n = addNotification('analytics', 'AI Insight', 'Your CTL is 72', { tab: 'dashboard' })
    expect(n.type).toBe('analytics')
    expect(n.title).toBe('AI Insight')
    expect(n.body).toBe('Your CTL is 72')
    expect(n.read).toBe(false)
    expect(typeof n.id).toBe('string')
    expect(typeof n.createdAt).toBe('string')
  })

  it('persists to localStorage', () => {
    addNotification('training', 'Session logged', 'TSS 95 added')
    const raw = JSON.parse(localStorage.getItem(KEY))
    expect(raw).toHaveLength(1)
    expect(raw[0].title).toBe('Session logged')
  })
})

describe('getNotifications', () => {
  it('returns newest first', () => {
    addNotification('training', 'First', '')
    addNotification('analytics', 'Second', '')
    addNotification('warning', 'Third', '')
    const items = getNotifications()
    expect(items[0].title).toBe('Third')
    expect(items[1].title).toBe('Second')
    expect(items[2].title).toBe('First')
  })

  it('returns empty array when nothing stored', () => {
    expect(getNotifications()).toEqual([])
  })
})

describe('50-entry cap', () => {
  it('caps at 50 entries and drops the oldest', () => {
    for (let i = 0; i < 51; i++) addNotification('training', `n${i}`, '')
    const items = getNotifications()
    expect(items).toHaveLength(50)
    // n50 is newest (index 0); n0 is oldest and should be gone
    expect(items[0].title).toBe('n50')
    expect(items.find(n => n.title === 'n0')).toBeUndefined()
  })
})

describe('markRead', () => {
  it('marks only the targeted notification as read', () => {
    addNotification('analytics', 'A', '')
    addNotification('analytics', 'B', '')
    const [b, a] = getNotifications()   // newest first
    markRead(a.id)
    const updated = getNotifications()
    expect(updated.find(n => n.id === a.id).read).toBe(true)
    expect(updated.find(n => n.id === b.id).read).toBe(false)
  })
})

describe('markAllRead', () => {
  it('sets all notifications to read', () => {
    addNotification('training', 'X', '')
    addNotification('coach', 'Y', '')
    markAllRead()
    const items = getNotifications()
    expect(items.every(n => n.read)).toBe(true)
  })
})

describe('getUnreadCount', () => {
  it('returns correct unread count before and after markRead', () => {
    addNotification('warning', 'W1', '')
    addNotification('warning', 'W2', '')
    addNotification('warning', 'W3', '')
    expect(getUnreadCount()).toBe(3)
    const [first] = getNotifications()
    markRead(first.id)
    expect(getUnreadCount()).toBe(2)
  })

  it('returns 0 after markAllRead', () => {
    addNotification('analytics', 'A', '')
    addNotification('analytics', 'B', '')
    markAllRead()
    expect(getUnreadCount()).toBe(0)
  })
})

describe('clearAll', () => {
  it('empties the notification store', () => {
    addNotification('achievement', 'Milestone', '1000km')
    addNotification('coach', 'Note', 'Easy week')
    clearAll()
    expect(getNotifications()).toEqual([])
    expect(getUnreadCount()).toBe(0)
  })
})

describe('unique IDs', () => {
  it('generates unique IDs on rapid sequential calls', () => {
    for (let i = 0; i < 20; i++) addNotification('training', `t${i}`, '')
    const ids = getNotifications().map(n => n.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(ids.length)
  })
})
