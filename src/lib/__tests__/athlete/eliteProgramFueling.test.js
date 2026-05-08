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
