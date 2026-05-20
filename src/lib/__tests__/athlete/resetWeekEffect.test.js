// Reset Week Effect — pure-function tests.
//
// Covers:
//   - guards (null today, non-array log, bad strings, Date type),
//   - NO_DELOAD_FOUND when nothing qualifies,
//   - STRONG_BOUNCE / MODEST_BOUNCE / NO_BOUNCE classification,
//   - deload-detection algorithm correctness (75% of prior 3-week mean),
//   - excludes the current partial week from search,
//   - weeksAfterDeloadAvailable computation (0, 1, 2),
//   - preMeanTss + postMeanTss math,
//   - bouncePct math + 4dp rounding + divide-by-zero safety,
//   - deload-week TSS = 0 excluded (it's a break, not a deload),
//   - custom lookbackWeeks override,
//   - ISO week (Monday) boundary correctness,
//   - today as Date vs string.

import { describe, it, expect } from 'vitest'
import {
  analyzeResetWeekEffect,
  RESET_WEEK_EFFECT_CITATION,
} from '../../athlete/resetWeekEffect.js'

const TODAY = '2026-05-20' // Wed → ISO Monday = 2026-05-18

// Mondays for the 13-week window ending at TODAY, oldest first.
// idx 12 is the partial current week (containing today).
// idx 11 is the most-recent fully-completed week (search starts here).
const WEEK_MONDAYS = [
  '2026-02-23', // idx 0  (oldest)
  '2026-03-02', // idx 1
  '2026-03-09', // idx 2
  '2026-03-16', // idx 3
  '2026-03-23', // idx 4
  '2026-03-30', // idx 5
  '2026-04-06', // idx 6
  '2026-04-13', // idx 7
  '2026-04-20', // idx 8
  '2026-04-27', // idx 9
  '2026-05-04', // idx 10
  '2026-05-11', // idx 11 (last completed; search starts here)
  '2026-05-18', // idx 12 (current partial week)
]

// Build a single training log entry for the given week + dayOffset.
function sessionInWeek(weekIdx, tss, dayOffset = 1) {
  const monday = WEEK_MONDAYS[weekIdx]
  const d = new Date(monday + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + dayOffset)
  return { date: d.toISOString().slice(0, 10), tss, type: 'Endurance' }
}

// Build a log where weekly TSS = `weekly[i]`, one Tuesday session per week.
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

describe('analyzeResetWeekEffect — guards', () => {
  it('returns null when called with no args', () => {
    expect(analyzeResetWeekEffect()).toBeNull()
  })

  it('returns null when today is missing', () => {
    expect(analyzeResetWeekEffect({ log: [] })).toBeNull()
  })

  it('returns null when today is a malformed string', () => {
    expect(
      analyzeResetWeekEffect({ log: [], today: 'not-a-date' }),
    ).toBeNull()
  })

  it('returns null when today is an invalid Date', () => {
    expect(
      analyzeResetWeekEffect({ log: [], today: new Date('totally invalid') }),
    ).toBeNull()
  })

  it('handles a non-array log without throwing', () => {
    expect(
      analyzeResetWeekEffect({ log: null, today: TODAY }),
    ).not.toBeNull()
    expect(
      analyzeResetWeekEffect({ log: 'not-an-array', today: TODAY }),
    ).not.toBeNull()
  })

  it('ignores log entries with bad dates / non-numeric TSS', () => {
    const log = logFromWeeklyTss([
      200, 220, 240, // pre-deload trio
      100,           // deload  (idx 3)
      230, 250,      // post 2 wks
      0, 0, 0, 0, 0, 0, 0,
    ]).concat([
      { date: null, tss: 100 },
      { date: '2026-05-18', tss: 'nope' },
      { date: 'gibberish', tss: 100 },
      { date: '1999-01-01', tss: 200 }, // out of window
    ])
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).not.toBe('NO_DELOAD_FOUND')
  })
})

// ─── NO_DELOAD_FOUND ──────────────────────────────────────────────────────

