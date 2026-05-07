// src/lib/__tests__/athlete/eliteProgramToYearly.test.js
import { describe, it, expect } from 'vitest'
import { buildEliteProgram } from '../../athlete/eliteProgram.js'
import { eliteProgramToYearlyWeeks } from '../../athlete/eliteProgramToYearly.js'

const TODAY = '2026-05-04'   // Monday

// ── canonical 16-week run fixture ──────────────────────────────────────────
const RUN_16W = {
  currentPR: { distanceM: 10000, timeSec: 3000 },  // 50:00
  targetPR:  { distanceM: 10000, timeSec: 2820 },  // 47:00
  raceDate:  '2026-08-25',                          // ~16w out
  sport:     'run',
  options:   { today: TODAY },
}

function build(extra = {}) {
  const program = buildEliteProgram({ ...RUN_16W, ...extra })
  return program
}

describe('eliteProgramToYearlyWeeks — input validation', () => {
  it('returns null for null program', () => {
    expect(eliteProgramToYearlyWeeks(null, TODAY)).toBeNull()
  })

  it('returns null for non-object program', () => {
    expect(eliteProgramToYearlyWeeks('string', TODAY)).toBeNull()
    expect(eliteProgramToYearlyWeeks(42, TODAY)).toBeNull()
  })

  it('returns null when phases or weeklyTSS missing', () => {
    expect(eliteProgramToYearlyWeeks({}, TODAY)).toBeNull()
    expect(eliteProgramToYearlyWeeks({ phases: [] }, TODAY)).toBeNull()
    expect(eliteProgramToYearlyWeeks({ weeklyTSS: [] }, TODAY)).toBeNull()
  })

  it('returns null for invalid programStart', () => {
    const program = build()
    expect(eliteProgramToYearlyWeeks(program, 'garbage')).toBeNull()
    expect(eliteProgramToYearlyWeeks(program, '2026-13-40')).toBeNull()
    expect(eliteProgramToYearlyWeeks(program, null)).toBeNull()
  })

  it('returns null for rejected program', () => {
    const rejected = { _rejected: true, reason: 'x' }
    expect(eliteProgramToYearlyWeeks(rejected, TODAY)).toBeNull()
  })
})

