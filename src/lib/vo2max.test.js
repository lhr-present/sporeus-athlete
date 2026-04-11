import { describe, it, expect } from 'vitest'
import {
  vdotFromRace,
  vdotFromPaceHR,
  zonesFromVDOT,
  raceEquivalents,
  estimateVO2maxTrend,
  fmtPaceSec,
} from './vo2max.js'

// ── vdotFromRace ──────────────────────────────────────────────────────────────

describe('vdotFromRace', () => {
  it('5K in 20:00 → VDOT in expected range (~49.8)', () => {
    const v = vdotFromRace(5000, 1200)
    expect(v).not.toBeNull()
    expect(v).toBeGreaterThan(48)
    expect(v).toBeLessThan(52)
  })

  it('10K in 40:00 → same speed longer duration → higher VDOT than 5K/20:00', () => {
    const v5k  = vdotFromRace(5000,  1200)
    const v10k = vdotFromRace(10000, 2400)
    expect(v10k).toBeGreaterThan(v5k)
  })

  it('Marathon 3:30 → VDOT in expected range (~44.6)', () => {
    const v = vdotFromRace(42195, 12600)
    expect(v).not.toBeNull()
    expect(v).toBeGreaterThan(43)
    expect(v).toBeLessThan(47)
  })

  it('Half marathon in reasonable time returns non-null', () => {
    const v = vdotFromRace(21097, 5400)  // 1:30:00
    expect(v).not.toBeNull()
    expect(v).toBeGreaterThan(30)
    expect(v).toBeLessThan(90)
  })

  it('returns null for duration < 3.5 min', () => {
    expect(vdotFromRace(400, 60)).toBeNull()   // 1 min
    expect(vdotFromRace(1000, 180)).toBeNull() // 3 min
  })

  it('returns null for duration > 240 min', () => {
    expect(vdotFromRace(100000, 15000)).toBeNull()  // 250 min
  })

  it('result is a finite number within physiological range', () => {
    const v = vdotFromRace(5000, 1200)
    expect(Number.isFinite(v)).toBe(true)
    expect(v).toBeGreaterThan(20)
    expect(v).toBeLessThan(90)
  })
})

// ── vdotFromPaceHR ────────────────────────────────────────────────────────────

describe('vdotFromPaceHR', () => {
  it('5:00/km (0.3 s/m) at 79% HRmax → valid estimate', () => {
    const v = vdotFromPaceHR(0.3, 150, 190)
    expect(v).not.toBeNull()
    expect(v).toBeGreaterThan(30)
    expect(v).toBeLessThan(90)
  })

  it('returns null when hrFrac < 0.6 (effort too low)', () => {
    expect(vdotFromPaceHR(0.3, 100, 190)).toBeNull()  // hrFrac ≈ 0.53
    expect(vdotFromPaceHR(0.3, 113, 190)).toBeNull()  // hrFrac ≈ 0.59
  })

  it('returns null when avgPaceMs is falsy', () => {
    expect(vdotFromPaceHR(0, 150, 190)).toBeNull()
    expect(vdotFromPaceHR(null, 150, 190)).toBeNull()
  })

  it('higher pace (faster) → higher VO2 demand → higher VDOT estimate at same HR', () => {
    const vSlow = vdotFromPaceHR(0.4, 150, 190)  // 6:40/km
    const vFast = vdotFromPaceHR(0.3, 150, 190)  // 5:00/km
    expect(vFast).toBeGreaterThan(vSlow)
  })
})

// ── zonesFromVDOT ─────────────────────────────────────────────────────────────

describe('zonesFromVDOT', () => {
  it('returns all 5 zones: E, M, T, I, R', () => {
    const z = zonesFromVDOT(50)
    expect(z).toHaveProperty('E')
    expect(z).toHaveProperty('M')
    expect(z).toHaveProperty('T')
    expect(z).toHaveProperty('I')
    expect(z).toHaveProperty('R')
  })

  it('each zone has low and high pace fields', () => {
    const z = zonesFromVDOT(50)
    for (const zone of ['E', 'M', 'T', 'I', 'R']) {
      expect(z[zone]).toHaveProperty('low')
      expect(z[zone]).toHaveProperty('high')
      expect(z[zone].low).toBeGreaterThan(0)
      expect(z[zone].high).toBeGreaterThan(0)
    }
  })

  it('within each zone, slow end (low%) > fast end (high%) in sec/km', () => {
    const z = zonesFromVDOT(50)
    for (const zone of ['E', 'M', 'T', 'I', 'R']) {
      expect(z[zone].low).toBeGreaterThan(z[zone].high)
    }
  })

  it('E zone is slower than R zone (E.low > R.low)', () => {
    const z = zonesFromVDOT(50)
    expect(z.E.low).toBeGreaterThan(z.R.low)
  })

  it('zone order slowest-to-fastest: E > M > T > I > R', () => {
    const z = zonesFromVDOT(50)
    expect(z.E.low).toBeGreaterThan(z.M.low)
    expect(z.M.low).toBeGreaterThan(z.I.low)
    expect(z.I.low).toBeGreaterThan(z.R.low)
  })

  it('zones scale correctly with VDOT (higher VDOT → faster paces)', () => {
    const z40 = zonesFromVDOT(40)
    const z60 = zonesFromVDOT(60)
    // Higher VDOT = faster E pace = lower sec/km
    expect(z60.E.low).toBeLessThan(z40.E.low)
    expect(z60.T.high).toBeLessThan(z40.T.high)
  })
})

