// @vitest-environment jsdom
// ─── NutritionTimingCard.test.jsx — render tests for the fueling card ───────
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import NutritionTimingCard from '../dashboard/NutritionTimingCard.jsx'

// ─── Render helper with overridable lang ─────────────────────────────────────
function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <NutritionTimingCard {...props} />
    </LangCtx.Provider>
  )
}

// ─── Build a plan whose Mon-index session matches today ─────────────────────
// getTodayPlannedSession() resolves today's date → week 0 (since
// generatedAt = today) → planDayIdx = (today.getDay() + 6) % 7. We populate
// every weekday slot with the same session so the card always finds one
// regardless of which day the test runs.
function buildPlanWithTodaySession(type = 'Tempo run', duration = 75) {
  const today = new Date().toISOString().slice(0, 10)
  const sessions = Array.from({ length: 7 }).map((_, i) => ({
    day:      ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i],
    type,
    duration,
    rpe:      6,
    tss:      90,
  }))
  return {
    generatedAt: today,
    start_date:  today,
    weeks: [{ week: 1, phase: 'build', sessions, totalHours: 8, tss: 500 }],
  }
}

function todayStr() { return new Date().toISOString().slice(0, 10) }

// ─── Empty / prompt states ───────────────────────────────────────────────────
describe('NutritionTimingCard — empty / prompt states', () => {
  it('renders bilingual empty-state when no plan and no log', () => {
    renderCard({ profile: { weight: 70 }, plan: null, log: [] })
    expect(screen.getByText(/No session today/i)).toBeInTheDocument()
  })

  it('renders TR empty-state when lang=tr', () => {
    renderCard({ profile: { weight: 70 }, plan: null, log: [] }, 'tr')
    expect(screen.getByText(/Bugün seans yok/i)).toBeInTheDocument()
  })

  it('renders weight prompt when profile lacks weight', () => {
    const plan = buildPlanWithTodaySession()
    renderCard({ profile: {}, plan, log: [] })
    expect(screen.getByText(/Add weight to profile/i)).toBeInTheDocument()
  })

  it('renders TR weight prompt when weight is invalid (<=0)', () => {
    const plan = buildPlanWithTodaySession()
    renderCard({ profile: { weight: 0 }, plan, log: [] }, 'tr')
    expect(screen.getByText(/profile kilo ekle/i)).toBeInTheDocument()
  })
})

// ─── Render with valid inputs ────────────────────────────────────────────────
describe('NutritionTimingCard — full render', () => {
  it('renders three sections (PRE / DURING / POST) for plan + weight', () => {
    const plan = buildPlanWithTodaySession('Tempo', 75)
    renderCard({ profile: { weight: 70 }, plan, log: [] })
    expect(screen.getByText('PRE')).toBeInTheDocument()
    expect(screen.getByText('DURING')).toBeInTheDocument()
    expect(screen.getByText('POST')).toBeInTheDocument()
  })

  it('falls back to most recent log entry when no plan today', () => {
    const log = [
      { date: todayStr(), type: 'Long run', duration: 120, rpe: 5, tss: 130 },
      { date: '2026-01-01', type: 'Easy run', duration: 30, rpe: 3, tss: 25 },
    ]
    renderCard({ profile: { weight: 70 }, plan: null, log })
    // Should now render the full 3-section card, not the empty-state
    expect(screen.queryByText(/No session today/i)).not.toBeInTheDocument()
    expect(screen.getByText('PRE')).toBeInTheDocument()
    expect(screen.getByText('POST')).toBeInTheDocument()
  })

  it('renders TR section labels (ÖNCE / SIRADA / SONRA) when lang=tr', () => {
    const plan = buildPlanWithTodaySession('Tempo', 75)
    renderCard({ profile: { weight: 70 }, plan, log: [] }, 'tr')
    expect(screen.getByText('ÖNCE')).toBeInTheDocument()
    expect(screen.getByText('SIRADA')).toBeInTheDocument()
    expect(screen.getByText('SONRA')).toBeInTheDocument()
  })

  it('renders total summary line with carb + fluid', () => {
    const plan = buildPlanWithTodaySession('Tempo', 75)
    renderCard({ profile: { weight: 70 }, plan, log: [] })
    expect(screen.getByText(/Total:\s*~\d+g carb · \d+ml fluid/)).toBeInTheDocument()
  })

  it('renders citation footer (Burke 2014; Jeukendrup 2014)', () => {
    const plan = buildPlanWithTodaySession('Tempo', 75)
    renderCard({ profile: { weight: 70 }, plan, log: [] })
    expect(screen.getByText(/Burke 2014; Jeukendrup 2014/)).toBeInTheDocument()
  })
})

// ─── A11y ────────────────────────────────────────────────────────────────────
describe('NutritionTimingCard — a11y', () => {
  it('card root has role=region with bilingual aria-label', () => {
    const plan = buildPlanWithTodaySession('Tempo', 75)
    renderCard({ profile: { weight: 70 }, plan, log: [] })
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('aria-label')).toMatch(/Nutrition timing/i)
  })

  it('each of the 3 sections has role=group', () => {
    const plan = buildPlanWithTodaySession('Tempo', 75)
    renderCard({ profile: { weight: 70 }, plan, log: [] })
    const groups = screen.getAllByRole('group')
    expect(groups.length).toBe(3)
    // pre / during / post each have an aria-label that ends in "fueling"
    for (const g of groups) {
      expect(g.getAttribute('aria-label')).toMatch(/fueling/i)
    }
  })

  it('total summary has aria-live="polite"', () => {
    const plan = buildPlanWithTodaySession('Tempo', 75)
    const { container } = renderCard({ profile: { weight: 70 }, plan, log: [] })
    const live = container.querySelector('[aria-live="polite"]')
    expect(live).toBeTruthy()
    expect(within(live).getByText(/Total:/i)).toBeInTheDocument()
  })
})
