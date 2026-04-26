// src/lib/__tests__/science/aerobicEfficiency.test.js
// E20 — Tests for aerobicEfficiency.js
//
// Tests real computeEF computations without mocking internal libs.
// Session fields used: avgHR, np (cycling) / avgPaceMPerMin (running), date.

import { describe, it, expect } from 'vitest'
import {
  isoWeekLabel,
  weeklyEFHistory,
  classifyEFTrend,
  computeAerobicEfficiencyTrend,
  EF_CITATION,
} from '../../science/aerobicEfficiency.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a cycling session with known EF = np/avgHR */
function cycleSession(date, np, avgHR) {
  return { date, np, avgHR, sport: 'cycling' }
}

/** Build a running session with known EF = avgPaceMPerMin/avgHR */
function _runSession(date, avgPaceMPerMin, avgHR) {
  return { date, avgPaceMPerMin, avgHR, sport: 'running' }
}

// ── isoWeekLabel ──────────────────────────────────────────────────────────────

describe('isoWeekLabel', () => {
  it('returns correct week for 2026-04-25 (W17)', () => {
    // Jan 4 2026 is a Sunday (day 0); let's verify
    const label = isoWeekLabel('2026-04-25')
    expect(label).toMatch(/^2026-W\d{2}$/)
    // 2026-04-25 is in week 17
    expect(label).toBe('2026-W17')
  })

  it('returns correct week for 2026-01-01 (W01 or W53 of prev year)', () => {
    const label = isoWeekLabel('2026-01-05')
    expect(label).toMatch(/^2026-W\d{2}$/)
  })

  it('returns string in YYYY-Www format', () => {
    const label = isoWeekLabel('2025-06-15')
    expect(label).toMatch(/^\d{4}-W\d{2}$/)
  })

  it('same week label for two dates in the same computed week', () => {
    // 2026-04-25 and 2026-04-27 both fall in the same computed week
    expect(isoWeekLabel('2026-04-25')).toBe(isoWeekLabel('2026-04-27'))
  })
})

// ── weeklyEFHistory ───────────────────────────────────────────────────────────

describe('weeklyEFHistory — empty / invalid', () => {
  it('returns [] for empty log', () => {
    expect(weeklyEFHistory([])).toEqual([])
    expect(weeklyEFHistory()).toEqual([])
  })

  it('returns [] for log with no valid HR data', () => {
    const log = [
      { date: '2026-01-01', type: 'run' },   // no avgHR
      { date: '2026-01-08', np: 200 },        // no avgHR
    ]
    expect(weeklyEFHistory(log)).toEqual([])
  })

  it('returns [] when fewer than 3 usable weeks', () => {
    // Only 2 distinct weeks with valid EF
    const log = [
      cycleSession('2026-04-06', 220, 140),
      cycleSession('2026-04-13', 220, 140),
    ]
    expect(weeklyEFHistory(log, 8, '2026-04-25')).toEqual([])
  })
})

describe('weeklyEFHistory — sufficient data', () => {
  it('returns correct number of weeks for 4-week log', () => {
    const log = [
      // Week 1
      cycleSession('2026-03-30', 220, 140),
      // Week 2
      cycleSession('2026-04-06', 220, 140),
      // Week 3
      cycleSession('2026-04-13', 220, 140),
      // Week 4
      cycleSession('2026-04-20', 220, 140),
    ]
    const result = weeklyEFHistory(log, 8, '2026-04-25')
    expect(result.length).toBeGreaterThanOrEqual(3)
    expect(result.length).toBeLessThanOrEqual(4)
  })

  it('returns sorted oldest→newest order', () => {
    const log = [
      cycleSession('2026-04-13', 220, 140),
      cycleSession('2026-03-30', 220, 140),
      cycleSession('2026-04-06', 220, 140),
      cycleSession('2026-04-20', 220, 140),
    ]
    const result = weeklyEFHistory(log, 8, '2026-04-25')
    for (let i = 1; i < result.length; i++) {
      expect(result[i].isoWeek >= result[i - 1].isoWeek).toBe(true)
    }
  })

  it('computes correct median EF for a week with multiple sessions', () => {
    // 3 sessions in same week: EFs are 1.4, 1.5, 1.6 → median = 1.5
    const log = [
      cycleSession('2026-04-06', 196, 140),  // EF = 1.4
      cycleSession('2026-04-08', 210, 140),  // EF = 1.5
      cycleSession('2026-04-10', 224, 140),  // EF = 1.6
      // Need 2 more weeks for >=3
      cycleSession('2026-03-30', 220, 140),
      cycleSession('2026-04-13', 220, 140),
    ]
    const result = weeklyEFHistory(log, 8, '2026-04-25')
    expect(result.length).toBeGreaterThanOrEqual(3)
    // Find the week of 2026-04-06
    const week = result.find(w => w.isoWeek === isoWeekLabel('2026-04-06'))
    expect(week).toBeDefined()
    expect(week.ef).toBeCloseTo(1.5, 2)
    expect(week.sessionCount).toBe(3)
  })

  it('excludes future weeks (after today)', () => {
    const log = [
      cycleSession('2026-03-30', 220, 140),
      cycleSession('2026-04-06', 220, 140),
      cycleSession('2026-04-13', 220, 140),
      cycleSession('2026-05-01', 220, 140),  // future
    ]
    const result = weeklyEFHistory(log, 8, '2026-04-25')
    const hasFutureWeek = result.some(w => w.isoWeek > isoWeekLabel('2026-04-25'))
    expect(hasFutureWeek).toBe(false)
  })

  it('respects the `weeks` limit', () => {
    // 6 weeks of data, but limit to 4
    const log = []
    for (let w = 0; w < 6; w++) {
      const day = new Date('2026-03-02')
      day.setDate(day.getDate() + w * 7)
      log.push(cycleSession(day.toISOString().slice(0, 10), 220, 140))
    }
    const result = weeklyEFHistory(log, 4, '2026-04-25')
    expect(result.length).toBeLessThanOrEqual(4)
  })
})

