// src/lib/__tests__/athlete/volumeAcceleration.test.js
//
// Pure-fn tests for analyzeVolumeAcceleration — Vetter 2019 / Bourdon
// 2017 second-derivative-of-TSS detector. The 8-week TSS series we
// inject through helper fns is the SOURCE OF TRUTH for the
// expected band classifications; the offline-verified math is:
//
//   weeks   → deltas (i = 1..7)
//   deltas  → accelerations (i = 0..5)
//   current = mean(accelerations[3..5])
//   prior   = mean(accelerations[0..2])
//
import { describe, it, expect } from 'vitest'
import {
  analyzeVolumeAcceleration,
  VOLUME_ACCELERATION_CITATION,
} from '../../athlete/volumeAcceleration.js'

// Monday 2026-05-18 — `mondayOf(today)` === today
const TODAY = '2026-05-18'

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// Build a log where weeklyTss[i] is delivered as ONE entry on the
// Monday of week i. `weeklyTss[7]` is the newest week (the week
// containing TODAY). Length must be 8.
function buildWeeklyLog(weeklyTss, today = TODAY) {
  if (weeklyTss.length !== 8) {
    throw new Error('weeklyTss must have length 8 in tests')
  }
  const log = []
  // newest Monday === Monday of (week-containing-today). For TODAY
  // = 2026-05-18 (Mon) that's TODAY itself.
  const newestMonday = today
  for (let i = 0; i < 8; i++) {
    // Week 0 = oldest, week 7 = newest.
    const monday = isoMinusDays(newestMonday, (7 - i) * 7)
    log.push({ date: monday, tss: weeklyTss[i] })
  }
  return log
}

