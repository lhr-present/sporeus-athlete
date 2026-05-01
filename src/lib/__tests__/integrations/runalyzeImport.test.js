// src/lib/__tests__/integrations/runalyzeImport.test.js — Runalyze CSV import
import { describe, it, expect } from 'vitest'
import {
  mapWorkoutType,
  parseCSVLine,
  parseDate,
  parseDuration,
  mapRowToSession,
  parseRunalyzeCSV,
  dedupAgainstLog,
  importRunalyzeCSV,
} from '../../integrations/runalyzeImport.js'

// ── mapWorkoutType ────────────────────────────────────────────────────────────
describe('mapWorkoutType (Runalyze)', () => {
  it('maps Running/Run/Trail Running → Running', () => {
    expect(mapWorkoutType('Running')).toBe('Running')
    expect(mapWorkoutType('Run')).toBe('Running')
    expect(mapWorkoutType('Trail Running')).toBe('Running')
  })

  it('maps Cycling/Bike/Ride/MTB/Indoor Cycling → Cycling', () => {
    expect(mapWorkoutType('Cycling')).toBe('Cycling')
    expect(mapWorkoutType('Bike')).toBe('Cycling')
    expect(mapWorkoutType('Ride')).toBe('Cycling')
    expect(mapWorkoutType('MTB')).toBe('Cycling')
    expect(mapWorkoutType('Indoor Cycling')).toBe('Cycling')
  })

  it('maps Swim/Swimming/Open Water → Swimming', () => {
    expect(mapWorkoutType('Swim')).toBe('Swimming')
    expect(mapWorkoutType('Swimming')).toBe('Swimming')
    expect(mapWorkoutType('Open Water')).toBe('Swimming')
  })

  it('maps Strength/Weights/Gym → Strength', () => {
    expect(mapWorkoutType('Strength')).toBe('Strength')
    expect(mapWorkoutType('Weights')).toBe('Strength')
    expect(mapWorkoutType('Gym')).toBe('Strength')
  })

  it('maps Walk/Hike/Hiking → Walking', () => {
    expect(mapWorkoutType('Walk')).toBe('Walking')
    expect(mapWorkoutType('Hike')).toBe('Walking')
    expect(mapWorkoutType('Hiking')).toBe('Walking')
  })

  it('maps Row/Rowing/Ergometer → Rowing', () => {
    expect(mapWorkoutType('Row')).toBe('Rowing')
    expect(mapWorkoutType('Rowing')).toBe('Rowing')
    expect(mapWorkoutType('Ergometer')).toBe('Rowing')
  })

  it('maps unknown/empty/null → Other', () => {
    expect(mapWorkoutType('')).toBe('Other')
    expect(mapWorkoutType(null)).toBe('Other')
    expect(mapWorkoutType(undefined)).toBe('Other')
    expect(mapWorkoutType('Yoga')).toBe('Other')
    expect(mapWorkoutType('Crossfit')).toBe('Other')
  })

  it('handles case insensitivity', () => {
    expect(mapWorkoutType('RUNNING')).toBe('Running')
    expect(mapWorkoutType('cycling')).toBe('Cycling')
  })
})

