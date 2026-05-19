// @vitest-environment jsdom
// ─── TimeOnFeetCard.test.jsx — render tests ─────────────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import TimeOnFeetCard, { formatMinutes } from '../dashboard/TimeOnFeetCard.jsx'

// Sunday → mondayOf = 2026-05-11.
const TODAY = '2026-05-17'
const THIS_WEEK_TUE = '2026-05-12'

const COMPLETED_MONDAYS = [
  '2026-02-16', '2026-02-23', '2026-03-02', '2026-03-09',
  '2026-03-16', '2026-03-23', '2026-03-30', '2026-04-06',
  '2026-04-13', '2026-04-20', '2026-04-27', '2026-05-04',
]

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function renderCard(props = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <TimeOnFeetCard {...props} />
    </LangCtx.Provider>
  )
}

function runSession(date, durationMin, extras = {}) {
  return { date, durationMin, type: 'run', ...extras }
}

function buildLog({ weeklyMin, thisWeekMin }) {
  const log = []
  for (const mon of COMPLETED_MONDAYS) {
    if (weeklyMin > 0) {
      const d = new Date(mon + 'T00:00:00Z')
      d.setUTCDate(d.getUTCDate() + 1)
      log.push(runSession(d.toISOString().slice(0, 10), weeklyMin))
    }
  }
  if (thisWeekMin > 0) log.push(runSession(THIS_WEEK_TUE, thisWeekMin))
  return log
}

// ─── formatMinutes helper ────────────────────────────────────────────────

describe('formatMinutes', () => {
  it('formats sub-hour values as Mm', () => {
    expect(formatMinutes(45)).toBe('45m')
    expect(formatMinutes(59)).toBe('59m')
    expect(formatMinutes(1)).toBe('1m')
  })

  it('formats hour+ values as Hh Mm', () => {
    expect(formatMinutes(60)).toBe('1h 0m')
    expect(formatMinutes(245)).toBe('4h 5m')
    expect(formatMinutes(260)).toBe('4h 20m')
  })

  it('handles zero/negative/non-finite as 0m', () => {
    expect(formatMinutes(0)).toBe('0m')
    expect(formatMinutes(-5)).toBe('0m')
    expect(formatMinutes(NaN)).toBe('0m')
    expect(formatMinutes(undefined)).toBe('0m')
  })
})

// ─── render-null cases ───────────────────────────────────────────────────

describe('TimeOnFeetCard — null gating', () => {
  it('renders nothing for an empty log', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when log prop is missing', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when no running sessions exist (cycling only)', () => {
    const log = COMPLETED_MONDAYS.map(m => ({
      date: m, durationMin: 90, type: 'cycle',
    }))
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when fewer than 4 of 12 completed weeks have running', () => {
    const log = [
      runSession('2026-04-14', 60),
      runSession('2026-04-21', 60),
      runSession('2026-04-28', 60),
      runSession('2026-05-12', 60),
    ]
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })
})

// ─── band rendering ──────────────────────────────────────────────────────

