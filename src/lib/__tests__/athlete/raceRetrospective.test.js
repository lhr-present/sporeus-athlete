// v9.120.0 — Race retrospective detector tests.

import { describe, it, expect } from 'vitest'
import {
  detectRaceRetrospective,
  RACE_OUTCOMES,
  RACE_RETRO_WINDOW_DAYS,
  retroLocalStorageKey,
} from '../../athlete/raceRetrospective.js'

const TODAY = '2026-05-14'
function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

describe('detectRaceRetrospective', () => {
  it('returns null when no raceDate', () => {
    expect(detectRaceRetrospective({}, TODAY)).toBeNull()
    expect(detectRaceRetrospective(null, TODAY)).toBeNull()
  })
  it('returns null when race is in the future', () => {
    expect(detectRaceRetrospective({ raceDate: addDays(TODAY, 1) }, TODAY)).toBeNull()
    expect(detectRaceRetrospective({ raceDate: addDays(TODAY, 30) }, TODAY)).toBeNull()
  })
  it('returns null on race day itself (daysSince === 0)', () => {
    expect(detectRaceRetrospective({ raceDate: TODAY }, TODAY)).toBeNull()
  })
  it('fires the day after the race (daysSince === 1)', () => {
    const out = detectRaceRetrospective({ raceDate: addDays(TODAY, -1) }, TODAY)
    expect(out).toEqual({ raceDate: addDays(TODAY, -1), daysSince: 1 })
  })
  it('fires up through day 7', () => {
    const out = detectRaceRetrospective({ raceDate: addDays(TODAY, -7) }, TODAY)
    expect(out.daysSince).toBe(7)
  })
  it('returns null after the 7-day window', () => {
    expect(detectRaceRetrospective({ raceDate: addDays(TODAY, -8) }, TODAY)).toBeNull()
    expect(detectRaceRetrospective({ raceDate: addDays(TODAY, -30) }, TODAY)).toBeNull()
  })
  it('handles malformed raceDate gracefully', () => {
    expect(detectRaceRetrospective({ raceDate: 'not-a-date' }, TODAY)).toBeNull()
    expect(detectRaceRetrospective({ raceDate: '' }, TODAY)).toBeNull()
  })
  it('normalizes raceDate to YYYY-MM-DD slice', () => {
    const out = detectRaceRetrospective(
      { raceDate: addDays(TODAY, -3) + 'T08:00:00Z' },
      TODAY,
    )
    expect(out?.raceDate).toBe(addDays(TODAY, -3))
  })
  it('defaults today to UTC midnight when omitted', () => {
    const past = addDays(new Date().toISOString().slice(0, 10), -2)
    const out = detectRaceRetrospective({ raceDate: past })
    expect(out?.daysSince).toBe(2)
  })
})

describe('RACE_OUTCOMES', () => {
  it('has 3 canonical outcomes', () => {
    expect(RACE_OUTCOMES).toEqual(['hit_goal', 'missed_goal', 'dnf'])
  })
})

describe('RACE_RETRO_WINDOW_DAYS', () => {
  it('is 7', () => {
    expect(RACE_RETRO_WINDOW_DAYS).toBe(7)
  })
})

describe('retroLocalStorageKey', () => {
  it('keys per raceDate', () => {
    expect(retroLocalStorageKey('2026-05-10')).toBe('sporeus-race-retro-2026-05-10')
  })
  it('normalizes to date-only slice', () => {
    expect(retroLocalStorageKey('2026-05-10T12:00:00Z')).toBe('sporeus-race-retro-2026-05-10')
  })
})
