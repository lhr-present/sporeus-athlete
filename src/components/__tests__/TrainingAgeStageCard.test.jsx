// @vitest-environment jsdom
// ─── TrainingAgeStageCard.test.jsx — dashboard surface tests ──────────────────────
//
// Covers: render-null guard, the four stage bands
// (BEGINNER / DEVELOPING / ESTABLISHED / VETERAN), Turkish heading
// and stage labels, tenure format both `Xy Ymo` and `Xmo`, data
// anchors, citation footer.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import TrainingAgeStageCard from '../dashboard/TrainingAgeStageCard.jsx'

// 2026-05-18 is a Monday — clean ISO-week anchor.
const TODAY = '2026-05-18'

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function makeSessionsOnDate(date, count = 1) {
  const out = []
  for (let i = 0; i < count; i++) out.push({ date, type: 'run', tss: 50 })
  return out
}

function makeWeeklyLog(weekCounts, today = TODAY) {
  const t = new Date(today + 'T12:00:00Z')
  const dow = t.getUTCDay()
  const offset = dow === 0 ? 6 : dow - 1
  const currentMonday = new Date(Date.UTC(
    t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - offset, 12, 0, 0, 0,
  ))
  const log = []
  const W = weekCounts.length
  for (let i = 0; i < W; i++) {
    const offsetWeeks = (W - 1) - i
    const monday = new Date(currentMonday)
    monday.setUTCDate(monday.getUTCDate() - offsetWeeks * 7)
    const date = monday.toISOString().slice(0, 10)
    log.push(...makeSessionsOnDate(date, weekCounts[i]))
  }
  return log
}

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <TrainingAgeStageCard log={log} />
    </LangCtx.Provider>
  )
}

// ─── Guards ──────────────────────────────────────────────────────────────────
describe('TrainingAgeStageCard — guards', () => {
  it('renders nothing for an empty log', () => {
    const { container } = renderCard([])
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-training-age-card]')).toBeNull()
  })

  it('renders nothing when log is null', () => {
    const { container } = renderCard(null)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when log is undefined', () => {
    const { container } = renderCard(undefined)
    expect(container.firstChild).toBeNull()
  })
})

// ─── BEGINNER stage ──────────────────────────────────────────────────────────
describe('TrainingAgeStageCard — BEGINNER stage', () => {
  it('renders with BEGINNER stage for short consistent log', () => {
    // 10 weeks of 3 sessions → 10 consistent weeks → BEGINNER.
    const log = makeWeeklyLog(Array(10).fill(3))
    renderCard(log)
    const card = document.querySelector('[data-training-age-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-development-stage')).toBe('BEGINNER')
    expect(card.getAttribute('data-training-age-weeks')).toBe('10')
    expect(card.getAttribute('data-total-weeks-tracked')).toBe('10')
    expect(card.getAttribute('data-consistency-rate')).toBe('1')

    const region = screen.getByRole('region', { name: /Training Age/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/TRAINING AGE/)
    expect(region.textContent).toMatch(/BEGINNER/)
    expect(region.textContent).toMatch(/Less than 6 months of consistent training/i)
    expect(region.textContent).toMatch(/Focus on building the habit/i)
    expect(region.textContent).toMatch(/Bompa 2018; Tønnessen 2014; Lloyd 2015/)
  })

  it('formats tenure as Xmo when training age < 1 year', () => {
    // 10 consistent weeks → ~2.3 months → "2mo" rendered (rounded).
    const log = makeWeeklyLog(Array(10).fill(3))
    renderCard(log)
    const region = screen.getByRole('region', { name: /Training Age/i })
    expect(region.textContent).toMatch(/\d+mo/)
    // No "Xy Ymo" rendering at this scale.
    expect(region.textContent).not.toMatch(/\d+y \d+mo/)
  })

  it('renders consistencyRate as a percentage string', () => {
    // 4 weeks @ 3 sessions, 6 weeks @ 1 session → 4/10 consistent = 40%.
    const log = makeWeeklyLog([3, 3, 3, 3, 1, 1, 1, 1, 1, 1])
    renderCard(log)
    const region = screen.getByRole('region', { name: /Training Age/i })
    expect(region.textContent).toMatch(/40%/)
    expect(region.textContent).toMatch(/of weeks were ≥3 sessions/)
  })
})

