// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import TsbFreshnessBandCard from '../dashboard/TsbFreshnessBandCard.jsx'

// Anchor time deterministically so EMA-based TSB values are reproducible.
const TODAY = '2026-05-17'

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function renderCard(props = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <TsbFreshnessBandCard {...props} />
    </LangCtx.Provider>
  )
}

function isoOffset(days) {
  const d = new Date(TODAY + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function dailyBlock({ days, tss, lastOffset = 0 }) {
  const out = []
  for (let i = days - 1; i >= 0; i--) {
    out.push({ date: isoOffset(-i - lastOffset), tss })
  }
  return out
}

describe('TsbFreshnessBandCard — empty state', () => {
  it('renders nothing when the log is empty', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when log is undefined', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })
})

describe('TsbFreshnessBandCard — band rendering', () => {
  it('renders the FRESH band (green) for a tapered athlete', () => {
    // 60d high load then 21d rest → big positive TSB → VERY_FRESH/FRESH
    const log = dailyBlock({ days: 40, tss: 120, lastOffset: 12 })
    renderCard({ log })
    const card = document.querySelector('[data-tsb-freshness-band-card]')
    expect(card).not.toBeNull()
    const band = card.getAttribute('data-tsb-band')
    expect(['VERY_FRESH', 'FRESH']).toContain(band)
    // Green border for fresh bands (#5bc25b → rgb(91, 194, 91))
    expect(card.style.borderLeft).toMatch(/rgb\(91,\s*194,\s*91\)|#5bc25b/i)
    // Heading present
    expect(card.textContent).toMatch(/TSB FRESHNESS/)
    // Citation present
    expect(card.textContent).toMatch(/Banister 1975/)
    expect(card.textContent).toMatch(/Coggan & Allen 2010/)
  })

  it('renders VERY_FATIGUED (red) for an acute overload', () => {
    const log = dailyBlock({ days: 7, tss: 250 })
    renderCard({ log })
    const card = document.querySelector('[data-tsb-freshness-band-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-tsb-band')).toBe('VERY_FATIGUED')
    // Red border for very-fatigued band (#cc0000 → rgb(204, 0, 0))
    expect(card.style.borderLeft).toMatch(/rgb\(204,\s*0,\s*0\)|#cc0000/i)
  })

  it('exposes data-tsb-band that matches the computed band', () => {
    const log = dailyBlock({ days: 120, tss: 60 })
    renderCard({ log })
    const card = document.querySelector('[data-tsb-freshness-band-card]')
    expect(card).not.toBeNull()
    const band = card.getAttribute('data-tsb-band')
    expect(['VERY_FRESH', 'FRESH', 'NEUTRAL', 'FATIGUED', 'VERY_FATIGUED']).toContain(band)
    // Steady moderate load drives TSB toward 0 → NEUTRAL.
    expect(band).toBe('NEUTRAL')
  })

  it('renders the 28d sparkline SVG when the log has multiple days', () => {
    const log = dailyBlock({ days: 30, tss: 80 })
    renderCard({ log })
    const spark = document.querySelector('[data-tsb-sparkline] svg')
    expect(spark).not.toBeNull()
    expect(spark.querySelector('path')).not.toBeNull()
  })

  it('exposes a region with accessible aria-label', () => {
    const log = dailyBlock({ days: 20, tss: 50 })
    renderCard({ log })
    const region = screen.getByRole('region', { name: /TSB freshness band card/i })
    expect(region).toBeInTheDocument()
  })
})

describe('TsbFreshnessBandCard — bilingual', () => {
  it('renders Turkish heading "TSB TAZELİK" when lang=tr', () => {
    const log = dailyBlock({ days: 20, tss: 80 })
    renderCard({ log }, 'tr')
    const card = document.querySelector('[data-tsb-freshness-band-card]')
    expect(card).not.toBeNull()
    expect(card.textContent).toMatch(/TSB TAZEL[İI]K/)
  })

  it('renders Turkish aria-label when lang=tr', () => {
    const log = dailyBlock({ days: 20, tss: 80 })
    renderCard({ log }, 'tr')
    const region = screen.getByRole('region', { name: /TSB tazelik bandı kartı/i })
    expect(region).toBeInTheDocument()
  })
})
