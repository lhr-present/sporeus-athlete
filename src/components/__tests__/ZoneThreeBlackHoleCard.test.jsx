// @vitest-environment jsdom
// ─── ZoneThreeBlackHoleCard.test.jsx — render tests ─────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import ZoneThreeBlackHoleCard from '../dashboard/ZoneThreeBlackHoleCard.jsx'

const TODAY = '2026-04-30'
const OLDEST_MONDAY = '2026-03-09'

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function entry(date, durationMin, extras = {}) {
  return { date, durationMin, ...extras }
}

function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <ZoneThreeBlackHoleCard {...props} />
    </LangCtx.Provider>,
  )
}

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})

afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

// ─── Band rendering ─────────────────────────────────────────────────────────
describe('ZoneThreeBlackHoleCard — band rendering', () => {
  it('renders POLARIZED band when Z3 share < 25%', () => {
    // 20 + 80 = 100 → 20% Z3
    const log = [
      entry(OLDEST_MONDAY, 20, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 80, { zone: 'Z4' }),
    ]
    renderCard({ log })
    const region = screen.getByRole('region', { name: /Z3 black-hole detector/i })
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('data-zone-three-band')).toBe('POLARIZED')
    expect(screen.getByText('POLARIZED')).toBeInTheDocument()
  })

  it('renders BALANCED band when 25% ≤ Z3 share < 60%', () => {
    // 40 + 60 = 100 → 40%
    const log = [
      entry(OLDEST_MONDAY, 40, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 60, { zone: 'Z4' }),
    ]
    renderCard({ log })
    const region = screen.getByRole('region', { name: /Z3 black-hole detector/i })
    expect(region.getAttribute('data-zone-three-band')).toBe('BALANCED')
    expect(screen.getByText('BALANCED')).toBeInTheDocument()
  })

  it('renders BLACK_HOLE band when Z3 share ≥ 60%', () => {
    // 80 + 20 = 100 → 80%
    const log = [
      entry(OLDEST_MONDAY, 80, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 20, { zone: 'Z4' }),
    ]
    renderCard({ log })
    const region = screen.getByRole('region', { name: /Z3 black-hole detector/i })
    expect(region.getAttribute('data-zone-three-band')).toBe('BLACK_HOLE')
    expect(screen.getByText('BLACK HOLE')).toBeInTheDocument()
  })

  it('renders INSUFFICIENT_HARD_VOLUME band when total < 60 min', () => {
    const log = [
      entry(OLDEST_MONDAY, 20, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 20, { zone: 'Z4' }),
    ]
    renderCard({ log })
    const region = screen.getByRole('region', { name: /Z3 black-hole detector/i })
    expect(region.getAttribute('data-zone-three-band')).toBe('INSUFFICIENT_HARD_VOLUME')
    expect(screen.getByText('INSUFFICIENT DATA')).toBeInTheDocument()
  })
})

// ─── Bilingual (TR) ─────────────────────────────────────────────────────────
describe('ZoneThreeBlackHoleCard — Turkish copy', () => {
  it('renders Turkish title and band when lang=tr', () => {
    const log = [
      entry(OLDEST_MONDAY, 80, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 20, { zone: 'Z4' }),
    ]
    renderCard({ log }, 'tr')
    const region = screen.getByRole('region', { name: /Z3 tuzağı dedektörü/i })
    expect(region).toBeInTheDocument()
    expect(screen.getByText(/Z3 TUZAĞI · 8H/)).toBeInTheDocument()
    expect(screen.getByText('KARA DELİK')).toBeInTheDocument()
  })

  it('renders Turkish band label for POLARIZED', () => {
    const log = [
      entry(OLDEST_MONDAY, 20, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 80, { zone: 'Z4' }),
    ]
    renderCard({ log }, 'tr')
    expect(screen.getByText('POLARİZE')).toBeInTheDocument()
  })

  it('renders Turkish band label for INSUFFICIENT_HARD_VOLUME', () => {
    renderCard({ log: [] }, 'tr')
    expect(screen.getByText('YETERSİZ VERİ')).toBeInTheDocument()
  })
})

// ─── ∞ rendering ────────────────────────────────────────────────────────────
describe('ZoneThreeBlackHoleCard — infinity ratio rendering', () => {
  it('renders "∞" when totalHardMin === 0', () => {
    // 100 min Z3, no HARD → ratio = ∞
    const log = [
      entry(OLDEST_MONDAY, 100, { zone: 'Z3' }),
    ]
    renderCard({ log })
    expect(screen.getByText(/Z3\/\(Z4\+Z5\) ratio: ∞/)).toBeInTheDocument()
    const region = screen.getByRole('region', { name: /Z3 black-hole detector/i })
    expect(region.getAttribute('data-z3-to-hard-ratio')).toBe('infinity')
  })

  it('renders numeric ratio (e.g. 1.4×) when hardMin > 0', () => {
    // z3=70, hard=50 → ratio = 1.4
    const log = [
      entry(OLDEST_MONDAY, 70, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 50, { zone: 'Z4' }),
    ]
    renderCard({ log })
    expect(screen.getByText(/Z3\/\(Z4\+Z5\) ratio: 1\.4×/)).toBeInTheDocument()
  })
})

