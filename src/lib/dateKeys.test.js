import { describe, it, expect } from 'vitest'
import { isoMondayOf, weekKey } from './dateKeys.js'

describe('isoMondayOf', () => {
  it('returns the Monday for a mid-week date', () => {
    // 2026-04-15 is a Wednesday → Monday is 2026-04-13
    expect(isoMondayOf('2026-04-15')).toBe('2026-04-13')
  })
  it('returns the same day when input is already Monday', () => {
    expect(isoMondayOf('2026-04-13')).toBe('2026-04-13')
  })
  it('maps Sunday to the Monday that started its week (ISO, not Sunday-start)', () => {
    // 2026-04-19 is a Sunday → its ISO week started Monday 2026-04-13
    expect(isoMondayOf('2026-04-19')).toBe('2026-04-13')
  })
  it('handles month boundaries', () => {
    // 2026-03-01 is a Sunday → Monday 2026-02-23
    expect(isoMondayOf('2026-03-01')).toBe('2026-02-23')
  })
  it('is idempotent (fixed point on its own output)', () => {
    const m = isoMondayOf('2026-07-08')
    expect(isoMondayOf(m)).toBe(m)
  })
  it('accepts a Date and a full timestamp identically to the date string', () => {
    expect(isoMondayOf(new Date('2026-04-15T09:30:00Z'))).toBe('2026-04-13')
    expect(isoMondayOf('2026-04-15T23:59:59Z')).toBe('2026-04-13')
  })
  it('is timezone-stable for date-only input', () => {
    // date-only parses as UTC regardless of host TZ → deterministic
    expect(isoMondayOf('2026-01-01')).toBe('2025-12-29')
  })
  it('returns null on garbage', () => {
    expect(isoMondayOf('not-a-date')).toBeNull()
  })
})

describe('weekKey', () => {
  it('formats as YYYY-Www', () => {
    expect(weekKey('2026-04-15')).toMatch(/^\d{4}-W\d{2}$/)
  })
  it('matches known ISO weeks', () => {
    expect(weekKey('2026-01-05')).toBe('2026-W02')
    expect(weekKey('2026-01-01')).toBe('2026-W01')
    expect(weekKey('2026-04-13')).toBe('2026-W16') // Monday
  })
  it('gives the same key for every day Mon–Sun of one ISO week', () => {
    const mon = weekKey('2026-04-13')
    const sun = weekKey('2026-04-19')
    expect(mon).toBe(sun)
  })
  it('rolls to a new key on the next Monday', () => {
    expect(weekKey('2026-04-19')).not.toBe(weekKey('2026-04-20'))
  })
  it('returns null on bad input', () => {
    expect(weekKey('xyz')).toBeNull()
  })
})
