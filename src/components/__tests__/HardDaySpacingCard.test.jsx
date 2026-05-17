// @vitest-environment jsdom
// ─── HardDaySpacingCard.test.jsx — render tests for the spacing card ────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import HardDaySpacingCard from '../dashboard/HardDaySpacingCard.jsx'

// ─── Date helpers anchored to a fixed "today" ────────────────────────────────
const TODAY = '2026-04-30'

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function entry(daysAgo, overrides = {}) {
  return {
    date: addDaysStr(TODAY, -daysAgo),
    type: 'intervals',
    duration: 45,
    rpe: 8,
    ...overrides,
  }
}

function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <HardDaySpacingCard {...props} />
    </LangCtx.Provider>
  )
}

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})

afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

// ─── Empty / no-violation states should render NOTHING ──────────────────────
describe('HardDaySpacingCard — no findings → renders null', () => {
  it('renders nothing for an empty log', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-hard-day-spacing-card]')).toBeNull()
  })

  it('renders nothing for a null log', () => {
    const { container } = renderCard({ log: null })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for a log with no hard sessions', () => {
    const log = [
      entry(2, { type: 'recovery', rpe: 3 }),
      entry(4, { type: 'easy', rpe: 4 }),
      entry(6, { type: 'endurance', rpe: 4 }),
    ]
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when hard sessions are spaced 2+ days apart (clean week)', () => {
    const log = [
      entry(7, { type: 'intervals', rpe: 8 }),
      entry(4, { type: 'threshold', rpe: 8 }),
      entry(1, { type: 'vo2', rpe: 9 }),
    ]
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })
})

// ─── Violation → renders the card ───────────────────────────────────────────
describe('HardDaySpacingCard — violation surfaced', () => {
  it('renders the card when the detector reports a back-to-back hard pair', () => {
    const log = [
      entry(5, { type: 'intervals', rpe: 8 }),
      entry(4, { type: 'threshold', rpe: 8 }),
    ]
    renderCard({ log })
    const region = screen.getByRole('region', { name: /Hard-day spacing/i })
    expect(region).toBeInTheDocument()
  })

  it('exposes the data-hard-day-spacing-card attribute set to the band', () => {
    // 2 hard sessions, 1 violation → 50% → poor band
    const log = [
      entry(5, { type: 'intervals', rpe: 8 }),
      entry(4, { type: 'threshold', rpe: 8 }),
    ]
    renderCard({ log })
    const node = document.querySelector('[data-hard-day-spacing-card]')
    expect(node).not.toBeNull()
    expect(node.getAttribute('data-hard-day-spacing-card')).toBe('poor')
  })

  it('shows violation count + compliance percentage + POOR band badge', () => {
    const log = [
      entry(5, { type: 'intervals', rpe: 8 }),
      entry(4, { type: 'threshold', rpe: 8 }),
    ]
    renderCard({ log })
    // POOR band badge present
    expect(screen.getByText('POOR')).toBeInTheDocument()
    // Compliance % rendered via the aria-labelled node
    expect(screen.getByLabelText(/POOR 50% hard-day spacing/i)).toBeInTheDocument()
    // Stats row reflects the count
    expect(screen.getByText(/1 back-to-back hard pair \/ 2 hard days/i))
      .toBeInTheDocument()
  })

  it('lists the most recent violation dates with relative labels', () => {
    const log = [
      entry(5, { type: 'intervals', rpe: 8 }),
      entry(4, { type: 'threshold', rpe: 8 }),
    ]
    renderCard({ log })
    const list = screen.getByRole('list', { name: /Back-to-back hard day dates/i })
    expect(list).toBeInTheDocument()
    const items = list.querySelectorAll('[role="listitem"]')
    expect(items.length).toBe(1)
    // Violation date is the later of the pair = 4 days ago
    expect(items[0].textContent).toMatch(/4 days ago/i)
    expect(items[0].getAttribute('data-violation-date'))
      .toBe(addDaysStr(TODAY, -4))
  })

  it('renders the recommendation copy for the poor band', () => {
    const log = [
      entry(5, { type: 'intervals', rpe: 8 }),
      entry(4, { type: 'threshold', rpe: 8 }),
      entry(3, { type: 'vo2', rpe: 9 }),
    ]
    renderCard({ log })
    // Poor band recommendation mentions restructuring or 48h recovery
    expect(screen.getByText(/restructure week|48h aerobic recovery/i))
      .toBeInTheDocument()
  })

  it('renders the citation footer (Lambert; Foster; Seiler)', () => {
    const log = [
      entry(5, { type: 'intervals', rpe: 8 }),
      entry(4, { type: 'threshold', rpe: 8 }),
    ]
    renderCard({ log })
    expect(screen.getByText(/Lambert 1997; Foster 1998; Seiler 2010/))
      .toBeInTheDocument()
  })

  it('shows the low-sample reliability note when fewer than 4 hard sessions', () => {
    const log = [
      entry(5, { type: 'intervals', rpe: 8 }),
      entry(4, { type: 'threshold', rpe: 8 }),
    ]
    renderCard({ log })
    expect(screen.getByText(/Low sample — more reliable with 4\+ hard sessions/i))
      .toBeInTheDocument()
  })
})

// ─── Bilingual ──────────────────────────────────────────────────────────────
describe('HardDaySpacingCard — Turkish copy', () => {
  it('renders Turkish title + band + stats row when lang=tr', () => {
    const log = [
      entry(5, { type: 'intervals', rpe: 8 }),
      entry(4, { type: 'threshold', rpe: 8 }),
    ]
    renderCard({ log }, 'tr')
    // TR region aria-label
    const region = screen.getByRole('region', { name: /Sert-gün aralığı/i })
    expect(region).toBeInTheDocument()
    // TR title
    expect(screen.getByText(/SERT-GÜN ARALIĞI — 28G/i)).toBeInTheDocument()
    // TR band label
    expect(screen.getByText('ZAYIF')).toBeInTheDocument()
    // TR stats row
    expect(screen.getByText(/1 ardışık sert çift \/ 2 sert gün/i))
      .toBeInTheDocument()
    // TR violation-list aria-label
    expect(screen.getByRole('list', { name: /Ardışık sert gün tarihleri/i }))
      .toBeInTheDocument()
  })

  it('renders Turkish relative date label "dün" / "X gün önce"', () => {
    const log = [
      entry(5, { type: 'intervals', rpe: 8 }),
      entry(4, { type: 'threshold', rpe: 8 }),
    ]
    renderCard({ log }, 'tr')
    const list = screen.getByRole('list', { name: /Ardışık sert gün tarihleri/i })
    expect(list.textContent).toMatch(/4 gün önce/i)
  })
})
