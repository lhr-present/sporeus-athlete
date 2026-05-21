// Consecutive Deload Count — pure-function tests.
//
// Covers:
//   - guards (null today, malformed string, invalid Date, non-array log),
//   - INSUFFICIENT_DATA (< 6 classifiable weeks),
//   - NO_RUNS (deloads exist but isolated),
//   - OCCASIONAL_RUN (1 back-to-back event of length 2),
//   - EXTENDED_RUN by count (> 1 events),
//   - EXTENDED_RUN by length (single run of length > 2),
//   - run detection (3 consecutive = 1 run length 3, not 2 runs),
//   - TSS = 0 (break) does NOT count as a deload,
//   - deloadThresholdPct strict-less-than boundary,
//   - priorMean = 0 weeks skipped + DO NOT count as classifiable,
//   - deloadWeeksTotal counts singletons + in-runs,
//   - runs sorted oldest-first,
//   - custom windowWeeks / deloadThresholdPct,
//   - ISO week (Monday) boundary correctness,
//   - today as Date vs ISO string,
//   - meanRunTss + priorRefTss math & integer rounding,
//   - citation exported and surfaced on every result.

import { describe, it, expect } from 'vitest'
import {
  analyzeConsecutiveDeloadCount,
  CONSECUTIVE_DELOAD_COUNT_CITATION,
} from '../../athlete/consecutiveDeloadCount.js'

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
  '2026-05-11', // idx 14 (last completed)
  '2026-05-18', // idx 15 (current partial week)
]

function sessionInWeek(weekIdx, tss, dayOffset = 1) {
  const monday = WEEK_MONDAYS[weekIdx]
  const d = new Date(monday + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + dayOffset)
  return { date: d.toISOString().slice(0, 10), tss, type: 'Endurance' }
}

function logFromWeeklyTss(weekly) {
  const out = []
  for (let i = 0; i < weekly.length; i++) {
    const tss = Number(weekly[i])
    if (!Number.isFinite(tss) || tss <= 0) continue
    out.push(sessionInWeek(i, tss, 1))
  }
  return out
}

// ─── guards ───────────────────────────────────────────────────────────────

