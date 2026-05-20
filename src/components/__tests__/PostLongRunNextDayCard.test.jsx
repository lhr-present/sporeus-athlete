// @vitest-environment jsdom
// ─── PostLongRunNextDayCard.test.jsx — render tests ─────────────────────────
//
// UI tests for PostLongRunNextDayCard. Drives the analyzer via real fixtures
// (no mocks) and asserts on band class, share %, citation footer, EN/TR
// labels, accessibility, stacked-bar segments, and recent-chip rendering.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import PostLongRunNextDayCard from '../dashboard/PostLongRunNextDayCard.jsx'

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
      <PostLongRunNextDayCard {...props} />
    </LangCtx.Provider>
  )
}

function isoAddDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function isoMinusDays(iso, days) {
  return isoAddDays(iso, -days)
}

function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

function buildLongRun({ longRunDate, longRunMin = 120, nextDayTss = 0, nextDayDurMin = 0 }) {
  const out = [
    { date: longRunDate, duration_min: longRunMin, sport: 'run', tss: 0 },
  ]
  if (nextDayTss > 0 || nextDayDurMin > 0) {
    out.push({
      date: isoAddDays(longRunDate, 1),
      duration_min: nextDayDurMin,
      sport: 'easy',
      tss: nextDayTss,
    })
  }
  return out
}

// ─── Null gate ──────────────────────────────────────────────────────────────

describe('PostLongRunNextDayCard — null gate', () => {
  it('renders nothing for an empty log', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when log is null', () => {
    const { container } = renderCard({ log: null })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when there are no long runs in the window', () => {
    const monday = mondayOf(TODAY)
    const log = [
      { date: isoMinusDays(monday, 14), duration_min: 60, sport: 'run' },
    ]
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })
})

// ─── Band rendering ─────────────────────────────────────────────────────────

describe('PostLongRunNextDayCard — band rendering', () => {
  it('renders INSUFFICIENT_LONG_RUNS for 1-3 long runs', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 28) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 14) }),
    ]
    renderCard({ log })
    const card = screen.getByRole('region', { name: /after long run/i })
    expect(card.getAttribute('data-post-long-run-band')).toBe('INSUFFICIENT_LONG_RUNS')
    expect(card.getAttribute('data-total-long-runs')).toBe('2')
    expect(card.textContent).toMatch(/INSUFFICIENT/)
  })

  it('renders IDEAL_RECOVERY for 4 long runs all followed by rest', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 49) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 35) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 21) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 7) }),
    ]
    renderCard({ log })
    const card = screen.getByRole('region')
    expect(card.getAttribute('data-post-long-run-band')).toBe('IDEAL_RECOVERY')
    expect(card.getAttribute('data-total-long-runs')).toBe('4')
    expect(card.getAttribute('data-rest-days')).toBe('4')
    expect(card.textContent).toMatch(/IDEAL RECOVERY/)
  })

  it('renders AGGRESSIVE_FOLLOWUP when ≥40% of next-days are hard', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 49), nextDayTss: 100, nextDayDurMin: 60 }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 35), nextDayTss: 100, nextDayDurMin: 60 }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 21), nextDayTss: 30, nextDayDurMin: 45 }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 7) }),
    ]
    renderCard({ log })
    const card = screen.getByRole('region')
    expect(card.getAttribute('data-post-long-run-band')).toBe('AGGRESSIVE_FOLLOWUP')
    expect(card.getAttribute('data-hard-days')).toBe('2')
    expect(card.textContent).toMatch(/AGGRESSIVE/)
  })

  it('renders MIXED when neither IDEAL nor AGGRESSIVE thresholds met', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 49), nextDayTss: 60, nextDayDurMin: 60 }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 35), nextDayTss: 60, nextDayDurMin: 60 }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 21), nextDayTss: 30, nextDayDurMin: 45 }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 7) }),
    ]
    renderCard({ log })
    const card = screen.getByRole('region')
    expect(card.getAttribute('data-post-long-run-band')).toBe('MIXED')
    expect(card.textContent).toMatch(/MIXED/)
  })
})

// ─── Stacked bar ────────────────────────────────────────────────────────────

describe('PostLongRunNextDayCard — stacked bar', () => {
  it('renders all 4 segments when each band has at least one entry', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 49) }),                                       // rest
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 35), nextDayTss: 20, nextDayDurMin: 40 }),    // easy
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 21), nextDayTss: 50, nextDayDurMin: 50 }),    // moderate
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 7), nextDayTss: 100, nextDayDurMin: 60 }),    // hard
    ]
    renderCard({ log })
    expect(document.querySelector('[data-segment="rest"]')).not.toBeNull()
    expect(document.querySelector('[data-segment="easy"]')).not.toBeNull()
    expect(document.querySelector('[data-segment="moderate"]')).not.toBeNull()
    expect(document.querySelector('[data-segment="hard"]')).not.toBeNull()
  })

  it('omits zero-width segments', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 49) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 35) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 21) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 7) }),
    ]
    renderCard({ log })
    // All rest → only rest segment present
    expect(document.querySelector('[data-segment="rest"]')).not.toBeNull()
    expect(document.querySelector('[data-segment="easy"]')).toBeNull()
    expect(document.querySelector('[data-segment="moderate"]')).toBeNull()
    expect(document.querySelector('[data-segment="hard"]')).toBeNull()
  })
})

