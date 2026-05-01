// src/lib/__tests__/sport/athleteDataBridge.test.js — E105
import { describe, it, expect } from 'vitest'
import {
  deriveCtlAtl,
  findRecentResult,
  sessionFrequencyPerWeek,
  extractProfileSport,
  fmtTimeInput,
  parseTimeInput,
} from '../../sport/athleteDataBridge.js'

// ── Helper: recent log entries ending today ───────────────────────────────────
function makeLog(days, tss = 80, type = 'run') {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today)
    d.setUTCDate(today.getUTCDate() - (days - 1 - i))
    return { date: d.toISOString().slice(0, 10), tss, type, duration: 60 }
  })
}

// ── deriveCtlAtl ─────────────────────────────────────────────────────────────
describe('deriveCtlAtl', () => {
  it('returns {ctl:0,atl:0} for null', () => {
    expect(deriveCtlAtl(null)).toEqual({ ctl: 0, atl: 0 })
  })

  it('returns {ctl:0,atl:0} for empty array', () => {
    expect(deriveCtlAtl([])).toEqual({ ctl: 0, atl: 0 })
  })

  it('returns numeric ctl and atl for valid log', () => {
    const r = deriveCtlAtl(makeLog(30, 80))
    expect(typeof r.ctl).toBe('number')
    expect(typeof r.atl).toBe('number')
    expect(r.ctl).toBeGreaterThan(0)
    expect(r.atl).toBeGreaterThan(0)
  })

  it('ATL > CTL after a short constant-load period (ATL converges faster)', () => {
    const r = deriveCtlAtl(makeLog(14, 100))
    expect(r.atl).toBeGreaterThan(r.ctl)
  })
})

// ── findRecentResult ──────────────────────────────────────────────────────────
describe('findRecentResult', () => {
  it('returns null for empty log', () => {
    expect(findRecentResult([], 'race')).toBeNull()
  })

  it('returns null when no match', () => {
    const log = [{ date: '2026-01-01', type: 'run', duration: 60 }]
    expect(findRecentResult(log, 'swim')).toBeNull()
  })

  it('returns most recent entry matching type', () => {
    const log = [
      { date: '2026-01-01', type: 'race 5k', distanceM: '5000', durationSec: '1200' },
      { date: '2026-03-01', type: 'race 5k', distanceM: '5000', durationSec: '1180' },
    ]
    const r = findRecentResult(log, 'race')
    expect(r.date).toBe('2026-03-01')
  })

  it('returns timeSec from durationSec field', () => {
    const log = [{ date: '2026-01-01', type: 'race', distanceM: '5000', durationSec: '1200' }]
    expect(findRecentResult(log, 'race').timeSec).toBe(1200)
  })

  it('falls back to duration×60 when durationSec missing', () => {
    const log = [{ date: '2026-01-01', type: 'race', distanceM: '5000', duration: 20 }]
    expect(findRecentResult(log, 'race').timeSec).toBe(1200)
  })

  it('filters by distanceM when provided (±10m tolerance)', () => {
    const log = [
      { date: '2026-01-01', type: 'race', distanceM: '5000', durationSec: '1200' },
      { date: '2026-03-01', type: 'race', distanceM: '10000', durationSec: '2400' },
    ]
    const r = findRecentResult(log, 'race', 5000)
    expect(r.date).toBe('2026-01-01')
  })

  it('type match is case-insensitive substring', () => {
    const log = [{ date: '2026-01-01', type: 'Long Run', distanceM: '10000', duration: 60 }]
    expect(findRecentResult(log, 'run')).not.toBeNull()
    expect(findRecentResult(log, 'RUN')).not.toBeNull()
  })
})

// ── sessionFrequencyPerWeek ───────────────────────────────────────────────────
describe('sessionFrequencyPerWeek', () => {
  it('returns 0 for empty log', () => {
    expect(sessionFrequencyPerWeek([])).toBe(0)
  })

  it('returns 0 for null log', () => {
    expect(sessionFrequencyPerWeek(null)).toBe(0)
  })

  it('returns correct frequency for 4-week log with 3 sessions/week', () => {
    // 12 sessions in 28 days = 3.0/week
    const log = makeLog(28, 80)
    // Use only every 2-3 days: create a log with 12 entries in 28 days
    const sparse = makeLog(12, 80)
    const result = sessionFrequencyPerWeek(sparse, 4)
    // 12 sessions / 4 weeks = 3.0
    expect(result).toBe(3)
  })

  it('result is rounded to 1 decimal', () => {
    // 5 sessions / 4 weeks = 1.25, rounded → 1.3
    const sparse = makeLog(5, 80)
    const result = sessionFrequencyPerWeek(sparse, 4)
    expect(String(result)).toMatch(/^\d+(\.\d)?$/)
  })

  it('excludes entries older than weeks×7 days', () => {
    const recent = makeLog(7, 80) // 7 sessions in last week
    const old = [{ date: '2020-01-01', tss: 80, type: 'run', duration: 60 }]
    const result = sessionFrequencyPerWeek([...recent, ...old], 4)
    expect(result).toBe(sessionFrequencyPerWeek(recent, 4))
  })

  it('custom weeks parameter changes denominator', () => {
    const log = makeLog(14, 80) // 14 sessions in 14 days
    const r1 = sessionFrequencyPerWeek(log, 2) // 14/2 = 7
    const r2 = sessionFrequencyPerWeek(log, 4) // 14/4 = 3.5
    expect(r1).not.toBe(r2)
    expect(r1).toBeGreaterThan(r2)
  })
})

