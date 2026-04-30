// src/lib/__tests__/validate.test.js
// Comprehensive unit tests for src/lib/validate.js
// Covers all 5 exports: sanitizeString, sanitizeNumber, sanitizeDate,
//                       sanitizeLogEntry, sanitizeProfile

import { describe, it, expect } from 'vitest'
import {
  sanitizeString,
  sanitizeNumber,
  sanitizeDate,
  sanitizeLogEntry,
  sanitizeProfile,
} from '../validate.js'

// ─── sanitizeString ───────────────────────────────────────────────────────────
describe('sanitizeString', () => {
  it('trims whitespace from a string', () => {
    expect(sanitizeString('  hello  ')).toBe('hello')
  })

  it('truncates to default maxLen=200', () => {
    const long = 'a'.repeat(300)
    expect(sanitizeString(long)).toHaveLength(200)
  })

  it('truncates to custom maxLen', () => {
    expect(sanitizeString('hello world', 5)).toBe('hello')
  })

  it('returns empty string for null', () => {
    expect(sanitizeString(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(sanitizeString(undefined)).toBe('')
  })

  it('converts numbers to string', () => {
    expect(sanitizeString(42)).toBe('42')
  })

  it('converts objects to string via String()', () => {
    const result = sanitizeString({ x: 1 })
    expect(typeof result).toBe('string')
  })

  it('returns empty string for empty string input', () => {
    expect(sanitizeString('')).toBe('')
  })

  it('handles HTML/XSS-like strings — does not throw, returns trimmed/truncated', () => {
    const malicious = '<script>alert("xss")</script>'
    const result = sanitizeString(malicious, 200)
    expect(typeof result).toBe('string')
    expect(result).toBe(malicious.trim())
  })
})

// ─── sanitizeNumber ───────────────────────────────────────────────────────────
describe('sanitizeNumber', () => {
  it('returns the number when within default range [0, 99999]', () => {
    expect(sanitizeNumber(150)).toBe(150)
  })

  it('clamps below min to min (default 0)', () => {
    expect(sanitizeNumber(-10)).toBe(0)
  })

  it('clamps above max to max (default 99999)', () => {
    expect(sanitizeNumber(200000)).toBe(99999)
  })

  it('respects custom min and max', () => {
    expect(sanitizeNumber(5, 10, 100)).toBe(10)
    expect(sanitizeNumber(200, 10, 100)).toBe(100)
    expect(sanitizeNumber(50, 10, 100)).toBe(50)
  })

  it('returns 0 for NaN input', () => {
    expect(sanitizeNumber(NaN)).toBe(0)
    expect(sanitizeNumber('abc')).toBe(0)
  })

  it('returns 0 for Infinity', () => {
    expect(sanitizeNumber(Infinity)).toBe(0)
    expect(sanitizeNumber(-Infinity)).toBe(0)
  })

  it('parses numeric strings', () => {
    expect(sanitizeNumber('75')).toBe(75)
    expect(sanitizeNumber('3.14')).toBeCloseTo(3.14)
  })

  it('returns 0 for null input', () => {
    expect(sanitizeNumber(null)).toBe(0)
  })

  it('returns 0 for undefined input', () => {
    expect(sanitizeNumber(undefined)).toBe(0)
  })
})

// ─── sanitizeDate ─────────────────────────────────────────────────────────────
describe('sanitizeDate', () => {
  it('returns ISO date for a valid date string', () => {
    const result = sanitizeDate('2025-06-15')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // Should preserve the date (allow ±1 day for UTC offset edge cases)
    expect(result.startsWith('2025-06')).toBe(true)
  })

  it('returns today\'s date for undefined', () => {
    // new Date(undefined) → Invalid Date → falls back to today
    const today = new Date().toISOString().slice(0, 10)
    expect(sanitizeDate(undefined)).toBe(today)
  })

  it('returns today\'s date for invalid string', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(sanitizeDate('not-a-date')).toBe(today)
  })

  it('returns today\'s date for empty string', () => {
    // new Date('') → Invalid Date → falls back to today
    const today = new Date().toISOString().slice(0, 10)
    const result = sanitizeDate('')
    expect(result).toBe(today)
  })

  it('null input → returns today (not epoch)', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(sanitizeDate(null)).toBe(today)
  })

  it('result is always in YYYY-MM-DD format', () => {
    expect(sanitizeDate('2024-12-31')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(sanitizeDate(null)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(sanitizeDate('garbage')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

// ─── sanitizeLogEntry ─────────────────────────────────────────────────────────
describe('sanitizeLogEntry', () => {
  const validEntry = {
    id: 1,
    date: '2025-03-10',
    type: 'Easy Run',
    duration: 60,
    rpe: 5,
    tss: 80,
    notes: 'Morning run',
    source: 'manual',
  }

  it('passes through a valid entry cleanly', () => {
    const result = sanitizeLogEntry(validEntry)
    expect(result.id).toBe(1)
    expect(result.type).toBe('Easy Run')
    expect(result.duration).toBe(60)
    expect(result.rpe).toBe(5)
    expect(result.tss).toBe(80)
    expect(result.notes).toBe('Morning run')
  })

  it('clamps duration to [0, 1440]', () => {
    expect(sanitizeLogEntry({ ...validEntry, duration: -10 }).duration).toBe(0)
    expect(sanitizeLogEntry({ ...validEntry, duration: 9999 }).duration).toBe(1440)
    expect(sanitizeLogEntry({ ...validEntry, duration: 60 }).duration).toBe(60)
  })

  it('clamps rpe to [0, 10]', () => {
    expect(sanitizeLogEntry({ ...validEntry, rpe: -1 }).rpe).toBe(0)
    expect(sanitizeLogEntry({ ...validEntry, rpe: 11 }).rpe).toBe(10)
    expect(sanitizeLogEntry({ ...validEntry, rpe: 7 }).rpe).toBe(7)
  })

  it('clamps tss to [0, 2000]', () => {
    expect(sanitizeLogEntry({ ...validEntry, tss: -5 }).tss).toBe(0)
    expect(sanitizeLogEntry({ ...validEntry, tss: 5000 }).tss).toBe(2000)
  })

  it('falls back to default type "Easy Run" when type is missing/empty', () => {
    const result = sanitizeLogEntry({ ...validEntry, type: '' })
    expect(result.type).toBe('Easy Run')
    const result2 = sanitizeLogEntry({ ...validEntry, type: null })
    expect(result2.type).toBe('Easy Run')
  })

  it('truncates notes to 500 chars', () => {
    const longNotes = 'x'.repeat(600)
    const result = sanitizeLogEntry({ ...validEntry, notes: longNotes })
    expect(result.notes).toHaveLength(500)
  })

  it('non-positive id → id is replaced with Date.now() (a large positive number)', () => {
    const before = Date.now()
    const result = sanitizeLogEntry({ ...validEntry, id: -1 })
    const after  = Date.now()
    expect(result.id).toBeGreaterThanOrEqual(before)
    expect(result.id).toBeLessThanOrEqual(after)
  })

  it('non-numeric id → id replaced with Date.now()', () => {
    const result = sanitizeLogEntry({ ...validEntry, id: 'string-id' })
    expect(typeof result.id).toBe('number')
    expect(result.id).toBeGreaterThan(0)
  })

  it('sanitizes zones array: clamps each to [0, 1440], max 5 elements', () => {
    const result = sanitizeLogEntry({ ...validEntry, zones: [-1, 30, 9999, 10, 5, 100, 200] })
    expect(result.zones).toHaveLength(5)
    expect(result.zones[0]).toBe(0)    // -1 → 0
    expect(result.zones[2]).toBe(1440) // 9999 → 1440
  })

  it('preserves wPrimeExhausted = true if set', () => {
    const result = sanitizeLogEntry({ ...validEntry, wPrimeExhausted: true })
    expect(result.wPrimeExhausted).toBe(true)
  })

  it('does not set wPrimeExhausted when false', () => {
    const result = sanitizeLogEntry({ ...validEntry, wPrimeExhausted: false })
    expect(result.wPrimeExhausted).toBeUndefined()
  })

  it('preserves hasPower = true', () => {
    const result = sanitizeLogEntry({ ...validEntry, hasPower: true })
    expect(result.hasPower).toBe(true)
  })

  it('parses and preserves distanceM when positive', () => {
    const result = sanitizeLogEntry({ ...validEntry, distanceM: '5000' })
    expect(result.distanceM).toBe(5000)
  })

  it('ignores distanceM when non-positive or non-numeric', () => {
    expect(sanitizeLogEntry({ ...validEntry, distanceM: 'abc' }).distanceM).toBeUndefined()
    expect(sanitizeLogEntry({ ...validEntry, distanceM: 0 }).distanceM).toBeUndefined()
    expect(sanitizeLogEntry({ ...validEntry, distanceM: -100 }).distanceM).toBeUndefined()
  })

  it('parses and preserves avgHR when positive integer', () => {
    const result = sanitizeLogEntry({ ...validEntry, avgHR: '155' })
    expect(result.avgHR).toBe(155)
  })

  it('parses and preserves durationSec when positive', () => {
    const result = sanitizeLogEntry({ ...validEntry, durationSec: 3600 })
    expect(result.durationSec).toBe(3600)
  })

  it('handles missing optional fields without throwing', () => {
    const minimal = { id: 2, date: '2025-01-01', type: 'Easy Run', duration: 30, rpe: 4, tss: 40 }
    expect(() => sanitizeLogEntry(minimal)).not.toThrow()
  })

  it('non-numeric duration string → clamped to 0', () => {
    const result = sanitizeLogEntry({ ...validEntry, duration: 'abc' })
    expect(result.duration).toBe(0)
  })
})

// ─── sanitizeProfile ──────────────────────────────────────────────────────────
describe('sanitizeProfile', () => {
  const validProfile = {
    name: 'Athlete One',
    sport: 'running',
    primarySport: 'running',
    triathlonType: 'sprint',
    secondarySports: ['cycling'],
    athleteLevel: 'intermediate',
    age: '30',
    weight: '70',
    height: '175',
    gender: 'male',
    ftp: '250',
    vo2max: '55',
    maxhr: '190',
    threshold: '4:30',
    goal: 'Sub-3h marathon',
    neck: '38',
    waist: '82',
    hip: '95',
    email: 'athlete@example.com',
    weeklyTssGoal: '500',
    raceDate: '2025-09-15',
  }

  it('passes through a complete valid profile', () => {
    const p = sanitizeProfile(validProfile)
    expect(p.name).toBe('Athlete One')
    expect(p.sport).toBe('running')
    expect(p.age).toBe('30')
    expect(p.ftp).toBe('250')
    expect(p.gender).toBe('male')
    expect(p.raceDate).toBe('2025-09-15')
  })

  it('numeric fields are returned as strings', () => {
    const p = sanitizeProfile(validProfile)
    expect(typeof p.age).toBe('string')
    expect(typeof p.weight).toBe('string')
    expect(typeof p.ftp).toBe('string')
    expect(typeof p.maxhr).toBe('string')
  })

  it('clamps age to [5, 120]', () => {
    expect(sanitizeProfile({ ...validProfile, age: '3' }).age).toBe('5')
    expect(sanitizeProfile({ ...validProfile, age: '200' }).age).toBe('120')
    expect(sanitizeProfile({ ...validProfile, age: '25' }).age).toBe('25')
  })

  it('clamps weight to [10, 400]', () => {
    expect(sanitizeProfile({ ...validProfile, weight: '5' }).weight).toBe('10')
    expect(sanitizeProfile({ ...validProfile, weight: '500' }).weight).toBe('400')
  })

  it('clamps height to [50, 280]', () => {
    expect(sanitizeProfile({ ...validProfile, height: '30' }).height).toBe('50')
    expect(sanitizeProfile({ ...validProfile, height: '300' }).height).toBe('280')
  })

  it('clamps maxhr to [60, 280]', () => {
    expect(sanitizeProfile({ ...validProfile, maxhr: '40' }).maxhr).toBe('60')
    expect(sanitizeProfile({ ...validProfile, maxhr: '300' }).maxhr).toBe('280')
  })

  it('clamps ftp to [0, 3000]', () => {
    expect(sanitizeProfile({ ...validProfile, ftp: '-10' }).ftp).toBe('0')
    expect(sanitizeProfile({ ...validProfile, ftp: '4000' }).ftp).toBe('3000')
  })

  it('clamps vo2max to [0, 100]', () => {
    expect(sanitizeProfile({ ...validProfile, vo2max: '-1' }).vo2max).toBe('0')
    expect(sanitizeProfile({ ...validProfile, vo2max: '120' }).vo2max).toBe('100')
  })

  it('defaults gender to "male" for invalid gender values', () => {
    expect(sanitizeProfile({ ...validProfile, gender: 'nonbinary' }).gender).toBe('male')
    expect(sanitizeProfile({ ...validProfile, gender: null }).gender).toBe('male')
    expect(sanitizeProfile({ ...validProfile, gender: '' }).gender).toBe('male')
  })

  it('accepts "female" gender', () => {
    expect(sanitizeProfile({ ...validProfile, gender: 'female' }).gender).toBe('female')
  })

  it('NaN/invalid numeric field returns empty string', () => {
    expect(sanitizeProfile({ ...validProfile, age: 'abc' }).age).toBe('')
    expect(sanitizeProfile({ ...validProfile, ftp: null }).ftp).toBe('')
  })

  it('truncates name to 100 chars', () => {
    const longName = 'A'.repeat(150)
    const p = sanitizeProfile({ ...validProfile, name: longName })
    expect(p.name).toHaveLength(100)
  })

  it('secondarySports: non-array → empty array', () => {
    const p = sanitizeProfile({ ...validProfile, secondarySports: 'cycling' })
    expect(p.secondarySports).toEqual([])
  })

  it('secondarySports: array sliced to max 10 items', () => {
    const sports = Array.from({ length: 15 }, (_, i) => `sport${i}`)
    const p = sanitizeProfile({ ...validProfile, secondarySports: sports })
    expect(p.secondarySports).toHaveLength(10)
  })

  it('raceDate: valid YYYY-MM-DD preserved', () => {
    expect(sanitizeProfile({ ...validProfile, raceDate: '2026-04-30' }).raceDate).toBe('2026-04-30')
  })

  it('raceDate: invalid format → undefined', () => {
    expect(sanitizeProfile({ ...validProfile, raceDate: '2026/04/30' }).raceDate).toBeUndefined()
    expect(sanitizeProfile({ ...validProfile, raceDate: 'not-a-date' }).raceDate).toBeUndefined()
    expect(sanitizeProfile({ ...validProfile, raceDate: null }).raceDate).toBeUndefined()
  })

  it('handles completely empty profile object without throwing', () => {
    expect(() => sanitizeProfile({})).not.toThrow()
    const p = sanitizeProfile({})
    expect(p.name).toBe('')
    expect(p.gender).toBe('male')
    expect(p.secondarySports).toEqual([])
  })

  it('weeklyTssGoal clamps to [0, 2000]', () => {
    expect(sanitizeProfile({ ...validProfile, weeklyTssGoal: '-100' }).weeklyTssGoal).toBe('0')
    expect(sanitizeProfile({ ...validProfile, weeklyTssGoal: '5000' }).weeklyTssGoal).toBe('2000')
    expect(sanitizeProfile({ ...validProfile, weeklyTssGoal: '400' }).weeklyTssGoal).toBe('400')
  })

  it('goal truncated to 200 chars', () => {
    const longGoal = 'g'.repeat(250)
    const p = sanitizeProfile({ ...validProfile, goal: longGoal })
    expect(p.goal).toHaveLength(200)
  })
})
