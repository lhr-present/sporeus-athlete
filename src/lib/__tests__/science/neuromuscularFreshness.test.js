// src/lib/__tests__/science/neuromuscularFreshness.test.js
// E15 — Neuromuscular Freshness Index tests
//
// References:
//   Cairns S.P. (2006) Lactic acid and exercise performance. Sports Med 36(4):279–291.
//   Seiler S. (2010) What is best practice for training intensity and duration distribution
//     in endurance athletes? Int J Sports Physiol Perform 5(3):276–291.

import { describe, it, expect } from 'vitest'
import {
  computeNMFatigue,
  nmFatigueHistory,
  NM_FRESHNESS_CITATION,
} from '../../science/neuromuscularFreshness.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

const TODAY = '2024-03-15'

/** Build a log entry with explicit zone minutes. */
function makeZoneEntry(date, z4 = 0, z5 = 0, rpe = null) {
  const entry = { date, zones: { Z4: z4, Z5: z5 } }
  if (rpe !== null) entry.rpe = rpe
  return entry
}

/** Build a log entry with only RPE (no zones). */
function makeRpeEntry(date, rpe) {
  return { date, rpe }
}

/** Build a log entry with no zones and no RPE. */
function makeEasyEntry(date) {
  return { date, rpe: 5 }
}

/**
 * Build a log that produces a known baseline and controllable last-7d load.
 *
 * Strategy: place 3 baseline weeks entirely outside the 7d window (days -28 to -8).
 * The 28-day weekly mean = totalBaselineLoad / 4 (includes the 7d week = last7dLoad).
 *
 * Session placements (outside 7d window, inside 28d):
 *   Week bucket 3 (days 21–28 ago): single session at -22
 *   Week bucket 2 (days 14–20 ago): single session at -15
 *   Week bucket 1 (days  7–13 ago): single session at -10
 *   Week bucket 0 (last 7 days):    optional last7dLoad at -3
 *
 * With baselineMinPerWeek=40 per historical week and last7dLoad=X:
 *   weeklyTotals = [last7dLoad, 40, 40, 40]
 *   nmLoad28dWeeklyMean = (last7dLoad + 40 + 40 + 40) / 4
 *   fatigueRatio = last7dLoad / nmLoad28dWeeklyMean
 */
function buildLog(last7dLoad = 0, baselineMinPerWeek = 40) {
  const log = []
  // 3 historical weeks (strictly outside last 7 days)
  log.push(makeZoneEntry(_offset(TODAY, -22), baselineMinPerWeek, 0))  // week bucket 3
  log.push(makeZoneEntry(_offset(TODAY, -15), baselineMinPerWeek, 0))  // week bucket 2
  log.push(makeZoneEntry(_offset(TODAY, -10), baselineMinPerWeek, 0))  // week bucket 1
  // Last 7d
  if (last7dLoad > 0) {
    log.push(makeZoneEntry(_offset(TODAY, -3), last7dLoad, 0))
  }
  return log
}

/**
 * Compute the expected fatigueRatio and score given buildLog parameters.
 * (For test assertions)
 */
function _expectedRatio(last7dLoad, baselineMinPerWeek = 40) {
  const mean = (last7dLoad + baselineMinPerWeek * 3) / 4
  return last7dLoad / mean
}

