// src/lib/__tests__/storageKeys.test.js
// Regression guard for the central storage key registry.
import { describe, it, expect } from 'vitest'
import { STORAGE_KEYS } from '../storage/keys.js'

// ── Basic shape ───────────────────────────────────────────────────────────────

describe('STORAGE_KEYS — shape', () => {
  it('is an object', () => {
    expect(typeof STORAGE_KEYS).toBe('object')
    expect(STORAGE_KEYS).not.toBeNull()
  })

  it('is frozen', () => {
    expect(Object.isFrozen(STORAGE_KEYS)).toBe(true)
  })
})

// ── Required keys present ─────────────────────────────────────────────────────

describe('STORAGE_KEYS — required keys exist', () => {
  const required = ['LOG', 'PROFILE', 'RECOVERY', 'RACE_RESULTS', 'TIER']

  for (const key of required) {
    it(`has key ${key}`, () => {
      expect(Object.prototype.hasOwnProperty.call(STORAGE_KEYS, key)).toBe(true)
    })
  }
})

// ── Static string values are non-empty ────────────────────────────────────────

describe('STORAGE_KEYS — static string values', () => {
  it('all string values are non-empty', () => {
    const stringEntries = Object.entries(STORAGE_KEYS).filter(
      ([, v]) => typeof v === 'string'
    )
    expect(stringEntries.length).toBeGreaterThan(0)
    for (const [key, v] of stringEntries) {
      expect(v.length, `${key} value should be non-empty`).toBeGreaterThan(0)
    }
  })
})

// ── No duplicate string values ────────────────────────────────────────────────

describe('STORAGE_KEYS — uniqueness', () => {
  it('all static storage key strings are unique', () => {
    const strings = Object.values(STORAGE_KEYS).filter(v => typeof v === 'string')
    const unique = new Set(strings)
    expect(unique.size).toBe(strings.length)
  })
})

// ── Key set regression guard ──────────────────────────────────────────────────

describe('STORAGE_KEYS — complete key set', () => {
  it('contains all expected static and dynamic keys', () => {
    const expected = [
      'LOG', 'PROFILE', 'RECOVERY', 'RACE_RESULTS',
      'MIGRATED', 'GUEST_MODE', 'OFFLINE_MODE', 'TIER', 'TRAINING_AGE',
      'TEST_GOALS', 'MY_COACH', 'PUSH_RATE', 'AI_CALLS', 'AI_CACHE',
      'COACH_FLAGGED', 'COACH_MESSAGES', 'ACTIVE_TEAM', 'WEEK_NOTE',
      'POWER_ZONE', 'STRAVA_TOKEN', 'LAST_FIT_POWER',
      'RECENT_SEARCHES', 'QUOTA_WARNED', 'HEAT_USED',
    ]
    for (const key of expected) {
      expect(
        Object.prototype.hasOwnProperty.call(STORAGE_KEYS, key),
        `Expected STORAGE_KEYS to have key "${key}"`
      ).toBe(true)
    }
  })
})

// ── Dynamic key functions still callable ─────────────────────────────────────

describe('STORAGE_KEYS — dynamic key functions', () => {
  it('AI_CACHE is a function returning a prefixed string', () => {
    expect(typeof STORAGE_KEYS.AI_CACHE).toBe('function')
    expect(STORAGE_KEYS.AI_CACHE('plan')).toBe('sporeus-ai-plan')
  })

  it('WEEK_NOTE is a function returning a prefixed string', () => {
    expect(typeof STORAGE_KEYS.WEEK_NOTE).toBe('function')
    expect(STORAGE_KEYS.WEEK_NOTE('2026-04-28')).toBe('sporeus-week-2026-04-28')
  })

  it('POWER_ZONE is a function returning a prefixed string', () => {
    expect(typeof STORAGE_KEYS.POWER_ZONE).toBe('function')
    expect(STORAGE_KEYS.POWER_ZONE(4)).toBe('sporeus-power-4')
  })
})
