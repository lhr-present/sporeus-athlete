// @vitest-environment jsdom
// v9.29.0 — Race-week UI surfacing tests. Verifies that data fields which
// existed in the protocol output but were never rendered (preRaceMeals,
// mentalRehearsal, sport-specific caffeine, travel/altitude/heat) now
// reach the DOM when present.

import { describe, it, expect } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { renderWithLang } from './testUtils.jsx'
import { RaceWeekSection } from '../dashboard/BroaderPlanSections.jsx'

// Minimal protocol fixture matching the buildRaceWeekProtocol output shape.
// Only fields under test are populated; structural fields use one-line stubs.
function makeProtocol(extra = {}) {
  return {
    schedule: [{ tMinus: 0, day: 'T-0', session: { en: 'Race', tr: 'Yarış' }, notes: { en: '', tr: '' }, fueling: { en: '', tr: '' } }],
    raceDay: {
      wakeUp:    { en: 'Wake 3h pre',  tr: '3 saat önce kalk' },
      breakfast: { en: 'CHO 1.5 g/kg', tr: 'CHO 1.5 g/kg' },
      warmup:    { en: '15 min easy',  tr: '15 dk kolay' },
      pacing:    { en: 'Even',         tr: 'Eşit' },
      fueling:   { en: '60 g/h',       tr: '60 g/sa' },
      mental:    { en: 'Stay present', tr: 'Anda kal' },
      ...extra,
    },
    citation: 'Test 2026',
  }
}

