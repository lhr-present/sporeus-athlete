// @vitest-environment jsdom
// ─── MoodEnergyBalanceCard.test.jsx — Dashboard surface tests ──────────────
//
// Covers: null guards, each trend band (RISING / STABLE / DECLINING),
// each affect quadrant (VIGOROUS / CONTENT / EDGY / FLAT), affect-gauge
// data anchors, and Turkish locale.
//
// We freeze the system clock so that analyzeMoodEnergyBalance — called
// without an explicit `today` — sees a deterministic "today" relative to
// the synthesized recovery dates from `daysAgo()`.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import MoodEnergyBalanceCard from '../dashboard/MoodEnergyBalanceCard.jsx'

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

/** Build a recovery dataset with a constant or split mood/energy pair. */
function buildRecovery({ count = 14, early, recent }) {
  const out = []
  const perHalf = Math.ceil(count / 2)
  for (let i = 0; i < perHalf; i++) {
    const age = i % 14
    out.push({ date: daysAgo(age), ...recent(i) })
  }
  for (let i = 0; i < count - perHalf; i++) {
    const age = 14 + (i % 14)
    out.push({ date: daysAgo(age), ...early(i) })
  }
  return out
}

function renderCard(recovery, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <MoodEnergyBalanceCard recovery={recovery} />
    </LangCtx.Provider>
  )
}

describe('MoodEnergyBalanceCard — guards', () => {
  it('renders nothing for an empty recovery log', () => {
    const { container } = renderCard([])
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-mood-energy-balance-card]')).toBeNull()
  })

  it('renders nothing when recovery is null', () => {
    const { container } = renderCard(null)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when fewer than 7 valid samples exist', () => {
    const recovery = Array.from({ length: 5 }).map((_, i) => ({
      date: daysAgo(i),
      mood: 4,
      energy: 4,
    }))
    const { container } = renderCard(recovery)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when entries are missing one of the two fields', () => {
    const recovery = [
      ...Array.from({ length: 4 }).map((_, i) => ({ date: daysAgo(i), mood: 4, energy: 4 })),
      { date: daysAgo(5), mood: 4 },
      { date: daysAgo(6), energy: 4 },
    ]
    const { container } = renderCard(recovery)
    expect(container.firstChild).toBeNull()
  })
})

describe('MoodEnergyBalanceCard — RISING trend', () => {
  it('renders with trend RISING when affect is improving', () => {
    const recovery = buildRecovery({
      count: 14,
      early:  () => ({ mood: 2, energy: 2 }),
      recent: () => ({ mood: 4, energy: 4 }),
    })
    renderCard(recovery)
    const card = document.querySelector('[data-mood-energy-balance-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-affect-trend')).toBe('RISING')
    const region = screen.getByRole('region', { name: /Mood × energy balance/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/MOOD × ENERGY · 28D/)
    expect(region.textContent).toMatch(/RISING/)
    expect(region.textContent).toMatch(/Affect is improving/i)
    expect(region.textContent).toMatch(/Lane 2007/)
    expect(region.textContent).toMatch(/Russell 1980/)
  })
})

describe('MoodEnergyBalanceCard — STABLE trend', () => {
  it('renders with trend STABLE when no meaningful delta', () => {
    const recovery = buildRecovery({
      count: 14,
      early:  () => ({ mood: 3, energy: 3 }),
      recent: () => ({ mood: 3, energy: 3 }),
    })
    renderCard(recovery)
    const card = document.querySelector('[data-mood-energy-balance-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-affect-trend')).toBe('STABLE')
    expect(card.textContent).toMatch(/STABLE/)
    expect(card.textContent).toMatch(/steady/i)
  })
})

describe('MoodEnergyBalanceCard — DECLINING trend', () => {
  it('renders with trend DECLINING and the recovery-week hint', () => {
    const recovery = buildRecovery({
      count: 14,
      early:  () => ({ mood: 4, energy: 4 }),
      recent: () => ({ mood: 2, energy: 2 }),
    })
    renderCard(recovery)
    const card = document.querySelector('[data-mood-energy-balance-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-affect-trend')).toBe('DECLINING')
    expect(card.textContent).toMatch(/DECLINING/)
    expect(card.textContent).toMatch(/recovery week|adjust life-stress/i)
  })
})

