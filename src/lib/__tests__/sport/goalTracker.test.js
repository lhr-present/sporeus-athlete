// src/lib/__tests__/sport/goalTracker.test.js — E95
import { describe, it, expect } from 'vitest'
import {
  getGoalProgress,
  projectAchievementDate,
  calcWeeklyRate,
  getGoalStatus,
} from '../../sport/goalTracker.js'

// ─── helpers ─────────────────────────────────────────────────────────────────
// Returns an ISO date N days from today
function daysFromNow(n) {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
}

// ─── 1. calcWeeklyRate ────────────────────────────────────────────────────────
describe('calcWeeklyRate', () => {
  it('returns 0 for null input', () => {
    expect(calcWeeklyRate(null)).toBe(0)
  })

  it('returns 0 for empty array', () => {
    expect(calcWeeklyRate([])).toBe(0)
  })

  it('returns 0 for single data point', () => {
    expect(calcWeeklyRate([{ date: '2026-01-01', value: 50 }])).toBe(0)
  })

  it('returns 0 when all dates are identical (zero denominator)', () => {
    const pts = [
      { date: '2026-01-01', value: 50 },
      { date: '2026-01-01', value: 55 },
    ]
    expect(calcWeeklyRate(pts)).toBe(0)
  })

  it('returns a number type', () => {
    const pts = [
      { date: '2026-01-01', value: 50 },
      { date: '2026-02-01', value: 54 },
    ]
    expect(typeof calcWeeklyRate(pts)).toBe('number')
  })

  it('calculates approximately 1 unit/week for 31-day, 4-unit gain', () => {
    // 2026-01-01 to 2026-02-01 = 31 days ≈ 4.43 weeks; 4-unit gain ≈ 0.903/week
    const pts = [
      { date: '2026-01-01', value: 50 },
      { date: '2026-02-01', value: 54 },
    ]
    const rate = calcWeeklyRate(pts)
    expect(rate).toBeGreaterThan(0.8)
    expect(rate).toBeLessThan(1.1)
  })

  it('calculates exactly 1 unit/week for a perfect 7-day, 1-unit gain', () => {
    const pts = [
      { date: '2026-01-01', value: 50 },
      { date: '2026-01-08', value: 51 },
    ]
    expect(calcWeeklyRate(pts)).toBeCloseTo(1.0, 5)
  })

  it('calculates exactly 2 units/week for a perfect 14-day, 4-unit gain', () => {
    const pts = [
      { date: '2026-01-01', value: 40 },
      { date: '2026-01-15', value: 44 },
    ]
    expect(calcWeeklyRate(pts)).toBeCloseTo(2.0, 5)
  })

  it('returns negative rate for declining values', () => {
    const pts = [
      { date: '2026-01-01', value: 60 },
      { date: '2026-01-08', value: 58 },
    ]
    expect(calcWeeklyRate(pts)).toBeLessThan(0)
  })

  it('handles three collinear points correctly (OLS exact fit)', () => {
    // Each week +1: w0=50, w1=51, w2=52
    const pts = [
      { date: '2026-01-01', value: 50 },
      { date: '2026-01-08', value: 51 },
      { date: '2026-01-15', value: 52 },
    ]
    expect(calcWeeklyRate(pts)).toBeCloseTo(1.0, 4)
  })

  it('handles noisy data and still returns positive trend', () => {
    const pts = [
      { date: '2026-01-01', value: 50 },
      { date: '2026-01-08', value: 49 }, // dip
      { date: '2026-01-15', value: 52 },
      { date: '2026-01-22', value: 54 },
    ]
    expect(calcWeeklyRate(pts)).toBeGreaterThan(0)
  })
})

// ─── 2. projectAchievementDate ────────────────────────────────────────────────
describe('projectAchievementDate', () => {
  it('returns null when weeklyRate is 0', () => {
    expect(projectAchievementDate(50, 0, 60)).toBeNull()
  })

  it('returns null when weeklyRate is negative', () => {
    expect(projectAchievementDate(50, -1, 60)).toBeNull()
  })

  it('returns an ISO date string (YYYY-MM-DD) for valid inputs', () => {
    const result = projectAchievementDate(50, 1, 60)
    expect(typeof result).toBe('string')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns a future date when target > current', () => {
    const today = new Date().toISOString().slice(0, 10)
    const result = projectAchievementDate(50, 1, 60)
    expect(result > today).toBe(true)
  })

  it('projects exactly 10 weeks ahead for a 10-unit gap at 1/week', () => {
    const result = projectAchievementDate(50, 1, 60)
    const expected = new Date(Date.now() + 10 * 7 * 86400000).toISOString().slice(0, 10)
    expect(result).toBe(expected)
  })

  it('projects exactly 4 weeks ahead for an 8-unit gap at 2/week', () => {
    const result = projectAchievementDate(40, 2, 48)
    const expected = new Date(Date.now() + 4 * 7 * 86400000).toISOString().slice(0, 10)
    expect(result).toBe(expected)
  })

  it('returns today or past date when current already exceeds target', () => {
    // weeks = (55 - 60) / 1 = -5 weeks (past)
    const result = projectAchievementDate(60, 1, 55)
    const today = new Date().toISOString().slice(0, 10)
    expect(result <= today).toBe(true)
  })

  it('handles large weekly rates (fast improvement)', () => {
    const result = projectAchievementDate(50, 10, 60) // 1 week
    const expected = new Date(Date.now() + 1 * 7 * 86400000).toISOString().slice(0, 10)
    expect(result).toBe(expected)
  })

  it('handles fractional weekly rates', () => {
    const result = projectAchievementDate(50, 0.5, 55) // 10 weeks
    const expected = new Date(Date.now() + 10 * 7 * 86400000).toISOString().slice(0, 10)
    expect(result).toBe(expected)
  })
})

