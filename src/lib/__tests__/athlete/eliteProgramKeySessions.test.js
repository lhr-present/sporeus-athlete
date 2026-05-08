import { describe, it, expect } from 'vitest'
import {
  buildKeySessionLibrary,
  buildTriathlonKeySessions,
  getKeySessionsBySport,
  KEY_SESSION_CITATION,
} from '../../athlete/eliteProgramKeySessions.js'

const ALL_PHASES = [
  { phase: 'Base',  weeks: 8 },
  { phase: 'Build', weeks: 6 },
  { phase: 'Peak',  weeks: 3 },
  { phase: 'Taper', weeks: 2 },
]

describe('eliteProgramKeySessions', () => {
  it('exports a citation string', () => {
    expect(KEY_SESSION_CITATION).toMatch(/Daniels|Coggan|Wakayoshi/)
  })

  describe('buildKeySessionLibrary', () => {
    it('emits sessions only for present phases', () => {
      const lib = buildKeySessionLibrary({ sport: 'run', phases: [{ phase: 'Build' }] })
      expect(lib.Base).toEqual([])
      expect(lib.Build.length).toBeGreaterThan(0)
      expect(lib.Peak).toEqual([])
      expect(lib.Taper).toEqual([])
    })

    it('returns 3-5 sessions per present phase for run', () => {
      const lib = buildKeySessionLibrary({ sport: 'run', phases: ALL_PHASES })
      for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
        expect(lib[phase].length).toBeGreaterThanOrEqual(3)
        expect(lib[phase].length).toBeLessThanOrEqual(5)
      }
    })

    it('every session has bilingual EN+TR fields', () => {
      const lib = buildKeySessionLibrary({ sport: 'run', phases: ALL_PHASES })
      for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
        for (const s of lib[phase]) {
          expect(s.name.en).toBeTruthy()
          expect(s.name.tr).toBeTruthy()
          expect(s.purpose.en).toBeTruthy()
          expect(s.purpose.tr).toBeTruthy()
          expect(s.structure.en).toBeTruthy()
          expect(s.structure.tr).toBeTruthy()
          expect(s.warmup.en).toBeTruthy()
          expect(s.cooldown.en).toBeTruthy()
          expect(s.intensity.en).toBeTruthy()
        }
      }
    })

    it('every session has a citation', () => {
      const lib = buildKeySessionLibrary({ sport: 'run', phases: ALL_PHASES })
      for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
        for (const s of lib[phase]) {
          expect(s.citation).toBeTruthy()
          expect(typeof s.citation).toBe('string')
        }
      }
    })

    it('every session has a unique key', () => {
      const lib = buildKeySessionLibrary({ sport: 'run', phases: ALL_PHASES })
      const all = [...lib.Base, ...lib.Build, ...lib.Peak, ...lib.Taper]
      const keys = all.map(s => s.key)
      expect(new Set(keys).size).toBe(keys.length)
    })

    it('bike library covers FTP-derived intensities', () => {
      const lib = buildKeySessionLibrary({ sport: 'bike', phases: ALL_PHASES })
      const buildText = JSON.stringify(lib.Build)
      expect(buildText).toMatch(/FTP/i)
    })

    it('swim library uses CSS terminology', () => {
      const lib = buildKeySessionLibrary({ sport: 'swim', phases: ALL_PHASES })
      const buildText = JSON.stringify(lib.Build)
      expect(buildText).toMatch(/CSS/i)
    })

    it('triathlon defaults to run library at top level', () => {
      const lib = buildKeySessionLibrary({ sport: 'triathlon', phases: ALL_PHASES })
      expect(lib.Base.length).toBeGreaterThan(0)
    })

    it('handles empty/missing input gracefully', () => {
      const lib = buildKeySessionLibrary({ sport: 'run', phases: [] })
      expect(lib.Base).toEqual([])
      expect(lib.Build).toEqual([])
    })

    it('handles unknown sport by defaulting to run', () => {
      const lib = getKeySessionsBySport('unknown-sport')
      expect(lib.Base.length).toBeGreaterThan(0)
    })
  })

  describe('buildTriathlonKeySessions', () => {
    it('returns swim, bike, and run for a phase', () => {
      const tri = buildTriathlonKeySessions('Build')
      expect(tri.swim.length).toBeGreaterThan(0)
      expect(tri.bike.length).toBeGreaterThan(0)
      expect(tri.run.length).toBeGreaterThan(0)
    })

    it('returns empty arrays for an invalid phase', () => {
      const tri = buildTriathlonKeySessions('NotAPhase')
      expect(tri.swim).toEqual([])
      expect(tri.bike).toEqual([])
      expect(tri.run).toEqual([])
    })
  })

  describe('content quality', () => {
    it('Peak phase contains VO2-specific sessions for run', () => {
      const lib = buildKeySessionLibrary({ sport: 'run', phases: [{ phase: 'Peak' }] })
      const text = JSON.stringify(lib.Peak)
      expect(text).toMatch(/VO2|I-pace/)
    })

    it('Base phase contains long aerobic for run', () => {
      const lib = buildKeySessionLibrary({ sport: 'run', phases: [{ phase: 'Base' }] })
      const text = JSON.stringify(lib.Base).toLowerCase()
      expect(text).toMatch(/long|uzun/)
    })

    it('Taper phase has short low-volume sessions', () => {
      const lib = buildKeySessionLibrary({ sport: 'run', phases: [{ phase: 'Taper' }] })
      expect(lib.Taper.length).toBeLessThanOrEqual(4)
    })

    it('alternates array exists on every session (may be empty)', () => {
      const lib = buildKeySessionLibrary({ sport: 'run', phases: ALL_PHASES })
      const all = [...lib.Base, ...lib.Build, ...lib.Peak, ...lib.Taper]
      for (const s of all) {
        expect(Array.isArray(s.alternates)).toBe(true)
      }
    })
  })
})
