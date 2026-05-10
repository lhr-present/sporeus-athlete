import { describe, it, expect } from 'vitest'
import { buildFuelingProgram, FUELING_CITATION } from '../../athlete/eliteProgramFueling.js'

const ALL_PHASES = [
  { phase: 'Base' }, { phase: 'Build' }, { phase: 'Peak' }, { phase: 'Taper' },
]

describe('eliteProgramFueling', () => {
  it('exports citation', () => {
    expect(FUELING_CITATION).toMatch(/Burke|Jeukendrup/)
  })

  it('emits only present phases', () => {
    const fp = buildFuelingProgram({ phases: [{ phase: 'Peak' }, { phase: 'Taper' }] })
    expect(fp.Base).toBeUndefined()
    expect(fp.Build).toBeUndefined()
    expect(fp.Peak).toBeTruthy()
    expect(fp.Taper).toBeTruthy()
  })

  it('every phase has CHO/protein/fat ranges + during/pre/post', () => {
    const fp = buildFuelingProgram({ phases: ALL_PHASES })
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      const p = fp[phase]
      expect(Array.isArray(p.chodailyPerKg)).toBe(true)
      expect(p.chodailyPerKg.length).toBe(2)
      expect(p.chodailyPerKg[0]).toBeLessThanOrEqual(p.chodailyPerKg[1])
      expect(typeof p.proteindailyPerKg).toBe('number')
      expect(p.proteindailyPerKg).toBeGreaterThanOrEqual(1.4)
      expect(p.proteindailyPerKg).toBeLessThanOrEqual(2.2)
      expect(p.duringSession).toBeTruthy()
      expect(p.preSession).toBeTruthy()
      expect(p.postSession).toBeTruthy()
      expect(p.rationale.en).toBeTruthy()
      expect(p.rationale.tr).toBeTruthy()
      expect(p.notes.en).toBeTruthy()
      expect(p.notes.tr).toBeTruthy()
      expect(p.citation).toBeTruthy()
    }
  })

  it('CHO load increases from Base → Peak/Taper', () => {
    const fp = buildFuelingProgram({ phases: ALL_PHASES })
    expect(fp.Base.chodailyPerKg[1]).toBeLessThan(fp.Peak.chodailyPerKg[1])
    expect(fp.Taper.chodailyPerKg[1]).toBeGreaterThanOrEqual(fp.Peak.chodailyPerKg[1])
  })

  it('Taper carb-load reaches 10-12 g/kg/day', () => {
    const fp = buildFuelingProgram({ phases: [{ phase: 'Taper' }] })
    expect(fp.Taper.chodailyPerKg[0]).toBeGreaterThanOrEqual(8)
    expect(fp.Taper.chodailyPerKg[1]).toBeGreaterThanOrEqual(10)
  })

  it('absolute g values computed when bodyMassKg supplied', () => {
    const fp = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 70 })
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      const p = fp[phase]
      expect(p.dailyCHO_g).toBeTruthy()
      expect(p.dailyCHO_g.length).toBe(2)
      expect(p.dailyCHO_g[0]).toBe(Math.round(p.chodailyPerKg[0] * 70))
      expect(p.dailyCHO_g[1]).toBe(Math.round(p.chodailyPerKg[1] * 70))
      expect(p.dailyProtein_g).toBe(Math.round(p.proteindailyPerKg * 70))
    }
  })

  it('absolute g values omitted when no bodyMassKg', () => {
    const fp = buildFuelingProgram({ phases: ALL_PHASES })
    expect(fp.Base.dailyCHO_g).toBeUndefined()
    expect(fp.Base.dailyProtein_g).toBeUndefined()
  })

  it('during-session CHO range increases with intensity', () => {
    const fp = buildFuelingProgram({ phases: [{ phase: 'Build' }] })
    const easy = fp.Build.duringSession.easyKeyHr
    const hard = fp.Build.duringSession.hardSessionGPerHr
    expect(hard[1]).toBeGreaterThanOrEqual(easy[1])
  })

  it('handles empty phases gracefully', () => {
    expect(buildFuelingProgram({ phases: [] })).toEqual({})
  })

  it('handles invalid bodyMassKg as no-op', () => {
    const fp = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 'invalid' })
    expect(fp.Base.dailyCHO_g).toBeUndefined()
  })
})