describe('TimeOnFeetCard — band rendering', () => {
  it('renders SAFE_RAMP band: green stripe + label + EN hint', () => {
    renderCard({ log: buildLog({ weeklyMin: 60, thisWeekMin: 60 }) })
    const card = screen.getByRole('region', { name: /running time-on-feet/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-time-on-feet-band')).toBe('SAFE_RAMP')
    expect(card.style.borderLeft).toMatch(/rgb\(91,\s*194,\s*91\)/)
    expect(screen.getByText('SAFE')).toBeInTheDocument()
    expect(card.textContent).toMatch(/Gabbett's safe zone/)
    expect(card.textContent).toMatch(/Bennell 2012; Hreljac 2004/)
  })

  it('renders AGGRESSIVE band: orange stripe + label + hint', () => {
    renderCard({ log: buildLog({ weeklyMin: 60, thisWeekMin: 90 }) })
    const card = screen.getByRole('region', { name: /running time-on-feet/i })
    expect(card.getAttribute('data-time-on-feet-band')).toBe('AGGRESSIVE')
    expect(card.style.borderLeft).toMatch(/rgb\(255,\s*102,\s*0\)/)
    expect(screen.getByText('AGGRESSIVE')).toBeInTheDocument()
    expect(card.textContent).toMatch(/Bone stress risk increases when ACWR/)
  })

  it('renders DETRAINING band: blue stripe + label + hint', () => {
    renderCard({ log: buildLog({ weeklyMin: 60, thisWeekMin: 30 }) })
    const card = screen.getByRole('region', { name: /running time-on-feet/i })
    expect(card.getAttribute('data-time-on-feet-band')).toBe('DETRAINING')
    expect(card.style.borderLeft).toMatch(/rgb\(0,\s*100,\s*255\)/)
    expect(screen.getByText('DETRAINING')).toBeInTheDocument()
    expect(card.textContent).toMatch(/Brief deload OK/)
  })
})

// ─── Turkish ─────────────────────────────────────────────────────────────

describe('TimeOnFeetCard — Turkish', () => {
  it('renders TR title + TR band label (GÜVENLİ) when lang=tr', () => {
    renderCard({ log: buildLog({ weeklyMin: 60, thisWeekMin: 60 }) }, 'tr')
    expect(screen.getByText(/AYAK ÜSTÜNDE SÜRE · 12H/)).toBeInTheDocument()
    expect(screen.getByText('GÜVENLİ')).toBeInTheDocument()
    expect(screen.getByText(/Gabbett güvenli aralığında/)).toBeInTheDocument()
  })

  it('renders Turkish band labels for the other 2 bands', () => {
    let { unmount } = renderCard(
      { log: buildLog({ weeklyMin: 60, thisWeekMin: 90 }) }, 'tr'
    )
    expect(screen.getByText('AGRESİF')).toBeInTheDocument()
    unmount()

    renderCard({ log: buildLog({ weeklyMin: 60, thisWeekMin: 30 }) }, 'tr')
    expect(screen.getByText('AZALIYOR')).toBeInTheDocument()
  })
})

// ─── data anchors + minute formatting ────────────────────────────────────

describe('TimeOnFeetCard — data anchors and formatting', () => {
  it('exposes all required data-* anchors', () => {
    renderCard({ log: buildLog({ weeklyMin: 60, thisWeekMin: 90 }) })
    const card = document.querySelector('[data-time-on-feet-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-time-on-feet-band')).toBe('AGGRESSIVE')
    expect(card.getAttribute('data-this-week-min')).toBe('90')
    expect(card.getAttribute('data-avg-12w-min')).toBe('60')
    // deltaPct = (90 - 60) / 60 = 0.5
    expect(parseFloat(card.getAttribute('data-delta-pct'))).toBeCloseTo(0.5, 5)
  })

  it('renders thisWeekMin as Hh Mm when >= 60 (e.g. 4h 20m)', () => {
    // weeklyMin 200 avg = 200, thisWeek 260 = 4h 20m, ratio 1.3 → AGGRESSIVE
    renderCard({ log: buildLog({ weeklyMin: 200, thisWeekMin: 260 }) })
    expect(screen.getByText('4h 20m')).toBeInTheDocument()
  })

  it('renders thisWeekMin as Mm when < 60 (e.g. 45m)', () => {
    // weeklyMin 60 (avg 60), thisWeek 45 (75% → DETRAINING)
    renderCard({ log: buildLog({ weeklyMin: 60, thisWeekMin: 45 }) })
    expect(screen.getByText('45m')).toBeInTheDocument()
  })

  it('renders signed deltaPct (e.g. "+50%")', () => {
    renderCard({ log: buildLog({ weeklyMin: 60, thisWeekMin: 90 }) })
    expect(screen.getByText('+50%')).toBeInTheDocument()
  })

  it('renders avg label with formatted average', () => {
    // avg = 225 / 60 = 3h 45m
    renderCard({ log: buildLog({ weeklyMin: 225, thisWeekMin: 225 }) })
    const card = screen.getByRole('region', { name: /running time-on-feet/i })
    expect(card.textContent).toMatch(/avg 12w:/)
    expect(card.textContent).toMatch(/3h 45m/)
  })

  it('exposes 12 per-bar data anchors with weekStart and weekMinutes', () => {
    renderCard({ log: buildLog({ weeklyMin: 60, thisWeekMin: 60 }) })
    const bars = document.querySelectorAll('[data-week-bar]')
    expect(bars).toHaveLength(12)
    // First bar = oldest completed week
    expect(bars[0].getAttribute('data-week-start')).toBe('2026-02-16')
    expect(bars[0].getAttribute('data-week-minutes')).toBe('60')
    // Last bar = newest completed week (still chronological, NOT the in-progress week)
    expect(bars[11].getAttribute('data-week-start')).toBe('2026-05-04')
    expect(bars[11].getAttribute('data-week-minutes')).toBe('60')
  })

  it('per-bar minutes reflect weekly running sums', () => {
    const log = [
      runSession('2026-04-07', 30), // wk 2026-04-06
      runSession('2026-04-08', 30), // wk 2026-04-06 → 60 total
      runSession('2026-04-14', 60),
      runSession('2026-04-21', 60),
      runSession('2026-04-28', 60),
      runSession('2026-05-12', 60),
    ]
    renderCard({ log })
    const wkApr6 = document.querySelector('[data-week-start="2026-04-06"]')
    expect(wkApr6).not.toBeNull()
    expect(wkApr6.getAttribute('data-week-minutes')).toBe('60')
  })
})
