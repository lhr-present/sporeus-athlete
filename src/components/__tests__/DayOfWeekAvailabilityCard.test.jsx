// @vitest-environment jsdom
// ─── DayOfWeekAvailabilityCard.test.jsx — render tests ──────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import DayOfWeekAvailabilityCard from '../dashboard/DayOfWeekAvailabilityCard.jsx'

// today=Mon 2026-04-27 → Mon-of-week=2026-04-27 →
// 12-week window: 2026-02-09 (Mon) through 2026-05-03 (Sun)
beforeEach(() => { vi.setSystemTime(new Date('2026-04-27T12:00:00Z')) })
afterEach(()  => { vi.setSystemTime(new Date()) })

const WINDOW_START = '2026-02-09' // Monday

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function makeLogByDayCount(weeksByDay, weeks = 12, tss = 60) {
  const log = []
  for (let d = 0; d < 7; d++) {
    const n = Math.min(weeksByDay[d], weeks)
    for (let w = 0; w < n; w++) {
      log.push({ date: addDays(WINDOW_START, w * 7 + d), tss, type: 'run' })
    }
  }
  return log
}

function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <DayOfWeekAvailabilityCard {...props} />
    </LangCtx.Provider>
  )
}

// Fixtures matching pure-fn tests
const STRUCTURED_LOG    = makeLogByDayCount([12, 12, 12, 6, 12, 6, 2])
const OPPORTUNISTIC_LOG = makeLogByDayCount([6, 6, 6, 6, 6, 6, 6])

// SPARSE: 1 session per weekday across 7 distinct weeks
const SPARSE_LOG = (() => {
  const log = []
  for (let w = 0; w < 7; w++) {
    log.push({ date: addDays(WINDOW_START, w * 7 + w), tss: 60, type: 'run' })
  }
  return log
})()

