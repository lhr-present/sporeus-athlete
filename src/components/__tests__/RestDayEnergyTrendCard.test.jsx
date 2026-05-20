// @vitest-environment jsdom
// ─── RestDayEnergyTrendCard.test.jsx — Dashboard surface tests ─────────────
//
// Covers: null guards, each band (BURNOUT_SIGNAL / WARNING / NEUTRAL /
// WELL_RESTORED), bilingual EN/TR rendering, citation footer, accessibility
// (role="region", aria-label).
//
// We freeze the system clock so `analyzeRestDayEnergyTrend` — called without
// an explicit `today` — sees a deterministic "today" relative to the
// synthesized recovery + log dates from `daysAgo()`.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import RestDayEnergyTrendCard from '../dashboard/RestDayEnergyTrendCard.jsx'

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

function renderCard(log, recovery, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <RestDayEnergyTrendCard log={log} recovery={recovery} />
    </LangCtx.Provider>,
  )
}

/** Build a log+recovery pair where each weekday alternates train/rest. */
function buildWeeklyData({
  weeks = 8,
  trainEnergyFn = () => 5,
  restEnergyFn = () => 7,
} = {}) {
  const log = []
  const recovery = []
  for (let weekIdx = 0; weekIdx < weeks; weekIdx++) {
    const startAge = weekIdx * 7
    const trainEnergy = trainEnergyFn(weekIdx)
    const restEnergy = restEnergyFn(weekIdx)
    for (let d = 0; d < 4; d++) {
      const age = startAge + d
      log.push({ date: daysAgo(age), tss: 50 })
      recovery.push({ date: daysAgo(age), energy: trainEnergy })
    }
    for (let d = 4; d < 7; d++) {
      const age = startAge + d
      recovery.push({ date: daysAgo(age), energy: restEnergy })
    }
  }
  return { log, recovery }
}

// ─── Null gates ─────────────────────────────────────────────────────────────

describe('RestDayEnergyTrendCard — guards', () => {
  it('renders nothing when there is no data at all', () => {
    const { container } = renderCard([], [])
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-card="rest-day-energy-trend"]')).toBeNull()
  })

  it('renders nothing when both recovery and log are null', () => {
    const { container } = renderCard(null, null)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when only 1-2 samples on each side', () => {
    const log = [{ date: daysAgo(1), tss: 50 }]
    const recovery = [
      { date: daysAgo(0), energy: 7 },
      { date: daysAgo(1), energy: 5 },
    ]
    const { container } = renderCard(log, recovery)
    expect(container.firstChild).toBeNull()
  })
})

// ─── Bands ──────────────────────────────────────────────────────────────────

