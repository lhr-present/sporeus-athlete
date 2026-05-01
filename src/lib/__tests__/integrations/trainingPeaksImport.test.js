// src/lib/__tests__/integrations/trainingPeaksImport.test.js — E20 TP CSV import
import { describe, it, expect } from 'vitest'
import {
  mapWorkoutType,
  parseCSVLine,
  parseTPDate,
  parseTPDuration,
  mapTPRowToSession,
  parseTrainingPeaksCSV,
  dedupSessions,
  importTrainingPeaksCSV,
} from '../../integrations/trainingPeaksImport.js'

// ── mapWorkoutType ────────────────────────────────────────────────────────────
describe('mapWorkoutType', () => {
  it('maps Run/Running → Running', () => {
    expect(mapWorkoutType('Run')).toBe('Running')
    expect(mapWorkoutType('Running')).toBe('Running')
    expect(mapWorkoutType('RUN')).toBe('Running')
  })

  it('maps Bike/Cycling/Ride/MTB → Cycling', () => {
    expect(mapWorkoutType('Bike')).toBe('Cycling')
    expect(mapWorkoutType('Cycling')).toBe('Cycling')
    expect(mapWorkoutType('Ride')).toBe('Cycling')
    expect(mapWorkoutType('MTB')).toBe('Cycling')
  })

  it('maps Swim/Swimming → Swimming', () => {
    expect(mapWorkoutType('Swim')).toBe('Swimming')
    expect(mapWorkoutType('Swimming')).toBe('Swimming')
  })

  it('maps Strength/Weights → Strength', () => {
    expect(mapWorkoutType('Strength')).toBe('Strength')
    expect(mapWorkoutType('Weights')).toBe('Strength')
  })

  it('maps Walk/Hike → Walking', () => {
    expect(mapWorkoutType('Walk')).toBe('Walking')
    expect(mapWorkoutType('Hike')).toBe('Walking')
  })

  it('maps Row/Rowing → Rowing', () => {
    expect(mapWorkoutType('Row')).toBe('Rowing')
    expect(mapWorkoutType('Rowing')).toBe('Rowing')
  })

  it('maps unknown/empty/null → Other', () => {
    expect(mapWorkoutType('')).toBe('Other')
    expect(mapWorkoutType(null)).toBe('Other')
    expect(mapWorkoutType(undefined)).toBe('Other')
    expect(mapWorkoutType('Yoga')).toBe('Other')
    expect(mapWorkoutType('Unknown')).toBe('Other')
  })

  it('handles hyphenated and spaced forms', () => {
    expect(mapWorkoutType('xc-ski')).toBe('Other')
    expect(mapWorkoutType('xc ski')).toBe('Other')
  })
})

