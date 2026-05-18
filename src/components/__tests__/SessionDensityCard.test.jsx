// @vitest-environment jsdom
// ─── SessionDensityCard.test.jsx — render tests for the session-density card ──
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import SessionDensityCard from '../dashboard/SessionDensityCard.jsx'

// Reference date — pinned so the trailing 28-day window is deterministic.
const TODAY = '2026-05-18'

// ─── Render helper ───────────────────────────────────────────────────────────
function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <SessionDensityCard {...props} />
    </LangCtx.Provider>
  )
}

// ─── Date / log helpers ──────────────────────────────────────────────────────
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const session = (date, extras = {}) => ({ date, type: 'run', duration: 60, rpe: 5, ...extras })

/** SINGLE_FOCUSED: 20 unique days, 1 session each → density 1.00 */
function singleLog() {
  const log = []
  for (let i = 0; i < 20; i++) log.push(session(addDays(TODAY, -i)))
  return log
}

/** MIXED_DENSITY: 20 days, 5 doubles → 25/20 = 1.25 */
function mixedLog() {
  const log = []
  for (let i = 0; i < 20; i++) log.push(session(addDays(TODAY, -i)))
  for (let i = 0; i < 5; i++) log.push(session(addDays(TODAY, -i), { type: 'bike' }))
  return log
}

/** DOUBLE_HEAVY: 14 days, every day doubled → 28/14 = 2.00 */
function doubleLog() {
  const log = []
  for (let i = 0; i < 14; i++) {
    log.push(session(addDays(TODAY, -i)))
    log.push(session(addDays(TODAY, -i), { type: 'bike' }))
  }
  return log
}

// ─── Pin system time so the card's default-today matches our fixtures ────────
// Use Date.now spy instead of fake timers — fake timers interact badly with
// @testing-library/react's afterEach cleanup, which awaits microtasks.
let nowSpy
beforeEach(() => {
  const fixedMs = new Date(`${TODAY}T12:00:00Z`).getTime()
  nowSpy = vi.spyOn(Date, 'now').mockReturnValue(fixedMs)
  // Also patch Date constructor to return fixed-time when called with no args
  const RealDate = Date
  vi.stubGlobal('Date', class extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(fixedMs)
      else super(...args)
    }
    static now() { return fixedMs }
  })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  if (nowSpy) nowSpy.mockRestore()
})

// ─── Render-null states ─────────────────────────────────────────────────────
describe('SessionDensityCard — renders null on insufficient data', () => {
  it('returns nothing for empty log', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
  })

  it('returns nothing for missing log prop (default [])', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })

  it('returns nothing when fewer than 5 active days', () => {
    const log = []
    for (let i = 0; i < 4; i++) log.push(session(addDays(TODAY, -i)))
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })
})

