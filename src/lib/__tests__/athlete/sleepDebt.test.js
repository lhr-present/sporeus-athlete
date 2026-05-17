// ─── src/lib/__tests__/athlete/sleepDebt.test.js ─────────────────────────────
// Unit tests for the rolling sleep debt pure-fn.
import { describe, it, expect } from 'vitest'
import { computeSleepDebt, SLEEP_DEBT_CITATION } from '../../athlete/sleepDebt.js'

const TODAY = '2026-05-17'

// Helper: build a 7-day recovery array ending at TODAY with the given hours.
function buildRecovery(hoursList, endISO = TODAY) {
  const end = new Date(endISO + 'T00:00:00Z')
  const out = []
  const n = hoursList.length
  for (let i = 0; i < n; i++) {
    const d = new Date(end.getTime())
    d.setUTCDate(d.getUTCDate() - (n - 1 - i))
    out.push({
      date: d.toISOString().slice(0, 10),
      sleepHrs: hoursList[i],
    })
  }
  return out
}

describe('computeSleepDebt — empty / null inputs', () => {
  it('returns null when recovery is missing', () => {
    expect(computeSleepDebt({ recovery: undefined, today: TODAY })).toBeNull()
    expect(computeSleepDebt({ recovery: null, today: TODAY })).toBeNull()
  })

  it('returns null when recovery is an empty array', () => {
    expect(computeSleepDebt({ recovery: [], today: TODAY })).toBeNull()
  })

  it('returns null when no entries have valid sleep within window', () => {
    // Sleep values are out of sanity range → ignored
    const recovery = buildRecovery([0, 0, 25, 30, NaN, null, undefined])
    expect(computeSleepDebt({ recovery, today: TODAY })).toBeNull()
  })

  it('returns null when entries are outside the window', () => {
    // All entries dated > 7 days before TODAY
    const recovery = [
      { date: '2026-01-01', sleepHrs: 5 },
      { date: '2026-01-02', sleepHrs: 6 },
    ]
    expect(computeSleepDebt({ recovery, today: TODAY })).toBeNull()
  })
})