// ── parseCSVLine ──────────────────────────────────────────────────────────────
describe('parseCSVLine', () => {
  it('parses simple comma-separated fields', () => {
    expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c'])
  })

  it('handles trailing empty field', () => {
    expect(parseCSVLine('a,b,')).toEqual(['a', 'b', ''])
  })

  it('handles leading empty field', () => {
    expect(parseCSVLine(',a,b')).toEqual(['', 'a', 'b'])
  })

  it('handles quoted fields with embedded commas', () => {
    expect(parseCSVLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd'])
  })

  it('handles escaped double-quotes ("")', () => {
    expect(parseCSVLine('"he said ""hi""",b')).toEqual(['he said "hi"', 'b'])
  })

  it('handles entirely empty input', () => {
    expect(parseCSVLine('')).toEqual([''])
  })

  it('handles single field without commas', () => {
    expect(parseCSVLine('hello')).toEqual(['hello'])
  })

  it('strips quote markers but preserves inner content', () => {
    expect(parseCSVLine('"plain"')).toEqual(['plain'])
  })

  it('handles quoted field with comma and escape together', () => {
    expect(parseCSVLine('"a, ""b"", c",d')).toEqual(['a, "b", c', 'd'])
  })
})

// ── parseTPDate ───────────────────────────────────────────────────────────────
describe('parseTPDate', () => {
  it('parses ISO YYYY-MM-DD', () => {
    expect(parseTPDate('2026-04-15')).toBe('2026-04-15')
  })

  it('parses ISO with time appended', () => {
    expect(parseTPDate('2026-04-15T08:30:00')).toBe('2026-04-15')
    expect(parseTPDate('2026-04-15 08:30')).toBe('2026-04-15')
  })

  it('zero-pads single-digit ISO month/day', () => {
    expect(parseTPDate('2026-4-5')).toBe('2026-04-05')
  })

  it('parses MM/DD/YYYY (US, ambiguous → MM/DD)', () => {
    expect(parseTPDate('04/15/2026')).toBe('2026-04-15')
  })

  it('parses DD/MM/YYYY when day > 12', () => {
    expect(parseTPDate('15/04/2026')).toBe('2026-04-15')
  })

  it('returns null for unparseable input', () => {
    expect(parseTPDate('not a date')).toBeNull()
    expect(parseTPDate('15.04.2026')).toBeNull()
  })

  it('returns null for null/empty/undefined', () => {
    expect(parseTPDate(null)).toBeNull()
    expect(parseTPDate('')).toBeNull()
    expect(parseTPDate(undefined)).toBeNull()
    expect(parseTPDate('   ')).toBeNull()
  })

  it('returns null for invalid month/day in slash form', () => {
    expect(parseTPDate('13/13/2026')).toBeNull()
    expect(parseTPDate('00/15/2026')).toBeNull()
  })
})

// ── parseTPDuration ───────────────────────────────────────────────────────────
describe('parseTPDuration', () => {
  it('prefers TimeTotalInHours over Time', () => {
    expect(parseTPDuration('1.5', '00:30:00')).toBe(90) // 1.5h not 30min
  })

  it('converts decimal hours to minutes', () => {
    expect(parseTPDuration('1', '')).toBe(60)
    expect(parseTPDuration('0.5', '')).toBe(30)
    expect(parseTPDuration('2.25', '')).toBe(135)
  })

  it('parses HH:MM:SS Time format', () => {
    expect(parseTPDuration('', '01:30:00')).toBe(90)
    expect(parseTPDuration('', '00:45:30')).toBe(45.5)
  })

  it('parses HH:MM Time format', () => {
    expect(parseTPDuration('', '01:30')).toBe(90)
  })

  it('returns null for missing inputs', () => {
    expect(parseTPDuration('', '')).toBeNull()
    expect(parseTPDuration(null, null)).toBeNull()
    expect(parseTPDuration(undefined, undefined)).toBeNull()
  })

  it('returns null for invalid Time format', () => {
    expect(parseTPDuration('', 'invalid')).toBeNull()
  })

  it('returns null for negative TimeTotalInHours', () => {
    expect(parseTPDuration('-1', '')).toBeNull()
  })

  it('returns null for non-numeric TimeTotalInHours', () => {
    expect(parseTPDuration('abc', '')).toBeNull()
  })
})

// ── mapTPRowToSession ─────────────────────────────────────────────────────────
describe('mapTPRowToSession', () => {
  it('maps a complete row correctly', () => {
    const row = {
      Title: 'Long Run',
      WorkoutType: 'Run',
      WorkoutDay: '2026-04-15',
      TimeTotalInHours: '1.5',
      DistanceInMeters: '15000',
      TSS: '85.5',
      Rpe: '6',
      Comments: 'Felt good',
      Feeling: 'Strong',
    }
    const s = mapTPRowToSession(row)
    expect(s.date).toBe('2026-04-15')
    expect(s.type).toBe('Running')
    expect(s.duration).toBe(90)
    expect(s.tss).toBe(85.5)
    expect(s.rpe).toBe(6)
    expect(s.distanceM).toBe(15000)
    expect(s.source).toBe('tp_csv')
    expect(s.notes).toContain('Long Run')
    expect(s.notes).toContain('Felt good')
    expect(s.notes).toContain('Strong')
  })

  it('returns null without a date', () => {
    expect(mapTPRowToSession({ TimeTotalInHours: '1' })).toBeNull()
  })

  it('returns null without a duration', () => {
    expect(mapTPRowToSession({ WorkoutDay: '2026-04-15' })).toBeNull()
  })

  it('returns null for null/non-object input', () => {
    expect(mapTPRowToSession(null)).toBeNull()
    expect(mapTPRowToSession('string')).toBeNull()
    expect(mapTPRowToSession(42)).toBeNull()
  })

  it('always sets source to tp_csv', () => {
    const s = mapTPRowToSession({ WorkoutDay: '2026-04-15', TimeTotalInHours: '1' })
    expect(s.source).toBe('tp_csv')
  })

  it('omits TSS/RPE/distanceM when fields are empty', () => {
    const s = mapTPRowToSession({ WorkoutDay: '2026-04-15', TimeTotalInHours: '1' })
    expect(s.tss).toBeUndefined()
    expect(s.rpe).toBeUndefined()
    expect(s.distanceM).toBeUndefined()
  })

  it('defaults type to Other for unknown WorkoutType', () => {
    const s = mapTPRowToSession({ WorkoutDay: '2026-04-15', TimeTotalInHours: '1', WorkoutType: 'Yoga' })
    expect(s.type).toBe('Other')
  })

  it('omits notes when no Title/Comments/Feeling', () => {
    const s = mapTPRowToSession({ WorkoutDay: '2026-04-15', TimeTotalInHours: '1' })
    expect(s.notes).toBeUndefined()
  })

  it('skips invalid TSS without crashing', () => {
    const s = mapTPRowToSession({ WorkoutDay: '2026-04-15', TimeTotalInHours: '1', TSS: 'abc' })
    expect(s.tss).toBeUndefined()
  })
})

// ── parseTrainingPeaksCSV ─────────────────────────────────────────────────────
describe('parseTrainingPeaksCSV', () => {
  const HEADER = 'Title,WorkoutType,WorkoutDay,TimeTotalInHours,DistanceInMeters,TSS,Rpe,Comments,Feeling'

  it('returns empty for null/empty input', () => {
    expect(parseTrainingPeaksCSV(null).sessions).toEqual([])
    expect(parseTrainingPeaksCSV('').sessions).toEqual([])
    expect(parseTrainingPeaksCSV('   ').sessions).toEqual([])
  })

  it('returns empty for header-only input', () => {
    const r = parseTrainingPeaksCSV(HEADER)
    expect(r.sessions).toEqual([])
    expect(r.summary.total).toBe(0)
  })

  it('parses a single row', () => {
    const csv = `${HEADER}\nLong Run,Run,2026-04-15,1.5,15000,85,6,Felt good,Strong`
    const r = parseTrainingPeaksCSV(csv)
    expect(r.sessions).toHaveLength(1)
    expect(r.sessions[0].type).toBe('Running')
    expect(r.summary.parsed).toBe(1)
    expect(r.summary.total).toBe(1)
    expect(r.summary.skipped).toBe(0)
  })

  it('parses multiple rows', () => {
    const csv = [
      HEADER,
      'Long Run,Run,2026-04-15,1.5,15000,85,6,,',
      'Easy Bike,Bike,2026-04-16,1,30000,50,4,,',
      'Pool,Swim,2026-04-17,0.75,3000,40,5,,',
    ].join('\n')
    const r = parseTrainingPeaksCSV(csv)
    expect(r.sessions).toHaveLength(3)
    expect(r.sessions.map(s => s.type)).toEqual(['Running', 'Cycling', 'Swimming'])
  })

  it('strips BOM marker from start', () => {
    const csv = `﻿${HEADER}\nLong Run,Run,2026-04-15,1.5,15000,85,6,,`
    const r = parseTrainingPeaksCSV(csv)
    expect(r.sessions).toHaveLength(1)
  })

  it('handles Windows CRLF line endings', () => {
    const csv = `${HEADER}\r\nLong Run,Run,2026-04-15,1.5,15000,85,6,,\r\n`
    const r = parseTrainingPeaksCSV(csv)
    expect(r.sessions).toHaveLength(1)
  })

  it('handles quoted comma in field', () => {
    const csv = `${HEADER}\n"Long, slow run",Run,2026-04-15,1.5,15000,85,6,,`
    const r = parseTrainingPeaksCSV(csv)
    expect(r.sessions).toHaveLength(1)
    expect(r.sessions[0].notes).toContain('Long, slow run')
  })

  it('skips empty lines silently', () => {
    const csv = `${HEADER}\n\nLong Run,Run,2026-04-15,1.5,15000,85,6,,\n\n`
    const r = parseTrainingPeaksCSV(csv)
    expect(r.sessions).toHaveLength(1)
    expect(r.summary.total).toBe(1)
  })

  it('reports rows missing WorkoutDay in errors', () => {
    const csv = `${HEADER}\nNo Date,Run,,1,15000,85,6,,`
    const r = parseTrainingPeaksCSV(csv)
    expect(r.sessions).toHaveLength(0)
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.errors[0].reason).toMatch(/WorkoutDay/i)
    expect(r.summary.skipped).toBe(1)
  })

  it('reports header missing required columns', () => {
    const csv = `Title,WorkoutType\nLong Run,Run`
    const r = parseTrainingPeaksCSV(csv)
    expect(r.sessions).toHaveLength(0)
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.errors[0].reason).toMatch(/Missing required columns/)
  })

  it('errors do not block valid rows from importing', () => {
    const csv = [
      HEADER,
      'Bad,Run,not-a-date,1,15000,85,6,,',
      'Good,Run,2026-04-15,1,15000,85,6,,',
    ].join('\n')
    const r = parseTrainingPeaksCSV(csv)
    expect(r.sessions).toHaveLength(1)
    expect(r.errors.length).toBeGreaterThan(0)
  })

  it('500-row CSV completes quickly', () => {
    const rows = Array.from({ length: 500 }, (_, i) => {
      const day = String((i % 28) + 1).padStart(2, '0')
      return `R${i},Run,2026-04-${day},1,10000,50,5,,`
    })
    const csv = [HEADER, ...rows].join('\n')
    const start = performance.now()
    const r = parseTrainingPeaksCSV(csv)
    const elapsed = performance.now() - start
    expect(r.sessions).toHaveLength(500)
    expect(elapsed).toBeLessThan(500) // generous budget for CI variance
  })

  it('summary counts add up', () => {
    const csv = [
      HEADER,
      'A,Run,2026-04-15,1,,,,,',
      'B,Run,bad,1,,,,,',
      'C,Run,2026-04-16,1,,,,,',
    ].join('\n')
    const r = parseTrainingPeaksCSV(csv)
    expect(r.summary.total).toBe(3)
    expect(r.summary.parsed).toBe(2)
    expect(r.summary.skipped).toBe(1)
  })
})

