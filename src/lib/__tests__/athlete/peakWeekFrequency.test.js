// ─── peakWeekFrequency.test.js — pure-fn tests ───────────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  analyzePeakWeekFrequency,
  PEAK_WEEK_FREQUENCY_CITATION,
} from '../../athlete/peakWeekFrequency.js'

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
 * Generate weeks ending one week before current week. weeklyTssArray is
 * oldest-first. The LAST element corresponds to (currentWeekMonday - 7 days).
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
describe('analyzePeakWeekFrequency — null cases', () => {
  it('returns null for empty log', () => {
    expect(analyzePeakWeekFrequency({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null for non-array log', () => {
    expect(analyzePeakWeekFrequency({ log: null, today: TODAY })).toBeNull()
    expect(analyzePeakWeekFrequency({ log: undefined, today: TODAY })).toBeNull()
  })

  it('returns null when today is unparseable string', () => {
    const log = makeWeeklyLog([100, 200, 300, 400, 500, 600, 700, 800])
    expect(analyzePeakWeekFrequency({ log, today: 'not-a-date' })).toBeNull()
  })

  it('returns null when today is an Invalid Date', () => {
    const log = makeWeeklyLog([100, 200, 300, 400, 500, 600, 700, 800])
    expect(analyzePeakWeekFrequency({ log, today: new Date('xx') })).toBeNull()
  })

  it('returns null when fewer than 8 distinct weeks of log history', () => {
    const log = makeWeeklyLog([100, 200, 300, 400, 500, 600, 700]) // only 7
    expect(analyzePeakWeekFrequency({ log, today: TODAY })).toBeNull()
  })

  it('returns null when log has only zero/negative tss entries', () => {
    const log = [
      { date: '2025-12-01', tss: 0,    type: 'run' },
      { date: '2025-12-08', tss: -50,  type: 'run' },
      { date: '2025-12-15', tss: null, type: 'run' },
      { date: '2025-12-22', tss: 0,    type: 'run' },
      { date: '2025-12-29', tss: 0,    type: 'run' },
      { date: '2026-01-05', tss: 0,    type: 'run' },
      { date: '2026-01-12', tss: 0,    type: 'run' },
      { date: '2026-01-19', tss: 0,    type: 'run' },
    ]
    expect(analyzePeakWeekFrequency({ log, today: TODAY })).toBeNull()
  })
})

// ─── 2. Bands ──────────────────────────────────────────────────────────────
describe('analyzePeakWeekFrequency — bands', () => {
  it('NO_BLOCK: zero near-peak weeks in lookback', () => {
    // 8 history weeks far below peak. Peak set by single big week, OUTSIDE lookback.
    // Strategy: anchor a huge peak 40 weeks ago, then 8 low weeks recently.
    const log = [
      // Peak way back at week -40
      { date: addDays(CURRENT_WEEK_MONDAY, -7 * 40), tss: 1000, type: 'run' },
      // 8 low weeks recently
      ...makeWeeklyLog([100, 100, 100, 100, 100, 100, 100, 100]),
    ]
    const r = analyzePeakWeekFrequency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.lifetimePeakTss).toBe(1000)
    expect(r.nearPeakWeekCount).toBe(0)
    expect(r.band).toBe('NO_BLOCK')
  })

  it('SPARSE (1 near-peak week)', () => {
    // 8 history weeks. Peak = 1000 in one week. One other near-peak (≥900) in lookback.
    // Actually: peak week itself counts since it's in lookback too.
    // Build: 7 low + 1 peak(1000), peak placed in lookback range.
    const log = [
      ...makeWeeklyLog([100, 100, 100, 100, 100, 100, 100, 1000]),
    ]
    const r = analyzePeakWeekFrequency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.lifetimePeakTss).toBe(1000)
    // Only one near-peak week (the peak week itself).
    expect(r.nearPeakWeekCount).toBe(1)
    expect(r.band).toBe('SPARSE')
  })

  it('SPARSE (2 near-peak weeks)', () => {
    const log = [
      ...makeWeeklyLog([100, 100, 100, 100, 100, 100, 950, 1000]),
    ]
    const r = analyzePeakWeekFrequency({ log, today: TODAY })
    expect(r.nearPeakWeekCount).toBe(2)
    expect(r.band).toBe('SPARSE')
  })

  it('BLOCK_DENSITY (3 near-peak weeks)', () => {
    const log = [
      ...makeWeeklyLog([100, 100, 100, 100, 100, 920, 950, 1000]),
    ]
    const r = analyzePeakWeekFrequency({ log, today: TODAY })
    expect(r.nearPeakWeekCount).toBe(3)
    expect(r.band).toBe('BLOCK_DENSITY')
  })

  it('BLOCK_DENSITY (6 near-peak weeks)', () => {
    const log = [
      ...makeWeeklyLog([
        100, 100, 100, 100, 100, 100,
        910, 920, 930, 940, 950, 1000,
      ]),
    ]
    const r = analyzePeakWeekFrequency({ log, today: TODAY })
    expect(r.nearPeakWeekCount).toBe(6)
    expect(r.band).toBe('BLOCK_DENSITY')
  })

  it('PEAK_PHASE (7 near-peak weeks)', () => {
    const log = [
      ...makeWeeklyLog([
        100, 100, 100, 100, 100,
        905, 910, 920, 930, 940, 950, 1000,
      ]),
    ]
    const r = analyzePeakWeekFrequency({ log, today: TODAY })
    expect(r.nearPeakWeekCount).toBe(7)
    expect(r.band).toBe('PEAK_PHASE')
  })

  it('PEAK_PHASE (≥7 near-peak weeks, e.g. 10)', () => {
    const arr = [100, 100]
    for (let i = 0; i < 10; i++) arr.push(900 + i * 10)
    const log = makeWeeklyLog(arr)
    const r = analyzePeakWeekFrequency({ log, today: TODAY })
    expect(r.nearPeakWeekCount).toBe(10)
    expect(r.band).toBe('PEAK_PHASE')
  })
})

// ─── 3. lifetimePeakTss + current-week exclusion ────────────────────────────
describe('analyzePeakWeekFrequency — lifetime peak resolution', () => {
  it('lifetimePeakTss excludes current week', () => {
    // 8 history weeks (peak 170). Current week pumped to 999.
    const log = [
      ...makeWeeklyLog([100, 110, 120, 130, 140, 150, 160, 170]),
      { date: TODAY, tss: 999, type: 'run' },
    ]
    const r = analyzePeakWeekFrequency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.lifetimePeakTss).toBe(170)
    expect(r.lifetimePeakWeekStart).not.toBe(CURRENT_WEEK_MONDAY)
  })

  it('lifetimePeakWeekStart points at the correct Monday', () => {
    const log = makeWeeklyLog([100, 110, 120, 130, 140, 150, 160, 500])
    const r = analyzePeakWeekFrequency({ log, today: TODAY })
    expect(r.lifetimePeakTss).toBe(500)
    // The peak is the LAST element → its Monday is (CURRENT_WEEK_MONDAY - 7).
    expect(r.lifetimePeakWeekStart).toBe(addDays(CURRENT_WEEK_MONDAY, -7))
  })

  it('earliest-tie-wins for lifetimePeakWeekStart', () => {
    // First week and last week both at 500.
    const log = makeWeeklyLog([500, 100, 100, 100, 100, 100, 100, 500])
    const r = analyzePeakWeekFrequency({ log, today: TODAY })
    expect(r.lifetimePeakTss).toBe(500)
    // First week is the earliest tie → its Monday wins.
    const expectedFirst = addDays(CURRENT_WEEK_MONDAY, -7 * 8)
    expect(r.lifetimePeakWeekStart).toBe(expectedFirst)
  })

  it('returns null when lifetimePeakTss === 0 (all weeks zero, no training)', () => {
    // 8 distinct weeks all with TSS exactly 0 → filtered out → size=0 → null.
    // To get past the "≥8 distinct weeks" gate AND still have peak 0 would be
    // impossible since we filter ≤0 TSS. Verified above in null-cases section.
    // Here we double-check the path: only-current-week TSS positive.
    const log = [{ date: TODAY, tss: 200, type: 'run' }]
    const r = analyzePeakWeekFrequency({ log, today: TODAY })
    expect(r).toBeNull()
  })
})

