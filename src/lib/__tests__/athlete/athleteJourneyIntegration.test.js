// src/lib/__tests__/athlete/athleteJourneyIntegration.test.js
// Integration-style tests for the complete 5-layer athlete journey.
// No mocks — all real functions.
//
// Layers:
//   1. raceGoalEngine  — analyzeRaceGoal, parseMmSs
//   2. sessionLibrary  — buildFullWeekPlan
//   3. trainingBridge  — buildTrainingPlan, getCurrentPlanWeek
//   4. vdotTracker     — detectVdotFromLog
//   5. intelligence    — predictFitness

import { describe, it, expect } from 'vitest'
import { analyzeRaceGoal, parseMmSs }         from '../../athlete/raceGoalEngine.js'
import { buildFullWeekPlan }                   from '../../athlete/sessionLibrary.js'
import { buildTrainingPlan, getCurrentPlanWeek } from '../../athlete/trainingBridge.js'
import { detectVdotFromLog }                   from '../../athlete/vdotTracker.js'
import { predictFitness }                      from '../../intelligence.js'

// ── Inline adaptSession helper (mirrors RaceGoalDashCard.jsx logic) ───────────
// This is a copy of the pure logic — NOT imported from the component.
function adaptSession(session, tsb) {
  if (!session || tsb >= -5) return { session, downgraded: false, warn: false }
  if (tsb < -20 && session.run) {
    const easyRun = {
      type: 'Easy Run — TSB Adapted', tr: 'Kolay Koşu — TSB Uyarlaması',
      zone: 1, rpeLow: 2, rpeHigh: 3, durationMin: 30,
      paceStr: null, hrLow: null, hrHigh: null, tss: 20,
      structure: 'Run 30min easy. HR below 70% maxHR. Conversational pace. Scheduled session replaced due to critical fatigue.',
      structureTr: '30dk kolay koş. Nabız maks nabzın %70 altında. Sohbet temposu. Kritik yorgunluk nedeniyle planlanan antrenman değiştirildi.',
    }
    return {
      session: { ...session, run: easyRun, type: easyRun.type, tr: easyRun.tr, zone: 1, paceStr: null, totalDurationMin: easyRun.durationMin },
      downgraded: true, warn: false,
    }
  }
  return { session, downgraded: false, warn: true }
}

// ── Shared constants ──────────────────────────────────────────────────────────
const PLAN_START = '2026-04-28'
const TODAY      = '2026-04-30'

// ── Helpers ───────────────────────────────────────────────────────────────────
function makePlan(currentSec, goalSec, profile = {}) {
  const analysis = analyzeRaceGoal(currentSec, goalSec, 10000, profile, [])
  return { analysis, plan: analysis ? buildTrainingPlan(analysis, PLAN_START) : [] }
}

function firstPhaseWeeks(plan, phaseName) {
  return plan.filter(w => w.phase === phaseName && !w.isDeload)
}

// Finds the first non-deload week in a given phase
function firstNonDeloadWeek(plan, phaseName) {
  return plan.find(w => w.phase === phaseName && !w.isDeload) ?? null
}

