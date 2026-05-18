// ─── timeOfDayConsistency.test.js — pure-fn unit tests ──────────────────────
import { describe, it, expect } from 'vitest'
import {
  computeTimeOfDayConsistency,
  TIME_OF_DAY_CONSISTENCY_CITATION,
} from '../../athlete/timeOfDayConsistency.js'

const TODAY = '2026-05-15'

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function makeEntries(times, opts = {}) {
  const { today = TODAY, field = 'startTime', stepDays = 1 } = opts
  return times.map((t, i) => ({
    date: addDays(today, -i * stepDays),
    [field]: t,
  }))
}

describe('computeTimeOfDayConsistency — null cases', () => {
  it('returns null for an empty log', () => {
    expect(computeTimeOfDayConsistency({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null for fewer than 6 timed entries', () => {
    const log = makeEntries(['07:00', '07:05', '07:10', '06:55', '07:02'])
    expect(computeTimeOfDayConsistency({ log, today: TODAY })).toBeNull()
  })

  it('returns null when log is null/undefined', () => {
    expect(computeTimeOfDayConsistency({ log: null, today: TODAY })).toBeNull()
    expect(computeTimeOfDayConsistency({ today: TODAY })).toBeNull()
  })
})

describe('computeTimeOfDayConsistency — TIGHT band (<60 min SD)', () => {
  it('classifies tightly consistent training (07:00 ± 10 min) as TIGHT', () => {
    const log = makeEntries([
      '07:00', '06:55', '07:05', '07:10', '06:50', '07:00', '07:03', '06:58',
    ])
    const r = computeTimeOfDayConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('TIGHT')
    expect(r.sdMinutes).toBeLessThan(60)
    expect(r.meanHour).toBeGreaterThan(6.5)
    expect(r.meanHour).toBeLessThan(7.5)
    expect(r.n).toBe(8)
    expect(r.citation).toBe(TIME_OF_DAY_CONSISTENCY_CITATION)
  })
})

describe('computeTimeOfDayConsistency — MODERATE band (60-120 min SD)', () => {
  it('classifies moderately consistent training as MODERATE', () => {
    // Spread of ~90 min SD around 07:00
    const log = makeEntries([
      '05:00', '09:00', '07:30', '05:30', '08:45', '06:00', '08:30', '05:15',
    ])
    const r = computeTimeOfDayConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('MODERATE')
    expect(r.sdMinutes).toBeGreaterThanOrEqual(60)
    expect(r.sdMinutes).toBeLessThan(120)
  })
})

describe('computeTimeOfDayConsistency — SCATTERED band (>180 min SD)', () => {
  it('classifies very scattered training as SCATTERED', () => {
    const log = makeEntries([
      '05:00', '12:00', '18:00', '06:00', '20:00', '08:00', '22:00', '07:00',
    ])
    const r = computeTimeOfDayConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('SCATTERED')
    expect(r.sdMinutes).toBeGreaterThan(180)
  })
})

describe('computeTimeOfDayConsistency — field handling', () => {
  it('filters out entries with no time field at all', () => {
    const log = [
      { date: addDays(TODAY, 0),  startTime: '07:00' },
      { date: addDays(TODAY, -1), startTime: '06:55' },
      { date: addDays(TODAY, -2), startTime: '07:05' },
      { date: addDays(TODAY, -3) }, // no time
      { date: addDays(TODAY, -4) }, // no time
      { date: addDays(TODAY, -5), startTime: '07:10' },
      { date: addDays(TODAY, -6), startTime: '06:50' },
      { date: addDays(TODAY, -7), startTime: '07:02' },
    ]
    const r = computeTimeOfDayConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.n).toBe(6) // only the 6 with startTime were counted
    expect(r.band).toBe('TIGHT')
  })

  it('accepts multiple field names: startTime, time, timeOfDay', () => {
    const log = [
      { date: addDays(TODAY, 0),  startTime: '07:00' },
      { date: addDays(TODAY, -1), time:      '07:05' },
      { date: addDays(TODAY, -2), timeOfDay: '06:55' },
      { date: addDays(TODAY, -3), startTime: '07:02' },
      { date: addDays(TODAY, -4), time:      '06:58' },
      { date: addDays(TODAY, -5), timeOfDay: '07:08' },
      { date: addDays(TODAY, -6), startTime: '07:00' },
    ]
    const r = computeTimeOfDayConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.n).toBe(7)
    expect(r.band).toBe('TIGHT')
  })

  it('skips invalid HH:MM strings gracefully', () => {
    const log = [
      { date: addDays(TODAY, 0),  startTime: '07:00' },
      { date: addDays(TODAY, -1), startTime: 'not-a-time' },
      { date: addDays(TODAY, -2), startTime: '25:00' }, // out of range
      { date: addDays(TODAY, -3), startTime: '12:99' }, // invalid minute
      { date: addDays(TODAY, -4), startTime: '06:55' },
      { date: addDays(TODAY, -5), startTime: '07:05' },
      { date: addDays(TODAY, -6), startTime: '06:50' },
      { date: addDays(TODAY, -7), startTime: '07:10' },
      { date: addDays(TODAY, -8), startTime: '07:02' },
      { date: addDays(TODAY, -9), startTime: '' },     // empty
    ]
    const r = computeTimeOfDayConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    // 6 valid HH:MM entries
    expect(r.n).toBe(6)
    expect(r.band).toBe('TIGHT')
  })

  it('skips entries outside the trailing N-week window', () => {
    // Inside window (7 valid recent entries) plus an old outlier 60 days back
    const recent = makeEntries([
      '07:00', '07:05', '06:55', '07:02', '07:08', '06:58', '07:01',
    ])
    const old = [{
      date: addDays(TODAY, -60),
      startTime: '23:00', // would push SD up if included
    }]
    const r = computeTimeOfDayConsistency({ log: [...recent, ...old], today: TODAY, weeks: 4 })
    expect(r).not.toBeNull()
    expect(r.n).toBe(7) // old entry excluded
    expect(r.band).toBe('TIGHT')
  })
})
