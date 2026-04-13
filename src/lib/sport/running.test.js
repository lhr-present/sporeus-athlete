import { describe, it, expect } from 'vitest'
import {
  vdotFromRace, predictRaceTime, trainingPaces, criticalVelocity, raceReadiness,
} from './running.js'

// ── VDOT from race result ─────────────────────────────────────────────────────
describe('vdotFromRace', () => {
  it('returns a VDOT in physiologically plausible range (30–85) for a 5K result', () => {
    // 5K in 20 min → roughly VDOT 48–50
    const vdot = vdotFromRace(5000, 20 * 60)
    expect(vdot).toBeGreaterThan(45)
    expect(vdot).toBeLessThan(55)
  })

  it('faster race time gives higher VDOT', () => {
    const fast = vdotFromRace(5000, 15 * 60)
    const slow = vdotFromRace(5000, 25 * 60)
    expect(fast).toBeGreaterThan(slow)
  })

  it('returns null for invalid inputs', () => {
    expect(vdotFromRace(5000, 0)).toBeNull()
    expect(vdotFromRace(0, 1200)).toBeNull()
    expect(vdotFromRace(-1, 1200)).toBeNull()
  })
})

// ── Race time prediction ──────────────────────────────────────────────────────
describe('predictRaceTime', () => {
  it('predicts a longer time for marathon vs 5K with the same VDOT', () => {
    const vdot  = 50
    const fiveK = predictRaceTime(vdot, 5000)
    const mara  = predictRaceTime(vdot, 42195)
    expect(mara).toBeGreaterThan(fiveK)
  })

  it('VDOT 50 → 5K in physiologically correct range (19–21 min)', () => {
    const t = predictRaceTime(50, 5000)
    expect(t).toBeGreaterThan(19 * 60)
    expect(t).toBeLessThan(21 * 60)
  })

  it('round-trips: vdotFromRace → predictRaceTime returns close-to-original time', () => {
    const original = 20 * 60  // 20 min 5K
    const vdot     = vdotFromRace(5000, original)
    const predicted = predictRaceTime(vdot, 5000)
    // Should be within 5 seconds
    expect(Math.abs(predicted - original)).toBeLessThan(5)
  })

  it('returns null for invalid inputs', () => {
    expect(predictRaceTime(0, 5000)).toBeNull()
    expect(predictRaceTime(50, 0)).toBeNull()
  })

  it('predicts 10K time slower than 5K × 2 (longer relative fatigue)', () => {
    const vdot  = 50
    const fiveK = predictRaceTime(vdot, 5000)
    const tenK  = predictRaceTime(vdot, 10000)
    expect(tenK).toBeGreaterThan(fiveK * 2)
  })
})

// ── Training paces ────────────────────────────────────────────────────────────
describe('trainingPaces', () => {
  it('returns paces object with E, M, T, I, R zones', () => {
    const paces = trainingPaces(50)
    expect(paces).not.toBeNull()
    expect(typeof paces.E).toBe('number')
    expect(typeof paces.M).toBe('number')
    expect(typeof paces.T).toBe('number')
    expect(typeof paces.I).toBe('number')
    expect(typeof paces.R).toBe('number')
  })

  it('pace hierarchy: E > M > T > I > R (slower to faster, sec/km)', () => {
    const paces = trainingPaces(50)
    expect(paces.E).toBeGreaterThan(paces.M)
    expect(paces.M).toBeGreaterThan(paces.T)
    expect(paces.T).toBeGreaterThan(paces.I)
    expect(paces.I).toBeGreaterThan(paces.R)
  })

  it('returns null for VDOT = 0', () => {
    expect(trainingPaces(0)).toBeNull()
  })

  it('higher VDOT gives faster (lower sec/km) paces', () => {
    const p50 = trainingPaces(50)
    const p60 = trainingPaces(60)
    expect(p60.M).toBeLessThan(p50.M)
  })
})

// ── Critical Velocity ─────────────────────────────────────────────────────────
describe('criticalVelocity', () => {
  it('returns CV in m/s and D-prime in meters for 2 valid efforts', () => {
    // 1500m in 5:00 and 3000m in 11:00
    const result = criticalVelocity([
      { distanceM: 1500, timeSec: 5 * 60 },
      { distanceM: 3000, timeSec: 11 * 60 },
    ])
    expect(result).not.toBeNull()
    expect(result.CV).toBeGreaterThan(3)   // >3 m/s is plausible
    expect(result.CV).toBeLessThan(8)
    expect(result.DAna).toBeGreaterThan(0)
    expect(typeof result.CVPaceSecKm).toBe('number')
  })

  it('returns null for fewer than 2 efforts', () => {
    expect(criticalVelocity([{ distanceM: 1500, timeSec: 300 }])).toBeNull()
    expect(criticalVelocity(null)).toBeNull()
  })

  it('CV pace is faster than marathon pace for a typical runner', () => {
    const cv    = criticalVelocity([
      { distanceM: 1500, timeSec: 5 * 60 },
      { distanceM: 3000, timeSec: 11 * 60 },
    ])
    const vdot  = vdotFromRace(1500, 5 * 60)
    const paces = trainingPaces(vdot)
    // CV pace (sec/km) should be faster than marathon pace
    expect(cv.CVPaceSecKm).toBeLessThan(paces.M)
  })
})

// ── Race readiness ────────────────────────────────────────────────────────────
describe('raceReadiness', () => {
  it('returns score between 0 and 100', () => {
    const r = raceReadiness({ recentLog: [], targetDistanceM: 10000, peakWeeklyVolM: 50000, daysToRace: 7 })
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(100)
  })

  it('returns flags array', () => {
    const r = raceReadiness({ recentLog: [], targetDistanceM: 10000 })
    expect(Array.isArray(r.flags)).toBe(true)
  })

  it('higher score with quality sessions present', () => {
    const today = new Date().toISOString().slice(0, 10)
    const makeEntry = (rpe, distM = 10000) => ({
      date: today, type: 'Run', rpe, distanceM: distM,
    })
    const withQuality = raceReadiness({
      recentLog: Array.from({ length: 6 }, () => makeEntry(8)),
      targetDistanceM: 10000,
      peakWeeklyVolM:  60000,
      daysToRace:      14,
    })
    const noQuality = raceReadiness({
      recentLog: Array.from({ length: 6 }, () => makeEntry(4)),
      targetDistanceM: 10000,
      peakWeeklyVolM:  60000,
      daysToRace:      14,
    })
    expect(withQuality.score).toBeGreaterThan(noQuality.score)
  })
})
