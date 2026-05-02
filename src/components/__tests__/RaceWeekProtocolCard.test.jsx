// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import '@testing-library/jest-dom'
import { LangCtx } from '../../contexts/LangCtx.jsx'
import RaceWeekProtocolCard from '../dashboard/RaceWeekProtocolCard.jsx'

// ── helpers ────────────────────────────────────────────────────────────────
function renderWithLang(ui, lang = 'en') {
  const value = { t: k => k, lang, setLang: () => {} }
  function Wrapper({ children }) {
    return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>
  }
  return render(ui, { wrapper: Wrapper })
}

function todayUTC() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysUTC(days) {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Synthesize a small log so calcLoad has something to chew on.
function syntheticLog() {
  const out = []
  for (let i = 30; i >= 1; i--) {
    out.push({ date: addDaysUTC(-i), tss: 50, type: 'run', duration: 60 })
  }
  return out
}

describe('RaceWeekProtocolCard', () => {
  it('renders nothing when profile has no raceDate', () => {
    const { container } = renderWithLang(
      <RaceWeekProtocolCard profile={{}} log={syntheticLog()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when race is more than 7 days away', () => {
    const profile = { raceDate: addDaysUTC(14), goal: '10K race' }
    const { container } = renderWithLang(
      <RaceWeekProtocolCard profile={profile} log={syntheticLog()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when race date is in the past', () => {
    const profile = { raceDate: addDaysUTC(-3), goal: '10K race' }
    const { container } = renderWithLang(
      <RaceWeekProtocolCard profile={profile} log={syntheticLog()} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders countdown title when race is 5 days away', () => {
    const profile = { raceDate: addDaysUTC(5), goal: '10K race' }
    const { container } = renderWithLang(
      <RaceWeekProtocolCard profile={profile} log={syntheticLog()} />,
    )
    expect(container.textContent).toMatch(/RACE WEEK/i)
    expect(container.textContent).toMatch(/5 DAYS TO RACE/i)
  })

  it('renders RACE DAY! prominence when race is today', () => {
    const profile = { raceDate: todayUTC(), goal: 'Marathon' }
    const { container } = renderWithLang(
      <RaceWeekProtocolCard profile={profile} log={syntheticLog()} />,
    )
    expect(container.textContent).toMatch(/RACE DAY!/i)
  })

  it("highlights today's protocol entry within the 7-day strip", () => {
    const profile = { raceDate: addDaysUTC(3), goal: '10K race' }
    const { container } = renderWithLang(
      <RaceWeekProtocolCard profile={profile} log={syntheticLog()} />,
    )
    // Today section heading is present
    expect(container.textContent).toMatch(/TODAY/i)
    // The strip should contain a marker for D-3 ... D0 — and one tile is the highlighted today
    const items = container.querySelectorAll('[role="listitem"]')
    expect(items.length).toBe(7)
    const highlighted = Array.from(items).find(el => el.style.borderColor === 'rgb(255, 102, 0)')
    expect(highlighted).toBeTruthy()
  })

  it('renders exactly 7 entries in the 7-day strip', () => {
    const profile = { raceDate: addDaysUTC(2), goal: 'Half Marathon' }
    const { container } = renderWithLang(
      <RaceWeekProtocolCard profile={profile} log={syntheticLog()} />,
    )
    const items = container.querySelectorAll('[role="listitem"]')
    expect(items.length).toBe(7)
  })

  it('renders Turkish labels when lang=tr', () => {
    const profile = { raceDate: addDaysUTC(4), goal: 'Marathon' }
    const { container } = renderWithLang(
      <RaceWeekProtocolCard profile={profile} log={syntheticLog()} />,
      'tr',
    )
    expect(container.textContent).toMatch(/YARIŞ HAFTASI/)
    expect(container.textContent).toMatch(/BUGÜN/)
  })

  it('card root has role=region and bilingual aria-label', () => {
    const profile = { raceDate: addDaysUTC(2), goal: '5K' }
    const { container } = renderWithLang(
      <RaceWeekProtocolCard profile={profile} log={syntheticLog()} />,
    )
    const region = container.querySelector('[role="region"]')
    expect(region).toBeTruthy()
    expect(region.getAttribute('aria-label')).toMatch(/Race week protocol/i)

    // Turkish variant
    const trRender = renderWithLang(
      <RaceWeekProtocolCard profile={profile} log={syntheticLog()} />,
      'tr',
    )
    const trRegion = trRender.container.querySelector('[role="region"]')
    expect(trRegion.getAttribute('aria-label')).toMatch(/Yarış haftası protokolü/i)
  })

  it('renders the citation footer', () => {
    const profile = { raceDate: addDaysUTC(1), goal: 'Marathon' }
    const { container } = renderWithLang(
      <RaceWeekProtocolCard profile={profile} log={syntheticLog()} />,
    )
    expect(container.textContent).toMatch(/Mujika.*Padilla 2003.*Bompa 2005/)
  })

  it('renders bilingual error when raceType cannot be derived from goal', () => {
    const profile = { raceDate: addDaysUTC(3), goal: 'mystery race nowhere' }
    const { container } = renderWithLang(
      <RaceWeekProtocolCard profile={profile} log={syntheticLog()} />,
    )
    expect(container.textContent).toMatch(/Cannot generate race-week protocol/i)
  })
})
