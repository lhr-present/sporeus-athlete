// @vitest-environment jsdom
// ─── PeakWeekFrequencyCard.test.jsx — render tests ──────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import PeakWeekFrequencyCard from '../dashboard/PeakWeekFrequencyCard.jsx'

// ─── Anchored time: today = Wed 2026-04-29 → current-week Mon = 2026-04-27 ──
beforeEach(() => { vi.setSystemTime(new Date('2026-04-29T12:00:00Z')) })
afterEach(()  => { vi.setSystemTime(new Date()) })

const CURRENT_WEEK_MONDAY = '2026-04-27'

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Last element corresponds to (currentWeekMonday - 7 days). */
function makeWeeklyLog(weeklyTssArray) {
  const lastMonday = addDays(CURRENT_WEEK_MONDAY, -7)
  const firstMonday = addDays(lastMonday, -7 * (weeklyTssArray.length - 1))
  const log = []
  for (let i = 0; i < weeklyTssArray.length; i++) {
    const tss = weeklyTssArray[i]
    if (tss <= 0) continue
    log.push({ date: addDays(firstMonday, i * 7), tss, type: 'run' })
  }
  return log
}

function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <PeakWeekFrequencyCard {...props} />
    </LangCtx.Provider>
  )
}

// ─── Fixtures ───────────────────────────────────────────────────────────────
// NO_BLOCK: peak (1000) is 40 weeks back (outside 26-week lookback); 8 low
// weeks recently → 0 near-peak weeks in lookback.
const NO_BLOCK_LOG = [
  { date: addDays(CURRENT_WEEK_MONDAY, -7 * 40), tss: 1000, type: 'run' },
  ...makeWeeklyLog([100, 100, 100, 100, 100, 100, 100, 100]),
]

// SPARSE: 1 near-peak week (peak itself in lookback).
const SPARSE_LOG = makeWeeklyLog([100, 100, 100, 100, 100, 100, 100, 1000])

// BLOCK_DENSITY: 3 near-peak weeks.
const BLOCK_DENSITY_LOG = makeWeeklyLog(
  [100, 100, 100, 100, 100, 920, 950, 1000]
)

// PEAK_PHASE: 7 near-peak weeks.
const PEAK_PHASE_LOG = makeWeeklyLog([
  100, 100, 100, 100, 100,
  905, 910, 920, 930, 940, 950, 1000,
])

