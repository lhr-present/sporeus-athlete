// @vitest-environment jsdom
// ─── WeeklyVolumeRecordCard.test.jsx — render tests ──────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import WeeklyVolumeRecordCard from '../dashboard/WeeklyVolumeRecordCard.jsx'

// ─── Anchored time: today = Wed 2026-04-29 → current-week Mon = 2026-04-27 ──
beforeEach(() => { vi.setSystemTime(new Date('2026-04-29T12:00:00Z')) })
afterEach(()  => { vi.setSystemTime(new Date()) })

const TODAY = '2026-04-29'
const CURRENT_WEEK_MONDAY = '2026-04-27'

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function makeWeeklyLog(weeklyTssArray) {
  const firstMonday = addDays(CURRENT_WEEK_MONDAY, -7 * weeklyTssArray.length)
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
      <WeeklyVolumeRecordCard {...props} />
    </LangCtx.Provider>
  )
}

// ─── Fixtures per band ──────────────────────────────────────────────────────
// NEW_RECORD: 8 history weeks (100..170), current week monster at 999.
const NEW_RECORD_LOG = [
  ...makeWeeklyLog([100, 110, 120, 130, 140, 150, 160, 170]),
  { date: TODAY, tss: 999, type: 'run' },
]

// TOP_5: 10 hist weeks 100..1000, current 950 → rank 2 of 10.
const TOP_5_LOG = [
  ...makeWeeklyLog([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]),
  { date: TODAY, tss: 950, type: 'run' },
]

// TOP_20_PERCENT: 30 hist weeks 100..3000, current 2550 → rank 6, pct 83.
const top20Weekly = []
for (let i = 1; i <= 30; i++) top20Weekly.push(i * 100)
const TOP_20_LOG = [
  ...makeWeeklyLog(top20Weekly),
  { date: TODAY, tss: 2550, type: 'run' },
]

// TYPICAL: 20 hist weeks 100..2000, current 1050 → pct 50.
const typicalWeekly = []
for (let i = 1; i <= 20; i++) typicalWeekly.push(i * 100)
const TYPICAL_LOG = [
  ...makeWeeklyLog(typicalWeekly),
  { date: TODAY, tss: 1050, type: 'run' },
]

// LOW: 20 hist weeks 100..2000, current 150 → pct 5.
const LOW_LOG = [
  ...makeWeeklyLog(typicalWeekly),
  { date: TODAY, tss: 150, type: 'run' },
]

