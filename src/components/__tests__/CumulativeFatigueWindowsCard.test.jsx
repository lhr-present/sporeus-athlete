// @vitest-environment jsdom
// ─── CumulativeFatigueWindowsCard.test.jsx — render tests ─────────────────

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import CumulativeFatigueWindowsCard from '../dashboard/CumulativeFatigueWindowsCard.jsx'

const TODAY = '2026-05-19'

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
      <CumulativeFatigueWindowsCard {...props} />
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

function buildSpikeAtEndLog({
  today = TODAY,
  baseDaily = 60,
  spikeDaily = 250,
  days = 200,
  spikeDays = 14,
} = {}) {
  const log = []
  for (let i = days - 1; i >= 0; i--) {
    const isSpike = i < spikeDays
    log.push({
      date: isoMinusDays(today, i),
      tss: isSpike ? spikeDaily : baseDaily,
    })
  }
  return log
}

// ─── render gating ───────────────────────────────────────────────────────

describe('CumulativeFatigueWindowsCard — render gating', () => {
  it('renders NOTHING for an empty log', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders NOTHING when log has < 14 warm-CTL days', () => {
    const log = []
    for (let i = 8; i >= 0; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: 60 })
    }
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })

  it('renders NOTHING when prop `log` is omitted entirely', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })
})

// ─── band rendering ──────────────────────────────────────────────────────

describe('CumulativeFatigueWindowsCard — band rendering', () => {
  it('renders CONSERVATIVE band with green stripe (flat log)', () => {
    const log = buildFlatLog({ daily: 60, days: 250 })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /overreaching zone/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-overreach-band')).toBe('CONSERVATIVE')
    expect(card.style.borderLeft).toMatch(/rgb\(91,\s*194,\s*91\)/)
    expect(card.textContent).toMatch(/CONSERVATIVE/)
    expect(card.textContent).toMatch(/Halson 2014/)
  })

  it('renders NORMAL band with blue stripe (occasional spike)', () => {
    const log = buildSpikeAtEndLog({
      baseDaily: 60, spikeDaily: 220, days: 250, spikeDays: 5,
    })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /overreaching zone/i })
    expect(card.getAttribute('data-overreach-band')).toBe('NORMAL')
    expect(card.style.borderLeft).toMatch(/rgb\(0,\s*100,\s*255\)/)
    expect(card.textContent).toMatch(/NORMAL/)
  })

  it('renders ELEVATED_EXPOSURE band with orange stripe (moderate sustained spike)', () => {
    const log = buildSpikeAtEndLog({
      baseDaily: 60, spikeDaily: 200, days: 250, spikeDays: 25,
    })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /overreaching zone/i })
    expect(card.getAttribute('data-overreach-band')).toBe('ELEVATED_EXPOSURE')
    expect(card.style.borderLeft).toMatch(/rgb\(255,\s*102,\s*0\)/)
    expect(card.textContent).toMatch(/ELEVATED EXPOSURE/)
  })

  it('renders CHRONIC_OVERREACH band with red stripe (sustained heavy spike)', () => {
    const log = buildSpikeAtEndLog({
      baseDaily: 60, spikeDaily: 180, days: 250, spikeDays: 60,
    })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /overreaching zone/i })
    expect(card.getAttribute('data-overreach-band')).toBe('CHRONIC_OVERREACH')
    expect(card.style.borderLeft).toMatch(/rgb\(224,\s*48,\s*48\)/)
    expect(card.textContent).toMatch(/CHRONIC OVERREACH/)
  })
})

// ─── bilingual ───────────────────────────────────────────────────────────

