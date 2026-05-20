// ─── weeklyVolumeStreak.test.js — pure-fn tests ─────────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  analyzeWeeklyVolumeStreak,
  WEEKLY_VOLUME_STREAK_CITATION,
} from '../../athlete/weeklyVolumeStreak.js'

// ─── Anchors ────────────────────────────────────────────────────────────────
// Today = Wednesday 2026-04-29 → current-week Monday = 2026-04-27.
const TODAY = '2026-04-29'
const CURRENT_WEEK_MONDAY = '2026-04-27'

beforeEach(() => { vi.setSystemTime(new Date('2026-04-29T12:00:00Z')) })
afterEach(()  => { vi.setSystemTime(new Date()) })

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Build a log of weekly entries. weeklyTssArray is oldest-first.
 * The LAST element corresponds to (currentWeekMonday - 7 days), i.e. the most
 * recent FULLY COMPLETED week. Zero-or-negative entries are skipped so the
 * "no entry" weeks remain truly empty (analyse() treats them as TSS=0).
 */
function makeWeeklyLog(weeklyTssArray) {
  const lastMonday = addDays(CURRENT_WEEK_MONDAY, -7)
  const firstMonday = addDays(lastMonday, -7 * (weeklyTssArray.length - 1))
  const log = []
  for (let i = 0; i < weeklyTssArray.length; i++) {
    const tss = weeklyTssArray[i]
    if (tss <= 0) continue
    log.push({
      date: addDays(firstMonday, i * 7),
      tss,
      type: 'run',
    })
  }
  return log
}

// ─── 1. Null cases ──────────────────────────────────────────────────────────
describe('analyzeWeeklyVolumeStreak — null cases', () => {
  it('returns null for empty log', () => {
    expect(analyzeWeeklyVolumeStreak({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null for non-array log', () => {
    expect(analyzeWeeklyVolumeStreak({ log: null, today: TODAY })).toBeNull()
    expect(analyzeWeeklyVolumeStreak({ log: undefined, today: TODAY })).toBeNull()
  })

  it('returns null when today is unparseable string', () => {
    const log = makeWeeklyLog([100, 100, 100, 100, 100, 100, 100, 100])
    expect(analyzeWeeklyVolumeStreak({ log, today: 'not-a-date' })).toBeNull()
  })

  it('returns null when today is an Invalid Date', () => {
    const log = makeWeeklyLog([100, 100, 100, 100, 100, 100, 100, 100])
    expect(analyzeWeeklyVolumeStreak({ log, today: new Date('xx') })).toBeNull()
  })

  it('returns null when baselineTss=0 (log has only zero/negative tss)', () => {
    const log = [
      { date: '2025-12-01', tss: 0,    type: 'run' },
      { date: '2025-12-08', tss: -50,  type: 'run' },
      { date: '2025-12-15', tss: null, type: 'run' },
    ]
    expect(analyzeWeeklyVolumeStreak({ log, today: TODAY })).toBeNull()
  })

  it('returns null when log has only entries outside the lookback window', () => {
    // Single big week 40 weeks ago → outside 26-week lookback → baseline=0.
    const log = [
      { date: addDays(CURRENT_WEEK_MONDAY, -7 * 40), tss: 1000, type: 'run' },
    ]
    expect(analyzeWeeklyVolumeStreak({ log, today: TODAY })).toBeNull()
  })
})

// ─── 2. Bands ──────────────────────────────────────────────────────────────
describe('analyzeWeeklyVolumeStreak — bands', () => {
  it('NO_STREAK: longest ≤ 1 (only isolated above weeks)', () => {
    // 26 weeks, one week far above mean, rest at low value → longest = 1.
    const arr = new Array(26).fill(100)
    arr[10] = 800 // single isolated above-baseline week
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.longestStreakWeeks).toBeLessThanOrEqual(1)
    expect(r.band).toBe('NO_STREAK')
  })

  it('BUILDING: 2 consecutive above-mean weeks', () => {
    const arr = new Array(26).fill(100)
    arr[10] = 800
    arr[11] = 800
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.longestStreakWeeks).toBe(2)
    expect(r.band).toBe('BUILDING')
  })

  it('BUILDING: 3 consecutive above-mean weeks', () => {
    const arr = new Array(26).fill(100)
    arr[10] = 800
    arr[11] = 800
    arr[12] = 800
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.longestStreakWeeks).toBe(3)
    expect(r.band).toBe('BUILDING')
  })

  it('STRONG_MOMENTUM: 4 consecutive above-mean weeks', () => {
    const arr = new Array(26).fill(100)
    for (let i = 10; i <= 13; i++) arr[i] = 800
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.longestStreakWeeks).toBe(4)
    expect(r.band).toBe('STRONG_MOMENTUM')
  })

  it('STRONG_MOMENTUM: 6 consecutive above-mean weeks', () => {
    const arr = new Array(26).fill(100)
    for (let i = 10; i <= 15; i++) arr[i] = 800
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.longestStreakWeeks).toBe(6)
    expect(r.band).toBe('STRONG_MOMENTUM')
  })

  it('PEAK_BLOCK: 7 consecutive above-mean weeks (>6)', () => {
    const arr = new Array(26).fill(100)
    for (let i = 10; i <= 16; i++) arr[i] = 800
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.longestStreakWeeks).toBe(7)
    expect(r.band).toBe('PEAK_BLOCK')
  })

  it('PEAK_BLOCK: 10 consecutive above-mean weeks', () => {
    const arr = new Array(26).fill(100)
    for (let i = 10; i <= 19; i++) arr[i] = 800
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.longestStreakWeeks).toBe(10)
    expect(r.band).toBe('PEAK_BLOCK')
  })

  it('NO_STREAK: zero above-mean weeks (all equal but ≥ baseline = 1 streak length)', () => {
    // Edge: if all 26 weeks are EQUAL, then all are ≥ baseline → longest=26
    // → PEAK_BLOCK. Instead test that an all-zero-with-one-positive log
    // yields NO_STREAK because only one week is above (baseline pulled down).
    const arr = new Array(26).fill(0)
    arr[5] = 500
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.longestStreakWeeks).toBe(1)
    expect(r.band).toBe('NO_STREAK')
  })
})

