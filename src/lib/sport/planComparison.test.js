import { describe, it, expect } from 'vitest'
import { simulateBanister, peakFormWindow } from './simulation.js'

describe('simulateBanister', () => {
  it('missed week (7 zeros) from a high CTL baseline lowers CTL by end of break', () => {
    // Start with established CTL=60 ATL=60, then 7 rest days → CTL must fall
    const result = simulateBanister([0, 0, 0, 0, 0, 0, 0], 60, 60)
    expect(result[6].CTL).toBeLessThan(60)
  })

  it('returns empty array for empty input', () => {
    expect(simulateBanister([])).toEqual([])
  })

  it('resting from CTL=60 (all zeros, 7 days) → CTL[6] < 60', () => {
    const result = simulateBanister([0, 0, 0, 0, 0, 0, 0], 60, 80)
    expect(result[6].CTL).toBeLessThan(60)
  })

  it('simulateBanister([0..0], startCTL=60) → result[6].CTL < 60', () => {
    const result = simulateBanister([0, 0, 0, 0, 0, 0, 0], 60, 80)
    expect(result[6].CTL).toBeLessThan(60)
  })
})

describe('peakFormWindow', () => {
  it('peakDay falls in taper window of a 6-week build-taper plan', () => {
    // 6-week plan: 4 heavy + 2 light weeks. Mirror of passing test in simulation.test.js.
    const plan = [300, 350, 400, 450, 200, 100]
    const result = peakFormWindow(plan)
    // 42-day trace; peak should be in last 2 weeks (days 29–42)
    expect(result.peakDay).toBeGreaterThan(28)
  })

  it('both plans return numeric peakTSB', () => {
    const planA = [300, 350, 400, 100]
    const planB = [350, 350, 350, 150]
    const resultA = peakFormWindow(planA)
    const resultB = peakFormWindow(planB)
    expect(typeof resultA.peakTSB).toBe('number')
    expect(typeof resultB.peakTSB).toBe('number')
  })

  it('missed week: CTL after 7 zero days from CTL=60 is < 60', () => {
    const result = simulateBanister([0, 0, 0, 0, 0, 0, 0], 60, 0)
    expect(result[6].CTL).toBeLessThan(60)
  })
})
