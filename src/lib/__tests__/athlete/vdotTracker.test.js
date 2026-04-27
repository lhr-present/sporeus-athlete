// src/lib/__tests__/athlete/vdotTracker.test.js — E85
import { describe, it, expect } from 'vitest'
import { detectVdotFromLog } from '../../athlete/vdotTracker.js'

const TODAY = '2026-04-27'

// Builds a run entry: 10K in given seconds, type 'Run', RPE 6
function run10k(date, durSec, rpe = 6, type = 'Run') {
  return { date, distanceM: 10000, durationSec: durSec, duration: durSec / 60, rpe, type }
}
// 5K using distanceKm variant
function run5k(date, durSec, rpe = 7) {
  return { date, distanceKm: 5, durationSec: durSec, duration: durSec / 60, rpe, type: 'Run' }
}

describe('detectVdotFromLog — edge cases', () => {
  it('returns null for null log', () => expect(detectVdotFromLog(null)).toBeNull())
  it('returns null for empty log', () => expect(detectVdotFromLog([])).toBeNull())
  it('returns null when no distance data', () => {
    const log = [{ date: TODAY, duration: 30, rpe: 6, type: 'Run', durationSec: 1800 }]
    expect(detectVdotFromLog(log, 90, TODAY)).toBeNull()
  })
  it('returns null when all entries are walks (rpe ≤ 3)', () => {
    const log = [run10k(TODAY, 3600, 2)]
    expect(detectVdotFromLog(log, 90, TODAY)).toBeNull()
  })
  it('returns null when distance < 800m', () => {
    const e = { date: TODAY, distanceM: 400, durationSec: 90, duration: 1.5, rpe: 7, type: 'Run' }
    expect(detectVdotFromLog([e], 90, TODAY)).toBeNull()
  })
  it('returns null when duration < 2 min', () => {
    const e = { date: TODAY, distanceM: 1000, durationSec: 100, duration: 1.67, rpe: 8, type: 'Run' }
    expect(detectVdotFromLog([e], 90, TODAY)).toBeNull()
  })
  it('excludes cycling entries by type', () => {
    const e = { date: TODAY, distanceM: 40000, durationSec: 3600, duration: 60, rpe: 7, type: 'Bike Ride' }
    expect(detectVdotFromLog([e], 90, TODAY)).toBeNull()
  })
  it('excludes swim entries by type', () => {
    const e = { date: TODAY, distanceM: 2000, durationSec: 2400, duration: 40, rpe: 7, type: 'Swim' }
    expect(detectVdotFromLog([e], 90, TODAY)).toBeNull()
  })
})

describe('detectVdotFromLog — single entry', () => {
  const result = detectVdotFromLog([run10k(TODAY, 2700, 7)], 90, TODAY)

  it('returns non-null', () => expect(result).not.toBeNull())
  it('has vdot > 0', () => expect(result.vdot).toBeGreaterThan(0))
  it('has date', () => expect(result.date).toBe(TODAY))
  it('distanceKm ≈ 10', () => expect(result.distanceKm).toBe(10))
  it('method is log-detected', () => expect(result.method).toBe('log-detected'))
  it('has confidence', () => expect(['high', 'medium', 'low']).toContain(result.confidence))
  it('has trend array', () => expect(Array.isArray(result.trend)).toBe(true))
  it('trend has at least 1 entry', () => expect(result.trend.length).toBeGreaterThanOrEqual(1))
  it('candidateCount is 1', () => expect(result.candidateCount).toBe(1))
})

describe('detectVdotFromLog — confidence levels', () => {
  it('race entry → high confidence', () => {
    const e = { date: TODAY, distanceM: 10000, durationSec: 2700, duration: 45, rpe: 9, type: 'Race' }
    const r = detectVdotFromLog([e], 90, TODAY)
    expect(r.confidence).toBe('high')
  })
  it('≥5K non-race → medium confidence', () => {
    const r = detectVdotFromLog([run10k(TODAY, 2700)], 90, TODAY)
    expect(r.confidence).toBe('medium')
  })
  it('short run <5K → low confidence', () => {
    const e = { date: TODAY, distanceM: 2000, durationSec: 600, duration: 10, rpe: 7, type: 'Run' }
    const r = detectVdotFromLog([e], 90, TODAY)
    expect(r.confidence).toBe('low')
  })
})

describe('detectVdotFromLog — best recent', () => {
  // Two entries: an old great run and a recent mediocre run
  const oldBest   = run10k('2025-01-01', 2400, 7)   // 40:00 10K — great
  const recentMed = run10k(TODAY, 3000, 6)            // 50:00 10K — mediocre

  it('prefers recent over older faster run within daysBack window', () => {
    const r = detectVdotFromLog([oldBest, recentMed], 90, TODAY)
    // Recent pool only has recentMed, so best = recentMed
    expect(r.vdot).toBeLessThan(50)   // 50:00/10K → VDOT ~33
  })
  it('falls back to all-time best when no recent entries', () => {
    const r = detectVdotFromLog([oldBest], 90, TODAY)
    // oldBest is outside 90-day window, so uses all candidates
    expect(r.vdot).toBeGreaterThan(40)  // 40:00/10K → VDOT ~48
  })
})

describe('detectVdotFromLog — distance field variants', () => {
  it('reads distanceKm field', () => {
    const r = detectVdotFromLog([run5k(TODAY, 1500)], 90, TODAY)
    expect(r).not.toBeNull()
    expect(r.distanceKm).toBe(5)
  })
  it('reads legacy distance (km) field', () => {
    const e = { date: TODAY, distance: 10, durationSec: 3000, duration: 50, rpe: 7, type: 'Run' }
    const r = detectVdotFromLog([e], 90, TODAY)
    expect(r).not.toBeNull()
    expect(r.distanceKm).toBe(10)
  })
})

describe('detectVdotFromLog — trend', () => {
  // Build 14 entries over time
  const entries = Array.from({ length: 14 }, (_, i) => {
    const d = new Date('2026-01-01T12:00:00Z')
    d.setUTCDate(d.getUTCDate() + i * 7)
    return run10k(d.toISOString().slice(0, 10), 3000 - i * 10, 7)
  })

  const r = detectVdotFromLog(entries, 365, TODAY)

  it('trend length capped at 12', () => expect(r.trend.length).toBeLessThanOrEqual(12))
  it('trend entries have date, vdot, isRace, distanceKm', () => {
    for (const t of r.trend) {
      expect(typeof t.date).toBe('string')
      expect(t.vdot).toBeGreaterThan(0)
      expect(typeof t.isRace).toBe('boolean')
    }
  })
  it('trend is in chronological order', () => {
    const dates = r.trend.map(t => t.date)
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] >= dates[i - 1]).toBe(true)
    }
  })
})
