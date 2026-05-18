// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import TaperComplianceCard from '../dashboard/TaperComplianceCard.jsx'

const TODAY = '2026-05-17'

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function isoOffset(days) {
  const d = new Date(TODAY + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function flatBaseline(dur) {
  const out = []
  for (let d = 14; d < 28; d++) {
    out.push({ date: isoOffset(-d), duration: dur })
  }
  return out
}

function thisWeek(dur) {
  return [
    { date: isoOffset(-6), duration: dur },
    { date: isoOffset(-5), duration: dur },
    { date: isoOffset(-4), duration: dur },
    { date: isoOffset(-3), duration: dur },
    { date: isoOffset(-2), duration: dur },
    { date: isoOffset(-1), duration: dur },
    { date: isoOffset(0),  duration: dur },
  ]
}

function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <TaperComplianceCard {...props} />
    </LangCtx.Provider>
  )
}

describe('TaperComplianceCard', () => {
  it('renders nothing when profile has no race date', () => {
    const { container } = renderCard({ log: flatBaseline(60), profile: {} })
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-taper-compliance-card]')).toBeNull()
  })

  it('renders nothing for ON_TARGET (silent on success)', () => {
    // Baseline 7×60 = 420 min/wk; 30% cut → 7×42 = 294 min this week
    const log = [...flatBaseline(60), ...thisWeek(42)]
    const { container } = renderCard({
      log,
      profile: { raceDate: isoOffset(10) },
    })
    expect(container.firstChild).toBeNull()
  })

  it('renders the warning for UNDERCUT with orange accent', () => {
    // Baseline 7×60 = 420 min/wk; only ~10% cut → 7×54 = 378 min this week
    const log = [...flatBaseline(60), ...thisWeek(54)]
    renderCard({ log, profile: { raceDate: isoOffset(10) } })
    const card = document.querySelector('[data-taper-compliance-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-compliance')).toBe('UNDERCUT')
    // Orange border-left = UNDERCUT (jsdom normalises hex → rgb)
    expect(card.style.borderLeft).toMatch(/rgb\(255,\s*102,\s*0\)/i)
    expect(screen.getByText(/TAPER COMPLIANCE/)).toBeInTheDocument()
    expect(screen.getByText(/Cut volume more this week/)).toBeInTheDocument()
    // Expected vs actual surfaces
    expect(document.querySelector('[data-expected-cut]').textContent).toBe('30%')
    expect(document.querySelector('[data-actual-cut]')).not.toBeNull()
  })

  it('renders the warning for OVERCUT with red accent', () => {
    // Baseline 7×60 = 420 min/wk at 5 days out (expected 50%);
    // 70% cut → 7×18 = 126 min this week
    const log = [...flatBaseline(60), ...thisWeek(18)]
    renderCard({ log, profile: { raceDate: isoOffset(5) } })
    const card = document.querySelector('[data-taper-compliance-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-compliance')).toBe('OVERCUT')
    expect(card.style.borderLeft).toMatch(/rgb\(224,\s*48,\s*48\)/i)
    expect(screen.getByText(/risk of detraining/)).toBeInTheDocument()
  })

  it('renders Turkish heading "POTA UYUMU" when lang=tr', () => {
    const log = [...flatBaseline(60), ...thisWeek(54)]
    renderCard({ log, profile: { raceDate: isoOffset(10) } }, 'tr')
    const card = document.querySelector('[data-taper-compliance-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('aria-label')).toMatch(/Pota uyum/i)
    expect(screen.getByText(/POTA UYUMU/)).toBeInTheDocument()
    expect(screen.getByText(/YARIŞA GÜN/)).toBeInTheDocument()
  })
})
