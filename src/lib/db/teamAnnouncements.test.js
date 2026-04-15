import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  markLocalRead, markAllLocalRead, filterUnread,
} from './teamAnnouncements.js'

// ─── localStorage mock ────────────────────────────────────────────────────────
const store = {}
const localStorageMock = {
  getItem:    k => store[k] ?? null,
  setItem:    (k, v) => { store[k] = String(v) },
  removeItem: k => { delete store[k] },
  clear:      () => { Object.keys(store).forEach(k => delete store[k]) },
}
vi.stubGlobal('localStorage', localStorageMock)

// Mock supabase so we never hit the network
vi.mock('../supabase.js', () => ({
  isSupabaseReady: () => false,
  supabase: null,
}))

const makeAnn = (id, message = 'Hello squad') => ({ id, message, created_at: new Date().toISOString(), coach_id: 'coach-1' })

beforeEach(() => localStorage.clear())

describe('markLocalRead', () => {
  it('marks a single announcement as read', () => {
    const anns = [makeAnn(1), makeAnn(2)]
    markLocalRead(1)
    expect(filterUnread(anns)).toHaveLength(1)
    expect(filterUnread(anns)[0].id).toBe(2)
  })

  it('is idempotent — marking twice keeps count at 1', () => {
    markLocalRead(5)
    markLocalRead(5)
    const anns = [makeAnn(5)]
    expect(filterUnread(anns)).toHaveLength(0)
  })
})

describe('markAllLocalRead', () => {
  it('marks all provided IDs as read', () => {
    const anns = [makeAnn(10), makeAnn(11), makeAnn(12)]
    markAllLocalRead([10, 11, 12])
    expect(filterUnread(anns)).toHaveLength(0)
  })

  it('does not affect IDs not in the list', () => {
    const anns = [makeAnn(20), makeAnn(21)]
    markAllLocalRead([20])
    const unread = filterUnread(anns)
    expect(unread).toHaveLength(1)
    expect(unread[0].id).toBe(21)
  })
})

describe('filterUnread', () => {
  it('returns all when nothing read', () => {
    const anns = [makeAnn(30), makeAnn(31)]
    expect(filterUnread(anns)).toHaveLength(2)
  })

  it('returns empty array when all read', () => {
    const anns = [makeAnn(40), makeAnn(41)]
    markAllLocalRead([40, 41])
    expect(filterUnread(anns)).toHaveLength(0)
  })

  it('handles string and number IDs consistently', () => {
    markLocalRead('50')          // stored as string
    const anns = [makeAnn(50)]   // id is number
    expect(filterUnread(anns)).toHaveLength(0)
  })

  it('returns empty array for empty input', () => {
    expect(filterUnread([])).toHaveLength(0)
  })
})
