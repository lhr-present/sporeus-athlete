// @vitest-environment jsdom
// ─── SwimSwolfTrendCard.test.jsx — render tests for the SWOLF trend card ─────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import SwimSwolfTrendCard from '../dashboard/SwimSwolfTrendCard.jsx'

const TODAY_ISO = '2026-05-15'

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY_ISO + 'T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function renderCard({ log = [], profile = { primarySport: 'swimming' } } = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <SwimSwolfTrendCard log={log} profile={profile} />
    </LangCtx.Provider>
  )
}

/** swim entry helper — offset days back from TODAY_ISO. */
function swim(daysBack, swolf) {
  const d = new Date(TODAY_ISO + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - daysBack)
  return { type: 'swim', date: d.toISOString().slice(0, 10), swolf }
}

describe('SwimSwolfTrendCard — sport gating', () => {
  it('renders nothing for non-swimmer with no swim entries', () => {
    const { container } = renderCard({
      profile: { primarySport: 'cycling' },
      log: [{ type: 'bike', date: '2026-05-10', tss: 60 }],
    })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when swimmer has no derivable SWOLF data', () => {
    const { container } = renderCard({
      profile: { primarySport: 'swimming' },
      log: [
        { type: 'swim', date: '2026-05-10' }, // no swolf, no strokes/etc
      ],
    })
    expect(container.firstChild).toBeNull()
  })
})

describe('SwimSwolfTrendCard — rendering with data', () => {
  it('renders an improving trend (green, ↓ arrow, data-trend="improving")', () => {
    const log = [
      // First week (older) ~60
      swim(26, 60), swim(24, 62), swim(22, 61),
      // Mid
      swim(15, 56),
      // Last week (recent) ~50
      swim(5, 50), swim(2, 51), swim(1, 49),
    ]
    renderCard({ log, profile: { primarySport: 'swimming' } })

    const card = document.querySelector('[data-swim-swolf-trend-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-trend')).toBe('improving')
    // Arrow + label rendered
    expect(card.textContent).toMatch(/↓/)
    expect(card.textContent).toMatch(/IMPROVING/i)
    // Citation
    expect(card.textContent).toMatch(/Maglischo 2003/i)
  })

  it('data-trend attribute matches the computed trend (declining)', () => {
    const log = [
      // First week ~50
      swim(26, 50), swim(24, 51), swim(22, 49),
      // Mid
      swim(15, 55),
      // Last week ~63
      swim(5, 63), swim(2, 64), swim(1, 62),
    ]
    renderCard({ log, profile: { primarySport: 'swimming' } })
    const card = document.querySelector('[data-swim-swolf-trend-card]')
    expect(card.getAttribute('data-trend')).toBe('declining')
    expect(card.textContent).toMatch(/↑/)
    expect(card.textContent).toMatch(/DECLINING/i)
  })

  it('renders for a triathlete with swim entries', () => {
    const log = [
      swim(20, 58), swim(10, 56), swim(2, 54),
    ]
    renderCard({ log, profile: { primarySport: 'triathlon' } })
    expect(screen.getByRole('region', { name: /28-day SWOLF efficiency trend/i })).toBeInTheDocument()
  })
})

describe('SwimSwolfTrendCard — bilingual', () => {
  it('renders Turkish heading "SWOLF · 28G" when lang=tr', () => {
    const log = [
      swim(20, 58), swim(10, 56), swim(2, 54),
    ]
    renderCard({ log, profile: { primarySport: 'swimming' } }, 'tr')
    const region = screen.getByRole('region', { name: /28 günlük SWOLF/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/SWOLF · 28G/)
  })
})
