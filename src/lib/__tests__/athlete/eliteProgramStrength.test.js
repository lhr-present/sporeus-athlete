import { describe, it, expect } from 'vitest'
import { buildStrengthProgram, STRENGTH_CITATION } from '../../athlete/eliteProgramStrength.js'

const ALL_PHASES = [
  { phase: 'Base' }, { phase: 'Build' }, { phase: 'Peak' }, { phase: 'Taper' },
]

describe('eliteProgramStrength', () => {
  it('exports a citation', () => {
    expect(STRENGTH_CITATION).toMatch(/Rønnestad|Beattie/)
  })

  it('emits prescriptions only for present phases', () => {
    const sp = buildStrengthProgram({ phases: [{ phase: 'Base' }, { phase: 'Build' }] })
    expect(sp.Base).toBeTruthy()
    expect(sp.Build).toBeTruthy()
    expect(sp.Peak).toBeUndefined()
    expect(sp.Taper).toBeUndefined()
  })

  it('every phase prescription has emphasis/frequency/movements/citation', () => {
    const sp = buildStrengthProgram({ phases: ALL_PHASES })
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      const p = sp[phase]
      expect(p.emphasis.en).toBeTruthy()
      expect(p.emphasis.tr).toBeTruthy()
      expect(p.frequencyPerWeek).toBeGreaterThan(0)
      expect(p.frequencyPerWeek).toBeLessThanOrEqual(3)
      expect(p.sessionDurationMin).toBeGreaterThanOrEqual(15)
      expect(Array.isArray(p.movements)).toBe(true)
      expect(p.movements.length).toBeGreaterThan(0)
      expect(p.citation).toBeTruthy()
    }
  })

  it('every movement has bilingual name + sets/reps/intensity', () => {
    const sp = buildStrengthProgram({ phases: ALL_PHASES })
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      for (const m of sp[phase].movements) {
        expect(m.name.en).toBeTruthy()
        expect(m.name.tr).toBeTruthy()
        expect(typeof m.sets).toBe('number')
        expect(m.reps).toBeTruthy()
        expect(m.intensity.en).toBeTruthy()
        expect(m.intensity.tr).toBeTruthy()
      }
    }
  })

  it('Base emphasises max strength (low rep, high load)', () => {
    const sp = buildStrengthProgram({ phases: [{ phase: 'Base' }] })
    expect(sp.Base.emphasis.en.toLowerCase()).toMatch(/max|heavy/)
  })

  it('Build emphasises power conversion / explosive', () => {
    const sp = buildStrengthProgram({ phases: [{ phase: 'Build' }] })
    expect(sp.Build.emphasis.en.toLowerCase()).toMatch(/power|explosive|conversion/)
  })

  it('Peak frequency drops to 1/week (maintenance)', () => {
    const sp = buildStrengthProgram({ phases: [{ phase: 'Peak' }] })
    expect(sp.Peak.frequencyPerWeek).toBe(1)
  })

  it('Taper has lowest volume + neural priming framing', () => {
    const sp = buildStrengthProgram({ phases: [{ phase: 'Taper' }] })
    expect(sp.Taper.sessionDurationMin).toBeLessThanOrEqual(30)
    expect(sp.Taper.emphasis.en.toLowerCase()).toMatch(/neural|priming/)
  })

  it('every phase carries a warning string in both languages', () => {
    const sp = buildStrengthProgram({ phases: ALL_PHASES })
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      expect(sp[phase].warning.en).toBeTruthy()
      expect(sp[phase].warning.tr).toBeTruthy()
    }
  })

  it('handles empty phases gracefully', () => {
    const sp = buildStrengthProgram({ phases: [] })
    expect(Object.keys(sp).length).toBe(0)
  })

  it('handles missing input gracefully', () => {
    const sp = buildStrengthProgram({})
    expect(Object.keys(sp).length).toBe(0)
  })
})

// v9.164.0 (EP-5) — cohort overrides
describe('buildStrengthProgram — cohort overrides', () => {
  it('beginner: reduces Base frequency to 1×/wk (was 2×)', () => {
    const sp = buildStrengthProgram({ phases: ALL_PHASES, sport: 'run', cohort: 'beginner' })
    expect(sp.Base.frequencyPerWeek).toBe(1)
  })

  it('elite: increases Base frequency to 3×/wk (was 2×)', () => {
    const sp = buildStrengthProgram({ phases: ALL_PHASES, sport: 'run', cohort: 'elite' })
    expect(sp.Base.frequencyPerWeek).toBe(3)
  })

  it('intermediate: leaves the template at 2×/wk', () => {
    const sp = buildStrengthProgram({ phases: ALL_PHASES, sport: 'run', cohort: 'intermediate' })
    expect(sp.Base.frequencyPerWeek).toBe(2)
  })

  it('beginner Base session duration is shorter than intermediate', () => {
    const beg = buildStrengthProgram({ phases: ALL_PHASES, sport: 'run', cohort: 'beginner' })
    const int = buildStrengthProgram({ phases: ALL_PHASES, sport: 'run', cohort: 'intermediate' })
    expect(beg.Base.sessionDurationMin).toBeLessThan(int.Base.sessionDurationMin)
  })

  it('elite Base session duration is longer than intermediate', () => {
    const eli = buildStrengthProgram({ phases: ALL_PHASES, sport: 'run', cohort: 'elite' })
    const int = buildStrengthProgram({ phases: ALL_PHASES, sport: 'run', cohort: 'intermediate' })
    expect(eli.Base.sessionDurationMin).toBeGreaterThan(int.Base.sessionDurationMin)
  })

  it('cohortNote bilingual EN+TR present for every cohort', () => {
    for (const cohort of ['beginner', 'intermediate', 'elite']) {
      const sp = buildStrengthProgram({ phases: ALL_PHASES, sport: 'run', cohort })
      expect(sp.Base.cohortNote.en).toBeTruthy()
      expect(sp.Base.cohortNote.tr).toBeTruthy()
      expect(sp.Base.cohort).toBe(cohort)
    }
  })

  it('null cohort → output matches the untouched template (no cohort field)', () => {
    const noC = buildStrengthProgram({ phases: ALL_PHASES, sport: 'run', cohort: null })
    const def = buildStrengthProgram({ phases: ALL_PHASES, sport: 'run' })
    expect(noC.Base.frequencyPerWeek).toBe(def.Base.frequencyPerWeek)
    expect(noC.Base.sessionDurationMin).toBe(def.Base.sessionDurationMin)
    expect(noC.Base.cohort).toBeUndefined()
  })

  it('frequency is clamped to [1, 4]', () => {
    const sp = buildStrengthProgram({ phases: ALL_PHASES, sport: 'run', cohort: 'elite' })
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      expect(sp[phase].frequencyPerWeek).toBeGreaterThanOrEqual(1)
      expect(sp[phase].frequencyPerWeek).toBeLessThanOrEqual(4)
    }
  })

  it('intermediate cohort with all sports yields stable defaults', () => {
    for (const sport of ['run', 'bike', 'swim', 'rowing', 'triathlon']) {
      const sp = buildStrengthProgram({ phases: ALL_PHASES, sport, cohort: 'intermediate' })
      expect(sp.Base.frequencyPerWeek).toBe(2)
    }
  })
})