// ── parseCSVLine ──────────────────────────────────────────────────────────────
describe('parseCSVLine (Runalyze)', () => {
  it('parses simple comma-separated fields', () => {
    expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c'])
  })

  it('handles quoted fields with embedded commas', () => {
    expect(parseCSVLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd'])
  })

  it('handles escaped double-quotes', () => {
    expect(parseCSVLine('"he said ""hi""",b')).toEqual(['he said "hi"', 'b'])
  })

  it('handles trailing/leading empty fields', () => {
    expect(parseCSVLine(',a,b,')).toEqual(['', 'a', 'b', ''])
  })
})

// ── parseDate ─────────────────────────────────────────────────────────────────
describe('parseDate (Runalyze)', () => {
  it('parses ISO YYYY-MM-DD', () => {
    expect(parseDate('2026-04-15')).toBe('2026-04-15')
  })

  it('parses ISO with time appended', () => {
    expect(parseDate('2026-04-15 08:30:00')).toBe('2026-04-15')
    expect(parseDate('2026-04-15T08:30')).toBe('2026-04-15')
  })

  it('zero-pads single-digit ISO month/day', () => {
    expect(parseDate('2026-4-5')).toBe('2026-04-05')
  })

  it('parses EU dotted DD.MM.YYYY', () => {
    expect(parseDate('15.04.2026')).toBe('2026-04-15')
  })

  it('zero-pads single-digit EU dotted parts', () => {
    expect(parseDate('5.4.2026')).toBe('2026-04-05')
  })

  it('returns null for unparseable input', () => {
    expect(parseDate('not a date')).toBeNull()
    expect(parseDate('04/15/2026')).toBeNull()  // Runalyze doesn't use slash form
  })

  it('returns null for null/empty/whitespace', () => {
    expect(parseDate(null)).toBeNull()
    expect(parseDate('')).toBeNull()
    expect(parseDate(undefined)).toBeNull()
    expect(parseDate('   ')).toBeNull()
  })

  it('returns null for invalid month/day', () => {
    expect(parseDate('2026-13-01')).toBeNull()
    expect(parseDate('32.01.2026')).toBeNull()
  })
})

// ── parseDuration ─────────────────────────────────────────────────────────────
describe('parseDuration (Runalyze)', () => {
  it('parses numeric seconds (Runalyze default Time column)', () => {
    expect(parseDuration('3600')).toBe(60)
    expect(parseDuration('1800')).toBe(30)
    expect(parseDuration(3600)).toBe(60)
  })

  it('parses HH:MM:SS', () => {
    expect(parseDuration('01:30:00')).toBe(90)
    expect(parseDuration('00:45:30')).toBe(45.5)
  })

  it('parses MM:SS (two-part is minutes:seconds)', () => {
    expect(parseDuration('45:00')).toBe(45)
    expect(parseDuration('30:30')).toBe(30.5)
  })

  it('returns null for null/empty', () => {
    expect(parseDuration(null)).toBeNull()
    expect(parseDuration('')).toBeNull()
    expect(parseDuration(undefined)).toBeNull()
  })

  it('returns null for negative seconds', () => {
    expect(parseDuration('-100')).toBeNull()
  })

  it('returns null for non-numeric and not colon-form', () => {
    expect(parseDuration('abc')).toBeNull()
  })

  it('returns null for invalid colon form', () => {
    expect(parseDuration('xx:yy:zz')).toBeNull()
  })

  it('zero seconds → 0 minutes', () => {
    expect(parseDuration('0')).toBe(0)
  })
})

// ── mapRowToSession ───────────────────────────────────────────────────────────
describe('mapRowToSession (Runalyze)', () => {
  it('maps a complete row correctly', () => {
    const row = {
      Date: '2026-04-15',
      Sport: 'Running',
      Time: '3600',         // 60 minutes
      Distance: '12.5',     // km → 12500 m
      TRIMP: '85.5',
      RPE: '6',
      Notes: 'Felt good',
    }
    const s = mapRowToSession(row)
    expect(s.date).toBe('2026-04-15')
    expect(s.type).toBe('Running')
    expect(s.duration).toBe(60)
    expect(s.tss).toBe(85.5)        // TRIMP → tss
    expect(s.rpe).toBe(6)
    expect(s.distanceM).toBe(12500)
    expect(s.notes).toBe('Felt good')
    expect(s.source).toBe('runalyze_csv')
  })

  it('returns null without a Date', () => {
    expect(mapRowToSession({ Time: '3600' })).toBeNull()
  })

  it('returns null without a Time', () => {
    expect(mapRowToSession({ Date: '2026-04-15' })).toBeNull()
  })

  it('returns null for null/non-object input', () => {
    expect(mapRowToSession(null)).toBeNull()
    expect(mapRowToSession('string')).toBeNull()
    expect(mapRowToSession(42)).toBeNull()
  })

  it('always sets source to runalyze_csv', () => {
    const s = mapRowToSession({ Date: '2026-04-15', Time: '3600' })
    expect(s.source).toBe('runalyze_csv')
  })

  it('omits TRIMP/RPE/distance/notes when fields are empty', () => {
    const s = mapRowToSession({ Date: '2026-04-15', Time: '3600' })
    expect(s.tss).toBeUndefined()
    expect(s.rpe).toBeUndefined()
    expect(s.distanceM).toBeUndefined()
    expect(s.notes).toBeUndefined()
  })

  it('defaults type to Other for unknown Sport', () => {
    const s = mapRowToSession({ Date: '2026-04-15', Time: '3600', Sport: 'Crossfit' })
    expect(s.type).toBe('Other')
  })

  it('skips invalid TRIMP without crashing', () => {
    const s = mapRowToSession({ Date: '2026-04-15', Time: '3600', TRIMP: 'abc' })
    expect(s.tss).toBeUndefined()
  })

  it('handles HH:MM:SS Time form', () => {
    const s = mapRowToSession({ Date: '2026-04-15', Time: '01:30:00' })
    expect(s.duration).toBe(90)
  })

  it('handles EU dotted Date form', () => {
    const s = mapRowToSession({ Date: '15.04.2026', Time: '3600' })
    expect(s.date).toBe('2026-04-15')
  })
})

// ── parseRunalyzeCSV ──────────────────────────────────────────────────────────
describe('parseRunalyzeCSV', () => {
  const HEADER = 'Date,Sport,Time,Distance,TRIMP,RPE,Notes'

  it('returns empty for null/empty input', () => {
    expect(parseRunalyzeCSV(null).sessions).toEqual([])
    expect(parseRunalyzeCSV('').sessions).toEqual([])
    expect(parseRunalyzeCSV('   ').sessions).toEqual([])
  })

  it('returns empty for header-only input', () => {
    const r = parseRunalyzeCSV(HEADER)
    expect(r.sessions).toEqual([])
    expect(r.summary.total).toBe(0)
  })

  it('parses a single row', () => {
    const csv = `${HEADER}\n2026-04-15,Running,3600,12.5,85,6,Long run`
    const r = parseRunalyzeCSV(csv)
    expect(r.sessions).toHaveLength(1)
    expect(r.sessions[0].type).toBe('Running')
    expect(r.sessions[0].distanceM).toBe(12500)
    expect(r.sessions[0].tss).toBe(85)
    expect(r.summary.parsed).toBe(1)
  })

  it('parses multiple rows of mixed sports', () => {
    const csv = [
      HEADER,
      '2026-04-15,Running,3600,12.5,85,6,Run',
      '2026-04-16,Cycling,5400,40,70,5,Bike',
      '2026-04-17,Swim,1800,2,40,5,Pool',
    ].join('\n')
    const r = parseRunalyzeCSV(csv)
    expect(r.sessions).toHaveLength(3)
    expect(r.sessions.map(s => s.type)).toEqual(['Running', 'Cycling', 'Swimming'])
  })

  it('strips BOM marker from start', () => {
    const csv = `﻿${HEADER}\n2026-04-15,Running,3600,12.5,85,6,`
    const r = parseRunalyzeCSV(csv)
    expect(r.sessions).toHaveLength(1)
  })

  it('handles Windows CRLF line endings', () => {
    const csv = `${HEADER}\r\n2026-04-15,Running,3600,12.5,85,6,\r\n`
    const r = parseRunalyzeCSV(csv)
    expect(r.sessions).toHaveLength(1)
  })

  it('handles quoted commas in Notes field', () => {
    const csv = `${HEADER}\n2026-04-15,Running,3600,12.5,85,6,"Long, slow run"`
    const r = parseRunalyzeCSV(csv)
    expect(r.sessions).toHaveLength(1)
    expect(r.sessions[0].notes).toBe('Long, slow run')
  })

  it('skips empty lines silently', () => {
    const csv = `${HEADER}\n\n2026-04-15,Running,3600,12.5,85,6,\n\n`
    const r = parseRunalyzeCSV(csv)
    expect(r.sessions).toHaveLength(1)
    expect(r.summary.total).toBe(1)
  })

  it('reports rows missing Date in errors', () => {
    const csv = `${HEADER}\n,Running,3600,12.5,85,6,No date`
    const r = parseRunalyzeCSV(csv)
    expect(r.sessions).toHaveLength(0)
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.errors[0].reason).toMatch(/Date/i)
  })

  it('reports header missing required columns', () => {
    const csv = `Sport,Notes\nRunning,test`
    const r = parseRunalyzeCSV(csv)
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.errors[0].reason).toMatch(/Missing required columns/)
  })

  it('errors do not block valid rows from importing', () => {
    const csv = [
      HEADER,
      'bad-date,Running,3600,12.5,85,6,Bad row',
      '2026-04-15,Running,3600,12.5,85,6,Good row',
    ].join('\n')
    const r = parseRunalyzeCSV(csv)
    expect(r.sessions).toHaveLength(1)
    expect(r.errors.length).toBeGreaterThan(0)
  })

  it('200-row CSV completes under 500ms', () => {
    const rows = Array.from({ length: 200 }, (_, i) => {
      const day = String((i % 28) + 1).padStart(2, '0')
      return `2026-04-${day},Running,3600,10,50,5,row${i}`
    })
    const csv = [HEADER, ...rows].join('\n')
    const start = performance.now()
    const r = parseRunalyzeCSV(csv)
    const elapsed = performance.now() - start
    expect(r.sessions).toHaveLength(200)
    expect(elapsed).toBeLessThan(500)
  })

  it('summary counts add up', () => {
    const csv = [
      HEADER,
      '2026-04-15,Running,3600,,,,',
      'bad,Running,3600,,,,',
      '2026-04-16,Running,3600,,,,',
    ].join('\n')
    const r = parseRunalyzeCSV(csv)
    expect(r.summary.total).toBe(3)
    expect(r.summary.parsed).toBe(2)
    expect(r.summary.skipped).toBe(1)
  })
})

