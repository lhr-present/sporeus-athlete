// ─── src/lib/__tests__/plan/taperEngine.test.js ───────────────────────────────
// Unit tests for E13 taperEngine — applyTaper + suggestTaper.

import { describe, it, expect } from 'vitest'
import { generatePlan } from '../../plan/generatePlan.js'
import { applyTaper, suggestTaper } from '../../plan/taperEngine.js'

const BASE = Object.freeze({
  goal: 'pr', currentCTL: 50, weeksToRace: 12, availableDays: 5,
  model: 'traditional', level: 'intermediate',
})

function plan(overrides = {}) { return generatePlan({ ...BASE, ...overrides }) }

// ── Input validation ─────────────────────────────────────────────────────────
describe('applyTaper — input validation', () => {
  it('returns null on null plan', () => {
    expect(applyTaper(null, '2026-08-01', 2)).toBeNull()
  })

  it('returns null on plan without weeks', () => {
    expect(applyTaper({}, '2026-08-01', 2)).toBeNull()
  })

  it('returns null on empty weeks array', () => {
    expect(applyTaper({ weeks: [] }, '2026-08-01', 2)).toBeNull()
  })

  it('returns null when taperWeeks is not 2 or 3', () => {
    const p = plan()
    expect(applyTaper(p, '2026-08-01', 1)).toBeNull()
    expect(applyTaper(p, '2026-08-01', 4)).toBeNull()
    expect(applyTaper(p, '2026-08-01', 0)).toBeNull()
    expect(applyTaper(p, '2026-08-01', 'two')).toBeNull()
  })

  it('returns null when plan is shorter than taperWeeks + 1', () => {
    const tiny = { weeks: [{ weeklyTSS: 100, sessions: [] }] }
    expect(applyTaper(tiny, '2026-08-01', 2)).toBeNull()
  })

  it('accepts numeric string for taperWeeks', () => {
    const p = plan()
    const t = applyTaper(p, '2026-08-01', '3')
    expect(t).not.toBeNull()
    expect(t.taperWeeks).toBe(3)
  })
})

// ── Output shape ─────────────────────────────────────────────────────────────
describe('applyTaper — output shape', () => {
  it('returns plan with race-day metrics', () => {
    const t = applyTaper(plan(), '2026-08-01', 2)
    expect(t).toHaveProperty('weeks')
    expect(t).toHaveProperty('preTaperCTL')
    expect(t).toHaveProperty('raceDayCTL')
    expect(t).toHaveProperty('raceDayATL')
    expect(t).toHaveProperty('raceDayTSB')
    expect(t).toHaveProperty('ctlDropPct')
    expect(t).toHaveProperty('recommendation')
    expect(t).toHaveProperty('citation')
  })

  it('citation references Mujika & Padilla', () => {
    const t = applyTaper(plan(), '2026-08-01', 3)
    expect(t.citation).toMatch(/Mujika/i)
    expect(t.citation).toMatch(/2003/)
  })

  it('does not mutate the input plan', () => {
    const p = plan()
    const originalWeeklyTSS = p.weeks.map(w => w.weeklyTSS)
    applyTaper(p, '2026-08-01', 2)
    p.weeks.forEach((wk, i) => expect(wk.weeklyTSS).toBe(originalWeeklyTSS[i]))
  })

  it('marks last taper week as Race phase', () => {
    const t = applyTaper(plan(), '2026-08-01', 2)
    const last = t.weeks[t.weeks.length - 1]
    expect(last.phase).toBe('Race')
  })

  it('marks intermediate taper weeks as Taper phase', () => {
    const t = applyTaper(plan(), '2026-08-01', 3)
    const len = t.weeks.length
    expect(t.weeks[len - 3].phase).toBe('Taper')
    expect(t.weeks[len - 2].phase).toBe('Taper')
    expect(t.weeks[len - 1].phase).toBe('Race')
  })

  it('passes raceDate through into output', () => {
    const t = applyTaper(plan(), '2026-09-15', 2)
    expect(t.raceDate).toBe('2026-09-15')
  })

  it('handles missing raceDate gracefully (sets to null)', () => {
    const t = applyTaper(plan(), undefined, 2)
    expect(t).not.toBeNull()
    expect(t.raceDate).toBeNull()
  })
})

