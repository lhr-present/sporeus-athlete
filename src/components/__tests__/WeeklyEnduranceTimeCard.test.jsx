// @vitest-environment jsdom
// ─── WeeklyEnduranceTimeCard.test.jsx — Dashboard surface tests ──────────────
//
// Covers: null gate, each of BELOW_AMATEUR / AMATEUR_BAND / INTERMEDIATE_BAND
// / ADVANCED_BAND, bilingual (EN + TR), citation footer, accessibility
// (role=region + aria-label), per-bar data anchors.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import WeeklyEnduranceTimeCard from '../dashboard/WeeklyEnduranceTimeCard.jsx'

// Wednesday — mondayOf('2026-05-13') = '2026-05-11'.
// 12 ISO weeks ending in week containing today:
//   Mondays 2026-02-23 .. 2026-05-11.
const TODAY = '2026-05-13'

const WEEK_MONDAYS = [
  '2026-02-23', '2026-03-02', '2026-03-09', '2026-03-16',
  '2026-03-23', '2026-03-30', '2026-04-06', '2026-04-13',
  '2026-04-20', '2026-04-27', '2026-05-04', '2026-05-11',
]

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <WeeklyEnduranceTimeCard log={log} />
    </LangCtx.Provider>
  )
}

// Place a single Z1 easy session on the Saturday of each week with the given
// weekly easy minutes. 0/null skips the week.
function easyLog(durations) {
  const log = []
  for (let i = 0; i < WEEK_MONDAYS.length; i++) {
    const dur = durations[i]
    if (!dur || dur <= 0) continue
    const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
    mon.setUTCDate(mon.getUTCDate() + 5)
    log.push({
      date: mon.toISOString().slice(0, 10),
      durationMin: dur,
      zone: 'Z1',
    })
  }
  return log
}

// ─── null gate ─────────────────────────────────────────────────────────────

describe('WeeklyEnduranceTimeCard — null gate', () => {
  it('renders null on empty log', () => {
    const { container } = renderCard([])
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-card="weekly-endurance-time"]')).toBeNull()
  })

  it('renders null on null log', () => {
    const { container } = renderCard(null)
    expect(container.firstChild).toBeNull()
  })

  it('renders null when fewer than 6 weeks have classifiable load', () => {
    const { container } = renderCard(
      easyLog([0, 0, 0, 0, 0, 0, 0, 100, 100, 100, 100, 100])
    )
    expect(container.firstChild).toBeNull()
  })
})

// ─── BELOW_AMATEUR band ────────────────────────────────────────────────────

