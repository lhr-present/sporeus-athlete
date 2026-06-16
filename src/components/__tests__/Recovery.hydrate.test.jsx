// @vitest-environment jsdom
// ─── Recovery.hydrate.test.jsx ───────────────────────────────────────────────
// HIGH bug: on a signed-in cold load `entries` is empty so the form starts at
// defaults; useRecovery then hydrates today's entry async. The form-sync effect
// must re-run when today's entry appears, otherwise the form stays blank and a
// Save would clobber the real entry with default/blank values (data loss).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx, LABELS } from '../../contexts/LangCtx.jsx'

// Mutable data state so we can simulate async hydration via re-render.
const dataState = { recovery: [], setRecovery: vi.fn(), log: [], profile: {} }

vi.mock('../../contexts/DataContext.jsx', () => ({
  useData: () => dataState,
}))
vi.mock('../../hooks/useLocalStorage.js', () => ({
  useLocalStorage: () => ['en', vi.fn()],
}))

// Stub heavy children — irrelevant to the hydration behaviour under test.
vi.mock('../InjuryTracker.jsx',        () => ({ default: () => null }))
vi.mock('../MentalTools.jsx',          () => ({ default: () => null }))
vi.mock('../OSTRCQuestionnaire.jsx',   () => ({ default: () => null }))
vi.mock('../RTPProtocol.jsx',          () => ({ default: () => null }))
vi.mock('../CycleTracker.jsx',         () => ({ default: () => null }))
vi.mock('../HRVDashboard.jsx',         () => ({ default: () => null }))
vi.mock('../ErrorBoundary.jsx',        () => ({ default: ({ children }) => children }))

import Recovery from '../Recovery.jsx'

const t = key => LABELS.en?.[key] ?? key
const ctx = { lang: 'en', setLang: vi.fn(), t }

function renderRecovery() {
  return render(
    <LangCtx.Provider value={ctx}>
      <Recovery />
    </LangCtx.Provider>
  )
}

const today = new Date().toISOString().slice(0, 10)

describe('Recovery — hydrate-after-mount', () => {
  beforeEach(() => {
    dataState.recovery = []
    dataState.setRecovery = vi.fn()
    dataState.log = []
    dataState.profile = {}
  })

  it('reflects today\'s entry into the form when it hydrates after mount', () => {
    // Mount with empty entries (cold load) — form starts at defaults (sleep 3 → 60).
    const { rerender } = renderRecovery()
    // Default score is round((3+3+3+3+3)/5*20) = 60.
    expect(screen.getByText('60')).toBeInTheDocument()
    // No "already logged" banner before hydration.
    expect(screen.queryByText(t('alreadyLoggedMsg'))).toBeNull()

    // Async hydration arrives: today's real entry has higher wellness values.
    const todayEntry = { date: today, sleep: 5, soreness: 5, energy: 5, mood: 5, stress: 5, sleepHrs: '8', score: 100 }
    dataState.recovery = [todayEntry]
    rerender(
      <LangCtx.Provider value={ctx}>
        <Recovery />
      </LangCtx.Provider>
    )

    // "Already logged" banner now appears (today's entry hydrated).
    expect(screen.getByText(t('alreadyLoggedMsg'))).toBeInTheDocument()
    // The big score readout recomputes from the hydrated form to 100
    // (round((5+5+5+5+5)/5*20)); the default 60 is gone.
    expect(screen.queryByText('60')).toBeNull()
    expect(screen.getAllByText('100').length).toBeGreaterThan(0)
  })

  it('Save after hydration persists the real values, not blanks', () => {
    const { rerender } = renderRecovery()

    const todayEntry = { date: today, sleep: 5, soreness: 5, energy: 5, mood: 5, stress: 5, sleepHrs: '8', score: 100 }
    dataState.recovery = [todayEntry]
    rerender(
      <LangCtx.Provider value={ctx}>
        <Recovery />
      </LangCtx.Provider>
    )

    fireEvent.click(screen.getByText(t('saveEntryBtn')))
    expect(dataState.setRecovery).toHaveBeenCalled()
    const saved = dataState.setRecovery.mock.calls[dataState.setRecovery.mock.calls.length - 1][0]
    const persisted = saved.find(e => e.date === today)
    // Real values survive — Save did NOT clobber the entry with defaults (sleep 3).
    expect(persisted.sleep).toBe(5)
    expect(persisted.sleepHrs).toBe('8')
    expect(persisted.score).toBe(100)
  })
})