// ─── 4. Near-peak threshold math ────────────────────────────────────────────
describe('analyzePeakWeekFrequency — threshold math', () => {
  it('default 90% threshold: a week at exactly 90% counts as near-peak', () => {
    // 8 weeks. Peak = 1000. One week at exactly 900 should count.
    const log = makeWeeklyLog([100, 100, 100, 100, 100, 100, 900, 1000])
    const r = analyzePeakWeekFrequency({ log, today: TODAY })
    expect(r.nearPeakThreshold).toBe(900)
    expect(r.nearPeakWeekCount).toBe(2)
  })

  it('default 90% threshold: a week at 899 does NOT count', () => {
    const log = makeWeeklyLog([100, 100, 100, 100, 100, 100, 899, 1000])
    const r = analyzePeakWeekFrequency({ log, today: TODAY })
    expect(r.nearPeakWeekCount).toBe(1)
  })

  it('custom 85% threshold: weeks at 850-900 count', () => {
    const log = makeWeeklyLog([100, 100, 100, 100, 100, 850, 900, 1000])
    const r = analyzePeakWeekFrequency({
      log, today: TODAY, peakThresholdPct: 0.85,
    })
    expect(r.peakThresholdPct).toBe(0.85)
    expect(r.nearPeakThreshold).toBe(850)
    expect(r.nearPeakWeekCount).toBe(3)
  })

  it('custom 95% threshold: a week at 900 does NOT count', () => {
    const log = makeWeeklyLog([100, 100, 100, 100, 100, 100, 900, 1000])
    const r = analyzePeakWeekFrequency({
      log, today: TODAY, peakThresholdPct: 0.95,
    })
    expect(r.peakThresholdPct).toBe(0.95)
    expect(r.nearPeakThreshold).toBe(950)
    expect(r.nearPeakWeekCount).toBe(1)
  })

  it('invalid peakThresholdPct falls back to 0.90', () => {
    const log = makeWeeklyLog([100, 100, 100, 100, 100, 100, 900, 1000])
    const r = analyzePeakWeekFrequency({
      log, today: TODAY, peakThresholdPct: -1,
    })
    expect(r.peakThresholdPct).toBe(0.90)
    expect(r.nearPeakWeekCount).toBe(2)
  })
})

