// @vitest-environment jsdom
// ─── MaxTssDayPersonalRecordCard.test.jsx — render tests ────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import MaxTssDayPersonalRecordCard from '../dashboard/MaxTssDayPersonalRecordCard.jsx'

// ─── Anchored time ──────────────────────────────────────────────────────────
beforeEach(() => { vi.setSystemTime(new Date('2026-04-29T12:00:00Z')) })
afterEach(()  => { vi.setSystemTime(new Date()) })

const TODAY = '2026-04-29'

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function makeDailyLog(dailyTssArray, { firstDate = '2025-01-01', step = 2, type = 'run' } = {}) {
  const log = []
  for (let i = 0; i < dailyTssArray.length; i++) {
    const tss = dailyTssArray[i]
    if (tss <= 0) continue
    log.push({ date: addDays(firstDate, i * step), tss, type })
  }
  return log
}

function lifetime35Ascending() {
  const arr = []
  for (let i = 0; i < 35; i++) arr.push(100 + i) // 100..134
  return makeDailyLog(arr)
}

function lifetime100() {
  const arr = []
  for (let i = 0; i < 100; i++) arr.push(i + 1)
  return makeDailyLog(arr, { firstDate: '2024-01-01' })
}

function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <MaxTssDayPersonalRecordCard {...props} />
    </LangCtx.Provider>
  )
}

// ─── Fixtures per band ──────────────────────────────────────────────────────
// NEW_RECORD: lifetime peak = 134, recent peak = 200.
const NEW_RECORD_LOG = [
  ...lifetime35Ascending(),
  { date: TODAY, tss: 200, type: 'run' },
]

// TOP_5: lifetime 35 ascending 100..134, recent = 132 → rank 3.
const TOP_5_LOG = [
  ...lifetime35Ascending(),
  { date: TODAY, tss: 132, type: 'run' },
]

// TOP_20_PERCENT: lifetime 1..100, recent = 90 → rank 11, pct 89.
const TOP_20_LOG = [
  ...lifetime100(),
  { date: TODAY, tss: 90, type: 'run' },
]

// TYPICAL: lifetime 1..100, recent = 50 → pct 49.
const TYPICAL_LOG = [
  ...lifetime100(),
  { date: TODAY, tss: 50, type: 'run' },
]

// BELOW_TYPICAL: lifetime 1..100, recent = 10 → pct 9.
const BELOW_TYPICAL_LOG = [
  ...lifetime100(),
  { date: TODAY, tss: 10, type: 'run' },
]

// INSUFFICIENT_HISTORY: only 10 lifetime days + 1 recent.
const INSUFFICIENT_LOG = [
  ...makeDailyLog([100, 110, 120, 130, 140, 150, 160, 170, 180, 190]),
  { date: TODAY, tss: 200, type: 'run' },
]

