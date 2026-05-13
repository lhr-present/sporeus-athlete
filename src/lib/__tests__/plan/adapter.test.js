// src/lib/__tests__/plan/adapter.test.js
//
// v9.95.0 — Shape contract for the shared E13 → legacy adapter.

import { describe, it, expect } from 'vitest'
import { adaptE13PlanToLegacy } from '../../plan/adapter.js'
import { generatePlan } from '../../plan/generatePlan.js'

function baseInputs(extra = {}) {
  return generatePlan({
    goal:          'pr',
    currentCTL:    50,
    weeksToRace:   12,
    availableDays: 5,
    model:         'traditional',
    level:         'intermediate',
    ...extra,
  })
}

describe('adaptE13PlanToLegacy', () => {
  it('returns null on null input', () => {
    expect(adaptE13PlanToLegacy(null)).toBeNull()
    expect(adaptE13PlanToLegacy(undefined)).toBeNull()
  })

  it('returns null when weeks is missing or not an array', () => {
    expect(adaptE13PlanToLegacy({})).toBeNull()
    expect(adaptE13PlanToLegacy({ weeks: 'nope' })).toBeNull()
  })

  it('returns one legacy week per adaptive week', () => {
    const adaptive = baseInputs()
    const out = adaptE13PlanToLegacy(adaptive)
    expect(out).toHaveLength(adaptive.weeks.length)
  })

  it('preserves phase from each week', () => {
    const adaptive = baseInputs()
    const out = adaptE13PlanToLegacy(adaptive)
    for (let i = 0; i < adaptive.weeks.length; i++) {
      expect(out[i].phase).toBe(adaptive.weeks[i].phase)
    }
  })

  it('sessions get sport-specific labels when sport is passed', () => {
    const adaptive = baseInputs()
    const out = adaptE13PlanToLegacy(adaptive, 'en', 'Cycling')
    const types = new Set()
    for (const wk of out) for (const s of wk.sessions) types.add(s.type)
    // At least one of the cycling-specific labels should appear (depending
    // on which intents the generator emitted across 12 weeks)
    const cyclingLabels = ['Long ride', 'Tempo ride', 'Power intervals', 'Recovery spin', 'FTP test']
    expect(cyclingLabels.some(l => types.has(l))).toBe(true)
  })

  it('falls back to adaptivePlan.primarySport when explicit primarySport is null', () => {
    const adaptive = baseInputs({ primarySport: 'Running' })
    const out = adaptE13PlanToLegacy(adaptive, 'en', null)
    const types = new Set()
    for (const wk of out) for (const s of wk.sessions) types.add(s.type)
    const runningLabels = ['Long run', 'Tempo run', 'Interval run', 'Recovery jog', 'Run test']
    expect(runningLabels.some(l => types.has(l))).toBe(true)
  })

  it('Turkish lang emits Turkish session labels', () => {
    const adaptive = baseInputs()
    const out = adaptE13PlanToLegacy(adaptive, 'tr', 'Running')
    const types = new Set()
    for (const wk of out) for (const s of wk.sessions) types.add(s.type)
    const trLabels = ['Uzun koşu', 'Tempo koşu', 'İnterval koşu', 'Toparlanma koşusu', 'Koşu testi']
    expect(trLabels.some(l => types.has(l))).toBe(true)
  })

  it('rest sessions have duration 0', () => {
    const adaptive = baseInputs()
    const out = adaptE13PlanToLegacy(adaptive)
    for (const wk of out) {
      for (const s of wk.sessions) {
        if (s.type === 'Rest') expect(s.duration).toBe(0)
      }
    }
  })

  it('non-rest sessions have duration ≥ 20', () => {
    const adaptive = baseInputs()
    const out = adaptE13PlanToLegacy(adaptive)
    for (const wk of out) {
      for (const s of wk.sessions) {
        if (s.type !== 'Rest' && s.tss > 0) {
          expect(s.duration).toBeGreaterThanOrEqual(20)
        }
      }
    }
  })

  it('zonePct sums to within rounding error of 100', () => {
    const adaptive = baseInputs()
    const out = adaptE13PlanToLegacy(adaptive)
    for (const wk of out) {
      const sum = wk.zonePct.reduce((a, b) => a + b, 0)
      // Round-trip from 5 percentages can lose 1-2 points
      expect(Math.abs(sum - 100)).toBeLessThanOrEqual(2)
    }
  })

  it('totalHours is a string with one decimal', () => {
    const adaptive = baseInputs()
    const out = adaptE13PlanToLegacy(adaptive)
    for (const wk of out) {
      expect(typeof wk.totalHours).toBe('string')
      expect(wk.totalHours).toMatch(/^\d+\.\d$/)
    }
  })

  it('preserves isDeload flag from adaptive plan', () => {
    const adaptive = baseInputs()
    const out = adaptE13PlanToLegacy(adaptive)
    for (let i = 0; i < out.length; i++) {
      expect(out[i].isDeload).toBe(adaptive.weeks[i].isDeload || false)
    }
  })

  it('Z0 (rest) zone is rendered as "—"', () => {
    const adaptive = baseInputs()
    const out = adaptE13PlanToLegacy(adaptive)
    for (const wk of out) {
      for (const s of wk.sessions) {
        if (s.type === 'Rest') expect(s.zone).toBe('—')
      }
    }
  })
})
