// src/lib/__tests__/athlete/cyclePhaseGate.test.js
import { describe, it, expect } from 'vitest'
import {
  buildCyclePhaseGate,
  applyCyclePhaseGate,
  isCycleGateAvailable,
  CYCLE_GATE_CITATION,
} from '../../athlete/cyclePhaseGate.js'

const TODAY = '2026-05-04'
const FEMALE_PROFILE = {
  gender: 'female',
  lastPeriodStart: '2026-04-28',
  cycleLength: 28,
}

describe('isCycleGateAvailable — privacy gate', () => {
  it('false for null / non-object', () => {
    expect(isCycleGateAvailable(null)).toBe(false)
    expect(isCycleGateAvailable(undefined)).toBe(false)
    expect(isCycleGateAvailable(42)).toBe(false)
  })
  it('false when gender is missing', () => {
    expect(isCycleGateAvailable({ lastPeriodStart: '2026-04-28' })).toBe(false)
  })
  it('false when gender is male', () => {
    expect(isCycleGateAvailable({ gender: 'male', lastPeriodStart: '2026-04-28' })).toBe(false)
  })
  it('false when female but lastPeriodStart not set (NOT opted in)', () => {
    expect(isCycleGateAvailable({ gender: 'female' })).toBe(false)
    expect(isCycleGateAvailable({ gender: 'female', lastPeriodStart: '' })).toBe(false)
  })
  it('true only when female + lastPeriodStart present', () => {
    expect(isCycleGateAvailable(FEMALE_PROFILE)).toBe(true)
  })
  it('case-insensitive gender match', () => {
    expect(isCycleGateAvailable({ gender: 'Female', lastPeriodStart: '2026-04-28' })).toBe(true)
    expect(isCycleGateAvailable({ gender: 'FEMALE', lastPeriodStart: '2026-04-28' })).toBe(true)
  })
})

describe('buildCyclePhaseGate — gating returns null', () => {
  it('null profile → null', () => {
    expect(buildCyclePhaseGate(null, { today: TODAY })).toBeNull()
  })
  it('male athlete → null', () => {
    expect(buildCyclePhaseGate({ gender: 'male', lastPeriodStart: '2026-04-28' }, { today: TODAY })).toBeNull()
  })
  it('female but no lastPeriodStart → null', () => {
    expect(buildCyclePhaseGate({ gender: 'female' }, { today: TODAY })).toBeNull()
  })
  it('invalid cycleLength (too short or too long) → null', () => {
    expect(buildCyclePhaseGate({ ...FEMALE_PROFILE, cycleLength: 10 }, { today: TODAY })).toBeNull()
    expect(buildCyclePhaseGate({ ...FEMALE_PROFILE, cycleLength: 90 }, { today: TODAY })).toBeNull()
  })
  it('malformed lastPeriodStart → null', () => {
    expect(buildCyclePhaseGate({ ...FEMALE_PROFILE, lastPeriodStart: '04/28/2026' }, { today: TODAY })).toBeNull()
    expect(buildCyclePhaseGate({ ...FEMALE_PROFILE, lastPeriodStart: 'banana' }, { today: TODAY })).toBeNull()
  })
})

describe('buildCyclePhaseGate — happy path (opted-in female)', () => {
  it('returns 4 weeks by default', () => {
    const g = buildCyclePhaseGate(FEMALE_PROFILE, { today: TODAY })
    expect(g).not.toBeNull()
    expect(g.weeks).toHaveLength(4)
  })

  it('honours options.weeks override', () => {
    const g = buildCyclePhaseGate(FEMALE_PROFILE, { today: TODAY, weeks: 8 })
    expect(g.weeks).toHaveLength(8)
  })

  it('each week has coverage summing to 7 days', () => {
    const g = buildCyclePhaseGate(FEMALE_PROFILE, { today: TODAY })
    for (const w of g.weeks) {
      const sum = Object.values(w.coverage).reduce((a, b) => a + b, 0)
      expect(sum).toBe(7)
    }
  })

  it('startISO advances 7 days each week', () => {
    const g = buildCyclePhaseGate(FEMALE_PROFILE, { today: TODAY })
    for (let i = 1; i < g.weeks.length; i++) {
      const a = new Date(g.weeks[i - 1].startISO + 'T00:00:00Z').getTime()
      const b = new Date(g.weeks[i].startISO + 'T00:00:00Z').getTime()
      expect(b - a).toBe(7 * 86_400_000)
    }
  })

  it('all multipliers are gentle (within ±5%, i.e. 0.95 – 1.05)', () => {
    const g = buildCyclePhaseGate(FEMALE_PROFILE, { today: TODAY, weeks: 12 })
    for (const w of g.weeks) {
      expect(w.tssMultiplier).toBeGreaterThanOrEqual(0.95)
      expect(w.tssMultiplier).toBeLessThanOrEqual(1.05)
    }
  })

  it('every week has bilingual EN+TR note', () => {
    const g = buildCyclePhaseGate(FEMALE_PROFILE, { today: TODAY })
    for (const w of g.weeks) {
      expect(w.note.en).toBeTruthy()
      expect(w.note.tr).toBeTruthy()
    }
  })

  it('includes a bilingual privacy note', () => {
    const g = buildCyclePhaseGate(FEMALE_PROFILE, { today: TODAY })
    expect(g.privacyNote.en).toMatch(/opt-in/i)
    expect(g.privacyNote.tr).toBeTruthy()
  })

  it('citation references McNulty 2020 + Sims', () => {
    expect(CYCLE_GATE_CITATION).toMatch(/McNulty/)
    expect(CYCLE_GATE_CITATION).toMatch(/Sims/)
  })

  it('dominantPhase rotates through phases over enough weeks', () => {
    const g = buildCyclePhaseGate(FEMALE_PROFILE, { today: TODAY, weeks: 8 })
    const phases = new Set(g.weeks.map(w => w.dominantPhase))
    // Over 8 weeks (~2 cycles) we should hit multiple phases
    expect(phases.size).toBeGreaterThanOrEqual(2)
  })
})

