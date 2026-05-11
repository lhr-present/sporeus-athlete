import { describe, it, expect } from 'vitest'
import { SPORTS_RECORDS, getReference, hasReference } from '../../sport/sportsRecords.js'

describe('SPORTS_RECORDS table', () => {
  it('exposes all five top-level sports', () => {
    expect(SPORTS_RECORDS).toHaveProperty('run')
    expect(SPORTS_RECORDS).toHaveProperty('bike')
    expect(SPORTS_RECORDS).toHaveProperty('swim')
    expect(SPORTS_RECORDS).toHaveProperty('triathlon')
    expect(SPORTS_RECORDS).toHaveProperty('rowing')
  })

  it('every entry has both wr and beginner positive seconds', () => {
    for (const sport of Object.keys(SPORTS_RECORDS)) {
      for (const dist of Object.keys(SPORTS_RECORDS[sport])) {
        const e = SPORTS_RECORDS[sport][dist]
        expect(e.wr).toBeGreaterThan(0)
        expect(e.beginner).toBeGreaterThan(0)
      }
    }
  })

  it('beginner time is always strictly slower than wr time', () => {
    for (const sport of Object.keys(SPORTS_RECORDS)) {
      for (const dist of Object.keys(SPORTS_RECORDS[sport])) {
        const e = SPORTS_RECORDS[sport][dist]
        expect(e.beginner).toBeGreaterThan(e.wr)
      }
    }
  })

  it('marathon WR is plausibly around 2:00:35 (~7235s)', () => {
    expect(SPORTS_RECORDS.run[42195].wr).toBe(2 * 3600 + 0 * 60 + 35)
  })

  it('half-marathon WR rounds to 57:31 (3451s)', () => {
    expect(SPORTS_RECORDS.run[21097].wr).toBe(57 * 60 + 31)
  })

  it('5k WR rounds to 12:35 (755s)', () => {
    expect(SPORTS_RECORDS.run[5000].wr).toBe(12 * 60 + 35)
  })

  it('swim 100m WR allows sub-second precision', () => {
    expect(SPORTS_RECORDS.swim[100].wr).toBeCloseTo(46.4, 2)
  })

  it('rowing 2k WR is 5:35.8 (335.8s)', () => {
    expect(SPORTS_RECORDS.rowing[2000].wr).toBeCloseTo(335.8, 1)
  })

  it('Ironman 226k WR is around 7:25:18', () => {
    expect(SPORTS_RECORDS.triathlon[226000].wr).toBe(7 * 3600 + 25 * 60 + 18)
  })

  it('bike FTP-direct distance 0 is intentionally absent', () => {
    expect(SPORTS_RECORDS.bike[0]).toBeUndefined()
  })

  it('rowing distance 0 is intentionally absent', () => {
    expect(SPORTS_RECORDS.rowing[0]).toBeUndefined()
  })

  it('run distances cover 1500m up to 100mi (160934m)', () => {
    const keys = Object.keys(SPORTS_RECORDS.run).map(Number).sort((a, b) => a - b)
    expect(keys[0]).toBe(1500)
    expect(keys[keys.length - 1]).toBe(160934)
  })
})

describe('getReference', () => {
  it('returns the exact entry for a known sport+distance', () => {
    const ref = getReference('run', 5000)
    expect(ref).toEqual({ wr: 12 * 60 + 35, beginner: 30 * 60 })
  })

  it('returns null for an unknown sport', () => {
    expect(getReference('skiing', 5000)).toBeNull()
  })

  it('returns null for an unknown distance in a known sport', () => {
    expect(getReference('run', 1234)).toBeNull()
  })

  it('returns null for null sport', () => {
    expect(getReference(null, 5000)).toBeNull()
  })

  it('returns null for undefined or empty sport', () => {
    expect(getReference(undefined, 5000)).toBeNull()
    expect(getReference('', 5000)).toBeNull()
  })

  it('is case sensitive (Run !== run)', () => {
    expect(getReference('Run', 5000)).toBeNull()
  })

  it('returns null for distance 0 even when sport exists', () => {
    expect(getReference('bike', 0)).toBeNull()
    expect(getReference('rowing', 0)).toBeNull()
  })

  it('returns null for negative distance', () => {
    expect(getReference('run', -5000)).toBeNull()
  })

  it('handles NaN distance gracefully', () => {
    expect(getReference('run', NaN)).toBeNull()
  })

  it('returns shape { wr, beginner } for every hit', () => {
    const ref = getReference('swim', 200)
    expect(ref).toHaveProperty('wr')
    expect(ref).toHaveProperty('beginner')
  })
})

describe('hasReference', () => {
  it('returns true for an existing entry', () => {
    expect(hasReference('run', 10000)).toBe(true)
  })

  it('returns false for unknown sport or distance', () => {
    expect(hasReference('skiing', 10000)).toBe(false)
    expect(hasReference('run', 9999)).toBe(false)
  })

  it('returns false for null/undefined inputs', () => {
    expect(hasReference(null, null)).toBe(false)
    expect(hasReference(undefined, undefined)).toBe(false)
  })

  it('agrees with getReference on hits', () => {
    expect(hasReference('rowing', 2000)).toBe(getReference('rowing', 2000) != null)
  })

  it('agrees with getReference on misses', () => {
    expect(hasReference('rowing', 12345)).toBe(getReference('rowing', 12345) != null)
  })

  it('returns false for bike distance 0 (FTP sentinel)', () => {
    expect(hasReference('bike', 0)).toBe(false)
  })

  it('returns true for triathlon Olympic 51500', () => {
    expect(hasReference('triathlon', 51500)).toBe(true)
  })
})
