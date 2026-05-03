// @vitest-environment jsdom
// ─── TrainingDistributionCard.test.jsx — render tests for E128 season card ───
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import TrainingDistributionCard from '../dashboard/TrainingDistributionCard.jsx'

// ─── Render helper with overridable lang ─────────────────────────────────────
function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <TrainingDistributionCard {...props} />
    </LangCtx.Provider>
  )
}

// ─── Date helpers anchored to today (UTC) ────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10)
}
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Synthetic logs ──────────────────────────────────────────────────────────
/**
 * Polarized 80/20-ish: 12 weeks. Each week = 5 Z2 long sessions + 1 Z5 interval
 * + 1 recovery. Z2 minutes dominate (~85%) with a small Z5 share (~10–15%).
 */
function buildPolarizedLog() {
  const today = todayStr()
  const log = []
  for (let w = 0; w < 12; w++) {
    const wkStart = addDays(today, -(w * 7 + 6))
    // 5× Z2 endurance: 75 min @ RPE 5 → 375 min Z2/week
    for (let d = 0; d < 5; d++) {
      log.push({
        date: addDays(wkStart, d),
        type: 'run',
        duration: 75,
        tss: 60,
        rpe: 5,
        zones: [0, 75, 0, 0, 0],
      })
    }
    // 1× Z5 intervals: 45 min @ RPE 9 → 45 min Z5/week
    log.push({
      date: addDays(wkStart, 5),
      type: 'run',
      duration: 45,
      tss: 80,
      rpe: 9,
      zones: [0, 0, 0, 0, 45],
    })
    // 1× recovery: 30 min @ RPE 2 → 30 min Z1/week
    log.push({
      date: addDays(wkStart, 6),
      type: 'recovery',
      duration: 30,
      tss: 15,
      rpe: 2,
      zones: [30, 0, 0, 0, 0],
    })
  }
  return log
}

/**
 * Imbalanced log (all Z3 threshold): 12 weeks × 5 sessions @ Z3 RPE 6.
 * Should land in the POOR band — too much threshold, no Z5.
 */
function buildAllZ3Log() {
  const today = todayStr()
  const log = []
  for (let w = 0; w < 12; w++) {
    const wkStart = addDays(today, -(w * 7 + 6))
    for (let d = 0; d < 5; d++) {
      log.push({
        date: addDays(wkStart, d),
        type: 'run',
        duration: 60,
        tss: 65,
        rpe: 6,
        zones: [0, 0, 60, 0, 0],
      })
    }
  }
  return log
}