describe('WeeklyEnduranceTimeCard — BELOW_AMATEUR band', () => {
  it('renders BELOW_AMATEUR when mean easy < 180 min/wk', () => {
    renderCard(easyLog([90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90, 90]))
    const card = document.querySelector('[data-card="weekly-endurance-time"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('BELOW_AMATEUR')
    expect(card.getAttribute('data-mean-easy-min')).toBe('90')
    expect(card.textContent).toMatch(/BELOW AMATEUR/)
    expect(card.textContent).toMatch(/Build easy volume first/i)
  })
})

// ─── AMATEUR_BAND ──────────────────────────────────────────────────────────

describe('WeeklyEnduranceTimeCard — AMATEUR_BAND', () => {
  it('renders AMATEUR_BAND for 240 min/wk mean easy', () => {
    renderCard(easyLog([240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240]))
    const card = document.querySelector('[data-card="weekly-endurance-time"]')
    expect(card.getAttribute('data-band')).toBe('AMATEUR_BAND')
    expect(card.getAttribute('data-mean-easy-min')).toBe('240')
    expect(card.textContent).toMatch(/AMATEUR/)
    expect(card.textContent).toMatch(/amateur base zone/i)
  })
})

// ─── INTERMEDIATE_BAND ─────────────────────────────────────────────────────

describe('WeeklyEnduranceTimeCard — INTERMEDIATE_BAND', () => {
  it('renders INTERMEDIATE_BAND for 480 min/wk mean easy', () => {
    renderCard(easyLog([480, 480, 480, 480, 480, 480, 480, 480, 480, 480, 480, 480]))
    const card = document.querySelector('[data-card="weekly-endurance-time"]')
    expect(card.getAttribute('data-band')).toBe('INTERMEDIATE_BAND')
    expect(card.textContent).toMatch(/INTERMEDIATE/)
    expect(card.textContent).toMatch(/intermediate aerobic-base zone/i)
  })
})

// ─── ADVANCED_BAND ─────────────────────────────────────────────────────────

describe('WeeklyEnduranceTimeCard — ADVANCED_BAND', () => {
  it('renders ADVANCED_BAND for 720 min/wk mean easy', () => {
    renderCard(easyLog([720, 720, 720, 720, 720, 720, 720, 720, 720, 720, 720, 720]))
    const card = document.querySelector('[data-card="weekly-endurance-time"]')
    expect(card.getAttribute('data-band')).toBe('ADVANCED_BAND')
    expect(card.textContent).toMatch(/ADVANCED/)
    expect(card.textContent).toMatch(/advanced aerobic-base zone/i)
  })
})

// ─── per-bar data anchors ──────────────────────────────────────────────────

describe('WeeklyEnduranceTimeCard — per-bar data anchors', () => {
  it('renders 12 week bars Monday oldest-first with data anchors', () => {
    renderCard(easyLog([240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240]))
    const bars = document.querySelectorAll('[data-week-bar]')
    expect(bars.length).toBe(12)
    const weekStarts = Array.from(bars).map(b => b.getAttribute('data-week-start'))
    expect(weekStarts).toEqual(WEEK_MONDAYS)
    for (const bar of bars) {
      expect(bar.getAttribute('data-week-easy-min')).toBe('240')
      expect(bar.getAttribute('data-week-total-min')).toBe('240')
    }
  })
})

// ─── citation footer ──────────────────────────────────────────────────────

describe('WeeklyEnduranceTimeCard — citation', () => {
  it('renders the Maffetone / Seiler / Stöggl citation footer', () => {
    renderCard(easyLog([240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240]))
    const card = document.querySelector('[data-card="weekly-endurance-time"]')
    expect(card.textContent).toMatch(/Maffetone 2010/)
    expect(card.textContent).toMatch(/Seiler 2010/)
    expect(card.textContent).toMatch(/Stöggl 2014/)
  })
})

// ─── accessibility ────────────────────────────────────────────────────────

describe('WeeklyEnduranceTimeCard — accessibility', () => {
  it('exposes role=region with bilingual aria-label (EN)', () => {
    renderCard(easyLog([240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240]), 'en')
    const region = screen.getByRole('region', { name: /Weekly aerobic hours card/i })
    expect(region).toBeInTheDocument()
  })

  it('exposes role=region with bilingual aria-label (TR)', () => {
    renderCard(easyLog([240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240]), 'tr')
    const region = screen.getByRole('region', { name: /Haftalık aerobik saatler kartı/i })
    expect(region).toBeInTheDocument()
  })
})

// ─── bilingual (Turkish) ──────────────────────────────────────────────────

describe('WeeklyEnduranceTimeCard — bilingual (Turkish)', () => {
  it('renders Turkish heading + AMATEUR label + Turkish hint', () => {
    renderCard(easyLog([240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240, 240]), 'tr')
    const card = document.querySelector('[data-card="weekly-endurance-time"]')
    expect(card.textContent).toMatch(/HAFTALIK AEROBİK SAATLER · 12H/)
    expect(card.textContent).toMatch(/AMATÖR/)
    expect(card.textContent).toMatch(/Amatör temel bandındasın/i)
  })

  it('renders Turkish label + hint for ADVANCED_BAND', () => {
    renderCard(easyLog([720, 720, 720, 720, 720, 720, 720, 720, 720, 720, 720, 720]), 'tr')
    const card = document.querySelector('[data-card="weekly-endurance-time"]')
    expect(card.getAttribute('data-band')).toBe('ADVANCED_BAND')
    expect(card.textContent).toMatch(/İLERİ/)
    expect(card.textContent).toMatch(/İleri aerobik-temel bandındasın/i)
  })
})
