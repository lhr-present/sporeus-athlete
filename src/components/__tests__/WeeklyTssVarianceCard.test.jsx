// @vitest-environment jsdom
// ─── WeeklyTssVarianceCard.test.jsx — Dashboard surface tests ───────────────
//
// Covers: render-null guards, all 3 bands (STEADY / MODERATE / CHAOTIC),
// per-bar data anchors, top-level data anchors, Turkish heading.
//
// Style mirrors AerobicDecouplingTrendCard.test.jsx: freeze system time
// with vi.setSystemTime and wrap the render in a LangCtx.Provider.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import WeeklyTssVarianceCard from '../dashboard/WeeklyTssVarianceCard.jsx'

// 2026-05-17 is a Sunday → Monday of that week is 2026-05-11.
const TODAY = '2026-05-17'

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

// Build a log of N entries (oldest first), one session per loaded week.
function buildWeeklyLog(weeklyTss, today = TODAY) {
  const monday = mondayOf(today)
  const log = []
  for (let i = 0; i < weeklyTss.length; i++) {
    const weekStart = isoMinusDays(monday, (weeklyTss.length - 1 - i) * 7)
    const sessionDate = isoMinusDays(weekStart, -2)
    if (weeklyTss[i] > 0) {
      log.push({ date: sessionDate, tss: weeklyTss[i] })
    }
  }
  return log
}

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <WeeklyTssVarianceCard log={log} />
    </LangCtx.Provider>
  )
}

// ─── Guards ─────────────────────────────────────────────────────────────────

describe('WeeklyTssVarianceCard — guards', () => {
  it('renders nothing for an empty log', () => {
    const { container } = renderCard([])
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-weekly-tss-variance-card]')).toBeNull()
  })

  it('renders nothing when fewer than 8 of 12 weeks have TSS', () => {
    // 7 of 12 → below the analyzer's MIN_NON_ZERO_WEEKS threshold.
    const weekly = [0, 0, 0, 0, 0, 300, 300, 300, 300, 300, 300, 300]
    const { container } = renderCard(buildWeeklyLog(weekly))
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when log is null', () => {
    const { container } = renderCard(null)
    expect(container.firstChild).toBeNull()
  })
})

// ─── Bands ──────────────────────────────────────────────────────────────────

describe('WeeklyTssVarianceCard — STEADY band', () => {
  it('renders STEADY when every week is the same TSS (cv=0)', () => {
    renderCard(buildWeeklyLog(Array(12).fill(280)))
    const card = document.querySelector('[data-weekly-tss-variance-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-variance-band')).toBe('STEADY')
    expect(card.getAttribute('data-cv')).toBe('0')
    expect(card.getAttribute('data-mean-tss')).toBe('280')
    expect(card.getAttribute('data-std-tss')).toBe('0')

    const region = screen.getByRole('region', { name: /Week-to-week TSS variance/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/WEEK-TO-WEEK VARIANCE · 12W/)
    // CV % readout — 0%.
    expect(region.textContent).toMatch(/0%/)
    // Mean ref ("avg 280 TSS/wk").
    expect(region.textContent).toMatch(/avg 280 TSS\/wk/)
    // Std ref ("±0 TSS").
    expect(region.textContent).toMatch(/±0 TSS/)
    // STEADY interpretation hint.
    expect(region.textContent).toMatch(/Highly consistent weekly load/i)
    // Citation footer.
    expect(region.textContent).toMatch(/Foster 2001/)
    expect(region.textContent).toMatch(/Bourdon 2017/)
  })
})

describe('WeeklyTssVarianceCard — MODERATE band', () => {
  it('renders MODERATE at the cv = 0.20 boundary', () => {
    // 6@240 / 6@360 → mean=300, std=60, cv=0.20 → MODERATE.
    const weekly = [240, 360, 240, 360, 240, 360, 240, 360, 240, 360, 240, 360]
    renderCard(buildWeeklyLog(weekly))
    const card = document.querySelector('[data-weekly-tss-variance-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-variance-band')).toBe('MODERATE')
    expect(card.getAttribute('data-mean-tss')).toBe('300')
    expect(card.getAttribute('data-std-tss')).toBe('60')
    // 0.20 → rendered as "20%".
    expect(card.textContent).toMatch(/20%/)
    expect(card.textContent).toMatch(/Normal swings/i)
  })
})