describe('RaceWeekSection — v9.29.0 buried data surfaced', () => {
  it('renders pre-race meals as a collapsible list when array present', () => {
    const protocol = makeProtocol({
      preRaceMeals: {
        en: ['3h: rice + banana', '2h: bagel + honey', '1h: gel'],
        tr: ['3 sa: pilav + muz', '2 sa: simit + bal', '1 sa: jel'],
      },
    })
    renderWithLang(<RaceWeekSection raceWeekProtocol={protocol} isTR={false} defaultOpen={true} />)
    expect(screen.getByText(/PRE-RACE MEAL EXAMPLES/i)).toBeInTheDocument()
    expect(screen.getByText(/3h: rice \+ banana/i)).toBeInTheDocument()
    expect(screen.getByText(/2h: bagel \+ honey/i)).toBeInTheDocument()
  })

  it('renders mental rehearsal scripts as a collapsible list', () => {
    const protocol = makeProtocol({
      mentalRehearsal: {
        en: ['Visualize the start', 'Mid-race anchor', 'Push the last 25%'],
        tr: ['Başlangıcı görselleştir', 'Yarış ortası bağ', 'Son %25 ittir'],
      },
    })
    renderWithLang(<RaceWeekSection raceWeekProtocol={protocol} isTR={false} defaultOpen={true} />)
    expect(screen.getByText(/MENTAL REHEARSAL/i)).toBeInTheDocument()
    expect(screen.getByText(/Visualize the start/i)).toBeInTheDocument()
  })

  it('renders sport-specific caffeine dosing block (separate from universal safety flags)', () => {
    const protocol = makeProtocol({
      caffeine: { en: '3-6 mg/kg, 60 min pre-race', tr: '3-6 mg/kg, 60 dk önce' },
    })
    renderWithLang(<RaceWeekSection raceWeekProtocol={protocol} isTR={false} defaultOpen={true} />)
    expect(screen.getByText(/CAFFEINE DOSING/i)).toBeInTheDocument()
    expect(screen.getByText(/3-6 mg\/kg/i)).toBeInTheDocument()
  })

  it('renders travel jet-lag protocol when r.travel present', () => {
    const protocol = {
      ...makeProtocol(),
      travel: {
        summary:        { en: '8h eastward shift', tr: '8 sa doğu kayma' },
        sleep:          { en: 'Shift bedtime 1h/day', tr: 'Yatma saatini günde 1 sa kaydır' },
        fueling:        { en: 'Hydrate aggressively', tr: 'Agresif sıvı al' },
      },
    }
    renderWithLang(<RaceWeekSection raceWeekProtocol={protocol} isTR={false} defaultOpen={true} />)
    expect(screen.getByText(/TRAVEL \(JET LAG\)/i)).toBeInTheDocument()
    expect(screen.getByText(/8h eastward shift/i)).toBeInTheDocument()
    expect(screen.getByText(/Shift bedtime 1h\/day/i)).toBeInTheDocument()
  })

  it('renders altitude protocol when r.altitude present', () => {
    const protocol = {
      ...makeProtocol(),
      altitude: {
        summary:         { en: 'Race at 2500m', tr: '2500m yarış' },
        acclimatization: { en: 'Arrive 7-14 days early', tr: '7-14 gün erken var' },
        pacing:          { en: 'Slow 8% at 2000m', tr: '2000m\'de %8 yavaşla' },
        fueling:         { en: '+30% hydration', tr: '+%30 sıvı' },
      },
    }
    renderWithLang(<RaceWeekSection raceWeekProtocol={protocol} isTR={false} defaultOpen={true} />)
    expect(screen.getByText(/ALTITUDE/i)).toBeInTheDocument()
    expect(screen.getByText(/Race at 2500m/i)).toBeInTheDocument()
    expect(screen.getByText(/Arrive 7-14 days early/i)).toBeInTheDocument()
  })

  it('renders heat protocol when r.heat present', () => {
    const protocol = {
      ...makeProtocol(),
      heat: {
        summary:         { en: 'Race-day heat 30°C', tr: 'Yarış sıcağı 30°C' },
        acclimatization: { en: '7-10 days heat exposure', tr: '7-10 gün sıcak maruziyeti' },
        pacing:          { en: 'Slow 4-7%', tr: '%4-7 yavaşla' },
        fueling:         { en: '800-1200 mg sodium/h', tr: '800-1200 mg sodyum/sa' },
      },
    }
    renderWithLang(<RaceWeekSection raceWeekProtocol={protocol} isTR={false} defaultOpen={true} />)
    expect(screen.getByText(/🌡 HEAT/)).toBeInTheDocument()
    expect(screen.getByText(/Race-day heat 30°C/i)).toBeInTheDocument()
    expect(screen.getByText(/800-1200 mg sodium\/h/i)).toBeInTheDocument()
  })

  it('hides conditional protocols when not present (no rendering for null fields)', () => {
    const protocol = makeProtocol() // no travel / altitude / heat / extras
    renderWithLang(<RaceWeekSection raceWeekProtocol={protocol} isTR={false} defaultOpen={true} />)
    expect(screen.queryByText(/TRAVEL \(JET LAG\)/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/ALTITUDE/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^HEAT$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/PRE-RACE MEAL EXAMPLES/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/MENTAL REHEARSAL/i)).not.toBeInTheDocument()
  })

  it('renders Turkish strings when isTR=true', () => {
    const protocol = makeProtocol({
      preRaceMeals: { en: ['rice'], tr: ['pilav'] },
      mentalRehearsal: { en: ['relax'], tr: ['rahatla'] },
    })
    cleanup()
    renderWithLang(<RaceWeekSection raceWeekProtocol={protocol} isTR={true} defaultOpen={true} />)
    expect(screen.getByText(/YARIŞ ÖNCESİ ÖRNEK ÖĞÜNLER/i)).toBeInTheDocument()
    expect(screen.getByText(/ZİHİNSEL PROVA/i)).toBeInTheDocument()
    expect(screen.getByText(/^pilav$/i)).toBeInTheDocument()
    expect(screen.getByText(/^rahatla$/i)).toBeInTheDocument()
  })

  it('returns null when raceWeekProtocol is null/undefined', () => {
    const { container: c1 } = render(<RaceWeekSection raceWeekProtocol={null} isTR={false} />)
    const { container: c2 } = render(<RaceWeekSection raceWeekProtocol={undefined} isTR={false} />)
    expect(c1.firstChild).toBeNull()
    expect(c2.firstChild).toBeNull()
  })
})
