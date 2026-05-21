// @vitest-environment jsdom
// ─── ConsecutiveDeloadCountCard.test.jsx ──────────────────────────────────
//
// Surface tests for ConsecutiveDeloadCountCard:
//   - null gate (empty log still renders — INSUFFICIENT_DATA),
//   - INSUFFICIENT_DATA band,
//   - each populated band (NO_RUNS / OCCASIONAL_RUN / EXTENDED_RUN),
//   - bilingual EN + TR via LangCtx Provider,
//   - citation footer,
//   - role=region + aria-label accessibility,
//   - run-chip rendering (up to 3),
//   - 16-bar timeline rendering,
//   - data-attributes.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import ConsecutiveDeloadCountCard from '../dashboard/ConsecutiveDeloadCountCard.jsx'

const TODAY = '2026-05-20' // Wed → ISO Monday = 2026-05-18

// Mondays for the 16-week window ending at TODAY, oldest first.
const WEEK_MONDAYS = [
  '2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23',
  '2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23',
  '2026-03-30', '2026-04-06', '2026-04-13', '2026-04-20',
  '2026-04-27', '2026-05-04', '2026-05-11', '2026-05-18',
]

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})

afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function sessionInWeek(weekIdx, tss, dayOffset = 1) {
  const monday = WEEK_MONDAYS[weekIdx]
  const d = new Date(monday + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + dayOffset)
  return { date: d.toISOString().slice(0, 10), tss, type: 'Endurance' }
}

function logFromWeeklyTss(weekly) {
  const out = []
  for (let i = 0; i < weekly.length; i++) {
    const tss = Number(weekly[i])
    if (!Number.isFinite(tss) || tss <= 0) continue
    out.push(sessionInWeek(i, tss, 1))
  }
  return out
}

function renderCard(log, lang = 'en') {
  const value = { t: (k) => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <ConsecutiveDeloadCountCard log={log} />
    </LangCtx.Provider>,
  )
}

// ─── Fixtures ─────────────────────────────────────────────────────────────

// Steady 200 TSS baseline — NO_RUNS, no deloads.
const NO_RUNS_WEEKLY = [
  200, 200, 200, 200, 200, 200, 200, 200,
  200, 200, 200, 200, 200, 200, 200, 0,
]

// OCCASIONAL_RUN: one back-to-back deload event of length 2 at idx 7+8.
const OCCASIONAL_WEEKLY = [
  200, 200, 200, 200, 200, 200, 200, 100,
  100, 200, 200, 200, 200, 200, 200, 0,
]

// EXTENDED_RUN by length: one run of length 3 at idx 7/8/9.
const EXTENDED_WEEKLY = [
  200, 200, 200, 200, 200, 200, 200, 40,
  40, 40, 200, 200, 200, 200, 200, 0,
]

// Sparse: not enough classifiable weeks.
const SPARSE_WEEKLY = [
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 200, 200, 200, 200, 200, 0,
]

// ─── null gate / INSUFFICIENT_DATA ────────────────────────────────────────

describe('ConsecutiveDeloadCountCard — null gate', () => {
  it('renders INSUFFICIENT_DATA for an empty log', () => {
    renderCard([])
    const card = document.querySelector('[data-card="consecutive-deload-count"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_DATA')
  })

  it('renders INSUFFICIENT_DATA for a null log', () => {
    renderCard(null)
    const card = document.querySelector('[data-card="consecutive-deload-count"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_DATA')
  })

  it('renders INSUFFICIENT_DATA when classifiable-week gate fails', () => {
    renderCard(logFromWeeklyTss(SPARSE_WEEKLY))
    const card = document.querySelector('[data-card="consecutive-deload-count"]')
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_DATA')
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('NOT ENOUGH DATA')
  })
})

// ─── NO_RUNS band ─────────────────────────────────────────────────────────

