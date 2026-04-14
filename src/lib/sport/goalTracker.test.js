import { describe, it, expect } from 'vitest'
import {
  getGoalProgress,
  projectAchievementDate,
  calcWeeklyRate,
  getGoalStatus,
} from './goalTracker.js'

describe('getGoalProgress', () => {
  it('returns pct=50 when halfway to target', () => {
    // goal.current=100, goal.target=200, currentValue=150 → pct=50
    const goal = {
      type: 'vo2max',
      current: 100,
      target: 200,
      deadline: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    }
    const result = getGoalProgress(goal, 150)
    expect(result.pct).toBe(50)
  })

  it('returns pct=0 for no improvement (currentValue equals goal.current)', () => {
    const goal = {
      type: 'vo2max',
      current: 100,
      target: 200,
      deadline: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    }
    const result = getGoalProgress(goal, 100)
    expect(result.pct).toBe(0)
  })

  it('caps pct at 100 when currentValue exceeds target', () => {
    const goal = {
      type: 'vo2max',
      current: 100,
      target: 200,
      deadline: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    }
    const result = getGoalProgress(goal, 250)
    expect(result.pct).toBe(100)
  })
})

describe('projectAchievementDate', () => {
  it('returns null when weeklyRate is zero', () => {
    expect(projectAchievementDate(50, 0, 60)).toBeNull()
  })

  it('returns null when weeklyRate is negative', () => {
    expect(projectAchievementDate(50, -1, 60)).toBeNull()
  })

  it('returns a future ISO date string for positive weeklyRate', () => {
    const result = projectAchievementDate(50, 5, 60)
    expect(result).not.toBeNull()
    expect(typeof result).toBe('string')
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // 10 weeks into the future — must be after today
    const today = new Date().toISOString().slice(0, 10)
    expect(result > today).toBe(true)
  })
})

describe('calcWeeklyRate', () => {
  it('returns 0 for fewer than 2 data points', () => {
    expect(calcWeeklyRate([{ date: '2026-01-01', value: 50 }])).toBe(0)
    expect(calcWeeklyRate([])).toBe(0)
    expect(calcWeeklyRate(null)).toBe(0)
  })

  it('returns a positive slope for an ascending data series', () => {
    const dataPoints = [
      { date: '2026-01-01', value: 40 },
      { date: '2026-01-08', value: 45 },
      { date: '2026-01-15', value: 50 },
    ]
    const rate = calcWeeklyRate(dataPoints)
    expect(rate).toBeGreaterThan(0)
    // Each week goes up by 5 → slope should be ~5
    expect(rate).toBeCloseTo(5, 1)
  })
})

describe('getGoalStatus', () => {
  it('returns on_track when projected achievement date is before the deadline', () => {
    // Set a deadline 52 weeks out; target reachable at current rate
    const deadline = new Date(Date.now() + 52 * 7 * 86400000).toISOString().slice(0, 10)
    const goal = {
      type: 'vo2max',
      current: 40,
      target: 60,
      deadline,
    }
    // weeklyRate = 1 → 20 weeks to reach target, well inside 52-week deadline
    const result = getGoalStatus(goal, 40, 1)
    expect(result.status).toBe('on_track')
    expect(result.message).toContain('On track')
  })
})
