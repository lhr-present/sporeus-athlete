// @vitest-environment jsdom
// ─── CrossSportRecoveryGapCard.test.jsx — card render tests ────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import CrossSportRecoveryGapCard from '../dashboard/CrossSportRecoveryGapCard.jsx'

const TODAY = '2026-05-18'

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function renderCard(props = {}, lang = 'en') {
  const value = { t: (k) => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <CrossSportRecoveryGapCard {...props} />
    </LangCtx.Provider>
  )
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

describe('CrossSportRecoveryGapCard — null gating', () => {
  it('renders nothing when log is empty', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders nothing when only one sport has ever been logged', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1), type: 'Easy run' },
      { date: isoMinusDays(TODAY, 5), type: 'Long run' },
    ]
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when only "other" sessions are present', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1), type: 'Yoga' },
      { date: isoMinusDays(TODAY, 4), type: 'Mobility' },
    ]
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })
})

describe('CrossSportRecoveryGapCard — multi-sport render', () => {
  it('renders one row per logged sport with anchors + status', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1),  type: 'Easy run' },         // FRESH
      { date: isoMinusDays(TODAY, 1),  type: 'Indoor cycling' },   // FRESH
      { date: isoMinusDays(TODAY, 10), type: 'Swim drills' },      // OK
      { date: isoMinusDays(TODAY, 30), type: 'Gym squats' },       // STALE
    ]
    renderCard({ log })

    const card = screen.getByRole('region', { name: /Cross-sport recovery gap/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-cross-sport-gap-card')).not.toBeNull()
    expect(card.textContent).toMatch(/CROSS-SPORT GAP/)

    const rows = card.querySelectorAll('[data-sport-row]')
    expect(rows.length).toBe(4)

    const byKey = {}
    rows.forEach((r) => { byKey[r.getAttribute('data-sport-key')] = r })

    expect(byKey.run.getAttribute('data-sport-status')).toBe('FRESH')
    expect(byKey.run.getAttribute('data-days-since')).toBe('1')

    expect(byKey.bike.getAttribute('data-sport-status')).toBe('FRESH')
    expect(byKey.bike.getAttribute('data-days-since')).toBe('1')

    expect(byKey.swim.getAttribute('data-sport-status')).toBe('OK')
    expect(byKey.swim.getAttribute('data-days-since')).toBe('10')

    expect(byKey.strength.getAttribute('data-sport-status')).toBe('STALE')
    expect(byKey.strength.getAttribute('data-days-since')).toBe('30')

    // Citation footer present
    expect(card.textContent).toMatch(/Bompa 2018/)
    expect(card.textContent).toMatch(/Hreljac 2004/)
  })

  it('shows the STALE interpretation hint when any sport is STALE', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1),  type: 'Easy run' },
      { date: isoMinusDays(TODAY, 30), type: 'Long ride' }, // bike STALE (warn=21)
    ]
    renderCard({ log })
    expect(
      screen.getByText(/Long gap detected\. Consider working that discipline back in this week\./i)
    ).toBeInTheDocument()
  })

  it('shows the all-FRESH hint when every sport is FRESH', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1), type: 'Easy run' },
      { date: isoMinusDays(TODAY, 1), type: 'Bike Z2' },
    ]
    renderCard({ log })
    expect(
      screen.getByText(/Good rotation across sports — variety reduces overuse risk\./i)
    ).toBeInTheDocument()
  })

  it('shows the "healthy spacing" hint when mixed FRESH/OK (no STALE)', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1), type: 'Easy run' },  // FRESH
      { date: isoMinusDays(TODAY, 8), type: 'Swim drills' },// OK (swim ideal=4, warn=14)
    ]
    renderCard({ log })
    expect(
      screen.getByText(/Healthy spacing across disciplines\./i)
    ).toBeInTheDocument()
  })
})

describe('CrossSportRecoveryGapCard — Turkish', () => {
  it('renders Turkish title + status labels + hint', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1),  type: 'Easy run' },    // FRESH → TAZE
      { date: isoMinusDays(TODAY, 30), type: 'Long ride' },   // STALE → BAYAT
    ]
    renderCard({ log }, 'tr')

    expect(screen.getByText(/SPORLAR ARASI BOŞLUK/)).toBeInTheDocument()
    // TAZE for run-FRESH row, BAYAT for bike-STALE row
    expect(screen.getByText(/TAZE/)).toBeInTheDocument()
    expect(screen.getByText(/BAYAT/)).toBeInTheDocument()
    // Turkish interpretation hint
    expect(
      screen.getByText(/Uzun boşluk tespit edildi\. O disiplini bu hafta tekrar programa al\./i)
    ).toBeInTheDocument()
    // Turkish sport labels
    expect(screen.getByText(/Koşu/i)).toBeInTheDocument()
    expect(screen.getByText(/Bisiklet/i)).toBeInTheDocument()
  })
})
