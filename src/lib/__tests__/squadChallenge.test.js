// ─── squadChallenge.test.js ────────────────────────────────────────────────────
import { describe, it, expect, beforeAll } from 'vitest'
import { createChallenge, computeAthleteProgress, rankAthletes } from '../squadChallenge.js'

// Polyfill crypto.randomUUID for jsdom environment
beforeAll(() => {
  if (typeof globalThis.crypto === 'undefined') {
    globalThis.crypto = {
      randomUUID: () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = Math.random() * 16 | 0
          const v = c === 'x' ? r : (r & 0x3 | 0x8)
          return v.toString(16)
        })
      }
    }
  } else if (typeof globalThis.crypto.randomUUID === 'undefined') {
    globalThis.crypto.randomUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
      })
    }
  }
})

// ── createChallenge ────────────────────────────────────────────────────────────
describe('createChallenge', () => {
  it('returns an object with all required fields including a uuid id', () => {
    const challenge = createChallenge({
      title: 'Run 200km in May',
      metric: 'distance',
      targetValue: 200,
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    })
    expect(challenge).toMatchObject({
      title: 'Run 200km in May',
      metric: 'distance',
      targetValue: 200,
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    })
    expect(typeof challenge.id).toBe('string')
    // UUID v4 pattern
    expect(challenge.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    expect(typeof challenge.createdAt).toBe('string')
  })
})

// ── computeAthleteProgress — distance ─────────────────────────────────────────
describe('computeAthleteProgress — distance metric', () => {
  it('sums session distances that fall within the challenge date range', () => {
    const challenge = {
      metric: 'distance',
      targetValue: 100,
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    }
    const sessions = [
      { date: '2026-05-10', distance: 20 },
      { date: '2026-05-20', distance: 30 },
      { date: '2026-04-30', distance: 50 }, // outside range — should be ignored
    ]
    const result = computeAthleteProgress(sessions, challenge)
    expect(result.value).toBe(50)
    expect(result.pct).toBe(50)
  })
})

// ── computeAthleteProgress — sessions ─────────────────────────────────────────
describe('computeAthleteProgress — sessions metric', () => {
  it('counts sessions that fall within the challenge date range', () => {
    const challenge = {
      metric: 'sessions',
      targetValue: 20,
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    }
    const sessions = [
      { date: '2026-05-05' },
      { date: '2026-05-12' },
      { date: '2026-05-19' },
      { date: '2026-06-01' }, // outside — ignored
    ]
    const result = computeAthleteProgress(sessions, challenge)
    expect(result.value).toBe(3)
    expect(result.pct).toBe(15)
  })
})

// ── computeAthleteProgress — pct capped at 100 ────────────────────────────────
describe('computeAthleteProgress — pct cap', () => {
  it('caps pct at 100 when athlete exceeds the target', () => {
    const challenge = {
      metric: 'distance',
      targetValue: 10,
      startDate: '2026-05-01',
      endDate: '2026-05-31',
    }
    const sessions = [
      { date: '2026-05-05', distance: 15 },
    ]
    const result = computeAthleteProgress(sessions, challenge)
    expect(result.value).toBe(15)
    expect(result.pct).toBe(100)
  })
})

// ── rankAthletes ───────────────────────────────────────────────────────────────
describe('rankAthletes', () => {
  it('sorts descending by value and assigns correct rank numbers', () => {
    const list = [
      { athleteId: 'a1', name: 'Alice', value: 80 },
      { athleteId: 'a2', name: 'Bob',   value: 120 },
      { athleteId: 'a3', name: 'Carol', value: 40 },
    ]
    const ranked = rankAthletes(list)
    expect(ranked[0]).toMatchObject({ athleteId: 'a2', rank: 1 })
    expect(ranked[1]).toMatchObject({ athleteId: 'a1', rank: 2 })
    expect(ranked[2]).toMatchObject({ athleteId: 'a3', rank: 3 })
  })
})
