// @vitest-environment jsdom
// ─── CoachAthleteProgramCard.test.jsx — coach-side ingest of v=1 envelope ───
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import CoachAthleteProgramCard from '../coach/CoachAthleteProgramCard.jsx'

beforeEach(() => {
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  localStorage.clear()
})

function renderCard(lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <CoachAthleteProgramCard />
    </LangCtx.Provider>
  )
}

function validEnvelope(overrides = {}) {
  return {
    v: 1,
    kind: 'sporeus-elite-program-share',
    athleteSnapshot: {
      sport: 'run',
      distanceM: 10000,
      currentTime: 3000,
      targetTime: 2400,
      raceDate: '2026-08-15',
      weeksAvailable: 14,
      weeksNeeded: 12,
      feasibilityBand: 'realistic',
    },
    physiology: {
      currentVDOT: 50, targetVDOT: 56,
      currentFTP: null, targetFTP: null,
      currentCSS: null, targetCSS: null,
    },
    phases: [
      { phase: 'Base',  weeks: 6 },
      { phase: 'Build', weeks: 4 },
      { phase: 'Peak',  weeks: 2 },
      { phase: 'Taper', weeks: 2 },
    ],
    synthetic: null,
    lifecycle: { state: 'draft', percentComplete: 0, daysToRace: 100 },
    citation: 'Daniels 2014',
    generatedAt: '2026-05-07',
    ...overrides,
  }
}

describe('CoachAthleteProgramCard — empty mode', () => {
  it('renders textarea + ingest button when no envelope ingested', () => {
    renderCard()
    expect(screen.getByLabelText(/Plan summary JSON/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Ingest plan summary/i })).toBeInTheDocument()
  })

  it('ingest button is disabled when textarea is empty', () => {
    renderCard()
    const btn = screen.getByRole('button', { name: /Ingest plan summary/i })
    expect(btn).toBeDisabled()
  })

  it('TR copy renders when lang=tr', () => {
    renderCard('tr')
    expect(screen.getByText(/Sporcunun plan özetini buraya yapıştır/i)).toBeInTheDocument()
    const btn = screen.getByRole('button', { name: /Plan özetini içe aktar/i })
    expect(btn).toBeInTheDocument()
  })
})

describe('CoachAthleteProgramCard — ingest happy path', () => {
  it('pasting valid envelope + clicking ingest switches to loaded mode', () => {
    renderCard()
    const ta = screen.getByLabelText(/Plan summary JSON/i)
    fireEvent.change(ta, { target: { value: JSON.stringify(validEnvelope()) } })
    const btn = screen.getByRole('button', { name: /Ingest plan summary/i })
    expect(btn).not.toBeDisabled()
    fireEvent.click(btn)
    // Should be in loaded mode — find the wrapper region
    expect(document.querySelector('[data-coach-athlete-program="loaded"]')).not.toBeNull()
    expect(document.querySelector('[data-coach-athlete-program="empty"]')).toBeNull()
  })

  it('loaded mode renders sport, currentTime, targetTime, raceDate', () => {
    renderCard()
    fireEvent.change(screen.getByLabelText(/Plan summary JSON/i), {
      target: { value: JSON.stringify(validEnvelope()) },
    })
    fireEvent.click(screen.getByRole('button', { name: /Ingest plan summary/i }))
    expect(document.querySelector('[data-coach-sport="run"]')).not.toBeNull()
    expect(document.querySelector('[data-coach-current-time]').textContent).toBe('50:00')
    expect(document.querySelector('[data-coach-target-time]').textContent).toBe('40:00')
    expect(document.querySelector('[data-coach-race-date]').textContent).toBe('2026-08-15')
  })

  it('loaded mode renders physiology row with VDOT for run sport', () => {
    renderCard()
    fireEvent.change(screen.getByLabelText(/Plan summary JSON/i), {
      target: { value: JSON.stringify(validEnvelope()) },
    })
    fireEvent.click(screen.getByRole('button', { name: /Ingest plan summary/i }))
    const phys = document.querySelector('[data-coach-physiology="run"]')
    expect(phys).not.toBeNull()
    expect(phys.textContent).toMatch(/VDOT/)
    expect(phys.textContent).toMatch(/50/)
    expect(phys.textContent).toMatch(/56/)
  })

  it('phase split bar renders 4 phases', () => {
    renderCard()
    fireEvent.change(screen.getByLabelText(/Plan summary JSON/i), {
      target: { value: JSON.stringify(validEnvelope()) },
    })
    fireEvent.click(screen.getByRole('button', { name: /Ingest plan summary/i }))
    const split = document.querySelector('[data-coach-phase-split]')
    expect(split).not.toBeNull()
    const aria = split.getAttribute('aria-label') || ''
    expect(aria).toMatch(/BASE/)
    expect(aria).toMatch(/BUILD/)
    expect(aria).toMatch(/PEAK/)
    expect(aria).toMatch(/TAPER/)
  })

  it('CLEAR button returns to empty mode', () => {
    renderCard()
    fireEvent.change(screen.getByLabelText(/Plan summary JSON/i), {
      target: { value: JSON.stringify(validEnvelope()) },
    })
    fireEvent.click(screen.getByRole('button', { name: /Ingest plan summary/i }))
    expect(document.querySelector('[data-coach-athlete-program="loaded"]')).not.toBeNull()
    const clearBtn = screen.getByRole('button', { name: /Clear athlete program/i })
    fireEvent.click(clearBtn)
    expect(document.querySelector('[data-coach-athlete-program="empty"]')).not.toBeNull()
    expect(document.querySelector('[data-coach-athlete-program="loaded"]')).toBeNull()
  })
})

describe('CoachAthleteProgramCard — error paths', () => {
  it('invalid JSON shows bilingual error message and clears textarea', () => {
    renderCard()
    fireEvent.change(screen.getByLabelText(/Plan summary JSON/i), {
      target: { value: '{not valid json' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Ingest plan summary/i }))
    const err = document.querySelector('[data-coach-share-error="invalid-json"]')
    expect(err).not.toBeNull()
    expect(err.textContent).toMatch(/Could not parse/i)
    // Textarea should be cleared
    expect(screen.getByLabelText(/Plan summary JSON/i).value).toBe('')
  })

  it('wrong-kind JSON shows wrong-kind error message', () => {
    renderCard()
    fireEvent.change(screen.getByLabelText(/Plan summary JSON/i), {
      target: { value: JSON.stringify({ ...validEnvelope(), kind: 'something-else' }) },
    })
    fireEvent.click(screen.getByRole('button', { name: /Ingest plan summary/i }))
    const err = document.querySelector('[data-coach-share-error="wrong-kind"]')
    expect(err).not.toBeNull()
    expect(err.textContent).toMatch(/Not a Sporeus elite program share/i)
  })
})