// ─── DEVELOPING stage ────────────────────────────────────────────────────────
describe('TrainingAgeStageCard — DEVELOPING stage', () => {
  it('renders with DEVELOPING stage for 60 consistent weeks', () => {
    const log = makeWeeklyLog(Array(60).fill(3))
    renderCard(log)
    const card = document.querySelector('[data-training-age-card]')
    expect(card.getAttribute('data-development-stage')).toBe('DEVELOPING')
    expect(card.getAttribute('data-training-age-weeks')).toBe('60')
    expect(card.textContent).toMatch(/DEVELOPING/)
    expect(card.textContent).toMatch(/Building athletic base/i)
    expect(card.textContent).toMatch(/Adaptations come faster than they ever will again/i)
  })

  it('formats tenure as Xy Ymo when training age >= 1 year', () => {
    // 60 consistent weeks → 60/52 ≈ 1.15y → "1y Xmo".
    const log = makeWeeklyLog(Array(60).fill(3))
    renderCard(log)
    const region = screen.getByRole('region', { name: /Training Age/i })
    expect(region.textContent).toMatch(/\d+y \d+mo/)
  })
})

// ─── ESTABLISHED stage ───────────────────────────────────────────────────────
describe('TrainingAgeStageCard — ESTABLISHED stage', () => {
  it('renders with ESTABLISHED stage for 150 consistent weeks', () => {
    const log = makeWeeklyLog(Array(150).fill(3))
    renderCard(log)
    const card = document.querySelector('[data-training-age-card]')
    expect(card.getAttribute('data-development-stage')).toBe('ESTABLISHED')
    expect(card.getAttribute('data-training-age-weeks')).toBe('150')
    expect(card.textContent).toMatch(/ESTABLISHED/)
    expect(card.textContent).toMatch(/Solid athletic foundation/i)
    expect(card.textContent).toMatch(/periodization matters more now/i)
  })
})

// ─── VETERAN stage ───────────────────────────────────────────────────────────
describe('TrainingAgeStageCard — VETERAN stage', () => {
  it('renders with VETERAN stage for 300 consistent weeks', () => {
    const log = makeWeeklyLog(Array(300).fill(3))
    renderCard(log)
    const card = document.querySelector('[data-training-age-card]')
    expect(card.getAttribute('data-development-stage')).toBe('VETERAN')
    expect(card.getAttribute('data-training-age-weeks')).toBe('300')
    expect(card.textContent).toMatch(/VETERAN/)
    expect(card.textContent).toMatch(/Long-term endurance athlete/i)
    expect(card.textContent).toMatch(/Recovery and durability outweigh raw volume/i)
  })

  it('formats VETERAN tenure as Xy Ymo with X >= 5', () => {
    // 300 weeks → 5.77y → "5y 9mo" or similar.
    const log = makeWeeklyLog(Array(300).fill(3))
    renderCard(log)
    const region = screen.getByRole('region', { name: /Training Age/i })
    const match = region.textContent.match(/(\d+)y (\d+)mo/)
    expect(match).not.toBeNull()
    expect(Number(match[1])).toBeGreaterThanOrEqual(5)
  })

  it('shows the "over X years of log history" line', () => {
    const log = makeWeeklyLog(Array(300).fill(3))
    renderCard(log)
    const region = screen.getByRole('region', { name: /Training Age/i })
    expect(region.textContent).toMatch(/over [\d.]+ years of log history/)
  })
})

// ─── Turkish ─────────────────────────────────────────────────────────────────
describe('TrainingAgeStageCard — bilingual', () => {
  it('renders the Turkish heading and stage label when lang=tr (BEGINNER)', () => {
    const log = makeWeeklyLog(Array(10).fill(3))
    renderCard(log, 'tr')
    const region = screen.getByRole('region', { name: /Antrenman Yaşı/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/ANTRENMAN YAŞI/)
    expect(region.textContent).toMatch(/YENİ/)
    expect(region.textContent).toMatch(/6 aydan az tutarlı antrenman/)
    expect(region.textContent).toMatch(/tutarlı antrenman/)
  })

  it('renders Turkish stage label for DEVELOPING', () => {
    const log = makeWeeklyLog(Array(60).fill(3))
    renderCard(log, 'tr')
    const card = document.querySelector('[data-training-age-card]')
    expect(card.getAttribute('data-development-stage')).toBe('DEVELOPING')
    expect(card.textContent).toMatch(/GELİŞEN/)
    expect(card.textContent).toMatch(/Atletik temel inşası/)
  })

  it('renders Turkish stage label for ESTABLISHED', () => {
    const log = makeWeeklyLog(Array(150).fill(3))
    renderCard(log, 'tr')
    const card = document.querySelector('[data-training-age-card]')
    expect(card.getAttribute('data-development-stage')).toBe('ESTABLISHED')
    expect(card.textContent).toMatch(/YERLEŞMİŞ/)
    expect(card.textContent).toMatch(/Sağlam atletik temel/)
  })

  it('renders Turkish stage label for VETERAN', () => {
    const log = makeWeeklyLog(Array(300).fill(3))
    renderCard(log, 'tr')
    const card = document.querySelector('[data-training-age-card]')
    expect(card.getAttribute('data-development-stage')).toBe('VETERAN')
    expect(card.textContent).toMatch(/USTA/)
    expect(card.textContent).toMatch(/Uzun vadeli dayanıklılık sporcusu/)
  })
})
