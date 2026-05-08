// src/lib/__tests__/athlete/coachShareEnvelope.test.js
import { describe, it, expect } from 'vitest'
import {
  parseCoachShareEnvelope,
  validateCoachShareEnvelope,
  COACH_SHARE_ERRORS,
} from '../../athlete/coachShareEnvelope.js'

function validEnvelope(overrides = {}) {
  return {
    v: 1,
    kind: 'sporeus-elite-program-share',
    athleteSnapshot: {
      sport: 'run',
      distanceM: 10000,
      currentTime: 3000,
      targetTime: 2400,
      raceDate: '2026-08-15',
      weeksAvailable: 14,
      weeksNeeded: 12,
      feasibilityBand: 'realistic',
    },
    physiology: {
      currentVDOT: 50, targetVDOT: 56,
      currentFTP: null, targetFTP: null,
      currentCSS: null, targetCSS: null,
    },
    phases: [
      { phase: 'Base',  weeks: 6 },
      { phase: 'Build', weeks: 4 },
      { phase: 'Peak',  weeks: 2 },
      { phase: 'Taper', weeks: 2 },
    ],
    synthetic: null,
    lifecycle: { state: 'draft', percentComplete: 0, daysToRace: 100 },
    citation: 'Daniels 2014; Bompa 2009',
    generatedAt: '2026-05-07',
    ...overrides,
  }
}

describe('parseCoachShareEnvelope — happy path', () => {
  it('valid envelope round-trips through parse → ok=true', () => {
    const json = JSON.stringify(validEnvelope())
    const r = parseCoachShareEnvelope(json)
    expect(r.ok).toBe(true)
    expect(r.error).toBeNull()
    expect(r.envelope).not.toBeNull()
    expect(r.envelope.kind).toBe('sporeus-elite-program-share')
    expect(r.envelope.v).toBe(1)
    expect(r.envelope.athleteSnapshot.sport).toBe('run')
    expect(r.envelope.phases.length).toBe(4)
  })

  it('preserves citation and generatedAt', () => {
    const r = parseCoachShareEnvelope(JSON.stringify(validEnvelope()))
    expect(r.envelope.citation).toMatch(/Daniels 2014/)
    expect(r.envelope.generatedAt).toBe('2026-05-07')
  })
})

describe('parseCoachShareEnvelope — error paths', () => {
  it('invalid JSON returns invalid-json', () => {
    const r = parseCoachShareEnvelope('{not valid json')
    expect(r.ok).toBe(false)
    expect(r.error).toBe('invalid-json')
    expect(r.envelope).toBeNull()
  })

  it('wrong kind returns wrong-kind', () => {
    const env = validEnvelope({ kind: 'something-else' })
    const r = parseCoachShareEnvelope(JSON.stringify(env))
    expect(r.ok).toBe(false)
    expect(r.error).toBe('wrong-kind')
  })

  it('v=2 is now accepted (Wave B coach edit-back)', () => {
    const env = validEnvelope({ v: 2, edits: [], coachId: 'coach-1', editedAt: '2026-05-08' })
    const r = parseCoachShareEnvelope(JSON.stringify(env))
    expect(r.ok).toBe(true)
    expect(r.envelope.v).toBe(2)
    expect(Array.isArray(r.envelope.edits)).toBe(true)
    expect(r.envelope.coachId).toBe('coach-1')
    expect(r.envelope.editedAt).toBe('2026-05-08')
  })

  it('v=3 still returns unsupported-version', () => {
    const env = validEnvelope({ v: 3 })
    const r = parseCoachShareEnvelope(JSON.stringify(env))
    expect(r.ok).toBe(false)
    expect(r.error).toBe('unsupported-version')
  })

  it('v=2 normalizes edits[] (drops malformed, preserves valid)', () => {
    const env = validEnvelope({
      v: 2,
      edits: [
        { id: 'a', type: 'phase-tss-bias', target: 'Build', prev: 1, next: 1.1, note: { en: 'x', tr: 'y' }, timestamp: '2026-05-08' },
        { type: 'phase-note', target: 'Peak' },     // missing fields but normalizable
        null,                                         // dropped
        { id: 'c' },                                  // missing type/target — dropped
        'string-not-object',                          // dropped
      ],
    })
    const r = parseCoachShareEnvelope(JSON.stringify(env))
    expect(r.ok).toBe(true)
    expect(r.envelope.edits.length).toBe(2)
    expect(r.envelope.edits[0].id).toBe('a')
  })

  it('missing athleteSnapshot returns missing-required-fields', () => {
    const env = validEnvelope()
    delete env.athleteSnapshot
    const r = parseCoachShareEnvelope(JSON.stringify(env))
    expect(r.ok).toBe(false)
    expect(r.error).toBe('missing-required-fields')
  })

  it('missing phases returns missing-required-fields', () => {
    const env = validEnvelope()
    delete env.phases
    const r = parseCoachShareEnvelope(JSON.stringify(env))
    expect(r.ok).toBe(false)
    expect(r.error).toBe('missing-required-fields')
  })

  it('empty string input returns invalid-json', () => {
    const r = parseCoachShareEnvelope('')
    expect(r.ok).toBe(false)
    expect(r.error).toBe('invalid-json')
  })

  it('null input returns invalid-json', () => {
    const r = parseCoachShareEnvelope(null)
    expect(r.ok).toBe(false)
    expect(r.error).toBe('invalid-json')
  })

  it('malformed phases (non-array) returns missing-required-fields', () => {
    const env = validEnvelope({ phases: 'not-an-array' })
    const r = parseCoachShareEnvelope(JSON.stringify(env))
    expect(r.ok).toBe(false)
    expect(r.error).toBe('missing-required-fields')
  })
})