// ── v9.25.0 — Hydration + sodium + iron + RED-S individualization ───────────
describe('buildFuelingProgram — hydration + sodium individualization (v9.25.0)', () => {
  it('hydrationMlPerHr scales with body mass and sex (male 4-8 mL/kg/h)', () => {
    const fp = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 70, gender: 'male' })
    expect(fp.Build.hydrationMlPerHr).toEqual([280, 560])
  })

  it('hydrationMlPerHr is conservative for female (3-6 mL/kg/h)', () => {
    const fp = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 60, gender: 'female' })
    expect(fp.Build.hydrationMlPerHr).toEqual([180, 360])
  })

  it('hydrationMlPerHr defaults to male range when gender unspecified', () => {
    const fp = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 70 })
    expect(fp.Build.hydrationMlPerHr).toEqual([280, 560])
  })

  it('hydrationMlPerHr omitted when bodyMassKg unknown', () => {
    const fp = buildFuelingProgram({ phases: ALL_PHASES })
    expect(fp.Build.hydrationMlPerHr).toBeUndefined()
  })

  it('sodiumMgPerHr is lower bracket for female (500-800 mg/h)', () => {
    const fp = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 60, gender: 'female' })
    expect(fp.Build.sodiumMgPerHr).toEqual([500, 800])
  })

  it('sodiumMgPerHr is upper bracket for male (700-1200 mg/h)', () => {
    const fp = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 75, gender: 'male' })
    expect(fp.Build.sodiumMgPerHr).toEqual([700, 1200])
  })

  it('sweatRateProtocol surfaces ONLY in Build phase (where rehearsal happens)', () => {
    const fp = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 70, gender: 'male' })
    expect(fp.Build.sweatRateProtocol).toBeDefined()
    expect(fp.Build.sweatRateProtocol).toHaveProperty('en')
    expect(fp.Build.sweatRateProtocol).toHaveProperty('tr')
    expect(fp.Base.sweatRateProtocol).toBeUndefined()
    expect(fp.Peak.sweatRateProtocol).toBeUndefined()
    expect(fp.Taper.sweatRateProtocol).toBeUndefined()
  })

  it('ironGuidance surfaces ONLY for female athletes in Base + Build', () => {
    const fp = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 60, gender: 'female' })
    expect(fp.Base.ironGuidance).toBeDefined()
    expect(fp.Build.ironGuidance).toBeDefined()
    expect(fp.Peak.ironGuidance).toBeUndefined()
    expect(fp.Taper.ironGuidance).toBeUndefined()
  })

  it('ironGuidance NOT surfaced for male athletes', () => {
    const fp = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 75, gender: 'male' })
    expect(fp.Base.ironGuidance).toBeUndefined()
    expect(fp.Build.ironGuidance).toBeUndefined()
  })

  it('redsScreening surfaces in EVERY phase for female athletes', () => {
    const fp = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 60, gender: 'female' })
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      expect(fp[phase].redsScreening).toBeDefined()
      expect(fp[phase].redsScreening).toHaveProperty('en')
      expect(fp[phase].redsScreening).toHaveProperty('tr')
    }
  })

  it('redsScreening NOT surfaced for male athletes', () => {
    const fp = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 75, gender: 'male' })
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      expect(fp[phase].redsScreening).toBeUndefined()
    }
  })

  it('case-insensitive gender match (FEMALE / Female / female all trigger iron+RED-S)', () => {
    for (const g of ['female', 'Female', 'FEMALE']) {
      const fp = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 60, gender: g })
      expect(fp.Build.ironGuidance).toBeDefined()
      expect(fp.Build.redsScreening).toBeDefined()
    }
  })

  // v9.39.0 — RED-S restructured as tickable checklist for readability
  it('redsChecklist is structured (preface + signs[] + action) for every phase', () => {
    const fp = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 60, gender: 'female' })
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      const c = fp[phase].redsChecklist
      expect(c).toBeDefined()
      expect(c.preface.en).toBeTruthy()
      expect(c.preface.tr).toBeTruthy()
      expect(Array.isArray(c.signs.en)).toBe(true)
      expect(Array.isArray(c.signs.tr)).toBe(true)
      expect(c.signs.en.length).toBeGreaterThanOrEqual(5)
      expect(c.signs.en.length).toBe(c.signs.tr.length)
      expect(c.action.en).toMatch(/contraindicated/i)
      expect(c.action.tr).toMatch(/yasak/i)
    }
  })

  it('redsChecklist signs cover the 5 Mountjoy 2018 CAT 2.0 markers', () => {
    const fp = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 60, gender: 'female' })
    const flat = fp.Build.redsChecklist.signs.en.join(' | ').toLowerCase()
    expect(flat).toMatch(/period/)            // menstrual dysfunction
    expect(flat).toMatch(/fatigue/)           // persistent fatigue
    expect(flat).toMatch(/stress.*injur/i)    // recurrent stress injuries
    expect(flat).toMatch(/dexa|bone/)         // low BMD
    expect(flat).toMatch(/illness|urti|gi/)   // frequent illness
  })

  it('redsChecklist NOT surfaced for male athletes', () => {
    const fp = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 75, gender: 'male' })
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      expect(fp[phase].redsChecklist).toBeUndefined()
    }
  })

  // v9.42.0 — Day-type CHO periodization (Burke 2017 fuel for the work required)
  it('dayTypeCHO present per phase with recovery/easy/key/race ranges', () => {
    const fp = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 70 })
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      const d = fp[phase].dayTypeCHO
      expect(d).toBeDefined()
      for (const dayType of ['recovery', 'easy', 'key', 'race']) {
        expect(d[dayType]).toBeDefined()
        expect(Array.isArray(d[dayType].gPerKg)).toBe(true)
        expect(d[dayType].gPerKg[0]).toBeGreaterThanOrEqual(3)
        expect(d[dayType].gPerKg[0]).toBeLessThanOrEqual(d[dayType].gPerKg[1])
      }
    }
  })

  it('dayTypeCHO scales by day type (recovery < easy < key < race)', () => {
    const fp = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 70 })
    const d = fp.Build.dayTypeCHO
    expect(d.recovery.gPerKg[1]).toBeLessThan(d.easy.gPerKg[1])
    expect(d.easy.gPerKg[1]).toBeLessThan(d.key.gPerKg[1])
    expect(d.key.gPerKg[1]).toBeLessThan(d.race.gPerKg[1])
  })

  it('dayTypeCHO emits absolute g/day when bodyMassKg known, omits when not', () => {
    const fpBW = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 70 })
    const fpNoBW = buildFuelingProgram({ phases: ALL_PHASES })
    expect(fpBW.Build.dayTypeCHO.key.gPerDay).toBeDefined()
    expect(Array.isArray(fpBW.Build.dayTypeCHO.key.gPerDay)).toBe(true)
    expect(fpNoBW.Build.dayTypeCHO.key.gPerDay).toBeUndefined()
  })

  it('dayTypeCHO scales by cohort offset (elite > beginner for same day type)', () => {
    const elite = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 70, cohort: 'elite' })
    const beginner = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 70, cohort: 'beginner' })
    expect(elite.Build.dayTypeCHO.key.gPerKg[1]).toBeGreaterThan(beginner.Build.dayTypeCHO.key.gPerKg[1])
  })

  it('dayTypeCHOLabels are bilingual', () => {
    const fp = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 70 })
    const labels = fp.Build.dayTypeCHOLabels
    expect(labels).toBeDefined()
    for (const k of ['recovery', 'easy', 'key', 'race']) {
      expect(labels[k].en).toBeTruthy()
      expect(labels[k].tr).toBeTruthy()
    }
  })

  it('hydration and sodium are ranges (low<high), not points', () => {
    const fp = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 70, gender: 'male' })
    expect(fp.Build.hydrationMlPerHr[0]).toBeLessThan(fp.Build.hydrationMlPerHr[1])
    expect(fp.Build.sodiumMgPerHr[0]).toBeLessThan(fp.Build.sodiumMgPerHr[1])
  })

  it('hydration scales linearly with body mass within sex (50kg vs 80kg male)', () => {
    const fp50 = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 50, gender: 'male' })
    const fp80 = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 80, gender: 'male' })
    expect(fp80.Build.hydrationMlPerHr[0]).toBeGreaterThan(fp50.Build.hydrationMlPerHr[0])
    expect(fp80.Build.hydrationMlPerHr[1]).toBeGreaterThan(fp50.Build.hydrationMlPerHr[1])
  })

  it('hydration is sex-differentiated (same body mass, female lower than male)', () => {
    const fpF = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 70, gender: 'female' })
    const fpM = buildFuelingProgram({ phases: ALL_PHASES, bodyMassKg: 70, gender: 'male' })
    expect(fpF.Build.hydrationMlPerHr[1]).toBeLessThan(fpM.Build.hydrationMlPerHr[1])
  })
})

