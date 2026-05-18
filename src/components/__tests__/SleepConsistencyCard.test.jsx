// @vitest-environment jsdom
// ─── SleepConsistencyCard.test.jsx — render tests for the 28d sleep regularity card
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import SleepConsistencyCard from '../dashboard/SleepConsistencyCard.jsx'

// Lock the system clock so the trailing 28-day window is deterministic.
const TODAY = '2026-05-17'

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  cleanup()
  vi.setSystemTime(new Date())
})

function renderCard(props = {}, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  return render(
    <LangCtx.Provider value={value}>
      <SleepConsistencyCard {...props} />
    </LangCtx.Provider>,
  )
}

// Build a recovery array ending at TODAY with the given hours (oldest first).
function buildRecovery(hoursList, endISO = TODAY) {
  const end = new Date(endISO + 'T00:00:00Z')
  const out = []
  const n = hoursList.length
  for (let i = 0; i < n; i++) {
    const d = new Date(end.getTime())
    d.setUTCDate(d.getUTCDate() - (n - 1 - i))
    out.push({
      date: d.toISOString().slice(0, 10),
      sleepHrs: hoursList[i],
    })
  }
  return out
}

describe('SleepConsistencyCard — null states', () => {
  it('renders nothing for empty recovery', () => {
    const { container } = renderCard({ recovery: [] })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when recovery is undefined', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when fewer than 7 valid entries exist', () => {
    const recovery = buildRecovery([7, 7, 7, 7, 7, 7])
    const { container } = renderCard({ recovery })
    expect(container.firstChild).toBeNull()
  })
})

describe('SleepConsistencyCard — visible bands', () => {
  it('renders TIGHT band (green) for a steady schedule', () => {
    const recovery = buildRecovery([7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5])
    renderCard({ recovery })
    const region = screen.getByRole('region', { name: /twenty-eight day sleep consistency/i })
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('data-consistency-band')).toBe('TIGHT')
    expect(region.textContent).toMatch(/TIGHT/)
    expect(region.textContent).toMatch(/SLEEP CONSISTENCY · 28D/)
    // English interpretation hint
    expect(region.textContent).toMatch(/circadian rhythm is well-anchored/i)
    // Citation footer
    expect(region.textContent).toMatch(/Walker 2017/)
    expect(region.textContent).toMatch(/Lunsford-Avery 2018/)
  })

  it('renders LOOSE band (blue) for moderate variation', () => {
    const recovery = buildRecovery([6, 8, 7, 9, 6, 8, 7, 9])
    renderCard({ recovery })
    const region = screen.getByRole('region', { name: /twenty-eight day sleep consistency/i })
    expect(region.getAttribute('data-consistency-band')).toBe('LOOSE')
    expect(region.textContent).toMatch(/LOOSE/)
    expect(region.textContent).toMatch(/Some variation in sleep duration/i)
  })

  it('renders ERRATIC band (orange) for wide swings', () => {
    const recovery = buildRecovery([4, 10, 5, 9, 4.5, 9.5, 5, 10])
    renderCard({ recovery })
    const region = screen.getByRole('region', { name: /twenty-eight day sleep consistency/i })
    expect(region.getAttribute('data-consistency-band')).toBe('ERRATIC')
    expect(region.textContent).toMatch(/ERRATIC/)
    expect(region.textContent).toMatch(/Wide swings in sleep duration/i)
  })
})

describe('SleepConsistencyCard — data anchors', () => {
  it('exposes all required data-* attributes', () => {
    const recovery = buildRecovery([4, 10, 5, 9, 4.5, 9.5, 5, 10])
    renderCard({ recovery })
    const card = document.querySelector('[data-sleep-consistency-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-consistency-band')).toBe('ERRATIC')
    expect(card.getAttribute('data-std-sleep-hrs')).not.toBeNull()
    expect(card.getAttribute('data-avg-sleep-hrs')).not.toBeNull()
    expect(card.getAttribute('data-shortest-hrs')).toBe('4')
    expect(card.getAttribute('data-longest-hrs')).toBe('10')
  })

  it('renders the headline σ value and average reference', () => {
    const recovery = buildRecovery([7, 7.5, 8, 7, 7.5, 8, 7])
    renderCard({ recovery })
    const region = screen.getByRole('region', { name: /twenty-eight day sleep consistency/i })
    // Headline format: "±X.XXh SD"
    expect(region.textContent).toMatch(/±\d+\.\d{2}h SD/)
    // "avg X.Xh" reference line
    expect(region.textContent).toMatch(/avg \d+(\.\d+)?h/)
    // "range X.X–X.Xh" reference line
    expect(region.textContent).toMatch(/range \d+(\.\d+)?[–-]\d+(\.\d+)?h/)
    // sample count line
    expect(region.textContent).toMatch(/7 nights sampled/)
  })
})

describe('SleepConsistencyCard — bilingual (Turkish)', () => {
  it('renders Turkish heading and TIGHT band label', () => {
    const recovery = buildRecovery([7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5])
    renderCard({ recovery }, 'tr')
    const region = screen.getByRole('region', { name: /yirmi sekiz günlük uyku tutarlılığı/i })
    expect(region.textContent).toMatch(/UYKU TUTARLILIĞI · 28G/)
    expect(region.textContent).toMatch(/SIKI/)
    expect(region.textContent).toMatch(/sirkadiyen ritim iyi sabitlenmiş/i)
    expect(region.textContent).toMatch(/ort \d+(\.\d+)?s/)
    expect(region.textContent).toMatch(/aralık/)
    expect(region.textContent).toMatch(/7 gece örneklendi/)
  })

  it('renders Turkish LOOSE band label (GEVŞEK)', () => {
    const recovery = buildRecovery([6, 8, 7, 9, 6, 8, 7, 9])
    renderCard({ recovery }, 'tr')
    const region = screen.getByRole('region', { name: /yirmi sekiz günlük uyku tutarlılığı/i })
    expect(region.getAttribute('data-consistency-band')).toBe('LOOSE')
    expect(region.textContent).toMatch(/GEVŞEK/)
    expect(region.textContent).toMatch(/daha sıkı yatış aralığını hedefle/i)
  })

  it('renders Turkish ERRATIC band label (DÜZENSİZ)', () => {
    const recovery = buildRecovery([4, 10, 5, 9, 4.5, 9.5, 5, 10])
    renderCard({ recovery }, 'tr')
    const region = screen.getByRole('region', { name: /yirmi sekiz günlük uyku tutarlılığı/i })
    expect(region.getAttribute('data-consistency-band')).toBe('ERRATIC')
    expect(region.textContent).toMatch(/DÜZENSİZ/)
    expect(region.textContent).toMatch(/sirkadiyen ritim bozuluyor/i)
  })
})
