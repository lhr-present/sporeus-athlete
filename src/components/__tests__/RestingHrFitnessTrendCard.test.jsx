// @vitest-environment jsdom
// ─── RestingHrFitnessTrendCard.test.jsx — Dashboard surface tests ──────────
//
// Covers: null guard (insufficient samples), each of the 3 bands
// (IMPROVING / STABLE / RISING), Turkish bilingual rendering, and the
// full set of `data-*` anchors required by the spec.
//
// We freeze the system clock so `analyzeRestingHrFitnessTrend({ recovery })`
// (called without an explicit `today`) sees a deterministic anchor.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import RestingHrFitnessTrendCard from '../dashboard/RestingHrFitnessTrendCard.jsx'

const TODAY = '2026-05-17'

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function daysBefore(n) {
  const d = new Date(`${TODAY}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function renderCard(recovery, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <RestingHrFitnessTrendCard recovery={recovery} />
    </LangCtx.Provider>
  )
}

describe('RestingHrFitnessTrendCard — guards', () => {
  it('renders nothing when recovery is empty', () => {
    const { container } = renderCard([])
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-resting-hr-fitness-trend-card]')).toBeNull()
  })

  it('renders nothing when recovery is null', () => {
    const { container } = renderCard(null)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when fewer than 10 lifetime entries', () => {
    const recovery = Array.from({ length: 8 }, (_, i) => ({
      date: daysBefore(i),
      restingHR: 50,
    }))
    const { container } = renderCard(recovery)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when fewer than 5 entries in the recent window', () => {
    // 10 lifetime entries, only 4 within last 90 days.
    const recovery = [
      ...Array.from({ length: 6 }, (_, i) => ({
        date: daysBefore(200 + i),
        restingHR: 55,
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        date: daysBefore(5 + i),
        restingHR: 50,
      })),
    ]
    const { container } = renderCard(recovery)
    expect(container.firstChild).toBeNull()
  })
})

describe('RestingHrFitnessTrendCard — IMPROVING band', () => {
  it('renders with IMPROVING band (green) when recent ≤ lifetime − 2 bpm', () => {
    // 15 old at 55 + 5 recent at 50 → delta ≈ −3.75 → IMPROVING.
    const recovery = [
      ...Array.from({ length: 15 }, (_, i) => ({
        date: daysBefore(200 + i),
        restingHR: 55,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        date: daysBefore(i),
        restingHR: 50,
      })),
    ]
    renderCard(recovery)
    const card = document.querySelector('[data-resting-hr-fitness-trend-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-fitness-band')).toBe('IMPROVING')
    const region = screen.getByRole('region', {
      name: /Resting heart rate long-term fitness trend/i,
    })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/RESTING HR · 90D vs LIFETIME/)
    expect(region.textContent).toMatch(/IMPROVING/)
    expect(region.textContent).toMatch(/50 bpm/)
    expect(region.textContent).toMatch(/aerobic adaptation is working/i)
    expect(region.textContent).toMatch(/Buchheit 2014/)
    expect(region.textContent).toMatch(/Plews 2014/)
  })
})

describe('RestingHrFitnessTrendCard — STABLE band', () => {
  it('renders with STABLE band (blue) when |delta| < 2 bpm', () => {
    const recovery = [
      ...Array.from({ length: 15 }, (_, i) => ({
        date: daysBefore(200 + i),
        restingHR: 50,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        date: daysBefore(i),
        restingHR: 50,
      })),
    ]
    renderCard(recovery)
    const card = document.querySelector('[data-resting-hr-fitness-trend-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-fitness-band')).toBe('STABLE')
    expect(card.textContent).toMatch(/STABLE/)
    expect(card.textContent).toMatch(/fitness is consistent/i)
  })
})

describe('RestingHrFitnessTrendCard — RISING band', () => {
  it('renders with RISING band (orange) when recent ≥ lifetime + 2 bpm', () => {
    // 15 old at 50 + 5 recent at 55 → delta ≈ +3.75 → RISING.
    const recovery = [
      ...Array.from({ length: 15 }, (_, i) => ({
        date: daysBefore(200 + i),
        restingHR: 50,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        date: daysBefore(i),
        restingHR: 55,
      })),
    ]
    renderCard(recovery)
    const card = document.querySelector('[data-resting-hr-fitness-trend-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-fitness-band')).toBe('RISING')
    expect(card.textContent).toMatch(/RISING/)
    expect(card.textContent).toMatch(/55 bpm/)
    expect(card.textContent).toMatch(/sleep, illness/i)
  })
})

describe('RestingHrFitnessTrendCard — data anchors', () => {
  it('exposes all required data-* attributes', () => {
    const recovery = [
      ...Array.from({ length: 15 }, (_, i) => ({
        date: daysBefore(200 + i),
        restingHR: 50,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        date: daysBefore(i),
        restingHR: 55,
      })),
    ]
    renderCard(recovery)
    const card = document.querySelector('[data-resting-hr-fitness-trend-card]')
    expect(card).not.toBeNull()
    expect(card.hasAttribute('data-fitness-band')).toBe(true)
    expect(card.hasAttribute('data-recent-avg-rhr')).toBe(true)
    expect(card.hasAttribute('data-lifetime-avg-rhr')).toBe(true)
    expect(card.hasAttribute('data-delta')).toBe(true)
    expect(card.hasAttribute('data-recent-sample-count')).toBe(true)
    expect(card.hasAttribute('data-lifetime-sample-count')).toBe(true)
    // Verify shape of the values.
    expect(card.getAttribute('data-recent-sample-count')).toBe('5')
    expect(card.getAttribute('data-lifetime-sample-count')).toBe('20')
    expect(Number(card.getAttribute('data-recent-avg-rhr'))).toBeCloseTo(55, 1)
    // Lifetime = (15*50 + 5*55)/20 = 51.25
    expect(Number(card.getAttribute('data-lifetime-avg-rhr'))).toBeCloseTo(51.25, 1)
    expect(Number(card.getAttribute('data-delta'))).toBeCloseTo(3.75, 1)
  })
})

describe('RestingHrFitnessTrendCard — bilingual', () => {
  it('renders Turkish title + RISING band label when lang=tr', () => {
    const recovery = [
      ...Array.from({ length: 15 }, (_, i) => ({
        date: daysBefore(200 + i),
        restingHR: 50,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        date: daysBefore(i),
        restingHR: 55,
      })),
    ]
    renderCard(recovery, 'tr')
    const region = screen.getByRole('region', {
      name: /İstirahat kalp atış hızı uzun vadeli trend/i,
    })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/İSTİRAHAT KAH · 90G vs YAŞAM BOYU/)
    expect(region.textContent).toMatch(/ARTIYOR/) // RISING in Turkish
    expect(region.textContent).toMatch(/Uyku, hastalık/)
  })

  it('renders Turkish IMPROVING label when lang=tr and band is IMPROVING', () => {
    const recovery = [
      ...Array.from({ length: 15 }, (_, i) => ({
        date: daysBefore(200 + i),
        restingHR: 55,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        date: daysBefore(i),
        restingHR: 50,
      })),
    ]
    renderCard(recovery, 'tr')
    const card = document.querySelector('[data-resting-hr-fitness-trend-card]')
    expect(card.getAttribute('data-fitness-band')).toBe('IMPROVING')
    expect(card.textContent).toMatch(/İYİLEŞİYOR/)
    expect(card.textContent).toMatch(/aerobik adaptasyon çalışıyor/)
  })

  it('renders Turkish STABLE label when lang=tr and band is STABLE', () => {
    const recovery = [
      ...Array.from({ length: 15 }, (_, i) => ({
        date: daysBefore(200 + i),
        restingHR: 50,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        date: daysBefore(i),
        restingHR: 50,
      })),
    ]
    renderCard(recovery, 'tr')
    const card = document.querySelector('[data-resting-hr-fitness-trend-card]')
    expect(card.getAttribute('data-fitness-band')).toBe('STABLE')
    expect(card.textContent).toMatch(/STABİL/)
  })
})
