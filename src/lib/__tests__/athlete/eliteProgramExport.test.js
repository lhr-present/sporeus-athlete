// @vitest-environment jsdom
// ─── eliteProgramExport.test.js — CSV export pure-fn + download helper tests ─
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  ELITE_PROGRAM_CSV_HEADER,
  eliteProgramToCSV,
  downloadEliteProgramCSV,
} from '../../athlete/eliteProgramExport.js'
import { buildEliteProgram } from '../../athlete/eliteProgram.js'

const TODAY = '2026-05-07'

const RUN_INPUT = {
  currentPR: { distanceM: 10000, timeSec: 3000 },  // 50:00
  targetPR:  { distanceM: 10000, timeSec: 2400 },  // 40:00
  raceDate: '2026-08-15',
  sport: 'run',
  options: { today: TODAY },
}

function realProgram() {
  const p = buildEliteProgram(RUN_INPUT)
  expect(p).toBeTruthy()
  expect(p._rejected).toBeUndefined()
  return p
}

describe('eliteProgramToCSV — null / empty handling', () => {
  it('returns empty string when program is null', () => {
    expect(eliteProgramToCSV(null)).toBe('')
  })

  it('returns empty string when program is undefined', () => {
    expect(eliteProgramToCSV(undefined)).toBe('')
  })

  it('returns empty string when program is not an object', () => {
    expect(eliteProgramToCSV('foo')).toBe('')
    expect(eliteProgramToCSV(42)).toBe('')
  })

  it('emits header only when phases are missing', () => {
    expect(eliteProgramToCSV({})).toBe(ELITE_PROGRAM_CSV_HEADER)
  })

  it('header always emitted (with valid program)', () => {
    const csv = eliteProgramToCSV(realProgram())
    expect(csv.split('\n')[0]).toBe(ELITE_PROGRAM_CSV_HEADER)
  })
})

describe('eliteProgramToCSV — run path: 50:00 → 40:00 / 10K', () => {
  it('produces header + one row per (phase week × phase day)', () => {
    const program = realProgram()
    const csv = eliteProgramToCSV(program)
    const lines = csv.split('\n')

    let expected = 0
    for (const ph of program.phases) {
      const wks = ph.weeks?.length || 0
      const days = (program.sampleWeeks?.[ph.phase] || []).length
      expected += wks * days
    }
    expect(lines.length).toBe(1 + expected)
    expect(expected).toBeGreaterThan(0)
  })

  it('first phase row has correct phase + week + day fields', () => {
    const program = realProgram()
    const csv = eliteProgramToCSV(program)
    const firstPhase = program.phases[0]
    const firstWk = firstPhase.weeks[0]
    const firstDay = program.sampleWeeks[firstPhase.phase][0]
    const cols = csv.split('\n')[1].split(',')
    expect(cols[0]).toBe(firstPhase.phase)
    expect(cols[1]).toBe(String(firstWk))
    expect(cols[2]).toBe(firstDay.day)
  })

  it('zones spread across 5 separate columns Z1..Z5', () => {
    const program = realProgram()
    const csv = eliteProgramToCSV(program)
    const headers = csv.split('\n')[0].split(',')
    expect(headers[5]).toBe('Z1')
    expect(headers[6]).toBe('Z2')
    expect(headers[7]).toBe('Z3')
    expect(headers[8]).toBe('Z4')
    expect(headers[9]).toBe('Z5')

    // pick any non-rest day to verify numeric values
    const lines = csv.split('\n').slice(1)
    const nonRest = lines.find(l => {
      const c = l.split(',')
      return Number(c[4]) > 0
    })
    expect(nonRest).toBeTruthy()
    const cols = nonRest.split(',')
    for (let i = 5; i <= 9; i++) {
      expect(/^\d+$/.test(cols[i])).toBe(true)
    }
  })

  it('paceTarget appears when set on a day', () => {
    const program = realProgram()
    const csv = eliteProgramToCSV(program)
    expect(csv).toMatch(/\d+:\d{2}\/km/)
  })

  it('phase column matches phase name across all phases', () => {
    const program = realProgram()
    const csv = eliteProgramToCSV(program)
    const lines = csv.split('\n').slice(1)
    const phaseNames = new Set(program.phases.map(p => p.phase))
    for (const line of lines) {
      const phase = line.split(',')[0]
      expect(phaseNames.has(phase)).toBe(true)
    }
  })

  it('bilingual notes round-trip into NotesEN and NotesTR columns', () => {
    const program = realProgram()
    const csv = eliteProgramToCSV(program)
    const lines = csv.split('\n').slice(1)
    // some day has a bilingual note from runSampleWeek "Base phase ..."
    const hit = lines.find(l => /Base phase/.test(l) && /Base fazı/.test(l))
    expect(hit).toBeTruthy()
  })

  it('weekly TSS / phase week numbers monotonic across phases', () => {
    const program = realProgram()
    const csv = eliteProgramToCSV(program)
    const lines = csv.split('\n').slice(1)
    const weekNums = lines.map(l => Number(l.split(',')[1]))
    expect(weekNums[0]).toBeGreaterThan(0)
    expect(Math.max(...weekNums)).toBeLessThanOrEqual(program.feasibility.weeksAvailable)
  })
})