describe('eliteProgramToYearlyWeeks — week generation', () => {
  it('generates a 52-entry weeks array (padded with Recovery filler)', () => {
    const program = build()
    const out = eliteProgramToYearlyWeeks(program, TODAY, { raceDate: '2026-08-25' })
    expect(out).not.toBeNull()
    expect(out.weeks).toHaveLength(52)
  })

  it('first weeks reflect program phase progression (Base/Build/Peak/Taper)', () => {
    const program = build()
    const out = eliteProgramToYearlyWeeks(program, TODAY)
    const phasesUsed = new Set(out.weeks
      .slice(0, program.weeklyTSS.length)
      .map(w => w.phase))
    // Standard 16w split should include at least Build and Taper.
    expect(phasesUsed.has('Build')).toBe(true)
    expect(phasesUsed.has('Taper')).toBe(true)
  })

  it('weekStart sequence is 7 days apart (Monday-aligned UTC)', () => {
    const program = build()
    const out = eliteProgramToYearlyWeeks(program, TODAY)
    expect(out.weeks[0].weekStart).toBe('2026-05-04')
    for (let i = 1; i < out.weeks.length; i++) {
      const prev = new Date(out.weeks[i - 1].weekStart)
      const curr = new Date(out.weeks[i].weekStart)
      const diff = (curr - prev) / 86400000
      expect(diff).toBe(7)
    }
  })

  it('snaps non-Monday programStart backward to nearest Monday', () => {
    const program = build()
    // 2026-05-06 is a Wednesday; Monday of that ISO week is 2026-05-04
    const out = eliteProgramToYearlyWeeks(program, '2026-05-06')
    expect(out.weeks[0].weekStart).toBe('2026-05-04')
  })

  it('tssTarget is propagated from program.weeklyTSS', () => {
    const program = build()
    const out = eliteProgramToYearlyWeeks(program, TODAY)
    for (let i = 0; i < program.weeklyTSS.length; i++) {
      expect(out.weeks[i].targetTSS).toBe(Math.round(program.weeklyTSS[i]))
    }
  })

  it('phase strings are capitalized (match YearlyPlan expectations)', () => {
    const program = build()
    const out = eliteProgramToYearlyWeeks(program, TODAY)
    const ALLOWED = new Set(['Base', 'Build', 'Peak', 'Taper', 'Race', 'Recovery', 'Transition'])
    for (const w of out.weeks) {
      expect(ALLOWED.has(w.phase)).toBe(true)
    }
  })

  it('flags deload weeks where TSS dips well below neighbours', () => {
    const program = build()
    const out = eliteProgramToYearlyWeeks(program, TODAY)
    // The 16w fixture has 3:1 deloads at weeks ending in idx % 4 === 3
    const deloads = out.weeks
      .slice(0, program.weeklyTSS.length)
      .filter(w => w.isDeload)
    expect(deloads.length).toBeGreaterThan(0)
  })

  it('zoneDistribution sums to ~1.0 for each non-padded week', () => {
    const program = build()
    const out = eliteProgramToYearlyWeeks(program, TODAY)
    const w0 = out.weeks[0]
    const sum = (w0.zoneDistribution.Z1 || 0) + (w0.zoneDistribution.Z2 || 0)
              + (w0.zoneDistribution.Z3 || 0) + (w0.zoneDistribution.Z4 || 0)
              + (w0.zoneDistribution.Z5 || 0)
    expect(sum).toBeGreaterThan(0.95)
    expect(sum).toBeLessThan(1.05)
  })

  it('plannedHours is derived from targetTSS (~tss/60)', () => {
    const program = build()
    const out = eliteProgramToYearlyWeeks(program, TODAY)
    const w = out.weeks[0]
    expect(w.plannedHours).toBeCloseTo(w.targetTSS / 60, 1)
  })

  it('attaches sessionsBlueprint for in-program weeks', () => {
    const program = build()
    const out = eliteProgramToYearlyWeeks(program, TODAY)
    const inProgram = out.weeks.slice(0, program.weeklyTSS.length)
    // At least one program week should have a non-empty blueprint.
    const withBlueprint = inProgram.filter(w => Array.isArray(w.sessionsBlueprint) && w.sessionsBlueprint.length > 0)
    expect(withBlueprint.length).toBeGreaterThan(0)
    // Blueprint days are bilingual (intent has en + tr keys).
    const day = withBlueprint[0].sessionsBlueprint[0]
    expect(day.intent).toBeDefined()
    expect(typeof day.intent.en).toBe('string')
    expect(typeof day.intent.tr).toBe('string')
  })
})

