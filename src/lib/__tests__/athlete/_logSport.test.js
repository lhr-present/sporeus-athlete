import { describe, it, expect } from 'vitest'
import { logEntrySport, entryMatchesProgramSport } from '../../athlete/_logSport.js'

describe('logEntrySport — null / non-object input', () => {
  it('returns null for null and undefined', () => {
    expect(logEntrySport(null)).toBeNull()
    expect(logEntrySport(undefined)).toBeNull()
  })

  it('returns null for string/number primitives', () => {
    expect(logEntrySport('run')).toBeNull()
    expect(logEntrySport(42)).toBeNull()
  })

  it('returns null for empty object', () => {
    expect(logEntrySport({})).toBeNull()
  })

  it('returns null when sport and type are both empty strings', () => {
    expect(logEntrySport({ sport: '', type: '' })).toBeNull()
  })
})

describe('logEntrySport — sport field classification', () => {
  it('classifies "swim" as swim', () => {
    expect(logEntrySport({ sport: 'swim' })).toBe('swim')
  })

  it('classifies bike/cycling/ride patterns as bike', () => {
    expect(logEntrySport({ sport: 'bike' })).toBe('bike')
    expect(logEntrySport({ sport: 'Cycling' })).toBe('bike')
    expect(logEntrySport({ sport: 'Easy Ride' })).toBe('bike')
  })

  it('classifies "triathlon" as triathlon', () => {
    expect(logEntrySport({ sport: 'Triathlon' })).toBe('triathlon')
  })

  it('classifies run and jog patterns as run', () => {
    expect(logEntrySport({ sport: 'Run' })).toBe('run')
    expect(logEntrySport({ sport: 'morning jog' })).toBe('run')
  })

  it('is case-insensitive (uppercase SWIM)', () => {
    expect(logEntrySport({ sport: 'SWIM' })).toBe('swim')
  })
})

describe('logEntrySport — fallback to type field', () => {
  it('uses type when sport is missing', () => {
    expect(logEntrySport({ type: 'Easy Run' })).toBe('run')
  })

  it('uses type when sport is empty string', () => {
    expect(logEntrySport({ sport: '', type: 'Tempo Swim' })).toBe('swim')
  })

  it('prefers sport over type when both present', () => {
    expect(logEntrySport({ sport: 'swim', type: 'Easy Run' })).toBe('swim')
  })
})

describe('logEntrySport — precedence rules', () => {
  it('swim beats bike when both keywords are present', () => {
    expect(logEntrySport({ type: 'swim/bike brick' })).toBe('swim')
  })

  it('bike beats triathlon when both keywords are present', () => {
    // /bike|cycl|ride/ is tested before /tri/
    expect(logEntrySport({ type: 'tri bike leg' })).toBe('bike')
  })

  it('triathlon beats run when both keywords are present', () => {
    expect(logEntrySport({ type: 'tri run leg' })).toBe('triathlon')
  })

  it('returns null for unrecognized type like "yoga"', () => {
    expect(logEntrySport({ type: 'yoga' })).toBeNull()
  })

  it('returns null for unrecognized type like "rowing"', () => {
    // rowing is not currently in the keyword set
    expect(logEntrySport({ type: 'rowing' })).toBeNull()
  })

  it('does not throw for numeric sport field (truthy non-string)', () => {
    // sport is truthy so type is skipped; numeric coerces to "12345" → no match → null
    expect(() => logEntrySport({ sport: 12345, type: 'Run' })).not.toThrow()
    expect(logEntrySport({ sport: 12345, type: 'Run' })).toBeNull()
  })
})

describe('entryMatchesProgramSport — null / empty program', () => {
  it('returns true when programSport is null', () => {
    expect(entryMatchesProgramSport({ sport: 'run' }, null)).toBe(true)
  })

  it('returns true when programSport is undefined', () => {
    expect(entryMatchesProgramSport({ sport: 'run' }, undefined)).toBe(true)
  })

  it('returns true when programSport is empty string', () => {
    expect(entryMatchesProgramSport({ sport: 'run' }, '')).toBe(true)
  })
})

describe('entryMatchesProgramSport — unclassified entries', () => {
  it('returns true when entry sport is unclassifiable (yoga)', () => {
    expect(entryMatchesProgramSport({ type: 'yoga' }, 'run')).toBe(true)
  })

  it('returns true when entry is null or empty object (unclassifiable)', () => {
    expect(entryMatchesProgramSport(null, 'run')).toBe(true)
    expect(entryMatchesProgramSport({}, 'swim')).toBe(true)
  })
})

describe('entryMatchesProgramSport — single-sport programs', () => {
  it('accepts matching sport: run program + run entry', () => {
    expect(entryMatchesProgramSport({ sport: 'Easy Run' }, 'run')).toBe(true)
  })

  it('rejects mismatching sport: run program + bike entry', () => {
    expect(entryMatchesProgramSport({ sport: 'bike' }, 'run')).toBe(false)
  })

  it('rejects mismatching sport: swim program + run entry', () => {
    expect(entryMatchesProgramSport({ sport: 'run' }, 'swim')).toBe(false)
  })
})

describe('entryMatchesProgramSport — triathlon program', () => {
  it('accepts run entries', () => {
    expect(entryMatchesProgramSport({ sport: 'run' }, 'triathlon')).toBe(true)
  })

  it('accepts bike entries', () => {
    expect(entryMatchesProgramSport({ sport: 'bike' }, 'triathlon')).toBe(true)
  })

  it('accepts swim entries', () => {
    expect(entryMatchesProgramSport({ sport: 'swim' }, 'triathlon')).toBe(true)
  })

  it('accepts triathlon-tagged entries', () => {
    expect(entryMatchesProgramSport({ sport: 'triathlon' }, 'triathlon')).toBe(true)
  })
})
