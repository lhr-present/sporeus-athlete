// @vitest-environment jsdom
// ─── BedtimeConsistencyCard.test.jsx — render tests for the 28d bedtime regularity card
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import BedtimeConsistencyCard from '../dashboard/BedtimeConsistencyCard.jsx'

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
      <BedtimeConsistencyCard {...props} />
    </LangCtx.Provider>,
  )
}

// Build a recovery array ending at TODAY with the given bedtimes (oldest first).
function buildRecovery(bedtimeList, endISO = TODAY) {
  const end = new Date(endISO + 'T00:00:00Z')
  const out = []
  const n = bedtimeList.length
  for (let i = 0; i < n; i++) {
    const d = new Date(end.getTime())
    d.setUTCDate(d.getUTCDate() - (n - 1 - i))
    out.push({
      date: d.toISOString().slice(0, 10),
      bedtime: bedtimeList[i],
    })
  }
  return out
}

describe('BedtimeConsistencyCard — null states', () => {
  it('renders nothing for empty recovery', () => {
    const { container } = renderCard({ recovery: [] })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when recovery is undefined', () => {
    const { container } = renderCard({})
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when fewer than 7 valid bedtime entries exist', () => {
    const recovery = buildRecovery(['23:00', '23:00', '23:00', '23:00', '23:00', '23:00'])
    const { container } = renderCard({ recovery })
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when all bedtimes are empty', () => {
    const recovery = buildRecovery(['', '', '', '', '', '', '', ''])
    const { container } = renderCard({ recovery })
    expect(container.firstChild).toBeNull()
  })
})

describe('BedtimeConsistencyCard — visible bands', () => {
  it('renders STEADY band (green) for a tight schedule', () => {
    const recovery = buildRecovery([
      '23:00', '23:00', '23:00', '23:00', '23:00', '23:00', '23:00',
    ])
    renderCard({ recovery })
    const region = screen.getByRole('region', { name: /twenty-eight day bedtime consistency/i })
    expect(region).toBeInTheDocument()
    expect(region.getAttribute('data-bedtime-band')).toBe('STEADY')
    expect(region.textContent).toMatch(/STEADY/)
    expect(region.textContent).toMatch(/BEDTIME CONSISTENCY · 28D/)
    // English interpretation hint
    expect(region.textContent).toMatch(/circadian phase is well-anchored/i)
    // Citation footer
    expect(region.textContent).toMatch(/Walker 2017/)
    expect(region.textContent).toMatch(/Lunsford-Avery 2018/)
  })

  it('renders DRIFTING band (blue) for moderate variation', () => {
    const recovery = buildRecovery([
      '22:30', '23:45', '22:30', '23:45', '22:30', '23:45', '22:30', '23:45',
    ])
    renderCard({ recovery })
    const region = screen.getByRole('region', { name: /twenty-eight day bedtime consistency/i })
    expect(region.getAttribute('data-bedtime-band')).toBe('DRIFTING')
    expect(region.textContent).toMatch(/DRIFTING/)
    expect(region.textContent).toMatch(/Some bedtime variation/i)
  })

  it('renders ERRATIC band (orange) for wide swings', () => {
    const recovery = buildRecovery([
      '21:00', '01:00', '21:00', '01:00', '21:00', '01:00', '21:00', '01:00',
    ])
    renderCard({ recovery })
    const region = screen.getByRole('region', { name: /twenty-eight day bedtime consistency/i })
    expect(region.getAttribute('data-bedtime-band')).toBe('ERRATIC')
    expect(region.textContent).toMatch(/ERRATIC/)
    expect(region.textContent).toMatch(/Bedtime swings of an hour or more/i)
  })
})

describe('BedtimeConsistencyCard — data anchors', () => {
  it('exposes all required data-* attributes', () => {
    const recovery = buildRecovery([
      '21:00', '01:00', '21:00', '01:00', '21:00', '01:00', '21:00', '01:00',
    ])
    renderCard({ recovery })
    const card = document.querySelector('[data-bedtime-consistency-card]')
    expect(card).not.toBeNull()
    expect(card.getAttribute('data-bedtime-band')).toBe('ERRATIC')
    expect(card.getAttribute('data-avg-bedtime')).not.toBeNull()
    expect(card.getAttribute('data-std-minutes')).not.toBeNull()
    expect(card.getAttribute('data-earliest-bedtime')).toBe('21:00')
    expect(card.getAttribute('data-latest-bedtime')).toBe('01:00')
  })

  it('renders the headline avg-bedtime and σ reference', () => {
    const recovery = buildRecovery([
      '23:00', '23:15', '23:00', '23:15', '23:00', '23:15', '23:00',
    ])
    renderCard({ recovery })
    const region = screen.getByRole('region', { name: /twenty-eight day bedtime consistency/i })
    // Headline format: "HH:MM" big
    expect(region.textContent).toMatch(/\d{2}:\d{2}/)
    // σ format: "±X min"
    expect(region.textContent).toMatch(/±\d+ min/)
    // range line
    expect(region.textContent).toMatch(/range \d{2}:\d{2}[–-]\d{2}:\d{2}/)
    // sample count
    expect(region.textContent).toMatch(/7 nights sampled/)
  })
})

describe('BedtimeConsistencyCard — bilingual (Turkish)', () => {
  it('renders Turkish heading and STEADY band label', () => {
    const recovery = buildRecovery([
      '23:00', '23:00', '23:00', '23:00', '23:00', '23:00', '23:00',
    ])
    renderCard({ recovery }, 'tr')
    const region = screen.getByRole('region', { name: /yirmi sekiz günlük yatış saati tutarlılığı/i })
    expect(region.textContent).toMatch(/YATIŞ SAATİ TUTARLILIĞI · 28G/)
    expect(region.textContent).toMatch(/İSTİKRARLI/)
    expect(region.textContent).toMatch(/sirkadiyen faz iyi sabitlenmiş/i)
    expect(region.textContent).toMatch(/±\d+ dk/)
    expect(region.textContent).toMatch(/aralık/)
    expect(region.textContent).toMatch(/7 gece örneklendi/)
  })

  it('renders Turkish DRIFTING band label (KAYIYOR)', () => {
    const recovery = buildRecovery([
      '22:30', '23:45', '22:30', '23:45', '22:30', '23:45', '22:30', '23:45',
    ])
    renderCard({ recovery }, 'tr')
    const region = screen.getByRole('region', { name: /yirmi sekiz günlük yatış saati tutarlılığı/i })
    expect(region.getAttribute('data-bedtime-band')).toBe('DRIFTING')
    expect(region.textContent).toMatch(/KAYIYOR/)
    expect(region.textContent).toMatch(/pencereyi sıkılaştırmaya/i)
  })

  it('renders Turkish ERRATIC band label (DÜZENSİZ)', () => {
    const recovery = buildRecovery([
      '21:00', '01:00', '21:00', '01:00', '21:00', '01:00', '21:00', '01:00',
    ])
    renderCard({ recovery }, 'tr')
    const region = screen.getByRole('region', { name: /yirmi sekiz günlük yatış saati tutarlılığı/i })
    expect(region.getAttribute('data-bedtime-band')).toBe('ERRATIC')
    expect(region.textContent).toMatch(/DÜZENSİZ/)
    expect(region.textContent).toMatch(/sirkadiyen ritim bozuluyor/i)
  })
})
