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

  it('renders cold protocol when r.cold present (v9.31.0)', () => {
    const protocol = {
      ...makeProtocol(),
      cold: {
        summary:         { en: 'Race-day cold -5°C (severe)', tr: 'Yarış-günü soğuk -5°C (şiddetli)' },
        acclimatization: { en: '7-10 days cold-exposure sessions', tr: '7-10 gün soğuk-maruziyet seansı' },
        pacing:          { en: 'HR 5-10 bpm lower for same effort', tr: 'Aynı eforda nabız 5-10 bpm düşük' },
        fueling:         { en: 'Warm fluids, frostbite watch', tr: 'Ilık sıvı, donma izlemi' },
      },
    }
    renderWithLang(<RaceWeekSection raceWeekProtocol={protocol} isTR={false} defaultOpen={true} />)
    expect(screen.getByText(/❄️ COLD WEATHER/)).toBeInTheDocument()
    expect(screen.getByText(/Race-day cold -5°C/)).toBeInTheDocument()
    expect(screen.getByText(/HR 5-10 bpm lower/i)).toBeInTheDocument()
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

  // ── v9.30.0 — Triathlon T1/T2 layout + brick refuel render blocks ──
  it('renders tri-only transitionLayout block when present', () => {
    const protocol = makeProtocol({
      transitionLayout: {
        en: 'T1 layout: wetsuit-strip, helmet, bike shoes. T2 layout: run shoes, hat.',
        tr: 'T1 düzeni: neopren, kask, bisiklet ayakkabısı. T2 düzeni: koşu ayakkabısı, şapka.',
      },
    })
    renderWithLang(<RaceWeekSection raceWeekProtocol={protocol} isTR={false} defaultOpen={true} />)
    expect(screen.getByText(/TRANSITION LAYOUT/i)).toBeInTheDocument()
    expect(screen.getByText(/T1 layout:.*wetsuit-strip/i)).toBeInTheDocument()
  })

  it('renders tri-only brickRefuelWindow block when present', () => {
    const protocol = makeProtocol({
      brickRefuelWindow: {
        en: 'T1 immediate-CHO rule: take 25-30 g gel within 60s of mounting bike.',
        tr: 'T1 hemen-CHO kuralı: bisiklete binişten 60 saniye içinde 25-30 g jel al.',
      },
    })
    renderWithLang(<RaceWeekSection raceWeekProtocol={protocol} isTR={false} defaultOpen={true} />)
    expect(screen.getByText(/BRICK REFUEL WINDOW/i)).toBeInTheDocument()
    expect(screen.getByText(/take 25-30 g gel within 60s/i)).toBeInTheDocument()
  })

  it('hides tri-only blocks when not triathlon (run/bike/swim/rowing)', () => {
    const protocol = makeProtocol() // no transitionLayout / brickRefuelWindow
    renderWithLang(<RaceWeekSection raceWeekProtocol={protocol} isTR={false} defaultOpen={true} />)
    expect(screen.queryByText(/TRANSITION LAYOUT/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/BRICK REFUEL WINDOW/i)).not.toBeInTheDocument()
  })

  // ── v9.33.0 — Post-race 48h recovery render block ──
  it('renders post-race 48h recovery block when present', () => {
    const protocol = makeProtocol({
      postRaceRecovery48h: {
        hour0to2:    { en: 'Hour 0-2: 1.0 g/kg CHO + 25g protein', tr: 'Saat 0-2: 1.0 g/kg CHO + 25g protein' },
        hour2to4:    { en: 'Hour 2-4: solid meal', tr: 'Saat 2-4: katı öğün' },
        day1:        { en: 'Day 1: easy walking only', tr: '1. gün: sadece kolay yürüyüş' },
        day2:        { en: 'Day 2: 30-45 min Z1', tr: '2. gün: 30-45 dk Z1' },
        day3plus:    { en: 'Day 3+: gradual return', tr: '3. gün+: kademeli dönüş' },
        warningSigns: { en: 'Rhabdomyolysis: dark urine', tr: 'Rabdomyoliz: koyu idrar' },
      },
    })
    renderWithLang(<RaceWeekSection raceWeekProtocol={protocol} isTR={false} defaultOpen={true} />)
    expect(screen.getByText(/POST-RACE 48H RECOVERY/i)).toBeInTheDocument()
    expect(screen.getByText(/1.0 g\/kg CHO \+ 25g protein/)).toBeInTheDocument()
    expect(screen.getByText(/Rhabdomyolysis: dark urine/i)).toBeInTheDocument()
  })

  it('hides post-race block when not present', () => {
    const protocol = makeProtocol() // no postRaceRecovery48h
    renderWithLang(<RaceWeekSection raceWeekProtocol={protocol} isTR={false} defaultOpen={true} />)
    expect(screen.queryByText(/POST-RACE 48H RECOVERY/i)).not.toBeInTheDocument()
  })

  // ── v9.35.0 — DNF triage + last-3-nights sleep hygiene render blocks ──
  it('renders DNF decision tree when present', () => {
    const protocol = makeProtocol({
      dnfTriageDecisionTree: {
        en: 'STOP IMMEDIATELY: chest pain. EXIT: rhabdomyolysis. CONTINUE: mild cramp.',
        tr: 'HEMEN DUR: göğüs ağrısı. ÇIK: rabdomyoliz. DEVAM: hafif kramp.',
      },
    })
    renderWithLang(<RaceWeekSection raceWeekProtocol={protocol} isTR={false} defaultOpen={true} />)
    expect(screen.getByText(/DNF DECISION TREE/i)).toBeInTheDocument()
    expect(screen.getByText(/STOP IMMEDIATELY: chest pain/i)).toBeInTheDocument()
  })

  it('renders last-3-nights sleep hygiene when present', () => {
    const protocol = makeProtocol({
      last3NightsSleepHygiene: {
        en: 'T-3: zero caffeine after 14:00. T-1: 16-19°C bedroom.',
        tr: 'T-3: 14:00 sonrası kafein yok. T-1: 16-19°C yatak odası.',
      },
    })
    renderWithLang(<RaceWeekSection raceWeekProtocol={protocol} isTR={false} defaultOpen={true} />)
    expect(screen.getByText(/LAST 3 NIGHTS SLEEP HYGIENE/i)).toBeInTheDocument()
    expect(screen.getByText(/zero caffeine after 14:00/i)).toBeInTheDocument()
  })

  it('hides DNF + sleep hygiene blocks when not present', () => {
    const protocol = makeProtocol() // no dnfTriageDecisionTree / last3NightsSleepHygiene
    renderWithLang(<RaceWeekSection raceWeekProtocol={protocol} isTR={false} defaultOpen={true} />)
    expect(screen.queryByText(/DNF DECISION TREE/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/LAST 3 NIGHTS SLEEP HYGIENE/i)).not.toBeInTheDocument()
  })

  it('returns null when raceWeekProtocol is null/undefined', () => {
    const { container: c1 } = render(<RaceWeekSection raceWeekProtocol={null} isTR={false} />)
    const { container: c2 } = render(<RaceWeekSection raceWeekProtocol={undefined} isTR={false} />)
    expect(c1.firstChild).toBeNull()
    expect(c2.firstChild).toBeNull()
  })
})
