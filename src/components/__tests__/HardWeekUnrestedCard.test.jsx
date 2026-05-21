// @vitest-environment jsdom
// ─── HardWeekUnrestedCard.test.jsx ───────────────────────────────────────
//
// Surface tests for HardWeekUnrestedCard:
//   - CLEAN state renders (empty + flat-week logs),
//   - each band (CLEAN / OCCASIONAL / REPEATED / CHRONIC),
//   - bilingual EN + TR via LangCtx Provider,
//   - citation footer,
//   - role=region + aria-label accessibility,
//   - unrested-chip rendering (up to 3, newest first),
//   - 16-bar timeline rendering,
//   - data-attributes (band, totals, rate).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import HardWeekUnrestedCard from '../dashboard/HardWeekUnrestedCard.jsx'

const TODAY = '2026-05-20' // Wed → ISO Monday = 2026-05-18

// Mondays for the 16-week window ending at TODAY, oldest first.
// idx 15 is the partial current week.
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
      <HardWeekUnrestedCard log={log} />
    </LangCtx.Provider>,
  )
}

// ─── Fixtures ─────────────────────────────────────────────────────────────

// CLEAN: empty / no spikes.
const CLEAN_WEEKLY = [
  200, 200, 200, 200, 200, 200, 200, 200,
  200, 200, 200, 200, 200, 200, 200, 0,
]

// OCCASIONAL_UNRESTED: 1 unrested hard week.
// idx 3 spikes to 280 (vs prior 200 mean → 1.4×), follow-up idx 4 = 250 (unrested).
const OCCASIONAL_WEEKLY = [
  200, 200, 200, 280, 250, 200, 200, 200,
  200, 200, 200, 200, 200, 200, 200, 0,
]

// REPEATED_UNRESTED: 2 unrested hard weeks.
const REPEATED_WEEKLY = [
  200, 200, 200, 280, 250, 100, 100, 280,
  250, 100, 100, 280, 250, 100, 100, 0,
]

// CHRONIC_UNRESTED: many unrested hard weeks via geometric ramp.
const CHRONIC_WEEKLY = [
  100, 100, 100, 200, 250, 320, 400, 500,
  600, 720, 870, 1050, 1260, 1500, 1800, 0,
]

// ─── guards / empty log ───────────────────────────────────────────────────

