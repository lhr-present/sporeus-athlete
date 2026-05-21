// @vitest-environment jsdom
// ─── AlternatingWeekPatternCard.test.jsx ──────────────────────────────────
//
// Surface tests: render-null guards, INSUFFICIENT_DATA state, each band
// renders, EN + TR bilingual via LangCtx Provider, citation footer,
// accessibility, 8-bar rendering with mean line.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import AlternatingWeekPatternCard from '../dashboard/AlternatingWeekPatternCard.jsx'

const TODAY = '2026-05-20' // Wed → ISO Monday = 2026-05-18

// Mondays for the 8-week window ending at TODAY, oldest first.
const WEEK_MONDAYS = [
  '2026-03-30', '2026-04-06', '2026-04-13', '2026-04-20',
  '2026-04-27', '2026-05-04', '2026-05-11', '2026-05-18',
]

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function sessionInWeek(weekIdx, tss, dayOffset = 1) {
  const monday = WEEK_MONDAYS[weekIdx]
  const d = new Date(monday + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + dayOffset)
  return { date: d.toISOString().slice(0, 10), tss, type: 'Endurance' }
}

function buildLog(weekly) {
  const out = []
  for (let i = 0; i < weekly.length; i++) {
    if (weekly[i] > 0) out.push(sessionInWeek(i, weekly[i]))
  }
  return out
}

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <AlternatingWeekPatternCard log={log} />
    </LangCtx.Provider>
  )
}

const STRONG_WEEKLY    = [300, 100, 300, 100, 300, 100, 300, 100]
const MODERATE_WEEKLY  = [400, 100, 400, 100, 240, 240, 240, 240]
const FLAT_WEEKLY      = [200, 205, 198, 202, 200, 199, 201, 203]

describe('AlternatingWeekPatternCard — guards', () => {
  it('renders nothing when analyze returns null (mocked)', async () => {
    vi.resetModules()
    vi.doMock('../../lib/athlete/alternatingWeekPattern.js', () => ({
      analyzeAlternatingWeekPattern: () => null,
      ALTERNATING_WEEK_PATTERN_CITATION: 'Issurin 2010; Mujika 2014',
    }))
    const { default: MockedCard } = await import(
      '../dashboard/AlternatingWeekPatternCard.jsx?nullgate'
    )
    const value = { t: k => k, lang: 'en', setLang: () => {} }
    const { container } = render(
      <LangCtx.Provider value={value}>
        <MockedCard log={[]} />
      </LangCtx.Provider>
    )
    expect(container.firstChild).toBeNull()
    vi.doUnmock('../../lib/athlete/alternatingWeekPattern.js')
    vi.resetModules()
  })
})

describe('AlternatingWeekPatternCard — INSUFFICIENT_DATA', () => {
  it('renders the INSUFFICIENT_DATA state for an empty log', () => {
    renderCard([])
    const card = document.querySelector('[data-card="alternating-week-pattern"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_DATA')
    const badge = document.querySelector('[data-alternating-band-badge]')
    expect(badge.textContent).toBe('INSUFFICIENT DATA')
  })

  it('renders INSUFFICIENT_DATA when fewer than 6 weeks have TSS', () => {
    const log = buildLog([200, 0, 200, 0, 200, 0, 0, 200])
    renderCard(log)
    const card = document.querySelector('[data-card="alternating-week-pattern"]')
    expect(card.getAttribute('data-band')).toBe('INSUFFICIENT_DATA')
    // No bars rendered when weeks is empty.
    expect(document.querySelectorAll('[data-alternating-week]').length).toBe(0)
  })
})