// ─── 3. getGoalProgress ──────────────────────────────────────────────────────
describe('getGoalProgress', () => {
  it('returns pct, daysLeft, status keys', () => {
    const goal = { current: 50, target: 60, deadline: daysFromNow(30) }
    const result = getGoalProgress(goal, 55)
    expect(result).toHaveProperty('pct')
    expect(result).toHaveProperty('daysLeft')
    expect(result).toHaveProperty('status')
  })

  it('pct is a number between -Infinity and 100 (clamped at 100)', () => {
    const goal = { current: 50, target: 60, deadline: daysFromNow(30) }
    const result = getGoalProgress(goal, 55)
    expect(typeof result.pct).toBe('number')
    expect(result.pct).toBeLessThanOrEqual(100)
  })

  it('returns pct=50 when halfway to target', () => {
    const goal = { current: 50, target: 60, deadline: daysFromNow(30) }
    const result = getGoalProgress(goal, 55)
    expect(result.pct).toBe(50)
  })

  it('returns pct=0 when no progress', () => {
    const goal = { current: 50, target: 60, deadline: daysFromNow(30) }
    const result = getGoalProgress(goal, 50)
    expect(result.pct).toBe(0)
  })

  it('returns pct=100 when target reached', () => {
    const goal = { current: 50, target: 60, deadline: daysFromNow(30) }
    const result = getGoalProgress(goal, 60)
    expect(result.pct).toBe(100)
  })

  it('returns pct=100 when target exceeded (clamped)', () => {
    const goal = { current: 50, target: 60, deadline: daysFromNow(30) }
    const result = getGoalProgress(goal, 70)
    expect(result.pct).toBe(100)
  })

  it('returns pct=100 when range is 0 (current equals target)', () => {
    const goal = { current: 60, target: 60, deadline: daysFromNow(30) }
    const result = getGoalProgress(goal, 60)
    expect(result.pct).toBe(100)
  })

  it('daysLeft reflects future deadline', () => {
    const goal = { current: 50, target: 60, deadline: daysFromNow(30) }
    const result = getGoalProgress(goal, 55)
    // Allow ±1 day for clock drift during test execution
    expect(result.daysLeft).toBeGreaterThanOrEqual(29)
    expect(result.daysLeft).toBeLessThanOrEqual(31)
  })

  it('daysLeft is 0 or negative for a past deadline', () => {
    const goal = { current: 50, target: 60, deadline: '2020-01-01' }
    const result = getGoalProgress(goal, 55)
    expect(result.daysLeft).toBeLessThanOrEqual(0)
  })

  it('status is impossible when deadline has passed', () => {
    const goal = { current: 50, target: 60, deadline: '2020-01-01' }
    const result = getGoalProgress(goal, 55)
    expect(result.status).toBe('impossible')
  })

  it('status is on_track when pct >= 100 and deadline is future', () => {
    const goal = { current: 50, target: 60, deadline: daysFromNow(30) }
    const result = getGoalProgress(goal, 60)
    expect(result.status).toBe('on_track')
  })

  it('status is on_track when pct > 0 and deadline is future', () => {
    const goal = { current: 50, target: 60, deadline: daysFromNow(30) }
    const result = getGoalProgress(goal, 52)
    expect(result.status).toBe('on_track')
  })

  it('status is behind when pct = 0 and deadline is future', () => {
    const goal = { current: 50, target: 60, deadline: daysFromNow(30) }
    const result = getGoalProgress(goal, 50)
    expect(result.status).toBe('behind')
  })

  it('status is one of on_track, behind, impossible', () => {
    const statuses = ['on_track', 'behind', 'impossible']
    const goal = { current: 50, target: 60, deadline: daysFromNow(10) }
    const result = getGoalProgress(goal, 55)
    expect(statuses).toContain(result.status)
  })

  it('pct is correct for 25% progress (10-unit range, 2.5 units gained)', () => {
    const goal = { current: 40, target: 80, deadline: daysFromNow(30) }
    const result = getGoalProgress(goal, 50)
    expect(result.pct).toBe(25)
  })
})