describe('analyzeConsecutiveDeloadCount — guards', () => {
  it('returns null when called with no args', () => {
    expect(analyzeConsecutiveDeloadCount()).toBeNull()
  })

  it('returns null when today is missing', () => {
    expect(analyzeConsecutiveDeloadCount({ log: [] })).toBeNull()
  })

  it('returns null when today is a malformed string', () => {
    expect(
      analyzeConsecutiveDeloadCount({ log: [], today: 'not-a-date' }),
    ).toBeNull()
  })

  it('returns null when today is an invalid Date', () => {
    expect(
      analyzeConsecutiveDeloadCount({
        log: [],
        today: new Date('totally invalid'),
      }),
    ).toBeNull()
  })

  it('handles a non-array log gracefully → INSUFFICIENT_DATA', () => {
    const r = analyzeConsecutiveDeloadCount({ log: null, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('INSUFFICIENT_DATA')
    expect(r.runs).toEqual([])
    expect(r.totalRuns).toBe(0)
    expect(r.longestRunWeeks).toBe(0)
    expect(r.deloadWeeksTotal).toBe(0)
  })

  it('ignores log entries with bad dates / non-numeric TSS', () => {
    const log = [
      { date: null, tss: 100 },
      { date: 'gibberish', tss: 100 },
      { date: '2026-05-11', tss: 'nope' },
      { date: '1999-01-01', tss: 200 }, // out of window
    ]
    const r = analyzeConsecutiveDeloadCount({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('INSUFFICIENT_DATA')
  })
})

// ─── INSUFFICIENT_DATA ────────────────────────────────────────────────────

describe('analyzeConsecutiveDeloadCount — INSUFFICIENT_DATA gate', () => {
  it('returns INSUFFICIENT_DATA on an empty log', () => {
    const r = analyzeConsecutiveDeloadCount({ log: [], today: TODAY })
    expect(r).toEqual({
      band: 'INSUFFICIENT_DATA',
      runs: [],
      totalRuns: 0,
      longestRunWeeks: 0,
      deloadWeeksTotal: 0,
      citation: CONSECUTIVE_DELOAD_COUNT_CITATION,
    })
  })

  it('returns INSUFFICIENT_DATA when fewer than 6 classifiable weeks exist', () => {
    // Only weeks 13/14 can be classifiable (need 3 priors with non-zero TSS).
    // Loads only at idx 10..14 → priors non-zero from idx 13.
    const weekly = [
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 200, 200, 200, 200, 200, 0,
    ]
    const log = logFromWeeklyTss(weekly)
    const r = analyzeConsecutiveDeloadCount({ log, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_DATA')
  })

  it('passes the gate at exactly 6+ classifiable weeks', () => {
    // Loads from idx 6 onward → priors non-zero from idx 9 → 7 classifiable.
    const weekly = [
      0, 0, 0, 0, 0, 0, 200, 200,
      200, 200, 200, 200, 200, 200, 200, 0,
    ]
    const log = logFromWeeklyTss(weekly)
    const r = analyzeConsecutiveDeloadCount({ log, today: TODAY })
    expect(r.band).not.toBe('INSUFFICIENT_DATA')
  })
})

// ─── NO_RUNS ──────────────────────────────────────────────────────────────

describe('analyzeConsecutiveDeloadCount — NO_RUNS band', () => {
  it('returns NO_RUNS when no week is a deload', () => {
    const log = logFromWeeklyTss([
      200, 200, 200, 200, 200, 200, 200, 200,
      200, 200, 200, 200, 200, 200, 200, 0,
    ])
    const r = analyzeConsecutiveDeloadCount({ log, today: TODAY })
    expect(r.band).toBe('NO_RUNS')
    expect(r.totalRuns).toBe(0)
    expect(r.longestRunWeeks).toBe(0)
    expect(r.deloadWeeksTotal).toBe(0)
  })

  it('returns NO_RUNS when a SINGLE deload week is isolated', () => {
    // Steady 200 baseline; idx 7 dips to 100 (= 0.50 × 200 < 0.75 × 200=150 → deload).
    // Surrounding weeks normal → no back-to-back run.
    const log = logFromWeeklyTss([
      200, 200, 200, 200, 200, 200, 200, 100,
      200, 200, 200, 200, 200, 200, 200, 0,
    ])
    const r = analyzeConsecutiveDeloadCount({ log, today: TODAY })
    expect(r.band).toBe('NO_RUNS')
    expect(r.totalRuns).toBe(0)
    expect(r.deloadWeeksTotal).toBeGreaterThanOrEqual(1)
  })

  it('returns NO_RUNS when two deloads are separated by a normal week', () => {
    // 200 baseline; idx 6=100, idx 7=200, idx 8=100. Run is broken by the normal week.
    const log = logFromWeeklyTss([
      200, 200, 200, 200, 200, 200, 100, 200,
      100, 200, 200, 200, 200, 200, 200, 0,
    ])
    const r = analyzeConsecutiveDeloadCount({ log, today: TODAY })
    expect(r.band).toBe('NO_RUNS')
    expect(r.totalRuns).toBe(0)
  })
})

// ─── OCCASIONAL_RUN ───────────────────────────────────────────────────────

describe('analyzeConsecutiveDeloadCount — OCCASIONAL_RUN band', () => {
  it('classifies a single back-to-back deload event (length 2) as OCCASIONAL_RUN', () => {
    // 200 baseline, idx 7 + idx 8 both at 100 (both deloads vs priorMean=200).
    // priorMean for idx 8 needs idx 5/6/7 → 200/200/100 → mean=166.67; 100 < 0.75×166.67=125 → deload.
    const log = logFromWeeklyTss([
      200, 200, 200, 200, 200, 200, 200, 100,
      100, 200, 200, 200, 200, 200, 200, 0,
    ])
    const r = analyzeConsecutiveDeloadCount({ log, today: TODAY })
    expect(r.band).toBe('OCCASIONAL_RUN')
    expect(r.totalRuns).toBe(1)
    expect(r.longestRunWeeks).toBe(2)
    expect(r.runs).toHaveLength(1)
    expect(r.runs[0].startWeekStart).toBe(WEEK_MONDAYS[7])
    expect(r.runs[0].endWeekStart).toBe(WEEK_MONDAYS[8])
    expect(r.runs[0].lengthWeeks).toBe(2)
  })
})

// ─── EXTENDED_RUN ─────────────────────────────────────────────────────────

describe('analyzeConsecutiveDeloadCount — EXTENDED_RUN band', () => {
  it('classifies > 1 back-to-back events as EXTENDED_RUN (by count)', () => {
    // Two separate runs of length 2: idx 5+6 and idx 11+12.
    // Need priorMean baselines to recover between runs → use steady weeks.
    const log = logFromWeeklyTss([
      200, 200, 200, 200, 200, 100, 100, 200,
      200, 200, 200, 100, 100, 200, 200, 0,
    ])
    const r = analyzeConsecutiveDeloadCount({ log, today: TODAY })
    expect(r.band).toBe('EXTENDED_RUN')
    expect(r.totalRuns).toBeGreaterThanOrEqual(2)
  })

  it('classifies a single run of length > 2 as EXTENDED_RUN (by length)', () => {
    // 3 consecutive deload weeks at idx 7/8/9 → ONE run of length 3.
    // Use deep deloads (40) so the rolling priorMean stays well above 0.75×.
    const log = logFromWeeklyTss([
      200, 200, 200, 200, 200, 200, 200, 40,
      40, 40, 200, 200, 200, 200, 200, 0,
    ])
    const r = analyzeConsecutiveDeloadCount({ log, today: TODAY })
    expect(r.band).toBe('EXTENDED_RUN')
    expect(r.totalRuns).toBe(1)
    expect(r.longestRunWeeks).toBe(3)
    expect(r.runs[0].lengthWeeks).toBe(3)
  })
})

// ─── run detection ────────────────────────────────────────────────────────

describe('analyzeConsecutiveDeloadCount — run detection', () => {
  it('treats 3 consecutive deload weeks as ONE run of length 3 (not 2 runs)', () => {
    const log = logFromWeeklyTss([
      200, 200, 200, 200, 200, 200, 200, 40,
      40, 40, 200, 200, 200, 200, 200, 0,
    ])
    const r = analyzeConsecutiveDeloadCount({ log, today: TODAY })
    expect(r.runs).toHaveLength(1)
    expect(r.runs[0].lengthWeeks).toBe(3)
    expect(r.runs[0].startWeekStart).toBe(WEEK_MONDAYS[7])
    expect(r.runs[0].endWeekStart).toBe(WEEK_MONDAYS[9])
  })

  it('does NOT include singletons as runs', () => {
    // Single isolated deload week + a separate normal stretch.
    const log = logFromWeeklyTss([
      200, 200, 200, 200, 200, 200, 200, 100,
      200, 200, 200, 200, 200, 200, 200, 0,
    ])
    const r = analyzeConsecutiveDeloadCount({ log, today: TODAY })
    expect(r.totalRuns).toBe(0)
    expect(r.deloadWeeksTotal).toBeGreaterThanOrEqual(1)
  })
})

// ─── TSS = 0 is NOT a deload ──────────────────────────────────────────────

describe('analyzeConsecutiveDeloadCount — TSS=0 break vs deload', () => {
  it('does NOT classify a TSS=0 week as a deload', () => {
    // idx 7 has 0 TSS (a complete break, not a deload).
    const log = logFromWeeklyTss([
      200, 200, 200, 200, 200, 200, 200, 0,
      200, 200, 200, 200, 200, 200, 200, 0,
    ])
    const r = analyzeConsecutiveDeloadCount({ log, today: TODAY })
    // The 0-week week is not a deload, so totalRuns should be 0.
    expect(r.totalRuns).toBe(0)
  })

  it('breaks a run when a TSS=0 break separates two deload weeks', () => {
    // idx 7 = 100 (deload), idx 8 = 0 (break), idx 9 = 100. No back-to-back run.
    const log = logFromWeeklyTss([
      200, 200, 200, 200, 200, 200, 200, 100,
      0, 100, 200, 200, 200, 200, 200, 0,
    ])
    const r = analyzeConsecutiveDeloadCount({ log, today: TODAY })
    expect(r.totalRuns).toBe(0)
  })
})

// ─── deloadThresholdPct boundary ──────────────────────────────────────────

describe('analyzeConsecutiveDeloadCount — deloadThresholdPct boundary', () => {
  it('treats wkTss EXACTLY at threshold × priorMean as NOT a deload (strict <)', () => {
    // priorMean=200, threshold 0.75 → boundary = 150. Set idx 7=150, idx 8=150.
    const log = logFromWeeklyTss([
      200, 200, 200, 200, 200, 200, 200, 150,
      150, 200, 200, 200, 200, 200, 200, 0,
    ])
    const r = analyzeConsecutiveDeloadCount({ log, today: TODAY })
    expect(r.totalRuns).toBe(0)
  })

  it('treats wkTss just below threshold × priorMean as deload', () => {
    // 149 < 150 → deload at idx 7 and idx 8.
    const log = logFromWeeklyTss([
      200, 200, 200, 200, 200, 200, 200, 149,
      100, 200, 200, 200, 200, 200, 200, 0,
    ])
    const r = analyzeConsecutiveDeloadCount({ log, today: TODAY })
    expect(r.totalRuns).toBe(1)
    expect(r.runs[0].lengthWeeks).toBe(2)
  })
})

// ─── priorMean = 0 unclassifiable ─────────────────────────────────────────

describe('analyzeConsecutiveDeloadCount — priorMean=0 not classifiable', () => {
  it('does NOT count priorMean=0 weeks toward classifiable gate', () => {
    // Loads only at idx 10..14 → priors non-zero starting idx 13 → 2 classifiable.
    const weekly = [
      0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 200, 200, 200, 200, 200, 0,
    ]
    const log = logFromWeeklyTss(weekly)
    const r = analyzeConsecutiveDeloadCount({ log, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_DATA')
  })

  it('does NOT include priorMean=0 weeks inside a deload run', () => {
    // Build priors for idx 5..14, but have a priorMean=0 week earlier.
    // Then create deload run at idx 12/13. priorMean=0 at idx 3 would not
    // break the run because it's not even part of a candidate sequence.
    const log = logFromWeeklyTss([
      0, 0, 0, 200, 200, 200, 200, 200,
      200, 200, 200, 200, 100, 100, 200, 0,
    ])
    const r = analyzeConsecutiveDeloadCount({ log, today: TODAY })
    expect(r.totalRuns).toBe(1)
    expect(r.runs[0].lengthWeeks).toBe(2)
    expect(r.runs[0].startWeekStart).toBe(WEEK_MONDAYS[12])
  })
})

// ─── deloadWeeksTotal ─────────────────────────────────────────────────────

describe('analyzeConsecutiveDeloadCount — deloadWeeksTotal', () => {
  it('counts BOTH singleton deloads AND in-run deloads', () => {
    // Singleton at idx 5; run of 2 at idx 11+12.
    // Need normal recovery between to ensure the singleton stays singleton.
    const log = logFromWeeklyTss([
      200, 200, 200, 200, 200, 100, 200, 200,
      200, 200, 200, 100, 100, 200, 200, 0,
    ])
    const r = analyzeConsecutiveDeloadCount({ log, today: TODAY })
    expect(r.totalRuns).toBe(1)
    // Singleton (idx 5) + run (idx 11+12) → 3 deload weeks total.
    expect(r.deloadWeeksTotal).toBeGreaterThanOrEqual(3)
  })

  it('zero when no deload weeks at all', () => {
    const log = logFromWeeklyTss([
      200, 200, 200, 200, 200, 200, 200, 200,
      200, 200, 200, 200, 200, 200, 200, 0,
    ])
    const r = analyzeConsecutiveDeloadCount({ log, today: TODAY })
    expect(r.deloadWeeksTotal).toBe(0)
  })
})

// ─── sort order ───────────────────────────────────────────────────────────

describe('analyzeConsecutiveDeloadCount — runs sorted oldest-first', () => {
  it('returns runs in oldest-first order', () => {
    // Two runs: idx 5+6 (older), idx 11+12 (newer).
    const log = logFromWeeklyTss([
      200, 200, 200, 200, 200, 100, 100, 200,
      200, 200, 200, 100, 100, 200, 200, 0,
    ])
    const r = analyzeConsecutiveDeloadCount({ log, today: TODAY })
    expect(r.runs.length).toBeGreaterThanOrEqual(2)
    const starts = r.runs.map(rn => rn.startWeekStart)
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i] > starts[i - 1]).toBe(true)
    }
  })
})

// ─── meanRunTss + priorRefTss + integer rounding ─────────────────────────

describe('analyzeConsecutiveDeloadCount — meanRunTss & priorRefTss', () => {
  it('computes meanRunTss = mean(TSS across run), int', () => {
    // Run at idx 7+8: TSS 100 and 80 → mean 90.
    const log = logFromWeeklyTss([
      200, 200, 200, 200, 200, 200, 200, 100,
      80, 200, 200, 200, 200, 200, 200, 0,
    ])
    const r = analyzeConsecutiveDeloadCount({ log, today: TODAY })
    expect(r.runs).toHaveLength(1)
    expect(r.runs[0].meanRunTss).toBe(90)
    expect(Number.isInteger(r.runs[0].meanRunTss)).toBe(true)
  })

  it('priorRefTss is the 3-week mean immediately before the run, int', () => {
    // Run at idx 7+8. priorMean at idx 7 = mean(idx 4,5,6) = 200.
    const log = logFromWeeklyTss([
      200, 200, 200, 200, 200, 200, 200, 100,
      100, 200, 200, 200, 200, 200, 200, 0,
    ])
    const r = analyzeConsecutiveDeloadCount({ log, today: TODAY })
    expect(r.runs[0].priorRefTss).toBe(200)
    expect(Number.isInteger(r.runs[0].priorRefTss)).toBe(true)
  })

  it('rounds non-integer means to ints', () => {
    // Non-integer TSS values + non-integer prior mean.
    const baseLog = [
      sessionInWeek(4, 100.4),
      sessionInWeek(5, 200.6),
      sessionInWeek(6, 300.0),
      sessionInWeek(7, 90.7),
      sessionInWeek(8, 80.3),
      // padding so the gate passes
      sessionInWeek(9, 200),
      sessionInWeek(10, 200),
      sessionInWeek(11, 200),
      sessionInWeek(12, 200),
      sessionInWeek(13, 200),
      sessionInWeek(14, 200),
    ]
    const r = analyzeConsecutiveDeloadCount({ log: baseLog, today: TODAY })
    expect(r.runs.length).toBeGreaterThanOrEqual(1)
    const run = r.runs.find(rn => rn.startWeekStart === WEEK_MONDAYS[7])
    expect(run).toBeDefined()
    expect(Number.isInteger(run.meanRunTss)).toBe(true)
    expect(Number.isInteger(run.priorRefTss)).toBe(true)
  })
})

// ─── custom windowWeeks ───────────────────────────────────────────────────

describe('analyzeConsecutiveDeloadCount — custom windowWeeks', () => {
  it('clamps windowWeeks to a minimum of 4', () => {
    const r = analyzeConsecutiveDeloadCount({
      log: [],
      today: TODAY,
      windowWeeks: 1,
    })
    expect(r).not.toBeNull()
    expect(r.band).toBe('INSUFFICIENT_DATA')
  })

  it('honors a larger windowWeeks (20)', () => {
    // With windowWeeks=20, weeks beyond default 16 may come into scope.
    // We just verify it doesn't crash and returns a populated result.
    const log = logFromWeeklyTss([
      200, 200, 200, 200, 200, 200, 200, 200,
      200, 200, 200, 200, 200, 200, 200, 0,
    ])
    const r = analyzeConsecutiveDeloadCount({
      log,
      today: TODAY,
      windowWeeks: 20,
    })
    expect(r).not.toBeNull()
  })
})

// ─── custom deloadThresholdPct ───────────────────────────────────────────

describe('analyzeConsecutiveDeloadCount — custom deloadThresholdPct', () => {
  it('honors a stricter threshold (0.50)', () => {
    // 200 baseline, idx 7+8 at 120. threshold 0.50 → boundary = 100. 120 NOT < 100 → not a deload.
    const log = logFromWeeklyTss([
      200, 200, 200, 200, 200, 200, 200, 120,
      120, 200, 200, 200, 200, 200, 200, 0,
    ])
    const r = analyzeConsecutiveDeloadCount({
      log,
      today: TODAY,
      deloadThresholdPct: 0.50,
    })
    expect(r.totalRuns).toBe(0)
  })

  it('honors a looser threshold (0.90)', () => {
    // 200 baseline, idx 7+8 at 170. default 0.75 → 170 NOT < 150 → not a deload.
    // With 0.90 → boundary 180 → 170 < 180 → deload.
    const log = logFromWeeklyTss([
      200, 200, 200, 200, 200, 200, 200, 170,
      170, 200, 200, 200, 200, 200, 200, 0,
    ])
    const r = analyzeConsecutiveDeloadCount({
      log,
      today: TODAY,
      deloadThresholdPct: 0.90,
    })
    expect(r.totalRuns).toBe(1)
    expect(r.runs[0].lengthWeeks).toBeGreaterThanOrEqual(2)
  })
})

// ─── ISO week boundaries ──────────────────────────────────────────────────

describe('analyzeConsecutiveDeloadCount — ISO week boundaries', () => {
  it('groups a Sunday session into THAT week (Mon-anchored)', () => {
    // Build a run at idx 7+8 entirely via Sunday sessions.
    const baseLog = [
      sessionInWeek(4, 200, 1),
      sessionInWeek(5, 200, 1),
      sessionInWeek(6, 200, 6), // SUNDAY of idx 6
      sessionInWeek(7, 100, 6), // SUNDAY of idx 7
      sessionInWeek(8, 100, 6), // SUNDAY of idx 8
      sessionInWeek(9, 200, 1),
      sessionInWeek(10, 200, 1),
      sessionInWeek(11, 200, 1),
      sessionInWeek(12, 200, 1),
      sessionInWeek(13, 200, 1),
      sessionInWeek(14, 200, 1),
    ]
    const r = analyzeConsecutiveDeloadCount({ log: baseLog, today: TODAY })
    expect(r.totalRuns).toBe(1)
    expect(r.runs[0].startWeekStart).toBe(WEEK_MONDAYS[7])
    expect(r.runs[0].endWeekStart).toBe(WEEK_MONDAYS[8])
  })

  it('groups a Monday session into THAT Mondays week', () => {
    const baseLog = [
      sessionInWeek(4, 200, 0),
      sessionInWeek(5, 200, 0),
      sessionInWeek(6, 200, 0),
      sessionInWeek(7, 100, 0), // MONDAY of idx 7
      sessionInWeek(8, 100, 0), // MONDAY of idx 8
      sessionInWeek(9, 200, 0),
      sessionInWeek(10, 200, 0),
      sessionInWeek(11, 200, 0),
      sessionInWeek(12, 200, 0),
      sessionInWeek(13, 200, 0),
      sessionInWeek(14, 200, 0),
    ]
    const r = analyzeConsecutiveDeloadCount({ log: baseLog, today: TODAY })
    expect(r.totalRuns).toBe(1)
    expect(r.runs[0].startWeekStart).toBe(WEEK_MONDAYS[7])
  })
})

// ─── today: Date vs string ────────────────────────────────────────────────

describe('analyzeConsecutiveDeloadCount — today argument forms', () => {
  it('accepts today as a Date object', () => {
    const log = logFromWeeklyTss([
      200, 200, 200, 200, 200, 200, 200, 100,
      100, 200, 200, 200, 200, 200, 200, 0,
    ])
    const r = analyzeConsecutiveDeloadCount({
      log,
      today: new Date(TODAY + 'T00:00:00Z'),
    })
    expect(r.totalRuns).toBe(1)
    expect(r.runs[0].startWeekStart).toBe(WEEK_MONDAYS[7])
  })

  it('accepts today as an ISO datetime string (trims to date)', () => {
    const log = logFromWeeklyTss([
      200, 200, 200, 200, 200, 200, 200, 100,
      100, 200, 200, 200, 200, 200, 200, 0,
    ])
    const r = analyzeConsecutiveDeloadCount({
      log,
      today: '2026-05-20T15:42:11Z',
    })
    expect(r.totalRuns).toBe(1)
  })

  it('produces equal results for Date and string today', () => {
    const log = logFromWeeklyTss([
      200, 200, 200, 200, 200, 200, 200, 100,
      100, 200, 200, 200, 200, 200, 200, 0,
    ])
    const r1 = analyzeConsecutiveDeloadCount({ log, today: TODAY })
    const r2 = analyzeConsecutiveDeloadCount({
      log,
      today: new Date(TODAY + 'T00:00:00Z'),
    })
    expect(r1).toEqual(r2)
  })
})

// ─── citation ─────────────────────────────────────────────────────────────

describe('analyzeConsecutiveDeloadCount — citation', () => {
  it('exports the citation string constant', () => {
    expect(CONSECUTIVE_DELOAD_COUNT_CITATION).toBe('Bompa 2018; Mujika 2010')
  })

  it('returns the citation on every populated result', () => {
    const r1 = analyzeConsecutiveDeloadCount({ log: [], today: TODAY })
    const r2 = analyzeConsecutiveDeloadCount({
      log: logFromWeeklyTss([
        200, 200, 200, 200, 200, 200, 200, 100,
        100, 200, 200, 200, 200, 200, 200, 0,
      ]),
      today: TODAY,
    })
    expect(r1.citation).toBe(CONSECUTIVE_DELOAD_COUNT_CITATION)
    expect(r2.citation).toBe(CONSECUTIVE_DELOAD_COUNT_CITATION)
  })
})