describe('ConsecutiveDeloadCountCard — NO_RUNS band', () => {
  it('renders the NO_RUNS attr + label (EN)', () => {
    renderCard(logFromWeeklyTss(NO_RUNS_WEEKLY))
    const card = document.querySelector('[data-card="consecutive-deload-count"]')
    expect(card.getAttribute('data-band')).toBe('NO_RUNS')
    expect(card.getAttribute('data-total-runs')).toBe('0')
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('NO RUNS')
  })

  it('renders no run chips when nothing back-to-back', () => {
    renderCard(logFromWeeklyTss(NO_RUNS_WEEKLY))
    expect(document.querySelector('[data-run-chips]')).toBeNull()
  })

  it('renders the NO_RUNS hint (EN)', () => {
    renderCard(logFromWeeklyTss(NO_RUNS_WEEKLY))
    const hint = document.querySelector('[data-band-hint]')
    expect(hint).not.toBeNull()
    expect(hint.textContent).toMatch(/No back-to-back deload weeks/i)
  })
})

// ─── OCCASIONAL_RUN band ──────────────────────────────────────────────────

describe('ConsecutiveDeloadCountCard — OCCASIONAL_RUN band', () => {
  it('renders the OCCASIONAL_RUN attr + label', () => {
    renderCard(logFromWeeklyTss(OCCASIONAL_WEEKLY))
    const card = document.querySelector('[data-card="consecutive-deload-count"]')
    expect(card.getAttribute('data-band')).toBe('OCCASIONAL_RUN')
    expect(card.getAttribute('data-total-runs')).toBe('1')
    expect(card.getAttribute('data-longest-run')).toBe('2')
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('OCCASIONAL')
  })

  it('renders exactly one run chip', () => {
    renderCard(logFromWeeklyTss(OCCASIONAL_WEEKLY))
    const chips = document.querySelectorAll('[data-run-chip]')
    expect(chips.length).toBe(1)
    expect(chips[0].textContent).toMatch(/2 weeks/i)
    expect(chips[0].textContent).toMatch(/ref \d+ TSS/i)
  })
})

// ─── EXTENDED_RUN band ────────────────────────────────────────────────────

describe('ConsecutiveDeloadCountCard — EXTENDED_RUN band', () => {
  it('renders the EXTENDED_RUN attr + label for a length-3 run', () => {
    renderCard(logFromWeeklyTss(EXTENDED_WEEKLY))
    const card = document.querySelector('[data-card="consecutive-deload-count"]')
    expect(card.getAttribute('data-band')).toBe('EXTENDED_RUN')
    expect(card.getAttribute('data-longest-run')).toBe('3')
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('EXTENDED')
  })

  it('renders at most 3 run chips', () => {
    renderCard(logFromWeeklyTss(EXTENDED_WEEKLY))
    const chips = document.querySelectorAll('[data-run-chip]')
    expect(chips.length).toBeLessThanOrEqual(3)
    expect(chips.length).toBeGreaterThanOrEqual(1)
  })
})

// ─── 16-bar timeline ─────────────────────────────────────────────────────

describe('ConsecutiveDeloadCountCard — 16-bar timeline', () => {
  it('renders 16 mini bars on a NO_RUNS state', () => {
    renderCard(logFromWeeklyTss(NO_RUNS_WEEKLY))
    const bars = document.querySelectorAll('[data-mini-bar]')
    expect(bars.length).toBe(16)
  })

  it('marks the run weeks as "deload-in-run" in the timeline', () => {
    renderCard(logFromWeeklyTss(OCCASIONAL_WEEKLY))
    const inRunBars = document.querySelectorAll('[data-mini-bar="deload-in-run"]')
    expect(inRunBars.length).toBeGreaterThanOrEqual(2)
  })
})

// ─── bilingual (TR) ──────────────────────────────────────────────────────