// ─── 5. Lookback iteration & rate math ──────────────────────────────────────
describe('analyzePeakWeekFrequency — lookback iteration', () => {
  it('default lookbackWeeks = 26, produces 26 entries in weeks[]', () => {
    const log = makeWeeklyLog([100, 100, 100, 100, 100, 100, 100, 1000])
    const r = analyzePeakWeekFrequency({ log, today: TODAY })
    expect(r.lookbackWeeksAnalyzed).toBe(26)
    expect(r.weeks).toHaveLength(26)
  })

  it('custom lookbackWeeks = 12 produces 12 entries', () => {
    const log = makeWeeklyLog([100, 100, 100, 100, 100, 100, 100, 1000])
    const r = analyzePeakWeekFrequency({
      log, today: TODAY, lookbackWeeks: 12,
    })
    expect(r.lookbackWeeksAnalyzed).toBe(12)
    expect(r.weeks).toHaveLength(12)
  })

  it('nearPeakWeekRate = count / lookbackWeeksAnalyzed, 4dp', () => {
    const log = makeWeeklyLog([100, 100, 100, 100, 100, 100, 900, 1000])
    const r = analyzePeakWeekFrequency({ log, today: TODAY })
    expect(r.nearPeakWeekRate).toBeCloseTo(2 / 26, 4)
  })

  it('weeks array is chronological (oldest → newest)', () => {
    const log = makeWeeklyLog([100, 100, 100, 100, 100, 100, 100, 1000])
    const r = analyzePeakWeekFrequency({ log, today: TODAY })
    for (let i = 1; i < r.weeks.length; i++) {
      expect(r.weeks[i - 1].weekStart < r.weeks[i].weekStart).toBe(true)
    }
  })

  it('lookback iteration ENDS one week before the current week Monday', () => {
    // Build 8 weeks ending at (currentWeekMonday - 7). Verify last entry of
    // weeks[] points at that Monday.
    const log = makeWeeklyLog([100, 100, 100, 100, 100, 100, 100, 1000])
    const r = analyzePeakWeekFrequency({ log, today: TODAY })
    expect(r.weeks[r.weeks.length - 1].weekStart).toBe(addDays(CURRENT_WEEK_MONDAY, -7))
  })

  it('current week is NEVER in weeks[]', () => {
    const log = [
      ...makeWeeklyLog([100, 100, 100, 100, 100, 100, 100, 1000]),
      { date: TODAY, tss: 800, type: 'run' },
    ]
    const r = analyzePeakWeekFrequency({ log, today: TODAY })
    expect(r.weeks.find(w => w.weekStart === CURRENT_WEEK_MONDAY)).toBeUndefined()
  })

  it('weeks outside log history default to 0 tss, isNearPeak=false', () => {
    // 8-week history but lookback is 26 → 18 empty weeks.
    const log = makeWeeklyLog([100, 100, 100, 100, 100, 100, 100, 1000])
    const r = analyzePeakWeekFrequency({ log, today: TODAY })
    const zeroes = r.weeks.filter(w => w.tss === 0)
    expect(zeroes.length).toBeGreaterThanOrEqual(18)
    for (const w of zeroes) expect(w.isNearPeak).toBe(false)
  })

  it('weeks with tss === 0 are not counted as near-peak even at 90% of 0', () => {
    // 8 historical weeks → if peak were 0 we would have returned null. So we
    // verify the safer rule: explicit isNearPeak=false on 0-tss weeks.
    const log = makeWeeklyLog([100, 100, 100, 100, 100, 100, 100, 1000])
    const r = analyzePeakWeekFrequency({ log, today: TODAY })
    const zeroWeeks = r.weeks.filter(w => w.tss === 0)
    expect(zeroWeeks.every(w => !w.isNearPeak)).toBe(true)
  })
})

