// @vitest-environment jsdom
// ─── WorkoutDeviationCard.test.jsx — render tests for the 28d adherence card ─
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import WorkoutDeviationCard from '../dashboard/WorkoutDeviationCard.jsx'

const FIXED_TODAY = new Date('2026-04-28T12:00:00Z')

beforeEach(() => {
  vi.setSystemTime(FIXED_TODAY)
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function renderCard({ log, plan }, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <WorkoutDeviationCard log={log} plan={plan} />
    </LangCtx.Provider>
  )
}

function mkPlan(perDayTss) {
  const sessions = Array.from({ length: 7 }, () => ({
    type: 'Easy',
    duration: 60,
    tss: perDayTss,
  }))
  return {
    generatedAt: '2026-04-01',
    weeks: Array.from({ length: 8 }, () => ({
      sessions: sessions.map(s => ({ ...s })),
    })),
  }
}

function mkLog(tssPerDay, today = '2026-04-28', days = 28) {
  const endMs = Date.UTC(
    +today.slice(0, 4),
    +today.slice(5, 7) - 1,
    +today.slice(8, 10),
  )
  const log = []
  for (let i = 0; i < days; i++) {
    const d = new Date(endMs - (days - 1 - i) * 86400000)
    log.push({ date: d.toISOString().slice(0, 10), tss: tssPerDay, type: 'Easy' })
  }
  return log
}

describe('WorkoutDeviationCard — null cases', () => {
  it('(a) renders nothing when no plan', () => {
    const { container } = renderCard({ log: mkLog(50), plan: null })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByText(/28D ADHERENCE/i)).toBeNull()
  })

  it('renders nothing when no log entries in 28d window', () => {
    const { container } = renderCard({ log: [], plan: mkPlan(50) })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when planned TSS is 0', () => {
    const { container } = renderCard({ log: mkLog(50), plan: mkPlan(0) })
    expect(container.firstChild).toBeNull()
  })
})

describe('WorkoutDeviationCard — EXCELLENT case', () => {
  it('(b) renders adherence % + EXCELLENT band when plan and log match', () => {
    renderCard({ log: mkLog(50), plan: mkPlan(50) })
    const card = document.querySelector('[data-workout-deviation-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-adherence-band')).toBe('EXCELLENT')
    expect(card.textContent).toMatch(/28D ADHERENCE/i)
    expect(card.textContent).toMatch(/100%/)
    expect(card.textContent).toMatch(/EXCELLENT/i)
    expect(card.textContent).toMatch(/Foster 2001/)
  })

  it('green border + green band label colour for EXCELLENT', () => {
    renderCard({ log: mkLog(50), plan: mkPlan(50) })
    const card = document.querySelector('[data-workout-deviation-card]')
    // jsdom serialises hex to rgb() in computed inline styles
    expect(card.style.borderLeft).toMatch(/rgb\(91,\s*194,\s*91\)/) // #5bc25b
    const label = document.querySelector('[data-band-label]')
    expect(label.style.color).toBe('rgb(91, 194, 91)') // #5bc25b
  })
})

describe('WorkoutDeviationCard — POOR case', () => {
  it('(c) renders red band label for POOR adherence', () => {
    // 50% adherence: actual=50, planned=100
    renderCard({ log: mkLog(50), plan: mkPlan(100) })
    const card = document.querySelector('[data-workout-deviation-card]')
    expect(card.getAttribute('data-adherence-band')).toBe('POOR')
    expect(card.textContent).toMatch(/50%/)
    expect(card.textContent).toMatch(/POOR/i)
    expect(card.style.borderLeft).toMatch(/rgb\(224,\s*48,\s*48\)/) // #e03030
    const label = document.querySelector('[data-band-label]')
    expect(label.style.color).toBe('rgb(224, 48, 48)') // #e03030
  })
})

describe('WorkoutDeviationCard — data attributes', () => {
  it('(d) data-adherence-band matches band returned by pure fn', () => {
    // 65% → MODERATE
    renderCard({ log: mkLog(65), plan: mkPlan(100) })
    const card = document.querySelector('[data-workout-deviation-card]')
    expect(card.getAttribute('data-adherence-band')).toBe('MODERATE')
    expect(card.textContent).toMatch(/65%/)
  })

  it('exposes region role with bilingual aria-label (EN)', () => {
    renderCard({ log: mkLog(50), plan: mkPlan(50) })
    const region = screen.getByRole('region', { name: /28-day workout adherence card/i })
    expect(region).toBeInTheDocument()
  })
})

describe('WorkoutDeviationCard — Turkish (TR)', () => {
  it('(e) renders "28G UYUM" heading when lang=tr', () => {
    renderCard({ log: mkLog(50), plan: mkPlan(50) }, 'tr')
    const card = document.querySelector('[data-workout-deviation-card]')
    expect(card.textContent).toMatch(/28G UYUM/)
    // EN heading must not leak in
    expect(card.textContent).not.toMatch(/28D ADHERENCE/)
  })

  it('renders Turkish band label (MÜKEMMEL) for EXCELLENT in TR', () => {
    renderCard({ log: mkLog(50), plan: mkPlan(50) }, 'tr')
    const card = document.querySelector('[data-workout-deviation-card]')
    expect(card.textContent).toMatch(/MÜKEMMEL/)
  })

  it('renders Turkish region aria-label when lang=tr', () => {
    renderCard({ log: mkLog(50), plan: mkPlan(50) }, 'tr')
    const region = screen.getByRole('region', { name: /28 günlük antrenman uyum kartı/i })
    expect(region).toBeInTheDocument()
  })
})
