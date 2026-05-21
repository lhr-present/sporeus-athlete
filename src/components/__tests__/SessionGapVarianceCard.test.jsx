// @vitest-environment jsdom
// ─── SessionGapVarianceCard.test.jsx — Dashboard card surface tests ──────────
//
// Covers: null gate, INSUFFICIENT state, METRONOME / STEADY / CHAOTIC bands,
// EN+TR locale, citation footer, accessibility (role/region/aria-label),
// 30-day strip rendering.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import SessionGapVarianceCard from '../dashboard/SessionGapVarianceCard.jsx'

const TODAY = '2026-05-19'

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

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
      <SessionGapVarianceCard log={log} />
    </LangCtx.Provider>
  )
}

// Helper builders ------------------------------------------------------------
function metronomeLog() {
  // 8 sessions, every 2 days. CV = 0.
  const out = []
  for (let i = 0; i < 8; i++) out.push({ date: addDaysStr(TODAY, -i * 2), tss: 50 })
  return out
}

function steadyLog() {
  const offsets = [0, 1, 3, 4, 6, 7, 9, 12]
  return offsets.map(o => ({ date: addDaysStr(TODAY, -o), tss: 50 }))
}

function chaoticLog() {
  // Cluster + big gap + cluster pattern.
  const offsets = [0, 1, 2, 10, 11, 12]
  return offsets.map(o => ({ date: addDaysStr(TODAY, -o), tss: 50 }))
}

// ─── Null gate is implicit — the analyzer returns null only when today is
// unparseable. Inside the card today = new Date() so result is never null.
// Instead we cover INSUFFICIENT_SESSIONS which is the user-facing "no data".

describe('SessionGapVarianceCard — INSUFFICIENT state', () => {
  it('renders the INSUFFICIENT_SESSIONS band with <6 sessions', () => {
    renderCard([{ date: TODAY, tss: 40 }])
    const card = document.querySelector('[data-card="session-gap-variance"]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-session-gap-variance-band'))
      .toBe('INSUFFICIENT_SESSIONS')
    expect(card.textContent).toMatch(/LOW DATA/)
  })

  it('shows the en-dash placeholder for the mean stat when insufficient', () => {
    renderCard([{ date: TODAY, tss: 40 }])
    const card = document.querySelector('[data-card="session-gap-variance"]')
    expect(card.textContent).toMatch(/—/)
  })

  it('does NOT render the histogram in INSUFFICIENT state', () => {
    renderCard([{ date: TODAY, tss: 40 }])
    expect(document.querySelector('[data-session-gap-variance-histogram]')).toBeNull()
  })
})

describe('SessionGapVarianceCard — METRONOME band', () => {
  it('renders METRONOME band for perfectly regular cadence', () => {
    renderCard(metronomeLog())
    const card = document.querySelector('[data-card="session-gap-variance"]')
    expect(card.getAttribute('data-session-gap-variance-band')).toBe('METRONOME')
    expect(card.textContent).toMatch(/METRONOME/)
    expect(card.textContent).toMatch(/Metronome rhythm/i)
  })

  it('exposes mean / std / cv as data attributes', () => {
    renderCard(metronomeLog())
    const card = document.querySelector('[data-card="session-gap-variance"]')
    expect(card.getAttribute('data-session-gap-variance-count')).toBe('8')
    expect(card.getAttribute('data-session-gap-variance-mean')).toBe('2')
    expect(card.getAttribute('data-session-gap-variance-std')).toBe('0')
    expect(card.getAttribute('data-session-gap-variance-cv')).toBe('0')
  })

  it('renders the histogram with 5 buckets', () => {
    renderCard(metronomeLog())
    const buckets = document.querySelectorAll('[data-gap-bucket]')
    expect(buckets.length).toBe(5)
  })
})

describe('SessionGapVarianceCard — STEADY band', () => {
  it('renders the STEADY band on a mixed-cadence log', () => {
    renderCard(steadyLog())
    const card = document.querySelector('[data-card="session-gap-variance"]')
    expect(card.getAttribute('data-session-gap-variance-band')).toBe('STEADY')
    expect(card.textContent).toMatch(/STEADY/)
    expect(card.textContent).toMatch(/Steady cadence/i)
  })
})

describe('SessionGapVarianceCard — CHAOTIC band', () => {
  it('renders the CHAOTIC band on a clustered + gap log', () => {
    renderCard(chaoticLog())
    const card = document.querySelector('[data-card="session-gap-variance"]')
    expect(card.getAttribute('data-session-gap-variance-band')).toBe('CHAOTIC')
    expect(card.textContent).toMatch(/CHAOTIC/)
    expect(card.textContent).toMatch(/Chaotic spacing/i)
  })
})

describe('SessionGapVarianceCard — Turkish locale', () => {
  it('renders Turkish heading and METRONOME translation', () => {
    renderCard(metronomeLog(), 'tr')
    const card = document.querySelector('[data-card="session-gap-variance"]')
    expect(card.textContent).toMatch(/ANTRENMAN RİTMİ/)
    expect(card.textContent).toMatch(/METRONOM/)
    expect(card.textContent).toMatch(/Metronom ritmi/i)
  })

  it('uses Turkish aria-label when lang=tr', () => {
    renderCard(metronomeLog(), 'tr')
    const region = screen.getByRole('region', { name: /Antrenman Ritmi/i })
    expect(region).toBeInTheDocument()
  })

  it('renders the CHAOTIC Turkish interpretation', () => {
    renderCard(chaoticLog(), 'tr')
    const card = document.querySelector('[data-card="session-gap-variance"]')
    expect(card.textContent).toMatch(/KAOTİK/)
    expect(card.textContent).toMatch(/Kaotik aralık/i)
  })
})

describe('SessionGapVarianceCard — accessibility + citation', () => {
  it('exposes role=region with the English aria-label', () => {
    renderCard(metronomeLog())
    const region = screen.getByRole('region', { name: /Training Rhythm/i })
    expect(region).toBeInTheDocument()
  })

  it('renders the Foster 2017 / Halson 2014 citation footer', () => {
    renderCard(metronomeLog())
    const cite = document.querySelector('[data-session-gap-variance-citation]')
    expect(cite).not.toBeNull()
    expect(cite.textContent).toMatch(/Foster 2017/)
    expect(cite.textContent).toMatch(/Halson 2014/)
  })

  it('renders an SVG strip with an accessible label', () => {
    renderCard(metronomeLog())
    const strip = document.querySelector('[data-session-gap-variance-strip]')
    expect(strip).not.toBeNull()
    expect(strip.getAttribute('aria-label')).toMatch(/30-day training strip/i)
  })
})

describe('SessionGapVarianceCard — 30-day strip rendering', () => {
  it('renders 30 strip cells', () => {
    renderCard(metronomeLog())
    const cells = document.querySelectorAll('[data-strip-kind]')
    expect(cells.length).toBe(30)
  })

  it('marks training-day cells distinctly from rest days', () => {
    renderCard(metronomeLog())
    const train = document.querySelectorAll('[data-strip-kind="train"]')
    const rest  = document.querySelectorAll('[data-strip-kind="rest"]')
    // 8 sessions every other day for the last 16 days → all 8 should appear in
    // the 30-day strip; remaining cells are rest.
    expect(train.length).toBe(8)
    expect(rest.length).toBe(22)
  })

  it('Turkish strip aria-label switches', () => {
    renderCard(metronomeLog(), 'tr')
    const strip = document.querySelector('[data-session-gap-variance-strip]')
    expect(strip.getAttribute('aria-label')).toMatch(/30 gün antrenman şeridi/i)
  })
})
