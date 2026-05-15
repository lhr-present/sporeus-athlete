// src/lib/__tests__/athlete/raceStrategy.test.js
import { describe, it, expect } from 'vitest'
import {
  buildRaceStrategy,
  RACE_TYPES,
  PACK_RACES,
  RACE_STRATEGY_CITATION,
} from '../../athlete/raceStrategy.js'

describe('buildRaceStrategy — input validation', () => {
  it('null / non-object → null', () => {
    expect(buildRaceStrategy(null)).toBeNull()
    expect(buildRaceStrategy(undefined)).toBeNull()
    expect(buildRaceStrategy(42)).toBeNull()
  })

  it('invalid sport → rejected', () => {
    const r = buildRaceStrategy({ sport: 'banana', raceType: 'road' })
    expect(r._rejected).toBe(true)
    expect(r.reason).toBe('invalid-sport')
  })

  it('invalid race type → rejected with valid options', () => {
    const r = buildRaceStrategy({ sport: 'run', raceType: 'banana' })
    expect(r._rejected).toBe(true)
    expect(r.reason).toBe('invalid-race-type')
    expect(r.validTypes).toEqual(RACE_TYPES.run)
  })
})

describe('buildRaceStrategy — every defined race type returns a strategy', () => {
  it('all run race types', () => {
    for (const t of RACE_TYPES.run) {
      const r = buildRaceStrategy({ sport: 'run', raceType: t })
      expect(r._rejected).toBeUndefined()
      expect(r.pacing.en).toBeTruthy()
      expect(r.pacing.tr).toBeTruthy()
    }
  })
  it('all bike race types', () => {
    for (const t of RACE_TYPES.bike) {
      const r = buildRaceStrategy({ sport: 'bike', raceType: t })
      expect(r._rejected).toBeUndefined()
      expect(r.pacing.en).toBeTruthy()
    }
  })
  it('all swim, triathlon, rowing race types', () => {
    for (const sport of ['swim', 'triathlon', 'rowing']) {
      for (const t of RACE_TYPES[sport]) {
        const r = buildRaceStrategy({ sport, raceType: t })
        expect(r._rejected).toBeUndefined()
        expect(r.pacing.en).toBeTruthy()
        expect(r.fueling.en).toBeTruthy()
        expect(r.gear.en).toBeTruthy()
      }
    }
  })
})

describe('buildRaceStrategy — pack vs solo classification', () => {
  it('road run, crit bike, open-water swim, Ironman, head-race are pack races', () => {
    expect(buildRaceStrategy({ sport: 'run', raceType: 'road' }).isPackRace).toBe(true)
    expect(buildRaceStrategy({ sport: 'bike', raceType: 'crit' }).isPackRace).toBe(true)
    expect(buildRaceStrategy({ sport: 'swim', raceType: 'open-water' }).isPackRace).toBe(true)
    expect(buildRaceStrategy({ sport: 'triathlon', raceType: 'ironman' }).isPackRace).toBe(true)
    expect(buildRaceStrategy({ sport: 'rowing', raceType: 'head-race' }).isPackRace).toBe(true)
  })

  it('track, TT, pool, 2k erg are solo races (no pack strategy)', () => {
    expect(buildRaceStrategy({ sport: 'run', raceType: 'track' }).isPackRace).toBe(false)
    expect(buildRaceStrategy({ sport: 'run', raceType: 'track' }).packStrategy).toBeNull()
    expect(buildRaceStrategy({ sport: 'bike', raceType: 'tt' }).isPackRace).toBe(false)
    expect(buildRaceStrategy({ sport: 'bike', raceType: 'tt' }).packStrategy).toBeNull()
    expect(buildRaceStrategy({ sport: 'swim', raceType: 'pool' }).isPackRace).toBe(false)
    expect(buildRaceStrategy({ sport: 'rowing', raceType: '2k' }).packStrategy).toBeNull()
  })
})