// ─── 1. Null gates ─────────────────────────────────────────────────────────
describe('PeakWeekFrequencyCard — renders null on insufficient data', () => {
  it('renders nothing for empty log', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for <8 distinct weeks', () => {
    const log = makeWeeklyLog([100, 200, 300, 400, 500, 600, 700]) // 7 weeks
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when log prop is missing', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })
})

// ─── 2. Band rendering (English) ───────────────────────────────────────────
describe('PeakWeekFrequencyCard — band rendering (en)', () => {
  it('NO_BLOCK: badge + hint', () => {
    renderCard({ log: NO_BLOCK_LOG })
    expect(screen.getByText('NO BLOCK')).toBeInTheDocument()
    expect(screen.getByText(/No near-peak weeks/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-peak-band')).toBe('NO_BLOCK')
    expect(region.getAttribute('data-near-peak-week-count')).toBe('0')
  })

  it('SPARSE: badge + hint', () => {
    renderCard({ log: SPARSE_LOG })
    expect(screen.getByText('SPARSE')).toBeInTheDocument()
    expect(screen.getByText(/few near-peak weeks/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-peak-band')).toBe('SPARSE')
    expect(region.getAttribute('data-near-peak-week-count')).toBe('1')
  })

  it('BLOCK_DENSITY: badge + hint', () => {
    renderCard({ log: BLOCK_DENSITY_LOG })
    expect(screen.getByText('BLOCK DENSITY')).toBeInTheDocument()
    expect(screen.getByText(/genuine build block/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-peak-band')).toBe('BLOCK_DENSITY')
    expect(region.getAttribute('data-near-peak-week-count')).toBe('3')
  })

  it('PEAK_PHASE: badge + hint', () => {
    renderCard({ log: PEAK_PHASE_LOG })
    expect(screen.getByText('PEAK PHASE')).toBeInTheDocument()
    expect(screen.getByText(/Sustained near-peak training/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-peak-band')).toBe('PEAK_PHASE')
    expect(region.getAttribute('data-near-peak-week-count')).toBe('7')
  })
})

// ─── 3. Bilingual (Turkish) ────────────────────────────────────────────────
describe('PeakWeekFrequencyCard — Turkish', () => {
  it('renders Turkish title', () => {
    renderCard({ log: SPARSE_LOG }, 'tr')
    expect(screen.getByText('ZİRVE HAFTA SIKLIĞI')).toBeInTheDocument()
  })

  it('renders English title', () => {
    renderCard({ log: SPARSE_LOG })
    expect(screen.getByText('PEAK-WEEK FREQUENCY')).toBeInTheDocument()
  })

  it('renders Turkish band badges', () => {
    renderCard({ log: NO_BLOCK_LOG }, 'tr')
    expect(screen.getByText('BLOK YOK')).toBeInTheDocument()
  })

  it('renders Turkish BLOCK_DENSITY badge', () => {
    renderCard({ log: BLOCK_DENSITY_LOG }, 'tr')
    expect(screen.getByText('BLOK YOĞUNLUĞU')).toBeInTheDocument()
  })

  it('renders Turkish PEAK_PHASE hint', () => {
    renderCard({ log: PEAK_PHASE_LOG }, 'tr')
    expect(screen.getByText(/Sürekli zirveye yakın antrenman/i)).toBeInTheDocument()
  })
})

// ─── 4. Lifetime peak display ──────────────────────────────────────────────
describe('PeakWeekFrequencyCard — lifetime peak display', () => {
  it('shows lifetime peak TSS + week start date (en)', () => {
    renderCard({ log: SPARSE_LOG })
    expect(screen.getByText(/Lifetime peak: 1000 TSS ·/i)).toBeInTheDocument()
  })

  it('shows near-peak threshold label', () => {
    renderCard({ log: SPARSE_LOG })
    // 90% of 1000 = 900
    expect(screen.getByText(/Near-peak = ≥900 TSS/i)).toBeInTheDocument()
  })

  it('shows Turkish lifetime peak phrasing', () => {
    renderCard({ log: SPARSE_LOG }, 'tr')
    expect(screen.getByText(/Tüm zamanların zirvesi: 1000 TSS ·/i)).toBeInTheDocument()
  })

  it('shows the "of N weeks at peak level" phrasing', () => {
    renderCard({ log: SPARSE_LOG })
    expect(screen.getByText(/of 26 weeks at peak level/i)).toBeInTheDocument()
  })
})

// ─── 5. A11y + data anchors ────────────────────────────────────────────────
describe('PeakWeekFrequencyCard — a11y + data anchors', () => {
  it('exposes role="region" with English aria-label', () => {
    renderCard({ log: SPARSE_LOG })
    const region = screen.getByRole('region')
    expect(region.getAttribute('aria-label')).toMatch(/near-peak weeks/i)
  })

  it('exposes role="region" with Turkish aria-label', () => {
    renderCard({ log: SPARSE_LOG }, 'tr')
    const region = screen.getByRole('region')
    expect(region.getAttribute('aria-label')).toMatch(/zirve seviyesine yakın/i)
  })

  it('exposes data-card="peak-week-frequency" on root', () => {
    renderCard({ log: SPARSE_LOG })
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-card')).toBe('peak-week-frequency')
  })

  it('exposes all numeric data attributes on root', () => {
    renderCard({ log: BLOCK_DENSITY_LOG })
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-peak-band')).toBe('BLOCK_DENSITY')
    expect(region.getAttribute('data-near-peak-week-count')).toBe('3')
    expect(region.getAttribute('data-lookback-weeks')).toBe('26')
    expect(region.getAttribute('data-lifetime-peak-tss')).toBe('1000')
    expect(region.getAttribute('data-near-peak-threshold')).toBe('900')
  })

  it('renders 26 weekly mini-bars (chart present)', () => {
    const { container } = renderCard({ log: SPARSE_LOG })
    const rects = container.querySelectorAll('rect[data-week-start]')
    expect(rects.length).toBe(26)
  })

  it('renders citation footer', () => {
    renderCard({ log: SPARSE_LOG })
    expect(screen.getByText(/Issurin 2010; Bompa 2018/)).toBeInTheDocument()
  })
})