describe('MoodEnergyBalanceCard — affect quadrants', () => {
  it('renders quadrant VIGOROUS when both means ≥ 3.5', () => {
    const recovery = buildRecovery({
      count: 14,
      early:  () => ({ mood: 4, energy: 4 }),
      recent: () => ({ mood: 4, energy: 4 }),
    })
    renderCard(recovery)
    const card = document.querySelector('[data-mood-energy-balance-card]')
    expect(card.getAttribute('data-affect-quadrant')).toBe('VIGOROUS')
    expect(card.textContent).toMatch(/VIGOROUS/)
  })

  it('renders quadrant CONTENT when mood ≥ 3.5 but energy < 3.5', () => {
    const recovery = buildRecovery({
      count: 14,
      early:  () => ({ mood: 4, energy: 2 }),
      recent: () => ({ mood: 4, energy: 2 }),
    })
    renderCard(recovery)
    const card = document.querySelector('[data-mood-energy-balance-card]')
    expect(card.getAttribute('data-affect-quadrant')).toBe('CONTENT')
    expect(card.textContent).toMatch(/CONTENT/)
  })

  it('renders quadrant EDGY when mood < 3.5 but energy ≥ 3.5', () => {
    const recovery = buildRecovery({
      count: 14,
      early:  () => ({ mood: 2, energy: 4 }),
      recent: () => ({ mood: 2, energy: 4 }),
    })
    renderCard(recovery)
    const card = document.querySelector('[data-mood-energy-balance-card]')
    expect(card.getAttribute('data-affect-quadrant')).toBe('EDGY')
    expect(card.textContent).toMatch(/EDGY/)
  })

  it('renders quadrant FLAT when both means < 3.5', () => {
    const recovery = buildRecovery({
      count: 14,
      early:  () => ({ mood: 2, energy: 2 }),
      recent: () => ({ mood: 2, energy: 2 }),
    })
    renderCard(recovery)
    const card = document.querySelector('[data-mood-energy-balance-card]')
    expect(card.getAttribute('data-affect-quadrant')).toBe('FLAT')
    expect(card.textContent).toMatch(/FLAT/)
  })
})

describe('MoodEnergyBalanceCard — gauge data anchors', () => {
  it('exposes two affect gauges with the documented data attributes', () => {
    const recovery = buildRecovery({
      count: 14,
      early:  () => ({ mood: 3, energy: 3 }),
      recent: () => ({ mood: 4, energy: 4 }),
    })
    renderCard(recovery)
    const gauges = document.querySelectorAll('[data-affect-gauge]')
    expect(gauges.length).toBe(2)
    const names = Array.from(gauges).map(g => g.getAttribute('data-affect-name'))
    expect(names).toEqual(expect.arrayContaining(['mood', 'energy']))
    for (const g of gauges) {
      expect(g.hasAttribute('data-affect-value')).toBe(true)
      expect(g.hasAttribute('data-affect-delta')).toBe(true)
    }
    // Top-level data-avg-mood / data-avg-energy
    const card = document.querySelector('[data-mood-energy-balance-card]')
    expect(parseFloat(card.getAttribute('data-avg-mood'))).toBeCloseTo(3.5, 5)
    expect(parseFloat(card.getAttribute('data-avg-energy'))).toBeCloseTo(3.5, 5)
  })
})

describe('MoodEnergyBalanceCard — bilingual (Turkish)', () => {
  it('renders the Turkish heading and trend label when lang=tr', () => {
    // Recent 5/5 + early 4/4 → avgs 4.5 (VIGOROUS), deltas +1 (RISING)
    const recovery = buildRecovery({
      count: 14,
      early:  () => ({ mood: 4, energy: 4 }),
      recent: () => ({ mood: 5, energy: 5 }),
    })
    renderCard(recovery, 'tr')
    const region = screen.getByRole('region', { name: /Ruh × enerji dengesi/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/RUH × ENERJİ · 28G/)
    expect(region.textContent).toMatch(/YÜKSELİYOR/)
    expect(region.textContent).toMatch(/COŞKULU/)
    expect(region.textContent).toMatch(/Duygulanım iyileşiyor/)
  })

  it('renders the Turkish quadrant label for FLAT', () => {
    const recovery = buildRecovery({
      count: 14,
      early:  () => ({ mood: 2, energy: 2 }),
      recent: () => ({ mood: 2, energy: 2 }),
    })
    renderCard(recovery, 'tr')
    const card = document.querySelector('[data-mood-energy-balance-card]')
    expect(card.getAttribute('data-affect-quadrant')).toBe('FLAT')
    expect(card.textContent).toMatch(/DURGUN/)
    expect(card.textContent).toMatch(/STABİL/)
  })
})
