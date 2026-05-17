// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import ARaceCountdownPeek from '../today/ARaceCountdownPeek.jsx'
import { LangCtx } from '../../contexts/LangCtx.jsx'

const TODAY = '2026-05-17'

function isoOffset(days) {
  const d = new Date(TODAY + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function renderWithLang(ui, lang = 'en') {
  return render(
    <LangCtx.Provider value={{ t: (k) => k, lang, setLang: () => {} }}>
      {ui}
    </LangCtx.Provider>
  )
}

describe('<ARaceCountdownPeek/>', () => {
  it('renders nothing when neither profile nor multiPeakSeason has a race', () => {
    const { container } = renderWithLang(
      <ARaceCountdownPeek profile={{}} multiPeakSeason={null} today={TODAY} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when race is more than 28 days out', () => {
    const { container } = renderWithLang(
      <ARaceCountdownPeek
        profile={{ raceDate: isoOffset(40) }}
        multiPeakSeason={null}
        today={TODAY}
      />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders BUILD label for 21 days out', () => {
    renderWithLang(
      <ARaceCountdownPeek
        profile={{ raceDate: isoOffset(21) }}
        multiPeakSeason={null}
        today={TODAY}
      />
    )
    const peek = document.querySelector('[data-today-a-race-countdown-peek]')
    expect(peek).not.toBeNull()
    expect(peek).toHaveAttribute('data-taper-window', 'BUILD')
    expect(peek.textContent).toMatch(/BUILD/)
    expect(peek.textContent).toMatch(/21d/)
    expect(peek.textContent).toMatch(/A-RACE/)
  })

  it('renders TAPER label for 10 days out', () => {
    renderWithLang(
      <ARaceCountdownPeek
        profile={{ raceDate: isoOffset(10) }}
        multiPeakSeason={null}
        today={TODAY}
      />
    )
    const peek = document.querySelector('[data-today-a-race-countdown-peek]')
    expect(peek).not.toBeNull()
    expect(peek.textContent).toMatch(/TAPER/)
    expect(peek.textContent).toMatch(/10d/)
  })

  it('data-taper-window matches the computed window', () => {
    renderWithLang(
      <ARaceCountdownPeek
        profile={null}
        multiPeakSeason={{
          races: [{ date: isoOffset(3), label: 'Marathon', priority: 'A' }],
        }}
        today={TODAY}
      />
    )
    const peek = document.querySelector('[data-today-a-race-countdown-peek]')
    expect(peek).toHaveAttribute('data-taper-window', 'RACE_WEEK')
    expect(screen.getByText('Marathon')).toBeInTheDocument()
  })

  it('renders Turkish labels when lang="tr"', () => {
    renderWithLang(
      <ARaceCountdownPeek
        profile={{ raceDate: isoOffset(10) }}
        multiPeakSeason={null}
        today={TODAY}
      />,
      'tr'
    )
    const peek = document.querySelector('[data-today-a-race-countdown-peek]')
    expect(peek).not.toBeNull()
    expect(peek.textContent).toMatch(/A-YARIŞ/)
    expect(peek.textContent).toMatch(/10g/)
    expect(peek.textContent).toMatch(/TAPER/)
  })

  it('renders RACE DAY for 0 days out (red)', () => {
    renderWithLang(
      <ARaceCountdownPeek
        profile={{ raceDate: isoOffset(0) }}
        multiPeakSeason={null}
        today={TODAY}
      />
    )
    const peek = document.querySelector('[data-today-a-race-countdown-peek]')
    expect(peek).toHaveAttribute('data-taper-window', 'RACE_DAY')
    expect(peek.textContent).toMatch(/RACE DAY/)
  })
})
