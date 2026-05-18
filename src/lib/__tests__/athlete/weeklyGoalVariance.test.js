// src/lib/__tests__/athlete/weeklyGoalVariance.test.js
//
// Pure-fn tests for analyzeWeeklyGoalVariance — Locke 2002 / Latham 2002
// goal-setting variance tracker.
import { describe, it, expect } from 'vitest'
import {
  analyzeWeeklyGoalVariance,
  WEEKLY_GOAL_VARIANCE_CITATION,
} from '../../athlete/weeklyGoalVariance.js'

// 2026-05-17 is a Sunday → Monday of that week is 2026-05-11.
const TODAY = '2026-05-17'

// ─── Helpers ────────────────────────────────────────────────────────────────

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// Monday of the week containing `iso` (ISO 8601, Monday-first).
function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

// Build a log of 8 weekly entries — one session per week — with the given
// weekly TSS amounts (oldest first). Weeks align with calendar weeks ending
// in the week containing `today`.
function buildWeeklyLog({ today = TODAY, weeklyTss }) {
  const monday = mondayOf(today)
  const log = []
  for (let i = 0; i < weeklyTss.length; i++) {
    // weeklyTss[0] is the OLDEST week; index from current week back by (n-1-i)*7
    const weekStart = isoMinusDays(monday, (weeklyTss.length - 1 - i) * 7)
    // Put the session mid-week (Wednesday = weekStart + 2) so DST/UTC edge cases
    // can't push it into the wrong week.
    const sessionDate = isoMinusDays(weekStart, -2)
    log.push({ date: sessionDate, tss: weeklyTss[i] })
  }
  return log
}

// ─── null / insufficient signal ────────────────────────────────────────────

describe('analyzeWeeklyGoalVariance — null / insufficient signals', () => {
  it('returns null when profile has no weeklyTssGoal', () => {
    const log = buildWeeklyLog({ weeklyTss: [400, 400, 400, 400, 400, 400, 400, 400] })
    expect(
      analyzeWeeklyGoalVariance({ log, profile: {}, today: TODAY })
    ).toBeNull()
  })

  it('returns null when weeklyTssGoal <= 0', () => {
    const log = buildWeeklyLog({ weeklyTss: [400, 400, 400, 400, 400, 400, 400, 400] })
    expect(
      analyzeWeeklyGoalVariance({ log, profile: { weeklyTssGoal: 0 }, today: TODAY })
    ).toBeNull()
    expect(
      analyzeWeeklyGoalVariance({ log, profile: { weeklyTssGoal: -50 }, today: TODAY })
    ).toBeNull()
  })

  it('returns null when profile is null/undefined', () => {
    const log = buildWeeklyLog({ weeklyTss: [400, 400, 400, 400, 400, 400, 400, 400] })
    expect(
      analyzeWeeklyGoalVariance({ log, profile: null, today: TODAY })
    ).toBeNull()
    expect(
      analyzeWeeklyGoalVariance({ log, today: TODAY })
    ).toBeNull()
  })

  it('returns null when fewer than 4 of 8 weeks have any sessions', () => {
    // Only 3 weeks with sessions — below the MIN_WEEKS_WITH_SESSIONS=4 floor.
    const log = buildWeeklyLog({
      weeklyTss: [400, 0, 0, 400, 0, 0, 400, 0],
    }).filter(e => e.tss > 0)
    expect(
      analyzeWeeklyGoalVariance({
        log, profile: { weeklyTssGoal: 400 }, today: TODAY,
      })
    ).toBeNull()
  })

  it('returns null for an empty log even with a goal', () => {
    expect(
      analyzeWeeklyGoalVariance({
        log: [], profile: { weeklyTssGoal: 400 }, today: TODAY,
      })
    ).toBeNull()
  })

  it('returns null when today is invalid', () => {
    const log = buildWeeklyLog({ weeklyTss: [400, 400, 400, 400, 400, 400, 400, 400] })
    expect(
      analyzeWeeklyGoalVariance({
        log, profile: { weeklyTssGoal: 400 }, today: 'not-a-date',
      })
    ).toBeNull()
  })
})

// ─── Band classification ────────────────────────────────────────────────────

