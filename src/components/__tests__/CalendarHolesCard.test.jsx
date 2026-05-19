// @vitest-environment jsdom
// ─── CalendarHolesCard.test.jsx — Dashboard card surface tests ─────────────
//
// Covers: CLEAN / OCCASIONAL_HOLES / FRAGMENTED band rendering, EN+TR locale,
// citation footer, accessibility, holes chip rendering, data-attribute anchors.
//
// We freeze the system clock so the card's internal `new Date()` matches the
// synthesised "days ago" dates used in fixtures.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import CalendarHolesCard from '../dashboard/CalendarHolesCard.jsx'

const TODAY = '2026-05-19'

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function activeLog(days = 90) {
  const out = []
  for (let i = 0; i < days; i++) {
    out.push({ date: addDaysStr(TODAY, -i), duration_min: 30, tss: 40 })
  }
  return out
}

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <CalendarHolesCard log={log} />
    </LangCtx.Provider>
  )
}

describe('CalendarHolesCard — CLEAN state', () => {
  it('renders the CLEAN band on a fully active 90-day log', () => {
    renderCard(activeLog())
    const card = document.querySelector('[data-card="calendar-holes"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-calendar-holes-band')).toBe('CLEAN')
    expect(card.textContent).toMatch(/CLEAN/)
    expect(card.textContent).toMatch(/CALENDAR HOLES/i)
    expect(card.textContent).toMatch(/Calendar is clean/i)
  })

  it('reports 100% active days when there are no holes', () => {
    renderCard(activeLog())
    const card = document.querySelector('[data-card="calendar-holes"]')
    expect(card.getAttribute('data-calendar-holes-active-pct')).toBe('100')
    expect(card.getAttribute('data-calendar-holes-total')).toBe('0')
    expect(card.textContent).toMatch(/100%/)
  })

  it('does NOT render any hole chips when holes.length=0', () => {
    renderCard(activeLog())
    expect(document.querySelector('[data-hole-chip]')).toBeNull()
  })
})

describe('CalendarHolesCard — OCCASIONAL_HOLES band', () => {
  it('renders OCCASIONAL_HOLES when there is one 6-day hole', () => {
    const log = activeLog().filter(e => {
      for (let i = 10; i <= 15; i++) {
        if (e.date === addDaysStr(TODAY, -i)) return false
      }
      return true
    })
    renderCard(log)
    const card = document.querySelector('[data-card="calendar-holes"]')
    expect(card.getAttribute('data-calendar-holes-band')).toBe('OCCASIONAL_HOLES')
    expect(card.textContent).toMatch(/OCCASIONAL HOLES/)
    expect(card.textContent).toMatch(/Some gaps/i)
  })

  it('renders up to 3 most-recent hole chips with TSS arrows', () => {
    const log = activeLog().filter(e => {
      const drops = [10, 11, 12, 30, 31, 32]
        .map(n => addDaysStr(TODAY, -n))
      return !drops.includes(e.date)
    })
    renderCard(log)
    const chips = document.querySelectorAll('[data-hole-chip]')
    expect(chips.length).toBe(2)
    // Most-recent hole (end=-10) appears first because of .reverse() in render.
    expect(chips[0].getAttribute('data-hole-end')).toBe(addDaysStr(TODAY, -10))
    expect(chips[1].getAttribute('data-hole-end')).toBe(addDaysStr(TODAY, -30))
  })
})

describe('CalendarHolesCard — FRAGMENTED band', () => {
  it('renders FRAGMENTED with ≥4 holes', () => {
    const log = activeLog().filter(e => {
      const drops = [5, 6, 7, 20, 21, 22, 40, 41, 42, 60, 61, 62]
        .map(n => addDaysStr(TODAY, -n))
      return !drops.includes(e.date)
    })
    renderCard(log)
    const card = document.querySelector('[data-card="calendar-holes"]')
    expect(card.getAttribute('data-calendar-holes-band')).toBe('FRAGMENTED')
    expect(card.textContent).toMatch(/FRAGMENTED/)
    expect(card.textContent).toMatch(/fragmented|injury setup/i)
  })

  it('caps the recent-holes chip list at 3', () => {
    const log = activeLog().filter(e => {
      const drops = [5, 6, 7, 20, 21, 22, 40, 41, 42, 60, 61, 62]
        .map(n => addDaysStr(TODAY, -n))
      return !drops.includes(e.date)
    })
    renderCard(log)
    const chips = document.querySelectorAll('[data-hole-chip]')
    expect(chips.length).toBeLessThanOrEqual(3)
    expect(chips.length).toBe(3)
  })
})

describe('CalendarHolesCard — accessibility + citation', () => {
  it('exposes role=region with the English aria-label', () => {
    renderCard(activeLog())
    const region = screen.getByRole('region', { name: /Calendar Holes/i })
    expect(region).toBeInTheDocument()
  })

  it('renders the citation footer', () => {
    renderCard(activeLog())
    const card = document.querySelector('[data-card="calendar-holes"]')
    expect(card.textContent).toMatch(/Foster 2017/)
    expect(card.textContent).toMatch(/Soligard 2016/)
  })

  it('renders an SVG strip labelled for screen readers', () => {
    renderCard(activeLog())
    const strip = document.querySelector('[data-calendar-holes-strip]')
    expect(strip).not.toBeNull()
    expect(strip.getAttribute('aria-label')).toMatch(/90-day activity strip/i)
  })
})

describe('CalendarHolesCard — Turkish locale', () => {
  it('renders Turkish heading + band label', () => {
    renderCard(activeLog(), 'tr')
    const card = document.querySelector('[data-card="calendar-holes"]')
    expect(card.textContent).toMatch(/TAKVİM BOŞLUKLARI/)
    expect(card.textContent).toMatch(/TEMİZ/)
    expect(card.textContent).toMatch(/Takvim temiz/)
  })

  it('uses Turkish aria-label when lang=tr', () => {
    renderCard(activeLog(), 'tr')
    const region = screen.getByRole('region', { name: /Takvim Boşlukları/i })
    expect(region).toBeInTheDocument()
  })

  it('renders the FRAGMENTED Turkish label + interpretation', () => {
    const log = activeLog().filter(e => {
      const drops = [5, 6, 7, 20, 21, 22, 40, 41, 42, 60, 61, 62]
        .map(n => addDaysStr(TODAY, -n))
      return !drops.includes(e.date)
    })
    renderCard(log, 'tr')
    const card = document.querySelector('[data-card="calendar-holes"]')
    expect(card.getAttribute('data-calendar-holes-band')).toBe('FRAGMENTED')
    expect(card.textContent).toMatch(/PARÇALI/)
    expect(card.textContent).toMatch(/sakatlık riski/i)
  })
})

describe('CalendarHolesCard — strip rendering', () => {
  it('renders 90 cells in the activity strip', () => {
    renderCard(activeLog())
    const cells = document.querySelectorAll('[data-strip-kind]')
    expect(cells.length).toBe(90)
  })

  it('marks in-hole days with data-strip-kind="hole"', () => {
    const log = activeLog().filter(e =>
      e.date !== addDaysStr(TODAY, -10) &&
      e.date !== addDaysStr(TODAY, -11) &&
      e.date !== addDaysStr(TODAY, -12)
    )
    renderCard(log)
    const holeCells = document.querySelectorAll('[data-strip-kind="hole"]')
    expect(holeCells.length).toBe(3)
    const activeCells = document.querySelectorAll('[data-strip-kind="active"]')
    expect(activeCells.length).toBe(87)
  })
})