/** Build only N days (less than 4 weeks) to force unreliable. */
function buildShortLog(days) {
  const today = todayStr()
  const log = []
  for (let i = 0; i < days; i++) {
    log.push({
      date: addDays(today, -i),
      type: 'run',
      duration: 60,
      tss: 50,
      rpe: 5,
      zones: [0, 60, 0, 0, 0],
    })
  }
  return log
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe('TrainingDistributionCard — empty / unreliable states', () => {
  it('renders empty state for empty log', () => {
    renderCard({ log: [] })
    expect(screen.getByText(/Log 4\+ weeks to see season distribution/i))
      .toBeInTheDocument()
  })

  it('renders empty state when fewer than 4 weeks logged', () => {
    // 10 sessions on 10 consecutive days = ~2 ISO weeks → unreliable
    const log = buildShortLog(10)
    renderCard({ log })
    expect(screen.getByText(/Log 4\+ weeks to see season distribution/i))
      .toBeInTheDocument()
  })
})

describe('TrainingDistributionCard — reliable render', () => {
  it('renders GOOD badge with green color for polarized 80/20 log', () => {
    const log = buildPolarizedLog()
    renderCard({ log })
    const badge = screen.getByText('GOOD')
    expect(badge).toBeInTheDocument()
    // Band color #5bc25b → rgb(91, 194, 91)
    expect(badge.style.color.toLowerCase()).toBe('rgb(91, 194, 91)')
  })

  it('renders POOR badge with red color for imbalanced (all Z3) log', () => {
    const log = buildAllZ3Log()
    renderCard({ log })
    const badge = screen.getByText('POOR')
    expect(badge).toBeInTheDocument()
    // Band color #e03030 → rgb(224, 48, 48)
    expect(badge.style.color.toLowerCase()).toBe('rgb(224, 48, 48)')
  })

  it('renders all 5 zone labels in the legend', () => {
    const log = buildPolarizedLog()
    renderCard({ log })
    // Each zone gets its own legend entry: Z1..Z5
    expect(screen.getByText('Z1')).toBeInTheDocument()
    expect(screen.getByText('Z2')).toBeInTheDocument()
    expect(screen.getByText('Z3')).toBeInTheDocument()
    expect(screen.getByText('Z4')).toBeInTheDocument()
    expect(screen.getByText('Z5')).toBeInTheDocument()
  })

  it('renders all 5 intent labels (EN)', () => {
    const log = buildPolarizedLog()
    renderCard({ log })
    expect(screen.getByText('Recovery')).toBeInTheDocument()
    expect(screen.getByText('Long')).toBeInTheDocument()
    expect(screen.getByText('Steady')).toBeInTheDocument()
    expect(screen.getByText('Tempo')).toBeInTheDocument()
    expect(screen.getByText('Intervals')).toBeInTheDocument()
  })

  it('renders weekly averages with whole-number TSS / min / sessions per week', () => {
    const log = buildPolarizedLog()
    renderCard({ log })
    // Format: "X TSS · Y min · Z sessions per week"
    const node = screen.getByText(/\d+ TSS · \d+ min · \d+ sessions per week/i)
    expect(node).toBeInTheDocument()
  })

  it('renders TR labels when lang=tr', () => {
    const log = buildPolarizedLog()
    renderCard({ log }, 'tr')
    expect(screen.getByText(/ANTRENMAN DAĞILIMI — 84G/i)).toBeInTheDocument()
    expect(screen.getByText('İYİ')).toBeInTheDocument()
    // TR intent labels
    expect(screen.getByText('Toparlanma')).toBeInTheDocument()
    expect(screen.getByText('Uzun')).toBeInTheDocument()
    expect(screen.getByText('Sabit')).toBeInTheDocument()
    expect(screen.getByText('Tempo')).toBeInTheDocument()
    expect(screen.getByText('İntervaller')).toBeInTheDocument()
    // TR weekly-averages line
    expect(screen.getByText(/Haftada \d+ TSS · \d+ dk · \d+ seans/i)).toBeInTheDocument()
  })

  it('card root has role=region with bilingual aria-label', () => {
    const log = buildPolarizedLog()
    renderCard({ log })
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('aria-label'))
      .toMatch(/Season training distribution/i)
  })

  it('zone-bar container has role=img with aria-label summarizing 5 percentages', () => {
    const log = buildPolarizedLog()
    renderCard({ log })
    const img = screen.getByRole('img')
    expect(img).toBeInTheDocument()
    const al = img.getAttribute('aria-label') || ''
    // EN summary: "Z1 N%, Z2 N%, Z3 N%, Z4 N%, Z5 N%"
    expect(al).toMatch(/Z1 \d+%/)
    expect(al).toMatch(/Z2 \d+%/)
    expect(al).toMatch(/Z3 \d+%/)
    expect(al).toMatch(/Z4 \d+%/)
    expect(al).toMatch(/Z5 \d+%/)
  })

  it('renders the Seiler / Stöggl & Sperlich citation footer', () => {
    const log = buildPolarizedLog()
    renderCard({ log })
    expect(screen.getByText(/Seiler 2010; Stöggl & Sperlich 2014/))
      .toBeInTheDocument()
  })

  it('intent breakdown is wrapped in role=list with 5 listitems', () => {
    const log = buildPolarizedLog()
    renderCard({ log })
    const list = screen.getByRole('list', { name: /Intent breakdown/i })
    expect(list).toBeInTheDocument()
    const items = list.querySelectorAll('[role="listitem"]')
    expect(items.length).toBe(5)
  })
})
