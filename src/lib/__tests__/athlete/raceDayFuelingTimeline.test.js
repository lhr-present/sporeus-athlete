// ─── raceDayFuelingTimeline.test.js — pre-race fueling timeline ─────────────
import { describe, it, expect } from 'vitest'
import {
  buildRaceDayFuelingTimeline,
  RACE_DAY_FUELING_TIMELINE_CITATION,
} from '../../athlete/raceDayFuelingTimeline.js'

const TODAY = '2026-05-17'

describe('buildRaceDayFuelingTimeline — null gating', () => {
  it('(a) returns null when profile.weight is missing', () => {
    const r = buildRaceDayFuelingTimeline({
      profile: { raceDate: '2026-05-20' },
      today: TODAY,
    })
    expect(r).toBeNull()
  })

  it('(a2) returns null when profile.weight is non-positive / NaN', () => {
    expect(buildRaceDayFuelingTimeline({
      profile: { weight: 0, raceDate: '2026-05-20' },
      today: TODAY,
    })).toBeNull()
    expect(buildRaceDayFuelingTimeline({
      profile: { weight: 'abc', raceDate: '2026-05-20' },
      today: TODAY,
    })).toBeNull()
  })

  it('(b) returns null when there is no race date', () => {
    const r = buildRaceDayFuelingTimeline({
      profile: { weight: 70 },
      today: TODAY,
    })
    expect(r).toBeNull()
  })

  it('(c) returns null when the race is more than 7 days away', () => {
    const r = buildRaceDayFuelingTimeline({
      profile: { weight: 70, raceDate: '2026-06-30' },
      today: TODAY,
    })
    expect(r).toBeNull()
  })

  it('(d) returns null when the race date is in the past', () => {
    const r = buildRaceDayFuelingTimeline({
      profile: { weight: 70, raceDate: '2026-05-01' },
      today: TODAY,
    })
    expect(r).toBeNull()
  })
})

describe('buildRaceDayFuelingTimeline — timeline shape', () => {
  it('(e) race 3 days out, weight=70 → returns a populated timeline with the expected rows', () => {
    const r = buildRaceDayFuelingTimeline({
      profile: { weight: 70, raceDate: '2026-05-20' },
      today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(Array.isArray(r.timeline)).toBe(true)

    const byT = Object.fromEntries(r.timeline.map(row => [row.tMinus, row]))
    expect(byT['T-72h → T-24h']).toBeTruthy()
    expect(byT['T-72h → T-24h'].choTargetG).toBe(70 * 8)        // carb load 8 g/kg
    expect(byT['T-3h']).toBeTruthy()
    expect(byT['T-3h'].choTargetG).toBe(140)                    // 2 g/kg * 70 = 140
    expect(byT['T-3h'].fluidMl).toBe(500)
    expect(byT['T-60min']).toBeTruthy()
    expect(byT['T-60min'].choTargetG).toBe(30)
    expect(byT['T-60min'].fluidMl).toBe(250)
    expect(byT['T-15min']).toBeTruthy()
    expect(byT['T-15min'].fluidMl).toBe(150)
    expect(byT['T-0']).toBeTruthy()

    expect(r.citation).toBe(RACE_DAY_FUELING_TIMELINE_CITATION)
    expect(r.citation).toMatch(/Burke 2017/)
  })

  it('(f) timeline has at least 5 rows', () => {
    const r = buildRaceDayFuelingTimeline({
      profile: { weight: 70, raceDate: '2026-05-20' },
      today: TODAY,
    })
    expect(r.timeline.length).toBeGreaterThanOrEqual(5)
  })

  it('(g) every row carries bilingual (en + tr) label and hint objects', () => {
    const r = buildRaceDayFuelingTimeline({
      profile: { weight: 70, raceDate: '2026-05-20' },
      today: TODAY,
    })
    for (const row of r.timeline) {
      expect(typeof row.label?.en).toBe('string')
      expect(typeof row.label?.tr).toBe('string')
      expect(row.label.en.length).toBeGreaterThan(0)
      expect(row.label.tr.length).toBeGreaterThan(0)
      expect(typeof row.hint?.en).toBe('string')
      expect(typeof row.hint?.tr).toBe('string')
      expect(row.hint.en.length).toBeGreaterThan(0)
      expect(row.hint.tr.length).toBeGreaterThan(0)
    }
  })

  it('(h) different weight (60 kg) yields different CHO targets', () => {
    const r70 = buildRaceDayFuelingTimeline({
      profile: { weight: 70, raceDate: '2026-05-20' },
      today: TODAY,
    })
    const r60 = buildRaceDayFuelingTimeline({
      profile: { weight: 60, raceDate: '2026-05-20' },
      today: TODAY,
    })
    const carb70 = r70.timeline.find(t => t.tMinus === 'T-72h → T-24h').choTargetG
    const carb60 = r60.timeline.find(t => t.tMinus === 'T-72h → T-24h').choTargetG
    const meal70 = r70.timeline.find(t => t.tMinus === 'T-3h').choTargetG
    const meal60 = r60.timeline.find(t => t.tMinus === 'T-3h').choTargetG
    expect(carb70).not.toBe(carb60)
    expect(meal70).not.toBe(meal60)
    expect(carb60).toBe(60 * 8)
    expect(meal60).toBe(60 * 2)
  })

  it('(i) accepts nextRaceDate as a fallback (canonical raceDate getter)', () => {
    const r = buildRaceDayFuelingTimeline({
      profile: { weight: 70, nextRaceDate: '2026-05-20' },
      today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.timeline.length).toBeGreaterThan(0)
  })

  it('(j) renders during race week — exactly 7 days out is still in-window', () => {
    const r = buildRaceDayFuelingTimeline({
      profile: { weight: 70, raceDate: '2026-05-24' }, // 7 days from 2026-05-17
      today: TODAY,
    })
    expect(r).not.toBeNull()
  })
})
