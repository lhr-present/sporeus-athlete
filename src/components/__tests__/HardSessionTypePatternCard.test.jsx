// @vitest-environment jsdom
// ─── HardSessionTypePatternCard.test.jsx — render coverage ──────────────────
//
// Covers: null gate (none — analyze never returns null with default today),
// each band renders (INSUFFICIENT_HARD / MONOLITHIC / NARROW / BALANCED /
// VARIED), EN + TR, citation, accessibility, stacked-bar segment rendering
// with top-6 types + "other" collapse.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import HardSessionTypePatternCard from '../dashboard/HardSessionTypePatternCard.jsx'

const TODAY = '2026-05-19'

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})

afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function daysAgo(n) {
  const d = new Date(TODAY + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <HardSessionTypePatternCard log={log} />
    </LangCtx.Provider>
  )
}

function hardEntry(i, type, overrides = {}) {
  return {
    date: daysAgo(i + 1),
    type,
    zone: 'z4',
    rpe: 8,
    durationMin: 60,
    ...overrides,
  }
}

describe('HardSessionTypePatternCard — INSUFFICIENT_HARD', () => {
  it('renders INSUFFICIENT_HARD band with bilingual hint (EN)', () => {
    renderCard([])
    const card = document.querySelector('[data-card="hard-session-type-pattern"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_HARD')
    expect(card.textContent).toMatch(/NOT ENOUGH HARD/)
    expect(card.textContent).toMatch(/at least 8 hard sessions/i)
    expect(card.textContent).toMatch(/Stöggl 2014/)
    expect(card.textContent).toMatch(/Tønnessen 2015/)
  })

  it('renders INSUFFICIENT_HARD band with Turkish hint', () => {
    renderCard([], 'tr')
    const card = document.querySelector('[data-card="hard-session-type-pattern"]')
    expect(card.textContent).toMatch(/YETERSİZ SERT/)
    expect(card.textContent).toMatch(/en az 8 sert seans/i)
  })
})

describe('HardSessionTypePatternCard — band rendering', () => {
  it('renders MONOLITHIC band when one type owns 100% of hard sessions', () => {
    const log = Array.from({ length: 10 }, (_, i) => hardEntry(i, 'intervals'))
    renderCard(log)
    const card = document.querySelector('[data-card="hard-session-type-pattern"]')
    expect(card.getAttribute('data-band')).toBe('MONOLITHIC')
    expect(card.textContent).toMatch(/MONOLITHIC/)
    // Red stripe.
    expect(card.style.borderLeft).toMatch(/rgb\(224,\s*48,\s*48\)/)
    // Dominant share label.
    expect(card.querySelector('[data-dominant]').textContent).toMatch(/intervals: 100%/)
  })

  it('renders NARROW band (orange) when dominant share is 60-79%', () => {
    const log = [
      ...Array.from({ length: 6 }, (_, i) => hardEntry(i, 'intervals')),
      hardEntry(7, 'tempo'),
      hardEntry(8, 'tempo'),
      hardEntry(9, 'threshold'),
      hardEntry(10, 'hills'),
    ]
    renderCard(log)
    const card = document.querySelector('[data-card="hard-session-type-pattern"]')
    expect(card.getAttribute('data-band')).toBe('NARROW')
    expect(card.textContent).toMatch(/NARROW/)
    expect(card.style.borderLeft).toMatch(/rgb\(255,\s*102,\s*0\)/)
  })

  it('renders BALANCED band (blue) when mix is moderate', () => {
    const log = [
      hardEntry(0, 'intervals'), hardEntry(1, 'intervals'), hardEntry(2, 'intervals'),
      hardEntry(3, 'tempo'), hardEntry(4, 'tempo'), hardEntry(5, 'tempo'),
      hardEntry(6, 'threshold'), hardEntry(7, 'threshold'),
    ]
    renderCard(log)
    const card = document.querySelector('[data-card="hard-session-type-pattern"]')
    expect(card.getAttribute('data-band')).toBe('BALANCED')
    expect(card.textContent).toMatch(/BALANCED/)
    expect(card.style.borderLeft).toMatch(/rgb\(0,\s*100,\s*255\)/)
  })

  it('renders VARIED band (green) when 5+ types and high entropy', () => {
    const log = [
      hardEntry(0, 'intervals'), hardEntry(1, 'intervals'),
      hardEntry(2, 'tempo'),     hardEntry(3, 'tempo'),
      hardEntry(4, 'threshold'), hardEntry(5, 'threshold'),
      hardEntry(6, 'hills'),     hardEntry(7, 'hills'),
      hardEntry(8, 'racepace'),  hardEntry(9, 'racepace'),
    ]
    renderCard(log)
    const card = document.querySelector('[data-card="hard-session-type-pattern"]')
    expect(card.getAttribute('data-band')).toBe('VARIED')
    expect(card.textContent).toMatch(/VARIED/)
    expect(card.style.borderLeft).toMatch(/rgb\(91,\s*194,\s*91\)/)
  })
})

