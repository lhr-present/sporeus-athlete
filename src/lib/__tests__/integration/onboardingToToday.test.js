// src/lib/__tests__/integration/onboardingToToday.test.js
//
// v9.96.0 — End-to-end chain integration test:
// onboarding payload → buildStarterPlan → localStorage round-trip →
// getTodayPlannedSession → deriveSessionTargets.
//
// Each link in the Mission 1 chain has unit tests; this asserts the contract
// between them — i.e., the SHAPES handed off match. A drift in plan-week
// session field names (e.g., renaming `tss` → `targetTss`) would break the
// chain silently because individual unit tests pass against their own mocks.
// This test guards against that drift.

import { describe, it, expect } from 'vitest'
import { buildStarterPlan } from '../../plan/starterPlan.js'
import { getTodayPlannedSession } from '../../intelligence.js'
import { deriveSessionTargets } from '../../athlete/derivedSessionTargets.js'
import { computePlanDrift } from '../../athlete/planAdaptation.js'
import { buildDailyRecommendation } from '../../athlete/dailyRecommendation.js'

const TODAY = '2026-05-13'

describe('Mission 1 chain — onboarding → today (integration)', () => {
  it('Runner: onboarding finish produces a plan whose week-1 day-1 is today\'s session', () => {
    const onboardingData = {
      name: 'A', sport: 'Running',
      athleteLevel: 'competitive',
      maxhr: 185, ltpace: '4:30',
      goal: 'Half Marathon',
      weeks: 12,
      trainDays: 5,
    }
    const plan = buildStarterPlan(onboardingData, TODAY)
    expect(plan).not.toBeNull()
    expect(plan.weeks.length).toBe(12)

    // Round-trip through JSON (matches localStorage write+read in useAppState)
    const serialized = JSON.parse(JSON.stringify(plan))

    // getTodayPlannedSession should find a session for today (plan was generated today)
    const session = getTodayPlannedSession(serialized, TODAY)
    // Some week-1 day-1 sessions are 'rest' or 0-duration, in which case the
    // helper returns null. Iterate the next 5 days to find a real session.
    let found = session
    if (!found) {
      for (let i = 1; i < 5 && !found; i++) {
        const d = new Date(TODAY + 'T12:00:00Z')
        d.setUTCDate(d.getUTCDate() + i)
        found = getTodayPlannedSession(serialized, d.toISOString().slice(0, 10))
      }
    }
    expect(found).not.toBeNull()
    expect(typeof found.type).toBe('string')
    expect(found.duration).toBeGreaterThan(0)
  })

  it('Runner with threshold pace produces derivable pace targets in plan sessions', () => {
    const onboardingData = {
      sport: 'Running', goal: '10K',
      athleteLevel: 'intermediate',
    }
    const plan = buildStarterPlan(onboardingData, TODAY)
    const profile = { threshold: '4:30', primarySport: 'Running' }

    // Find first non-rest session in plan
    let session = null
    for (const wk of plan.weeks) {
      for (const s of wk.sessions) {
        if (s.duration > 0 && s.zone && s.zone !== '—') { session = s; break }
      }
      if (session) break
    }
    expect(session).not.toBeNull()

    // The chain: plan session → deriveSessionTargets → pace string
    const derived = deriveSessionTargets({ zone: session.zone, type: session.type }, profile)
    expect(derived.paceTarget).toMatch(/^\d:\d{2}(–\d:\d{2})?$/)
    expect(derived.powerTarget).toBeNull()
  })

  it('Swimmer with cssSec produces derivable swim pace targets (v9.100.0)', () => {
    // Pre-v9.100, a swimmer could complete onboarding but the metric input
    // showed FTP (irrelevant) so no cssSec was ever captured. Mission 1's
    // daily-answer link returned null for every swim session.
    const onboardingData = {
      sport: 'Swimming', goal: 'General Fitness',
      athleteLevel: 'competitive',
      cssSec: 90,  // 1:30/100m — captured by the v9.100 onboarding CSS field
    }
    const plan = buildStarterPlan(onboardingData, TODAY)
    const profile = { cssSec: 90, primarySport: 'Swimming' }

    // Find first non-rest session in the plan
    let session = null
    for (const wk of plan.weeks) {
      for (const s of wk.sessions) {
        if (s.duration > 0 && s.zone && s.zone !== '—') { session = s; break }
      }
      if (session) break
    }
    expect(session).not.toBeNull()

    // The chain: plan session → deriveSessionTargets → swim pace
    const derived = deriveSessionTargets({ zone: session.zone, type: session.type }, profile)
    expect(derived.paceTarget).toMatch(/\/100m$/)  // swim-pace suffix
    expect(derived.powerTarget).toBeNull()
  })

  it('Cyclist with FTP produces derivable power targets', () => {
    const onboardingData = {
      sport: 'Cycling', goal: 'Cycling Event',
      athleteLevel: 'competitive',
    }
    const plan = buildStarterPlan(onboardingData, TODAY)
    const profile = { ftp: 250, primarySport: 'Cycling' }

    // Find first non-rest cycling session
    let session = null
    for (const wk of plan.weeks) {
      for (const s of wk.sessions) {
        if (s.duration > 0 && s.zone && s.zone !== '—') { session = s; break }
      }
      if (session) break
    }
    expect(session).not.toBeNull()
    // Sport-specific labels from v9.92
    expect(session.type).toMatch(/ride|spin|FTP|interval/i)

    const derived = deriveSessionTargets({ zone: session.zone, type: session.type }, profile)
    expect(derived.powerTarget).toMatch(/^\d+(–\d+)?W$/)
  })

  it('Plan from onboarding has the shape planAdaptation expects', () => {
    const onboardingData = { sport: 'Running', goal: '10K', weeks: 12 }
    const plan = buildStarterPlan(onboardingData, TODAY)

    // computePlanDrift requires plan.weeks[].sessions[].tss; assert it's there
    for (const wk of plan.weeks) {
      expect(Array.isArray(wk.sessions)).toBe(true)
      for (const s of wk.sessions) {
        // Either it's a rest day (tss=0/missing) or it has a numeric tss
        if (s.type !== 'Rest' && s.duration > 0) {
          expect(typeof s.tss === 'number' || typeof s.targetTSS === 'number').toBe(true)
        }
      }
    }

    // Drift computation on a fresh plan + empty log should return pending
    const drift = computePlanDrift(plan, [], TODAY)
    expect(drift).not.toBeNull()
    expect(drift.status).toBe('pending')
    expect(drift.action).toBe('continue')
  })

  it('Plan from onboarding feeds back into buildDailyRecommendation when plan is later cleared', () => {
    // Simulate: athlete onboarded, then later cleared plan; no-plan branch
    // should still produce a recommendation.
    const profile = { primarySport: 'Running', threshold: '4:30' }
    const rec = buildDailyRecommendation({ log: [], recovery: [], profile, lang: 'en' })
    expect(rec).not.toBeNull()
    expect(rec.type).toBe('Long run')  // sport-specific even without a plan
    expect(rec.zone).toMatch(/^Z[0-5]$/)
  })

  it('Onboarding without goal does NOT seed a plan (fast-track exit)', () => {
    const onboardingData = { sport: 'Running', name: 'A' }  // no goal
    const plan = buildStarterPlan(onboardingData, TODAY)
    expect(plan).toBeNull()
  })

  it('Plan generatedAt aligns with today for getTodayPlannedSession week computation', () => {
    const plan = buildStarterPlan({ sport: 'Running', goal: '5K' }, TODAY)
    expect(plan.generatedAt).toBe(TODAY)
    // Week 1 = generatedAt..generatedAt+6 inclusive
    const w1Session = getTodayPlannedSession(plan, TODAY)
    // Either rest (null) or a real session — both are valid shapes
    if (w1Session) {
      expect(w1Session.weekIdx).toBe(0)
    }
  })

  it('TR language preserves session sport-specific labels in plan output', () => {
    const plan = buildStarterPlan({ sport: 'Running', goal: '10K' }, TODAY, 'tr')
    const allTypes = new Set()
    for (const wk of plan.weeks) for (const s of wk.sessions) allTypes.add(s.type)
    // At least one Turkish running label must appear
    const trRunningLabels = ['Uzun koşu', 'Tempo koşu', 'İnterval koşu', 'Toparlanma koşusu']
    expect(trRunningLabels.some(l => allTypes.has(l))).toBe(true)
  })
})
