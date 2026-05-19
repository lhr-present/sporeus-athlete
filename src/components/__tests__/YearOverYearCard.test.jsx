// @vitest-environment jsdom
// ─── YearOverYearCard.test.jsx — render tests ──────────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import YearOverYearCard from '../dashboard/YearOverYearCard.jsx'

const TODAY = '2026-05-19'

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
      <YearOverYearCard {...props} />
    </LangCtx.Provider>
  )
}

function buildWindow(from, to, count, { durationMin = 60, tss = 50 } = {}) {
  const start = new Date(from + 'T00:00:00Z').getTime()
  const end   = new Date(to   + 'T00:00:00Z').getTime()
  const span  = Math.max(1, end - start)
  const out = []
  for (let i = 0; i < count; i++) {
    const t = start + Math.round((i / Math.max(1, count - 1)) * span)
    const d = new Date(t).toISOString().slice(0, 10)
    out.push({ date: d, durationMin, tss })
  }
  return out
}

describe('YearOverYearCard — null gating', () => {
  it('renders nothing for an empty log', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders nothing when last-year baseline is too small (< 10 sessions)', () => {
    const log = [
      ...buildWindow('2025-01-05', '2025-05-19', 8),
      ...buildWindow('2026-01-05', '2026-05-19', 20),
    ]
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })
})

describe('YearOverYearCard — band rendering', () => {
  it('renders AHEAD band with green stripe + English label + EN hint', () => {
    const log = [
      ...buildWindow('2025-01-05', '2025-05-19', 50),
      ...buildWindow('2026-01-05', '2026-05-19', 65), // +30%
    ]
    renderCard({ log })
    const card = screen.getByRole('region', { name: /year-over-year/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-yoy-band')).toBe('AHEAD')
    // Green left border
    expect(card.style.borderLeft).toMatch(/rgb\(91,\s*194,\s*91\)/)
    expect(card.textContent).toMatch(/AHEAD/)
    expect(card.textContent).toMatch(/solid YoY progression/i)
    expect(card.textContent).toMatch(/Issurin 2010; Tønnessen 2014/)
  })

  it('renders MATCHING band with blue stripe', () => {
    const log = [
      ...buildWindow('2025-01-05', '2025-05-19', 50),
      ...buildWindow('2026-01-05', '2026-05-19', 51), // ~+2%
    ]
    renderCard({ log })
    const card = screen.getByRole('region', { name: /year-over-year/i })
    expect(card.getAttribute('data-yoy-band')).toBe('MATCHING')
    expect(card.style.borderLeft).toMatch(/rgb\(0,\s*100,\s*255\)/)
    expect(card.textContent).toMatch(/MATCHING/)
  })

  it('renders BEHIND band with orange stripe', () => {
    const log = [
      ...buildWindow('2025-01-05', '2025-05-19', 50),
      ...buildWindow('2026-01-05', '2026-05-19', 35), // -30%
    ]
    renderCard({ log })
    const card = screen.getByRole('region', { name: /year-over-year/i })
    expect(card.getAttribute('data-yoy-band')).toBe('BEHIND')
    expect(card.style.borderLeft).toMatch(/rgb\(255,\s*102,\s*0\)/)
    expect(card.textContent).toMatch(/BEHIND/)
  })
})

describe('YearOverYearCard — Turkish', () => {
  it('renders Turkish title + Turkish band label (ÖNDE) when lang=tr', () => {
    const log = [
      ...buildWindow('2025-01-05', '2025-05-19', 50),
      ...buildWindow('2026-01-05', '2026-05-19', 65),
    ]
    renderCard({ log }, 'tr')
    expect(screen.getByText(/YIL vs GEÇEN YIL · YIL BAŞINDAN/)).toBeInTheDocument()
    expect(screen.getByText('ÖNDE')).toBeInTheDocument()
    // Turkish hint snippet
    expect(screen.getByText(/sağlam yıllık ilerleme/)).toBeInTheDocument()
  })

  it('renders Turkish MATCHING (EŞİT) + BEHIND (GERİDE) labels', () => {
    // MATCHING
    let log = [
      ...buildWindow('2025-01-05', '2025-05-19', 50),
      ...buildWindow('2026-01-05', '2026-05-19', 51),
    ]
    const { unmount } = renderCard({ log }, 'tr')
    expect(screen.getByText('EŞİT')).toBeInTheDocument()
    unmount()

    // BEHIND
    log = [
      ...buildWindow('2025-01-05', '2025-05-19', 50),
      ...buildWindow('2026-01-05', '2026-05-19', 35),
    ]
    renderCard({ log }, 'tr')
    expect(screen.getByText('GERİDE')).toBeInTheDocument()
  })
})

describe('YearOverYearCard — per-row data anchors', () => {
  it('exposes 3 rows with correct metric / this-year / last-year / delta anchors', () => {
    // Last: 50 sessions × 60min × 50 TSS
    // This: 60 sessions × 90min × 100 TSS
    const log = [
      ...buildWindow('2025-01-05', '2025-05-19', 50, { durationMin: 60, tss: 50 }),
      ...buildWindow('2026-01-05', '2026-05-19', 60, { durationMin: 90, tss: 100 }),
    ]
    renderCard({ log })

    const rows = document.querySelectorAll('[data-yoy-row]')
    expect(rows.length).toBe(3)

    const byMetric = {}
    rows.forEach(r => { byMetric[r.getAttribute('data-yoy-metric')] = r })

    expect(byMetric.sessions).toBeTruthy()
    expect(byMetric.hours).toBeTruthy()
    expect(byMetric.tss).toBeTruthy()

    expect(byMetric.sessions.getAttribute('data-yoy-this-year')).toBe('60')
    expect(byMetric.sessions.getAttribute('data-yoy-last-year')).toBe('50')
    expect(parseFloat(byMetric.sessions.getAttribute('data-yoy-delta'))).toBeCloseTo(0.2, 5)

    // Hours = round(minutes / 60) — minutes this year = 60*90 = 5400 → 90h
    expect(byMetric.hours.getAttribute('data-yoy-this-year')).toBe('90')
    // Last year minutes = 50*60 = 3000 → 50h
    expect(byMetric.hours.getAttribute('data-yoy-last-year')).toBe('50')
    // Minutes delta = 0.8 (computed from raw minutes, not rounded hours)
    expect(parseFloat(byMetric.hours.getAttribute('data-yoy-delta'))).toBeCloseTo(0.8, 5)

    expect(byMetric.tss.getAttribute('data-yoy-this-year')).toBe('6000')
    expect(byMetric.tss.getAttribute('data-yoy-last-year')).toBe('2500')
    expect(parseFloat(byMetric.tss.getAttribute('data-yoy-delta'))).toBeCloseTo(1.4, 5)
  })

  it('exposes top-level data-yoy-aggregate-trend anchor', () => {
    const log = [
      ...buildWindow('2025-01-05', '2025-05-19', 50),
      ...buildWindow('2026-01-05', '2026-05-19', 65),
    ]
    renderCard({ log })
    const card = document.querySelector('[data-year-over-year-card]')
    expect(card).not.toBeNull()
    const trend = parseFloat(card.getAttribute('data-yoy-aggregate-trend'))
    expect(Number.isFinite(trend)).toBe(true)
    expect(trend).toBeGreaterThanOrEqual(0.10)
  })
})