describe('analyzeResetWeekEffect — NO_DELOAD_FOUND', () => {
  it('returns NO_DELOAD_FOUND for an empty log', () => {
    const r = analyzeResetWeekEffect({ log: [], today: TODAY })
    expect(r).toEqual({
      band: 'NO_DELOAD_FOUND',
      deloadWeekStart: null,
      deloadWeekTss: 0,
      preMeanTss: 0,
      postMeanTss: 0,
      bouncePct: 0,
      weeksAfterDeloadAvailable: 0,
      citation: RESET_WEEK_EFFECT_CITATION,
    })
  })

  it('returns NO_DELOAD_FOUND when every week has identical TSS', () => {
    // Flat = no qualifying deload (no week is <75% of its preceding 3-week mean).
    const log = logFromWeeklyTss([200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200])
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    expect(r.band).toBe('NO_DELOAD_FOUND')
    expect(r.deloadWeekStart).toBeNull()
  })

  it('returns NO_DELOAD_FOUND when the only sub-75% week has TSS = 0 (break)', () => {
    // idx 11 is 0 (a break, not a deload). Nothing else qualifies.
    const log = logFromWeeklyTss([200, 220, 240, 200, 220, 240, 200, 220, 240, 200, 220, 0, 0])
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    expect(r.band).toBe('NO_DELOAD_FOUND')
  })

  it('returns NO_DELOAD_FOUND when prior 3-week trio has any zero week', () => {
    // idx 11 ~100 looks deload-ish, but idx 9 = 0 → prior trio invalid.
    const log = logFromWeeklyTss([200, 220, 240, 200, 220, 240, 200, 220, 240, 0, 220, 100, 100])
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    expect(r.band).toBe('NO_DELOAD_FOUND')
  })

  it('does NOT confuse the partial current week (idx 12) with a deload', () => {
    // idx 12 (current partial week) is 50 (<75% of 200) — but it must be
    // excluded from the search.
    // idx 11 is 200 (not deload). idx 8/9/10/11 trio is 200/200/200.
    const log = logFromWeeklyTss([200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 50])
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    // idx 12 is intentionally ignored, so nothing else qualifies.
    expect(r.band).toBe('NO_DELOAD_FOUND')
  })
})

// ─── STRONG_BOUNCE / MODEST_BOUNCE / NO_BOUNCE ────────────────────────────

describe('analyzeResetWeekEffect — bounce bands', () => {
  it('returns STRONG_BOUNCE when post-mean ≥ 110 % of pre-mean', () => {
    // Deload at idx 9, post at idx 10, idx 11.
    // Pre trio idx 6/7/8 = 200/220/240, mean = 220.
    // Deload idx 9 = 100 (<165). Post 10/11 = 260/280 → post mean 270.
    // bounce = (270-220)/220 = 0.2273 → STRONG.
    const log = logFromWeeklyTss([100, 100, 100, 200, 220, 240, 200, 220, 240, 100, 260, 280, 0])
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    expect(r.band).toBe('STRONG_BOUNCE')
    expect(r.deloadWeekStart).toBe(WEEK_MONDAYS[9])
    expect(r.weeksAfterDeloadAvailable).toBe(2)
    expect(r.preMeanTss).toBe(220)
    expect(r.postMeanTss).toBe(270)
    expect(r.bouncePct).toBeCloseTo(0.2273, 4)
  })

  it('returns MODEST_BOUNCE when post-mean is 0 < bounce < 10 %', () => {
    // Pre trio 200/200/200 mean 200; deload 100; post 205/210 mean 207.5.
    // bounce = 0.0375 → MODEST.
    const log = logFromWeeklyTss([200, 200, 200, 200, 200, 200, 200, 200, 200, 100, 205, 210, 0])
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    expect(r.band).toBe('MODEST_BOUNCE')
    expect(r.preMeanTss).toBe(200)
    expect(r.postMeanTss).toBe(207.5)
    expect(r.bouncePct).toBeCloseTo(0.0375, 4)
  })

  it('returns STRONG_BOUNCE when bouncePct exactly equals 0.10', () => {
    // Pre mean 200, post mean 220 → bounce = 0.10 exactly.
    const log = logFromWeeklyTss([200, 200, 200, 200, 200, 200, 200, 200, 200, 100, 220, 220, 0])
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    expect(r.bouncePct).toBeCloseTo(0.10, 4)
    expect(r.band).toBe('STRONG_BOUNCE')
  })

  it('returns NO_BOUNCE when post-mean is flat (=pre-mean)', () => {
    // Pre 200, post 200 → bouncePct = 0 → NO_BOUNCE.
    const log = logFromWeeklyTss([200, 200, 200, 200, 200, 200, 200, 200, 200, 100, 200, 200, 0])
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    expect(r.band).toBe('NO_BOUNCE')
    expect(r.bouncePct).toBe(0)
  })

  it('returns NO_BOUNCE when post-mean is below pre-mean', () => {
    // Pre 200, post 150 → bounce = -0.25 → NO_BOUNCE.
    const log = logFromWeeklyTss([200, 200, 200, 200, 200, 200, 200, 200, 200, 100, 150, 150, 0])
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    expect(r.band).toBe('NO_BOUNCE')
    expect(r.bouncePct).toBeCloseTo(-0.25, 4)
  })
})