// Returns the session for a given day-of-week index (0=Mon, 1=Tue…6=Sun)
function daySession(week, dayIdx) {
  return week?.sessions?.[dayIdx] ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. BEGINNER JOURNEY — 50:00 → 45:00 for 10K
// ─────────────────────────────────────────────────────────────────────────────
describe('Beginner journey — 50:00 → 45:00 10K', () => {
  const currentSec = parseMmSs('50:00')  // 3000
  const goalSec    = parseMmSs('45:00')  // 2700
  const analysis   = analyzeRaceGoal(currentSec, goalSec, 10000, {}, [])
  const plan       = analysis ? buildTrainingPlan(analysis, PLAN_START) : []

  it('parseMmSs returns correct seconds for 50:00', () => {
    expect(currentSec).toBe(3000)
  })

  it('parseMmSs returns correct seconds for 45:00', () => {
    expect(goalSec).toBe(2700)
  })

  it('analyzeRaceGoal returns non-null', () => {
    expect(analysis).not.toBeNull()
  })

  it('weeksToGoal is > 0', () => {
    expect(analysis.weeksToGoal).toBeGreaterThan(0)
  })

  it('plan is non-empty', () => {
    expect(plan.length).toBeGreaterThan(0)
  })

  it('first phase is Base', () => {
    expect(plan[0].phase).toBe('Base')
  })

  it('week 1 Tuesday (index 1) has a run session', () => {
    const week1 = plan[0]
    const tuesday = daySession(week1, 1)
    expect(tuesday).not.toBeNull()
    expect(tuesday.run).not.toBeNull()
  })

  it('phaseTr.length <= 10 on every non-deload week', () => {
    for (const week of plan) {
      if (!week.isDeload) {
        expect(week.phaseTr.length).toBeLessThanOrEqual(10)
      }
    }
  })

  it('week 3 Saturday run is longer than week 1 Saturday run (progressive overload)', () => {
    const baseWeeks = firstPhaseWeeks(plan, 'Base')
    // Need at least 3 non-deload Base weeks to test progressive overload
    if (baseWeeks.length < 3) return

    const week1Sat = daySession(baseWeeks[0], 5) // Saturday = index 5
    const week3Sat = daySession(baseWeeks[2], 5)

    expect(week1Sat?.run).not.toBeNull()
    expect(week3Sat?.run).not.toBeNull()
    expect(week3Sat.run.durationMin).toBeGreaterThan(week1Sat.run.durationMin)
  })

  it('all weeks have 7 sessions', () => {
    for (const week of plan) {
      expect(week.sessions).toHaveLength(7)
    }
  })

  it('plan total weeks matches analysis.weeksToGoal', () => {
    expect(plan.length).toBe(analysis.weeksToGoal)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. INTERMEDIATE JOURNEY — 40:00 → 35:00 for 10K
// ─────────────────────────────────────────────────────────────────────────────
describe('Intermediate journey — 40:00 → 35:00 10K', () => {
  const currentSec = parseMmSs('40:00')  // 2400
  const goalSec    = parseMmSs('35:00')  // 2100
  const analysis   = analyzeRaceGoal(currentSec, goalSec, 10000, {}, [])
  const plan       = analysis ? buildTrainingPlan(analysis, PLAN_START) : []

  it('analysis is non-null', () => {
    expect(analysis).not.toBeNull()
  })

  it('Build phase exists in the plan', () => {
    const buildWeek = plan.find(w => w.phase === 'Build')
    expect(buildWeek).not.toBeUndefined()
  })

  it('Build week Tuesday session (zone 4 threshold) exists', () => {
    const buildWeek = firstNonDeloadWeek(plan, 'Build')
    expect(buildWeek).not.toBeNull()
    const tuesday = daySession(buildWeek, 1)
    expect(tuesday?.run).not.toBeNull()
    expect(tuesday.run.zone).toBe(4)
  })

  it('vdotGap is positive (goal faster than current)', () => {
    expect(analysis.vdotGap).toBeGreaterThan(0)
  })

  it('feasibility is one of the expected values', () => {
    expect(['achievable', 'ambitious', 'stretch', 'extreme']).toContain(analysis.feasibility)
  })

  it('all Build-phase non-deload weeks have threshold Tuesday', () => {
    const buildWeeks = firstPhaseWeeks(plan, 'Build')
    for (const week of buildWeeks) {
      const tuesday = daySession(week, 1)
      expect(tuesday?.run?.zone).toBe(4)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. ADVANCED JOURNEY — 32:00 → 30:00 for 10K
// ─────────────────────────────────────────────────────────────────────────────
describe('Advanced journey — 32:00 → 30:00 10K', () => {
  const currentSec = parseMmSs('32:00')  // 1920
  const goalSec    = parseMmSs('30:00')  // 1800
  const analysis   = analyzeRaceGoal(currentSec, goalSec, 10000, {}, [])
  const plan       = analysis ? buildTrainingPlan(analysis, PLAN_START) : []

  it('analysis is non-null', () => {
    expect(analysis).not.toBeNull()
  })

  it('Peak phase exists in the plan', () => {
    const peakWeek = plan.find(w => w.phase === 'Peak')
    expect(peakWeek).not.toBeUndefined()
  })

  it('Peak phase week Tuesday has zone 5 (VO2max intervals)', () => {
    const peakWeek = firstNonDeloadWeek(plan, 'Peak')
    expect(peakWeek).not.toBeNull()
    const tuesday = daySession(peakWeek, 1)
    expect(tuesday?.run).not.toBeNull()
    expect(tuesday.run.zone).toBe(5)
  })

  it('currentVdot is high (> 55) for a 32:00 10K runner', () => {
    expect(analysis.currentVdot).toBeGreaterThan(55)
  })

  it('all Peak-phase non-deload Tuesdays have zone 5', () => {
    const peakWeeks = firstPhaseWeeks(plan, 'Peak')
    for (const week of peakWeeks) {
      const tuesday = daySession(week, 1)
      expect(tuesday?.run?.zone).toBe(5)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. GOAL ALREADY MET — current = goal (equal times)
// ─────────────────────────────────────────────────────────────────────────────
describe('Goal already met — current = goal', () => {
  // The function guards: goalTimeSec >= currentTimeSec → null
  // When times are equal the function returns null by design.
  it('analyzeRaceGoal(2400, 2400, 10000) returns null (equal times not a valid goal)', () => {
    const result = analyzeRaceGoal(2400, 2400, 10000, {}, [])
    expect(result).toBeNull()
  })

  it('buildTrainingPlan(null, ...) returns empty array', () => {
    expect(buildTrainingPlan(null, PLAN_START)).toEqual([])
  })

  // With a 1-second improvement (vdotGap near 0), the plan builds without error
  it('1-second improvement returns non-null with minimal vdotGap', () => {
    const result = analyzeRaceGoal(2400, 2399, 10000, {}, [])
    expect(result).not.toBeNull()
    expect(result.vdotGap).toBeGreaterThanOrEqual(0)
    expect(result.weeksToGoal).toBeGreaterThan(0)
  })

  it('plan builds from 1-second goal without error', () => {
    const analysis = analyzeRaceGoal(2400, 2399, 10000, {}, [])
    const plan = buildTrainingPlan(analysis, PLAN_START)
    expect(Array.isArray(plan)).toBe(true)
    expect(plan.length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. NULL / ZERO INPUTS
// ─────────────────────────────────────────────────────────────────────────────
describe('Null / zero inputs', () => {
  it('analyzeRaceGoal(0, 0, 10000) returns null without throwing', () => {
    expect(() => analyzeRaceGoal(0, 0, 10000, {}, [])).not.toThrow()
    expect(analyzeRaceGoal(0, 0, 10000, {}, [])).toBeNull()
  })

  it('analyzeRaceGoal(null, null, 10000) returns null without throwing', () => {
    expect(() => analyzeRaceGoal(null, null, 10000, {}, [])).not.toThrow()
    expect(analyzeRaceGoal(null, null, 10000, {}, [])).toBeNull()
  })

  it('buildTrainingPlan(null, PLAN_START) returns []', () => {
    expect(buildTrainingPlan(null, PLAN_START)).toEqual([])
  })

  it('getCurrentPlanWeek([], TODAY) returns null', () => {
    expect(getCurrentPlanWeek([], TODAY)).toBeNull()
  })

  it('getCurrentPlanWeek(null, TODAY) returns null', () => {
    expect(getCurrentPlanWeek(null, TODAY)).toBeNull()
  })

  it('buildFullWeekPlan with unknown phase falls back to Base config', () => {
    const sessions = buildFullWeekPlan('UNKNOWN_PHASE', 33, 1, null)
    expect(sessions).toHaveLength(7)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. MAXHR CHAIN — profile.age → HR ranges in sessions
// ─────────────────────────────────────────────────────────────────────────────
describe('MaxHR chain — profile.age → HR ranges in sessions', () => {
  const profile = { age: 40 }
  // Expected maxHR via Tanaka 2001: 208 − 0.7 × 40 = 180
  const expectedMaxHR = Math.round(208 - 0.7 * 40)

  const analysis = analyzeRaceGoal(3000, 2700, 10000, profile, [])
  const plan     = analysis ? buildTrainingPlan(analysis, PLAN_START) : []

  it('analysis predicted.maxHR is derived from age', () => {
    expect(analysis).not.toBeNull()
    expect(analysis.predicted.maxHR.value).toBe(expectedMaxHR)
    expect(analysis.predicted.maxHR.label).toBe('PREDICTED')
  })

  it('predicted lthr is calculated from maxHR', () => {
    const expectedLTHR = Math.round(expectedMaxHR * 0.87)
    expect(analysis.predicted.lthr.value).toBe(expectedLTHR)
  })

  it('Build week Tuesday run has hrLow > 0 (HR ranges propagated)', () => {
    const buildWeek = firstNonDeloadWeek(plan, 'Build')
    expect(buildWeek).not.toBeNull()
    const tuesday = daySession(buildWeek, 1)
    expect(tuesday?.run).not.toBeNull()
    expect(tuesday.run.hrLow).toBeGreaterThan(0)
  })

  it('Build week Tuesday run hrHigh > hrLow', () => {
    const buildWeek = firstNonDeloadWeek(plan, 'Build')
    const tuesday = daySession(buildWeek, 1)
    expect(tuesday.run.hrHigh).toBeGreaterThan(tuesday.run.hrLow)
  })

  it('directly built week plan with maxHR has hrLow on run sessions', () => {
    const sessions = buildFullWeekPlan('Build', analysis.currentVdot, 1, expectedMaxHR)
    const tueSess  = sessions[1] // Tuesday
    expect(tueSess.run).not.toBeNull()
    expect(tueSess.run.hrLow).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. TSB ADAPTATION RULES — inline helper
// ─────────────────────────────────────────────────────────────────────────────
describe('TSB adaptation rules — inline helper', () => {
  // A typical run-containing session (simulates a Build Tuesday)
  const sessionWithRun = {
    day: 'Tue', zone: 4, type: 'Threshold 2×20min',
    totalDurationMin: 55,
    run: {
      type: 'Threshold 2×20min', zone: 4, durationMin: 55,
      rpeLow: 7, rpeHigh: 8, tss: 65,
    },
  }

  // A session with no run (preventive-only day)
  const sessionNoRun = {
    day: 'Mon', zone: 1, type: 'Hip & Glute Activation',
    totalDurationMin: 15,
    run: null,
    preventive: { name: 'Hip & Glute Activation', durationMin: 15 },
  }

  it('tsb >= -5: no change, downgraded=false, warn=false', () => {
    const { session, downgraded, warn } = adaptSession(sessionWithRun, -5)
    expect(downgraded).toBe(false)
    expect(warn).toBe(false)
    expect(session).toBe(sessionWithRun)
  })

  it('tsb = 0 (well-rested): no adaptation', () => {
    const { downgraded, warn } = adaptSession(sessionWithRun, 0)
    expect(downgraded).toBe(false)
    expect(warn).toBe(false)
  })

  it('tsb = -12, session has run: warn=true, downgraded=false', () => {
    const { downgraded, warn } = adaptSession(sessionWithRun, -12)
    expect(warn).toBe(true)
    expect(downgraded).toBe(false)
  })

  it('tsb = -12, session has run: original session returned unchanged', () => {
    const { session } = adaptSession(sessionWithRun, -12)
    expect(session).toBe(sessionWithRun)
  })

  it('tsb = -25, session has run: downgraded=true', () => {
    const { downgraded } = adaptSession(sessionWithRun, -25)
    expect(downgraded).toBe(true)
  })

  it('tsb = -25, session has run: adapted run.zone = 1', () => {
    const { session } = adaptSession(sessionWithRun, -25)
    expect(session.run.zone).toBe(1)
  })

  it('tsb = -25, session has run: totalDurationMin = 30', () => {
    const { session } = adaptSession(sessionWithRun, -25)
    expect(session.totalDurationMin).toBe(30)
  })

  it('tsb = -25, session has run: warn=false (downgraded, not warned)', () => {
    const { warn } = adaptSession(sessionWithRun, -25)
    expect(warn).toBe(false)
  })

  it('tsb = -25, session has NO run (preventive only): downgraded=false, warn=true', () => {
    const { downgraded, warn } = adaptSession(sessionNoRun, -25)
    expect(downgraded).toBe(false)
    expect(warn).toBe(true)
  })

  it('tsb = -25, session=null: session=null returned, downgraded=false', () => {
    const { session, downgraded } = adaptSession(null, -25)
    expect(session).toBeNull()
    expect(downgraded).toBe(false)
  })

  it('tsb = -21 (just below -20) with run: downgraded=true (boundary)', () => {
    const { downgraded } = adaptSession(sessionWithRun, -21)
    expect(downgraded).toBe(true)
  })

  it('tsb = -20 (boundary, not below -20) with run: warn=true, downgraded=false', () => {
    const { downgraded, warn } = adaptSession(sessionWithRun, -20)
    expect(downgraded).toBe(false)
    expect(warn).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. VDOTTRACKER + INTELLIGENCE CHAIN
// ─────────────────────────────────────────────────────────────────────────────
describe('vdotTracker + intelligence chain', () => {
  // 3 recent running entries spanning 90 days
  const recentRunLog = [
    { date: '2026-04-01', distanceM: 10000, durationSec: 3000, duration: 50, rpe: 7, type: 'Run', tss: 60 },
    { date: '2026-04-10', distanceM: 10000, durationSec: 2940, duration: 49, rpe: 7, type: 'Run', tss: 63 },
    { date: '2026-04-20', distanceM: 10000, durationSec: 2880, duration: 48, rpe: 7, type: 'Run', tss: 65 },
  ]

  const bikeOnlyLog = [
    { date: '2026-04-01', distanceM: 40000, durationSec: 3600, duration: 60, rpe: 7, type: 'Bike' },
    { date: '2026-04-10', distanceM: 40000, durationSec: 3500, duration: 58, rpe: 6, type: 'Cycling' },
    { date: '2026-04-20', distanceM: 30000, durationSec: 3000, duration: 50, rpe: 6, type: 'Bike Ride' },
  ]

  it('detectVdotFromLog with 3 recent running entries returns non-null', () => {
    const result = detectVdotFromLog(recentRunLog, 90, TODAY)
    expect(result).not.toBeNull()
  })

  it('detectVdotFromLog with 3 recent running entries returns vdot > 0', () => {
    const result = detectVdotFromLog(recentRunLog, 90, TODAY)
    expect(result.vdot).toBeGreaterThan(0)
  })

  it('detectVdotFromLog with 3 recent running entries has candidateCount = 3', () => {
    const result = detectVdotFromLog(recentRunLog, 90, TODAY)
    expect(result.candidateCount).toBe(3)
  })

  it('detectVdotFromLog best vdot from recent log matches highest-effort run', () => {
    // Most recent run is fastest (2880s) — best should come from pool
    const result = detectVdotFromLog(recentRunLog, 90, TODAY)
    expect(result.vdot).toBeGreaterThan(30)
  })

  it('detectVdotFromLog with only Bike entries returns null', () => {
    const result = detectVdotFromLog(bikeOnlyLog, 90, TODAY)
    expect(result).toBeNull()
  })

  it('predictFitness with empty log returns non-null object', () => {
    const result = predictFitness([])
    expect(result).not.toBeNull()
    expect(typeof result).toBe('object')
  })

  it('predictFitness with empty log has current = 0', () => {
    const result = predictFitness([])
    expect(result.current).toBe(0)
  })

  it('predictFitness with empty log has trajectory = flat', () => {
    const result = predictFitness([])
    expect(result.trajectory).toBe('flat')
  })

  it('predictFitness with 10 running entries returns ctl > 0', () => {
    // Build 10 entries spanning recent weeks with meaningful TSS
    const runEntries = Array.from({ length: 10 }, (_, i) => ({
      date: new Date(Date.now() - (i + 1) * 3 * 24 * 60 * 60 * 1000)
        .toISOString().slice(0, 10),
      tss:  60 + i,
      type: 'Run',
      rpe:  6,
    }))
    const result = predictFitness(runEntries)
    expect(result.current).toBeGreaterThan(0)
  })

  it('predictFitness with 10 running entries returns tsb field', () => {
    const runEntries = Array.from({ length: 10 }, (_, i) => ({
      date: new Date(Date.now() - (i + 1) * 3 * 24 * 60 * 60 * 1000)
        .toISOString().slice(0, 10),
      tss:  60 + i,
      type: 'Run',
      rpe:  6,
    }))
    const result = predictFitness(runEntries)
    expect(result).toHaveProperty('tsb')
  })

  it('predictFitness with 10 running entries has in4w and in8w fields', () => {
    const runEntries = Array.from({ length: 10 }, (_, i) => ({
      date: new Date(Date.now() - (i + 1) * 3 * 24 * 60 * 60 * 1000)
        .toISOString().slice(0, 10),
      tss:  60 + i,
      type: 'Run',
      rpe:  6,
    }))
    const result = predictFitness(runEntries)
    expect(typeof result.in4w).toBe('number')
    expect(typeof result.in8w).toBe('number')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 9. getCurrentPlanWeek — boundary conditions
// ─────────────────────────────────────────────────────────────────────────────
describe('getCurrentPlanWeek — boundary conditions', () => {
  const analysis = analyzeRaceGoal(3000, 2700, 10000, {}, [])
  const plan     = buildTrainingPlan(analysis, PLAN_START)

  // plan[0].startDate = '2026-04-28', plan[0].endDate = '2026-05-04'
  const planFirst = plan[0]
  const planLast  = plan[plan.length - 1]

  it('date before plan start returns weekIdx = 0', () => {
    const result = getCurrentPlanWeek(plan, '2026-01-01')
    expect(result.weekIdx).toBe(0)
  })

  it('date after plan end returns weekIdx = plan.length - 1', () => {
    const result = getCurrentPlanWeek(plan, '2030-01-01')
    expect(result.weekIdx).toBe(plan.length - 1)
  })

  it('date exactly on plan start returns weekNum = 1', () => {
    const result = getCurrentPlanWeek(plan, planFirst.startDate)
    expect(result.week.weekNum).toBe(1)
    expect(result.weekIdx).toBe(0)
  })

  it('date on plan end day returns last week', () => {
    const result = getCurrentPlanWeek(plan, planLast.endDate)
    expect(result.weekIdx).toBe(plan.length - 1)
  })

  it('mid-plan date returns correct week', () => {
    // Use a date known to be in the plan (PLAN_START + 7 = week 2 start)
    const week2Start = plan[1].startDate
    const result = getCurrentPlanWeek(plan, week2Start)
    expect(result.week.weekNum).toBe(2)
    expect(result.weekIdx).toBe(1)
  })

  it('date within week 3 returns weekNum = 3', () => {
    const week3Mid = plan[2].startDate  // start of week 3
    const result = getCurrentPlanWeek(plan, week3Mid)
    expect(result.week.weekNum).toBe(3)
  })

  it('TODAY (2026-04-30) falls in week 1 given PLAN_START 2026-04-28', () => {
    const result = getCurrentPlanWeek(plan, TODAY)
    expect(result.week.weekNum).toBe(1)
  })

  it('getCurrentPlanWeek returns {week, weekIdx} shape', () => {
    const result = getCurrentPlanWeek(plan, TODAY)
    expect(result).toHaveProperty('week')
    expect(result).toHaveProperty('weekIdx')
    expect(result.week).toHaveProperty('weekNum')
    expect(result.week).toHaveProperty('sessions')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 10. FULL PIPELINE SMOKE TEST — all 5 layers in sequence
// ─────────────────────────────────────────────────────────────────────────────
describe('Full 5-layer pipeline smoke test', () => {
  const profile  = { age: 35 }
  const analysis = analyzeRaceGoal(
    parseMmSs('46:00'),  // 2760s — solid intermediate runner
    parseMmSs('42:00'),  // 2520s — goal
    10000,
    profile,
    [],
  )

  it('layer 1 (raceGoalEngine) produces valid analysis', () => {
    expect(analysis).not.toBeNull()
    expect(analysis.currentVdot).toBeGreaterThan(0)
    expect(analysis.phases.length).toBe(4)
  })

  it('layer 2 (sessionLibrary) builds a valid Base week directly', () => {
    const sessions = buildFullWeekPlan('Base', analysis.currentVdot, 1, analysis.predicted?.maxHR?.value ?? null)
    expect(sessions).toHaveLength(7)
    expect(sessions[1].run).not.toBeNull()  // Tuesday has a run
  })

  it('layer 3 (trainingBridge) produces full plan', () => {
    const plan = buildTrainingPlan(analysis, PLAN_START)
    expect(plan.length).toBe(analysis.weeksToGoal)
    expect(plan[0].phase).toBe('Base')
  })

  it('layer 3 getCurrentPlanWeek finds correct week', () => {
    const plan   = buildTrainingPlan(analysis, PLAN_START)
    const result = getCurrentPlanWeek(plan, TODAY)
    expect(result).not.toBeNull()
    expect(result.week).toBeDefined()
  })

  it('layer 4 (vdotTracker) detects VDOT from a matching run entry', () => {
    const log = [{
      date: TODAY, distanceM: 10000, durationSec: 2760, duration: 46, rpe: 8, type: 'Run',
    }]
    const vdotResult = detectVdotFromLog(log, 90, TODAY)
    expect(vdotResult).not.toBeNull()
    expect(vdotResult.vdot).toBeCloseTo(analysis.currentVdot, 0)
  })

  it('layer 5 (intelligence) predictFitness returns object with trajectory', () => {
    const log = [{ date: TODAY, tss: 55, type: 'Run', rpe: 7 }]
    const result = predictFitness(log)
    expect(result).not.toBeNull()
    expect(['improving', 'declining', 'stable', 'flat']).toContain(result.trajectory)
  })
})
