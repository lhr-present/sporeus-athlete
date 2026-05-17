// @vitest-environment jsdom
// ─── CaffeineDoseCard.test.jsx — render tests for caffeine dose card ───────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import CaffeineDoseCard from '../dashboard/CaffeineDoseCard.jsx'

// 2026-05-07 is a Thursday → planDayIdx = (4 + 6) % 7 = 3.
// With generatedAt = 2026-05-07, weekIdx = 0, dayIdx = 3.
const TODAY_ISO = '2026-05-07'

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY_ISO}T12:00:00Z`))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function makePlan(sessionForToday) {
  // weeks[0].sessions[3] is "today" given the date setup above
  const filler = { type: 'Rest', duration: 0, rpe: 0 }
  return {
    generatedAt: TODAY_ISO,
    weeks: [{
      phase: 'Build',
      sessions: [filler, filler, filler, sessionForToday, filler, filler, filler],
    }],
  }
}

function renderCard(props = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <CaffeineDoseCard {...props} />
    </LangCtx.Provider>
  )
}

describe('CaffeineDoseCard — null gates', () => {
  it('(a) renders nothing without profile.weight', () => {
    const plan = makePlan({ type: 'intervals', duration: 60, rpe: 8 })
    const { container } = renderCard({ profile: {}, plan })
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-caffeine-dose-card]')).toBeNull()
  })

  it('(b) renders nothing without a hard session today', () => {
    const plan = makePlan({ type: 'recovery', duration: 30, rpe: 3 })
    const { container } = renderCard({ profile: { weight: 70 }, plan })
    expect(container.firstChild).toBeNull()
  })

  it('(b2) renders nothing when plan is null', () => {
    const { container } = renderCard({ profile: { weight: 70 }, plan: null })
    expect(container.firstChild).toBeNull()
  })
})

describe('CaffeineDoseCard — valid render', () => {
  it('(c) renders typical dose for valid input (70 kg + intervals)', () => {
    const plan = makePlan({ type: 'intervals', duration: 60, rpe: 8 })
    renderCard({ profile: { weight: 70 }, plan })
    const region = screen.getByRole('region', { name: /caffeine dose guidance/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/350 mg/)
    expect(region.textContent).toMatch(/45 min pre-session/)
    expect(region.textContent).toMatch(/Burke 2017/)
  })

  it('(d) data-dose-typical attribute equals the integer mg value', () => {
    const plan = makePlan({ type: 'intervals', duration: 60, rpe: 8 })
    renderCard({ profile: { weight: 70 }, plan })
    const card = document.querySelector('[data-caffeine-dose-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-dose-typical')).toBe('350')
  })

  it('shows the long-session split note when session > 90 min', () => {
    const plan = makePlan({ type: 'threshold', duration: 120, rpe: 7 })
    renderCard({ profile: { weight: 70 }, plan })
    const splitNote = document.querySelector('[data-caffeine-split-note]')
    expect(splitNote).not.toBeNull()
    expect(splitNote.textContent).toMatch(/half pre-session/i)
  })

  it('omits the split note for short hard sessions (≤90 min)', () => {
    const plan = makePlan({ type: 'intervals', duration: 60, rpe: 8 })
    renderCard({ profile: { weight: 70 }, plan })
    expect(document.querySelector('[data-caffeine-split-note]')).toBeNull()
  })
})

describe('CaffeineDoseCard — bilingual', () => {
  it('(e) Turkish heading "KAFEİN · BUGÜN" renders when lang=tr', () => {
    const plan = makePlan({ type: 'intervals', duration: 60, rpe: 8 })
    renderCard({ profile: { weight: 70 }, plan }, 'tr')
    const region = screen.getByRole('region', { name: /kafein dozu/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/KAFEİN · BUGÜN/)
    expect(region.textContent).toMatch(/45 dk önce/)
    expect(region.textContent).toMatch(/Hassasiyetin varsa veya 14:00 sonrası alma/)
  })

  it('Turkish split note renders for long hard session when lang=tr', () => {
    const plan = makePlan({ type: 'threshold', duration: 120, rpe: 8 })
    renderCard({ profile: { weight: 70 }, plan }, 'tr')
    const splitNote = document.querySelector('[data-caffeine-split-note]')
    expect(splitNote).not.toBeNull()
    expect(splitNote.textContent).toMatch(/Uzun seans/)
  })
})
