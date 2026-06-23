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

  it('Triathlon now produces sport-specific title (v9.97.0: was generic fallback)', () => {
    const out = buildDailyRecommendation({
      log:      [],
      recovery: [],
      profile:  { primarySport: 'Triathlon' },
    })
    // v9.97.0 added Triathlon to SPORT_INTENT_LABELS — default 'endurance' intent → 'Long session'
    expect(out.type).toBe('Long session')
  })

  it('falls back to generic title when sport has no mapping (Hybrid)', () => {
    const out = buildDailyRecommendation({
      log:      [],
      recovery: [],
      profile:  { primarySport: 'Hybrid' },
    })
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

  it('recent isolated spike WITH ≥14 days chronic base → recovery / Z1 / easy', () => {
    // INV-3: acwr_high only fires once a real chronic base exists (≥14 distinct
    // days). Provide a light 15-day base + a heavy acute spike so ACWR > 1.3.
    const log = []
    for (let i = 27; i >= 13; i--) {  // 15 distinct light days
      const d = new Date(); d.setUTCDate(d.getUTCDate() - i)
      log.push({ date: d.toISOString().slice(0, 10), type: 'Easy run', tss: 10 })
    }
    for (let i = 5; i >= 0; i--) {    // 6-day heavy acute spike
      const d = new Date(); d.setUTCDate(d.getUTCDate() - i)
      log.push({ date: d.toISOString().slice(0, 10), type: 'Race', tss: 200 })
    }
    const out = buildDailyRecommendation({ log, recovery: [], profile: {} })
    expect(out.source).toBe('acwr_high')
    expect(out.intent).toBe('recovery')
    expect(out.zone).toBe('Z1')
    expect(out.load).toBe('easy')
  })

  it('INV-3: cold-start single hard session (<14 days) does NOT yield mandatory-rest acwr_high', () => {
    const log = [
      { date: (() => { const d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10) })(),
        type: 'Race', tss: 250 },
    ]
    const out = buildDailyRecommendation({ log, recovery: [], profile: {} })
    expect(out.source).not.toBe('acwr_high')
  })

  // ── SAFETY INV-1: downgrade floor (forceEasy) ──────────────────────────────
  it('INV-1: forceEasy floors a tsb_high hard rec to easy Z1–Z2 recovery', () => {
    // tsb_high fires when TSB > 15: heavy chronic base, very light recent.
    const log = []
    for (let i = 70; i >= 11; i--) {  // 60-day heavy chronic base
      const d = new Date(); d.setUTCDate(d.getUTCDate() - i)
      log.push({ date: d.toISOString().slice(0, 10), type: 'Tempo', tss: 100 })
    }
    for (let i = 4; i >= 0; i--) {    // 5 very light recent days → TSB rises
      const d = new Date(); d.setUTCDate(d.getUTCDate() - i)
      log.push({ date: d.toISOString().slice(0, 10), type: 'Easy', tss: 5 })
    }
    // Without forceEasy this is a hard Z5 session.
    const hard = buildDailyRecommendation({ log, recovery: [], profile: {} })
    expect(hard.source).toBe('tsb_high')
    expect(hard.load).toBe('hard')
    // With forceEasy (the downgrade path) it must NEVER be hard.
    const easy = buildDailyRecommendation({ log, recovery: [], profile: {}, forceEasy: true })
    expect(easy.load).not.toBe('hard')
    expect(easy.load).toBe('easy')
    expect(easy.intent).toBe('recovery')
    expect(easy.rpe).toBeLessThanOrEqual(4)
    expect(easy.zone).toMatch(/^Z[12]$/)
  })

  it('INV-1: forceEasy leaves a non-hard rec unchanged (no spurious downgrade)', () => {
    // Default rule → moderate; forceEasy should not alter it.
    const plain = buildDailyRecommendation({ log: [], recovery: [], profile: {} })
    const forced = buildDailyRecommendation({ log: [], recovery: [], profile: {}, forceEasy: true })
    expect(plain.load).not.toBe('hard')
    expect(forced.load).toBe(plain.load)
    expect(forced.zone).toBe(plain.zone)
    expect(forced.rpe).toBe(plain.rpe)
  })

  it('INV-1: forceEasy downgrade is never harder than easy across rule paths', () => {
    const variants = [
      { log: [], recovery: [] },                                   // default → moderate
      { log: tssDays(28, 100), recovery: [] },                     // heavy chronic
      { log: [], recovery: [rec(today(), 25)] },                   // wellness_poor
    ]
    for (const v of variants) {
      const out = buildDailyRecommendation({ ...v, profile: {}, forceEasy: true })
      expect(out.load).not.toBe('hard')
    }
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
