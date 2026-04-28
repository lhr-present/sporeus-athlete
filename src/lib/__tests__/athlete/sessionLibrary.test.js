// src/lib/__tests__/athlete/sessionLibrary.test.js — E90
import { describe, it, expect } from 'vitest'
import {
  DRILL_CIRCUITS,
  PREVENTIVE_ROUTINES,
  STRENGTH_WORKOUTS,
  buildFullWeekPlan,
} from '../../athlete/sessionLibrary.js'

// ─── DRILL_CIRCUITS ───────────────────────────────────────────────────────────
describe('DRILL_CIRCUITS', () => {
  it('has 3 circuits', () => expect(DRILL_CIRCUITS).toHaveLength(3))

  it('levels are beginner, intermediate, advanced in order', () => {
    expect(DRILL_CIRCUITS[0].level).toBe('beginner')
    expect(DRILL_CIRCUITS[1].level).toBe('intermediate')
    expect(DRILL_CIRCUITS[2].level).toBe('advanced')
  })

  it('each circuit has name, tr, durationMin, exercises', () => {
    for (const c of DRILL_CIRCUITS) {
      expect(typeof c.name).toBe('string')
      expect(typeof c.tr).toBe('string')
      expect(c.durationMin).toBeGreaterThan(0)
      expect(Array.isArray(c.exercises)).toBe(true)
      expect(c.exercises.length).toBeGreaterThan(0)
    }
  })

  it('every exercise has name, tr, cue, cueTr', () => {
    for (const c of DRILL_CIRCUITS) {
      for (const ex of c.exercises) {
        expect(typeof ex.name).toBe('string')
        expect(typeof ex.tr).toBe('string')
        expect(typeof ex.cue).toBe('string')
        expect(typeof ex.cueTr).toBe('string')
      }
    }
  })

  it('advanced circuit has more duration than beginner', () => {
    expect(DRILL_CIRCUITS[2].durationMin).toBeGreaterThanOrEqual(DRILL_CIRCUITS[0].durationMin)
  })
})

// ─── PREVENTIVE_ROUTINES ──────────────────────────────────────────────────────
describe('PREVENTIVE_ROUTINES', () => {
  it('has hip_glute, calf_achilles, full_mobility keys', () => {
    expect(PREVENTIVE_ROUTINES).toHaveProperty('hip_glute')
    expect(PREVENTIVE_ROUTINES).toHaveProperty('calf_achilles')
    expect(PREVENTIVE_ROUTINES).toHaveProperty('full_mobility')
  })

  it('each routine has name, tr, durationMin, exercises', () => {
    for (const r of Object.values(PREVENTIVE_ROUTINES)) {
      expect(typeof r.name).toBe('string')
      expect(typeof r.tr).toBe('string')
      expect(r.durationMin).toBeGreaterThan(0)
      expect(Array.isArray(r.exercises)).toBe(true)
      expect(r.exercises.length).toBeGreaterThan(0)
    }
  })

  it('every exercise has sets and reps', () => {
    for (const r of Object.values(PREVENTIVE_ROUTINES)) {
      for (const ex of r.exercises) {
        expect(typeof ex.name).toBe('string')
        expect(typeof ex.tr).toBe('string')
        expect(ex.sets).toBeGreaterThan(0)
        expect(typeof ex.reps).toBe('string')
      }
    }
  })

  it('eccentric calf raise is in calf_achilles routine', () => {
    const names = PREVENTIVE_ROUTINES.calf_achilles.exercises.map(e => e.name.toLowerCase())
    expect(names.some(n => n.includes('eccentric') && n.includes('calf'))).toBe(true)
  })
})

// ─── STRENGTH_WORKOUTS ────────────────────────────────────────────────────────
describe('STRENGTH_WORKOUTS', () => {
  const expectedKeys = ['foundation_lower', 'foundation_core', 'progressive_lower', 'progressive_power', 'maintenance_a', 'maintenance_b']

  it('has all 6 workout templates', () => {
    for (const k of expectedKeys) {
      expect(STRENGTH_WORKOUTS).toHaveProperty(k)
    }
  })

  it('each workout has name, tr, durationMin, category, exercises', () => {
    for (const w of Object.values(STRENGTH_WORKOUTS)) {
      expect(typeof w.name).toBe('string')
      expect(typeof w.tr).toBe('string')
      expect(w.durationMin).toBeGreaterThan(0)
      expect(['foundation', 'progressive', 'maintenance']).toContain(w.category)
      expect(Array.isArray(w.exercises)).toBe(true)
      expect(w.exercises.length).toBeGreaterThan(0)
    }
  })

  it('every exercise has name, tr, sets, reps', () => {
    for (const w of Object.values(STRENGTH_WORKOUTS)) {
      for (const ex of w.exercises) {
        expect(typeof ex.name).toBe('string')
        expect(typeof ex.tr).toBe('string')
        expect(ex.sets).toBeGreaterThan(0)
        expect(typeof ex.reps).toBe('string')
      }
    }
  })

  it('Nordic hamstring curl is in progressive_lower', () => {
    const names = STRENGTH_WORKOUTS.progressive_lower.exercises.map(e => e.name.toLowerCase())
    expect(names.some(n => n.includes('nordic'))).toBe(true)
  })

  it('maintenance workouts are shorter than progressive', () => {
    expect(STRENGTH_WORKOUTS.maintenance_a.durationMin).toBeLessThan(STRENGTH_WORKOUTS.progressive_lower.durationMin)
    expect(STRENGTH_WORKOUTS.maintenance_b.durationMin).toBeLessThan(STRENGTH_WORKOUTS.progressive_power.durationMin)
  })
})