// ─── 1. Null gate ───────────────────────────────────────────────────────────
describe('MaxTssDayPersonalRecordCard — renders null when analyze returns null', () => {
  it('renders nothing for empty log', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when no recent-window positive-TSS days', () => {
    // Lifetime only (all dates well before recent window). No today entry.
    const { container } = renderCard({ log: lifetime35Ascending() })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when log prop is omitted', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })
})

// ─── 2. INSUFFICIENT_HISTORY render ─────────────────────────────────────────
describe('MaxTssDayPersonalRecordCard — INSUFFICIENT_HISTORY render', () => {
  it('renders the recent peak even with insufficient history (en)', () => {
    renderCard({ log: INSUFFICIENT_LOG })
    expect(screen.getByText('BUILDING HISTORY')).toBeInTheDocument()
    expect(screen.getByText(/Not enough lifetime daily history/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-band')).toBe('INSUFFICIENT_HISTORY')
    expect(region.getAttribute('data-recent-peak-tss')).toBe('200')
  })

  it('renders the recent peak even with insufficient history (tr)', () => {
    renderCard({ log: INSUFFICIENT_LOG }, 'tr')
    expect(screen.getByText('GEÇMİŞ OLUŞUYOR')).toBeInTheDocument()
    expect(screen.getByText(/yeterli günlük geçmiş yok/i)).toBeInTheDocument()
  })
})

// ─── 3. Band rendering — each band ──────────────────────────────────────────
describe('MaxTssDayPersonalRecordCard — renders each band', () => {
  it('NEW_RECORD: badge + hint (en)', () => {
    renderCard({ log: NEW_RECORD_LOG })
    expect(screen.getByText('NEW RECORD')).toBeInTheDocument()
    expect(screen.getByText(/Biggest single-day TSS ever recorded/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-band')).toBe('NEW_RECORD')
  })

  it('TOP_5: badge + hint (en)', () => {
    renderCard({ log: TOP_5_LOG })
    expect(screen.getByText('TOP 5')).toBeInTheDocument()
    expect(screen.getByText(/top-5 single-day loads/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-band')).toBe('TOP_5')
  })

  it('TOP_20_PERCENT: badge + hint (en)', () => {
    renderCard({ log: TOP_20_LOG })
    expect(screen.getByText('TOP 20%')).toBeInTheDocument()
    expect(screen.getByText(/Top-quintile single-day load/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-band')).toBe('TOP_20_PERCENT')
  })

  it('TYPICAL: badge + hint (en)', () => {
    renderCard({ log: TYPICAL_LOG })
    expect(screen.getByText('TYPICAL')).toBeInTheDocument()
    expect(screen.getByText(/typical hard day/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-band')).toBe('TYPICAL')
  })

  it('BELOW_TYPICAL: badge + hint (en)', () => {
    renderCard({ log: BELOW_TYPICAL_LOG })
    expect(screen.getByText('BELOW TYPICAL')).toBeInTheDocument()
    expect(screen.getByText(/easier side of your history/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-band')).toBe('BELOW_TYPICAL')
  })
})

// ─── 4. Turkish labels ──────────────────────────────────────────────────────
describe('MaxTssDayPersonalRecordCard — Turkish labels', () => {
  it('renders Turkish title', () => {
    renderCard({ log: NEW_RECORD_LOG }, 'tr')
    expect(screen.getByText('EN YÜKSEK GÜNLÜK TSS')).toBeInTheDocument()
  })

  it('renders English title', () => {
    renderCard({ log: NEW_RECORD_LOG })
    expect(screen.getByText('PEAK SINGLE-DAY TSS')).toBeInTheDocument()
  })

  it('renders Turkish NEW_RECORD badge + hint', () => {
    renderCard({ log: NEW_RECORD_LOG }, 'tr')
    expect(screen.getByText('YENİ REKOR')).toBeInTheDocument()
    expect(screen.getByText(/Şimdiye kadarki en yüksek tek günlük TSS/i)).toBeInTheDocument()
  })

  it('renders Turkish TOP_5 / TYPICAL / BELOW_TYPICAL badges', () => {
    const { unmount } = renderCard({ log: TOP_5_LOG }, 'tr')
    expect(screen.getByText('İLK 5')).toBeInTheDocument()
    unmount()

    const t = renderCard({ log: TYPICAL_LOG }, 'tr')
    expect(screen.getByText('OLAĞAN')).toBeInTheDocument()
    t.unmount()

    renderCard({ log: BELOW_TYPICAL_LOG }, 'tr')
    expect(screen.getByText('OLAĞAN ALTI')).toBeInTheDocument()
  })

  it('uses Turkish-style percentile string', () => {
    renderCard({ log: TYPICAL_LOG }, 'tr')
    expect(screen.getByText(/%49 yüzdelik/i)).toBeInTheDocument()
  })

  it('uses English ordinal percentile string', () => {
    renderCard({ log: TYPICAL_LOG })
    expect(screen.getByText(/49th percentile/i)).toBeInTheDocument()
  })
})

// ─── 5. Citation ────────────────────────────────────────────────────────────
describe('MaxTssDayPersonalRecordCard — citation', () => {
  it('renders the Issurin 2010 / Daniels 2014 citation footer', () => {
    renderCard({ log: NEW_RECORD_LOG })
    expect(screen.getByText(/Issurin 2010; Daniels 2014/)).toBeInTheDocument()
  })
})

// ─── 6. Accessibility + data anchors ────────────────────────────────────────
describe('MaxTssDayPersonalRecordCard — a11y + data anchors', () => {
  it('exposes role="region" with bilingual aria-label (en)', () => {
    renderCard({ log: NEW_RECORD_LOG })
    const region = screen.getByRole('region')
    expect(region.getAttribute('aria-label')).toMatch(/Peak single-day TSS/i)
  })

  it('exposes role="region" with Turkish aria-label (tr)', () => {
    renderCard({ log: NEW_RECORD_LOG }, 'tr')
    const region = screen.getByRole('region')
    expect(region.getAttribute('aria-label')).toMatch(/En yüksek tek günlük TSS/i)
  })

  it('exposes data-card="max-tss-day-personal-record" on root', () => {
    renderCard({ log: NEW_RECORD_LOG })
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-card')).toBe('max-tss-day-personal-record')
  })

  it('exposes all numeric/ISO data attributes on root', () => {
    renderCard({ log: TOP_5_LOG })
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-band')).toBe('TOP_5')
    expect(region.getAttribute('data-recent-peak-tss')).toBe('132')
    expect(region.getAttribute('data-recent-peak-date')).toBe(TODAY)
    expect(region.getAttribute('data-lifetime-peak-tss')).toBe('134')
    expect(region.getAttribute('data-recent-rank')).toBe('3')
    expect(region.getAttribute('data-total-historical-days')).toBe('35')
  })

  it('renders the lifetime peak reference line', () => {
    renderCard({ log: TOP_5_LOG })
    expect(screen.getByText(/Lifetime peak: 134 TSS ·/i)).toBeInTheDocument()
  })

  it('renders the rank line with ordinal suffix', () => {
    renderCard({ log: TOP_5_LOG })
    expect(screen.getByText(/rank 3rd of 35 historical days/i)).toBeInTheDocument()
  })
})
