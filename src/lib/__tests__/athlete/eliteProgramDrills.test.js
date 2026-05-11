import { describe, it, expect } from 'vitest'
import { buildDrillsLibrary, DRILLS_CITATION } from '../../athlete/eliteProgramDrills.js'

const ALL_PHASES = [
  { phase: 'Base' }, { phase: 'Build' }, { phase: 'Peak' }, { phase: 'Taper' },
]

describe('DRILLS_CITATION', () => {
  it('exposes a non-empty citation string', () => {
    expect(typeof DRILLS_CITATION).toBe('string')
    expect(DRILLS_CITATION.length).toBeGreaterThan(20)
  })

  it('references key methodology authors', () => {
    expect(DRILLS_CITATION).toMatch(/Daniels|Maglischo|Coggan|Nolte/)
  })
})

describe('buildDrillsLibrary — null / undefined / empty input', () => {
  it('returns empty phase buckets when input is undefined', () => {
    const out = buildDrillsLibrary(undefined)
    expect(out).toEqual({ Base: [], Build: [], Peak: [], Taper: [] })
  })

  it('returns empty phase buckets when input is null', () => {
    const out = buildDrillsLibrary(null)
    expect(out).toEqual({ Base: [], Build: [], Peak: [], Taper: [] })
  })

  it('returns empty phase buckets when phases array is empty', () => {
    const out = buildDrillsLibrary({ sport: 'run', phases: [] })
    expect(out.Base).toEqual([])
    expect(out.Build).toEqual([])
    expect(out.Peak).toEqual([])
    expect(out.Taper).toEqual([])
  })

  it('returns empty phase buckets when phases is undefined', () => {
    const out = buildDrillsLibrary({ sport: 'run' })
    expect(Object.values(out).every(arr => arr.length === 0)).toBe(true)
  })

  it('returns full shape with all four phase keys, always', () => {
    const out = buildDrillsLibrary({ sport: 'run', phases: [{ phase: 'Base' }] })
    expect(Object.keys(out).sort()).toEqual(['Base', 'Build', 'Peak', 'Taper'])
  })
})

describe('buildDrillsLibrary — single-sport selection', () => {
  it('returns run drills when sport=run', () => {
    const out = buildDrillsLibrary({ sport: 'run', phases: ALL_PHASES })
    expect(out.Base.every(d => d.key.startsWith('run-'))).toBe(true)
  })

  it('returns bike drills when sport=bike', () => {
    const out = buildDrillsLibrary({ sport: 'bike', phases: ALL_PHASES })
    expect(out.Base.every(d => d.key.startsWith('bike-'))).toBe(true)
  })

  it('returns swim drills when sport=swim', () => {
    const out = buildDrillsLibrary({ sport: 'swim', phases: ALL_PHASES })
    expect(out.Base.every(d => d.key.startsWith('swim-'))).toBe(true)
  })

  it('returns rowing drills when sport=rowing', () => {
    const out = buildDrillsLibrary({ sport: 'rowing', phases: ALL_PHASES })
    expect(out.Base.every(d => d.key.startsWith('row-'))).toBe(true)
  })

  it('falls back to run drills when sport is unknown', () => {
    const out = buildDrillsLibrary({ sport: 'parkour', phases: ALL_PHASES })
    expect(out.Base.every(d => d.key.startsWith('run-'))).toBe(true)
  })

  it('falls back to run drills when sport is null', () => {
    const out = buildDrillsLibrary({ sport: null, phases: ALL_PHASES })
    expect(out.Base.length).toBeGreaterThan(0)
    expect(out.Base.every(d => d.key.startsWith('run-'))).toBe(true)
  })
})

describe('buildDrillsLibrary — phase filtering', () => {
  it('only emits buckets for phases present in input', () => {
    const out = buildDrillsLibrary({ sport: 'run', phases: [{ phase: 'Peak' }] })
    expect(out.Base).toEqual([])
    expect(out.Build).toEqual([])
    expect(out.Taper).toEqual([])
    expect(out.Peak.length).toBeGreaterThan(0)
  })

  it('every drill in a phase bucket lists that phase in its phases array', () => {
    const out = buildDrillsLibrary({ sport: 'run', phases: ALL_PHASES })
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      for (const d of out[phase]) {
        expect(d.phases).toContain(phase)
      }
    }
  })

  it('Taper phase emits at least one stride-like drill for run', () => {
    const out = buildDrillsLibrary({ sport: 'run', phases: [{ phase: 'Taper' }] })
    expect(out.Taper.length).toBeGreaterThan(0)
  })

  it('Peak phase for bike emits standing-sprints or cornering', () => {
    const out = buildDrillsLibrary({ sport: 'bike', phases: [{ phase: 'Peak' }] })
    const keys = out.Peak.map(d => d.key)
    expect(keys).toContain('bike-drill-cornering')
  })

  it('Base phase for swim never includes Peak-only drills', () => {
    const out = buildDrillsLibrary({ sport: 'swim', phases: [{ phase: 'Base' }] })
    for (const d of out.Base) {
      expect(d.phases).toContain('Base')
    }
  })
})

