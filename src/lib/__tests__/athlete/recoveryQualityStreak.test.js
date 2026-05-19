import { describe, it, expect } from 'vitest'
import {
  analyzeRecoveryQualityStreak,
  RECOVERY_QUALITY_STREAK_CITATION,
} from '../../athlete/recoveryQualityStreak.js'

const TODAY = '2026-05-17'

function isoOffset(days) {
  const d = new Date(TODAY + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Build a baseline of 10 RHR=60 entries far in the past (days -50..-41)
// so baseline = 60 but they don't contribute to the recent streak window.
function baselinePadding(rhr = 60, days = 10, startOffset = -50) {
  const out = []
  for (let i = 0; i < days; i++) {
    out.push({
      date: isoOffset(startOffset - i),
      sleepHrs: 4,        // intentionally LOW so they aren't quality days
      restingHR: rhr,
    })
  }
  return out
}

describe('analyzeRecoveryQualityStreak — pure fn', () => {
  it('returns null on empty / missing recovery input', () => {
    expect(analyzeRecoveryQualityStreak({ recovery: [], today: TODAY })).toBeNull()
    expect(analyzeRecoveryQualityStreak({ recovery: null, today: TODAY })).toBeNull()
    expect(analyzeRecoveryQualityStreak({})).toBeNull()
  })

  it('returns null when fewer than 10 valid RHR entries exist (baseline untrusted)', () => {
    // 9 entries with valid RHR — not enough
    const recovery = []
    for (let i = 0; i < 9; i++) {
      recovery.push({ date: isoOffset(-i), sleepHrs: 8.5, restingHR: 55 })
    }
    expect(analyzeRecoveryQualityStreak({ recovery, today: TODAY })).toBeNull()
  })

  it('returns null when entries have restingHR = 0 / missing (RHR=0 not counted)', () => {
    const recovery = []
    for (let i = 0; i < 12; i++) {
      recovery.push({ date: isoOffset(-i), sleepHrs: 9, restingHR: 0 })
    }
    expect(analyzeRecoveryQualityStreak({ recovery, today: TODAY })).toBeNull()
  })

  it('classifies DEEP_RECOVERY when currentStreak ≥ 5', () => {
    // 6 consecutive quality days: sleep 9h, RHR 50 (well under baseline 60)
    const recovery = []
    for (let i = 0; i < 6; i++) {
      recovery.push({ date: isoOffset(-i), sleepHrs: 9, restingHR: 50 })
    }
    // Pad with baseline so RHR count ≥ 10
    recovery.push(...baselinePadding(60, 10))
    const r = analyzeRecoveryQualityStreak({ recovery, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.status).toBe('DEEP_RECOVERY')
    expect(r.currentStreak).toBe(6)
    expect(r.citation).toBe(RECOVERY_QUALITY_STREAK_CITATION)
  })

  it('classifies STEADY when 2 ≤ currentStreak ≤ 4', () => {
    // 3 quality days; one day before is bad
    const recovery = [
      { date: TODAY,         sleepHrs: 9,   restingHR: 50 },
      { date: isoOffset(-1), sleepHrs: 9,   restingHR: 50 },
      { date: isoOffset(-2), sleepHrs: 9,   restingHR: 50 },
      { date: isoOffset(-3), sleepHrs: 5,   restingHR: 50 }, // bad sleep
      ...baselinePadding(60, 10),
    ]
    const r = analyzeRecoveryQualityStreak({ recovery, today: TODAY })
    expect(r.status).toBe('STEADY')
    expect(r.currentStreak).toBe(3)
  })

  it('classifies INCONSISTENT when currentStreak < 2', () => {
    // 1 quality day today, then a bad day
    const recovery = [
      { date: TODAY,         sleepHrs: 9, restingHR: 50 },
      { date: isoOffset(-1), sleepHrs: 5, restingHR: 50 },
      ...baselinePadding(60, 10),
    ]
    const r = analyzeRecoveryQualityStreak({ recovery, today: TODAY })
    expect(r.status).toBe('INCONSISTENT')
    expect(r.currentStreak).toBe(1)
  })

  it('classifies INCONSISTENT when currentStreak = 0 (today fails)', () => {
    // Today has bad sleep
    const recovery = [
      { date: TODAY,         sleepHrs: 5, restingHR: 50 },
      { date: isoOffset(-1), sleepHrs: 9, restingHR: 50 },
      { date: isoOffset(-2), sleepHrs: 9, restingHR: 50 },
      ...baselinePadding(60, 10),
    ]
    const r = analyzeRecoveryQualityStreak({ recovery, today: TODAY })
    expect(r.status).toBe('INCONSISTENT')
    expect(r.currentStreak).toBe(0)
  })

  it('missing entry for a day breaks the streak (strict — no grace)', () => {
    // Today + day-before are quality; day -1 is MISSING
    const recovery = [
      { date: TODAY,         sleepHrs: 9, restingHR: 50 },
      // -1 missing
      { date: isoOffset(-2), sleepHrs: 9, restingHR: 50 },
      ...baselinePadding(60, 10),
    ]
    const r = analyzeRecoveryQualityStreak({ recovery, today: TODAY })
    expect(r.currentStreak).toBe(1) // only today contributes
  })

  it('elevated RHR (above baseline) ends a streak even if sleep is fine', () => {
    // Baseline = 60. Yesterday has sleep=9 but RHR=70 (above baseline) → not quality.
    const recovery = [
      { date: TODAY,         sleepHrs: 9, restingHR: 50 },
      { date: isoOffset(-1), sleepHrs: 9, restingHR: 70 }, // RHR drift
      ...baselinePadding(60, 10),
    ]
    const r = analyzeRecoveryQualityStreak({ recovery, today: TODAY })
    expect(r.currentStreak).toBe(1)
  })

  it('insufficient sleep ends a streak even if RHR is fresh', () => {
    const recovery = [
      { date: TODAY,         sleepHrs: 9, restingHR: 50 },
      { date: isoOffset(-1), sleepHrs: 7, restingHR: 50 }, // < 8h default
      ...baselinePadding(60, 10),
    ]
    const r = analyzeRecoveryQualityStreak({ recovery, today: TODAY })
    expect(r.currentStreak).toBe(1)
  })

  it('uses profile.sleepTarget when provided (parsed as number)', () => {
    // sleepTarget = 7.5 — 7.5h sleep should now qualify
    const recovery = [
      { date: TODAY,         sleepHrs: 7.5, restingHR: 50 },
      { date: isoOffset(-1), sleepHrs: 7.6, restingHR: 50 },
      { date: isoOffset(-2), sleepHrs: 7.7, restingHR: 50 },
      ...baselinePadding(60, 10),
    ]
    // With default 8h target → 0 quality days today
    const rDefault = analyzeRecoveryQualityStreak({ recovery, today: TODAY })
    expect(rDefault.currentStreak).toBe(0)
    // With profile.sleepTarget=7.5 → all 3 qualify
    const rLow = analyzeRecoveryQualityStreak({
      recovery,
      profile: { sleepTarget: 7.5 },
      today: TODAY,
    })
    expect(rLow.sleepTarget).toBe(7.5)
    expect(rLow.currentStreak).toBe(3)
  })

  it("accepts profile.sleepTarget as string and parses it; falls back to 8h on garbage", () => {
    const recovery = [
      { date: TODAY,         sleepHrs: 7.5, restingHR: 50 },
      { date: isoOffset(-1), sleepHrs: 7.5, restingHR: 50 },
      ...baselinePadding(60, 10),
    ]
    // String '7.5' should parse → currentStreak = 2
    const rStr = analyzeRecoveryQualityStreak({
      recovery,
      profile: { sleepTarget: '7.5' },
      today: TODAY,
    })
    expect(rStr.sleepTarget).toBe(7.5)
    expect(rStr.currentStreak).toBe(2)

    // Garbage profile.sleepTarget → falls back to 8h default → streak = 0
    const rBad = analyzeRecoveryQualityStreak({
      recovery,
      profile: { sleepTarget: 'abc' },
      today: TODAY,
    })
    expect(rBad.sleepTarget).toBe(8.0)
    expect(rBad.currentStreak).toBe(0)
  })

  it('falls back to 8h default when profile is missing entirely', () => {
    const recovery = [
      { date: TODAY,         sleepHrs: 8, restingHR: 50 },
      { date: isoOffset(-1), sleepHrs: 8, restingHR: 50 },
      ...baselinePadding(60, 10),
    ]
    const r = analyzeRecoveryQualityStreak({ recovery, today: TODAY })
    expect(r.sleepTarget).toBe(8.0)
    // Exactly 8h ≥ 8 → both quality
    expect(r.currentStreak).toBe(2)
  })

  it('computes lifetimeBaselineRHR as mean across ALL entries with restingHR > 0', () => {
    // 5 entries at RHR=50, 5 entries at RHR=70 → baseline = 60
    const recovery = []
    for (let i = 0; i < 5; i++) {
      recovery.push({ date: isoOffset(-i),  sleepHrs: 5, restingHR: 50 })
    }
    for (let i = 5; i < 10; i++) {
      recovery.push({ date: isoOffset(-i),  sleepHrs: 5, restingHR: 70 })
    }
    const r = analyzeRecoveryQualityStreak({ recovery, today: TODAY })
    expect(r.lifetimeBaselineRHR).toBeCloseTo(60, 5)
  })

  it('lifetimeBaselineRHR excludes restingHR = 0 and non-numeric entries', () => {
    const recovery = []
    for (let i = 0; i < 10; i++) {
      recovery.push({ date: isoOffset(-i), sleepHrs: 5, restingHR: 60 })
    }
    // Add three garbage entries that should not affect baseline
    recovery.push({ date: isoOffset(-20), sleepHrs: 5, restingHR: 0 })
    recovery.push({ date: isoOffset(-21), sleepHrs: 5, restingHR: 'abc' })
    recovery.push({ date: isoOffset(-22), sleepHrs: 5 })
    const r = analyzeRecoveryQualityStreak({ recovery, today: TODAY })
    expect(r.lifetimeBaselineRHR).toBeCloseTo(60, 5)
  })

  it('computes longestStreak across the entire log (may exceed currentStreak)', () => {
    // Old 7-day quality run: days -20..-14
    const old = []
    for (let i = 14; i <= 20; i++) {
      old.push({ date: isoOffset(-i), sleepHrs: 9, restingHR: 50 })
    }
    // Break at -13
    old.push({ date: isoOffset(-13), sleepHrs: 4, restingHR: 50 })
    // Recent 3-day quality run: today, -1, -2
    const recent = [
      { date: TODAY,         sleepHrs: 9, restingHR: 50 },
      { date: isoOffset(-1), sleepHrs: 9, restingHR: 50 },
      { date: isoOffset(-2), sleepHrs: 9, restingHR: 50 },
    ]
    // Baseline padding far back (entries at 60 = baseline; below the streak's 50)
    const padding = baselinePadding(60, 10, -60)
    const recovery = [...old, ...recent, ...padding]
    const r = analyzeRecoveryQualityStreak({ recovery, today: TODAY })
    expect(r.currentStreak).toBe(3)
    expect(r.longestStreak).toBe(7)
  })

  it('totalQualityDays28 counts only quality days in the last 28 days', () => {
    const recovery = []
    // 10 quality days inside the 28-day window (days 0..-9)
    for (let i = 0; i < 10; i++) {
      recovery.push({ date: isoOffset(-i), sleepHrs: 9, restingHR: 50 })
    }
    // 5 quality days OUTSIDE the 28-day window (days -30..-34) — must not count
    for (let i = 30; i < 35; i++) {
      recovery.push({ date: isoOffset(-i), sleepHrs: 9, restingHR: 50 })
    }
    // Baseline padding (low-sleep so not quality)
    recovery.push(...baselinePadding(60, 10, -60))
    const r = analyzeRecoveryQualityStreak({ recovery, today: TODAY })
    expect(r.totalQualityDays28).toBe(10)
  })

  it('streak math: current + longest computed correctly together', () => {
    // 4-day current run + an older 6-day run separated by a bad day
    const recovery = [
      // current run: today..-3
      { date: TODAY,         sleepHrs: 9, restingHR: 50 },
      { date: isoOffset(-1), sleepHrs: 9, restingHR: 50 },
      { date: isoOffset(-2), sleepHrs: 9, restingHR: 50 },
      { date: isoOffset(-3), sleepHrs: 9, restingHR: 50 },
      // break
      { date: isoOffset(-4), sleepHrs: 4, restingHR: 50 },
      // older 6-day run: -5..-10
      { date: isoOffset(-5),  sleepHrs: 9, restingHR: 50 },
      { date: isoOffset(-6),  sleepHrs: 9, restingHR: 50 },
      { date: isoOffset(-7),  sleepHrs: 9, restingHR: 50 },
      { date: isoOffset(-8),  sleepHrs: 9, restingHR: 50 },
      { date: isoOffset(-9),  sleepHrs: 9, restingHR: 50 },
      { date: isoOffset(-10), sleepHrs: 9, restingHR: 50 },
      ...baselinePadding(60, 10, -60),
    ]
    const r = analyzeRecoveryQualityStreak({ recovery, today: TODAY })
    expect(r.currentStreak).toBe(4)
    expect(r.longestStreak).toBe(6)
    expect(r.status).toBe('STEADY') // currentStreak=4 → STEADY (≥2, <5)
  })

  it('returns expected shape with all required keys', () => {
    const recovery = []
    for (let i = 0; i < 12; i++) {
      recovery.push({ date: isoOffset(-i), sleepHrs: 9, restingHR: 50 })
    }
    const r = analyzeRecoveryQualityStreak({ recovery, today: TODAY })
    expect(r).toEqual({
      status: expect.any(String),
      currentStreak: expect.any(Number),
      longestStreak: expect.any(Number),
      totalQualityDays28: expect.any(Number),
      sleepTarget: expect.any(Number),
      lifetimeBaselineRHR: expect.any(Number),
      citation: RECOVERY_QUALITY_STREAK_CITATION,
    })
  })

  it('latest entry by index wins for same-date duplicates', () => {
    // Today has two entries; the LAST one (bad sleep) should win.
    const recovery = [
      { date: TODAY,         sleepHrs: 9, restingHR: 50 }, // earlier, would qualify
      { date: isoOffset(-1), sleepHrs: 9, restingHR: 50 },
      { date: TODAY,         sleepHrs: 4, restingHR: 50 }, // overrides → bad
      ...baselinePadding(60, 10),
    ]
    const r = analyzeRecoveryQualityStreak({ recovery, today: TODAY })
    expect(r.currentStreak).toBe(0)
  })
})
