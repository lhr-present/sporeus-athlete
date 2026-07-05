// ─── rowingSplitConsistency.test.js — pure-fn tests ──────────────────────────
import { describe, it, expect } from 'vitest'
import {
  computeRowingSplitConsistency,
  rowingConsistencyBlockedByRpe,
  ROWING_SPLIT_CONSISTENCY_CITATION,
} from '../../athlete/rowingSplitConsistency.js'

const TODAY = '2026-05-17'

/**
 * Build a steady-state rowing session. distance in metres, duration in seconds.
 * RPE defaults to 5 → inside the steady-state UT/AT window.
 * v9.474 — real entries store `duration` in MINUTES; the seconds value rides
 * `durationSec` (the lib prefers it), matching the Concept2-import shape.
 */
const mkRow = (date, distance, duration, rpe = 5) => ({
  date, type: 'row', sport: 'rowing', distance, durationSec: duration, duration: Math.round(duration / 60), rpe,
})

describe('computeRowingSplitConsistency — null cases', () => {
  it('(a) returns null for empty log', () => {
    expect(computeRowingSplitConsistency({ log: [], today: TODAY })).toBeNull()
  })

  it('(a) returns null for non-array log', () => {
    expect(computeRowingSplitConsistency({ log: null, today: TODAY })).toBeNull()
  })

  it('(b) returns null when log has no rowing sessions', () => {
    const log = [
      { date: '2026-05-10', type: 'bike', sport: 'cycling', distance: 30000, duration: 3600, rpe: 5 },
      { date: '2026-05-12', type: 'run',  sport: 'running', distance: 10000, duration: 3000, rpe: 5 },
    ]
    expect(computeRowingSplitConsistency({ log, today: TODAY })).toBeNull()
  })

  it('(c) returns null when no bucket has ≥3 sessions', () => {
    // 2 sessions at 2000m, 2 at 1000m — neither reaches the 3-session threshold.
    const log = [
      mkRow('2026-05-10', 2000, 480),
      mkRow('2026-05-12', 2000, 482),
      mkRow('2026-05-14', 1000, 240),
      mkRow('2026-05-15', 1000, 241),
    ]
    expect(computeRowingSplitConsistency({ log, today: TODAY })).toBeNull()
  })

  it('excludes sessions outside the 28d window', () => {
    // All three rowing pieces are 60d old → out of window.
    const log = [
      mkRow('2026-03-01', 2000, 480),
      mkRow('2026-03-03', 2000, 482),
      mkRow('2026-03-05', 2000, 484),
    ]
    expect(computeRowingSplitConsistency({ log, today: TODAY })).toBeNull()
  })

  it('excludes recovery paddles (RPE < 4) and all-out tests (RPE > 7)', () => {
    const log = [
      mkRow('2026-05-10', 2000, 480, 3),  // recovery — excluded
      mkRow('2026-05-12', 2000, 482, 9),  // test — excluded
      mkRow('2026-05-14', 2000, 484, 8),  // test — excluded
    ]
    expect(computeRowingSplitConsistency({ log, today: TODAY })).toBeNull()
  })

  it('excludes sessions missing distance or duration', () => {
    const log = [
      mkRow('2026-05-10', 2000, 480),
      { date: '2026-05-12', type: 'row', sport: 'rowing', duration: 482, rpe: 5 },     // no distance
      { date: '2026-05-14', type: 'row', sport: 'rowing', distance: 2000, rpe: 5 },    // no duration
    ]
    // Only one valid → below threshold → null
    expect(computeRowingSplitConsistency({ log, today: TODAY })).toBeNull()
  })
})

