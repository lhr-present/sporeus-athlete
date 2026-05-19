// @vitest-environment jsdom
// ─── LongRunFrequencyCard.test.jsx — Dashboard surface tests ─────────────────
//
// Covers: null render (sparse log), each of the 3 bands
// (STRONG_BASE / DEVELOPING / THIN), Turkish heading + band label,
// per-bar data anchors (data-month-bar, data-month-label, data-month-count).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import LongRunFrequencyCard from '../dashboard/LongRunFrequencyCard.jsx'

const TODAY = '2026-05-18'

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <LongRunFrequencyCard log={log} />
    </LangCtx.Provider>
  )
}

// Build a log with `perMonth` long (≥90 min) sessions in each of the
// 6 trailing months ending in May 2026.
function evenLongLog(perMonth) {
  const days = ['2025-12-05', '2026-01-05', '2026-02-05', '2026-03-05', '2026-04-05', '2026-05-05']
  const log = []
  for (const d of days) {
    for (let k = 0; k < perMonth; k++) {
      log.push({ date: d, durationMin: 95, type: 'Long Run' })
    }
  }
  return log
}

describe('LongRunFrequencyCard — guards (renders null)', () => {
  it('renders nothing for an empty log', () => {
    const { container } = renderCard([])
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-long-run-frequency-card]')).toBeNull()
  })

  it('renders nothing for a null log', () => {
    const { container } = renderCard(null)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when fewer than 3 months have any sessions', () => {
    const log = [
      { date: '2026-05-05', durationMin: 95 },
      { date: '2026-04-05', durationMin: 30 },
    ]
    const { container } = renderCard(log)
    expect(container.firstChild).toBeNull()
  })
})

describe('LongRunFrequencyCard — STRONG_BASE band', () => {
  it('renders STRONG_BASE band with green accent + interpretation', () => {
    renderCard(evenLongLog(3)) // 18 long sessions / 6 months → 3.0 avg
    const card = document.querySelector('[data-long-run-frequency-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-frequency-band')).toBe('STRONG_BASE')
    expect(card.getAttribute('data-total-long-sessions')).toBe('18')
    expect(card.getAttribute('data-avg-per-month')).toBe('3')
    expect(card.getAttribute('data-long-min-threshold')).toBe('90')

    const region = screen.getByRole('region', { name: /Long run frequency card/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/LONG SESSIONS · 6 MONTHS/)
    expect(region.textContent).toMatch(/STRONG BASE/)
    expect(region.textContent).toMatch(/aerobic base is being maintained/i)
    expect(region.textContent).toMatch(/Daniels 2014/)
    expect(region.textContent).toMatch(/Lydiard 1978/)
    expect(region.textContent).toMatch(/3\.0\/mo avg/)
    expect(region.textContent).toMatch(/≥90min sessions \/ 6mo/)
  })
})

describe('LongRunFrequencyCard — DEVELOPING band', () => {
  it('renders DEVELOPING band with blue accent + interpretation', () => {
    renderCard(evenLongLog(2)) // 12 long sessions / 6 months → 2.0 avg
    const card = document.querySelector('[data-long-run-frequency-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-frequency-band')).toBe('DEVELOPING')
    expect(card.getAttribute('data-total-long-sessions')).toBe('12')
    expect(card.getAttribute('data-avg-per-month')).toBe('2')

    expect(card.textContent).toMatch(/DEVELOPING/)
    expect(card.textContent).toMatch(/Some long sessions, not yet weekly habit/i)
  })
})

describe('LongRunFrequencyCard — THIN band', () => {
  it('renders THIN band with orange accent + interpretation', () => {
    // 1 long session/month × 6 months = 6 → 1.0 avg → THIN
    renderCard(evenLongLog(1))
    const card = document.querySelector('[data-long-run-frequency-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-frequency-band')).toBe('THIN')
    expect(card.getAttribute('data-total-long-sessions')).toBe('6')
    expect(card.getAttribute('data-avg-per-month')).toBe('1')

    expect(card.textContent).toMatch(/THIN/)
    expect(card.textContent).toMatch(/Rare long sessions/i)
    expect(card.textContent).toMatch(/Add 1 long session every 2-3 weeks/i)
  })
})

