// @vitest-environment jsdom
// ─── LongRunConsistencyCard.test.jsx — Dashboard surface tests ───────────────
//
// Covers: null gate (< 3 long-run weeks), INSUFFICIENT band (3-5 long-run
// weeks), each of STEADY / PROGRESSIVE / EROSIVE / CHAOTIC, bilingual
// (EN + TR), citation, accessibility (role=region + aria-label),
// per-bar data anchors, data-card attribute.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import LongRunConsistencyCard from '../dashboard/LongRunConsistencyCard.jsx'

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
      <LongRunConsistencyCard log={log} />
    </LangCtx.Provider>
  )
}

// Place one long run on Saturday of each ISO week, using `durations[i]`
// (0 / null → skip that week).
function buildLog(durations) {
  const log = []
  for (let i = 0; i < WEEK_MONDAYS.length; i++) {
    const dur = durations[i]
    if (!dur || dur <= 0) continue
    const mon = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
    mon.setUTCDate(mon.getUTCDate() + 5) // Saturday
    log.push({
      date: mon.toISOString().slice(0, 10),
      durationMin: dur,
      type: 'long run',
    })
  }
  return log
}

// ─── null gate ─────────────────────────────────────────────────────────────

describe('LongRunConsistencyCard — null gate', () => {
  it('renders null on empty log', () => {
    const { container } = renderCard([])
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-card="long-run-consistency"]')).toBeNull()
  })

  it('renders null on null log', () => {
    const { container } = renderCard(null)
    expect(container.firstChild).toBeNull()
  })

  it('renders null when fewer than 3 long-run weeks', () => {
    const { container } = renderCard(
      buildLog([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100, 110])
    )
    expect(container.firstChild).toBeNull()
  })
})

// ─── INSUFFICIENT band (3-5 long-run weeks) ─────────────────────────────────

describe('LongRunConsistencyCard — INSUFFICIENT band', () => {
  it('renders INSUFFICIENT band with muted accent + log-more hint', () => {
    renderCard(buildLog([0, 0, 0, 0, 0, 0, 0, 0, 0, 100, 110, 120]))
    const card = document.querySelector('[data-card="long-run-consistency"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT')
    expect(card.getAttribute('data-long-run-count')).toBe('3')
    expect(card.textContent).toMatch(/INSUFFICIENT/)
    expect(card.textContent).toMatch(/Log more long runs/i)
  })
})

// ─── STEADY band ───────────────────────────────────────────────────────────

