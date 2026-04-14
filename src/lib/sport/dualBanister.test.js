// ─── sport/dualBanister.test.js — Dual Banister model tests ────────────────────
import { describe, it, expect } from 'vitest'
import { dualBanister, splitDisciplineLogs } from './simulation.js'

// ── dualBanister ─────────────────────────────────────────────────────────────

describe('dualBanister', () => {
  it('returns empty array for empty logs', () => {
    expect(dualBanister([], [])).toEqual([])
  })

  it('returns a row for each unique date', () => {
    const swimLog    = [{ date: '2026-04-01', tss: 50 }, { date: '2026-04-03', tss: 60 }]
    const bikeRunLog = [{ date: '2026-04-02', tss: 80 }]
    const result = dualBanister(swimLog, bikeRunLog)
    expect(result).toHaveLength(3)
    expect(result.map(r => r.date)).toEqual(['2026-04-01', '2026-04-02', '2026-04-03'])
  })

  it('swim and bikeRun evolve independently', () => {
    const swimLog    = [{ date: '2026-04-01', tss: 100 }]
    const bikeRunLog = [{ date: '2026-04-01', tss: 0   }]
    const result = dualBanister(swimLog, bikeRunLog, { startSwimCTL: 0, startBikeRunCTL: 0 })
    const d = result[0]
    // Swim CTL should be higher than bikeRun CTL after a pure swim day
    expect(d.swimCTL).toBeGreaterThan(d.bikeRunCTL)
  })

  it('combined load equals swimTSS + bikeRunTSS for that day', () => {
    const swimLog    = [{ date: '2026-04-01', tss: 40 }]
    const bikeRunLog = [{ date: '2026-04-01', tss: 60 }]
    const result = dualBanister(swimLog, bikeRunLog)
    expect(result[0].combinedLoad).toBe(100)
  })

  it('swim fatigue decays faster than bikeRun fatigue (τ2 difference)', () => {
    // Build up both channels with TSS, then compare ATL decay rate
    const days = 10
    const swimLog    = Array.from({ length: days }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, '0')}`, tss: 80,
    }))
    const bikeRunLog = Array.from({ length: days }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, '0')}`, tss: 80,
    }))
    const built = dualBanister(swimLog, bikeRunLog, { tau2Swim: 5, tau2BikeRun: 7 })
    const lastBuilt = built[built.length - 1]

    // Now simulate 5 rest days for both (all TSS=0)
    const restSwim    = Array.from({ length: 5 }, (_, i) => ({ date: `2026-04-${String(days + i + 1).padStart(2, '0')}`, tss: 0 }))
    const restBikeRun = restSwim.map(e => ({ ...e }))
    const resting = dualBanister(restSwim, restBikeRun, {
      startSwimATL: lastBuilt.swimATL, startBikeRunATL: lastBuilt.bikeRunATL,
      tau2Swim: 5, tau2BikeRun: 7,
    })

    const lastRest = resting[resting.length - 1]
    // With faster τ2, swim ATL should be lower (more decayed) after rest
    expect(lastRest.swimATL).toBeLessThan(lastRest.bikeRunATL)
  })

  it('TSB equals CTL - ATL for both channels', () => {
    const swimLog    = [{ date: '2026-04-01', tss: 70 }]
    const bikeRunLog = [{ date: '2026-04-01', tss: 90 }]
    const result = dualBanister(swimLog, bikeRunLog)
    const d = result[0]
    expect(d.swimTSB).toBeCloseTo(d.swimCTL - d.swimATL, 0)
    expect(d.bikeRunTSB).toBeCloseTo(d.bikeRunCTL - d.bikeRunATL, 0)
  })

  it('respects startSwimCTL and startBikeRunCTL options', () => {
    const swimLog    = [{ date: '2026-04-01', tss: 0 }]
    const bikeRunLog = [{ date: '2026-04-01', tss: 0 }]
    const result = dualBanister(swimLog, bikeRunLog, { startSwimCTL: 50, startBikeRunCTL: 80 })
    // With zero TSS, CTL should decay slightly from starting values
    expect(result[0].swimCTL).toBeLessThan(50)
    expect(result[0].bikeRunCTL).toBeLessThan(80)
    // But bikeRun should still be higher
    expect(result[0].bikeRunCTL).toBeGreaterThan(result[0].swimCTL)
  })
})

// ── splitDisciplineLogs ───────────────────────────────────────────────────────

describe('splitDisciplineLogs', () => {
  it('splits swim sessions into swimLog', () => {
    const log = [
      { date: '2026-04-01', tss: 50, type: 'Swim' },
      { date: '2026-04-02', tss: 80, type: 'Run'  },
    ]
    const { swimLog, bikeRunLog } = splitDisciplineLogs(log)
    expect(swimLog).toHaveLength(1)
    expect(bikeRunLog).toHaveLength(1)
  })

  it('assigns Ride and Run to bikeRunLog', () => {
    const log = [
      { date: '2026-04-01', tss: 60, type: 'Ride' },
      { date: '2026-04-02', tss: 70, type: 'Running' },
      { date: '2026-04-03', tss: 40, type: 'Swimming' },
    ]
    const { swimLog, bikeRunLog } = splitDisciplineLogs(log)
    expect(swimLog).toHaveLength(1)
    expect(bikeRunLog).toHaveLength(2)
  })

  it('skips entries with zero TSS', () => {
    const log = [{ date: '2026-04-01', tss: 0, type: 'Swim' }]
    const { swimLog } = splitDisciplineLogs(log)
    expect(swimLog).toHaveLength(0)
  })
})
