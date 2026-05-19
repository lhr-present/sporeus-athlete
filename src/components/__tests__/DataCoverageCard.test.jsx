// @vitest-environment jsdom
// ─── DataCoverageCard.test.jsx — Dashboard surface tests ──────────────────────
//
// Covers: empty/null log+recovery (render-null), HIGH band, MEDIUM band,
// LOW band, Turkish heading + band label, data anchors.
//
// We freeze the system clock so the pure-fn's default "today" (current
// system date) lines up with the synthetic dates produced by `daysAgo()`.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import DataCoverageCard from '../dashboard/DataCoverageCard.jsx'

const TODAY = '2026-05-18'

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

function renderCard({ log = [], recovery = [], lang = 'en' } = {}) {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <DataCoverageCard log={log} recovery={recovery} />
    </LangCtx.Provider>
  )
}

// ── Render-null guards ──────────────────────────────────────────────────────
describe('DataCoverageCard — render-null guards', () => {
  it('renders nothing when both log and recovery are empty', () => {
    const { container } = renderCard({ log: [], recovery: [] })
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-data-coverage-card]')).toBeNull()
  })

  it('renders nothing when both log and recovery are null', () => {
    const { container } = renderCard({ log: null, recovery: null })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when only entries with unparseable dates exist', () => {
    const { container } = renderCard({
      log: [{ date: 'garbage' }],
      recovery: [{ date: null }],
    })
    expect(container.firstChild).toBeNull()
  })
})

// ── HIGH band ───────────────────────────────────────────────────────────────
describe('DataCoverageCard — HIGH band', () => {
  it('renders with HIGH band when coverage ≥ 0.70', () => {
    // Fill all 10 days
    const log = []
    for (let i = 0; i < 10; i++) log.push({ date: daysAgo(i) })
    renderCard({ log })
    const card = document.querySelector('[data-data-coverage-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-coverage-band')).toBe('HIGH')
    expect(card.getAttribute('data-days-with-any-entry')).toBe('10')
    expect(card.getAttribute('data-total-days')).toBe('10')
    expect(card.getAttribute('data-days-with-session')).toBe('10')
    expect(card.getAttribute('data-days-with-recovery')).toBe('0')
    expect(card.getAttribute('data-overlap')).toBe('0')
    expect(parseFloat(card.getAttribute('data-coverage'))).toBeCloseTo(1, 4)

    const region = screen.getByRole('region', { name: /Data coverage lifetime/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/DATA COVERAGE/i)
    expect(region.textContent).toMatch(/100\.0%/)
    expect(region.textContent).toMatch(/10 of 10 days logged/)
    expect(region.textContent).toMatch(/HIGH/)
    // HIGH-band hint:
    expect(region.textContent).toMatch(/Strong logging discipline/i)
    expect(region.textContent).toMatch(/Wood 2013; Hellard 2019/)
  })
})

// ── MEDIUM band ─────────────────────────────────────────────────────────────
describe('DataCoverageCard — MEDIUM band', () => {
  it('renders with MEDIUM band when 0.40 ≤ coverage < 0.70', () => {
    // 5 of 10 days
    const log = [
      { date: daysAgo(9) },
      { date: daysAgo(7) },
      { date: daysAgo(5) },
      { date: daysAgo(3) },
      { date: daysAgo(0) },
    ]
    renderCard({ log })
    const card = document.querySelector('[data-data-coverage-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-coverage-band')).toBe('MEDIUM')
    expect(card.getAttribute('data-days-with-any-entry')).toBe('5')
    expect(card.getAttribute('data-total-days')).toBe('10')
    expect(card.textContent).toMatch(/50\.0%/)
    expect(card.textContent).toMatch(/5 of 10 days logged/)
    expect(card.textContent).toMatch(/MEDIUM/)
    expect(card.textContent).toMatch(/Moderate coverage/i)
  })
})

// ── LOW band ────────────────────────────────────────────────────────────────
describe('DataCoverageCard — LOW band', () => {
  it('renders with LOW band when coverage < 0.40', () => {
    // 3 of 10 days
    const log = [
      { date: daysAgo(9) },
      { date: daysAgo(5) },
      { date: daysAgo(0) },
    ]
    renderCard({ log })
    const card = document.querySelector('[data-data-coverage-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-coverage-band')).toBe('LOW')
    expect(card.getAttribute('data-days-with-any-entry')).toBe('3')
    expect(card.getAttribute('data-total-days')).toBe('10')
    expect(card.textContent).toMatch(/30\.0%/)
    expect(card.textContent).toMatch(/LOW/)
    expect(card.textContent).toMatch(/Sparse log coverage/i)
  })

  it('exposes overlap + per-stream day-count breakdown rows', () => {
    const log = [
      { date: daysAgo(4) },
      { date: daysAgo(0) },
    ]
    const recovery = [
      { date: daysAgo(4) }, // overlap
      { date: daysAgo(2) },
    ]
    renderCard({ log, recovery })
    const card = document.querySelector('[data-data-coverage-card]')
    expect(card.getAttribute('data-overlap')).toBe('1')
    expect(card.getAttribute('data-days-with-session')).toBe('2')
    expect(card.getAttribute('data-days-with-recovery')).toBe('2')
    // Mini breakdown rows present
    expect(document.querySelector('[data-coverage-row="sessions"]')).not.toBeNull()
    expect(document.querySelector('[data-coverage-row="recovery"]')).not.toBeNull()
    expect(document.querySelector('[data-coverage-row="overlap"]')).not.toBeNull()
  })
})

// ── Bilingual ───────────────────────────────────────────────────────────────
describe('DataCoverageCard — bilingual (Turkish)', () => {
  it('renders the Turkish heading + band label when lang=tr', () => {
    // HIGH band, fully logged 10 days
    const log = []
    for (let i = 0; i < 10; i++) log.push({ date: daysAgo(i) })
    renderCard({ log, lang: 'tr' })

    const region = screen.getByRole('region', { name: /Veri kapsamı yaşam boyu/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/VERİ KAPSAMI · YAŞAM BOYU/)
    expect(region.textContent).toMatch(/YÜKSEK/)
    expect(region.textContent).toMatch(/gün kayıtlı/)
    // Turkish HIGH-band hint
    expect(region.textContent).toMatch(/Güçlü kayıt disiplini/i)
  })

  it('renders the Turkish MEDIUM band label "ORTA"', () => {
    const log = [
      { date: daysAgo(9) },
      { date: daysAgo(7) },
      { date: daysAgo(5) },
      { date: daysAgo(3) },
      { date: daysAgo(0) },
    ]
    renderCard({ log, lang: 'tr' })
    const card = document.querySelector('[data-data-coverage-card]')
    expect(card.getAttribute('data-coverage-band')).toBe('MEDIUM')
    expect(card.textContent).toMatch(/ORTA/)
    expect(card.textContent).toMatch(/Orta kapsam/i)
  })

  it('renders the Turkish LOW band label "DÜŞÜK"', () => {
    const log = [
      { date: daysAgo(9) },
      { date: daysAgo(5) },
      { date: daysAgo(0) },
    ]
    renderCard({ log, lang: 'tr' })
    const card = document.querySelector('[data-data-coverage-card]')
    expect(card.getAttribute('data-coverage-band')).toBe('LOW')
    expect(card.textContent).toMatch(/DÜŞÜK/)
    expect(card.textContent).toMatch(/Seyrek kayıt/i)
  })
})
