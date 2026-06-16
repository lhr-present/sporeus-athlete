// After-Big-Week RPE — pure-function tests.
//
// Covers:
//   - guards (no args, bad today, Date type, non-array log),
//   - INSUFFICIENT_DATA when <3 big weeks,
//   - NORMAL_RECOVERY (week-1 RPE elevated, week-2 returning),
//   - PROLONGED_ELEVATION (week-2 RPE still ≥ week-1 elevation),
//   - NO_RPE_RESPONSE (|meanRpeElevationPct| < 0.05),
//   - week-mean RPE math (only finite rpe counts),
//   - missing rpe → meanRpe null → rpeElevationPct null & skipped from
//     elevation aggregate,
//   - big-week detection at exactly threshold,
//   - priorMeanTss=0 skipped,
//   - nextWeek outside window → nextWeekMeanRpe null,
//   - twoWeeksOut outside window → null,
//   - custom windowWeeks (clamped to 4 min),
//   - custom bigWeekThresholdPct,
//   - ISO week boundary correctness,
//   - today as Date vs string,
//   - bigWeeks oldest-first,
//   - 4dp rounding of pct fields,
//   - 2dp rounding of mean RPE fields,
//   - citation passthrough.

import { describe, it, expect } from 'vitest'
import {
  analyzeAfterBigWeekRpe,
  AFTER_BIG_WEEK_RPE_CITATION,
} from '../../athlete/afterBigWeekRpe.js'

const TODAY = '2026-05-20' // Wed → ISO Monday = 2026-05-18

// Mondays for the default 16-week window ending at TODAY, oldest first.
// idx 15 is the partial current week (containing today).
const WEEK_MONDAYS = [
  '2026-02-02', // idx 0
  '2026-02-09', // idx 1
  '2026-02-16', // idx 2
  '2026-02-23', // idx 3
  '2026-03-02', // idx 4
  '2026-03-09', // idx 5
  '2026-03-16', // idx 6
  '2026-03-23', // idx 7
  '2026-03-30', // idx 8
  '2026-04-06', // idx 9
  '2026-04-13', // idx 10
  '2026-04-20', // idx 11
  '2026-04-27', // idx 12
  '2026-05-04', // idx 13
  '2026-05-11', // idx 14
  '2026-05-18', // idx 15
]

function sessionInWeek(weekIdx, { tss, rpe, dayOffset = 1 }) {
  const monday = WEEK_MONDAYS[weekIdx]
  const d = new Date(monday + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + dayOffset)
  const entry = { date: d.toISOString().slice(0, 10), type: 'Endurance' }
  if (tss != null) entry.tss = tss
  if (rpe != null) entry.rpe = rpe
  return entry
}

// Build a log where each week gets a single session with the given tss + rpe.
function logFromWeekly({ tssArr, rpeArr }) {
  const out = []
  const n = Math.max(tssArr?.length || 0, rpeArr?.length || 0)
  for (let i = 0; i < n; i++) {
    const tss = tssArr?.[i]
    const rpe = rpeArr?.[i]
    if ((tss == null || tss === 0) && rpe == null) continue
    out.push(sessionInWeek(i, { tss: tss || undefined, rpe }))
  }
  return out
}

// ─── guards ───────────────────────────────────────────────────────────────

