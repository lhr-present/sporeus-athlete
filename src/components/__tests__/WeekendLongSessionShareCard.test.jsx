// @vitest-environment jsdom
// ─── WeekendLongSessionShareCard.test.jsx — render tests for the long-session
// weekday/weekend split card. Covers the null gate, every band, EN+TR
// locales, accessibility, citation, and 7-bar histogram data attributes.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import WeekendLongSessionShareCard from '../dashboard/WeekendLongSessionShareCard.jsx'

// 2026-05-17 is a Sunday → current ISO week 2026-05-11..2026-05-17.
const TODAY_ISO = '2026-05-17'

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}
function isoAddDays(iso, days) {
  return isoMinusDays(iso, -days)
}
function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}
function dateForDow(dowIndex, weeksBack = 0) {
  const mon = mondayOf(TODAY_ISO)
  return isoAddDays(mon, dowIndex - weeksBack * 7)
}
function longEntry(date, durationMin = 120) {
  return { date, durationMin }
}

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <WeekendLongSessionShareCard log={log} />
    </LangCtx.Provider>
  )
}

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY_ISO + 'T12:00:00Z'))
})

afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

// ─── Null gate ──────────────────────────────────────────────────────────────

describe('WeekendLongSessionShareCard — null gate', () => {
  it('renders the card for an empty log → INSUFFICIENT_LONG_SESSIONS', () => {
    const { container } = renderCard([])
    expect(container.firstChild).not.toBeNull()
    const card = document.querySelector('[data-card="weekend-long-session-share"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_LONG_SESSIONS')
  })

  it('renders the card for a missing log prop (defaults to [])', () => {
    const value = { t: k => k, lang: 'en', setLang: () => {} }
    const { container } = render(
      <LangCtx.Provider value={value}>
        <WeekendLongSessionShareCard />
      </LangCtx.Provider>
    )
    expect(container.firstChild).not.toBeNull()
  })
})

// ─── Band rendering ─────────────────────────────────────────────────────────

describe('WeekendLongSessionShareCard — band rendering', () => {
  it('renders INSUFFICIENT_LONG_SESSIONS band text for empty log', () => {
    renderCard([])
    const card = document.querySelector('[data-card="weekend-long-session-share"]')
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_LONG_SESSIONS')
    expect(card.textContent).toMatch(/INSUFFICIENT LONG/)
    expect(card.textContent).toMatch(/Fewer than 6 long sessions/)
  })

  it('renders WEEKDAY_DOMINANT band for pure mid-week long sessions', () => {
    const log = []
    for (let w = 0; w < 8; w++) log.push(longEntry(dateForDow(2, w))) // 8 Wed
    renderCard(log)
    const card = document.querySelector('[data-card="weekend-long-session-share"]')
    expect(card.getAttribute('data-band')).toBe('WEEKDAY_DOMINANT')
    expect(card.textContent).toMatch(/WEEKDAY DOMINANT/)
    expect(card.textContent).toMatch(/0/) // 0% weekend share
    expect(card.textContent).toMatch(/Long sessions skew to mid-week/)
  })

  it('renders WEEKEND_DOMINANT band for pure Sat/Sun long sessions', () => {
    const log = []
    for (let w = 0; w < 6; w++) {
      log.push(longEntry(dateForDow(5, w))) // Sat
      log.push(longEntry(dateForDow(6, w))) // Sun
    }
    renderCard(log)
    const card = document.querySelector('[data-card="weekend-long-session-share"]')
    expect(card.getAttribute('data-band')).toBe('WEEKEND_DOMINANT')
    expect(card.textContent).toMatch(/WEEKEND DOMINANT/)
    expect(card.textContent).toMatch(/Long sessions cluster on Sat\/Sun/)
  })

  it('renders MIXED band for an even split', () => {
    const log = []
    for (let w = 0; w < 5; w++) {
      log.push(longEntry(dateForDow(2, w))) // Wed
      log.push(longEntry(dateForDow(5, w))) // Sat
    }
    renderCard(log)
    const card = document.querySelector('[data-card="weekend-long-session-share"]')
    expect(card.getAttribute('data-band')).toBe('MIXED')
    expect(card.textContent).toMatch(/MIXED/)
    expect(card.textContent).toMatch(/Long sessions spread between weekdays and weekends/)
  })
})

// ─── EN + TR locale ─────────────────────────────────────────────────────────

