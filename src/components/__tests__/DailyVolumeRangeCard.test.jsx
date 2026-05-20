// @vitest-environment jsdom
// ─── DailyVolumeRangeCard.test.jsx — render tests ─────────────────────────

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import DailyVolumeRangeCard from '../dashboard/DailyVolumeRangeCard.jsx'

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
      <DailyVolumeRangeCard {...props} />
    </LangCtx.Provider>
  )
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function buildFlatLog({ today = TODAY, daily = 60, days = 60 } = {}) {
  const log = []
  for (let i = days - 1; i >= 0; i--) {
    log.push({ date: isoMinusDays(today, i), tss: daily })
  }
  return log
}

function buildAlternatingLog({ today = TODAY, hard = 150, easy = 50, days = 60 } = {}) {
  const log = []
  for (let i = days - 1; i >= 0; i--) {
    log.push({
      date: isoMinusDays(today, i),
      tss: (i % 2 === 0) ? hard : easy,
    })
  }
  return log
}

// ─── render gating ───────────────────────────────────────────────────────

describe('DailyVolumeRangeCard — render gating', () => {
  it('renders NOTHING for an empty log', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders NOTHING when prop `log` is omitted entirely', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })

  it('renders NOTHING when the recent 28 days are all zero (only old log)', () => {
    const log = []
    for (let i = 50; i >= 30; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: 80 })
    }
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })
})

// ─── band rendering ──────────────────────────────────────────────────────

describe('DailyVolumeRangeCard — band rendering', () => {
  it('renders FLAT band with orange stripe (flat low daily TSS)', () => {
    const log = buildFlatLog({ daily: 60, days: 60 })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /Daily TSS swing/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-band')).toBe('FLAT')
    expect(card.style.borderLeft).toMatch(/rgb\(255,\s*102,\s*0\)/)
    expect(card.textContent).toMatch(/FLAT/)
  })

  it('renders STEADY band with green stripe (alternating 50/100)', () => {
    const log = buildAlternatingLog({ hard: 100, easy: 50, days: 60 })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /Daily TSS swing/i })
    expect(card.getAttribute('data-band')).toBe('STEADY')
    expect(card.style.borderLeft).toMatch(/rgb\(91,\s*194,\s*91\)/)
    expect(card.textContent).toMatch(/STEADY/)
  })

  it('renders PULSED band with blue stripe (alternating 40/150)', () => {
    const log = buildAlternatingLog({ hard: 150, easy: 40, days: 60 })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /Daily TSS swing/i })
    expect(card.getAttribute('data-band')).toBe('PULSED')
    expect(card.style.borderLeft).toMatch(/rgb\(0,\s*100,\s*255\)/)
    expect(card.textContent).toMatch(/PULSED/)
  })

  it('renders EXTREME_SWING band with red stripe (alternating 30/250)', () => {
    const log = buildAlternatingLog({ hard: 250, easy: 30, days: 60 })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /Daily TSS swing/i })
    expect(card.getAttribute('data-band')).toBe('EXTREME_SWING')
    expect(card.style.borderLeft).toMatch(/rgb\(224,\s*48,\s*48\)/)
    expect(card.textContent).toMatch(/EXTREME SWING/)
  })
})

// ─── bilingual ───────────────────────────────────────────────────────────

describe('DailyVolumeRangeCard — bilingual', () => {
  it('renders English title when lang=en', () => {
    const log = buildFlatLog({ daily: 60, days: 60 })
    renderCard({ log }, 'en')
    expect(screen.getByText(/DAILY VOLUME RANGE/)).toBeInTheDocument()
    expect(screen.getByText(/FLAT/)).toBeInTheDocument()
  })

  it('renders Turkish title when lang=tr', () => {
    const log = buildFlatLog({ daily: 60, days: 60 })
    renderCard({ log }, 'tr')
    expect(screen.getByText(/GÜNLÜK HACİM ARALIĞI/)).toBeInTheDocument()
    expect(screen.getByText(/DÜZ/)).toBeInTheDocument()
  })

  it('renders Turkish band label for EXTREME_SWING (AŞIRI SALINIM)', () => {
    const log = buildAlternatingLog({ hard: 250, easy: 30, days: 60 })
    renderCard({ log }, 'tr')
    expect(screen.getByText(/AŞIRI SALINIM/)).toBeInTheDocument()
  })

  it('Turkish aria-label uses Turkish phrasing', () => {
    const log = buildFlatLog({ daily: 60, days: 60 })
    renderCard({ log }, 'tr')
    const card = screen.getByRole('region')
    expect(card.getAttribute('aria-label')).toMatch(/günlük TSS/i)
  })
})

