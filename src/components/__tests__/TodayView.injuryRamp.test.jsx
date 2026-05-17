// @vitest-environment jsdom
// ─── TodayView.injuryRamp.test.jsx — v9.199.0 injury ramp peek ──────────────
//
// Cross-surface: TodayView reads the same `sporeus-injuryReturnRamp`
// localStorage key the InjuryReturnCard writes. When the athlete has
// stamped a rampStartDate + filled the required form fields, today's
// week prescription surfaces inline.

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

const SELECTOR = '[data-injury-ramp-today-peek]'

describe('TodayView — v9.199.0 injury ramp peek', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.setSystemTime(new Date('2026-05-07T12:00:00Z'))
    localStorage.clear()
    __mockProfile = { primarySport: 'Running' }
  })
  afterEach(() => { vi.setSystemTime(new Date()); localStorage.clear() })

  it('renders NOTHING when athlete has no injury-ramp data in localStorage', () => {
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector(SELECTOR)).toBeNull()
  })

  it('renders NOTHING when rampStartDate is missing (ramp not yet built)', () => {
    localStorage.setItem('sporeus-injuryReturnRamp', JSON.stringify({
      expanded: true, daysOff: '21', injuryType: 'soft-tissue',
      bodyRegion: '', preInjuryCTL: '60', dismissedComeback: false,
      // rampStartDate intentionally absent
    }))
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector(SELECTOR)).toBeNull()
  })

  it('renders NOTHING when injuryType is missing', () => {
    localStorage.setItem('sporeus-injuryReturnRamp', JSON.stringify({
      expanded: true, daysOff: '21', injuryType: '',
      bodyRegion: '', preInjuryCTL: '60', dismissedComeback: false,
      rampStartDate: '2026-05-07',
    }))
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector(SELECTOR)).toBeNull()
  })

  it('renders the peek with W1 prescription when athlete just started ramp', () => {
    localStorage.setItem('sporeus-injuryReturnRamp', JSON.stringify({
      expanded: true, daysOff: '21', injuryType: 'soft-tissue',
      bodyRegion: '', preInjuryCTL: '60', dismissedComeback: true,
      rampStartDate: '2026-05-07',
    }))
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    const peek = document.querySelector(SELECTOR)
    expect(peek).not.toBeNull()
    expect(peek.getAttribute('data-current-week')).toBe('1')
    // Soligard W1 = 30% volume, Z2 cap, 0 quality
    expect(peek.textContent).toMatch(/W1 \/ 5/i)
    expect(peek.textContent).toMatch(/30%/)
    expect(peek.textContent).toMatch(/Z2/)
    expect(peek.textContent).toMatch(/no quality/i)
  })

  it('current week advances when ramp was started days ago', () => {
    localStorage.setItem('sporeus-injuryReturnRamp', JSON.stringify({
      expanded: true, daysOff: '21', injuryType: 'soft-tissue',
      bodyRegion: '', preInjuryCTL: '60', dismissedComeback: true,
      rampStartDate: '2026-04-29', // 8 days ago → W2
    }))
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    const peek = document.querySelector(SELECTOR)
    expect(peek).not.toBeNull()
    expect(peek.getAttribute('data-current-week')).toBe('2')
    expect(peek.textContent).toMatch(/W2/i)
  })

  it('suppresses peek once the ramp is complete (past the final week)', () => {
    // Soft-tissue 21-day ramp = 5 weeks = 35 days. Stamp 50 days ago → past end
    localStorage.setItem('sporeus-injuryReturnRamp', JSON.stringify({
      expanded: true, daysOff: '21', injuryType: 'soft-tissue',
      bodyRegion: '', preInjuryCTL: '60', dismissedComeback: true,
      rampStartDate: '2026-03-18', // 50 days ago
    }))
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector(SELECTOR)).toBeNull()
  })

  // v9.205.0 — RTS criteria progress mirror
  it('RTS progress mirror shows 0/5 when no criteria are met', () => {
    localStorage.setItem('sporeus-injuryReturnRamp', JSON.stringify({
      expanded: true, daysOff: '21', injuryType: 'soft-tissue',
      bodyRegion: '', preInjuryCTL: '60', dismissedComeback: true,
      rampStartDate: '2026-05-07',
      rtsCriteriaMet: [],
    }))
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    const progress = document.querySelector('[data-rts-progress-peek]')
    expect(progress).not.toBeNull()
    expect(progress.getAttribute('data-rts-met')).toBe('0')
    expect(progress.textContent).toMatch(/RTS criteria: 0\/5/i)
  })

  it('RTS progress mirror reflects partial checks (3/5)', () => {
    localStorage.setItem('sporeus-injuryReturnRamp', JSON.stringify({
      expanded: true, daysOff: '21', injuryType: 'soft-tissue',
      bodyRegion: '', preInjuryCTL: '60', dismissedComeback: true,
      rampStartDate: '2026-05-07',
      rtsCriteriaMet: [true, false, true, true, false],
    }))
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    const progress = document.querySelector('[data-rts-progress-peek]')
    expect(progress.getAttribute('data-rts-met')).toBe('3')
    expect(progress.textContent).toMatch(/3\/5/)
  })

  it('shows READY TO RETURN badge when all 5 are met', () => {
    localStorage.setItem('sporeus-injuryReturnRamp', JSON.stringify({
      expanded: true, daysOff: '21', injuryType: 'soft-tissue',
      bodyRegion: '', preInjuryCTL: '60', dismissedComeback: true,
      rampStartDate: '2026-05-07',
      rtsCriteriaMet: [true, true, true, true, true],
    }))
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    const progress = document.querySelector('[data-rts-progress-peek]')
    expect(progress.getAttribute('data-rts-met')).toBe('5')
    expect(progress.textContent).toMatch(/READY TO RETURN/i)
  })
})
