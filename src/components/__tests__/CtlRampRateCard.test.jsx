// @vitest-environment jsdom
// ─── CtlRampRateCard.test.jsx — render tests for the ramp-rate card ────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import CtlRampRateCard from '../dashboard/CtlRampRateCard.jsx'

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
      <CtlRampRateCard {...props} />
    </LangCtx.Provider>
  )
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// Build a stepped log identical in shape to the pure-fn tests.
function buildSteppedLog({
  today = TODAY,
  baseline = 70,
  priorDays = 200,
  weeklySteps = [70, 70, 70, 70],
}) {
  const weeks = weeklySteps.length
  const log = []
  for (let i = priorDays - 1; i >= 0; i--) {
    log.push({ date: isoMinusDays(today, weeks * 7 + i), tss: baseline })
  }
  for (let k = 0; k < weeks; k++) {
    for (let d = 1; d <= 7; d++) {
      const offsetFromToday = weeks * 7 - (k * 7 + d)
      log.push({ date: isoMinusDays(today, offsetFromToday), tss: weeklySteps[k] })
    }
  }
  return log
}

describe('CtlRampRateCard — render gating', () => {
  it('(a) renders NOTHING for an empty log', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders NOTHING for a too-short log (only a few days)', () => {
    const log = [{ date: TODAY, tss: 80 }]
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })
})

describe('CtlRampRateCard — band rendering', () => {
  it('(b) renders OPTIMAL band with green color', () => {
    const log = buildSteppedLog({
      baseline: 70,
      weeklySteps: [82, 94, 106, 118], // tuned to mean delta ≈ 6.4
    })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /Weekly CTL ramp rate/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-ramp-band')).toBe('OPTIMAL')
    // Green stripe on left border (jsdom serializes hex → rgb)
    expect(card.style.borderLeft).toMatch(/rgb\(91,\s*194,\s*91\)/)
    // Band label visible
    expect(card.textContent).toMatch(/OPTIMAL/)
    // Citation footer
    expect(card.textContent).toMatch(/Gabbett 2016/)
  })

  it('(c) renders HIGH_RISK band with red color', () => {
    const log = buildSteppedLog({
      baseline: 70,
      weeklySteps: [150, 220, 290, 360], // mean ≈ 30+ → HIGH_RISK
    })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /Weekly CTL ramp rate/i })
    expect(card.getAttribute('data-ramp-band')).toBe('HIGH_RISK')
    expect(card.style.borderLeft).toMatch(/rgb\(224,\s*48,\s*48\)/)
    expect(card.textContent).toMatch(/HIGH RISK/)
  })

  it('also renders UNDERTRAINED band (orange) — never silent unless log is too short', () => {
    const log = buildSteppedLog({
      baseline: 70,
      weeklySteps: [70, 70, 70, 70], // flat → rampRate ≈ 0 → UNDERTRAINED
    })
    renderCard({ log })
    const card = screen.getByRole('region', { name: /Weekly CTL ramp rate/i })
    expect(card.getAttribute('data-ramp-band')).toBe('UNDERTRAINED')
    expect(card.style.borderLeft).toMatch(/rgb\(255,\s*102,\s*0\)/)
  })
})

describe('CtlRampRateCard — anchors + bilingual', () => {
  it('(d) data-ramp-band anchor matches the computed band', () => {
    const log = buildSteppedLog({
      baseline: 70,
      weeklySteps: [85, 103, 121, 139], // tuned to mean ≈ 9.1 → AGGRESSIVE
    })
    renderCard({ log })
    const card = document.querySelector('[data-ctl-ramp-rate-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-ramp-band')).toBe('AGGRESSIVE')
  })

  it('(e) renders Turkish heading "CTL ARTIŞ HIZI · 4H" when lang=tr', () => {
    const log = buildSteppedLog({
      baseline: 70,
      weeklySteps: [82, 94, 106, 118], // any band that renders is fine
    })
    renderCard({ log }, 'tr')
    expect(screen.getByText(/CTL ARTIŞ HIZI · 4H/)).toBeInTheDocument()
    // Turkish band label for OPTIMAL is OPTIMUM
    expect(screen.getByText(/OPTIMUM/)).toBeInTheDocument()
  })
})
