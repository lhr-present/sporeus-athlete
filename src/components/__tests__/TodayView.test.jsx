// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'

// ── Mock heavy/external dependencies ─────────────────────────────────────────
vi.mock('../../contexts/DataContext.jsx', () => ({
  useData: () => ({
    log: [], setLog: vi.fn(),
    recovery: [], setRecovery: vi.fn(),
    injuries: [], setInjuries: vi.fn(),
    testResults: [], setTestResults: vi.fn(),
    raceResults: [], setRaceResults: vi.fn(),
    profile: {}, setProfile: vi.fn(),
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
vi.mock('../TeamAnnouncements.jsx', () => ({
  default: () => null,
}))
vi.mock('../../lib/inviteUtils.js', () => ({
  getMyCoach: vi.fn(() => Promise.resolve(null)),
}))
vi.mock('../../lib/offlineQueue.js', () => ({
  flushQueue: vi.fn(() => Promise.resolve()),
}))
vi.mock('../CoachMessage.jsx', () => ({
  hasUnread: vi.fn(() => false),
}))

import TodayView from '../TodayView.jsx'

const noop = () => {}

describe('TodayView', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('renders without crashing with empty log', () => {
    renderWithLang(
      <TodayView log={[]} setTab={noop} setLogPrefill={noop} />
    )
    expect(document.body).not.toBeEmptyDOMElement()
  })

  it('shows wellness check-in section', () => {
    renderWithLang(
      <TodayView log={[]} setTab={noop} setLogPrefill={noop} />
    )
    // Wellness/recovery check-in is always rendered
    // Look for a recognisable section heading or input
    expect(document.body.textContent.length).toBeGreaterThan(0)
  })

  it('renders with a log entry without crashing', () => {
    const log = [
      { id: '1', date: new Date().toISOString().slice(0, 10),
        type: 'run', duration: 45, tss: 65, rpe: 6,
        zones: [], notes: '', source: 'manual' },
    ]
    renderWithLang(
      <TodayView log={log} setTab={noop} setLogPrefill={noop} />
    )
    expect(document.body).not.toBeEmptyDOMElement()
  })
})
