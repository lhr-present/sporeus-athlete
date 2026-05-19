// @vitest-environment jsdom
// ─── PaceRangeCard.test.jsx — card render tests ─────────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import PaceRangeCard from '../dashboard/PaceRangeCard.jsx'

const TODAY = '2026-05-18'

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function renderCard(props = {}, lang = 'en') {
  const value = { t: (k) => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <PaceRangeCard {...props} />
    </LangCtx.Provider>
  )
}

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function run(daysAgo, distanceKm, durationMin) {
  return {
    date: isoMinusDays(TODAY, daysAgo),
    type: 'run',
    distanceKm,
    durationMin,
  }
}

// ─── Null gating ────────────────────────────────────────────────────────────
describe('PaceRangeCard — null gating', () => {
  it('renders nothing when log is empty', () => {
    const { container } = renderCard({ log: [] })
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders nothing when fewer than 5 runs in window', () => {
    const log = [
      run(1, 10, 60),
      run(3, 10, 55),
      run(5, 10, 50),
      run(7, 10, 45),
    ]
    const { container } = renderCard({ log })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when no log prop passed', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })
})

// ─── WIDE_SPREAD band ───────────────────────────────────────────────────────
describe('PaceRangeCard — WIDE_SPREAD band (EN)', () => {
  it('renders title, spread value, band badge, range, median, citation', () => {
    // Fastest 4:00, slowest 7:00 → spread 3:00 → WIDE
    const log = [
      run(1, 5, 20),    // 4:00/km
      run(3, 10, 50),   // 5:00/km
      run(5, 10, 60),   // 6:00/km
      run(7, 10, 65),   // 6:30/km
      run(9, 10, 70),   // 7:00/km
    ]
    renderCard({ log })

    const card = screen.getByRole('region', { name: /Pace range/i })
    expect(card).toBeInTheDocument()
    expect(card.getAttribute('data-pace-range-card')).not.toBeNull()
    expect(card.getAttribute('data-pace-range-band')).toBe('WIDE_SPREAD')
    expect(card.getAttribute('data-sample-count')).toBe('5')

    expect(parseFloat(card.getAttribute('data-spread'))).toBeCloseTo(3.0, 4)
    expect(parseFloat(card.getAttribute('data-fastest-pace'))).toBeCloseTo(4.0, 4)
    expect(parseFloat(card.getAttribute('data-slowest-pace'))).toBeCloseTo(7.0, 4)
    expect(parseFloat(card.getAttribute('data-median-pace'))).toBeCloseTo(6.0, 4)

    expect(card.textContent).toMatch(/PACE RANGE · 28D/)
    expect(card.textContent).toMatch(/5 runs/)

    // Spread value rendered with ± prefix and M:SS/km format
    expect(card.textContent).toMatch(/±3:00\/km/)

    // Range endpoints
    expect(card.textContent).toMatch(/4:00\/km/)
    expect(card.textContent).toMatch(/7:00\/km/)
    // Median
    expect(card.textContent).toMatch(/6:00\/km/)

    // Band badge label (EN)
    expect(card.textContent).toMatch(/WIDE/)

    // Interpretation hint (EN)
    expect(
      screen.getByText(/Wide pace variety — you're using both ends of the spectrum\. Polarized training territory\./i)
    ).toBeInTheDocument()

    expect(card.textContent).toMatch(/Daniels 2014; Seiler 2010/)
  })
})

// ─── MODERATE_SPREAD band ───────────────────────────────────────────────────
describe('PaceRangeCard — MODERATE_SPREAD band (EN)', () => {
  it('renders MODERATE band, hint, anchors', () => {
    // 5:00 → 6:30 → spread 1:30
    const log = [
      run(1, 10, 50),
      run(3, 10, 55),
      run(5, 10, 60),
      run(7, 10, 62),
      run(9, 10, 65),
    ]
    renderCard({ log })

    const card = screen.getByRole('region')
    expect(card.getAttribute('data-pace-range-band')).toBe('MODERATE_SPREAD')

    expect(card.textContent).toMatch(/±1:30\/km/)
    expect(card.textContent).toMatch(/MODERATE/)

    expect(
      screen.getByText(/Some pace variety\. Add 1-2 sessions at extreme paces \(very easy OR very fast\) for full polarization\./i)
    ).toBeInTheDocument()
  })
})

// ─── NARROW_SPREAD band ─────────────────────────────────────────────────────
describe('PaceRangeCard — NARROW_SPREAD band (EN)', () => {
  it('renders NARROW band + junk-mile hint', () => {
    // 5:30 → 6:00 → spread 0:30
    const log = [
      run(1, 10, 55),
      run(3, 10, 56),
      run(5, 10, 57),
      run(7, 10, 58),
      run(9, 10, 60),
    ]
    renderCard({ log })

    const card = screen.getByRole('region')
    expect(card.getAttribute('data-pace-range-band')).toBe('NARROW_SPREAD')

    expect(card.textContent).toMatch(/±0:30\/km/)
    // Match NARROW without colliding with anything else
    expect(card.textContent).toMatch(/NARROW/)

    expect(
      screen.getByText(/Single-pace pattern — most runs land in a tight pace band\. Junk-mile risk\. Push hard days harder, easy days easier\./i)
    ).toBeInTheDocument()
  })
})

// ─── Turkish ────────────────────────────────────────────────────────────────
describe('PaceRangeCard — Turkish', () => {
  it('renders TR title, TR band label (GENİŞ), TR hint (WIDE)', () => {
    const log = [
      run(1, 5, 20),    // 4:00/km
      run(3, 10, 50),
      run(5, 10, 60),
      run(7, 10, 65),
      run(9, 10, 70),   // 7:00/km — spread 3:00 → WIDE
    ]
    renderCard({ log }, 'tr')

    const card = screen.getByRole('region')
    expect(card.getAttribute('data-pace-range-card')).not.toBeNull()
    expect(card.getAttribute('data-pace-range-band')).toBe('WIDE_SPREAD')

    expect(card.textContent).toMatch(/TEMPO ARALIĞI · 28G/)
    expect(card.textContent).toMatch(/5 koşu/)
    expect(card.textContent).toMatch(/GENİŞ/)

    expect(
      screen.getByText(/Geniş tempo çeşitliliği — spektrumun her iki ucunu kullanıyorsun\. Polarize antrenman bölgesi\./i)
    ).toBeInTheDocument()
  })

  it('renders TR ORTA + TR moderate-hint', () => {
    const log = [
      run(1, 10, 50),
      run(3, 10, 55),
      run(5, 10, 60),
      run(7, 10, 62),
      run(9, 10, 65),
    ]
    renderCard({ log }, 'tr')
    const card = screen.getByRole('region')
    expect(card.getAttribute('data-pace-range-band')).toBe('MODERATE_SPREAD')
    expect(card.textContent).toMatch(/ORTA/)
    expect(
      screen.getByText(/Bir miktar tempo çeşitliliği\. Tam polarizasyon için aşırı tempolarda \(çok kolay VEYA çok hızlı\) 1-2 seans ekle\./i)
    ).toBeInTheDocument()
  })

  it('renders TR DAR + TR narrow-hint', () => {
    const log = [
      run(1, 10, 55),
      run(3, 10, 56),
      run(5, 10, 57),
      run(7, 10, 58),
      run(9, 10, 60),
    ]
    renderCard({ log }, 'tr')
    const card = screen.getByRole('region')
    expect(card.getAttribute('data-pace-range-band')).toBe('NARROW_SPREAD')
    expect(card.textContent).toMatch(/DAR/)
    expect(
      screen.getByText(/Tek-tempo deseni — koşuların çoğu dar bir aralıkta\. Verimsiz-mil riski\. Sert günleri daha sert, kolay günleri daha kolay yap\./i)
    ).toBeInTheDocument()
  })
})

// ─── Data anchors ───────────────────────────────────────────────────────────
describe('PaceRangeCard — data anchors', () => {
  it('emits all required data attributes', () => {
    const log = [
      run(1, 5, 20),
      run(3, 10, 50),
      run(5, 10, 60),
      run(7, 10, 65),
      run(9, 10, 70),
    ]
    renderCard({ log })

    const card = screen.getByRole('region')
    expect(card.hasAttribute('data-pace-range-card')).toBe(true)
    expect(card.hasAttribute('data-pace-range-band')).toBe(true)
    expect(card.hasAttribute('data-spread')).toBe(true)
    expect(card.hasAttribute('data-fastest-pace')).toBe(true)
    expect(card.hasAttribute('data-slowest-pace')).toBe(true)
    expect(card.hasAttribute('data-median-pace')).toBe(true)
    expect(card.hasAttribute('data-sample-count')).toBe(true)
  })

  it('has accessibility role + aria-label', () => {
    const log = [
      run(1, 5, 20),
      run(3, 10, 50),
      run(5, 10, 60),
      run(7, 10, 65),
      run(9, 10, 70),
    ]
    renderCard({ log })
    const card = screen.getByRole('region')
    expect(card.getAttribute('aria-label')).toMatch(/Pace range/i)
  })
})

// ─── Pace formatting in the rendered card ───────────────────────────────────
describe('PaceRangeCard — pace formatting', () => {
  it('zero-pads seconds (e.g. 4:05/km not 4:5/km)', () => {
    // 4:05/km fastest needs 5 km in 20.4167 minutes → 4.0833 min/km
    // Just feed paces that yield zero-padded seconds: 4:05/km and 5:55/km
    const log = [
      run(1, 12, 49),    // 49/12 = 4.0833 → 4:05
      run(3, 10, 55),
      run(5, 10, 59),
      run(7, 12, 71),    // 71/12 ≈ 5.9166 → 5:55
      run(9, 12, 71),
    ]
    renderCard({ log })
    const card = screen.getByRole('region')
    expect(card.textContent).toMatch(/4:05\/km/)
    expect(card.textContent).toMatch(/5:55\/km/)
  })

  it('renders fastest and slowest in pace-range-fastest / pace-range-slowest spans', () => {
    const log = [
      run(1, 5, 20),
      run(3, 10, 50),
      run(5, 10, 60),
      run(7, 10, 65),
      run(9, 10, 70),
    ]
    renderCard({ log })
    const card = screen.getByRole('region')
    const fastestEl = card.querySelector('[data-pace-range-fastest]')
    const slowestEl = card.querySelector('[data-pace-range-slowest]')
    const medianEl = card.querySelector('[data-pace-range-median]')

    expect(fastestEl).toBeTruthy()
    expect(slowestEl).toBeTruthy()
    expect(medianEl).toBeTruthy()

    expect(fastestEl.textContent).toMatch(/4:00\/km/)
    expect(slowestEl.textContent).toMatch(/7:00\/km/)
    expect(medianEl.textContent).toMatch(/6:00\/km/)
  })

  it('spread formatted as M:SS/km without a sign', () => {
    const log = [
      run(1, 10, 50),
      run(3, 10, 55),
      run(5, 10, 60),
      run(7, 10, 62),
      run(9, 10, 65),    // spread 1:30
    ]
    renderCard({ log })
    const card = screen.getByRole('region')
    expect(card.textContent).toMatch(/±1:30\/km/)
    // No "+" or "-" inside the spread token
    expect(card.textContent).not.toMatch(/[+-]1:30\/km/)
  })
})
