// @vitest-environment jsdom
// ─── OverlookedSessionTypeCard.test.jsx — render tests for dropped-type card ─
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import OverlookedSessionTypeCard from '../dashboard/OverlookedSessionTypeCard.jsx'

const TODAY = '2026-05-19'

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
      <OverlookedSessionTypeCard {...props} />
    </LangCtx.Provider>
  )
}

function addDaysIso(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function makeEntry(daysAgo, type) {
  return { date: addDaysIso(TODAY, -daysAgo), type }
}

function withBaselineRuns(extras = []) {
  const log = []
  for (let i = 0; i < 10; i++) log.push(makeEntry(40 + i, 'easy run'))
  log.push(makeEntry(3, 'easy run'))
  return log.concat(extras)
}

// ─── null gating ────────────────────────────────────────────────────────────
describe('OverlookedSessionTypeCard — null gating', () => {
  it('still renders on empty log (INSUFFICIENT_HISTORY)', () => {
    renderCard({ log: [] })
    const card = screen.getByRole('region')
    expect(card.querySelector('[data-band]').getAttribute('data-band')).toBe(
      'INSUFFICIENT_HISTORY',
    )
  })

  it('renders nothing when log is omitted (defaults to empty)', () => {
    // log defaults to [] → INSUFFICIENT_HISTORY, still renders
    renderCard({})
    const card = screen.getByRole('region')
    expect(card).toBeInTheDocument()
  })
})

// ─── INSUFFICIENT_HISTORY band ──────────────────────────────────────────────
describe('OverlookedSessionTypeCard — INSUFFICIENT_HISTORY', () => {
  it('renders INSUFFICIENT_HISTORY band when <10 baseline sessions', () => {
    const log = []
    for (let i = 0; i < 6; i++) log.push(makeEntry(40 + i, 'easy run'))
    renderCard({ log })
    const card = screen.getByRole('region')
    expect(card.querySelector('[data-band]').getAttribute('data-band')).toBe(
      'INSUFFICIENT_HISTORY',
    )
    expect(card.textContent).toMatch(/NEED MORE HISTORY/)
  })
})

// ─── COMPLETE_REPERTOIRE band ──────────────────────────────────────────────
describe('OverlookedSessionTypeCard — COMPLETE_REPERTOIRE', () => {
  it('renders COMPLETE_REPERTOIRE band with positive message', () => {
    const log = withBaselineRuns()
    renderCard({ log })
    const card = screen.getByRole('region', { name: /Dropped session types/i })
    expect(card.getAttribute('data-card')).toBe('overlooked-session-type')
    expect(card.querySelector('[data-band]').getAttribute('data-band')).toBe(
      'COMPLETE_REPERTOIRE',
    )
    expect(card.textContent).toMatch(/COMPLETE REPERTOIRE/)
    expect(
      card.querySelector('[data-positive-message="true"]'),
    ).toBeInTheDocument()
    expect(card.textContent).toMatch(/nothing has fallen off/i)
  })

  it('shows 0 as the headline stat on COMPLETE_REPERTOIRE', () => {
    const log = withBaselineRuns()
    renderCard({ log })
    const card = screen.getByRole('region')
    expect(card.querySelector('[data-stat="overlooked-count"]').textContent).toBe('0')
  })
})

// ─── MINOR_DROPS band ──────────────────────────────────────────────────────
describe('OverlookedSessionTypeCard — MINOR_DROPS', () => {
  it('renders MINOR_DROPS band for 1 dropped type', () => {
    const log = withBaselineRuns([
      makeEntry(60, 'strength'),
      makeEntry(80, 'strength'),
      makeEntry(100, 'strength'),
    ])
    renderCard({ log })
    const card = screen.getByRole('region')
    expect(card.querySelector('[data-band]').getAttribute('data-band')).toBe(
      'MINOR_DROPS',
    )
    expect(card.textContent).toMatch(/MINOR DROPS/)
  })

  it('renders chip for the dropped type with baseline count + days-ago', () => {
    const log = withBaselineRuns([
      makeEntry(60, 'strength'),
      makeEntry(80, 'strength'),
      makeEntry(100, 'strength'),
    ])
    renderCard({ log })
    const item = screen.getByRole('listitem')
    expect(item.getAttribute('data-overlooked-type')).toBe('strength')
    expect(item.textContent).toMatch(/3 sessions/)
    expect(item.textContent).toMatch(/60 days ago/)
    // Positive-message block should NOT be present on MINOR_DROPS
    const card = screen.getByRole('region')
    expect(card.querySelector('[data-positive-message="true"]')).toBeNull()
  })
})

// ─── MULTIPLE_DROPS band ────────────────────────────────────────────────────
describe('OverlookedSessionTypeCard — MULTIPLE_DROPS', () => {
  it('renders MULTIPLE_DROPS band for ≥3 dropped types', () => {
    const log = withBaselineRuns([
      makeEntry(60, 'strength'),
      makeEntry(80, 'strength'),
      makeEntry(100, 'strength'),
      makeEntry(70, 'sprints'),
      makeEntry(90, 'sprints'),
      makeEntry(110, 'sprints'),
      makeEntry(90, 'hills'),
      makeEntry(100, 'hills'),
      makeEntry(120, 'hills'),
    ])
    renderCard({ log })
    const card = screen.getByRole('region')
    expect(card.querySelector('[data-band]').getAttribute('data-band')).toBe(
      'MULTIPLE_DROPS',
    )
    expect(card.textContent).toMatch(/MULTIPLE DROPS/)
    expect(screen.getAllByRole('listitem').length).toBe(3)
  })
})

// ─── Turkish ────────────────────────────────────────────────────────────────
describe('OverlookedSessionTypeCard — Turkish', () => {
  it('renders Turkish title + band + hint + chips', () => {
    const log = withBaselineRuns([
      makeEntry(60, 'strength'),
      makeEntry(80, 'strength'),
      makeEntry(100, 'strength'),
    ])
    renderCard({ log }, 'tr')
    expect(screen.getByText(/UNUTULAN ANTRENMAN TÜRLERİ/)).toBeInTheDocument()
    expect(screen.getByText(/AZ KAYIP/)).toBeInTheDocument()
    const card = screen.getByRole('region')
    expect(card.textContent).toMatch(/3 seans/)
    expect(card.textContent).toMatch(/60 gün önce/)
  })

  it('renders Turkish positive message on COMPLETE_REPERTOIRE', () => {
    const log = withBaselineRuns()
    renderCard({ log }, 'tr')
    expect(
      screen.getByText(/Tüm tekrar eden seans türleri korunuyor/i),
    ).toBeInTheDocument()
  })
})

// ─── accessibility + citation ───────────────────────────────────────────────
describe('OverlookedSessionTypeCard — accessibility + citation', () => {
  it('exposes region role with English aria-label', () => {
    const log = withBaselineRuns()
    renderCard({ log })
    const card = screen.getByRole('region', { name: 'Dropped session types' })
    expect(card).toBeInTheDocument()
  })

  it('exposes region role with Turkish aria-label', () => {
    const log = withBaselineRuns()
    renderCard({ log }, 'tr')
    const card = screen.getByRole('region', { name: 'Unutulan antrenman türleri' })
    expect(card).toBeInTheDocument()
  })

  it('renders Bompa 2018; Issurin 2010 citation footer', () => {
    const log = withBaselineRuns([
      makeEntry(60, 'strength'),
      makeEntry(80, 'strength'),
      makeEntry(100, 'strength'),
    ])
    renderCard({ log })
    expect(screen.getByText(/Bompa 2018; Issurin 2010/)).toBeInTheDocument()
  })

  it('uses data-card="overlooked-session-type" identifier', () => {
    const log = withBaselineRuns()
    renderCard({ log })
    const card = screen.getByRole('region')
    expect(card.getAttribute('data-card')).toBe('overlooked-session-type')
  })

  it('has aria-live="polite" on the band hint', () => {
    const log = withBaselineRuns()
    renderCard({ log })
    const card = screen.getByRole('region')
    expect(card.querySelector('[aria-live="polite"]')).not.toBeNull()
  })
})
