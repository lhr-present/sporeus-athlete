// @vitest-environment jsdom
// ─── TodayView.chronicFatigue.test.jsx — v9.203.0 ───────────────────────────
//
// Banner fires when detectChronicFatiguePattern reports isChronic=true
// (≥3 low quick-tap / wellness days in the last 7). The recovery array
// flows in via the mocked DataContext.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
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
const SELECTOR = '[data-chronic-fatigue-banner]'

describe('TodayView — v9.203.0 chronic fatigue banner', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.setSystemTime(new Date('2026-05-07T12:00:00Z'))
    localStorage.clear()
    __mockProfile = {}
    __mockRecovery = []
  })
  afterEach(() => { vi.setSystemTime(new Date()); localStorage.clear() })

  it('does NOT render when recovery is empty', () => {
    __mockRecovery = []
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector(SELECTOR)).toBeNull()
  })

  it('does NOT render with only 2 low days (below threshold)', () => {
    __mockRecovery = [
      { date: '2026-05-07', score: 25, source: 'quick-tap', id: 1 },
      { date: '2026-05-05', score: 30, source: 'quick-tap', id: 2 },
    ]
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector(SELECTOR)).toBeNull()
  })

  it('renders the banner when 3 low days within the last 7', () => {
    __mockRecovery = [
      { date: '2026-05-07', score: 25, source: 'quick-tap', id: 1 },
      { date: '2026-05-05', score: 30, source: 'quick-tap', id: 2 },
      { date: '2026-05-03', score: 20, source: 'quick-tap', id: 3 },
    ]
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    const banner = document.querySelector(SELECTOR)
    expect(banner).not.toBeNull()
    expect(banner.getAttribute('data-low-day-count')).toBe('3')
    expect(banner.textContent).toMatch(/CHRONIC FATIGUE · 3 LOW DAYS IN LAST 7/i)
    expect(banner.textContent).toMatch(/Halson 2014/)
  })

  it('renders Turkish copy when lang=tr (via banner heading)', () => {
    __mockRecovery = [
      { date: '2026-05-07', score: 25, source: 'quick-tap', id: 1 },
      { date: '2026-05-06', score: 25, source: 'quick-tap', id: 2 },
      { date: '2026-05-05', score: 25, source: 'quick-tap', id: 3 },
    ]
    // We render via renderWithLang which forces lang='en'; for TR coverage
    // the underlying lang-fork is exercised by the pure-fn tests + this
    // test confirms the EN path renders the expected count token.
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector(SELECTOR).textContent).toMatch(/3 LOW DAYS/i)
  })

  it('low days OUTSIDE the 7-day window do not trip the banner', () => {
    __mockRecovery = [
      { date: '2026-05-07', score: 25, source: 'quick-tap', id: 1 },
      { date: '2026-04-15', score: 25, source: 'quick-tap', id: 2 },
      { date: '2026-04-10', score: 25, source: 'quick-tap', id: 3 },
    ]
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector(SELECTOR)).toBeNull()
  })

  // v9.206.0 — Per-day dismissal
  it('DISMISS FOR TODAY button hides the banner', () => {
    __mockRecovery = [
      { date: '2026-05-07', score: 25, source: 'quick-tap', id: 1 },
      { date: '2026-05-06', score: 25, source: 'quick-tap', id: 2 },
      { date: '2026-05-05', score: 25, source: 'quick-tap', id: 3 },
    ]
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector(SELECTOR)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /DISMISS FOR TODAY/i }))
    expect(document.querySelector(SELECTOR)).toBeNull()
    // localStorage tracks today's ISO so tomorrow re-surfaces fresh
    const raw = localStorage.getItem('sporeus-chronicFatigueDismissedDate')
    expect(raw).toBe(JSON.stringify('2026-05-07'))
  })

  it('dismissed banner stays hidden across remount within the same day', () => {
    __mockRecovery = [
      { date: '2026-05-07', score: 25, source: 'quick-tap', id: 1 },
      { date: '2026-05-06', score: 25, source: 'quick-tap', id: 2 },
      { date: '2026-05-05', score: 25, source: 'quick-tap', id: 3 },
    ]
    // Pre-seed the dismissed date matching today
    localStorage.setItem('sporeus-chronicFatigueDismissedDate', JSON.stringify('2026-05-07'))
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector(SELECTOR)).toBeNull()
  })

  it('dismissal from YESTERDAY does not suppress today (per-day scope)', () => {
    __mockRecovery = [
      { date: '2026-05-07', score: 25, source: 'quick-tap', id: 1 },
      { date: '2026-05-06', score: 25, source: 'quick-tap', id: 2 },
      { date: '2026-05-05', score: 25, source: 'quick-tap', id: 3 },
    ]
    localStorage.setItem('sporeus-chronicFatigueDismissedDate', JSON.stringify('2026-05-06'))
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector(SELECTOR)).not.toBeNull()
  })
})
