import { describe, it, expect } from 'vitest'
import { isSunday, shouldRunWeeklyDigest, getWeekStart } from './aiHelpers.js'

describe('isSunday', () => {
  it('2026-04-19 is a Sunday → true', () => {
    expect(isSunday('2026-04-19')).toBe(true)
  })

  it('2026-04-20 is a Monday → false', () => {
    expect(isSunday('2026-04-20')).toBe(false)
  })
})

describe('shouldRunWeeklyDigest', () => {
  it('2026-04-19 (Sunday) → true', () => {
    expect(shouldRunWeeklyDigest('2026-04-19')).toBe(true)
  })
})

describe('getWeekStart', () => {
  it('Thursday 2026-04-23 → Monday 2026-04-20', () => {
    expect(getWeekStart('2026-04-23')).toBe('2026-04-20')
  })
})