// ─── citation + accessibility ────────────────────────────────────────────

describe('DailyVolumeRangeCard — citation + a11y', () => {
  it('renders citation footer', () => {
    const log = buildFlatLog({ daily: 60, days: 60 })
    renderCard({ log })
    expect(screen.getByText(/Foster 2001.*Halson 2014/)).toBeInTheDocument()
  })

  it('exposes role="region" with descriptive English aria-label', () => {
    const log = buildFlatLog({ daily: 60, days: 60 })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /Daily TSS swing/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('aria-label')).toMatch(/Foster 2001/)
  })
})

// ─── data anchors + 28-bar chart ─────────────────────────────────────────

describe('DailyVolumeRangeCard — data anchors + chart', () => {
  it('exposes all expected data-* attributes', () => {
    const log = buildAlternatingLog({ hard: 200, easy: 50, days: 60 })
    renderCard({ log })
    const card = document.querySelector('[data-card="daily-volume-range"]')
    expect(card).not.toBeNull()
    expect(card.hasAttribute('data-band')).toBe(true)
    expect(card.hasAttribute('data-recent-min')).toBe(true)
    expect(card.hasAttribute('data-recent-max')).toBe(true)
    expect(card.hasAttribute('data-recent-mean')).toBe(true)
    expect(card.hasAttribute('data-recent-stddev')).toBe(true)
    expect(card.hasAttribute('data-recent-range')).toBe(true)
    expect(card.hasAttribute('data-trend-range-delta')).toBe(true)
    expect(card.hasAttribute('data-zero-day-count')).toBe(true)
    expect(Number.isFinite(parseFloat(card.getAttribute('data-recent-min')))).toBe(true)
    expect(Number.isFinite(parseFloat(card.getAttribute('data-recent-max')))).toBe(true)
    expect(Number.isFinite(parseFloat(card.getAttribute('data-recent-mean')))).toBe(true)
    expect(Number.isFinite(parseFloat(card.getAttribute('data-recent-stddev')))).toBe(true)
    expect(Number.isFinite(parseFloat(card.getAttribute('data-recent-range')))).toBe(true)
  })

  it('renders an SVG bar chart with exactly 28 bars (one per day)', () => {
    const log = buildFlatLog({ daily: 60, days: 60 })
    renderCard({ log })
    const chart = document.querySelector('[data-chart="daily-volume-range"]')
    expect(chart).not.toBeNull()
    expect(chart.tagName.toLowerCase()).toBe('svg')
    const bars = chart.querySelectorAll('[data-bar]')
    expect(bars.length).toBe(28)
  })

  it('renders a trend arrow in trend display (up/down/flat)', () => {
    const log = buildAlternatingLog({ hard: 150, easy: 50, days: 60 })
    renderCard({ log })
    const trend = document.querySelector('[data-trend-display]')
    expect(trend).not.toBeNull()
    // One of these three glyphs must appear
    expect(['▲', '▼', '·'].some(c => trend.textContent.includes(c))).toBe(true)
  })

  it('renders rest-day count label', () => {
    const log = []
    for (let i = 4; i >= 0; i--) {
      log.push({ date: isoMinusDays(TODAY, i), tss: 100 })
    }
    renderCard({ log })
    // 23 rest days expected; English copy is "X rest days"
    expect(screen.getByText(/23 rest days/)).toBeInTheDocument()
  })

  it('renders all 5 stat boxes in the stats grid', () => {
    const log = buildAlternatingLog({ hard: 150, easy: 50, days: 60 })
    renderCard({ log })
    expect(document.querySelector('[data-stat="min"]')).not.toBeNull()
    expect(document.querySelector('[data-stat="max"]')).not.toBeNull()
    expect(document.querySelector('[data-stat="mean"]')).not.toBeNull()
    expect(document.querySelector('[data-stat="stddev"]')).not.toBeNull()
    expect(document.querySelector('[data-stat="range"]')).not.toBeNull()
  })
})
