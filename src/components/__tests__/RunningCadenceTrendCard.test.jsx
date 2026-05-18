// @vitest-environment jsdom
// ─── RunningCadenceTrendCard.test.jsx — Daniels/Heiderscheit card render ─────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import RunningCadenceTrendCard from '../dashboard/RunningCadenceTrendCard.jsx'

const TODAY = '2026-05-17'

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function daysAgo(n) {
  const d = new Date(TODAY + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function renderCard(props = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <RunningCadenceTrendCard log={[]} profile={{ primarySport: 'Running' }} {...props} />
    </LangCtx.Provider>
  )
}

// (a) non-runner profile → renders NULL
describe('RunningCadenceTrendCard — sport gating', () => {
  it('renders nothing when the athlete is clearly not a runner', () => {
    // primarySport=cycling, no run entries
    const log = [
      { type: 'bike', date: daysAgo(2), cadence: 90, rpe: 5 },
    ]
    const { container } = renderCard({ log, profile: { primarySport: 'Cycling' } })
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-running-cadence-trend-card]')).toBeNull()
  })
})

// (b) runner but no cadence data → renders NULL
describe('RunningCadenceTrendCard — no data', () => {
  it('renders nothing when the pure-fn returns null (no cadence entries)', () => {
    const log = [
      { type: 'run', date: daysAgo(2), rpe: 5 }, // no cadence
      { type: 'run', date: daysAgo(5), rpe: 5 },
      { type: 'run', date: daysAgo(8), rpe: 5 },
    ]
    const { container } = renderCard({ log, profile: { primarySport: 'Running' } })
    expect(container.firstChild).toBeNull()
  })
})

// (c) TARGET band → green
describe('RunningCadenceTrendCard — TARGET band', () => {
  it('renders avg cadence + TARGET label in green with NO recommendation', () => {
    const log = [
      { type: 'run', date: daysAgo(2),  rpe: 5, cadence: 175 },
      { type: 'run', date: daysAgo(5),  rpe: 5, cadence: 178 },
      { type: 'run', date: daysAgo(10), rpe: 5, cadence: 180 },
    ]
    renderCard({ log, profile: { primarySport: 'Running' } })

    const card = document.querySelector('[data-running-cadence-trend-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-cadence-band')).toBe('TARGET')

    const region = screen.getByRole('region', { name: /Running cadence 28-day trend/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/RUN CADENCE · 28D/)
    expect(region.textContent).toMatch(/TARGET/)
    expect(region.textContent).toMatch(/Daniels 2014/)

    // Band badge styled green (#5bc25b → rgb(91, 194, 91) in JSDOM)
    const badge = document.querySelector('[data-cadence-band-label]')
    expect(badge).not.toBeNull()
    expect(badge.getAttribute('style')).toMatch(/91,\s*194,\s*91/)

    // No recommendation block when on-target
    expect(document.querySelector('[data-cadence-recommendation]')).toBeNull()
  })
})

// (d) OVERSTRIDING band → orange + recommendation
describe('RunningCadenceTrendCard — OVERSTRIDING band', () => {
  it('renders OVERSTRIDING label in orange and a metronome recommendation', () => {
    const log = [
      { type: 'run', date: daysAgo(2),  rpe: 5, cadence: 158 },
      { type: 'run', date: daysAgo(5),  rpe: 5, cadence: 160 },
      { type: 'run', date: daysAgo(10), rpe: 5, cadence: 162 },
    ]
    renderCard({ log, profile: { primarySport: 'Running' } })

    const card = document.querySelector('[data-running-cadence-trend-card]')
    expect(card.getAttribute('data-cadence-band')).toBe('OVERSTRIDING')

    const badge = document.querySelector('[data-cadence-band-label]')
    expect(badge.textContent).toMatch(/OVERSTRIDING/)
    // #ff6600 → rgb(255, 102, 0) in JSDOM
    expect(badge.getAttribute('style')).toMatch(/255,\s*102,\s*0/)

    const rec = document.querySelector('[data-cadence-recommendation]')
    expect(rec).not.toBeNull()
    expect(rec.textContent).toMatch(/metronome at 175–180 spm/i)
  })
})

// (e) Turkish heading
describe('RunningCadenceTrendCard — Turkish locale', () => {
  it('renders "KOŞU TEMPO · 28G" when lang=tr', () => {
    const log = [
      { type: 'run', date: daysAgo(2),  rpe: 5, cadence: 175 },
      { type: 'run', date: daysAgo(5),  rpe: 5, cadence: 178 },
      { type: 'run', date: daysAgo(10), rpe: 5, cadence: 180 },
    ]
    renderCard({ log, profile: { primarySport: 'Running' } }, 'tr')

    const region = screen.getByRole('region', { name: /Koşu adım frekansı 28 günlük trendi/i })
    expect(region).toBeInTheDocument()
    expect(region.textContent).toMatch(/KOŞU TEMPO · 28G/)
    // TARGET → "HEDEF" in TR
    expect(region.textContent).toMatch(/HEDEF/)
  })
})