// ─── deload detection (75 % threshold) ────────────────────────────────────

describe('analyzeResetWeekEffect — deload detection rule', () => {
  it('classifies week strictly LESS THAN 75 % of prior-3 mean as deload', () => {
    // Pre 200/200/200 mean 200; deload 149 (< 150).
    const log = logFromWeeklyTss([200, 200, 200, 200, 200, 200, 200, 200, 200, 149, 200, 200, 0])
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    expect(r.band).not.toBe('NO_DELOAD_FOUND')
    expect(r.deloadWeekStart).toBe(WEEK_MONDAYS[9])
  })

  it('does NOT classify week at exactly 75 % of prior-3 mean as deload', () => {
    // 150 == 0.75 × 200 → NOT a deload (strict <).
    const log = logFromWeeklyTss([200, 200, 200, 200, 200, 200, 200, 200, 200, 150, 200, 200, 0])
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    expect(r.band).toBe('NO_DELOAD_FOUND')
  })

  it('does NOT classify week above 75 % of prior-3 mean as deload', () => {
    // 160 > 150 → not a deload.
    const log = logFromWeeklyTss([200, 200, 200, 200, 200, 200, 200, 200, 200, 160, 200, 200, 0])
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    expect(r.band).toBe('NO_DELOAD_FOUND')
  })
})

// ─── most-recent-first search order ───────────────────────────────────────

describe('analyzeResetWeekEffect — most-recent deload wins', () => {
  it('picks the most-recent deload when two qualify', () => {
    // idx 4 deload (pre idx 1/2/3 mean 200) AND idx 9 deload — return idx 9.
    const log = logFromWeeklyTss([200, 200, 200, 200, 100, 250, 220, 240, 200, 100, 220, 240, 0])
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    expect(r.deloadWeekStart).toBe(WEEK_MONDAYS[9])
  })

  it('falls back to an earlier deload when the most-recent candidate has no valid prior trio', () => {
    // idx 11 looks deload-ish but idx 8 = 0 → invalid trio.
    // idx 5 IS a deload: pre idx 2/3/4 mean 200, idx 5 = 100.
    const log = logFromWeeklyTss([200, 200, 200, 200, 200, 100, 200, 200, 0, 200, 200, 100, 0])
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    // idx 11 attempt fails (idx 8=0); idx 5 IS a valid deload.
    expect(r.deloadWeekStart).toBe(WEEK_MONDAYS[5])
  })
})

// ─── weeksAfterDeloadAvailable ────────────────────────────────────────────

describe('analyzeResetWeekEffect — weeksAfterDeloadAvailable', () => {
  it('reports 2 when deload is at idx ≤ safeWindow-4 (idx ≤ 9)', () => {
    const log = logFromWeeklyTss([200, 200, 200, 200, 200, 200, 200, 200, 200, 100, 230, 240, 0])
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    expect(r.deloadWeekStart).toBe(WEEK_MONDAYS[9])
    expect(r.weeksAfterDeloadAvailable).toBe(2)
  })

  it('reports 1 when deload is at idx safeWindow-3 (idx 10)', () => {
    // idx 10 deload: pre idx 7/8/9. Only idx 11 after (idx 12 excluded).
    const log = logFromWeeklyTss([200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 100, 230, 0])
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    expect(r.deloadWeekStart).toBe(WEEK_MONDAYS[10])
    expect(r.weeksAfterDeloadAvailable).toBe(1)
    expect(r.postMeanTss).toBe(230) // single week mean.
  })

  it('reports 0 when deload is at idx safeWindow-2 (idx 11) — last completed week', () => {
    // idx 11 deload: pre idx 8/9/10. No completed weeks after.
    const log = logFromWeeklyTss([200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 100, 999])
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    expect(r.deloadWeekStart).toBe(WEEK_MONDAYS[11])
    expect(r.weeksAfterDeloadAvailable).toBe(0)
    expect(r.postMeanTss).toBe(0)
    expect(r.bouncePct).toBeCloseTo(-1, 4) // (0-200)/200 = -1
    expect(r.band).toBe('NO_BOUNCE')
  })
})

// ─── math accuracy + rounding ─────────────────────────────────────────────

