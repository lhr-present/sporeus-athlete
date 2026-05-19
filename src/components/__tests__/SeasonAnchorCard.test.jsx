// @vitest-environment jsdom
// ─── SeasonAnchorCard.test.jsx — render tests for the season-anchor card ──

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import SeasonAnchorCard from '../dashboard/SeasonAnchorCard.jsx'

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
      <SeasonAnchorCard {...props} />
    </LangCtx.Provider>
  )
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function buildFlatLog({ today = TODAY, daily = 10, days = 200 } = {}) {
  const log = []
  for (let i = days - 1; i >= 0; i--) {
    log.push({ date: isoMinusDays(today, i), tss: daily })
  }
  return log
}

function buildTwoTierLog({
  today = TODAY,
  firstDaily,
  firstDays,
  secondDaily,
  secondDays,
} = {}) {
  const total = firstDays + secondDays
  const log = []
  for (let i = total - 1; i >= 0; i--) {
    const ordinal = total - 1 - i
    const tss = ordinal < firstDays ? firstDaily : secondDaily
    log.push({ date: isoMinusDays(today, i), tss })
  }
  return log
}

// ─── render gating ───────────────────────────────────────────────────────

describe('SeasonAnchorCard — render gating', () => {
  it('renders NOTHING for an empty log', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders NOTHING when log has < 56 days of history', () => {
    const log = buildFlatLog({ daily: 50, days: 30 })
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })

  it('renders NOTHING when no log prop is passed (default empty)', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })
})

// ─── band rendering — all five bands ─────────────────────────────────────

describe('SeasonAnchorCard — band rendering', () => {
  it('renders AT_ANCHOR band (flat log)', () => {
    const log = buildFlatLog({ daily: 10, days: 200 })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /season anchor/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-anchor-band')).toBe('AT_ANCHOR')
    expect(card.getAttribute('data-card')).toBe('season-anchor')
    expect(card.textContent).toMatch(/AT ANCHOR/)
  })

  it('renders EARLY_RAMP band', () => {
    const log = buildTwoTierLog({
      firstDaily: 5, firstDays: 100, secondDaily: 7, secondDays: 100,
    })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /season anchor/i })
    expect(card.getAttribute('data-anchor-band')).toBe('EARLY_RAMP')
    expect(card.textContent).toMatch(/EARLY RAMP/)
  })

  it('renders BUILDING band', () => {
    const log = buildTwoTierLog({
      firstDaily: 5, firstDays: 100, secondDaily: 10, secondDays: 100,
    })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /season anchor/i })
    expect(card.getAttribute('data-anchor-band')).toBe('BUILDING')
    expect(card.textContent).toMatch(/BUILDING/)
  })

  it('renders PEAK_BLOCK band with orange stripe', () => {
    const log = buildTwoTierLog({
      firstDaily: 10, firstDays: 100, secondDaily: 30, secondDays: 60,
    })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /season anchor/i })
    expect(card.getAttribute('data-anchor-band')).toBe('PEAK_BLOCK')
    expect(card.textContent).toMatch(/PEAK BLOCK/)
    expect(card.style.borderLeft).toMatch(/rgb\(255,\s*102,\s*0\)/)
  })

  it('renders ABOVE_HISTORY band on a sudden spike', () => {
    const log = buildTwoTierLog({
      firstDaily: 10, firstDays: 150, secondDaily: 40, secondDays: 28,
    })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /season anchor/i })
    expect(card.getAttribute('data-anchor-band')).toBe('ABOVE_HISTORY')
    expect(card.textContent).toMatch(/NEW HIGH/)
  })
})

// ─── data anchors ────────────────────────────────────────────────────────

describe('SeasonAnchorCard — data anchors', () => {
  it('exposes all expected data-* attributes', () => {
    const log = buildTwoTierLog({
      firstDaily: 5, firstDays: 100, secondDaily: 10, secondDays: 100,
    })
    renderCard({ log })
    const card = document.querySelector('[data-card="season-anchor"]')
    expect(card).not.toBeNull()
    expect(card.hasAttribute('data-anchor-band')).toBe(true)
    expect(card.hasAttribute('data-anchor-4w-tss')).toBe(true)
    expect(card.hasAttribute('data-current-last-4w-tss')).toBe(true)
    expect(card.hasAttribute('data-ramp-ratio')).toBe(true)
    expect(card.hasAttribute('data-days-since-anchor')).toBe(true)
    expect(card.hasAttribute('data-peak-4w-tss')).toBe(true)
    expect(card.hasAttribute('data-anchor-date')).toBe(true)
    expect(card.hasAttribute('data-peak-date')).toBe(true)
    expect(Number.isFinite(parseFloat(card.getAttribute('data-anchor-4w-tss')))).toBe(true)
    expect(Number.isFinite(parseFloat(card.getAttribute('data-ramp-ratio')))).toBe(true)
  })

  it('mini chart svg renders when data is present', () => {
    const log = buildFlatLog({ daily: 10, days: 200 })
    renderCard({ log })
    const svg = document.querySelector('[data-mini-chart="season-anchor"]')
    expect(svg).not.toBeNull()
  })
})