describe('computeSleepDebt — band classification', () => {
  it('returns band NONE and debtHours=0 when all days at target', () => {
    const recovery = buildRecovery([8, 8, 8, 8, 8, 8, 8])
    const out = computeSleepDebt({ recovery, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.debtHours).toBe(0)
    expect(out.band).toBe('NONE')
    expect(out.daysCounted).toBe(7)
    expect(out.targetHours).toBe(8)
    expect(out.citation).toBe(SLEEP_DEBT_CITATION)
    expect(out.dailyDeficits).toHaveLength(7)
    expect(out.dailyDeficits.every(d => d.deficit === 0)).toBe(true)
  })

  it('classifies MINOR (~2h cumulative deficit)', () => {
    // 7d × ~0.3h shortfall ≈ 2h total
    const recovery = buildRecovery([7.7, 7.7, 7.7, 7.7, 7.7, 7.7, 7.7])
    const out = computeSleepDebt({ recovery, today: TODAY })
    expect(out.debtHours).toBeGreaterThan(1)
    expect(out.debtHours).toBeLessThanOrEqual(4)
    expect(out.band).toBe('MINOR')
  })

  it('classifies MODERATE (~6h cumulative deficit)', () => {
    // 7d × ~0.85h shortfall ≈ 6h total
    const recovery = buildRecovery([7.1, 7.1, 7.1, 7.1, 7.2, 7.2, 7.2])
    const out = computeSleepDebt({ recovery, today: TODAY })
    expect(out.debtHours).toBeGreaterThan(4)
    expect(out.debtHours).toBeLessThanOrEqual(8)
    expect(out.band).toBe('MODERATE')
  })

  it('classifies SEVERE (>8h cumulative deficit)', () => {
    // 7d × ~1.5h shortfall ≈ 10.5h total
    const recovery = buildRecovery([6.5, 6.5, 6.5, 6.5, 6.5, 6.5, 6.5])
    const out = computeSleepDebt({ recovery, today: TODAY })
    expect(out.debtHours).toBeGreaterThan(8)
    expect(out.band).toBe('SEVERE')
  })
})

describe('computeSleepDebt — profile target override', () => {
  it('custom profile target (9h) increases deficit', () => {
    // 7d × 8h = 0h debt at 8h target; same input at 9h target → 7h debt
    const recovery = buildRecovery([8, 8, 8, 8, 8, 8, 8])
    const at8 = computeSleepDebt({ recovery, today: TODAY })
    const at9 = computeSleepDebt({
      recovery,
      profile: { sleepTargetHours: 9 },
      today: TODAY,
    })
    expect(at8.debtHours).toBe(0)
    expect(at9.targetHours).toBe(9)
    expect(at9.debtHours).toBeGreaterThan(at8.debtHours)
    expect(at9.debtHours).toBeCloseTo(7, 1)
  })

  it('falls back to 8h when profile target is out of sane range', () => {
    const recovery = buildRecovery([8, 8, 8, 8, 8, 8, 8])
    const out = computeSleepDebt({
      recovery,
      profile: { sleepTargetHours: 999 },
      today: TODAY,
    })
    expect(out.targetHours).toBe(8)
  })
})

describe('computeSleepDebt — surplus + counting semantics', () => {
  it('surplus day does NOT subtract from later deficit', () => {
    // Day 1: 10h (surplus 2h) + Day 2: 4h (deficit 4h) → debt = 4h (not 2h)
    const recovery = buildRecovery([10, 4, 8, 8, 8, 8, 8])
    const out = computeSleepDebt({ recovery, today: TODAY })
    expect(out.debtHours).toBe(4)
    expect(out.band).toBe('MINOR')
    // The surplus day's daily deficit is clamped to 0
    const surplusDay = out.dailyDeficits[0]
    expect(surplusDay.deficit).toBe(0)
  })

  it('daysCounted matches actual entries within window (sparse data)', () => {
    // Only 3 of the last 7 days have sleep data
    const end = new Date(TODAY + 'T00:00:00Z')
    const sparse = [
      // Outside window — should be ignored
      { date: '2026-05-08', sleepHrs: 5 },
      // Inside window — 3 entries
      { date: '2026-05-15', sleepHrs: 6 },
      { date: '2026-05-16', sleepHrs: 7 },
      { date: '2026-05-17', sleepHrs: 8 },
      // Garbage entries — should be ignored
      { date: '2026-05-14', sleepHrs: 'bogus' },
      { sleepHrs: 7 }, // no date
    ]
    void end
    const out = computeSleepDebt({ recovery: sparse, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.daysCounted).toBe(3)
    expect(out.dailyDeficits).toHaveLength(3)
    // 6h (deficit 2) + 7h (deficit 1) + 8h (deficit 0) = 3h
    expect(out.debtHours).toBe(3)
    expect(out.band).toBe('MINOR')
  })

  it('accepts sleepHours (long form) as a fallback field name', () => {
    const recovery = [
      { date: '2026-05-15', sleepHours: 6 },
      { date: '2026-05-16', sleepHours: 6 },
      { date: '2026-05-17', sleepHours: 6 },
    ]
    const out = computeSleepDebt({ recovery, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.daysCounted).toBe(3)
    expect(out.debtHours).toBe(6) // 3d × 2h deficit
  })

  it('de-dupes multiple entries on the same date (latest wins)', () => {
    const recovery = [
      { date: '2026-05-17', sleepHrs: 5 },
      { date: '2026-05-17', sleepHrs: 8 }, // latest write wins
    ]
    const out = computeSleepDebt({ recovery, today: TODAY })
    expect(out.daysCounted).toBe(1)
    expect(out.debtHours).toBe(0)
  })

  it('respects custom windowDays', () => {
    // 14 days of 7h sleep → 1h/day × 14 = 14h debt with windowDays=14
    const recovery = buildRecovery(new Array(14).fill(7))
    const out14 = computeSleepDebt({ recovery, today: TODAY, windowDays: 14 })
    expect(out14.daysCounted).toBe(14)
    expect(out14.debtHours).toBe(14)
  })

  it('dailyDeficits is sorted oldest-first', () => {
    const recovery = buildRecovery([4, 5, 6, 7, 8, 8, 8])
    const out = computeSleepDebt({ recovery, today: TODAY })
    const dates = out.dailyDeficits.map(d => d.date)
    const sorted = [...dates].sort()
    expect(dates).toEqual(sorted)
  })
})
