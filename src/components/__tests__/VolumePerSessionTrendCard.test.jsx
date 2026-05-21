// @vitest-environment jsdom
// ─── VolumePerSessionTrendCard.test.jsx — Dashboard surface tests ────────────
//
// Covers: null gate (today unresolvable not possible via component since
// Date.now is mocked, so instead test INSUFFICIENT_DATA), each of the 5
// bands (SHRINKING / STABLE / GROWING / AGGRESSIVE_GROWTH /
// INSUFFICIENT_DATA), bilingual EN+TR, citation, accessibility, 12-bar
// rendering + trend line.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import VolumePerSessionTrendCard from '../dashboard/VolumePerSessionTrendCard.jsx'

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

function buildWeeklyLog(weekMinutes) {
  const log = []
  for (let i = 0; i < weekMinutes.length; i++) {
    const min = weekMinutes[i]
    if (!min) continue
    const weeksBack = (weekMinutes.length - 1) - i
    log.push({
      date: daysAgo(weeksBack * 7),
      durationMin: min,
      type: 'Easy Run',
    })
  }
  return log
}

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <VolumePerSessionTrendCard log={log} />
    </LangCtx.Provider>
  )
}

// ─── INSUFFICIENT_DATA ──────────────────────────────────────────────────────

describe('VolumePerSessionTrendCard — INSUFFICIENT_DATA state', () => {
  it('renders INSUFFICIENT_DATA band when fewer than 12 sessions are logged', () => {
    const log = buildWeeklyLog([0, 0, 0, 0, 60, 60, 60, 60, 60, 60, 60, 60])  // 8 sessions
    renderCard(log)
    const card = document.querySelector('[data-card="volume-per-session-trend"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_DATA')
    expect(card.textContent).toMatch(/NOT ENOUGH DATA/)
    expect(card.textContent).toMatch(/Log at least 12 sessions/)
  })

  it('renders INSUFFICIENT_DATA band for an empty log', () => {
    renderCard([])
    const card = document.querySelector('[data-card="volume-per-session-trend"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_DATA')
    expect(card.getAttribute('data-session-count-total')).toBe('0')
  })
})

// ─── STABLE band ───────────────────────────────────────────────────────────

describe('VolumePerSessionTrendCard — STABLE band', () => {
  it('renders STABLE band when weekly means are flat at 60 min', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    renderCard(log)
    const card = document.querySelector('[data-card="volume-per-session-trend"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('STABLE')
    const region = screen.getByRole('region', { name: /Session length trend/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/SESSION LENGTH TREND · 12W/)
    expect(region.textContent).toMatch(/STABLE/)
    expect(region.textContent).toMatch(/Mean session length is steady/i)
  })

  it('shows the overallMeanSessionMin large stat formatted', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    renderCard(log)
    const card = document.querySelector('[data-card="volume-per-session-trend"]')
    expect(card.getAttribute('data-overall-mean')).toBe('60')
    const meanDisplay = card.querySelector('[data-overall-mean-display]')
    expect(meanDisplay).not.toBeNull()
    expect(meanDisplay.textContent).toBe('1h')
  })
})

// ─── GROWING band ──────────────────────────────────────────────────────────

describe('VolumePerSessionTrendCard — GROWING band', () => {
  it('renders GROWING band for +2 min/wk linear growth', () => {
    const weekly = []
    for (let i = 0; i < 12; i++) weekly.push(60 + i * 2)
    renderCard(buildWeeklyLog(weekly))
    const card = document.querySelector('[data-card="volume-per-session-trend"]')
    expect(card.getAttribute('data-band')).toBe('GROWING')
    expect(card.textContent).toMatch(/GROWING/)
    expect(card.textContent).toMatch(/getting longer/i)
  })

  it('exposes data-trend-slope and data-trend-pct anchors when growing', () => {
    const weekly = []
    for (let i = 0; i < 12; i++) weekly.push(60 + i * 2)
    renderCard(buildWeeklyLog(weekly))
    const card = document.querySelector('[data-card="volume-per-session-trend"]')
    expect(card.getAttribute('data-trend-slope')).toBe('2')
    expect(Number(card.getAttribute('data-trend-pct'))).toBeGreaterThanOrEqual(0.02)
  })
})

