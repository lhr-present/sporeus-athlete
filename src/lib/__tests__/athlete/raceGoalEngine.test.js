// src/lib/__tests__/athlete/raceGoalEngine.test.js — E80
import { describe, it, expect } from 'vitest'
import { analyzeRaceGoal, parseMmSs } from '../../athlete/raceGoalEngine.js'

// 50:00 = 3000s, 40:00 = 2400s for 10K — the canonical test scenario
const CURRENT = 3000  // 50:00
const GOAL    = 2400  // 40:00
const DIST    = 10000 // 10K

describe('parseMmSs', () => {
  it('parses MM:SS', () => expect(parseMmSs('50:00')).toBe(3000))
  it('parses 40:00', () => expect(parseMmSs('40:00')).toBe(2400))
  it('parses H:MM:SS', () => expect(parseMmSs('1:00:00')).toBe(3600))
  it('returns NaN for empty string', () => expect(parseMmSs('')).toBeNaN())
  it('returns NaN for null', () => expect(parseMmSs(null)).toBeNaN())
  it('returns NaN for non-numeric', () => expect(parseMmSs('abc:de')).toBeNaN())
})

describe('analyzeRaceGoal — basic validation', () => {
  it('returns null for zero currentTime', () => {
    expect(analyzeRaceGoal(0, GOAL, DIST)).toBeNull()
  })
  it('returns null for zero goalTime', () => {
    expect(analyzeRaceGoal(CURRENT, 0, DIST)).toBeNull()
  })
  it('returns null when goal is slower than current', () => {
    expect(analyzeRaceGoal(CURRENT, CURRENT + 100, DIST)).toBeNull()
  })
  it('returns null when goal equals current', () => {
    expect(analyzeRaceGoal(CURRENT, CURRENT, DIST)).toBeNull()
  })
})

describe('analyzeRaceGoal — 50:00 → 40:00 for 10K', () => {
  const result = analyzeRaceGoal(CURRENT, GOAL, DIST, {}, [])

  it('returns non-null', () => expect(result).not.toBeNull())
  it('has correct distanceLabel', () => expect(result.distanceLabel).toBe('10K'))
  it('currentTimeStr is 50:00', () => expect(result.currentTimeStr).toBe('50:00'))
  it('goalTimeStr is 40:00', () => expect(result.goalTimeStr).toBe('40:00'))
  it('currentVdot is > 0', () => expect(result.currentVdot).toBeGreaterThan(0))
  it('goalVdot > currentVdot', () => expect(result.goalVdot).toBeGreaterThan(result.currentVdot))
  it('vdotGap is positive', () => expect(result.vdotGap).toBeGreaterThan(0))
  it('weeksToGoal is a positive multiple of 12', () => {
    expect(result.weeksToGoal).toBeGreaterThan(0)
    expect(result.weeksToGoal % 12).toBe(0)
  })
  it('feasibility is set', () => {
    expect(['achievable', 'ambitious', 'stretch', 'extreme']).toContain(result.feasibility)
  })
  it('currentPaces has E/M/T/I/R keys', () => {
    expect(result.currentPaces).toMatchObject({
      E: expect.any(String), M: expect.any(String),
      T: expect.any(String), I: expect.any(String), R: expect.any(String),
    })
  })
  it('goalPaces has E/M/T/I/R keys', () => {
    expect(result.goalPaces).toMatchObject({
      E: expect.any(String), M: expect.any(String),
      T: expect.any(String), I: expect.any(String), R: expect.any(String),
    })
  })
  it('goalPaces T is faster than currentPaces T', () => {
    const tCurrent = result.currentPaces.T
    const tGoal    = result.goalPaces.T
    // Lower pace string = faster (fewer minutes or seconds)
    expect(tGoal < tCurrent).toBe(true)
  })
  it('phases array has 4 entries', () => expect(result.phases).toHaveLength(4))
  it('phases sum to weeksToGoal', () => {
    const sum = result.phases.reduce((s, p) => s + p.weeks, 0)
    expect(sum).toBe(result.weeksToGoal)
  })
  it('all phases have en/tr strings', () => {
    for (const p of result.phases) {
      expect(p.en.length).toBeGreaterThan(5)
      expect(p.tr.length).toBeGreaterThan(5)
    }
  })
  it('checkpoints has at least 1 entry', () => expect(result.checkpoints.length).toBeGreaterThanOrEqual(1))
  it('final checkpoint vdot ≈ goalVdot', () => {
    const last = result.checkpoints[result.checkpoints.length - 1]
    expect(last.vdot).toBeCloseTo(result.goalVdot, 0)
  })
  it('safeWeeklyTSS is positive', () => expect(result.safeWeeklyTSS).toBeGreaterThan(0))
})

describe('analyzeRaceGoal — with profile (age+maxhr)', () => {
  const withProfile = analyzeRaceGoal(CURRENT, GOAL, DIST, { age: 35, maxhr: 185 }, [])

  it('returns non-null', () => expect(withProfile).not.toBeNull())
  it('maxHR from profile is MEASURED', () => {
    expect(withProfile.predicted.maxHR?.label).toBe('MEASURED')
    expect(withProfile.predicted.maxHR?.value).toBe(185)
  })
  it('lthr is CALCULATED when maxHR is MEASURED', () => {
    expect(withProfile.predicted.lthr?.label).toBe('CALCULATED')
  })
  it('lthr value is 87% of maxHR', () => {
    expect(withProfile.predicted.lthr?.value).toBe(Math.round(185 * 0.87))
  })
  it('thresholdHRRange is CALCULATED', () => {
    expect(withProfile.predicted.thresholdHRRange?.label).toBe('CALCULATED')
  })
})

describe('analyzeRaceGoal — age-only profile (no maxHR)', () => {
  const withAge = analyzeRaceGoal(CURRENT, GOAL, DIST, { age: 40 }, [])

  it('maxHR is PREDICTED', () => {
    expect(withAge.predicted.maxHR?.label).toBe('PREDICTED')
  })
  it('maxHR uses Tanaka formula', () => {
    const expected = Math.round(208 - 0.7 * 40)
    expect(withAge.predicted.maxHR?.value).toBe(expected)
  })
  it('lthr is PREDICTED when maxHR is PREDICTED', () => {
    expect(withAge.predicted.lthr?.label).toBe('PREDICTED')
  })
})

describe('analyzeRaceGoal — no profile (no predictions for HR)', () => {
  const noProfile = analyzeRaceGoal(CURRENT, GOAL, DIST, {}, [])
  it('predicted.maxHR is undefined when no age/maxhr', () => {
    expect(noProfile.predicted.maxHR).toBeUndefined()
  })
  it('predicted.lthr is undefined when no age/maxhr', () => {
    expect(noProfile.predicted.lthr).toBeUndefined()
  })
  it('thresholdPace is DERIVED', () => {
    expect(noProfile.predicted.thresholdPace?.label).toBe('DERIVED')
  })
})

describe('analyzeRaceGoal — 5K scenario', () => {
  const res = analyzeRaceGoal(25 * 60, 22 * 60, 5000, {}, [])
  it('returns non-null for 5K', () => expect(res).not.toBeNull())
  it('distanceLabel is 5K', () => expect(res.distanceLabel).toBe('5K'))
  it('currentVdot > 0', () => expect(res.currentVdot).toBeGreaterThan(0))
})