describe('WeekendLongSessionShareCard — bilingual', () => {
  it('renders the English heading by default', () => {
    renderCard([])
    const card = document.querySelector('[data-card="weekend-long-session-share"]')
    expect(card.textContent).toMatch(/WEEKEND LONG SESSIONS · 12W/)
  })

  it('renders the Turkish heading when lang="tr"', () => {
    renderCard([], 'tr')
    const card = document.querySelector('[data-card="weekend-long-session-share"]')
    expect(card.textContent).toMatch(/HAFTASONU UZUN ANTRENMANLAR · 12H/)
  })

  it('renders Turkish band label + hint for WEEKEND_DOMINANT', () => {
    const log = []
    for (let w = 0; w < 6; w++) log.push(longEntry(dateForDow(5, w))) // 6 Sat
    renderCard(log, 'tr')
    const card = document.querySelector('[data-card="weekend-long-session-share"]')
    expect(card.getAttribute('data-band')).toBe('WEEKEND_DOMINANT')
    expect(card.textContent).toMatch(/HAFTASONU AĞIRLIKLI/)
    expect(card.textContent).toMatch(/klasik çalışan sporcu kalıbı/)
  })

  it('renders Turkish day labels in the histogram (Pzt..Paz)', () => {
    renderCard([], 'tr')
    const card = document.querySelector('[data-card="weekend-long-session-share"]')
    expect(card.textContent).toMatch(/Pzt/)
    expect(card.textContent).toMatch(/Paz/)
    expect(card.textContent).toMatch(/Cmt/)
  })

  it('renders English day labels in the histogram (Mon..Sun)', () => {
    renderCard([])
    const card = document.querySelector('[data-card="weekend-long-session-share"]')
    expect(card.textContent).toMatch(/Mon/)
    expect(card.textContent).toMatch(/Sat/)
    expect(card.textContent).toMatch(/Sun/)
  })
})

// ─── Citation ───────────────────────────────────────────────────────────────

describe('WeekendLongSessionShareCard — citation', () => {
  it('renders the citation string (Foster 2017; Bompa 2018)', () => {
    renderCard([])
    const card = document.querySelector('[data-card="weekend-long-session-share"]')
    expect(card.textContent).toMatch(/Foster 2017/)
    expect(card.textContent).toMatch(/Bompa 2018/)
  })
})

// ─── Accessibility ──────────────────────────────────────────────────────────

describe('WeekendLongSessionShareCard — accessibility', () => {
  it('exposes role=region with English aria-label', () => {
    renderCard([])
    const region = screen.getByRole('region', { name: /Weekend long session share card/i })
    expect(region).toBeInTheDocument()
  })

  it('exposes role=region with Turkish aria-label', () => {
    renderCard([], 'tr')
    const region = screen.getByRole('region', { name: /Hafta sonu uzun antrenman payı kartı/i })
    expect(region).toBeInTheDocument()
  })

  it('exposes the histogram group with an aria-label', () => {
    renderCard([])
    const group = screen.getByRole('group', { name: /Long-session counts Monday through Sunday/i })
    expect(group).toBeInTheDocument()
  })

  it('histogram group has Turkish aria-label when lang="tr"', () => {
    renderCard([], 'tr')
    const group = screen.getByRole('group', { name: /uzun seans sayıları/i })
    expect(group).toBeInTheDocument()
  })
})

// ─── histogram data-attrs reflect the dayCounts ─────────────────────────────

describe('WeekendLongSessionShareCard — histogram data attributes', () => {
  it('attaches the correct dow-count attribute on each bar', () => {
    const log = []
    for (let w = 0; w < 3; w++) log.push(longEntry(dateForDow(5, w))) // 3 Sat
    log.push(longEntry(dateForDow(2, 0))) // 1 Wed
    renderCard(log)
    const satBar = document.querySelector('[data-dow-key="sat"]')
    const wedBar = document.querySelector('[data-dow-key="wed"]')
    const monBar = document.querySelector('[data-dow-key="mon"]')
    expect(satBar.getAttribute('data-dow-count')).toBe('3')
    expect(wedBar.getAttribute('data-dow-count')).toBe('1')
    expect(monBar.getAttribute('data-dow-count')).toBe('0')
  })

  it('exposes the headline weekend-share-pct data attr', () => {
    const log = []
    for (let w = 0; w < 6; w++) log.push(longEntry(dateForDow(5, w))) // 100% weekend
    renderCard(log)
    const elem = document.querySelector('[data-weekend-long-share-pct]')
    expect(elem.getAttribute('data-weekend-long-share-pct')).toBe('100')
  })

  it('renders all 7 Mon-Sun bars regardless of data', () => {
    renderCard([])
    const bars = document.querySelectorAll('[data-dow-key]')
    expect(bars.length).toBe(7)
  })

  it('exposes the total long-sessions count data attr', () => {
    const log = []
    for (let w = 0; w < 7; w++) log.push(longEntry(dateForDow(5, w)))
    renderCard(log)
    const elem = document.querySelector('[data-weekend-long-total]')
    expect(elem.getAttribute('data-weekend-long-total')).toBe('7')
  })

  it('shows total/weekend/weekday counts in the summary line', () => {
    const log = []
    for (let w = 0; w < 4; w++) log.push(longEntry(dateForDow(5, w))) // Sat
    for (let w = 0; w < 4; w++) log.push(longEntry(dateForDow(2, w))) // Wed
    renderCard(log)
    const card = document.querySelector('[data-card="weekend-long-session-share"]')
    expect(card.textContent).toMatch(/8 long sessions/)
    expect(card.textContent).toMatch(/4 weekend/)
    expect(card.textContent).toMatch(/4 weekday/)
  })
})
