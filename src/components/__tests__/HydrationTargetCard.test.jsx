// @vitest-environment jsdom
// ─── HydrationTargetCard.test.jsx — render tests for the hydration UI ───────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import HydrationTargetCard from '../dashboard/HydrationTargetCard.jsx'

// 2026-05-07 is a Thursday → dayIdx = 3 (Mon=0)
// generatedAt 2026-05-04 (Mon) puts today inside week 0.
const FIXED_NOW = '2026-05-07T12:00:00Z'
const GENERATED_AT = '2026-05-04T00:00:00Z'

function makePlan(thursdaySession) {
  // 7 entries, index 3 = Thursday
  const sessions = new Array(7).fill(null).map(() => (
    { type: 'Rest', duration: 0 }
  ))
  sessions[3] = thursdaySession
  return {
    generatedAt: GENERATED_AT,
    weeks: [{ phase: 'Base', sessions }],
  }
}

beforeEach(() => {
  vi.setSystemTime(new Date(FIXED_NOW))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function renderCard(props = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <HydrationTargetCard {...props} />
    </LangCtx.Provider>
  )
}

describe('HydrationTargetCard — guard rails', () => {
  it('renders nothing when profile has no weight', () => {
    const { container } = renderCard({ profile: {} })
    expect(container.querySelector('[data-hydration-target-card]')).toBeNull()
    expect(container.firstChild).toBeNull()
  })
})

describe('HydrationTargetCard — daily target', () => {
  it('renders the daily target for a 70 kg profile', () => {
    renderCard({ profile: { weight: 70 } })
    const card = screen.getByRole('region', { name: /hydration target/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-daily-ml')).toBe('2800')
    expect(card.textContent).toMatch(/2800\s*mL/)
    expect(card.textContent).toMatch(/Daily/)
    expect(card.textContent).toMatch(/Sawka 2007/)
  })
})

describe('HydrationTargetCard — per-session block', () => {
  it('renders per-hour fluid + sodium when planned session ≥ 60 min', () => {
    const plan = makePlan({ type: 'Endurance', duration: 90 })
    renderCard({ profile: { weight: 70 }, plan })
    const perSession = document.querySelector('[data-hydration-per-session]')
    expect(perSession).not.toBeNull()
    // Pre-session 500 mL
    expect(perSession.textContent).toMatch(/Pre-session/)
    expect(perSession.textContent).toMatch(/500\s*mL/)
    // Per-hour fluid (600 mL temperate default) + sodium (700 mg)
    expect(perSession.textContent).toMatch(/Per Hour/)
    expect(perSession.textContent).toMatch(/600\s*mL/)
    expect(perSession.textContent).toMatch(/Sodium/)
    expect(perSession.textContent).toMatch(/700\s*mg/)
  })

  it('does NOT render per-session block when planned session < 60 min', () => {
    const plan = makePlan({ type: 'Recovery', duration: 30 })
    renderCard({ profile: { weight: 70 }, plan })
    expect(document.querySelector('[data-hydration-per-session]')).toBeNull()
    // Daily target still rendered
    const card = screen.getByRole('region', { name: /hydration target/i })
    expect(card.textContent).toMatch(/2800\s*mL/)
  })

  it('does NOT render per-session block when there is no plan at all', () => {
    renderCard({ profile: { weight: 70 } })
    expect(document.querySelector('[data-hydration-per-session]')).toBeNull()
  })
})

describe('HydrationTargetCard — bilingual', () => {
  it('renders Turkish heading when lang=tr', () => {
    renderCard({ profile: { weight: 70 } }, 'tr')
    const card = screen.getByRole('region', { name: /hidrasyon hedefi/i })
    expect(card).toBeInTheDocument()
    expect(card.textContent).toMatch(/HİDRASYON HEDEFİ/)
    expect(card.textContent).toMatch(/Günlük/)
    expect(card.textContent).toMatch(/Antrenman Sonrası/)
  })
})
