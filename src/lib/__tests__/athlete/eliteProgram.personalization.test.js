// v9.34.0 — Personalization invariant tests. Locks in the contract that
// Mission #1 produces a SPECIALIZED plan per athlete, not a generic template.
//
// Each test asserts that two athletes with different status produce DIFFERENT
// prescriptions across the dimension being tested. If any of these regress
// silently (e.g., a refactor decouples paces from VDOT), the tests fail loudly.
//
// Coverage matrix:
//   • Current status → personalized paces (VDOT/FTP/CSS-driven)
//   • Target PR → realistic vs unrealistic band feedback
//   • Body mass → absolute fueling targets scale linearly
//   • Sex → hydration / sodium / iron / RED-S differential
//   • CTL → weekly TSS curve scales
//   • Cohort → key session dosing differs (intermediate vs elite)
//   • Race-week → sport-specific protocol (no fall-through)
//   • Graceful degradation when profile data missing

import { describe, it, expect } from 'vitest'
import { buildEliteProgram } from '../../athlete/eliteProgram.js'

const TODAY = '2026-05-10'
const RACE = '2026-09-01' // ~16 weeks

function runner(timeSec, profile = {}) {
  return buildEliteProgram({
    currentPR: { distanceM: 10000, timeSec },
    targetPR:  { distanceM: 10000, timeSec: timeSec - 180 },
    raceDate: RACE,
    sport: 'run',
    options: { today: TODAY },
    profile,
  })
}

// ── 1. Current status → personalized paces ─────────────────────────────
describe('personalization — current PR drives prescribed paces (v9.34.0)', () => {
  it('two runners with different 10K times receive DIFFERENT prescribed paces', () => {
    const slow = runner(3000) // 50:00 → VDOT ~40
    const fast = runner(2280) // 38:00 → VDOT ~55
    expect(slow.currentLevel.vdot).not.toBe(fast.currentLevel.vdot)
    expect(slow.currentLevel.paces.T).not.toBeCloseTo(fast.currentLevel.paces.T, 0)
    expect(slow.currentLevel.paces.E).not.toBeCloseTo(fast.currentLevel.paces.E, 0)
    expect(slow.currentLevel.paces.I).not.toBeCloseTo(fast.currentLevel.paces.I, 0)
  })

  it('faster athlete receives faster paces (lower sec/km values)', () => {
    const slow = runner(3000)
    const fast = runner(2280)
    expect(fast.currentLevel.paces.T).toBeLessThan(slow.currentLevel.paces.T)
    expect(fast.currentLevel.paces.E).toBeLessThan(slow.currentLevel.paces.E)
  })

  it('sample-week Build Tue paceTarget MATCHES the athlete\'s computed T-pace', () => {
    const r = runner(3000)
    const buildTue = r.sampleWeeks.Build.find(d => d.day === 'Tue')
    expect(buildTue.paceTarget).toBeDefined()
    // Format: "M:SS/km"
    const [m, s] = buildTue.paceTarget.split(':').map(p => parseInt(p))
    const paceSec = m * 60 + s
    expect(paceSec).toBeCloseTo(r.currentLevel.paces.T, -1) // within 5 sec
  })
})

// ── 2. Target PR → feasibility band feedback ────────────────────────────
describe('personalization — target PR drives feasibility recommendation (v9.34.0)', () => {
  it('realistic target produces "realistic" band + positive recommendation', () => {
    const r = runner(3000) // 50→47 over 16w
    expect(r.feasibility.band).toMatch(/realistic|comfortable/)
    expect(r.recommendation.en).not.toMatch(/aggressive|extend/i)
  })

  it('unrealistic target produces band + warning recommendation', () => {
    const r = buildEliteProgram({
      currentPR: { distanceM: 10000, timeSec: 2280 }, // 38:00
      targetPR:  { distanceM: 10000, timeSec: 2100 }, // 35:00 — huge gain
      raceDate: RACE,
      sport: 'run',
      options: { today: TODAY },
    })
    expect(r.feasibility.band).toBe('unrealistic')
    expect(r.recommendation.en).toMatch(/aggressive|extend|moderate/i)
  })
})

