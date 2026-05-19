// @vitest-environment jsdom
// ─── MesocycleProgressionCard.test.jsx ────────────────────────────────────
//
// Surface tests: render-null guards, weekly bars, band label rendering,
// EN + TR bilingual via LangCtx Provider, citation footer, console
// hygiene on render.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import MesocycleProgressionCard from '../dashboard/MesocycleProgressionCard.jsx'

const TODAY = '2026-05-20' // Wed → ISO Monday = 2026-05-18

// Mondays for the 12-week window ending at TODAY, oldest first.
const WEEK_MONDAYS = [
  '2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23',
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
      <MesocycleProgressionCard log={log} />
    </LangCtx.Provider>
  )
}

const ON_PATTERN_WEEKLY = [
  200, 220, 240, 100,
  210, 230, 250, 110,
  220, 240, 260, 120,
]

describe('MesocycleProgressionCard — guards', () => {
  it('renders nothing for an empty log', () => {
    const { container } = renderCard([])
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-card="mesocycle-progression"]')).toBeNull()
  })

  it('renders nothing for a null log', () => {
    const { container } = renderCard(null)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when fewer than 8 weeks have TSS', () => {
    // Only 5 weeks non-zero.
    const log = buildLog([200, 0, 200, 0, 200, 0, 200, 0, 200, 0, 0, 0])
    const { container } = renderCard(log)
    expect(container.firstChild).toBeNull()
  })
})

describe('MesocycleProgressionCard — render (ON_PATTERN)', () => {
  it('renders the card region with the EN heading', () => {
    renderCard(buildLog(ON_PATTERN_WEEKLY))
    const region = screen.getByRole('region', {
      name: /Mesocycle progression — 3:1 block periodization adherence/i,
    })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/MESOCYCLE PROGRESSION/)
  })

  it('renders 12 weekly bars with role data attributes', () => {
    renderCard(buildLog(ON_PATTERN_WEEKLY))
    const bars = document.querySelectorAll('[data-mesocycle-week]')
    expect(bars.length).toBe(12)
    // Each bar carries a role.
    const roles = Array.from(bars).map(b => b.getAttribute('data-week-role'))
    expect(roles.filter(r => r === 'BUILD').length).toBeGreaterThan(0)
    expect(roles.filter(r => r === 'DELOAD').length).toBe(3)
    expect(roles.filter(r => r === 'PEAK').length).toBe(3)
  })

  it('shows ON PATTERN band label and mesocycle count of 3', () => {
    renderCard(buildLog(ON_PATTERN_WEEKLY))
    const card = document.querySelector('[data-card="mesocycle-progression"]')
    expect(card.getAttribute('data-band')).toBe('ON_PATTERN')
    expect(card.getAttribute('data-mesocycles-detected')).toBe('3')
    const badge = document.querySelector('[data-mesocycle-band-badge]')
    expect(badge.textContent).toBe('ON PATTERN')
    const count = document.querySelector('[data-mesocycle-count]')
    expect(count.textContent).toBe('3')
  })

  it('shows deload depth as a percent', () => {
    renderCard(buildLog(ON_PATTERN_WEEKLY))
    const pct = document.querySelector('[data-deload-depth-pct]')
    expect(pct).not.toBeNull()
    // 120/240=.5, 110/250=.44, 120/260=.4615 → mean ≈ 0.4705 → 47 %
    expect(pct.textContent).toMatch(/^\d+%$/)
  })

  it('renders the citation footer Issurin 2010; Bompa 2018', () => {
    renderCard(buildLog(ON_PATTERN_WEEKLY))
    const cite = document.querySelector('[data-mesocycle-citation]')
    expect(cite).not.toBeNull()
    expect(cite.textContent).toBe('Issurin 2010; Bompa 2018')
  })
})

describe('MesocycleProgressionCard — band labels', () => {
  it('renders NO DELOAD for a no-deload pattern (EN)', () => {
    // 12 flat-ish weeks above the volume floor.
    const weekly = [200, 210, 200, 220, 200, 210, 200, 220, 200, 210, 200, 220]
    renderCard(buildLog(weekly))
    const card = document.querySelector('[data-card="mesocycle-progression"]')
    expect(card.getAttribute('data-band')).toBe('NO_DELOAD')
    const badge = document.querySelector('[data-mesocycle-band-badge]')
    expect(badge.textContent).toBe('NO DELOAD')
  })

  it('renders CHAOTIC for a sub-floor jumpy pattern (EN)', () => {
    const weekly = [60, 80, 70, 90, 80, 70, 60, 80, 70, 90, 80, 70]
    renderCard(buildLog(weekly))
    const card = document.querySelector('[data-card="mesocycle-progression"]')
    expect(card.getAttribute('data-band')).toBe('CHAOTIC')
    const badge = document.querySelector('[data-mesocycle-band-badge]')
    expect(badge.textContent).toBe('CHAOTIC')
  })
})

describe('MesocycleProgressionCard — Turkish', () => {
  it('renders the TR heading and band labels when lang=tr', () => {
    renderCard(buildLog(ON_PATTERN_WEEKLY), 'tr')
    const region = screen.getByRole('region', {
      name: /Mezodöngü ilerleyişi — 3:1 blok periyodizasyon uyumu/i,
    })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/MEZODÖNGÜ İLERLEYİŞİ/)
    const badge = document.querySelector('[data-mesocycle-band-badge]')
    expect(badge.textContent).toBe('DESENE UYGUN')
    // Hint text in Turkish.
    expect(region.textContent).toMatch(/Issurin blok periyodizasyonu/)
    // "TEMİZ MEZODÖNGÜ" label.
    expect(region.textContent).toMatch(/TEMİZ MEZODÖNGÜ/)
  })

  it('renders the TR NO_DELOAD label', () => {
    const weekly = [200, 210, 200, 220, 200, 210, 200, 220, 200, 210, 200, 220]
    renderCard(buildLog(weekly), 'tr')
    const badge = document.querySelector('[data-mesocycle-band-badge]')
    expect(badge.textContent).toBe('BOŞALTMA YOK')
  })
})

describe('MesocycleProgressionCard — console hygiene', () => {
  it('renders without console warnings or errors', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderCard(buildLog(ON_PATTERN_WEEKLY))
    expect(warnSpy).not.toHaveBeenCalled()
    expect(errSpy).not.toHaveBeenCalled()
    warnSpy.mockRestore()
    errSpy.mockRestore()
  })
})