// ── dedupSessions ─────────────────────────────────────────────────────────────
describe('dedupSessions', () => {
  it('returns all newSessions when existingLog is empty', () => {
    const newS = [{ date: '2026-04-15', type: 'Running', duration: 60 }]
    expect(dedupSessions(newS, [])).toEqual(newS)
    expect(dedupSessions(newS, null)).toEqual(newS)
  })

  it('returns empty array for non-array newSessions', () => {
    expect(dedupSessions(null, [])).toEqual([])
    expect(dedupSessions(undefined, [])).toEqual([])
  })

  it('filters exact duplicate by date+type+duration', () => {
    const existing = [{ date: '2026-04-15', type: 'Running', duration: 60 }]
    const newS = [{ date: '2026-04-15', type: 'Running', duration: 60 }]
    expect(dedupSessions(newS, existing)).toEqual([])
  })

  it('filters near-duplicate within ±5 min tolerance', () => {
    const existing = [{ date: '2026-04-15', type: 'Running', duration: 60 }]
    const newS = [{ date: '2026-04-15', type: 'Running', duration: 63 }]
    expect(dedupSessions(newS, existing)).toEqual([])
  })

  it('does NOT filter when duration differs by > 5 min', () => {
    const existing = [{ date: '2026-04-15', type: 'Running', duration: 60 }]
    const newS = [{ date: '2026-04-15', type: 'Running', duration: 90 }]
    expect(dedupSessions(newS, existing)).toHaveLength(1)
  })

  it('does NOT filter different dates', () => {
    const existing = [{ date: '2026-04-15', type: 'Running', duration: 60 }]
    const newS = [{ date: '2026-04-16', type: 'Running', duration: 60 }]
    expect(dedupSessions(newS, existing)).toHaveLength(1)
  })

  it('does NOT filter different types', () => {
    const existing = [{ date: '2026-04-15', type: 'Running', duration: 60 }]
    const newS = [{ date: '2026-04-15', type: 'Cycling', duration: 60 }]
    expect(dedupSessions(newS, existing)).toHaveLength(1)
  })

  it('handles mixed dup and non-dup', () => {
    const existing = [{ date: '2026-04-15', type: 'Running', duration: 60 }]
    const newS = [
      { date: '2026-04-15', type: 'Running', duration: 60 },  // dup
      { date: '2026-04-16', type: 'Running', duration: 60 },  // new
      { date: '2026-04-15', type: 'Cycling', duration: 60 },  // new (different type)
    ]
    expect(dedupSessions(newS, existing)).toHaveLength(2)
  })
})