// ─── 1. Null cases (render-null) ────────────────────────────────────────────
describe('WeeklyVolumeRecordCard — renders null on insufficient data', () => {
  it('renders nothing for empty log', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for <8 completed weeks', () => {
    const log = makeWeeklyLog([100, 110, 120, 130, 140, 150, 160]) // only 7
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when log prop is missing', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })
})

// ─── 2. Band rendering ─────────────────────────────────────────────────────
describe('WeeklyVolumeRecordCard — renders each band', () => {
  it('NEW_RECORD: badge + hint (en)', () => {
    renderCard({ log: NEW_RECORD_LOG })
    expect(screen.getByText('NEW RECORD')).toBeInTheDocument()
    expect(screen.getByText(/All-time biggest week/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-record-band')).toBe('NEW_RECORD')
  })

  it('TOP_5: badge + hint (en)', () => {
    renderCard({ log: TOP_5_LOG })
    expect(screen.getByText('TOP 5')).toBeInTheDocument()
    expect(screen.getByText(/One of your biggest weeks ever/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-record-band')).toBe('TOP_5')
  })

  it('TOP_20_PERCENT: badge + hint (en)', () => {
    renderCard({ log: TOP_20_LOG })
    expect(screen.getByText('TOP 20%')).toBeInTheDocument()
    expect(screen.getByText(/Top-quintile training week/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-record-band')).toBe('TOP_20_PERCENT')
  })

  it('TYPICAL: badge + hint (en)', () => {
    renderCard({ log: TYPICAL_LOG })
    expect(screen.getByText('TYPICAL')).toBeInTheDocument()
    expect(screen.getByText(/Middle of your historical range/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-record-band')).toBe('TYPICAL')
  })

  it('LOW: badge + hint (en)', () => {
    renderCard({ log: LOW_LOG })
    expect(screen.getByText('LOW')).toBeInTheDocument()
    expect(screen.getByText(/Lower than your typical week/i)).toBeInTheDocument()
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-record-band')).toBe('LOW')
  })
})

// ─── 3. Bilingual (Turkish) ─────────────────────────────────────────────────
describe('WeeklyVolumeRecordCard — Turkish labels', () => {
  it('renders Turkish title', () => {
    renderCard({ log: NEW_RECORD_LOG }, 'tr')
    expect(screen.getByText('HAFTALIK HACİM · REKOR')).toBeInTheDocument()
  })

  it('renders English title', () => {
    renderCard({ log: NEW_RECORD_LOG })
    expect(screen.getByText('WEEKLY VOLUME · RECORD')).toBeInTheDocument()
  })

  it('renders Turkish NEW_RECORD badge + hint', () => {
    renderCard({ log: NEW_RECORD_LOG }, 'tr')
    expect(screen.getByText('YENİ REKOR')).toBeInTheDocument()
    expect(screen.getByText(/Tüm zamanların en büyük haftası/i)).toBeInTheDocument()
  })

  it('renders Turkish TOP_5 badge', () => {
    renderCard({ log: TOP_5_LOG }, 'tr')
    expect(screen.getByText('İLK 5')).toBeInTheDocument()
  })

  it('renders Turkish TOP_20_PERCENT badge', () => {
    renderCard({ log: TOP_20_LOG }, 'tr')
    expect(screen.getByText('İLK %20')).toBeInTheDocument()
  })

  it('renders Turkish TYPICAL badge', () => {
    renderCard({ log: TYPICAL_LOG }, 'tr')
    expect(screen.getByText('OLAĞAN')).toBeInTheDocument()
  })

  it('renders Turkish LOW badge', () => {
    renderCard({ log: LOW_LOG }, 'tr')
    expect(screen.getByText('DÜŞÜK')).toBeInTheDocument()
  })

  it('uses Turkish-style percentile string', () => {
    renderCard({ log: TYPICAL_LOG }, 'tr')
    // "%50 yüzdelik"
    expect(screen.getByText(/%50 yüzdelik/i)).toBeInTheDocument()
  })

  it('uses English ordinal percentile string', () => {
    renderCard({ log: TYPICAL_LOG })
    // "50th percentile"
    expect(screen.getByText(/50th percentile/i)).toBeInTheDocument()
  })
})

// ─── 4. Data anchors + a11y ─────────────────────────────────────────────────
describe('WeeklyVolumeRecordCard — data anchors + a11y', () => {
  it('exposes role="region" with bilingual aria-label (en)', () => {
    renderCard({ log: NEW_RECORD_LOG })
    const region = screen.getByRole('region')
    expect(region.getAttribute('aria-label')).toMatch(/Weekly volume record/i)
  })

  it('exposes role="region" with Turkish aria-label (tr)', () => {
    renderCard({ log: NEW_RECORD_LOG }, 'tr')
    const region = screen.getByRole('region')
    expect(region.getAttribute('aria-label')).toMatch(/Haftalık hacim rekoru/i)
  })

  it('exposes data-weekly-volume-record-card on root', () => {
    renderCard({ log: NEW_RECORD_LOG })
    const region = screen.getByRole('region')
    expect(region.hasAttribute('data-weekly-volume-record-card')).toBe(true)
  })

  it('exposes all numeric data attributes on root', () => {
    renderCard({ log: TOP_5_LOG })
    const region = screen.getByRole('region')
    expect(region.getAttribute('data-record-band')).toBe('TOP_5')
    expect(region.getAttribute('data-current-week-tss')).toBe('950')
    expect(region.getAttribute('data-peak-week-tss')).toBe('1000')
    expect(region.getAttribute('data-current-rank')).toBe('2')
    expect(region.getAttribute('data-current-percentile')).toBe('90')
    expect(region.getAttribute('data-total-completed-weeks')).toBe('10')
  })

  it('renders the peak reference line', () => {
    renderCard({ log: TOP_5_LOG })
    // "All-time peak: 1000 · 2026-XX-XX"
    expect(screen.getByText(/All-time peak: 1000 ·/i)).toBeInTheDocument()
  })

  it('renders the rank line', () => {
    renderCard({ log: TOP_5_LOG })
    expect(screen.getByText(/rank #2 of 10 completed weeks/i)).toBeInTheDocument()
  })

  it('renders citation footer', () => {
    renderCard({ log: NEW_RECORD_LOG })
    expect(screen.getByText(/Hellard 2019; Issurin 2010/)).toBeInTheDocument()
  })
})