describe('AlternatingWeekPatternCard — STRONG_ALTERNATION', () => {
  it('renders the EN card region with the heading', () => {
    renderCard(buildLog(STRONG_WEEKLY))
    const region = screen.getByRole('region', {
      name: /Alternating week rhythm — high\/low week oscillation/i,
    })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/ALTERNATING WEEK RHYTHM/)
  })

  it('exposes the band on the card data-band attribute', () => {
    renderCard(buildLog(STRONG_WEEKLY))
    const card = document.querySelector('[data-card="alternating-week-pattern"]')
    expect(card.getAttribute('data-band')).toBe('STRONG_ALTERNATION')
    const badge = document.querySelector('[data-alternating-band-badge]')
    expect(badge.textContent).toBe('STRONG ALTERNATION')
  })

  it('renders 8 vertical bars and a mean line', () => {
    renderCard(buildLog(STRONG_WEEKLY))
    const bars = document.querySelectorAll('[data-alternating-week]')
    expect(bars.length).toBe(8)
    const meanLine = document.querySelector('[data-mean-line]')
    expect(meanLine).not.toBeNull()
  })

  it('tags every bar with HIGH or LOW for a clean alternation', () => {
    renderCard(buildLog(STRONG_WEEKLY))
    const bars = document.querySelectorAll('[data-alternating-week]')
    const roles = Array.from(bars).map(b => b.getAttribute('data-week-role'))
    expect(roles.filter(r => r === 'HIGH').length).toBe(4)
    expect(roles.filter(r => r === 'LOW').length).toBe(4)
  })

  it('renders alternationScore as a percent', () => {
    renderCard(buildLog(STRONG_WEEKLY))
    const v = document.querySelector('[data-alternation-score-value]')
    expect(v).not.toBeNull()
    // 8 weeks alternating → 7/7 = 100%
    expect(v.textContent).toBe('100%')
  })

  it('renders amplitudeRatio with × suffix', () => {
    renderCard(buildLog(STRONG_WEEKLY))
    const amp = document.querySelector('[data-amplitude-ratio-str]')
    expect(amp).not.toBeNull()
    expect(amp.textContent).toMatch(/^\d+\.\d{2}×$/)
  })

  it('renders HIGH and LOW counts', () => {
    renderCard(buildLog(STRONG_WEEKLY))
    const hi = document.querySelector('[data-high-count]')
    const lo = document.querySelector('[data-low-count]')
    expect(hi.textContent).toBe('4')
    expect(lo.textContent).toBe('4')
  })

  it('renders the citation footer Issurin 2010; Mujika 2014', () => {
    renderCard(buildLog(STRONG_WEEKLY))
    const cite = document.querySelector('[data-alternating-citation]')
    expect(cite).not.toBeNull()
    expect(cite.textContent).toBe('Issurin 2010; Mujika 2014')
  })
})

describe('AlternatingWeekPatternCard — band labels', () => {
  it('renders MODERATE ALTERNATION for a partial pattern', () => {
    renderCard(buildLog(MODERATE_WEEKLY))
    const card = document.querySelector('[data-card="alternating-week-pattern"]')
    expect(card.getAttribute('data-band')).toBe('MODERATE_ALTERNATION')
    const badge = document.querySelector('[data-alternating-band-badge]')
    expect(badge.textContent).toBe('MODERATE ALTERNATION')
  })

  it('renders NO ALTERNATION for near-flat weeks', () => {
    renderCard(buildLog(FLAT_WEEKLY))
    const card = document.querySelector('[data-card="alternating-week-pattern"]')
    expect(card.getAttribute('data-band')).toBe('NO_ALTERNATION')
    const badge = document.querySelector('[data-alternating-band-badge]')
    expect(badge.textContent).toBe('NO ALTERNATION')
  })
})

describe('AlternatingWeekPatternCard — Turkish', () => {
  it('renders TR heading and TR band label for STRONG_ALTERNATION', () => {
    renderCard(buildLog(STRONG_WEEKLY), 'tr')
    const region = screen.getByRole('region', {
      name: /Dönüşümlü hafta ritmi — yüksek\/düşük hafta osilasyonu/i,
    })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/DÖNÜŞÜMLÜ HAFTA RİTMİ/)
    const badge = document.querySelector('[data-alternating-band-badge]')
    expect(badge.textContent).toBe('GÜÇLÜ DÖNÜŞÜM')
    // TR hint text included.
    expect(region.textContent).toMatch(/Issurin dönüşümlü hafta deseni/)
  })

  it('renders TR INSUFFICIENT_DATA label', () => {
    renderCard([], 'tr')
    const badge = document.querySelector('[data-alternating-band-badge]')
    expect(badge.textContent).toBe('YETERSİZ VERİ')
  })

  it('renders TR labels for chips (DÖNÜŞÜM SKORU, GENLİK ORANI)', () => {
    renderCard(buildLog(STRONG_WEEKLY), 'tr')
    const region = screen.getByRole('region', {
      name: /Dönüşümlü hafta ritmi/i,
    })
    expect(region.textContent).toMatch(/DÖNÜŞÜM SKORU/)
    expect(region.textContent).toMatch(/GENLİK ORANI/)
  })
})

describe('AlternatingWeekPatternCard — accessibility', () => {
  it('uses role="region" with an aria-label', () => {
    renderCard(buildLog(STRONG_WEEKLY))
    const region = screen.getByRole('region', {
      name: /Alternating week rhythm/i,
    })
    expect(region.getAttribute('aria-label')).toMatch(/Alternating week rhythm/)
  })

  it('marks the bar-chart SVG as role="img" with an aria-label', () => {
    renderCard(buildLog(STRONG_WEEKLY))
    const svg = document.querySelector('[data-alternating-bars]')
    expect(svg).not.toBeNull()
    expect(svg.getAttribute('role')).toBe('img')
    expect(svg.getAttribute('aria-label')).toMatch(/Weekly TSS mini chart/)
  })
})

describe('AlternatingWeekPatternCard — console hygiene', () => {
  it('renders without console warnings or errors', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errSpy  = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderCard(buildLog(STRONG_WEEKLY))
    expect(warnSpy).not.toHaveBeenCalled()
    expect(errSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
    errSpy.mockRestore()
  })
})
