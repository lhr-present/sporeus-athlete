// src/lib/__tests__/athlete/triathlonWeekBalance.test.js
import { describe, it, expect } from 'vitest'
import {
  classifyTriSession,
  validateTriathlonWeek,
  balanceTriathlonWeek,
} from '../../athlete/triathlonWeekBalance.js'
import { buildEliteProgram } from '../../athlete/eliteProgram.js'

function buildTri() {
  return buildEliteProgram({
    sport: 'triathlon',
    raceDate: '2026-11-01',
    currentPR: { distanceM: 10000, timeSec: 3000 },
    targetPR:  { distanceM: 10000, timeSec: 2820 },
    profile:   { currentCTL: 60 },
    options:   { today: '2026-05-04' },
  })
}

describe('classifyTriSession', () => {
  it('rest discipline → rest', () => {
    expect(classifyTriSession({ day: 'Mon', discipline: 'rest', durationMin: 0, zones: {} })).toBe('rest')
  })
  it('durationMin=0 → rest regardless of discipline', () => {
    expect(classifyTriSession({ day: 'Sun', discipline: 'run', durationMin: 0, zones: { Z5: 0 } })).toBe('rest')
  })
  it('Z4+Z5 ≥ 25 → hard', () => {
    expect(classifyTriSession({ day: 'Tue', discipline: 'run', durationMin: 60, zones: { Z4: 25, Z5: 0 } })).toBe('hard')
    expect(classifyTriSession({ day: 'Tue', discipline: 'swim', durationMin: 55, zones: { Z4: 0, Z5: 35 } })).toBe('hard')
  })
  it('long bike (≥150) → long; shorter bike → easy', () => {
    expect(classifyTriSession({ day: 'Sat', discipline: 'bike', durationMin: 180, zones: { Z2: 140 } })).toBe('long')
    expect(classifyTriSession({ day: 'Wed', discipline: 'bike', durationMin: 95,  zones: { Z2: 65  } })).toBe('easy')
  })
  it('long run (≥120) → long; 90-min run → easy', () => {
    expect(classifyTriSession({ day: 'Sun', discipline: 'run', durationMin: 120, zones: { Z1: 100 } })).toBe('long')
    expect(classifyTriSession({ day: 'Sun', discipline: 'run', durationMin: 90,  zones: { Z1: 80  } })).toBe('easy')
  })
  it('short non-rest non-hard → easy', () => {
    expect(classifyTriSession({ day: 'Wed', discipline: 'swim', durationMin: 40, zones: { Z1: 40 } })).toBe('easy')
  })
})

describe('validateTriathlonWeek (synthetic)', () => {
  it('flags hard-on-consecutive-days (R1)', () => {
    const week = [
      { day: 'Mon', discipline: 'rest', durationMin: 0, zones: {} },
      { day: 'Tue', discipline: 'run',  durationMin: 60, zones: { Z4: 40 } },
      { day: 'Wed', discipline: 'swim', durationMin: 55, zones: { Z5: 30 } },
      { day: 'Thu', discipline: 'bike', durationMin: 60, zones: { Z2: 60 } },
      { day: 'Fri', discipline: 'rest', durationMin: 0, zones: {} },
      { day: 'Sat', discipline: 'bike', durationMin: 180, zones: { Z2: 150 } },
      { day: 'Sun', discipline: 'run',  durationMin: 90, zones: { Z1: 80 } },
    ]
    const v = validateTriathlonWeek(week)
    expect(v.valid).toBe(false)
    expect(v.violations.some(x => x.rule === 'R1-hard-adjacent')).toBe(true)
  })

  it('flags long on weekday (R2)', () => {
    const week = [
      { day: 'Mon', discipline: 'rest', durationMin: 0, zones: {} },
      { day: 'Tue', discipline: 'bike', durationMin: 180, zones: { Z2: 150 } }, // long on Tue
      { day: 'Wed', discipline: 'rest', durationMin: 0, zones: {} },
      { day: 'Thu', discipline: 'run',  durationMin: 50, zones: { Z1: 50 } },
      { day: 'Fri', discipline: 'rest', durationMin: 0, zones: {} },
      { day: 'Sat', discipline: 'swim', durationMin: 40, zones: { Z1: 40 } },
      { day: 'Sun', discipline: 'run',  durationMin: 90, zones: { Z1: 80 } },
    ]
    const v = validateTriathlonWeek(week)
    expect(v.violations.some(x => x.rule === 'R2-long-not-weekend' && x.day === 'Tue')).toBe(true)
  })

  it('flags strength → hard with no gap (R3)', () => {
    const week = [
      { day: 'Mon', discipline: 'strength', durationMin: 45, zones: {} },
      { day: 'Tue', discipline: 'run', durationMin: 60, zones: { Z4: 40 } }, // hard right after
      { day: 'Wed', discipline: 'rest', durationMin: 0, zones: {} },
      { day: 'Thu', discipline: 'swim', durationMin: 40, zones: { Z1: 40 } },
      { day: 'Fri', discipline: 'rest', durationMin: 0, zones: {} },
      { day: 'Sat', discipline: 'bike', durationMin: 180, zones: { Z2: 150 } },
      { day: 'Sun', discipline: 'run',  durationMin: 90, zones: { Z1: 80 } },
    ]
    const v = validateTriathlonWeek(week)
    expect(v.violations.some(x => x.rule === 'R3-strength-before-hard')).toBe(true)
  })

  it('passes a balanced week', () => {
    const week = [
      { day: 'Mon', discipline: 'rest', durationMin: 0, zones: {} },
      { day: 'Tue', discipline: 'run',  durationMin: 60, zones: { Z4: 40 } }, // hard
      { day: 'Wed', discipline: 'bike', durationMin: 75, zones: { Z2: 60 } }, // easy
      { day: 'Thu', discipline: 'swim', durationMin: 55, zones: { Z5: 30 } }, // hard
      { day: 'Fri', discipline: 'swim', durationMin: 35, zones: { Z1: 35 } }, // easy
      { day: 'Sat', discipline: 'bike', durationMin: 180, zones: { Z2: 150 } }, // long
      { day: 'Sun', discipline: 'run',  durationMin: 120, zones: { Z1: 110 } }, // long
    ]
    const v = validateTriathlonWeek(week)
    expect(v.valid).toBe(true)
    expect(v.hardDays).toEqual(['Tue', 'Thu'])
    expect(v.longDays.every(d => ['Sat', 'Sun'].includes(d))).toBe(true)
  })
})

