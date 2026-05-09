// v9.32.0 — Plan staleness detection tests
import { describe, it, expect } from 'vitest'
import { computePlanStaleness, STALENESS_CITATION } from '../../athlete/eliteProgramStaleness.js'

const RUN_PLAN = {
  sport: 'run',
  currentLevel: { vdot: 50, ftp: null, css: null, split2kSec: null },
}
const BIKE_PLAN = {
  sport: 'bike',
  currentLevel: { vdot: null, ftp: 280, css: null, split2kSec: null },
}
const SWIM_PLAN = {
  sport: 'swim',
  currentLevel: { vdot: null, ftp: null, css: 95, split2kSec: null },
}
const ROW_PLAN = {
  sport: 'rowing',
  currentLevel: { vdot: null, ftp: null, css: null, split2kSec: 420 },
}
const TRI_PLAN = {
  sport: 'triathlon',
  currentLevel: { vdot: 48, ftp: 250, css: 100, split2kSec: null },
}

describe('computePlanStaleness — null returns', () => {
  it('returns null when plan is null/undefined', () => {
    expect(computePlanStaleness(null, { vdot: 55 })).toBeNull()
    expect(computePlanStaleness(undefined, { vdot: 55 })).toBeNull()
  })

  it('returns null when profile is null/undefined', () => {
    expect(computePlanStaleness(RUN_PLAN, null)).toBeNull()
    expect(computePlanStaleness(RUN_PLAN, undefined)).toBeNull()
  })

  it('returns null when plan has no currentLevel', () => {
    expect(computePlanStaleness({ sport: 'run' }, { vdot: 55 })).toBeNull()
  })

  it('returns null when no metric drifts beyond threshold', () => {
    expect(computePlanStaleness(RUN_PLAN, { vdot: 51 })).toBeNull() // <3 points
    expect(computePlanStaleness(RUN_PLAN, { vdot: 52 })).toBeNull() // exactly 2 points
  })

  it('returns null when profile has no comparable metric (zero / non-numeric)', () => {
    expect(computePlanStaleness(RUN_PLAN, { vdot: 0 })).toBeNull()
    expect(computePlanStaleness(RUN_PLAN, { vdot: 'fast' })).toBeNull()
    expect(computePlanStaleness(RUN_PLAN, {})).toBeNull()
  })
})

describe('computePlanStaleness — VDOT drift', () => {
  it('detects VDOT improvement crossing +3 threshold', () => {
    const r = computePlanStaleness(RUN_PLAN, { vdot: 55 })
    expect(r).not.toBeNull()
    expect(r.drifted).toHaveLength(1)
    expect(r.drifted[0].metric).toBe('vdot')
    expect(r.drifted[0].planValue).toBe(50)
    expect(r.drifted[0].currentValue).toBe(55)
    expect(r.drifted[0].deltaPct).toBeCloseTo(0.10, 2) // (55-50)/50
  })

  it('detects VDOT regression crossing -3 threshold', () => {
    const r = computePlanStaleness(RUN_PLAN, { vdot: 46 })
    expect(r).not.toBeNull()
    expect(r.drifted[0].deltaPct).toBeLessThan(0)
  })

  it('classifies major severity at +5% pace shift threshold', () => {
    // VDOT 50 → 55 = +10% — clearly major
    const r = computePlanStaleness(RUN_PLAN, { vdot: 55 })
    expect(r.severity).toBe('major')
  })

  it('classifies minor severity below the +5% threshold', () => {
    // VDOT 50 → 53 = +6%, just over major threshold; 50 → 52.4 = +4.8% minor
    const r = computePlanStaleness(RUN_PLAN, { vdot: 53 })
    expect(r.severity).toBe('major')
    // edge: just barely above drift threshold (3 points = 6% on VDOT 50 = major)
    // To get minor we need a higher base VDOT. Use a custom plan:
    const highPlan = { sport: 'run', currentLevel: { vdot: 65 } }
    const r2 = computePlanStaleness(highPlan, { vdot: 68 }) // 4.6% shift
    expect(r2.severity).toBe('minor')
  })
})