// ─── buildFullWeekPlan ────────────────────────────────────────────────────────
describe('buildFullWeekPlan — structure', () => {
  const VDOT = 33  // 50:00/10km athlete

  it('returns 7 days for every phase', () => {
    for (const phase of ['Base', 'Build', 'Peak', 'Taper', 'Deload']) {
      expect(buildFullWeekPlan(phase, VDOT)).toHaveLength(7)
    }
  })

  it('each day has required backward-compat fields', () => {
    const plan = buildFullWeekPlan('Base', VDOT)
    for (const d of plan) {
      expect(typeof d.day).toBe('string')
      expect(typeof d.dayTr).toBe('string')
      expect(typeof d.type).toBe('string')
      expect(typeof d.tr).toBe('string')
      expect(typeof d.zone).toBe('number')
    }
  })

  it('each day has totalDurationMin >= 0', () => {
    const plan = buildFullWeekPlan('Build', VDOT)
    for (const d of plan) {
      expect(d.totalDurationMin).toBeGreaterThanOrEqual(0)
    }
  })

  it('unknown phase falls back to Base template (7 days)', () => {
    expect(buildFullWeekPlan('Unknown', VDOT)).toHaveLength(7)
  })
})

describe('buildFullWeekPlan — Base phase (VDOT 33)', () => {
  const plan = buildFullWeekPlan('Base', 33)

  it('Tuesday has a running session', () => {
    const tue = plan[1]
    expect(tue.run).not.toBeNull()
    expect(tue.run.durationMin).toBeGreaterThan(0)
  })

  it('Tuesday has beginner drills (pre-run warmup)', () => {
    const tue = plan[1]
    expect(tue.drills).not.toBeNull()
    expect(tue.drills.level).toBe('beginner')
  })

  it('Wednesday has strength session, no run', () => {
    const wed = plan[2]
    expect(wed.strength).not.toBeNull()
    expect(wed.run).toBeNull()
  })

  it('Thursday has a run, no strength', () => {
    const thu = plan[3]
    expect(thu.run).not.toBeNull()
    expect(thu.strength).toBeNull()
  })

  it('Friday has strength + preventive, no run', () => {
    const fri = plan[4]
    expect(fri.strength).not.toBeNull()
    expect(fri.preventive).not.toBeNull()
    expect(fri.run).toBeNull()
  })

  it('Saturday has the long run', () => {
    const sat = plan[5]
    expect(sat.run).not.toBeNull()
    expect(sat.run.durationMin).toBeGreaterThanOrEqual(60)
  })

  it('Sunday has a preventive routine, no run', () => {
    const sun = plan[6]
    expect(sun.preventive).not.toBeNull()
    expect(sun.run).toBeNull()
  })

  it('Monday has hip_glute preventive, no run or strength', () => {
    const mon = plan[0]
    expect(mon.run).toBeNull()
    expect(mon.strength).toBeNull()
    expect(mon.preventive?.focus).toBe('hip_glute')
  })
})

describe('buildFullWeekPlan — paces injected from VDOT', () => {
  it('run sessions have paceStr when vdot is valid', () => {
    const plan = buildFullWeekPlan('Base', 33)
    const tue = plan[1]
    expect(tue.run?.paceStr).toBeTruthy()
    expect(tue.run?.paceStr).toMatch(/^\d+:\d{2}\/km$/)
  })

  it('structure text has no unreplaced {E} placeholders when vdot is valid', () => {
    const plan = buildFullWeekPlan('Build', 33)
    for (const d of plan) {
      if (d.run?.structure) {
        expect(d.run.structure).not.toContain('{E}')
        expect(d.run.structure).not.toContain('{T}')
        expect(d.run.structure).not.toContain('{I}')
      }
    }
  })

  it('paceStr is null for rest/non-run days', () => {
    const plan = buildFullWeekPlan('Base', 33)
    const mon = plan[0]  // Mon = rest in Base
    expect(mon.paceStr).toBeNull()
    expect(mon.run).toBeNull()
  })

  it('handles null vdot gracefully (no paces)', () => {
    const plan = buildFullWeekPlan('Base', null)
    expect(plan).toHaveLength(7)
    // Run sessions exist but paceStr is null
    const tue = plan[1]
    expect(tue.run?.paceStr).toBeFalsy()
  })
})

