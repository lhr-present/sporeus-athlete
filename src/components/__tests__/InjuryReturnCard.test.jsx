// @vitest-environment jsdom
// ─── InjuryReturnCard.test.jsx — render tests for the EP-10 UI surface ──────
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import InjuryReturnCard from '../dashboard/InjuryReturnCard.jsx'

const STORAGE_KEY = 'sporeus-injuryReturnRamp'

beforeEach(() => { localStorage.clear() })
afterEach(() => { cleanup(); localStorage.clear() })

function renderCard(props = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <InjuryReturnCard log={[]} profile={{ primarySport: 'Running' }} {...props} />
    </LangCtx.Provider>
  )
}

describe('InjuryReturnCard — collapsed state', () => {
  it('renders the toggle entry point with sport-agnostic title', () => {
    renderCard()
    const region = screen.getByRole('region', { name: /Injury return ramp/i })
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('data-injury-return-card')).toBe('collapsed')
    expect(screen.getByRole('button', { name: /Returning from injury/i })).toBeInTheDocument()
  })

  it('does NOT render inputs while collapsed', () => {
    renderCard()
    expect(screen.queryByLabelText(/DAYS OFF/i)).toBeNull()
    expect(screen.queryByLabelText(/INJURY TYPE/i)).toBeNull()
  })
})

describe('InjuryReturnCard — expanded form', () => {
  it('toggling renders the form inputs', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /Returning from injury/i }))
    expect(screen.getByLabelText(/DAYS OFF/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/INJURY TYPE/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/BODY REGION/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/PRE-INJURY CTL/i)).toBeInTheDocument()
  })

  it('shows helper text until inputs are sufficient', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /Returning from injury/i }))
    expect(document.querySelector('[data-injury-ramp-output]')).toBeNull()
    expect(screen.getByText(/Fill in days off \+ injury type/i)).toBeInTheDocument()
  })

  it('renders the 5-week ramp table once daysOff + injuryType + CTL are set', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /Returning from injury/i }))
    fireEvent.change(screen.getByLabelText(/DAYS OFF/i), { target: { value: '21' } })
    fireEvent.change(screen.getByLabelText(/INJURY TYPE/i), { target: { value: 'soft-tissue' } })
    fireEvent.change(screen.getByLabelText(/PRE-INJURY CTL/i), { target: { value: '60' } })
    const output = document.querySelector('[data-injury-ramp-output]')
    expect(output).not.toBeNull()
    // 5-week ramp body — rows for W1..W5
    expect(output.textContent).toMatch(/W1/)
    expect(output.textContent).toMatch(/W5/)
    // Soligard citation
    expect(output.textContent).toMatch(/Soligard 2016/)
    // RTS criteria list contains the strength criterion
    expect(output.textContent).toMatch(/Strength ≥90%/)
    // Red-flag block present
    expect(output.textContent).toMatch(/RED FLAGS/)
  })

  it('impact injury to lower-leg adds the 2-week non-impact preamble (total 7 weeks)', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /Returning from injury/i }))
    fireEvent.change(screen.getByLabelText(/DAYS OFF/i), { target: { value: '21' } })
    fireEvent.change(screen.getByLabelText(/INJURY TYPE/i), { target: { value: 'impact' } })
    fireEvent.change(screen.getByLabelText(/BODY REGION/i), { target: { value: 'lower-leg' } })
    fireEvent.change(screen.getByLabelText(/PRE-INJURY CTL/i), { target: { value: '60' } })
    const output = document.querySelector('[data-injury-ramp-output]')
    expect(output).not.toBeNull()
    expect(output.textContent).toMatch(/7-week return protocol/i)
    // The preamble weeks are marked with ⓟ
    expect(output.textContent).toMatch(/W1.*ⓟ/)
    expect(output.textContent).toMatch(/W7/)
  })
})

describe('InjuryReturnCard — bilingual', () => {
  it('renders Turkish labels + Turkish citation when lang=tr', () => {
    renderCard({}, 'tr')
    const region = screen.getByRole('region', { name: /Yaralanmadan dönüş rampası/i })
    expect(region).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Yaralanmadan dönüyor musun/i }))
    expect(screen.getByLabelText(/GÜN KAYBI/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/YARALANMA TİPİ/i)).toBeInTheDocument()
  })
})

describe('InjuryReturnCard — persistence', () => {
  it('expanded state + inputs persist to localStorage', () => {
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /Returning from injury/i }))
    fireEvent.change(screen.getByLabelText(/DAYS OFF/i), { target: { value: '14' } })
    fireEvent.change(screen.getByLabelText(/INJURY TYPE/i), { target: { value: 'overuse' } })
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).toBeTruthy()
    const stored = JSON.parse(raw)
    expect(stored.expanded).toBe(true)
    expect(stored.daysOff).toBe('14')
    expect(stored.injuryType).toBe('overuse')
  })
})