describe('HardSessionTypePatternCard — stats & segments', () => {
  it('exposes hard-session count, unique types and dominant attribute', () => {
    const log = [
      ...Array.from({ length: 6 }, (_, i) => hardEntry(i, 'intervals')),
      hardEntry(7, 'tempo'),
      hardEntry(8, 'tempo'),
      hardEntry(9, 'threshold'),
      hardEntry(10, 'hills'),
    ]
    renderCard(log)
    const card = document.querySelector('[data-card="hard-session-type-pattern"]')
    expect(card.getAttribute('data-hard-sessions')).toBe('10')
    expect(card.getAttribute('data-unique-types')).toBe('4')
    expect(card.getAttribute('data-dominant-type')).toBe('intervals')
    expect(card.querySelector('[data-hard-count]').textContent).toBe('10')
    expect(card.querySelector('[data-stats]').textContent).toMatch(/4 unique types/i)
    expect(card.querySelector('[data-stats]').textContent).toMatch(/entropy/i)
    expect(card.querySelector('[data-stats]').textContent).toMatch(/variety/i)
  })

  it('renders top-6 types plus a single "other" segment when 7+ types', () => {
    // 7 distinct types, each twice, plus 1 single (8 types total).
    const types = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const log = types.flatMap((t, i) => [
      hardEntry(i * 2, t),
      hardEntry(i * 2 + 1, t),
    ])
    renderCard(log)
    const card = document.querySelector('[data-card="hard-session-type-pattern"]')
    const segments = card.querySelectorAll('[data-segment]')
    // 6 top + 1 other = 7
    expect(segments.length).toBe(7)
    const other = card.querySelector('[data-segment="__other__"]')
    expect(other).not.toBeNull()
    // Other groups 2 leftover types × 2 entries = 4
    expect(other.getAttribute('data-segment-count')).toBe('4')
  })

  it('does not render an "other" segment when 6 or fewer types', () => {
    const types = ['a', 'b', 'c', 'd', 'e', 'f']
    const log = types.flatMap((t, i) => [
      hardEntry(i * 2, t),
      hardEntry(i * 2 + 1, t),
    ])
    renderCard(log)
    const card = document.querySelector('[data-card="hard-session-type-pattern"]')
    const other = card.querySelector('[data-segment="__other__"]')
    expect(other).toBeNull()
    const segments = card.querySelectorAll('[data-segment]')
    expect(segments.length).toBe(6)
  })
})

describe('HardSessionTypePatternCard — bilingual', () => {
  it('renders Turkish title and hard-session count label', () => {
    const log = Array.from({ length: 10 }, (_, i) => hardEntry(i, 'intervals'))
    renderCard(log, 'tr')
    const card = document.querySelector('[data-card="hard-session-type-pattern"]')
    expect(card.textContent).toMatch(/SERT ANTRENMAN ÇEŞİTLİLİĞİ/)
    expect(card.textContent).toMatch(/son 90 günde 10 sert seans/i)
  })

  it('renders English title and pluralised count label', () => {
    const log = Array.from({ length: 8 }, (_, i) => hardEntry(i, 'tempo'))
    renderCard(log)
    const card = document.querySelector('[data-card="hard-session-type-pattern"]')
    expect(card.textContent).toMatch(/HARD-SESSION VARIETY/)
    expect(card.textContent).toMatch(/8 hard sessions in last 90d/i)
  })
})

describe('HardSessionTypePatternCard — accessibility', () => {
  it('exposes role=region with bilingual aria-label (EN)', () => {
    renderCard([])
    const region = screen.getByRole('region', { name: /Hard-session variety/i })
    expect(region).toBeInTheDocument()
  })

  it('exposes role=region with bilingual aria-label (TR)', () => {
    renderCard([], 'tr')
    const region = screen.getByRole('region', { name: /Sert antrenman çeşitliliği/i })
    expect(region).toBeInTheDocument()
  })

  it('exposes the stacked bar as a role=list when populated', () => {
    const log = [
      ...Array.from({ length: 4 }, (_, i) => hardEntry(i, 'intervals')),
      ...Array.from({ length: 4 }, (_, i) => hardEntry(i + 4, 'tempo')),
    ]
    renderCard(log)
    const list = screen.getByRole('list', { name: /Hard-session type distribution/i })
    expect(list).toBeInTheDocument()
  })

  it('renders the citation in the footer', () => {
    renderCard([])
    const citation = document.querySelector('[data-citation]')
    expect(citation).not.toBeNull()
    expect(citation.textContent).toMatch(/Stöggl 2014; Tønnessen 2015/)
  })

  it('renders a band-coloured hint strip with aria-live="polite"', () => {
    renderCard([])
    const hint = document.querySelector('[data-hint]')
    expect(hint).not.toBeNull()
    expect(hint.getAttribute('aria-live')).toBe('polite')
  })
})