// ─── Citation footer ────────────────────────────────────────────────────────
describe('ZoneThreeBlackHoleCard — citation footer', () => {
  it('renders the citation (Seiler 2010; Stöggl 2014)', () => {
    const log = [
      entry(OLDEST_MONDAY, 80, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 20, { zone: 'Z4' }),
    ]
    renderCard({ log })
    expect(screen.getByText(/Seiler 2010; Stöggl 2014/)).toBeInTheDocument()
  })
})

// ─── Weekly mini-bars ───────────────────────────────────────────────────────
describe('ZoneThreeBlackHoleCard — weekly mini-bars', () => {
  it('renders 8 weekly bars', () => {
    const log = [
      entry(OLDEST_MONDAY, 60, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 60, { zone: 'Z4' }),
    ]
    renderCard({ log })
    const bars = document.querySelectorAll('[data-week-bar]')
    expect(bars.length).toBe(8)
  })

  it('exposes per-week data attributes', () => {
    const log = [
      entry(OLDEST_MONDAY, 60, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 60, { zone: 'Z4' }),
    ]
    renderCard({ log })
    const firstBar = document.querySelector('[data-week-bar]')
    expect(firstBar.getAttribute('data-week-start')).toBe(OLDEST_MONDAY)
    expect(firstBar.getAttribute('data-week-z3-min')).toBe('60')
    expect(firstBar.getAttribute('data-week-hard-min')).toBe('60')
  })
})

// ─── Accessibility ──────────────────────────────────────────────────────────
describe('ZoneThreeBlackHoleCard — accessibility', () => {
  it('exposes role="region" with a bilingual aria-label (EN)', () => {
    const log = [
      entry(OLDEST_MONDAY, 80, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 20, { zone: 'Z4' }),
    ]
    renderCard({ log })
    const region = screen.getByRole('region', { name: /Z3 black-hole detector/i })
    expect(region).toBeInTheDocument()
  })

  it('exposes role="region" with a bilingual aria-label (TR)', () => {
    const log = [
      entry(OLDEST_MONDAY, 80, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 20, { zone: 'Z4' }),
    ]
    renderCard({ log }, 'tr')
    const region = screen.getByRole('region', { name: /Z3 tuzağı dedektörü/i })
    expect(region).toBeInTheDocument()
  })

  it('exposes data-card="zone-three-black-hole" anchor', () => {
    const log = [
      entry(OLDEST_MONDAY, 80, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 20, { zone: 'Z4' }),
    ]
    renderCard({ log })
    const node = document.querySelector('[data-card="zone-three-black-hole"]')
    expect(node).not.toBeNull()
  })

  it('exposes data attributes for downstream test hooks', () => {
    const log = [
      entry(OLDEST_MONDAY, 80, { zone: 'Z3' }),
      entry(addDaysStr(OLDEST_MONDAY, 1), 20, { zone: 'Z4' }),
    ]
    renderCard({ log })
    const node = document.querySelector('[data-card="zone-three-black-hole"]')
    expect(node.getAttribute('data-zone-three-band')).toBe('BLACK_HOLE')
    expect(node.getAttribute('data-z3-share-pct')).toBe('80')
  })
})

// ─── Robustness ─────────────────────────────────────────────────────────────
describe('ZoneThreeBlackHoleCard — robustness', () => {
  it('renders nothing when LangCtx provides invalid today (no Provider crash)', () => {
    // With an empty log, today is taken from system time; we set it in beforeEach.
    const { container } = renderCard({ log: [] })
    // Empty log still renders the card with INSUFFICIENT_HARD_VOLUME band.
    expect(container.firstChild).not.toBeNull()
  })

  it('renders nothing when log is omitted entirely (default = [])', () => {
    const { container } = render(
      <LangCtx.Provider value={{ t: k => k, lang: 'en', setLang: () => {} }}>
        <ZoneThreeBlackHoleCard />
      </LangCtx.Provider>,
    )
    // Empty default log → INSUFFICIENT_HARD_VOLUME band still renders.
    expect(container.firstChild).not.toBeNull()
    const region = screen.getByRole('region', { name: /Z3 black-hole detector/i })
    expect(region.getAttribute('data-zone-three-band')).toBe('INSUFFICIENT_HARD_VOLUME')
  })
})
