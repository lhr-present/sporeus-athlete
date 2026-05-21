// ─── maxTssDayPersonalRecord.test.js — pure-fn tests ────────────────────────
import { describe, it, expect } from 'vitest'
import {
  analyzeMaxTssDayPersonalRecord,
  MAX_TSS_DAY_PERSONAL_RECORD_CITATION,
} from '../../athlete/maxTssDayPersonalRecord.js'

// ─── Anchors ────────────────────────────────────────────────────────────────
// Today = 2026-04-29. Recent window default = 90 days inclusive:
// [2026-01-30 .. 2026-04-29].
const TODAY = '2026-04-29'
const WINDOW_START_DEFAULT = '2026-01-30' // 90 days back inclusive

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Build N distinct lifetime (pre-window) days each with a given TSS.
 * Returns log entries dated chronologically starting from `firstDate`.
 */
function makeDailyLog(dailyTssArray, { firstDate = '2025-01-01', step = 2, type = 'run' } = {}) {
  const log = []
  for (let i = 0; i < dailyTssArray.length; i++) {
    const tss = dailyTssArray[i]
    if (tss <= 0) continue
    log.push({ date: addDays(firstDate, i * step), tss, type })
  }
  return log
}

// 35 distinct lifetime days at ascending TSS 100..135 — used wherever we
// need MIN_LIFETIME_DAYS satisfied with a known ranked distribution.
function lifetime35Ascending() {
  // Each day step=2 starting 2025-01-01 stays well outside the
  // [2026-01-30 .. 2026-04-29] window (last day = 2025-01-01 + 68 = 2025-03-10).
  const arr = []
  for (let i = 0; i < 35; i++) arr.push(100 + i) // 100..134
  return makeDailyLog(arr)
}