describe('computeRowingSplitConsistency — band classification', () => {
  it('(d) tight splits across 4 × 2000m pieces → ELITE (CV < 1 %)', () => {
    // splits = duration / 4 → [120.00, 120.25, 120.50, 120.75] → CV ≈ 0.23 %
    const log = [
      mkRow('2026-05-10', 2000, 480),
      mkRow('2026-05-12', 2000, 481),
      mkRow('2026-05-14', 2000, 482),
      mkRow('2026-05-16', 2000, 483),
    ]
    const r = computeRowingSplitConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('ELITE')
    expect(r.avgCvPct).toBeLessThan(1)
    expect(r.bucketResults).toHaveLength(1)
    expect(r.bucketResults[0].distance).toBe(2000)
    expect(r.bucketResults[0].n).toBe(4)
  })

  it('(e) ~1.2 % CV → COMPETITIVE (1–2 %)', () => {
    // splits = [115, 117, 119, 117] → mean 117, stdDev ≈ 1.414, CV ≈ 1.21 %
    const log = [
      mkRow('2026-05-10', 2000, 460),
      mkRow('2026-05-12', 2000, 468),
      mkRow('2026-05-14', 2000, 476),
      mkRow('2026-05-16', 2000, 468),
    ]
    const r = computeRowingSplitConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('COMPETITIVE')
    expect(r.avgCvPct).toBeGreaterThanOrEqual(1)
    expect(r.avgCvPct).toBeLessThan(2)
  })

  it('(f) ~3 % CV → DEVELOPING (2–4 %)', () => {
    // splits = [115, 120, 125, 120] → mean 120, stdDev ≈ 3.536, CV ≈ 2.95 %
    const log = [
      mkRow('2026-05-10', 2000, 460),
      mkRow('2026-05-12', 2000, 480),
      mkRow('2026-05-14', 2000, 500),
      mkRow('2026-05-16', 2000, 480),
    ]
    const r = computeRowingSplitConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('DEVELOPING')
    expect(r.avgCvPct).toBeGreaterThan(2)
    expect(r.avgCvPct).toBeLessThanOrEqual(4)
  })

  it('(g) ~6.6 % CV → INCONSISTENT (> 4 %)', () => {
    // splits = [110, 125, 115, 130] → mean 120, stdDev ≈ 7.906, CV ≈ 6.59 %
    const log = [
      mkRow('2026-05-10', 2000, 440),
      mkRow('2026-05-12', 2000, 500),
      mkRow('2026-05-14', 2000, 460),
      mkRow('2026-05-16', 2000, 520),
    ]
    const r = computeRowingSplitConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('INCONSISTENT')
    expect(r.avgCvPct).toBeGreaterThan(4)
  })

  it('(h) groups distances within ±5 % into the same bucket (1950 m, 2000 m, 2050 m → 2000 bucket)', () => {
    const log = [
      mkRow('2026-05-10', 1950, 468),  // splits 120.0  (468*500/1950 = 120.0)
      mkRow('2026-05-12', 2000, 480),  // split  120
      mkRow('2026-05-14', 2050, 492),  // split  120 (492*500/2050 = 120)
    ]
    const r = computeRowingSplitConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.bucketResults).toHaveLength(1)
    expect(r.bucketResults[0].distance).toBe(2000)
    expect(r.bucketResults[0].n).toBe(3)
    expect(r.band).toBe('ELITE')   // all three splits equal → CV ≈ 0
  })

  it('drops distances outside any bucket tolerance (e.g. 1500 m piece falls between 1000 and 2000 buckets)', () => {
    // 1500m piece — outside ±5% of both 1000 (max 1050) and 2000 (min 1900).
    const log = [
      mkRow('2026-05-10', 1500, 360),
      mkRow('2026-05-12', 1500, 362),
      mkRow('2026-05-14', 1500, 364),
    ]
    expect(computeRowingSplitConsistency({ log, today: TODAY })).toBeNull()
  })

  it('averages CV across multiple qualifying buckets', () => {
    // 2000m bucket: tight (ELITE-ish, CV near 0)
    // 5000m bucket: identical splits → CV exactly 0
    // avgCvPct should still classify as ELITE.
    const log = [
      mkRow('2026-05-10', 2000, 480),
      mkRow('2026-05-12', 2000, 481),
      mkRow('2026-05-14', 2000, 482),
      mkRow('2026-05-11', 5000, 1200),
      mkRow('2026-05-13', 5000, 1200),
      mkRow('2026-05-15', 5000, 1200),
    ]
    const r = computeRowingSplitConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.bucketResults).toHaveLength(2)
    const distances = r.bucketResults.map(b => b.distance).sort((a, b) => a - b)
    expect(distances).toEqual([2000, 5000])
    expect(r.band).toBe('ELITE')
  })

  it('exports the citation constant', () => {
    expect(ROWING_SPLIT_CONSISTENCY_CITATION).toMatch(/Foster 2001/)
    expect(ROWING_SPLIT_CONSISTENCY_CITATION).toMatch(/Smith 2012/)
    expect(ROWING_SPLIT_CONSISTENCY_CITATION).toMatch(/Steinacker 1993/)
  })

  it('attaches the citation to the result', () => {
    const log = [
      mkRow('2026-05-10', 2000, 480),
      mkRow('2026-05-12', 2000, 481),
      mkRow('2026-05-14', 2000, 482),
    ]
    const r = computeRowingSplitConsistency({ log, today: TODAY })
    expect(r.citation).toBe(ROWING_SPLIT_CONSISTENCY_CITATION)
  })
})