// ── 3. Body mass → fueling absolute targets ────────────────────────────
describe('personalization — body mass scales fueling (v9.34.0)', () => {
  it('athlete with body mass receives absolute CHO targets in grams', () => {
    const r = runner(3000, { bodyMassKg: 60 })
    expect(r.fuelingProgram.Build.dailyCHO_g).toBeDefined()
    expect(r.fuelingProgram.Build.dailyCHO_g[0]).toBeGreaterThan(0)
  })

  it('CHO grams scale LINEARLY with body mass (60 vs 80 kg)', () => {
    const r60 = runner(3000, { bodyMassKg: 60 })
    const r80 = runner(3000, { bodyMassKg: 80 })
    expect(r80.fuelingProgram.Build.dailyCHO_g[0]).toBeGreaterThan(r60.fuelingProgram.Build.dailyCHO_g[0])
    // Linearity check: 80 / 60 = 1.33×
    const ratio = r80.fuelingProgram.Build.dailyCHO_g[0] / r60.fuelingProgram.Build.dailyCHO_g[0]
    expect(ratio).toBeCloseTo(80 / 60, 1)
  })

  it('graceful degradation: no body mass → CHO surfaces as g/kg only (not absolute)', () => {
    const r = runner(3000) // no profile.bodyMassKg
    expect(r.fuelingProgram.Build.chodailyPerKg).toBeDefined()
    expect(r.fuelingProgram.Build.dailyCHO_g).toBeUndefined()
    expect(r.fuelingProgram.Build.hydrationMlPerHr).toBeUndefined()
    expect(r.fuelingProgram.Build.sodiumMgPerHr).toBeUndefined()
  })
})

// ── 4. Sex → hydration / sodium / iron / RED-S differential ────────────
describe('personalization — sex drives hydration + sodium + iron + RED-S (v9.34.0)', () => {
  it('female receives lower hydration bracket than male (same body mass)', () => {
    const f = runner(3000, { bodyMassKg: 70, gender: 'female' })
    const m = runner(3000, { bodyMassKg: 70, gender: 'male' })
    expect(f.fuelingProgram.Build.hydrationMlPerHr[1]).toBeLessThan(m.fuelingProgram.Build.hydrationMlPerHr[1])
  })

  it('female receives lower sodium bracket than male', () => {
    const f = runner(3000, { bodyMassKg: 70, gender: 'female' })
    const m = runner(3000, { bodyMassKg: 70, gender: 'male' })
    expect(f.fuelingProgram.Build.sodiumMgPerHr[0]).toBeLessThan(m.fuelingProgram.Build.sodiumMgPerHr[0])
  })

  it('female surfaces iron guidance + RED-S screening; male does not', () => {
    const f = runner(3000, { bodyMassKg: 60, gender: 'female' })
    const m = runner(3000, { bodyMassKg: 70, gender: 'male' })
    expect(f.fuelingProgram.Build.ironGuidance).toBeDefined()
    expect(f.fuelingProgram.Build.redsScreening).toBeDefined()
    expect(m.fuelingProgram.Build.ironGuidance).toBeUndefined()
    expect(m.fuelingProgram.Build.redsScreening).toBeUndefined()
  })
})

