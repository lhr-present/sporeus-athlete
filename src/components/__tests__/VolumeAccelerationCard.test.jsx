// @vitest-environment jsdom
// ─── VolumeAccelerationCard.test.jsx — render tests ────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import VolumeAccelerationCard from '../dashboard/VolumeAccelerationCard.jsx'

// Monday 2026-05-18 — `mondayOf(today)` === today.
const TODAY = '2026-05-18'

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
      <VolumeAccelerationCard {...props} />
    </LangCtx.Provider>
  )
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function buildWeeklyLog(weeklyTss, today = TODAY) {
  const log = []
  for (let i = 0; i < 8; i++) {
    const monday = isoMinusDays(today, (7 - i) * 7)
    log.push({ date: monday, tss: weeklyTss[i] })
  }
  return log
}

describe('VolumeAccelerationCard — render gating', () => {
  it('renders NOTHING for an empty log', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders NOTHING when the series is too gappy (>1 zero week)', () => {
    const log = buildWeeklyLog([0, 0, 0, 100, 110, 120, 130, 140])
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })
})

describe('VolumeAccelerationCard — band rendering', () => {
  it('renders STEADY band with green color for constant weekly TSS', () => {
    const log = buildWeeklyLog([300, 300, 300, 300, 300, 300, 300, 300])
    renderCard({ log })
    const card = screen.getByRole('region', { name: /Weekly TSS acceleration/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-acceleration-band')).toBe('STEADY')
    // Green stripe on left border (jsdom serializes #5bc25b → rgb(91, 194, 91))
    expect(card.style.borderLeft).toMatch(/rgb\(91,\s*194,\s*91\)/)
    expect(card.textContent).toMatch(/STEADY/)
    expect(card.textContent).toMatch(/Vetter 2019/)
  })

  it('renders COMPOUNDING_RAMP band with red color when acceleration ≥ 30', () => {
    // Quadratic series: deltas = [20,60,100,140,180,220,260] → accel all +40
    const log = buildWeeklyLog([200, 220, 280, 380, 520, 700, 920, 1180])
    renderCard({ log })
    const card = screen.getByRole('region', { name: /Weekly TSS acceleration/i })
    expect(card.getAttribute('data-acceleration-band')).toBe('COMPOUNDING_RAMP')
    expect(card.style.borderLeft).toMatch(/rgb\(255,\s*68,\s*68\)/)
    expect(card.textContent).toMatch(/COMPOUNDING/)
  })

  it('renders DECELERATING band with blue color when acceleration ≤ -30', () => {
    const log = buildWeeklyLog([100, 360, 580, 760, 900, 1000, 1060, 1080])
    renderCard({ log })
    const card = screen.getByRole('region', { name: /Weekly TSS acceleration/i })
    expect(card.getAttribute('data-acceleration-band')).toBe('DECELERATING')
    expect(card.style.borderLeft).toMatch(/rgb\(0,\s*100,\s*255\)/)
    expect(card.textContent).toMatch(/DECELERATING/)
  })
})

describe('VolumeAccelerationCard — anchors + bilingual', () => {
  it('exposes data anchors for current and prior acceleration', () => {
    const log = buildWeeklyLog([200, 220, 280, 380, 520, 700, 920, 1180])
    renderCard({ log })
    const card = document.querySelector('[data-volume-acceleration-card]')
    expect(card).not.toBeNull()
    expect(Number(card.getAttribute('data-current-acceleration'))).toBeCloseTo(40, 1)
    expect(Number(card.getAttribute('data-prior-acceleration'))).toBeCloseTo(40, 1)
  })

  it('renders one data-week-bar group per weekly bucket with data-week-start/tss/delta', () => {
    const log = buildWeeklyLog([100, 110, 130, 160, 200, 250, 310, 380])
    renderCard({ log })
    const bars = document.querySelectorAll('[data-week-bar]')
    expect(bars).toHaveLength(8)
    // Newest bar's TSS should be 380; oldest 100.
    expect(Number(bars[0].getAttribute('data-week-tss'))).toBeCloseTo(100, 1)
    expect(Number(bars[7].getAttribute('data-week-tss'))).toBeCloseTo(380, 1)
    // Every bar except the oldest carries a delta value.
    expect(bars[0].getAttribute('data-week-delta')).toBe('')
    for (let i = 1; i < bars.length; i++) {
      expect(bars[i].getAttribute('data-week-delta')).not.toBe('')
      expect(bars[i].getAttribute('data-week-start')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('renders Turkish heading and band label when lang=tr', () => {
    const log = buildWeeklyLog([300, 300, 300, 300, 300, 300, 300, 300])
    renderCard({ log }, 'tr')
    expect(screen.getByText(/HACİM İVMESİ · 8H/)).toBeInTheDocument()
    expect(screen.getByText(/SABİT/)).toBeInTheDocument()
  })

  it('renders Turkish COMPOUNDING_RAMP label "İVMELİ"', () => {
    const log = buildWeeklyLog([200, 220, 280, 380, 520, 700, 920, 1180])
    renderCard({ log }, 'tr')
    expect(screen.getByText(/İVMELİ/)).toBeInTheDocument()
  })

  it('renders Turkish DECELERATING label "YAVAŞLIYOR"', () => {
    const log = buildWeeklyLog([100, 360, 580, 760, 900, 1000, 1060, 1080])
    renderCard({ log }, 'tr')
    expect(screen.getByText(/YAVAŞLIYOR/)).toBeInTheDocument()
  })
})
