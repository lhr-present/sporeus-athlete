// @vitest-environment jsdom
// ─── EliteRaceWeekCard.test.jsx — race-week gating + bilingual rendering ─────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import EliteRaceWeekCard from '../dashboard/EliteRaceWeekCard.jsx'

// Anchor "today" deterministically for all gating tests.
const TODAY_ISO = '2026-05-17'

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY_ISO}T12:00:00Z`))
})

afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function renderCard(profile = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <EliteRaceWeekCard profile={profile} />
    </LangCtx.Provider>
  )
}

describe('EliteRaceWeekCard — gating', () => {
  it('renders nothing when profile has no raceDate', () => {
    const { container } = renderCard({ primarySport: 'Running' })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region', { name: /race week protocol/i })).toBeNull()
  })

  it('renders nothing when raceDate is more than 7 days away', () => {
    const { container } = renderCard({
      primarySport: 'Running',
      // TODAY = 2026-05-17, race = 2026-06-01 → 15 days away.
      raceDate: '2026-06-01',
    })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when raceDate is in the past', () => {
    const { container } = renderCard({
      primarySport: 'Running',
      raceDate: '2026-05-10', // 7 days ago
    })
    expect(container.firstChild).toBeNull()
  })

  it('renders the card when raceDate is within race week (≤7 days away)', () => {
    renderCard({
      primarySport: 'Running',
      // TODAY = 2026-05-17, race = 2026-05-23 → 6 days away.
      raceDate: '2026-05-23',
    })
    const region = screen.getByRole('region', { name: /elite race week protocol/i })
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('data-elite-race-week-card')).toBe('race-week')
    // Schedule has 8 entries (T-7..T-0).
    const rows = document.querySelectorAll('[data-elite-race-week-row]')
    expect(rows.length).toBe(8)
    // Race-day blocks present.
    expect(document.querySelector('[data-elite-race-week-warmup]')).not.toBeNull()
    expect(document.querySelector('[data-elite-race-week-fueling]')).not.toBeNull()
    // Citation visible.
    expect(document.querySelector('[data-elite-race-week-citation]').textContent).toMatch(/Mujika/)
  })

  it('renders the card on race day itself (daysToRace = 0)', () => {
    renderCard({
      primarySport: 'Running',
      raceDate: TODAY_ISO,
    })
    const region = screen.getByRole('region', { name: /elite race week protocol/i })
    expect(region.getAttribute('data-elite-race-week-card')).toBe('race-day')
  })
})

describe('EliteRaceWeekCard — bilingual day labels', () => {
  it('renders Turkish day-of-week label (e.g. Pzt/Sal/...) when lang="tr"', () => {
    // TODAY = 2026-05-17 (Sun), race = 2026-05-23 (Sat).
    // T-7 row maps to 2026-05-16 = Saturday → "Cmt" in TR.
    renderCard(
      { primarySport: 'Running', raceDate: '2026-05-23' },
      'tr'
    )
    const region = screen.getByRole('region', { name: /elit yarış haftası protokolü/i })
    expect(region).toBeInTheDocument()
    // Header reads YARIŞA … GÜN in TR.
    expect(region.textContent).toMatch(/YARIŞA \d GÜN|YARIŞ GÜNÜ/)
    // At least one row carries a Turkish DoW label (one of the 7 short codes).
    const rows = document.querySelectorAll('[data-elite-race-week-row]')
    const firstCellTexts = Array.from(rows).map(r => r.querySelector('td')?.textContent?.trim())
    const TR_DOW = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
    const hit = firstCellTexts.some(t => TR_DOW.includes(t))
    expect(hit).toBe(true)
    // Sanity: English DoW codes must NOT appear in the day column under TR.
    const EN_DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const englishLeak = firstCellTexts.some(t => EN_DOW.includes(t))
    expect(englishLeak).toBe(false)
  })

  it('renders English day-of-week labels when lang="en"', () => {
    renderCard(
      { primarySport: 'Running', raceDate: '2026-05-23' },
      'en'
    )
    const rows = document.querySelectorAll('[data-elite-race-week-row]')
    const firstCellTexts = Array.from(rows).map(r => r.querySelector('td')?.textContent?.trim())
    const EN_DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const hit = firstCellTexts.some(t => EN_DOW.includes(t))
    expect(hit).toBe(true)
  })
})
