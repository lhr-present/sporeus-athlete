// @vitest-environment jsdom
// ─── TodayView.activationCTAs.test.jsx ──────────────────────────────────────
//
// Activation-enhancement coverage:
//   1. Empty-state GettingStartedCard "LOG YOUR FIRST SESSION" now prefills
//      today's plannedSession (when a plan exists) instead of opening a blank
//      QuickAdd. Falls back to a null/blank prefill when there is no plan.
//   2. The plan-less recommended-session "LOG THIS →" button opens QuickAdd in
//      place (setShowQuickAdd) rather than navigating to the Log tab.

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

// A plan whose week-0 Thursday slot (index 3) is a real session.
function buildPlan() {
  const sessions = [
    { type: 'Easy', duration: 45, rpe: 4 },       // Mon
    { type: 'Tempo', duration: 60, rpe: 7 },      // Tue
    { type: 'Easy', duration: 40, rpe: 4 },       // Wed
    { type: 'Endurance', duration: 90, rpe: 5 },  // Thu (today)
    { type: 'Rest', duration: 0, rpe: 0 },        // Fri
    { type: 'Long', duration: 120, rpe: 6 },      // Sat
    { type: 'Rest', duration: 0, rpe: 0 },        // Sun
  ]
  return { generatedAt: TODAY, weeks: [{ phase: 'Base', sessions }] }
}

describe('TodayView — activation CTAs', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.setSystemTime(new Date('2026-05-07T12:00:00Z'))
    localStorage.clear()
    __mockProfile = {}
    __mockRecovery = []
    __mockLog = []
  })
  afterEach(() => { vi.setSystemTime(new Date()); localStorage.clear() })

  // ── Change 1 — empty-state CTA prefills the planned session ───────────────
  it('empty-state "LOG YOUR FIRST SESSION" prefills today\'s planned session when a plan exists', () => {
    localStorage.setItem('sporeus-plan', JSON.stringify(buildPlan()))
    const setLogPrefill = vi.fn()
    const setShowQuickAdd = vi.fn()
    renderWithLang(
      <TodayView log={[]} setTab={noop} setLogPrefill={setLogPrefill} setShowQuickAdd={setShowQuickAdd} />
    )
    fireEvent.click(screen.getByRole('button', { name: /LOG YOUR FIRST SESSION/i }))
    expect(setLogPrefill).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'Endurance', duration: 90, rpe: 5, date: TODAY })
    )
    expect(setShowQuickAdd).toHaveBeenCalledTimes(1)
  })

  it('empty-state "LOG YOUR FIRST SESSION" falls back to a blank prefill when no plan exists', () => {
    const setLogPrefill = vi.fn()
    const setShowQuickAdd = vi.fn()
    renderWithLang(
      <TodayView log={[]} setTab={noop} setLogPrefill={setLogPrefill} setShowQuickAdd={setShowQuickAdd} />
    )
    fireEvent.click(screen.getByRole('button', { name: /LOG YOUR FIRST SESSION/i }))
    expect(setLogPrefill).toHaveBeenCalledWith(null)
    expect(setShowQuickAdd).toHaveBeenCalledTimes(1)
  })

  // ── Change 2 — no-plan "LOG THIS →" opens QuickAdd in place ───────────────
  it('plan-less "LOG THIS →" opens QuickAdd in place instead of navigating to the Log tab', () => {
    // No plan, but a recent training history so the empty-state card is gone
    // and the plan-less recommended-session block surfaces a non-rest session.
    __mockLog = []
    for (let i = 10; i >= 2; i--) {
      const d = new Date('2026-05-07T12:00:00Z'); d.setUTCDate(d.getUTCDate() - i)
      __mockLog.push({ id: `e${i}`, date: d.toISOString().slice(0, 10), type: 'Easy', duration: 45, tss: 40, rpe: 4, zones: [] })
    }
    const setTab = vi.fn()
    const setLogPrefill = vi.fn()
    const setShowQuickAdd = vi.fn()
    renderWithLang(
      <TodayView log={__mockLog} setTab={setTab} setLogPrefill={setLogPrefill} setShowQuickAdd={setShowQuickAdd} />
    )
    const btn = screen.getByRole('button', { name: /LOG THIS →/i })
    fireEvent.click(btn)
    expect(setShowQuickAdd).toHaveBeenCalledTimes(1)
    expect(setLogPrefill).toHaveBeenCalledWith(
      expect.objectContaining({ date: TODAY })
    )
    expect(setTab).not.toHaveBeenCalledWith('log')
  })
})
