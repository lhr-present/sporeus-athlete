// @vitest-environment jsdom
// ─── WeeklyVolumeRampCard.test.jsx — render tests ───────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import WeeklyVolumeRampCard from '../dashboard/WeeklyVolumeRampCard.jsx'

const TODAY = '2026-05-17'

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
      <WeeklyVolumeRampCard {...props} />
    </LangCtx.Provider>
  )
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function buildWeeklyLog({ today = TODAY, weeklyMinutes }) {
  const log = []
  const weeks = weeklyMinutes.length
  for (let k = 0; k < weeks; k++) {
    const perDay = weeklyMinutes[k] / 7
    for (let d = 1; d <= 7; d++) {
      const offsetFromToday = weeks * 7 - (k * 7 + d)
      log.push({ date: isoMinusDays(today, offsetFromToday), duration: perDay })
    }
  }
  return log
}

describe('WeeklyVolumeRampCard — render gating', () => {
  it('(a) renders NOTHING for an empty log', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })
})

describe('WeeklyVolumeRampCard — band rendering', () => {
  it('(b) renders PRODUCTIVE band with green color', () => {
    // +8%/week → mean ramp ~8% → PRODUCTIVE
    const base = 700
    const minutes = []
    for (let i = 0; i < 5; i++) minutes.push(base * Math.pow(1.08, i))
    const log = buildWeeklyLog({ weeklyMinutes: minutes })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /Weekly volume ramp/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-ramp-band')).toBe('PRODUCTIVE')
    // Green stripe on left border (jsdom serializes hex → rgb)
    expect(card.style.borderLeft).toMatch(/rgb\(91,\s*194,\s*91\)/)
    // Band label visible
    expect(card.textContent).toMatch(/PRODUCTIVE/)
    // Citation footer
    expect(card.textContent).toMatch(/Foster 2001/)
  })

  it('(c) renders OVERSHOOT band with red color', () => {
    // +20%/week → OVERSHOOT
    const base = 500
    const minutes = []
    for (let i = 0; i < 5; i++) minutes.push(base * Math.pow(1.20, i))
    const log = buildWeeklyLog({ weeklyMinutes: minutes })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /Weekly volume ramp/i })
    expect(card.getAttribute('data-ramp-band')).toBe('OVERSHOOT')
    expect(card.style.borderLeft).toMatch(/rgb\(224,\s*48,\s*48\)/)
    expect(card.textContent).toMatch(/OVERSHOOT/)
  })
})

describe('WeeklyVolumeRampCard — anchors + bilingual', () => {
  it('(d) data-ramp-band anchor matches the computed band (AGGRESSIVE @ +12%)', () => {
    const base = 600
    const minutes = []
    for (let i = 0; i < 5; i++) minutes.push(base * Math.pow(1.12, i))
    const log = buildWeeklyLog({ weeklyMinutes: minutes })
    renderCard({ log })
    const card = document.querySelector('[data-weekly-volume-ramp-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-ramp-band')).toBe('AGGRESSIVE')
  })

  it('(e) renders Turkish heading "HACİM ARTIŞI · 4H" when lang=tr', () => {
    const base = 700
    const minutes = []
    for (let i = 0; i < 5; i++) minutes.push(base * Math.pow(1.08, i))
    const log = buildWeeklyLog({ weeklyMinutes: minutes })
    renderCard({ log }, 'tr')
    expect(screen.getByText(/HACİM ARTIŞI · 4H/)).toBeInTheDocument()
    // Turkish band label for PRODUCTIVE is VERİMLİ
    expect(screen.getByText(/VERİMLİ/)).toBeInTheDocument()
  })
})