// ─── 3. Baseline math ──────────────────────────────────────────────────────
describe('analyzeWeeklyVolumeStreak — baseline math', () => {
  it('baselineTss is mean across all lookback weeks INCLUDING zero weeks', () => {
    const arr = new Array(26).fill(0)
    arr[0] = 100
    arr[1] = 100
    arr[2] = 100
    arr[3] = 100
    // sum=400, /26 weeks → 15.38
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.baselineTss).toBeCloseTo(400 / 26, 2)
  })

  it('baselineTss rounded to 2 decimal places', () => {
    const arr = new Array(26).fill(0)
    arr[0] = 100 // baseline = 100/26 = 3.846…
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    // 3.846153… rounded to 2dp → 3.85
    expect(r.baselineTss).toBe(3.85)
  })

  it('baselineTss when all weeks equal = the equal value', () => {
    const arr = new Array(26).fill(200)
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.baselineTss).toBe(200)
  })
})

// ─── 4. aboveBaseline boundary ─────────────────────────────────────────────
describe('analyzeWeeklyVolumeStreak — aboveBaseline boundary', () => {
  it('a week with tss === baseline counts as aboveBaseline', () => {
    // All 26 weeks at 200 → baseline = 200 → every week is exactly equal,
    // so every week aboveBaseline=true and longest = 26.
    const arr = new Array(26).fill(200)
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.baselineTss).toBe(200)
    expect(r.weeks.every(w => w.aboveBaseline)).toBe(true)
    expect(r.longestStreakWeeks).toBe(26)
    expect(r.band).toBe('PEAK_BLOCK')
  })

  it('a week strictly below baseline is NOT aboveBaseline', () => {
    const arr = new Array(26).fill(0)
    arr[0] = 100
    arr[1] = 100
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    // baseline = 200/26 ≈ 7.69; arr[2..25] are zero (below).
    const zeroWeeks = r.weeks.filter(w => w.tss === 0)
    expect(zeroWeeks.every(w => w.aboveBaseline === false)).toBe(true)
  })
})