describe('WeeklyTssVarianceCard — CHAOTIC band', () => {
  it('renders CHAOTIC at the cv = 0.40 boundary', () => {
    // 6@180 / 6@420 → mean=300, std=120, cv=0.40 → CHAOTIC.
    const weekly = [180, 420, 180, 420, 180, 420, 180, 420, 180, 420, 180, 420]
    renderCard(buildWeeklyLog(weekly))
    const card = document.querySelector('[data-weekly-tss-variance-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-variance-band')).toBe('CHAOTIC')
    expect(card.getAttribute('data-mean-tss')).toBe('300')
    expect(card.getAttribute('data-std-tss')).toBe('120')
    // 0.40 → rendered as "40%".
    expect(card.textContent).toMatch(/40%/)
    expect(card.textContent).toMatch(/Large week-to-week swings/i)
  })
})

// ─── Per-bar data anchors ───────────────────────────────────────────────────

describe('WeeklyTssVarianceCard — per-bar data anchors', () => {
  it('renders 12 [data-week-bar] anchors with date + tss attrs', () => {
    const weekly = [100, 200, 300, 100, 200, 300, 100, 200, 300, 100, 200, 300]
    renderCard(buildWeeklyLog(weekly))
    const bars = document.querySelectorAll('[data-week-bar]')
    expect(bars.length).toBe(12)

    // Newest bar = 2026-05-11 with tss=300 (last entry in `weekly`).
    const last = bars[bars.length - 1]
    expect(last.getAttribute('data-week-start')).toBe('2026-05-11')
    expect(last.getAttribute('data-week-tss')).toBe('300')

    // Oldest bar = 2026-02-23 with tss=100 (first entry in `weekly`).
    const first = bars[0]
    expect(first.getAttribute('data-week-start')).toBe('2026-02-23')
    expect(first.getAttribute('data-week-tss')).toBe('100')

    // All weekStarts unique and chronologically ordered (oldest → newest).
    const starts = Array.from(bars).map(b => b.getAttribute('data-week-start'))
    const sorted = [...starts].sort()
    expect(starts).toEqual(sorted)
    expect(new Set(starts).size).toBe(12)
  })
})

// ─── Bilingual ──────────────────────────────────────────────────────────────

describe('WeeklyTssVarianceCard — bilingual', () => {
  it('renders the Turkish heading and band label when lang=tr', () => {
    renderCard(buildWeeklyLog(Array(12).fill(280)), 'tr')
    const region = screen.getByRole('region', { name: /Haftalar arası TSS değişkenliği/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/HAFTALAR ARASI DEĞİŞKENLİK · 12H/)
    // STEADY → SABİT in TR.
    expect(region.textContent).toMatch(/SABİT/)
    // TR mean ref label.
    expect(region.textContent).toMatch(/ort 280 TSS\/hafta/)
    // TR STEADY interpretation hint.
    expect(region.textContent).toMatch(/Yüksek tutarlılıkta haftalık yük/i)
  })

  it('renders the Turkish CHAOTIC label "KAOTİK" and TR hint', () => {
    const weekly = [180, 420, 180, 420, 180, 420, 180, 420, 180, 420, 180, 420]
    renderCard(buildWeeklyLog(weekly), 'tr')
    const card = document.querySelector('[data-weekly-tss-variance-card]')
    expect(card.getAttribute('data-variance-band')).toBe('CHAOTIC')
    expect(card.textContent).toMatch(/KAOTİK/)
    expect(card.textContent).toMatch(/Haftalar arası büyük dalgalanmalar/i)
  })

  it('renders the Turkish MODERATE label "ORTA" and TR hint', () => {
    const weekly = [200, 400, 200, 400, 200, 400, 200, 400, 200, 400, 200, 400]
    renderCard(buildWeeklyLog(weekly), 'tr')
    const card = document.querySelector('[data-weekly-tss-variance-card]')
    expect(card.getAttribute('data-variance-band')).toBe('MODERATE')
    expect(card.textContent).toMatch(/ORTA/)
    expect(card.textContent).toMatch(/Normal dalgalanmalar/i)
  })
})