// ── importTrainingPeaksCSV (end-to-end) ───────────────────────────────────────
describe('importTrainingPeaksCSV', () => {
  const HEADER = 'Title,WorkoutType,WorkoutDay,TimeTotalInHours,DistanceInMeters,TSS,Rpe,Comments,Feeling'

  it('returns parsed sessions when log is empty', () => {
    const csv = `${HEADER}\nA,Run,2026-04-15,1,,,,,`
    const r = importTrainingPeaksCSV(csv, [])
    expect(r.toImport).toHaveLength(1)
    expect(r.duplicates).toHaveLength(0)
  })

  it('separates duplicates from new sessions', () => {
    const csv = [
      HEADER,
      'A,Run,2026-04-15,1,,,,,',
      'B,Run,2026-04-16,1,,,,,',
      'C,Run,2026-04-17,1,,,,,',
    ].join('\n')
    const existing = [{ date: '2026-04-15', type: 'Running', duration: 60 }]
    const r = importTrainingPeaksCSV(csv, existing)
    expect(r.toImport).toHaveLength(2)
    expect(r.duplicates).toHaveLength(1)
    expect(r.duplicates[0].date).toBe('2026-04-15')
  })

  it('summary includes duplicates and toImport counts', () => {
    const csv = [HEADER, 'A,Run,2026-04-15,1,,,,,'].join('\n')
    const existing = [{ date: '2026-04-15', type: 'Running', duration: 60 }]
    const r = importTrainingPeaksCSV(csv, existing)
    expect(r.summary.duplicates).toBe(1)
    expect(r.summary.toImport).toBe(0)
    expect(r.summary.total).toBe(1)
  })

  it('idempotency: re-running with previously-imported sessions yields zero new', () => {
    const csv = `${HEADER}\nA,Run,2026-04-15,1,,,,,`
    const firstPass = importTrainingPeaksCSV(csv, [])
    expect(firstPass.toImport).toHaveLength(1)
    // Second pass: existing log now contains the imported session
    const secondPass = importTrainingPeaksCSV(csv, firstPass.toImport)
    expect(secondPass.toImport).toHaveLength(0)
    expect(secondPass.duplicates).toHaveLength(1)
  })

  it('passes errors through to result', () => {
    const csv = [HEADER, 'Bad,Run,bad-date,1,,,,,'].join('\n')
    const r = importTrainingPeaksCSV(csv, [])
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.toImport).toHaveLength(0)
  })

  it('every imported session has source=tp_csv', () => {
    const csv = [HEADER, 'A,Run,2026-04-15,1,,,,,'].join('\n')
    const r = importTrainingPeaksCSV(csv, [])
    expect(r.toImport[0].source).toBe('tp_csv')
  })
})
