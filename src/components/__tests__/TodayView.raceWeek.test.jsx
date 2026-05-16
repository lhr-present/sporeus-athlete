// @vitest-environment jsdom
// ─── TodayView.raceWeek.test.jsx — v9.193.0 race-week strategy peek ─────────
//
// Gates: raceCountdown.days ≤ 7 AND sport-mapped raceType in localStorage.
// Reads cross-surface conditions key for auto-warnings.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'
import { LangCtx, LABELS } from '../../contexts/LangCtx.jsx'

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

describe('TodayView — v9.193.0 race-week strategy peek', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.setSystemTime(new Date('2026-05-07T12:00:00Z'))
    localStorage.clear()
    __mockProfile = {}
  })
  afterEach(() => { vi.setSystemTime(new Date()); localStorage.clear() })

  it('renders NOTHING when raceDate is missing', () => {
    __mockProfile = { primarySport: 'Running' }
    localStorage.setItem('sporeus-eliteProgram-raceStrategy', JSON.stringify({ run: 'road' }))
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector('[data-race-week-strategy]')).toBeNull()
  })

  it('renders NOTHING when raceDate is >7 days away', () => {
    __mockProfile = { primarySport: 'Running', raceDate: '2026-06-30' } // ~54 days
    localStorage.setItem('sporeus-eliteProgram-raceStrategy', JSON.stringify({ run: 'road' }))
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector('[data-race-week-strategy]')).toBeNull()
  })

  it('renders NOTHING when athlete has not picked a race format', () => {
    __mockProfile = { primarySport: 'Running', raceDate: '2026-05-10' } // 3 days
    // No race-format pick in localStorage
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(document.querySelector('[data-race-week-strategy]')).toBeNull()
  })

  it('renders the strategy peek when race is within 7 days + format is picked', () => {
    __mockProfile = { primarySport: 'Running', raceDate: '2026-05-10' } // 3 days
    localStorage.setItem('sporeus-eliteProgram-raceStrategy', JSON.stringify({ run: 'road' }))
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    const block = document.querySelector('[data-race-week-strategy]')
    expect(block).not.toBeNull()
    expect(block.textContent).toMatch(/RACE-WEEK STRATEGY/i)
    expect(block.textContent).toMatch(/Pacing:/)
    expect(block.textContent).toMatch(/Opener:/)
    expect(block.textContent).toMatch(/Fueling:/)
  })

  it('renders "TODAY" suffix when raceDate is today (0 days)', () => {
    __mockProfile = { primarySport: 'Running', raceDate: '2026-05-07' }
    localStorage.setItem('sporeus-eliteProgram-raceStrategy', JSON.stringify({ run: 'road' }))
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    const block = document.querySelector('[data-race-week-strategy]')
    expect(block).not.toBeNull()
    expect(block.textContent).toMatch(/TODAY/i)
  })

  it('auto-surfaces heat warning from cross-surface conditions key', () => {
    __mockProfile = { primarySport: 'Running', raceDate: '2026-05-10' }
    localStorage.setItem('sporeus-eliteProgram-raceStrategy', JSON.stringify({ run: 'road' }))
    localStorage.setItem('sporeus-raceConditions', JSON.stringify({
      expanded: true, tempC: '32', windKph: '', altitudeM: '',
    }))
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    const block = document.querySelector('[data-race-week-strategy]')
    expect(block).not.toBeNull()
    expect(block.textContent).toMatch(/Race-day temperature 32°C/i)
    expect(block.textContent).toMatch(/Maughan 2010/i)
  })

  it('renders Turkish labels when lang=tr', () => {
    __mockProfile = { primarySport: 'Running', raceDate: '2026-05-10' }
    localStorage.setItem('sporeus-eliteProgram-raceStrategy', JSON.stringify({ run: 'road' }))
    const trT = k => LABELS.tr?.[k] ?? LABELS.en?.[k] ?? k
    render(
      <LangCtx.Provider value={{ t: trT, lang: 'tr', setLang: () => {} }}>
        <TodayView log={[]} setTab={noop} setLogPrefill={noop} />
      </LangCtx.Provider>
    )
    const block = document.querySelector('[data-race-week-strategy]')
    expect(block).not.toBeNull()
    expect(block.textContent).toMatch(/YARIŞ HAFTASI STRATEJİSİ/i)
    expect(block.textContent).toMatch(/Tempolama:/)
  })

  // v9.197.0 — Day-sensitive line rotation
  describe('day-sensitive line rotation', () => {
    beforeEach(() => {
      localStorage.setItem('sporeus-eliteProgram-raceStrategy', JSON.stringify({ run: 'road' }))
    })

    it('5 days out (4-7 bucket): gear / fueling / pacing — no opener / closer', () => {
      __mockProfile = { primarySport: 'Running', raceDate: '2026-05-12' } // 5 days
      renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
      expect(document.querySelector('[data-race-week-line="gear"]')).not.toBeNull()
      expect(document.querySelector('[data-race-week-line="fueling"]')).not.toBeNull()
      expect(document.querySelector('[data-race-week-line="pacing"]')).not.toBeNull()
      expect(document.querySelector('[data-race-week-line="opener"]')).toBeNull()
      expect(document.querySelector('[data-race-week-line="closer"]')).toBeNull()
    })

    it('3 days out (1-3 bucket): fueling / pacing / opener — no gear / closer', () => {
      __mockProfile = { primarySport: 'Running', raceDate: '2026-05-10' } // 3 days
      renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
      expect(document.querySelector('[data-race-week-line="fueling"]')).not.toBeNull()
      expect(document.querySelector('[data-race-week-line="pacing"]')).not.toBeNull()
      expect(document.querySelector('[data-race-week-line="opener"]')).not.toBeNull()
      expect(document.querySelector('[data-race-week-line="gear"]')).toBeNull()
      expect(document.querySelector('[data-race-week-line="closer"]')).toBeNull()
    })

    it('race day (0): opener / pacing / closer — no gear / fueling', () => {
      __mockProfile = { primarySport: 'Running', raceDate: '2026-05-07' } // 0 days
      renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
      expect(document.querySelector('[data-race-week-line="opener"]')).not.toBeNull()
      expect(document.querySelector('[data-race-week-line="pacing"]')).not.toBeNull()
      expect(document.querySelector('[data-race-week-line="closer"]')).not.toBeNull()
      expect(document.querySelector('[data-race-week-line="gear"]')).toBeNull()
      expect(document.querySelector('[data-race-week-line="fueling"]')).toBeNull()
    })

    it('7 days out is in the 4-7 bucket (boundary)', () => {
      __mockProfile = { primarySport: 'Running', raceDate: '2026-05-14' } // 7 days
      renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
      expect(document.querySelector('[data-race-week-line="gear"]')).not.toBeNull()
    })

    it('1 day out is in the 1-3 bucket (boundary)', () => {
      __mockProfile = { primarySport: 'Running', raceDate: '2026-05-08' } // 1 day
      renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
      expect(document.querySelector('[data-race-week-line="fueling"]')).not.toBeNull()
      expect(document.querySelector('[data-race-week-line="opener"]')).not.toBeNull()
      expect(document.querySelector('[data-race-week-line="gear"]')).toBeNull()
    })
  })
})
