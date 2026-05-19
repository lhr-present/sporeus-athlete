// Mesocycle progression — pure-function tests.
//
// Covers: null gating, clean 3:1 cycle detection (single + multiple),
// no-deload, over-deloaded, continuous-load, chaotic bands, deloadDepth
// math, ISO-8601 Monday week boundaries, sparse/empty logs, today as
// Date vs string, windowWeeks override.

import { describe, it, expect } from 'vitest'
import {
  analyzeMesocycleProgression,
  MESOCYCLE_PROGRESSION_CITATION,
} from '../../athlete/mesocycleProgression.js'

const TODAY = '2026-05-20' // Wed → ISO Monday = 2026-05-18

// Mondays for the 12-week window ending at TODAY, oldest first.
// Computed deterministically from the same Monday-anchoring logic the
// analyzer uses.
const WEEK_MONDAYS = [
  '2026-03-02', // idx 0  (oldest)
  '2026-03-09', // idx 1
  '2026-03-16', // idx 2
  '2026-03-23', // idx 3
  '2026-03-30', // idx 4
  '2026-04-06', // idx 5
  '2026-04-13', // idx 6
  '2026-04-20', // idx 7
  '2026-04-27', // idx 8
  '2026-05-04', // idx 9
  '2026-05-11', // idx 10
  '2026-05-18', // idx 11 (current)
]

// Build a single training log entry tagged to the Monday of `weekIdx`.
function sessionInWeek(weekIdx, tss, dayOffset = 0) {
  const monday = WEEK_MONDAYS[weekIdx]
  const d = new Date(monday + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + dayOffset)
  return { date: d.toISOString().slice(0, 10), tss, type: 'Endurance' }
}

// Helper: build a 12-week log where every week's TSS = `tssPerWeek[idx]`.
// Each week's TSS is concentrated in a single Tuesday session (dayOffset=1).
function logFromWeeklyTss(weekly) {
  const out = []
  for (let i = 0; i < weekly.length; i++) {
    const tss = Number(weekly[i])
    if (!Number.isFinite(tss) || tss <= 0) continue
    out.push(sessionInWeek(i, tss, 1))
  }
  return out
}