describe('eliteProgramToYearlyWeeks — race week + races[]', () => {
  it('appends a Race week when raceDate is supplied', () => {
    const program = build()
    const out = eliteProgramToYearlyWeeks(program, TODAY, {
      raceDate: '2026-08-25',
      raceName: 'Goal Race',
    })
    const raceWeek = out.weeks.find(w => w.phase === 'Race')
    expect(raceWeek).toBeDefined()
    expect(raceWeek.raceName).toBe('Goal Race')
    expect(raceWeek.raceDate).toBe('2026-08-25')
    expect(raceWeek.priority).toBe('A')
  })

  it('populates races[] with priority A', () => {
    const program = build()
    const out = eliteProgramToYearlyWeeks(program, TODAY, {
      raceDate: '2026-08-25',
      raceName: 'Goal Race',
    })
    expect(out.races).toHaveLength(1)
    expect(out.races[0]).toMatchObject({
      date: '2026-08-25',
      name: 'Goal Race',
      priority: 'A',
    })
  })

  it('omits race week + empty races[] when no raceDate provided', () => {
    const program = build()
    const out = eliteProgramToYearlyWeeks(program, TODAY)
    expect(out.races).toEqual([])
    // No 'Race' phase week in result.
    const racePhase = out.weeks.find(w => w.phase === 'Race')
    expect(racePhase).toBeUndefined()
  })

  it('startDate echoes the snapped Monday', () => {
    const program = build()
    const out = eliteProgramToYearlyWeeks(program, '2026-05-07')   // Thursday
    expect(out.startDate).toBe('2026-05-04')
  })

  it('preserves model tag from opts (default traditional)', () => {
    const program = build()
    const polarized = eliteProgramToYearlyWeeks(program, TODAY, { model: 'polarized' })
    expect(polarized.model).toBe('polarized')
    const dflt = eliteProgramToYearlyWeeks(program, TODAY)
    expect(dflt.model).toBe('traditional')
  })

  it('padding fills remainder with Recovery phase', () => {
    const program = build()
    const out = eliteProgramToYearlyWeeks(program, TODAY, { raceDate: '2026-08-25' })
    const programLen = program.weeklyTSS.length + 1   // +1 for race week
    const padded = out.weeks.slice(programLen)
    expect(padded.every(w => w.phase === 'Recovery')).toBe(true)
  })
})

// ─── v8.96.0 — synthetic-anchor passthrough ──────────────────────────────────
describe('eliteProgramToYearlyWeeks — v8.96.0 synthetic raceDate passthrough', () => {
  function buildSynthetic(extra = {}) {
    return buildEliteProgram({
      currentPR: { distanceM: 10000, timeSec: 3000 },
      sport: 'run',
      noTarget: true,
      weeksOverride: 16,
      options: { today: TODAY },
      ...extra,
    })
  }

  it('uses program.feasibility.effectiveRaceDate when no opts.raceDate supplied', () => {
    const program = buildSynthetic()
    expect(program.synthetic?.raceDate).toBe(true)
    expect(typeof program.feasibility.effectiveRaceDate).toBe('string')
    const out = eliteProgramToYearlyWeeks(program, TODAY)
    expect(out).not.toBeNull()
    expect(out.raceDate).toBe(program.feasibility.effectiveRaceDate)
    expect(out.races).toHaveLength(1)
  })

  it('synthetic race week uses priority C and "Final Week" name', () => {
    const program = buildSynthetic()
    const out = eliteProgramToYearlyWeeks(program, TODAY)
    const raceWeek = out.weeks.find(w => w.phase === 'Race')
    expect(raceWeek).toBeTruthy()
    expect(raceWeek.priority).toBe('C')
    expect(raceWeek.raceName).toBe('Final Week')
    expect(out.races[0].priority).toBe('C')
    expect(out.races[0].name).toBe('Final Week')
  })

  it('opts.raceDate overrides effectiveRaceDate when both present, but priority stays C for synthetic', () => {
    const program = buildSynthetic()
    const out = eliteProgramToYearlyWeeks(program, TODAY, {
      raceDate: '2026-09-15',
      raceName: 'Tune-up',
    })
    expect(out.raceDate).toBe('2026-09-15')
    expect(out.races[0].priority).toBe('C')
    expect(out.races[0].name).toBe('Tune-up')
  })

  it('non-synthetic program preserves priority A behavior', () => {
    const program = buildEliteProgram({
      currentPR: { distanceM: 10000, timeSec: 3000 },
      targetPR:  { distanceM: 10000, timeSec: 2820 },
      raceDate:  '2026-08-25',
      sport: 'run',
      options: { today: TODAY },
    })
    expect(program.synthetic).toBeUndefined()
    const out = eliteProgramToYearlyWeeks(program, TODAY, { raceDate: '2026-08-25', raceName: 'Goal Race' })
    expect(out.races[0].priority).toBe('A')
  })
})