describe('parseCoachShareEnvelope — sport-conditional physiology', () => {
  it('run sport — VDOT populated, FTP/CSS null', () => {
    const env = validEnvelope({
      athleteSnapshot: { ...validEnvelope().athleteSnapshot, sport: 'run' },
      physiology: { currentVDOT: 48, targetVDOT: 54, currentFTP: null, targetFTP: null, currentCSS: null, targetCSS: null },
    })
    const r = parseCoachShareEnvelope(JSON.stringify(env))
    expect(r.ok).toBe(true)
    expect(r.envelope.physiology.currentVDOT).toBe(48)
    expect(r.envelope.physiology.currentFTP).toBeNull()
    expect(r.envelope.physiology.currentCSS).toBeNull()
  })

  it('bike sport — FTP populated, VDOT/CSS null', () => {
    const env = validEnvelope({
      athleteSnapshot: { ...validEnvelope().athleteSnapshot, sport: 'bike' },
      physiology: { currentVDOT: null, targetVDOT: null, currentFTP: 250, targetFTP: 290, currentCSS: null, targetCSS: null },
    })
    const r = parseCoachShareEnvelope(JSON.stringify(env))
    expect(r.ok).toBe(true)
    expect(r.envelope.physiology.currentFTP).toBe(250)
    expect(r.envelope.physiology.currentVDOT).toBeNull()
  })

  it('swim sport — CSS populated, VDOT/FTP null', () => {
    const env = validEnvelope({
      athleteSnapshot: { ...validEnvelope().athleteSnapshot, sport: 'swim' },
      physiology: { currentVDOT: null, targetVDOT: null, currentFTP: null, targetFTP: null, currentCSS: 1.25, targetCSS: 1.40 },
    })
    const r = parseCoachShareEnvelope(JSON.stringify(env))
    expect(r.ok).toBe(true)
    expect(r.envelope.physiology.currentCSS).toBe(1.25)
    expect(r.envelope.physiology.targetCSS).toBe(1.40)
  })

  it('triathlon sport — both VDOT and FTP populated', () => {
    const env = validEnvelope({
      athleteSnapshot: { ...validEnvelope().athleteSnapshot, sport: 'triathlon' },
      physiology: { currentVDOT: 50, targetVDOT: 56, currentFTP: 250, targetFTP: 280, currentCSS: 1.20, targetCSS: 1.35 },
    })
    const r = parseCoachShareEnvelope(JSON.stringify(env))
    expect(r.ok).toBe(true)
    expect(r.envelope.physiology.currentVDOT).toBe(50)
    expect(r.envelope.physiology.currentFTP).toBe(250)
    expect(r.envelope.physiology.currentCSS).toBe(1.20)
  })
})

describe('parseCoachShareEnvelope — synthetic + forward-compat', () => {
  it('synthetic=null normalizes to null', () => {
    const env = validEnvelope({ synthetic: null })
    const r = parseCoachShareEnvelope(JSON.stringify(env))
    expect(r.ok).toBe(true)
    expect(r.envelope.synthetic).toBeNull()
  })

  it('synthetic.raceDate=true preserves bool flag', () => {
    const env = validEnvelope({ synthetic: { raceDate: true, raceLabel: '12 weeks out' } })
    const r = parseCoachShareEnvelope(JSON.stringify(env))
    expect(r.ok).toBe(true)
    expect(r.envelope.synthetic).not.toBeNull()
    expect(r.envelope.synthetic.raceDate).toBe(true)
    expect(r.envelope.synthetic.raceLabel).toBe('12 weeks out')
  })

  it('extra unknown fields are tolerated (forward-compat)', () => {
    const env = { ...validEnvelope(), futureField: 'x', meta: { tag: 'beta' } }
    const r = parseCoachShareEnvelope(JSON.stringify(env))
    expect(r.ok).toBe(true)
    expect(r.envelope.futureField).toBe('x')
  })
})

describe('COACH_SHARE_ERRORS — bilingual lookup', () => {
  it('every error code has both en + tr entries', () => {
    const codes = ['invalid-json', 'wrong-kind', 'unsupported-version', 'missing-required-fields']
    for (const c of codes) {
      expect(COACH_SHARE_ERRORS[c]).toBeDefined()
      expect(typeof COACH_SHARE_ERRORS[c].en).toBe('string')
      expect(typeof COACH_SHARE_ERRORS[c].tr).toBe('string')
      expect(COACH_SHARE_ERRORS[c].en.length).toBeGreaterThan(0)
      expect(COACH_SHARE_ERRORS[c].tr.length).toBeGreaterThan(0)
    }
  })
})

describe('validateCoachShareEnvelope — parity with parse().ok', () => {
  it('valid object passes validation', () => {
    expect(validateCoachShareEnvelope(validEnvelope()).ok).toBe(true)
  })

  it('returns same boolean as parse().ok across the same input', () => {
    const cases = [
      validEnvelope(),
      { ...validEnvelope(), kind: 'wrong' },
      { ...validEnvelope(), v: 2 },
      (() => { const e = validEnvelope(); delete e.athleteSnapshot; return e })(),
      (() => { const e = validEnvelope(); delete e.phases; return e })(),
    ]
    for (const c of cases) {
      const v = validateCoachShareEnvelope(c).ok
      const p = parseCoachShareEnvelope(JSON.stringify(c)).ok
      expect(v).toBe(p)
    }
  })
})