// ─── v9.474 — entry-shape compat + honest RPE-blocked empty state ─────────────
describe('v9.474 entry-shape fixes', () => {
  it('accepts Strava/FIT shape: distanceM + minutes duration (no distance/durationSec keys)', () => {
    const stravaRow = (date, distanceM, durationMin, rpe = 5) => ({ date, type: 'row', distanceM, duration: durationMin, rpe })
    const log = [
      stravaRow('2026-05-10', 2000, 8),
      stravaRow('2026-05-12', 2000, 8),
      stravaRow('2026-05-14', 2000, 8),
    ]
    const r = computeRowingSplitConsistency({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.bucketResults[0].distance).toBe(2000)
    // 8 min over 2000m → 480s → 120s/500m (seconds, not minutes)
    expect(r.bucketResults[0].meanSplitSec).toBe(120)
  })

  it('null-rpe rowing pieces do not qualify (honest-null)', () => {
    const log = [
      { date: '2026-05-10', type: 'row', distanceM: 2000, duration: 8, rpe: null },
      { date: '2026-05-12', type: 'row', distanceM: 2000, duration: 8, rpe: null },
      { date: '2026-05-14', type: 'row', distanceM: 2000, duration: 8, rpe: null },
    ]
    expect(computeRowingSplitConsistency({ log, today: TODAY })).toBeNull()
  })
})

describe('rowingConsistencyBlockedByRpe (v9.474)', () => {
  const nullRpeRow = (date) => ({ date, type: 'row', distanceM: 2000, duration: 8, rpe: null })
  it('true when rowing pieces exist but none carry a steady-state RPE', () => {
    expect(rowingConsistencyBlockedByRpe({ log: [nullRpeRow('2026-05-10'), nullRpeRow('2026-05-12')], today: TODAY })).toBe(true)
  })
  it('false when at least one piece has a steady-state RPE (analysis path owns it)', () => {
    expect(rowingConsistencyBlockedByRpe({ log: [nullRpeRow('2026-05-10'), mkRow('2026-05-12', 2000, 480)], today: TODAY })).toBe(false)
  })
  it('false when there are no rowing pieces at all', () => {
    expect(rowingConsistencyBlockedByRpe({ log: [], today: TODAY })).toBe(false)
    expect(rowingConsistencyBlockedByRpe({ log: [{ date: '2026-05-10', type: 'run', distanceM: 10000, duration: 50, rpe: null }], today: TODAY })).toBe(false)
  })
  it('false for out-of-window or non-bucket distances', () => {
    expect(rowingConsistencyBlockedByRpe({ log: [{ ...nullRpeRow('2026-01-01') }], today: TODAY })).toBe(false)
    expect(rowingConsistencyBlockedByRpe({ log: [{ date: '2026-05-10', type: 'row', distanceM: 3456, duration: 15, rpe: null }], today: TODAY })).toBe(false)
  })
})

describe('rowingConsistencyBlockedByRpe — real out-of-band rpe is NOT "blocked" (v9.474)', () => {
  it('false when all pieces carry real out-of-band RPE (recovery/test — silence is correct)', () => {
    const log = [
      { date: '2026-05-10', type: 'row', distanceM: 2000, duration: 8, rpe: 3 },
      { date: '2026-05-12', type: 'row', distanceM: 2000, duration: 8, rpe: 9 },
    ]
    expect(rowingConsistencyBlockedByRpe({ log, today: TODAY })).toBe(false)
  })
})
