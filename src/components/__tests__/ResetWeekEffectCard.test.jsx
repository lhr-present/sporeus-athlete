// @vitest-environment jsdom
// ─── ResetWeekEffectCard.test.jsx ─────────────────────────────────────────
//
// Surface tests: render-null guard, NO_DELOAD_FOUND state, each bounce
// band (STRONG / MODEST / NO_BOUNCE), EN + TR bilingual via LangCtx
// Provider, citation footer, accessibility (role=region + aria-label),
// console hygiene.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import ResetWeekEffectCard from '../dashboard/ResetWeekEffectCard.jsx'

const TODAY = '2026-05-20' // Wed → ISO Monday = 2026-05-18

// Mondays for the 13-week window ending at TODAY, oldest first.
const WEEK_MONDAYS = [
  '2026-02-23', '2026-03-02', '2026-03-09', '2026-03-16',
  '2026-03-23', '2026-03-30', '2026-04-06', '2026-04-13',
  '2026-04-20', '2026-04-27', '2026-05-04', '2026-05-11',
  '2026-05-18',
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

function buildLog(weekly) {
  const out = []
  for (let i = 0; i < weekly.length; i++) {
    if (weekly[i] > 0) out.push(sessionInWeek(i, weekly[i]))
  }
  return out
}

function renderCard(log, lang = 'en') {
  const value = { t: (k) => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <ResetWeekEffectCard log={log} />
    </LangCtx.Provider>,
  )
}

const STRONG_BOUNCE_WEEKLY = [
  100, 100, 100, 200, 220, 240,
  200, 220, 240, 100, 260, 280, 0,
]
// Deload at idx 9, pre mean 220, post mean 270 → bounce 0.227 → STRONG.

const MODEST_BOUNCE_WEEKLY = [
  200, 200, 200, 200, 200, 200,
  200, 200, 200, 100, 205, 210, 0,
]
// pre 200, post 207.5 → bounce 0.0375 → MODEST.

const NO_BOUNCE_WEEKLY = [
  200, 200, 200, 200, 200, 200,
  200, 200, 200, 100, 150, 150, 0,
]
// pre 200, post 150 → bounce -0.25 → NO_BOUNCE.

const NO_DELOAD_WEEKLY = [
  200, 200, 200, 200, 200, 200,
  200, 200, 200, 200, 200, 200, 200,
]
// Flat → NO_DELOAD_FOUND.

// ─── guards ───────────────────────────────────────────────────────────────

describe('ResetWeekEffectCard — guards', () => {
  it('renders the NO_DELOAD_FOUND state even for an empty log', () => {
    renderCard([])
    const card = document.querySelector('[data-card="reset-week-effect"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('NO_DELOAD_FOUND')
  })

  it('renders the NO_DELOAD_FOUND state for a null log', () => {
    renderCard(null)
    const card = document.querySelector('[data-card="reset-week-effect"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('NO_DELOAD_FOUND')
  })
})

// ─── NO_DELOAD_FOUND ──────────────────────────────────────────────────────

describe('ResetWeekEffectCard — NO_DELOAD_FOUND state', () => {
  it('renders the no-deload hint message (EN)', () => {
    renderCard(buildLog(NO_DELOAD_WEEKLY))
    const card = document.querySelector('[data-card="reset-week-effect"]')
    expect(card.getAttribute('data-band')).toBe('NO_DELOAD_FOUND')
    const state = document.querySelector('[data-no-deload-state]')
    expect(state).not.toBeNull()
    expect(state.textContent).toMatch(/No deload week in the last 13 weeks/i)
  })

  it('renders the no-deload hint message (TR)', () => {
    renderCard(buildLog(NO_DELOAD_WEEKLY), 'tr')
    const state = document.querySelector('[data-no-deload-state]')
    expect(state.textContent).toMatch(/Son 13 haftada boşaltma haftası yok/i)
  })

  it('does NOT render the three-bar chart in NO_DELOAD_FOUND state', () => {
    renderCard(buildLog(NO_DELOAD_WEEKLY))
    expect(document.querySelector('[data-mini-chart="reset-week-effect"]'))
      .toBeNull()
  })
})

// ─── STRONG_BOUNCE ────────────────────────────────────────────────────────

describe('ResetWeekEffectCard — STRONG_BOUNCE', () => {
  it('renders the card region with the EN heading', () => {
    renderCard(buildLog(STRONG_BOUNCE_WEEKLY))
    const region = screen.getByRole('region', {
      name: /Reset week effect: post-deload supercompensation check/i,
    })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/RESET WEEK EFFECT/)
  })

  it('exposes the band on data-band', () => {
    renderCard(buildLog(STRONG_BOUNCE_WEEKLY))
    const card = document.querySelector('[data-card="reset-week-effect"]')
    expect(card.getAttribute('data-band')).toBe('STRONG_BOUNCE')
  })

  it('renders the three-bar mini chart', () => {
    renderCard(buildLog(STRONG_BOUNCE_WEEKLY))
    expect(document.querySelector('[data-mini-chart="reset-week-effect"]'))
      .not.toBeNull()
    expect(document.querySelector('[data-three-bar="pre"]')).not.toBeNull()
    expect(document.querySelector('[data-three-bar="deload"]')).not.toBeNull()
    expect(document.querySelector('[data-three-bar="post"]')).not.toBeNull()
  })

  it('shows the bounce % with a + sign', () => {
    renderCard(buildLog(STRONG_BOUNCE_WEEKLY))
    const display = document.querySelector('[data-bounce-display]')
    expect(display).not.toBeNull()
    expect(display.textContent).toMatch(/^\+\d+(\.\d)?%$/)
  })

  it('exposes pre/post/deload TSS via data attributes', () => {
    renderCard(buildLog(STRONG_BOUNCE_WEEKLY))
    const card = document.querySelector('[data-card="reset-week-effect"]')
    expect(card.getAttribute('data-pre-mean-tss')).toBe('220')
    expect(card.getAttribute('data-post-mean-tss')).toBe('270')
    expect(card.getAttribute('data-deload-week-tss')).toBe('100')
    expect(card.getAttribute('data-deload-week-start')).toBe(WEEK_MONDAYS[9])
    expect(card.getAttribute('data-weeks-after-deload-available')).toBe('2')
  })

  it('shows the STRONG BOUNCE band label (EN)', () => {
    renderCard(buildLog(STRONG_BOUNCE_WEEKLY))
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('STRONG BOUNCE')
  })
})

// ─── MODEST_BOUNCE / NO_BOUNCE ────────────────────────────────────────────

describe('ResetWeekEffectCard — other bounce bands', () => {
  it('renders MODEST BOUNCE label and band attr', () => {
    renderCard(buildLog(MODEST_BOUNCE_WEEKLY))
    const card = document.querySelector('[data-card="reset-week-effect"]')
    expect(card.getAttribute('data-band')).toBe('MODEST_BOUNCE')
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('MODEST BOUNCE')
  })

  it('renders NO BOUNCE label and band attr', () => {
    renderCard(buildLog(NO_BOUNCE_WEEKLY))
    const card = document.querySelector('[data-card="reset-week-effect"]')
    expect(card.getAttribute('data-band')).toBe('NO_BOUNCE')
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('NO BOUNCE')
  })

  it('shows the bounce % with a − sign for negative bounce', () => {
    renderCard(buildLog(NO_BOUNCE_WEEKLY))
    const display = document.querySelector('[data-bounce-display]')
    // bounce = -0.25 → -25.0% (1 decimal place, "-25%" format).
    expect(display.textContent).toMatch(/^-\d+(\.\d)?%$/)
  })
})

// ─── Turkish ──────────────────────────────────────────────────────────────

describe('ResetWeekEffectCard — Turkish', () => {
  it('renders the TR heading and band label when lang=tr', () => {
    renderCard(buildLog(STRONG_BOUNCE_WEEKLY), 'tr')
    const region = screen.getByRole('region', {
      name: /Yenileme haftası etkisi: son boşaltma sonrası süperkompansasyon kontrolü/i,
    })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/YENİLEME HAFTASI ETKİSİ/)
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('GÜÇLÜ SIÇRAMA')
  })

  it('renders the TR NO_BOUNCE label', () => {
    renderCard(buildLog(NO_BOUNCE_WEEKLY), 'tr')
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('SIÇRAMA YOK')
  })

  it('renders the TR MODEST_BOUNCE label and hint', () => {
    renderCard(buildLog(MODEST_BOUNCE_WEEKLY), 'tr')
    const badge = document.querySelector('[data-band-label]')
    expect(badge.textContent).toBe('HAFİF SIÇRAMA')
    const hint = document.querySelector('[data-band-hint]')
    expect(hint.textContent).toMatch(/Küçük bir sıçrama/)
  })

  it('renders Turkish pre / post / deload labels', () => {
    renderCard(buildLog(STRONG_BOUNCE_WEEKLY), 'tr')
    const card = document.querySelector('[data-card="reset-week-effect"]')
    expect(card.textContent).toMatch(/Boşaltma haftası/)
    expect(card.textContent).toMatch(/3-hafta öncesi ortalama/)
    expect(card.textContent).toMatch(/2-hafta sonrası ortalama/)
  })
})

// ─── citation ─────────────────────────────────────────────────────────────

describe('ResetWeekEffectCard — citation', () => {
  it('renders the citation footer', () => {
    renderCard(buildLog(STRONG_BOUNCE_WEEKLY))
    const cite = document.querySelector('[data-reset-week-citation]')
    expect(cite).not.toBeNull()
    expect(cite.textContent).toBe('Bompa 2018; Issurin 2010')
  })

  it('renders the citation in the NO_DELOAD_FOUND state', () => {
    renderCard(buildLog(NO_DELOAD_WEEKLY))
    const cite = document.querySelector('[data-reset-week-citation]')
    expect(cite.textContent).toBe('Bompa 2018; Issurin 2010')
  })
})

// ─── accessibility ────────────────────────────────────────────────────────

describe('ResetWeekEffectCard — accessibility', () => {
  it('uses role=region with a bilingual aria-label (EN)', () => {
    renderCard(buildLog(STRONG_BOUNCE_WEEKLY))
    const region = document.querySelector('[role="region"][data-card="reset-week-effect"]')
    expect(region).not.toBeNull()
    expect(region.getAttribute('aria-label')).toMatch(/Reset week effect/i)
  })

  it('uses role=region with a bilingual aria-label (TR)', () => {
    renderCard(buildLog(STRONG_BOUNCE_WEEKLY), 'tr')
    const region = document.querySelector('[role="region"][data-card="reset-week-effect"]')
    expect(region.getAttribute('aria-label')).toMatch(/Yenileme haftası/i)
  })
})

// ─── console hygiene ──────────────────────────────────────────────────────

describe('ResetWeekEffectCard — console hygiene', () => {
  it('renders without console warnings or errors', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderCard(buildLog(STRONG_BOUNCE_WEEKLY))
    expect(warnSpy).not.toHaveBeenCalled()
    expect(errSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
    errSpy.mockRestore()
  })
})
