// ─── hydrationTarget.test.js — Sawka 2007 ACSM hydration targets ────────────
import { describe, it, expect } from 'vitest'
import {
  computeHydrationTarget,
  HYDRATION_TARGET_CITATION,
} from '../../athlete/hydrationTarget.js'

describe('computeHydrationTarget — guards', () => {
  it('returns null when profile.weight is missing', () => {
    expect(computeHydrationTarget({ profile: {} })).toBeNull()
  })

  it('returns null when weight is zero or negative', () => {
    expect(computeHydrationTarget({ profile: { weight: 0 } })).toBeNull()
    expect(computeHydrationTarget({ profile: { weight: -5 } })).toBeNull()
  })

  it('returns null when weight is non-numeric garbage', () => {
    expect(computeHydrationTarget({ profile: { weight: 'heavy' } })).toBeNull()
  })

  it('returns null when called with no arguments', () => {
    expect(computeHydrationTarget()).toBeNull()
  })
})

describe('computeHydrationTarget — daily baseline (Sawka 2007)', () => {
  it('70 kg → dailyMl = 2800 (40 mL/kg)', () => {
    const out = computeHydrationTarget({ profile: { weight: 70 } })
    expect(out).not.toBeNull()
    expect(out.dailyMl).toBe(2800)
  })

  it('scales linearly with weight', () => {
    const a = computeHydrationTarget({ profile: { weight: 50 } })
    const b = computeHydrationTarget({ profile: { weight: 90 } })
    expect(a.dailyMl).toBe(2000)
    expect(b.dailyMl).toBe(3600)
  })

  it('accepts numeric strings for weight', () => {
    const out = computeHydrationTarget({ profile: { weight: '65' } })
    expect(out.dailyMl).toBe(2600)
  })
})

describe('computeHydrationTarget — pre / post-session universals', () => {
  it('preSessionMl is 500 mL regardless of weight', () => {
    expect(computeHydrationTarget({ profile: { weight: 50 } }).preSessionMl).toBe(500)
    expect(computeHydrationTarget({ profile: { weight: 90 } }).preSessionMl).toBe(500)
  })

  it('postSessionMlPerKgLost = 1500 mL (Sawka 1.5 L per kg lost)', () => {
    const out = computeHydrationTarget({ profile: { weight: 70 } })
    expect(out.postSessionMlPerKgLost).toBe(1500)
  })
})

describe('computeHydrationTarget — per-hour fluid by climate', () => {
  it('temperate → 600 mL/hr', () => {
    const out = computeHydrationTarget({
      profile: { weight: 70 },
      climate: 'temperate',
    })
    expect(out.perHourFluidMl).toBe(600)
  })

  it('cool → 500 mL/hr', () => {
    const out = computeHydrationTarget({
      profile: { weight: 70 },
      climate: 'cool',
    })
    expect(out.perHourFluidMl).toBe(500)
  })

  it('hot → 800 mL/hr', () => {
    const out = computeHydrationTarget({
      profile: { weight: 70 },
      climate: 'hot',
    })
    expect(out.perHourFluidMl).toBe(800)
  })

  it('falls back to temperate when climate is unknown', () => {
    const out = computeHydrationTarget({
      profile: { weight: 70 },
      climate: 'tropical',
    })
    expect(out.perHourFluidMl).toBe(600)
  })

  it('caps at 1000 mL/hr (hyponatremia safety)', () => {
    const out = computeHydrationTarget({
      profile: { weight: 70 },
      climate: 'hot',
    })
    expect(out.perHourFluidMl).toBeLessThanOrEqual(1000)
  })
})

describe('computeHydrationTarget — per-hour sodium by climate', () => {
  it('temperate → 700 mg/hr', () => {
    const out = computeHydrationTarget({
      profile: { weight: 70 },
      climate: 'temperate',
    })
    expect(out.perHourSodiumMg).toBe(700)
  })

  it('cool → 500 mg/hr', () => {
    const out = computeHydrationTarget({
      profile: { weight: 70 },
      climate: 'cool',
    })
    expect(out.perHourSodiumMg).toBe(500)
  })

  it('hot → 1000 mg/hr', () => {
    const out = computeHydrationTarget({
      profile: { weight: 70 },
      climate: 'hot',
    })
    expect(out.perHourSodiumMg).toBe(1000)
  })
})

describe('computeHydrationTarget — passes plannedSession through', () => {
  it('eligibleSession echoes the planned session payload', () => {
    const session = { type: 'Endurance', duration: 90 }
    const out = computeHydrationTarget({
      profile: { weight: 70 },
      plannedSession: session,
    })
    expect(out.eligibleSession).toBe(session)
  })

  it('eligibleSession is null when no planned session is supplied', () => {
    const out = computeHydrationTarget({ profile: { weight: 70 } })
    expect(out.eligibleSession).toBeNull()
  })
})

describe('computeHydrationTarget — citation', () => {
  it('cites Sawka 2007 + Casa 2000', () => {
    const out = computeHydrationTarget({ profile: { weight: 70 } })
    expect(out.citation).toBe(HYDRATION_TARGET_CITATION)
    expect(out.citation).toMatch(/Sawka 2007/)
    expect(out.citation).toMatch(/Casa 2000/)
  })
})