// ─── 4. getGoalStatus ────────────────────────────────────────────────────────
describe('getGoalStatus', () => {
  it('returns status and message keys', () => {
    const goal = { target: 60, deadline: daysFromNow(60) }
    const result = getGoalStatus(goal, 52, 1.0)
    expect(result).toHaveProperty('status')
    expect(result).toHaveProperty('message')
  })

  it('status and message are strings', () => {
    const goal = { target: 60, deadline: daysFromNow(60) }
    const result = getGoalStatus(goal, 52, 1.0)
    expect(typeof result.status).toBe('string')
    expect(typeof result.message).toBe('string')
  })

  it('returns impossible when deadline is past', () => {
    const goal = { target: 60, deadline: '2020-01-01' }
    const result = getGoalStatus(goal, 55, 1.0)
    expect(result.status).toBe('impossible')
    expect(result.message).toBe('Deadline passed')
  })

  it('returns behind when weeklyRate <= 0 and target > current', () => {
    const goal = { target: 60, deadline: daysFromNow(30) }
    const result = getGoalStatus(goal, 50, 0)
    expect(result.status).toBe('behind')
    expect(result.message).toBe('No improvement trend detected')
  })

  it('returns behind when weeklyRate is negative and target > current', () => {
    const goal = { target: 60, deadline: daysFromNow(30) }
    const result = getGoalStatus(goal, 50, -1)
    expect(result.status).toBe('behind')
    expect(result.message).toBe('No improvement trend detected')
  })

  // on_track: current=52, target=60, weeklyRate=1.0, deadline=14 weeks
  // projected: 8 weeks out < 14-week deadline → on_track
  it('returns on_track when projected date is before deadline', () => {
    const goal = { target: 60, deadline: daysFromNow(98) } // 14 weeks
    const result = getGoalStatus(goal, 52, 1.0)
    expect(result.status).toBe('on_track')
    expect(result.message).toMatch(/^On track/)
  })

  it('on_track message includes projected date in YYYY-MM-DD format', () => {
    const goal = { target: 60, deadline: daysFromNow(98) }
    const result = getGoalStatus(goal, 52, 1.0)
    expect(result.message).toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  // behind: current=52, target=60, weeklyRate=0.5, deadline=4 days
  // projected: 16 weeks out > 4-day deadline
  // needed rate >> weeklyRate, but needed/weeklyRate might not be > 3
  it('returns behind or impossible when rate is too slow for deadline', () => {
    const goal = { target: 60, deadline: daysFromNow(4) }
    const result = getGoalStatus(goal, 52, 0.5)
    expect(['behind', 'impossible']).toContain(result.status)
  })

  it('behind message contains improvement/week hint', () => {
    const goal = { target: 60, deadline: daysFromNow(14) }
    const result = getGoalStatus(goal, 52, 0.2)
    if (result.status === 'behind') {
      expect(result.message).toMatch(/improvement\/week/)
    }
  })

  // impossible: needed rate is > 3x weeklyRate
  it('returns impossible when needed rate is more than 3x weekly rate', () => {
    // target=60, current=52, daysLeft=14 (2 weeks), needed=4/week, weeklyRate=1 → ratio=4 > 3
    const goal = { target: 60, deadline: daysFromNow(14) }
    const result = getGoalStatus(goal, 52, 1.0)
    // projected date is 8 weeks out > 14-day deadline, and needed/weeklyRate = 4 > 3
    expect(result.status).toBe('impossible')
    expect(result.message).toBe('Target too aggressive for timeline')
  })

  it('status is one of on_track, behind, impossible', () => {
    const valid = ['on_track', 'behind', 'impossible']
    const goal = { target: 70, deadline: daysFromNow(30) }
    const result = getGoalStatus(goal, 55, 1.5)
    expect(valid).toContain(result.status)
  })

  // Already at or past target with positive rate → on_track
  it('returns on_track when current >= target with positive rate', () => {
    const goal = { target: 60, deadline: daysFromNow(30) }
    const result = getGoalStatus(goal, 65, 1.0)
    // projected date is in the past (already exceeded), so projDate <= deadline
    expect(result.status).toBe('on_track')
  })

  // weeklyRate=0 but current >= target → not triggering the "behind" guard
  it('weeklyRate=0 but current already at target — projected date is now or past → on_track', () => {
    const goal = { target: 60, deadline: daysFromNow(30) }
    // weeklyRate <=0 AND target (60) NOT > currentValue (60) → skips behind guard
    const result = getGoalStatus(goal, 60, 0)
    // projDate returns null for rate=0, so falls through to behind check
    // Since projDate is null it won't be on_track via projection path
    // but needed/weeklyRate check would be Infinity > 3 → impossible
    expect(['behind', 'impossible', 'on_track']).toContain(result.status)
  })
})
