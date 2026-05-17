// src/lib/__tests__/athlete/ctlTrajectory.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { projectCtlTrajectory, CITATION } from '../../athlete/ctlTrajectory.js'

// `calcLoad` (formulas.js) walks daily TSS from the log's first date up
// to system-time `new Date()`. Freezing the clock lets us position
// "real today" at the desired weekday so the projection has a known
// remaining-days window.
beforeEach(() => {
  vi.setSystemTime(new Date('2026-05-04T12:00:00Z')) // Monday
})
afterEach(() => {
  vi.setSystemTime(new Date())
})

// Build a saved plan with `weeks` where each week.sessions is a 7-day
// Mon→Sun array of { tss } entries. `generatedAt` defaults to the
// Monday of the test week so weekIdx 0 covers Mon→Sun.
function makePlan({ tssByDow = [0, 0, 0, 0, 0, 0, 0], generatedAt = '2026-05-04', weeks = 1 } = {}) {
  const sessions = tssByDow.map(tss => ({ type: 'Endurance', tss, duration: 60, rpe: 5 }))
  return {
    generatedAt,
    weeks: Array.from({ length: weeks }, () => ({ phase: 'Build', sessions })),
  }
}

// Build a long log of repeated daily TSS ending at `endDate` (ISO).
// 180 days of constant TSS lets CTL converge close to that TSS.
function makeLogConstant(tss, endDate, days = 180) {
  const out = []
  const end = new Date(endDate + 'T00:00:00Z')
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end.getTime())
    d.setUTCDate(d.getUTCDate() - i)
    out.push({ date: d.toISOString().slice(0, 10), tss })
  }
  return out
}

describe('projectCtlTrajectory — null / empty signals', () => {
  it('returns null for an empty log', () => {
    expect(projectCtlTrajectory({
      log: [],
      plan: makePlan(),
      today: '2026-05-04',
    })).toBeNull()
  })

  it('returns null when log produces CTL=0 (single tiny entry, no history)', () => {
    // A single recent TSS=0 entry yields CTL=0 via calcLoad.
    const log = [{ date: '2026-05-04', tss: 0 }]
    expect(projectCtlTrajectory({
      log,
      plan: makePlan(),
      today: '2026-05-04',
    })).toBeNull()
  })

  it('returns null when no plan provided', () => {
    expect(projectCtlTrajectory({
      log: makeLogConstant(50, '2026-05-04'),
      plan: null,
      today: '2026-05-04',
    })).toBeNull()
    expect(projectCtlTrajectory({
      log: makeLogConstant(50, '2026-05-04'),
      plan: { weeks: [] },
      today: '2026-05-04',
    })).toBeNull()
  })
})

describe('projectCtlTrajectory — direction classification', () => {
  it('rising when remaining planned TSS far exceeds current CTL', () => {
    // Monday 2026-05-04, current CTL ≈ 30, plan loads 200 TSS each day Mon→Sun
    const log = makeLogConstant(30, '2026-05-04')
    const plan = makePlan({ tssByDow: [200, 200, 200, 200, 200, 200, 200] })
    const r = projectCtlTrajectory({ log, plan, today: '2026-05-04' })
    expect(r).not.toBeNull()
    expect(r.direction).toBe('rising')
    expect(r.delta).toBeGreaterThan(0.5)
    expect(r.projectedCtl).toBeGreaterThan(r.currentCtl)
    expect(r.daysToSunday).toBe(6)
  })

  it('falling when remaining days are all rest (TSS=0)', () => {
    // Monday 2026-05-04, current CTL ≈ 80, every remaining day rest
    const log = makeLogConstant(80, '2026-05-04')
    const plan = makePlan({ tssByDow: [0, 0, 0, 0, 0, 0, 0] })
    const r = projectCtlTrajectory({ log, plan, today: '2026-05-04' })
    expect(r).not.toBeNull()
    expect(r.direction).toBe('falling')
    expect(r.delta).toBeLessThan(-0.5)
    expect(r.projectedCtl).toBeLessThan(r.currentCtl)
  })

  it('stable when planned TSS each day ≈ current CTL', () => {
    // Maintenance week: TSS=50/day matches CTL=50 → no drift
    const log = makeLogConstant(50, '2026-05-04')
    const plan = makePlan({ tssByDow: [50, 50, 50, 50, 50, 50, 50] })
    const r = projectCtlTrajectory({ log, plan, today: '2026-05-04' })
    expect(r).not.toBeNull()
    expect(r.direction).toBe('stable')
    expect(Math.abs(r.delta)).toBeLessThanOrEqual(0.5)
  })
})

describe('projectCtlTrajectory — Banister math', () => {
  it('single remaining day (Sunday): CTL=50, TSS=100, k=42 → ≈ 51.19', () => {
    // 2026-05-10 is a Sunday → daysToSunday = 0 → remainingDays = 1
    vi.setSystemTime(new Date('2026-05-10T12:00:00Z'))
    const log = makeLogConstant(50, '2026-05-10')
    // generatedAt = Mon of that week so weekIdx 0 includes Sunday
    const plan = makePlan({ tssByDow: [0, 0, 0, 0, 0, 0, 100], generatedAt: '2026-05-04' })
    const r = projectCtlTrajectory({ log, plan, today: '2026-05-10', k: 42 })
    expect(r).not.toBeNull()
    expect(r.daysToSunday).toBe(0)
    expect(r.currentCtl).toBeCloseTo(50, 0)
    // 50 + (100 − 50) / 42 = 51.190…
    expect(r.projectedCtl).toBeCloseTo(51.2, 1)
  })

  it('returns the documented shape (CITATION exported + numeric fields)', () => {
    const log = makeLogConstant(40, '2026-05-04')
    const plan = makePlan({ tssByDow: [60, 60, 60, 60, 60, 60, 60] })
    const r = projectCtlTrajectory({ log, plan, today: '2026-05-04' })
    expect(r).toMatchObject({
      currentCtl: expect.any(Number),
      projectedCtl: expect.any(Number),
      delta: expect.any(Number),
      direction: expect.stringMatching(/^(rising|falling|stable)$/),
      daysToSunday: expect.any(Number),
    })
    expect(CITATION).toMatch(/Banister/i)
    expect(CITATION).toMatch(/Coggan/i)
  })
})