describe('computePlanStaleness — FTP drift', () => {
  it('detects FTP improvement crossing +15 W threshold', () => {
    const r = computePlanStaleness(BIKE_PLAN, { ftp: 300 })
    expect(r).not.toBeNull()
    expect(r.drifted[0].metric).toBe('ftp')
    expect(r.drifted[0].planValue).toBe(280)
    expect(r.drifted[0].currentValue).toBe(300)
  })

  it('does NOT trigger at sub-threshold drift (10 W)', () => {
    expect(computePlanStaleness(BIKE_PLAN, { ftp: 290 })).toBeNull()
  })

  it('major severity at large FTP gain (≥5%)', () => {
    const r = computePlanStaleness(BIKE_PLAN, { ftp: 320 }) // +14.3%
    expect(r.severity).toBe('major')
  })
})

describe('computePlanStaleness — CSS drift (lower is faster)', () => {
  it('detects CSS improvement (faster = lower sec/100m)', () => {
    const r = computePlanStaleness(SWIM_PLAN, { cssSec: 90 }) // 95 → 90, 5 sec faster
    expect(r).not.toBeNull()
    expect(r.drifted[0].metric).toBe('css')
    // direction should classify as 'improved' since CSS got lower (faster)
    expect(r.message.en).toMatch(/improved/i)
  })

  it('detects CSS regression (slower = higher sec/100m)', () => {
    const r = computePlanStaleness(SWIM_PLAN, { cssSec: 100 }) // +5 sec slower
    expect(r.message.en).toMatch(/dropped/i)
  })

  it('does NOT trigger at sub-threshold drift (2 sec)', () => {
    expect(computePlanStaleness(SWIM_PLAN, { cssSec: 93 })).toBeNull()
  })
})

describe('computePlanStaleness — 2k row drift', () => {
  it('detects 2k improvement at ≥10s', () => {
    const r = computePlanStaleness(ROW_PLAN, { split2kSec: 408 })
    expect(r).not.toBeNull()
    expect(r.drifted[0].metric).toBe('split2k')
  })

  it('does NOT trigger below threshold', () => {
    expect(computePlanStaleness(ROW_PLAN, { split2kSec: 415 })).toBeNull()
  })
})

describe('computePlanStaleness — multi-metric (triathlon)', () => {
  it('reports ALL drifted metrics for triathlon', () => {
    const r = computePlanStaleness(TRI_PLAN, { vdot: 53, ftp: 270, cssSec: 95 })
    expect(r).not.toBeNull()
    expect(r.drifted.length).toBe(3)
    const metrics = r.drifted.map(d => d.metric).sort()
    expect(metrics).toEqual(['css', 'ftp', 'vdot'])
  })

  it('reports mixed direction when some improved + some regressed', () => {
    // VDOT improved (48 → 53), FTP regressed (250 → 230)
    const r = computePlanStaleness(TRI_PLAN, { vdot: 53, ftp: 230 })
    expect(r.message.en).toMatch(/shifted/i)
  })

  it('skips metrics that match plan exactly (one-sided drift)', () => {
    const r = computePlanStaleness(TRI_PLAN, { vdot: 53, ftp: 250, cssSec: 100 })
    expect(r.drifted).toHaveLength(1)
    expect(r.drifted[0].metric).toBe('vdot')
  })
})

describe('computePlanStaleness — message bilingual', () => {
  it('returns bilingual message with EN + TR keys', () => {
    const r = computePlanStaleness(RUN_PLAN, { vdot: 55 })
    expect(r.message).toHaveProperty('en')
    expect(r.message).toHaveProperty('tr')
    expect(r.message.tr.length).toBeGreaterThan(10)
  })

  it('major severity message says "regenerate the plan"', () => {
    const r = computePlanStaleness(RUN_PLAN, { vdot: 60 })
    expect(r.message.en).toMatch(/regenerate/i)
  })

  it('minor severity message is softer ("consider")', () => {
    const highPlan = { sport: 'run', currentLevel: { vdot: 70 } }
    const r = computePlanStaleness(highPlan, { vdot: 73 })
    expect(r.severity).toBe('minor')
    expect(r.message.en).toMatch(/consider/i)
  })
})

describe('computePlanStaleness — citation export', () => {
  it('exports a citation string', () => {
    expect(STALENESS_CITATION).toMatch(/Daniels|Coggan/)
  })
})