// ─── 1. Null cases (render-null) ────────────────────────────────────────────
describe('DayOfWeekAvailabilityCard — renders null on insufficient data', () => {
  it('renders nothing for empty log', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for <6 active weeks', () => {
    const log = []
    for (let w = 0; w < 5; w++) {
      log.push({ date: addDays(WINDOW_START, w * 7), tss: 60, type: 'run' })
    }
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when log prop is missing', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })
})

// ─── 2. Pattern rendering ────────────────────────────────────────────────────
describe('DayOfWeekAvailabilityCard — renders each pattern', () => {
  it('STRUCTURED badge + hint (en)', () => {
    renderCard({ log: STRUCTURED_LOG })
    expect(screen.getByText('STRUCTURED')).toBeInTheDocument()
    expect(screen.getByText(/Clear weekly pattern/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-availability-pattern')).toBe('STRUCTURED')
  })

  it('OPPORTUNISTIC badge + hint (en)', () => {
    renderCard({ log: OPPORTUNISTIC_LOG })
    expect(screen.getByText('OPPORTUNISTIC')).toBeInTheDocument()
    expect(screen.getByText(/Training opportunistically/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-availability-pattern')).toBe('OPPORTUNISTIC')
  })

  it('SPARSE badge + hint (en)', () => {
    renderCard({ log: SPARSE_LOG })
    expect(screen.getByText('SPARSE')).toBeInTheDocument()
    expect(screen.getByText(/Low overall training frequency/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-availability-pattern')).toBe('SPARSE')
  })
})

// ─── 3. Bilingual (Turkish) ─────────────────────────────────────────────────
describe('DayOfWeekAvailabilityCard — Turkish labels', () => {
  it('renders Turkish title and STRUCTURED label', () => {
    renderCard({ log: STRUCTURED_LOG }, 'tr')
    expect(screen.getByText('HAFTA GÜNÜ MÜSAİTLİK · 12H')).toBeInTheDocument()
    expect(screen.getByText('YAPILI')).toBeInTheDocument()
    expect(screen.getByText(/Net haftalık desen/i)).toBeInTheDocument()
  })

  it('renders Turkish OPPORTUNISTIC label', () => {
    renderCard({ log: OPPORTUNISTIC_LOG }, 'tr')
    expect(screen.getByText('FIRSAT')).toBeInTheDocument()
    expect(screen.getByText(/Fırsata göre antrenman/i)).toBeInTheDocument()
  })

  it('renders Turkish SPARSE label', () => {
    renderCard({ log: SPARSE_LOG }, 'tr')
    expect(screen.getByText('SEYREK')).toBeInTheDocument()
    expect(screen.getByText(/Düşük genel antrenman frekansı/i)).toBeInTheDocument()
  })

  it('renders English title in EN mode', () => {
    renderCard({ log: STRUCTURED_LOG })
    expect(screen.getByText('DAY-OF-WEEK AVAILABILITY · 12W')).toBeInTheDocument()
  })

  it('renders PZT-PAZ day labels in Turkish', () => {
    renderCard({ log: STRUCTURED_LOG }, 'tr')
    expect(screen.getByText('PZT')).toBeInTheDocument()
    expect(screen.getByText('SAL')).toBeInTheDocument()
    expect(screen.getByText('ÇAR')).toBeInTheDocument()
    expect(screen.getByText('PER')).toBeInTheDocument()
    expect(screen.getByText('CUM')).toBeInTheDocument()
    expect(screen.getByText('CMT')).toBeInTheDocument()
    expect(screen.getByText('PAZ')).toBeInTheDocument()
  })

  it('renders MON-SUN day labels in English', () => {
    renderCard({ log: STRUCTURED_LOG })
    expect(screen.getByText('MON')).toBeInTheDocument()
    expect(screen.getByText('TUE')).toBeInTheDocument()
    expect(screen.getByText('WED')).toBeInTheDocument()
    expect(screen.getByText('THU')).toBeInTheDocument()
    expect(screen.getByText('FRI')).toBeInTheDocument()
    expect(screen.getByText('SAT')).toBeInTheDocument()
    expect(screen.getByText('SUN')).toBeInTheDocument()
  })
})

// ─── 4. Data anchors + a11y ─────────────────────────────────────────────────
describe('DayOfWeekAvailabilityCard — data anchors + a11y', () => {
  it('exposes role="region" with bilingual aria-label (en)', () => {
    renderCard({ log: STRUCTURED_LOG })
    const region = screen.getByRole('region')
    expect(region.getAttribute('aria-label')).toMatch(/Day-of-week availability/i)
  })

  it('exposes role="region" with Turkish aria-label (tr)', () => {
    renderCard({ log: STRUCTURED_LOG }, 'tr')
    const region = screen.getByRole('region')
    expect(region.getAttribute('aria-label')).toMatch(/Hafta günü müsaitlik/i)
  })

  it('exposes data-day-of-week-availability-card on root', () => {
    renderCard({ log: STRUCTURED_LOG })
    const region = screen.getByRole('region')
    expect(region.hasAttribute('data-day-of-week-availability-card')).toBe(true)
  })

  it('exposes data-availability-pattern + data-average-rate + counts on root', () => {
    renderCard({ log: STRUCTURED_LOG })
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-availability-pattern')).toBe('STRUCTURED')
    expect(region.hasAttribute('data-average-rate')).toBe(true)
    // STRUCTURED fixture: Mon/Tue/Wed/Fri = 12/12 anchors → 4 anchors
    expect(region.getAttribute('data-anchor-day-count')).toBe('4')
    // Sun = 2/12 ≈ 0.167 → weak
    expect(Number(region.getAttribute('data-weak-day-count'))).toBeGreaterThanOrEqual(1)
  })

  it('renders 7 bars with all per-bar data anchors', () => {
    const { container } = renderCard({ log: STRUCTURED_LOG })
    const bars = container.querySelectorAll('[data-day-bar]')
    expect(bars.length).toBe(7)
    bars.forEach((bar, i) => {
      expect(bar.getAttribute('data-day-index')).toBe(String(i))
      expect(bar.hasAttribute('data-day-rate')).toBe(true)
      expect(bar.hasAttribute('data-day-count')).toBe(true)
      expect(bar.hasAttribute('data-is-anchor')).toBe(true)
      expect(bar.hasAttribute('data-is-weak')).toBe(true)
    })
    // Mon (idx 0) is an anchor in STRUCTURED fixture
    expect(bars[0].getAttribute('data-is-anchor')).toBe('true')
    // Sun (idx 6) is a weak day in STRUCTURED fixture
    expect(bars[6].getAttribute('data-is-weak')).toBe('true')
  })

  it('renders citation footer', () => {
    renderCard({ log: STRUCTURED_LOG })
    expect(screen.getByText(/Bompa 2018; Issurin 2010/)).toBeInTheDocument()
  })
})
