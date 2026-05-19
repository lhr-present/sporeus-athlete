// @vitest-environment jsdom
// ─── CtlSlopeCard.test.jsx — render tests for the CTL-slope card ────────

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import CtlSlopeCard from '../dashboard/CtlSlopeCard.jsx'

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
      <CtlSlopeCard {...props} />
    </LangCtx.Provider>
  )
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function buildFlatLog({ today = TODAY, daily = 60, days = 300 } = {}) {
  const log = []
  for (let i = days - 1; i >= 0; i--) {
    log.push({ date: isoMinusDays(today, i), tss: daily })
  }
  return log
}

function buildLinearRampLog({ today = TODAY, dailyStart, dailyEnd, days }) {
  const log = []
  for (let i = days - 1; i >= 0; i--) {
    const t = (days - 1 - i) / Math.max(1, days - 1)
    const tss = dailyStart + (dailyEnd - dailyStart) * t
    log.push({ date: isoMinusDays(today, i), tss })
  }
  return log
}

// ─── render gating ───────────────────────────────────────────────────────

describe('CtlSlopeCard — render gating', () => {
  it('renders NOTHING for an empty log', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders NOTHING when log has < 28 days of history', () => {
    const log = []
    for (let i = 6; i >= 0; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: 80 })
    }
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })
})

// ─── band rendering ──────────────────────────────────────────────────────

describe('CtlSlopeCard — band rendering', () => {
  it('renders PLATEAU band with blue color stripe (flat log)', () => {
    const log = buildFlatLog({ daily: 60, days: 300 })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /6-week CTL linear-regression slope/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-slope-band')).toBe('PLATEAU')
    // Blue stripe on left border (jsdom serializes hex → rgb).
    expect(card.style.borderLeft).toMatch(/rgb\(0,\s*100,\s*255\)/)
    expect(card.textContent).toMatch(/PLATEAU/)
    expect(card.textContent).toMatch(/Banister 1991/)
    expect(card.textContent).toMatch(/Coggan 2010/)
  })

  it('renders STEADY_UP band with green color stripe (gentle ramp)', () => {
    const log = buildLinearRampLog({
      dailyStart: 40, dailyEnd: 80, days: 200,
    })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /6-week CTL linear-regression slope/i })
    expect(card.getAttribute('data-slope-band')).toBe('STEADY_UP')
    expect(card.style.borderLeft).toMatch(/rgb\(91,\s*194,\s*91\)/)
    expect(card.textContent).toMatch(/STEADY UP/)
  })

  it('renders CLIMBING band with orange color stripe (steep ramp)', () => {
    const log = buildLinearRampLog({
      dailyStart: 30, dailyEnd: 150, days: 120,
    })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /6-week CTL linear-regression slope/i })
    expect(card.getAttribute('data-slope-band')).toBe('CLIMBING')
    expect(card.style.borderLeft).toMatch(/rgb\(255,\s*102,\s*0\)/)
    expect(card.textContent).toMatch(/CLIMBING/)
  })

  it('renders DECLINING band with muted color stripe (negative ramp)', () => {
    const log = buildLinearRampLog({
      dailyStart: 100, dailyEnd: 40, days: 200,
    })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /6-week CTL linear-regression slope/i })
    expect(card.getAttribute('data-slope-band')).toBe('DECLINING')
    expect(card.style.borderLeft).toMatch(/rgb\(136,\s*136,\s*136\)/)
    expect(card.textContent).toMatch(/DECLINING/)
  })
})

// ─── data anchors ────────────────────────────────────────────────────────

describe('CtlSlopeCard — data anchors', () => {
  it('exposes all expected data-* attributes', () => {
    const log = buildLinearRampLog({
      dailyStart: 40, dailyEnd: 80, days: 200,
    })
    renderCard({ log })
    const card = document.querySelector('[data-ctl-slope-card]')
    expect(card).not.toBeNull()
    expect(card.hasAttribute('data-slope-band')).toBe(true)
    expect(card.hasAttribute('data-slope')).toBe(true)
    expect(card.hasAttribute('data-slope-per-week')).toBe(true)
    expect(card.hasAttribute('data-recent-ctl')).toBe(true)
    expect(card.hasAttribute('data-intercept')).toBe(true)
    // Numeric anchors should parse as finite numbers.
    expect(Number.isFinite(parseFloat(card.getAttribute('data-slope')))).toBe(true)
    expect(Number.isFinite(parseFloat(card.getAttribute('data-slope-per-week')))).toBe(true)
    expect(Number.isFinite(parseFloat(card.getAttribute('data-recent-ctl')))).toBe(true)
    expect(Number.isFinite(parseFloat(card.getAttribute('data-intercept')))).toBe(true)
  })

  it('data-slope-band attribute matches the computed band (CLIMBING case)', () => {
    const log = buildLinearRampLog({
      dailyStart: 30, dailyEnd: 150, days: 120,
    })
    renderCard({ log })
    const card = document.querySelector('[data-ctl-slope-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-slope-band')).toBe('CLIMBING')
  })
})

// ─── bilingual ───────────────────────────────────────────────────────────

describe('CtlSlopeCard — bilingual', () => {
  it('renders English title "CTL SLOPE · 6W" when lang=en', () => {
    const log = buildFlatLog({ daily: 60, days: 300 })
    renderCard({ log }, 'en')
    expect(screen.getByText('CTL SLOPE · 6W')).toBeInTheDocument()
    expect(screen.getByText(/PLATEAU/)).toBeInTheDocument()
  })

  it('renders Turkish title "CTL EĞİMİ · 6H" when lang=tr', () => {
    const log = buildFlatLog({ daily: 60, days: 300 })
    renderCard({ log }, 'tr')
    expect(screen.getByText('CTL EĞİMİ · 6H')).toBeInTheDocument()
    // Turkish PLATEAU label
    expect(screen.getByText(/PLATO/)).toBeInTheDocument()
  })

  it('renders Turkish band label for CLIMBING (TIRMANIYOR)', () => {
    const log = buildLinearRampLog({
      dailyStart: 30, dailyEnd: 150, days: 120,
    })
    renderCard({ log }, 'tr')
    expect(screen.getByText(/TIRMANIYOR/)).toBeInTheDocument()
  })

  it('renders Turkish band label for DECLINING (DÜŞÜYOR)', () => {
    const log = buildLinearRampLog({
      dailyStart: 100, dailyEnd: 40, days: 200,
    })
    renderCard({ log }, 'tr')
    expect(screen.getByText(/DÜŞÜYOR/)).toBeInTheDocument()
  })

  it('renders Turkish band label for STEADY_UP (İSTİKRARLI ARTIŞ)', () => {
    const log = buildLinearRampLog({
      dailyStart: 40, dailyEnd: 80, days: 200,
    })
    renderCard({ log }, 'tr')
    expect(screen.getByText(/İSTİKRARLI ARTIŞ/)).toBeInTheDocument()
  })
})
