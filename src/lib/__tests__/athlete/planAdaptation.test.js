// src/lib/__tests__/athlete/planAdaptation.test.js
//
// v9.94.0 — tests for the EXECUTION → ADAPTATION feedback loop.

import { describe, it, expect } from 'vitest'
import { computeWeekCompliance, computePlanDrift } from '../../athlete/planAdaptation.js'

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeWeek(plannedTssTotal, sessionCount = 4) {
  const per = Math.floor(plannedTssTotal / sessionCount)
  const sessions = []
  for (let i = 0; i < sessionCount; i++) {
    sessions.push({ day: i + 1, type: 'Endurance', duration: 60, tss: per, rpe: 5 })
  }
  // Add a rest day so the week has 5 entries (4 working + 1 rest)
  sessions.push({ day: 6, type: 'Rest', duration: 0, tss: 0 })
  return { sessions }
}

function addDays(isoDate, n) {
  const d = new Date(isoDate + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function logEntry(date, tss, opts = {}) {
  return { date, type: 'Easy run', duration: 45, rpe: 4, tss, ...opts }
}

const TODAY = '2026-05-13'  // matches injected currentDate

describe('computeWeekCompliance', () => {
  it('returns no-data for missing or malformed planWeek', () => {
    const tssMap = {}
    expect(computeWeekCompliance(null, '2026-05-06', tssMap).status).toBe('no-data')
    expect(computeWeekCompliance({}, '2026-05-06', tssMap).status).toBe('no-data')
    expect(computeWeekCompliance({ sessions: 'nope' }, '2026-05-06', tssMap).status).toBe('no-data')
  })

  it('returns rest-week when plannedTSS is 0 (e.g., deload week without TSS)', () => {
    const planWeek = { sessions: [
      { day: 1, type: 'Rest', duration: 0, tss: 0 },
      { day: 2, type: 'Rest', duration: 0, tss: 0 },
    ]}
    const wc = computeWeekCompliance(planWeek, '2026-05-06', {})
    expect(wc.status).toBe('rest-week')
    expect(wc.plannedTSS).toBe(0)
  })

  it('on-track when actual TSS is 70-130% of planned', () => {
    const planWeek = makeWeek(400)  // 4 × 100 TSS
    const tssMap = {
      '2026-05-06': 100,
      '2026-05-07': 100,
      '2026-05-08': 100,
      '2026-05-09': 100,  // total 400 = 100%
    }
    const wc = computeWeekCompliance(planWeek, '2026-05-06', tssMap)
    expect(wc.status).toBe('on-track')
    expect(wc.pct).toBeCloseTo(1.0, 1)
    expect(wc.daysLogged).toBe(4)
  })

  it('under when actual TSS is 30-70% of planned', () => {
    const planWeek = makeWeek(400)
    const tssMap = {
      '2026-05-06': 100,
      '2026-05-07': 100,  // 200 / 400 = 50% → under
    }
    const wc = computeWeekCompliance(planWeek, '2026-05-06', tssMap)
    expect(wc.status).toBe('under')
    expect(wc.pct).toBeCloseTo(0.5, 1)
  })

  it('missed when actual TSS < 30% of planned', () => {
    const planWeek = makeWeek(400)
    const tssMap = { '2026-05-06': 50 }  // 12.5%
    const wc = computeWeekCompliance(planWeek, '2026-05-06', tssMap)
    expect(wc.status).toBe('missed')
  })

  it('over when actual TSS > 130% of planned', () => {
    const planWeek = makeWeek(400)
    const tssMap = {
      '2026-05-06': 200,
      '2026-05-07': 200,
      '2026-05-08': 200,  // 600/400 = 150%
    }
    const wc = computeWeekCompliance(planWeek, '2026-05-06', tssMap)
    expect(wc.status).toBe('over')
  })

  it('TSS is capped at 300/day per entry (defense against duplicates)', () => {
    // 5 entries summing to 1500 on one day should cap at 300
    const planWeek = makeWeek(400)
    const tssMap = { '2026-05-06': 1500 }  // pre-capped at 300 by buildTSSMap call site
    // But computeWeekCompliance receives the pre-built map — verify it doesn't re-cap
    const wc = computeWeekCompliance(planWeek, '2026-05-06', tssMap)
    expect(wc.actualTSS).toBe(1500)  // passthrough; capping happens in buildTSSMap
  })

  it('only counts days within the 7-day window', () => {
    const planWeek = makeWeek(400)
    const tssMap = {
      '2026-05-06': 100,           // in window
      '2026-05-12': 100,           // day 6 (end of week) — in
      '2026-05-13': 100,           // day 7 — OUT
      '2026-05-05': 100,           // day before — OUT
    }
    const wc = computeWeekCompliance(planWeek, '2026-05-06', tssMap)
    expect(wc.actualTSS).toBe(200)
    expect(wc.daysLogged).toBe(2)
  })
})

describe('computePlanDrift — basic shape', () => {
  it('returns null for null/malformed plan', () => {
    expect(computePlanDrift(null, [])).toBeNull()
    expect(computePlanDrift({}, [])).toBeNull()
    expect(computePlanDrift({ weeks: [] }, [])).toBeNull()  // missing generatedAt
  })

  it('returns pending status when no weeks are complete', () => {
    // Plan generated TODAY — no completed weeks yet
    const plan = {
      generatedAt: TODAY,
      weeks: [makeWeek(400), makeWeek(450)],
    }
    const out = computePlanDrift(plan, [], TODAY)
    expect(out).not.toBeNull()
    expect(out.status).toBe('pending')
    expect(out.weeksAnalyzed).toBe(0)
    expect(out.action).toBe('continue')
  })

  it('analyzes only completed weeks (excludes current + future)', () => {
    // Plan generated 14 days ago, so week 1 + week 2 are complete; week 3 in-flight
    const planStart = addDays(TODAY, -14)
    const plan = {
      generatedAt: planStart,
      weeks: [makeWeek(400), makeWeek(400), makeWeek(400), makeWeek(400)],
    }
    const out = computePlanDrift(plan, [], TODAY)
    expect(out.weeksAnalyzed).toBe(2)
  })
})

describe('computePlanDrift — recommendation rules', () => {
  function buildScenario({ avgPctTarget, weeksBack = 21 }) {
    // 3 completed weeks (21 days back), each with planned 400 TSS.
    // Distribute actual TSS to hit the target avg pct.
    const planStart = addDays(TODAY, -weeksBack)
    const plan = {
      generatedAt: planStart,
      weeks: [makeWeek(400), makeWeek(400), makeWeek(400), makeWeek(400)],
    }
    const log = []
    for (let w = 0; w < 3; w++) {
      const dailyTss = Math.round((400 * avgPctTarget) / 4)
      for (let d = 0; d < 4; d++) {
        log.push(logEntry(addDays(planStart, w * 7 + d), dailyTss))
      }
    }
    return { plan, log }
  }

  it('on-track when avg ≈ 100%', () => {
    const { plan, log } = buildScenario({ avgPctTarget: 1.0 })
    const out = computePlanDrift(plan, log, TODAY)
    expect(out.status).toBe('on-track')
    expect(out.action).toBe('continue')
    expect(out.avgPct).toBeCloseTo(1.0, 1)
  })

  it('under (action=reduce-next) when avg ≈ 50%', () => {
    const { plan, log } = buildScenario({ avgPctTarget: 0.5 })
    const out = computePlanDrift(plan, log, TODAY)
    expect(out.status).toBe('under')
    expect(out.action).toBe('reduce-next')
  })

  it('over (action=monitor-fatigue) when avg ≈ 150%', () => {
    const { plan, log } = buildScenario({ avgPctTarget: 1.5 })
    const out = computePlanDrift(plan, log, TODAY)
    expect(out.status).toBe('over')
    expect(out.action).toBe('monitor-fatigue')
  })

  it('drift (action=regenerate) when avg < 30%', () => {
    const { plan, log } = buildScenario({ avgPctTarget: 0.2 })
    const out = computePlanDrift(plan, log, TODAY)
    expect(out.status).toBe('drift')
    expect(out.action).toBe('regenerate')
  })

  it('drift (action=regenerate) when ≥2 weeks missed', () => {
    // Build plan with 3 completed weeks, only middle week has logs
    const planStart = addDays(TODAY, -21)
    const plan = {
      generatedAt: planStart,
      weeks: [makeWeek(400), makeWeek(400), makeWeek(400), makeWeek(400)],
    }
    // Only the second week's log entries → first + third = missed
    const log = []
    for (let d = 0; d < 4; d++) {
      log.push(logEntry(addDays(planStart, 7 + d), 80))
    }
    const out = computePlanDrift(plan, log, TODAY)
    expect(out.status).toBe('drift')
    expect(out.missedWeeks).toBeGreaterThanOrEqual(2)
  })

  it('bilingual recommendation strings exist for every status', () => {
    const variants = [
      buildScenario({ avgPctTarget: 1.0 }),    // on-track
      buildScenario({ avgPctTarget: 0.5 }),    // under
      buildScenario({ avgPctTarget: 1.5 }),    // over
      buildScenario({ avgPctTarget: 0.1 }),    // drift
    ]
    for (const { plan, log } of variants) {
      const out = computePlanDrift(plan, log, TODAY)
      expect(typeof out.recommendation.en).toBe('string')
      expect(typeof out.recommendation.tr).toBe('string')
      expect(out.recommendation.en.length).toBeGreaterThan(0)
      expect(out.recommendation.tr.length).toBeGreaterThan(0)
    }
  })

  it('pending status has empty citation', () => {
    const plan = { generatedAt: TODAY, weeks: [makeWeek(400)] }
    const out = computePlanDrift(plan, [], TODAY)
    expect(out.citation).toBe('')
  })

  it('drift status has a non-empty citation', () => {
    const { plan, log } = buildScenario({ avgPctTarget: 0.1 })
    const out = computePlanDrift(plan, log, TODAY)
    expect(out.citation.length).toBeGreaterThan(0)
  })

  it('skips rest-only weeks from average', () => {
    // Plan: week1 has rest only, week2 has TSS → only week2 should count
    const planStart = addDays(TODAY, -14)
    const restWeek = { sessions: [{ day: 1, type: 'Rest', duration: 0, tss: 0 }] }
    const plan = {
      generatedAt: planStart,
      weeks: [restWeek, makeWeek(400), makeWeek(400)],
    }
    const log = []
    for (let d = 0; d < 4; d++) {
      log.push(logEntry(addDays(planStart, 7 + d), 100))
    }
    const out = computePlanDrift(plan, log, TODAY)
    expect(out.weeksAnalyzed).toBe(1)  // only week2 counted (week1 = rest, week3 in-flight)
  })
})
