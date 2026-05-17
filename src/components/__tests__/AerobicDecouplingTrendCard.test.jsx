// @vitest-environment jsdom
// ─── AerobicDecouplingTrendCard.test.jsx — Dashboard surface tests ──────────
//
// Covers: empty/null log, insufficient samples, coupled trend (green),
// mild trend (blue), poor trend (orange), data-decoupling-band anchor,
// and Turkish heading rendering.
//
// We freeze the system clock so `analyzeDecouplingTrend(log)` (called
// without a `today` arg) sees a deterministic "today" relative to the
// log dates synthesized by `daysAgo()`.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import AerobicDecouplingTrendCard from '../dashboard/AerobicDecouplingTrendCard.jsx'

const TODAY = '2026-05-14'

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function daysAgo(n) {
  const d = new Date(`${TODAY}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function aerobic(n, decouplingPct, rpe = 5) {
  return { date: daysAgo(n), rpe, tss: 60, type: 'Easy', decouplingPct }
}

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <AerobicDecouplingTrendCard log={log} />
    </LangCtx.Provider>
  )
}

describe('AerobicDecouplingTrendCard — guards', () => {
  it('renders nothing for an empty log', () => {
    const { container } = renderCard([])
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-aerobic-decoupling-trend-card]')).toBeNull()
  })

  it('renders nothing when analyzeDecouplingTrend returns null (non-array log)', () => {
    const { container } = renderCard(null)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when fewer than 3 aerobic samples are available', () => {
    // 2 valid aerobic samples → analyzer flags but card requires ≥3
    const log = [aerobic(1, 8), aerobic(3, 6)]
    const { container } = renderCard(log)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when only high-RPE (non-aerobic) sessions exist', () => {
    const log = [
      aerobic(1, 8, 8),
      aerobic(3, 7, 9),
      aerobic(5, 9, 8),
    ]
    const { container } = renderCard(log)
    expect(container.firstChild).toBeNull()
  })
})

describe('AerobicDecouplingTrendCard — coupled (good) trend', () => {
  it('renders with COUPLED band when avg drift < 5%', () => {
    const log = [aerobic(1, 3), aerobic(3, 4), aerobic(5, 2)]
    renderCard(log)
    const card = document.querySelector('[data-aerobic-decoupling-trend-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-decoupling-band')).toBe('COUPLED')
    const region = screen.getByRole('region', { name: /Aerobic decoupling trend/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/AEROBIC DECOUPLING/i)
    expect(region.textContent).toMatch(/3\.0%/)
    expect(region.textContent).toMatch(/Friel 2014/)
    expect(region.textContent).toMatch(/Coggan/)
  })
})

describe('AerobicDecouplingTrendCard — mild trend', () => {
  it('renders with MILD band when avg drift is 5–10%', () => {
    const log = [aerobic(1, 6), aerobic(3, 7), aerobic(5, 8)]
    renderCard(log)
    const card = document.querySelector('[data-aerobic-decoupling-trend-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-decoupling-band')).toBe('MILD')
    expect(card.textContent).toMatch(/7\.0%/)
  })
})

describe('AerobicDecouplingTrendCard — poor trend', () => {
  it('renders with POOR band when avg drift ≥ 10%', () => {
    const log = [aerobic(1, 12), aerobic(3, 15), aerobic(5, 11)]
    renderCard(log)
    const card = document.querySelector('[data-aerobic-decoupling-trend-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-decoupling-band')).toBe('POOR')
    // avg = 12.666... → toFixed(1) = '12.7'
    expect(card.textContent).toMatch(/12\.7%/)
    // Hint should reference rebuilding the aerobic base
    expect(card.textContent).toMatch(/rebuilding|deliberate/i)
  })

  it('renders one chip per included sample with per-session band attribute', () => {
    const log = [aerobic(1, 12), aerobic(3, 4), aerobic(5, 8)]
    renderCard(log)
    const chips = document.querySelectorAll('[data-decoupling-chip]')
    expect(chips.length).toBe(3)
    const bands = Array.from(chips).map(c => c.getAttribute('data-chip-band'))
    expect(bands).toEqual(expect.arrayContaining(['POOR', 'COUPLED', 'MILD']))
  })
})

describe('AerobicDecouplingTrendCard — bilingual', () => {
  it('renders the Turkish heading when lang=tr', () => {
    const log = [aerobic(1, 6), aerobic(3, 7), aerobic(5, 8)]
    renderCard(log, 'tr')
    const region = screen.getByRole('region', { name: /Aerobik bozulma/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/AEROBİK BOZULMA · 14G/)
    // Mild → Turkish band label "HAFİF"
    expect(region.textContent).toMatch(/HAFİF/)
    // Turkish interpretation hint for MILD band
    expect(region.textContent).toMatch(/Z2 hacmini artır/)
  })
})
