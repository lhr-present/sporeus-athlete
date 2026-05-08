import { describe, it, expect } from 'vitest'
import {
  buildCoachEdit,
  validateCoachEdit,
  applyCoachEdits,
  acceptCoachEdit,
  revertCoachEdit,
  acceptAllCoachEdits,
  summarizeCoachEdits,
} from '../../athlete/coachEditEngine.js'

const MIN_PROGRAM = {
  phases: [
    { phase: 'Base',  weeks: [1, 2, 3, 4] },
    { phase: 'Build', weeks: [5, 6, 7] },
    { phase: 'Peak',  weeks: [8, 9] },
    { phase: 'Taper', weeks: [10] },
  ],
  weeklyTSS: [100, 110, 120, 130, 140, 150, 160, 170, 180, 90],
  keySessionLibrary: {
    Base: [{ key: 'run-base-long-aerobic', name: { en: 'Long', tr: 'Uzun' } }],
    Build: [{ key: 'run-build-vo2-5x4', name: { en: 'VO2 5x4', tr: 'VO2 5x4' } }],
    Peak: [],
    Taper: [],
  },
}

describe('coachEditEngine — buildCoachEdit', () => {
  it('builds a phase-tss-bias edit with valid input', () => {
    const e = buildCoachEdit({ type: 'phase-tss-bias', target: 'Build', prev: 1.0, next: 1.1, noteEn: 'lift base load', noteTr: 'temel yükü artır' })
    expect(e).toBeTruthy()
    expect(e.id).toMatch(/^edit-/)
    expect(e.type).toBe('phase-tss-bias')
    expect(e.target).toBe('Build')
    expect(e.next).toBe(1.1)
    expect(e.note.en).toBe('lift base load')
    expect(e.note.tr).toBe('temel yükü artır')
    expect(e.timestamp).toBeTruthy()
  })

  it('rejects invalid edit type', () => {
    expect(buildCoachEdit({ type: 'random', target: 'Build', next: 1.1 })).toBeNull()
  })

  it('rejects invalid phase for phase-tss-bias', () => {
    expect(buildCoachEdit({ type: 'phase-tss-bias', target: 'BadPhase', next: 1.1 })).toBeNull()
  })

  it('rejects out-of-range bias', () => {
    expect(buildCoachEdit({ type: 'phase-tss-bias', target: 'Build', next: 2.0 })).toBeNull()
    expect(buildCoachEdit({ type: 'phase-tss-bias', target: 'Build', next: 0.3 })).toBeNull()
  })

  it('builds a phase-note edit', () => {
    const e = buildCoachEdit({ type: 'phase-note', target: 'Peak', noteEn: 'Drop 1 quality session', noteTr: 'Bir kaliteyi azalt' })
    expect(e).toBeTruthy()
    expect(e.type).toBe('phase-note')
    expect(e.note.en).toBe('Drop 1 quality session')
  })

  it('builds a key-session-swap edit', () => {
    const next = { key: 'custom', name: { en: 'Custom', tr: 'Özel' } }
    const e = buildCoachEdit({ type: 'key-session-swap', target: 'Build/run-build-vo2-5x4', prev: null, next })
    expect(e).toBeTruthy()
    expect(e.target).toBe('Build/run-build-vo2-5x4')
    expect(e.next.key).toBe('custom')
  })

  it('builds a general-note edit', () => {
    const e = buildCoachEdit({ type: 'general-note', target: '*', noteEn: 'Race day pacing strategy attached', noteTr: 'Yarış günü tempo stratejisi ekli' })
    expect(e).toBeTruthy()
    expect(e.target).toBe('*')
  })
})

describe('coachEditEngine — validateCoachEdit', () => {
  it('accepts valid phase-tss-bias', () => {
    const v = validateCoachEdit({ type: 'phase-tss-bias', target: 'Build', next: 1.1 })
    expect(v.ok).toBe(true)
  })

  it('rejects unknown type', () => {
    expect(validateCoachEdit({ type: 'random', target: 'Build', next: 1 }).ok).toBe(false)
  })

  it('rejects bias out of range', () => {
    expect(validateCoachEdit({ type: 'phase-tss-bias', target: 'Build', next: 2 }).ok).toBe(false)
  })
})

