// @vitest-environment jsdom
// ─── MidweekHardDayFrequencyCard.test.jsx — render tests for the day-of-week
// hard-session distribution card. Covers the null gate, every band, EN+TR
// locales, accessibility, dominantDay label rendering, and citation.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import MidweekHardDayFrequencyCard from '../dashboard/MidweekHardDayFrequencyCard.jsx'

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
// Mon=0..Sun=6 → date string for that ISO weekday in week `weeksBack` back.
function dateForDow(dowIndex, weeksBack = 0) {
  const mon = mondayOf(TODAY_ISO)
  return isoAddDays(mon, dowIndex - weeksBack * 7)
}
function hardEntry(date, tss = 80) {
  return { date, tss }
}

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <MidweekHardDayFrequencyCard log={log} />
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

describe('MidweekHardDayFrequencyCard — null gate', () => {
  it('renders something (not null) for an empty log — empty band is INSUFFICIENT_HARD', () => {
    // The card renders for all four bands. Empty log → INSUFFICIENT_HARD.
    const { container } = renderCard([])
    expect(container.firstChild).not.toBeNull()
    const card = document.querySelector('[data-card="midweek-hard-day-frequency"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_HARD')
  })

  it('renders the card for a missing log prop (defaults to [])', () => {
    const value = { t: k => k, lang: 'en', setLang: () => {} }
    const { container } = render(
      <LangCtx.Provider value={value}>
        <MidweekHardDayFrequencyCard />
      </LangCtx.Provider>
    )
    expect(container.firstChild).not.toBeNull()
  })
})

// ─── Band rendering ─────────────────────────────────────────────────────────

describe('MidweekHardDayFrequencyCard — band rendering', () => {
  it('renders INSUFFICIENT_HARD band for an empty log', () => {
    renderCard([])
    const card = document.querySelector('[data-card="midweek-hard-day-frequency"]')
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_HARD')
    expect(card.textContent).toMatch(/INSUFFICIENT HARD/)
    expect(card.textContent).toMatch(/Fewer than 6 hard days/)
  })

  it('renders MIDWEEK_FOCUSED band for pure Tue/Wed/Thu pattern', () => {
    const log = []
    for (let w = 0; w < 8; w++) {
      log.push(hardEntry(dateForDow(1, w))) // Tue
      log.push(hardEntry(dateForDow(2, w))) // Wed
      log.push(hardEntry(dateForDow(3, w))) // Thu
    }
    renderCard(log)
    const card = document.querySelector('[data-card="midweek-hard-day-frequency"]')
    expect(card.getAttribute('data-band')).toBe('MIDWEEK_FOCUSED')
    expect(card.textContent).toMatch(/MIDWEEK FOCUSED/)
    // 100% midweek share rendered
    expect(card.textContent).toMatch(/100/)
    expect(card.textContent).toMatch(/Most hard sessions land mid-week/)
  })

  it('renders WEEKEND_WARRIOR band for pure Sat/Sun pattern', () => {
    const log = []
    for (let w = 0; w < 4; w++) {
      log.push(hardEntry(dateForDow(5, w))) // Sat
      log.push(hardEntry(dateForDow(6, w))) // Sun
    }
    renderCard(log)
    const card = document.querySelector('[data-card="midweek-hard-day-frequency"]')
    expect(card.getAttribute('data-band')).toBe('WEEKEND_WARRIOR')
    expect(card.textContent).toMatch(/WEEKEND WARRIOR/)
    expect(card.textContent).toMatch(/Hard sessions cluster on Sat\/Sun/)
  })

  it('renders BALANCED band for a mixed pattern', () => {
    const log = []
    for (let w = 0; w < 2; w++) {
      log.push(hardEntry(dateForDow(0, w))) // Mon
      log.push(hardEntry(dateForDow(2, w))) // Wed
      log.push(hardEntry(dateForDow(4, w))) // Fri
      log.push(hardEntry(dateForDow(5, w))) // Sat
    }
    renderCard(log)
    const card = document.querySelector('[data-card="midweek-hard-day-frequency"]')
    expect(card.getAttribute('data-band')).toBe('BALANCED')
    expect(card.textContent).toMatch(/BALANCED/)
  })
})

// ─── EN + TR locale ─────────────────────────────────────────────────────────

describe('MidweekHardDayFrequencyCard — bilingual', () => {
  it('renders the English heading by default', () => {
    renderCard([])
    const card = document.querySelector('[data-card="midweek-hard-day-frequency"]')
    expect(card.textContent).toMatch(/MIDWEEK HARD DAYS · 8W/)
  })

  it('renders the Turkish heading when lang="tr"', () => {
    renderCard([], 'tr')
    const card = document.querySelector('[data-card="midweek-hard-day-frequency"]')
    expect(card.textContent).toMatch(/HAFTA İÇİ SERT GÜNLER · 8H/)
  })

  it('renders Turkish band label and hint when lang="tr"', () => {
    const log = []
    for (let w = 0; w < 8; w++) {
      log.push(hardEntry(dateForDow(2, w)))
    }
    renderCard(log, 'tr')
    const card = document.querySelector('[data-card="midweek-hard-day-frequency"]')
    expect(card.getAttribute('data-band')).toBe('MIDWEEK_FOCUSED')
    expect(card.textContent).toMatch(/HAFTA İÇİ ODAKLI/)
    expect(card.textContent).toMatch(/Sert seansların çoğu hafta içine düşüyor/)
  })

  it('renders Turkish day labels in the histogram (Pzt..Paz)', () => {
    renderCard([], 'tr')
    const card = document.querySelector('[data-card="midweek-hard-day-frequency"]')
    expect(card.textContent).toMatch(/Pzt/)
    expect(card.textContent).toMatch(/Paz/)
    expect(card.textContent).toMatch(/Çar/)
  })

  it('renders English day labels in the histogram (Mon..Sun)', () => {
    renderCard([])
    const card = document.querySelector('[data-card="midweek-hard-day-frequency"]')
    expect(card.textContent).toMatch(/Mon/)
    expect(card.textContent).toMatch(/Sun/)
    expect(card.textContent).toMatch(/Wed/)
  })
})

