// Race-time estimator tests — Riegel 1981 projection.

import { describe, it, expect } from 'vitest'
import {
  estimateRaceTimes,
  riegelProject,
  reliabilityFromRatio,
  RIEGEL_EXPONENT,
  RACE_TARGETS,
} from '../../athlete/raceTimeEstimator.js'

const TODAY = '2026-05-14'

function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function run(daysAgo, distanceKm, durationMin, extra = {}) {
  return {
    date: addDays(TODAY, -daysAgo),
    type: 'Run',
    distanceKm,
    durationMin,
    ...extra,
  }
}

describe('reliabilityFromRatio', () => {
  it('HIGH for ratio <= 2', () => {
    expect(reliabilityFromRatio(1)).toBe('HIGH')
    expect(reliabilityFromRatio(2)).toBe('HIGH')
  })
  it('MEDIUM for 2 < ratio <= 5', () => {
    expect(reliabilityFromRatio(2.1)).toBe('MEDIUM')
    expect(reliabilityFromRatio(4.2195)).toBe('MEDIUM')
    expect(reliabilityFromRatio(5)).toBe('MEDIUM')
  })
  it('LOW for ratio > 5', () => {
    expect(reliabilityFromRatio(5.1)).toBe('LOW')
    expect(reliabilityFromRatio(8.439)).toBe('LOW')
  })
  it('LOW for invalid input', () => {
    expect(reliabilityFromRatio(NaN)).toBe('LOW')
    expect(reliabilityFromRatio(0)).toBe('LOW')
    expect(reliabilityFromRatio(-1)).toBe('LOW')
  })
})

describe('riegelProject', () => {
  it('returns the same time when D2 === D1', () => {
    expect(riegelProject(20, 5, 5)).toBeCloseTo(20, 6)
  })
  it('matches the Riegel formula T2 = T1 * (D2/D1)^1.06', () => {
    // 5K @ 20:00 -> 10K projection
    const projected = riegelProject(20, 5, 10)
    const expected = 20 * Math.pow(10 / 5, RIEGEL_EXPONENT)
    expect(projected).toBeCloseTo(expected, 6)
    // sanity: 20 * 2^1.06 ≈ 41.71
    expect(projected).toBeGreaterThan(41)
    expect(projected).toBeLessThan(42)
  })
  it('returns null for non-positive or non-finite inputs', () => {
    expect(riegelProject(0, 5, 10)).toBeNull()
    expect(riegelProject(20, 0, 10)).toBeNull()
    expect(riegelProject(20, 5, 0)).toBeNull()
    expect(riegelProject(NaN, 5, 10)).toBeNull()
    expect(riegelProject(20, NaN, 10)).toBeNull()
    expect(riegelProject(20, 5, NaN)).toBeNull()
  })
})

describe('estimateRaceTimes — null cases', () => {
  it('returns null for empty log', () => {
    expect(estimateRaceTimes({ log: [], today: TODAY })).toBeNull()
  })
  it('returns null when log is not an array', () => {
    expect(estimateRaceTimes({ log: null, today: TODAY })).toBeNull()
    expect(estimateRaceTimes({ log: undefined, today: TODAY })).toBeNull()
  })
  it('returns null when only non-running entries exist', () => {
    const log = [
      { date: addDays(TODAY, -1), type: 'Cycling', distanceKm: 40, durationMin: 80 },
      { date: addDays(TODAY, -3), type: 'Swim',    distanceKm: 2,  durationMin: 45 },
      { date: addDays(TODAY, -5), type: 'Walk',    distanceKm: 5,  durationMin: 60 },
    ]
    expect(estimateRaceTimes({ log, today: TODAY })).toBeNull()
  })
  it('returns null when all running entries are below the 3km min reference distance', () => {
    const log = [
      run(1, 1.5, 8),
      run(3, 2.0, 11),
      run(7, 2.9, 16),
    ]
    expect(estimateRaceTimes({ log, today: TODAY })).toBeNull()
  })
  it('returns null when runs exist but outside the window', () => {
    // 91 days ago, default window 90
    const log = [run(91, 10, 45)]
    expect(estimateRaceTimes({ log, today: TODAY })).toBeNull()
  })
  it('returns null when runs have no distance or duration', () => {
    const log = [
      { date: addDays(TODAY, -1), type: 'Run', distanceKm: 0,  durationMin: 25 },
      { date: addDays(TODAY, -3), type: 'Run', distanceKm: 5,  durationMin: 0  },
      { date: addDays(TODAY, -5), type: 'Run' },
    ]
    expect(estimateRaceTimes({ log, today: TODAY })).toBeNull()
  })
})

