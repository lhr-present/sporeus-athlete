// @vitest-environment jsdom
// ─── FitnessGainRateCard.test.jsx — render tests for the 28d CTL-slope card ──
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import FitnessGainRateCard from '../dashboard/FitnessGainRateCard.jsx'

// ─── Render helper with overridable lang ─────────────────────────────────────
function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <FitnessGainRateCard {...props} />
    </LangCtx.Provider>
  )
}

// ─── Synthetic log builders (dates anchored to "today") ──────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Build `days` log entries ending today. `tssOf` is either a number (constant)
 * or a function (dayIndex 0..days-1, oldest→newest) → tss.
 */
function buildLog(days, tssOf) {
  const today = todayStr()
  const log = []
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i)
    const idx = days - 1 - i // oldest day index = 0
    const tss = typeof tssOf === 'function' ? tssOf(idx) : tssOf
    log.push({ date, tss, type: 'run', duration: 60 })
  }
  return log
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('FitnessGainRateCard — empty / unreliable states', () => {
  it('renders empty state for empty log', () => {
    renderCard({ log: [] })
    expect(screen.getByText(/Log 21\+ days of training to see fitness trajectory/i))
      .toBeInTheDocument()
  })

  it('renders empty state for 14-day log (unreliable < 21 days)', () => {
    const log = buildLog(14, 100)
    renderCard({ log })
    expect(screen.getByText(/Log 21\+ days of training to see fitness trajectory/i))
      .toBeInTheDocument()
  })

  it('renders TR empty-state copy when lang=tr', () => {
    renderCard({ log: [] }, 'tr')
    expect(screen.getByText(/Form trajektorisini görmek için 21\+ gün antrenman kaydet/i))
      .toBeInTheDocument()
  })
})

describe('FitnessGainRateCard — reliable states', () => {
  it('renders MAINTAINING band for 200-day flat-100 log (CTL ~steady)', () => {
    // Long flat history → CTL converges to ~100 → near-zero slope → maintaining
    const log = buildLog(200, 100)
    renderCard({ log })
    expect(screen.getByText('MAINTAINING')).toBeInTheDocument()
  })

  it('renders a positive slope for 28-day rising-TSS log (50→150)', () => {
    // Rising training → CTL ramping → positive slope (band: building or spiking)
    const log = buildLog(28, i => 50 + (i * 100) / 27)
    renderCard({ log })
    // Slope label combines band + signed value + unit (positive case → starts with +)
    const slopeNode = screen.getByLabelText(/(BUILDING|SPIKING) \+\d+\.\d{2} CTL per week/i)
    expect(slopeNode).toBeInTheDocument()
    // Either building or spiking band badge visible
    const hasBand = !!screen.queryByText('BUILDING') || !!screen.queryByText('SPIKING')
    expect(hasBand).toBe(true)
  })

  it('renders DETRAINING band for 200-day log dropping in last 28 days', () => {
    // 172 days flat-200 then 28-day decline 200→0 → strongly negative slope
    const log = buildLog(200, i => (i < 172 ? 200 : Math.max(0, 200 - (i - 172) * 8)))
    renderCard({ log })
    expect(screen.getByText('DETRAINING')).toBeInTheDocument()
    // Slope aria-label carries a negative signed value
    expect(screen.getByLabelText(/DETRAINING -\d+\.\d{2} CTL per week/i)).toBeInTheDocument()
  })

  it('renders BUILDING band for 200-day log with mild ramp in last 28 days', () => {
    // Gentle ramp (+0.2/day) → slope/week ≈ 0.58 → building
    const log = buildLog(200, i => (i < 172 ? 100 : 100 + (i - 172) * 0.2))
    renderCard({ log })
    expect(screen.getByText('BUILDING')).toBeInTheDocument()
  })

  it('renders the slope value with sign + CTL/week unit', () => {
    const log = buildLog(200, 100)
    renderCard({ log })
    // Unit text appears as the standalone "CTL/week" label inside the slope element
    expect(screen.getByText('CTL/week')).toBeInTheDocument()
    // Slope aria-label exposes a signed value followed by " CTL per week"
    expect(screen.getByLabelText(/MAINTAINING [+-]?\d+\.\d{2} CTL per week/i)).toBeInTheDocument()
  })

  it('renders CTL endpoints in "X → Y" format', () => {
    const log = buildLog(200, 100)
    renderCard({ log })
    // "CTL: 98.4 → 99.1" style — match the prefix and the arrow
    expect(screen.getByText(/^CTL:/)).toBeInTheDocument()
    expect(screen.getByText(/→/)).toBeInTheDocument()
  })

  it('renders R² as a fit-quality indicator (EN)', () => {
    const log = buildLog(200, 100)
    renderCard({ log })
    expect(screen.getByText(/Fit quality:\s*\d\.\d{2}/i)).toBeInTheDocument()
  })

  it('renders TR labels when lang=tr (FORM KAZANIM ORANI title + Uyum kalitesi)', () => {
    const log = buildLog(200, 100)
    renderCard({ log }, 'tr')
    expect(screen.getByText(/FORM KAZANIM ORANI — 28G/i)).toBeInTheDocument()
    expect(screen.getByText(/Uyum kalitesi:\s*\d\.\d{2}/i)).toBeInTheDocument()
    expect(screen.getByText('KORUMA')).toBeInTheDocument()
    expect(screen.getByText(/CTL\/hafta/i)).toBeInTheDocument()
  })
})

describe('FitnessGainRateCard — a11y + citation', () => {
  it('card root has role=region with bilingual aria-label', () => {
    const log = buildLog(200, 100)
    renderCard({ log })
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('aria-label')).toMatch(/Fitness gain rate/i)
  })

  it('renders the Banister/Coggan citation footer', () => {
    const log = buildLog(200, 100)
    renderCard({ log })
    expect(screen.getByText(/Banister 1991; Coggan PMC/)).toBeInTheDocument()
  })
})
