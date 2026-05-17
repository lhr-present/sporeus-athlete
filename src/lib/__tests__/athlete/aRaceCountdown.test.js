import { describe, it, expect } from 'vitest'
import {
  computeARaceCountdown,
  A_RACE_COUNTDOWN_CITATION,
} from '../../athlete/aRaceCountdown.js'

const TODAY = '2026-05-17'

function isoOffset(days) {
  const d = new Date(TODAY + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

describe('computeARaceCountdown — pure fn', () => {
  it('returns null when no race anywhere', () => {
    const r = computeARaceCountdown({ profile: {}, multiPeakSeason: null, today: TODAY })
    expect(r).toBeNull()
  })

  it('returns null when race date is in the past', () => {
    const r = computeARaceCountdown({
      profile: { raceDate: isoOffset(-3) },
      multiPeakSeason: null,
      today: TODAY,
    })
    expect(r).toBeNull()
  })

  it('returns null when race is more than 28 days out (OUT_OF_WINDOW)', () => {
    const r = computeARaceCountdown({
      profile: { raceDate: isoOffset(35) },
      multiPeakSeason: null,
      today: TODAY,
    })
    expect(r).toBeNull()
  })

  it('classifies 21 days out as BUILD', () => {
    const r = computeARaceCountdown({
      profile: { raceDate: isoOffset(21) },
      multiPeakSeason: null,
      today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.daysToRace).toBe(21)
    expect(r.taperWindow).toBe('BUILD')
  })

  it('classifies 10 days out as TAPER', () => {
    const r = computeARaceCountdown({
      profile: { raceDate: isoOffset(10) },
      multiPeakSeason: null,
      today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.daysToRace).toBe(10)
    expect(r.taperWindow).toBe('TAPER')
  })

  it('classifies 3 days out as RACE_WEEK', () => {
    const r = computeARaceCountdown({
      profile: { raceDate: isoOffset(3) },
      multiPeakSeason: null,
      today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.daysToRace).toBe(3)
    expect(r.taperWindow).toBe('RACE_WEEK')
  })

  it('classifies 0 days as RACE_DAY', () => {
    const r = computeARaceCountdown({
      profile: { raceDate: isoOffset(0) },
      multiPeakSeason: null,
      today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.daysToRace).toBe(0)
    expect(r.taperWindow).toBe('RACE_DAY')
  })

  it('picks the chronologically nearest A-race from multiPeakSeason', () => {
    const r = computeARaceCountdown({
      profile: null,
      multiPeakSeason: {
        races: [
          { date: isoOffset(60), label: 'Late A', priority: 'A' },
          { date: isoOffset(12), label: 'Near A', priority: 'A' },
          { date: isoOffset(5),  label: 'Near B', priority: 'B' },
          { date: isoOffset(2),  label: 'Near C', priority: 'C' },
        ],
      },
      today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.daysToRace).toBe(12)
    expect(r.raceName).toBe('Near A')
    expect(r.taperWindow).toBe('TAPER')
  })

  it('prefers multiPeakSeason A-race over profile.raceDate when both are set', () => {
    const r = computeARaceCountdown({
      profile: { raceDate: isoOffset(20) },
      multiPeakSeason: {
        races: [{ date: isoOffset(5), label: 'Real A', priority: 'A' }],
      },
      today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.raceName).toBe('Real A')
    expect(r.daysToRace).toBe(5)
    expect(r.taperWindow).toBe('RACE_WEEK')
  })

  it('falls back to profile.raceDate when multiPeakSeason has no A-race', () => {
    const r = computeARaceCountdown({
      profile: { raceDate: isoOffset(8) },
      multiPeakSeason: { races: [{ date: isoOffset(4), label: 'B only', priority: 'B' }] },
      today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.raceName).toBeNull()
    expect(r.daysToRace).toBe(8)
    expect(r.taperWindow).toBe('TAPER')
  })

  it('ignores past A-races in multiPeakSeason', () => {
    const r = computeARaceCountdown({
      profile: null,
      multiPeakSeason: {
        races: [
          { date: isoOffset(-10), label: 'Past A', priority: 'A' },
          { date: isoOffset(7),   label: 'Next A', priority: 'A' },
        ],
      },
      today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.daysToRace).toBe(7)
    expect(r.raceName).toBe('Next A')
    expect(r.taperWindow).toBe('RACE_WEEK')
  })

  it('exports the protocol citation constant', () => {
    expect(A_RACE_COUNTDOWN_CITATION).toMatch(/Bompa/)
    expect(A_RACE_COUNTDOWN_CITATION).toMatch(/Mujika/)
    expect(A_RACE_COUNTDOWN_CITATION).toMatch(/Issurin/)
  })
})