describe('LongRunConsistencyCard — STEADY band', () => {
  it('renders STEADY band with cv≈0 when durations are identical', () => {
    renderCard(buildLog([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]))
    const card = document.querySelector('[data-card="long-run-consistency"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('STEADY')
    expect(card.getAttribute('data-cv')).toBe('0')
    expect(card.getAttribute('data-mean-min')).toBe('100')
    expect(card.getAttribute('data-long-run-count')).toBe('12')
    expect(card.textContent).toMatch(/STEADY/)
    expect(card.textContent).toMatch(/Reliable aerobic stimulus/i)
  })
})

// ─── PROGRESSIVE band ──────────────────────────────────────────────────────

describe('LongRunConsistencyCard — PROGRESSIVE band', () => {
  it('renders PROGRESSIVE when durations climb across the window', () => {
    renderCard(buildLog([60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170]))
    const card = document.querySelector('[data-card="long-run-consistency"]')
    expect(card.getAttribute('data-band')).toBe('PROGRESSIVE')
    expect(Number(card.getAttribute('data-trend-slope-pct-per-week'))).toBeGreaterThan(0.03)
    expect(card.textContent).toMatch(/PROGRESSIVE/)
    expect(card.textContent).toMatch(/Classic build-phase pattern/i)
  })
})

// ─── EROSIVE band ──────────────────────────────────────────────────────────

describe('LongRunConsistencyCard — EROSIVE band', () => {
  it('renders EROSIVE when durations fall across the window', () => {
    renderCard(buildLog([170, 160, 150, 140, 130, 120, 110, 100, 90, 80, 70, 60]))
    const card = document.querySelector('[data-card="long-run-consistency"]')
    expect(card.getAttribute('data-band')).toBe('EROSIVE')
    expect(Number(card.getAttribute('data-trend-slope-pct-per-week'))).toBeLessThan(-0.03)
    expect(card.textContent).toMatch(/EROSIVE/)
    expect(card.textContent).toMatch(/shrinking week over week/i)
  })
})

// ─── CHAOTIC band ──────────────────────────────────────────────────────────

describe('LongRunConsistencyCard — CHAOTIC band', () => {
  it('renders CHAOTIC when durations swing without clear trend', () => {
    renderCard(buildLog([90, 180, 90, 180, 90, 180, 90, 180, 90, 180, 90, 180]))
    const card = document.querySelector('[data-card="long-run-consistency"]')
    expect(card.getAttribute('data-band')).toBe('CHAOTIC')
    expect(card.textContent).toMatch(/CHAOTIC/)
    expect(card.textContent).toMatch(/swing wildly/i)
  })
})

// ─── per-bar data anchors ──────────────────────────────────────────────────

describe('LongRunConsistencyCard — per-bar data anchors', () => {
  it('renders 12 week bars Monday oldest-first with data anchors', () => {
    renderCard(buildLog([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]))
    const bars = document.querySelectorAll('[data-week-bar]')
    expect(bars.length).toBe(12)
    const weekStarts = Array.from(bars).map(b => b.getAttribute('data-week-start'))
    expect(weekStarts).toEqual(WEEK_MONDAYS)
    for (const bar of bars) {
      expect(bar.getAttribute('data-week-min')).toBe('100')
    }
  })

  it('exposes per-bar longest-run minutes when weeks differ', () => {
    renderCard(buildLog([0, 0, 0, 0, 0, 0, 100, 110, 120, 130, 140, 150]))
    const bars = document.querySelectorAll('[data-week-bar]')
    const byWeek = Object.fromEntries(
      Array.from(bars).map(b => [
        b.getAttribute('data-week-start'),
        b.getAttribute('data-week-min'),
      ])
    )
    expect(byWeek['2026-04-06']).toBe('100')
    expect(byWeek['2026-04-13']).toBe('110')
    expect(byWeek['2026-04-20']).toBe('120')
    expect(byWeek['2026-04-27']).toBe('130')
    expect(byWeek['2026-05-04']).toBe('140')
    expect(byWeek['2026-05-11']).toBe('150')
    expect(byWeek['2026-02-23']).toBe('0')
  })
})

// ─── citation footer ───────────────────────────────────────────────────────

describe('LongRunConsistencyCard — citation', () => {
  it('renders the Daniels 2014 / Pfitzinger 2014 citation footer', () => {
    renderCard(buildLog([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]))
    const card = document.querySelector('[data-card="long-run-consistency"]')
    expect(card.textContent).toMatch(/Daniels 2014/)
    expect(card.textContent).toMatch(/Pfitzinger 2014/)
  })
})

// ─── accessibility ─────────────────────────────────────────────────────────

describe('LongRunConsistencyCard — accessibility', () => {
  it('exposes role=region with bilingual aria-label (EN)', () => {
    renderCard(buildLog([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]), 'en')
    const region = screen.getByRole('region', { name: /Long-run duration consistency/i })
    expect(region).toBeInTheDocument()
  })

  it('exposes role=region with bilingual aria-label (TR)', () => {
    renderCard(buildLog([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]), 'tr')
    const region = screen.getByRole('region', { name: /Uzun koşu süresi tutarlılık kartı/i })
    expect(region).toBeInTheDocument()
  })
})

// ─── bilingual (Turkish) ───────────────────────────────────────────────────

describe('LongRunConsistencyCard — bilingual (Turkish)', () => {
  it('renders Turkish heading, band label, and hint for STEADY', () => {
    renderCard(buildLog([100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100]), 'tr')
    const card = document.querySelector('[data-card="long-run-consistency"]')
    expect(card.textContent).toMatch(/UZUN KOŞU TUTARLILIĞI · 12H/)
    expect(card.textContent).toMatch(/TUTARLI/)
    expect(card.textContent).toMatch(/haftadan haftaya kararlı/i)
  })

  it('renders Turkish label + hint for PROGRESSIVE', () => {
    renderCard(buildLog([60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170]), 'tr')
    const card = document.querySelector('[data-card="long-run-consistency"]')
    expect(card.getAttribute('data-band')).toBe('PROGRESSIVE')
    expect(card.textContent).toMatch(/İLERLEYEN/)
    expect(card.textContent).toMatch(/inşa-fazı paterni/i)
  })

  it('renders Turkish label + hint for EROSIVE', () => {
    renderCard(buildLog([170, 160, 150, 140, 130, 120, 110, 100, 90, 80, 70, 60]), 'tr')
    const card = document.querySelector('[data-card="long-run-consistency"]')
    expect(card.getAttribute('data-band')).toBe('EROSIVE')
    expect(card.textContent).toMatch(/ERİYEN/)
    expect(card.textContent).toMatch(/her hafta kısalıyor/i)
  })

  it('renders Turkish label + hint for CHAOTIC', () => {
    renderCard(buildLog([90, 180, 90, 180, 90, 180, 90, 180, 90, 180, 90, 180]), 'tr')
    const card = document.querySelector('[data-card="long-run-consistency"]')
    expect(card.getAttribute('data-band')).toBe('CHAOTIC')
    expect(card.textContent).toMatch(/KAOTİK/)
    expect(card.textContent).toMatch(/net trend olmadan savruluyor/i)
  })

  it('renders Turkish label + hint for INSUFFICIENT', () => {
    renderCard(buildLog([0, 0, 0, 0, 0, 0, 0, 0, 0, 100, 110, 120]), 'tr')
    const card = document.querySelector('[data-card="long-run-consistency"]')
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT')
    expect(card.textContent).toMatch(/YETERSİZ/)
    expect(card.textContent).toMatch(/yeterli uzun koşu yok/i)
  })
})