// ── dedupAgainstLog ───────────────────────────────────────────────────────────
describe('dedupAgainstLog (Runalyze)', () => {
  it('returns all newSessions when existingLog is empty', () => {
    const newS = [{ date: '2026-04-15', type: 'Running', duration: 60 }]
    expect(dedupAgainstLog(newS, [])).toEqual(newS)
    expect(dedupAgainstLog(newS, null)).toEqual(newS)
  })

  it('returns empty for non-array newSessions', () => {
    expect(dedupAgainstLog(null, [])).toEqual([])
  })

  it('filters exact duplicate by date+type+duration', () => {
    const existing = [{ date: '2026-04-15', type: 'Running', duration: 60 }]
    const newS = [{ date: '2026-04-15', type: 'Running', duration: 60 }]
    expect(dedupAgainstLog(newS, existing)).toEqual([])
  })

  it('filters near-duplicate within ±5 min tolerance', () => {
    const existing = [{ date: '2026-04-15', type: 'Running', duration: 60 }]
    const newS = [{ date: '2026-04-15', type: 'Running', duration: 63 }]
    expect(dedupAgainstLog(newS, existing)).toEqual([])
  })

  it('does NOT filter when duration differs by > 5 min', () => {
    const existing = [{ date: '2026-04-15', type: 'Running', duration: 60 }]
    const newS = [{ date: '2026-04-15', type: 'Running', duration: 90 }]
    expect(dedupAgainstLog(newS, existing)).toHaveLength(1)
  })

  it('handles mixed dup and non-dup', () => {
    const existing = [{ date: '2026-04-15', type: 'Running', duration: 60 }]
    const newS = [
      { date: '2026-04-15', type: 'Running', duration: 60 },
      { date: '2026-04-16', type: 'Running', duration: 60 },
      { date: '2026-04-15', type: 'Cycling', duration: 60 },
    ]
    expect(dedupAgainstLog(newS, existing)).toHaveLength(2)
  })
})

