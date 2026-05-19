// ─── twoADays.test.js — pure-fn coverage ───────────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  analyzeTwoADays,
  TWO_A_DAYS_CITATION,
} from '../../athlete/twoADays.js'

const TODAY = '2026-05-18'

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// ─── Gating / today resolution ──────────────────────────────────────────────
describe('analyzeTwoADays — today resolution + gating', () => {
  it('returns null when today is an invalid string', () => {
    expect(analyzeTwoADays({ log: [], today: 'not-a-date' })).toBe(null)
  })

  it('returns null when today is an invalid Date', () => {
    expect(analyzeTwoADays({ log: [], today: new Date('not-a-date') })).toBe(null)
  })

  it('returns null when today is a non-string non-Date (number)', () => {
    expect(analyzeTwoADays({ log: [], today: 12345 })).toBe(null)
  })

  it('returns populated NONE shape for empty log + valid today', () => {
    const r = analyzeTwoADays({ log: [], today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('NONE')
    expect(r.doubleDays).toEqual([])
    expect(r.totalDoubleDays).toBe(0)
    expect(r.crossSportDoubleDays).toBe(0)
    expect(r.meanDayTssOnDoubles).toBe(0)
    expect(r.citation).toBe(TWO_A_DAYS_CITATION)
  })

  it('returns populated NONE shape for non-array log + valid today', () => {
    const r = analyzeTwoADays({ log: null, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('NONE')
    expect(r.totalDoubleDays).toBe(0)
  })

  it('returns populated NONE shape with no `log` argument at all', () => {
    const r = analyzeTwoADays({ today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('NONE')
  })

  it('accepts today as a Date object', () => {
    const r = analyzeTwoADays({ log: [], today: new Date(TODAY + 'T12:00:00Z') })
    expect(r).not.toBeNull()
    expect(r.band).toBe('NONE')
  })

  it('accepts today as an ISO timestamp string and slices to YYYY-MM-DD', () => {
    const log = [
      { date: TODAY, type: 'run', durationMin: 30 },
      { date: TODAY, type: 'bike', durationMin: 30 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY + 'T08:00:00Z' })
    expect(r.totalDoubleDays).toBe(1)
  })
})

// ─── Band thresholds ────────────────────────────────────────────────────────
describe('analyzeTwoADays — band thresholds', () => {
  it('NONE when totalDoubleDays === 0', () => {
    const r = analyzeTwoADays({ log: [], today: TODAY })
    expect(r.band).toBe('NONE')
  })

  it('OCCASIONAL when 1 double day', () => {
    const log = [
      { date: TODAY, type: 'run',  durationMin: 30 },
      { date: TODAY, type: 'bike', durationMin: 30 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.totalDoubleDays).toBe(1)
    expect(r.band).toBe('OCCASIONAL')
  })

  it('OCCASIONAL when 3 double days', () => {
    const log = []
    for (let i = 0; i < 3; i++) {
      const d = isoMinusDays(TODAY, i * 2)
      log.push({ date: d, type: 'run',  durationMin: 30 })
      log.push({ date: d, type: 'bike', durationMin: 30 })
    }
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.totalDoubleDays).toBe(3)
    expect(r.band).toBe('OCCASIONAL')
  })

  it('OCCASIONAL at upper edge of 5', () => {
    const log = []
    for (let i = 0; i < 5; i++) {
      const d = isoMinusDays(TODAY, i * 2)
      log.push({ date: d, type: 'run',  durationMin: 30 })
      log.push({ date: d, type: 'bike', durationMin: 30 })
    }
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.totalDoubleDays).toBe(5)
    expect(r.band).toBe('OCCASIONAL')
  })

  it('ROUTINE at 6 double days (lower edge)', () => {
    const log = []
    for (let i = 0; i < 6; i++) {
      const d = isoMinusDays(TODAY, i * 2)
      log.push({ date: d, type: 'run',  durationMin: 30 })
      log.push({ date: d, type: 'bike', durationMin: 30 })
    }
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.totalDoubleDays).toBe(6)
    expect(r.band).toBe('ROUTINE')
  })

  it('ROUTINE at 10 double days', () => {
    const log = []
    for (let i = 0; i < 10; i++) {
      const d = isoMinusDays(TODAY, i * 2)
      log.push({ date: d, type: 'run',  durationMin: 30 })
      log.push({ date: d, type: 'bike', durationMin: 30 })
    }
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.totalDoubleDays).toBe(10)
    expect(r.band).toBe('ROUTINE')
  })

  it('ROUTINE at 15 double days (upper edge)', () => {
    const log = []
    for (let i = 0; i < 15; i++) {
      const d = isoMinusDays(TODAY, i * 2)
      log.push({ date: d, type: 'run',  durationMin: 30 })
      log.push({ date: d, type: 'bike', durationMin: 30 })
    }
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.totalDoubleDays).toBe(15)
    expect(r.band).toBe('ROUTINE')
  })

  it('EXCESSIVE at 16 double days (lower edge)', () => {
    const log = []
    for (let i = 0; i < 16; i++) {
      const d = isoMinusDays(TODAY, i * 2)
      log.push({ date: d, type: 'run',  durationMin: 30 })
      log.push({ date: d, type: 'bike', durationMin: 30 })
    }
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.totalDoubleDays).toBe(16)
    expect(r.band).toBe('EXCESSIVE')
  })

  it('EXCESSIVE at 20 double days', () => {
    const log = []
    for (let i = 0; i < 20; i++) {
      const d = isoMinusDays(TODAY, i * 2)
      log.push({ date: d, type: 'run',  durationMin: 30 })
      log.push({ date: d, type: 'bike', durationMin: 30 })
    }
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.totalDoubleDays).toBe(20)
    expect(r.band).toBe('EXCESSIVE')
  })
})

