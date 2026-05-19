// ─── src/lib/__tests__/athlete/bedtimeConsistency.test.js ────────────────────
// Unit tests for analyzeBedtimeConsistency (28-day bedtime-clock variance).
import { describe, it, expect } from 'vitest'
import {
  analyzeBedtimeConsistency,
  BEDTIME_CONSISTENCY_CITATION,
} from '../../athlete/bedtimeConsistency.js'

const TODAY = '2026-05-17'

// Build a recovery array ending at `endISO` with the given bedtimes (oldest first).
function buildRecovery(bedtimeList, endISO = TODAY) {
  const end = new Date(endISO + 'T00:00:00Z')
  const out = []
  const n = bedtimeList.length
  for (let i = 0; i < n; i++) {
    const d = new Date(end.getTime())
    d.setUTCDate(d.getUTCDate() - (n - 1 - i))
    out.push({
      date: d.toISOString().slice(0, 10),
      bedtime: bedtimeList[i],
    })
  }
  return out
}

describe('analyzeBedtimeConsistency — null inputs', () => {
  it('returns null when recovery is missing', () => {
    expect(analyzeBedtimeConsistency({ recovery: undefined, today: TODAY })).toBeNull()
    expect(analyzeBedtimeConsistency({ recovery: null, today: TODAY })).toBeNull()
  })

  it('returns null when recovery is an empty array', () => {
    expect(analyzeBedtimeConsistency({ recovery: [], today: TODAY })).toBeNull()
  })

  it('returns null when fewer than 7 valid bedtime entries exist', () => {
    const recovery = buildRecovery(['23:00', '23:15', '23:00', '23:30', '23:00', '23:15'])
    expect(analyzeBedtimeConsistency({ recovery, today: TODAY })).toBeNull()
  })

  it('returns null when all bedtimes are empty or missing', () => {
    const recovery = buildRecovery(['', '', '', '', '', '', '', ''])
    expect(analyzeBedtimeConsistency({ recovery, today: TODAY })).toBeNull()
  })

  it('returns null when all bedtimes are unparseable', () => {
    const recovery = buildRecovery(['7am', '11pm', 'midnight', 'bedtime', '25:00', '12:99', null, undefined])
    expect(analyzeBedtimeConsistency({ recovery, today: TODAY })).toBeNull()
  })

  it('returns null when entries are outside the 28-day window', () => {
    const recovery = [
      { date: '2025-01-01', bedtime: '23:00' },
      { date: '2025-01-02', bedtime: '23:00' },
      { date: '2025-01-03', bedtime: '23:00' },
      { date: '2025-01-04', bedtime: '23:00' },
      { date: '2025-01-05', bedtime: '23:00' },
      { date: '2025-01-06', bedtime: '23:00' },
      { date: '2025-01-07', bedtime: '23:00' },
    ]
    expect(analyzeBedtimeConsistency({ recovery, today: TODAY })).toBeNull()
  })
})

