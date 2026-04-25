// ─── triLoad.test.js — 15+ tests for triLoad.js (E44) + computeTriZones (E47) ─
import { describe, it, expect } from 'vitest'
import {
  extractDisciplineSessions,
  detectBrickSessions,
  computeTriLoad,
  computeTriZones,
} from '../../athlete/triLoad.js'
import { TRIATHLON_DISTANCES } from '../../sport/triathlon.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

const today      = new Date().toISOString().slice(0, 10)
const daysAgo    = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

const makeSwim   = (date, tss = 60) => ({ id: `s-${date}`, date, type: 'Swim',    duration: 45, tss, distanceM: 2000 })
const makeBike   = (date, tss = 90) => ({ id: `b-${date}`, date, type: 'Bike',    duration: 60, tss })
const makeRun    = (date, tss = 70) => ({ id: `r-${date}`, date, type: 'Run',     duration: 50, tss, distanceM: 10000 })
const makeCycling= (date, tss = 80) => ({ id: `c-${date}`, date, type: 'Cycling', duration: 60, tss })

// ── sessionSport (tested via extractDisciplineSessions with a single session) ─

describe('sessionSport via extractDisciplineSessions', () => {
  it("type='Swim' → 'swim'", () => {
    const { swim } = extractDisciplineSessions([makeSwim(today)], 1)
    expect(swim).toHaveLength(1)
  })

  it("type='Bike' → 'bike'", () => {
    const { bike } = extractDisciplineSessions([makeBike(today)], 1)
    expect(bike).toHaveLength(1)
  })

  it("type='Run' → 'run'", () => {
    const { run } = extractDisciplineSessions([makeRun(today)], 1)
    expect(run).toHaveLength(1)
  })

  it("type='Cycling' classified as bike", () => {
    const { bike } = extractDisciplineSessions([makeCycling(today)], 1)
    expect(bike).toHaveLength(1)
  })

  it('sport field with swim keyword → swim', () => {
    const s = { id: 'x', date: today, sport: 'Open Water Swimming', duration: 45, tss: 60 }
    const { swim } = extractDisciplineSessions([s], 1)
    expect(swim).toHaveLength(1)
  })

  it('sport field with cycl keyword → bike', () => {
    const s = { id: 'x', date: today, sport: 'Cycling Race', duration: 60, tss: 80 }
    const { bike } = extractDisciplineSessions([s], 1)
    expect(bike).toHaveLength(1)
  })

  it('unknown type → not classified into any discipline', () => {
    const s = { id: 'x', date: today, type: 'Yoga', duration: 30, tss: 20 }
    const { swim, bike, run } = extractDisciplineSessions([s], 1)
    expect(swim.length + bike.length + run.length).toBe(0)
  })
})

// ── extractDisciplineSessions ─────────────────────────────────────────────────

describe('extractDisciplineSessions', () => {
  it('empty log → {swim:[], bike:[], run:[]}', () => {
    const result = extractDisciplineSessions([], 28)
    expect(result).toEqual({ swim: [], bike: [], run: [] })
  })

  it('filters out sessions older than N days', () => {
    const old = makeSwim(daysAgo(40))   // older than 28 days
    const now = makeSwim(daysAgo(5))    // within window
    const { swim } = extractDisciplineSessions([old, now], 28)
    expect(swim).toHaveLength(1)
    expect(swim[0].date).toBe(daysAgo(5))
  })

  it('separates by discipline correctly', () => {
    const log = [
      makeSwim(daysAgo(2)),
      makeBike(daysAgo(3)),
      makeRun(daysAgo(4)),
    ]
    const { swim, bike, run } = extractDisciplineSessions(log, 28)
    expect(swim).toHaveLength(1)
    expect(bike).toHaveLength(1)
    expect(run).toHaveLength(1)
  })
})

// ── detectBrickSessions ───────────────────────────────────────────────────────