describe('buildFullWeekPlan — HR ranges', () => {
  it('run hrLow/hrHigh are null when maxHR not provided', () => {
    const plan = buildFullWeekPlan('Build', 33)
    const tue = plan[1]  // tempo session
    expect(tue.run?.hrLow).toBeNull()
    expect(tue.run?.hrHigh).toBeNull()
  })

  it('run hrLow/hrHigh computed when maxHR provided', () => {
    const plan = buildFullWeekPlan('Build', 33, 1, 190)
    const tue = plan[1]  // tempo: 88–92% maxHR
    expect(tue.run?.hrLow).toBe(Math.round(190 * 0.88))
    expect(tue.run?.hrHigh).toBe(Math.round(190 * 0.92))
  })
})

describe('buildFullWeekPlan — Build phase quality sessions', () => {
  const plan = buildFullWeekPlan('Build', 33)

  it('Tuesday has threshold tempo session', () => {
    const tue = plan[1]
    expect(tue.run?.type).toContain('Threshold')
    expect(tue.run?.zone).toBe(4)
  })

  it('Tuesday has intermediate drills', () => {
    expect(plan[1].drills?.level).toBe('intermediate')
  })

  it('Wednesday has progressive lower strength', () => {
    expect(plan[2].strength?.category).toBe('progressive')
  })

  it('Saturday is the long run (progression)', () => {
    const sat = plan[5]
    expect(sat.run?.durationMin).toBeGreaterThanOrEqual(75)
  })
})

describe('buildFullWeekPlan — Peak phase', () => {
  const plan = buildFullWeekPlan('Peak', 33)

  it('Tuesday has VO2max intervals', () => {
    const tue = plan[1]
    expect(tue.run?.zone).toBe(5)
    expect(tue.run?.type).toContain('Interval')
  })

  it('Tuesday has advanced drills', () => {
    expect(plan[1].drills?.level).toBe('advanced')
  })

  it('Monday has maintenance strength', () => {
    expect(plan[0].strength?.category).toBe('maintenance')
  })

  it('Saturday has race simulation', () => {
    expect(plan[5].run?.type).toContain('Race Simulation')
  })
})

describe('buildFullWeekPlan — Taper phase', () => {
  const plan = buildFullWeekPlan('Taper', 33)

  it('has lower total running TSS than Build', () => {
    const buildPlan = buildFullWeekPlan('Build', 33)
    const taperTss = plan.reduce((s, d) => s + (d.run?.tss ?? 0), 0)
    const buildTss = buildPlan.reduce((s, d) => s + (d.run?.tss ?? 0), 0)
    expect(taperTss).toBeLessThan(buildTss)
  })

  it('Sunday is race day', () => {
    const sun = plan[6]
    expect(sun.run?.type).toBe('RACE DAY')
  })

  it('no strength sessions in taper week', () => {
    for (const d of plan) {
      expect(d.strength).toBeNull()
    }
  })
})

describe('buildFullWeekPlan — Deload phase', () => {
  const plan = buildFullWeekPlan('Deload', 33)

  it('has no drills in deload week', () => {
    for (const d of plan) {
      expect(d.drills).toBeNull()
    }
  })

  it('run sessions are easy only (zone ≤ 2)', () => {
    for (const d of plan) {
      if (d.run) {
        expect(d.run.zone).toBeLessThanOrEqual(2)
      }
    }
  })

  it('total running duration is less than Base', () => {
    const basePlan = buildFullWeekPlan('Base', 33)
    const deloadMin = plan.reduce((s, d) => s + (d.run?.durationMin ?? 0), 0)
    const baseMin   = basePlan.reduce((s, d) => s + (d.run?.durationMin ?? 0), 0)
    expect(deloadMin).toBeLessThan(baseMin)
  })
})

describe('buildFullWeekPlan — totalDurationMin', () => {
  it('is sum of all modality durations', () => {
    const plan = buildFullWeekPlan('Build', 33)
    for (const d of plan) {
      const expected =
        (d.run?.durationMin ?? 0) +
        (d.drills?.durationMin ?? 0) +
        (d.strength?.durationMin ?? 0) +
        (d.preventive?.durationMin ?? 0)
      expect(d.totalDurationMin).toBe(expected)
    }
  })
})
