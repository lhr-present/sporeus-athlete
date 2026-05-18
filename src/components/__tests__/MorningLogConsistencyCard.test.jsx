// @vitest-environment jsdom
// ─── MorningLogConsistencyCard.test.jsx — habit-formation surface tests ───
//
// Covers: empty/null recovery, daysLogged===0 suppression, each band
// (HABITUATED / DEVELOPING / SPORADIC), 28-cell grid, streak chips,
// Turkish heading, and data anchors.
//
// We freeze the system clock so MorningLogConsistencyCard, which calls
// `analyzeMorningLogConsistency({ recovery })` without an explicit `today`,
// sees a deterministic "today" relative to the entries built by `daysAgo()`.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import MorningLogConsistencyCard from '../dashboard/MorningLogConsistencyCard.jsx'

const TODAY = '2026-05-18'

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function daysAgo(n) {
  const d = new Date(`${TODAY}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function consecutive(n, fields = { sleepHrs: 7.5 }) {
  const out = []
  for (let i = 0; i < n; i++) {
    out.push({ date: daysAgo(i), ...fields })
  }
  return out
}

function renderCard(recovery, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <MorningLogConsistencyCard recovery={recovery} />
    </LangCtx.Provider>
  )
}

describe('MorningLogConsistencyCard — guards', () => {
  it('renders nothing for an empty recovery array', () => {
    const { container } = renderCard([])
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-morning-log-consistency-card]')).toBeNull()
  })

  it('renders nothing for null recovery', () => {
    const { container } = renderCard(null)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for undefined recovery', () => {
    const { container } = renderCard(undefined)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when daysLogged === 0 (entries have no defined fields)', () => {
    const recovery = [
      { date: daysAgo(0) },
      { date: daysAgo(1), sleepHrs: null, hrv: undefined, restingHR: '' },
    ]
    const { container } = renderCard(recovery)
    expect(container.firstChild).toBeNull()
  })
})

describe('MorningLogConsistencyCard — HABITUATED band', () => {
  it('renders with HABITUATED band when 28/28 logged', () => {
    const recovery = consecutive(28)
    renderCard(recovery)
    const card = document.querySelector('[data-morning-log-consistency-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-consistency-band')).toBe('HABITUATED')
    expect(card.getAttribute('data-current-streak')).toBe('28')
    expect(card.getAttribute('data-longest-streak')).toBe('28')
    expect(card.getAttribute('data-completion-rate')).toBe('1.0000')

    const region = screen.getByRole('region', { name: /Morning log consistency/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/MORNING LOG · 28D/)
    expect(region.textContent).toMatch(/100%/)
    expect(region.textContent).toMatch(/HABITUATED/)
    expect(region.textContent).toMatch(/Strong morning routine/i)
    expect(region.textContent).toMatch(/Wood 2013/)
    expect(region.textContent).toMatch(/Lally 2010/)
  })

  it('renders 28 day-cells with correct data-day-logged flags', () => {
    const recovery = consecutive(28)
    renderCard(recovery)
    const cells = document.querySelectorAll('[data-day-cell]')
    expect(cells.length).toBe(28)
    Array.from(cells).forEach(c => {
      expect(c.getAttribute('data-day-logged')).toBe('true')
      expect(c.getAttribute('data-day-iso')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })
})

describe('MorningLogConsistencyCard — DEVELOPING band', () => {
  it('renders with DEVELOPING band at 18/28 (~64%)', () => {
    const recovery = consecutive(18)
    renderCard(recovery)
    const card = document.querySelector('[data-morning-log-consistency-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-consistency-band')).toBe('DEVELOPING')
    expect(card.textContent).toMatch(/64%/)
    expect(card.textContent).toMatch(/DEVELOPING/)
    expect(card.textContent).toMatch(/Routine is forming/i)
  })

  it('shows mixed logged/not-logged cells', () => {
    const recovery = consecutive(18)
    renderCard(recovery)
    const cells = document.querySelectorAll('[data-day-cell]')
    expect(cells.length).toBe(28)
    const logged = Array.from(cells).filter(c => c.getAttribute('data-day-logged') === 'true')
    const empty = Array.from(cells).filter(c => c.getAttribute('data-day-logged') === 'false')
    expect(logged.length).toBe(18)
    expect(empty.length).toBe(10)
  })
})

describe('MorningLogConsistencyCard — SPORADIC band', () => {
  it('renders with SPORADIC band at 7/28 (25%)', () => {
    const recovery = consecutive(7)
    renderCard(recovery)
    const card = document.querySelector('[data-morning-log-consistency-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-consistency-band')).toBe('SPORADIC')
    expect(card.textContent).toMatch(/25%/)
    expect(card.textContent).toMatch(/SPORADIC/)
    expect(card.textContent).toMatch(/Inconsistent logging/i)
  })
})

describe('MorningLogConsistencyCard — streak attributes', () => {
  it('reflects partial current streak vs longer historic streak', () => {
    // 2-day current streak (today, day-1); 7-day streak earlier
    const recovery = []
    for (let i = 0; i < 2; i++) recovery.push({ date: daysAgo(i), sleepHrs: 7 })
    for (let i = 4; i < 11; i++) recovery.push({ date: daysAgo(i), sleepHrs: 7 })
    renderCard(recovery)
    const card = document.querySelector('[data-morning-log-consistency-card]')
    expect(card.getAttribute('data-current-streak')).toBe('2')
    expect(card.getAttribute('data-longest-streak')).toBe('7')
  })
})

describe('MorningLogConsistencyCard — bilingual', () => {
  it('renders Turkish heading and band label when lang=tr (HABITUATED)', () => {
    const recovery = consecutive(28)
    renderCard(recovery, 'tr')
    const region = screen.getByRole('region', { name: /Sabah kaydı tutarlılığı/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/SABAH KAYDI · 28G/)
    expect(region.textContent).toMatch(/ALIŞKANLIK/)
    expect(region.textContent).toMatch(/Güçlü sabah rutini/)
    expect(region.textContent).toMatch(/Wood 2013/)
  })

  it('renders Turkish band label for DEVELOPING', () => {
    const recovery = consecutive(18)
    renderCard(recovery, 'tr')
    const card = document.querySelector('[data-morning-log-consistency-card]')
    expect(card.textContent).toMatch(/GELİŞİYOR/)
    expect(card.textContent).toMatch(/Rutin oluşuyor/)
  })

  it('renders Turkish band label for SPORADIC', () => {
    const recovery = consecutive(7)
    renderCard(recovery, 'tr')
    const card = document.querySelector('[data-morning-log-consistency-card]')
    expect(card.textContent).toMatch(/DÜZENSİZ/)
    expect(card.textContent).toMatch(/Düzensiz kayıt/)
  })
})