// ─── AGGRESSIVE_GROWTH band ────────────────────────────────────────────────

describe('VolumePerSessionTrendCard — AGGRESSIVE_GROWTH band', () => {
  it('renders AGGRESSIVE_GROWTH band for steep growth (+4 min/wk on a small base)', () => {
    const weekly = []
    for (let i = 0; i < 12; i++) weekly.push(30 + i * 4)
    renderCard(buildWeeklyLog(weekly))
    const card = document.querySelector('[data-card="volume-per-session-trend"]')
    expect(card.getAttribute('data-band')).toBe('AGGRESSIVE_GROWTH')
    expect(card.textContent).toMatch(/AGGRESSIVE GROWTH/i)
    expect(card.textContent).toMatch(/watch for fatigue/i)
  })
})

// ─── SHRINKING band ───────────────────────────────────────────────────────

describe('VolumePerSessionTrendCard — SHRINKING band', () => {
  it('renders SHRINKING band when weekly mean drops 2 min/wk', () => {
    const weekly = []
    for (let i = 0; i < 12; i++) weekly.push(82 - i * 2)
    renderCard(buildWeeklyLog(weekly))
    const card = document.querySelector('[data-card="volume-per-session-trend"]')
    expect(card.getAttribute('data-band')).toBe('SHRINKING')
    expect(card.textContent).toMatch(/SHRINKING/)
    expect(card.textContent).toMatch(/getting shorter/i)
  })
})

// ─── Turkish bilingual ─────────────────────────────────────────────────────

describe('VolumePerSessionTrendCard — bilingual (Turkish)', () => {
  it('renders the Turkish heading and STABİL label when lang=tr', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    renderCard(log, 'tr')
    const region = screen.getByRole('region', { name: /Antrenman süresi trendi/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/ANTRENMAN SÜRESİ TRENDİ · 12H/)
    expect(region.textContent).toMatch(/STABİL/)
    expect(region.textContent).toMatch(/Ortalama seans süresi sabit/i)
  })

  it('renders BÜYÜYOR + Turkish hint for GROWING in TR', () => {
    const weekly = []
    for (let i = 0; i < 12; i++) weekly.push(60 + i * 2)
    renderCard(buildWeeklyLog(weekly), 'tr')
    const card = document.querySelector('[data-card="volume-per-session-trend"]')
    expect(card.getAttribute('data-band')).toBe('GROWING')
    expect(card.textContent).toMatch(/BÜYÜYOR/)
    expect(card.textContent).toMatch(/aerobik tabanı geliştiren/i)
  })

  it('renders KÜÇÜLÜYOR + Turkish hint for SHRINKING in TR', () => {
    const weekly = []
    for (let i = 0; i < 12; i++) weekly.push(82 - i * 2)
    renderCard(buildWeeklyLog(weekly), 'tr')
    const card = document.querySelector('[data-card="volume-per-session-trend"]')
    expect(card.getAttribute('data-band')).toBe('SHRINKING')
    expect(card.textContent).toMatch(/KÜÇÜLÜYOR/)
    expect(card.textContent).toMatch(/kolay günlerine/i)
  })

  it('renders AGRESİF BÜYÜME for AGGRESSIVE_GROWTH in TR', () => {
    const weekly = []
    for (let i = 0; i < 12; i++) weekly.push(30 + i * 4)
    renderCard(buildWeeklyLog(weekly), 'tr')
    const card = document.querySelector('[data-card="volume-per-session-trend"]')
    expect(card.getAttribute('data-band')).toBe('AGGRESSIVE_GROWTH')
    expect(card.textContent).toMatch(/AGRESİF BÜYÜME/)
  })

  it('renders Turkish unit "dk/hafta" in slope display when lang=tr', () => {
    const weekly = []
    for (let i = 0; i < 12; i++) weekly.push(60 + i * 2)
    renderCard(buildWeeklyLog(weekly), 'tr')
    const card = document.querySelector('[data-card="volume-per-session-trend"]')
    expect(card.textContent).toMatch(/dk\/hafta/)
  })
})

