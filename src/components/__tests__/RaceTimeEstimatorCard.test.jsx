// @vitest-environment jsdom
// ─── RaceTimeEstimatorCard.test.jsx — Dashboard surface tests ──────────
//
// Covers: render-null (empty / no qualifying runs), render with data,
// time formatting, per-row data anchors, reliability chip coloring,
// Turkish heading.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import RaceTimeEstimatorCard, { formatMinutes } from '../dashboard/RaceTimeEstimatorCard.jsx'

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

function run(n, distanceKm, durationMin, extra = {}) {
  return {
    date: daysAgo(n),
    type: 'Run',
    distanceKm,
    durationMin,
    ...extra,
  }
}

function renderCard(log, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <RaceTimeEstimatorCard log={log} />
    </LangCtx.Provider>
  )
}

describe('formatMinutes', () => {
  it('formats >= 60min as H:MM:SS', () => {
    expect(formatMinutes(195)).toBe('3:15:00')
    expect(formatMinutes(60)).toBe('1:00:00')
    expect(formatMinutes(125.5)).toBe('2:05:30')
  })
  it('formats < 60min as MM:SS', () => {
    expect(formatMinutes(22.5)).toBe('22:30')
    expect(formatMinutes(20)).toBe('20:00')
    expect(formatMinutes(5.5)).toBe('05:30')
  })
  it('returns em-dash for invalid input', () => {
    expect(formatMinutes(NaN)).toBe('—')
    expect(formatMinutes(null)).toBe('—')
    expect(formatMinutes(undefined)).toBe('—')
    expect(formatMinutes(-1)).toBe('—')
  })
})

describe('RaceTimeEstimatorCard — guards', () => {
  it('renders nothing for an empty log', () => {
    const { container } = renderCard([])
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-race-time-estimator-card]')).toBeNull()
  })

  it('renders nothing when log is null', () => {
    const { container } = renderCard(null)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when no running entries exist', () => {
    const log = [
      { date: daysAgo(1), type: 'Cycling', distanceKm: 40, durationMin: 80 },
      { date: daysAgo(3), type: 'Swim',    distanceKm: 2,  durationMin: 45 },
    ]
    const { container } = renderCard(log)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when running entries are all under 3km', () => {
    const log = [run(1, 2, 10), run(3, 2.5, 13)]
    const { container } = renderCard(log)
    expect(container.firstChild).toBeNull()
  })
})

describe('RaceTimeEstimatorCard — render with data', () => {
  it('renders region with the title and citation when a reference effort exists', () => {
    const log = [run(2, 5, 20)]
    renderCard(log)
    const card = document.querySelector('[data-race-time-estimator-card]')
    expect(card).not.toBeNull()
    const region = screen.getByRole('region', { name: /Race time estimates/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/RACE TIME ESTIMATES · 90D/i)
    expect(region.textContent).toMatch(/Riegel 1981; Daniels 2014/)
  })

  it('exposes the reference effort line with km/time/pace/date', () => {
    const log = [run(2, 5, 20)]
    renderCard(log)
    const card = document.querySelector('[data-race-time-estimator-card]')
    expect(card.getAttribute('data-reference-distance-km')).toBe('5')
    expect(card.getAttribute('data-reference-time-min')).toBe('20')
    expect(card.getAttribute('data-reference-date')).toBe(daysAgo(2))
    // reference line should show '5km in 20:00 · pace 04:00/km · YYYY-MM-DD'
    expect(card.textContent).toMatch(/5km in 20:00/)
    expect(card.textContent).toMatch(/pace 04:00\/km/)
    expect(card.textContent).toMatch(daysAgo(2))
  })

  it('renders one row per canonical target with per-row data anchors', () => {
    const log = [run(2, 5, 20)]
    renderCard(log)
    const rows = document.querySelectorAll('[data-projection-row]')
    expect(rows).toHaveLength(4)
    const names = Array.from(rows).map(r => r.getAttribute('data-projection-name'))
    expect(names).toEqual(['5K', '10K', 'HALF', 'FULL'])
    // each row must carry the four data attributes the spec calls out
    rows.forEach(r => {
      expect(r.getAttribute('data-projection-name')).toBeTruthy()
      expect(r.getAttribute('data-projection-distance-km')).toBeTruthy()
      expect(r.getAttribute('data-projection-minutes')).toBeTruthy()
      expect(r.getAttribute('data-projection-reliability')).toBeTruthy()
    })
  })

  it('reliability values reflect the extrapolation ratio', () => {
    const log = [run(2, 5, 20)]
    renderCard(log)
    const rows = document.querySelectorAll('[data-projection-row]')
    const byName = {}
    rows.forEach(r => {
      byName[r.getAttribute('data-projection-name')] =
        r.getAttribute('data-projection-reliability')
    })
    expect(byName['5K']).toBe('HIGH')
    expect(byName['10K']).toBe('HIGH')
    expect(byName['HALF']).toBe('MEDIUM')
    expect(byName['FULL']).toBe('LOW')
  })

  it('formats projected times correctly across rows', () => {
    // 5K @ 20:00 -> 10K ≈ 41:42 -> Half ≈ 1:33:18 -> Full ≈ 3:14:39
    const log = [run(2, 5, 20)]
    renderCard(log)
    const card = document.querySelector('[data-race-time-estimator-card]')
    // reference row already covers 20:00 — assert one >60min projection
    // appears in H:MM:SS form
    expect(card.textContent).toMatch(/\d:\d\d:\d\d/)
  })
})

describe('RaceTimeEstimatorCard — Turkish', () => {
  it('renders the Turkish title and reliability labels when lang=tr', () => {
    const log = [run(2, 5, 20)]
    renderCard(log, 'tr')
    const region = screen.getByRole('region', { name: /Yarış zamanı tahmini/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/YARIŞ ZAMANI TAHMİNİ · 90G/)
    // Turkish reliability labels
    expect(region.textContent).toMatch(/YÜKSEK/)
    expect(region.textContent).toMatch(/ORTA/)
    expect(region.textContent).toMatch(/DÜŞÜK/)
    // Turkish reference label + pace label
    expect(region.textContent).toMatch(/REFERANS/)
    expect(region.textContent).toMatch(/tempo 04:00\/km/)
    // Turkish target labels
    expect(region.textContent).toMatch(/YARI MARATON/)
    expect(region.textContent).toMatch(/MARATON/)
    // Turkish interpretation hint
    expect(region.textContent).toMatch(/Riegel ekstrapolasyonu/)
  })
})

describe('RaceTimeEstimatorCard — calibrated promotion', () => {
  it('promotes HALF to HIGH when a similar-distance run is in the window', () => {
    const log = [
      run(2, 5, 20),       // best pace, reference
      run(10, 20, 100),    // within +/-20% of 21.0975
    ]
    renderCard(log)
    const halfRow = document.querySelector('[data-projection-name="HALF"]')
    expect(halfRow).not.toBeNull()
    expect(halfRow.getAttribute('data-projection-reliability')).toBe('HIGH')
  })
})
