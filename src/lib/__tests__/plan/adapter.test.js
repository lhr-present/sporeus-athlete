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

// v9.158.0 (Prompt D) — Threshold-aware duration scaling
describe('adaptE13PlanToLegacy — threshold-aware duration', () => {
  function nonRestDurations(legacy) {
    const out = []
    for (const wk of legacy) {
      for (const s of wk.sessions) {
        if (s.type !== 'Rest' && s.tss > 0) out.push(s.duration)
      }
    }
    return out
  }

  it('no scaling applied when threshold is absent', () => {
    const adaptive = baseInputs({ primarySport: 'Running' })
    const baseline = adaptE13PlanToLegacy(adaptive, 'en', 'Running')
    const explicit = adaptE13PlanToLegacy(adaptive, 'en', 'Running', { threshold: null })
    expect(nonRestDurations(baseline)).toEqual(nonRestDurations(explicit))
  })

  it('faster threshold (4:00/km) produces shorter sessions', () => {
    const adaptive = baseInputs({ primarySport: 'Running' })
    const baseline = adaptE13PlanToLegacy(adaptive, 'en', 'Running')
    const fast = adaptE13PlanToLegacy(adaptive, 'en', 'Running', { threshold: '4:00' })
    // sqrt(240/330) ≈ 0.853 → ~15% shorter
    const baselineDurations = nonRestDurations(baseline)
    const fastDurations = nonRestDurations(fast)
    expect(fastDurations.length).toBe(baselineDurations.length)
    // At least one comparison must show a meaningful shorter session
    // (some short sessions hit the 20-min floor and don't scale)
    const scaledPairs = baselineDurations
      .map((d, i) => [d, fastDurations[i]])
      .filter(([b]) => b > 25)  // skip floor-bound sessions
    expect(scaledPairs.length).toBeGreaterThan(0)
    for (const [b, f] of scaledPairs) {
      expect(f).toBeLessThan(b)
      // Within sqrt-damped range: 0.80–0.90
      expect(f / b).toBeGreaterThan(0.78)
      expect(f / b).toBeLessThan(0.92)
    }
  })

  it('slower threshold (6:30/km) produces longer sessions', () => {
    const adaptive = baseInputs({ primarySport: 'Running' })
    const baseline = adaptE13PlanToLegacy(adaptive, 'en', 'Running')
    const slow = adaptE13PlanToLegacy(adaptive, 'en', 'Running', { threshold: '6:30' })
    // sqrt(390/330) ≈ 1.087 → ~9% longer
    const baselineDurations = nonRestDurations(baseline)
    const slowDurations = nonRestDurations(slow)
    const meaningful = baselineDurations
      .map((d, i) => [d, slowDurations[i]])
      .filter(([b]) => b > 20)
    for (const [b, s] of meaningful) {
      expect(s).toBeGreaterThanOrEqual(b)
    }
  })

  it('threshold scaling skipped for non-running sports', () => {
    const adaptive = baseInputs({ primarySport: 'Cycling' })
    const baseline = adaptE13PlanToLegacy(adaptive, 'en', 'Cycling')
    const withThr  = adaptE13PlanToLegacy(adaptive, 'en', 'Cycling', { threshold: '4:00' })
    expect(nonRestDurations(baseline)).toEqual(nonRestDurations(withThr))
  })

  it('accepts numeric threshold (already in sec/km)', () => {
    const adaptive = baseInputs({ primarySport: 'Running' })
    const baseline   = adaptE13PlanToLegacy(adaptive, 'en', 'Running')
    const fromStr    = adaptE13PlanToLegacy(adaptive, 'en', 'Running', { threshold: '4:00' })
    const fromNumber = adaptE13PlanToLegacy(adaptive, 'en', 'Running', { threshold: 240 })
    expect(nonRestDurations(fromNumber)).toEqual(nonRestDurations(fromStr))
    // Sanity: also different from baseline
    expect(nonRestDurations(fromNumber)).not.toEqual(nonRestDurations(baseline))
  })

  it('garbage threshold input falls back to no scaling', () => {
    const adaptive = baseInputs({ primarySport: 'Running' })
    const baseline  = adaptE13PlanToLegacy(adaptive, 'en', 'Running')
    const garbage   = adaptE13PlanToLegacy(adaptive, 'en', 'Running', { threshold: 'not-a-pace' })
    const empty     = adaptE13PlanToLegacy(adaptive, 'en', 'Running', { threshold: '' })
    const zero      = adaptE13PlanToLegacy(adaptive, 'en', 'Running', { threshold: 0 })
    expect(nonRestDurations(garbage)).toEqual(nonRestDurations(baseline))
    expect(nonRestDurations(empty)).toEqual(nonRestDurations(baseline))
    expect(nonRestDurations(zero)).toEqual(nonRestDurations(baseline))
  })

  it('respects the 20-min minimum even when scaling would drop below', () => {
    const adaptive = baseInputs({ primarySport: 'Running' })
    const fast = adaptE13PlanToLegacy(adaptive, 'en', 'Running', { threshold: '3:00' })  // very fast
    for (const wk of fast) {
      for (const s of wk.sessions) {
        if (s.type !== 'Rest' && s.tss > 0) {
          expect(s.duration).toBeGreaterThanOrEqual(20)
        }
      }
    }
  })
})
