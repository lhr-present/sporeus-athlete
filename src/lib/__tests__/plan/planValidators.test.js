// ─── src/lib/__tests__/plan/planValidators.test.js ────────────────────────────
// Unit tests for E13 planValidators — validatePlan + isPlanValid.

import { describe, it, expect } from 'vitest'
import { generatePlan } from '../../plan/generatePlan.js'
import { applyTaper } from '../../plan/taperEngine.js'
import {
  validatePlan,
  isPlanValid,
  VALIDATION_CODES,
} from '../../plan/planValidators.js'

const BASE = Object.freeze({
  goal: 'pr', currentCTL: 50, weeksToRace: 12, availableDays: 5,
  model: 'traditional', level: 'intermediate',
})

function plan(overrides = {}) { return generatePlan({ ...BASE, ...overrides }) }

// ── Bad input handling ───────────────────────────────────────────────────────
describe('validatePlan — bad inputs', () => {
  it('returns invalid for null', () => {
    const r = validatePlan(null)
    expect(r.valid).toBe(false)
    expect(r.errors[0].code).toBe(VALIDATION_CODES.INVALID_PLAN)
  })

  it('returns invalid for non-object', () => {
    const r = validatePlan('not a plan')
    expect(r.valid).toBe(false)
  })

  it('returns invalid for plan with no weeks', () => {
    const r = validatePlan({ weeks: [] })
    expect(r.valid).toBe(false)
    expect(r.errors[0].code).toBe(VALIDATION_CODES.EMPTY_PLAN)
  })

  it('returns invalid for plan with weeks=null', () => {
    const r = validatePlan({ weeks: null })
    expect(r.valid).toBe(false)
  })
})

// ── Happy path ───────────────────────────────────────────────────────────────
describe('validatePlan — generated plans', () => {
  it.each(['traditional', 'polarized', 'block'])(
    'a generated %s plan is valid',
    (model) => {
      const r = validatePlan(plan({ model }))
      expect(r.valid).toBe(true)
      expect(r.errors).toEqual([])
    },
  )

  it('a tapered plan is valid', () => {
    const t = applyTaper(plan(), '2026-08-01', 3)
    const r = validatePlan(t)
    expect(r.valid).toBe(true)
  })

  it('isPlanValid mirrors validatePlan.valid', () => {
    const p = plan()
    expect(isPlanValid(p)).toBe(true)
    expect(isPlanValid(null)).toBe(false)
  })
})

// ── Rule 1: WoW TSS jump > 10% ───────────────────────────────────────────────
describe('validatePlan — TSS spike rule', () => {
  it('flags a >10% week-over-week jump', () => {
    const bad = {
      weeks: [
        {
          weekNum: 1, phase: 'Base', weeklyTSS: 200, isDeload: false,
          sessions: [
            { day: 1, intent: 'endurance', targetTSS: 100, zone: 'Z1' },
            { day: 2, intent: 'recovery',  targetTSS: 100, zone: 'Z1' },
          ],
        },
        {
          weekNum: 2, phase: 'Base', weeklyTSS: 240, isDeload: false,  // +20%
          sessions: [
            { day: 1, intent: 'endurance', targetTSS: 120, zone: 'Z1' },
            { day: 2, intent: 'recovery',  targetTSS: 120, zone: 'Z1' },
          ],
        },
      ],
    }
    const r = validatePlan(bad)
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.code === VALIDATION_CODES.TSS_SPIKE)).toBe(true)
  })

  it('does not flag a 10% growth (boundary)', () => {
    const ok = {
      weeks: [
        {
          weekNum: 1, phase: 'Base', weeklyTSS: 200, isDeload: false,
          sessions: [
            { day: 1, intent: 'endurance', targetTSS: 100, zone: 'Z1' },
            { day: 2, intent: 'recovery',  targetTSS: 100, zone: 'Z1' },
          ],
        },
        {
          weekNum: 2, phase: 'Base', weeklyTSS: 220, isDeload: false,  // +10%
          sessions: [
            { day: 1, intent: 'endurance', targetTSS: 110, zone: 'Z1' },
            { day: 2, intent: 'recovery',  targetTSS: 110, zone: 'Z1' },
          ],
        },
      ],
    }
    const r = validatePlan(ok)
    expect(r.errors.filter(e => e.code === VALIDATION_CODES.TSS_SPIKE)).toEqual([])
  })

  it('skips spike check if previous week was a deload', () => {
    const ok = {
      weeks: [
        {
          weekNum: 1, phase: 'Base', weeklyTSS: 100, isDeload: true,
          sessions: [
            { day: 1, intent: 'endurance', targetTSS: 50, zone: 'Z1' },
            { day: 2, intent: 'recovery',  targetTSS: 50, zone: 'Z1' },
          ],
        },
        {
          weekNum: 2, phase: 'Base', weeklyTSS: 200, isDeload: false,  // recovery from deload
          sessions: [
            { day: 1, intent: 'endurance', targetTSS: 100, zone: 'Z1' },
            { day: 2, intent: 'recovery',  targetTSS: 100, zone: 'Z1' },
          ],
        },
      ],
    }
    const r = validatePlan(ok)
    expect(r.errors.filter(e => e.code === VALIDATION_CODES.TSS_SPIKE)).toEqual([])
  })
})

