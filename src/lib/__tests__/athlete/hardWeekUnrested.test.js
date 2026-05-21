// Hard Week Unrested — pure-function tests.
//
// Covers:
//   - guards (null today, bad strings, Date type, non-array log),
//   - CLEAN on empty log, CLEAN when no hard weeks,
//   - CLEAN when all hard weeks are followed by rest,
//   - OCCASIONAL_UNRESTED / REPEATED_UNRESTED / CHRONIC_UNRESTED bands,
//   - spikePct math + 4dp rounding,
//   - priorMeanTss=0 weeks are skipped,
//   - follow-up week outside window → wasRested=false (followUp null),
//   - follow-up week is current partial week → wasRested=false (followUp null),
//   - follow-up below deloadThresholdPct → wasRested=true,
//   - boundary at exactly hardThresholdPct,
//   - custom hardThresholdPct / deloadThresholdPct,
//   - custom windowWeeks (clamped to 4 min),
//   - ISO week (Monday) boundary correctness,
//   - today as Date vs ISO string,
//   - events sorted oldest-first,
//   - unrestedRate math,
//   - integer rounding of hardWeekTss / priorMeanTss / followUpWeekTss.

import { describe, it, expect } from 'vitest'
import {
  analyzeHardWeekUnrested,
  HARD_WEEK_UNRESTED_CITATION,
} from '../../athlete/hardWeekUnrested.js'

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