describe('coachEditEngine — applyCoachEdits', () => {
  it('returns input unchanged when no edits', () => {
    const out = applyCoachEdits(MIN_PROGRAM, [])
    expect(out).toBe(MIN_PROGRAM)
  })

  it('skips pending edits (accepted === undefined)', () => {
    const e = buildCoachEdit({ type: 'phase-tss-bias', target: 'Build', next: 1.5 })
    const out = applyCoachEdits(MIN_PROGRAM, [e])
    expect(out.weeklyTSS[4]).toBe(140) // unchanged
  })

  it('skips rejected edits (accepted === false)', () => {
    const e = { ...buildCoachEdit({ type: 'phase-tss-bias', target: 'Build', next: 1.5 }), accepted: false }
    const out = applyCoachEdits(MIN_PROGRAM, [e])
    expect(out.weeklyTSS[4]).toBe(140) // unchanged
  })

  it('applies accepted phase-tss-bias to correct week range', () => {
    const e = { ...buildCoachEdit({ type: 'phase-tss-bias', target: 'Build', next: 1.5 }), accepted: true }
    const out = applyCoachEdits(MIN_PROGRAM, [e])
    expect(out.weeklyTSS[4]).toBe(Math.round(140 * 1.5))   // week 5 in Build
    expect(out.weeklyTSS[5]).toBe(Math.round(150 * 1.5))   // week 6
    expect(out.weeklyTSS[6]).toBe(Math.round(160 * 1.5))   // week 7
    expect(out.weeklyTSS[3]).toBe(130)                     // week 4 in Base — unchanged
    expect(out.weeklyTSS[7]).toBe(170)                     // week 8 in Peak — unchanged
  })

  it('does not mutate input', () => {
    const before = JSON.stringify(MIN_PROGRAM)
    const e = { ...buildCoachEdit({ type: 'phase-tss-bias', target: 'Build', next: 1.5 }), accepted: true }
    applyCoachEdits(MIN_PROGRAM, [e])
    expect(JSON.stringify(MIN_PROGRAM)).toBe(before)
  })

  it('applies phase-note: appends to coachNotes.phase[target]', () => {
    const e = { ...buildCoachEdit({ type: 'phase-note', target: 'Peak', noteEn: 'Drop quality', noteTr: 'Kaliteyi azalt' }), accepted: true }
    const out = applyCoachEdits(MIN_PROGRAM, [e])
    expect(out.coachNotes.phase.Peak).toBeTruthy()
    expect(out.coachNotes.phase.Peak[0].en).toBe('Drop quality')
  })

  it('applies general-note: appends to coachNotes.general', () => {
    const e = { ...buildCoachEdit({ type: 'general-note', target: '*', noteEn: 'Welcome', noteTr: 'Hoşgeldin' }), accepted: true }
    const out = applyCoachEdits(MIN_PROGRAM, [e])
    expect(out.coachNotes.general[0].en).toBe('Welcome')
  })

  it('applies key-session-swap: replaces library entry', () => {
    const newSession = { name: { en: 'Cruise 4×10', tr: 'Cruise 4×10' }, structure: { en: '4×10 @T', tr: '4×10 @T' } }
    const e = { ...buildCoachEdit({ type: 'key-session-swap', target: 'Build/run-build-vo2-5x4', prev: null, next: newSession }), accepted: true }
    const out = applyCoachEdits(MIN_PROGRAM, [e])
    const swapped = out.keySessionLibrary.Build[0]
    expect(swapped.key).toBe('run-build-vo2-5x4')        // key preserved
    expect(swapped.name.en).toBe('Cruise 4×10')          // content swapped
    expect(swapped._swappedByCoach).toBe(true)           // marker
  })

  it('skips key-session-swap when target session not found', () => {
    const e = { ...buildCoachEdit({ type: 'key-session-swap', target: 'Build/nonexistent-key', prev: null, next: { name: { en: 'X', tr: 'X' } } }), accepted: true }
    const out = applyCoachEdits(MIN_PROGRAM, [e])
    expect(out.keySessionLibrary.Build).toEqual(MIN_PROGRAM.keySessionLibrary.Build)
  })

  it('emits coachAppliedEdits array listing applied edits', () => {
    const e1 = { ...buildCoachEdit({ type: 'phase-tss-bias', target: 'Build', next: 1.2 }), accepted: true }
    const e2 = { ...buildCoachEdit({ type: 'general-note', target: '*', noteEn: 'note' }), accepted: true }
    const out = applyCoachEdits(MIN_PROGRAM, [e1, e2])
    expect(out.coachAppliedEdits.length).toBe(2)
  })

  it('handles non-program input gracefully', () => {
    expect(applyCoachEdits(null, [])).toBe(null)
    expect(applyCoachEdits(undefined, [])).toBe(undefined)
  })
})

describe('coachEditEngine — accept/revert/acceptAll/summarize', () => {
  const E1 = buildCoachEdit({ type: 'phase-tss-bias', target: 'Build', next: 1.1 })
  const E2 = buildCoachEdit({ type: 'general-note', target: '*', noteEn: 'note' })
  const E3 = buildCoachEdit({ type: 'phase-note', target: 'Peak', noteEn: 'note' })

  it('acceptCoachEdit toggles single edit to accepted=true', () => {
    const out = acceptCoachEdit([E1, E2], E1.id)
    expect(out[0].accepted).toBe(true)
    expect(out[1].accepted).toBeUndefined()
  })

  it('revertCoachEdit toggles single edit to accepted=false', () => {
    const out = revertCoachEdit([E1, E2], E1.id)
    expect(out[0].accepted).toBe(false)
    expect(out[1].accepted).toBeUndefined()
  })

  it('acceptAllCoachEdits accepts only pending edits', () => {
    const E1Rejected = { ...E1, accepted: false }
    const out = acceptAllCoachEdits([E1Rejected, E2, E3])
    expect(out[0].accepted).toBe(false) // already rejected — preserved
    expect(out[1].accepted).toBe(true)
    expect(out[2].accepted).toBe(true)
  })

  it('summarizeCoachEdits counts by status', () => {
    const arr = [
      { ...E1, accepted: true },
      { ...E2, accepted: false },
      E3, // pending
    ]
    expect(summarizeCoachEdits(arr)).toEqual({ total: 3, accepted: 1, pending: 1, rejected: 1 })
  })

  it('summarizeCoachEdits handles empty/invalid input', () => {
    expect(summarizeCoachEdits([])).toEqual({ total: 0, accepted: 0, pending: 0, rejected: 0 })
    expect(summarizeCoachEdits(null)).toEqual({ total: 0, accepted: 0, pending: 0, rejected: 0 })
  })
})