describe('HardWeekUnrestedCard — guards', () => {
  it('renders the CLEAN state for an empty log', () => {
    renderCard([])
    const card = document.querySelector('[data-card="hard-week-unrested"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('CLEAN')
  })

  it('renders the CLEAN state for a null log', () => {
    renderCard(null)
    const card = document.querySelector('[data-card="hard-week-unrested"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('CLEAN')
  })
})

// ─── CLEAN band ───────────────────────────────────────────────────────────

describe('HardWeekUnrestedCard — CLEAN band', () => {
  it('renders the CLEAN band label (EN)', () => {
    renderCard(logFromWeeklyTss(CLEAN_WEEKLY))
    const card = document.querySelector('[data-card="hard-week-unrested"]')
    expect(card.getAttribute('data-band')).toBe('CLEAN')
    expect(card.getAttribute('data-unrested-count')).toBe('0')
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('CLEAN')
  })

  it('renders the CLEAN hint (EN)', () => {
    renderCard(logFromWeeklyTss(CLEAN_WEEKLY))
    const hint = document.querySelector('[data-band-hint]')
    expect(hint).not.toBeNull()
    expect(hint.textContent).toMatch(/No unrested overreaching events/i)
  })

  it('renders no unrested-chip group when nothing unrested', () => {
    renderCard(logFromWeeklyTss(CLEAN_WEEKLY))
    expect(document.querySelector('[data-unrested-chips]')).toBeNull()
  })
})

// ─── OCCASIONAL_UNRESTED band ─────────────────────────────────────────────

describe('HardWeekUnrestedCard — OCCASIONAL_UNRESTED band', () => {
  it('renders the OCCASIONAL band attr + label', () => {
    renderCard(logFromWeeklyTss(OCCASIONAL_WEEKLY))
    const card = document.querySelector('[data-card="hard-week-unrested"]')
    expect(card.getAttribute('data-band')).toBe('OCCASIONAL_UNRESTED')
    expect(card.getAttribute('data-unrested-count')).toBe('1')
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('OCCASIONAL')
  })

  it('renders exactly one unrested chip', () => {
    renderCard(logFromWeeklyTss(OCCASIONAL_WEEKLY))
    const chips = document.querySelectorAll('[data-unrested-chip]')
    expect(chips.length).toBe(1)
    // Chip text should reference the spike percentage and "no deload after".
    expect(chips[0].textContent).toMatch(/\+\d+(\.\d)?%/)
    expect(chips[0].textContent).toMatch(/no deload after/i)
  })
})

// ─── REPEATED_UNRESTED band ───────────────────────────────────────────────

describe('HardWeekUnrestedCard — REPEATED_UNRESTED band', () => {
  it('renders the REPEATED band attr + label', () => {
    renderCard(logFromWeeklyTss(REPEATED_WEEKLY))
    const card = document.querySelector('[data-card="hard-week-unrested"]')
    expect(card.getAttribute('data-band')).toBe('REPEATED_UNRESTED')
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('REPEATED')
  })

  it('renders at most 3 unrested chips', () => {
    renderCard(logFromWeeklyTss(REPEATED_WEEKLY))
    const chips = document.querySelectorAll('[data-unrested-chip]')
    expect(chips.length).toBeLessThanOrEqual(3)
    expect(chips.length).toBeGreaterThanOrEqual(1)
  })
})

// ─── CHRONIC_UNRESTED band ────────────────────────────────────────────────

describe('HardWeekUnrestedCard — CHRONIC_UNRESTED band', () => {
  it('renders the CHRONIC band attr + label', () => {
    renderCard(logFromWeeklyTss(CHRONIC_WEEKLY))
    const card = document.querySelector('[data-card="hard-week-unrested"]')
    expect(card.getAttribute('data-band')).toBe('CHRONIC_UNRESTED')
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('CHRONIC')
  })

  it('renders at most 3 chips even when many unrested events exist', () => {
    renderCard(logFromWeeklyTss(CHRONIC_WEEKLY))
    const chips = document.querySelectorAll('[data-unrested-chip]')
    expect(chips.length).toBeLessThanOrEqual(3)
  })
})

// ─── 16-bar timeline ─────────────────────────────────────────────────────

describe('HardWeekUnrestedCard — 16-bar timeline', () => {
  it('renders 16 mini bars on a CLEAN state', () => {
    renderCard(logFromWeeklyTss(CLEAN_WEEKLY))
    const bars = document.querySelectorAll('[data-mini-bar]')
    expect(bars.length).toBe(16)
  })

  it('marks the spiked week as "unrested" in the timeline', () => {
    renderCard(logFromWeeklyTss(OCCASIONAL_WEEKLY))
    const unrestedBars = document.querySelectorAll('[data-mini-bar="unrested"]')
    expect(unrestedBars.length).toBeGreaterThanOrEqual(1)
  })
})

// ─── bilingual (TR) ──────────────────────────────────────────────────────

describe('HardWeekUnrestedCard — Turkish', () => {
  it('renders the TR heading and band label when lang=tr', () => {
    renderCard(logFromWeeklyTss(OCCASIONAL_WEEKLY), 'tr')
    const region = screen.getByRole('region', {
      name: /Dinlenmemiş sert haftalar/i,
    })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/DİNLENMEMİŞ SERT HAFTALAR/)
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('ARA SIRA')
  })

  it('renders TR chip text', () => {
    renderCard(logFromWeeklyTss(OCCASIONAL_WEEKLY), 'tr')
    const chip = document.querySelector('[data-unrested-chip]')
    expect(chip).not.toBeNull()
    expect(chip.textContent).toMatch(/sonrası boşaltma yok/i)
  })

  it('renders the TR CLEAN hint', () => {
    renderCard(logFromWeeklyTss(CLEAN_WEEKLY), 'tr')
    const hint = document.querySelector('[data-band-hint]')
    expect(hint.textContent).toMatch(/Dinlenmemiş aşırı yüklenme olayı yok/i)
  })

  it('renders TR CHRONIC band label', () => {
    renderCard(logFromWeeklyTss(CHRONIC_WEEKLY), 'tr')
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('KRONİK')
  })
})

// ─── citation ─────────────────────────────────────────────────────────────

describe('HardWeekUnrestedCard — citation', () => {
  it('renders the citation footer', () => {
    renderCard(logFromWeeklyTss(OCCASIONAL_WEEKLY))
    const cite = document.querySelector('[data-hard-week-citation]')
    expect(cite).not.toBeNull()
    expect(cite.textContent).toBe('Foster 2001; Halson 2014; Bompa 2018')
  })

  it('renders the citation in CLEAN state too', () => {
    renderCard(logFromWeeklyTss(CLEAN_WEEKLY))
    const cite = document.querySelector('[data-hard-week-citation]')
    expect(cite.textContent).toBe('Foster 2001; Halson 2014; Bompa 2018')
  })
})

// ─── accessibility ────────────────────────────────────────────────────────

describe('HardWeekUnrestedCard — accessibility', () => {
  it('uses role=region with a bilingual aria-label (EN)', () => {
    renderCard(logFromWeeklyTss(OCCASIONAL_WEEKLY))
    const region = document.querySelector('[role="region"][data-card="hard-week-unrested"]')
    expect(region).not.toBeNull()
    expect(region.getAttribute('aria-label')).toMatch(/Unrested hard weeks/i)
  })

  it('uses role=region with a bilingual aria-label (TR)', () => {
    renderCard(logFromWeeklyTss(OCCASIONAL_WEEKLY), 'tr')
    const region = document.querySelector('[role="region"][data-card="hard-week-unrested"]')
    expect(region.getAttribute('aria-label')).toMatch(/Dinlenmemiş sert haftalar/i)
  })
})

// ─── data attributes ──────────────────────────────────────────────────────

describe('HardWeekUnrestedCard — data attributes', () => {
  it('exposes data-total-hard-weeks, data-unrested-count, data-unrested-rate', () => {
    renderCard(logFromWeeklyTss(OCCASIONAL_WEEKLY))
    const card = document.querySelector('[data-card="hard-week-unrested"]')
    expect(card.getAttribute('data-total-hard-weeks')).toBe('1')
    expect(card.getAttribute('data-unrested-count')).toBe('1')
    expect(Number(card.getAttribute('data-unrested-rate'))).toBeCloseTo(1, 4)
  })
})

// ─── console hygiene ──────────────────────────────────────────────────────

describe('HardWeekUnrestedCard — console hygiene', () => {
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