// ── Mujika & Padilla compliance ──────────────────────────────────────────────
describe('applyTaper — Mujika & Padilla compliance', () => {
  it('CTL drop is between 5% and 10% across realistic CTL range', () => {
    for (const ctl of [30, 40, 50, 60, 70]) {
      for (const tw of [2, 3]) {
        const t = applyTaper(plan({ currentCTL: ctl }), '2026-08-01', tw)
        expect(t.ctlDropPct).toBeGreaterThanOrEqual(5)
        expect(t.ctlDropPct).toBeLessThanOrEqual(10)
      }
    }
  })

  it('TSB rises into +5..+15 for typical CTL=40..60', () => {
    for (const ctl of [40, 50, 60]) {
      for (const tw of [2, 3]) {
        const t = applyTaper(plan({ currentCTL: ctl }), '2026-08-01', tw)
        expect(t.raceDayTSB).toBeGreaterThanOrEqual(5)
        expect(t.raceDayTSB).toBeLessThanOrEqual(15)
      }
    }
  })

  it('TSB is positive on race day for any CTL', () => {
    for (const ctl of [25, 35, 45, 55, 65, 75, 85]) {
      const t = applyTaper(plan({ currentCTL: ctl }), '2026-08-01', 2)
      expect(t.raceDayTSB).toBeGreaterThan(0)
    }
  })

  it('race-day CTL is lower than pre-taper CTL', () => {
    const t = applyTaper(plan(), '2026-08-01', 3)
    expect(t.raceDayCTL).toBeLessThan(t.preTaperCTL)
  })

  it('recommendation is "optimal" for CTL=40..60 with tw=2 or 3', () => {
    for (const ctl of [40, 50, 60]) {
      for (const tw of [2, 3]) {
        const t = applyTaper(plan({ currentCTL: ctl }), '2026-08-01', tw)
        expect(t.recommendation).toBe('optimal')
      }
    }
  })

  it('recommendation is well-defined', () => {
    const valid = ['optimal', 'under_tapered', 'over_tapered']
    const t = applyTaper(plan(), '2026-08-01', 2)
    expect(valid).toContain(t.recommendation)
  })
})

// ── 3-week vs 2-week behavior ────────────────────────────────────────────────
describe('applyTaper — 3-week vs 2-week dynamics', () => {
  it('3-week taper produces equal or larger CTL drop than 2-week', () => {
    const t2 = applyTaper(plan(), '2026-08-01', 2)
    const t3 = applyTaper(plan(), '2026-08-01', 3)
    expect(t3.ctlDropPct).toBeGreaterThanOrEqual(t2.ctlDropPct)
  })

  it('both tapers leave the last (race) week with the lowest weekly TSS', () => {
    const t = applyTaper(plan(), '2026-08-01', 3)
    const lastTSS = t.weeks[t.weeks.length - 1].weeklyTSS
    const taperLen = t.taperWeeks
    for (let i = t.weeks.length - taperLen; i < t.weeks.length - 1; i++) {
      expect(t.weeks[i].weeklyTSS).toBeGreaterThanOrEqual(lastTSS)
    }
  })

  it('isDeload flag is cleared on taper weeks', () => {
    // Force a deload week to land at the start of the taper region
    const t = applyTaper(plan({ weeksToRace: 12 }), '2026-08-01', 3)
    const taperStart = t.weeks.length - 3
    for (let i = taperStart; i < t.weeks.length; i++) {
      expect(t.weeks[i].isDeload).toBe(false)
    }
  })
})

// ── Sessions inside taper weeks ──────────────────────────────────────────────
describe('applyTaper — taper-week sessions', () => {
  it('each taper-week session targetTSS is non-negative', () => {
    const t = applyTaper(plan(), '2026-08-01', 3)
    const taperStart = t.weeks.length - 3
    for (let i = taperStart; i < t.weeks.length; i++) {
      for (const s of t.weeks[i].sessions) {
        expect(s.targetTSS).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('preserves the intent variety from the source plan', () => {
    const p = plan()
    const t = applyTaper(p, '2026-08-01', 3)
    // The intents in taper weeks should match those generated for that week
    const startIdx = t.weeks.length - 3
    for (let i = 0; i < 3; i++) {
      const before = p.weeks[startIdx + i].sessions.map(s => s.intent)
      const after = t.weeks[startIdx + i].sessions.map(s => s.intent)
      expect(after).toEqual(before)
    }
  })
})

// ── suggestTaper ─────────────────────────────────────────────────────────────
describe('suggestTaper', () => {
  it('returns null for invalid plan', () => {
    expect(suggestTaper(null)).toBeNull()
    expect(suggestTaper({})).toBeNull()
  })

  it('returns one of the simulated tapers', () => {
    const s = suggestTaper(plan(), '2026-08-01')
    expect([2, 3]).toContain(s.taperWeeks)
  })

  it('selected taper has TSB in or near the +5..+15 range', () => {
    const s = suggestTaper(plan(), '2026-08-01')
    expect(s.raceDayTSB).toBeGreaterThan(0)
    expect(s.raceDayTSB).toBeLessThanOrEqual(20)
  })

  it('selected taper has CTL drop ≤ 12% (some slack vs strict 10%)', () => {
    const s = suggestTaper(plan({ currentCTL: 50 }), '2026-08-01')
    expect(s.ctlDropPct).toBeLessThanOrEqual(12)
  })
})

// ── Periodization model coverage ─────────────────────────────────────────────
describe('applyTaper — across periodization models', () => {
  it.each(['traditional', 'polarized', 'block'])(
    'works for model=%s',
    (model) => {
      const t = applyTaper(plan({ model }), '2026-08-01', 3)
      expect(t).not.toBeNull()
      expect(t.raceDayTSB).toBeGreaterThan(0)
    },
  )
})
