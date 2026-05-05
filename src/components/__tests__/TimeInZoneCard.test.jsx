// @vitest-environment jsdom
// ─── TimeInZoneCard.test.jsx — render tests for v8.79.0 time-in-zone card ────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import TimeInZoneCard from '../dashboard/TimeInZoneCard.jsx'

beforeEach(() => {
  vi.setSystemTime(new Date('2026-05-05T12:00:00Z'))
})
afterEach(() => {
  vi.setSystemTime(new Date())
})

function renderCard(props, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <TimeInZoneCard {...props} />
    </LangCtx.Provider>
  )
}

const TODAY = '2026-05-05'

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function makeLog(count, today, zonesArr) {
  const log = []
  for (let i = count - 1; i >= 0; i--) {
    log.push({
      date: addDays(today, -i),
      zones: zonesArr.slice(),
      type: 'run',
    })
  }
  return log
}

// Polarized-perfect 28d fixture (matches lib good-band test)
const GOOD_FIXTURE = makeLog(28, TODAY, [28, 56, 7, 7, 4])

// Single-zone-over moderate-band fixture. Per-day [28,56,12,7,4]×28 →
// totals 784/1568/336/196/112 (sum 2996). Default scaled targets at
// 28/56/7/7/4 → ~839/1678/210/210/120. Only Z3 ratio 1.60 lands outside
// ±20% band (over) — others within. → moderate band.
const MODERATE_FIXTURE = makeLog(28, TODAY, [28, 56, 12, 7, 4])

// Three-zones-off poor band fixture: Z3 inflated, Z4 inflated, Z5 inflated.
// Per-day [10, 30, 30, 30, 0] × 28 = 280/840/840/840/0 (sum 2800).
// Scaled targets 28/56/7/7/4 → 784/1568/196/196/112. Z2 ratio 0.54 (under),
// Z3 4.29 (over), Z4 4.29 (over), Z5 0 (under). 4 zones off → poor.
const POOR_FIXTURE = makeLog(28, TODAY, [10, 30, 30, 30, 0])

describe('TimeInZoneCard — insufficient data', () => {
  it('renders insufficient-data notice when log empty', () => {
    renderCard({ log: [] })
    expect(
      screen.getByText(/Log 200\+ minutes to track time in zone/i)
    ).toBeInTheDocument()
  })

  it('renders TR insufficient-data notice when lang=tr', () => {
    renderCard({ log: [] }, 'tr')
    expect(
      screen.getByText(/Bölge süreleri için 200\+ dk veri gerekli/i)
    ).toBeInTheDocument()
  })
})

describe('TimeInZoneCard — band classification', () => {
  it('renders ON TARGET band with polarized-perfect fixture', () => {
    renderCard({ log: GOOD_FIXTURE })
    expect(screen.getByText('ON TARGET')).toBeInTheDocument()
  })

  it('renders MODERATE band when one zone deviates', () => {
    renderCard({ log: MODERATE_FIXTURE })
    expect(screen.getByText('MODERATE')).toBeInTheDocument()
  })

  it('renders POOR band when three+ zones off', () => {
    renderCard({ log: POOR_FIXTURE })
    expect(screen.getByText('POOR')).toBeInTheDocument()
  })
})

describe('TimeInZoneCard — bilingual', () => {
  it('renders English title when lang=en', () => {
    renderCard({ log: GOOD_FIXTURE })
    expect(screen.getByText('TIME IN ZONE — 28D')).toBeInTheDocument()
  })

  it('renders Turkish title and band label when lang=tr', () => {
    renderCard({ log: GOOD_FIXTURE }, 'tr')
    expect(screen.getByText('BÖLGE SÜRELERİ — 28G')).toBeInTheDocument()
    expect(screen.getByText('HEDEFTE')).toBeInTheDocument()
  })
})

describe('TimeInZoneCard — a11y + structure', () => {
  it('card root has role=region with bilingual aria-label (en)', () => {
    renderCard({ log: GOOD_FIXTURE })
    const region = screen.getByRole('region')
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('aria-label')).toMatch(/Time in zone/i)
  })

  it('renders role=img stacked bar with zone-share aria-label', () => {
    renderCard({ log: GOOD_FIXTURE })
    const bar = screen.getByRole('img')
    expect(bar).toBeInTheDocument()
    expect(bar.getAttribute('aria-label')).toMatch(/Z1.*Z2.*Z3.*Z4.*Z5/)
  })

  it('renders the citation footer', () => {
    renderCard({ log: GOOD_FIXTURE })
    expect(screen.getByText(/Seiler 2010 polarized/)).toBeInTheDocument()
  })
})

describe('TimeInZoneCard — content rendering', () => {
  it('byZone breakdown renders all 5 zones', () => {
    renderCard({ log: GOOD_FIXTURE })
    const region = screen.getByRole('region')
    for (const z of ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']) {
      expect(within(region).getAllByText(new RegExp(`${z}:`)).length).toBeGreaterThan(0)
    }
  })

  it('totalMinutes big number renders', () => {
    renderCard({ log: GOOD_FIXTURE })
    // 28 days * (28+56+7+7+4 = 102 min/day) = 2856
    expect(screen.getByText('2856')).toBeInTheDocument()
  })

  it('worstZone callout renders when band !== good', () => {
    renderCard({ log: MODERATE_FIXTURE })
    expect(screen.getByText(/Worst:/i)).toBeInTheDocument()
  })

  it('worstZone callout absent on good band', () => {
    renderCard({ log: GOOD_FIXTURE })
    expect(screen.queryByText(/Worst:/i)).not.toBeInTheDocument()
  })

  it('status arrow glyph renders for off-target zone', () => {
    renderCard({ log: MODERATE_FIXTURE })
    // At least one ↑ (over) must appear since Z3 is over-target
    const region = screen.getByRole('region')
    expect(region.textContent).toMatch(/↑/)
  })

  it('TR target label "hedef" appears when lang=tr', () => {
    renderCard({ log: GOOD_FIXTURE }, 'tr')
    const region = screen.getByRole('region')
    expect(region.textContent).toMatch(/hedef/)
  })
})
