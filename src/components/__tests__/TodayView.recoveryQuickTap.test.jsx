// @vitest-environment jsdom
// ─── TodayView.recoveryQuickTap.test.jsx — v9.196.0 ─────────────────────────
//
// Pre-v9.196 the Recovery Protocols Card required the full wellness form
// (wellnessSaved flag). Athletes who quick-tapped 😴 (drained, score=25)
// never saw protocol suggestions. v9.196 relaxes the gate: quick-tap
// entries with score ≤ 30 also fire the card, with the quick-tap score
// normalized to the 1–5 wellness scale `getRecommendedProtocols` expects.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'

let __mockProfile = {}
let __mockRecovery = []

vi.mock('../../contexts/DataContext.jsx', () => ({
  useData: () => ({
    log: [], setLog: vi.fn(),
    get recovery() { return __mockRecovery },
    setRecovery: vi.fn(),
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

describe('TodayView — v9.196.0 recovery protocols on quick-tap', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.setSystemTime(new Date('2026-05-07T12:00:00Z'))
    localStorage.clear()
    __mockProfile = {}
    __mockRecovery = []
  })
  afterEach(() => { vi.setSystemTime(new Date()); localStorage.clear() })

  it('does NOT render protocols when no recovery entry exists today', () => {
    __mockRecovery = []
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector('[data-recovery-protocols-card]')).toBeNull()
  })

  it('does NOT render protocols on fresh quick-tap (score=90)', () => {
    __mockRecovery = [{
      date: '2026-05-07', readiness: 90, score: 90,
      source: 'quick-tap', id: 1,
    }]
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector('[data-recovery-protocols-card]')).toBeNull()
  })

  it('does NOT render protocols on okay quick-tap (score=60)', () => {
    __mockRecovery = [{
      date: '2026-05-07', readiness: 60, score: 60,
      source: 'quick-tap', id: 2,
    }]
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector('[data-recovery-protocols-card]')).toBeNull()
  })

  it('RENDERS protocols on drained quick-tap (score=25)', () => {
    __mockRecovery = [{
      date: '2026-05-07', readiness: 25, score: 25,
      source: 'quick-tap', id: 3,
    }]
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    const card = document.querySelector('[data-recovery-protocols-card]')
    expect(card).not.toBeNull()
    expect(card.textContent).toMatch(/RECOVERY PROTOCOLS/i)
  })

  it('boundary case: quick-tap score=30 still fires (≤ 30 threshold)', () => {
    __mockRecovery = [{
      date: '2026-05-07', readiness: 30, score: 30,
      source: 'quick-tap', id: 4,
    }]
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector('[data-recovery-protocols-card]')).not.toBeNull()
  })

  it('boundary case: quick-tap score=31 does NOT fire (>30)', () => {
    __mockRecovery = [{
      date: '2026-05-07', readiness: 31, score: 31,
      source: 'quick-tap', id: 5,
    }]
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector('[data-recovery-protocols-card]')).toBeNull()
  })
})