// ── Rule 2: ≥1 recovery / rest day per week ──────────────────────────────────
describe('validatePlan — recovery-day rule', () => {
  it('flags a week with no recovery and no rest', () => {
    const bad = {
      weeks: [{
        weekNum: 1, phase: 'Base', weeklyTSS: 200, isDeload: false,
        sessions: [
          { day: 1, intent: 'endurance', targetTSS: 100, zone: 'Z1' },
          { day: 2, intent: 'tempo',     targetTSS: 100, zone: 'Z3' },
        ],
      }],
    }
    const r = validatePlan(bad)
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.code === VALIDATION_CODES.NO_RECOVERY)).toBe(true)
  })

  it('accepts a week with at least one rest day', () => {
    const ok = {
      weeks: [{
        weekNum: 1, phase: 'Base', weeklyTSS: 100, isDeload: false,
        sessions: [
          { day: 1, intent: 'endurance', targetTSS: 50, zone: 'Z1' },
          { day: 2, intent: 'rest',      targetTSS:  0, zone: 'Z0' },
          { day: 3, intent: 'endurance', targetTSS: 50, zone: 'Z1' },
        ],
      }],
    }
    const r = validatePlan(ok)
    expect(r.errors.filter(e => e.code === VALIDATION_CODES.NO_RECOVERY)).toEqual([])
  })

  it('Race phase is allowed to have no recovery day', () => {
    const ok = {
      weeks: [{
        weekNum: 1, phase: 'Race', weeklyTSS: 100, isDeload: false,
        sessions: [
          { day: 1, intent: 'tempo', targetTSS: 100, zone: 'Z3' },
        ],
      }],
    }
    const r = validatePlan(ok)
    expect(r.errors.filter(e => e.code === VALIDATION_CODES.NO_RECOVERY)).toEqual([])
  })
})

// ── Rule 3: no back-to-back Z5 days ──────────────────────────────────────────
describe('validatePlan — back-to-back Z5 rule', () => {
  it('flags two Z5 sessions on consecutive days', () => {
    const bad = {
      weeks: [{
        weekNum: 1, phase: 'Peak', weeklyTSS: 300, isDeload: false,
        sessions: [
          { day: 1, intent: 'vo2',     targetTSS: 150, zone: 'Z5' },
          { day: 2, intent: 'vo2',     targetTSS: 150, zone: 'Z5' },
          { day: 3, intent: 'recovery', targetTSS: 0, zone: 'Z1' },
        ],
      }],
    }
    const r = validatePlan(bad)
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.code === VALIDATION_CODES.BACK_TO_BACK_Z5)).toBe(true)
  })

  it('allows Z5 sessions separated by at least one day', () => {
    const ok = {
      weeks: [{
        weekNum: 1, phase: 'Peak', weeklyTSS: 300, isDeload: false,
        sessions: [
          { day: 1, intent: 'vo2',      targetTSS: 150, zone: 'Z5' },
          { day: 2, intent: 'recovery', targetTSS:  0, zone: 'Z1' },
          { day: 3, intent: 'vo2',      targetTSS: 150, zone: 'Z5' },
        ],
      }],
    }
    const r = validatePlan(ok)
    expect(r.errors.filter(e => e.code === VALIDATION_CODES.BACK_TO_BACK_Z5)).toEqual([])
  })

  it('detects Z5 by zone tag even without vo2 intent', () => {
    const bad = {
      weeks: [{
        weekNum: 1, phase: 'Peak', weeklyTSS: 200, isDeload: false,
        sessions: [
          { day: 1, intent: 'tempo', targetTSS: 100, zone: 'Z5' },
          { day: 2, intent: 'tempo', targetTSS: 100, zone: 'Z5' },
          { day: 3, intent: 'rest',  targetTSS:   0, zone: 'Z0' },
        ],
      }],
    }
    const r = validatePlan(bad)
    expect(r.errors.some(e => e.code === VALIDATION_CODES.BACK_TO_BACK_Z5)).toBe(true)
  })
})

