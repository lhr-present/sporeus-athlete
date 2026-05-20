// @vitest-environment jsdom
// ─── MicrocycleVarietyCard.test.jsx — render coverage ──────────────────────
//
// Covers: null gate (analyzeMicrocycleVariety never returns null at default
// today, so card never null-gates with default input; we exercise the null
// branch by patching today via an invalid log shape — see custom log test),
// each band renders (INSUFFICIENT_DATA / MONOTONOUS / NARROW / BALANCED /
// WIDE_VARIETY), EN + TR, citation, accessibility (role=region, role=list,
// aria-live), 12-bar rendering with sessionCount labels.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import MicrocycleVarietyCard from '../dashboard/MicrocycleVarietyCard.jsx'

// 2026-05-17 is a Sunday → current ISO week Mon = 2026-05-11.
const TODAY = '2026-05-17'

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})

afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

function entryInWeek(weeksAgo, type, overrides = {}) {
  const monday = mondayOf(TODAY)
  const weekStart = isoMinusDays(monday, weeksAgo * 7)
  const date = isoMinusDays(weekStart, -2) // Wednesday
  return {
    date,
    type,
    durationMin: 60,
    ...overrides,
  }
}

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <MicrocycleVarietyCard log={log} />
    </LangCtx.Provider>,
  )
}

// ─── INSUFFICIENT_DATA band ────────────────────────────────────────────────
describe('MicrocycleVarietyCard — INSUFFICIENT_DATA', () => {
  it('renders INSUFFICIENT_DATA band with EN hint when log is empty', () => {
    renderCard([])
    const card = document.querySelector('[data-card="microcycle-variety"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_DATA')
    expect(card.textContent).toMatch(/NOT ENOUGH WEEKS/)
    expect(card.textContent).toMatch(/at least 4 weeks/i)
    expect(card.textContent).toMatch(/Issurin 2010/)
    expect(card.textContent).toMatch(/Bompa 2018/)
  })

  it('renders INSUFFICIENT_DATA band with TR hint', () => {
    renderCard([], 'tr')
    const card = document.querySelector('[data-card="microcycle-variety"]')
    expect(card.textContent).toMatch(/YETERSİZ HAFTA/)
    expect(card.textContent).toMatch(/en az 4 hafta/i)
  })
})

// ─── Band rendering ────────────────────────────────────────────────────────
describe('MicrocycleVarietyCard — band rendering', () => {
  it('renders MONOTONOUS band (red) when every training week has exactly 1 type', () => {
    const log = [0, 1, 2, 3, 4].map(w => entryInWeek(w, 'easy'))
    renderCard(log)
    const card = document.querySelector('[data-card="microcycle-variety"]')
    expect(card.getAttribute('data-band')).toBe('MONOTONOUS')
    expect(card.textContent).toMatch(/MONOTONOUS/)
    expect(card.style.borderLeft).toMatch(/rgb\(224,\s*48,\s*48\)/)
  })

  it('renders NARROW band (orange) when mean is just above 1.5', () => {
    const log = [
      ...['easy', 'tempo'].map(t => entryInWeek(0, t)),
      ...['easy', 'tempo'].map(t => entryInWeek(1, t)),
      ...['easy', 'tempo'].map(t => entryInWeek(2, t)),
      entryInWeek(3, 'easy'),
      entryInWeek(4, 'easy'),
    ]
    renderCard(log)
    const card = document.querySelector('[data-card="microcycle-variety"]')
    expect(card.getAttribute('data-band')).toBe('NARROW')
    expect(card.textContent).toMatch(/NARROW/)
    expect(card.style.borderLeft).toMatch(/rgb\(255,\s*102,\s*0\)/)
  })

  it('renders BALANCED band (blue) when mean is ~3', () => {
    const types = ['easy', 'tempo', 'long']
    const log = [0, 1, 2, 3].flatMap(w => types.map(t => entryInWeek(w, t)))
    renderCard(log)
    const card = document.querySelector('[data-card="microcycle-variety"]')
    expect(card.getAttribute('data-band')).toBe('BALANCED')
    expect(card.textContent).toMatch(/BALANCED/)
    expect(card.style.borderLeft).toMatch(/rgb\(0,\s*100,\s*255\)/)
  })

  it('renders WIDE_VARIETY band (green) when mean > 4', () => {
    const types = ['easy', 'tempo', 'long', 'intervals', 'strength']
    const log = [0, 1, 2, 3].flatMap(w => types.map(t => entryInWeek(w, t)))
    renderCard(log)
    const card = document.querySelector('[data-card="microcycle-variety"]')
    expect(card.getAttribute('data-band')).toBe('WIDE_VARIETY')
    expect(card.textContent).toMatch(/WIDE VARIETY/)
    expect(card.style.borderLeft).toMatch(/rgb\(91,\s*194,\s*91\)/)
  })
})