describe('analyzeWeeklyGoalVariance — band classification', () => {
  it('exact-goal sessions → ON_TARGET, avgVariance == 0', () => {
    const log = buildWeeklyLog({
      weeklyTss: [400, 400, 400, 400, 400, 400, 400, 400],
    })
    const r = analyzeWeeklyGoalVariance({
      log, profile: { weeklyTssGoal: 400 }, today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.band).toBe('ON_TARGET')
    expect(r.avgVariance).toBe(0)
    expect(r.weeklyTssGoal).toBe(400)
    expect(r.weeks).toHaveLength(8)
  })

  it('UNDER band — all weeks at 60% of goal (variance -0.4)', () => {
    const log = buildWeeklyLog({
      weeklyTss: [240, 240, 240, 240, 240, 240, 240, 240],
    })
    const r = analyzeWeeklyGoalVariance({
      log, profile: { weeklyTssGoal: 400 }, today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.band).toBe('UNDER')
    expect(r.avgVariance).toBeLessThan(-0.10)
    expect(r.avgVariance).toBeCloseTo(-0.4, 3)
  })

  it('OVER band — all weeks at 140% of goal (variance +0.4)', () => {
    const log = buildWeeklyLog({
      weeklyTss: [560, 560, 560, 560, 560, 560, 560, 560],
    })
    const r = analyzeWeeklyGoalVariance({
      log, profile: { weeklyTssGoal: 400 }, today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.band).toBe('OVER')
    expect(r.avgVariance).toBeGreaterThan(0.10)
    expect(r.avgVariance).toBeCloseTo(0.4, 3)
  })

  it('within ±10% tolerance still classifies ON_TARGET (e.g. 105% of goal)', () => {
    const log = buildWeeklyLog({
      weeklyTss: [420, 420, 420, 420, 420, 420, 420, 420],
    })
    const r = analyzeWeeklyGoalVariance({
      log, profile: { weeklyTssGoal: 400 }, today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.band).toBe('ON_TARGET')
    expect(r.avgVariance).toBeCloseTo(0.05, 3)
  })

  it('exact boundary +0.10 → ON_TARGET (≤ tolerance is inclusive)', () => {
    // 8 weeks of 440 vs goal 400 → variance = +0.10 each → avg = +0.10.
    const log = buildWeeklyLog({
      weeklyTss: [440, 440, 440, 440, 440, 440, 440, 440],
    })
    const r = analyzeWeeklyGoalVariance({
      log, profile: { weeklyTssGoal: 400 }, today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.avgVariance).toBeCloseTo(0.10, 3)
    expect(r.band).toBe('ON_TARGET')
  })

  it('just past boundary +0.11 → OVER', () => {
    // 444 vs 400 → variance +0.11.
    const log = buildWeeklyLog({
      weeklyTss: [444, 444, 444, 444, 444, 444, 444, 444],
    })
    const r = analyzeWeeklyGoalVariance({
      log, profile: { weeklyTssGoal: 400 }, today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.avgVariance).toBeGreaterThan(0.10)
    expect(r.band).toBe('OVER')
  })

  it('just past boundary -0.11 → UNDER', () => {
    // 356 vs 400 → variance -0.11.
    const log = buildWeeklyLog({
      weeklyTss: [356, 356, 356, 356, 356, 356, 356, 356],
    })
    const r = analyzeWeeklyGoalVariance({
      log, profile: { weeklyTssGoal: 400 }, today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.avgVariance).toBeLessThan(-0.10)
    expect(r.band).toBe('UNDER')
  })
})

// ─── Shape + metadata ───────────────────────────────────────────────────────

describe('analyzeWeeklyGoalVariance — shape + metadata', () => {
  it('returns 8 weeks oldest-first with correct weekStart anchors', () => {
    const log = buildWeeklyLog({
      weeklyTss: [400, 400, 400, 400, 400, 400, 400, 400],
    })
    const r = analyzeWeeklyGoalVariance({
      log, profile: { weeklyTssGoal: 400 }, today: TODAY,
    })
    expect(r.weeks).toHaveLength(8)
    // Weeks are oldest first — each weekStart is 7 days after the previous.
    for (let i = 1; i < 8; i++) {
      const prev = new Date(r.weeks[i - 1].weekStart + 'T00:00:00Z')
      const cur  = new Date(r.weeks[i].weekStart + 'T00:00:00Z')
      const diffDays = Math.round((cur - prev) / (1000 * 60 * 60 * 24))
      expect(diffDays).toBe(7)
    }
    // Last weekStart is the Monday of the week containing today.
    expect(r.weeks[7].weekStart).toBe(mondayOf(TODAY))
  })

  it('exposes Locke 2002; Latham 2002 citation', () => {
    const log = buildWeeklyLog({
      weeklyTss: [400, 400, 400, 400, 400, 400, 400, 400],
    })
    const r = analyzeWeeklyGoalVariance({
      log, profile: { weeklyTssGoal: 400 }, today: TODAY,
    })
    expect(r.citation).toBe(WEEKLY_GOAL_VARIANCE_CITATION)
    expect(r.citation).toMatch(/Locke 2002/)
    expect(r.citation).toMatch(/Latham 2002/)
  })

  it('per-week variance matches (actualTss - goal) / goal', () => {
    const log = buildWeeklyLog({
      weeklyTss: [200, 300, 400, 500, 600, 400, 400, 400],
    })
    const r = analyzeWeeklyGoalVariance({
      log, profile: { weeklyTssGoal: 400 }, today: TODAY,
    })
    expect(r).not.toBeNull()
    const expectedVariances = [-0.5, -0.25, 0, 0.25, 0.5, 0, 0, 0]
    r.weeks.forEach((w, i) => {
      expect(w.variance).toBeCloseTo(expectedVariances[i], 3)
    })
  })

  it('ignores sessions outside the 8-week window', () => {
    // Build 8 weeks of 400 + one stray session 12 weeks ago of 9999 TSS.
    const log = buildWeeklyLog({
      weeklyTss: [400, 400, 400, 400, 400, 400, 400, 400],
    })
    const monday = mondayOf(TODAY)
    const ancient = isoMinusDays(monday, 12 * 7) // 12 weeks before current Monday
    log.push({ date: ancient, tss: 9999 })

    const r = analyzeWeeklyGoalVariance({
      log, profile: { weeklyTssGoal: 400 }, today: TODAY,
    })
    expect(r.band).toBe('ON_TARGET')
    expect(r.avgVariance).toBe(0)
  })

  it('sums multiple same-week sessions into one weekly total', () => {
    // Two sessions in the current week, each 200 TSS → 400 weekly total.
    // Surrounding 7 weeks also at 400 each → ON_TARGET.
    const monday = mondayOf(TODAY)
    const log = buildWeeklyLog({
      weeklyTss: [400, 400, 400, 400, 400, 400, 400, 0],
    }).filter(e => e.tss > 0)
    log.push({ date: isoMinusDays(monday, -2), tss: 200 }) // Wed of current week
    log.push({ date: isoMinusDays(monday, -4), tss: 200 }) // Fri of current week

    const r = analyzeWeeklyGoalVariance({
      log, profile: { weeklyTssGoal: 400 }, today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.weeks[7].actualTss).toBe(400)
    expect(r.band).toBe('ON_TARGET')
  })

  it('returns when exactly 4 of 8 weeks have sessions (boundary inclusive)', () => {
    // 4 weeks at 400 (matching goal), 4 weeks with no sessions.
    // 4 zero-weeks → variance -1 each; 4 on-goal weeks → 0 each.
    // avgVariance = (4 * -1) / 8 = -0.5 → UNDER.
    const log = buildWeeklyLog({
      weeklyTss: [400, 0, 400, 0, 400, 0, 400, 0],
    }).filter(e => e.tss > 0)
    const r = analyzeWeeklyGoalVariance({
      log, profile: { weeklyTssGoal: 400 }, today: TODAY,
    })
    expect(r).not.toBeNull()
    expect(r.band).toBe('UNDER')
  })

  it('rounds actualTss to nearest integer per week', () => {
    // Inject fractional TSS to confirm rounding.
    const monday = mondayOf(TODAY)
    const log = []
    for (let i = 0; i < 8; i++) {
      const weekStart = isoMinusDays(monday, (7 - i) * 7)
      log.push({ date: isoMinusDays(weekStart, -2), tss: 100.4 })
      log.push({ date: isoMinusDays(weekStart, -3), tss: 100.4 })
    }
    const r = analyzeWeeklyGoalVariance({
      log, profile: { weeklyTssGoal: 200 }, today: TODAY,
    })
    expect(r).not.toBeNull()
    r.weeks.forEach(w => {
      expect(Number.isInteger(w.actualTss)).toBe(true)
    })
  })
})