// ─── doubleDays mechanics ───────────────────────────────────────────────────
describe('analyzeTwoADays — doubleDays mechanics', () => {
  it('counts a 3-session day as one double day with sessionCount=3', () => {
    const d = isoMinusDays(TODAY, 2)
    const log = [
      { date: d, type: 'run',      durationMin: 30 },
      { date: d, type: 'bike',     durationMin: 40 },
      { date: d, type: 'strength', durationMin: 30 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.totalDoubleDays).toBe(1)
    expect(r.doubleDays[0].sessionCount).toBe(3)
  })

  it('does NOT count a 1-session day as a double day', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1), type: 'run', durationMin: 60 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.totalDoubleDays).toBe(0)
    expect(r.doubleDays).toEqual([])
  })

  it('sports are unique and preserve first-occurrence order', () => {
    const d = isoMinusDays(TODAY, 1)
    const log = [
      { date: d, type: 'Bike Endurance', durationMin: 60 }, // bike endurance
      { date: d, type: 'Easy Run',       durationMin: 30 }, // easy run
      { date: d, type: 'Bike Endurance', durationMin: 30 }, // dup bike endurance
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.doubleDays[0].sports).toEqual(['bike endurance', 'easy run'])
  })

  it('sports are normalised (trim + lowercase)', () => {
    const d = isoMinusDays(TODAY, 1)
    const log = [
      { date: d, type: '  RUN  ', durationMin: 30 },
      { date: d, type: 'Bike',    durationMin: 30 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.doubleDays[0].sports).toEqual(['run', 'bike'])
  })

  it('isCrossSport true when sports.length >= 2', () => {
    const d = isoMinusDays(TODAY, 1)
    const log = [
      { date: d, type: 'run',  durationMin: 30 },
      { date: d, type: 'bike', durationMin: 30 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.doubleDays[0].isCrossSport).toBe(true)
  })

  it('isCrossSport false when same sport twice', () => {
    const d = isoMinusDays(TODAY, 1)
    const log = [
      { date: d, type: 'run', durationMin: 30 },
      { date: d, type: 'run', durationMin: 30 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.doubleDays[0].sports).toEqual(['run'])
    expect(r.doubleDays[0].isCrossSport).toBe(false)
  })

  it('crossSportDoubleDays counts only multi-sport double days', () => {
    const log = [
      // double-day 1: cross-sport
      { date: isoMinusDays(TODAY, 1), type: 'run',  durationMin: 30 },
      { date: isoMinusDays(TODAY, 1), type: 'bike', durationMin: 30 },
      // double-day 2: same-sport
      { date: isoMinusDays(TODAY, 3), type: 'run', durationMin: 30 },
      { date: isoMinusDays(TODAY, 3), type: 'run', durationMin: 30 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.totalDoubleDays).toBe(2)
    expect(r.crossSportDoubleDays).toBe(1)
  })

  it('totalDayTss sums only finite positive TSS values', () => {
    const d = isoMinusDays(TODAY, 1)
    const log = [
      { date: d, type: 'run',  durationMin: 30, tss: 50 },
      { date: d, type: 'bike', durationMin: 30, tss: 70 },
      { date: d, type: 'swim', durationMin: 30, tss: 'bogus' }, // ignored for tss
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.doubleDays[0].totalDayTss).toBe(120)
  })

  it('totalDayTss = 0 when no TSS values present but duration-only', () => {
    const d = isoMinusDays(TODAY, 1)
    const log = [
      { date: d, type: 'run',  durationMin: 30 },
      { date: d, type: 'bike', durationMin: 30 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.doubleDays[0].totalDayTss).toBe(0)
  })

  it('meanDayTssOnDoubles = mean across double days, 2dp', () => {
    const log = [
      // day1: 100 TSS total
      { date: isoMinusDays(TODAY, 1), type: 'run',  durationMin: 30, tss: 40 },
      { date: isoMinusDays(TODAY, 1), type: 'bike', durationMin: 30, tss: 60 },
      // day2: 50 TSS total
      { date: isoMinusDays(TODAY, 3), type: 'run',  durationMin: 30, tss: 25 },
      { date: isoMinusDays(TODAY, 3), type: 'bike', durationMin: 30, tss: 25 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.totalDoubleDays).toBe(2)
    expect(r.meanDayTssOnDoubles).toBe(75) // (100 + 50) / 2
  })

  it('meanDayTssOnDoubles rounds to 2dp', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1), type: 'run',  durationMin: 30, tss: 33.333 },
      { date: isoMinusDays(TODAY, 1), type: 'bike', durationMin: 30, tss: 33.333 },
      { date: isoMinusDays(TODAY, 2), type: 'run',  durationMin: 30, tss: 33.333 },
      { date: isoMinusDays(TODAY, 2), type: 'bike', durationMin: 30, tss: 33.334 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.totalDoubleDays).toBe(2)
    // day1 = 66.666 ; day2 = 66.667 ; mean = 66.6665 → rounded 2dp = 66.67
    expect(r.meanDayTssOnDoubles).toBeCloseTo(66.67, 2)
  })

  it('meanDayTssOnDoubles = 0 when no double days', () => {
    const r = analyzeTwoADays({ log: [], today: TODAY })
    expect(r.meanDayTssOnDoubles).toBe(0)
  })

  it('sorts doubleDays oldest-first by date', () => {
    const log = [
      { date: isoMinusDays(TODAY, 1),  type: 'run',  durationMin: 30 },
      { date: isoMinusDays(TODAY, 1),  type: 'bike', durationMin: 30 },
      { date: isoMinusDays(TODAY, 10), type: 'run',  durationMin: 30 },
      { date: isoMinusDays(TODAY, 10), type: 'bike', durationMin: 30 },
      { date: isoMinusDays(TODAY, 5),  type: 'run',  durationMin: 30 },
      { date: isoMinusDays(TODAY, 5),  type: 'bike', durationMin: 30 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.doubleDays.map((d) => d.date)).toEqual([
      isoMinusDays(TODAY, 10),
      isoMinusDays(TODAY, 5),
      isoMinusDays(TODAY, 1),
    ])
  })
})

// ─── Qualifying-entry gate ──────────────────────────────────────────────────
describe('analyzeTwoADays — qualifying entry gate', () => {
  it('entry with duration_min=0 + tss=0 does NOT qualify', () => {
    const d = isoMinusDays(TODAY, 1)
    const log = [
      { date: d, type: 'wellness', duration_min: 0, tss: 0 },
      { date: d, type: 'run',      durationMin: 30 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    // Only 1 qualifying session that day → not a double.
    expect(r.totalDoubleDays).toBe(0)
  })

  it('entry with TSS > 0 but duration absent still qualifies', () => {
    const d = isoMinusDays(TODAY, 1)
    const log = [
      { date: d, type: 'run',  tss: 50 },
      { date: d, type: 'bike', tss: 60 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.totalDoubleDays).toBe(1)
  })

  it('camelCase durationMin is preferred over snake_case duration_min', () => {
    const d = isoMinusDays(TODAY, 1)
    const log = [
      // camelCase wins → qualifies even though snake_case is 0
      { date: d, type: 'run',  durationMin: 30, duration_min: 0 },
      { date: d, type: 'bike', durationMin: 30, duration_min: 0 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.totalDoubleDays).toBe(1)
  })

  it('snake_case duration_min is used as fallback when camelCase is absent', () => {
    const d = isoMinusDays(TODAY, 1)
    const log = [
      { date: d, type: 'run',  duration_min: 30 },
      { date: d, type: 'bike', duration_min: 30 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.totalDoubleDays).toBe(1)
  })

  it('entry with negative duration does NOT qualify', () => {
    const d = isoMinusDays(TODAY, 1)
    const log = [
      { date: d, type: 'run',  durationMin: -10, tss: 0 },
      { date: d, type: 'bike', durationMin: 30 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.totalDoubleDays).toBe(0)
  })

  it('entries with invalid dates are silently skipped', () => {
    const d = isoMinusDays(TODAY, 1)
    const log = [
      { date: 'invalid', type: 'run',  durationMin: 30 },
      { date: d,         type: 'run',  durationMin: 30 },
      { date: d,         type: 'bike', durationMin: 30 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.totalDoubleDays).toBe(1)
  })

  it('non-object entries are silently skipped', () => {
    const d = isoMinusDays(TODAY, 1)
    const log = [
      null,
      undefined,
      'oops',
      { date: d, type: 'run',  durationMin: 30 },
      { date: d, type: 'bike', durationMin: 30 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.totalDoubleDays).toBe(1)
  })
})

// ─── Window boundaries ──────────────────────────────────────────────────────
describe('analyzeTwoADays — windowDays + ISO date boundaries', () => {
  it('default windowDays is 60', () => {
    // double day at exactly 60 days ago is INSIDE window (inclusive start)
    const d59 = isoMinusDays(TODAY, 59)
    const log = [
      { date: d59, type: 'run',  durationMin: 30 },
      { date: d59, type: 'bike', durationMin: 30 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.totalDoubleDays).toBe(1)
  })

  it('default windowDays excludes a day 60 days ago (60 = boundary, inclusive 59)', () => {
    // window = [todayIso - 59 .. todayIso], so day at minus 60 is out.
    const d60 = isoMinusDays(TODAY, 60)
    const log = [
      { date: d60, type: 'run',  durationMin: 30 },
      { date: d60, type: 'bike', durationMin: 30 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.totalDoubleDays).toBe(0)
  })

  it('respects custom windowDays = 7', () => {
    const dIn  = isoMinusDays(TODAY, 6)
    const dOut = isoMinusDays(TODAY, 7) // outside 7-day window
    const log = [
      { date: dIn,  type: 'run',  durationMin: 30 },
      { date: dIn,  type: 'bike', durationMin: 30 },
      { date: dOut, type: 'run',  durationMin: 30 },
      { date: dOut, type: 'bike', durationMin: 30 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY, windowDays: 7 })
    expect(r.totalDoubleDays).toBe(1)
    expect(r.doubleDays[0].date).toBe(dIn)
  })

  it('falls back to 60-day window when windowDays is non-finite', () => {
    const d59 = isoMinusDays(TODAY, 59)
    const log = [
      { date: d59, type: 'run',  durationMin: 30 },
      { date: d59, type: 'bike', durationMin: 30 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY, windowDays: NaN })
    expect(r.totalDoubleDays).toBe(1)
  })

  it('falls back to 60-day window when windowDays is zero or negative', () => {
    const d1 = isoMinusDays(TODAY, 1)
    const log = [
      { date: d1, type: 'run',  durationMin: 30 },
      { date: d1, type: 'bike', durationMin: 30 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY, windowDays: 0 })
    expect(r.totalDoubleDays).toBe(1)
    const r2 = analyzeTwoADays({ log, today: TODAY, windowDays: -10 })
    expect(r2.totalDoubleDays).toBe(1)
  })

  it('excludes future-dated entries (after today)', () => {
    const future = isoMinusDays(TODAY, -3)
    const log = [
      { date: future, type: 'run',  durationMin: 30 },
      { date: future, type: 'bike', durationMin: 30 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.totalDoubleDays).toBe(0)
  })

  it('citation string matches export constant', () => {
    const r = analyzeTwoADays({ log: [], today: TODAY })
    expect(r.citation).toBe(TWO_A_DAYS_CITATION)
    expect(TWO_A_DAYS_CITATION).toMatch(/Cejuela 2013/)
    expect(TWO_A_DAYS_CITATION).toMatch(/Issurin 2010/)
    expect(TWO_A_DAYS_CITATION).toMatch(/Skorski 2019/)
  })
})

// ─── Sport-field precedence ─────────────────────────────────────────────────
describe('analyzeTwoADays — sport-field precedence', () => {
  it('uses entry.sport when present, falls back to entry.type', () => {
    const d = isoMinusDays(TODAY, 1)
    const log = [
      { date: d, sport: 'Run',   type: 'Easy run',   durationMin: 30 },
      { date: d, sport: '',      type: 'Long ride',  durationMin: 30 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    expect(r.doubleDays[0].sports).toEqual(['run', 'long ride'])
  })

  it('treats missing sport/type as empty (no entry in sports list)', () => {
    const d = isoMinusDays(TODAY, 1)
    const log = [
      { date: d, durationMin: 30 },
      { date: d, durationMin: 30 },
    ]
    const r = analyzeTwoADays({ log, today: TODAY })
    // empty-string sports filtered out → sports list stays empty.
    expect(r.doubleDays[0].sports).toEqual([])
    expect(r.doubleDays[0].isCrossSport).toBe(false)
  })
})
