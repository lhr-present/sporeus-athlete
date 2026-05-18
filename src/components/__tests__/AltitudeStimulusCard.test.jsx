// @vitest-environment jsdom
// ─── AltitudeStimulusCard.test.jsx — Dashboard surface tests ────────────────
//
// Covers: empty/null log render-null cases, fewer-than-7-sessions guard,
// zero-elevation guard, each of the 3 bands (HYPOXIC_STIMULUS / MODERATE
// / NONE), the data-altitude-band anchor, data-total-ascent, the weekly
// chips (data-week-index), and Turkish heading rendering.
//
// We freeze the system clock so `detectAltitudeStimulus({ log })`
// (invoked without `today`) sees a deterministic "today" relative to
// the log dates synthesized by `daysAgo()`.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import AltitudeStimulusCard from '../dashboard/AltitudeStimulusCard.jsx'

const TODAY = '2026-05-14'

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

function climb(n, elevationGainM) {
  return {
    date: daysAgo(n),
    elevationGainM,
    durationMin: 90,
    type: 'Endurance',
    sport: 'cycling',
  }
}

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <AltitudeStimulusCard log={log} />
    </LangCtx.Provider>
  )
}

describe('AltitudeStimulusCard — guards', () => {
  it('renders nothing for an empty log', () => {
    const { container } = renderCard([])
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-altitude-stimulus-card]')).toBeNull()
  })

  it('renders nothing when log is null', () => {
    const { container } = renderCard(null)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when fewer than 7 sessions are in window', () => {
    const log = [
      climb(1, 800),
      climb(3, 800),
      climb(5, 800),
    ]
    const { container } = renderCard(log)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when 7+ sessions exist but none have elevation data', () => {
    const log = []
    for (let i = 0; i < 8; i++) {
      log.push({
        date: daysAgo(i),
        durationMin: 60,
        type: 'Easy',
        sport: 'running',
      })
    }
    const { container } = renderCard(log)
    expect(container.firstChild).toBeNull()
  })
})

describe('AltitudeStimulusCard — HYPOXIC_STIMULUS band', () => {
  it('renders with HYPOXIC_STIMULUS band when ≥3 weeks ≥1500m', () => {
    const log = [
      // 3 high weeks + 1 flat
      climb(1,  800), climb(3,  800),  // week 0: 1600m
      climb(8,  850), climb(10, 850),  // week 1: 1700m
      climb(15, 900), climb(17, 900),  // week 2: 1800m
      climb(22, 200),                  // week 3: 200m
    ]
    renderCard(log)
    const card = document.querySelector('[data-altitude-stimulus-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-altitude-band')).toBe('HYPOXIC_STIMULUS')
    expect(card.getAttribute('data-total-ascent')).toBe(String(1600 + 1700 + 1800 + 200))
    const region = screen.getByRole('region', { name: /Altitude stimulus/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/ALTITUDE STIMULUS · 28D/)
    expect(region.textContent).toMatch(/HYPOXIC_STIMULUS/)
    expect(region.textContent).toMatch(/EPO response/i)
    expect(region.textContent).toMatch(/Lippl 2010; Levine 1997/)
  })

  it('renders 4 weekly chips with data-week-index attributes', () => {
    const log = [
      climb(1,  800), climb(3,  800),
      climb(8,  850), climb(10, 850),
      climb(15, 900), climb(17, 900),
      climb(22, 200),
    ]
    renderCard(log)
    const chips = document.querySelectorAll('[data-altitude-week-chip]')
    expect(chips.length).toBe(4)
    const indices = Array.from(chips).map(c => c.getAttribute('data-week-index'))
    expect(indices).toEqual(['0', '1', '2', '3'])
  })
})

describe('AltitudeStimulusCard — MODERATE band', () => {
  it('renders with MODERATE band when ≥2 weeks in 500–1500m range', () => {
    const log = [
      climb(1, 400), climb(3, 400),   // week 0: 800m moderate
      climb(8, 350), climb(10, 350),  // week 1: 700m moderate
      climb(15, 50),                  // week 2: 50m
      climb(22, 50),                  // week 3: 50m
      climb(5,  100),                 // filler
    ]
    renderCard(log)
    const card = document.querySelector('[data-altitude-stimulus-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-altitude-band')).toBe('MODERATE')
    expect(card.textContent).toMatch(/MODERATE/)
    expect(card.textContent).toMatch(/increase climbing minutes/i)
  })
})

describe('AltitudeStimulusCard — NONE band', () => {
  it('renders with NONE band when fewer than 2 weeks reach 500m', () => {
    const log = [
      climb(1, 300), climb(2, 300),   // week 0: 600m (moderate)
      // every other week below 500m
      climb(8,  50), climb(10, 50),
      climb(15, 50), climb(17, 50),
      climb(22, 50), climb(24, 50),
    ]
    renderCard(log)
    const card = document.querySelector('[data-altitude-stimulus-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-altitude-band')).toBe('NONE')
    expect(card.textContent).toMatch(/NONE/)
    expect(card.textContent).toMatch(/Minimal elevation gain/i)
  })
})

describe('AltitudeStimulusCard — bilingual', () => {
  it('renders the Turkish heading and band label when lang=tr', () => {
    const log = [
      climb(1, 400), climb(3, 400),
      climb(8, 350), climb(10, 350),
      climb(15, 50),
      climb(22, 50),
      climb(5,  100),
    ]
    renderCard(log, 'tr')
    const region = screen.getByRole('region', { name: /İrtifa uyaranı/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/İRTİFA UYARANI · 28G/)
    // MODERATE in Turkish
    expect(region.textContent).toMatch(/ORTA/)
    // Turkish hint for MODERATE
    expect(region.textContent).toMatch(/tırmanış dakikalarını artır/)
  })

  it('renders Turkish hint for HYPOXIC_STIMULUS band', () => {
    const log = [
      climb(1,  800), climb(3,  800),
      climb(8,  850), climb(10, 850),
      climb(15, 900), climb(17, 900),
      climb(22, 200),
    ]
    renderCard(log, 'tr')
    const card = document.querySelector('[data-altitude-stimulus-card]')
    expect(card.getAttribute('data-altitude-band')).toBe('HYPOXIC_STIMULUS')
    expect(card.textContent).toMatch(/HİPOKSİK/)
    expect(card.textContent).toMatch(/EPO yanıtı/)
  })

  it('renders Turkish hint for NONE band', () => {
    const log = [
      climb(1, 300), climb(2, 300),
      climb(8,  50), climb(10, 50),
      climb(15, 50), climb(17, 50),
      climb(22, 50), climb(24, 50),
    ]
    renderCard(log, 'tr')
    const card = document.querySelector('[data-altitude-stimulus-card]')
    expect(card.getAttribute('data-altitude-band')).toBe('NONE')
    expect(card.textContent).toMatch(/YOK/)
    expect(card.textContent).toMatch(/hipoksik adaptasyon için tırmanış hacmi yetersiz/)
  })
})
