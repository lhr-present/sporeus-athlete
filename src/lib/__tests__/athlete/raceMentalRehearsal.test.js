// ─── raceMentalRehearsal.test.js — pure-fn tests ────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  buildRaceMentalRehearsal,
  RACE_MENTAL_REHEARSAL_CITATION,
} from '../../athlete/raceMentalRehearsal.js'

describe('buildRaceMentalRehearsal', () => {
  it('returns null when profile has no race date', () => {
    const r = buildRaceMentalRehearsal({ profile: {}, today: '2026-05-17' })
    expect(r).toBeNull()
  })

  it('returns null when race is more than 7 days out', () => {
    const r = buildRaceMentalRehearsal({
      profile: { raceDate: '2026-06-01' },
      today: '2026-05-17',
    })
    expect(r).toBeNull()
  })

  it('returns null when the race is in the past', () => {
    const r = buildRaceMentalRehearsal({
      profile: { raceDate: '2026-05-10' },
      today: '2026-05-17',
    })
    expect(r).toBeNull()
  })

  it('returns a protocol when the race is 5 days out', () => {
    const r = buildRaceMentalRehearsal({
      profile: { raceDate: '2026-05-22' },
      today: '2026-05-17',
    })
    expect(r).not.toBeNull()
    expect(r.daysToRace).toBe(5)
    expect(Array.isArray(r.protocol)).toBe(true)
  })

  it('protocol has exactly 5 components', () => {
    const r = buildRaceMentalRehearsal({
      profile: { raceDate: '2026-05-22' },
      today: '2026-05-17',
    })
    expect(r.protocol.length).toBe(5)
    const ids = r.protocol.map(c => c.id)
    expect(ids).toEqual([
      'imagery',
      'cueWord',
      'arousalRegulation',
      'contingencyPlan',
      'postRaceReflection',
    ])
  })

  it('each component has bilingual label and hint (en + tr)', () => {
    const r = buildRaceMentalRehearsal({
      profile: { raceDate: '2026-05-22' },
      today: '2026-05-17',
    })
    for (const c of r.protocol) {
      expect(typeof c.label.en).toBe('string')
      expect(typeof c.label.tr).toBe('string')
      expect(c.label.en.length).toBeGreaterThan(0)
      expect(c.label.tr.length).toBeGreaterThan(0)
      expect(typeof c.hint.en).toBe('string')
      expect(typeof c.hint.tr).toBe('string')
      expect(c.hint.en.length).toBeGreaterThan(0)
      expect(c.hint.tr.length).toBeGreaterThan(0)
    }
  })

  it('each component has a numeric doseMinutes', () => {
    const r = buildRaceMentalRehearsal({
      profile: { raceDate: '2026-05-22' },
      today: '2026-05-17',
    })
    for (const c of r.protocol) {
      expect(typeof c.doseMinutes).toBe('number')
      expect(Number.isFinite(c.doseMinutes)).toBe(true)
      expect(c.doseMinutes).toBeGreaterThan(0)
    }
  })

  it('daysToRace is correctly computed across the 0-7 window', () => {
    const cases = [
      { race: '2026-05-17', today: '2026-05-17', days: 0 },
      { race: '2026-05-18', today: '2026-05-17', days: 1 },
      { race: '2026-05-23', today: '2026-05-17', days: 6 },
      { race: '2026-05-24', today: '2026-05-17', days: 7 },
    ]
    for (const c of cases) {
      const r = buildRaceMentalRehearsal({
        profile: { raceDate: c.race },
        today: c.today,
      })
      expect(r).not.toBeNull()
      expect(r.daysToRace).toBe(c.days)
    }
  })

  it('returns canonical citation string', () => {
    const r = buildRaceMentalRehearsal({
      profile: { raceDate: '2026-05-22' },
      today: '2026-05-17',
    })
    expect(r.citation).toBe(RACE_MENTAL_REHEARSAL_CITATION)
    expect(RACE_MENTAL_REHEARSAL_CITATION).toBe('Williams 2014; Behncke 2004; Cumming 2017')
  })

  it('accepts nextRaceDate via getProfileRaceDate', () => {
    const r = buildRaceMentalRehearsal({
      profile: { nextRaceDate: '2026-05-22' },
      today: '2026-05-17',
    })
    expect(r).not.toBeNull()
    expect(r.daysToRace).toBe(5)
  })
})