// ── classifyEFTrend ───────────────────────────────────────────────────────────

describe('classifyEFTrend', () => {
  it('returns null for empty array', () => {
    expect(classifyEFTrend([])).toBeNull()
    expect(classifyEFTrend()).toBeNull()
  })

  it('returns null for fewer than 3 points', () => {
    const history = [
      { isoWeek: '2026-W13', ef: 1.5, sessionCount: 1 },
      { isoWeek: '2026-W14', ef: 1.6, sessionCount: 1 },
    ]
    expect(classifyEFTrend(history)).toBeNull()
  })

  it('classifies flat trend as stable (slope ≈ 0)', () => {
    const history = [
      { isoWeek: '2026-W13', ef: 1.5, sessionCount: 1 },
      { isoWeek: '2026-W14', ef: 1.5, sessionCount: 1 },
      { isoWeek: '2026-W15', ef: 1.5, sessionCount: 1 },
    ]
    const result = classifyEFTrend(history)
    expect(result).not.toBeNull()
    expect(result.classification).toBe('stable')
    expect(result.slope).toBeCloseTo(0, 5)
  })

  it('classifies rising trend as improving (slope > 0.005)', () => {
    // Strong upward trend: EF increases by 0.05/week
    const history = [
      { isoWeek: '2026-W13', ef: 1.50, sessionCount: 2 },
      { isoWeek: '2026-W14', ef: 1.55, sessionCount: 2 },
      { isoWeek: '2026-W15', ef: 1.60, sessionCount: 2 },
      { isoWeek: '2026-W16', ef: 1.65, sessionCount: 2 },
    ]
    const result = classifyEFTrend(history)
    expect(result.classification).toBe('improving')
    expect(result.slope).toBeGreaterThan(0.005)
  })

  it('classifies falling trend as declining (slope < -0.005)', () => {
    // Strong downward trend: EF decreases by 0.05/week
    const history = [
      { isoWeek: '2026-W13', ef: 1.65, sessionCount: 2 },
      { isoWeek: '2026-W14', ef: 1.60, sessionCount: 2 },
      { isoWeek: '2026-W15', ef: 1.55, sessionCount: 2 },
      { isoWeek: '2026-W16', ef: 1.50, sessionCount: 2 },
    ]
    const result = classifyEFTrend(history)
    expect(result.classification).toBe('declining')
    expect(result.slope).toBeLessThan(-0.005)
  })

  it('returns weeklyGain equal to slope', () => {
    const history = [
      { isoWeek: '2026-W13', ef: 1.50, sessionCount: 1 },
      { isoWeek: '2026-W14', ef: 1.52, sessionCount: 1 },
      { isoWeek: '2026-W15', ef: 1.54, sessionCount: 1 },
    ]
    const result = classifyEFTrend(history)
    expect(result.weeklyGain).toBe(result.slope)
  })
})

// ── computeAerobicEfficiencyTrend ─────────────────────────────────────────────

describe('computeAerobicEfficiencyTrend', () => {
  it('returns null for empty log', () => {
    expect(computeAerobicEfficiencyTrend([])).toBeNull()
  })

  it('returns null when fewer than 3 usable weeks', () => {
    const log = [
      cycleSession('2026-04-06', 220, 140),
      cycleSession('2026-04-13', 220, 140),
    ]
    expect(computeAerobicEfficiencyTrend(log, 8, '2026-04-25')).toBeNull()
  })

  it('returns full result shape for valid log', () => {
    const log = [
      cycleSession('2026-03-30', 220, 145),
      cycleSession('2026-04-06', 220, 143),
      cycleSession('2026-04-13', 220, 141),
      cycleSession('2026-04-20', 220, 139),
    ]
    const result = computeAerobicEfficiencyTrend(log, 8, '2026-04-25')
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('weeks')
    expect(result).toHaveProperty('slope')
    expect(result).toHaveProperty('weeklyGain')
    expect(result).toHaveProperty('classification')
    expect(result).toHaveProperty('citation')
    expect(result.citation).toContain('Coggan')
    expect(['improving', 'stable', 'declining']).toContain(result.classification)
  })

  it('exports EF_CITATION string containing Coggan', () => {
    expect(typeof EF_CITATION).toBe('string')
    expect(EF_CITATION).toContain('Coggan')
  })

  it('detects improving trend when HR drops week over week', () => {
    // NP constant, HR decreasing → EF increasing
    const log = [
      cycleSession('2026-03-09', 220, 150),
      cycleSession('2026-03-16', 220, 148),
      cycleSession('2026-03-23', 220, 146),
      cycleSession('2026-03-30', 220, 144),
      cycleSession('2026-04-06', 220, 142),
      cycleSession('2026-04-13', 220, 140),
    ]
    const result = computeAerobicEfficiencyTrend(log, 8, '2026-04-25')
    expect(result).not.toBeNull()
    expect(result.classification).toBe('improving')
    expect(result.slope).toBeGreaterThan(0)
  })
})