// ── extractProfileSport ───────────────────────────────────────────────────────
describe('extractProfileSport', () => {
  it('returns null for null profile', () => {
    expect(extractProfileSport(null)).toBeNull()
  })

  it('returns null for empty sport strings', () => {
    expect(extractProfileSport({ sport: '', primarySport: '' })).toBeNull()
  })

  it('maps "running" → "running"', () => {
    expect(extractProfileSport({ sport: 'running' })).toBe('running')
  })

  it('maps "run" → "running"', () => {
    expect(extractProfileSport({ sport: 'run' })).toBe('running')
  })

  it('maps "cycling" → "cycling"', () => {
    expect(extractProfileSport({ sport: 'cycling' })).toBe('cycling')
  })

  it('maps "bike" → "cycling"', () => {
    expect(extractProfileSport({ sport: 'bike' })).toBe('cycling')
  })

  it('maps "swimming" → "swimming"', () => {
    expect(extractProfileSport({ primarySport: 'swimming' })).toBe('swimming')
  })

  it('maps "triathlon" → "triathlon"', () => {
    expect(extractProfileSport({ sport: 'triathlon' })).toBe('triathlon')
  })

  it('maps "rowing" → "rowing"', () => {
    expect(extractProfileSport({ sport: 'rowing' })).toBe('rowing')
  })

  it('prefers primarySport over sport', () => {
    expect(extractProfileSport({ sport: 'cycling', primarySport: 'running' })).toBe('running')
  })

  it('is case-insensitive', () => {
    expect(extractProfileSport({ sport: 'RUNNING' })).toBe('running')
    expect(extractProfileSport({ sport: 'Cycling' })).toBe('cycling')
  })

  it('returns null for unrecognised sport', () => {
    expect(extractProfileSport({ sport: 'football' })).toBeNull()
  })
})

// ── fmtTimeInput ─────────────────────────────────────────────────────────────
describe('fmtTimeInput', () => {
  it('returns empty string for 0', () => {
    expect(fmtTimeInput(0)).toBe('')
  })

  it('returns empty string for null/undefined', () => {
    expect(fmtTimeInput(null)).toBe('')
    expect(fmtTimeInput(undefined)).toBe('')
  })

  it('formats 60s as "1:00"', () => {
    expect(fmtTimeInput(60)).toBe('1:00')
  })

  it('formats 90s as "1:30"', () => {
    expect(fmtTimeInput(90)).toBe('1:30')
  })

  it('formats 3600s as "60:00"', () => {
    expect(fmtTimeInput(3600)).toBe('60:00')
  })

  it('pads seconds to 2 digits', () => {
    expect(fmtTimeInput(65)).toBe('1:05')
  })

  it('formats 1200s (20 min) as "20:00"', () => {
    expect(fmtTimeInput(1200)).toBe('20:00')
  })

  it('negative value returns empty string', () => {
    expect(fmtTimeInput(-10)).toBe('')
  })
})

// ── parseTimeInput ────────────────────────────────────────────────────────────
describe('parseTimeInput', () => {
  it('returns null for null/undefined/empty', () => {
    expect(parseTimeInput(null)).toBeNull()
    expect(parseTimeInput(undefined)).toBeNull()
    expect(parseTimeInput('')).toBeNull()
  })

  it('parses "1:00" as 60', () => {
    expect(parseTimeInput('1:00')).toBe(60)
  })

  it('parses "1:30" as 90', () => {
    expect(parseTimeInput('1:30')).toBe(90)
  })

  it('parses "20:00" as 1200', () => {
    expect(parseTimeInput('20:00')).toBe(1200)
  })

  it('parses plain seconds string', () => {
    expect(parseTimeInput('90')).toBe(90)
  })

  it('returns null for non-numeric string', () => {
    expect(parseTimeInput('abc')).toBeNull()
  })

  it('round-trips with fmtTimeInput', () => {
    for (const sec of [60, 90, 300, 1200, 3661]) {
      expect(parseTimeInput(fmtTimeInput(sec))).toBe(sec)
    }
  })
})
