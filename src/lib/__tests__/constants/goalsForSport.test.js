// src/lib/__tests__/constants/goalsForSport.test.js
//
// v9.96.0 — tests for the sport-filtered goal subset helper.

import { describe, it, expect } from 'vitest'
import { goalsForSport, PLAN_GOALS } from '../../constants.js'

describe('goalsForSport', () => {
  it('returns the running subset for Running (no Cycling Event)', () => {
    const out = goalsForSport('Running')
    expect(out).toEqual(['5K', '10K', 'Half Marathon', 'Marathon', 'General Fitness'])
    expect(out).not.toContain('Cycling Event')
  })

  it('returns only cycling-relevant goals for Cycling (no running distances)', () => {
    const out = goalsForSport('Cycling')
    expect(out).toEqual(['Cycling Event', 'General Fitness'])
    expect(out).not.toContain('5K')
    expect(out).not.toContain('Marathon')
  })

  it('returns only General Fitness for Swimming', () => {
    expect(goalsForSport('Swimming')).toEqual(['General Fitness'])
  })

  it('returns only General Fitness for Rowing', () => {
    expect(goalsForSport('Rowing')).toEqual(['General Fitness'])
  })

  it('falls through to full PLAN_GOALS for Triathlon (mixed sport)', () => {
    expect(goalsForSport('Triathlon')).toEqual(PLAN_GOALS)
  })

  it('falls through to full PLAN_GOALS for Other / Hybrid / unknown sports', () => {
    expect(goalsForSport('Other')).toEqual(PLAN_GOALS)
    expect(goalsForSport('Hybrid')).toEqual(PLAN_GOALS)
    expect(goalsForSport('UnknownSport')).toEqual(PLAN_GOALS)
  })

  it('falls through to full PLAN_GOALS for null / undefined / empty', () => {
    expect(goalsForSport(null)).toEqual(PLAN_GOALS)
    expect(goalsForSport(undefined)).toEqual(PLAN_GOALS)
    expect(goalsForSport('')).toEqual(PLAN_GOALS)
  })

  it('every returned goal is a member of PLAN_GOALS (no orphan values)', () => {
    for (const sport of ['Running', 'Cycling', 'Swimming', 'Rowing']) {
      for (const g of goalsForSport(sport)) {
        expect(PLAN_GOALS).toContain(g)
      }
    }
  })

  it('General Fitness appears in every per-sport subset (universal fallback)', () => {
    for (const sport of ['Running', 'Cycling', 'Swimming', 'Rowing']) {
      expect(goalsForSport(sport)).toContain('General Fitness')
    }
  })
})
