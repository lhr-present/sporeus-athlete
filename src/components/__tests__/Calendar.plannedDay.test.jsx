// @vitest-environment jsdom
// ─── Calendar.plannedDay.test.jsx ────────────────────────────────────────────
// HIGH bug: the planned-session overlay placed sessions by ARRAY INDEX
// (wi*7 + di), ignoring ses.day. Adaptive/preset plans compress to N active
// sessions, so sessions rendered on the wrong weekdays. Sessions must be placed
// on their real weekday (ses.day → Mon..Sun offset 0..6), index only as fallback.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx, LABELS } from '../../contexts/LangCtx.jsx'

let planValue = null

vi.mock('../../hooks/useLocalStorage.js', () => ({
  useLocalStorage: () => [planValue, vi.fn()],
}))
vi.mock('../../contexts/DataContext.jsx', () => ({
  useData: () => ({ recovery: [] }),
}))

import Calendar from '../Calendar.jsx'

const t = key => LABELS.en?.[key] ?? key
const ctx = { lang: 'en', setLang: vi.fn(), t }

function renderCal() {
  return render(
    <LangCtx.Provider value={ctx}>
      <Calendar log={[]} setLog={vi.fn()} onEdit={vi.fn()} />
    </LangCtx.Provider>
  )
}

describe('Calendar — planned sessions placed by weekday', () => {
  beforeEach(() => { planValue = null })

  it('places a session on its ses.day weekday, not its array index', () => {
    // generatedAt is Monday 2026-06-01 (UTC). A plan compressed to 2 active
    // sessions: a Monday run and a Wednesday tempo. By array index the second
    // session would land on Tue (index 1); by ses.day it must land on Wed.
    planValue = {
      generatedAt: '2026-06-01T00:00:00.000Z',
      weeks: [
        { sessions: [
          { day: 'Mon', type: 'Easy Run', duration: 40, zone: 'Z2' },
          { day: 'Wed', type: 'Tempo',    duration: 50, zone: 'Z3' },
        ] },
      ],
    }
    renderCal()

    // Navigate the calendar to June 2026.
    goToMonth(2026, 6)

    // Tuesday 2026-06-02: clicking it should NOT show the Tempo planned session.
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    expect(screen.queryByText(/PLANNED: Tempo/)).toBeNull()

    // Wednesday 2026-06-03: clicking it SHOULD show the Tempo planned session.
    fireEvent.click(screen.getByRole('button', { name: '3' }))
    expect(screen.getByText(/PLANNED: Tempo/)).toBeInTheDocument()
  })

  it('falls back to array index when ses.day is absent', () => {
    planValue = {
      generatedAt: '2026-06-01T00:00:00.000Z',
      weeks: [
        { sessions: [
          { type: 'Easy Run', duration: 40, zone: 'Z2' }, // index 0 → Mon 06-01
          { type: 'Tempo',    duration: 50, zone: 'Z3' }, // index 1 → Tue 06-02
        ] },
      ],
    }
    renderCal()
    goToMonth(2026, 6)

    fireEvent.click(screen.getByRole('button', { name: '2' }))
    expect(screen.getByText(/PLANNED: Tempo/)).toBeInTheDocument()
  })
})

// Navigate the calendar (← / → buttons) to a target year+month (1-indexed month).
function goToMonth(year, month) {
  const target = `${monthName(month)} ${year}`.toUpperCase()
  for (let i = 0; i < 240; i++) {
    if (screen.queryByText(target)) return
    fireEvent.click(screen.getByLabelText('Next month'))
  }
  throw new Error(`could not reach ${target}`)
}

function monthName(m) {
  return ['', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'][m]
}