describe('eliteProgramToCSV — escaping rules', () => {
  function fixtureWithNotes(en, tr) {
    return {
      phases: [{ phase: 'Base', weeks: [1] }],
      sampleWeeks: {
        Base: [{
          day: 'Mon',
          intent: { en: 'Easy run', tr: 'Kolay koşu' },
          durationMin: 45,
          zones: { Z1: 45, Z2: 0, Z3: 0, Z4: 0, Z5: 0 },
          paceTarget: '5:30/km',
          notes: { en, tr },
        }],
      },
    }
  }

  it('escapes commas in notes by wrapping in quotes', () => {
    const csv = eliteProgramToCSV(fixtureWithNotes('Easy run, focus on cadence', 'Kolay koşu'))
    expect(csv).toContain('"Easy run, focus on cadence"')
  })

  it('escapes embedded quotes by doubling them', () => {
    const csv = eliteProgramToCSV(fixtureWithNotes('She said "go easy"', 'Yavaş'))
    expect(csv).toContain('"She said ""go easy"""')
  })

  it('escapes multi-line (newline) notes by wrapping in quotes', () => {
    const csv = eliteProgramToCSV(fixtureWithNotes('line1\nline2', 'sat1\nsat2'))
    expect(csv).toContain('"line1\nline2"')
    expect(csv).toContain('"sat1\nsat2"')
  })

  it('empty / missing zones fall back to 0,0,0,0,0', () => {
    const fx = {
      phases: [{ phase: 'Base', weeks: [1] }],
      sampleWeeks: {
        Base: [{ day: 'Mon', intent: { en: 'Rest', tr: 'Dinlenme' }, durationMin: 0, zones: {}, paceTarget: null, notes: {} }],
      },
    }
    const csv = eliteProgramToCSV(fx)
    const cols = csv.split('\n')[1].split(',')
    expect(cols.slice(5, 10).join(',')).toBe('0,0,0,0,0')
  })

  it('missing intent / pace / notes produce empty strings (no "undefined")', () => {
    const fx = {
      phases: [{ phase: 'Base', weeks: [1] }],
      sampleWeeks: {
        Base: [{ day: 'Mon' }],
      },
    }
    const csv = eliteProgramToCSV(fx)
    expect(csv).not.toMatch(/undefined/)
  })
})

describe('downloadEliteProgramCSV', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns false when program is null', () => {
    expect(downloadEliteProgramCSV(null)).toBe(false)
  })

  it('returns true with a valid program in jsdom', () => {
    const ok = downloadEliteProgramCSV(realProgram(), 'test.csv')
    expect(ok).toBe(true)
  })
})
