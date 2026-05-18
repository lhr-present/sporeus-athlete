// @vitest-environment jsdom
// ─── AverageWeekShapeCard.test.jsx — render tests ────────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import AverageWeekShapeCard from '../dashboard/AverageWeekShapeCard.jsx'

// ─── Anchored time: today=Mon 2026-04-27, prev-Sun=2026-04-26, win=2026-03-02 ──
beforeEach(() => { vi.setSystemTime(new Date('2026-04-27T12:00:00Z')) })
afterEach(()  => { vi.setSystemTime(new Date()) })

const WINDOW_START = '2026-03-02' // Monday

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function makeWeeklyLog(pattern, weeks = 8) {
  const log = []
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const tss = pattern[d]
      if (tss > 0) {
        log.push({ date: addDays(WINDOW_START, w * 7 + d), tss, type: 'run' })
      }
    }
  }
  return log
}

function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <AverageWeekShapeCard {...props} />
    </LangCtx.Provider>
  )
}

// Fixtures matching pure-fn tests
const WEEKEND_LOG  = makeWeeklyLog([30, 30, 30, 30, 30, 150, 120])
const MIDWEEK_LOG  = makeWeeklyLog([20, 20, 80, 80, 30, 10, 10])
const EVENLY_LOG   = makeWeeklyLog([60, 55, 65, 60, 55, 60, 65])
const POLARIZED_LOG = makeWeeklyLog([140, 140, 50, 0, 0, 50, 0])
const MIXED_LOG    = makeWeeklyLog([80, 80, 50, 50, 90, 40, 20])