// ── Rule 4: Taper → Race monotonic descent (v9.422) ──────────────────────────
describe('validatePlan — taper descent rule', () => {
  it('flags a taper week that ramps UP vs the prior taper week', () => {
    const bad = {
      weeks: [
        {
          weekNum: 1, phase: 'Peak', weeklyTSS: 300, isDeload: false,
          sessions: [
            { day: 1, intent: 'vo2',      targetTSS: 200, zone: 'Z5' },
            { day: 2, intent: 'recovery', targetTSS: 100, zone: 'Z1' },
          ],
        },
        {
          weekNum: 2, phase: 'Taper', weeklyTSS: 200, isDeload: false,
          sessions: [
            { day: 1, intent: 'tempo',    targetTSS: 120, zone: 'Z3' },
            { day: 2, intent: 'recovery', targetTSS:  80, zone: 'Z1' },
          ],
        },
        {
          weekNum: 3, phase: 'Taper', weeklyTSS: 260, isDeload: false,  // ramps UP
          sessions: [
            { day: 1, intent: 'tempo',    targetTSS: 160, zone: 'Z3' },
            { day: 2, intent: 'recovery', targetTSS: 100, zone: 'Z1' },
          ],
        },
      ],
    }
    const r = validatePlan(bad)
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.code === VALIDATION_CODES.TAPER_RAMP_UP && e.weekNum === 3)).toBe(true)
  })

  it('flags a later taper week that climbs back above the achieved peak', () => {
    // First taper week descends below peak (250→180); the next then climbs to
    // 300 — both a ramp-up vs the prior taper week AND above the peak week.
    const bad = {
      weeks: [
        {
          weekNum: 1, phase: 'Peak', weeklyTSS: 250, isDeload: false,
          sessions: [
            { day: 1, intent: 'vo2',      targetTSS: 150, zone: 'Z5' },
            { day: 2, intent: 'recovery', targetTSS: 100, zone: 'Z1' },
          ],
        },
        {
          weekNum: 2, phase: 'Taper', weeklyTSS: 180, isDeload: false,
          sessions: [
            { day: 1, intent: 'tempo',    targetTSS: 110, zone: 'Z3' },
            { day: 2, intent: 'recovery', targetTSS:  70, zone: 'Z1' },
          ],
        },
        {
          weekNum: 3, phase: 'Taper', weeklyTSS: 300, isDeload: false,  // > peak (250)
          sessions: [
            { day: 1, intent: 'tempo',    targetTSS: 200, zone: 'Z3' },
            { day: 2, intent: 'recovery', targetTSS: 100, zone: 'Z1' },
          ],
        },
      ],
    }
    const r = validatePlan(bad)
    expect(r.valid).toBe(false)
    // Reported both as a ramp-up and as exceeding the peak ceiling.
    const wk3Errs = r.errors.filter(e => e.code === VALIDATION_CODES.TAPER_RAMP_UP && e.weekNum === 3)
    expect(wk3Errs.length).toBeGreaterThanOrEqual(1)
  })

  it('accepts a monotonically descending taper', () => {
    const ok = {
      weeks: [
        {
          weekNum: 1, phase: 'Peak', weeklyTSS: 300, isDeload: false,
          sessions: [
            { day: 1, intent: 'vo2',      targetTSS: 200, zone: 'Z5' },
            { day: 2, intent: 'recovery', targetTSS: 100, zone: 'Z1' },
          ],
        },
        {
          weekNum: 2, phase: 'Taper', weeklyTSS: 220, isDeload: false,
          sessions: [
            { day: 1, intent: 'tempo',    targetTSS: 140, zone: 'Z3' },
            { day: 2, intent: 'recovery', targetTSS:  80, zone: 'Z1' },
          ],
        },
        {
          weekNum: 3, phase: 'Race', weeklyTSS: 120, isDeload: false,
          sessions: [
            { day: 1, intent: 'tempo',    targetTSS:  80, zone: 'Z3' },
            { day: 2, intent: 'recovery', targetTSS:  40, zone: 'Z1' },
          ],
        },
      ],
    }
    const r = validatePlan(ok)
    expect(r.errors.filter(e => e.code === VALIDATION_CODES.TAPER_RAMP_UP)).toEqual([])
  })

  it('every generated plan satisfies the taper descent rule (both phasing paths)', () => {
    const isoDaysAhead = (days) => {
      const d = new Date(); d.setUTCHours(12, 0, 0, 0); d.setUTCDate(d.getUTCDate() + days)
      return d.toISOString().slice(0, 10)
    }
    for (const w of [8, 12, 16, 20]) {
      for (const useRaceDate of [false, true]) {
        const overrides = { weeksToRace: w }
        if (useRaceDate) overrides.raceDate = isoDaysAhead(w * 7)
        const r = validatePlan(plan(overrides))
        expect(r.errors.filter(e => e.code === VALIDATION_CODES.TAPER_RAMP_UP)).toEqual([])
      }
    }
  })
})

