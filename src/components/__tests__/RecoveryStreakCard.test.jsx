// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import RecoveryStreakCard from '../dashboard/RecoveryStreakCard.jsx'

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
      <RecoveryStreakCard {...props} />
    </LangCtx.Provider>
  )
}

describe('RecoveryStreakCard', () => {
  it('(a) renders nothing when recovery is empty', () => {
    const { container } = renderCard({ recovery: [] })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders nothing when recovery is undefined / null', () => {
    const { container } = renderCard({ recovery: undefined })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when both current and longest are zero (today low, no prior)', () => {
    const { container } = renderCard({
      recovery: [{ date: TODAY, score: 30 }],
    })
    expect(container.firstChild).toBeNull()
  })

  it('(b) renders the current streak count for an active streak', () => {
    const recovery = []
    for (let i = 0; i < 5; i++) recovery.push({ date: isoOffset(-i), score: 80 })
    renderCard({ recovery })
    const region = screen.getByRole('region', { name: /Recovery streak/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/RECOVERY STREAK/)
    expect(region.textContent).toMatch(/5\s*days/)
    expect(region.textContent).toMatch(/best 90d: 5/)
    expect(region.textContent).toMatch(/Halson 2014/)
  })

  it('(c) data-current-streak attribute matches the integer streak length', () => {
    const recovery = []
    for (let i = 0; i < 7; i++) recovery.push({ date: isoOffset(-i), score: 85 })
    renderCard({ recovery })
    const el = document.querySelector('[data-recovery-streak-card]')
    expect(el).not.toBeNull()
    expect(el.getAttribute('data-current-streak')).toBe('7')
  })

  it('(d) milestone fire marker appears when currentStreak ≥ 14', () => {
    const recovery = []
    for (let i = 0; i < 15; i++) recovery.push({ date: isoOffset(-i), score: 90 })
    renderCard({ recovery })
    const fire = document.querySelector('[data-recovery-streak-fire]')
    expect(fire).not.toBeNull()
    expect(fire.textContent).toContain('🔥')
  })

  it('milestone fire marker is ABSENT when currentStreak < 14', () => {
    const recovery = []
    for (let i = 0; i < 10; i++) recovery.push({ date: isoOffset(-i), score: 90 })
    renderCard({ recovery })
    expect(document.querySelector('[data-recovery-streak-fire]')).toBeNull()
  })

  it('still renders when current=0 but a longest streak exists in the window', () => {
    // Today low (breaks current); prior 4-day good run → longest=4, current=0
    const recovery = [
      { date: TODAY,         score: 40 },
      { date: isoOffset(-1), score: 85 },
      { date: isoOffset(-2), score: 85 },
      { date: isoOffset(-3), score: 85 },
      { date: isoOffset(-4), score: 85 },
    ]
    renderCard({ recovery })
    const region = screen.queryByRole('region', { name: /Recovery streak/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/best 90d: 4/)
    const el = document.querySelector('[data-recovery-streak-card]')
    expect(el.getAttribute('data-current-streak')).toBe('0')
  })

  it('(e) Turkish copy renders when lang=tr', () => {
    const recovery = []
    for (let i = 0; i < 5; i++) recovery.push({ date: isoOffset(-i), score: 80 })
    renderCard({ recovery }, 'tr')
    const region = screen.getByRole('region', { name: /Toparlanma serisi/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/TOPARLANMA SERİSİ/)
    expect(region.textContent).toMatch(/gün/)
    expect(region.textContent).toMatch(/90 gün en iyi:/)
  })
})