describe('buildRaceStrategy — pack-size bucket selection', () => {
  it('small pack (<15) gets small-pack guidance', () => {
    const r = buildRaceStrategy({ sport: 'bike', raceType: 'road', packSize: 10 })
    expect(r.packStrategy.en).toMatch(/Small pack/i)
  })

  it('medium pack (15-49) gets medium-pack guidance', () => {
    const r = buildRaceStrategy({ sport: 'bike', raceType: 'road', packSize: 30 })
    expect(r.packStrategy.en).toMatch(/Medium pack/i)
  })

  it('large pack (≥50) gets large-pack guidance', () => {
    const r = buildRaceStrategy({ sport: 'bike', raceType: 'road', packSize: 80 })
    expect(r.packStrategy.en).toMatch(/Large pack/i)
  })

  it('pack race with no packSize specified falls back to default', () => {
    const r = buildRaceStrategy({ sport: 'bike', raceType: 'road' })
    expect(r.packStrategy).not.toBeNull()
    expect(r.packStrategy.en).toMatch(/Pack tactics/i)
  })

  it('packSize on a SOLO race is ignored (still solo)', () => {
    const r = buildRaceStrategy({ sport: 'bike', raceType: 'tt', packSize: 100 })
    expect(r.isPackRace).toBe(false)
    expect(r.packStrategy).toBeNull()
  })
})

describe('buildRaceStrategy — conditions warnings', () => {
  it('heat warning fires above 28°C', () => {
    const r = buildRaceStrategy({ sport: 'run', raceType: 'road', conditions: { tempC: 32 } })
    expect(r.warnings.some(w => w.code === 'heat-warning')).toBe(true)
  })

  it('cold warning fires below 5°C', () => {
    const r = buildRaceStrategy({ sport: 'run', raceType: 'road', conditions: { tempC: 2 } })
    expect(r.warnings.some(w => w.code === 'cold-warning')).toBe(true)
  })

  it('crosswind warning fires above 25 km/h for bike/tri only', () => {
    const r = buildRaceStrategy({ sport: 'bike', raceType: 'road', conditions: { windKph: 35 } })
    expect(r.warnings.some(w => w.code === 'crosswind-warning')).toBe(true)
    const r2 = buildRaceStrategy({ sport: 'run', raceType: 'road', conditions: { windKph: 35 } })
    expect(r2.warnings.some(w => w.code === 'crosswind-warning')).toBe(false)
  })

  it('altitude warning fires above 1800m', () => {
    const r = buildRaceStrategy({ sport: 'run', raceType: 'trail', conditions: { altitudeM: 2400 } })
    expect(r.warnings.some(w => w.code === 'altitude-warning')).toBe(true)
  })

  it('clean conditions → no warnings', () => {
    const r = buildRaceStrategy({ sport: 'run', raceType: 'road', conditions: { tempC: 18, windKph: 8, altitudeM: 100 } })
    expect(r.warnings).toHaveLength(0)
  })

  it('every warning is bilingual', () => {
    const r = buildRaceStrategy({
      sport: 'bike', raceType: 'road',
      conditions: { tempC: 32, windKph: 35, altitudeM: 2400 },
    })
    for (const w of r.warnings) {
      expect(w.en).toBeTruthy()
      expect(w.tr).toBeTruthy()
    }
  })
})

describe('buildRaceStrategy — sport-specific content sanity', () => {
  it('TT pacing mentions even power / FTP', () => {
    const r = buildRaceStrategy({ sport: 'bike', raceType: 'tt' })
    expect(r.pacing.en).toMatch(/even power|FTP/i)
  })

  it('Ironman pacing mentions under-bike or "lose"', () => {
    const r = buildRaceStrategy({ sport: 'triathlon', raceType: 'ironman' })
    expect(r.pacing.en).toMatch(/win|lose|FTP/i)
  })

  it('ultra pacing emphasises negative split / walk early', () => {
    const r = buildRaceStrategy({ sport: 'run', raceType: 'ultra' })
    expect(r.pacing.en).toMatch(/negative split|walk/i)
  })

  it('2k rowing pacing mentions classic 500m splits', () => {
    const r = buildRaceStrategy({ sport: 'rowing', raceType: '2k' })
    expect(r.pacing.en).toMatch(/500m|split/i)
  })

  it('citation references canonical authorities', () => {
    expect(RACE_STRATEGY_CITATION).toMatch(/Coggan/i)
    expect(RACE_STRATEGY_CITATION).toMatch(/Jeukendrup/i)
  })
})

describe('PACK_RACES constant — completeness invariant', () => {
  it('contains all expected pack-race keys', () => {
    expect(PACK_RACES.has('bike:road')).toBe(true)
    expect(PACK_RACES.has('bike:tt')).toBe(false)
    expect(PACK_RACES.has('swim:pool')).toBe(false)
    expect(PACK_RACES.has('swim:open-water')).toBe(true)
    expect(PACK_RACES.has('rowing:2k')).toBe(false)
  })
})