describe('RestDayEnergyTrendCard — WELL_RESTORED band', () => {
  it('renders the well-restored copy when gap ≥ 1.5', () => {
    const { log, recovery } = buildWeeklyData({
      trainEnergyFn: () => 5,
      restEnergyFn: () => 7,
    })
    renderCard(log, recovery)
    const card = document.querySelector('[data-card="rest-day-energy-trend"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('WELL_RESTORED')
    expect(card.textContent).toMatch(/REST-DAY RESTORATION/i)
    expect(card.textContent).toMatch(/30D/i)
    expect(card.textContent).toMatch(/Rest days restore meaningfully/i)
    // Citation footer
    expect(card.textContent).toMatch(/Lemyre 2007/)
    expect(card.textContent).toMatch(/Kellmann 2018/)
  })
})

describe('RestDayEnergyTrendCard — BURNOUT_SIGNAL band (negative gap)', () => {
  it('renders the burnout copy when rest energy < training energy', () => {
    const { log, recovery } = buildWeeklyData({
      trainEnergyFn: () => 7,
      restEnergyFn: () => 5,
    })
    renderCard(log, recovery)
    const card = document.querySelector('[data-card="rest-day-energy-trend"]')
    expect(card.getAttribute('data-band')).toBe('BURNOUT_SIGNAL')
    expect(card.textContent).toMatch(/Rest no longer restores/i)
    expect(card.textContent).toMatch(/burnout signal/i)
  })
})

describe('RestDayEnergyTrendCard — WARNING band', () => {
  it('renders the warning copy when gap is small AND trend negative', () => {
    // Recent week gap ~0.3, falling 0.1/week → WARNING per pure-fn spec.
    const { log, recovery } = buildWeeklyData({
      trainEnergyFn: () => 6,
      restEnergyFn: (w) => 6 + (0.3 + 0.1 * w),
    })
    renderCard(log, recovery)
    const card = document.querySelector('[data-card="rest-day-energy-trend"]')
    expect(card.getAttribute('data-band')).toBe('WARNING')
    expect(card.textContent).toMatch(/Restoration gap is small AND shrinking/i)
  })
})

describe('RestDayEnergyTrendCard — NEUTRAL band', () => {
  it('renders the neutral copy when gap is stable and moderate', () => {
    const { log, recovery } = buildWeeklyData({
      trainEnergyFn: () => 5,
      restEnergyFn: () => 6,
    })
    renderCard(log, recovery)
    const card = document.querySelector('[data-card="rest-day-energy-trend"]')
    expect(card.getAttribute('data-band')).toBe('NEUTRAL')
    expect(card.textContent).toMatch(/modest energy lift/i)
  })
})

// ─── Data anchors / numeric rendering ──────────────────────────────────────

describe('RestDayEnergyTrendCard — data anchors', () => {
  it('exposes the documented data attributes', () => {
    const { log, recovery } = buildWeeklyData({
      trainEnergyFn: () => 5,
      restEnergyFn: () => 7,
    })
    renderCard(log, recovery)
    const card = document.querySelector('[data-card="rest-day-energy-trend"]')
    expect(card.hasAttribute('data-band')).toBe(true)
    expect(card.hasAttribute('data-energy-gap')).toBe(true)
    expect(card.hasAttribute('data-rest-mean')).toBe(true)
    expect(card.hasAttribute('data-training-mean')).toBe(true)
    expect(parseFloat(card.getAttribute('data-rest-mean'))).toBeCloseTo(7, 1)
    expect(parseFloat(card.getAttribute('data-training-mean'))).toBeCloseTo(5, 1)
    expect(parseFloat(card.getAttribute('data-energy-gap'))).toBeCloseTo(2, 1)
  })

  it('renders both rest and training stat blocks', () => {
    const { log, recovery } = buildWeeklyData({
      trainEnergyFn: () => 5,
      restEnergyFn: () => 7,
    })
    renderCard(log, recovery)
    expect(document.querySelector('[data-stat="rest"]')).not.toBeNull()
    expect(document.querySelector('[data-stat="training"]')).not.toBeNull()
    expect(document.querySelector('[data-gap-value]')).not.toBeNull()
    expect(document.querySelector('[data-trend-value]')).not.toBeNull()
  })
})

// ─── Accessibility ──────────────────────────────────────────────────────────

describe('RestDayEnergyTrendCard — accessibility', () => {
  it('renders as a region with the bilingual aria-label (EN)', () => {
    const { log, recovery } = buildWeeklyData({
      trainEnergyFn: () => 5,
      restEnergyFn: () => 7,
    })
    renderCard(log, recovery)
    const region = screen.getByRole('region', { name: /Rest-day energy restoration/i })
    expect(region).toBeInTheDocument()
  })

  it('renders as a region with the bilingual aria-label (TR)', () => {
    const { log, recovery } = buildWeeklyData({
      trainEnergyFn: () => 5,
      restEnergyFn: () => 7,
    })
    renderCard(log, recovery, 'tr')
    const region = screen.getByRole('region', { name: /Dinlenme günü toparlanması/i })
    expect(region).toBeInTheDocument()
  })
})

// ─── Bilingual ──────────────────────────────────────────────────────────────

describe('RestDayEnergyTrendCard — bilingual (TR)', () => {
  it('renders the Turkish heading and band label when lang=tr', () => {
    const { log, recovery } = buildWeeklyData({
      trainEnergyFn: () => 5,
      restEnergyFn: () => 7,
    })
    renderCard(log, recovery, 'tr')
    const card = document.querySelector('[data-card="rest-day-energy-trend"]')
    expect(card.textContent).toMatch(/DİNLENME GÜNÜ TOPARLANMASI · 30G/)
    expect(card.textContent).toMatch(/İYİ TOPARLANIYOR/)
    expect(card.textContent).toMatch(/Adaptasyon yolunda/)
  })

  it('renders the Turkish burnout label for BURNOUT_SIGNAL', () => {
    const { log, recovery } = buildWeeklyData({
      trainEnergyFn: () => 7,
      restEnergyFn: () => 5,
    })
    renderCard(log, recovery, 'tr')
    const card = document.querySelector('[data-card="rest-day-energy-trend"]')
    expect(card.getAttribute('data-band')).toBe('BURNOUT_SIGNAL')
    expect(card.textContent).toMatch(/TÜKENMİŞLİK SİNYALİ/)
    expect(card.textContent).toMatch(/Dinlenme artık toparlamıyor/)
  })

  it('renders the Turkish per-week trend suffix', () => {
    const { log, recovery } = buildWeeklyData({
      trainEnergyFn: () => 5,
      restEnergyFn: () => 7,
    })
    renderCard(log, recovery, 'tr')
    const card = document.querySelector('[data-card="rest-day-energy-trend"]')
    expect(card.textContent).toMatch(/\/hf/)
  })
})

// ─── Citation ───────────────────────────────────────────────────────────────

describe('RestDayEnergyTrendCard — citation footer', () => {
  it('always shows the Lemyre 2007 + Kellmann 2018 footer', () => {
    const { log, recovery } = buildWeeklyData({
      trainEnergyFn: () => 5,
      restEnergyFn: () => 7,
    })
    renderCard(log, recovery)
    const card = document.querySelector('[data-card="rest-day-energy-trend"]')
    expect(card.textContent).toMatch(/Lemyre 2007/)
    expect(card.textContent).toMatch(/Kellmann 2018/)
  })
})
