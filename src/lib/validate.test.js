// src/lib/validate.test.js
import { describe, it, expect } from 'vitest'
import { sanitizeString, sanitizeNumber, sanitizeDate, sanitizeLogEntry, sanitizeProfile } from './validate.js'

describe('sanitizeString', () => {
  it('returns empty string for null', () => {
    expect(sanitizeString(null)).toBe('')
  })
  it('coerces numbers to string', () => {
    expect(sanitizeString(42)).toBe('42')
  })
  it('trims whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello')
  })
  it('truncates to maxLen', () => {
    expect(sanitizeString('abcde', 3)).toBe('abc')
  })
})

describe('sanitizeNumber', () => {
  it('parses valid number string', () => {
    expect(sanitizeNumber('42', 0, 100)).toBe(42)
  })
  it('clamps to min', () => {
    expect(sanitizeNumber(-10, 0, 100)).toBe(0)
  })
  it('clamps to max', () => {
    expect(sanitizeNumber(200, 0, 100)).toBe(100)
  })
  it('returns 0 for NaN', () => {
    expect(sanitizeNumber('abc', 0, 100)).toBe(0)
  })
})

describe('sanitizeDate', () => {
  it('accepts valid ISO date', () => {
    expect(sanitizeDate('2025-06-15')).toBe('2025-06-15')
  })
  it('returns a valid date string (today) for invalid input', () => {
    const result = sanitizeDate('not-a-date')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('sanitizeLogEntry', () => {
  it('preserves valid entry fields', () => {
    const e = { date:'2025-01-01', type:'Easy Run', duration:60, rpe:6, tss:50, notes:'Good session' }
    const out = sanitizeLogEntry(e)
    expect(out.type).toBe('Easy Run')
    expect(out.duration).toBe(60)
    expect(out.rpe).toBe(6)
    expect(out.notes).toBe('Good session')
  })
  it('clamps RPE to 0-10', () => {
    const e = { date:'2025-01-01', type:'run', duration:60, rpe:15, tss:50 }
    expect(sanitizeLogEntry(e).rpe).toBe(10)
  })
  it('v9.469 — missing rpe stays null (clamp(null)→0 was a second fabrication)', () => {
    const base = { date:'2025-01-01', type:'run', duration:60, tss:50 }
    expect(sanitizeLogEntry({ ...base }).rpe).toBeNull()
    expect(sanitizeLogEntry({ ...base, rpe: null }).rpe).toBeNull()
    expect(sanitizeLogEntry({ ...base, rpe: '' }).rpe).toBeNull()
    expect(sanitizeLogEntry({ ...base, rpe: 6 }).rpe).toBe(6)
  })
  it('v9.472 — non-numeric rpe garbage is also null, not 0 (audit LOW-1: parseInt("null")→NaN path)', () => {
    const base = { date:'2025-01-01', type:'run', duration:60, tss:50 }
    expect(sanitizeLogEntry({ ...base, rpe: 'x' }).rpe).toBeNull()
    expect(sanitizeLogEntry({ ...base, rpe: NaN }).rpe).toBeNull()
    expect(sanitizeLogEntry({ ...base, rpe: 'null' }).rpe).toBeNull()
    expect(sanitizeLogEntry({ ...base, rpe: '7' }).rpe).toBe(7)
  })
  it('clamps duration to 0+', () => {
    const e = { date:'2025-01-01', type:'run', duration:-5, rpe:5, tss:50 }
    expect(sanitizeLogEntry(e).duration).toBe(0)
  })
  it('defaults type to Easy Run when empty', () => {
    const e = { date:'2025-01-01', type:'', duration:60, rpe:5, tss:50 }
    expect(sanitizeLogEntry(e).type).toBe('Easy Run')
  })
  it('sanitizes zones array', () => {
    const e = { date:'2025-01-01', type:'run', duration:60, rpe:5, tss:50, zones:[10,20,30,0,0] }
    const out = sanitizeLogEntry(e)
    expect(out.zones).toHaveLength(5)
    expect(out.zones[0]).toBe(10)
  })
  it('preserves distanceM, durationSec, avgHR for VO2max estimation', () => {
    const e = { date:'2025-01-01', type:'run', duration:45, rpe:6, tss:60, distanceM:10000, durationSec:2700, avgHR:155 }
    const out = sanitizeLogEntry(e)
    expect(out.distanceM).toBe(10000)
    expect(out.durationSec).toBe(2700)
    expect(out.avgHR).toBe(155)
  })
  it('drops invalid distanceM / avgHR', () => {
    const e = { date:'2025-01-01', type:'run', duration:60, rpe:5, tss:50, distanceM:-5, avgHR:0 }
    const out = sanitizeLogEntry(e)
    expect(out.distanceM).toBeUndefined()
    expect(out.avgHR).toBeUndefined()
  })
  it('rejects out-of-range avgHR / avgCadence (physiological bounds)', () => {
    const out = sanitizeLogEntry({ date:'2025-01-01', type:'run', duration:60, rpe:5, tss:50, avgHR:300, avgCadence:5000 })
    expect(out.avgHR).toBeUndefined()
    expect(out.avgCadence).toBeUndefined()
    const ok = sanitizeLogEntry({ date:'2025-01-01', type:'run', duration:60, rpe:5, tss:50, avgHR:155, avgCadence:85 })
    expect(ok.avgHR).toBe(155)
    expect(ok.avgCadence).toBe(85)
  })
  it('rejects Infinity numeric fields (isNaN lets Infinity through; Number.isFinite does not)', () => {
    const e = { date:'2025-01-01', type:'run', duration:60, rpe:5, tss:50,
      distanceM: Infinity, distance: '1e999', distanceKm: Infinity, durationSec: Infinity }
    const out = sanitizeLogEntry(e)
    expect(out.distanceM).toBeUndefined()
    expect(out.distance).toBeUndefined()
    expect(out.distanceKm).toBeUndefined()
    expect(out.durationSec).toBeUndefined()
  })
  it('preserves decouplingPct (incl. 0 and negatives) and wPrimeMethod — FIT import sanitizes before setLog', () => {
    const base = { date:'2025-01-01', type:'Ride', duration:90, rpe:5, tss:80 }
    expect(sanitizeLogEntry({ ...base, decouplingPct: 7.5 }).decouplingPct).toBe(7.5)
    expect(sanitizeLogEntry({ ...base, decouplingPct: 0 }).decouplingPct).toBe(0)
    expect(sanitizeLogEntry({ ...base, decouplingPct: -3.2 }).decouplingPct).toBe(-3.2)
    expect(sanitizeLogEntry({ ...base, decouplingPct: 999 }).decouplingPct).toBeUndefined()
    expect(sanitizeLogEntry({ ...base, wPrimeMethod: 'measured' }).wPrimeMethod).toBe('measured')
    expect(sanitizeLogEntry({ ...base, wPrimeMethod: 'estimated' }).wPrimeMethod).toBe('estimated')
    expect(sanitizeLogEntry({ ...base, wPrimeMethod: 'guessed' }).wPrimeMethod).toBeUndefined()
  })
  it('preserves v9.465 Strava enrichment fields within plausibility bounds', () => {
    const base = { date:'2025-01-01', type:'row', duration:60, rpe:6, tss:70 }
    const out = sanitizeLogEntry({ ...base, avgPower: 185, maxHR: 178, elevationGainM: 240,
      kilojoules: 660, sufferScore: 55, startTime: '06:15', rpeMethod: 'derived_hr' })
    expect(out.avgPower).toBe(185)
    expect(out.maxHR).toBe(178)
    expect(out.elevationGainM).toBe(240)
    expect(out.kilojoules).toBe(660)
    expect(out.sufferScore).toBe(55)
    expect(out.startTime).toBe('06:15')
    expect(out.rpeMethod).toBe('derived_hr')
  })
  it('v9.480 — powerPeaks survives sanitization (validated shape), garbage dropped', () => {
    const base = { date:'2025-01-01', type:'Ride', duration:120, rpe:6, tss:90 }
    expect(sanitizeLogEntry({ ...base, powerPeaks: { p300: 310, lh300: 295 } }).powerPeaks).toEqual({ p300: 310, lh300: 295 })
    expect(sanitizeLogEntry({ ...base, powerPeaks: { p300: 9000 } }).powerPeaks).toBeUndefined()
    expect(sanitizeLogEntry({ ...base }).powerPeaks).toBeUndefined()
  })
  it('v9.474 — preserves Concept2 rowing fields (avg_spm, drag_factor, strokes, sport_type, avg_hr alias)', () => {
    const base = { date:'2025-01-01', type:'Row', duration:32, rpe:5, tss:55 }
    const out = sanitizeLogEntry({ ...base, sport_type: 'rowing', avg_spm: 22, drag_factor: 128, strokes: 704, avg_hr: 152 })
    expect(out.sport_type).toBe('rowing')
    expect(out.avg_spm).toBe(22)
    expect(out.drag_factor).toBe(128)
    expect(out.strokes).toBe(704)
    expect(out.avgHR).toBe(152)  // avg_hr alias → canonical avgHR
    const bad = sanitizeLogEntry({ ...base, avg_spm: 99, drag_factor: 400, strokes: -5 })
    expect(bad.avg_spm).toBeUndefined()
    expect(bad.drag_factor).toBeUndefined()
    expect(bad.strokes).toBeUndefined()
  })
  it('preserves calories within bounds, drops implausible values (v9.466)', () => {
    const base = { date:'2025-01-01', type:'Ride', duration:120, rpe:6, tss:90 }
    expect(sanitizeLogEntry({ ...base, calories: 950 }).calories).toBe(950)
    expect(sanitizeLogEntry({ ...base, calories: 0 }).calories).toBeUndefined()
    expect(sanitizeLogEntry({ ...base, calories: 50000 }).calories).toBeUndefined()
  })
  it('drops out-of-bounds enrichment values and malformed startTime', () => {
    const base = { date:'2025-01-01', type:'row', duration:60, rpe:6, tss:70 }
    const out = sanitizeLogEntry({ ...base, avgPower: 9000, maxHR: 300, elevationGainM: -4,
      kilojoules: Infinity, sufferScore: 5000, startTime: '25:99', rpeMethod: '' })
    expect(out.avgPower).toBeUndefined()
    expect(out.maxHR).toBeUndefined()
    expect(out.elevationGainM).toBeUndefined()
    expect(out.kilojoules).toBeUndefined()
    expect(out.sufferScore).toBeUndefined()
    expect(out.startTime).toBeUndefined()
    expect(out.rpeMethod).toBeUndefined()
  })
})

describe('sanitizeProfile', () => {
  it('trims name', () => {
    const out = sanitizeProfile({ name: '  John  ' })
    expect(out.name).toBe('John')
  })
  it('returns object even for empty input', () => {
    expect(typeof sanitizeProfile({})).toBe('object')
  })
  it('defaults gender to male if invalid', () => {
    expect(sanitizeProfile({ gender: 'alien' }).gender).toBe('male')
  })
  it('accepts female gender', () => {
    expect(sanitizeProfile({ gender: 'female' }).gender).toBe('female')
  })
  it('keeps ftp as string', () => {
    expect(typeof sanitizeProfile({ ftp: '250' }).ftp).toBe('string')
  })

  // v9.100.0 — cssSec is now allowed through the whitelist
  it('preserves cssSec through sanitization (v9.100.0)', () => {
    expect(sanitizeProfile({ cssSec: 90 }).cssSec).toBe('90')
    expect(sanitizeProfile({ cssSec: '85' }).cssSec).toBe('85')
  })

  it('clamps cssSec to valid range [40, 300]', () => {
    expect(sanitizeProfile({ cssSec: 20 }).cssSec).toBe('40')   // floor
    expect(sanitizeProfile({ cssSec: 500 }).cssSec).toBe('300') // ceiling
  })

  it('returns empty string for missing/empty cssSec', () => {
    expect(sanitizeProfile({}).cssSec).toBe('')
    expect(sanitizeProfile({ cssSec: '' }).cssSec).toBe('')
    expect(sanitizeProfile({ cssSec: null }).cssSec).toBe('')
  })
})

describe('v9.494 — profile split2k (2000m erg TIME, mm:ss)', () => {
  it('accepts mm:ss and rejects junk / bare numbers', () => {
    expect(sanitizeProfile({ split2k: '7:30' }).split2k).toBe('7:30')
    expect(sanitizeProfile({ split2k: ' 6:45 ' }).split2k).toBe('6:45')
    expect(sanitizeProfile({ split2k: '450' }).split2k).toBe('')
    expect(sanitizeProfile({ split2k: '7:75' }).split2k).toBe('')
    expect(sanitizeProfile({ split2k: 450 }).split2k).toBe('')
  })
})