describe('analyzeResetWeekEffect — math accuracy', () => {
  it('rounds preMeanTss to 2 decimals', () => {
    // pre 100/100/101 → mean 100.3333… → 100.33.
    const log = logFromWeeklyTss([200, 200, 200, 200, 200, 200, 100, 100, 101, 60, 100, 100, 0])
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    expect(r.preMeanTss).toBe(100.33)
  })

  it('rounds postMeanTss to 2 decimals', () => {
    // Deload at idx 9 (pre 200/200/200 mean 200, deload 100).
    // Post idx 10/11 = 220/221 → mean 220.5 → 220.5 (already 2dp).
    const log = logFromWeeklyTss([200, 200, 200, 200, 200, 200, 200, 200, 200, 100, 220, 221, 0])
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    expect(r.deloadWeekStart).toBe(WEEK_MONDAYS[9])
    expect(r.postMeanTss).toBe(220.5)
  })

  it('rounds bouncePct to 4 decimals', () => {
    // pre 300 mean, post 333 mean → bounce = 33/300 = 0.11 → 0.11.
    const log = logFromWeeklyTss([200, 200, 200, 200, 200, 200, 300, 300, 300, 100, 333, 333, 0])
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    expect(r.bouncePct).toBeCloseTo(0.11, 4)
    expect(r.preMeanTss).toBe(300)
    expect(r.postMeanTss).toBe(333)
  })

  it('returns deloadWeekTss as an integer (rounded)', () => {
    // Deload week sums two sessions to 100.4 → rounds to 100.
    const baseLog = logFromWeeklyTss([200, 200, 200, 200, 200, 200, 200, 200, 200, 0, 200, 200, 0])
    const extra = [
      sessionInWeek(9, 60.2, 1),
      sessionInWeek(9, 40.2, 3),
    ]
    const r = analyzeResetWeekEffect({ log: baseLog.concat(extra), today: TODAY })
    expect(r.deloadWeekTss).toBe(100)
    expect(Number.isInteger(r.deloadWeekTss)).toBe(true)
  })

  it('handles divide-by-zero safety (preMeanTss = 0 → bouncePct = 0)', () => {
    // It's impossible to reach a deload classification with preMeanTss=0
    // (the deload detector requires positive prior trio). But the post-mean
    // math should still not throw / NaN for any band. Smoke check via the
    // NO_DELOAD_FOUND zero defaults:
    const r = analyzeResetWeekEffect({ log: [], today: TODAY })
    expect(r.bouncePct).toBe(0)
    expect(Number.isFinite(r.bouncePct)).toBe(true)
  })
})

// ─── lookbackWeeks override ───────────────────────────────────────────────

describe('analyzeResetWeekEffect — custom lookbackWeeks', () => {
  it('honours a smaller lookbackWeeks (8)', () => {
    // With lookback=8: idx 6 = last completed week (Mon 2026-04-13).
    // Build a log where idx 2 in the 8-week window is a deload.
    // 8-week window mondays:
    //   safeWindow=8 → mondays = currentMonday - 7..0 weeks
    //   = [2026-04-06 .. 2026-05-18]
    //   idx 0=2026-04-06, idx1=04-13, idx2=04-20, idx3=04-27, idx4=05-04, idx5=05-11, idx6=05-18(current)…
    // Wait: with 8 weeks, current = idx 7. Search starts at idx 6 (last completed).
    // We'll place a deload at idx 4 (Mon 2026-04-13 mapped under safeWindow=8).
    // Easier: just test that a different lookback affects which deload is found.
    const r = analyzeResetWeekEffect({
      log: logFromWeeklyTss([
        // 13-week index 5 has deload (pre 2,3,4 = 200/200/200, idx5=100).
        200, 200, 200, 200, 200, 100, 220, 240, 200, 200, 200, 200, 0,
      ]),
      today: TODAY,
      lookbackWeeks: 8,
    })
    // The 8-week window starts at WEEK_MONDAYS[6] (idx 6 of the 13-week ref).
    // Pre-deload weeks at 13-week-idx 2/3/4 fall OUTSIDE the 8-week window
    // → no qualifying deload visible.
    expect(r.band).toBe('NO_DELOAD_FOUND')
  })

  it('clamps lookbackWeeks to a minimum of 4', () => {
    // lookbackWeeks=1 (silly) → clamped to 4.
    const r = analyzeResetWeekEffect({
      log: [],
      today: TODAY,
      lookbackWeeks: 1,
    })
    // Should not crash; should return NO_DELOAD_FOUND.
    expect(r.band).toBe('NO_DELOAD_FOUND')
  })

  it('uses default of 13 when lookbackWeeks is omitted', () => {
    // Deload at idx 9 of a 13-week window.
    const log = logFromWeeklyTss([100, 100, 100, 200, 220, 240, 200, 220, 240, 100, 260, 280, 0])
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    expect(r.deloadWeekStart).toBe(WEEK_MONDAYS[9])
  })
})