// ── Structural checks ────────────────────────────────────────────────────────
describe('validatePlan — structural checks', () => {
  it('flags an empty week (no sessions)', () => {
    const bad = {
      weeks: [{ weekNum: 1, phase: 'Base', weeklyTSS: 0, isDeload: false, sessions: [] }],
    }
    const r = validatePlan(bad)
    expect(r.valid).toBe(false)
    expect(r.errors.some(e => e.code === VALIDATION_CODES.EMPTY_WEEK)).toBe(true)
  })

  it('flags negative TSS', () => {
    const bad = {
      weeks: [{
        weekNum: 1, phase: 'Base', weeklyTSS: -50, isDeload: false,
        sessions: [
          { day: 1, intent: 'endurance', targetTSS: 50, zone: 'Z1' },
          { day: 2, intent: 'recovery',  targetTSS:  0, zone: 'Z1' },
        ],
      }],
    }
    const r = validatePlan(bad)
    expect(r.errors.some(e => e.code === VALIDATION_CODES.NEGATIVE_TSS)).toBe(true)
  })
})

// ── Bilingual error messages ─────────────────────────────────────────────────
describe('validatePlan — bilingual messages', () => {
  it('every error message has en and tr keys', () => {
    const r = validatePlan(null)
    for (const err of r.errors) {
      expect(err.message).toHaveProperty('en')
      expect(err.message).toHaveProperty('tr')
      expect(typeof err.message.en).toBe('string')
      expect(typeof err.message.tr).toBe('string')
    }
  })

  it('TSS spike error includes the offending week number', () => {
    const bad = {
      weeks: [
        {
          weekNum: 1, phase: 'Base', weeklyTSS: 100, isDeload: false,
          sessions: [
            { day: 1, intent: 'endurance', targetTSS: 50, zone: 'Z1' },
            { day: 2, intent: 'recovery',  targetTSS: 50, zone: 'Z1' },
          ],
        },
        {
          weekNum: 2, phase: 'Base', weeklyTSS: 250, isDeload: false,
          sessions: [
            { day: 1, intent: 'endurance', targetTSS: 125, zone: 'Z1' },
            { day: 2, intent: 'recovery',  targetTSS: 125, zone: 'Z1' },
          ],
        },
      ],
    }
    const r = validatePlan(bad)
    const spike = r.errors.find(e => e.code === VALIDATION_CODES.TSS_SPIKE)
    expect(spike.weekNum).toBe(2)
  })
})

// ── Property test: random valid generated plans always pass ──────────────────
describe('validatePlan — property: every generated plan is valid', () => {
  const cases = []
  for (const ctl of [25, 45, 65]) {
    for (const w of [4, 8, 12, 24, 36, 52]) {
      for (const days of [3, 5, 7]) {
        for (const m of ['traditional', 'polarized', 'block']) {
          cases.push({ ctl, w, days, m })
        }
      }
    }
  }

  it.each(cases)(
    'CTL=$ctl weeks=$w days=$days model=$m always passes',
    ({ ctl, w, days, m }) => {
      const p = generatePlan({
        goal: 'pr', currentCTL: ctl, weeksToRace: w,
        availableDays: days, model: m, level: 'intermediate',
      })
      const r = validatePlan(p)
      expect(r.valid).toBe(true)
    },
  )
})

// ── Codes export ─────────────────────────────────────────────────────────────
describe('VALIDATION_CODES', () => {
  it('exports all expected codes', () => {
    const expected = [
      'EMPTY_PLAN', 'INVALID_PLAN', 'TSS_SPIKE',
      'NO_RECOVERY', 'BACK_TO_BACK_Z5', 'NEGATIVE_TSS', 'EMPTY_WEEK',
      'TAPER_RAMP_UP',
    ]
    for (const k of expected) expect(VALIDATION_CODES).toHaveProperty(k)
  })
})
