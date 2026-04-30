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
  it('all phases have en/tr strings and nameTr', () => {
    for (const p of result.phases) {
      expect(p.en.length).toBeGreaterThan(5)
      expect(p.tr.length).toBeGreaterThan(5)
      expect(p.nameTr.length).toBeGreaterThan(2)
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

// ─── parseMmSs — additional edge cases ───────────────────────────────────────
describe('parseMmSs — additional edge cases', () => {
  it('returns NaN for undefined', () => expect(parseMmSs(undefined)).toBeNaN())
  it('returns NaN for single segment (no colon)', () => expect(parseMmSs('3600')).toBeNaN())
  it('returns NaN for four-part string', () => expect(parseMmSs('1:00:00:00')).toBeNaN())
  it('parses 3:30:00 (half-three marathon) → 12600s', () => expect(parseMmSs('3:30:00')).toBe(12600))
  it('parses 3:00:00 → 10800s', () => expect(parseMmSs('3:00:00')).toBe(10800))
  it('parses 38:00 → 2280s', () => expect(parseMmSs('38:00')).toBe(2280))
  it('trims whitespace before parsing', () => expect(parseMmSs('  22:00  ')).toBe(1320))
  it('returns NaN for mixed alpha "abc:00"', () => expect(parseMmSs('abc:00')).toBeNaN())
  it('handles numeric input coerced to string "45:30"', () => {
    // parseMmSs coerces via String(str) so passing a numeric-like string is fine
    expect(parseMmSs('45:30')).toBe(45 * 60 + 30)
  })
})

// ─── analyzeRaceGoal — null / negative / boundary guard ──────────────────────
describe('analyzeRaceGoal — null and negative inputs', () => {
  it('returns null for null currentTimeSec', () => {
    expect(analyzeRaceGoal(null, 2400, 10000)).toBeNull()
  })
  it('returns null for null goalTimeSec', () => {
    expect(analyzeRaceGoal(3000, null, 10000)).toBeNull()
  })
  it('returns null for negative currentTimeSec', () => {
    expect(analyzeRaceGoal(-1, 2400, 10000)).toBeNull()
  })
  it('returns null for negative goalTimeSec', () => {
    expect(analyzeRaceGoal(3000, -1, 10000)).toBeNull()
  })
  it('returns null when both times are null', () => {
    expect(analyzeRaceGoal(null, null, 10000)).toBeNull()
  })
})

// ─── analyzeRaceGoal — 10K 40:00 → 38:00 (VDOT gain ~2) ─────────────────────
describe('analyzeRaceGoal — 10K 40:00 → 38:00 (~2 VDOT gain)', () => {
  const res = analyzeRaceGoal(40 * 60, 38 * 60, 10000, {}, [])
  it('returns non-null', () => expect(res).not.toBeNull())
  it('goalVdot > currentVdot', () => expect(res.goalVdot).toBeGreaterThan(res.currentVdot))
  it('vdotGap is approximately 2 (±1)', () => {
    expect(res.vdotGap).toBeGreaterThan(0.5)
    expect(res.vdotGap).toBeLessThan(5)
  })
  it('vdotGap equals goalVdot − currentVdot (rounded to 1dp)', () => {
    const expected = Math.round((res.goalVdot - res.currentVdot) * 10) / 10
    expect(res.vdotGap).toBe(expected)
  })
  it('weeksToGoal is a positive integer multiple of 12', () => {
    expect(res.weeksToGoal % 12).toBe(0)
    expect(res.weeksToGoal).toBeGreaterThan(0)
  })
  it('currentCTL is 0 with empty log', () => expect(res.currentCTL).toBe(0))
  it('safeWeeklyTSS falls back to 50 with empty log (CTL=0)', () => {
    // safeWeeklyTSS = max(30, 50) = 50 when currentCTL is 0
    expect(res.safeWeeklyTSS).toBe(50)
  })
  it('distanceLabel is 10K', () => expect(res.distanceLabel).toBe('10K'))
})

// ─── analyzeRaceGoal — Marathon 3:30:00 → 3:00:00 ───────────────────────────
describe('analyzeRaceGoal — Marathon 3:30:00 → 3:00:00', () => {
  const current = 3 * 3600 + 30 * 60  // 12600s
  const goal    = 3 * 3600             // 10800s
  const res     = analyzeRaceGoal(current, goal, 42195, {}, [])

  it('returns non-null', () => expect(res).not.toBeNull())
  it('distanceLabel is Marathon', () => expect(res.distanceLabel).toBe('Marathon'))
  it('currentVdot is positive', () => expect(res.currentVdot).toBeGreaterThan(0))
  it('goalVdot > currentVdot', () => expect(res.goalVdot).toBeGreaterThan(res.currentVdot))
  it('vdotGap is positive', () => expect(res.vdotGap).toBeGreaterThan(0))
  it('weeksToGoal is at least 12', () => expect(res.weeksToGoal).toBeGreaterThanOrEqual(12))
  it('currentTimeSec and goalTimeSec are preserved', () => {
    expect(res.currentTimeSec).toBe(current)
    expect(res.goalTimeSec).toBe(goal)
  })
  it('feasibility is one of the four labels', () => {
    expect(['achievable', 'ambitious', 'stretch', 'extreme']).toContain(res.feasibility)
  })
})

// ─── analyzeRaceGoal — Half Marathon label ───────────────────────────────────
describe('analyzeRaceGoal — Half Marathon label', () => {
  const res = analyzeRaceGoal(90 * 60, 85 * 60, 21097, {}, [])
  it('returns non-null', () => expect(res).not.toBeNull())
  it('distanceLabel is Half Marathon', () => expect(res.distanceLabel).toBe('Half Marathon'))
})

// ─── analyzeRaceGoal — non-standard distance falls back to Xd.xK label ───────
describe('analyzeRaceGoal — non-standard distance (15K)', () => {
  const res = analyzeRaceGoal(70 * 60, 65 * 60, 15000, {}, [])
  it('returns non-null', () => expect(res).not.toBeNull())
  it('distanceLabel contains K', () => expect(res.distanceLabel).toMatch(/K$/))
  it('distanceLabel is 15.0K', () => expect(res.distanceLabel).toBe('15.0K'))
})

// ─── analyzeRaceGoal — profile with lthr set directly (MEASURED) ─────────────
describe('analyzeRaceGoal — profile with lthr set directly', () => {
  const res = analyzeRaceGoal(CURRENT, GOAL, DIST, { lthr: 158 }, [])
  it('returns non-null', () => expect(res).not.toBeNull())
  it('lthr is MEASURED when profile.lthr is set', () => {
    expect(res.predicted.lthr?.label).toBe('MEASURED')
    expect(res.predicted.lthr?.value).toBe(158)
  })
})

// ─── analyzeRaceGoal — checkpoints structure ─────────────────────────────────
describe('analyzeRaceGoal — checkpoints structure', () => {
  const res = analyzeRaceGoal(CURRENT, GOAL, DIST, {}, [])

  it('each checkpoint has block, weeks, vdot, projectedTime', () => {
    for (const cp of res.checkpoints) {
      expect(cp).toHaveProperty('block')
      expect(cp).toHaveProperty('weeks')
      expect(cp).toHaveProperty('vdot')
      expect(cp).toHaveProperty('projectedTime')
    }
  })
  it('checkpoint weeks are multiples of 12', () => {
    for (const cp of res.checkpoints) {
      expect(cp.weeks % 12).toBe(0)
    }
  })
  it('checkpoints are ordered by block ascending', () => {
    for (let i = 1; i < res.checkpoints.length; i++) {
      expect(res.checkpoints[i].block).toBeGreaterThan(res.checkpoints[i - 1].block)
    }
  })
  it('checkpoints vdot are non-decreasing', () => {
    for (let i = 1; i < res.checkpoints.length; i++) {
      expect(res.checkpoints[i].vdot).toBeGreaterThanOrEqual(res.checkpoints[i - 1].vdot)
    }
  })
})

// ─── analyzeRaceGoal — phases TSS ordering ───────────────────────────────────
describe('analyzeRaceGoal — phases TSS ordering', () => {
  const res = analyzeRaceGoal(CURRENT, GOAL, DIST, {}, [])

  it('Base phase TSS < Build phase TSS', () => {
    const base  = res.phases.find(p => p.name === 'Base')
    const build = res.phases.find(p => p.name === 'Build')
    expect(base.tss).toBeLessThan(build.tss)
  })
  it('Taper phase TSS < Base phase TSS', () => {
    const base  = res.phases.find(p => p.name === 'Base')
    const taper = res.phases.find(p => p.name === 'Taper')
    expect(taper.tss).toBeLessThan(base.tss)
  })
  it('Peak phase TSS >= Build phase TSS', () => {
    const build = res.phases.find(p => p.name === 'Build')
    const peak  = res.phases.find(p => p.name === 'Peak')
    expect(peak.tss).toBeGreaterThanOrEqual(build.tss)
  })
  it('all phases have positive weeks', () => {
    for (const p of res.phases) {
      expect(p.weeks).toBeGreaterThan(0)
    }
  })
})

// ─── analyzeRaceGoal — return object does not expose private helpers ──────────
describe('analyzeRaceGoal — private helpers not exported', () => {
  it('module does not export vdotGainPerBlock', async () => {
    const mod = await import('../../../lib/athlete/raceGoalEngine.js')
    expect(mod.vdotGainPerBlock).toBeUndefined()
  })
  it('module does not export fmtPaceStr', async () => {
    const mod = await import('../../../lib/athlete/raceGoalEngine.js')
    expect(mod.fmtPaceStr).toBeUndefined()
  })
})