describe('LongRunFrequencyCard — per-month bars', () => {
  it('renders exactly 6 month bars oldest-first with data anchors', () => {
    renderCard(evenLongLog(2))
    const bars = document.querySelectorAll('[data-month-bar]')
    expect(bars.length).toBe(6)
    const months = Array.from(bars).map(b => b.getAttribute('data-month'))
    expect(months).toEqual([
      '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05',
    ])
    const labels = Array.from(bars).map(b => b.getAttribute('data-month-label'))
    expect(labels).toEqual(['DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY'])
    for (const bar of bars) {
      expect(bar.getAttribute('data-month-count')).toBe('2')
    }
  })

  it('exposes correct per-bar counts when bucket totals differ', () => {
    const log = [
      // May: 3 longs
      { date: '2026-05-01', durationMin: 95 },
      { date: '2026-05-08', durationMin: 95 },
      { date: '2026-05-15', durationMin: 95 },
      // Apr: 2 longs
      { date: '2026-04-05', durationMin: 95 },
      { date: '2026-04-20', durationMin: 95 },
      // Mar: 1 long
      { date: '2026-03-05', durationMin: 95 },
      // Feb–Dec: short filler sessions for coverage
      { date: '2026-02-05', durationMin: 30 },
      { date: '2026-01-05', durationMin: 30 },
      { date: '2025-12-05', durationMin: 30 },
    ]
    renderCard(log)
    const bars = document.querySelectorAll('[data-month-bar]')
    const byMonth = Object.fromEntries(
      Array.from(bars).map(b => [b.getAttribute('data-month'), b.getAttribute('data-month-count')])
    )
    expect(byMonth['2026-05']).toBe('3')
    expect(byMonth['2026-04']).toBe('2')
    expect(byMonth['2026-03']).toBe('1')
    expect(byMonth['2026-02']).toBe('0')
    expect(byMonth['2026-01']).toBe('0')
    expect(byMonth['2025-12']).toBe('0')
  })
})

describe('LongRunFrequencyCard — bilingual (Turkish)', () => {
  it('renders Turkish heading, band label, hint, and TR month labels', () => {
    renderCard(evenLongLog(3), 'tr') // STRONG_BASE
    const region = screen.getByRole('region', { name: /Uzun seans frekansı/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/UZUN SEANSLAR · 6 AY/)
    expect(region.textContent).toMatch(/GÜÇLÜ TEMEL/)
    expect(region.textContent).toMatch(/aerobik temel korunuyor/i)
    expect(region.textContent).toMatch(/3\.0\/ay ort\./)
    expect(region.textContent).toMatch(/≥90dk seans \/ 6 ay/)

    // Per-bar Turkish month labels.
    const bars = document.querySelectorAll('[data-month-bar]')
    const labels = Array.from(bars).map(b => b.getAttribute('data-month-label'))
    expect(labels).toEqual(['ARA', 'OCA', 'ŞUB', 'MAR', 'NİS', 'MAY'])
  })

  it('renders Turkish DEVELOPING label + hint', () => {
    renderCard(evenLongLog(2), 'tr')
    const card = document.querySelector('[data-long-run-frequency-card]')
    expect(card.getAttribute('data-frequency-band')).toBe('DEVELOPING')
    expect(card.textContent).toMatch(/GELİŞEN/)
    expect(card.textContent).toMatch(/henüz haftalık alışkanlık değil/i)
  })

  it('renders Turkish THIN label + hint', () => {
    renderCard(evenLongLog(1), 'tr')
    const card = document.querySelector('[data-long-run-frequency-card]')
    expect(card.getAttribute('data-frequency-band')).toBe('THIN')
    expect(card.textContent).toMatch(/İNCE/)
    expect(card.textContent).toMatch(/Az sayıda uzun seans/i)
  })
})