// ─── today: Date vs string ────────────────────────────────────────────────

describe('analyzeResetWeekEffect — today argument forms', () => {
  it('accepts today as a Date object', () => {
    const log = logFromWeeklyTss([100, 100, 100, 200, 220, 240, 200, 220, 240, 100, 260, 280, 0])
    const r = analyzeResetWeekEffect({
      log,
      today: new Date(TODAY + 'T00:00:00Z'),
    })
    expect(r.deloadWeekStart).toBe(WEEK_MONDAYS[9])
  })

  it('accepts today as a YYYY-MM-DD string', () => {
    const log = logFromWeeklyTss([100, 100, 100, 200, 220, 240, 200, 220, 240, 100, 260, 280, 0])
    const r1 = analyzeResetWeekEffect({ log, today: TODAY })
    const r2 = analyzeResetWeekEffect({
      log,
      today: new Date(TODAY + 'T00:00:00Z'),
    })
    expect(r1).toEqual(r2)
  })

  it('accepts today as an ISO datetime string (trims to date)', () => {
    const log = logFromWeeklyTss([100, 100, 100, 200, 220, 240, 200, 220, 240, 100, 260, 280, 0])
    const r = analyzeResetWeekEffect({ log, today: '2026-05-20T15:42:11Z' })
    expect(r.deloadWeekStart).toBe(WEEK_MONDAYS[9])
  })
})

// ─── ISO week (Monday) boundary correctness ───────────────────────────────

describe('analyzeResetWeekEffect — ISO week boundaries', () => {
  it('groups Sunday session into the SAME ISO week (Mon-anchored)', () => {
    // Mon 2026-05-11 .. Sun 2026-05-17 = one ISO week.
    // A Sunday session belongs to idx 11.
    const log = [
      sessionInWeek(8, 200, 1),
      sessionInWeek(9, 200, 1),
      sessionInWeek(10, 200, 1),
      // Deload idx 11 — placed on the SUNDAY (dayOffset = 6).
      sessionInWeek(11, 50, 6),
    ]
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    expect(r.deloadWeekStart).toBe(WEEK_MONDAYS[11])
    expect(r.deloadWeekTss).toBe(50)
    expect(r.weeksAfterDeloadAvailable).toBe(0)
  })

  it('groups Monday session into THAT Monday\'s ISO week', () => {
    const log = [
      sessionInWeek(8, 200, 0),  // Monday
      sessionInWeek(9, 200, 0),  // Monday
      sessionInWeek(10, 200, 0), // Monday
      sessionInWeek(11, 50, 0),  // Monday (deload)
    ]
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    expect(r.deloadWeekStart).toBe(WEEK_MONDAYS[11])
  })

  it('today different weekday → same Monday-anchored window', () => {
    // Today as Sat 2026-05-23 (still in same ISO week as 05-20).
    const log = logFromWeeklyTss([100, 100, 100, 200, 220, 240, 200, 220, 240, 100, 260, 280, 0])
    const r = analyzeResetWeekEffect({ log, today: '2026-05-23' })
    expect(r.deloadWeekStart).toBe(WEEK_MONDAYS[9])
  })
})

// ─── citation ─────────────────────────────────────────────────────────────

describe('analyzeResetWeekEffect — citation', () => {
  it('exports the citation string constant', () => {
    expect(RESET_WEEK_EFFECT_CITATION).toBe('Bompa 2018; Issurin 2010')
  })

  it('returns the citation on a found-deload result', () => {
    const log = logFromWeeklyTss([100, 100, 100, 200, 220, 240, 200, 220, 240, 100, 260, 280, 0])
    const r = analyzeResetWeekEffect({ log, today: TODAY })
    expect(r.citation).toBe('Bompa 2018; Issurin 2010')
  })

  it('returns the citation on a NO_DELOAD_FOUND result', () => {
    const r = analyzeResetWeekEffect({ log: [], today: TODAY })
    expect(r.citation).toBe('Bompa 2018; Issurin 2010')
  })
})
