// src/lib/__tests__/integrations/garminConnectImport.test.js — Garmin Connect CSV
import { describe, it, expect } from 'vitest'
import {
  mapWorkoutType,
  parseCSVLine,
  parseDate,
  parseDuration,
  parseDistance,
  mapRowToSession,
  parseGarminConnectCSV,
  dedupAgainstLog,
  importGarminConnectCSV,
} from '../../integrations/garminConnectImport.js'

// ── mapWorkoutType ────────────────────────────────────────────────────────────
describe('mapWorkoutType (Garmin)', () => {
  it('maps Running variants → Running', () => {
    expect(mapWorkoutType('Running')).toBe('Running')
    expect(mapWorkoutType('Treadmill Running')).toBe('Running')
    expect(mapWorkoutType('Trail Running')).toBe('Running')
    expect(mapWorkoutType('Track Running')).toBe('Running')
  })

  it('maps Cycling variants → Cycling', () => {
    expect(mapWorkoutType('Cycling')).toBe('Cycling')
    expect(mapWorkoutType('Road Cycling')).toBe('Cycling')
    expect(mapWorkoutType('Mountain Biking')).toBe('Cycling')
    expect(mapWorkoutType('Indoor Cycling')).toBe('Cycling')
    expect(mapWorkoutType('Virtual Ride')).toBe('Cycling')
    expect(mapWorkoutType('Gravel Cycling')).toBe('Cycling')
  })

  it('maps Swim variants → Swimming', () => {
    expect(mapWorkoutType('Pool Swimming')).toBe('Swimming')
    expect(mapWorkoutType('Open Water Swimming')).toBe('Swimming')
    expect(mapWorkoutType('Swim')).toBe('Swimming')
  })

  it('maps Strength Training/Cardio → Strength', () => {
    expect(mapWorkoutType('Strength Training')).toBe('Strength')
    expect(mapWorkoutType('Cardio')).toBe('Strength')
    expect(mapWorkoutType('Weights')).toBe('Strength')
  })

  it('maps Walking/Hike/Hiking → Walking', () => {
    expect(mapWorkoutType('Walking')).toBe('Walking')
    expect(mapWorkoutType('Hiking')).toBe('Walking')
    expect(mapWorkoutType('Hike')).toBe('Walking')
  })

  it('maps Rowing/Indoor Rowing → Rowing', () => {
    expect(mapWorkoutType('Rowing')).toBe('Rowing')
    expect(mapWorkoutType('Indoor Rowing')).toBe('Rowing')
  })

  it('maps Yoga/Pilates/Multisport/Triathlon → Other', () => {
    expect(mapWorkoutType('Yoga')).toBe('Other')
    expect(mapWorkoutType('Pilates')).toBe('Other')
    expect(mapWorkoutType('Multisport')).toBe('Other')
    expect(mapWorkoutType('Triathlon')).toBe('Other')
  })

  it('maps unknown/empty/null → Other', () => {
    expect(mapWorkoutType('')).toBe('Other')
    expect(mapWorkoutType(null)).toBe('Other')
    expect(mapWorkoutType(undefined)).toBe('Other')
    expect(mapWorkoutType('SUP')).toBe('Other')
  })
})

