// src/lib/__tests__/athlete/phaseTransition.test.js
//
// Pure-fn tests for detectPhaseTransition. No React, no DOM, no
// localStorage — just shape + label assertions.
import { describe, it, expect } from 'vitest'
import {
  detectPhaseTransition,
  PHASE_TRANSITION_CITATION,
} from '../../athlete/phaseTransition.js'

describe('detectPhaseTransition', () => {
  it('(a) returns null when args is null/undefined or missing multiPeakSeason', () => {
    expect(detectPhaseTransition(null)).toBeNull()
    expect(detectPhaseTransition(undefined)).toBeNull()
    expect(detectPhaseTransition({})).toBeNull()
    expect(detectPhaseTransition({ multiPeakSeason: null })).toBeNull()
  })

  it('(b) returns null when weeks is missing or empty', () => {
    expect(detectPhaseTransition({ multiPeakSeason: {} })).toBeNull()
    expect(detectPhaseTransition({ multiPeakSeason: { weeks: [] } })).toBeNull()
    expect(detectPhaseTransition({ multiPeakSeason: { weeks: null } })).toBeNull()
  })

  it('(c) isTransition=false when previous + current weeks share the same phase', () => {
    const res = detectPhaseTransition({
      multiPeakSeason: { weeks: [{ phase: 'Base' }] },
      previousWeek: { phase: 'Base' },
    })
    expect(res).not.toBeNull()
    expect(res.isTransition).toBe(false)
    expect(res.fromPhase).toBe('Base')
    expect(res.toPhase).toBe('Base')
    expect(res.citation).toBe(PHASE_TRANSITION_CITATION)
  })

  it('(d) Base→Build returns isTransition=true with "+15%" delta', () => {
    const res = detectPhaseTransition({
      multiPeakSeason: { weeks: [{ phase: 'Build' }] },
      previousWeek: { phase: 'Base' },
    })
    expect(res.isTransition).toBe(true)
    expect(res.fromPhase).toBe('Base')
    expect(res.toPhase).toBe('Build')
    expect(res.expectedTssDelta).toBe('+15%')
  })

  it('(e) Peak→Taper returns "-30%" delta', () => {
    const res = detectPhaseTransition({
      multiPeakSeason: { weeks: [{ phase: 'Taper' }] },
      previousWeek: { phase: 'Peak' },
    })
    expect(res.isTransition).toBe(true)
    expect(res.expectedTssDelta).toBe('-30%')
  })

  it('(f) Taper→Race returns "race-day"', () => {
    const res = detectPhaseTransition({
      multiPeakSeason: { weeks: [{ phase: 'Race' }] },
      previousWeek: { phase: 'Taper' },
    })
    expect(res.isTransition).toBe(true)
    expect(res.expectedTssDelta).toBe('race-day')
  })

  it('(g) Recovery→Base returns "new cycle"', () => {
    const res = detectPhaseTransition({
      multiPeakSeason: { weeks: [{ phase: 'Base' }] },
      previousWeek: { phase: 'Recovery' },
    })
    expect(res.isTransition).toBe(true)
    expect(res.expectedTssDelta).toBe('new cycle')
  })

  it('(h) unmapped pair (e.g. Maintenance→Build) returns "see plan"', () => {
    const res = detectPhaseTransition({
      multiPeakSeason: { weeks: [{ phase: 'Build' }] },
      previousWeek: { phase: 'Maintenance' },
    })
    expect(res.isTransition).toBe(true)
    expect(res.expectedTssDelta).toBe('see plan')
  })

  it('(i) Build→Peak returns "+10%"', () => {
    const res = detectPhaseTransition({
      multiPeakSeason: { weeks: [{ phase: 'Peak' }] },
      previousWeek: { phase: 'Build' },
    })
    expect(res.isTransition).toBe(true)
    expect(res.expectedTssDelta).toBe('+10%')
  })

  it('(j) Race→Recovery returns "recovery"', () => {
    const res = detectPhaseTransition({
      multiPeakSeason: { weeks: [{ phase: 'Recovery' }] },
      previousWeek: { phase: 'Race' },
    })
    expect(res.isTransition).toBe(true)
    expect(res.expectedTssDelta).toBe('recovery')
  })

  it('(k) reads previousWeek from multiPeakSeason.previousWeek when arg omitted', () => {
    const res = detectPhaseTransition({
      multiPeakSeason: {
        weeks: [{ phase: 'Build' }],
        previousWeek: { phase: 'Base' },
      },
    })
    expect(res.isTransition).toBe(true)
    expect(res.fromPhase).toBe('Base')
    expect(res.toPhase).toBe('Build')
    expect(res.expectedTssDelta).toBe('+15%')
  })

  it('(l) when no previous week is supplied, returns isTransition=false (no signal)', () => {
    const res = detectPhaseTransition({
      multiPeakSeason: { weeks: [{ phase: 'Build' }] },
    })
    expect(res).not.toBeNull()
    expect(res.isTransition).toBe(false)
    expect(res.fromPhase).toBe('Build')
    expect(res.toPhase).toBe('Build')
  })

  it('(m) citation is the Bompa+Issurin+Mujika triple', () => {
    expect(PHASE_TRANSITION_CITATION).toBe('Bompa 2009; Issurin 2010; Mujika 2003')
  })
})
