// @vitest-environment jsdom
// ─── StressPatternCard.test.jsx ─────────────────────────────────────────────
// Renders the 28-day stress × sleep coupling card. Covers null render,
// each of the 3 patterns (STRESS_DRIVEN / DECOUPLED / PROTECTED), and a
// Turkish bilingual smoke test.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import StressPatternCard from '../dashboard/StressPatternCard.jsx'

const TODAY = '2026-05-17'

beforeEach(() => {
  vi.setSystemTime(new Date(TODAY + 'T12:00:00Z'))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

// Build a 28-day recovery array (14 early + 14 recent) ending at TODAY.
function buildRecovery({ early, recent, sleepFn }) {
  const all = [...early, ...recent]
  return all.map((stress, i) => {
    const d = new Date(TODAY + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() - (all.length - 1 - i))
    const date = d.toISOString().slice(0, 10)
    const row = { date, stress }
    const sleep = typeof sleepFn === 'function' ? sleepFn(stress, i) : sleepFn
    if (sleep !== undefined && sleep !== null) row.sleepHrs = sleep
    return row
  })
}

function renderCard(props = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <StressPatternCard {...props} />
    </LangCtx.Provider>,
  )
}

// ── Null render ─────────────────────────────────────────────────────────────
describe('StressPatternCard — null render', () => {
  it('renders nothing when recovery is missing', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
    expect(document.querySelector('[data-stress-pattern-card]')).toBeNull()
  })

  it('renders nothing when fewer than 7 stress entries are available', () => {
    const recovery = Array.from({ length: 5 }, (_, i) => {
      const d = new Date(TODAY + 'T00:00:00Z')
      d.setUTCDate(d.getUTCDate() - i)
      return { date: d.toISOString().slice(0, 10), stress: 3, sleepHrs: 7 }
    })
    const { container } = renderCard({ recovery })
    expect(container.firstChild).toBeNull()
  })
})

// ── Pattern render ──────────────────────────────────────────────────────────
describe('StressPatternCard — pattern render', () => {
  it('renders STRESS_DRIVEN with red interpretation copy', () => {
    // Rising stress + sleep collapses with stress → MOUNTING + STRESS_DRIVEN
    const recovery = buildRecovery({
      early:  [1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2],
      recent: [3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5],
      sleepFn: (s) => 10 - s,
    })
    renderCard({ recovery })
    const card = document.querySelector('[data-stress-pattern-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-stress-trend')).toBe('MOUNTING')
    expect(card.getAttribute('data-stress-pattern')).toBe('STRESS_DRIVEN')
    // Sample count exposed
    expect(card.getAttribute('data-sample-count')).toBe('28')
    // Interpretation copy in EN
    expect(screen.getByText(/Protect bedtime or reduce training intensity/i)).toBeInTheDocument()
    // English pattern chip label
    expect(screen.getByText(/STRESS-DRIVEN/)).toBeInTheDocument()
    // English title
    expect(screen.getByText(/STRESS × SLEEP · 28D/)).toBeInTheDocument()
  })

  it('renders DECOUPLED when correlation is in (-0.3, +0.3)', () => {
    const recovery = buildRecovery({
      early:  Array(14).fill(2),
      recent: Array(14).fill(4),
      sleepFn: (s, i) => 7 + ((i % 2) === 0 ? 0.1 : -0.1),
    })
    renderCard({ recovery })
    const card = document.querySelector('[data-stress-pattern-card]')
    expect(card.getAttribute('data-stress-pattern')).toBe('DECOUPLED')
    expect(screen.getByText(/DECOUPLED/)).toBeInTheDocument()
    expect(screen.getByText(/moving independently/i)).toBeInTheDocument()
  })

  it('renders PROTECTED when sleep holds up despite stress shifts', () => {
    // Stress rises, sleep also rises → positive r → PROTECTED
    const recovery = buildRecovery({
      early:  Array(14).fill(2),
      recent: Array(14).fill(4),
      sleepFn: (s) => 5 + s,
    })
    renderCard({ recovery })
    const card = document.querySelector('[data-stress-pattern-card]')
    expect(card.getAttribute('data-stress-pattern')).toBe('PROTECTED')
    expect(screen.getByText(/PROTECTED/)).toBeInTheDocument()
    expect(screen.getByText(/robust recovery anchor/i)).toBeInTheDocument()
  })

  it('exposes data anchors with the expected values', () => {
    const recovery = buildRecovery({
      early:  Array(14).fill(2),
      recent: Array(14).fill(4),
      sleepFn: (s) => 10 - s,
    })
    renderCard({ recovery })
    const card = document.querySelector('[data-stress-pattern-card]')
    // avgStress, sleepCorrelation, sampleCount surfaced
    expect(card.getAttribute('data-avg-stress')).toBeTruthy()
    expect(card.getAttribute('data-sleep-correlation')).toBeTruthy()
    expect(card.getAttribute('data-sample-count')).toBe('28')
  })

  it('exposes role=region with the EN aria-label', () => {
    const recovery = buildRecovery({
      early:  Array(14).fill(3),
      recent: Array(14).fill(3),
      sleepFn: 7,
    })
    renderCard({ recovery })
    const region = screen.getByRole('region', { name: /Perceived stress and sleep pattern card/i })
    expect(region).toBeInTheDocument()
  })

  it('renders the citation footer (Selye + Kallus)', () => {
    const recovery = buildRecovery({
      early:  Array(14).fill(3),
      recent: Array(14).fill(3),
      sleepFn: 7,
    })
    renderCard({ recovery })
    expect(screen.getByText(/Selye 1956/)).toBeInTheDocument()
    expect(screen.getByText(/Kallus/)).toBeInTheDocument()
  })
})

// ── Bilingual ───────────────────────────────────────────────────────────────
describe('StressPatternCard — bilingual', () => {
  it('renders Turkish title, trend label, and pattern chip when lang=tr', () => {
    const recovery = buildRecovery({
      early:  [1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2],
      recent: [3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5],
      sleepFn: (s) => 10 - s,
    })
    renderCard({ recovery }, 'tr')
    expect(screen.getByText(/STRES × UYKU · 28G/)).toBeInTheDocument()
    expect(screen.getByText(/ARTIYOR/)).toBeInTheDocument()         // MOUNTING in TR
    expect(screen.getByText(/STRES SÜRÜLÜ/)).toBeInTheDocument()    // STRESS_DRIVEN in TR
    // Turkish interpretation copy
    expect(screen.getByText(/Yatış saatini koru veya antrenman yoğunluğunu azalt/i))
      .toBeInTheDocument()
    // Turkish aria-label
    const region = screen.getByRole('region', { name: /Algılanan stres × uyku örüntü kartı/i })
    expect(region).toBeInTheDocument()
  })

  it('renders Turkish trend label SAKİNLEŞİYOR for CALMING trend', () => {
    const recovery = buildRecovery({
      early:  Array(14).fill(4),
      recent: Array(14).fill(2),
      sleepFn: 7,
    })
    renderCard({ recovery }, 'tr')
    expect(screen.getByText(/SAKİNLEŞİYOR/)).toBeInTheDocument()
  })

  it('renders Turkish trend label STABİL for STEADY trend', () => {
    const recovery = buildRecovery({
      early:  Array(14).fill(3),
      recent: Array(14).fill(3),
      sleepFn: 7,
    })
    renderCard({ recovery }, 'tr')
    expect(screen.getByText(/STABİL/)).toBeInTheDocument()
  })
})
