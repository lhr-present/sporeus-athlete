// ─── src/lib/__tests__/athlete/preRaceSleepBanking.test.js ───────────────────
// Unit tests for the pre-race sleep banking pure-fn.
import { describe, it, expect } from 'vitest'
import {
  detectPreRaceSleepBanking,
  PRE_RACE_SLEEP_BANKING_CITATION,
} from '../../athlete/preRaceSleepBanking.js'

const TODAY = '2026-05-17'
// Race is 3 days out from TODAY → falls inside the default 7-day window.
const RACE_DATE = '2026-05-20'

// Helper: build a 7-day recovery array ending at TODAY with the given hours.
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

describe('detectPreRaceSleepBanking — null guards', () => {
  it('returns null when profile has no race date', () => {
    const recovery = buildRecovery([9, 9, 9, 9, 9, 9, 9])
    expect(detectPreRaceSleepBanking({ recovery, profile: {}, today: TODAY })).toBeNull()
    expect(detectPreRaceSleepBanking({ recovery, today: TODAY })).toBeNull()
  })

  it('returns null when race is more than windowDays away', () => {
    const recovery = buildRecovery([9, 9, 9, 9, 9, 9, 9])
    // Race 30 days out — way past the 7-day window
    const out = detectPreRaceSleepBanking({
      recovery,
      profile: { raceDate: '2026-06-30' },
      today: TODAY,
    })
    expect(out).toBeNull()
  })

  it('returns null when race date is in the past', () => {
    const recovery = buildRecovery([9, 9, 9, 9, 9, 9, 9])
    const out = detectPreRaceSleepBanking({
      recovery,
      profile: { raceDate: '2026-05-01' },
      today: TODAY,
    })
    expect(out).toBeNull()
  })
})

describe('detectPreRaceSleepBanking — status classification', () => {
  it('NEEDS_FOCUS when all nights are AT target only (no surplus)', () => {
    // target=8, threshold=8.5; 8h per night = 0 banked
    const recovery = buildRecovery([8, 8, 8, 8, 8, 8, 8])
    const out = detectPreRaceSleepBanking({
      recovery,
      profile: { raceDate: RACE_DATE },
      today: TODAY,
    })
    expect(out).not.toBeNull()
    expect(out.nightsBanked).toBe(0)
    expect(out.status).toBe('NEEDS_FOCUS')
    expect(out.nightsTotal).toBe(7)
    expect(out.citation).toBe(PRE_RACE_SLEEP_BANKING_CITATION)
  })

  it('BANKED when 5 of 7 nights ≥ 9h with default 8h target', () => {
    // 5 banked (≥ 8.5h), 2 not
    const recovery = buildRecovery([7, 7, 9, 9, 9, 9, 9])
    const out = detectPreRaceSleepBanking({
      recovery,
      profile: { raceDate: RACE_DATE },
      today: TODAY,
    })
    expect(out.nightsBanked).toBe(5)
    expect(out.status).toBe('BANKED')
    expect(out.nightsTotal).toBe(7)
  })

  it('PARTIAL when exactly 3 of 7 nights are banked', () => {
    // 3 banked (≥ 8.5h), 4 below threshold
    const recovery = buildRecovery([7, 8, 8, 8, 9, 9, 9])
    const out = detectPreRaceSleepBanking({
      recovery,
      profile: { raceDate: RACE_DATE },
      today: TODAY,
    })
    expect(out.nightsBanked).toBe(3)
    expect(out.status).toBe('PARTIAL')
  })
})

describe('detectPreRaceSleepBanking — profile override + edges', () => {
  it('custom profile.sleepTargetHours=7 → banking threshold = 7.5h', () => {
    // 7.5h is now AT threshold → banked
    const recovery = buildRecovery([7.5, 7.5, 7.5, 7.5, 7.5, 7.5, 7.5])
    const out = detectPreRaceSleepBanking({
      recovery,
      profile: { raceDate: RACE_DATE, sleepTargetHours: 7 },
      today: TODAY,
    })
    expect(out.nightsBanked).toBe(7)
    expect(out.status).toBe('BANKED')
    // At 8h target the same recovery would yield 0 banked nights
    const at8 = detectPreRaceSleepBanking({
      recovery,
      profile: { raceDate: RACE_DATE },
      today: TODAY,
    })
    expect(at8.nightsBanked).toBe(0)
    expect(at8.status).toBe('NEEDS_FOCUS')
  })

  it('perNight length matches the number of available data nights (sparse window)', () => {
    // Only 4 of the 7 pre-race nights have sleep data
    const recovery = [
      // Outside the trailing 7-day window — ignored
      { date: '2026-05-08', sleepHrs: 9 },
      // Inside the window — 4 entries
      { date: '2026-05-14', sleepHrs: 9 },
      { date: '2026-05-15', sleepHrs: 9 },
      { date: '2026-05-16', sleepHrs: 7.5 },
      { date: '2026-05-17', sleepHrs: 9 },
    ]
    const out = detectPreRaceSleepBanking({
      recovery,
      profile: { raceDate: RACE_DATE },
      today: TODAY,
    })
    expect(out).not.toBeNull()
    expect(out.perNight).toHaveLength(4)
    expect(out.nightsTotal).toBe(4)
    // 3 nights at 9h are banked (>= 8.5), the 7.5h night is not
    expect(out.nightsBanked).toBe(3)
    expect(out.perNight.every(p => typeof p.date === 'string')).toBe(true)
    expect(out.perNight.every(p => typeof p.sleepHrs === 'number')).toBe(true)
    expect(out.perNight.every(p => typeof p.isBanked === 'boolean')).toBe(true)
  })

  it('daysToRace is correctly computed (race in 3 days)', () => {
    const recovery = buildRecovery([8, 8, 8, 8, 8, 8, 8])
    const out = detectPreRaceSleepBanking({
      recovery,
      profile: { raceDate: RACE_DATE },
      today: TODAY,
    })
    expect(out.daysToRace).toBe(3)
  })

  it('reads nextRaceDate as a fallback when raceDate is absent', () => {
    const recovery = buildRecovery([9, 9, 9, 9, 9, 9, 9])
    const out = detectPreRaceSleepBanking({
      recovery,
      profile: { nextRaceDate: RACE_DATE },
      today: TODAY,
    })
    expect(out).not.toBeNull()
    expect(out.daysToRace).toBe(3)
    expect(out.status).toBe('BANKED')
  })

  it('returns empty perNight + 0 totals when recovery is empty (race still surfaces)', () => {
    const out = detectPreRaceSleepBanking({
      recovery: [],
      profile: { raceDate: RACE_DATE },
      today: TODAY,
    })
    expect(out).not.toBeNull()
    expect(out.perNight).toEqual([])
    expect(out.nightsBanked).toBe(0)
    expect(out.nightsTotal).toBe(0)
    expect(out.status).toBe('NEEDS_FOCUS')
  })
})
