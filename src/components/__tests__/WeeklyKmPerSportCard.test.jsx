// @vitest-environment jsdom
// ─── WeeklyKmPerSportCard.test.jsx — Dashboard surface tests ─────────────
//
// Covers: render-null guards, multi-sport rendering, Turkish heading +
// labels, and the per-row data anchors used by E2E selectors.
//
// We freeze the system clock so the underlying analyzer
// (analyzeWeeklyKmPerSport — called without an explicit `today` arg
// from the card) sees a deterministic "today" relative to the log
// dates synthesized by `daysAgo()`.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import WeeklyKmPerSportCard from '../dashboard/WeeklyKmPerSportCard.jsx'

const TODAY = '2026-05-20' // Wednesday → ISO week starts Mon 2026-05-18

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

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <WeeklyKmPerSportCard log={log} />
    </LangCtx.Provider>
  )
}

describe('WeeklyKmPerSportCard — guards', () => {
  it('renders nothing for an empty log', () => {
    const { container } = renderCard([])
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-weekly-km-per-sport-card]')).toBeNull()
  })

  it('renders nothing for a null log', () => {
    const { container } = renderCard(null)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when no entry has positive distanceKm', () => {
    const log = [
      { date: daysAgo(1), type: 'Run', distanceKm: 0 },
      { date: daysAgo(3), type: 'Bike', distanceKm: NaN },
    ]
    const { container } = renderCard(log)
    expect(container.firstChild).toBeNull()
  })
})

describe('WeeklyKmPerSportCard — multi-sport render', () => {
  // Three-sport log with Run = biggest past avg, Bike = middle,
  // Swim = smallest (and brand new this week, so deltaPct = null).
  const log = [
    // Run: 10 km this week + 60 km across past 12 weeks → avg 5, delta +1.0.
    { date: daysAgo(0), type: 'Run', distanceKm: 10 },
    { date: daysAgo(10), type: 'Run', distanceKm: 30 },
    { date: daysAgo(20), type: 'Run', distanceKm: 30 },
    // Bike: 5 km this week + 24 km past → avg 2, delta +1.5.
    { date: daysAgo(1), type: 'Easy Bike', distanceKm: 5 },
    { date: daysAgo(15), type: 'Bike', distanceKm: 12 },
    { date: daysAgo(25), type: 'Bike', distanceKm: 12 },
    // Swim: new this week, no history → deltaPct null.
    { date: daysAgo(0), type: 'Open water swim', distanceKm: 1.5 },
  ]

  it('renders the card region with the EN heading', () => {
    renderCard(log)
    const region = screen.getByRole('region', { name: /Weekly km per sport/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/WEEKLY KM × SPORT/)
    expect(region.textContent).toMatch(/Daniels 2014/)
    expect(region.textContent).toMatch(/Bompa 2018/)
  })

  it('sets data-sport-count to the number of sport rows', () => {
    renderCard(log)
    const card = document.querySelector('[data-weekly-km-per-sport-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-sport-count')).toBe('3')
  })

  it('renders one row per sport, sorted by 12-week avg desc', () => {
    renderCard(log)
    const rows = document.querySelectorAll('[data-sport-row]')
    expect(rows.length).toBe(3)
    const keys = Array.from(rows).map(r => r.getAttribute('data-sport-key'))
    expect(keys).toEqual(['run', 'bike', 'swim'])
  })

  it('exposes per-row data anchors with thisWeekKm + avg12WeekKm + deltaPct', () => {
    renderCard(log)
    const rows = document.querySelectorAll('[data-sport-row]')
    const run = Array.from(rows).find(r => r.getAttribute('data-sport-key') === 'run')
    expect(run).toBeDefined()
    // Run this-week = 10, avg = 60/12 = 5, delta = (10 − 5)/5 = 1.0.
    expect(parseFloat(run.getAttribute('data-this-week-km'))).toBeCloseTo(10, 6)
    expect(parseFloat(run.getAttribute('data-avg-12w-km'))).toBeCloseTo(5, 6)
    expect(parseFloat(run.getAttribute('data-delta-pct'))).toBeCloseTo(1, 6)

    const swim = Array.from(rows).find(r => r.getAttribute('data-sport-key') === 'swim')
    expect(swim).toBeDefined()
    // Swim is brand-new this week — deltaPct is null on the analyzer,
    // surfaced as an empty data-delta-pct attribute on the row.
    expect(swim.getAttribute('data-delta-pct')).toBe('')
  })

  it('renders thisWeekKm to 1 decimal place', () => {
    renderCard(log)
    const card = document.querySelector('[data-weekly-km-per-sport-card]')
    // Run = 10.0 km, Bike = 5.0 km, Swim = 1.5 km.
    expect(card.textContent).toMatch(/10\.0 km/)
    expect(card.textContent).toMatch(/5\.0 km/)
    expect(card.textContent).toMatch(/1\.5 km/)
  })
})

describe('WeeklyKmPerSportCard — Turkish', () => {
  it('renders the Turkish heading and sport labels when lang=tr', () => {
    const log = [
      { date: daysAgo(0), type: 'Run', distanceKm: 10 },
      { date: daysAgo(15), type: 'Run', distanceKm: 60 },
      { date: daysAgo(1), type: 'Easy Bike', distanceKm: 4 },
      { date: daysAgo(20), type: 'Bike', distanceKm: 24 },
      { date: daysAgo(2), type: 'Open water swim', distanceKm: 2 },
      { date: daysAgo(30), type: 'Swim', distanceKm: 2 },
    ]
    renderCard(log, 'tr')
    const region = screen.getByRole('region', { name: /Spor başına haftalık km/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/HAFTALIK KM × SPOR/)
    expect(region.textContent).toMatch(/Koşu/)
    expect(region.textContent).toMatch(/Bisiklet/)
    expect(region.textContent).toMatch(/Yüzme/)
    expect(region.textContent).toMatch(/12-HAFTA ORT\./)
    // Turkish interpretation hint
    expect(region.textContent).toMatch(/vücutlarında spor bazında hisseder/)
  })
})