// ─── 5. longestStreakWeeks correctness across multiple streaks ─────────────
describe('analyzeWeeklyVolumeStreak — longestStreakWeeks correctness', () => {
  it('picks the longest of multiple non-contiguous above runs', () => {
    const arr = new Array(26).fill(50)
    // Run A: 3 weeks at index 5,6,7
    arr[5] = 800; arr[6] = 800; arr[7] = 800
    // Run B: 5 weeks at index 12..16
    for (let i = 12; i <= 16; i++) arr[i] = 800
    // Run C: 2 weeks at index 22,23
    arr[22] = 800; arr[23] = 800
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.longestStreakWeeks).toBe(5)
    expect(r.band).toBe('STRONG_MOMENTUM')
  })

  it('returns longest = 1 when no two above weeks are adjacent', () => {
    const arr = new Array(26).fill(50)
    for (let i = 0; i < 26; i += 2) arr[i] = 800 // alternating
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.longestStreakWeeks).toBe(1)
    expect(r.band).toBe('NO_STREAK')
  })
})

// ─── 6. currentStreakWeeks ─────────────────────────────────────────────────
describe('analyzeWeeklyVolumeStreak — currentStreakWeeks', () => {
  it('currentStreakWeeks = 0 when last completed week is below baseline', () => {
    const arr = new Array(26).fill(50)
    // Long run NOT ending at the last week.
    for (let i = 10; i <= 18; i++) arr[i] = 800
    // Last completed week (index 25) is low → below baseline.
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.longestStreakWeeks).toBe(9)
    expect(r.currentStreakWeeks).toBe(0)
  })

  it('currentStreakWeeks counted only from the END', () => {
    const arr = new Array(26).fill(50)
    // Place a run of 4 above weeks ending at the last week.
    for (let i = 22; i <= 25; i++) arr[i] = 800
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.currentStreakWeeks).toBe(4)
    expect(r.longestStreakWeeks).toBe(4)
  })

  it('currentStreakWeeks does NOT count an earlier longer run', () => {
    const arr = new Array(26).fill(50)
    for (let i = 5; i <= 14; i++) arr[i] = 800 // 10-week run far back
    arr[25] = 800                                // single above week most recent
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.longestStreakWeeks).toBe(10)
    expect(r.currentStreakWeeks).toBe(1)
  })

  it('currentStreakWeeks equals longestStreakWeeks when the only streak ends at the last week', () => {
    const arr = new Array(26).fill(50)
    for (let i = 20; i <= 25; i++) arr[i] = 800
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.currentStreakWeeks).toBe(6)
    expect(r.longestStreakWeeks).toBe(6)
  })
})

// ─── 7. totalAtOrAboveWeeks ────────────────────────────────────────────────
describe('analyzeWeeklyVolumeStreak — totalAtOrAboveWeeks', () => {
  it('counts every week where aboveBaseline is true', () => {
    const arr = new Array(26).fill(50)
    // 7 scattered weeks above
    for (const i of [3, 7, 10, 14, 18, 21, 25]) arr[i] = 800
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalAtOrAboveWeeks).toBe(7)
  })

  it('totalAtOrAboveWeeks = 26 when all weeks equal', () => {
    const arr = new Array(26).fill(200)
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalAtOrAboveWeeks).toBe(26)
  })
})

// ─── 8. Current partial week excluded ──────────────────────────────────────
describe('analyzeWeeklyVolumeStreak — current partial week excluded', () => {
  it('does NOT count entries dated in the current ISO week', () => {
    // Build a log of 26 prior weeks at 100 TSS each, plus a massive entry
    // dated TODAY (Wednesday 2026-04-29, current ISO week).
    const arr = new Array(26).fill(100)
    const log = makeWeeklyLog(arr)
    log.push({ date: TODAY, tss: 9999, type: 'run' })

    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    // Baseline must equal 100 (the huge current-week entry was excluded).
    expect(r.baselineTss).toBe(100)
    // weeks length stays at 26; the most recent week is the
    // already-completed week, not the current partial one.
    expect(r.weeks.length).toBe(26)
    const lastWeekIso = r.weeks[r.weeks.length - 1].weekStart
    expect(lastWeekIso).toBe(addDays(CURRENT_WEEK_MONDAY, -7))
  })
})

