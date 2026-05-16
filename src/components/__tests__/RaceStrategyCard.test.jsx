// @vitest-environment jsdom
// ─── RaceStrategyCard.test.jsx — render tests for the standalone surface ────
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import RaceStrategyCard from '../dashboard/RaceStrategyCard.jsx'

const STORAGE_KEY = 'sporeus-eliteProgram-raceStrategy'

beforeEach(() => { localStorage.clear() })
afterEach(() => { cleanup(); localStorage.clear() })

function renderCard(profile = { primarySport: 'Running' }, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <RaceStrategyCard profile={profile} />
    </LangCtx.Provider>
  )
}

describe('RaceStrategyCard — pre-selection', () => {
  it('renders the picker with helper text and no output', () => {
    renderCard()
    const region = screen.getByRole('region', { name: /Race strategy/i })
    expect(region).toBeInTheDocument()
    expect(screen.getByLabelText(/Select race format/i)).toBeInTheDocument()
    expect(region.textContent).toMatch(/Select a race format/i)
    expect(document.querySelector('[data-race-strategy-card-output]')).toBeNull()
  })

  it('exposes the selected sport in the title', () => {
    renderCard({ primarySport: 'Cycling' })
    const region = screen.getByRole('region', { name: /Race strategy/i })
    expect(region.textContent).toMatch(/BIKE/)
  })
})

describe('RaceStrategyCard — post-selection', () => {
  it('renders pacing/opener/closer/fueling/gear when a format is selected', () => {
    renderCard()
    fireEvent.change(screen.getByLabelText(/Select race format/i), { target: { value: 'road' } })
    const output = document.querySelector('[data-race-strategy-card-output]')
    expect(output).not.toBeNull()
    expect(output.textContent).toMatch(/Pacing:/)
    expect(output.textContent).toMatch(/Opener:/)
    expect(output.textContent).toMatch(/Closer:/)
    expect(output.textContent).toMatch(/Fueling:/)
    expect(output.textContent).toMatch(/Gear:/)
    expect(output.textContent).toMatch(/Foster 1999/)
  })

  it('persists selection to the same localStorage key as the in-program block', () => {
    renderCard()
    fireEvent.change(screen.getByLabelText(/Select race format/i), { target: { value: 'trail' } })
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(stored.run).toBe('trail')
  })

  it('reads selection back from the shared key (cross-surface compat)', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ run: 'ultra' }))
    renderCard()
    const picker = screen.getByLabelText(/Select race format/i)
    expect(picker.value).toBe('ultra')
    expect(document.querySelector('[data-race-strategy-card-output]')).not.toBeNull()
  })
})

describe('RaceStrategyCard — bilingual', () => {
  it('renders Turkish labels + Turkish strategy text when lang=tr', () => {
    renderCard({ primarySport: 'Running' }, 'tr')
    const region = screen.getByRole('region', { name: /Yarış stratejisi/i })
    expect(region).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Yarış formatı seç/i), { target: { value: 'road' } })
    const output = document.querySelector('[data-race-strategy-card-output]')
    expect(output.textContent).toMatch(/Tempolama:/)
    expect(output.textContent).toMatch(/Açılış:/)
  })
})

// v9.190.0 — race-day conditions inputs unlock the heat/cold/wind/altitude
// warning paths in buildRaceStrategy that previously had no UI feeding them.
describe('RaceStrategyCard — v9.190.0 race-day conditions', () => {
  it('conditions section collapsed by default; inputs hidden', () => {
    renderCard()
    expect(screen.queryByLabelText(/TEMP \(°C\)/i)).toBeNull()
    expect(screen.queryByLabelText(/WIND \(km\/h\)/i)).toBeNull()
    expect(screen.queryByLabelText(/ALTITUDE \(m\)/i)).toBeNull()
  })

  it('toggling expand reveals all three optional inputs', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /Race-day conditions/i }))
    expect(screen.getByLabelText(/TEMP \(°C\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/WIND \(km\/h\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/ALTITUDE \(m\)/i)).toBeInTheDocument()
  })

  it('hot temperature fires the Maughan heat warning when format is selected', () => {
    renderCard()
    fireEvent.change(screen.getByLabelText(/Select race format/i), { target: { value: 'road' } })
    fireEvent.click(screen.getByRole('button', { name: /Race-day conditions/i }))
    fireEvent.change(screen.getByLabelText(/TEMP \(°C\)/i), { target: { value: '32' } })
    const output = document.querySelector('[data-race-strategy-card-output]')
    expect(output.textContent).toMatch(/Race-day temperature 32°C/i)
    expect(output.textContent).toMatch(/Maughan 2010/i)
  })

  it('cold temperature fires the cold warning', () => {
    renderCard()
    fireEvent.change(screen.getByLabelText(/Select race format/i), { target: { value: 'road' } })
    fireEvent.click(screen.getByRole('button', { name: /Race-day conditions/i }))
    fireEvent.change(screen.getByLabelText(/TEMP \(°C\)/i), { target: { value: '2' } })
    const output = document.querySelector('[data-race-strategy-card-output]')
    expect(output.textContent).toMatch(/Cold race-day/i)
    expect(output.textContent).toMatch(/extended warm-up/i)
  })

  it('high wind fires the crosswind warning (bike sport)', () => {
    renderCard({ primarySport: 'Cycling' })
    fireEvent.change(screen.getByLabelText(/Select race format/i), { target: { value: 'road' } })
    fireEvent.click(screen.getByRole('button', { name: /Race-day conditions/i }))
    fireEvent.change(screen.getByLabelText(/WIND \(km\/h\)/i), { target: { value: '35' } })
    const output = document.querySelector('[data-race-strategy-card-output]')
    expect(output.textContent).toMatch(/High wind/i)
    expect(output.textContent).toMatch(/echelon positioning/i)
  })

  it('high altitude fires the altitude warning', () => {
    renderCard()
    fireEvent.change(screen.getByLabelText(/Select race format/i), { target: { value: 'road' } })
    fireEvent.click(screen.getByRole('button', { name: /Race-day conditions/i }))
    fireEvent.change(screen.getByLabelText(/ALTITUDE \(m\)/i), { target: { value: '2400' } })
    const output = document.querySelector('[data-race-strategy-card-output]')
    expect(output.textContent).toMatch(/Altitude 2400m/i)
    expect(output.textContent).toMatch(/5-10% performance drop/i)
  })

  it('empty conditions inputs do NOT fire any warnings', () => {
    renderCard()
    fireEvent.change(screen.getByLabelText(/Select race format/i), { target: { value: 'road' } })
    fireEvent.click(screen.getByRole('button', { name: /Race-day conditions/i }))
    // Leave all conditions blank
    const output = document.querySelector('[data-race-strategy-card-output]')
    expect(output.textContent).not.toMatch(/temperature.*°C/i)
    expect(output.textContent).not.toMatch(/Cold race-day/i)
    expect(output.textContent).not.toMatch(/High wind/i)
    expect(output.textContent).not.toMatch(/Altitude.*m/i)
  })

  it('conditions persist to localStorage independent of race-format key', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /Race-day conditions/i }))
    fireEvent.change(screen.getByLabelText(/TEMP \(°C\)/i), { target: { value: '30' } })
    const stored = JSON.parse(localStorage.getItem('sporeus-raceConditions') || '{}')
    expect(stored.tempC).toBe('30')
    expect(stored.expanded).toBe(true)
    // race-format key remains untouched
    expect(localStorage.getItem('sporeus-eliteProgram-raceStrategy')).toBeNull()
  })
})
