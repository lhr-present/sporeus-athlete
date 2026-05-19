// @vitest-environment jsdom
// ─── EnergySorenessDivergenceCard.test.jsx — Dashboard surface tests ───────
//
// Covers: null guards, each wellness quadrant (THRIVING / RECOVERING /
// DRAINED / STRUGGLING), gauge data anchors, avg-index sign coloring,
// and Turkish locale.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import EnergySorenessDivergenceCard from '../dashboard/EnergySorenessDivergenceCard.jsx'

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

/** Build a recovery dataset of `count` entries, ages 0..(count-1) clipped to 27. */
function buildSeries(count, mkVals) {
  const out = []
  for (let i = 0; i < count; i++) {
    const age = Math.min(i, 27)
    out.push({ date: daysAgo(age), ...mkVals(i) })
  }
  return out
}

function renderCard(recovery, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <EnergySorenessDivergenceCard recovery={recovery} />
    </LangCtx.Provider>
  )
}

describe('EnergySorenessDivergenceCard — guards', () => {
  it('renders nothing for an empty recovery log', () => {
    const { container } = renderCard([])
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-energy-soreness-divergence-card]')).toBeNull()
  })

  it('renders nothing when recovery is null', () => {
    const { container } = renderCard(null)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when fewer than 7 valid samples exist', () => {
    const recovery = Array.from({ length: 5 }).map((_, i) => ({
      date: daysAgo(i),
      energy: 4,
      soreness: 2,
    }))
    const { container } = renderCard(recovery)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when entries are missing one of the two fields', () => {
    const recovery = [
      ...Array.from({ length: 4 }).map((_, i) => ({ date: daysAgo(i), energy: 4, soreness: 2 })),
      { date: daysAgo(5), energy: 4 },
      { date: daysAgo(6), soreness: 2 },
    ]
    const { container } = renderCard(recovery)
    expect(container.firstChild).toBeNull()
  })
})

describe('EnergySorenessDivergenceCard — THRIVING quadrant', () => {
  it('renders with quadrant THRIVING for high energy + low soreness', () => {
    const recovery = buildSeries(14, () => ({ energy: 4, soreness: 2 }))
    renderCard(recovery)
    const card = document.querySelector('[data-energy-soreness-divergence-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-wellness-quadrant')).toBe('THRIVING')
    const region = screen.getByRole('region', { name: /Energy × soreness divergence/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/ENERGY × SORENESS · 28D/)
    expect(region.textContent).toMatch(/THRIVING/)
    expect(region.textContent).toMatch(/recovery is paying off/i)
    expect(region.textContent).toMatch(/Hooper 1995/)
    expect(region.textContent).toMatch(/Saw 2016/)
  })
})

describe('EnergySorenessDivergenceCard — RECOVERING quadrant', () => {
  it('renders with quadrant RECOVERING for high energy + high soreness', () => {
    const recovery = buildSeries(14, () => ({ energy: 4, soreness: 4 }))
    renderCard(recovery)
    const card = document.querySelector('[data-energy-soreness-divergence-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-wellness-quadrant')).toBe('RECOVERING')
    expect(card.textContent).toMatch(/RECOVERING/)
    expect(card.textContent).toMatch(/being processed/i)
  })
})

describe('EnergySorenessDivergenceCard — DRAINED quadrant', () => {
  it('renders with quadrant DRAINED for low energy + low soreness', () => {
    const recovery = buildSeries(14, () => ({ energy: 2, soreness: 2 }))
    renderCard(recovery)
    const card = document.querySelector('[data-energy-soreness-divergence-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-wellness-quadrant')).toBe('DRAINED')
    expect(card.textContent).toMatch(/DRAINED/)
    expect(card.textContent).toMatch(/sleep, stress, or undereating/i)
  })
})

describe('EnergySorenessDivergenceCard — STRUGGLING quadrant', () => {
  it('renders with quadrant STRUGGLING for low energy + high soreness', () => {
    const recovery = buildSeries(14, () => ({ energy: 2, soreness: 4 }))
    renderCard(recovery)
    const card = document.querySelector('[data-energy-soreness-divergence-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-wellness-quadrant')).toBe('STRUGGLING')
    expect(card.textContent).toMatch(/STRUGGLING/)
    expect(card.textContent).toMatch(/rest day|active recovery/i)
  })
})