describe('detectBrickSessions', () => {
  it('empty log → []', () => {
    expect(detectBrickSessions([], 28)).toEqual([])
  })

  it('returns brick when bike+run on same day', () => {
    const date = daysAgo(3)
    const log  = [makeBike(date, 120), makeRun(date, 50)]
    const bricks = detectBrickSessions(log, 28)
    expect(bricks).toHaveLength(1)
    expect(bricks[0].date).toBe(date)
  })

  it('no brick when only bike session (no matching run)', () => {
    const log = [makeBike(daysAgo(3), 120)]
    expect(detectBrickSessions(log, 28)).toHaveLength(0)
  })

  it('no brick when bike and run on different days', () => {
    const log = [makeBike(daysAgo(3), 120), makeRun(daysAgo(4), 50)]
    expect(detectBrickSessions(log, 28)).toHaveLength(0)
  })

  it('brickFactor > 1.0 for real brick data (bikeTS=120, runDist=10km)', () => {
    const date = daysAgo(3)
    const log  = [makeBike(date, 120), makeRun(date, 50)]
    const bricks = detectBrickSessions(log, 28)
    expect(bricks[0].brickFactor).toBeGreaterThan(1.0)
  })

  it('brickFactor = 1.0 when bikeSession.tss = 0 and run has no distanceM', () => {
    const date  = daysAgo(2)
    const bike  = { id: 'b', date, type: 'Bike', duration: 60, tss: 0 }
    const run   = { id: 'r', date, type: 'Run',  duration: 40 }
    const bricks = detectBrickSessions([bike, run], 28)
    expect(bricks[0].brickFactor).toBe(1.0)
  })
})

// ── computeTriLoad ────────────────────────────────────────────────────────────

describe('computeTriLoad', () => {
  it('returns null when non-triathlete with < 2 disciplines', () => {
    const log = [makeRun(daysAgo(5)), makeRun(daysAgo(10))]
    expect(computeTriLoad(log, {})).toBeNull()
  })

  it('returns null with empty log and non-triathlete profile', () => {
    expect(computeTriLoad([], { primarySport: 'running' })).toBeNull()
  })

  it('returns data for triathlete profile regardless of discipline count', () => {
    const log = [makeRun(daysAgo(5))]
    const result = computeTriLoad(log, { primarySport: 'triathlon' })
    expect(result).not.toBeNull()
  })

  it('swimTSS + bikeTSS + runTSS === totalTSS', () => {
    const log = [makeSwim(daysAgo(2)), makeBike(daysAgo(3)), makeRun(daysAgo(4))]
    const r = computeTriLoad(log, { primarySport: 'triathlon' })
    expect(r.swimTSS + r.bikeTSS + r.runTSS).toBe(r.totalTSS)
  })

  it('sessionCounts match discipline arrays', () => {
    const log = [
      makeSwim(daysAgo(2)), makeSwim(daysAgo(5)),
      makeBike(daysAgo(3)),
      makeRun(daysAgo(4)), makeRun(daysAgo(7)), makeRun(daysAgo(9)),
    ]
    const r = computeTriLoad(log, { primarySport: 'triathlon' })
    expect(r.swimCount).toBe(2)
    expect(r.bikeCount).toBe(1)
    expect(r.runCount).toBe(3)
  })

  it('nearestRace is set when totalTSS > 0', () => {
    const log = [makeSwim(daysAgo(2)), makeBike(daysAgo(3)), makeRun(daysAgo(4))]
    const r = computeTriLoad(log, { primarySport: 'triathlon' })
    expect(r.nearestRace).not.toBeNull()
    expect(['sprint', 'olympic', 'half', 'full']).toContain(r.nearestRace)
  })

  it('nearestRace is null when all TSS values are 0', () => {
    const log = [
      { id: 's', date: daysAgo(2), type: 'Swim', duration: 30, tss: 0 },
      { id: 'b', date: daysAgo(3), type: 'Bike', duration: 60, tss: 0 },
    ]
    const r = computeTriLoad(log, { primarySport: 'triathlon' })
    expect(r.nearestRace).toBeNull()
  })

  it('bricks array is returned', () => {
    const log = [makeSwim(daysAgo(2)), makeBike(daysAgo(3)), makeRun(daysAgo(3))]
    const r = computeTriLoad(log, { primarySport: 'triathlon' })
    expect(Array.isArray(r.bricks)).toBe(true)
  })

  it('bricks detected correctly inside computeTriLoad', () => {
    const date = daysAgo(3)
    const log  = [makeSwim(daysAgo(2)), makeBike(date, 120), makeRun(date, 50)]
    const r = computeTriLoad(log, { primarySport: 'triathlon' })
    expect(r.bricks).toHaveLength(1)
    expect(r.bricks[0].date).toBe(date)
  })

  it('DISTANCES pass-through === TRIATHLON_DISTANCES from triathlon.js', () => {
    const log = [makeSwim(daysAgo(2)), makeBike(daysAgo(3)), makeRun(daysAgo(4))]
    const r = computeTriLoad(log, { primarySport: 'triathlon' })
    expect(r.DISTANCES).toBe(TRIATHLON_DISTANCES)
  })
})

