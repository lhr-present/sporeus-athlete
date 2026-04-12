// src/lib/validate.test.js
import { describe, it, expect } from 'vitest'
import { sanitizeString, sanitizeNumber, sanitizeDate, sanitizeLogEntry, sanitizeProfile } from './validate.js'

describe('sanitizeString', () => {
  it('returns empty string for null', () => {
    expect(sanitizeString(null)).toBe('')
  })
  it('coerces numbers to string', () => {
    expect(sanitizeString(42)).toBe('42')
  })
  it('trims whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello')
  })
  it('truncates to maxLen', () => {
    expect(sanitizeString('abcde', 3)).toBe('abc')
  })
})

describe('sanitizeNumber', () => {
  it('parses valid number string', () => {
    expect(sanitizeNumber('42', 0, 100)).toBe(42)
  })
  it('clamps to min', () => {
    expect(sanitizeNumber(-10, 0, 100)).toBe(0)
  })
  it('clamps to max', () => {
    expect(sanitizeNumber(200, 0, 100)).toBe(100)
  })
  it('returns 0 for NaN', () => {
    expect(sanitizeNumber('abc', 0, 100)).toBe(0)
  })
})

describe('sanitizeDate', () => {
  it('accepts valid ISO date', () => {
    expect(sanitizeDate('2025-06-15')).toBe('2025-06-15')
  })
  it('returns a valid date string (today) for invalid input', () => {
    const result = sanitizeDate('not-a-date')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('sanitizeLogEntry', () => {
  it('preserves valid entry fields', () => {
    const e = { date:'2025-01-01', type:'Easy Run', duration:60, rpe:6, tss:50, notes:'Good session' }
    const out = sanitizeLogEntry(e)
    expect(out.type).toBe('Easy Run')
    expect(out.duration).toBe(60)
    expect(out.rpe).toBe(6)
    expect(out.notes).toBe('Good session')
  })
  it('clamps RPE to 0-10', () => {
    const e = { date:'2025-01-01', type:'run', duration:60, rpe:15, tss:50 }
    expect(sanitizeLogEntry(e).rpe).toBe(10)
  })
  it('clamps duration to 0+', () => {
    const e = { date:'2025-01-01', type:'run', duration:-5, rpe:5, tss:50 }
    expect(sanitizeLogEntry(e).duration).toBe(0)
  })
  it('defaults type to Easy Run when empty', () => {
    const e = { date:'2025-01-01', type:'', duration:60, rpe:5, tss:50 }
    expect(sanitizeLogEntry(e).type).toBe('Easy Run')
  })
  it('sanitizes zones array', () => {
    const e = { date:'2025-01-01', type:'run', duration:60, rpe:5, tss:50, zones:[10,20,30,0,0] }
    const out = sanitizeLogEntry(e)
    expect(out.zones).toHaveLength(5)
    expect(out.zones[0]).toBe(10)
  })
  it('preserves distanceM, durationSec, avgHR for VO2max estimation', () => {
    const e = { date:'2025-01-01', type:'run', duration:45, rpe:6, tss:60, distanceM:10000, durationSec:2700, avgHR:155 }
    const out = sanitizeLogEntry(e)
    expect(out.distanceM).toBe(10000)
    expect(out.durationSec).toBe(2700)
    expect(out.avgHR).toBe(155)
  })
  it('drops invalid distanceM / avgHR', () => {
    const e = { date:'2025-01-01', type:'run', duration:60, rpe:5, tss:50, distanceM:-5, avgHR:0 }
    const out = sanitizeLogEntry(e)
    expect(out.distanceM).toBeUndefined()
    expect(out.avgHR).toBeUndefined()
  })
})

describe('sanitizeProfile', () => {
  it('trims name', () => {
    const out = sanitizeProfile({ name: '  John  ' })
    expect(out.name).toBe('John')
  })
  it('returns object even for empty input', () => {
    expect(typeof sanitizeProfile({})).toBe('object')
  })
  it('defaults gender to male if invalid', () => {
    expect(sanitizeProfile({ gender: 'alien' }).gender).toBe('male')
  })
  it('accepts female gender', () => {
    expect(sanitizeProfile({ gender: 'female' }).gender).toBe('female')
  })
  it('keeps ftp as string', () => {
    expect(typeof sanitizeProfile({ ftp: '250' }).ftp).toBe('string')
  })
})