describe('EnergySorenessDivergenceCard — gauge data anchors', () => {
  it('exposes two wellness gauges with the documented data attributes', () => {
    const recovery = buildSeries(14, () => ({ energy: 4, soreness: 2 }))
    renderCard(recovery)
    const gauges = document.querySelectorAll('[data-wellness-gauge]')
    expect(gauges.length).toBe(2)
    const names = Array.from(gauges).map(g => g.getAttribute('data-gauge-name'))
    expect(names).toEqual(expect.arrayContaining(['energy', 'soreness']))
    for (const g of gauges) {
      expect(g.hasAttribute('data-gauge-value')).toBe(true)
    }
    const card = document.querySelector('[data-energy-soreness-divergence-card]')
    expect(parseFloat(card.getAttribute('data-avg-energy'))).toBeCloseTo(4, 5)
    expect(parseFloat(card.getAttribute('data-avg-soreness'))).toBeCloseTo(2, 5)
    expect(parseFloat(card.getAttribute('data-avg-index'))).toBeCloseTo(2, 5)
  })

  it('renders per-gauge values matching the averages', () => {
    // Mix energy 4 and 3 → avg 3.5; soreness all 2 → avg 2.0
    const recovery = [
      ...Array.from({ length: 7 }).map((_, i) => ({ date: daysAgo(i), energy: 4, soreness: 2 })),
      ...Array.from({ length: 7 }).map((_, i) => ({ date: daysAgo(i + 7), energy: 3, soreness: 2 })),
    ]
    renderCard(recovery)
    const energyGauge = document.querySelector('[data-gauge-name="energy"]')
    const sorenessGauge = document.querySelector('[data-gauge-name="soreness"]')
    expect(parseFloat(energyGauge.getAttribute('data-gauge-value'))).toBeCloseTo(3.5, 5)
    expect(parseFloat(sorenessGauge.getAttribute('data-gauge-value'))).toBeCloseTo(2, 5)
  })
})

describe('EnergySorenessDivergenceCard — bilingual (Turkish)', () => {
  it('renders the Turkish heading and quadrant label for THRIVING', () => {
    const recovery = buildSeries(14, () => ({ energy: 5, soreness: 1 }))
    renderCard(recovery, 'tr')
    const region = screen.getByRole('region', { name: /Enerji × ağrı dengesi/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/ENERJİ × AĞRI · 28G/)
    expect(region.textContent).toMatch(/GELİŞİYOR/)
    expect(region.textContent).toMatch(/Yüksek enerji, düşük ağrı/)
  })

  it('renders the Turkish quadrant label for STRUGGLING', () => {
    const recovery = buildSeries(14, () => ({ energy: 2, soreness: 4 }))
    renderCard(recovery, 'tr')
    const card = document.querySelector('[data-energy-soreness-divergence-card]')
    expect(card.getAttribute('data-wellness-quadrant')).toBe('STRUGGLING')
    expect(card.textContent).toMatch(/ZORLANIYOR/)
    expect(card.textContent).toMatch(/aktif toparlanma/)
  })

  it('renders the Turkish quadrant labels for DRAINED and RECOVERING', () => {
    // DRAINED case
    const drained = buildSeries(14, () => ({ energy: 2, soreness: 2 }))
    const { unmount } = renderCard(drained, 'tr')
    let card = document.querySelector('[data-energy-soreness-divergence-card]')
    expect(card.getAttribute('data-wellness-quadrant')).toBe('DRAINED')
    expect(card.textContent).toMatch(/TÜKENMİŞ/)
    unmount()

    // RECOVERING case
    const recovering = buildSeries(14, () => ({ energy: 4, soreness: 4 }))
    renderCard(recovering, 'tr')
    card = document.querySelector('[data-energy-soreness-divergence-card]')
    expect(card.getAttribute('data-wellness-quadrant')).toBe('RECOVERING')
    expect(card.textContent).toMatch(/TOPARLANIYOR/)
  })
})