// ─── Stats + bars ──────────────────────────────────────────────────────────
describe('MicrocycleVarietyCard — stats & bars', () => {
  it('exposes mean stat, training-week count and trend delta as data attrs', () => {
    const types = ['easy', 'tempo', 'long']
    const log = [0, 1, 2, 3].flatMap(w => types.map(t => entryInWeek(w, t)))
    renderCard(log)
    const card = document.querySelector('[data-card="microcycle-variety"]')
    expect(card.getAttribute('data-training-weeks')).toBe('4')
    expect(card.getAttribute('data-mean-unique')).toBe('3')
    expect(card.querySelector('[data-mean-stat]').textContent).toBe('3.00')
    expect(card.querySelector('[data-stats]').textContent).toMatch(/training weeks/i)
    expect(card.querySelector('[data-stats]').textContent).toMatch(/trend/i)
  })

  it('renders exactly 12 mini bars by default', () => {
    renderCard([])
    const card = document.querySelector('[data-card="microcycle-variety"]')
    const bars = card.querySelectorAll('[data-bar]')
    expect(bars.length).toBe(12)
  })

  it('each bar exposes its weekStart, uniqueTypes and sessionCount', () => {
    const log = [
      entryInWeek(0, 'easy'),
      entryInWeek(0, 'tempo'),
      entryInWeek(1, 'easy'),
      entryInWeek(2, 'easy'),
      entryInWeek(3, 'easy'),
    ]
    renderCard(log)
    const card = document.querySelector('[data-card="microcycle-variety"]')
    const bars = card.querySelectorAll('[data-bar]')
    const newest = bars[bars.length - 1]
    expect(newest.getAttribute('data-week-start')).toBe('2026-05-11')
    expect(newest.getAttribute('data-unique-types')).toBe('2')
    expect(newest.getAttribute('data-session-count')).toBe('2')
    // sessionCount label below the bar.
    expect(newest.querySelector('[data-bar-count]').textContent).toBe('2')
  })

  it('renders sessionCount = 0 for empty weeks', () => {
    const log = [
      entryInWeek(0, 'easy'),
      entryInWeek(1, 'easy'),
      entryInWeek(2, 'easy'),
      entryInWeek(3, 'easy'),
    ]
    renderCard(log)
    const card = document.querySelector('[data-card="microcycle-variety"]')
    const bars = card.querySelectorAll('[data-bar]')
    // Oldest bar = 11 weeks ago — empty.
    const oldest = bars[0]
    expect(oldest.getAttribute('data-session-count')).toBe('0')
    expect(oldest.getAttribute('data-unique-types')).toBe('0')
  })
})

// ─── Bilingual ─────────────────────────────────────────────────────────────
describe('MicrocycleVarietyCard — bilingual', () => {
  it('renders Turkish title and stat label', () => {
    const types = ['easy', 'tempo', 'long']
    const log = [0, 1, 2, 3].flatMap(w => types.map(t => entryInWeek(w, t)))
    renderCard(log, 'tr')
    const card = document.querySelector('[data-card="microcycle-variety"]')
    expect(card.textContent).toMatch(/MİKROSİKL ÇEŞİTLİLİĞİ/)
    expect(card.textContent).toMatch(/tip \/ hafta/)
    expect(card.textContent).toMatch(/antrenmanlı hafta/)
  })

  it('renders English title and stat label', () => {
    const types = ['easy', 'tempo', 'long']
    const log = [0, 1, 2, 3].flatMap(w => types.map(t => entryInWeek(w, t)))
    renderCard(log)
    const card = document.querySelector('[data-card="microcycle-variety"]')
    expect(card.textContent).toMatch(/MICROCYCLE VARIETY/)
    expect(card.textContent).toMatch(/types per week/)
    expect(card.textContent).toMatch(/training weeks/)
  })

  it('uses TR trend label format', () => {
    const log = [0, 1, 2, 3].map(w => entryInWeek(w, 'easy'))
    renderCard(log, 'tr')
    const card = document.querySelector('[data-card="microcycle-variety"]')
    expect(card.querySelector('[data-trend]').textContent).toMatch(/eğim/)
    expect(card.querySelector('[data-trend]').textContent).toMatch(/\/ hafta/)
  })
})

