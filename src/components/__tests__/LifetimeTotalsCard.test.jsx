// @vitest-environment jsdom
// ─── LifetimeTotalsCard.test.jsx — Dashboard surface tests ───────────────────
//
// Covers: empty/null log (render null), totals aggregation render,
// tenure "Xy Ymo" shape (≥1 year), tenure "Xmo" shape (<1 year),
// data anchors, Turkish bilingual render.
//
// System clock frozen so `analyzeLifetimeTotals({ log })` (called
// without an explicit `today`) sees a deterministic relative timeline.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import LifetimeTotalsCard from '../dashboard/LifetimeTotalsCard.jsx'

const TODAY = '2026-05-14'

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function daysAgo(n) {
  const d = new Date(`${TODAY}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function sess(n, overrides = {}) {
  return {
    date: daysAgo(n),
    durationMin: 60,
    distanceKm:  10,
    tss:         50,
    ...overrides,
  }
}

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <LifetimeTotalsCard log={log} />
    </LangCtx.Provider>
  )
}

describe('LifetimeTotalsCard — guards', () => {
  it('renders nothing for an empty log', () => {
    const { container } = renderCard([])
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-lifetime-totals-card]')).toBeNull()
  })

  it('renders nothing when analyzer returns null (null log)', () => {
    const { container } = renderCard(null)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when no log entries have parseable dates', () => {
    const log = [{ durationMin: 60, distanceKm: 10, tss: 50 }]
    const { container } = renderCard(log)
    expect(container.firstChild).toBeNull()
  })
})

describe('LifetimeTotalsCard — render with data', () => {
  it('renders region, title, citation and stat anchors', () => {
    const log = [
      sess(0,   { durationMin: 60, distanceKm: 10, tss: 50 }),
      sess(30,  { durationMin: 90, distanceKm: 15, tss: 75 }),
      sess(60,  { durationMin: 45, distanceKm:  8, tss: 40 }),
    ]
    renderCard(log)

    const card = document.querySelector('[data-lifetime-totals-card]')
    expect(card).not.toBeNull()

    const region = screen.getByRole('region', { name: /Lifetime training totals/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/LIFETIME · ALL TIME/i)

    // Totals: 3 sessions, 195min = 3h, 33km, 165 TSS.
    expect(card.getAttribute('data-total-sessions')).toBe('3')
    expect(card.getAttribute('data-total-hours')).toBe('3')
    expect(card.getAttribute('data-total-distance-km')).toBe('33')
    expect(card.getAttribute('data-total-tss')).toBe('165')
    expect(card.getAttribute('data-first-session-date')).toBe(daysAgo(60))
    // 60 days back + today inclusive = 61.
    expect(card.getAttribute('data-tenure-days')).toBe('61')

    // Rendered stat values somewhere in the card text.
    expect(card.textContent).toMatch(/3h/)
    expect(card.textContent).toMatch(/33km/)
    expect(card.textContent).toMatch(/165/)

    // Citation footer.
    expect(card.textContent).toMatch(/Bandura 1997/)

    // Motivational hint.
    expect(card.textContent).toMatch(/training capital/i)
  })
})

describe('LifetimeTotalsCard — tenure format', () => {
  it('uses "Xy Ymo · since YYYY-MM-DD" when tenure ≥ 1 year', () => {
    // ~2 years 3 months ago.
    const log = [
      sess(820, { durationMin: 60, distanceKm: 10, tss: 50 }),
      sess(0,   { durationMin: 60, distanceKm: 10, tss: 50 }),
    ]
    renderCard(log)
    const card = document.querySelector('[data-lifetime-totals-card]')
    expect(card).not.toBeNull()
    // 820/365.25 ≈ 2.245y → floor 2, rem ≈ 0.245 * 12 ≈ 3mo.
    expect(card.textContent).toMatch(/2y 3mo · since /)
    expect(card.textContent).toContain(daysAgo(820))
  })

  it('uses "Xmo · since YYYY-MM-DD" when tenure < 1 year', () => {
    // 90 days back → ~3 months.
    const log = [
      sess(90, { durationMin: 60, distanceKm: 10, tss: 50 }),
      sess(0,  { durationMin: 60, distanceKm: 10, tss: 50 }),
    ]
    renderCard(log)
    const card = document.querySelector('[data-lifetime-totals-card]')
    expect(card).not.toBeNull()
    // 91 days / 30.4375 ≈ 2.99 → rounds to 3mo.
    expect(card.textContent).toMatch(/3mo · since /)
    expect(card.textContent).toContain(daysAgo(90))
    // Should NOT have a years prefix.
    expect(card.textContent).not.toMatch(/\b\dy \d+mo · since/)
  })
})

describe('LifetimeTotalsCard — bilingual', () => {
  it('renders Turkish heading, stat labels, hint, and tenure shape', () => {
    const log = [
      sess(820, { durationMin: 60, distanceKm: 10, tss: 50 }),
      sess(0,   { durationMin: 60, distanceKm: 10, tss: 50 }),
    ]
    renderCard(log, 'tr')

    const region = screen.getByRole('region', { name: /Yaşam boyu antrenman/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/YAŞAM BOYU · TÜM ZAMAN/)

    // Turkish tenure shape: "Xy Ya · YYYY-MM-DD'den beri"
    expect(region.textContent).toMatch(/2y 3a · /)
    expect(region.textContent).toMatch(/'den beri/)

    // Turkish stat labels (uppercased by CSS but DOM text is the source).
    expect(region.textContent).toMatch(/seans/)
    expect(region.textContent).toMatch(/saat/)
    expect(region.textContent).toMatch(/mesafe/)

    // Turkish hint.
    expect(region.textContent).toMatch(/antrenman sermayendir/)
  })

  it('renders Turkish "Xa" tenure shape when < 1 year', () => {
    const log = [
      sess(90, { durationMin: 60, distanceKm: 10, tss: 50 }),
      sess(0,  { durationMin: 60, distanceKm: 10, tss: 50 }),
    ]
    renderCard(log, 'tr')
    const card = document.querySelector('[data-lifetime-totals-card]')
    expect(card.textContent).toMatch(/3a · /)
    expect(card.textContent).toMatch(/'den beri/)
  })
})
