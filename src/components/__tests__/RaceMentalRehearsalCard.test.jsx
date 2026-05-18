// @vitest-environment jsdom
// ─── RaceMentalRehearsalCard.test.jsx — render + persistence tests ─────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import RaceMentalRehearsalCard from '../dashboard/RaceMentalRehearsalCard.jsx'

const STORAGE_KEY = 'sporeus-raceMentalRehearsalChecks'

beforeEach(() => {
  vi.setSystemTime(new Date('2026-05-17T12:00:00Z'))
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.setSystemTime(new Date())
})

function renderCard(profile = {}, lang = 'en') {
  const value = { t: (k) => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <RaceMentalRehearsalCard profile={profile} />
    </LangCtx.Provider>
  )
}

describe('RaceMentalRehearsalCard', () => {
  it('renders nothing when profile has no race date', () => {
    const { container } = renderCard({})
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders 5 component rows when race is 5 days out', () => {
    renderCard({ raceDate: '2026-05-22' })
    const card = document.querySelector('[data-race-mental-rehearsal-card]')
    expect(card).not.toBeNull()
    const rows = document.querySelectorAll('[data-component-id]')
    expect(rows.length).toBe(5)
    const ids = Array.from(rows).map((r) => r.getAttribute('data-component-id'))
    expect(ids).toEqual([
      'imagery',
      'cueWord',
      'arousalRegulation',
      'contingencyPlan',
      'postRaceReflection',
    ])
  })

  it('data-days-to-race attribute matches computed days', () => {
    renderCard({ raceDate: '2026-05-22' })
    const card = document.querySelector('[data-race-mental-rehearsal-card]')
    expect(card.getAttribute('data-days-to-race')).toBe('5')
    // Heading shows T-5
    expect(card.textContent).toMatch(/T-5\s*DAYS/i)
  })

  it('clicking a checkbox persists state to localStorage keyed by ISO date', () => {
    renderCard({ raceDate: '2026-05-22' })
    const cb = document.querySelector('[data-checkbox-id="imagery"]')
    expect(cb).not.toBeNull()
    expect(cb.checked).toBe(false)
    fireEvent.click(cb)
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(stored.imagery).toBeTruthy()
    expect(stored.imagery['2026-05-17']).toBe(true)
    // Re-render to confirm persisted state hydrates
    cleanup()
    renderCard({ raceDate: '2026-05-22' })
    const cb2 = document.querySelector('[data-checkbox-id="imagery"]')
    expect(cb2.checked).toBe(true)
  })

  it('renders Turkish heading when lang=tr', () => {
    renderCard({ raceDate: '2026-05-22' }, 'tr')
    const card = document.querySelector('[data-race-mental-rehearsal-card]')
    expect(card).not.toBeNull()
    expect(card.textContent).toMatch(/ZİHİNSEL HAZIRLIK/)
    expect(card.textContent).toMatch(/T-5\s*GÜN/)
    // Turkish labels surface
    expect(card.textContent).toMatch(/Zihinsel Canlandırma/)
    expect(card.textContent).toMatch(/Anahtar Kelime/)
  })

  it('renders citation footer with all three sources', () => {
    renderCard({ raceDate: '2026-05-22' })
    const card = document.querySelector('[data-race-mental-rehearsal-card]')
    expect(card.textContent).toMatch(/Williams 2014/)
    expect(card.textContent).toMatch(/Behncke 2004/)
    expect(card.textContent).toMatch(/Cumming 2017/)
  })

  it('renders nothing when race is more than 7 days out', () => {
    const { container } = renderCard({ raceDate: '2026-06-15' })
    expect(container).toBeEmptyDOMElement()
  })
})
