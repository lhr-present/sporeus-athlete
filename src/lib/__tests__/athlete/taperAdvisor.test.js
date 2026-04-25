// ── tests/athlete/taperAdvisor.test.js — E38 ──────────────────────────────────
import { describe, it, expect } from 'vitest'
import { daysUntil, computeTaperAdvice } from '../../athlete/taperAdvisor.js'

// ── daysUntil ──────────────────────────────────────────────────────────────────
describe('daysUntil', () => {
  it('returns 0 for same date', () => {
    expect(daysUntil('2024-06-01', '2024-06-01')).toBe(0)
  })

  it('returns positive for future date', () => {
    expect(daysUntil('2024-06-10', '2024-06-01')).toBe(9)
  })

  it('returns negative for past date', () => {
    expect(daysUntil('2024-05-25', '2024-06-01')).toBe(-7)
  })

  it('returns null when no date string provided', () => {
    expect(daysUntil(null)).toBeNull()
    expect(daysUntil(undefined)).toBeNull()
    expect(daysUntil('')).toBeNull()
  })

  it('returns 14 for date 14 days out', () => {
    expect(daysUntil('2024-06-15', '2024-06-01')).toBe(14)
  })
})

// ── computeTaperAdvice — null cases ───────────────────────────────────────────
describe('computeTaperAdvice — null cases', () => {
  const today = '2024-06-01'
  const planWith2Weeks = {
    weeks: [
      { start_date: '2024-06-10', sessions: [{ duration: 60, tss: 80 }] },
      { start_date: '2024-06-17', sessions: [{ duration: 60, tss: 80 }] },
    ],
  }

  it('returns null when plan is null', () => {
    expect(computeTaperAdvice(null, { nextRaceDate: '2024-06-15' }, today)).toBeNull()
  })

  it('returns null when plan has no weeks array', () => {
    expect(computeTaperAdvice({}, { nextRaceDate: '2024-06-15' }, today)).toBeNull()
  })

  it('returns null when plan.weeks is empty', () => {
    expect(computeTaperAdvice({ weeks: [] }, { nextRaceDate: '2024-06-15' }, today)).toBeNull()
  })

  it('returns null when no race date in profile', () => {
    expect(computeTaperAdvice(planWith2Weeks, {}, today)).toBeNull()
    expect(computeTaperAdvice(planWith2Weeks, { level: 'trained' }, today)).toBeNull()
  })

  it('returns null when race is already passed', () => {
    expect(computeTaperAdvice(planWith2Weeks, { nextRaceDate: '2024-05-20' }, today)).toBeNull()
  })

  it('returns null when race is more than 90 days away', () => {
    expect(computeTaperAdvice(planWith2Weeks, { nextRaceDate: '2024-09-01' }, today)).toBeNull()
  })
})

// ── computeTaperAdvice — status logic ─────────────────────────────────────────
describe('computeTaperAdvice — status logic', () => {
  const plan = {
    weeks: [
      { start_date: '2024-06-17', sessions: [{ duration: 60, tss: 80 }] },
      { start_date: '2024-06-24', sessions: [{ duration: 60, tss: 80 }] },
    ],
  }

  it('status is taper_active when race is ≤ 14 days away', () => {
    const result = computeTaperAdvice(plan, { nextRaceDate: '2024-06-10' }, '2024-06-01')
    expect(result).not.toBeNull()
    expect(result.status).toBe('taper_active')
  })

  it('status is taper_soon when race is 15–21 days away', () => {
    const result = computeTaperAdvice(plan, { nextRaceDate: '2024-06-18' }, '2024-06-01')
    expect(result).not.toBeNull()
    expect(result.status).toBe('taper_soon')
  })

  it('status is pre_taper when race is 22–90 days away', () => {
    const result = computeTaperAdvice(plan, { nextRaceDate: '2024-07-15' }, '2024-06-01')
    expect(result).not.toBeNull()
    expect(result.status).toBe('pre_taper')
  })

  it('status is taper_active exactly at 14 days', () => {
    const result = computeTaperAdvice(plan, { nextRaceDate: '2024-06-15' }, '2024-06-01')
    expect(result.status).toBe('taper_active')
  })

  it('status is taper_soon exactly at 21 days', () => {
    const result = computeTaperAdvice(plan, { nextRaceDate: '2024-06-22' }, '2024-06-01')
    expect(result.status).toBe('taper_soon')
  })
})

// ── computeTaperAdvice — return shape ─────────────────────────────────────────
describe('computeTaperAdvice — return shape', () => {
  const plan = {
    weeks: [
      { start_date: '2024-06-17', sessions: [{ duration: 60, tss: 80 }] },
    ],
  }
  const profile = { nextRaceDate: '2024-06-20', level: 'trained' }
  const today   = '2024-06-01'

  it('returns all expected fields', () => {
    const result = computeTaperAdvice(plan, profile, today)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('raceDate')
    expect(result).toHaveProperty('daysUntilRace')
    expect(result).toHaveProperty('taperStartDate')
    expect(result).toHaveProperty('cutPct')
    expect(result).toHaveProperty('cutPctDisplay')
    expect(result).toHaveProperty('level')
    expect(result).toHaveProperty('taperedWeeks')
    expect(result).toHaveProperty('daysUntilTaperStart')
    expect(result).toHaveProperty('status')
    expect(result).toHaveProperty('citation')
  })

  it('taperStartDate is 14 days before race', () => {
    const result = computeTaperAdvice(plan, profile, today)
    expect(result.taperStartDate).toBe('2024-06-06')
  })

  it('citation contains Mujika', () => {
    const result = computeTaperAdvice(plan, profile, today)
    expect(result.citation).toMatch(/Mujika/)
  })

  it('cutPctDisplay is a percentage string', () => {
    const result = computeTaperAdvice(plan, profile, today)
    expect(result.cutPctDisplay).toMatch(/%$/)
  })

  it('uses raceDate fallback when nextRaceDate is absent', () => {
    const result = computeTaperAdvice(plan, { raceDate: '2024-06-20', level: 'trained' }, today)
    expect(result).not.toBeNull()
    expect(result.raceDate).toBe('2024-06-20')
  })
})