// ─── 9. lookbackWeeks ──────────────────────────────────────────────────────
describe('analyzeWeeklyVolumeStreak — custom lookbackWeeks', () => {
  it('honours a custom lookback length', () => {
    const arr = new Array(12).fill(200)
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY, lookbackWeeks: 12 })
    expect(r).not.toBeNull()
    expect(r.weeks.length).toBe(12)
    expect(r.baselineTss).toBe(200)
    expect(r.longestStreakWeeks).toBe(12)
  })

  it('falls back to default 26 when lookback is invalid', () => {
    const arr = new Array(26).fill(100)
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY, lookbackWeeks: -5 })
    expect(r).not.toBeNull()
    expect(r.weeks.length).toBe(26)
  })

  it('treats NaN lookback as default 26', () => {
    const arr = new Array(26).fill(100)
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY, lookbackWeeks: NaN })
    expect(r).not.toBeNull()
    expect(r.weeks.length).toBe(26)
  })
})

// ─── 10. ISO week boundary ─────────────────────────────────────────────────
describe('analyzeWeeklyVolumeStreak — ISO week boundary', () => {
  it('groups entries by Monday-anchored ISO weeks', () => {
    // Two entries in the same ISO week (Mon 2026-04-20 → Sun 2026-04-26):
    // one on Monday, one on Sunday. Both should fold into the same week.
    // Build a log of older history that does NOT touch 2026-04-20 so the
    // folding behaviour is the only contribution to that week's TSS.
    const arr = new Array(24).fill(50)
    arr[23] = 0 // skip the most-recent synthetic entry (2026-04-20)
    const log = makeWeeklyLog(arr)
    // Both entries land inside the ISO week starting Mon 2026-04-20.
    log.push({ date: '2026-04-20', tss: 100, type: 'run' })
    log.push({ date: '2026-04-26', tss: 100, type: 'run' })
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    const lastWk = r.weeks[r.weeks.length - 1]
    expect(lastWk.weekStart).toBe('2026-04-20')
    expect(lastWk.tss).toBe(200) // both Mon + Sun entries folded in
  })

  it('weekStart values are chronological oldest → newest', () => {
    const arr = new Array(26).fill(100)
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    for (let i = 1; i < r.weeks.length; i++) {
      expect(r.weeks[i].weekStart > r.weeks[i - 1].weekStart).toBe(true)
    }
  })
})

// ─── 11. today as Date vs string ───────────────────────────────────────────
describe('analyzeWeeklyVolumeStreak — today as Date or string', () => {
  it('accepts today as a Date object', () => {
    const arr = new Array(26).fill(100)
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: new Date('2026-04-29T12:00:00Z') })
    expect(r).not.toBeNull()
    expect(r.weeks.length).toBe(26)
    expect(r.baselineTss).toBe(100)
  })

  it('accepts today as an ISO date string', () => {
    const arr = new Array(26).fill(100)
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.weeks.length).toBe(26)
  })

  it('defaults today to "now" (uses vi.setSystemTime) when omitted', () => {
    const arr = new Array(26).fill(100)
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log }) // no today arg
    expect(r).not.toBeNull()
    expect(r.weeks.length).toBe(26)
    expect(r.baselineTss).toBe(100)
  })
})

// ─── 12. Citation + return shape ───────────────────────────────────────────
describe('analyzeWeeklyVolumeStreak — citation + return shape', () => {
  it('returns the canonical citation string', () => {
    const arr = new Array(26).fill(100)
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.citation).toBe(WEEKLY_VOLUME_STREAK_CITATION)
    expect(r.citation).toMatch(/Bompa 2018/)
  })

  it('weeks array each has weekStart, tss, aboveBaseline', () => {
    const arr = new Array(26).fill(100)
    const log = makeWeeklyLog(arr)
    const r = analyzeWeeklyVolumeStreak({ log, today: TODAY })
    expect(r).not.toBeNull()
    for (const w of r.weeks) {
      expect(typeof w.weekStart).toBe('string')
      expect(typeof w.tss).toBe('number')
      expect(typeof w.aboveBaseline).toBe('boolean')
    }
  })
})