describe('CumulativeFatigueWindowsCard — bilingual', () => {
  it('renders English title when lang=en', () => {
    const log = buildFlatLog({ daily: 60, days: 250 })
    renderCard({ log }, 'en')
    expect(screen.getByText(/OVERREACH EXPOSURE/)).toBeInTheDocument()
    expect(screen.getByText(/CONSERVATIVE/)).toBeInTheDocument()
  })

  it('renders Turkish title when lang=tr', () => {
    const log = buildFlatLog({ daily: 60, days: 250 })
    renderCard({ log }, 'tr')
    expect(screen.getByText(/AŞIRI YÜKLENME MARUZİYETİ/)).toBeInTheDocument()
    expect(screen.getByText(/TUTUMLU/)).toBeInTheDocument()
  })

  it('renders Turkish band label for CHRONIC_OVERREACH (KRONİK AŞIRI YÜKLENME)', () => {
    const log = buildSpikeAtEndLog({
      baseDaily: 60, spikeDaily: 180, days: 250, spikeDays: 60,
    })
    renderCard({ log }, 'tr')
    expect(screen.getByText(/KRONİK AŞIRI YÜKLENME/)).toBeInTheDocument()
  })
})

// ─── citation + accessibility ────────────────────────────────────────────

describe('CumulativeFatigueWindowsCard — citation + a11y', () => {
  it('renders citation footer', () => {
    const log = buildFlatLog({ daily: 60, days: 250 })
    renderCard({ log })
    expect(screen.getByText(/Halson 2014.*Meeusen 2013/)).toBeInTheDocument()
  })

  it('exposes role="region" with descriptive aria-label', () => {
    const log = buildFlatLog({ daily: 60, days: 250 })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /overreaching zone/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('aria-label')).toMatch(/Halson 2014/)
  })

  it('Turkish aria-label uses Turkish phrasing', () => {
    const log = buildFlatLog({ daily: 60, days: 250 })
    renderCard({ log }, 'tr')
    const card = screen.getByRole('region')
    expect(card.getAttribute('aria-label')).toMatch(/aşırı yüklenme/i)
  })
})

// ─── data anchors ────────────────────────────────────────────────────────

describe('CumulativeFatigueWindowsCard — data anchors', () => {
  it('exposes all expected data-* attributes', () => {
    const log = buildSpikeAtEndLog({
      baseDaily: 60, spikeDaily: 250, days: 200, spikeDays: 14,
    })
    renderCard({ log })
    const card = document.querySelector('[data-card="cumulative-fatigue-windows"]')
    expect(card).not.toBeNull()
    expect(card.hasAttribute('data-overreach-band')).toBe(true)
    expect(card.hasAttribute('data-windows-above-threshold')).toBe(true)
    expect(card.hasAttribute('data-total-days')).toBe(true)
    expect(card.hasAttribute('data-exposure-rate')).toBe(true)
    expect(card.hasAttribute('data-peak-ratio')).toBe(true)
    expect(card.hasAttribute('data-peak-ratio-date')).toBe(true)
    expect(Number.isFinite(parseFloat(card.getAttribute('data-windows-above-threshold')))).toBe(true)
    expect(Number.isFinite(parseFloat(card.getAttribute('data-total-days')))).toBe(true)
    expect(Number.isFinite(parseFloat(card.getAttribute('data-exposure-rate')))).toBe(true)
    expect(Number.isFinite(parseFloat(card.getAttribute('data-peak-ratio')))).toBe(true)
  })

  it('renders an SVG sparkline with the cumulative-fatigue-windows tag', () => {
    const log = buildFlatLog({ daily: 60, days: 250 })
    renderCard({ log })
    const spark = document.querySelector('[data-sparkline="cumulative-fatigue-windows"]')
    expect(spark).not.toBeNull()
    expect(spark.tagName.toLowerCase()).toBe('svg')
  })

  it('renders red over-threshold dots when ratio breaches threshold', () => {
    const log = buildSpikeAtEndLog({
      baseDaily: 60, spikeDaily: 250, days: 200, spikeDays: 14,
    })
    renderCard({ log })
    const dots = document.querySelectorAll('[data-overreach-dot]')
    expect(dots.length).toBeGreaterThan(0)
  })

  it('renders ZERO over-threshold dots for a fully conservative log', () => {
    const log = buildFlatLog({ daily: 60, days: 250 })
    renderCard({ log })
    const dots = document.querySelectorAll('[data-overreach-dot]')
    expect(dots.length).toBe(0)
  })
})