describe('applyCyclePhaseGate — pure no-op when gate is null', () => {
  const weeklyTSS = [
    { week: 1, phase: 'Base',  tss: 400 },
    { week: 2, phase: 'Base',  tss: 420 },
    { week: 3, phase: 'Build', tss: 450 },
  ]

  it('null gate returns the same array reference unchanged', () => {
    const out = applyCyclePhaseGate(weeklyTSS, null)
    expect(out).toBe(weeklyTSS)
  })

  it('undefined gate returns the same array', () => {
    const out = applyCyclePhaseGate(weeklyTSS, undefined)
    expect(out).toBe(weeklyTSS)
  })

  it('non-array input returns input unchanged', () => {
    expect(applyCyclePhaseGate(null, null)).toBeNull()
    expect(applyCyclePhaseGate(42, null)).toBe(42)
  })

  it('male athlete: build → apply → completely untouched output', () => {
    const gate = buildCyclePhaseGate({ gender: 'male' }, { today: TODAY })
    const out = applyCyclePhaseGate(weeklyTSS, gate)
    expect(out).toBe(weeklyTSS)
    // No cycle fields leaked onto any entry
    expect(out[0].cycleMultiplier).toBeUndefined()
    expect(out[0].cyclePhase).toBeUndefined()
  })
})

describe('applyCyclePhaseGate — opted-in female athlete', () => {
  it('adds cycleMultiplier + cyclePhase + cycleAdjustedTSS to each week', () => {
    const gate = buildCyclePhaseGate(FEMALE_PROFILE, { today: TODAY })
    const weeklyTSS = [
      { week: 1, phase: 'Base',  tss: 400 },
      { week: 2, phase: 'Base',  tss: 420 },
      { week: 3, phase: 'Build', tss: 450 },
      { week: 4, phase: 'Build', tss: 470 },
    ]
    const out = applyCyclePhaseGate(weeklyTSS, gate)
    for (let i = 0; i < out.length; i++) {
      expect(typeof out[i].cycleMultiplier).toBe('number')
      expect(typeof out[i].cyclePhase).toBe('string')
      expect(typeof out[i].cycleAdjustedTSS).toBe('number')
      // Adjusted = round(tss × multiplier)
      expect(out[i].cycleAdjustedTSS).toBe(Math.round(weeklyTSS[i].tss * out[i].cycleMultiplier))
    }
  })

  it('preserves original TSS field unchanged', () => {
    const gate = buildCyclePhaseGate(FEMALE_PROFILE, { today: TODAY })
    const weeklyTSS = [{ week: 1, phase: 'Base', tss: 400 }]
    const out = applyCyclePhaseGate(weeklyTSS, gate)
    expect(out[0].tss).toBe(400)
  })

  it('weeks beyond the forecast horizon are left unchanged', () => {
    const gate = buildCyclePhaseGate(FEMALE_PROFILE, { today: TODAY, weeks: 2 })
    const weeklyTSS = [
      { week: 1, phase: 'Base', tss: 400 },
      { week: 2, phase: 'Base', tss: 420 },
      { week: 3, phase: 'Build', tss: 450 }, // beyond 2-week horizon
    ]
    const out = applyCyclePhaseGate(weeklyTSS, gate)
    expect(out[0].cycleAdjustedTSS).toBeDefined()
    expect(out[1].cycleAdjustedTSS).toBeDefined()
    expect(out[2].cycleAdjustedTSS).toBeUndefined()
  })
})

// v9.489 (program-content HIGH F3) — buildEliteProgram passes weeklyTSS as
// NUMBERS; spreading a number yielded {} and zeroed every opted-in female
// athlete's program targets.
describe('applyCyclePhaseGate — number-array weeks (v9.489)', () => {
  it('annotates number weeks without destroying the tss', () => {
    const gate = { weeks: [{ tssMultiplier: 0.9, dominantPhase: 'luteal' }, { tssMultiplier: 1.0, dominantPhase: 'follicular' }] }
    const out = applyCyclePhaseGate([350, 365, 380], gate)
    expect(out[0].tss).toBe(350)
    expect(out[0].cycleAdjustedTSS).toBe(315)
    expect(out[1].cycleAdjustedTSS).toBe(365)
    expect(out[2]).toBe(380)  // beyond horizon — unchanged
  })
})
