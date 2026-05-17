// @vitest-environment jsdom
// ─── FuelingCard.test.jsx — render tests for the fueling Dashboard card ──
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import FuelingCard from '../dashboard/FuelingCard.jsx'
import { buildFuelingProgram } from '../../lib/athlete/eliteProgramFueling.js'

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
      <FuelingCard profile={profile} />
    </LangCtx.Provider>
  )
}

describe('FuelingCard — gating', () => {
  it('renders nothing when profile is missing entirely', () => {
    const { container } = renderCard(undefined)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when profile lacks weight', () => {
    const { container } = renderCard({ gender: 'male' })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when weight is zero or non-numeric', () => {
    const a = renderCard({ weight: 0 })
    expect(a.container.firstChild).toBeNull()
    cleanup()
    const b = renderCard({ weight: 'abc' })
    expect(b.container.firstChild).toBeNull()
  })
})

describe('FuelingCard — complete profile renders card', () => {
  it('renders the card region for a complete profile', () => {
    renderCard({ weight: 70, gender: 'male' })
    const region = screen.getByRole('region', { name: /Fueling program by phase/i })
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('data-fueling-card')).not.toBeNull()
  })

  it('data-fueling-card anchor exists', () => {
    renderCard({ weight: 70, gender: 'male' })
    expect(document.querySelector('[data-fueling-card]')).not.toBeNull()
  })

  it('renders one section per phase (Base/Build/Peak/Taper)', () => {
    renderCard({ weight: 70, gender: 'male' })
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      expect(document.querySelector(`[data-fueling-phase="${phase}"]`)).not.toBeNull()
    }
  })
})

describe('FuelingCard — bodyweight-derived CHO target', () => {
  it('renders absolute daily CHO grams computed from bodyweight (Build phase, 70 kg)', () => {
    renderCard({ weight: 70, gender: 'male' })
    // Sanity-compute the same target via the pure fn
    const fp = buildFuelingProgram({
      phases: [{ phase: 'Build' }],
      bodyMassKg: 70,
      gender: 'male',
    })
    const [lo, hi] = fp.Build.dailyCHO_g
    expect(lo).toBe(Math.round(fp.Build.chodailyPerKg[0] * 70))
    expect(hi).toBe(Math.round(fp.Build.chodailyPerKg[1] * 70))

    const dailyChoCell = document.querySelector('[data-fueling-daily-cho="Build"]')
    expect(dailyChoCell).not.toBeNull()
    // Range label (g/kg/day) shown as primary
    expect(dailyChoCell.textContent).toMatch(
      new RegExp(`${fp.Build.chodailyPerKg[0]}.{1,3}${fp.Build.chodailyPerKg[1]}`)
    )
    // Absolute grams shown as secondary
    expect(dailyChoCell.textContent).toMatch(new RegExp(`${lo}.{1,3}${hi}`))
  })

  it('renders fluid + sodium ranges from the pure fn (male 70 kg)', () => {
    renderCard({ weight: 70, gender: 'male' })
    const fp = buildFuelingProgram({
      phases: [{ phase: 'Build' }],
      bodyMassKg: 70,
      gender: 'male',
    })
    const [flo, fhi] = fp.Build.hydrationMlPerHr
    const [slo, shi] = fp.Build.sodiumMgPerHr
    const fluid = document.querySelector('[data-fueling-fluid="Build"]')
    const sodium = document.querySelector('[data-fueling-sodium="Build"]')
    expect(fluid.textContent).toMatch(new RegExp(`${flo}.{1,3}${fhi}`))
    expect(sodium.textContent).toMatch(new RegExp(`${slo}.{1,3}${shi}`))
  })

  it('session-CHO cell shows the hard-session g/h range', () => {
    renderCard({ weight: 70, gender: 'male' })
    const fp = buildFuelingProgram({
      phases: [{ phase: 'Build' }],
      bodyMassKg: 70,
      gender: 'male',
    })
    const [lo, hi] = fp.Build.duringSession.hardSessionGPerHr
    const cell = document.querySelector('[data-fueling-session-cho="Build"]')
    expect(cell).not.toBeNull()
    expect(cell.textContent).toMatch(new RegExp(`${lo}.{1,3}${hi}`))
  })
})

describe('FuelingCard — bilingual', () => {
  it('renders English labels by default', () => {
    renderCard({ weight: 70, gender: 'male' }, 'en')
    // Labels repeat per phase (one panel per Base/Build/Peak/Taper)
    expect(screen.getAllByText(/Daily CHO/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Fluid/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Sodium/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/FUELING PROGRAM/i)).toBeInTheDocument()
  })

  it('renders Turkish labels when lang=tr', () => {
    renderCard({ weight: 70, gender: 'male' }, 'tr')
    const region = screen.getByRole('region', {
      name: /Faza göre beslenme programı/i,
    })
    expect(region).toBeInTheDocument()
    expect(screen.getByText(/BESLENME PROGRAMI/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Günlük KH/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Sıvı/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Sodyum/i).length).toBeGreaterThan(0)
    // Phase labels translated
    expect(screen.getByText(/TEMEL/)).toBeInTheDocument()
    expect(screen.getByText(/YAPI/)).toBeInTheDocument()
  })
})

describe('FuelingCard — citation', () => {
  it('renders FUELING_CITATION footer in muted small text', () => {
    renderCard({ weight: 70, gender: 'male' })
    const footer = document.querySelector('[data-fueling-citation]')
    expect(footer).not.toBeNull()
    expect(footer.textContent).toMatch(/Burke 2017/)
    expect(footer.textContent).toMatch(/Jeukendrup 2014/)
  })
})

describe('FuelingCard — cohort-aware', () => {
  it('elite cohort daily CHO shifts upward vs default for the same bodyweight', () => {
    const fpElite = buildFuelingProgram({
      phases: [{ phase: 'Build' }],
      bodyMassKg: 70,
      cohort: 'elite',
    })
    renderCard({ weight: 70, cohort: 'elite' })
    const cell = document.querySelector('[data-fueling-daily-cho="Build"]')
    const [lo, hi] = fpElite.Build.chodailyPerKg
    expect(cell.textContent).toMatch(new RegExp(`${lo}.{1,3}${hi}`))
    // Elite Build offset = +2 → 8-10 g/kg, strictly above the default 6-8
    expect(hi).toBeGreaterThan(8)
  })
})
