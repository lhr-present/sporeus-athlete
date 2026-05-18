// @vitest-environment jsdom
// ─── LongSessionShareCard.test.jsx — render tests for the long-session UI ───
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import LongSessionShareCard from '../dashboard/LongSessionShareCard.jsx'

// 2026-05-17 is a Sunday. 4-week window = Mon 2026-04-20 → Sun 2026-05-17.
const TODAY_ISO = '2026-05-17'
const WEEKS = ['2026-04-20', '2026-04-27', '2026-05-04', '2026-05-11']

function entry(weekIdx, dayOffset, durationMin) {
  const base = new Date(WEEKS[weekIdx] + 'T00:00:00Z')
  base.setUTCDate(base.getUTCDate() + dayOffset)
  const date = base.toISOString().slice(0, 10)
  return { date, duration: durationMin, type: 'run' }
}

// Build a 4-week log where every week totals `weeklyTotal` min and the
// longest session is exactly `longestMin`. Filler is split across enough
// days that every filler day < longestMin.
function buildLog({ longestMin, weeklyTotal }) {
  const log = []
  const filler = weeklyTotal - longestMin
  const minDays = Math.max(3, Math.ceil(filler / Math.max(1, longestMin - 1)))
  const per = filler / minDays
  const fillerDays = [0, 1, 2, 3, 4, 5].slice(0, minDays)
  for (let w = 0; w < 4; w++) {
    for (const dow of fillerDays) log.push(entry(w, dow, per))
    log.push(entry(w, 6, longestMin))
  }
  return log
}

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <LongSessionShareCard log={log} />
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

describe('LongSessionShareCard — null render cases', () => {
  it('(a) renders nothing for empty log', () => {
    const { container } = renderCard([])
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-long-session-share-card]')).toBeNull()
  })

  it('(b) renders nothing for TARGET band (30% share)', () => {
    // longest=90, total=300 → 30% → TARGET → card returns null
    const log = buildLog({ longestMin: 90, weeklyTotal: 300 })
    const { container } = renderCard(log)
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-long-session-share-card]')).toBeNull()
  })
})

describe('LongSessionShareCard — TOO_SHORT pattern', () => {
  it('(c) renders TOO_SHORT warning with orange treatment', () => {
    // longest=45, total=300 → 15% → TOO_SHORT
    const log = buildLog({ longestMin: 45, weeklyTotal: 300 })
    renderCard(log)
    const card = document.querySelector('[data-long-session-share-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-share-band')).toBe('TOO_SHORT')
    // The big share number renders (15%).
    expect(card.textContent).toMatch(/15/)
    // English band label.
    expect(card.textContent).toMatch(/TOO SHORT/)
    // English recommendation text.
    expect(card.textContent).toMatch(/Build a real long session each week/i)
    // Citation.
    expect(card.textContent).toMatch(/Daniels 2014/)
    // Orange (#ff6600 → rgb(255, 102, 0)). JSDOM normalizes hex → rgb()
    // so we assert on the rgb form in the inline style.
    const style = card.getAttribute('style') || ''
    expect(style).toMatch(/rgb\(255,\s*102,\s*0\)/)
    // English heading.
    expect(card.textContent).toMatch(/LONG SESSION SHARE · 4W/)
    // Renders one chip per week (4 weeks).
    expect(document.querySelectorAll('[data-week-chip]').length).toBe(4)
    // Exposes role=region.
    expect(screen.getByRole('region', { name: /Long session share card/i })).toBeInTheDocument()
  })
})

describe('LongSessionShareCard — ISOLATED pattern', () => {
  it('(d) renders ISOLATED warning with red treatment', () => {
    // longest=180, total=300 → 60% → ISOLATED
    const log = buildLog({ longestMin: 180, weeklyTotal: 300 })
    renderCard(log)
    const card = document.querySelector('[data-long-session-share-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-share-band')).toBe('ISOLATED')
    expect(card.textContent).toMatch(/60/)
    expect(card.textContent).toMatch(/ISOLATED/)
    expect(card.textContent).toMatch(/high injury risk/i)
    // Red (#e03030 → rgb(224, 48, 48)) — JSDOM normalizes to rgb().
    const style = card.getAttribute('style') || ''
    expect(style).toMatch(/rgb\(224,\s*48,\s*48\)/)
  })
})

describe('LongSessionShareCard — Turkish locale', () => {
  it('(e) renders Turkish heading "UZUN ANTR. PAYI · 4H" when lang=tr', () => {
    // ISOLATED so the card actually renders
    const log = buildLog({ longestMin: 180, weeklyTotal: 300 })
    renderCard(log, 'tr')
    const card = document.querySelector('[data-long-session-share-card]')
    expect(card).not.toBeNull()
    expect(card.textContent).toMatch(/UZUN ANTR\. PAYI · 4H/)
    // Turkish band label for ISOLATED
    expect(card.textContent).toMatch(/İZOLE/)
    // Turkish recommendation snippet
    expect(card.textContent).toMatch(/Tek büyük antrenman/)
    // Turkish region label
    expect(screen.getByRole('region', { name: /Uzun antrenman payı kartı/i })).toBeInTheDocument()
  })
})
