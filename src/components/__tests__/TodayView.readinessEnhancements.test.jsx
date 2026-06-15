// @vitest-environment jsdom
// ─── TodayView.readinessEnhancements.test.jsx ───────────────────────────────
//
// Covers two hero/banner enhancements:
//   ENH 2 — "WHY THIS NUMBER": the #1 readiness driver line under the hero
//           readiness number. Surfaces only when a FULL check-in produced
//           drivers (HRV/sleep history); the bare quick-tap path renders
//           nothing new.
//   ENH 3 — actionable low-readiness banner: when readiness < 50 on a planned
//           day, a "↓ LOG AT -20%" button prefills a 20%-reduced session and
//           opens QuickAdd. Gated to !todayLogEntry && !downgradeRec.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithLang } from './testUtils.jsx'

let __mockProfile = {}
let __mockRecovery = []
let __mockLog = []

vi.mock('../../contexts/DataContext.jsx', () => ({
  useData: () => ({
    get log() { return __mockLog }, setLog: vi.fn(),
    get recovery() { return __mockRecovery }, setRecovery: vi.fn(),
    injuries: [], setInjuries: vi.fn(),
    testResults: [], setTestResults: vi.fn(),
    raceResults: [], setRaceResults: vi.fn(),
    get profile() { return __mockProfile }, setProfile: vi.fn(),
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
const TODAY = '2026-05-07' // Thursday → isoDow=3 (Mon=0)

function dateAt(daysAgo) {
  const d = new Date('2026-05-07T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}

// 28d history + today's FULL check-in (HRV+sleep+soreness+energy) so the
// readiness lib produces real drivers. todaySleep low → sleep is top driver.
function buildFullRecovery({ todayHrv = 65, todaySleep = 4, todaySoreness = 3, todayEnergy = 3, todayScore = 45 } = {}) {
  const out = []
  for (let i = 28; i >= 1; i--) {
    out.push({ date: dateAt(i), hrv: 65, sleepHrs: 7.5, soreness: 3, energy: 3, sleep: 3, score: 80 })
  }
  // `score` is the stored composite the hero/banner read (todayReadiness);
  // the hrv/sleep/soreness/energy fields drive the recomputed `heroReadiness`.
  out.push({ date: TODAY, hrv: todayHrv, sleepHrs: todaySleep, soreness: todaySoreness, energy: todayEnergy, sleep: 3, score: todayScore })
  return out
}

// A plan whose week-0 Thursday slot (index 3) is a real session.
function buildPlan() {
  const sessions = [
    { type: 'Easy', duration: 45, rpe: 4 },   // Mon
    { type: 'Tempo', duration: 60, rpe: 7 },  // Tue
    { type: 'Easy', duration: 40, rpe: 4 },   // Wed
    { type: 'Endurance', duration: 90, rpe: 5 }, // Thu (today)
    { type: 'Rest', duration: 0, rpe: 0 },    // Fri
    { type: 'Long', duration: 120, rpe: 6 },  // Sat
    { type: 'Rest', duration: 0, rpe: 0 },    // Sun
  ]
  return { generatedAt: TODAY, weeks: [{ phase: 'Base', sessions }] }
}

describe('TodayView — readiness hero + low-readiness banner enhancements', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.setSystemTime(new Date('2026-05-07T12:00:00Z'))
    localStorage.clear()
    __mockProfile = {}
    __mockRecovery = []
    __mockLog = []
  })
  afterEach(() => { vi.setSystemTime(new Date()); localStorage.clear() })

  // ── ENH 2 — hero readiness driver line ──────────────────────────────────
  it('renders the #1 readiness driver line for a full check-in', () => {
    __mockRecovery = buildFullRecovery({ todaySleep: 4 })
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    const driver = screen.getByTestId('hero-readiness-driver')
    expect(driver).toBeInTheDocument()
    expect(driver.textContent.length).toBeGreaterThan(10)
    // factor is one of the lib's driver factors
    expect(['hrv', 'sleep', 'soreness', 'mood']).toContain(driver.getAttribute('data-driver-factor'))
  })

  it('does NOT render a driver line for a bare quick-tap (no HRV/sleep)', () => {
    __mockRecovery = [{ date: TODAY, readiness: 25, score: 25, source: 'quick-tap', id: 1 }]
    renderWithLang(<TodayView log={[]} setTab={noop} setLogPrefill={noop} />)
    expect(screen.queryByTestId('hero-readiness-driver')).toBeNull()
  })

  // ── ENH 3 — low-readiness banner button ──────────────────────────────────
  it('shows a -20% log button on a low-readiness planned day and prefills + opens QuickAdd', () => {
    // soreness 5/5 + energy 1/5 + low sleep → readiness well under 50
    __mockRecovery = buildFullRecovery({ todayHrv: 30, todaySleep: 3, todaySoreness: 5, todayEnergy: 1 })
    localStorage.setItem('sporeus-plan', JSON.stringify(buildPlan()))
    const setLogPrefill = vi.fn()
    const setShowQuickAdd = vi.fn()
    renderWithLang(
      <TodayView log={[]} setTab={noop} setLogPrefill={setLogPrefill} setShowQuickAdd={setShowQuickAdd} />
    )
    // planned Thursday session = Endurance 90min → reduced = floor(90*0.8)=72
    const btn = screen.getByText(/LOG AT -20%/i)
    expect(btn).toBeInTheDocument()
    expect(btn.textContent).toMatch(/72 min/)
    fireEvent.click(btn)
    expect(setLogPrefill).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'Endurance', duration: 72, date: TODAY })
    )
    expect(setShowQuickAdd).toHaveBeenCalledTimes(1)
  })

  it('hides the -20% button once today is already logged', () => {
    __mockRecovery = buildFullRecovery({ todayHrv: 30, todaySleep: 3, todaySoreness: 5, todayEnergy: 1 })
    __mockLog = [{ id: 'x', date: TODAY, type: 'Endurance', duration: 60, tss: 50, rpe: 5, zones: [] }]
    localStorage.setItem('sporeus-plan', JSON.stringify(buildPlan()))
    renderWithLang(<TodayView log={__mockLog} setTab={noop} setLogPrefill={noop} setShowQuickAdd={noop} />)
    // The LOW banner may still render, but the action button must not.
    expect(screen.queryByText(/LOG AT -20%/i)).toBeNull()
  })
})
