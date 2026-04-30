// src/lib/__tests__/aiHelpers.test.js
import { describe, it, expect } from 'vitest'
import { isSunday, shouldRunWeeklyDigest, getWeekStart } from '../aiHelpers.js'

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/

describe('isSunday', () => {
  it('June 15 2025 (Sunday) → true', () => {
    expect(isSunday('2025-06-15')).toBe(true)
  })

  it('June 16 2025 (Monday) → false', () => {
    expect(isSunday('2025-06-16')).toBe(false)
  })

  it('June 14 2025 (Saturday) → false', () => {
    expect(isSunday('2025-06-14')).toBe(false)
  })

  it('June 17 2025 (Tuesday) → false', () => {
    expect(isSunday('2025-06-17')).toBe(false)
  })

  it('another Sunday — 2024-12-29 → true', () => {
    expect(isSunday('2024-12-29')).toBe(true)
  })

  it('2025-01-01 (Wednesday) → false', () => {
    expect(isSunday('2025-01-01')).toBe(false)
  })
})

describe('shouldRunWeeklyDigest', () => {
  it('returns true for Sunday 2025-06-15', () => {
    expect(shouldRunWeeklyDigest('2025-06-15')).toBe(true)
  })

  it('returns false for Monday 2025-06-16', () => {
    expect(shouldRunWeeklyDigest('2025-06-16')).toBe(false)
  })

  it('returns false for Saturday 2025-06-14', () => {
    expect(shouldRunWeeklyDigest('2025-06-14')).toBe(false)
  })

  it('consistent with isSunday for a range of days', () => {
    const days = ['2025-06-09','2025-06-10','2025-06-11','2025-06-12',
                  '2025-06-13','2025-06-14','2025-06-15']
    for (const d of days) {
      expect(shouldRunWeeklyDigest(d)).toBe(isSunday(d))
    }
  })
})

describe('getWeekStart', () => {
  it('Sunday 2025-06-15 → Monday 2025-06-09', () => {
    expect(getWeekStart('2025-06-15')).toBe('2025-06-09')
  })

  it('Monday 2025-06-16 → same day 2025-06-16', () => {
    expect(getWeekStart('2025-06-16')).toBe('2025-06-16')
  })

  it('Wednesday 2025-06-18 → 2025-06-16', () => {
    expect(getWeekStart('2025-06-18')).toBe('2025-06-16')
  })

  it('Saturday 2025-06-21 → 2025-06-16', () => {
    expect(getWeekStart('2025-06-21')).toBe('2025-06-16')
  })

  it('Friday 2025-06-20 → 2025-06-16', () => {
    expect(getWeekStart('2025-06-20')).toBe('2025-06-16')
  })

  it('Tuesday 2025-06-17 → 2025-06-16', () => {
    expect(getWeekStart('2025-06-17')).toBe('2025-06-16')
  })

  it('result is always in YYYY-MM-DD format', () => {
    const dates = ['2025-06-09','2025-06-14','2025-06-15','2025-06-18','2025-12-31']
    for (const d of dates) {
      expect(getWeekStart(d)).toMatch(YYYY_MM_DD)
    }
  })

  it('Monday is a fixed point — getWeekStart(getWeekStart(d)) === getWeekStart(d)', () => {
    const monday = getWeekStart('2025-06-18')
    expect(getWeekStart(monday)).toBe(monday)
  })

  it('Monday 2025-01-06 → same day', () => {
    expect(getWeekStart('2025-01-06')).toBe('2025-01-06')
  })

  it('Thursday 2025-01-09 → 2025-01-06', () => {
    expect(getWeekStart('2025-01-09')).toBe('2025-01-06')
  })
})
