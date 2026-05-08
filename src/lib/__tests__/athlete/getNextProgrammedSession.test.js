import { describe, it, expect } from 'vitest'
import {
  getTodayProgrammedSession,
  getNextProgrammedSession,
} from '../../athlete/todayProgrammedSession.js'

// Build a tiny synthetic program with a 7-day sample week pattern.
// Wed/Thu/Sat = key sessions, others = rest.
function buildSyntheticProgram() {
  return {
    sport: 'run',
    phases: [
      { phase: 'Build', weeks: [1, 2, 3, 4, 5, 6, 7, 8] },
    ],
    sampleWeeks: {
      Build: [
        { day: 'Mon', intent: { en: 'Rest', tr: 'Dinlenme' }, durationMin: 0 },
        { day: 'Tue', intent: { en: 'Rest', tr: 'Dinlenme' }, durationMin: 0 },
        { day: 'Wed', intent: { en: 'Threshold 2x20', tr: 'Eşik 2x20' }, durationMin: 60 },
        { day: 'Thu', intent: { en: 'Easy', tr: 'Kolay' }, durationMin: 30 },
        { day: 'Fri', intent: { en: 'Rest', tr: 'Dinlenme' }, durationMin: 0 },
        { day: 'Sat', intent: { en: 'Long run', tr: 'Uzun koşu' }, durationMin: 90 },
        { day: 'Sun', intent: { en: 'Rest', tr: 'Dinlenme' }, durationMin: 0 },
      ],
    },
  }
}

describe('getNextProgrammedSession', () => {
  const program = buildSyntheticProgram()
  const programStart = '2026-04-13'  // Monday (UTC)

  it('returns today\'s session when today is a quality day', () => {
    // Wednesday 2026-04-15
    const r = getNextProgrammedSession(program, '2026-04-15', programStart)
    expect(r).toBeTruthy()
    expect(r.daysAhead).toBe(0)
    expect(r.dateISO).toBe('2026-04-15')
    expect(r.intent.en).toBe('Threshold 2x20')
  })

  it('returns the next quality day when today is rest', () => {
    // Tuesday — Tue is rest, Wed has Threshold
    const r = getNextProgrammedSession(program, '2026-04-14', programStart)
    expect(r).toBeTruthy()
    expect(r.daysAhead).toBe(1)
    expect(r.dateISO).toBe('2026-04-15')
    expect(r.intent.en).toBe('Threshold 2x20')
  })

  it('skips multiple rest days', () => {
    // Friday — Fri rest, Sat = Long
    const r = getNextProgrammedSession(program, '2026-04-17', programStart)
    expect(r).toBeTruthy()
    expect(r.daysAhead).toBe(1)
    expect(r.intent.en).toBe('Long run')
  })

  it('returns null when no quality session in next 14 days', () => {
    // Build a program where every sample day is rest
    const allRest = {
      sport: 'run',
      phases: [{ phase: 'Build', weeks: [1] }],
      sampleWeeks: {
        Build: [
          { day: 'Mon', intent: { en: 'Rest', tr: 'Dinlenme' }, durationMin: 0 },
          { day: 'Tue', intent: { en: 'Rest', tr: 'Dinlenme' }, durationMin: 0 },
          { day: 'Wed', intent: { en: 'Rest', tr: 'Dinlenme' }, durationMin: 0 },
          { day: 'Thu', intent: { en: 'Rest', tr: 'Dinlenme' }, durationMin: 0 },
          { day: 'Fri', intent: { en: 'Rest', tr: 'Dinlenme' }, durationMin: 0 },
          { day: 'Sat', intent: { en: 'Rest', tr: 'Dinlenme' }, durationMin: 0 },
          { day: 'Sun', intent: { en: 'Rest', tr: 'Dinlenme' }, durationMin: 0 },
        ],
      },
    }
    const r = getNextProgrammedSession(allRest, '2026-04-13', '2026-04-13')
    expect(r).toBeNull()
  })

  it('returns null for invalid input', () => {
    expect(getNextProgrammedSession(null)).toBeNull()
  })

  it('walks across week boundaries', () => {
    // Sunday rest → Monday rest → Tuesday rest → Wednesday Threshold
    const r = getNextProgrammedSession(program, '2026-04-19', programStart)
    expect(r).toBeTruthy()
    expect(r.daysAhead).toBe(3)
    expect(r.dateISO).toBe('2026-04-22')
    expect(r.intent.en).toBe('Threshold 2x20')
  })

  it('preserves pace target + zones from underlying session', () => {
    const programWithPace = {
      ...program,
      sampleWeeks: {
        Build: [
          { day: 'Mon', intent: { en: 'Threshold 2x20', tr: 'Eşik' }, durationMin: 60, paceTarget: '4:00/km', zones: { Z1: 20, Z2: 0, Z3: 0, Z4: 40, Z5: 0 } },
          ...program.sampleWeeks.Build.slice(1),
        ],
      },
    }
    const r = getNextProgrammedSession(programWithPace, '2026-04-13', '2026-04-13')
    expect(r.paceTarget).toBe('4:00/km')
    expect(r.zones.Z4).toBe(40)
  })
})

describe('getTodayProgrammedSession (existing — sanity)', () => {
  it('still returns a result for a known program', () => {
    const r = getTodayProgrammedSession(buildSyntheticProgram(), '2026-04-15', '2026-04-13')
    expect(r).toBeTruthy()
    expect(r.reliable).toBe(true)
  })
})
