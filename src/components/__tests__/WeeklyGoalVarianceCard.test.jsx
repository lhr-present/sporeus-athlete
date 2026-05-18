// @vitest-environment jsdom
// ─── WeeklyGoalVarianceCard.test.jsx — render tests for the goal-variance card
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import WeeklyGoalVarianceCard from '../dashboard/WeeklyGoalVarianceCard.jsx'

// 2026-05-17 is a Sunday → Monday of that week is 2026-05-11.
const TODAY = '2026-05-17'

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
      <WeeklyGoalVarianceCard {...props} />
    </LangCtx.Provider>
  )
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

// Build 8 weekly sessions (oldest first) with the given weekly-TSS amounts.
function buildWeeklyLog(weeklyTss) {
  const monday = mondayOf(TODAY)
  const log = []
  for (let i = 0; i < weeklyTss.length; i++) {
    const weekStart = isoMinusDays(monday, (weeklyTss.length - 1 - i) * 7)
    const sessionDate = isoMinusDays(weekStart, -2)
    if (weeklyTss[i] > 0) {
      log.push({ date: sessionDate, tss: weeklyTss[i] })
    }
  }
  return log
}

// ─── Render-null gating ─────────────────────────────────────────────────────

describe('WeeklyGoalVarianceCard — render gating', () => {
  it('renders NOTHING when profile has no weeklyTssGoal', () => {
    const log = buildWeeklyLog([400, 400, 400, 400, 400, 400, 400, 400])
    const { container } = renderCard({ log, profile: {} })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders NOTHING when weeklyTssGoal is 0', () => {
    const log = buildWeeklyLog([400, 400, 400, 400, 400, 400, 400, 400])
    const { container } = renderCard({ log, profile: { weeklyTssGoal: 0 } })
    expect(container.firstChild).toBeNull()
  })

  it('renders NOTHING when fewer than 4 of 8 weeks have any sessions', () => {
    // Only 3 weeks with sessions.
    const log = buildWeeklyLog([400, 0, 0, 400, 0, 0, 400, 0])
    const { container } = renderCard({
      log, profile: { weeklyTssGoal: 400 },
    })
    expect(container.firstChild).toBeNull()
  })

  it('renders NOTHING for an empty log', () => {
    const { container } = renderCard({
      log: [], profile: { weeklyTssGoal: 400 },
    })
    expect(container.firstChild).toBeNull()
  })
})

// ─── Band rendering ─────────────────────────────────────────────────────────

describe('WeeklyGoalVarianceCard — band rendering', () => {
  it('renders ON_TARGET band with green color', () => {
    const log = buildWeeklyLog([400, 400, 400, 400, 400, 400, 400, 400])
    renderCard({ log, profile: { weeklyTssGoal: 400 } })
    const card = screen.getByRole('region', { name: /Weekly TSS goal variance/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-goal-band')).toBe('ON_TARGET')
    expect(card.getAttribute('data-weekly-goal')).toBe('400')
    expect(card.getAttribute('data-avg-variance')).toBe('0')
    // Green stripe on left border.
    expect(card.style.borderLeft).toMatch(/rgb\(91,\s*194,\s*91\)/)
    expect(card.textContent).toMatch(/ON TARGET/)
    expect(card.textContent).toMatch(/Locke 2002/)
    expect(card.textContent).toMatch(/Latham 2002/)
  })

  it('renders UNDER band with blue color', () => {
    // 60% of goal across all 8 weeks → variance -0.4 → UNDER.
    const log = buildWeeklyLog([240, 240, 240, 240, 240, 240, 240, 240])
    renderCard({ log, profile: { weeklyTssGoal: 400 } })
    const card = screen.getByRole('region', { name: /Weekly TSS goal variance/i })
    expect(card.getAttribute('data-goal-band')).toBe('UNDER')
    // Blue (#0064ff) stripe on left border.
    expect(card.style.borderLeft).toMatch(/rgb\(0,\s*100,\s*255\)/)
    expect(card.textContent).toMatch(/UNDER/)
    // Reco hint EN.
    expect(card.textContent).toMatch(/below goal/i)
  })

  it('renders OVER band with orange color', () => {
    // 140% of goal across all 8 weeks → variance +0.4 → OVER.
    const log = buildWeeklyLog([560, 560, 560, 560, 560, 560, 560, 560])
    renderCard({ log, profile: { weeklyTssGoal: 400 } })
    const card = screen.getByRole('region', { name: /Weekly TSS goal variance/i })
    expect(card.getAttribute('data-goal-band')).toBe('OVER')
    expect(card.style.borderLeft).toMatch(/rgb\(255,\s*102,\s*0\)/)
    expect(card.textContent).toMatch(/OVER/)
    // Reco hint EN.
    expect(card.textContent).toMatch(/above goal/i)
  })
})

// ─── Bar anchors ────────────────────────────────────────────────────────────

describe('WeeklyGoalVarianceCard — weekly bar anchors', () => {
  it('renders exactly 8 bars with data-week-bar + data-week-start + data-week-tss + data-week-variance', () => {
    const log = buildWeeklyLog([400, 400, 400, 400, 400, 400, 400, 400])
    renderCard({ log, profile: { weeklyTssGoal: 400 } })
    const bars = document.querySelectorAll('[data-week-bar]')
    expect(bars).toHaveLength(8)
    bars.forEach(bar => {
      expect(bar.getAttribute('data-week-start')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(bar.getAttribute('data-week-tss')).not.toBeNull()
      expect(bar.getAttribute('data-week-variance')).not.toBeNull()
    })
  })
})

// ─── Bilingual (Turkish) ────────────────────────────────────────────────────

describe('WeeklyGoalVarianceCard — Turkish', () => {
  it('renders Turkish heading and band label when lang=tr', () => {
    const log = buildWeeklyLog([400, 400, 400, 400, 400, 400, 400, 400])
    renderCard({ log, profile: { weeklyTssGoal: 400 } }, 'tr')
    expect(screen.getByText(/HAFTALIK HEDEF · 8H/)).toBeInTheDocument()
    expect(screen.getByText(/HEDEFTE/)).toBeInTheDocument()
    // Turkish reco snippet appears.
    expect(screen.getByText(/güçlü uyum/)).toBeInTheDocument()
  })

  it('renders Turkish UNDER label when avgVariance is below -10%', () => {
    const log = buildWeeklyLog([240, 240, 240, 240, 240, 240, 240, 240])
    renderCard({ log, profile: { weeklyTssGoal: 400 } }, 'tr')
    expect(screen.getByText(/ALTINDA/)).toBeInTheDocument()
  })

  it('renders Turkish OVER label when avgVariance is above +10%', () => {
    const log = buildWeeklyLog([560, 560, 560, 560, 560, 560, 560, 560])
    renderCard({ log, profile: { weeklyTssGoal: 400 } }, 'tr')
    expect(screen.getByText(/ÜSTÜNDE/)).toBeInTheDocument()
  })
})
