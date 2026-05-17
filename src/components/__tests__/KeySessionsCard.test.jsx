// @vitest-environment jsdom
// ─── KeySessionsCard.test.jsx — render tests for the key-session library ────
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import KeySessionsCard from '../dashboard/KeySessionsCard.jsx'

afterEach(() => {
  cleanup()
})

function renderCard(props = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <KeySessionsCard {...props} />
    </LangCtx.Provider>
  )
}

describe('KeySessionsCard — gating', () => {
  it('renders nothing when profile is empty', () => {
    const { container } = renderCard({ profile: {} })
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-key-sessions-card]')).toBeNull()
  })

  it('renders nothing when profile is undefined', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for an unsupported sport', () => {
    const { container } = renderCard({ profile: { primarySport: 'Chess' } })
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-key-sessions-card]')).toBeNull()
  })
})

describe('KeySessionsCard — rendering for supported sports', () => {
  it('renders the card region for a runner profile', () => {
    renderCard({ profile: { primarySport: 'Running' } })
    const region = screen.getByRole('region', { name: /Key session library/i })
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('data-key-sessions-card')).toBe('run')
  })

  it('renders at least one expected session label for a runner profile', () => {
    renderCard({ profile: { primarySport: 'Running' } })
    // From RUN_BASE — stable session name
    expect(screen.getByText(/Long aerobic run/i)).toBeInTheDocument()
    // From RUN_BUILD threshold session
    expect(screen.getByText(/Threshold 2x20 min/i)).toBeInTheDocument()
  })

  it('groups sessions by training phase with data anchors', () => {
    renderCard({ profile: { primarySport: 'Running' } })
    expect(document.querySelector('[data-key-session-phase="Base"]')).not.toBeNull()
    expect(document.querySelector('[data-key-session-phase="Build"]')).not.toBeNull()
    expect(document.querySelector('[data-key-session-phase="Peak"]')).not.toBeNull()
    expect(document.querySelector('[data-key-session-phase="Taper"]')).not.toBeNull()
  })

  it('tags individual sessions with a session-type anchor', () => {
    renderCard({ profile: { primarySport: 'Running' } })
    // VO2 in the peak phase comes from run-peak-vo2-5x3 / 6x800
    expect(document.querySelector('[data-key-session-type="vo2"]')).not.toBeNull()
    // Threshold in the build phase
    expect(document.querySelector('[data-key-session-type="threshold"]')).not.toBeNull()
    // Long aerobic in the base phase
    expect(document.querySelector('[data-key-session-type="long"]')).not.toBeNull()
  })

  it('renders the card for a cyclist profile (FTP-based bike library)', () => {
    renderCard({ profile: { primarySport: 'Cycling' } })
    const region = screen.getByRole('region', { name: /Key session library/i })
    expect(region.getAttribute('data-key-sessions-card')).toBe('bike')
  })

  it('renders triathlon with discipline-tagged sessions', () => {
    renderCard({ profile: { primarySport: 'Triathlon' } })
    const region = screen.getByRole('region', { name: /Key session library/i })
    expect(region.getAttribute('data-key-sessions-card')).toBe('triathlon')
    // Tri merges swim + bike + run — Base phase should have all three
    const basePhase = document.querySelector('[data-key-session-phase="Base"]')
    expect(basePhase).not.toBeNull()
  })
})

describe('KeySessionsCard — citation', () => {
  it('renders the KEY_SESSION_CITATION at the bottom', () => {
    renderCard({ profile: { primarySport: 'Running' } })
    const citation = document.querySelector('[data-key-sessions-citation]')
    expect(citation).not.toBeNull()
    expect(citation.textContent).toMatch(/Daniels 2014/)
    expect(citation.textContent).toMatch(/Coggan 2010/)
  })
})

describe('KeySessionsCard — bilingual', () => {
  it('renders Turkish title when lang=tr', () => {
    renderCard({ profile: { primarySport: 'Running' } }, 'tr')
    const region = screen.getByRole('region', { name: /Anahtar seans kütüphanesi/i })
    expect(region).toBeInTheDocument()
    // Turkish phase header label
    expect(screen.getByText(/TEMEL/)).toBeInTheDocument()
    // Turkish session name from RUN_BASE
    expect(screen.getByText(/Uzun aerobik koşu/i)).toBeInTheDocument()
  })

  it('renders English title by default', () => {
    renderCard({ profile: { primarySport: 'Running' } })
    expect(screen.getByText(/KEY SESSION LIBRARY/i)).toBeInTheDocument()
    expect(screen.getByText(/BASE/)).toBeInTheDocument()
  })
})
