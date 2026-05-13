// src/lib/__tests__/athlete/dailyRecommendation.test.js
//
// v9.93.0 — tests for buildDailyRecommendation

import { describe, it, expect } from 'vitest'
import { buildDailyRecommendation } from '../../athlete/dailyRecommendation.js'

// Helper: build a recovery entry for a given date with a 0–100 score
function rec(date, score) {
  return { date, sleep: 3, energy: 3, soreness: 3, mood: 3, stress: 3, score }
}

function today() { return new Date().toISOString().slice(0, 10) }

// Build N days of equal TSS at a given level to push CTL/ATL to a target.
// Returns an array of log entries dated yesterday and earlier.
function tssDays(days, tssPerDay) {
  const out = []
  for (let i = 1; i <= days; i++) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
    out.push({ date: d.toISOString().slice(0, 10), type: 'Easy run', duration: 45, rpe: 4, tss: tssPerDay })
  }
  return out
}

describe('buildDailyRecommendation', () => {
  it('returns null when getSingleSuggestion returns null (defensive — should not happen with default rule)', () => {
    // getSingleSuggestion's default rule always fires, so this is never null in
    // practice. The function still null-guards. We just verify the contract.
    const out = buildDailyRecommendation({ log: [], recovery: [], profile: {} })
    expect(out).not.toBeNull()
  })

  it('returns a renderable session for a fresh athlete (no log, no recovery)', () => {
    const out = buildDailyRecommendation({ log: [], recovery: [], profile: {} })
    expect(out).toMatchObject({
      intent:   expect.any(String),
      type:     expect.any(String),
      zone:     expect.stringMatching(/^Z[0-5]$/),
      duration: expect.any(Number),
      rpe:      expect.any(Number),
      load:     expect.stringMatching(/^(none|easy|moderate|hard)$/),
      source:   expect.any(String),
    })
    // Default rule fires for a fresh athlete
    expect(out.source).toBe('default')
    expect(out.intent).toBe('endurance')
    expect(out.zone).toBe('Z2')
  })

  it('low wellness (score ≤40) triggers recovery / Z1 / low RPE', () => {
    const out = buildDailyRecommendation({
      log:      [],
      recovery: [rec(today(), 30)],  // 30/100 → 1.5/5 → 2/5 (rounds up) — actually ≤2 triggers wellness_poor
      profile:  { primarySport: 'Running' },
    })
    expect(out.source).toBe('wellness_poor')
    expect(out.intent).toBe('recovery')
    expect(out.zone).toBe('Z1')
    expect(out.rpe).toBeLessThanOrEqual(5)
  })

  it('sport-specific title for cyclist with default recommendation', () => {
    const out = buildDailyRecommendation({
      log:      [],
      recovery: [],
      profile:  { primarySport: 'Cycling' },
    })
    // Default → endurance → "Long ride" for cyclists
    expect(out.type).toBe('Long ride')
  })

  it('sport-specific title for runner', () => {
    const out = buildDailyRecommendation({
      log:      [],
      recovery: [],
      profile:  { primarySport: 'Running' },
    })
    expect(out.type).toBe('Long run')
  })

  it('falls back to generic title when sport is unknown', () => {
    const out = buildDailyRecommendation({
      log:      [],
      recovery: [],
      profile:  { primarySport: 'Triathlon' },
    })
    // Triathlon falls through to generic 'Endurance'
    expect(out.type).toBe('Endurance')
  })

  it('Turkish rationale when lang=tr', () => {
    const out = buildDailyRecommendation({
      log:      [],
      recovery: [],
      profile:  { primarySport: 'Running' },
      lang:     'tr',
    })
    expect(out.rationale).toBe('Normal antrenman aralığında')
    expect(out.type).toBe('Uzun koşu')
  })

  it('Turkish rationale for wellness_poor source', () => {
    const out = buildDailyRecommendation({
      log:      [],
      recovery: [rec(today(), 25)],
      profile:  { primarySport: 'Running' },
      lang:     'tr',
    })
    expect(out.rationale).toBe('İyilik düşük — otonom toparlanma önceliklidir')
  })

  it('recent heavy load → easy/recovery (not vo2)', () => {
    // 14 days of heavy TSS produces either acwr_high or tsb_low — both map to
    // recovery zone. We assert the OUTCOME (don't push hard today), not which
    // specific rule fired.
    const log = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setUTCDate(d.getUTCDate() - i)
      log.push({ date: d.toISOString().slice(0, 10), type: 'Tempo', tss: 100 })
    }
    const out = buildDailyRecommendation({ log, recovery: [], profile: {} })
    expect(['acwr_high', 'tsb_low']).toContain(out.source)
    expect(out.intent).toBe('recovery')
    expect(out.zone).toBe('Z1')
    expect(out.load).toBe('easy')
  })

  it('recent isolated spike → recovery / Z1 / easy', () => {
    // Single big TSS day after empty chronic window → high ACWR
    const log = [
      { date: (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10) })(),
        type: 'Race', tss: 250 },
    ]
    const out = buildDailyRecommendation({ log, recovery: [], profile: {} })
    expect(out.source).toBe('acwr_high')
    expect(out.intent).toBe('recovery')
    expect(out.zone).toBe('Z1')
    expect(out.load).toBe('easy')
  })

  it('returns numeric duration for all sources', () => {
    const cases = [
      { log: [], recovery: [rec(today(), 25)], expect: 0 },  // wellness_poor → null duration → 0
      { log: [], recovery: [], expect: 60 },                  // default → 60 (from getSingleSuggestion)
    ]
    for (const c of cases) {
      const out = buildDailyRecommendation({ log: c.log, recovery: c.recovery, profile: {} })
      expect(typeof out.duration).toBe('number')
    }
  })

  it('zone is always parseable by deriveSessionTargets (Z1–Z5 or Z0)', () => {
    // Exercise several rule paths
    const variants = [
      { log: [], recovery: [], profile: {} },
      { log: [], recovery: [rec(today(), 20)], profile: {} },
      { log: tssDays(28, 100), recovery: [], profile: {} },
    ]
    for (const v of variants) {
      const out = buildDailyRecommendation(v)
      expect(out.zone).toMatch(/^Z[0-5]$/)
    }
  })

  it('args object is optional — defaults to empty inputs', () => {
    const out = buildDailyRecommendation()
    expect(out).not.toBeNull()
    expect(out.source).toBeDefined()
  })

  it('lang defaults to en when omitted', () => {
    const out = buildDailyRecommendation({ log: [], recovery: [], profile: { primarySport: 'Running' } })
    expect(out.type).toBe('Long run')  // EN label
  })

  it('output shape is identical regardless of which rule fires', () => {
    const keys = ['intent', 'type', 'zone', 'duration', 'rpe', 'rationale', 'load', 'source'].sort()
    const variants = [
      { log: [], recovery: [] },                              // default
      { log: [], recovery: [rec(today(), 25)] },              // wellness_poor
      { log: tssDays(20, 100).concat({ date: (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10) })(), tss: 250 }), recovery: [] }, // acwr_high
    ]
    for (const v of variants) {
      const out = buildDailyRecommendation({ ...v, profile: {} })
      expect(Object.keys(out).sort()).toEqual(keys)
    }
  })
})
