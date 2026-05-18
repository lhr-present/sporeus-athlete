// @vitest-environment jsdom
// ─── RaceDayFuelingTimelineCard.test.jsx — pre-race timeline render tests ──
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import RaceDayFuelingTimelineCard from '../dashboard/RaceDayFuelingTimelineCard.jsx'

beforeEach(() => {
  vi.setSystemTime(new Date('2026-05-17T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function renderCard(profile, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <RaceDayFuelingTimelineCard profile={profile} />
    </LangCtx.Provider>
  )
}

describe('RaceDayFuelingTimelineCard — null gating', () => {
  it('(a) renders nothing without profile.weight', () => {
    const { container } = renderCard({ raceDate: '2026-05-20' })
    expect(container.querySelector('[data-race-day-fueling-timeline-card]')).toBeNull()
  })

  it('(b) renders nothing without a race date', () => {
    const { container } = renderCard({ weight: 70 })
    expect(container.querySelector('[data-race-day-fueling-timeline-card]')).toBeNull()
  })

  it('(c) renders nothing when race is more than 7 days out', () => {
    const { container } = renderCard({ weight: 70, raceDate: '2026-06-30' })
    expect(container.querySelector('[data-race-day-fueling-timeline-card]')).toBeNull()
  })
})

describe('RaceDayFuelingTimelineCard — render', () => {
  it('(d) data-days-to-race attribute matches days from today to race', () => {
    renderCard({ weight: 70, raceDate: '2026-05-20' }) // 3 days out
    const card = document.querySelector('[data-race-day-fueling-timeline-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-days-to-race')).toBe('3')
    expect(screen.getByRole('region', { name: /Pre-race fueling timeline/i })).toBeInTheDocument()
    // English heading
    expect(card.textContent).toMatch(/RACE FUELING · T-3 DAYS/)
    // 5 rows expected (T-72→T-24, T-3h, T-60min, T-15min, T-0)
    expect(card.querySelectorAll('[data-timeline-row]').length).toBeGreaterThanOrEqual(5)
    // Citation footer
    expect(card.textContent).toMatch(/Burke 2017/)
  })

  it('(e) Turkish heading "YARIŞ BESLENME" renders when lang=tr', () => {
    renderCard({ weight: 70, raceDate: '2026-05-20' }, 'tr')
    const card = document.querySelector('[data-race-day-fueling-timeline-card]')
    expect(card).not.toBeNull()
    expect(card.textContent).toMatch(/YARIŞ BESLENME · T-3 GÜN/)
    // Turkish label "Karbonhidrat yükleme" appears in the T-72h row
    expect(card.textContent).toMatch(/Karbonhidrat yükleme/)
    expect(card.textContent).toMatch(/Son jel/)
  })
})
