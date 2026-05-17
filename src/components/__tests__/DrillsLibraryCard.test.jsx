// @vitest-environment jsdom
// ─── DrillsLibraryCard.test.jsx — render tests for the drills surface ──────
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import DrillsLibraryCard from '../dashboard/DrillsLibraryCard.jsx'

afterEach(() => {
  cleanup()
})

function renderCard(props = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <DrillsLibraryCard {...props} />
    </LangCtx.Provider>
  )
}

describe('DrillsLibraryCard — gating', () => {
  it('renders nothing when profile is empty', () => {
    const { container } = renderCard({ profile: {} })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when profile.primarySport is undefined', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for an unsupported primarySport', () => {
    const { container } = renderCard({ profile: { primarySport: 'Parkour' } })
    expect(container.firstChild).toBeNull()
  })
})

describe('DrillsLibraryCard — runner profile', () => {
  it('renders the card and at least one drill row for a runner', () => {
    renderCard({ profile: { primarySport: 'Running' } })
    const region = screen.getByRole('region', {
      name: /Sport-specific technique drills library/i,
    })
    expect(region).toBeInTheDocument()

    // The first run drill ("A-skip") must be present in the DOM,
    // not lazy-rendered behind an expand toggle.
    const drillRows = region.querySelectorAll('[data-drill-name]')
    expect(drillRows.length).toBeGreaterThan(0)
    expect(region.textContent).toMatch(/A-skip/)
  })

  it('exposes the data-drills-library-card test anchor', () => {
    renderCard({ profile: { primarySport: 'Running' } })
    const anchor = document.querySelector('[data-drills-library-card]')
    expect(anchor).not.toBeNull()
    // Value reflects collapse state — collapsed by default.
    expect(anchor.getAttribute('data-drills-library-card')).toBe('collapsed')
  })

  it('renders the DRILLS_CITATION attribution at the bottom', () => {
    renderCard({ profile: { primarySport: 'Running' } })
    const region = screen.getByRole('region', {
      name: /Sport-specific technique drills library/i,
    })
    // Citation references core authors per the pure-fn export.
    expect(region.textContent).toMatch(/Daniels 2014/)
    expect(region.textContent).toMatch(/Maglischo 2003/)
  })
})

describe('DrillsLibraryCard — bilingual', () => {
  it('renders the Turkish phase header (TEMEL) when lang=tr', () => {
    renderCard({ profile: { primarySport: 'Running' } }, 'tr')
    const region = screen.getByRole('region', {
      name: /Spora özel teknik drilleri/i,
    })
    expect(region).toBeInTheDocument()
    // Turkish "Base" section header.
    expect(region.textContent).toMatch(/TEMEL/)
    // English header should NOT be present in tr mode.
    expect(region.textContent).not.toMatch(/\bBASE\b/)
  })

  it('renders English phase header (BASE) by default', () => {
    renderCard({ profile: { primarySport: 'Running' } })
    const region = screen.getByRole('region', {
      name: /Sport-specific technique drills library/i,
    })
    expect(region.textContent).toMatch(/\bBASE\b/)
  })
})

describe('DrillsLibraryCard — triathlon merge', () => {
  it('renders disciplines from run, bike, and swim for a triathlete', () => {
    renderCard({ profile: { primarySport: 'Triathlon' } })
    const region = screen.getByRole('region', {
      name: /Sport-specific technique drills library/i,
    })
    const disciplines = new Set(
      Array.from(region.querySelectorAll('[data-drill-discipline]'))
        .map(el => el.getAttribute('data-drill-discipline'))
    )
    expect(disciplines.has('run')).toBe(true)
    expect(disciplines.has('bike')).toBe(true)
    expect(disciplines.has('swim')).toBe(true)
  })
})