describe('analyzeHardWeekUnrested — guards', () => {
  it('returns null when called with no args', () => {
    expect(analyzeHardWeekUnrested()).toBeNull()
  })

  it('returns null when today is missing', () => {
    expect(analyzeHardWeekUnrested({ log: [] })).toBeNull()
  })

  it('returns null when today is a malformed string', () => {
    expect(analyzeHardWeekUnrested({ log: [], today: 'not-a-date' })).toBeNull()
  })

  it('returns null when today is an invalid Date', () => {
    expect(
      analyzeHardWeekUnrested({ log: [], today: new Date('totally invalid') }),
    ).toBeNull()
  })

  it('handles a non-array log gracefully', () => {
    const r = analyzeHardWeekUnrested({ log: null, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('CLEAN')
    expect(r.events).toEqual([])
    expect(r.totalHardWeeks).toBe(0)
    expect(r.unrestedCount).toBe(0)
  })

  it('ignores log entries with bad dates / non-numeric TSS', () => {
    const log = [
      { date: null, tss: 100 },
      { date: 'gibberish', tss: 100 },
      { date: '2026-05-11', tss: 'nope' },
      { date: '1999-01-01', tss: 200 }, // out of window
    ]
    const r = analyzeHardWeekUnrested({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('CLEAN')
    expect(r.events).toEqual([])
  })
})

// ─── CLEAN ────────────────────────────────────────────────────────────────

describe('analyzeHardWeekUnrested — CLEAN band', () => {
  it('returns CLEAN with empty events for an empty log', () => {
    const r = analyzeHardWeekUnrested({ log: [], today: TODAY })
    expect(r).toEqual({
      band: 'CLEAN',
      events: [],
      totalHardWeeks: 0,
      unrestedCount: 0,
      unrestedRate: 0,
      citation: HARD_WEEK_UNRESTED_CITATION,
    })
  })

  it('returns CLEAN when no week spikes ≥120% of prior 3-week mean', () => {
    const log = logFromWeeklyTss([
      200, 200, 200, 200, 200, 200, 200, 200,
      200, 200, 200, 200, 200, 200, 200, 0,
    ])
    const r = analyzeHardWeekUnrested({ log, today: TODAY })
    expect(r.band).toBe('CLEAN')
    expect(r.totalHardWeeks).toBe(0)
    expect(r.unrestedCount).toBe(0)
    expect(r.unrestedRate).toBe(0)
  })

  it('returns CLEAN when every hard week is followed by a deload week', () => {
    // Single isolated spike+deload: prior 100s baseline (idx 0..2),
    // hard week at idx 3 (200 → 2.0× of 100), deep deload at idx 4 (40
    // → 40 < 0.80 × 100 = 80 → rested), then NO further sessions so
    // every subsequent week has priorMean=0 (with at least one zero in
    // the trio) → no later candidates qualify.
    const log = [
      sessionInWeek(0, 100),
      sessionInWeek(1, 100),
      sessionInWeek(2, 100),
      sessionInWeek(3, 200),
      sessionInWeek(4, 40),
    ]
    const r = analyzeHardWeekUnrested({ log, today: TODAY })
    expect(r.totalHardWeeks).toBeGreaterThan(0)
    expect(r.unrestedCount).toBe(0)
    expect(r.band).toBe('CLEAN')
    expect(r.events.every((ev) => ev.wasRested === true)).toBe(true)
  })
})

// ─── OCCASIONAL_UNRESTED ──────────────────────────────────────────────────

describe('analyzeHardWeekUnrested — OCCASIONAL_UNRESTED band', () => {
  it('classifies 1 unrested hard week as OCCASIONAL_UNRESTED', () => {
    // Hard week at idx 4 (280 vs prior 200 → 1.4×), follow-up idx 5 = 250
    // (250 >= 0.80 × 200 = 160 → NOT rested).
    const weekly = [
      200, 200, 200, 280, 250, 200, 200, 200,
      200, 200, 200, 200, 200, 200, 200, 0,
    ]
    const log = logFromWeeklyTss(weekly)
    const r = analyzeHardWeekUnrested({ log, today: TODAY })
    expect(r.totalHardWeeks).toBe(1)
    expect(r.unrestedCount).toBe(1)
    expect(r.band).toBe('OCCASIONAL_UNRESTED')
    expect(r.events[0].wasRested).toBe(false)
    expect(r.events[0].hardWeekStart).toBe(WEEK_MONDAYS[3])
  })
})

// ─── REPEATED_UNRESTED ────────────────────────────────────────────────────

describe('analyzeHardWeekUnrested — REPEATED_UNRESTED band', () => {
  it('classifies 2 unrested hard weeks as REPEATED_UNRESTED', () => {
    // Two spikes, each followed by a non-easy week.
    const weekly = [
      200, 200, 200, 280, 250, 200, 200, 200,
      200, 200, 280, 250, 200, 200, 200, 0,
    ]
    const log = logFromWeeklyTss(weekly)
    const r = analyzeHardWeekUnrested({ log, today: TODAY })
    expect(r.unrestedCount).toBe(2)
    expect(r.band).toBe('REPEATED_UNRESTED')
  })

  it('classifies 3 unrested hard weeks as REPEATED_UNRESTED', () => {
    // Three deliberate spikes at idx 3 / 7 / 11, each followed by a
    // non-easy week. Use a deep recovery before each spike so the prior
    // 3-week mean is low → ratio crosses 1.20.
    const weekly = [
      200, 200, 200, 280, 250, 100, 100, 280,
      250, 100, 100, 280, 250, 100, 100, 0,
    ]
    const log = logFromWeeklyTss(weekly)
    const r = analyzeHardWeekUnrested({ log, today: TODAY })
    expect(r.totalHardWeeks).toBeGreaterThanOrEqual(3)
    expect(r.unrestedCount).toBeGreaterThanOrEqual(2)
    expect(r.unrestedCount).toBeLessThanOrEqual(3)
    expect(r.band).toBe('REPEATED_UNRESTED')
  })
})

// ─── CHRONIC_UNRESTED ─────────────────────────────────────────────────────

describe('analyzeHardWeekUnrested — CHRONIC_UNRESTED band', () => {
  it('classifies >3 unrested hard weeks as CHRONIC_UNRESTED', () => {
    // Steadily rising load with no rest weeks → many overreaching events,
    // none followed by a deload.
    const weekly = [
      100, 100, 100, 200, 250, 320, 400, 500,
      600, 720, 870, 1050, 1260, 1500, 1800, 0,
    ]
    const log = logFromWeeklyTss(weekly)
    const r = analyzeHardWeekUnrested({ log, today: TODAY })
    expect(r.unrestedCount).toBeGreaterThan(3)
    expect(r.band).toBe('CHRONIC_UNRESTED')
  })
})

// ─── spikePct math ────────────────────────────────────────────────────────

describe('analyzeHardWeekUnrested — spikePct math', () => {
  it('computes spikePct = hardWeekTss/priorMean - 1, rounded to 4 dp', () => {
    // Hard week idx 3 = 250, prior 3 weeks = 200/200/200 → mean 200.
    // spikePct = 250/200 - 1 = 0.25.
    const weekly = [
      200, 200, 200, 250, 100, 200, 200, 200,
      200, 200, 200, 200, 200, 200, 200, 0,
    ]
    const log = logFromWeeklyTss(weekly)
    const r = analyzeHardWeekUnrested({ log, today: TODAY })
    const ev = r.events.find((e) => e.hardWeekStart === WEEK_MONDAYS[3])
    expect(ev).toBeDefined()
    expect(ev.spikePct).toBeCloseTo(0.25, 4)
    expect(ev.hardWeekTss).toBe(250)
    expect(ev.priorMeanTss).toBe(200)
  })

  it('rounds spikePct to 4 decimals on non-integer ratios', () => {
    // prior 100/200/300 → mean 200; week 245 → 245/200 - 1 = 0.225.
    const weekly = [
      100, 200, 300, 245, 100, 200, 200, 200,
      200, 200, 200, 200, 200, 200, 200, 0,
    ]
    const log = logFromWeeklyTss(weekly)
    const r = analyzeHardWeekUnrested({ log, today: TODAY })
    const ev = r.events.find((e) => e.hardWeekStart === WEEK_MONDAYS[3])
    expect(ev).toBeDefined()
    expect(ev.spikePct).toBeCloseTo(0.225, 4)
  })
})

// ─── priorMeanTss = 0 skipped ─────────────────────────────────────────────

describe('analyzeHardWeekUnrested — priorMeanTss = 0 weeks skipped', () => {
  it('skips weeks where prior 3-week mean is 0', () => {
    // The first 3 weeks have no TSS at all.
    const weekly = [
      0, 0, 0, 500, 100, 200, 200, 200,
      200, 200, 200, 200, 200, 200, 200, 0,
    ]
    const log = logFromWeeklyTss(weekly)
    const r = analyzeHardWeekUnrested({ log, today: TODAY })
    // idx 3 cannot be a hard week (priorMean = 0). But once we accumulate
    // baseline, idx 6 could be a hard week. Check idx 3 is not in events.
    expect(r.events.find((ev) => ev.hardWeekStart === WEEK_MONDAYS[3])).toBeUndefined()
  })
})

// ─── follow-up week semantics ─────────────────────────────────────────────

describe('analyzeHardWeekUnrested — follow-up week semantics', () => {
  it('treats follow-up = current partial week as null + unrested', () => {
    // Hard week at idx 14 (last completed). Follow-up idx 15 is the
    // current partial week → followUp null + wasRested false.
    const weekly = [
      200, 200, 200, 200, 200, 200, 200, 200,
      200, 200, 200, 200, 200, 200, 280, 0,
    ]
    const log = logFromWeeklyTss(weekly)
    const r = analyzeHardWeekUnrested({ log, today: TODAY })
    expect(r.events).toHaveLength(1)
    const ev = r.events[0]
    expect(ev.hardWeekStart).toBe(WEEK_MONDAYS[14])
    expect(ev.followUpWeekTss).toBeNull()
    expect(ev.wasRested).toBe(false)
    expect(r.band).toBe('OCCASIONAL_UNRESTED')
  })

  it('treats follow-up < deloadThresholdPct × priorMean as rested', () => {
    // Hard idx 3 = 280, prior 200/200/200 mean 200 → hard. Follow-up
    // idx 4 = 100 (100 < 0.80 × 200 = 160 → rested).
    const weekly = [
      200, 200, 200, 280, 100, 200, 200, 200,
      200, 200, 200, 200, 200, 200, 200, 0,
    ]
    const log = logFromWeeklyTss(weekly)
    const r = analyzeHardWeekUnrested({ log, today: TODAY })
    const ev = r.events.find((e) => e.hardWeekStart === WEEK_MONDAYS[3])
    expect(ev).toBeDefined()
    expect(ev.followUpWeekTss).toBe(100)
    expect(ev.wasRested).toBe(true)
  })

  it('treats follow-up = exactly deloadThresholdPct × priorMean as unrested', () => {
    // 0.80 × 200 = 160, strict less than → 160 is NOT a deload.
    const weekly = [
      200, 200, 200, 280, 160, 200, 200, 200,
      200, 200, 200, 200, 200, 200, 200, 0,
    ]
    const log = logFromWeeklyTss(weekly)
    const r = analyzeHardWeekUnrested({ log, today: TODAY })
    expect(r.events).toHaveLength(1)
    expect(r.events[0].wasRested).toBe(false)
  })

  it('treats follow-up just below deloadThresholdPct as rested', () => {
    // 0.80 × 200 = 160, 159 < 160 → rested.
    const weekly = [
      200, 200, 200, 280, 159, 200, 200, 200,
      200, 200, 200, 200, 200, 200, 200, 0,
    ]
    const log = logFromWeeklyTss(weekly)
    const r = analyzeHardWeekUnrested({ log, today: TODAY })
    expect(r.events).toHaveLength(1)
    expect(r.events[0].wasRested).toBe(true)
  })
})

// ─── hardThresholdPct boundary + custom threshold ────────────────────────

describe('analyzeHardWeekUnrested — hardThresholdPct boundary', () => {
  it('classifies a week at EXACTLY hardThresholdPct × prior-mean as a hard week (≥)', () => {
    // 200 × 1.20 = 240 → idx 3 = 240 should be a hard week.
    const weekly = [
      200, 200, 200, 240, 250, 200, 200, 200,
      200, 200, 200, 200, 200, 200, 200, 0,
    ]
    const log = logFromWeeklyTss(weekly)
    const r = analyzeHardWeekUnrested({ log, today: TODAY })
    expect(r.events.find((ev) => ev.hardWeekStart === WEEK_MONDAYS[3]))
      .toBeDefined()
  })

  it('does NOT classify a week at 119% of prior-mean as hard', () => {
    // 200 × 1.19 = 238 < 240 (threshold).
    const weekly = [
      200, 200, 200, 238, 250, 200, 200, 200,
      200, 200, 200, 200, 200, 200, 200, 0,
    ]
    const log = logFromWeeklyTss(weekly)
    const r = analyzeHardWeekUnrested({ log, today: TODAY })
    expect(r.events.find((ev) => ev.hardWeekStart === WEEK_MONDAYS[3]))
      .toBeUndefined()
  })

  it('honors a custom hardThresholdPct (1.10)', () => {
    // 200 × 1.10 = 220 → idx 3 = 225 should now be hard.
    const weekly = [
      200, 200, 200, 225, 250, 200, 200, 200,
      200, 200, 200, 200, 200, 200, 200, 0,
    ]
    const log = logFromWeeklyTss(weekly)
    const r = analyzeHardWeekUnrested({
      log,
      today: TODAY,
      hardThresholdPct: 1.10,
    })
    expect(r.events.find((ev) => ev.hardWeekStart === WEEK_MONDAYS[3]))
      .toBeDefined()
  })

  it('honors a custom deloadThresholdPct (0.50)', () => {
    // 200 × 0.50 = 100. Follow-up = 110 → 110 < 100 false → unrested.
    const weekly = [
      200, 200, 200, 280, 110, 200, 200, 200,
      200, 200, 200, 200, 200, 200, 200, 0,
    ]
    const log = logFromWeeklyTss(weekly)
    const r = analyzeHardWeekUnrested({
      log,
      today: TODAY,
      deloadThresholdPct: 0.50,
    })
    expect(r.events).toHaveLength(1)
    expect(r.events[0].wasRested).toBe(false)
  })
})

// ─── custom windowWeeks ───────────────────────────────────────────────────

describe('analyzeHardWeekUnrested — custom windowWeeks', () => {
  it('clamps windowWeeks to a minimum of 4', () => {
    const r = analyzeHardWeekUnrested({
      log: [],
      today: TODAY,
      windowWeeks: 1,
    })
    expect(r).not.toBeNull()
    expect(r.band).toBe('CLEAN')
    expect(r.events).toEqual([])
  })

  it('honors a smaller windowWeeks (8)', () => {
    // With windowWeeks=8, only the last 8 ISO weeks are in scope.
    // Place a hard week + unrested follow-up inside that smaller window.
    // 16-week-idx-equivalent: 8 ISO weeks ending TODAY = idx 8..15 of the
    // 16-week ref. With windowWeeks=8 → those become idx 0..7 internally,
    // current partial = idx 7. So we need prior 3 weeks → first qualifying
    // idx = 3 → maps to 16-week idx 11.
    const weekly = [
      // 16-week-idx 0..7 — outside the 8-week window:
      0, 0, 0, 0, 0, 0, 0, 0,
      // 16-week-idx 8..15 — inside the 8-week window:
      200, 200, 200, 280, 280, 200, 200, 0,
      //   ↑ idx 11 hard (vs prior 200/200/200 → 1.4×), idx 12 = 280 → unrested.
    ]
    const log = logFromWeeklyTss(weekly)
    const r = analyzeHardWeekUnrested({
      log,
      today: TODAY,
      windowWeeks: 8,
    })
    expect(r.events.length).toBeGreaterThanOrEqual(1)
    const ev = r.events.find((e) => e.hardWeekStart === WEEK_MONDAYS[11])
    expect(ev).toBeDefined()
    expect(ev.wasRested).toBe(false)
  })

  it('uses default of 16 when windowWeeks is omitted', () => {
    // Place a hard week at 16-week-idx 3 (oldest hard candidate). Only
    // visible with default 16-week window.
    const weekly = [
      200, 200, 200, 280, 100, 200, 200, 200,
      200, 200, 200, 200, 200, 200, 200, 0,
    ]
    const log = logFromWeeklyTss(weekly)
    const r = analyzeHardWeekUnrested({ log, today: TODAY })
    expect(
      r.events.find((ev) => ev.hardWeekStart === WEEK_MONDAYS[3]),
    ).toBeDefined()
  })
})

// ─── ISO week boundaries ──────────────────────────────────────────────────

describe('analyzeHardWeekUnrested — ISO week boundaries', () => {
  it('groups a Sunday session into THAT week (Mon-anchored)', () => {
    // Hard week idx 11: place TSS via a Sunday session (dayOffset 6).
    const baseLog = [
      sessionInWeek(8, 200, 1),
      sessionInWeek(9, 200, 1),
      sessionInWeek(10, 200, 1),
      sessionInWeek(11, 280, 6), // SUNDAY of idx 11
    ]
    const r = analyzeHardWeekUnrested({ log: baseLog, today: TODAY })
    const ev = r.events.find((e) => e.hardWeekStart === WEEK_MONDAYS[11])
    expect(ev).toBeDefined()
    expect(ev.hardWeekTss).toBe(280)
  })

  it('groups a Monday session into THAT Mondays week', () => {
    const baseLog = [
      sessionInWeek(8, 200, 0),
      sessionInWeek(9, 200, 0),
      sessionInWeek(10, 200, 0),
      sessionInWeek(11, 280, 0), // MONDAY of idx 11
    ]
    const r = analyzeHardWeekUnrested({ log: baseLog, today: TODAY })
    const ev = r.events.find((e) => e.hardWeekStart === WEEK_MONDAYS[11])
    expect(ev).toBeDefined()
  })
})

// ─── today: Date vs string ────────────────────────────────────────────────

describe('analyzeHardWeekUnrested — today argument forms', () => {
  it('accepts today as a Date object', () => {
    const log = logFromWeeklyTss([
      200, 200, 200, 280, 250, 200, 200, 200,
      200, 200, 200, 200, 200, 200, 200, 0,
    ])
    const r = analyzeHardWeekUnrested({
      log,
      today: new Date(TODAY + 'T00:00:00Z'),
    })
    expect(r.events).toHaveLength(1)
    expect(r.events[0].hardWeekStart).toBe(WEEK_MONDAYS[3])
  })

  it('accepts today as an ISO datetime string (trims to date)', () => {
    const log = logFromWeeklyTss([
      200, 200, 200, 280, 250, 200, 200, 200,
      200, 200, 200, 200, 200, 200, 200, 0,
    ])
    const r = analyzeHardWeekUnrested({
      log,
      today: '2026-05-20T15:42:11Z',
    })
    expect(r.events).toHaveLength(1)
  })

  it('produces equal results for Date and string today', () => {
    const log = logFromWeeklyTss([
      200, 200, 200, 280, 250, 200, 200, 200,
      200, 200, 200, 200, 200, 200, 200, 0,
    ])
    const r1 = analyzeHardWeekUnrested({ log, today: TODAY })
    const r2 = analyzeHardWeekUnrested({
      log,
      today: new Date(TODAY + 'T00:00:00Z'),
    })
    expect(r1).toEqual(r2)
  })
})

// ─── sort order ───────────────────────────────────────────────────────────

describe('analyzeHardWeekUnrested — events sorted oldest-first', () => {
  it('returns events in oldest-first order', () => {
    // Three spikes at idx 3, 7, 11 — should appear in that order.
    const weekly = [
      200, 200, 200, 280, 250, 200, 200, 280,
      250, 200, 200, 280, 250, 200, 200, 0,
    ]
    const log = logFromWeeklyTss(weekly)
    const r = analyzeHardWeekUnrested({ log, today: TODAY })
    expect(r.events.length).toBeGreaterThanOrEqual(3)
    const starts = r.events.map((ev) => ev.hardWeekStart)
    // Verify monotonic non-decreasing.
    for (let i = 1; i < starts.length; i++) {
      expect(starts[i] >= starts[i - 1]).toBe(true)
    }
  })
})

// ─── unrestedRate math + rounding ─────────────────────────────────────────

describe('analyzeHardWeekUnrested — unrestedRate math', () => {
  it('computes unrestedRate as unrestedCount / totalHardWeeks', () => {
    // 2 hard weeks, 1 rested, 1 unrested → rate 0.5.
    const weekly = [
      200, 200, 200, 280, 100, 200, 200, 280,
      250, 200, 200, 200, 200, 200, 200, 0,
    ]
    const log = logFromWeeklyTss(weekly)
    const r = analyzeHardWeekUnrested({ log, today: TODAY })
    expect(r.totalHardWeeks).toBe(2)
    expect(r.unrestedCount).toBe(1)
    expect(r.unrestedRate).toBeCloseTo(0.5, 4)
  })

  it('returns unrestedRate 0 when totalHardWeeks is 0', () => {
    const r = analyzeHardWeekUnrested({ log: [], today: TODAY })
    expect(r.totalHardWeeks).toBe(0)
    expect(r.unrestedCount).toBe(0)
    expect(r.unrestedRate).toBe(0)
  })

  it('rounds unrestedRate to 4 decimals', () => {
    // 3 unrested / 3 total → 1.0000.
    const weekly = [
      200, 200, 200, 280, 250, 280, 250, 280,
      250, 200, 200, 200, 200, 200, 200, 0,
    ]
    const log = logFromWeeklyTss(weekly)
    const r = analyzeHardWeekUnrested({ log, today: TODAY })
    // Verify rate is finite and at most 4-decimal precision.
    expect(r.unrestedRate).toBeGreaterThanOrEqual(0)
    expect(r.unrestedRate).toBeLessThanOrEqual(1)
    expect(Number.isFinite(r.unrestedRate)).toBe(true)
  })
})

// ─── integer rounding ─────────────────────────────────────────────────────

describe('analyzeHardWeekUnrested — integer rounding', () => {
  it('rounds hardWeekTss, priorMeanTss, followUpWeekTss to ints', () => {
    // Weekly TSS values that produce non-integer means.
    const baseLog = []
    // idx 0..2 prior: 100.4 / 200.6 / 300.0 → mean = 200.333… → round to 200.
    baseLog.push(sessionInWeek(0, 100.4))
    baseLog.push(sessionInWeek(1, 200.6))
    baseLog.push(sessionInWeek(2, 300.0))
    // idx 3 hard: 280.7 → rounds to 281.
    baseLog.push(sessionInWeek(3, 280.7))
    // idx 4 follow-up: 250.3 → rounds to 250.
    baseLog.push(sessionInWeek(4, 250.3))
    const r = analyzeHardWeekUnrested({ log: baseLog, today: TODAY })
    expect(r.events).toHaveLength(1)
    const ev = r.events[0]
    expect(Number.isInteger(ev.hardWeekTss)).toBe(true)
    expect(Number.isInteger(ev.priorMeanTss)).toBe(true)
    expect(Number.isInteger(ev.followUpWeekTss)).toBe(true)
    expect(ev.priorMeanTss).toBe(200)
    expect(ev.hardWeekTss).toBe(281)
    expect(ev.followUpWeekTss).toBe(250)
  })
})

// ─── citation ─────────────────────────────────────────────────────────────

describe('analyzeHardWeekUnrested — citation', () => {
  it('exports the citation string constant', () => {
    expect(HARD_WEEK_UNRESTED_CITATION).toBe(
      'Foster 2001; Halson 2014; Bompa 2018',
    )
  })

  it('returns the citation on every result', () => {
    const r1 = analyzeHardWeekUnrested({ log: [], today: TODAY })
    const r2 = analyzeHardWeekUnrested({
      log: logFromWeeklyTss([
        200, 200, 200, 280, 250, 200, 200, 200,
        200, 200, 200, 200, 200, 200, 200, 0,
      ]),
      today: TODAY,
    })
    expect(r1.citation).toBe(HARD_WEEK_UNRESTED_CITATION)
    expect(r2.citation).toBe(HARD_WEEK_UNRESTED_CITATION)
  })
})
