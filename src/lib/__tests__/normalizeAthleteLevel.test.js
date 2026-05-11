// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { normalizeAthleteLevel, LEVEL_CONFIG } from '../constants.js'

describe('normalizeAthleteLevel — v9.67.0', () => {
  it('maps capital Onboarding values to LEVEL_CONFIG keys', () => {
    expect(normalizeAthleteLevel('Beginner')).toBe('beginner')
    expect(normalizeAthleteLevel('Intermediate')).toBe('competitive')
    expect(normalizeAthleteLevel('Advanced')).toBe('advanced')
  })

  it('passes through already-lowercase ATHLETE_LEVELS keys unchanged', () => {
    expect(normalizeAthleteLevel('beginner')).toBe('beginner')
    expect(normalizeAthleteLevel('recreational')).toBe('recreational')
    expect(normalizeAthleteLevel('competitive')).toBe('competitive')
    expect(normalizeAthleteLevel('advanced')).toBe('advanced')
    expect(normalizeAthleteLevel('elite')).toBe('elite')
  })

  it('case-insensitive on lowercase ATHLETE_LEVELS values', () => {
    expect(normalizeAthleteLevel('ELITE')).toBe('elite')
    expect(normalizeAthleteLevel('Recreational')).toBe('recreational')
    expect(normalizeAthleteLevel('  beginner  ')).toBe('beginner')
  })

  it('returns empty string for unknown / falsy input (so caller fallback chains work)', () => {
    expect(normalizeAthleteLevel(null)).toBe('')
    expect(normalizeAthleteLevel(undefined)).toBe('')
    expect(normalizeAthleteLevel('')).toBe('')
    expect(normalizeAthleteLevel('nonsense')).toBe('')
    expect(normalizeAthleteLevel(42)).toBe('')
    expect(normalizeAthleteLevel({})).toBe('')
  })

  it('Beginner mapping points at the dashSimple config (the whole point of the fix)', () => {
    const mapped = normalizeAthleteLevel('Beginner')
    expect(LEVEL_CONFIG[mapped].dashSimple).toBe(true)
    expect(LEVEL_CONFIG[mapped].showCTL).toBe(false)
    expect(LEVEL_CONFIG[mapped].showACWR).toBe(false)
  })

  it('Intermediate mapping points at a full-features config (matches old fallback)', () => {
    const mapped = normalizeAthleteLevel('Intermediate')
    expect(LEVEL_CONFIG[mapped].dashSimple).toBe(false)
    expect(LEVEL_CONFIG[mapped].showCTL).toBe(true)
    expect(LEVEL_CONFIG[mapped].showACWR).toBe(true)
  })

  it('Advanced mapping points at the monotony-included config', () => {
    const mapped = normalizeAthleteLevel('Advanced')
    expect(LEVEL_CONFIG[mapped].showMonotony).toBe(true)
  })
})
