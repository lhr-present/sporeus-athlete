// @vitest-environment jsdom
// ─── TodayView.seasonPhase.test.jsx — v9.201.0 season-phase peek ────────────
//
// Cross-surface: TodayView reads the same `sporeus-multiPeakSeason` key
// MultiPeakSeasonCard writes. When the athlete has built a season,
// today's phase + next-race countdown surface inline.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
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
const SELECTOR = '[data-season-phase-peek]'

describe('TodayView — v9.201.0 season-phase peek', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.setSystemTime(new Date('2026-05-07T12:00:00Z'))
    localStorage.clear()
    __mockProfile = { primarySport: 'Running' }
  })
  afterEach(() => { vi.setSystemTime(new Date()); localStorage.clear() })

  it('renders NOTHING when no season is built', () => {
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector(SELECTOR)).toBeNull()
  })

  it('renders NOTHING when races array is empty', () => {
    localStorage.setItem('sporeus-multiPeakSeason', JSON.stringify({
      expanded: true, races: [], seededFromProfile: false,
    }))
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector(SELECTOR)).toBeNull()
  })

  it('renders the peek with current phase + next race when season is built', () => {
    localStorage.setItem('sporeus-multiPeakSeason', JSON.stringify({
      expanded: true,
      races: [{ date: '2026-08-15', label: 'Istanbul Half', priority: 'A' }],
      seededFromProfile: false,
    }))
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    const peek = document.querySelector(SELECTOR)
    expect(peek).not.toBeNull()
    expect(peek.textContent).toMatch(/SEASON · W1 \/ \d+/i)
    expect(peek.textContent).toMatch(/Next race/i)
    expect(peek.textContent).toMatch(/Istanbul Half/)
    expect(peek.textContent).toMatch(/A/)
    // 2026-08-15 minus 2026-05-07 = 100 days
    expect(peek.textContent).toMatch(/100d/)
  })

  it('handles unlabeled races gracefully', () => {
    localStorage.setItem('sporeus-multiPeakSeason', JSON.stringify({
      expanded: true,
      races: [{ date: '2026-08-15', label: '', priority: 'B' }],
      seededFromProfile: false,
    }))
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    const peek = document.querySelector(SELECTOR)
    expect(peek).not.toBeNull()
    expect(peek.textContent).toMatch(/unlabeled/i)
  })

  it('phase data-attribute is one of the canonical phase keys', () => {
    localStorage.setItem('sporeus-multiPeakSeason', JSON.stringify({
      expanded: true,
      races: [{ date: '2026-08-15', label: 'A-race', priority: 'A' }],
      seededFromProfile: false,
    }))
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    const peek = document.querySelector(SELECTOR)
    const phase = peek.getAttribute('data-current-phase')
    expect(['Base', 'Build', 'Peak', 'Taper', 'Race', 'Recovery', 'Maintenance']).toContain(phase)
  })

  it('renders nothing for invalid race (date in past)', () => {
    // Builder rejects races in the past
    localStorage.setItem('sporeus-multiPeakSeason', JSON.stringify({
      expanded: true,
      races: [{ date: '2026-04-01', label: 'past', priority: 'A' }],
      seededFromProfile: false,
    }))
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector(SELECTOR)).toBeNull()
  })
})
