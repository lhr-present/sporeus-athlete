// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { normalizeAthleteLevel, normalizeSport, LEVEL_CONFIG } from '../constants.js'

describe('normalizeSport — v9.78.0', () => {
  it('maps 3-letter internal IDs to Capitalized canonical', () => {
    expect(normalizeSport('run')).toBe('Running')
    expect(normalizeSport('bike')).toBe('Cycling')
    expect(normalizeSport('swim')).toBe('Swimming')
    expect(normalizeSport('triathlon')).toBe('Triathlon')
    expect(normalizeSport('rowing')).toBe('Rowing')
  })

  it('maps full lowercase to Capitalized canonical', () => {
    expect(normalizeSport('running')).toBe('Running')
    expect(normalizeSport('cycling')).toBe('Cycling')
    expect(normalizeSport('swimming')).toBe('Swimming')
  })

  it('passes through Capitalized canonical unchanged (case-insensitive)', () => {
    expect(normalizeSport('Running')).toBe('Running')
    expect(normalizeSport('Cycling')).toBe('Cycling')
    expect(normalizeSport('Triathlon')).toBe('Triathlon')
  })

  it('trim + case-insensitive across all forms', () => {
    expect(normalizeSport(' RUN ')).toBe('Running')
    expect(normalizeSport('  Bike  ')).toBe('Cycling')
    expect(normalizeSport('SWIMMING')).toBe('Swimming')
  })

  it('returns empty string for unknown / falsy input', () => {
    expect(normalizeSport(null)).toBe('')
    expect(normalizeSport(undefined)).toBe('')
    expect(normalizeSport('')).toBe('')
    expect(normalizeSport('walking')).toBe('')
    expect(normalizeSport(42)).toBe('')
  })

  it('legacy "Brick (Bike+Run)" is unknown — caller falls back to raw', () => {
    // FIT imports occasionally produce labels like 'Brick (Bike+Run)';
    // normalizeSport returns '' so the sanitizeProfile fallback preserves
    // the raw string instead of dropping the value.
    expect(normalizeSport('Brick (Bike+Run)')).toBe('')
  })
})

describe('normalizeAthleteLevel — v9.67.0', () => {
  it('maps capital Onboarding values to LEVEL_CONFIG keys', () => {
    expect(normalizeAthleteLevel('Beginner')).toBe('beginner')
    expect(normalizeAthleteLevel('Intermediate')).toBe('competitive')
    expect(normalizeAthleteLevel('Advanced')).toBe('advanced')
  })

  it('v9.74.0 — handles new picker values Recreational + Competitive + Elite', () => {
    // The v9.74.0 picker exposes 5 tiers (was 3). All capitalized labels
    // normalize to lowercase LEVEL_CONFIG keys via the case-insensitive
    // pass-through (no LEVEL_MAP entry needed for these — they share spelling).
    expect(normalizeAthleteLevel('Recreational')).toBe('recreational')
    expect(normalizeAthleteLevel('Competitive')).toBe('competitive')
    expect(normalizeAthleteLevel('Elite')).toBe('elite')
  })

  it('v9.74.0 — Recreational maps to a mid-tier config (CTL off, TSB on)', () => {
    const mapped = normalizeAthleteLevel('Recreational')
    expect(LEVEL_CONFIG[mapped].dashSimple).toBe(false)
    expect(LEVEL_CONFIG[mapped].showCTL).toBe(false)
    expect(LEVEL_CONFIG[mapped].showTSB).toBe(true)
    expect(LEVEL_CONFIG[mapped].showACWR).toBe(false)
  })

  it('v9.74.0 — Elite maps to the same full-feature config as Advanced', () => {
    const mapped = normalizeAthleteLevel('Elite')
    expect(LEVEL_CONFIG[mapped].showCTL).toBe(true)
    expect(LEVEL_CONFIG[mapped].showMonotony).toBe(true)
    expect(LEVEL_CONFIG[mapped].dashSimple).toBe(false)
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
