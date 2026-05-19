// @vitest-environment jsdom
// ─── BackToBackLongDayCard.test.jsx — render tests ──────────────────────────
//
// UI tests for BackToBackLongDayCard. Drives the analyzer via real
// fixtures (no mocks) and asserts on band class, badge presence, citation
// footer, EN/TR labels, accessibility, and chip rendering.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import BackToBackLongDayCard from '../dashboard/BackToBackLongDayCard.jsx'

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
      <BackToBackLongDayCard {...props} />
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

function buildPair({ startDate, day1Min = 120, day2Min = 100, sport1 = 'run', sport2 = 'bike', followingTss = 0 }) {
  const out = [
    { date: startDate, duration_min: day1Min, sport: sport1, tss: 0 },
    { date: isoAddDays(startDate, 1), duration_min: day2Min, sport: sport2, tss: 0 },
  ]
  if (followingTss > 0) {
    out.push({ date: isoAddDays(startDate, 2), duration_min: 30, sport: 'easy', tss: followingTss })
  }
  return out
}

// ─── NONE state ─────────────────────────────────────────────────────────────

describe('BackToBackLongDayCard — NONE state', () => {
  it('renders the NONE band region for an empty log', () => {
    renderCard({ log: [] })
    const card = screen.getByRole('region', { name: /back-to-back long days/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-back-to-back-band')).toBe('NONE')
    expect(card.getAttribute('data-total-occurrences')).toBe('0')
    expect(card.getAttribute('data-flagged-count')).toBe('0')
  })

  it('does not render the flagged badge when flaggedCount = 0', () => {
    renderCard({ log: [] })
    expect(document.querySelector('[data-flagged-badge]')).toBeNull()
  })
})

// ─── Band rendering ─────────────────────────────────────────────────────────

describe('BackToBackLongDayCard — band rendering', () => {
  it('renders OCCASIONAL band for 2 pairs', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildPair({ startDate: isoMinusDays(monday, 56) }),
      ...buildPair({ startDate: isoMinusDays(monday, 28) }),
    ]
    renderCard({ log })
    const card = screen.getByRole('region')
    expect(card.getAttribute('data-back-to-back-band')).toBe('OCCASIONAL')
    expect(card.getAttribute('data-total-occurrences')).toBe('2')
    expect(card.textContent).toMatch(/OCCASIONAL/)
  })

  it('renders BLOCK_STYLE band for 5 clean pairs', () => {
    const monday = mondayOf(TODAY)
    const log = []
    for (const off of [70, 56, 42, 28, 14]) {
      log.push(...buildPair({ startDate: isoMinusDays(monday, off) }))
    }
    renderCard({ log })
    const card = screen.getByRole('region')
    expect(card.getAttribute('data-back-to-back-band')).toBe('BLOCK_STYLE')
    expect(card.getAttribute('data-total-occurrences')).toBe('5')
    expect(card.textContent).toMatch(/BLOCK STYLE/)
  })

  it('renders EXCESSIVE band when ≥9 pairs', () => {
    const monday = mondayOf(TODAY)
    const log = []
    for (const off of [77, 70, 63, 56, 49, 42, 35, 28, 21, 14]) {
      log.push(...buildPair({ startDate: isoMinusDays(monday, off) }))
    }
    renderCard({ log })
    const card = screen.getByRole('region')
    expect(card.getAttribute('data-back-to-back-band')).toBe('EXCESSIVE')
    expect(card.textContent).toMatch(/EXCESSIVE/)
  })

  it('renders EXCESSIVE with flagged badge when most pairs have no recovery', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildPair({ startDate: isoMinusDays(monday, 70), followingTss: 0 }),
      ...buildPair({ startDate: isoMinusDays(monday, 42), followingTss: 200 }),
      ...buildPair({ startDate: isoMinusDays(monday, 14), followingTss: 200 }),
    ]
    renderCard({ log })
    const card = screen.getByRole('region')
    expect(card.getAttribute('data-back-to-back-band')).toBe('EXCESSIVE')
    expect(card.getAttribute('data-flagged-count')).toBe('2')
    const badge = document.querySelector('[data-flagged-badge]')
    expect(badge).not.toBeNull()
    expect(badge.textContent).toMatch(/no 48h recovery/)
  })
})

// ─── Turkish (TR) localization ──────────────────────────────────────────────