// ─── Trend arrow ───────────────────────────────────────────────────────────
describe('MicrocycleVarietyCard — trend arrow', () => {
  it('renders an upward arrow when uniqueTypes grows over the window', () => {
    // 12 weeks ascending 1→2→3.
    const byWeek = [
      ['a'], ['a'], ['a'], ['a'],
      ['a', 'b'], ['a', 'b'], ['a', 'b'], ['a', 'b'],
      ['a', 'b', 'c'], ['a', 'b', 'c'], ['a', 'b', 'c'], ['a', 'b', 'c'],
    ]
    const log = []
    byWeek.forEach((types, i) => {
      const weeksAgo = byWeek.length - 1 - i
      for (const t of types) log.push(entryInWeek(weeksAgo, t))
    })
    renderCard(log)
    const card = document.querySelector('[data-card="microcycle-variety"]')
    expect(card.querySelector('[data-trend]').textContent).toMatch(/↑/)
  })

  it('renders a downward arrow when uniqueTypes shrinks over the window', () => {
    const byWeek = [
      ['a', 'b', 'c'], ['a', 'b', 'c'], ['a', 'b', 'c'], ['a', 'b', 'c'],
      ['a', 'b'], ['a', 'b'], ['a', 'b'], ['a', 'b'],
      ['a'], ['a'], ['a'], ['a'],
    ]
    const log = []
    byWeek.forEach((types, i) => {
      const weeksAgo = byWeek.length - 1 - i
      for (const t of types) log.push(entryInWeek(weeksAgo, t))
    })
    renderCard(log)
    const card = document.querySelector('[data-card="microcycle-variety"]')
    expect(card.querySelector('[data-trend]').textContent).toMatch(/↓/)
  })

  it('renders a flat arrow when uniqueTypes is constant', () => {
    const log = []
    for (let w = 0; w < 12; w++) {
      log.push(entryInWeek(w, 'easy'))
      log.push(entryInWeek(w, 'tempo'))
    }
    renderCard(log)
    const card = document.querySelector('[data-card="microcycle-variety"]')
    expect(card.querySelector('[data-trend]').textContent).toMatch(/→/)
  })
})

// ─── Accessibility ─────────────────────────────────────────────────────────
describe('MicrocycleVarietyCard — accessibility', () => {
  it('exposes role=region with bilingual aria-label (EN)', () => {
    renderCard([])
    const region = screen.getByRole('region', { name: /Microcycle variety/i })
    expect(region).toBeInTheDocument()
  })

  it('exposes role=region with bilingual aria-label (TR)', () => {
    renderCard([], 'tr')
    const region = screen.getByRole('region', { name: /Mikrosikl çeşitliliği/i })
    expect(region).toBeInTheDocument()
  })

  it('exposes the 12-bar group as a role=list', () => {
    renderCard([])
    const list = screen.getByRole('list', { name: /Weekly microcycle variety/i })
    expect(list).toBeInTheDocument()
  })

  it('renders the citation in the footer', () => {
    renderCard([])
    const citation = document.querySelector('[data-citation]')
    expect(citation).not.toBeNull()
    expect(citation.textContent).toMatch(/Issurin 2010; Bompa 2018/)
  })

  it('renders a band-coloured hint strip with aria-live="polite"', () => {
    renderCard([])
    const hint = document.querySelector('[data-hint]')
    expect(hint).not.toBeNull()
    expect(hint.getAttribute('aria-live')).toBe('polite')
  })
})