describe('estimateRaceTimes — reference selection', () => {
  it('picks the BEST pace, not the most recent run', () => {
    // recent slow run vs older fast run — fast one should win
    const log = [
      run(1,  10, 60),     // pace 6.0 min/km (slow)
      run(20, 10, 40),     // pace 4.0 min/km (fast)
      run(40, 5,  22.5),   // pace 4.5 min/km
    ]
    const out = estimateRaceTimes({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.reference.distanceKm).toBe(10)
    expect(out.reference.timeMin).toBe(40)
    expect(out.reference.paceMinKm).toBeCloseTo(4.0, 6)
    expect(out.reference.date).toBe(addDays(TODAY, -20))
  })

  it('ignores runs under 3km even if they have the best pace', () => {
    const log = [
      run(1, 1.5, 4.5),   // pace 3.0 min/km (best, but too short)
      run(3, 5,   22.5),  // pace 4.5 min/km
      run(5, 10,  50),    // pace 5.0 min/km
    ]
    const out = estimateRaceTimes({ log, today: TODAY })
    expect(out.reference.distanceKm).toBe(5)
    expect(out.reference.timeMin).toBe(22.5)
  })

  it('detects running via the `sport` field too', () => {
    const log = [
      { date: addDays(TODAY, -2), sport: 'running', distanceKm: 5,  durationMin: 22 },
      { date: addDays(TODAY, -4), sport: 'cycling', distanceKm: 40, durationMin: 80 },
    ]
    const out = estimateRaceTimes({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.reference.distanceKm).toBe(5)
  })

  it('detects running via "Trail Run" / "jog" type names (regex)', () => {
    const log = [
      { date: addDays(TODAY, -2), type: 'Trail Run', distanceKm: 10, durationMin: 55 },
      { date: addDays(TODAY, -4), type: 'Easy Jog',  distanceKm: 5,  durationMin: 28 },
    ]
    const out = estimateRaceTimes({ log, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.reference.distanceKm).toBe(10)
  })
})

describe('estimateRaceTimes — Riegel math', () => {
  it('projects 5K → 10K / HALF / FULL with the Riegel formula', () => {
    // Reference: 5K at 20:00
    const log = [run(2, 5, 20)]
    const out = estimateRaceTimes({ log, today: TODAY })
    expect(out).not.toBeNull()

    const byName = Object.fromEntries(out.projections.map(p => [p.name, p]))
    expect(byName['5K'].projectedMinutes).toBeCloseTo(20, 4)
    expect(byName['10K'].projectedMinutes).toBeCloseTo(
      20 * Math.pow(10 / 5, RIEGEL_EXPONENT), 4,
    )
    expect(byName['HALF'].projectedMinutes).toBeCloseTo(
      20 * Math.pow(21.0975 / 5, RIEGEL_EXPONENT), 4,
    )
    expect(byName['FULL'].projectedMinutes).toBeCloseTo(
      20 * Math.pow(42.195 / 5, RIEGEL_EXPONENT), 4,
    )
  })

  it('returns all four canonical targets', () => {
    const log = [run(2, 5, 20)]
    const out = estimateRaceTimes({ log, today: TODAY })
    expect(out.projections).toHaveLength(4)
    const names = out.projections.map(p => p.name)
    expect(names).toEqual(['5K', '10K', 'HALF', 'FULL'])
  })

  it('exposes the citation', () => {
    const log = [run(2, 5, 20)]
    const out = estimateRaceTimes({ log, today: TODAY })
    expect(out.citation).toBe('Riegel 1981; Daniels 2014')
  })

  it('exports the canonical target list as a public constant', () => {
    expect(RACE_TARGETS.map(t => t.name)).toEqual(['5K', '10K', 'HALF', 'FULL'])
    const byName = Object.fromEntries(RACE_TARGETS.map(t => [t.name, t]))
    expect(byName['5K'].distanceKm).toBe(5)
    expect(byName['10K'].distanceKm).toBe(10)
    expect(byName['HALF'].distanceKm).toBeCloseTo(21.0975, 6)
    expect(byName['FULL'].distanceKm).toBeCloseTo(42.195, 6)
  })
})

describe('estimateRaceTimes — reliability tiers', () => {
  it('5K reference → 5K HIGH, 10K HIGH, HALF MEDIUM, FULL LOW', () => {
    const log = [run(2, 5, 20)]
    const out = estimateRaceTimes({ log, today: TODAY })
    const r = Object.fromEntries(out.projections.map(p => [p.name, p.reliability]))
    // 5K / 5K = 1 → HIGH
    expect(r['5K']).toBe('HIGH')
    // 10K / 5K = 2 → HIGH
    expect(r['10K']).toBe('HIGH')
    // 21.0975 / 5 = 4.2195 → MEDIUM
    expect(r['HALF']).toBe('MEDIUM')
    // 42.195 / 5 = 8.439 → LOW
    expect(r['FULL']).toBe('LOW')
  })

  it('10K reference → HALF MEDIUM, FULL MEDIUM', () => {
    const log = [run(2, 10, 45)]
    const out = estimateRaceTimes({ log, today: TODAY })
    const r = Object.fromEntries(out.projections.map(p => [p.name, p.reliability]))
    expect(r['5K']).toBe('HIGH')      // ratio 0.5 → <=2 → HIGH
    expect(r['10K']).toBe('HIGH')     // ratio 1
    expect(r['HALF']).toBe('MEDIUM')  // ratio 2.10975
    expect(r['FULL']).toBe('MEDIUM')  // ratio 4.2195
  })
})

describe('estimateRaceTimes — calibrated when similar-distance run exists', () => {
  it('promotes HALF to HIGH when a ~21km run is in the window', () => {
    // Best pace is a fast 5K, but there's also a half-marathon-ish run.
    const log = [
      run(2, 5,    20),    // best pace (fastest), reference effort
      run(10, 20,  100),   // 20 km, within +/-20% of 21.0975
    ]
    const out = estimateRaceTimes({ log, today: TODAY })
    expect(out.reference.distanceKm).toBe(5)
    const half = out.projections.find(p => p.name === 'HALF')
    expect(half.reliability).toBe('HIGH')
    // FULL should still be LOW — no similar-distance run for it
    const full = out.projections.find(p => p.name === 'FULL')
    expect(full.reliability).toBe('LOW')
  })

  it('promotes FULL to HIGH when a ~marathon-distance run is in the window', () => {
    const log = [
      run(2, 5,   20),     // reference
      run(20, 40, 200),    // 40 km, within +/-20% of 42.195
    ]
    const out = estimateRaceTimes({ log, today: TODAY })
    const full = out.projections.find(p => p.name === 'FULL')
    expect(full.reliability).toBe('HIGH')
  })

  it('does NOT promote when the similar-distance run is outside +/-20%', () => {
    // 30 km is > +/-20% of both 21.0975 (~25.3 cap) and 42.195 (~33.8 floor) → outside both
    const log = [
      run(2, 5,   20),
      run(20, 30, 165),
    ]
    const out = estimateRaceTimes({ log, today: TODAY })
    const half = out.projections.find(p => p.name === 'HALF')
    const full = out.projections.find(p => p.name === 'FULL')
    expect(half.reliability).toBe('MEDIUM') // unchanged
    expect(full.reliability).toBe('LOW')    // unchanged
  })
})

describe('estimateRaceTimes — window', () => {
  it('respects custom windowDays', () => {
    // Run 45 days ago — outside windowDays=30, inside windowDays=90.
    const log = [run(45, 10, 45)]
    expect(estimateRaceTimes({ log, today: TODAY, windowDays: 30 })).toBeNull()
    const out = estimateRaceTimes({ log, today: TODAY, windowDays: 90 })
    expect(out).not.toBeNull()
    expect(out.reference.distanceKm).toBe(10)
  })
})