// ─── accessibility ───────────────────────────────────────────────────────

describe('SeasonAnchorCard — accessibility', () => {
  it('uses role="region" with an aria-label citing Hägglund + Bompa (EN)', () => {
    const log = buildFlatLog({ daily: 10, days: 200 })
    renderCard({ log }, 'en')
    const card = screen.getByRole('region')
    const label = card.getAttribute('aria-label') || ''
    expect(label).toMatch(/Season anchor/i)
    expect(label).toMatch(/Hägglund 2013/)
    expect(label).toMatch(/Bompa 2018/)
  })

  it('uses role="region" with a Turkish aria-label when lang=tr', () => {
    const log = buildFlatLog({ daily: 10, days: 200 })
    renderCard({ log }, 'tr')
    const card = screen.getByRole('region')
    const label = card.getAttribute('aria-label') || ''
    expect(label).toMatch(/Sezon demir atışı/i)
  })
})

// ─── bilingual ───────────────────────────────────────────────────────────

describe('SeasonAnchorCard — bilingual', () => {
  it('renders English title "SEASON ANCHOR" when lang=en', () => {
    const log = buildFlatLog({ daily: 10, days: 200 })
    renderCard({ log }, 'en')
    expect(screen.getByText('SEASON ANCHOR')).toBeInTheDocument()
  })

  it('renders Turkish title "SEZON DEMİR ATIŞI" when lang=tr', () => {
    const log = buildFlatLog({ daily: 10, days: 200 })
    renderCard({ log }, 'tr')
    expect(screen.getByText('SEZON DEMİR ATIŞI')).toBeInTheDocument()
  })

  it('renders Turkish band label for PEAK_BLOCK (ZİRVE BLOĞU)', () => {
    const log = buildTwoTierLog({
      firstDaily: 10, firstDays: 100, secondDaily: 30, secondDays: 60,
    })
    renderCard({ log }, 'tr')
    expect(screen.getByText(/ZİRVE BLOĞU/)).toBeInTheDocument()
  })

  it('renders Turkish band label for ABOVE_HISTORY (YENİ ZİRVE)', () => {
    const log = buildTwoTierLog({
      firstDaily: 10, firstDays: 150, secondDaily: 40, secondDays: 28,
    })
    renderCard({ log }, 'tr')
    expect(screen.getByText(/YENİ ZİRVE/)).toBeInTheDocument()
  })

  it('renders Turkish "demir atıştan beri" ramp text when lang=tr', () => {
    const log = buildTwoTierLog({
      firstDaily: 5, firstDays: 100, secondDaily: 10, secondDays: 100,
    })
    renderCard({ log }, 'tr')
    // The ramp-display row reads e.g. "2.00× demir atıştan beri".
    expect(screen.getByText(/×\s+demir atıştan beri/i)).toBeInTheDocument()
  })

  it('renders English "since anchor" ramp text when lang=en', () => {
    const log = buildTwoTierLog({
      firstDaily: 5, firstDays: 100, secondDaily: 10, secondDays: 100,
    })
    renderCard({ log }, 'en')
    // The ramp-display row reads e.g. "2.00× since anchor".
    expect(screen.getByText(/×\s+since anchor/i)).toBeInTheDocument()
  })
})

// ─── citation footer ─────────────────────────────────────────────────────

describe('SeasonAnchorCard — citation footer', () => {
  it('renders the Hägglund 2013; Bompa 2018 citation', () => {
    const log = buildFlatLog({ daily: 10, days: 200 })
    renderCard({ log })
    const card = screen.getByRole('region')
    expect(card.textContent).toMatch(/Hägglund 2013/)
    expect(card.textContent).toMatch(/Bompa 2018/)
  })
})
