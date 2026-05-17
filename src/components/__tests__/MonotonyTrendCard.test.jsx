// @vitest-environment jsdom
// ─── MonotonyTrendCard.test.jsx — render tests for 4W monotony trend card ───
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import MonotonyTrendCard from '../dashboard/MonotonyTrendCard.jsx'

beforeEach(() => {
  // Anchor "today" to a Sunday so the most recent Mon–Sun week aligns
  // with the synthetic logs (which generate `days` entries ending on
  // this date).
  vi.setSystemTime(new Date('2026-04-26T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <MonotonyTrendCard log={log} />
    </LangCtx.Provider>
  )
}

/** Build `days` daily entries ending today (2026-04-26). */
function makeLog(days, tssFor) {
  const log = []
  const base = new Date('2026-04-26T00:00:00Z')
  for (let i = 0; i < days; i++) {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() - i)
    log.push({
      date: d.toISOString().slice(0, 10),
      tss: tssFor(i),
      type: 'run',
    })
  }
  return log
}

describe('MonotonyTrendCard — null/empty handling', () => {
  it('renders nothing when log is empty', () => {
    const { container } = renderCard([])
    expect(container.querySelector('[data-monotony-trend-card]')).toBeNull()
  })

  it('renders nothing when log has fewer than 7 entries', () => {
    const log = makeLog(5, () => 50)
    const { container } = renderCard(log)
    expect(container.querySelector('[data-monotony-trend-card]')).toBeNull()
  })
})

describe('MonotonyTrendCard — high-monotony surface', () => {
  it('renders the latest monotony value prominently', () => {
    // Near-flat daily load → high monotony in every week.
    const log = makeLog(28, i => (i % 7 === 0 ? 65 : 60))
    renderCard(log)
    const card = screen.getByRole('region', { name: /Monotony 4-week trend/i })
    expect(card).toBeInTheDocument()
    const latest = card.querySelector('[data-monotony-latest]')
    expect(latest).not.toBeNull()
    // Two-decimal format → e.g. "34.34" — at minimum it must contain a dot.
    expect(latest.textContent).toMatch(/\d+\.\d{2}/)
  })

  it('data-monotony-band matches the classified band', () => {
    // Near-flat daily load → monotony >2.5 → VERY_HIGH.
    const log = makeLog(28, i => (i % 7 === 0 ? 65 : 60))
    renderCard(log)
    const card = screen.getByRole('region', { name: /Monotony 4-week trend/i })
    const band = card.getAttribute('data-monotony-band')
    expect(['HIGH', 'VERY_HIGH']).toContain(band)
  })

  it('renders one chip per trend week (default 4)', () => {
    const log = makeLog(28, i => (i % 3 === 0 ? 90 : 40))
    renderCard(log)
    const chips = document.querySelectorAll('[data-monotony-week]')
    expect(chips.length).toBe(4)
  })
})

describe('MonotonyTrendCard — colour-coding', () => {
  it('HIGH band band-chip uses the orange palette colour', () => {
    // Tune perturbation to land monotony in the [2.0, 2.5] HIGH band.
    // mean ≈ 50, stdev needs to land monotony ≈ 2.0–2.5 → stdev ≈ 20–25.
    // Pattern: alternate 50 and 50±25 → stdev ≈ 12.5, monotony ≈ 4 → too
    // high. Try: 6 days at 60, 1 day at 10 → mean ≈ 52.86, stdev ≈ 17.5,
    // monotony ≈ 3.02 → still VERY_HIGH. We need a wider spread.
    // Pattern: 5 days at 60, 2 days at 0 → mean ≈ 42.86, stdev ≈ 27.7,
    // monotony ≈ 1.55 → MODERATE. Try 6 days at 60, 1 day at 30 → mean
    // 55.7, stdev 10.5, monotony 5.3 → VERY_HIGH. We want HIGH specifically.
    // Pattern: 4 days at 70, 3 days at 30 → mean 52.86, stdev 19.5,
    // monotony ≈ 2.71 → VERY_HIGH. Try: 4 days at 70, 3 days at 20 → mean
    // 48.57, stdev 24.4, monotony ≈ 1.99 → MODERATE/HIGH boundary.
    // Pattern: 4 days at 80, 3 days at 30 → mean 58.57, stdev 24.4,
    // monotony ≈ 2.4 → HIGH ✓.
    const log = makeLog(28, i => ((i % 7) < 4 ? 80 : 30))
    renderCard(log)
    const card = screen.getByRole('region', { name: /Monotony 4-week trend/i })
    const band = card.getAttribute('data-monotony-band')
    // Confirm it's HIGH (not VERY_HIGH or MODERATE) before checking colour.
    expect(band).toBe('HIGH')
    const chip = card.querySelector('[data-monotony-band-chip]')
    expect(chip).not.toBeNull()
    // Orange palette: #ff6600. Inline style stores it lowercase rgb form
    // via React → jsdom; we assert the chip-style color attr contains it.
    const style = chip.getAttribute('style') || ''
    // jsdom normalises hex → rgb in some versions; accept both forms.
    expect(style.toLowerCase()).toMatch(/(#ff6600|255,\s*102,\s*0)/)
  })
})

describe('MonotonyTrendCard — bilingual', () => {
  it('renders Turkish heading "MONOTONLUK · 4H TRENDİ" when lang=tr', () => {
    const log = makeLog(28, i => (i % 7 === 0 ? 65 : 60))
    renderCard(log, 'tr')
    expect(
      screen.getByRole('region', { name: /Monotonluk 4 haftalık trendi/i })
    ).toBeInTheDocument()
    // The exact heading string must render in the card.
    expect(document.body.textContent).toMatch(/MONOTONLUK · 4H TRENDİ/)
  })
})
