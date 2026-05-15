// src/lib/__tests__/athlete/eliteProgramDrillStrengthSubs.test.js
import { describe, it, expect } from 'vitest'
import {
  classifyStrengthMovement,
  getDrillSubstitute,
  getStrengthSubstitute,
  buildDrillStrengthSubstitutionMap,
} from '../../athlete/eliteProgramDrillStrengthSubs.js'
import { buildDrillsLibrary } from '../../athlete/eliteProgramDrills.js'
import { buildStrengthProgram } from '../../athlete/eliteProgramStrength.js'

const PHASES = [{ phase: 'Base' }, { phase: 'Build' }, { phase: 'Peak' }, { phase: 'Taper' }]

describe('classifyStrengthMovement', () => {
  it('classifies the main canonical movements', () => {
    expect(classifyStrengthMovement('Back squat')).toBe('squat')
    expect(classifyStrengthMovement('Back squat (explosive)')).toBe('squat')
    expect(classifyStrengthMovement('Romanian deadlift')).toBe('hinge')
    expect(classifyStrengthMovement('Trap-bar deadlift')).toBe('hinge')
    expect(classifyStrengthMovement('Single-leg press or split squat')).toBe('singleLeg')
    expect(classifyStrengthMovement('Pull-up or lat pulldown')).toBe('verticalPull')
    expect(classifyStrengthMovement('Barbell or dumbbell row')).toBe('horizontalPull')
    expect(classifyStrengthMovement('Standing overhead press')).toBe('push')
    expect(classifyStrengthMovement('Dumbbell bench or push-up progression')).toBe('push')
    expect(classifyStrengthMovement('Box jumps')).toBe('plyo')
    expect(classifyStrengthMovement('Single-leg hop drills')).toBe('plyo') // hop wins over single-leg
    expect(classifyStrengthMovement('Med-ball chest pass (power throw)')).toBe('plyo')
  })

  it('returns null for non-pattern movements (calf raise, prehab)', () => {
    expect(classifyStrengthMovement('Calf raise (bent + straight knee)')).toBeNull()
    expect(classifyStrengthMovement('Hip CARs')).toBeNull()
    expect(classifyStrengthMovement('Plank progression (45-60s)')).toBeNull()
  })

  it('null/empty inputs → null', () => {
    expect(classifyStrengthMovement(null)).toBeNull()
    expect(classifyStrengthMovement('')).toBeNull()
    expect(classifyStrengthMovement(undefined)).toBeNull()
  })
})

describe('getDrillSubstitute', () => {
  it('returns a bilingual substitute for each known drill+constraint', () => {
    const sub = getDrillSubstitute('run-drill-a-skip', 'noEquipment')
    expect(sub).not.toBeNull()
    expect(sub.en).toBeTruthy()
    expect(sub.tr).toBeTruthy()
  })

  it('returns null for unknown drill key', () => {
    expect(getDrillSubstitute('run-drill-banana', 'noEquipment')).toBeNull()
  })

  it('returns null for invalid constraint', () => {
    expect(getDrillSubstitute('run-drill-a-skip', 'weather')).toBeNull()
  })

  it('covers all drills surfaced by buildDrillsLibrary across sports', () => {
    const sports = ['run', 'bike', 'swim', 'rowing', 'triathlon']
    for (const sport of sports) {
      const lib = buildDrillsLibrary({ sport, phases: PHASES })
      const drills = [].concat(...Object.values(lib))
      for (const d of drills) {
        for (const c of ['noEquipment', 'noFacility', 'injured']) {
          const s = getDrillSubstitute(d.key, c)
          expect(s, `${sport} drill ${d.key} should have ${c} substitute`).not.toBeNull()
          expect(s.en, `${sport}/${d.key}/${c} EN`).toBeTruthy()
          expect(s.tr, `${sport}/${d.key}/${c} TR`).toBeTruthy()
        }
      }
    }
  })
})

describe('getStrengthSubstitute', () => {
  it('returns a substitute + pattern label', () => {
    const sub = getStrengthSubstitute('Back squat', 'noEquipment')
    expect(sub).not.toBeNull()
    expect(sub.pattern).toBe('squat')
    expect(sub.en).toBeTruthy()
    expect(sub.tr).toBeTruthy()
  })

  it('returns null for unpatterned movements (calf raise)', () => {
    expect(getStrengthSubstitute('Calf raise (bent + straight knee)', 'noEquipment')).toBeNull()
  })

  it('covers all main movements across run/bike/swim/rowing Base+Build+Peak phases', () => {
    const sports = ['run', 'bike', 'swim', 'rowing']
    for (const sport of sports) {
      const prog = buildStrengthProgram({ phases: PHASES, sport })
      for (const phase of ['Base', 'Build', 'Peak']) {
        const plan = prog[phase]
        if (!plan) continue
        for (const m of plan.movements) {
          const name = m?.name?.en
          if (!name) continue
          // Calf raises are intentionally not in the pattern taxonomy
          if (/calf\s+raise/i.test(name)) continue
          for (const c of ['noEquipment', 'noGym', 'injured']) {
            const s = getStrengthSubstitute(name, c)
            expect(s, `${sport}/${phase}/${name} should classify and substitute ${c}`).not.toBeNull()
            expect(s.en).toBeTruthy()
            expect(s.tr).toBeTruthy()
          }
        }
      }
    }
  })
})

describe('buildDrillStrengthSubstitutionMap', () => {
  it('returns phase-keyed drill + strength substitute maps for a run program', () => {
    const map = buildDrillStrengthSubstitutionMap({ sport: 'run', phases: PHASES })
    expect(map).toHaveProperty('drills')
    expect(map).toHaveProperty('strength')
    expect(map.drills.Base.length).toBeGreaterThan(0)
    expect(map.strength.Base.length).toBeGreaterThan(0)
    // Every drill entry has subs with all 3 axes present
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      for (const d of map.drills[phase]) {
        expect(d.subs).toHaveProperty('noEquipment')
        expect(d.subs).toHaveProperty('noFacility')
        expect(d.subs).toHaveProperty('injured')
      }
    }
  })

  it('runs cleanly for all 5 sports without throwing', () => {
    for (const sport of ['run', 'bike', 'swim', 'rowing', 'triathlon']) {
      expect(() => buildDrillStrengthSubstitutionMap({ sport, phases: PHASES })).not.toThrow()
    }
  })

  it('triathlon drills span run+bike+swim+tri-extras (all have subs)', () => {
    const map = buildDrillStrengthSubstitutionMap({ sport: 'triathlon', phases: PHASES })
    const allKeys = []
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      for (const d of map.drills[phase]) allKeys.push(d.key)
    }
    const unique = [...new Set(allKeys)]
    // Expect at least one drill from each discipline tag (run/bike/swim/tri)
    expect(unique.some(k => k.startsWith('run-drill-'))).toBe(true)
    expect(unique.some(k => k.startsWith('bike-drill-'))).toBe(true)
    expect(unique.some(k => k.startsWith('swim-drill-'))).toBe(true)
    expect(unique.some(k => k.startsWith('tri-drill-'))).toBe(true)
    // And every one has resolved substitutes
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      for (const d of map.drills[phase]) {
        expect(d.subs.noEquipment).not.toBeNull()
      }
    }
  })
})