describe('validateTriathlonWeek (real triSampleWeek output)', () => {
  it('Base / Build / Peak / Taper weeks all pass R1–R4', () => {
    const p = buildTri()
    expect(p).not.toBeNull()
    expect(p.sampleWeeks).toBeTruthy()
    const phases = ['Base', 'Build', 'Peak', 'Taper']
    for (const phase of phases) {
      const wk = p.sampleWeeks[phase]
      expect(wk, `${phase} week present`).toBeTruthy()
      const v = validateTriathlonWeek(wk)
      if (!v.valid) {
        // Surface the failing rule in the assertion message
        console.error(`[${phase}] violations:`, JSON.stringify(v.violations, null, 2))
      }
      expect(v.valid, `${phase}: ${v.violations.map(x => x.rule).join(', ')}`).toBe(true)
    }
  })

  it('every phase has zero hard-hard adjacencies', () => {
    const p = buildTri()
    for (const phase of ['Base', 'Build', 'Peak', 'Taper']) {
      const v = validateTriathlonWeek(p.sampleWeeks[phase])
      const adj = v.violations.filter(x => x.rule === 'R1-hard-adjacent')
      expect(adj.length, `${phase} hard-hard adjacencies`).toBe(0)
    }
  })

  it('every long session in Base/Build lands on weekend', () => {
    const p = buildTri()
    for (const phase of ['Base', 'Build']) {
      const v = validateTriathlonWeek(p.sampleWeeks[phase])
      expect(v.longDays.length, `${phase} has ≥1 long`).toBeGreaterThanOrEqual(1)
      for (const d of v.longDays) {
        expect(['Sat', 'Sun']).toContain(d)
      }
    }
  })
})

describe('balanceTriathlonWeek', () => {
  it('resolves a simple hard-adjacent violation via day-swap', () => {
    const broken = [
      { day: 'Mon', discipline: 'rest', durationMin: 0, zones: {} },
      { day: 'Tue', discipline: 'run',  durationMin: 60, zones: { Z4: 40 } }, // hard
      { day: 'Wed', discipline: 'swim', durationMin: 55, zones: { Z5: 30 } }, // hard — adjacent to Tue
      { day: 'Thu', discipline: 'bike', durationMin: 60, zones: { Z2: 60 } }, // easy
      { day: 'Fri', discipline: 'rest', durationMin: 0, zones: {} },
      { day: 'Sat', discipline: 'bike', durationMin: 180, zones: { Z2: 150 } }, // long
      { day: 'Sun', discipline: 'run',  durationMin: 90, zones: { Z1: 80 } },   // long
    ]
    const { week, swaps, residualViolations } = balanceTriathlonWeek(broken)
    expect(swaps.length).toBeGreaterThanOrEqual(1)
    // Final week has no R1 adjacency
    const v = validateTriathlonWeek(week)
    const adj = v.violations.filter(x => x.rule === 'R1-hard-adjacent')
    expect(adj.length).toBe(0)
    expect(residualViolations).toBe(v.violations.length)
  })

  it('no-op on an already-balanced week', () => {
    const ok = [
      { day: 'Mon', discipline: 'rest', durationMin: 0, zones: {} },
      { day: 'Tue', discipline: 'run',  durationMin: 60, zones: { Z4: 40 } },
      { day: 'Wed', discipline: 'bike', durationMin: 75, zones: { Z2: 60 } },
      { day: 'Thu', discipline: 'swim', durationMin: 55, zones: { Z5: 30 } },
      { day: 'Fri', discipline: 'swim', durationMin: 35, zones: { Z1: 35 } },
      { day: 'Sat', discipline: 'bike', durationMin: 180, zones: { Z2: 150 } },
      { day: 'Sun', discipline: 'run',  durationMin: 90, zones: { Z1: 80 } },
    ]
    const { swaps } = balanceTriathlonWeek(ok)
    expect(swaps.length).toBe(0)
  })
})