describe('analyzeAfterBigWeekRpe — guards', () => {
  it('returns null when called with no args', () => {
    expect(analyzeAfterBigWeekRpe()).toBeNull()
  })

  it('returns null when today is missing', () => {
    expect(analyzeAfterBigWeekRpe({ log: [] })).toBeNull()
  })

  it('returns null when today is a malformed string', () => {
    expect(
      analyzeAfterBigWeekRpe({ log: [], today: 'not-a-date' }),
    ).toBeNull()
  })

  it('returns null when today is an invalid Date', () => {
    expect(
      analyzeAfterBigWeekRpe({ log: [], today: new Date('totally bogus') }),
    ).toBeNull()
  })

  it('handles a null log gracefully', () => {
    const r = analyzeAfterBigWeekRpe({ log: null, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('INSUFFICIENT_DATA')
    expect(r.bigWeeks).toEqual([])
    expect(r.bigWeekCount).toBe(0)
  })

  it('ignores log entries with bad dates / non-finite values', () => {
    const log = [
      { date: null, tss: 100, rpe: 6 },
      { date: 'gibberish', tss: 100, rpe: 6 },
      { date: '2026-05-11', tss: 'nope', rpe: 'huh' },
      { date: '1999-01-01', tss: 200, rpe: 5 }, // out of window
    ]
    const r = analyzeAfterBigWeekRpe({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('INSUFFICIENT_DATA')
    expect(r.bigWeeks).toEqual([])
  })

  it('accepts today as a Date', () => {
    const r = analyzeAfterBigWeekRpe({
      log: [],
      today: new Date(`${TODAY}T12:00:00Z`),
    })
    expect(r).not.toBeNull()
    expect(r.band).toBe('INSUFFICIENT_DATA')
  })

  it('accepts today as an ISO string', () => {
    const r = analyzeAfterBigWeekRpe({ log: [], today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('INSUFFICIENT_DATA')
  })
})

// ─── INSUFFICIENT_DATA ────────────────────────────────────────────────────

describe('analyzeAfterBigWeekRpe — INSUFFICIENT_DATA', () => {
  it('returns INSUFFICIENT_DATA on empty log', () => {
    const r = analyzeAfterBigWeekRpe({ log: [], today: TODAY })
    expect(r).toEqual({
      band: 'INSUFFICIENT_DATA',
      bigWeeks: [],
      meanRpeElevationPct: 0,
      meanRpeReturnAtWeek2: 0,
      bigWeekCount: 0,
      citation: AFTER_BIG_WEEK_RPE_CITATION,
    })
  })

  it('returns INSUFFICIENT_DATA with zeroed values when only 1 big week exists', () => {
    const tssArr = [
      200, 200, 200, 280, 200, 200, 200, 200,
      200, 200, 200, 200, 200, 200, 200, 0,
    ]
    const rpeArr = [
      6, 6, 6, 7, 7, 6, 6, 6,
      6, 6, 6, 6, 6, 6, 6, null,
    ]
    const log = logFromWeekly({ tssArr, rpeArr })
    const r = analyzeAfterBigWeekRpe({ log, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_DATA')
    expect(r.bigWeekCount).toBe(0)
    expect(r.bigWeeks).toEqual([])
    expect(r.meanRpeElevationPct).toBe(0)
  })

  it('returns INSUFFICIENT_DATA with zeroed values when only 2 big weeks exist', () => {
    // Spike at idx 3 (280 vs 200 prior mean) and a separate spike later.
    // Between the spikes give the rolling mean enough room to drop.
    const log = [
      sessionInWeek(0, { tss: 200, rpe: 6 }),
      sessionInWeek(1, { tss: 200, rpe: 6 }),
      sessionInWeek(2, { tss: 200, rpe: 6 }),
      sessionInWeek(3, { tss: 280, rpe: 7 }), // big week 1
      sessionInWeek(4, { tss: 200, rpe: 7 }),
      sessionInWeek(5, { tss: 200, rpe: 6 }),
      sessionInWeek(6, { tss: 200, rpe: 6 }),
      sessionInWeek(7, { tss: 280, rpe: 7 }), // big week 2
      sessionInWeek(8, { tss: 200, rpe: 7 }),
    ]
    const r = analyzeAfterBigWeekRpe({ log, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_DATA')
    expect(r.bigWeekCount).toBe(0)
    expect(r.bigWeeks).toEqual([])
  })
})

// ─── NORMAL_RECOVERY ──────────────────────────────────────────────────────

describe('analyzeAfterBigWeekRpe — NORMAL_RECOVERY', () => {
  it('classifies week-1 elevation + week-2 return as NORMAL_RECOVERY', () => {
    // 3 big weeks (idx 3, 7, 11): each followed by RPE elevation in week+1
    // and a return toward baseline in week+2.
    const tssArr = [
      200, 200, 200, 280, 200, 200, 200, 280,
      200, 200, 200, 280, 200, 200, 200, 0,
    ]
    const rpeArr = [
      6, 6, 6, 6.5, 7.5, 6.2, 6, 6.5,
      7.5, 6.2, 6, 6.5, 7.5, 6.2, 6, null,
    ]
    const log = logFromWeekly({ tssArr, rpeArr })
    const r = analyzeAfterBigWeekRpe({ log, today: TODAY })
    expect(r.bigWeekCount).toBeGreaterThanOrEqual(3)
    expect(r.band).toBe('NORMAL_RECOVERY')
    expect(r.meanRpeElevationPct).toBeGreaterThan(0.05)
    expect(r.meanRpeReturnAtWeek2).toBeLessThan(r.meanRpeElevationPct)
  })
})

// ─── PROLONGED_ELEVATION ──────────────────────────────────────────────────

describe('analyzeAfterBigWeekRpe — PROLONGED_ELEVATION', () => {
  it('classifies week-2 still ≥ week-1 elevation as PROLONGED_ELEVATION', () => {
    // Big weeks at idx 3, 7, 11. Week+1 elevated and week+2 even more so.
    const tssArr = [
      200, 200, 200, 280, 200, 200, 200, 280,
      200, 200, 200, 280, 200, 200, 200, 0,
    ]
    const rpeArr = [
      6, 6, 6, 6, 7, 7.5, 6, 6,
      7, 7.5, 6, 6, 7, 7.5, 6, null,
    ]
    const log = logFromWeekly({ tssArr, rpeArr })
    const r = analyzeAfterBigWeekRpe({ log, today: TODAY })
    expect(r.bigWeekCount).toBeGreaterThanOrEqual(3)
    expect(r.band).toBe('PROLONGED_ELEVATION')
    expect(r.meanRpeReturnAtWeek2).toBeGreaterThanOrEqual(r.meanRpeElevationPct)
  })
})

// ─── RPE DROPPED (regression: must NOT be PROLONGED_ELEVATION) ─────────────

describe('analyzeAfterBigWeekRpe — RPE dropped after big weeks', () => {
  it('does not classify a recovery (RPE fell) as PROLONGED_ELEVATION', () => {
    // Big weeks at idx 3, 7, 11. Big-week RPE high (8); week+1 and week+2 RPE
    // fall to 6 → elevation AND return are both negative (-0.25). The old code
    // returned PROLONGED_ELEVATION because return >= elevation held for two
    // negatives; the fix requires positive elevation first → NO_RPE_RESPONSE.
    const tssArr = [
      200, 200, 200, 280, 200, 200, 200, 280,
      200, 200, 200, 280, 200, 200, 200, 0,
    ]
    const rpeArr = [
      6, 6, 6, 8, 6, 6, 8, 8,
      6, 6, 8, 8, 6, 6, 8, null,
    ]
    const log = logFromWeekly({ tssArr, rpeArr })
    const r = analyzeAfterBigWeekRpe({ log, today: TODAY })
    expect(r.bigWeekCount).toBeGreaterThanOrEqual(3)
    expect(r.meanRpeElevationPct).toBeLessThan(0)         // RPE actually fell
    expect(r.meanRpeReturnAtWeek2).toBeLessThan(0)
    expect(r.band).not.toBe('PROLONGED_ELEVATION')
    expect(r.band).toBe('NO_RPE_RESPONSE')
  })
})

// ─── NO_RPE_RESPONSE ──────────────────────────────────────────────────────

describe('analyzeAfterBigWeekRpe — NO_RPE_RESPONSE', () => {
  it('classifies flat RPE post-big-week as NO_RPE_RESPONSE', () => {
    // 3 big weeks with identical RPE before / during / after.
    const tssArr = [
      200, 200, 200, 280, 200, 200, 200, 280,
      200, 200, 200, 280, 200, 200, 200, 0,
    ]
    const rpeArr = [
      6, 6, 6, 6, 6, 6, 6, 6,
      6, 6, 6, 6, 6, 6, 6, null,
    ]
    const log = logFromWeekly({ tssArr, rpeArr })
    const r = analyzeAfterBigWeekRpe({ log, today: TODAY })
    expect(r.bigWeekCount).toBeGreaterThanOrEqual(3)
    expect(r.band).toBe('NO_RPE_RESPONSE')
    expect(Math.abs(r.meanRpeElevationPct)).toBeLessThan(0.05)
  })
})

// ─── week-mean RPE math ───────────────────────────────────────────────────

describe('analyzeAfterBigWeekRpe — week-mean RPE math', () => {
  it('averages all finite rpe entries in a week', () => {
    // Big week idx 3 with two sessions: rpe 6 + rpe 8 → mean 7.
    const log = [
      sessionInWeek(0, { tss: 200, rpe: 6 }),
      sessionInWeek(1, { tss: 200, rpe: 6 }),
      sessionInWeek(2, { tss: 200, rpe: 6 }),
      sessionInWeek(3, { tss: 280, rpe: 6, dayOffset: 1 }),
      sessionInWeek(3, { rpe: 8, dayOffset: 2 }),
      sessionInWeek(4, { tss: 200, rpe: 7 }),
      sessionInWeek(5, { tss: 200, rpe: 6 }),
      sessionInWeek(6, { tss: 200, rpe: 6 }),
      sessionInWeek(7, { tss: 280, rpe: 7 }),
      sessionInWeek(8, { tss: 200, rpe: 7 }),
      sessionInWeek(11, { tss: 280, rpe: 7 }),
      sessionInWeek(12, { tss: 200, rpe: 7 }),
    ]
    const r = analyzeAfterBigWeekRpe({ log, today: TODAY })
    const ev = r.bigWeeks.find((b) => b.weekStart === WEEK_MONDAYS[3])
    expect(ev).toBeDefined()
    expect(ev.bigWeekMeanRpe).toBe(7) // (6+8)/2 = 7
  })

  it('ignores non-finite rpe entries when computing the week mean', () => {
    // 3 big weeks total; idx 3 has rpe=6 + rpe='nope' → mean must be 6 (not NaN).
    const log = [
      sessionInWeek(0, { tss: 200, rpe: 6 }),
      sessionInWeek(1, { tss: 200, rpe: 6 }),
      sessionInWeek(2, { tss: 200, rpe: 6 }),
      sessionInWeek(3, { tss: 280, rpe: 6, dayOffset: 1 }),
      sessionInWeek(3, { rpe: 'nope', dayOffset: 2 }),
      sessionInWeek(4, { tss: 200, rpe: 6 }),
      sessionInWeek(5, { tss: 200, rpe: 6 }),
      sessionInWeek(6, { tss: 200, rpe: 6 }),
      sessionInWeek(7, { tss: 280, rpe: 7 }),
      sessionInWeek(8, { tss: 200, rpe: 7 }),
      sessionInWeek(9, { tss: 200, rpe: 6 }),
      sessionInWeek(10, { tss: 200, rpe: 6 }),
      sessionInWeek(11, { tss: 280, rpe: 7 }),
      sessionInWeek(12, { tss: 200, rpe: 7 }),
    ]
    const r = analyzeAfterBigWeekRpe({ log, today: TODAY })
    const ev = r.bigWeeks.find((b) => b.weekStart === WEEK_MONDAYS[3])
    expect(ev).toBeDefined()
    expect(ev.bigWeekMeanRpe).toBe(6)
  })
})

// ─── missing RPE → null cascade ───────────────────────────────────────────

describe('analyzeAfterBigWeekRpe — missing RPE', () => {
  it('null bigWeekMeanRpe and nullable rpeElevationPct when no rpe in big week', () => {
    // 3 big weeks total. Idx 3 big week has TSS but no rpe entries.
    const log = [
      sessionInWeek(0, { tss: 200, rpe: 6 }),
      sessionInWeek(1, { tss: 200, rpe: 6 }),
      sessionInWeek(2, { tss: 200, rpe: 6 }),
      sessionInWeek(3, { tss: 280 }), // no rpe
      sessionInWeek(4, { tss: 200, rpe: 7 }),
      sessionInWeek(5, { tss: 200, rpe: 6 }),
      sessionInWeek(6, { tss: 200, rpe: 6 }),
      sessionInWeek(7, { tss: 280, rpe: 6 }),
      sessionInWeek(8, { tss: 200, rpe: 7 }),
      sessionInWeek(9, { tss: 200, rpe: 6 }),
      sessionInWeek(10, { tss: 200, rpe: 6 }),
      sessionInWeek(11, { tss: 280, rpe: 6 }),
      sessionInWeek(12, { tss: 200, rpe: 7 }),
    ]
    const r = analyzeAfterBigWeekRpe({ log, today: TODAY })
    const ev = r.bigWeeks.find((b) => b.weekStart === WEEK_MONDAYS[3])
    expect(ev).toBeDefined()
    expect(ev.bigWeekMeanRpe).toBeNull()
    expect(ev.rpeElevationPct).toBeNull()
  })

  it('excludes null rpeElevationPct from meanRpeElevationPct aggregate', () => {
    // 3 big weeks, but idx 3 has no rpe → elevationPct null → excluded.
    const log = [
      sessionInWeek(0, { tss: 200, rpe: 6 }),
      sessionInWeek(1, { tss: 200, rpe: 6 }),
      sessionInWeek(2, { tss: 200, rpe: 6 }),
      sessionInWeek(3, { tss: 280 }), // no rpe → elevationPct null
      sessionInWeek(4, { tss: 200, rpe: 7 }),
      sessionInWeek(5, { tss: 200, rpe: 6 }),
      sessionInWeek(6, { tss: 200, rpe: 6 }),
      sessionInWeek(7, { tss: 280, rpe: 6 }),
      sessionInWeek(8, { tss: 200, rpe: 7 }), // elevation: 1/6 ≈ 0.1667
      sessionInWeek(9, { tss: 200, rpe: 6 }),
      sessionInWeek(10, { tss: 200, rpe: 6 }),
      sessionInWeek(11, { tss: 280, rpe: 6 }),
      sessionInWeek(12, { tss: 200, rpe: 7 }), // elevation: 0.1667
    ]
    const r = analyzeAfterBigWeekRpe({ log, today: TODAY })
    expect(r.bigWeekCount).toBeGreaterThanOrEqual(3)
    const nonNull = r.bigWeeks.filter((b) => b.rpeElevationPct != null)
    expect(nonNull.length).toBe(r.bigWeeks.length - 1)
    // meanRpeElevationPct = avg of (only) non-null elevations ≈ 0.1667.
    expect(r.meanRpeElevationPct).toBeCloseTo(0.1667, 3)
  })
})

// ─── big-week threshold ───────────────────────────────────────────────────

describe('analyzeAfterBigWeekRpe — big-week threshold', () => {
  it('treats exactly threshold as a big week (≥, not >)', () => {
    // 3 big weeks each at EXACTLY threshold (prior mean 200 → 240).
    const log = [
      sessionInWeek(0, { tss: 200, rpe: 6 }),
      sessionInWeek(1, { tss: 200, rpe: 6 }),
      sessionInWeek(2, { tss: 200, rpe: 6 }),
      sessionInWeek(3, { tss: 240, rpe: 7 }),
      sessionInWeek(4, { tss: 200, rpe: 7 }),
      sessionInWeek(5, { tss: 200, rpe: 6 }),
      sessionInWeek(6, { tss: 200, rpe: 6 }),
      sessionInWeek(7, { tss: 240, rpe: 7 }),
      sessionInWeek(8, { tss: 200, rpe: 7 }),
      sessionInWeek(9, { tss: 200, rpe: 6 }),
      sessionInWeek(10, { tss: 200, rpe: 6 }),
      sessionInWeek(11, { tss: 240, rpe: 7 }),
      sessionInWeek(12, { tss: 200, rpe: 7 }),
    ]
    const r = analyzeAfterBigWeekRpe({ log, today: TODAY })
    expect(r.bigWeekCount).toBeGreaterThanOrEqual(3)
    expect(r.bigWeeks.find((b) => b.weekStart === WEEK_MONDAYS[3])).toBeDefined()
  })

  it('does NOT mark a week below threshold (e.g. 239 vs 240) as big', () => {
    // Provide 3 valid big weeks elsewhere so the function does NOT bail to
    // INSUFFICIENT_DATA — then verify idx 3 (239 < 240) is NOT a big week.
    const log = [
      sessionInWeek(0, { tss: 200, rpe: 6 }),
      sessionInWeek(1, { tss: 200, rpe: 6 }),
      sessionInWeek(2, { tss: 200, rpe: 6 }),
      sessionInWeek(3, { tss: 239, rpe: 7 }), // BELOW threshold
      sessionInWeek(4, { tss: 200, rpe: 7 }),
      sessionInWeek(5, { tss: 200, rpe: 6 }),
      sessionInWeek(6, { tss: 200, rpe: 6 }),
      sessionInWeek(7, { tss: 280, rpe: 7 }),
      sessionInWeek(8, { tss: 200, rpe: 7 }),
      sessionInWeek(9, { tss: 200, rpe: 6 }),
      sessionInWeek(10, { tss: 200, rpe: 6 }),
      sessionInWeek(11, { tss: 280, rpe: 7 }),
      sessionInWeek(12, { tss: 200, rpe: 7 }),
      sessionInWeek(13, { tss: 200, rpe: 6 }),
      sessionInWeek(14, { tss: 280, rpe: 7 }),
    ]
    const r = analyzeAfterBigWeekRpe({ log, today: TODAY })
    expect(r.bigWeekCount).toBeGreaterThanOrEqual(3)
    expect(r.bigWeeks.find((b) => b.weekStart === WEEK_MONDAYS[3])).toBeUndefined()
  })
})

// ─── priorMeanTss = 0 skipped ─────────────────────────────────────────────

describe('analyzeAfterBigWeekRpe — priorMeanTss = 0', () => {
  it('skips weeks with priorMeanTss = 0', () => {
    // First 3 weeks empty → idx 3 cannot be flagged.
    const log = [
      sessionInWeek(3, { tss: 500, rpe: 7 }),
      sessionInWeek(4, { tss: 200, rpe: 7 }),
    ]
    const r = analyzeAfterBigWeekRpe({ log, today: TODAY })
    expect(r.bigWeeks.find((b) => b.weekStart === WEEK_MONDAYS[3])).toBeUndefined()
  })
})

// ─── follow-up windows ────────────────────────────────────────────────────

describe('analyzeAfterBigWeekRpe — follow-up windows', () => {
  it('nextWeekMeanRpe is null when big week is the last index', () => {
    // Big week at idx 15 — but idx 15 is the current partial week.
    // Since priorMean fills first, big at idx 14 with nextIdx=15 still
    // returns meanRpe (it's just that week 15 only has rpe if a session
    // is logged this week). Use idx 14 with no week 15 session → next null.
    const log = [
      sessionInWeek(11, { tss: 200, rpe: 6 }),
      sessionInWeek(12, { tss: 200, rpe: 6 }),
      sessionInWeek(13, { tss: 200, rpe: 6 }),
      sessionInWeek(14, { tss: 280, rpe: 7 }),
      // No session in week 15.
    ]
    const r = analyzeAfterBigWeekRpe({ log, today: TODAY })
    const ev = r.bigWeeks.find((b) => b.weekStart === WEEK_MONDAYS[14])
    expect(ev).toBeDefined()
    expect(ev.nextWeekMeanRpe).toBeNull()
    expect(ev.twoWeeksOutMeanRpe).toBeNull()
    expect(ev.rpeElevationPct).toBeNull()
  })

  it('twoWeeksOutMeanRpe is null when i+2 outside window', () => {
    // Big week at idx 14 → twoWeeksOut idx 16 outside window.
    const log = [
      sessionInWeek(11, { tss: 200, rpe: 6 }),
      sessionInWeek(12, { tss: 200, rpe: 6 }),
      sessionInWeek(13, { tss: 200, rpe: 6 }),
      sessionInWeek(14, { tss: 280, rpe: 7 }),
      sessionInWeek(15, { tss: 200, rpe: 7 }),
    ]
    const r = analyzeAfterBigWeekRpe({ log, today: TODAY })
    const ev = r.bigWeeks.find((b) => b.weekStart === WEEK_MONDAYS[14])
    expect(ev).toBeDefined()
    expect(ev.twoWeeksOutMeanRpe).toBeNull()
    expect(ev.nextWeekMeanRpe).toBe(7)
  })
})

// ─── custom windowWeeks ───────────────────────────────────────────────────

describe('analyzeAfterBigWeekRpe — custom windowWeeks', () => {
  it('respects a smaller windowWeeks (only counts within window)', () => {
    // windowWeeks = 6. Last 6 Mondays end at idx 15 = 2026-05-18, so
    // window covers idx 10..15 in our 16-idx grid (= 2026-04-13 onwards).
    // Sessions before that should be ignored.
    const log = [
      // OUTSIDE window:
      sessionInWeek(3, { tss: 280, rpe: 7 }),
      sessionInWeek(4, { tss: 200, rpe: 7 }),
      // INSIDE window:
      sessionInWeek(10, { tss: 200, rpe: 6 }),
      sessionInWeek(11, { tss: 200, rpe: 6 }),
      sessionInWeek(12, { tss: 200, rpe: 6 }),
      sessionInWeek(13, { tss: 280, rpe: 7 }),
      sessionInWeek(14, { tss: 200, rpe: 7 }),
    ]
    const r = analyzeAfterBigWeekRpe({ log, today: TODAY, windowWeeks: 6 })
    expect(r).not.toBeNull()
    // The idx-3 spike is outside the 6-week window so should not appear.
    expect(
      r.bigWeeks.find((b) => b.weekStart === WEEK_MONDAYS[3]),
    ).toBeUndefined()
  })

  it('clamps windowWeeks below 4 to 4', () => {
    const r = analyzeAfterBigWeekRpe({ log: [], today: TODAY, windowWeeks: 1 })
    expect(r).not.toBeNull()
    expect(r.band).toBe('INSUFFICIENT_DATA')
  })
})

// ─── custom bigWeekThresholdPct ───────────────────────────────────────────

describe('analyzeAfterBigWeekRpe — custom bigWeekThresholdPct', () => {
  it('lower threshold catches more weeks', () => {
    // 3 weeks each at +12% over prior. With default 1.20 → no big weeks
    // → INSUFFICIENT_DATA. With 1.10 → 3 big weeks detected.
    const log = [
      sessionInWeek(0, { tss: 200, rpe: 6 }),
      sessionInWeek(1, { tss: 200, rpe: 6 }),
      sessionInWeek(2, { tss: 200, rpe: 6 }),
      sessionInWeek(3, { tss: 230, rpe: 7 }),
      sessionInWeek(4, { tss: 200, rpe: 7 }),
      sessionInWeek(5, { tss: 200, rpe: 6 }),
      sessionInWeek(6, { tss: 200, rpe: 6 }),
      sessionInWeek(7, { tss: 230, rpe: 7 }),
      sessionInWeek(8, { tss: 200, rpe: 7 }),
      sessionInWeek(9, { tss: 200, rpe: 6 }),
      sessionInWeek(10, { tss: 200, rpe: 6 }),
      sessionInWeek(11, { tss: 230, rpe: 7 }),
      sessionInWeek(12, { tss: 200, rpe: 7 }),
    ]
    const r110 = analyzeAfterBigWeekRpe({
      log,
      today: TODAY,
      bigWeekThresholdPct: 1.10,
    })
    expect(r110.bigWeekCount).toBeGreaterThanOrEqual(3)
    const r120 = analyzeAfterBigWeekRpe({ log, today: TODAY })
    expect(r120.bigWeekCount).toBe(0)
    expect(r120.band).toBe('INSUFFICIENT_DATA')
  })

  it('falls back to default when bigWeekThresholdPct is non-finite or ≤ 0', () => {
    // 3 spikes at default 1.20 → big weeks. Pass non-finite threshold.
    const log = [
      sessionInWeek(0, { tss: 200, rpe: 6 }),
      sessionInWeek(1, { tss: 200, rpe: 6 }),
      sessionInWeek(2, { tss: 200, rpe: 6 }),
      sessionInWeek(3, { tss: 280, rpe: 7 }),
      sessionInWeek(4, { tss: 200, rpe: 7 }),
      sessionInWeek(5, { tss: 200, rpe: 6 }),
      sessionInWeek(7, { tss: 280, rpe: 7 }),
      sessionInWeek(8, { tss: 200, rpe: 7 }),
      sessionInWeek(11, { tss: 280, rpe: 7 }),
      sessionInWeek(12, { tss: 200, rpe: 7 }),
    ]
    const r = analyzeAfterBigWeekRpe({
      log,
      today: TODAY,
      bigWeekThresholdPct: -1,
    })
    expect(r.bigWeekCount).toBeGreaterThanOrEqual(3)
  })
})

// ─── ISO week boundary ────────────────────────────────────────────────────

describe('analyzeAfterBigWeekRpe — ISO week boundary', () => {
  it('treats Sunday as the last day of its Monday-anchored week', () => {
    // Sunday 2026-05-10 → Monday of week = 2026-05-04 (idx 13).
    const log = [
      sessionInWeek(10, { tss: 200, rpe: 6 }),
      sessionInWeek(11, { tss: 200, rpe: 6 }),
      sessionInWeek(12, { tss: 200, rpe: 6 }),
      { date: '2026-05-10', tss: 280, rpe: 7, type: 'Endurance' },
      sessionInWeek(14, { tss: 200, rpe: 7 }),
    ]
    const r = analyzeAfterBigWeekRpe({ log, today: TODAY })
    const ev = r.bigWeeks.find((b) => b.weekStart === WEEK_MONDAYS[13])
    expect(ev).toBeDefined()
    expect(ev.bigWeekMeanRpe).toBe(7)
  })

  it('treats Monday as the first day of its own week', () => {
    // Monday 2026-05-04 → Monday of week = 2026-05-04 (idx 13).
    const log = [
      sessionInWeek(10, { tss: 200, rpe: 6 }),
      sessionInWeek(11, { tss: 200, rpe: 6 }),
      sessionInWeek(12, { tss: 200, rpe: 6 }),
      { date: '2026-05-04', tss: 280, rpe: 7, type: 'Endurance' },
    ]
    const r = analyzeAfterBigWeekRpe({ log, today: TODAY })
    const ev = r.bigWeeks.find((b) => b.weekStart === WEEK_MONDAYS[13])
    expect(ev).toBeDefined()
  })
})

// ─── ordering + rounding ──────────────────────────────────────────────────

describe('analyzeAfterBigWeekRpe — ordering + rounding', () => {
  it('returns bigWeeks oldest-first', () => {
    // Big weeks at idx 3, 7, 11.
    const tssArr = [
      200, 200, 200, 280, 200, 200, 200, 280,
      200, 200, 200, 280, 200, 200, 200, 0,
    ]
    const rpeArr = [
      6, 6, 6, 6.5, 7.5, 6.2, 6, 6.5,
      7.5, 6.2, 6, 6.5, 7.5, 6.2, 6, null,
    ]
    const log = logFromWeekly({ tssArr, rpeArr })
    const r = analyzeAfterBigWeekRpe({ log, today: TODAY })
    expect(r.bigWeeks.length).toBeGreaterThanOrEqual(3)
    const starts = r.bigWeeks.map((b) => b.weekStart)
    const sorted = [...starts].sort()
    expect(starts).toEqual(sorted)
  })

  it('rounds rpeElevationPct to 4 decimal places', () => {
    // 3 big weeks, each: bigMean 6, nextMean 7 → 1/6 ≈ 0.1667.
    const log = [
      sessionInWeek(0, { tss: 200, rpe: 6 }),
      sessionInWeek(1, { tss: 200, rpe: 6 }),
      sessionInWeek(2, { tss: 200, rpe: 6 }),
      sessionInWeek(3, { tss: 280, rpe: 6 }),
      sessionInWeek(4, { tss: 200, rpe: 7 }),
      sessionInWeek(5, { tss: 200, rpe: 6 }),
      sessionInWeek(6, { tss: 200, rpe: 6 }),
      sessionInWeek(7, { tss: 280, rpe: 6 }),
      sessionInWeek(8, { tss: 200, rpe: 7 }),
      sessionInWeek(9, { tss: 200, rpe: 6 }),
      sessionInWeek(10, { tss: 200, rpe: 6 }),
      sessionInWeek(11, { tss: 280, rpe: 6 }),
      sessionInWeek(12, { tss: 200, rpe: 7 }),
    ]
    const r = analyzeAfterBigWeekRpe({ log, today: TODAY })
    const ev = r.bigWeeks.find((b) => b.weekStart === WEEK_MONDAYS[3])
    expect(ev).toBeDefined()
    expect(ev.rpeElevationPct).toBeCloseTo(0.1667, 4)
    // exactly 4dp encoding
    const decimals = (ev.rpeElevationPct.toString().split('.')[1] || '').length
    expect(decimals).toBeLessThanOrEqual(4)
  })

  it('rounds bigWeekMeanRpe / nextWeekMeanRpe to 2 decimals', () => {
    // 3 big weeks. Idx 3 sessions: rpe 6.12345 + 6.12345 → 6.12, week 4 → 7.98765 → 7.99.
    const log = [
      sessionInWeek(0, { tss: 200, rpe: 6 }),
      sessionInWeek(1, { tss: 200, rpe: 6 }),
      sessionInWeek(2, { tss: 200, rpe: 6 }),
      sessionInWeek(3, { tss: 280, rpe: 6.12345 }),
      sessionInWeek(4, { tss: 200, rpe: 7.98765 }),
      sessionInWeek(5, { tss: 200, rpe: 6 }),
      sessionInWeek(6, { tss: 200, rpe: 6 }),
      sessionInWeek(7, { tss: 280, rpe: 6 }),
      sessionInWeek(8, { tss: 200, rpe: 7 }),
      sessionInWeek(9, { tss: 200, rpe: 6 }),
      sessionInWeek(10, { tss: 200, rpe: 6 }),
      sessionInWeek(11, { tss: 280, rpe: 6 }),
      sessionInWeek(12, { tss: 200, rpe: 7 }),
    ]
    const r = analyzeAfterBigWeekRpe({ log, today: TODAY })
    const ev = r.bigWeeks.find((b) => b.weekStart === WEEK_MONDAYS[3])
    expect(ev).toBeDefined()
    expect(ev.bigWeekMeanRpe).toBe(6.12)
    expect(ev.nextWeekMeanRpe).toBe(7.99)
  })

  it('citation passthrough', () => {
    const r = analyzeAfterBigWeekRpe({ log: [], today: TODAY })
    expect(r.citation).toBe(AFTER_BIG_WEEK_RPE_CITATION)
    expect(r.citation).toMatch(/Halson 2014/)
    expect(r.citation).toMatch(/Foster 2001/)
  })
})

// ─── elevation aggregate math ─────────────────────────────────────────────

describe('analyzeAfterBigWeekRpe — meanRpeElevationPct aggregate', () => {
  it('matches arithmetic mean of non-null rpeElevationPct', () => {
    // 3 big weeks with elevation 0.10, 0.20, 0.30 → mean 0.20.
    const log = [
      sessionInWeek(0, { tss: 200, rpe: 6 }),
      sessionInWeek(1, { tss: 200, rpe: 6 }),
      sessionInWeek(2, { tss: 200, rpe: 6 }),
      sessionInWeek(3, { tss: 280, rpe: 10 }),
      sessionInWeek(4, { tss: 200, rpe: 11 }), // 1/10 = 0.10
      sessionInWeek(5, { tss: 200, rpe: 6 }),
      sessionInWeek(6, { tss: 200, rpe: 6 }),
      sessionInWeek(7, { tss: 280, rpe: 10 }),
      sessionInWeek(8, { tss: 200, rpe: 12 }), // 2/10 = 0.20
      sessionInWeek(9, { tss: 200, rpe: 6 }),
      sessionInWeek(10, { tss: 200, rpe: 6 }),
      sessionInWeek(11, { tss: 280, rpe: 10 }),
      sessionInWeek(12, { tss: 200, rpe: 13 }), // 3/10 = 0.30
    ]
    const r = analyzeAfterBigWeekRpe({ log, today: TODAY })
    expect(r.bigWeekCount).toBeGreaterThanOrEqual(3)
    expect(r.meanRpeElevationPct).toBeCloseTo(0.20, 3)
  })
})

// ─── meanRpeReturnAtWeek2 ─────────────────────────────────────────────────

describe('analyzeAfterBigWeekRpe — meanRpeReturnAtWeek2 aggregate', () => {
  it('matches arithmetic mean of (week2-base)/base across qualifying entries', () => {
    // 3 big weeks. base 10, week2 RPE 11/12/13 → returns 0.10/0.20/0.30 → mean 0.20.
    const log = [
      sessionInWeek(0, { tss: 200, rpe: 6 }),
      sessionInWeek(1, { tss: 200, rpe: 6 }),
      sessionInWeek(2, { tss: 200, rpe: 6 }),
      sessionInWeek(3, { tss: 280, rpe: 10 }),
      sessionInWeek(4, { tss: 200, rpe: 11 }),
      sessionInWeek(5, { tss: 200, rpe: 11 }), // week 2 after = 11
      sessionInWeek(6, { tss: 200, rpe: 6 }),
      sessionInWeek(7, { tss: 280, rpe: 10 }),
      sessionInWeek(8, { tss: 200, rpe: 12 }),
      sessionInWeek(9, { tss: 200, rpe: 12 }), // week 2 after = 12
      sessionInWeek(10, { tss: 200, rpe: 6 }),
      sessionInWeek(11, { tss: 280, rpe: 10 }),
      sessionInWeek(12, { tss: 200, rpe: 13 }),
      sessionInWeek(13, { tss: 200, rpe: 13 }), // week 2 after = 13
    ]
    const r = analyzeAfterBigWeekRpe({ log, today: TODAY })
    expect(r.bigWeekCount).toBeGreaterThanOrEqual(3)
    expect(r.meanRpeReturnAtWeek2).toBeCloseTo(0.20, 3)
  })
})
