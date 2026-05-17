// @vitest-environment jsdom
// ─── SessionClassifierBreakdownCard.test.jsx — week-distribution tests ───
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import SessionClassifierBreakdownCard from '../dashboard/SessionClassifierBreakdownCard.jsx'

// Freeze "today" to Wed 2026-05-13 — Mon-Sun week is 2026-05-11..2026-05-17.
const TODAY = '2026-05-13T12:00:00Z'
const WEEK_DATES = {
  mon: '2026-05-11',
  tue: '2026-05-12',
  wed: '2026-05-13',
  thu: '2026-05-14',
  fri: '2026-05-15',
  sat: '2026-05-16',
  sun: '2026-05-17',
}
const OUTSIDE = '2026-05-04' // Mon of the previous week

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function renderCard(props = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <SessionClassifierBreakdownCard {...props} />
    </LangCtx.Provider>
  )
}

describe('SessionClassifierBreakdownCard — empty + below threshold', () => {
  it('renders nothing for empty log', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when this-week has <2 sessions', () => {
    const log = [
      // 1 session this week + 1 from a prior week → only 1 in-week
      { date: WEEK_DATES.tue, type: 'Easy Run', duration: 60, rpe: 6, tss: 60 },
      { date: OUTSIDE,        type: 'Easy Run', duration: 60, rpe: 6, tss: 60 },
    ]
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })
})

describe('SessionClassifierBreakdownCard — distribution rendering', () => {
  it('renders for a week with 3+ sessions, showing at least 2 type rows', () => {
    const log = [
      // recovery: short + low RPE
      { date: WEEK_DATES.mon, type: 'Easy Run', duration: 30, rpe: 3, tss: 25 },
      // moderate: normal session
      { date: WEEK_DATES.tue, type: 'Easy Run', duration: 60, rpe: 6, tss: 60 },
      // unplanned_high: TSS >= 150, no plan
      { date: WEEK_DATES.thu, type: 'Long Run', duration: 180, rpe: 7, tss: 200 },
    ]
    renderCard({ log })
    const region = screen.getByRole('region', {
      name: /Weekly session classification breakdown/i,
    })
    expect(region).toBeInTheDocument()
    const rows = region.querySelectorAll('tbody tr[data-tag]')
    expect(rows.length).toBeGreaterThanOrEqual(2)
  })

  it('data-types-present attribute lists the expected classifier keys', () => {
    const log = [
      // recovery
      { date: WEEK_DATES.mon, type: 'Easy Run', duration: 30, rpe: 3, tss: 25 },
      // moderate
      { date: WEEK_DATES.tue, type: 'Easy Run', duration: 60, rpe: 6, tss: 60 },
      // unplanned_high
      { date: WEEK_DATES.thu, type: 'Long Run', duration: 180, rpe: 7, tss: 200 },
    ]
    renderCard({ log })
    const region = screen.getByRole('region', {
      name: /Weekly session classification breakdown/i,
    })
    const types = (region.getAttribute('data-types-present') || '').split(',')
    expect(types).toContain('recovery')
    expect(types).toContain('moderate')
    expect(types).toContain('unplanned_high')
  })

  it('citation footer cites Daniels / Coggan / Seiler', () => {
    const log = [
      { date: WEEK_DATES.mon, type: 'Easy Run', duration: 30, rpe: 3, tss: 25 },
      { date: WEEK_DATES.tue, type: 'Easy Run', duration: 60, rpe: 6, tss: 60 },
    ]
    renderCard({ log })
    const region = screen.getByRole('region', {
      name: /Weekly session classification breakdown/i,
    })
    expect(region.textContent).toMatch(/Daniels 2014/)
    expect(region.textContent).toMatch(/Coggan 2010/)
    expect(region.textContent).toMatch(/Seiler 2010/)
  })
})

describe('SessionClassifierBreakdownCard — bilingual labels', () => {
  it('Z2 / Eşik labels resolve correctly by lang', () => {
    // Pre-tagged synthetic sessions: classifySession would map by load/RPE,
    // but the card honours an explicit s.tag so we can exercise the label
    // map for the polarized type names referenced in the spec.
    const log = [
      { date: WEEK_DATES.mon, type: 'Easy Run', duration: 60, rpe: 4, tss: 40, tag: 'z2' },
      { date: WEEK_DATES.tue, type: 'Threshold', duration: 60, rpe: 8, tss: 90, tag: 'threshold' },
      { date: WEEK_DATES.thu, type: 'Long Run', duration: 120, rpe: 6, tss: 110, tag: 'z2' },
    ]
    // EN
    const en = renderCard({ log }, 'en')
    const enRegion = en.getByRole
      ? en.getByRole('region')
      : screen.getByRole('region')
    expect(enRegion.textContent).toMatch(/Z2 Easy/)
    expect(enRegion.textContent).toMatch(/Threshold/)
    cleanup()
    // TR
    renderCard({ log }, 'tr')
    const trRegion = screen.getByRole('region')
    expect(trRegion.textContent).toMatch(/Z2 Hafif/)
    expect(trRegion.textContent).toMatch(/Eşik/)
  })

  it('renders Turkish heading "HAFTA · SINIFLAMA" when lang=tr', () => {
    const log = [
      { date: WEEK_DATES.mon, type: 'Easy Run', duration: 60, rpe: 6, tss: 60 },
      { date: WEEK_DATES.tue, type: 'Easy Run', duration: 60, rpe: 6, tss: 60 },
      { date: WEEK_DATES.thu, type: 'Easy Run', duration: 60, rpe: 6, tss: 60 },
    ]
    renderCard({ log }, 'tr')
    const region = screen.getByRole('region')
    expect(region.textContent).toMatch(/HAFTA · SINIFLAMA/)
    // English heading absent
    expect(region.textContent).not.toMatch(/WEEK · CLASSIFIED/)
  })
})

describe('SessionClassifierBreakdownCard — date windowing', () => {
  it('ignores sessions outside the current Mon-Sun week', () => {
    const log = [
      // 5 from a previous week → should be filtered out
      { date: OUTSIDE, type: 'Easy Run', duration: 60, rpe: 6, tss: 60 },
      { date: OUTSIDE, type: 'Easy Run', duration: 60, rpe: 6, tss: 60 },
      { date: OUTSIDE, type: 'Easy Run', duration: 60, rpe: 6, tss: 60 },
      { date: OUTSIDE, type: 'Easy Run', duration: 60, rpe: 6, tss: 60 },
      { date: OUTSIDE, type: 'Easy Run', duration: 60, rpe: 6, tss: 60 },
      // 1 session this week — under <2 threshold once outsiders filtered
      { date: WEEK_DATES.mon, type: 'Easy Run', duration: 60, rpe: 6, tss: 60 },
    ]
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })
})
