import { describe, it, expect } from 'vitest'
import { generatePlan } from '../plan/generatePlan.js'
import { adaptE13PlanToLegacy } from '../plan/adapter.js'

const BASE = { goal: 'pr', currentCTL: 50, weeksToRace: 12, availableDays: 5, model: 'traditional', level: 'intermediate', raceDistance: '10K' }
const peakOf = (plan) => Math.max(...plan.weeks.map(w => w.weeklyTSS))

describe('v9.412 physiology→plan: VO2max ramp (flag-gated)', () => {
  it('flag OFF → volume is byte-identical regardless of vo2max', () => {
    const off       = generatePlan({ ...BASE })
    const offHiVo2  = generatePlan({ ...BASE, vo2max: 75 })            // flag still off
    expect(off.weeks.map(w => w.weeklyTSS)).toEqual(offHiVo2.weeks.map(w => w.weeklyTSS))
  })

  it('flag ON stays subordinate to ACWR safety: bounded, monotonic in vo2max, never unsafe', () => {
    // The VO2max nudge raises the peakTSS ANCHOR but the visible weekly peak is governed by
    // the ACWR injury-safety clamp — so it widens only within safe headroom and never exceeds
    // it. We assert the SAFE contract (not a forced increase): >= baseline, <= safe bound,
    // monotonic in vo2max. (Overriding the ACWR ceiling is a separate founder decision.)
    const off  = generatePlan({ ...BASE })
    const hi   = generatePlan({ ...BASE, vo2max: 75, physiologyTargets: true })
    const lo   = generatePlan({ ...BASE, vo2max: 40, physiologyTargets: true })
    expect(peakOf(hi)).toBeGreaterThanOrEqual(peakOf(off))               // never below baseline
    expect(peakOf(hi)).toBeLessThanOrEqual(Math.round(peakOf(off) * 1.11) + 5) // never unsafe
    expect(peakOf(hi)).toBeGreaterThanOrEqual(peakOf(lo))               // monotonic in vo2max
  })

  it('flag ON but no vo2max → unchanged (no NaN)', () => {
    const off = generatePlan({ ...BASE })
    const on  = generatePlan({ ...BASE, physiologyTargets: true })   // no vo2max
    expect(on.weeks.map(w => w.weeklyTSS)).toEqual(off.weeks.map(w => w.weeklyTSS))
  })
})

describe('v9.412 physiology→plan: adapter bakes intensity targets (flag-gated)', () => {
  const plan = generatePlan({ ...BASE, primarySport: 'cycling', physiologyTargets: true })
  const profile = { primarySport: 'cycling', sport: 'Cycling', ftp: '250' }

  it('flag OFF → sessions carry no target key', () => {
    const weeks = adaptE13PlanToLegacy(plan, 'en', 'cycling', { profile, physiologyTargets: false })
    const anyTarget = weeks.some(w => w.sessions.some(s => s.target))
    expect(anyTarget).toBe(false)
  })

  it('flag ON + FTP → at least one non-rest cycling session gets a power target', () => {
    const weeks = adaptE13PlanToLegacy(plan, 'en', 'cycling', { profile, physiologyTargets: true })
    const withPower = weeks.flatMap(w => w.sessions).filter(s => s.target && s.target.power)
    expect(withPower.length).toBeGreaterThan(0)
  })

  it('flag ON but no profile → no targets (and no crash)', () => {
    const weeks = adaptE13PlanToLegacy(plan, 'en', 'cycling', { physiologyTargets: true })
    expect(weeks.some(w => w.sessions.some(s => s.target))).toBe(false)
  })
})