// ─── Citation ──────────────────────────────────────────────────────────────

describe('VolumePerSessionTrendCard — citation footer', () => {
  it('renders the Daniels 2014 + Pfitzinger 2014 citation', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    renderCard(log)
    const card = document.querySelector('[data-card="volume-per-session-trend"]')
    expect(card.textContent).toMatch(/Daniels 2014/)
    expect(card.textContent).toMatch(/Pfitzinger 2014/)
  })
})

// ─── Accessibility ─────────────────────────────────────────────────────────

describe('VolumePerSessionTrendCard — accessibility', () => {
  it('exposes role=region with bilingual aria-label', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    renderCard(log)
    const region = screen.getByRole('region', { name: /Session length trend/i })
    expect(region).toBeInTheDocument()
  })

  it('exposes role=region with Turkish aria-label when lang=tr', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    renderCard(log, 'tr')
    const region = screen.getByRole('region', { name: /Antrenman süresi trendi/i })
    expect(region).toBeInTheDocument()
  })

  it('keeps the band-coloured interpretation strip aria-live=polite', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    renderCard(log)
    const hint = document.querySelector('[data-hint]')
    expect(hint).not.toBeNull()
    expect(hint.getAttribute('aria-live')).toBe('polite')
  })
})

// ─── 12-bar rendering + trend line ─────────────────────────────────────────

describe('VolumePerSessionTrendCard — 12-bar mini chart + trend line', () => {
  it('renders exactly 12 week bars with weekStart + mean-min anchors', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    renderCard(log)
    const bars = document.querySelectorAll('[data-week-bar]')
    expect(bars.length).toBe(12)
    for (const bar of bars) {
      expect(bar.getAttribute('data-week-start')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(bar.getAttribute('data-mean-min')).toMatch(/^[\d.]+$/)
    }
  })

  it('renders the linear regression trend line overlay when there is signal', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    renderCard(log)
    const line = document.querySelector('[data-trend-line]')
    expect(line).not.toBeNull()
    expect(line.tagName.toLowerCase()).toBe('line')
  })

  it('does NOT render the trend line when no weekly mean is positive (empty log)', () => {
    renderCard([])
    const line = document.querySelector('[data-trend-line]')
    expect(line).toBeNull()
  })

  it('marks empty weeks with mean-min=0 and sessionCount=0 anchors', () => {
    const log = buildWeeklyLog([60, 0, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    renderCard(log)
    const bars = document.querySelectorAll('[data-week-bar]')
    const empty = Array.from(bars).filter(b => b.getAttribute('data-mean-min') === '0')
    expect(empty.length).toBe(1)
    expect(empty[0].getAttribute('data-session-count')).toBe('0')
  })

  it('exposes data-sessions-total / data-session-count-total surfaces matching session count', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    renderCard(log)
    const card = document.querySelector('[data-card="volume-per-session-trend"]')
    expect(card.getAttribute('data-session-count-total')).toBe('12')
    expect(card.textContent).toMatch(/12 sessions analyzed/)
  })

  it('shows trend arrow + slope display for GROWING data', () => {
    const weekly = []
    for (let i = 0; i < 12; i++) weekly.push(60 + i * 2)
    renderCard(buildWeeklyLog(weekly))
    const arrow = document.querySelector('[data-trend-arrow]')
    expect(arrow).not.toBeNull()
    expect(['↑', '⇈']).toContain(arrow.textContent)
    const slope = document.querySelector('[data-trend-slope-display]')
    expect(slope).not.toBeNull()
    expect(slope.textContent).toMatch(/\+2\.00 min\/wk/)
  })
})
