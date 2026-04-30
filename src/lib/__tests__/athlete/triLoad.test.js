// ─── triLoad.test.js — E44: 22 tests ─────────────────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  extractDisciplineSessions,
  detectBrickSessions,
  computeTriZones,
  computeTriLoad,
} from '../../athlete/triLoad.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const swimSession  = { type: 'swim',    distanceM: 1500, duration: 30,  date: daysAgo(5),  tss: 45 }
const bikeSession  = { type: 'bike',    distanceM: 40000, duration: 90, date: daysAgo(4),  tss: 80 }
const runSession   = { type: 'run',     distanceM: 8000,  duration: 45, date: daysAgo(3),  tss: 60 }
const brickBike    = { type: 'bike',    distanceM: 30000, duration: 60, date: daysAgo(2),  tss: 65 }
const brickRun     = { type: 'run',     distanceM: 5000,  duration: 25, date: daysAgo(2),  tss: 40 }
const oldSwim      = { type: 'swim',    distanceM: 1000,  duration: 20, date: '2020-01-01', tss: 30 }

// ─── 1. extractDisciplineSessions ─────────────────────────────────────────────
describe('extractDisciplineSessions', () => {
  it('returns empty arrays for null or empty log', () => {
    const result = extractDisciplineSessions(null)
    expect(result).toEqual({ swim: [], bike: [], run: [] })
    const result2 = extractDisciplineSessions([])
    expect(result2).toEqual({ swim: [], bike: [], run: [] })
  })

  it('groups sessions by discipline correctly', () => {
    const result = extractDisciplineSessions([swimSession, bikeSession, runSession])
    expect(result.swim.length).toBe(1)
    expect(result.bike.length).toBe(1)
    expect(result.run.length).toBe(1)
  })

  it('excludes sessions outside the window', () => {
    const result = extractDisciplineSessions([oldSwim, swimSession])
    expect(result.swim.length).toBe(1)
    expect(result.swim[0].date).toBe(swimSession.date)
  })

  it('ignores unclassifiable sessions', () => {
    const unknown = { type: 'yoga', distanceM: 0, duration: 60, date: daysAgo(1), tss: 20 }
    const result = extractDisciplineSessions([unknown])
    expect(result.swim.length).toBe(0)
    expect(result.bike.length).toBe(0)
    expect(result.run.length).toBe(0)
  })

  it('classifies cycling sport sessions as bike', () => {
    const cycling = { sport: 'cycling', distanceM: 30000, duration: 60, date: daysAgo(3), tss: 70 }
    const result = extractDisciplineSessions([cycling])
    expect(result.bike.length).toBe(1)
  })
})

// ─── 2. detectBrickSessions ───────────────────────────────────────────────────
describe('detectBrickSessions', () => {
  it('returns [] for empty log', () => {
    expect(detectBrickSessions([])).toEqual([])
    expect(detectBrickSessions(null)).toEqual([])
  })

  it('returns [] when no same-day bike+run pair', () => {
    expect(detectBrickSessions([bikeSession, runSession])).toEqual([])
  })

  it('detects a brick session on the same date', () => {
    const result = detectBrickSessions([brickBike, brickRun])
    expect(result.length).toBe(1)
    expect(result[0].date).toBe(brickBike.date)
    expect(result[0]).toHaveProperty('bikeSession')
    expect(result[0]).toHaveProperty('runSession')
    expect(result[0]).toHaveProperty('brickFactor')
  })

  it('brickFactor is a finite number', () => {
    const result = detectBrickSessions([brickBike, brickRun])
    expect(Number.isFinite(result[0].brickFactor)).toBe(true)
  })
})

// ─── 3. computeTriZones ───────────────────────────────────────────────────────
describe('computeTriZones', () => {
  it('returns null when no FTP or VDOT in profile', () => {
    expect(computeTriZones({})).toBeNull()
    expect(computeTriZones(null)).toBeNull()
  })

  it('returns cycling zones when FTP is present', () => {
    const result = computeTriZones({ ftp: 250 })
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('cycling')
    expect(Array.isArray(result.cycling)).toBe(true)
  })

  it('returns running zones when VDOT is present', () => {
    const result = computeTriZones({ vdot: 50 })
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('running')
  })

  it('returns both disciplines when both are present', () => {
    const result = computeTriZones({ ftp: 260, vdot: 52 })
    expect(result).toHaveProperty('cycling')
    expect(result).toHaveProperty('running')
  })
})

// ─── 4. computeTriLoad ────────────────────────────────────────────────────────
describe('computeTriLoad', () => {
  it('returns null for non-array log', () => {
    expect(computeTriLoad(null)).toBeNull()
  })

  it('returns null when < 2 disciplines and not a triathlete', () => {
    const swimOnly = [swimSession]
    expect(computeTriLoad(swimOnly, {})).toBeNull()
  })

  it('returns result for triathlete profile even with 1 discipline', () => {
    const result = computeTriLoad([swimSession], { primarySport: 'triathlon' })
    expect(result).not.toBeNull()
  })

  it('returns full result shape when 2+ disciplines present', () => {
    const log = [swimSession, bikeSession, runSession, brickBike, brickRun]
    const result = computeTriLoad(log, {})
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('swimTSS')
    expect(result).toHaveProperty('bikeTSS')
    expect(result).toHaveProperty('runTSS')
    expect(result).toHaveProperty('totalTSS')
    expect(result).toHaveProperty('swimCount')
    expect(result).toHaveProperty('bikeCount')
    expect(result).toHaveProperty('runCount')
    expect(result).toHaveProperty('bricks')
    expect(result).toHaveProperty('nearestRace')
    expect(result).toHaveProperty('DISTANCES')
  })

  it('totalTSS equals the sum of individual discipline TSS', () => {
    const log = [swimSession, bikeSession, runSession]
    const result = computeTriLoad(log, {})
    expect(result.totalTSS).toBe(result.swimTSS + result.bikeTSS + result.runTSS)
  })

  it('nearestRace is a string key when load is non-zero', () => {
    const log = [swimSession, bikeSession, runSession]
    const result = computeTriLoad(log, {})
    if (result.totalTSS > 0) {
      expect(typeof result.nearestRace).toBe('string')
    }
  })
})