// ── parseCSVLine ──────────────────────────────────────────────────────────────
describe('parseCSVLine (Garmin)', () => {
  it('parses simple comma-separated fields', () => {
    expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c'])
  })

  it('handles quoted fields with embedded commas', () => {
    expect(parseCSVLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd'])
  })

  it('handles escaped double-quotes', () => {
    expect(parseCSVLine('"he said ""hi""",b')).toEqual(['he said "hi"', 'b'])
  })
})

// ── parseDate ─────────────────────────────────────────────────────────────────
describe('parseDate (Garmin)', () => {
  it('parses YYYY-MM-DD HH:MM:SS', () => {
    expect(parseDate('2026-04-15 08:30:00')).toBe('2026-04-15')
  })

  it('parses YYYY-MM-DDTHH:MM:SS', () => {
    expect(parseDate('2026-04-15T08:30:00')).toBe('2026-04-15')
  })

  it('parses bare YYYY-MM-DD', () => {
    expect(parseDate('2026-04-15')).toBe('2026-04-15')
  })

  it('zero-pads single-digit month/day', () => {
    expect(parseDate('2026-4-5')).toBe('2026-04-05')
  })

  it('returns null for unparseable input', () => {
    expect(parseDate('not a date')).toBeNull()
    expect(parseDate('15.04.2026')).toBeNull()
    expect(parseDate('04/15/2026')).toBeNull()
  })

  it('returns null for null/empty/whitespace', () => {
    expect(parseDate(null)).toBeNull()
    expect(parseDate('')).toBeNull()
    expect(parseDate(undefined)).toBeNull()
    expect(parseDate('   ')).toBeNull()
  })

  it('returns null for invalid month/day', () => {
    expect(parseDate('2026-13-01')).toBeNull()
    expect(parseDate('2026-01-32')).toBeNull()
  })
})

// ── parseDuration ─────────────────────────────────────────────────────────────
describe('parseDuration (Garmin)', () => {
  it('parses HH:MM:SS', () => {
    expect(parseDuration('01:30:00')).toBe(90)
    expect(parseDuration('00:45:30')).toBe(45.5)
    expect(parseDuration('02:00:00')).toBe(120)
  })

  it('parses MM:SS (two-part minutes:seconds)', () => {
    expect(parseDuration('45:30')).toBe(45.5)
    expect(parseDuration('30:00')).toBe(30)
  })

  it('parses HH:MM:SS with fractional seconds', () => {
    expect(parseDuration('00:30:30.5')).toBeCloseTo(30.508, 2)
  })

  it('parses raw seconds (numeric form)', () => {
    expect(parseDuration('3600')).toBe(60)
  })

  it('returns null for null/empty', () => {
    expect(parseDuration(null)).toBeNull()
    expect(parseDuration('')).toBeNull()
    expect(parseDuration(undefined)).toBeNull()
  })

  it('returns null for invalid colon form', () => {
    expect(parseDuration('xx:yy:zz')).toBeNull()
  })

  it('returns null for non-numeric non-colon values', () => {
    expect(parseDuration('abc')).toBeNull()
  })

  it('returns null for negative seconds', () => {
    expect(parseDuration('-100')).toBeNull()
  })
})

// ── parseDistance ─────────────────────────────────────────────────────────────
describe('parseDistance (Garmin)', () => {
  it('parses kilometers with km suffix', () => {
    expect(parseDistance('10.5 km')).toBe(10500)
    expect(parseDistance('10.5km')).toBe(10500)
    expect(parseDistance('1 km')).toBe(1000)
  })

  it('parses miles and converts to meters', () => {
    expect(parseDistance('5 mi')).toBeCloseTo(8046.72, 1)
    expect(parseDistance('1mi')).toBeCloseTo(1609.34, 1)
    expect(parseDistance('5 miles')).toBeCloseTo(8046.72, 1)
  })

  it('parses meters with m suffix', () => {
    expect(parseDistance('500 m')).toBe(500)
    expect(parseDistance('1500m')).toBe(1500)
  })

  it('defaults to km when no unit', () => {
    expect(parseDistance('10.5')).toBe(10500)
  })

  it('strips comma thousands separators', () => {
    expect(parseDistance('1,234.5 km')).toBe(1234500)
  })

  it('returns null for unparseable values', () => {
    expect(parseDistance('abc')).toBeNull()
    expect(parseDistance('-')).toBeNull()
    expect(parseDistance('--')).toBeNull()
  })

  it('returns null for null/empty', () => {
    expect(parseDistance(null)).toBeNull()
    expect(parseDistance('')).toBeNull()
    expect(parseDistance(undefined)).toBeNull()
  })

  it('returns null for negative values', () => {
    expect(parseDistance('-5 km')).toBeNull()
  })

  it('handles zero distance', () => {
    expect(parseDistance('0 km')).toBe(0)
  })
})

// ── mapRowToSession ───────────────────────────────────────────────────────────
describe('mapRowToSession (Garmin)', () => {
  it('maps a complete row correctly', () => {
    const row = {
      'Activity Type': 'Running',
      Date: '2026-04-15 08:30:00',
      Time: '01:30:00',
      Distance: '15.0 km',
      'Avg HR': '145',
      'Max HR': '170',
      'Aerobic TE': '3.2',
      Calories: '850',
      Title: 'Morning Run',
    }
    const s = mapRowToSession(row)
    expect(s.date).toBe('2026-04-15')
    expect(s.type).toBe('Running')
    expect(s.duration).toBe(90)
    expect(s.distanceM).toBe(15000)
    expect(s.source).toBe('garmin_csv')
    expect(s.tss).toBeUndefined()  // Garmin doesn't export TSS
    expect(s.notes).toContain('Morning Run')
    expect(s.notes).toContain('Avg HR: 145')
    expect(s.notes).toContain('850 kcal')
  })

  it('handles miles distance', () => {
    const row = {
      'Activity Type': 'Running',
      Date: '2026-04-15',
      Time: '01:00:00',
      Distance: '6.21 mi',
    }
    const s = mapRowToSession(row)
    expect(s.distanceM).toBeCloseTo(9994.03, 1)
  })

  it('returns null without a Date', () => {
    expect(mapRowToSession({ Time: '01:00:00' })).toBeNull()
  })

  it('returns null without Time', () => {
    expect(mapRowToSession({ Date: '2026-04-15' })).toBeNull()
  })

  it('returns null for null/non-object input', () => {
    expect(mapRowToSession(null)).toBeNull()
    expect(mapRowToSession('string')).toBeNull()
    expect(mapRowToSession(42)).toBeNull()
  })

  it('always sets source to garmin_csv', () => {
    const s = mapRowToSession({ Date: '2026-04-15', Time: '01:00:00' })
    expect(s.source).toBe('garmin_csv')
  })

  it('never sets tss (Garmin does not export TSS)', () => {
    const s = mapRowToSession({
      Date: '2026-04-15',
      Time: '01:00:00',
      'Aerobic TE': '4.5',  // training effect — must NOT map to tss
    })
    expect(s.tss).toBeUndefined()
  })

  it('omits distanceM/notes when fields are empty', () => {
    const s = mapRowToSession({ Date: '2026-04-15', Time: '01:00:00' })
    expect(s.distanceM).toBeUndefined()
    expect(s.notes).toBeUndefined()
  })

  it('defaults type to Other for unknown Activity Type', () => {
    const s = mapRowToSession({
      'Activity Type': 'Surfing',
      Date: '2026-04-15',
      Time: '01:00:00',
    })
    expect(s.type).toBe('Other')
  })

  it('skips unparseable Distance silently', () => {
    const s = mapRowToSession({
      Date: '2026-04-15',
      Time: '01:00:00',
      Distance: 'abc',
    })
    expect(s.distanceM).toBeUndefined()
  })

  it('ignores "--" placeholder values in HR/Calories', () => {
    const s = mapRowToSession({
      Date: '2026-04-15',
      Time: '01:00:00',
      'Avg HR': '--',
      Calories: '--',
      Title: 'Quick Walk',
    })
    expect(s.notes).toBe('Quick Walk')
  })
})

// ── parseGarminConnectCSV ─────────────────────────────────────────────────────
describe('parseGarminConnectCSV', () => {
  const HEADER = 'Activity Type,Date,Time,Distance,Avg HR,Max HR,Aerobic TE,Calories,Title'

  it('returns empty for null/empty input', () => {
    expect(parseGarminConnectCSV(null).sessions).toEqual([])
    expect(parseGarminConnectCSV('').sessions).toEqual([])
    expect(parseGarminConnectCSV('   ').sessions).toEqual([])
  })

  it('returns empty for header-only input', () => {
    const r = parseGarminConnectCSV(HEADER)
    expect(r.sessions).toEqual([])
    expect(r.summary.total).toBe(0)
  })

  it('parses a single row', () => {
    const csv = `${HEADER}\nRunning,2026-04-15 08:30:00,01:30:00,15.0 km,145,170,3.2,850,Morning Run`
    const r = parseGarminConnectCSV(csv)
    expect(r.sessions).toHaveLength(1)
    expect(r.sessions[0].type).toBe('Running')
    expect(r.sessions[0].distanceM).toBe(15000)
    expect(r.sessions[0].tss).toBeUndefined()
  })

  it('parses multiple rows of mixed activity types', () => {
    const csv = [
      HEADER,
      'Running,2026-04-15 08:00:00,01:00:00,10 km,140,160,2.8,500,Run',
      'Cycling,2026-04-16 10:00:00,02:00:00,40 km,135,165,3.5,1200,Bike',
      'Pool Swimming,2026-04-17 18:00:00,00:45:00,2 km,120,140,2.5,300,Pool',
    ].join('\n')
    const r = parseGarminConnectCSV(csv)
    expect(r.sessions).toHaveLength(3)
    expect(r.sessions.map(s => s.type)).toEqual(['Running', 'Cycling', 'Swimming'])
  })

  it('handles miles units in Distance column', () => {
    const csv = `${HEADER}\nRunning,2026-04-15,01:00:00,6.21 mi,140,160,2.8,500,Run`
    const r = parseGarminConnectCSV(csv)
    expect(r.sessions[0].distanceM).toBeCloseTo(9994.03, 1)
  })

  it('strips BOM marker from start', () => {
    const csv = `﻿${HEADER}\nRunning,2026-04-15,01:00:00,10 km,,,,,`
    const r = parseGarminConnectCSV(csv)
    expect(r.sessions).toHaveLength(1)
  })

  it('handles Windows CRLF line endings', () => {
    const csv = `${HEADER}\r\nRunning,2026-04-15,01:00:00,10 km,,,,,\r\n`
    const r = parseGarminConnectCSV(csv)
    expect(r.sessions).toHaveLength(1)
  })

  it('handles quoted commas in Title field', () => {
    const csv = `${HEADER}\nRunning,2026-04-15,01:00:00,10 km,,,,,"Long, slow run"`
    const r = parseGarminConnectCSV(csv)
    expect(r.sessions).toHaveLength(1)
    expect(r.sessions[0].notes).toContain('Long, slow run')
  })

  it('skips empty lines silently', () => {
    const csv = `${HEADER}\n\nRunning,2026-04-15,01:00:00,10 km,,,,,\n\n`
    const r = parseGarminConnectCSV(csv)
    expect(r.sessions).toHaveLength(1)
    expect(r.summary.total).toBe(1)
  })

  it('reports rows missing Date in errors', () => {
    const csv = `${HEADER}\nRunning,,01:00:00,10 km,,,,,No date`
    const r = parseGarminConnectCSV(csv)
    expect(r.sessions).toHaveLength(0)
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.errors[0].reason).toMatch(/Date/i)
  })

  it('reports header missing required columns', () => {
    const csv = `Activity Type,Title\nRunning,test`
    const r = parseGarminConnectCSV(csv)
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.errors[0].reason).toMatch(/Missing required columns/)
  })

  it('errors do not block valid rows from importing', () => {
    const csv = [
      HEADER,
      'Running,bad-date,01:00:00,10 km,,,,,Bad',
      'Running,2026-04-15,01:00:00,10 km,,,,,Good',
    ].join('\n')
    const r = parseGarminConnectCSV(csv)
    expect(r.sessions).toHaveLength(1)
    expect(r.errors.length).toBeGreaterThan(0)
  })

  it('200-row CSV completes under 500ms', () => {
    const rows = Array.from({ length: 200 }, (_, i) => {
      const day = String((i % 28) + 1).padStart(2, '0')
      return `Running,2026-04-${day},01:00:00,10 km,140,160,2.8,500,r${i}`
    })
    const csv = [HEADER, ...rows].join('\n')
    const start = performance.now()
    const r = parseGarminConnectCSV(csv)
    const elapsed = performance.now() - start
    expect(r.sessions).toHaveLength(200)
    expect(elapsed).toBeLessThan(500)
  })

  it('summary counts add up', () => {
    const csv = [
      HEADER,
      'Running,2026-04-15,01:00:00,10 km,,,,,',
      'Running,bad,01:00:00,10 km,,,,,',
      'Running,2026-04-16,01:00:00,10 km,,,,,',
    ].join('\n')
    const r = parseGarminConnectCSV(csv)
    expect(r.summary.total).toBe(3)
    expect(r.summary.parsed).toBe(2)
    expect(r.summary.skipped).toBe(1)
  })
})