// ─── Share % display ────────────────────────────────────────────────────────

describe('PostLongRunNextDayCard — share display', () => {
  it('renders 100% rest+easy share when all next days are rest', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 49) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 35) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 21) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 7) }),
    ]
    renderCard({ log })
    const display = document.querySelector('[data-share-display]')
    expect(display).not.toBeNull()
    expect(display.textContent).toMatch(/100/)
  })
})

// ─── Turkish ────────────────────────────────────────────────────────────────

describe('PostLongRunNextDayCard — Turkish', () => {
  it('renders TR title and band label when lang=tr', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 49) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 35) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 21) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 7) }),
    ]
    renderCard({ log }, 'tr')
    expect(screen.getByText(/UZUN KOŞU SONRASI/)).toBeInTheDocument()
    expect(screen.getByText(/İDEAL TOPARLANMA/)).toBeInTheDocument()
  })

  it('renders TR counts caption with TR segment labels', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 49) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 35) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 21), nextDayTss: 100, nextDayDurMin: 60 }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 7), nextDayTss: 30, nextDayDurMin: 45 }),
    ]
    renderCard({ log }, 'tr')
    const caption = document.querySelector('[data-counts-caption]')
    expect(caption).not.toBeNull()
    expect(caption.textContent).toMatch(/uzun koşu/)
    expect(caption.textContent).toMatch(/dinlenme/)
    expect(caption.textContent).toMatch(/sert/)
  })
})

// ─── Citation + accessibility ───────────────────────────────────────────────

describe('PostLongRunNextDayCard — citation + accessibility', () => {
  it('includes the citation footer with Daniels + Pfitzinger', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 49) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 35) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 21) }),
      ...buildLongRun({ longRunDate: isoMinusDays(monday, 7) }),
    ]
    renderCard({ log })
    const cite = document.querySelector('[data-citation]')
    expect(cite).not.toBeNull()
    expect(cite.textContent).toMatch(/Daniels 2014/)
    expect(cite.textContent).toMatch(/Pfitzinger 2014/)
  })

  it('has role=region, accessible aria-label, and data-card anchor', () => {
    const monday = mondayOf(TODAY)
    const log = buildLongRun({ longRunDate: isoMinusDays(monday, 14) })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /after long run/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-card')).toBe('post-long-run-next-day')
  })

  it('exposes the band on a strip element via data-band-strip', () => {
    const monday = mondayOf(TODAY)
    const log = buildLongRun({ longRunDate: isoMinusDays(monday, 14) })
    renderCard({ log })
    const strip = document.querySelector('[data-band-strip]')
    expect(strip).not.toBeNull()
  })
})

// ─── Recent chips ───────────────────────────────────────────────────────────

describe('PostLongRunNextDayCard — recent chips', () => {
  it('renders chips for up to 4 most-recent long runs', () => {
    const monday = mondayOf(TODAY)
    const log = []
    for (const off of [70, 56, 42, 28, 14]) {
      log.push(...buildLongRun({ longRunDate: isoMinusDays(monday, off) }))
    }
    renderCard({ log })
    const chips = document.querySelectorAll('[data-recent-chip]')
    expect(chips.length).toBe(4)
  })

  it('chip text uses the EN format with month-day and minutes', () => {
    const log = [
      { date: '2026-05-12', duration_min: 130, sport: 'run' },
      { date: '2026-05-13', duration_min: 30, sport: 'easy', tss: 25 },
    ]
    renderCard({ log })
    const chip = document.querySelector('[data-recent-chip]')
    expect(chip).not.toBeNull()
    expect(chip.textContent).toMatch(/May 12/)
    expect(chip.textContent).toMatch(/130m run/)
    expect(chip.textContent).toMatch(/easy/)
  })

  it('chip exposes the next-day kind via data attribute', () => {
    const log = [
      { date: '2026-05-12', duration_min: 130, sport: 'run' },
    ]
    renderCard({ log })
    const chip = document.querySelector('[data-recent-chip]')
    expect(chip).not.toBeNull()
    expect(chip.getAttribute('data-next-day-kind')).toBe('rest')
  })

  it('does not render the chip list when there are no long runs', () => {
    renderCard({ log: [] })
    expect(document.querySelector('[data-recent-chips]')).toBeNull()
  })
})
