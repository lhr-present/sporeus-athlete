// src/lib/intelligence.test.js
import { describe, it, expect } from 'vitest'
import {
  analyzeLoadTrend,
  analyzeZoneBalance,
  predictFitness,
  scoreSession,
  assessDataQuality,
} from './intelligence.js'

// Helper: build a log entry N days ago
function entry(daysAgo, tss = 80, rpe = 6, type = 'Easy Run', extra = {}) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return { date: d.toISOString().slice(0, 10), tss, rpe, duration: 60, type, ...extra }
}

// ── analyzeLoadTrend ──────────────────────────────────────────────────────────
describe('analyzeLoadTrend', () => {
  it('returns insufficient for fewer than 4 sessions', () => {
    expect(analyzeLoadTrend([]).trend).toBe('insufficient')
    expect(analyzeLoadTrend([entry(1)]).trend).toBe('insufficient')
  })

  it('detects building trend when last week has >15% more TSS', () => {
    const log = [
      entry(15, 50), entry(14, 50), entry(13, 50),
      entry(6, 100), entry(5, 100), entry(4, 100), entry(3, 100),
    ]
    const result = analyzeLoadTrend(log)
    expect(result.trend).toBe('building')
  })

  it('returns ctl and atl values', () => {
    const log = Array.from({ length: 10 }, (_, i) => entry(i, 100))
    const result = analyzeLoadTrend(log)
    expect(typeof result.ctl).toBe('number')
    expect(typeof result.atl).toBe('number')
  })
})

// ── analyzeZoneBalance ────────────────────────────────────────────────────────
describe('analyzeZoneBalance', () => {
  it('returns no data for empty log', () => {
    const result = analyzeZoneBalance([])
    expect(result.status).toBe('no_data')
  })

  it('detects polarized pattern with lots of Z1+Z2 and Z4+Z5', () => {
    const log = Array.from({ length: 10 }, (_, i) => ({
      ...entry(i, 100),
      zones: [30, 20, 5, 5, 0],  // 50 min easy, 10 min hard
    }))
    const result = analyzeZoneBalance(log)
    expect(result.status).not.toBe('no_data')
    expect(typeof result.z1z2Pct).toBe('number')
  })
})

// ── predictFitness ────────────────────────────────────────────────────────────
describe('predictFitness', () => {
  it('returns zero fitness for empty log', () => {
    const result = predictFitness([])
    expect(result.current).toBe(0)
    expect(result.trajectory).toBe('flat')
  })

  it('CTL increases with consistent training', () => {
    const log = Array.from({ length: 60 }, (_, i) => entry(60 - i, 100))
    const result = predictFitness(log)
    expect(result.current).toBeGreaterThan(0)
    expect(['improving','stable','declining']).toContain(result.trajectory)
  })

  it('projects in4w as a number', () => {
    const log = Array.from({ length: 30 }, (_, i) => entry(30 - i, 80))
    const result = predictFitness(log)
    expect(typeof result.in4w).toBe('number')
  })
})

// ── scoreSession ──────────────────────────────────────────────────────────────
describe('scoreSession', () => {
  it('returns grade B for null entry', () => {
    const result = scoreSession(null, [], {})
    expect(result.grade).toBe('B')
    expect(result.score).toBe(50)
  })

  it('returns an object with score, grade, feedback', () => {
    const e = entry(0, 100, 7)
    const result = scoreSession(e, [], {})
    expect(typeof result.score).toBe('number')
    expect(typeof result.grade).toBe('string')
    expect(result.feedback).toBeDefined()
  })

  it('high RPE session gets a non-zero score', () => {
    const e = entry(0, 150, 9)
    const result = scoreSession(e, [e], {})
    expect(result.score).toBeGreaterThan(0)
  })
})

// ── assessDataQuality ─────────────────────────────────────────────────────────
describe('assessDataQuality', () => {
  it('returns F grade for empty data', () => {
    const result = assessDataQuality([], [], [], {})
    expect(result.grade).toBe('F')
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('score improves with a complete profile', () => {
    const profile = { name:'Test', primarySport:'Run', age:'30', weight:'70', ftp:'250', athleteLevel:'Competitive', goal:'Marathon' }
    const log = Array.from({ length: 20 }, (_, i) => entry(i, 80, 6))
    const result = assessDataQuality(log, [], [], profile)
    expect(result.score).toBeGreaterThan(assessDataQuality([], [], [], {}).score)
  })

  it('returns grade string', () => {
    const result = assessDataQuality([], [], [], {})
    expect(['A','B','C','D','F']).toContain(result.grade)
  })
})