// ── importRunalyzeCSV (end-to-end) ────────────────────────────────────────────
describe('importRunalyzeCSV', () => {
  const HEADER = 'Date,Sport,Time,Distance,TRIMP,RPE,Notes'

  it('returns parsed sessions when log is empty', () => {
    const csv = `${HEADER}\n2026-04-15,Running,3600,12.5,85,6,`
    const r = importRunalyzeCSV(csv, [])
    expect(r.toImport).toHaveLength(1)
    expect(r.duplicates).toHaveLength(0)
  })

  it('separates duplicates from new sessions', () => {
    const csv = [
      HEADER,
      '2026-04-15,Running,3600,12.5,85,6,',
      '2026-04-16,Running,3600,12.5,85,6,',
      '2026-04-17,Running,3600,12.5,85,6,',
    ].join('\n')
    const existing = [{ date: '2026-04-15', type: 'Running', duration: 60 }]
    const r = importRunalyzeCSV(csv, existing)
    expect(r.toImport).toHaveLength(2)
    expect(r.duplicates).toHaveLength(1)
    expect(r.duplicates[0].date).toBe('2026-04-15')
  })

  it('summary includes duplicates and toImport counts', () => {
    const csv = [HEADER, '2026-04-15,Running,3600,12.5,85,6,'].join('\n')
    const existing = [{ date: '2026-04-15', type: 'Running', duration: 60 }]
    const r = importRunalyzeCSV(csv, existing)
    expect(r.summary.duplicates).toBe(1)
    expect(r.summary.toImport).toBe(0)
    expect(r.summary.total).toBe(1)
  })

  it('idempotency: re-importing previously-imported rows yields zero new', () => {
    const csv = `${HEADER}\n2026-04-15,Running,3600,12.5,85,6,`
    const first = importRunalyzeCSV(csv, [])
    expect(first.toImport).toHaveLength(1)
    const second = importRunalyzeCSV(csv, first.toImport)
    expect(second.toImport).toHaveLength(0)
    expect(second.duplicates).toHaveLength(1)
  })

  it('passes errors through to result', () => {
    const csv = [HEADER, 'bad-date,Running,3600,12.5,85,6,'].join('\n')
    const r = importRunalyzeCSV(csv, [])
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.toImport).toHaveLength(0)
  })

  it('every imported session has source=runalyze_csv (invariant)', () => {
    const csv = [
      HEADER,
      '2026-04-15,Running,3600,12.5,85,6,',
      '2026-04-16,Cycling,5400,40,70,5,',
      '2026-04-17,Swim,1800,2,40,5,',
    ].join('\n')
    const r = importRunalyzeCSV(csv, [])
    expect(r.toImport).toHaveLength(3)
    for (const s of r.toImport) {
      expect(s.source).toBe('runalyze_csv')
    }
  })
})
