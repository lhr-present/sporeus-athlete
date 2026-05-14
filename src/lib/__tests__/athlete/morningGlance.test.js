// src/lib/__tests__/athlete/morningGlance.test.js
// v9.145.0 — Tests for buildGlanceLine.

import { describe, it, expect } from 'vitest'
import { buildGlanceLine } from '../../athlete/morningGlance.js'

describe('buildGlanceLine', () => {
  it('returns null when plannedSession is missing', () => {
    expect(buildGlanceLine({})).toBeNull()
    expect(buildGlanceLine({ plannedSession: null })).toBeNull()
    expect(buildGlanceLine()).toBeNull()
  })

  it('returns null when plannedSession has no type', () => {
    expect(buildGlanceLine({ plannedSession: { duration: 45 } })).toBeNull()
  })

  it('returns type alone when only type is set', () => {
    expect(buildGlanceLine({ plannedSession: { type: 'Rest Day' } })).toBe('Rest Day')
  })

  it('appends duration with min suffix (EN)', () => {
    expect(buildGlanceLine({ plannedSession: { type: 'Easy Run', duration: 45 } }))
      .toBe('Easy Run · 45min')
  })

  it('appends duration with dk suffix (TR)', () => {
    expect(buildGlanceLine({ plannedSession: { type: 'Kolay Koşu', duration: 45 }, lang: 'tr' }))
      .toBe('Kolay Koşu · 45dk')
  })

  it('omits duration when zero or negative', () => {
    expect(buildGlanceLine({ plannedSession: { type: 'Rest', duration: 0 } })).toBe('Rest')
    expect(buildGlanceLine({ plannedSession: { type: 'Rest', duration: -5 } })).toBe('Rest')
  })

  it('appends dominant zone from zones object', () => {
    expect(buildGlanceLine({
      plannedSession: { type: 'Easy Run', duration: 45, zones: { Z1: 5, Z2: 35, Z3: 5 } },
    })).toBe('Easy Run · 45min · Z2')
  })

  it('falls back to RPE when no zones', () => {
    expect(buildGlanceLine({
      plannedSession: { type: 'Easy Run', duration: 45, rpe: 4 },
    })).toBe('Easy Run · 45min · RPE 4')
  })

  it('prefers zones over RPE when both present', () => {
    expect(buildGlanceLine({
      plannedSession: { type: 'Threshold', duration: 60, rpe: 7, zones: { Z4: 40, Z2: 20 } },
    })).toBe('Threshold · 60min · Z4')
  })

  it('appends paceTarget when present', () => {
    expect(buildGlanceLine({
      plannedSession: { type: 'Easy Run', duration: 45, rpe: 4, paceTarget: '5:30/km' },
    })).toBe('Easy Run · 45min · RPE 4 · 5:30/km')
  })

  it('falls back to hrTarget when no paceTarget', () => {
    expect(buildGlanceLine({
      plannedSession: { type: 'Long Ride', duration: 120, rpe: 5, hrTarget: '140-155' },
    })).toBe('Long Ride · 120min · RPE 5 · 140-155 bpm')
  })

  it('full shape with all fields', () => {
    expect(buildGlanceLine({
      plannedSession: {
        type: 'Threshold',
        duration: 60,
        rpe: 7,
        zones: { Z4: 40, Z2: 20 },
        paceTarget: '4:20/km',
      },
    })).toBe('Threshold · 60min · Z4 · 4:20/km')
  })

  it('ignores empty zones object', () => {
    expect(buildGlanceLine({
      plannedSession: { type: 'Easy Run', duration: 45, rpe: 4, zones: { Z1: 0, Z2: 0 } },
    })).toBe('Easy Run · 45min · RPE 4')
  })
})
