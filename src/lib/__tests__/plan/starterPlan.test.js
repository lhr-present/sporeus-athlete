// src/lib/__tests__/plan/starterPlan.test.js
//
// v9.95.0 — tests for the onboarding → plan seed.

import { describe, it, expect } from 'vitest'
import { buildStarterPlan, canSeedStarterPlan } from '../../plan/starterPlan.js'

const TODAY = '2026-05-13'

describe('canSeedStarterPlan', () => {
  it('returns false for null/empty/missing-goal inputs', () => {
    expect(canSeedStarterPlan(null)).toBe(false)
    expect(canSeedStarterPlan(undefined)).toBe(false)
    expect(canSeedStarterPlan({})).toBe(false)
    expect(canSeedStarterPlan({ name: 'A', sport: 'Running' })).toBe(false)  // no goal
  })

  it('returns true once goal is set', () => {
    expect(canSeedStarterPlan({ goal: '5K' })).toBe(true)
    expect(canSeedStarterPlan({ goal: 'General Fitness' })).toBe(true)
    expect(canSeedStarterPlan({ goal: 'Marathon', name: 'A' })).toBe(true)
  })
})

describe('buildStarterPlan', () => {
  it('returns null when goal is missing (fast-track exit)', () => {
    const out = buildStarterPlan({ name: 'A', sport: 'Running' }, TODAY)
    expect(out).toBeNull()
  })

  it('returns a complete plan when goal is provided', () => {
    const data = {
      name: 'A', sport: 'Running', goal: 'Half Marathon',
      athleteLevel: 'competitive', maxhr: 185, ftp: 0, ltpace: '4:30',
    }
    const out = buildStarterPlan(data, TODAY)
    expect(out).not.toBeNull()
    expect(out.goal).toBe('Half Marathon')
    expect(out.raceDistance).toBe('Half Marathon')
    expect(out.primarySport).toBe('Running')
    expect(Array.isArray(out.weeks)).toBe(true)
    expect(out.weeks.length).toBeGreaterThan(0)
    expect(out.fromOnboarding).toBe(true)
    expect(out.isAdaptive).toBe(true)
    expect(out.generatedAt).toBe(TODAY)
  })

  it('uses explicit weeks when provided', () => {
    const data = { goal: '5K', sport: 'Running', weeks: 8 }
    const out = buildStarterPlan(data, TODAY)
    expect(out.weeks.length).toBe(8)
  })

  it('derives weeks from raceDate when weeks is missing', () => {
    // Race date ~9 weeks from today
    const raceDate = '2026-07-15'
    const data = { goal: 'Marathon', sport: 'Running', raceDate }
    const out = buildStarterPlan(data, TODAY)
    expect(out.weeks.length).toBeGreaterThanOrEqual(8)
    expect(out.weeks.length).toBeLessThanOrEqual(10)
  })

  it('defaults to 12 weeks when both weeks and raceDate are missing', () => {
    const data = { goal: '10K', sport: 'Running' }
    const out = buildStarterPlan(data, TODAY)
    expect(out.weeks.length).toBe(12)
  })

  it('rejects out-of-range explicit weeks (< 3 → default)', () => {
    const data = { goal: '5K', sport: 'Running', weeks: 2 }
    const out = buildStarterPlan(data, TODAY)
    expect(out.weeks.length).toBe(12)  // falls back to default
  })

  it('rejects out-of-range explicit weeks (> 52 → default)', () => {
    const data = { goal: 'Marathon', sport: 'Running', weeks: 100 }
    const out = buildStarterPlan(data, TODAY)
    expect(out.weeks.length).toBe(12)  // falls back to default
  })

  it('Cycling sport routes through distance-aware generator', () => {
    const data = { goal: 'Cycling Event', sport: 'Cycling', ftp: 250 }
    const out = buildStarterPlan(data, TODAY)
    expect(out.primarySport).toBe('Cycling')
    expect(out.raceDistance).toBe('Cycling Event')
    // Cycling labels should appear somewhere in the plan
    const allTypes = out.weeks.flatMap(w => w.sessions.map(s => s.type))
    const cyclingLabels = ['Long ride', 'Tempo ride', 'Power intervals', 'Recovery spin', 'FTP test']
    expect(cyclingLabels.some(l => allTypes.includes(l))).toBe(true)
  })

  it('Turkish lang emits Turkish session labels', () => {
    const data = { goal: '10K', sport: 'Running' }
    const out = buildStarterPlan(data, TODAY, 'tr')
    const allTypes = out.weeks.flatMap(w => w.sessions.map(s => s.type))
    const trLabels = ['Uzun koşu', 'Tempo koşu', 'İnterval koşu', 'Toparlanma koşusu']
    expect(trLabels.some(l => allTypes.includes(l))).toBe(true)
  })

  it('uses data.athleteLevel when present', () => {
    const data = { goal: '5K', sport: 'Running', athleteLevel: 'advanced' }
    const out = buildStarterPlan(data, TODAY)
    expect(out.level).toBe('advanced')
  })

  it('falls back to data.level for backwards-compat', () => {
    const data = { goal: '5K', sport: 'Running', level: 'Beginner' }
    const out = buildStarterPlan(data, TODAY)
    expect(out.level).toBe('Beginner')
  })

  it('hoursPerWeek scales with availableDays (default 5 → 8)', () => {
    const data = { goal: '5K', sport: 'Running' }
    const out = buildStarterPlan(data, TODAY)
    // availableDays default = 5; hoursPerWeek = max(3, round(5*1.5)) = 8
    expect(out.hoursPerWeek).toBe(8)
  })

  it('honors data.trainDays when in [2, 7] range', () => {
    const data = { goal: '5K', sport: 'Running', trainDays: 6 }
    const out = buildStarterPlan(data, TODAY)
    expect(out.hoursPerWeek).toBe(9)  // round(6*1.5) = 9
  })

  it('plan includes a Base phase early (sanity)', () => {
    const data = { goal: '10K', sport: 'Running' }
    const out = buildStarterPlan(data, TODAY)
    const earlyPhases = out.weeks.slice(0, 3).map(w => w.phase)
    expect(earlyPhases).toContain('Base')
  })

  it('plan includes Taper or Race phase at the end (sanity)', () => {
    const data = { goal: '10K', sport: 'Running' }
    const out = buildStarterPlan(data, TODAY)
    const latePhases = out.weeks.slice(-2).map(w => w.phase)
    expect(['Taper', 'Race'].some(p => latePhases.includes(p))).toBe(true)
  })

  it('General Fitness goal still produces a valid plan', () => {
    const data = { goal: 'General Fitness', sport: 'Running' }
    const out = buildStarterPlan(data, TODAY)
    expect(out).not.toBeNull()
    expect(out.weeks.length).toBe(12)
  })

  it('respects data.primarySport when sport is absent (mirror)', () => {
    const data = { goal: '5K', primarySport: 'Cycling' }
    const out = buildStarterPlan(data, TODAY)
    expect(out.primarySport).toBe('Cycling')
  })
})
