// @vitest-environment jsdom
// ─── TodayView.cyclePhase.test.jsx — v9.192.0 cycle-phase one-liner ─────────
//
// The privacy contract is the load-bearing part: non-female / non-opted-in
// athletes must see NO cycle indicator anywhere in TodayView. These tests
// pin that contract end-to-end through the daily readiness band.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'

let __mockProfile = {}

vi.mock('../../contexts/DataContext.jsx', () => ({
  useData: () => ({
    log: [], setLog: vi.fn(),
    recovery: [], setRecovery: vi.fn(),
    injuries: [], setInjuries: vi.fn(),
    testResults: [], setTestResults: vi.fn(),
    raceResults: [], setRaceResults: vi.fn(),
    get profile() { return __mockProfile },
    setProfile: vi.fn(),
  }),
}))
vi.mock('../../lib/supabase.js', () => ({
  supabase: null,
  isSupabaseReady: vi.fn(() => false),
}))
vi.mock('../../lib/logger.js', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))
vi.mock('../../lib/db/coachSessions.js', () => ({
  getUpcomingSessions: vi.fn(() => Promise.resolve({ data: [] })),
  upsertAttendance:    vi.fn(() => Promise.resolve({ error: null })),
}))
vi.mock('../TeamAnnouncements.jsx', () => ({ default: () => null }))
vi.mock('../../lib/inviteUtils.js', () => ({
  getMyCoach: vi.fn(() => Promise.resolve(null)),
}))
vi.mock('../../lib/offlineQueue.js', () => ({
  flushQueue: vi.fn(() => Promise.resolve()),
}))
vi.mock('../CoachMessage.jsx', () => ({ hasUnread: vi.fn(() => false) }))
vi.mock('../QRScanner.jsx', () => ({ default: () => null }))

import TodayView from '../TodayView.jsx'

const noop = () => {}

describe('TodayView — v9.192.0 cycle phase one-liner', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // Use a fixed date so the cycle math is deterministic
    vi.setSystemTime(new Date('2026-05-07T12:00:00Z'))
    __mockProfile = {}
  })

  it('renders NOTHING cycle-related for empty profile', () => {
    __mockProfile = {}
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector('[data-today-cycle-phase]')).toBeNull()
  })

  it('renders NOTHING for male profile (privacy)', () => {
    __mockProfile = { gender: 'male', lastPeriodStart: '2026-04-15', cycleLength: 28 }
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector('[data-today-cycle-phase]')).toBeNull()
  })

  it('renders NOTHING for female who hasn\'t entered lastPeriodStart', () => {
    __mockProfile = { gender: 'female' }
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector('[data-today-cycle-phase]')).toBeNull()
  })

  it('renders the one-liner for opted-in female (gender + lastPeriodStart)', () => {
    __mockProfile = { gender: 'female', lastPeriodStart: '2026-04-15', cycleLength: 28 }
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    const el = document.querySelector('[data-today-cycle-phase]')
    expect(el).not.toBeNull()
    expect(el.textContent).toMatch(/TSS [+-]?\d+%/)
  })

  it('phase attribute is one of the four valid phase keys', () => {
    __mockProfile = { gender: 'female', lastPeriodStart: '2026-04-15', cycleLength: 28 }
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    const el = document.querySelector('[data-today-cycle-phase]')
    expect(el).not.toBeNull()
    const phase = el.getAttribute('data-today-cycle-phase')
    expect(['menstruation', 'follicular', 'ovulation', 'luteal']).toContain(phase)
  })
})