// ── dedupAgainstLog ───────────────────────────────────────────────────────────
describe('dedupAgainstLog (Garmin)', () => {
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
    const newS = [{ date: '2026-04-15', type: 'Running', duration: 64 }]
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

// ── importGarminConnectCSV (end-to-end) ───────────────────────────────────────
describe('importGarminConnectCSV', () => {
  const HEADER = 'Activity Type,Date,Time,Distance,Avg HR,Max HR,Aerobic TE,Calories,Title'

  it('returns parsed sessions when log is empty', () => {
    const csv = `${HEADER}\nRunning,2026-04-15,01:00:00,10 km,,,,,`
    const r = importGarminConnectCSV(csv, [])
    expect(r.toImport).toHaveLength(1)
    expect(r.duplicates).toHaveLength(0)
  })

  it('separates duplicates from new sessions', () => {
    const csv = [
      HEADER,
      'Running,2026-04-15,01:00:00,10 km,,,,,',
      'Running,2026-04-16,01:00:00,10 km,,,,,',
      'Running,2026-04-17,01:00:00,10 km,,,,,',
    ].join('\n')
    const existing = [{ date: '2026-04-15', type: 'Running', duration: 60 }]
    const r = importGarminConnectCSV(csv, existing)
    expect(r.toImport).toHaveLength(2)
    expect(r.duplicates).toHaveLength(1)
    expect(r.duplicates[0].date).toBe('2026-04-15')
  })

  it('summary includes duplicates and toImport counts', () => {
    const csv = [HEADER, 'Running,2026-04-15,01:00:00,10 km,,,,,'].join('\n')
    const existing = [{ date: '2026-04-15', type: 'Running', duration: 60 }]
    const r = importGarminConnectCSV(csv, existing)
    expect(r.summary.duplicates).toBe(1)
    expect(r.summary.toImport).toBe(0)
  })

  it('idempotency: re-importing previously-imported rows yields zero new', () => {
    const csv = `${HEADER}\nRunning,2026-04-15,01:00:00,10 km,,,,,`
    const first = importGarminConnectCSV(csv, [])
    expect(first.toImport).toHaveLength(1)
    const second = importGarminConnectCSV(csv, first.toImport)
    expect(second.toImport).toHaveLength(0)
    expect(second.duplicates).toHaveLength(1)
  })

  it('passes errors through to result', () => {
    const csv = [HEADER, 'Running,bad-date,01:00:00,10 km,,,,,'].join('\n')
    const r = importGarminConnectCSV(csv, [])
    expect(r.errors.length).toBeGreaterThan(0)
    expect(r.toImport).toHaveLength(0)
  })

  it('every imported session has source=garmin_csv (invariant)', () => {
    const csv = [
      HEADER,
      'Running,2026-04-15,01:00:00,10 km,,,,,',
      'Cycling,2026-04-16,01:30:00,30 km,,,,,',
      'Pool Swimming,2026-04-17,00:45:00,2 km,,,,,',
    ].join('\n')
    const r = importGarminConnectCSV(csv, [])
    expect(r.toImport).toHaveLength(3)
    for (const s of r.toImport) {
      expect(s.source).toBe('garmin_csv')
    }
  })

  it('every imported session has tss=undefined (Garmin invariant)', () => {
    const csv = [
      HEADER,
      'Running,2026-04-15,01:00:00,10 km,,,5.0,500,',
      'Cycling,2026-04-16,01:30:00,30 km,,,4.5,800,',
    ].join('\n')
    const r = importGarminConnectCSV(csv, [])
    for (const s of r.toImport) {
      expect(s.tss).toBeUndefined()
    }
  })
})
