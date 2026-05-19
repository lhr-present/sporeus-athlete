// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import LogStreakBreakerCard from '../dashboard/LogStreakBreakerCard.jsx'

const TODAY = '2026-05-17'

function isoOffset(days) {
  const d = new Date(TODAY + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

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
      <LogStreakBreakerCard {...props} />
    </LangCtx.Provider>
  )
}

describe('LogStreakBreakerCard', () => {
  it('renders nothing when log and recovery are both empty', () => {
    const { container } = renderCard({ log: [], recovery: [] })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders nothing when log and recovery are undefined', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })

  it('renders ACTIVE status for a long current streak with no historical gaps', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push({ date: isoOffset(-i) })
    renderCard({ log, recovery: [] })
    const region = screen.getByRole('region', { name: /Streak versus longest break/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/STREAK vs LONGEST BREAK/)
    expect(region.textContent).toMatch(/10\s*days/)
    expect(region.textContent).toMatch(/ACTIVE/)
    expect(region.textContent).toMatch(/momentum's compounding/i)
    expect(region.textContent).toMatch(/Wood 2013/)
    expect(region.textContent).toMatch(/Duckworth 2007/)
  })

  it('renders STEADY status for a 3-6 day streak', () => {
    const log = []
    for (let i = 0; i < 4; i++) log.push({ date: isoOffset(-i) })
    renderCard({ log, recovery: [] })
    const region = screen.getByRole('region')
    expect(region.textContent).toMatch(/STEADY/)
    expect(region.textContent).toMatch(/4\s*days/)
    expect(region.textContent).toMatch(/Active streak holding/i)
  })

  it('renders RECENT_BREAK status when current streak < 3', () => {
    // Single entry today, no history → currentStreak=1, longestGap=0, status RECENT_BREAK.
    renderCard({ log: [{ date: TODAY }], recovery: [] })
    const region = screen.getByRole('region')
    expect(region.textContent).toMatch(/RECENT BREAK/)
    expect(region.textContent).toMatch(/1\s*day/)
    expect(region.textContent).toMatch(/Logging just lapsed/i)
  })

  it('exposes all data anchors with correct values', () => {
    // Build: 5-day current streak + an old island 30 days ago (gap = 24).
    const log = []
    for (let i = 0; i < 5; i++) log.push({ date: isoOffset(-i) })
    log.push({ date: isoOffset(-30) })
    renderCard({ log, recovery: [] })
    const el = document.querySelector('[data-log-streak-breaker-card]')
    expect(el).not.toBeNull()
    expect(el.getAttribute('data-streak-status')).toBe('STEADY')
    expect(el.getAttribute('data-current-streak')).toBe('5')
    expect(el.getAttribute('data-longest-gap')).toBe('25')
    expect(el.getAttribute('data-gap-start')).toBe(isoOffset(-30))
    expect(el.getAttribute('data-gap-end')).toBe(isoOffset(-4))
    expect(el.getAttribute('data-total-logged-days')).toBe('6')
  })

  it('shows the longest-break comparison line with end date', () => {
    const log = [
      { date: isoOffset(-40) },
      { date: TODAY },
      { date: isoOffset(-1) },
    ]
    renderCard({ log, recovery: [] })
    const region = screen.getByRole('region')
    // Gap: -40 → -1 = 38 days, ended on isoOffset(-1).
    expect(region.textContent).toMatch(/longest break ever: 38 days/)
    expect(region.textContent).toMatch(new RegExp(`ended ${isoOffset(-1)}`))
  })

  it('renders Turkish copy when lang=tr', () => {
    const log = []
    for (let i = 0; i < 4; i++) log.push({ date: isoOffset(-i) })
    renderCard({ log, recovery: [] }, 'tr')
    const region = screen.getByRole('region', { name: /Seri ve en uzun ara/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/SERİ vs EN UZUN ARA/)
    expect(region.textContent).toMatch(/SABİT/)
    expect(region.textContent).toMatch(/gün/)
    expect(region.textContent).toMatch(/en uzun ara:/)
    expect(region.textContent).toMatch(/Aktif seri devam ediyor/)
  })

  it('renders Turkish AKTİF label for ACTIVE status', () => {
    const log = []
    for (let i = 0; i < 12; i++) log.push({ date: isoOffset(-i) })
    renderCard({ log, recovery: [] }, 'tr')
    const el = document.querySelector('[data-log-streak-breaker-card]')
    expect(el.getAttribute('data-streak-status')).toBe('ACTIVE')
    expect(el.textContent).toMatch(/AKTİF/)
    expect(el.textContent).toMatch(/momentum birikiyor/)
  })

  it('renders Turkish ARA label for RECENT_BREAK status', () => {
    renderCard({ log: [{ date: isoOffset(-10) }], recovery: [] }, 'tr')
    const el = document.querySelector('[data-log-streak-breaker-card]')
    expect(el.getAttribute('data-streak-status')).toBe('RECENT_BREAK')
    expect(el.textContent).toMatch(/ARA/)
    expect(el.textContent).toMatch(/yeniden başla/)
  })

  it('combines log and recovery into one streak count', () => {
    // log has today, -2; recovery has -1, -3 — together → 4-day consecutive run.
    const log = [{ date: TODAY }, { date: isoOffset(-2) }]
    const recovery = [
      { date: isoOffset(-1), score: 80 },
      { date: isoOffset(-3), score: 80 },
    ]
    renderCard({ log, recovery })
    const el = document.querySelector('[data-log-streak-breaker-card]')
    expect(el.getAttribute('data-current-streak')).toBe('4')
    expect(el.getAttribute('data-total-logged-days')).toBe('4')
  })
})