// ── raceEquivalents ───────────────────────────────────────────────────────────

describe('raceEquivalents', () => {
  it('returns results for all standard distances', () => {
    const r = raceEquivalents(50)
    expect(r).toHaveProperty('5000')
    expect(r).toHaveProperty('10000')
    expect(r).toHaveProperty('21097')
    expect(r).toHaveProperty('42195')
  })

  it('5K and 10K at VDOT 50 have non-null times', () => {
    const r = raceEquivalents(50)
    expect(r[5000]).not.toBeNull()
    expect(r[10000]).not.toBeNull()
  })

  it('each valid result has time and pace fields', () => {
    const r = raceEquivalents(50)
    expect(r[5000]).toHaveProperty('time')
    expect(r[5000]).toHaveProperty('pace')
    expect(r[5000].time).toBeGreaterThan(0)
    expect(r[5000].pace).toBeGreaterThan(0)
  })

  it('10K time > 5K time (longer race)', () => {
    const r = raceEquivalents(50)
    expect(r[10000].time).toBeGreaterThan(r[5000].time)
  })

  it('marathon time > half marathon time', () => {
    const r = raceEquivalents(50)
    if (r[42195] && r[21097]) {
      expect(r[42195].time).toBeGreaterThan(r[21097].time)
    }
  })

  it('higher VDOT → faster times', () => {
    const r40 = raceEquivalents(40)
    const r60 = raceEquivalents(60)
    if (r40[5000] && r60[5000]) {
      expect(r60[5000].time).toBeLessThan(r40[5000].time)
    }
  })
})

// ── fmtPaceSec ────────────────────────────────────────────────────────────────

describe('fmtPaceSec', () => {
  it('240 sec/km → "4:00/km"', () => {
    expect(fmtPaceSec(240)).toBe('4:00/km')
  })

  it('270 sec/km → "4:30/km"', () => {
    expect(fmtPaceSec(270)).toBe('4:30/km')
  })

  it('300 sec/km → "5:00/km"', () => {
    expect(fmtPaceSec(300)).toBe('5:00/km')
  })

  it('pads seconds to two digits', () => {
    expect(fmtPaceSec(245)).toBe('4:05/km')
  })

  it('360 sec/km → "6:00/km"', () => {
    expect(fmtPaceSec(360)).toBe('6:00/km')
  })
})

// ── estimateVO2maxTrend ───────────────────────────────────────────────────────

describe('estimateVO2maxTrend', () => {
  it('empty log → []', () => {
    expect(estimateVO2maxTrend([])).toEqual([])
    expect(estimateVO2maxTrend(null)).toEqual([])
  })

  it('skips entries with type that does not include "run"', () => {
    const log = [
      { date: '2025-01-15', type: 'bike', distanceM: 5000, durationSec: 1500 },
    ]
    expect(estimateVO2maxTrend(log)).toEqual([])
  })

  it('skips runs shorter than 20 min', () => {
    const log = [
      { date: '2025-01-15', type: 'run', distanceM: 3000, durationSec: 900 }, // 15 min
    ]
    expect(estimateVO2maxTrend(log)).toEqual([])
  })

  it('extracts VDOT from a valid 5K run entry', () => {
    const log = [
      { date: '2025-01-15', type: 'run', distanceM: 5000, durationSec: 1200 },
    ]
    const trend = estimateVO2maxTrend(log)
    expect(trend).toHaveLength(1)
    expect(trend[0].vo2max).toBeGreaterThan(48)
    expect(trend[0].vo2max).toBeLessThan(52)
    expect(trend[0].date).toBe('2025-01-15')
    expect(trend[0]).toHaveProperty('method')
    expect(trend[0]).toHaveProperty('confidence')
  })

  it('groups by ISO week, keeps best confidence per week', () => {
    const log = [
      // Two runs in the same week — second has HR >= 75% so high confidence
      { date: '2025-01-13', type: 'run', distanceM: 5000, durationSec: 1200 },                        // medium
      { date: '2025-01-15', type: 'run', distanceM: 5000, durationSec: 1200, avgHR: 145, maxHR: 190 }, // high
    ]
    const trend = estimateVO2maxTrend(log, 190)
    expect(trend).toHaveLength(1)
    expect(trend[0].confidence).toBe('high')
  })

  it('returns entries sorted chronologically', () => {
    const log = [
      { date: '2025-03-01', type: 'run', distanceM: 5000, durationSec: 1200 },
      { date: '2025-01-01', type: 'run', distanceM: 5000, durationSec: 1200 },
    ]
    const trend = estimateVO2maxTrend(log)
    expect(trend.length).toBeGreaterThanOrEqual(1)
    for (let i = 1; i < trend.length; i++) {
      expect(trend[i].date >= trend[i-1].date).toBe(true)
    }
  })

  it('caps output at 52 entries', () => {
    // Generate 60 runs in different weeks
    const log = []
    for (let w = 0; w < 60; w++) {
      const d = new Date(Date.UTC(2024, 0, 1 + w * 7))
      log.push({
        date: d.toISOString().slice(0, 10),
        type: 'run',
        distanceM: 5000,
        durationSec: 1200,
      })
    }
    const trend = estimateVO2maxTrend(log)
    expect(trend.length).toBeLessThanOrEqual(52)
  })
})