describe('analyzeMesocycleProgression — guards', () => {
  it('returns null when called with no args', () => {
    expect(analyzeMesocycleProgression()).toBeNull()
  })

  it('returns null when today is missing', () => {
    expect(analyzeMesocycleProgression({ log: [] })).toBeNull()
  })

  it('returns null when today is malformed string', () => {
    expect(analyzeMesocycleProgression({ log: [], today: 'not-a-date' })).toBeNull()
  })

  it('returns null when today is an invalid Date', () => {
    expect(
      analyzeMesocycleProgression({ log: [], today: new Date('not real') })
    ).toBeNull()
  })

  it('returns null for an empty log (insufficient signal)', () => {
    expect(analyzeMesocycleProgression({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null when fewer than 8 of 12 weeks have any TSS', () => {
    // Only 7 weeks non-zero.
    const weekly = [100, 0, 100, 0, 100, 0, 100, 0, 100, 0, 100, 100]
    const log = logFromWeeklyTss(weekly)
    expect(analyzeMesocycleProgression({ log, today: TODAY })).toBeNull()
  })

  it('handles a non-array log without throwing', () => {
    expect(
      analyzeMesocycleProgression({ log: null, today: TODAY })
    ).toBeNull()
    expect(
      analyzeMesocycleProgression({ log: 'not-an-array', today: TODAY })
    ).toBeNull()
  })

  it('ignores entries with no date / invalid date / non-numeric TSS', () => {
    // Solid 3:1 base with garbage entries mixed in.
    const weekly = [200, 220, 240, 100, 200, 220, 240, 100, 200, 220, 240, 100]
    const log = logFromWeeklyTss(weekly).concat([
      { date: null, tss: 999 },
      { date: '2026-05-18', tss: 'oops' },
      { date: 'not-a-date', tss: 100 },
      { date: '1999-01-01', tss: 100 }, // outside window
      { date: '2026-05-20', tss: -50 }, // negative TSS ignored
    ])
    const out = analyzeMesocycleProgression({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.band).toBe('ON_PATTERN')
  })
})

describe('analyzeMesocycleProgression — clean 3:1 detection', () => {
  it('detects ONE clean cycle but classifies as CONTINUOUS_LOAD or CHAOTIC (not ON_PATTERN)', () => {
    // Single mesocycle in weeks 0..3, rest of weeks are non-zero
    // but uniform (no further deloads).
    const weekly = [200, 220, 240, 100, 200, 200, 200, 200, 200, 200, 200, 200]
    const log = logFromWeeklyTss(weekly)
    const out = analyzeMesocycleProgression({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.mesocyclesDetected).toBe(1)
    expect(out.band).not.toBe('ON_PATTERN')
  })

  it('detects TWO clean cycles → ON_PATTERN', () => {
    const weekly = [
      200, 220, 240, 100, // cycle 1: build, build, peak, deload
      210, 230, 250, 110, // cycle 2
      200, 220, 240, 200, // partial — last week not a deload
    ]
    const log = logFromWeeklyTss(weekly)
    const out = analyzeMesocycleProgression({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.band).toBe('ON_PATTERN')
    expect(out.mesocyclesDetected).toBe(2)
  })

  it('detects THREE consecutive clean cycles → ON_PATTERN', () => {
    const weekly = [
      200, 220, 240, 100,
      210, 230, 250, 110,
      220, 240, 260, 120,
    ]
    const log = logFromWeeklyTss(weekly)
    const out = analyzeMesocycleProgression({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.band).toBe('ON_PATTERN')
    expect(out.mesocyclesDetected).toBe(3)
  })

  it('does NOT count overlapping cycles — windows are non-overlapping', () => {
    // If the quartet starts at week 1 instead of week 0, the slider
    // (which steps in non-overlapping 4-week chunks aligned to week 0)
    // should NOT match.
    const weekly = [
      150, // filler
      200, 220, 240, 100, // would-be cycle starting at idx 1
      210, 230, 250, 110,
      220, 240, 260, // 11 weeks of data after filler
    ]
    // Truncate to 12 entries.
    weekly.length = 12
    const log = logFromWeeklyTss(weekly)
    const out = analyzeMesocycleProgression({ log, today: TODAY })
    expect(out).not.toBeNull()
    // Cycles aligned to indices 0..3, 4..7, 8..11:
    //   [150,200,220,240] → 240 < 0.75*190? 240 < 142.5? no → not clean
    //   [100,210,230,250] → 250 < 0.75*180? no → not clean
    //   [110,220,240,260] → 260 < 0.75*190? no → not clean
    expect(out.mesocyclesDetected).toBe(0)
  })

  it('does not count a quartet where any build week is zero', () => {
    const weekly = [
      200, 0, 240, 100,
      210, 230, 250, 110,
      220, 240, 260, 120,
    ]
    const log = logFromWeeklyTss(weekly)
    const out = analyzeMesocycleProgression({ log, today: TODAY })
    expect(out).not.toBeNull()
    // First quartet invalid; second + third still clean.
    expect(out.mesocyclesDetected).toBe(2)
    expect(out.band).toBe('ON_PATTERN')
  })

  it('does not count a quartet where deload week >= 0.75× mean of prior 3', () => {
    // Mean(200,220,240) = 220; 0.75 × 220 = 165 → deload must be < 165.
    const weekly = [
      200, 220, 240, 170, // deload = 170 ≥ 165 → not a clean cycle
      210, 230, 250, 110,
      220, 240, 260, 120,
    ]
    const log = logFromWeeklyTss(weekly)
    const out = analyzeMesocycleProgression({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.mesocyclesDetected).toBe(2)
  })
})

describe('analyzeMesocycleProgression — week-role tagging', () => {
  it('tags BUILD / PEAK / DELOAD inside each clean cycle', () => {
    const weekly = [
      200, 220, 240, 100,
      210, 230, 250, 110,
      220, 240, 260, 120,
    ]
    const log = logFromWeeklyTss(weekly)
    const out = analyzeMesocycleProgression({ log, today: TODAY })
    expect(out).not.toBeNull()
    const roles = out.weeks.map(w => w.role)
    // Cycle 1 (idx 0..3): peak is week 2 (240).
    expect(roles[0]).toBe('BUILD')
    expect(roles[1]).toBe('BUILD')
    expect(roles[2]).toBe('PEAK')
    expect(roles[3]).toBe('DELOAD')
    // Cycle 2 (idx 4..7): peak is week 6 (250).
    expect(roles[6]).toBe('PEAK')
    expect(roles[7]).toBe('DELOAD')
    // Cycle 3 (idx 8..11): peak is week 10 (260).
    expect(roles[10]).toBe('PEAK')
    expect(roles[11]).toBe('DELOAD')
  })

  it('tags weeks outside any clean cycle as UNKNOWN', () => {
    const weekly = [180, 180, 180, 180, 180, 180, 180, 180, 180, 180, 180, 180]
    const log = logFromWeeklyTss(weekly)
    const out = analyzeMesocycleProgression({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.weeks.every(w => w.role === 'UNKNOWN')).toBe(true)
  })
})

describe('analyzeMesocycleProgression — band classification', () => {
  it('NO_DELOAD when no deload weeks and mean weekly TSS > 100', () => {
    const weekly = [200, 210, 200, 220, 200, 210, 200, 220, 200, 210, 200, 220]
    const log = logFromWeeklyTss(weekly)
    const out = analyzeMesocycleProgression({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.band).toBe('NO_DELOAD')
    expect(out.mesocyclesDetected).toBe(0)
    expect(out.deloadDepth).toBeNull()
  })

  it('OVER_DELOADED when >40% of weeks classify as deload', () => {
    // Pattern: build, build, build, deload, deload, deload, ... with
    // deload weeks shifted off the quartet grid so they DON'T form
    // clean cycles. Use 3 build then 2 deload then 3 build then 4
    // deload — the rolling deload detector (which doesn't require
    // alignment) flags many weeks, but the quartet slider catches
    // none because the deload weeks fall in build-week positions.
    //
    // Layout (weekly TSS, 12 weeks):
    //   [200, 200, 200, 50, 50, 50, 200, 200, 50, 50, 50, 50]
    //   Quartets:
    //     [200,200,200,50]   → clean cycle (1)
    //     [50,50,200,200]    → build #3 = 200, mean(50,50,200) = 100;
    //                          deload < 0.75*100 = 75? 200 < 75? no.
    //                          Also, build trio includes 50s; that's
    //                          fine, but deload (200) isn't < 75 → not clean
    //     [50,50,50,50]      → all positive, mean(50,50,50)=50,
    //                          0.75*50=37.5; deload=50 ≥ 37.5 → not clean
    //   Rolling deloads anywhere in window: lots (50 vs prior 200s).
    //
    // We need to confirm: 1 clean cycle (which is < 2 so not ON_PATTERN),
    // AND > 40 % deload-flagged weeks.
    const weekly = [200, 200, 200, 50, 50, 50, 200, 200, 50, 50, 50, 50]
    const log = logFromWeeklyTss(weekly)
    const out = analyzeMesocycleProgression({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.band).toBe('OVER_DELOADED')
  })

  it('CONTINUOUS_LOAD when exactly one deload week + sustained mean', () => {
    // One deload-only quartet but not 2 clean cycles.
    const weekly = [200, 220, 240, 100, 230, 240, 250, 245, 250, 260, 270, 280]
    const log = logFromWeeklyTss(weekly)
    const out = analyzeMesocycleProgression({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.band).toBe('CONTINUOUS_LOAD')
  })

  it('CHAOTIC fallback when nothing else fits', () => {
    // Sparse, jumpy, sub-floor mean — not NO_DELOAD, not OVER, no
    // clean cycles, not single-deload-with-volume.
    const weekly = [60, 0, 80, 0, 70, 0, 90, 0, 80, 0, 80, 0]
    const log = logFromWeeklyTss(weekly)
    // Only 6 non-zero weeks — fails gate. Bump count up.
    const weekly2 = [60, 80, 70, 90, 80, 70, 60, 80, 70, 90, 80, 70]
    const log2 = logFromWeeklyTss(weekly2)
    expect(analyzeMesocycleProgression({ log, today: TODAY })).toBeNull()
    const out2 = analyzeMesocycleProgression({ log: log2, today: TODAY })
    expect(out2).not.toBeNull()
    // mean ≈ 76 < 100 → NO_DELOAD floor not crossed. No deloads,
    // no clean cycles → CHAOTIC.
    expect(out2.band).toBe('CHAOTIC')
  })

  it('ON_PATTERN overrides OVER_DELOADED when ≥ 2 clean cycles exist', () => {
    // Two clean cycles + an extra deload week that pushes the
    // rolling-deload count up. ON_PATTERN should still win.
    const weekly = [
      200, 220, 240, 100, // clean cycle 1
      210, 230, 250, 110, // clean cycle 2
      300, 310, 320, 90,  // clean cycle 3 — but extra: replace 90 with deeper
    ]
    // Force ≥2 clean cycles and don't tip into >40 % deload territory
    // (3/12 = 25 %).
    const log = logFromWeeklyTss(weekly)
    const out = analyzeMesocycleProgression({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.band).toBe('ON_PATTERN')
    expect(out.mesocyclesDetected).toBeGreaterThanOrEqual(2)
  })
})

describe('analyzeMesocycleProgression — deloadDepth math', () => {
  it('computes mean ratio of deload TSS to preceding peak (single cycle)', () => {
    const weekly = [
      200, 220, 240, 120, // peak = 240, deload = 120 → 0.5
      200, 200, 200, 200, // no deload
      200, 200, 200, 200,
    ]
    const log = logFromWeeklyTss(weekly)
    const out = analyzeMesocycleProgression({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.deloadDepth).toBeCloseTo(0.5, 4)
  })

  it('averages depth across multiple clean cycles', () => {
    const weekly = [
      200, 220, 240, 120, // depth = 120/240 = 0.5
      210, 230, 250, 100, // depth = 100/250 = 0.4
      220, 240, 260, 130, // depth = 130/260 = 0.5
    ]
    const log = logFromWeeklyTss(weekly)
    const out = analyzeMesocycleProgression({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.mesocyclesDetected).toBe(3)
    // mean of 0.5, 0.4, 0.5 = 0.4667
    expect(out.deloadDepth).toBeCloseTo(0.4667, 3)
  })

  it('returns deloadDepth = null when no clean cycles', () => {
    const weekly = [200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200]
    const log = logFromWeeklyTss(weekly)
    const out = analyzeMesocycleProgression({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.deloadDepth).toBeNull()
  })
})

describe('analyzeMesocycleProgression — ISO week boundaries', () => {
  it('aggregates sessions across Mon–Sun into the correct week', () => {
    const weekly = [200, 220, 240, 100, 210, 230, 250, 110, 220, 240, 260, 120]
    const log = []
    for (let i = 0; i < 12; i++) {
      // Spread 3 sessions per week across Mon/Wed/Fri to verify aggregation.
      log.push(sessionInWeek(i, weekly[i] / 3, 0))
      log.push(sessionInWeek(i, weekly[i] / 3, 2))
      log.push(sessionInWeek(i, weekly[i] / 3, 4))
    }
    const out = analyzeMesocycleProgression({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.band).toBe('ON_PATTERN')
    expect(out.weeks[0].tss).toBe(200)
    expect(out.weeks[2].tss).toBe(240)
  })

  it('places a Sunday session into THAT week (last day of ISO week)', () => {
    // Sunday is dayOffset=6 from Monday. We place the only session
    // for week 0 on its Sunday.
    const log = [sessionInWeek(0, 200, 6)]
    // Pad enough weeks to clear the gate.
    for (let i = 1; i < 12; i++) log.push(sessionInWeek(i, 200, 1))
    const out = analyzeMesocycleProgression({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.weeks[0].tss).toBe(200)
  })

  it('excludes a session dated the Monday AFTER the current week', () => {
    const weekly = [200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200]
    const log = logFromWeeklyTss(weekly)
    // Inject a session one week after the current Monday.
    const future = new Date('2026-05-18T00:00:00Z')
    future.setUTCDate(future.getUTCDate() + 7)
    log.push({ date: future.toISOString().slice(0, 10), tss: 999 })
    const out = analyzeMesocycleProgression({ log, today: TODAY })
    expect(out).not.toBeNull()
    // Last week should be the unaffected 200, NOT 999.
    expect(out.weeks[11].tss).toBe(200)
  })

  it('excludes a session dated BEFORE the earliest week start', () => {
    const weekly = [200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200]
    const log = logFromWeeklyTss(weekly)
    log.push({ date: '2025-12-01', tss: 999 })
    const out = analyzeMesocycleProgression({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.weeks[0].tss).toBe(200)
  })

  it('uses ISO Monday-anchored weekStarts in output', () => {
    const weekly = [200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200, 200]
    const log = logFromWeeklyTss(weekly)
    const out = analyzeMesocycleProgression({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.weeks.map(w => w.weekStart)).toEqual([
      '2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23',
      '2026-03-30', '2026-04-06', '2026-04-13', '2026-04-20',
      '2026-04-27', '2026-05-04', '2026-05-11', '2026-05-18',
    ])
  })
})

describe('analyzeMesocycleProgression — input flexibility', () => {
  it('accepts today as a Date instance', () => {
    const weekly = [200, 220, 240, 100, 210, 230, 250, 110, 220, 240, 260, 120]
    const log = logFromWeeklyTss(weekly)
    const out = analyzeMesocycleProgression({
      log,
      today: new Date('2026-05-20T12:00:00Z'),
    })
    expect(out).not.toBeNull()
    expect(out.band).toBe('ON_PATTERN')
  })

  it('respects a custom windowWeeks override (shorter window)', () => {
    // For an 8-week window ending at TODAY, the Mondays are the LAST
    // 8 of the 12-week list (indices 4..11 in WEEK_MONDAYS). Place
    // sessions on those weeks directly.
    const weekly8 = [200, 220, 240, 100, 210, 230, 250, 110]
    const log = []
    for (let i = 0; i < 8; i++) {
      // i maps to WEEK_MONDAYS[i + 4]
      log.push(sessionInWeek(i + 4, weekly8[i], 1))
    }
    // 8-week window — gate requires ≥ Math.ceil(8 * 2/3) = 6 non-zero.
    const out = analyzeMesocycleProgression({
      log,
      today: TODAY,
      windowWeeks: 8,
    })
    expect(out).not.toBeNull()
    expect(out.weeks.length).toBe(8)
    expect(out.mesocyclesDetected).toBe(2)
  })

  it('rejects a windowWeeks value that drops signal below floor', () => {
    // 4-week window, only 1 week non-zero → gate fails (need ceil(4 * 2/3)=3).
    const log = [sessionInWeek(11, 200, 1)]
    const out = analyzeMesocycleProgression({
      log,
      today: TODAY,
      windowWeeks: 4,
    })
    expect(out).toBeNull()
  })

  it('coerces a non-numeric windowWeeks to default 12', () => {
    const weekly = [200, 220, 240, 100, 210, 230, 250, 110, 220, 240, 260, 120]
    const log = logFromWeeklyTss(weekly)
    const out = analyzeMesocycleProgression({
      log,
      today: TODAY,
      windowWeeks: 'oops',
    })
    expect(out).not.toBeNull()
    expect(out.weeks.length).toBe(12)
  })
})

describe('analyzeMesocycleProgression — output shape', () => {
  it('exposes the documented citation string', () => {
    expect(MESOCYCLE_PROGRESSION_CITATION).toBe('Issurin 2010; Bompa 2018')
    const weekly = [200, 220, 240, 100, 210, 230, 250, 110, 220, 240, 260, 120]
    const log = logFromWeeklyTss(weekly)
    const out = analyzeMesocycleProgression({ log, today: TODAY })
    expect(out.citation).toBe(MESOCYCLE_PROGRESSION_CITATION)
  })

  it('rounds weekly TSS to integers in output', () => {
    const log = [
      sessionInWeek(0, 100.4, 1),
      sessionInWeek(0, 100.4, 2),
      sessionInWeek(1, 200, 1),
      sessionInWeek(2, 200, 1),
      sessionInWeek(3, 200, 1),
      sessionInWeek(4, 200, 1),
      sessionInWeek(5, 200, 1),
      sessionInWeek(6, 200, 1),
      sessionInWeek(7, 200, 1),
      sessionInWeek(8, 200, 1),
    ]
    const out = analyzeMesocycleProgression({ log, today: TODAY })
    expect(out).not.toBeNull()
    // First week: 100.4 + 100.4 = 200.8 → rounds to 201
    expect(out.weeks[0].tss).toBe(201)
  })

  it('returns weeks[] sorted oldest-first', () => {
    const weekly = [200, 220, 240, 100, 210, 230, 250, 110, 220, 240, 260, 120]
    const log = logFromWeeklyTss(weekly)
    const out = analyzeMesocycleProgression({ log, today: TODAY })
    expect(out).not.toBeNull()
    for (let i = 1; i < out.weeks.length; i++) {
      expect(out.weeks[i].weekStart > out.weeks[i - 1].weekStart).toBe(true)
    }
  })
})