describe('analyzeVolumeAcceleration — null / insufficient signals', () => {
  it('returns null for empty log', () => {
    expect(analyzeVolumeAcceleration({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null for invalid today', () => {
    const log = buildWeeklyLog([100, 100, 100, 100, 100, 100, 100, 100])
    expect(analyzeVolumeAcceleration({ log, today: 'not-a-date' })).toBeNull()
  })

  it('returns null for windowWeeks < 4', () => {
    const log = buildWeeklyLog([100, 100, 100, 100, 100, 100, 100, 100])
    expect(
      analyzeVolumeAcceleration({ log, today: TODAY, windowWeeks: 3 })
    ).toBeNull()
  })

  it('returns null when fewer than 7 of 8 weeks have non-zero TSS', () => {
    // Only 5 weeks populated, 3 zeros.
    const log = buildWeeklyLog([0, 0, 0, 100, 110, 120, 130, 140])
    expect(analyzeVolumeAcceleration({ log, today: TODAY })).toBeNull()
  })

  it('returns a result when exactly 7 of 8 weeks have non-zero TSS', () => {
    const log = buildWeeklyLog([0, 100, 110, 120, 130, 140, 150, 160])
    const r = analyzeVolumeAcceleration({ log, today: TODAY })
    expect(r).not.toBeNull()
  })
})

describe('analyzeVolumeAcceleration — band classification', () => {
  it('constant weekly TSS → STEADY (accelerations all 0)', () => {
    const log = buildWeeklyLog([300, 300, 300, 300, 300, 300, 300, 300])
    const r = analyzeVolumeAcceleration({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('STEADY')
    expect(r.currentAcceleration).toBe(0)
    expect(r.priorAcceleration).toBe(0)
    expect(r.accelerations.every(a => a === 0)).toBe(true)
  })

  it('monotonic linear ramp → STEADY (constant deltas, zero acceleration)', () => {
    const log = buildWeeklyLog([100, 200, 300, 400, 500, 600, 700, 800])
    const r = analyzeVolumeAcceleration({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('STEADY')
    expect(r.weekDeltas.every(d => Math.abs(d - 100) < 0.01)).toBe(true)
    expect(r.accelerations.every(a => Math.abs(a) < 0.01)).toBe(true)
  })

  it('quadratic-style growth → COMPOUNDING_RAMP (acceleration +40)', () => {
    // deltas = [20, 60, 100, 140, 180, 220, 260] → accel all = 40
    const log = buildWeeklyLog([200, 220, 280, 380, 520, 700, 920, 1180])
    const r = analyzeVolumeAcceleration({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('COMPOUNDING_RAMP')
    expect(r.currentAcceleration).toBeGreaterThanOrEqual(30)
    expect(r.currentAcceleration).toBeCloseTo(40, 1)
    expect(r.priorAcceleration).toBeCloseTo(40, 1)
  })

  it('ramp-then-plateau series → DECELERATING (acceleration -40)', () => {
    // deltas = [260, 220, 180, 140, 100, 60, 20] → accel all -40
    const log = buildWeeklyLog([100, 360, 580, 760, 900, 1000, 1060, 1080])
    const r = analyzeVolumeAcceleration({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('DECELERATING')
    expect(r.currentAcceleration).toBeLessThanOrEqual(-30)
    expect(r.currentAcceleration).toBeCloseTo(-40, 1)
  })

  it('slight positive accel under threshold → STEADY (|accel| < 30)', () => {
    // Construct deltas with small positive step: deltas = [10, 20, 30, 40, 50, 60, 70]
    // → accel all = 10 → STEADY.
    //   tss[0] = 0 (zero allowed once at oldest), build progressively
    // Better: tss starts at 100 and accumulates each delta.
    let tss = 100
    const series = [tss]
    const deltas = [10, 20, 30, 40, 50, 60, 70]
    for (const d of deltas) {
      tss += d
      series.push(tss)
    }
    const log = buildWeeklyLog(series)
    const r = analyzeVolumeAcceleration({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('STEADY')
    expect(r.currentAcceleration).toBeCloseTo(10, 1)
  })

  it('boundary +30: lands in COMPOUNDING_RAMP (≥)', () => {
    // Build deltas with constant accel = 30
    let tss = 100
    const series = [tss]
    let delta = 10
    for (let i = 0; i < 7; i++) {
      tss += delta
      series.push(tss)
      delta += 30
    }
    const log = buildWeeklyLog(series)
    const r = analyzeVolumeAcceleration({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('COMPOUNDING_RAMP')
    expect(r.currentAcceleration).toBeCloseTo(30, 1)
  })

  it('boundary -30: lands in DECELERATING (≤)', () => {
    let tss = 1000
    const series = [tss]
    let delta = -10
    for (let i = 0; i < 7; i++) {
      tss += delta
      series.push(tss)
      delta -= 30
    }
    const log = buildWeeklyLog(series)
    const r = analyzeVolumeAcceleration({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('DECELERATING')
    expect(r.currentAcceleration).toBeCloseTo(-30, 1)
  })
})

describe('analyzeVolumeAcceleration — shape + metadata', () => {
  it('weeks length === 8 (default windowWeeks), oldest first', () => {
    const log = buildWeeklyLog([100, 110, 120, 130, 140, 150, 160, 170])
    const r = analyzeVolumeAcceleration({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.weeks).toHaveLength(8)
    for (let i = 1; i < r.weeks.length; i++) {
      expect(r.weeks[i].weekStart > r.weeks[i - 1].weekStart).toBe(true)
    }
  })

  it('weekDeltas length === 7, accelerations length === 6', () => {
    const log = buildWeeklyLog([100, 110, 120, 130, 140, 150, 160, 170])
    const r = analyzeVolumeAcceleration({ log, today: TODAY })
    expect(r.weekDeltas).toHaveLength(7)
    expect(r.accelerations).toHaveLength(6)
  })

  it('weekDeltas[i] equals weeks[i+1].tss - weeks[i].tss', () => {
    const log = buildWeeklyLog([100, 150, 220, 290, 360, 430, 500, 570])
    const r = analyzeVolumeAcceleration({ log, today: TODAY })
    for (let i = 0; i < r.weekDeltas.length; i++) {
      const expected = r.weeks[i + 1].tss - r.weeks[i].tss
      expect(Math.abs(r.weekDeltas[i] - expected)).toBeLessThanOrEqual(0.1)
    }
  })

  it('accelerations[i] equals weekDeltas[i+1] - weekDeltas[i]', () => {
    const log = buildWeeklyLog([100, 150, 220, 290, 360, 430, 500, 570])
    const r = analyzeVolumeAcceleration({ log, today: TODAY })
    for (let i = 0; i < r.accelerations.length; i++) {
      const expected = r.weekDeltas[i + 1] - r.weekDeltas[i]
      expect(Math.abs(r.accelerations[i] - expected)).toBeLessThanOrEqual(0.1)
    }
  })

  it('citation matches Vetter 2019; Bourdon 2017', () => {
    const log = buildWeeklyLog([100, 110, 120, 130, 140, 150, 160, 170])
    const r = analyzeVolumeAcceleration({ log, today: TODAY })
    expect(r.citation).toBe(VOLUME_ACCELERATION_CITATION)
    expect(r.citation).toMatch(/Vetter 2019/)
    expect(r.citation).toMatch(/Bourdon 2017/)
  })

  it('sums daily TSS within an ISO Mon-Sun week into a single weekly bucket', () => {
    // Replace newest-week entry with two intra-week entries; their
    // sum should appear in the newest bucket.
    const log = buildWeeklyLog([100, 110, 120, 130, 140, 150, 160, 0])
    log.push({ date: TODAY, tss: 80 })                                  // Mon
    log.push({ date: isoMinusDays(TODAY, -2), tss: 90 })                // Wed (intra-week)
    const r = analyzeVolumeAcceleration({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.weeks[7].tss).toBeCloseTo(170, 1)
  })
})