describe('ConsecutiveDeloadCountCard — Turkish', () => {
  it('renders the TR heading and aria-label when lang=tr', () => {
    renderCard(logFromWeeklyTss(OCCASIONAL_WEEKLY), 'tr')
    const region = screen.getByRole('region', {
      name: /Üst üste yenileme haftaları/i,
    })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/ÜST ÜSTE YENİLEME HAFTALARI/)
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('ARA SIRA')
  })

  it('renders TR chip text', () => {
    renderCard(logFromWeeklyTss(OCCASIONAL_WEEKLY), 'tr')
    const chip = document.querySelector('[data-run-chip]')
    expect(chip).not.toBeNull()
    expect(chip.textContent).toMatch(/hafta/i)
  })

  it('renders the TR NO_RUNS hint', () => {
    renderCard(logFromWeeklyTss(NO_RUNS_WEEKLY), 'tr')
    const hint = document.querySelector('[data-band-hint]')
    expect(hint.textContent).toMatch(/Üst üste boşaltma haftası yok/i)
  })

  it('renders TR EXTENDED band label', () => {
    renderCard(logFromWeeklyTss(EXTENDED_WEEKLY), 'tr')
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('UZUN SÜRELİ')
  })

  it('renders TR INSUFFICIENT_DATA band label', () => {
    renderCard(logFromWeeklyTss(SPARSE_WEEKLY), 'tr')
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('YETERSİZ VERİ')
  })
})

// ─── citation ─────────────────────────────────────────────────────────────

describe('ConsecutiveDeloadCountCard — citation', () => {
  it('renders the citation footer', () => {
    renderCard(logFromWeeklyTss(OCCASIONAL_WEEKLY))
    const cite = document.querySelector('[data-consecutive-deload-citation]')
    expect(cite).not.toBeNull()
    expect(cite.textContent).toBe('Bompa 2018; Mujika 2010')
  })

  it('renders the citation in NO_RUNS state too', () => {
    renderCard(logFromWeeklyTss(NO_RUNS_WEEKLY))
    const cite = document.querySelector('[data-consecutive-deload-citation]')
    expect(cite.textContent).toBe('Bompa 2018; Mujika 2010')
  })

  it('renders the citation in INSUFFICIENT_DATA state too', () => {
    renderCard([])
    const cite = document.querySelector('[data-consecutive-deload-citation]')
    expect(cite.textContent).toBe('Bompa 2018; Mujika 2010')
  })
})

// ─── accessibility ────────────────────────────────────────────────────────

describe('ConsecutiveDeloadCountCard — accessibility', () => {
  it('uses role=region with a bilingual aria-label (EN)', () => {
    renderCard(logFromWeeklyTss(OCCASIONAL_WEEKLY))
    const region = document.querySelector(
      '[role="region"][data-card="consecutive-deload-count"]',
    )
    expect(region).not.toBeNull()
    expect(region.getAttribute('aria-label')).toMatch(/Back-to-back deloads/i)
  })

  it('uses role=region with a bilingual aria-label (TR)', () => {
    renderCard(logFromWeeklyTss(OCCASIONAL_WEEKLY), 'tr')
    const region = document.querySelector(
      '[role="region"][data-card="consecutive-deload-count"]',
    )
    expect(region.getAttribute('aria-label')).toMatch(
      /Üst üste yenileme haftaları/i,
    )
  })
})

// ─── data attributes ──────────────────────────────────────────────────────

describe('ConsecutiveDeloadCountCard — data attributes', () => {
  it('exposes data-total-runs, data-longest-run, data-deload-weeks-total', () => {
    renderCard(logFromWeeklyTss(OCCASIONAL_WEEKLY))
    const card = document.querySelector('[data-card="consecutive-deload-count"]')
    expect(card.getAttribute('data-total-runs')).toBe('1')
    expect(card.getAttribute('data-longest-run')).toBe('2')
    // 2 deload weeks (the run) + possibly more singletons. Just check it's ≥ 2.
    expect(Number(card.getAttribute('data-deload-weeks-total'))).toBeGreaterThanOrEqual(2)
  })
})

// ─── console hygiene ──────────────────────────────────────────────────────

describe('ConsecutiveDeloadCountCard — console hygiene', () => {
  it('renders without console warnings or errors', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderCard(logFromWeeklyTss(OCCASIONAL_WEEKLY))
    expect(warnSpy).not.toHaveBeenCalled()
    expect(errSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
    errSpy.mockRestore()
  })
})