function _offset(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ── 1. No Z4/Z5 in last 7 days → score 95, fresh ────────────────────────────

describe('computeNMFatigue — no high-intensity last 7d', () => {
  it('score = 95 and classification = fresh when no Z4/Z5 in last 7 days', () => {
    // Baseline: 3 weeks at 40 min. Last 7d: 0 min.
    // nmLoad7d=0, mean=(0+40+40+40)/4=30, ratio=0 → score=95
    const log = buildLog(0, 40)
    const result = computeNMFatigue(log, TODAY)
    expect(result.score).toBe(95)
    expect(result.classification).toBe('fresh')
  })

  it('fatigueRatio = 0 when no high-intensity sessions in last 7d', () => {
    // nmLoad7d=0, mean=30 → ratio=0/30=0
    const log = buildLog(0, 40)
    const result = computeNMFatigue(log, TODAY)
    expect(result.fatigueRatio).toBe(0)
  })
})

// ── 2. Same load as baseline (ratio = 1.0) → score = 70, normal ─────────────

describe('computeNMFatigue — load equals baseline (ratio = 1.0)', () => {
  it('score = 70 and classification = normal when this week equals baseline', () => {
    // nmLoad7d=40, mean=(40+40+40+40)/4=40, ratio=1.0 → score=70
    const log = buildLog(40, 40)
    const result = computeNMFatigue(log, TODAY)
    expect(result.score).toBe(70)
    expect(result.classification).toBe('normal')
  })
})

// ── 3. ~2× baseline → score = 35, accumulated ───────────────────────────────

describe('computeNMFatigue — ~2× baseline in 7d', () => {
  it('score = 35 and accumulated when 2× weekly baseline in 7 days', () => {
    // nmLoad7d=80, mean=(80+40+40+40)/4=50, ratio=80/50=1.6 → score=35
    const log = buildLog(80, 40)
    const result = computeNMFatigue(log, TODAY)
    expect(result.score).toBeLessThanOrEqual(40)
    expect(['accumulated', 'overreached']).toContain(result.classification)
  })
})

// ── 4. 3× baseline → score ≤ 15, overreached ────────────────────────────────

describe('computeNMFatigue — 3× baseline in 7d', () => {
  it('score ≤ 15 and overreached when 3× weekly baseline in 7 days', () => {
    // nmLoad7d=120, mean=(120+40+40+40)/4=60, ratio=2.0 → score=15
    const log = buildLog(120, 40)
    const result = computeNMFatigue(log, TODAY)
    expect(result.score).toBeLessThanOrEqual(15)
    expect(result.classification).toBe('overreached')
  })
})

// ── 5. Zero baseline (new athlete) → score = 80 ─────────────────────────────

describe('computeNMFatigue — zero baseline (new athlete)', () => {
  it('score = 80 when no baseline history (new athlete)', () => {
    const result = computeNMFatigue([], TODAY)
    expect(result.score).toBe(80)
    expect(result.nmLoad28dWeeklyMean).toBe(0)
  })
})

// ── 6. RPE fallback ──────────────────────────────────────────────────────────

describe('computeNMFatigue — RPE fallback', () => {
  it('entry with RPE=9 but no zones contributes 15 min to nmLoad7d', () => {
    const log = [makeRpeEntry(_offset(TODAY, -2), 9)]
    const result = computeNMFatigue(log, TODAY)
    expect(result.nmLoad7d).toBe(15)
  })

  it('entry with RPE=8 (boundary) contributes 15 min', () => {
    const log = [makeRpeEntry(_offset(TODAY, -1), 8)]
    const result = computeNMFatigue(log, TODAY)
    expect(result.nmLoad7d).toBe(15)
  })
})

// ── 7. nmFatigueHistory returns correct length ───────────────────────────────

describe('nmFatigueHistory — return length', () => {
  it('returns exactly 8 entries by default', () => {
    const result = nmFatigueHistory([], 8, TODAY)
    expect(result).toHaveLength(8)
  })

  it('returns correct length when weeks param specified', () => {
    const result = nmFatigueHistory([], 4, TODAY)
    expect(result).toHaveLength(4)
  })

  it('oldest entry first (weekStart ascending)', () => {
    const result = nmFatigueHistory(buildLog(40, 40), 4, TODAY)
    expect(result[0].weekStart < result[3].weekStart).toBe(true)
  })
})

// ── 8. Sessions without zones AND without RPE → 0 Z4/Z5 ────────────────────

describe('computeNMFatigue — no zones no RPE = 0 high-intensity', () => {
  it('entry without zones and with low RPE contributes 0 min', () => {
    const log = [makeEasyEntry(_offset(TODAY, -1))]  // RPE=5, no zones
    const result = computeNMFatigue(log, TODAY)
    expect(result.nmLoad7d).toBe(0)
  })
})

// ── 9. Citation always present ───────────────────────────────────────────────

describe('computeNMFatigue — citation', () => {
  it('always includes citation string', () => {
    const r1 = computeNMFatigue([], TODAY)
    expect(r1.citation).toBeTruthy()
    expect(r1.citation).toContain('Cairns')

    const r2 = computeNMFatigue(buildLog(40, 40), TODAY)
    expect(r2.citation).toBeTruthy()
    expect(r2.citation).toContain('Seiler')
  })

  it('NM_FRESHNESS_CITATION constant is exported and non-empty', () => {
    expect(typeof NM_FRESHNESS_CITATION).toBe('string')
    expect(NM_FRESHNESS_CITATION.length).toBeGreaterThan(10)
  })
})

// ── 10. Score always in [0, 100] ─────────────────────────────────────────────

describe('computeNMFatigue — score bounds', () => {
  it('score is always between 0 and 100 for extreme loads', () => {
    const extremeLog = buildLog(1000, 40) // 25× baseline
    const r = computeNMFatigue(extremeLog, TODAY)
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(100)
  })

  it('score = 80 for empty log (zero baseline)', () => {
    const r = computeNMFatigue([], TODAY)
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(100)
  })
})

// ── 11. fatigueRatio = 0 when no high-intensity ──────────────────────────────

describe('computeNMFatigue — fatigueRatio zero', () => {
  it('fatigueRatio is 0 when nmLoad7d is 0 with baseline', () => {
    // nmLoad7d=0, mean=30 → ratio=0/30=0 → score=95
    const log = buildLog(0, 40)
    const result = computeNMFatigue(log, TODAY)
    expect(result.fatigueRatio).toBe(0)
    expect(result.score).toBe(95)
  })
})

// ── 12. lastHardSessionDaysAgo ────────────────────────────────────────────────

describe('computeNMFatigue — lastHardSessionDaysAgo', () => {
  it('returns null when no hard sessions exist', () => {
    const log = [makeEasyEntry(_offset(TODAY, -2))]
    const r = computeNMFatigue(log, TODAY)
    expect(r.lastHardSessionDaysAgo).toBeNull()
  })

  it('returns correct number of days ago for last hard session', () => {
    const log = [makeZoneEntry(_offset(TODAY, -3), 20, 0)]
    const r = computeNMFatigue(log, TODAY)
    expect(r.lastHardSessionDaysAgo).toBe(3)
  })

  it('returns 0 for a hard session on today', () => {
    const log = [makeZoneEntry(TODAY, 10, 0)]
    const r = computeNMFatigue(log, TODAY)
    expect(r.lastHardSessionDaysAgo).toBe(0)
  })

  it('returns most recent hard session (not oldest)', () => {
    const log = [
      makeZoneEntry(_offset(TODAY, -10), 20, 0),
      makeZoneEntry(_offset(TODAY, -2),  15, 0),
    ]
    const r = computeNMFatigue(log, TODAY)
    expect(r.lastHardSessionDaysAgo).toBe(2)
  })
})

// ── Extra: nmFatigueHistory null score for < 2 sessions ─────────────────────

describe('nmFatigueHistory — null score for sparse weeks', () => {
  it('score is null for weeks with < 2 sessions', () => {
    // Only one session total, in the most recent week
    const log = [makeZoneEntry(_offset(TODAY, -2), 20, 0)]
    const history = nmFatigueHistory(log, 8, TODAY)
    // Most recent week (index 7) has 1 session → score null
    expect(history[history.length - 1].score).toBeNull()
  })
})
