import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  fmtSessionList,
  getReminderSettings,
  saveReminderSettings,
} from './pushNotifications.js'

// ─── localStorage mock for Node environment ────────────────────────────────────
const store = {}
const localStorageMock = {
  getItem:    k => store[k] ?? null,
  setItem:    (k, v) => { store[k] = String(v) },
  removeItem: k => { delete store[k] },
  clear:      () => { Object.keys(store).forEach(k => delete store[k]) },
}
vi.stubGlobal('localStorage', localStorageMock)

// ─── fmtSessionList ────────────────────────────────────────────────────────────

describe('fmtSessionList', () => {
  it('returns empty string for empty array', () => {
    expect(fmtSessionList([])).toBe('')
  })

  it('returns empty string for non-array', () => {
    expect(fmtSessionList(null)).toBe('')
    expect(fmtSessionList(undefined)).toBe('')
  })

  it('formats 1 session', () => {
    expect(fmtSessionList([{ type: 'Run' }])).toBe('Run')
  })

  it('formats 3 sessions comma-separated', () => {
    const sessions = [{ type: 'Run' }, { type: 'Swim' }, { type: 'Bike' }]
    expect(fmtSessionList(sessions)).toBe('Run, Swim, Bike')
  })

  it('shows +N more for more than 3 sessions', () => {
    const sessions = [
      { type: 'Run' }, { type: 'Swim' }, { type: 'Bike' },
      { type: 'Strength' }, { type: 'Yoga' },
    ]
    const result = fmtSessionList(sessions)
    expect(result).toBe('Run, Swim, Bike +2 more')
  })

  it('uses name field if type missing', () => {
    expect(fmtSessionList([{ name: 'Tempo Run' }])).toBe('Tempo Run')
  })
})

// ─── getReminderSettings / saveReminderSettings ────────────────────────────────

describe('getReminderSettings / saveReminderSettings', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns defaults when nothing saved', () => {
    const s = getReminderSettings()
    expect(s.enabled).toBe(false)
    expect(s.hour).toBe(7)
  })

  it('round-trips enabled=true, hour=8', () => {
    saveReminderSettings({ enabled: true, hour: 8 })
    const s = getReminderSettings()
    expect(s.enabled).toBe(true)
    expect(s.hour).toBe(8)
  })
})