// ── computeTriZones ───────────────────────────────────────────────────────────

describe('computeTriZones', () => {
  it('returns null when profile has no ftp or vdot', () => {
    expect(computeTriZones({})).toBeNull()
    expect(computeTriZones(null)).toBeNull()
    expect(computeTriZones({ ftp: 0, vdot: 0 })).toBeNull()
  })

  it('returns cycling zones when profile.ftp is set', () => {
    const result = computeTriZones({ ftp: 250 })
    expect(result).not.toBeNull()
    expect(Array.isArray(result.cycling)).toBe(true)
    expect(result.cycling.length).toBeGreaterThan(0)
  })

  it('returns running zones when profile.vdot is set', () => {
    const result = computeTriZones({ vdot: 50 })
    expect(result).not.toBeNull()
    expect(Array.isArray(result.running)).toBe(true)
    expect(result.running.length).toBeGreaterThan(0)
  })

  it('returns both cycling and running zones when both ftp and vdot are set', () => {
    const result = computeTriZones({ ftp: 250, vdot: 50 })
    expect(result).not.toBeNull()
    expect(Array.isArray(result.cycling)).toBe(true)
    expect(Array.isArray(result.running)).toBe(true)
  })

  it('cycling zones have minWatts and maxWatts fields', () => {
    const result = computeTriZones({ ftp: 300 })
    const z1 = result.cycling[0]
    expect(z1).toHaveProperty('minWatts')
    expect(z1).toHaveProperty('maxWatts')
    expect(typeof z1.minWatts).toBe('number')
  })

  it('running zones have paceSecKm field', () => {
    const result = computeTriZones({ vdot: 45 })
    const z1 = result.running[0]
    expect(z1).toHaveProperty('paceSecKm')
    expect(typeof z1.paceSecKm).toBe('number')
    expect(z1.paceSecKm).toBeGreaterThan(0)
  })
})

// ── TRIATHLON_DISTANCES spot check ────────────────────────────────────────────

describe('TRIATHLON_DISTANCES', () => {
  it('olympic.swim === 1.5', () => {
    expect(TRIATHLON_DISTANCES.olympic.swim).toBe(1.5)
  })

  it('full.run === 42.2', () => {
    expect(TRIATHLON_DISTANCES.full.run).toBe(42.2)
  })

  it('sprint.typicalTSS.lo === 80', () => {
    expect(TRIATHLON_DISTANCES.sprint.typicalTSS.lo).toBe(80)
  })

  it('half.typicalTSS.hi === 380', () => {
    expect(TRIATHLON_DISTANCES.half.typicalTSS.hi).toBe(380)
  })
})