// ─── 6. ISO week boundary, today input variants ─────────────────────────────
describe('analyzePeakWeekFrequency — date handling', () => {
  it('accepts today as Date object', () => {
    const log = makeWeeklyLog([100, 100, 100, 100, 100, 100, 100, 1000])
    const r = analyzePeakWeekFrequency({
      log, today: new Date('2026-04-29T12:00:00Z'),
    })
    expect(r).not.toBeNull()
    expect(r.lifetimePeakTss).toBe(1000)
  })

  it('accepts today as ISO string', () => {
    const log = makeWeeklyLog([100, 100, 100, 100, 100, 100, 100, 1000])
    const r = analyzePeakWeekFrequency({ log, today: '2026-04-29' })
    expect(r).not.toBeNull()
    expect(r.lifetimePeakTss).toBe(1000)
  })

  it('Sunday & Saturday in same ISO week roll up under the same Monday', () => {
    // Sun 2026-04-26 + Sat 2026-04-25 → same ISO week (Mon 2026-04-20).
    // 8 distinct weeks for the gate, then 3 extra entries that all collapse
    // into the Mon 2026-04-20 week.
    const log = [
      ...makeWeeklyLog([100, 100, 100, 100, 100, 100, 100, 50]), // 8 weeks, last = Mon 2026-04-20 @ 50
      { date: '2026-04-25', tss: 300, type: 'run' }, // Sat (same wk as 2026-04-20)
      { date: '2026-04-26', tss: 250, type: 'run' }, // Sun (same wk)
    ]
    const r = analyzePeakWeekFrequency({ log, today: TODAY })
    expect(r).not.toBeNull()
    // That ISO week should sum to 50 + 300 + 250 = 600.
    const wk = r.weeks.find(w => w.weekStart === '2026-04-20')
    expect(wk).toBeDefined()
    expect(wk.tss).toBe(600)
  })

  it('defaults `today` to now when omitted', () => {
    const log = makeWeeklyLog([100, 100, 100, 100, 100, 100, 100, 1000])
    const r = analyzePeakWeekFrequency({ log })
    expect(r).not.toBeNull()
  })
})

// ─── 7. Output shape + citation ─────────────────────────────────────────────
describe('analyzePeakWeekFrequency — output shape', () => {
  it('returns expected keys', () => {
    const log = makeWeeklyLog([100, 100, 100, 100, 100, 100, 100, 1000])
    const r = analyzePeakWeekFrequency({ log, today: TODAY })
    expect(r).toMatchObject({
      band: expect.any(String),
      weeks: expect.any(Array),
      lifetimePeakTss: expect.any(Number),
      nearPeakWeekCount: expect.any(Number),
      lookbackWeeksAnalyzed: expect.any(Number),
      nearPeakWeekRate: expect.any(Number),
      nearPeakThreshold: expect.any(Number),
      peakThresholdPct: expect.any(Number),
      citation: PEAK_WEEK_FREQUENCY_CITATION,
    })
    expect(r.lifetimePeakWeekStart).toBeTruthy()
  })

  it('citation constant matches expected value', () => {
    expect(PEAK_WEEK_FREQUENCY_CITATION).toBe('Issurin 2010; Bompa 2018')
  })

  it('skips malformed entries (bad dates, missing tss)', () => {
    const log = [
      ...makeWeeklyLog([100, 100, 100, 100, 100, 100, 100, 1000]),
      { date: 'bad-date',     tss: 999, type: 'run' },
      { date: '',             tss: 999, type: 'run' },
      { date: '2026-04-20',   tss: 'foo', type: 'run' },
      null,
      undefined,
      { tss: 200 },
    ]
    const r = analyzePeakWeekFrequency({ log, today: TODAY })
    expect(r).not.toBeNull()
    // Peak unchanged from history.
    expect(r.lifetimePeakTss).toBe(1000)
  })
})
