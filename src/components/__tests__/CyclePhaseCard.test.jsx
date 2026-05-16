// @vitest-environment jsdom
// ─── CyclePhaseCard.test.jsx — privacy + render tests (v9.187.0) ────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import CyclePhaseCard from '../dashboard/CyclePhaseCard.jsx'

beforeEach(() => { vi.setSystemTime(new Date('2026-05-07T12:00:00Z')) })
afterEach(() => { cleanup(); vi.setSystemTime(new Date()) })

function renderCard(profile, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <CyclePhaseCard profile={profile} />
    </LangCtx.Provider>
  )
}

describe('CyclePhaseCard — privacy gate', () => {
  it('renders NOTHING for empty profile', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })

  it('renders NOTHING for male profile (even with cycle data filled)', () => {
    const { container } = renderCard({ gender: 'male', lastPeriodStart: '2026-04-15', cycleLength: 28 })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders NOTHING for female without lastPeriodStart (not opted in)', () => {
    const { container } = renderCard({ gender: 'female' })
    expect(container.firstChild).toBeNull()
  })
})

describe('CyclePhaseCard — opted-in render', () => {
  it('renders the region for female + lastPeriodStart', () => {
    renderCard({ gender: 'female', lastPeriodStart: '2026-04-15', cycleLength: 28 })
    const region = screen.getByRole('region', { name: /Cycle phase guidance/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/McNulty/)
    expect(region.textContent).toMatch(/opt-in and visible only to you/i)
  })

  it('renders Turkish labels + privacy note when lang=tr', () => {
    renderCard({ gender: 'female', lastPeriodStart: '2026-04-15', cycleLength: 28 }, 'tr')
    const region = screen.getByRole('region', { name: /Döngü fazı önerisi/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/yalnızca sana görünür/i)
  })

  it('renders one forecast cell per gate week', () => {
    renderCard({ gender: 'female', lastPeriodStart: '2026-04-15', cycleLength: 28 })
    // buildCyclePhaseGate defaults to 4 weeks; each week renders W1..W4
    const region = screen.getByRole('region', { name: /Cycle phase guidance/i })
    expect(region.textContent).toMatch(/W1/)
    expect(region.textContent).toMatch(/W4/)
  })
})