describe('BackToBackLongDayCard — Turkish', () => {
  it('renders TR title and band label when lang=tr', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildPair({ startDate: isoMinusDays(monday, 56) }),
      ...buildPair({ startDate: isoMinusDays(monday, 28) }),
    ]
    renderCard({ log }, 'tr')
    expect(screen.getByText(/ÜST ÜSTE UZUN GÜNLER/)).toBeInTheDocument()
    expect(screen.getByText(/ARA SIRA/)).toBeInTheDocument()
  })

  it('renders TR flagged caption when flaggedCount > 0', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildPair({ startDate: isoMinusDays(monday, 42), followingTss: 200 }),
    ]
    renderCard({ log }, 'tr')
    const badge = document.querySelector('[data-flagged-badge]')
    expect(badge).not.toBeNull()
    expect(badge.textContent).toMatch(/48s toparlanma yok/)
  })
})

// ─── Citation + accessibility ───────────────────────────────────────────────

describe('BackToBackLongDayCard — citation + accessibility', () => {
  it('includes the citation footer', () => {
    renderCard({ log: [] })
    const cite = document.querySelector('[data-citation]')
    expect(cite).not.toBeNull()
    expect(cite.textContent).toMatch(/Issurin 2010/)
    expect(cite.textContent).toMatch(/Daniels 2014/)
    expect(cite.textContent).toMatch(/Skorski 2019/)
  })

  it('has role=region, accessible aria-label, and data-card anchor', () => {
    renderCard({ log: [] })
    const card = screen.getByRole('region', { name: /back-to-back long days/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-card')).toBe('back-to-back-long-day')
  })

  it('exposes the band on the strip element via data-band-strip', () => {
    renderCard({ log: [] })
    const strip = document.querySelector('[data-band-strip]')
    expect(strip).not.toBeNull()
  })
})

// ─── Occurrence chips ───────────────────────────────────────────────────────

describe('BackToBackLongDayCard — occurrence chips', () => {
  it('renders chips for occurrences (up to 4 most-recent)', () => {
    const monday = mondayOf(TODAY)
    const log = []
    for (const off of [70, 56, 42, 28, 14]) {
      log.push(...buildPair({ startDate: isoMinusDays(monday, off) }))
    }
    renderCard({ log })
    const chips = document.querySelectorAll('[data-occurrence-chip]')
    expect(chips.length).toBe(4)
  })

  it('renders a red flag dot when an occurrence is flagged no-recovery', () => {
    const monday = mondayOf(TODAY)
    const log = [
      ...buildPair({ startDate: isoMinusDays(monday, 14), followingTss: 200 }),
    ]
    renderCard({ log })
    const chips = document.querySelectorAll('[data-occurrence-chip]')
    expect(chips.length).toBe(1)
    expect(chips[0].getAttribute('data-occurrence-flagged')).toBe('1')
    const dot = chips[0].querySelector('[data-occurrence-flag-dot]')
    expect(dot).not.toBeNull()
  })

  it('omits the flag dot when an occurrence is clean', () => {
    const monday = mondayOf(TODAY)
    const log = buildPair({ startDate: isoMinusDays(monday, 14), followingTss: 0 })
    renderCard({ log })
    const chip = document.querySelector('[data-occurrence-chip]')
    expect(chip).not.toBeNull()
    expect(chip.getAttribute('data-occurrence-flagged')).toBe('0')
    expect(chip.querySelector('[data-occurrence-flag-dot]')).toBeNull()
  })

  it('formats the chip date as a "May 12-13" range when the pair stays in one month', () => {
    const start = '2026-05-12' // Tue
    const log = [
      { date: start, duration_min: 120, sport: 'run' },
      { date: '2026-05-13', duration_min: 100, sport: 'bike' },
    ]
    renderCard({ log })
    const chip = document.querySelector('[data-occurrence-chip]')
    expect(chip).not.toBeNull()
    expect(chip.textContent).toMatch(/May 12-13/)
    expect(chip.textContent).toMatch(/120\+100m/)
    expect(chip.textContent).toMatch(/run\+bike/)
  })

  it('does not render the chip list when there are no occurrences', () => {
    renderCard({ log: [] })
    expect(document.querySelector('[data-occurrence-chips]')).toBeNull()
  })
})