// ─── 1. Null cases ──────────────────────────────────────────────────────────
describe('analyzeMaxTssDayPersonalRecord — null cases', () => {
  it('returns null for non-array log', () => {
    expect(analyzeMaxTssDayPersonalRecord({ log: null, today: TODAY })).toBeNull()
    expect(analyzeMaxTssDayPersonalRecord({ log: undefined, today: TODAY })).toBeNull()
  })

  it('returns null for empty log', () => {
    expect(analyzeMaxTssDayPersonalRecord({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null when today is unparseable', () => {
    const log = [{ date: TODAY, tss: 200, type: 'run' }]
    expect(analyzeMaxTssDayPersonalRecord({ log, today: 'not-a-date' })).toBeNull()
  })

  it('returns null when today is empty string or unparseable', () => {
    const log = [{ date: TODAY, tss: 200, type: 'run' }]
    expect(analyzeMaxTssDayPersonalRecord({ log, today: '' })).toBeNull()
    expect(analyzeMaxTssDayPersonalRecord({ log, today: 'xx-yy-zz' })).toBeNull()
  })

  it('returns null when recent window has NO positive-TSS days', () => {
    // Lots of lifetime days, but nothing in the last 90.
    const log = lifetime35Ascending()
    expect(analyzeMaxTssDayPersonalRecord({ log, today: TODAY })).toBeNull()
  })

  it('returns null when only zero/negative/non-finite TSS in recent window', () => {
    const log = [
      ...lifetime35Ascending(),
      { date: TODAY, tss: 0, type: 'run' },
      { date: addDays(TODAY, -1), tss: -50, type: 'run' },
      { date: addDays(TODAY, -2), tss: 'NaN', type: 'run' },
    ]
    expect(analyzeMaxTssDayPersonalRecord({ log, today: TODAY })).toBeNull()
  })
})

// ─── 2. INSUFFICIENT_HISTORY ────────────────────────────────────────────────
describe('analyzeMaxTssDayPersonalRecord — INSUFFICIENT_HISTORY', () => {
  it('returns INSUFFICIENT_HISTORY when fewer than 30 lifetime days', () => {
    // 10 lifetime days + 1 recent day.
    const arr = []
    for (let i = 0; i < 10; i++) arr.push(100 + i)
    const log = [
      ...makeDailyLog(arr),
      { date: TODAY, tss: 200, type: 'run' },
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('INSUFFICIENT_HISTORY')
    expect(r.recentPeakTss).toBe(200)
    expect(r.recentPeakDate).toBe(TODAY)
    expect(r.lifetimePeakTss).toBe(0)
    expect(r.lifetimePeakDate).toBe('')
    expect(r.recentRank).toBe(0)
    expect(r.recentPercentile).toBe(0)
    expect(r.totalHistoricalDays).toBe(0)
  })

  it('INSUFFICIENT_HISTORY surfaces recent peak even with 0 lifetime days', () => {
    const log = [{ date: TODAY, tss: 280, type: 'run' }]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_HISTORY')
    expect(r.recentPeakTss).toBe(280)
    expect(r.recentPeakDate).toBe(TODAY)
  })

  it('INSUFFICIENT_HISTORY exposes the citation', () => {
    const log = [{ date: TODAY, tss: 100, type: 'run' }]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r.citation).toBe(MAX_TSS_DAY_PERSONAL_RECORD_CITATION)
  })
})

// ─── 3. NEW_RECORD ──────────────────────────────────────────────────────────
describe('analyzeMaxTssDayPersonalRecord — NEW_RECORD', () => {
  it('NEW_RECORD when recent peak strictly exceeds lifetime peak', () => {
    // Lifetime peak = 134. Recent peak = 200.
    const log = [
      ...lifetime35Ascending(),
      { date: TODAY, tss: 200, type: 'run' },
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r.band).toBe('NEW_RECORD')
    expect(r.recentPeakTss).toBe(200)
    expect(r.lifetimePeakTss).toBe(134)
    expect(r.recentRank).toBe(1)
    // All 35 lifetime days are strictly less → percentile 100.
    expect(r.recentPercentile).toBe(100)
  })

  it('NEW_RECORD requires strict >, not ≥', () => {
    // Recent peak exactly equals lifetime peak → not NEW_RECORD.
    const log = [
      ...lifetime35Ascending(), // peak = 134
      { date: TODAY, tss: 134, type: 'run' },
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r.band).not.toBe('NEW_RECORD')
  })
})

// ─── 4. TOP_5 ───────────────────────────────────────────────────────────────
describe('analyzeMaxTssDayPersonalRecord — TOP_5', () => {
  it('TOP_5 when rank ∈ 1..5 and not a new record', () => {
    // Lifetime 35 ascending 100..134. Recent peak = 132 → strictlyGreater = (133,134) = 2 → rank 3.
    const log = [
      ...lifetime35Ascending(),
      { date: TODAY, tss: 132, type: 'run' },
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r.band).toBe('TOP_5')
    expect(r.recentRank).toBe(3)
  })

  it('TOP_5 boundary: rank 5 is TOP_5, rank 6 is not', () => {
    // Make recent peak = 130 → strictly greater = 131,132,133,134 = 4 → rank 5 → TOP_5.
    const log5 = [
      ...lifetime35Ascending(),
      { date: TODAY, tss: 130, type: 'run' },
    ]
    expect(analyzeMaxTssDayPersonalRecord({ log: log5, today: TODAY }).recentRank).toBe(5)
    expect(analyzeMaxTssDayPersonalRecord({ log: log5, today: TODAY }).band).toBe('TOP_5')

    // Recent peak = 129 → strictly greater = 130..134 = 5 → rank 6 → not TOP_5.
    const log6 = [
      ...lifetime35Ascending(),
      { date: TODAY, tss: 129, type: 'run' },
    ]
    expect(analyzeMaxTssDayPersonalRecord({ log: log6, today: TODAY }).recentRank).toBe(6)
    expect(analyzeMaxTssDayPersonalRecord({ log: log6, today: TODAY }).band).not.toBe('TOP_5')
  })
})

// ─── 5. TOP_20_PERCENT ──────────────────────────────────────────────────────
describe('analyzeMaxTssDayPersonalRecord — TOP_20_PERCENT', () => {
  it('TOP_20_PERCENT when percentile ≥ 80 but rank > 5', () => {
    // 100 lifetime days at TSS = 1..100, all step=2, starting 2024-01-01
    // → last day = 2024-01-01 + 99*2 = 2024-07-10, still pre-window.
    const arr = []
    for (let i = 0; i < 100; i++) arr.push(i + 1) // 1..100
    const lifetime = makeDailyLog(arr, { firstDate: '2024-01-01' })
    // Recent peak = 90 → strictlyGreater = (91..100) = 10 → rank 11.
    // strictlyLess = (1..89) = 89 → pct = round(89/100*100) = 89 → TOP_20_PERCENT.
    const log = [
      ...lifetime,
      { date: TODAY, tss: 90, type: 'run' },
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r.recentRank).toBe(11)
    expect(r.recentPercentile).toBe(89)
    expect(r.band).toBe('TOP_20_PERCENT')
  })
})

// ─── 6. TYPICAL ─────────────────────────────────────────────────────────────
describe('analyzeMaxTssDayPersonalRecord — TYPICAL', () => {
  it('TYPICAL when percentile in [20, 80)', () => {
    const arr = []
    for (let i = 0; i < 100; i++) arr.push(i + 1)
    const lifetime = makeDailyLog(arr, { firstDate: '2024-01-01' })
    // Recent peak = 50 → strictlyLess = 49 → pct = 49 → TYPICAL.
    const log = [
      ...lifetime,
      { date: TODAY, tss: 50, type: 'run' },
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r.band).toBe('TYPICAL')
    expect(r.recentPercentile).toBe(49)
  })
})

// ─── 7. BELOW_TYPICAL ───────────────────────────────────────────────────────
describe('analyzeMaxTssDayPersonalRecord — BELOW_TYPICAL', () => {
  it('BELOW_TYPICAL when percentile < 20', () => {
    const arr = []
    for (let i = 0; i < 100; i++) arr.push(i + 1)
    const lifetime = makeDailyLog(arr, { firstDate: '2024-01-01' })
    // Recent peak = 10 → strictlyLess = 9 → pct = 9 → BELOW_TYPICAL.
    const log = [
      ...lifetime,
      { date: TODAY, tss: 10, type: 'run' },
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r.band).toBe('BELOW_TYPICAL')
    expect(r.recentPercentile).toBe(9)
  })
})

// ─── 8. Rank math (strict-greater tie handling) ─────────────────────────────
describe('analyzeMaxTssDayPersonalRecord — rank math', () => {
  it('ties: matching value slots us into the top (strict > only)', () => {
    // 35 lifetime days at 100 each. Recent peak = 100.
    // strictlyGreater = 0 → rank 1. Not NEW_RECORD (100 !> 100) → TOP_5.
    const arr = Array(35).fill(100)
    const lifetime = makeDailyLog(arr)
    const log = [
      ...lifetime,
      { date: TODAY, tss: 100, type: 'run' },
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r.recentRank).toBe(1)
    expect(r.band).toBe('TOP_5')
    // strictlyLess = 0 → percentile = 0.
    expect(r.recentPercentile).toBe(0)
  })

  it('exact rank counting using strictly-greater', () => {
    // Lifetime: 100,200,300,400,500,600,700,800,900,1000 + 25 throwaway lows
    // to satisfy ≥30. Recent = 550.
    const arr = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
    for (let i = 0; i < 25; i++) arr.push(10) // 25 low days
    const lifetime = makeDailyLog(arr)
    const log = [
      ...lifetime,
      { date: TODAY, tss: 550, type: 'run' },
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    // strictlyGreater = 600,700,800,900,1000 = 5 → rank 6.
    expect(r.recentRank).toBe(6)
  })
})

// ─── 9. Percentile math ─────────────────────────────────────────────────────
describe('analyzeMaxTssDayPersonalRecord — percentile math', () => {
  it('exact percentile = round(strictlyLess / total * 100)', () => {
    // 50 lifetime days = 100..149. Recent = 130.
    // strictlyLess = (100..129) = 30 → pct = round(30/50*100) = 60.
    const arr = []
    for (let i = 0; i < 50; i++) arr.push(100 + i)
    const lifetime = makeDailyLog(arr)
    const log = [
      ...lifetime,
      { date: TODAY, tss: 130, type: 'run' },
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r.recentPercentile).toBe(60)
    expect(r.totalHistoricalDays).toBe(50)
  })

  it('percentile = 100 when recent peak strictly above every lifetime day', () => {
    const arr = []
    for (let i = 0; i < 35; i++) arr.push(50)
    const lifetime = makeDailyLog(arr)
    const log = [
      ...lifetime,
      { date: TODAY, tss: 999, type: 'run' },
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r.recentPercentile).toBe(100)
  })
})

// ─── 10. Multi-session day TSS sum ──────────────────────────────────────────
describe('analyzeMaxTssDayPersonalRecord — multi-session per day', () => {
  it('sums multiple positive-TSS entries on the same date', () => {
    const lifetime = lifetime35Ascending() // peaks at 134
    const log = [
      ...lifetime,
      { date: TODAY, tss: 80, type: 'run' },
      { date: TODAY, tss: 70, type: 'bike' }, // same day → 150 total
      { date: TODAY, tss: 30, type: 'swim' }, // total 180
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r.recentPeakTss).toBe(180)
    expect(r.recentPeakDate).toBe(TODAY)
    expect(r.band).toBe('NEW_RECORD')
  })
})

// ─── 11. Tie-break: recentPeakDate = latest tie ─────────────────────────────
describe('analyzeMaxTssDayPersonalRecord — recentPeakDate latest-tie-wins', () => {
  it('when two recent days tie for peak, the later date wins', () => {
    const lifetime = lifetime35Ascending()
    const log = [
      ...lifetime,
      { date: addDays(TODAY, -10), tss: 250, type: 'run' },
      { date: addDays(TODAY, -5), tss: 250, type: 'run' },
      { date: addDays(TODAY, -1), tss: 250, type: 'run' }, // latest tie
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r.recentPeakTss).toBe(250)
    expect(r.recentPeakDate).toBe(addDays(TODAY, -1))
  })
})

// ─── 12. Tie-break: lifetimePeakDate = earliest tie ─────────────────────────
describe('analyzeMaxTssDayPersonalRecord — lifetimePeakDate earliest-tie-wins', () => {
  it('when two lifetime days tie for peak, the earlier date wins', () => {
    // Build a custom lifetime with three peak days at 500 each.
    const lifetime = makeDailyLog([100, 100, 100, 100, 100], { firstDate: '2024-01-01' })
    // Add three tied peak days, in chronological order.
    lifetime.push({ date: '2024-06-01', tss: 500, type: 'run' })
    lifetime.push({ date: '2024-07-15', tss: 500, type: 'run' })
    lifetime.push({ date: '2024-09-10', tss: 500, type: 'run' })
    // Fill out to ≥30 lifetime days.
    for (let i = 0; i < 30; i++) lifetime.push({ date: addDays('2024-10-01', i), tss: 50, type: 'run' })
    const log = [
      ...lifetime,
      { date: TODAY, tss: 100, type: 'run' },
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r.lifetimePeakTss).toBe(500)
    expect(r.lifetimePeakDate).toBe('2024-06-01')
  })
})

// ─── 13. Lifetime distribution EXCLUDES recent window ───────────────────────
describe('analyzeMaxTssDayPersonalRecord — lifetime excludes recent window', () => {
  it('lifetime peak ignores recent-window peaks even when bigger', () => {
    const lifetime = lifetime35Ascending() // lifetime peak = 134
    const log = [
      ...lifetime,
      // Huge value INSIDE recent window must not become lifetime peak.
      { date: addDays(TODAY, -10), tss: 9999, type: 'run' },
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r.lifetimePeakTss).toBe(134)
    expect(r.recentPeakTss).toBe(9999)
    expect(r.band).toBe('NEW_RECORD')
  })

  it('totalHistoricalDays counts only lifetime (outside recent) days', () => {
    const lifetime = lifetime35Ascending()
    const log = [
      ...lifetime,
      { date: TODAY, tss: 100, type: 'run' },
      { date: addDays(TODAY, -10), tss: 50, type: 'run' }, // also recent
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r.totalHistoricalDays).toBe(35)
  })
})

// ─── 14. Non-finite / malformed entries ─────────────────────────────────────
describe('analyzeMaxTssDayPersonalRecord — non-finite & malformed', () => {
  it('ignores non-finite TSS values', () => {
    const lifetime = lifetime35Ascending()
    const log = [
      ...lifetime,
      { date: TODAY, tss: NaN, type: 'run' },
      { date: TODAY, tss: Infinity, type: 'run' },
      { date: TODAY, tss: -Infinity, type: 'run' },
      { date: TODAY, tss: 80, type: 'run' }, // the only valid one
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r.recentPeakTss).toBe(80)
  })

  it('ignores malformed dates', () => {
    const lifetime = lifetime35Ascending()
    const log = [
      ...lifetime,
      { date: 'not-a-date', tss: 9999, type: 'run' },
      { date: '2026-13-99', tss: 9999, type: 'run' }, // invalid calendar
      { date: TODAY, tss: 100, type: 'run' },
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r.recentPeakTss).toBe(100)
  })

  it('ignores entries with missing date field', () => {
    const lifetime = lifetime35Ascending()
    const log = [
      ...lifetime,
      { tss: 9999, type: 'run' },
      { date: TODAY, tss: 75, type: 'run' },
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r.recentPeakTss).toBe(75)
  })

  it('ignores null / undefined entries', () => {
    const lifetime = lifetime35Ascending()
    const log = [
      ...lifetime,
      null,
      undefined,
      { date: TODAY, tss: 75, type: 'run' },
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r.recentPeakTss).toBe(75)
  })
})

// ─── 15. Custom recentWindowDays ────────────────────────────────────────────
describe('analyzeMaxTssDayPersonalRecord — custom recentWindowDays', () => {
  it('honors a custom recent-window length', () => {
    // 14-day window: [2026-04-16 .. 2026-04-29]
    const lifetime = lifetime35Ascending()
    const log = [
      ...lifetime,
      { date: '2026-04-20', tss: 500, type: 'run' }, // inside 14-day window
      { date: '2026-03-15', tss: 200, type: 'run' }, // outside 14-day, but inside 90-day
    ]
    const r14 = analyzeMaxTssDayPersonalRecord({ log, today: TODAY, recentWindowDays: 14 })
    expect(r14.recentPeakTss).toBe(500)
    expect(r14.recentPeakDate).toBe('2026-04-20')
    // The 2026-03-15 entry becomes part of LIFETIME for the 14-day window.
    expect(r14.lifetimePeakTss).toBe(200)
  })

  it('falls back to 90 when recentWindowDays is invalid', () => {
    const lifetime = lifetime35Ascending()
    const log = [
      ...lifetime,
      { date: TODAY, tss: 100, type: 'run' },
    ]
    // Negative → fallback
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY, recentWindowDays: -5 })
    expect(r).not.toBeNull()
    expect(r.recentPeakTss).toBe(100)
  })
})

// ─── 16. Window-boundary inclusivity ────────────────────────────────────────
describe('analyzeMaxTssDayPersonalRecord — ISO date boundary', () => {
  it('first day of recent window (todayIso - 89) is INSIDE the window', () => {
    // Default 90-day window starts at TODAY - 89 = 2026-01-30.
    const lifetime = lifetime35Ascending()
    const log = [
      ...lifetime,
      { date: WINDOW_START_DEFAULT, tss: 300, type: 'run' },
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r.recentPeakTss).toBe(300)
    expect(r.recentPeakDate).toBe(WINDOW_START_DEFAULT)
  })

  it('day BEFORE the window start is OUTSIDE the window (counts as lifetime)', () => {
    // TODAY - 90 = 2026-01-29 → outside default 90-day window.
    const lifetime = lifetime35Ascending()
    const log = [
      ...lifetime,
      { date: addDays(WINDOW_START_DEFAULT, -1), tss: 500, type: 'run' },
      { date: TODAY, tss: 100, type: 'run' },
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r.lifetimePeakTss).toBe(500)
    expect(r.recentPeakTss).toBe(100)
  })

  it('today itself is INSIDE the recent window', () => {
    const lifetime = lifetime35Ascending()
    const log = [
      ...lifetime,
      { date: TODAY, tss: 250, type: 'run' },
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r.recentPeakDate).toBe(TODAY)
  })
})

// ─── 17. today as Date vs string ────────────────────────────────────────────
describe('analyzeMaxTssDayPersonalRecord — today input shapes', () => {
  it('accepts ISO string today', () => {
    const lifetime = lifetime35Ascending()
    const log = [
      ...lifetime,
      { date: TODAY, tss: 200, type: 'run' },
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.recentPeakTss).toBe(200)
  })

  it('accepts Date object today', () => {
    const lifetime = lifetime35Ascending()
    const log = [
      ...lifetime,
      { date: TODAY, tss: 200, type: 'run' },
    ]
    const r = analyzeMaxTssDayPersonalRecord({
      log,
      today: new Date(TODAY + 'T12:00:00Z'),
    })
    expect(r).not.toBeNull()
    expect(r.recentPeakTss).toBe(200)
  })

  it('produces identical output for Date vs ISO string anchored to the same day', () => {
    const lifetime = lifetime35Ascending()
    const log = [
      ...lifetime,
      { date: TODAY, tss: 200, type: 'run' },
    ]
    const a = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    const b = analyzeMaxTssDayPersonalRecord({
      log,
      today: new Date(TODAY + 'T08:30:00Z'),
    })
    expect(a).toEqual(b)
  })
})

// ─── 18. Plumbing ───────────────────────────────────────────────────────────
describe('analyzeMaxTssDayPersonalRecord — plumbing', () => {
  it('returns the citation string', () => {
    const log = [
      ...lifetime35Ascending(),
      { date: TODAY, tss: 100, type: 'run' },
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    expect(r.citation).toBe(MAX_TSS_DAY_PERSONAL_RECORD_CITATION)
    expect(r.citation).toMatch(/Issurin 2010/)
    expect(r.citation).toMatch(/Daniels 2014/)
  })

  it('integer-rounds the published TSS values', () => {
    const log = [
      ...lifetime35Ascending(),
      { date: TODAY, tss: 123.456, type: 'run' },
      { date: TODAY, tss: 56.7, type: 'bike' },
    ]
    const r = analyzeMaxTssDayPersonalRecord({ log, today: TODAY })
    // 123.456 + 56.7 = 180.156 → rounds to 180
    expect(r.recentPeakTss).toBe(180)
    expect(Number.isInteger(r.lifetimePeakTss)).toBe(true)
  })
})