// ── 5. CTL → weekly TSS curve scales ──────────────────────────────────
describe('personalization — currentCTL drives weekly TSS curve (v9.34.0)', () => {
  it('athlete with higher CTL receives higher weekly TSS targets', () => {
    const lowCtl  = runner(3000, { currentCTL: 40 })
    const highCtl = runner(3000, { currentCTL: 80 })
    const lowMax  = Math.max(...lowCtl.weeklyTSS)
    const highMax = Math.max(...highCtl.weeklyTSS)
    expect(highMax).toBeGreaterThan(lowMax)
    // Roughly 2× CTL → roughly 2× peak weekly TSS
    expect(highMax / lowMax).toBeCloseTo(2, 0)
  })

  it('weekly TSS curve has at least 4 entries (one per phase week)', () => {
    const r = runner(3000)
    expect(r.weeklyTSS.length).toBeGreaterThanOrEqual(4)
  })
})

// ── 6. Cohort → key session dosing ────────────────────────────────────
describe('personalization — cohort drives key session dosing (v9.34.0)', () => {
  it('different cohorts produce different key session structures', () => {
    const slowR = runner(3300, { bodyMassKg: 70 }) // 55:00 — beginner cohort
    const fastR = runner(2280, { bodyMassKg: 70 }) // 38:00 — elite cohort

    const findThreshold = result => result.keySessionLibrary.Build
      .find(s => s.key === 'run-build-threshold-2x20')
    const slowSess = findThreshold(slowR)
    const fastSess = findThreshold(fastR)

    expect(slowSess.cohort).not.toBe(fastSess.cohort)
    // Different cohorts → different structure prescriptions
    expect(slowSess.structure?.en).not.toBe(fastSess.structure?.en)
  })
})

// ── 7. Race-week protocol → sport-specific (no fall-through) ──────────
describe('personalization — race-week protocol is sport-specific (v9.34.0)', () => {
  it('triathlon race-week is NOT identical to run race-week (v9.30.0 fix)', () => {
    const tri = buildEliteProgram({
      currentPR: { distanceM: 51500, timeSec: 9000 }, // ~Olympic-distance tri PR
      targetPR:  { distanceM: 51500, timeSec: 8400 },
      raceDate: RACE,
      sport: 'triathlon',
      options: { today: TODAY },
    })
    const run = runner(3000)
    expect(JSON.stringify(tri.raceWeekProtocol.schedule))
      .not.toBe(JSON.stringify(run.raceWeekProtocol.schedule))
    // Tri-only fields should be present
    expect(tri.raceWeekProtocol.raceDay.transitionLayout).toBeDefined()
    expect(tri.raceWeekProtocol.raceDay.brickRefuelWindow).toBeDefined()
  })

  it('post-race recovery 48h block surfaces for every sport', () => {
    for (const sport of ['run', 'bike', 'swim', 'rowing']) {
      const r = buildEliteProgram({
        currentPR: sport === 'bike' ? { distanceM: 0, timeSec: 280 }
          : sport === 'swim' ? { distanceM: 1500, timeSec: 1500 }
          : sport === 'rowing' ? { distanceM: 2000, timeSec: 420 }
          : { distanceM: 10000, timeSec: 3000 },
        targetPR: null,
        noTarget: true,
        raceDate: RACE,
        sport,
        options: { today: TODAY },
      })
      expect(r?.raceWeekProtocol?.raceDay?.postRaceRecovery48h).toBeDefined()
    }
  })
})

// ── 8. End-to-end verifies the personalization SHAPE ─────────────────
describe('personalization — end-to-end shape verification (v9.34.0)', () => {
  it('plan output carries currentLevel + targetLevel + cohort + recommendation', () => {
    const r = runner(3000, { bodyMassKg: 60, gender: 'female', currentCTL: 50 })
    expect(r.currentLevel?.vdot).toBeDefined()
    expect(r.targetLevel?.vdot).toBeDefined()
    expect(r.cohort).toBeDefined()
    expect(r.recommendation?.en).toBeDefined()
    expect(r.recommendation?.tr).toBeDefined()
    // Phase focus is bilingual (was a brief audit confusion when raw-printed)
    for (const phase of r.phases) {
      expect(phase.focus).toHaveProperty('en')
      expect(phase.focus).toHaveProperty('tr')
    }
  })
})
