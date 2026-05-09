import { describe, it, expect } from 'vitest'
import { buildRecoveryProgram, RECOVERY_CITATION } from '../../athlete/eliteProgramRecovery.js'

const ALL_PHASES = [
  { phase: 'Base' }, { phase: 'Build' }, { phase: 'Peak' }, { phase: 'Taper' },
]

describe('eliteProgramRecovery', () => {
  it('exports citation', () => {
    expect(RECOVERY_CITATION).toMatch(/Halson|Plews|Kellmann/)
  })

  it('emits only present phases', () => {
    const rp = buildRecoveryProgram({ phases: [{ phase: 'Peak' }] })
    expect(rp.Base).toBeUndefined()
    expect(rp.Peak).toBeTruthy()
  })

  it('every phase has sleep/HRV/deload/modalities/warningSigns/citation', () => {
    const rp = buildRecoveryProgram({ phases: ALL_PHASES })
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      const p = rp[phase]
      expect(Array.isArray(p.sleepHoursTarget)).toBe(true)
      expect(p.sleepHoursTarget[0]).toBeLessThanOrEqual(p.sleepHoursTarget[1])
      expect(typeof p.easyDayPaceCapPctOfHRmax).toBe('number')
      expect(typeof p.hrvDropTriggerPct).toBe('number')
      expect(typeof p.deloadEvery).toBe('number')
      expect(Array.isArray(p.modalities)).toBe(true)
      expect(p.modalities.length).toBeGreaterThan(0)
      expect(Array.isArray(p.warningSigns)).toBe(true)
      expect(p.warningSigns.length).toBeGreaterThan(0)
      expect(p.citation).toBeTruthy()
    }
  })

  it('every modality + warning has bilingual EN+TR', () => {
    const rp = buildRecoveryProgram({ phases: ALL_PHASES })
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      for (const m of rp[phase].modalities) {
        expect(m.en).toBeTruthy()
        expect(m.tr).toBeTruthy()
      }
      for (const w of rp[phase].warningSigns) {
        expect(w.en).toBeTruthy()
        expect(w.tr).toBeTruthy()
      }
    }
  })

  it('sleep target trends up from Base to Taper', () => {
    const rp = buildRecoveryProgram({ phases: ALL_PHASES })
    expect(rp.Taper.sleepHoursTarget[0]).toBeGreaterThanOrEqual(rp.Base.sleepHoursTarget[0])
  })

  it('HRV trigger tightens in Build/Peak vs Base', () => {
    const rp = buildRecoveryProgram({ phases: ALL_PHASES })
    expect(rp.Build.hrvDropTriggerPct).toBeLessThanOrEqual(rp.Base.hrvDropTriggerPct)
    expect(rp.Peak.hrvDropTriggerPct).toBeLessThanOrEqual(rp.Base.hrvDropTriggerPct)
  })

  it('Taper deloadEvery is 0 (race week is the de facto deload)', () => {
    const rp = buildRecoveryProgram({ phases: [{ phase: 'Taper' }] })
    expect(rp.Taper.deloadEvery).toBe(0)
  })

  it('Peak deload cadence accelerates vs Base/Build', () => {
    const rp = buildRecoveryProgram({ phases: ALL_PHASES })
    expect(rp.Peak.deloadEvery).toBeLessThanOrEqual(rp.Base.deloadEvery)
  })

  it('handles empty/missing input gracefully', () => {
    expect(buildRecoveryProgram({ phases: [] })).toEqual({})
    expect(buildRecoveryProgram({})).toEqual({})
  })
})

// ── v9.36.0 — Cold-water immersion schedule-aware warning ──────────────
describe('Cold-water immersion — schedule-aware Roberts 2015 warning (v9.36.0)', () => {
  it('Build modalities include cold-water immersion with Wed/Sat/Sun day guidance', () => {
    const rp = buildRecoveryProgram({ phases: ALL_PHASES })
    const cwiText = rp.Build.modalities.find(m => m.en?.match(/Cold-water/i))
    expect(cwiText).toBeDefined()
    // v9.36.0 — added schedule-concrete day suggestions (since v9.24.0 strength
    // weaves onto Tue+Thu, recovery days for CWI are Wed/Sat/Sun)
    expect(cwiText.en).toMatch(/Wed.*Sat.*Sun|aerobic.*days/i)
  })

  it('CWI still cites Roberts 2015 hypertrophy-blunting evidence', () => {
    const rp = buildRecoveryProgram({ phases: ALL_PHASES })
    const cwiText = rp.Build.modalities.find(m => m.en?.match(/Cold-water/i))
    expect(cwiText.en).toMatch(/Roberts 2015/)
    expect(cwiText.en).toMatch(/hypertrophy|protein-synthesis/i)
  })

  it('CWI explicitly says NOT within 4h of strength', () => {
    const rp = buildRecoveryProgram({ phases: ALL_PHASES })
    const cwiText = rp.Build.modalities.find(m => m.en?.match(/Cold-water/i))
    expect(cwiText.en).toMatch(/4h|4 h|4 hours/i)
    expect(cwiText.en).toMatch(/strength|lift/i)
  })

  it('CWI is bilingual (Turkish equivalent present)', () => {
    const rp = buildRecoveryProgram({ phases: ALL_PHASES })
    const cwiText = rp.Build.modalities.find(m => m.en?.match(/Cold-water/i))
    expect(cwiText.tr).toBeDefined()
    expect(cwiText.tr).toMatch(/Roberts 2015/)
    expect(cwiText.tr).toMatch(/Çar.*Cmt.*Paz|aerobik/i)
  })
})