describe('buildDrillsLibrary — triathlon merge', () => {
  it('triathlon Base contains run + bike + swim drills', () => {
    const out = buildDrillsLibrary({ sport: 'triathlon', phases: [{ phase: 'Base' }] })
    const disciplines = new Set(out.Base.map(d => d.discipline))
    expect(disciplines.has('run')).toBe(true)
    expect(disciplines.has('bike')).toBe(true)
    expect(disciplines.has('swim')).toBe(true)
  })

  it('triathlon Peak includes the tri-specific T1/T2 transition drills', () => {
    const out = buildDrillsLibrary({ sport: 'triathlon', phases: [{ phase: 'Peak' }] })
    const triKeys = out.Peak.filter(d => d.discipline === 'tri').map(d => d.key)
    expect(triKeys).toContain('tri-drill-brick-transition')
    expect(triKeys).toContain('tri-drill-swim-to-bike')
  })

  it('triathlon Taper bucket is empty when Taper not requested', () => {
    const out = buildDrillsLibrary({ sport: 'triathlon', phases: [{ phase: 'Base' }] })
    expect(out.Taper).toEqual([])
  })

  it('triathlon drills carry a discipline tag', () => {
    const out = buildDrillsLibrary({ sport: 'triathlon', phases: ALL_PHASES })
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      for (const d of out[phase]) {
        expect(['run', 'bike', 'swim', 'tri']).toContain(d.discipline)
      }
    }
  })

  it('triathlon Build does NOT include T1 rehearsal (Peak-only)', () => {
    const out = buildDrillsLibrary({ sport: 'triathlon', phases: [{ phase: 'Build' }] })
    const keys = out.Build.map(d => d.key)
    expect(keys).not.toContain('tri-drill-swim-to-bike')
  })
})

describe('buildDrillsLibrary — drill shape (EN+TR bilingual contract)', () => {
  it('every drill has key, name, purpose, structure, phases, frequencyPerWeek, citation', () => {
    const out = buildDrillsLibrary({ sport: 'run', phases: ALL_PHASES })
    for (const d of out.Base) {
      expect(typeof d.key).toBe('string')
      expect(d.name).toHaveProperty('en')
      expect(d.name).toHaveProperty('tr')
      expect(d.purpose).toHaveProperty('en')
      expect(d.purpose).toHaveProperty('tr')
      expect(d.structure).toHaveProperty('en')
      expect(d.structure).toHaveProperty('tr')
      expect(Array.isArray(d.phases)).toBe(true)
      expect(typeof d.frequencyPerWeek).toBe('number')
      expect(typeof d.citation).toBe('string')
    }
  })

  it('every EN+TR pair has non-empty strings', () => {
    const out = buildDrillsLibrary({ sport: 'swim', phases: ALL_PHASES })
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      for (const d of out[phase]) {
        expect(d.name.en.length).toBeGreaterThan(0)
        expect(d.name.tr.length).toBeGreaterThan(0)
      }
    }
  })

  it('frequencyPerWeek is always within a sane 1-7 range', () => {
    const out = buildDrillsLibrary({ sport: 'bike', phases: ALL_PHASES })
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      for (const d of out[phase]) {
        expect(d.frequencyPerWeek).toBeGreaterThanOrEqual(1)
        expect(d.frequencyPerWeek).toBeLessThanOrEqual(7)
      }
    }
  })

  it('drill keys are unique within a single sport', () => {
    const out = buildDrillsLibrary({ sport: 'rowing', phases: ALL_PHASES })
    const all = [...out.Base, ...out.Build, ...out.Peak, ...out.Taper]
    const uniqueKeys = new Set(all.map(d => d.key))
    // duplicates across phases are expected (same drill appears in multiple phases);
    // but each phase bucket should have unique keys.
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      const keys = out[phase].map(d => d.key)
      expect(new Set(keys).size).toBe(keys.length)
    }
    expect(uniqueKeys.size).toBeGreaterThan(0)
  })
})

describe('buildDrillsLibrary — idempotence & purity', () => {
  it('returns deep-fresh arrays each call (no aliasing across calls)', () => {
    const a = buildDrillsLibrary({ sport: 'run', phases: ALL_PHASES })
    const b = buildDrillsLibrary({ sport: 'run', phases: ALL_PHASES })
    expect(a).not.toBe(b)
    expect(a.Base).not.toBe(b.Base)
  })

  it('does not mutate input phases array', () => {
    const phases = [{ phase: 'Base' }, { phase: 'Peak' }]
    const snapshot = JSON.stringify(phases)
    buildDrillsLibrary({ sport: 'run', phases })
    expect(JSON.stringify(phases)).toBe(snapshot)
  })

  it('handles unrecognized phase labels by silently dropping them', () => {
    const out = buildDrillsLibrary({ sport: 'run', phases: [{ phase: 'Recovery' }] })
    expect(out.Base).toEqual([])
    expect(out.Build).toEqual([])
    expect(out.Peak).toEqual([])
    expect(out.Taper).toEqual([])
  })
})