// ─── SINGLE_FOCUSED rendering ───────────────────────────────────────────────
describe('SessionDensityCard — SINGLE_FOCUSED', () => {
  it('renders title, density 1.00, SINGLE badge, blue accent, citation', () => {
    const { container } = renderCard({ log: singleLog() })

    // Title
    expect(screen.getByText(/SESSION DENSITY · 28D/)).toBeInTheDocument()
    // Density value (2dp)
    expect(screen.getByText('1.00')).toBeInTheDocument()
    // Band badge
    expect(screen.getByText('SINGLE')).toBeInTheDocument()
    // Sessions / days breakdown
    expect(screen.getByText(/20 sessions · 20 days/)).toBeInTheDocument()
    // Double-day stats (0 doubles, 0%)
    expect(screen.getByText(/0 double days \(0%\)/)).toBeInTheDocument()
    // Citation footer
    expect(screen.getByText(/Bompa 2018; Mujika 2014/)).toBeInTheDocument()
    // Blue accent on border-left
    const region = container.querySelector('[role="region"]')
    expect(region.getAttribute('style'))
      .toMatch(/border-left:\s*3px\s+solid\s+(?:#0064ff|rgb\(0,\s*100,\s*255\))/i)
  })

  it('exposes data-* anchors for SINGLE_FOCUSED', () => {
    const { container } = renderCard({ log: singleLog() })
    const region = container.querySelector('[data-session-density-card]')
    expect(region).not.toBeNull()
    expect(region.getAttribute('data-density-band')).toBe('SINGLE_FOCUSED')
    expect(Number(region.getAttribute('data-density'))).toBeCloseTo(1.0, 4)
    expect(region.getAttribute('data-active-days')).toBe('20')
    expect(region.getAttribute('data-double-days')).toBe('0')
    expect(Number(region.getAttribute('data-double-rate'))).toBeCloseTo(0, 4)
  })

  it('shows the SINGLE_FOCUSED interpretation hint (EN)', () => {
    renderCard({ log: singleLog() })
    expect(screen.getByText(/One session per training day/i)).toBeInTheDocument()
  })
})

// ─── MIXED_DENSITY rendering ────────────────────────────────────────────────
describe('SessionDensityCard — MIXED_DENSITY', () => {
  it('renders density 1.25, MIXED badge, green accent', () => {
    const { container } = renderCard({ log: mixedLog() })

    expect(screen.getByText('1.25')).toBeInTheDocument()
    expect(screen.getByText('MIXED')).toBeInTheDocument()
    expect(screen.getByText(/25 sessions · 20 days/)).toBeInTheDocument()
    expect(screen.getByText(/5 double days \(25%\)/)).toBeInTheDocument()

    const region = container.querySelector('[role="region"]')
    expect(region.getAttribute('style'))
      .toMatch(/border-left:\s*3px\s+solid\s+(?:#5bc25b|rgb\(91,\s*194,\s*91\))/i)
  })

  it('exposes data-* anchors for MIXED_DENSITY', () => {
    const { container } = renderCard({ log: mixedLog() })
    const region = container.querySelector('[data-session-density-card]')
    expect(region.getAttribute('data-density-band')).toBe('MIXED_DENSITY')
    expect(Number(region.getAttribute('data-density'))).toBeCloseTo(1.25, 4)
    expect(region.getAttribute('data-active-days')).toBe('20')
    expect(region.getAttribute('data-double-days')).toBe('5')
    expect(Number(region.getAttribute('data-double-rate'))).toBeCloseTo(0.25, 4)
  })

  it('shows the MIXED_DENSITY interpretation hint (EN)', () => {
    renderCard({ log: mixedLog() })
    expect(screen.getByText(/Occasional doubles/i)).toBeInTheDocument()
  })
})

// ─── DOUBLE_HEAVY rendering ─────────────────────────────────────────────────
describe('SessionDensityCard — DOUBLE_HEAVY', () => {
  it('renders density 2.00, DOUBLE badge, orange accent', () => {
    const { container } = renderCard({ log: doubleLog() })

    expect(screen.getByText('2.00')).toBeInTheDocument()
    expect(screen.getByText('DOUBLE')).toBeInTheDocument()
    expect(screen.getByText(/28 sessions · 14 days/)).toBeInTheDocument()
    expect(screen.getByText(/14 double days \(100%\)/)).toBeInTheDocument()

    const region = container.querySelector('[role="region"]')
    expect(region.getAttribute('style'))
      .toMatch(/border-left:\s*3px\s+solid\s+(?:#ff6600|rgb\(255,\s*102,\s*0\))/i)
  })

  it('exposes data-* anchors for DOUBLE_HEAVY', () => {
    const { container } = renderCard({ log: doubleLog() })
    const region = container.querySelector('[data-session-density-card]')
    expect(region.getAttribute('data-density-band')).toBe('DOUBLE_HEAVY')
    expect(Number(region.getAttribute('data-density'))).toBeCloseTo(2.0, 4)
    expect(region.getAttribute('data-active-days')).toBe('14')
    expect(region.getAttribute('data-double-days')).toBe('14')
    expect(Number(region.getAttribute('data-double-rate'))).toBeCloseTo(1.0, 4)
  })

  it('shows the DOUBLE_HEAVY interpretation hint (EN)', () => {
    renderCard({ log: doubleLog() })
    expect(screen.getByText(/Frequent doubles/i)).toBeInTheDocument()
  })
})

// ─── Turkish localisation ───────────────────────────────────────────────────
describe('SessionDensityCard — Turkish (lang=tr)', () => {
  it('renders TR title + TR band label for SINGLE_FOCUSED', () => {
    renderCard({ log: singleLog() }, 'tr')
    expect(screen.getByText(/SEANS YOĞUNLUĞU · 28G/)).toBeInTheDocument()
    expect(screen.getByText('TEK')).toBeInTheDocument()
    expect(screen.getByText(/Antrenman günü başına tek seans/i)).toBeInTheDocument()
    // TR sessions/days strings
    expect(screen.getByText(/20 seans · 20 gün/)).toBeInTheDocument()
    expect(screen.getByText(/0 çift gün \(0%\)/)).toBeInTheDocument()
  })

  it('renders TR band label "KARIŞIK" for MIXED_DENSITY', () => {
    renderCard({ log: mixedLog() }, 'tr')
    expect(screen.getByText('KARIŞIK')).toBeInTheDocument()
    expect(screen.getByText(/Ara sıra çift seans/i)).toBeInTheDocument()
    expect(screen.getByText(/5 çift gün \(25%\)/)).toBeInTheDocument()
  })

  it('renders TR band label "ÇİFT" for DOUBLE_HEAVY', () => {
    renderCard({ log: doubleLog() }, 'tr')
    expect(screen.getByText('ÇİFT')).toBeInTheDocument()
    expect(screen.getByText(/Sık çift seans/i)).toBeInTheDocument()
    expect(screen.getByText(/14 çift gün \(100%\)/)).toBeInTheDocument()
  })

  it('region aria-label is bilingual (TR)', () => {
    renderCard({ log: singleLog() }, 'tr')
    const region = screen.getByRole('region')
    expect(region.getAttribute('aria-label')).toMatch(/Seans yoğunluğu/i)
  })
})

// ─── A11y / aria ────────────────────────────────────────────────────────────
describe('SessionDensityCard — a11y', () => {
  it('card root has role=region with EN aria-label', () => {
    renderCard({ log: singleLog() })
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('aria-label')).toMatch(/Session density/i)
  })
})