// ─── 1. Null cases (render-null) ────────────────────────────────────────────
describe('AverageWeekShapeCard — renders null on insufficient data', () => {
  it('renders nothing for empty log', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for <4 active weeks', () => {
    const log = [
      { date: addDays(WINDOW_START, 0), tss: 60, type: 'run' },
      { date: addDays(WINDOW_START, 7), tss: 60, type: 'run' },
      { date: addDays(WINDOW_START, 14), tss: 60, type: 'run' },
    ]
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when log prop is missing', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })
})

// ─── 2. Pattern rendering ────────────────────────────────────────────────────
describe('AverageWeekShapeCard — renders each pattern', () => {
  it('WEEKEND_HEAVY badge + hint (en)', () => {
    renderCard({ log: WEEKEND_LOG })
    expect(screen.getByText('WEEKEND HEAVY')).toBeInTheDocument()
    expect(screen.getByText(/Long sessions stacked on weekends/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-week-shape-pattern')).toBe('WEEKEND_HEAVY')
  })

  it('MIDWEEK_HEAVY badge + hint (en)', () => {
    renderCard({ log: MIDWEEK_LOG })
    expect(screen.getByText('MIDWEEK HEAVY')).toBeInTheDocument()
    expect(screen.getByText(/Quality work mid-week/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-week-shape-pattern')).toBe('MIDWEEK_HEAVY')
  })

  it('EVENLY_DISTRIBUTED badge + hint (en)', () => {
    renderCard({ log: EVENLY_LOG })
    expect(screen.getByText('EVENLY DISTRIBUTED')).toBeInTheDocument()
    expect(screen.getByText(/Steady microcycle/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-week-shape-pattern')).toBe('EVENLY_DISTRIBUTED')
  })

  it('POLARIZED badge + hint (en)', () => {
    renderCard({ log: POLARIZED_LOG })
    expect(screen.getByText('POLARIZED')).toBeInTheDocument()
    expect(screen.getByText(/Hard-easy rhythm/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-week-shape-pattern')).toBe('POLARIZED')
  })

  it('MIXED badge + hint (en)', () => {
    renderCard({ log: MIXED_LOG })
    expect(screen.getByText('MIXED')).toBeInTheDocument()
    expect(screen.getByText(/No dominant pattern/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-week-shape-pattern')).toBe('MIXED')
  })
})

// ─── 3. Bilingual (Turkish) ─────────────────────────────────────────────────
describe('AverageWeekShapeCard — Turkish labels', () => {
  it('renders Turkish title and pattern label for WEEKEND_HEAVY', () => {
    renderCard({ log: WEEKEND_LOG }, 'tr')
    expect(screen.getByText('TİPİK HAFTA · 8H')).toBeInTheDocument()
    expect(screen.getByText('HAFTA SONU AĞIR')).toBeInTheDocument()
    expect(screen.getByText(/hafta sonuna yığılmış/i)).toBeInTheDocument()
  })

  it('renders Turkish MIDWEEK_HEAVY label', () => {
    renderCard({ log: MIDWEEK_LOG }, 'tr')
    expect(screen.getByText('HAFTA ORTASI AĞIR')).toBeInTheDocument()
  })

  it('renders Turkish EVENLY_DISTRIBUTED label', () => {
    renderCard({ log: EVENLY_LOG }, 'tr')
    expect(screen.getByText('DENGELİ')).toBeInTheDocument()
  })

  it('renders Turkish POLARIZED label', () => {
    renderCard({ log: POLARIZED_LOG }, 'tr')
    expect(screen.getByText('POLARİZE')).toBeInTheDocument()
  })

  it('renders Turkish MIXED label', () => {
    renderCard({ log: MIXED_LOG }, 'tr')
    expect(screen.getByText('KARIŞIK')).toBeInTheDocument()
  })

  it('renders English title in EN mode', () => {
    renderCard({ log: WEEKEND_LOG })
    expect(screen.getByText('TYPICAL WEEK · 8W')).toBeInTheDocument()
  })
})

// ─── 4. Day labels under chart ──────────────────────────────────────────────
describe('AverageWeekShapeCard — day labels', () => {
  it('renders MON-SUN day labels in English', () => {
    renderCard({ log: WEEKEND_LOG })
    expect(screen.getByText('MON')).toBeInTheDocument()
    expect(screen.getByText('TUE')).toBeInTheDocument()
    expect(screen.getByText('WED')).toBeInTheDocument()
    expect(screen.getByText('THU')).toBeInTheDocument()
    expect(screen.getByText('FRI')).toBeInTheDocument()
    expect(screen.getByText('SAT')).toBeInTheDocument()
    expect(screen.getByText('SUN')).toBeInTheDocument()
  })

  it('renders PZT-PAZ day labels in Turkish', () => {
    renderCard({ log: WEEKEND_LOG }, 'tr')
    expect(screen.getByText('PZT')).toBeInTheDocument()
    expect(screen.getByText('SAL')).toBeInTheDocument()
    expect(screen.getByText('ÇAR')).toBeInTheDocument()
    expect(screen.getByText('PER')).toBeInTheDocument()
    expect(screen.getByText('CUM')).toBeInTheDocument()
    expect(screen.getByText('CMT')).toBeInTheDocument()
    expect(screen.getByText('PAZ')).toBeInTheDocument()
  })
})

// ─── 5. Data anchors + a11y ─────────────────────────────────────────────────
describe('AverageWeekShapeCard — data anchors + a11y', () => {
  it('exposes role="region" with bilingual aria-label (en)', () => {
    renderCard({ log: WEEKEND_LOG })
    const region = screen.getByRole('region')
    expect(region.getAttribute('aria-label')).toMatch(/Typical week shape/i)
  })

  it('exposes role="region" with Turkish aria-label (tr)', () => {
    renderCard({ log: WEEKEND_LOG }, 'tr')
    const region = screen.getByRole('region')
    expect(region.getAttribute('aria-label')).toMatch(/Tipik hafta şekli/i)
  })

  it('exposes data-average-week-shape-card on root', () => {
    renderCard({ log: WEEKEND_LOG })
    const region = screen.getByRole('region')
    expect(region.hasAttribute('data-average-week-shape-card')).toBe(true)
  })

  it('exposes data-peak-day and data-rest-day on root', () => {
    renderCard({ log: WEEKEND_LOG })
    const region = screen.getByRole('region')
    // Peak day = Sat = index 5
    expect(region.getAttribute('data-peak-day')).toBe('5')
    // Rest day = lowest, all weekdays equal at 30 → first min = Mon (0)
    expect(region.getAttribute('data-rest-day')).toBe('0')
  })

  it('renders 7 bars with data-day-bar + data-day-index + data-day-avg-tss', () => {
    const { container } = renderCard({ log: EVENLY_LOG })
    const bars = container.querySelectorAll('[data-day-bar]')
    expect(bars.length).toBe(7)
    // Confirm each bar carries the correct day index and avg-tss
    bars.forEach((bar, i) => {
      expect(bar.getAttribute('data-day-index')).toBe(String(i))
      expect(bar.hasAttribute('data-day-avg-tss')).toBe(true)
    })
  })

  it('renders citation footer', () => {
    renderCard({ log: WEEKEND_LOG })
    expect(screen.getByText(/Bompa 2018; Issurin 2010/)).toBeInTheDocument()
  })
})
