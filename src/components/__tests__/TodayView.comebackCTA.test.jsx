// @vitest-environment jsdom
// ─── TodayView.comebackCTA.test.jsx — v9.194.0 comeback CTA ─────────────────
//
// TodayView already surfaces a WELCOME BACK diagnostic when the comeback
// detector fires (v9.110.0). v9.194.0 adds a "VIEW RETURN RAMP →" button
// that pre-fills `sporeus-injuryReturnRamp` localStorage with the
// comeback values + switches the active tab to 'dashboard' so the
// InjuryReturnCard appears expanded with the values populated.
//
// Building a comeback log requires ≥14 days of silence on the log + prior
// CTL ≥10 (PRIOR_CTL_FLOOR). The detector reads CTL at the *last training
// date*, so we build 30 days of TSS=80 then leave a 21-day gap.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'
import { fireEvent, screen } from '@testing-library/react'

let __mockProfile = {}
let __mockLog = []

vi.mock('../../contexts/DataContext.jsx', () => ({
  useData: () => ({
    get log() { return __mockLog },
    setLog: vi.fn(),
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

function buildComebackLog() {
  // 30 days of training ending 21 days before today (2026-04-16).
  const lastTraining = new Date('2026-04-16T12:00:00Z')
  const out = []
  for (let i = 30; i >= 0; i--) {
    const d = new Date(lastTraining.getTime() - i * 86400000)
    out.push({ date: d.toISOString().slice(0, 10), tss: 80, type: 'run' })
  }
  return out
}

describe('TodayView — v9.194.0 comeback CTA', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.setSystemTime(new Date('2026-05-07T12:00:00Z'))
    localStorage.clear()
    __mockProfile = {}
    __mockLog = []
  })
  afterEach(() => { vi.setSystemTime(new Date()); localStorage.clear() })

  it('CTA button is absent when no comeback gap is detected (recent activity)', () => {
    __mockLog = buildComebackLog().slice(-5).map(e => ({
      ...e,
      date: new Date('2026-05-05T12:00:00Z').toISOString().slice(0, 10),
    }))
    renderWithLang(<TodayView log={__mockLog} setTab={vi.fn()} setLogPrefill={vi.fn()} />)
    expect(document.querySelector('[data-comeback-cta]')).toBeNull()
  })

  it('CTA button renders when comeback diagnostic wins the priority ranking', () => {
    __mockLog = buildComebackLog()
    renderWithLang(<TodayView log={__mockLog} setTab={vi.fn()} setLogPrefill={vi.fn()} />)
    const cta = document.querySelector('[data-comeback-cta]')
    expect(cta).not.toBeNull()
    expect(cta.textContent).toMatch(/VIEW RETURN RAMP/i)
  })

  it('clicking the CTA writes the pre-fill to sporeus-injuryReturnRamp', () => {
    __mockLog = buildComebackLog()
    renderWithLang(<TodayView log={__mockLog} setTab={vi.fn()} setLogPrefill={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /VIEW RETURN RAMP/i }))
    const stored = JSON.parse(localStorage.getItem('sporeus-injuryReturnRamp') || '{}')
    expect(stored.expanded).toBe(true)
    expect(stored.daysOff).toBe('21')
    expect(Number(stored.preInjuryCTL)).toBeGreaterThan(10)
    expect(stored.dismissedComeback).toBe(true)
  })

  it('clicking the CTA switches tab to dashboard', () => {
    __mockLog = buildComebackLog()
    const setTab = vi.fn()
    renderWithLang(<TodayView log={__mockLog} setTab={setTab} setLogPrefill={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /VIEW RETURN RAMP/i }))
    expect(setTab).toHaveBeenCalledWith('dashboard')
  })
})
