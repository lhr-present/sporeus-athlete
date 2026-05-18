// @vitest-environment jsdom
// ─── PerseveranceCard.test.jsx — dashboard surface tests ────────────────────
//
// Covers: render-null guards, the three bands (CONSISTENT / VARIABLE /
// SPORADIC), Turkish heading & band labels, per-week data anchors.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import PerseveranceCard from '../dashboard/PerseveranceCard.jsx'

// 2026-05-18 is a Monday — keeps ISO-week anchoring deterministic.
const TODAY = '2026-05-18'

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function makeWeeklyLog(weekCounts, today = TODAY) {
  const t = new Date(today + 'T12:00:00Z')
  const dow = t.getUTCDay()
  const offset = dow === 0 ? 6 : dow - 1
  const currentMonday = new Date(Date.UTC(
    t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - offset, 12, 0, 0, 0
  ))
  const log = []
  const W = weekCounts.length
  for (let i = 0; i < W; i++) {
    const offsetWeeks = (W - 1) - i
    const monday = new Date(currentMonday)
    monday.setUTCDate(monday.getUTCDate() - offsetWeeks * 7)
    const date = monday.toISOString().slice(0, 10)
    for (let s = 0; s < weekCounts[i]; s++) {
      log.push({ date, type: 'run', tss: 50 })
    }
  }
  return log
}

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <PerseveranceCard log={log} />
    </LangCtx.Provider>
  )
}

// ─── Guards ──────────────────────────────────────────────────────────────────
describe('PerseveranceCard — guards', () => {
  it('renders nothing for an empty log', () => {
    const { container } = renderCard([])
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-perseverance-card]')).toBeNull()
  })

  it('renders nothing when log is null', () => {
    const { container } = renderCard(null)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when fewer than 6 of 12 weeks are active', () => {
    // 5 active weeks
    const counts = [3, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0, 0]
    const { container } = renderCard(makeWeeklyLog(counts))
    expect(container.firstChild).toBeNull()
  })
})

// ─── CONSISTENT band ─────────────────────────────────────────────────────────
describe('PerseveranceCard — CONSISTENT band', () => {
  it('renders with CONSISTENT band and gritScore 100 for flat 3/wk', () => {
    const log = makeWeeklyLog(Array(12).fill(3))
    renderCard(log)
    const card = document.querySelector('[data-perseverance-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-grit-band')).toBe('CONSISTENT')
    expect(card.getAttribute('data-grit-score')).toBe('100')
    expect(card.getAttribute('data-active-weeks')).toBe('12')
    expect(card.getAttribute('data-mean-sessions-per-week')).toBe('3')

    const region = screen.getByRole('region', { name: /Perseverance/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/PERSEVERANCE · 12W/)
    expect(region.textContent).toMatch(/CONSISTENT/)
    expect(region.textContent).toMatch(/long-term consistency compounds/i)
    expect(region.textContent).toMatch(/Duckworth 2007; Duckworth 2016/)
  })

  it('renders exactly 12 weekly bars with data-week-start + data-week-sessions', () => {
    const counts = [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 2, 3]
    const log = makeWeeklyLog(counts)
    renderCard(log)
    const bars = document.querySelectorAll('[data-week-bar]')
    expect(bars.length).toBe(12)
    const sessionsAttrs = Array.from(bars).map(b => Number(b.getAttribute('data-week-sessions')))
    expect(sessionsAttrs).toEqual(counts)
    for (const b of bars) {
      expect(b.getAttribute('data-week-start')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })
})

// ─── VARIABLE band ───────────────────────────────────────────────────────────
describe('PerseveranceCard — VARIABLE band', () => {
  it('renders with VARIABLE band for 8 active weeks of 1 + 4 inactive', () => {
    const counts = [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0]
    const log = makeWeeklyLog(counts)
    renderCard(log)
    const card = document.querySelector('[data-perseverance-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-grit-band')).toBe('VARIABLE')
    expect(card.textContent).toMatch(/VARIABLE/)
    expect(card.textContent).toMatch(/Smooth the highs and lows/i)
  })
})

// ─── SPORADIC band ───────────────────────────────────────────────────────────
describe('PerseveranceCard — SPORADIC band', () => {
  it('renders with SPORADIC band for 6 active + 6 inactive weeks', () => {
    const counts = [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0]
    const log = makeWeeklyLog(counts)
    renderCard(log)
    const card = document.querySelector('[data-perseverance-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-grit-band')).toBe('SPORADIC')
    expect(card.textContent).toMatch(/SPORADIC/)
    expect(card.textContent).toMatch(/anchor 3-4 sessions per week/i)
  })
})

// ─── Turkish ─────────────────────────────────────────────────────────────────
describe('PerseveranceCard — bilingual', () => {
  it('renders the Turkish heading and band label when lang=tr (CONSISTENT)', () => {
    const log = makeWeeklyLog(Array(12).fill(3))
    renderCard(log, 'tr')
    const region = screen.getByRole('region', { name: /Azim/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/AZİM · 12H/)
    expect(region.textContent).toMatch(/TUTARLI/)
    expect(region.textContent).toMatch(/Güçlü haftalık ritim/)
  })

  it('renders Turkish hint for VARIABLE band', () => {
    const log = makeWeeklyLog([1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0])
    renderCard(log, 'tr')
    const card = document.querySelector('[data-perseverance-card]')
    expect(card.getAttribute('data-grit-band')).toBe('VARIABLE')
    expect(card.textContent).toMatch(/DEĞİŞKEN/)
    expect(card.textContent).toMatch(/iniş çıkışları yumuşat/)
  })

  it('renders Turkish hint for SPORADIC band', () => {
    const log = makeWeeklyLog([1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0])
    renderCard(log, 'tr')
    const card = document.querySelector('[data-perseverance-card]')
    expect(card.getAttribute('data-grit-band')).toBe('SPORADIC')
    expect(card.textContent).toMatch(/DÜZENSİZ/)
    expect(card.textContent).toMatch(/haftada 3-4 seansı sabitle/)
  })
})