describe('analyzeBedtimeConsistency — band classification', () => {
  it('classifies STEADY when stdMinutes < 30 (within 30 min variation)', () => {
    const recovery = buildRecovery([
      '23:00', '23:00', '23:00', '23:00', '23:00', '23:00', '23:00',
    ])
    const out = analyzeBedtimeConsistency({ recovery, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.band).toBe('STEADY')
    expect(out.stdMinutes).toBe(0)
    expect(out.avgBedtimeHHMM).toBe('23:00')
    expect(out.earliestBedtime).toBe('23:00')
    expect(out.latestBedtime).toBe('23:00')
    expect(out.sampleCount).toBe(7)
    expect(out.citation).toBe(BEDTIME_CONSISTENCY_CITATION)
  })

  it('classifies STEADY for small (~15 min) variation', () => {
    const recovery = buildRecovery([
      '23:00', '23:15', '23:00', '23:15', '23:00', '23:15', '23:00',
    ])
    const out = analyzeBedtimeConsistency({ recovery, today: TODAY })
    expect(out.band).toBe('STEADY')
    expect(out.stdMinutes).toBeLessThan(30)
  })

  it('classifies DRIFTING for moderate variation (~45 min)', () => {
    // Alternating 22:30 and 23:45 → 75 min apart → σ = 37.5
    const recovery = buildRecovery([
      '22:30', '23:45', '22:30', '23:45', '22:30', '23:45', '22:30', '23:45',
    ])
    const out = analyzeBedtimeConsistency({ recovery, today: TODAY })
    expect(out.band).toBe('DRIFTING')
    expect(out.stdMinutes).toBeGreaterThanOrEqual(30)
    expect(out.stdMinutes).toBeLessThan(60)
  })

  it('classifies ERRATIC for wide variation (≥60 min)', () => {
    // Alternating 21:00 and 01:00 — these are 4h apart → σ ≈ 120 min
    const recovery = buildRecovery([
      '21:00', '01:00', '21:00', '01:00', '21:00', '01:00', '21:00', '01:00',
    ])
    const out = analyzeBedtimeConsistency({ recovery, today: TODAY })
    expect(out.band).toBe('ERRATIC')
    expect(out.stdMinutes).toBeGreaterThanOrEqual(60)
  })

  it('boundary: σ exactly 30 min should be DRIFTING (not STEADY)', () => {
    // Half at 22:30, half at 23:30 → 60 min apart → σ = 30
    const recovery = buildRecovery([
      '22:30', '23:30', '22:30', '23:30', '22:30', '23:30', '22:30', '23:30',
    ])
    const out = analyzeBedtimeConsistency({ recovery, today: TODAY })
    expect(out.stdMinutes).toBeCloseTo(30, 6)
    expect(out.band).toBe('DRIFTING')
  })

  it('boundary: σ exactly 60 min should be ERRATIC (not DRIFTING)', () => {
    // Half at 22:00, half at 00:00 → 120 min apart → σ = 60
    const recovery = buildRecovery([
      '22:00', '00:00', '22:00', '00:00', '22:00', '00:00', '22:00', '00:00',
    ])
    const out = analyzeBedtimeConsistency({ recovery, today: TODAY })
    expect(out.stdMinutes).toBeCloseTo(60, 6)
    expect(out.band).toBe('ERRATIC')
  })
})

describe('analyzeBedtimeConsistency — midnight-crossing math', () => {
  it('treats 23:30 and 00:30 as 1h (60 min) apart, not 23h', () => {
    // Alternating 23:30 and 00:30 — should be exactly 60 min apart → σ = 30
    const recovery = buildRecovery([
      '23:30', '00:30', '23:30', '00:30', '23:30', '00:30', '23:30', '00:30',
    ])
    const out = analyzeBedtimeConsistency({ recovery, today: TODAY })
    expect(out).not.toBeNull()
    // σ should be 30 (60 min span / 2), not something like 690+
    expect(out.stdMinutes).toBeCloseTo(30, 1)
    expect(out.band).toBe('DRIFTING')
  })

  it('handles 02:00 as 8h after 18:00 (480 minutes)', () => {
    // All bedtimes at 02:00 → σ = 0, average bedtime = 02:00
    const recovery = buildRecovery([
      '02:00', '02:00', '02:00', '02:00', '02:00', '02:00', '02:00',
    ])
    const out = analyzeBedtimeConsistency({ recovery, today: TODAY })
    expect(out.stdMinutes).toBe(0)
    expect(out.avgBedtimeHHMM).toBe('02:00')
    expect(out.band).toBe('STEADY')
  })

  it('correctly averages 23:00 and 01:00 as 00:00', () => {
    // Alternating 23:00 and 01:00 — mean clock time is exactly midnight
    const recovery = buildRecovery([
      '23:00', '01:00', '23:00', '01:00', '23:00', '01:00', '23:00', '01:00',
    ])
    const out = analyzeBedtimeConsistency({ recovery, today: TODAY })
    expect(out.avgBedtimeHHMM).toBe('00:00')
    // 23:00 = 300 min from 18:00; 01:00 = 420 min from 18:00; range = 120 min
    expect(out.earliestBedtime).toBe('23:00')
    expect(out.latestBedtime).toBe('01:00')
  })
})

describe('analyzeBedtimeConsistency — parse tolerance', () => {
  it('accepts both "7:30" and "07:30" as valid (treats 7:30 as 07:30)', () => {
    // 07:30 is in the morning — treated as post-midnight wrap → 13h30m after 18:00.
    // Even number 07:30 entries should not crash; treat them as same time.
    const recovery = buildRecovery([
      '7:30', '07:30', '7:30', '07:30', '7:30', '07:30', '7:30',
    ])
    const out = analyzeBedtimeConsistency({ recovery, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.stdMinutes).toBe(0)
    expect(out.avgBedtimeHHMM).toBe('07:30')
    expect(out.sampleCount).toBe(7)
  })

  it('ignores invalid bedtime tokens like "7am", "12pm", "midnight"', () => {
    // 7 valid + several garbage values
    const recovery = [
      { date: '2026-05-11', bedtime: '23:00' },
      { date: '2026-05-12', bedtime: '23:15' },
      { date: '2026-05-13', bedtime: '23:00' },
      { date: '2026-05-14', bedtime: '23:30' },
      { date: '2026-05-15', bedtime: '23:00' },
      { date: '2026-05-16', bedtime: '23:15' },
      { date: '2026-05-17', bedtime: '23:00' },
      // Garbage
      { date: '2026-05-10', bedtime: '7am' },
      { date: '2026-05-09', bedtime: '12pm' },
      { date: '2026-05-08', bedtime: 'midnight' },
      { date: '2026-05-07', bedtime: '25:00' },
      { date: '2026-05-06', bedtime: '12:99' },
    ]
    const out = analyzeBedtimeConsistency({ recovery, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.sampleCount).toBe(7)
  })

  it('skips entries with missing or empty bedtime field', () => {
    const recovery = [
      { date: '2026-05-11', bedtime: '23:00' },
      { date: '2026-05-12', bedtime: '' },
      { date: '2026-05-13', bedtime: '23:00' },
      { date: '2026-05-14' }, // no bedtime
      { date: '2026-05-15', bedtime: null },
      { date: '2026-05-16', bedtime: '23:00' },
      { date: '2026-05-17', bedtime: '23:00' },
      { date: '2026-05-10', bedtime: '23:00' },
      { date: '2026-05-09', bedtime: '23:00' },
      { date: '2026-05-08', bedtime: '23:00' },
      { date: '2026-05-07', bedtime: '23:00' },
    ]
    const out = analyzeBedtimeConsistency({ recovery, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.sampleCount).toBe(8)
  })
})

describe('analyzeBedtimeConsistency — windowing + de-duping', () => {
  it('de-dupes multiple entries on the same date (latest wins)', () => {
    const recovery = [
      ...buildRecovery(['23:00', '23:00', '23:00', '23:00', '23:00', '23:00', '23:00']),
      { date: TODAY, bedtime: '02:00' }, // latest write — replaces TODAY's 23:00
    ]
    const out = analyzeBedtimeConsistency({ recovery, today: TODAY })
    expect(out.sampleCount).toBe(7)
    // latest=02:00 is 8h after 18:00 (480 min); 23:00 = 300 min; range covers both
    expect(out.latestBedtime).toBe('02:00')
    expect(out.earliestBedtime).toBe('23:00')
  })

  it('respects custom windowDays', () => {
    // 14 entries spanning 14 days
    const recovery = buildRecovery([
      '21:00', '21:00', '21:00', '21:00', '21:00', '21:00', '21:00',
      '23:30', '23:30', '23:30', '23:30', '23:30', '23:30', '23:30',
    ])
    const out7 = analyzeBedtimeConsistency({ recovery, today: TODAY, windowDays: 7 })
    expect(out7.sampleCount).toBe(7)
    expect(out7.avgBedtimeHHMM).toBe('23:30')
    expect(out7.earliestBedtime).toBe('23:30')

    const out28 = analyzeBedtimeConsistency({ recovery, today: TODAY, windowDays: 28 })
    expect(out28.sampleCount).toBe(14)
    expect(out28.earliestBedtime).toBe('21:00')
    expect(out28.latestBedtime).toBe('23:30')
  })

  it('uses system clock when `today` is omitted', () => {
    const now = new Date()
    now.setUTCHours(0, 0, 0, 0)
    const recovery = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getTime())
      d.setUTCDate(d.getUTCDate() - i)
      recovery.push({ date: d.toISOString().slice(0, 10), bedtime: '23:00' })
    }
    const out = analyzeBedtimeConsistency({ recovery })
    expect(out).not.toBeNull()
    expect(out.sampleCount).toBe(7)
    expect(out.band).toBe('STEADY')
    expect(out.avgBedtimeHHMM).toBe('23:00')
  })

  it('returns the citation string', () => {
    const recovery = buildRecovery([
      '23:00', '23:00', '23:00', '23:00', '23:00', '23:00', '23:00',
    ])
    const out = analyzeBedtimeConsistency({ recovery, today: TODAY })
    expect(out.citation).toBe('Walker 2017; Lunsford-Avery 2018')
  })
})