// ─── Citation ───────────────────────────────────────────────────────────────

describe('MidweekHardDayFrequencyCard — citation', () => {
  it('renders the citation string (Foster 2017; Bompa 2018)', () => {
    renderCard([])
    const card = document.querySelector('[data-card="midweek-hard-day-frequency"]')
    expect(card.textContent).toMatch(/Foster 2017/)
    expect(card.textContent).toMatch(/Bompa 2018/)
  })
})

// ─── Accessibility ──────────────────────────────────────────────────────────

describe('MidweekHardDayFrequencyCard — accessibility', () => {
  it('exposes role=region with English aria-label', () => {
    renderCard([])
    const region = screen.getByRole('region', { name: /Midweek hard day frequency card/i })
    expect(region).toBeInTheDocument()
  })

  it('exposes role=region with Turkish aria-label', () => {
    renderCard([], 'tr')
    const region = screen.getByRole('region', { name: /Hafta içi sert gün sıklığı kartı/i })
    expect(region).toBeInTheDocument()
  })

  it('exposes the histogram group with an aria-label', () => {
    renderCard([])
    const group = screen.getByRole('group', { name: /Hard-day counts Monday through Sunday/i })
    expect(group).toBeInTheDocument()
  })

  it('histogram group has Turkish aria-label when lang="tr"', () => {
    renderCard([], 'tr')
    const group = screen.getByRole('group', { name: /sert gün sayıları/i })
    expect(group).toBeInTheDocument()
  })
})

// ─── dominantDay label rendering ────────────────────────────────────────────

describe('MidweekHardDayFrequencyCard — dominantDay label', () => {
  it('renders the dominant-day long name (Wednesday) when Wed has most hard sessions', () => {
    const log = []
    for (let w = 0; w < 8; w++) {
      log.push(hardEntry(dateForDow(2, w))) // 8 Wed
    }
    log.push(hardEntry(dateForDow(0, 0))) // 1 Mon
    renderCard(log)
    const card = document.querySelector('[data-card="midweek-hard-day-frequency"]')
    expect(card.textContent).toMatch(/Most-hard day: Wednesday/)
    expect(card.getAttribute('data-band')).toBe('MIDWEEK_FOCUSED')
    const elem = card.querySelector('[data-midweek-dominant-day]')
    expect(elem.getAttribute('data-midweek-dominant-day')).toBe('wed')
  })

  it('renders Turkish dominant-day long name (Çarşamba) when Wed dominates', () => {
    const log = []
    for (let w = 0; w < 8; w++) {
      log.push(hardEntry(dateForDow(2, w))) // 8 Wed
    }
    renderCard(log, 'tr')
    const card = document.querySelector('[data-card="midweek-hard-day-frequency"]')
    expect(card.textContent).toMatch(/En sert gün: Çarşamba/)
  })

  it('renders an em-dash when no hard sessions exist (dominantDay null)', () => {
    renderCard([])
    const card = document.querySelector('[data-card="midweek-hard-day-frequency"]')
    expect(card.textContent).toMatch(/Most-hard day: —/)
    const elem = card.querySelector('[data-midweek-dominant-day]')
    expect(elem.getAttribute('data-midweek-dominant-day')).toBe('')
  })

  it('Turkish em-dash rendering when no hard sessions', () => {
    renderCard([], 'tr')
    const card = document.querySelector('[data-card="midweek-hard-day-frequency"]')
    expect(card.textContent).toMatch(/En sert gün: —/)
  })
})

// ─── histogram data-attrs reflect the dayCounts ─────────────────────────────

describe('MidweekHardDayFrequencyCard — histogram data attributes', () => {
  it('attaches the correct dow-count attribute on each bar', () => {
    const log = []
    for (let w = 0; w < 3; w++) log.push(hardEntry(dateForDow(2, w))) // 3 Wed
    log.push(hardEntry(dateForDow(5, 0))) // 1 Sat
    renderCard(log)
    const wedBar = document.querySelector('[data-dow-key="wed"]')
    const satBar = document.querySelector('[data-dow-key="sat"]')
    const monBar = document.querySelector('[data-dow-key="mon"]')
    expect(wedBar.getAttribute('data-dow-count')).toBe('3')
    expect(satBar.getAttribute('data-dow-count')).toBe('1')
    expect(monBar.getAttribute('data-dow-count')).toBe('0')
  })

  it('exposes the headline midweek-share-pct data attr', () => {
    const log = []
    for (let w = 0; w < 8; w++) log.push(hardEntry(dateForDow(2, w))) // 100% midweek
    renderCard(log)
    const elem = document.querySelector('[data-midweek-share-pct]')
    expect(elem.getAttribute('data-midweek-share-pct')).toBe('100')
  })
})
