// @vitest-environment jsdom
// ─── LongestSessionTrendCard.test.jsx — Dashboard surface tests ──────────────
//
// Covers: null render (sparse / empty log), each of the 3 bands
// (GROWING / STABLE / SHRINKING), Turkish heading + band label,
// per-week data anchors, peak-week highlight.
//
// We freeze the system clock so the card's "today" matches the
// synthetic log dates produced by `weeksAgo()`.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import LongestSessionTrendCard from '../dashboard/LongestSessionTrendCard.jsx'

const TODAY = '2026-05-18'  // Monday

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function daysAgo(n) {
  const d = new Date(`${TODAY}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

// Build a 12-week log where each index 0..11 (oldest..newest) gets the
// supplied longestMin (or 0 to skip).
function buildWeeklyLog(weekLongest) {
  const log = []
  for (let i = 0; i < weekLongest.length; i++) {
    const min = weekLongest[i]
    if (!min) continue
    const weeksBack = (weekLongest.length - 1) - i
    log.push({
      date: daysAgo(weeksBack * 7),
      durationMin: min,
      type: 'Long Run',
    })
  }
  return log
}

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <LongestSessionTrendCard log={log} />
    </LangCtx.Provider>
  )
}

describe('LongestSessionTrendCard — guards (renders null)', () => {
  it('renders nothing for an empty log', () => {
    const { container } = renderCard([])
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-longest-session-trend-card]')).toBeNull()
  })

  it('renders nothing for null log', () => {
    const { container } = renderCard(null)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when fewer than 6 of 12 weeks have sessions', () => {
    // 5 active weeks → analyzer returns null.
    const log = buildWeeklyLog([60, 0, 0, 60, 0, 60, 0, 0, 60, 0, 0, 60])
    const { container } = renderCard(log)
    expect(container.firstChild).toBeNull()
  })
})

describe('LongestSessionTrendCard — GROWING band', () => {
  it('renders with GROWING band when recent third averages ≥10% above early third', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 70, 75, 80, 85, 88, 90, 90, 90])
    renderCard(log)
    const card = document.querySelector('[data-longest-session-trend-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-trend-band')).toBe('GROWING')
    const region = screen.getByRole('region', { name: /Longest session trend/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/LONGEST SESSION/i)
    expect(region.textContent).toMatch(/GROWING/)
    expect(region.textContent).toMatch(/aerobic base is expanding/i)
    expect(region.textContent).toMatch(/Daniels 2014/)
    expect(region.textContent).toMatch(/Lydiard 1978/)
  })

  it('shows peak duration formatted as Xh Ymin and exposes peak data anchors', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 70, 75, 80, 85, 88, 90, 90, 125])
    renderCard(log)
    const card = document.querySelector('[data-longest-session-trend-card]')
    expect(card).not.toBeNull()
    // 125 min → "2h 5min"
    expect(card.textContent).toMatch(/2h 5min/)
    expect(card.getAttribute('data-peak-min')).toBe('125')
    // peakWeek must be the most-recent Monday (weeksBack = 0).
    expect(card.getAttribute('data-peak-week')).toBe(daysAgo(0))
  })
})

describe('LongestSessionTrendCard — STABLE band', () => {
  it('renders with STABLE band when |delta| < 10%', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    renderCard(log)
    const card = document.querySelector('[data-longest-session-trend-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-trend-band')).toBe('STABLE')
    expect(card.textContent).toMatch(/STABLE/)
    expect(card.textContent).toMatch(/Long-session capacity is steady/i)
  })
})

describe('LongestSessionTrendCard — SHRINKING band', () => {
  it('renders with SHRINKING band when recent third ≥10% below early third', () => {
    const log = buildWeeklyLog([90, 90, 90, 90, 85, 80, 75, 70, 65, 60, 60, 60])
    renderCard(log)
    const card = document.querySelector('[data-longest-session-trend-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-trend-band')).toBe('SHRINKING')
    expect(card.textContent).toMatch(/SHRINKING/)
    expect(card.textContent).toMatch(/getting shorter/i)
  })
})

describe('LongestSessionTrendCard — per-week bars', () => {
  it('renders exactly 12 week bars with weekStart + longestMin data anchors', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    renderCard(log)
    const bars = document.querySelectorAll('[data-week-bar]')
    expect(bars.length).toBe(12)
    for (const bar of bars) {
      expect(bar.getAttribute('data-week-start')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(bar.getAttribute('data-longest-min')).toMatch(/^\d+$/)
    }
  })

  it('renders empty weeks with longest-min=0 anchor', () => {
    // 7 active weeks, 5 empty.
    const log = buildWeeklyLog([60, 60, 0, 60, 0, 60, 0, 60, 0, 60, 0, 60])
    renderCard(log)
    const bars = document.querySelectorAll('[data-week-bar]')
    expect(bars.length).toBe(12)
    const emptyBars = Array.from(bars).filter(b => b.getAttribute('data-longest-min') === '0')
    expect(emptyBars.length).toBe(5)
  })

  it('highlights the peak week bar with the peakWeek date', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 120, 60, 60, 60, 60, 60, 60])
    renderCard(log)
    const card = document.querySelector('[data-longest-session-trend-card]')
    expect(card.getAttribute('data-peak-min')).toBe('120')
    // Index 5 in 12-week array → 6 weeks back from this Monday.
    expect(card.getAttribute('data-peak-week')).toBe(daysAgo(6 * 7))
    // The bar at that weekStart must exist.
    const peakBar = document.querySelector(
      `[data-week-bar][data-week-start="${daysAgo(6 * 7)}"]`
    )
    expect(peakBar).not.toBeNull()
    expect(peakBar.getAttribute('data-longest-min')).toBe('120')
  })
})

describe('LongestSessionTrendCard — bilingual (Turkish)', () => {
  it('renders the Turkish heading and STABLE band label when lang=tr', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    renderCard(log, 'tr')
    const region = screen.getByRole('region', { name: /En uzun seans/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/EN UZUN SEANS · 12H/)
    expect(region.textContent).toMatch(/STABİL/)
    expect(region.textContent).toMatch(/Uzun seans kapasitesi sabit/)
  })

  it('renders the Turkish GROWING band label', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 70, 75, 80, 85, 88, 90, 90, 90])
    renderCard(log, 'tr')
    const card = document.querySelector('[data-longest-session-trend-card]')
    expect(card.getAttribute('data-trend-band')).toBe('GROWING')
    expect(card.textContent).toMatch(/BÜYÜYOR/)
    expect(card.textContent).toMatch(/aerobik temel genişliyor/i)
  })

  it('renders the Turkish SHRINKING band label', () => {
    const log = buildWeeklyLog([90, 90, 90, 90, 85, 80, 75, 70, 65, 60, 60, 60])
    renderCard(log, 'tr')
    const card = document.querySelector('[data-longest-session-trend-card]')
    expect(card.getAttribute('data-trend-band')).toBe('SHRINKING')
    expect(card.textContent).toMatch(/KÜÇÜLÜYOR/)
    expect(card.textContent).toMatch(/dayanıklılık temeli kayıyor/i)
  })
})

describe('LongestSessionTrendCard — delta data anchor', () => {
  it('exposes the numeric delta on data-delta', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    renderCard(log)
    const card = document.querySelector('[data-longest-session-trend-card]')
    expect(card.getAttribute('data-delta')).toBe('0.0000')
  })

  it('renders an empty data-delta when delta is null (fresh-base STABLE)', () => {
    // First 4 weeks empty but recent weeks active — fresh base.
    const log = buildWeeklyLog([0, 0, 0, 0, 30, 40, 50, 60, 70, 80, 85, 90])
    renderCard(log)
    const card = document.querySelector('[data-longest-session-trend-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-trend-band')).toBe('STABLE')
    expect(card.getAttribute('data-delta')).toBe('')
  })
})
