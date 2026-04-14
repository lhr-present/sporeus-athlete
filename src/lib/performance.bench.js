import { bench, describe } from 'vitest'
import { calculateACWR } from './trainingLoad.js'
import { simulateBanister, monteCarloOptimizer } from './sport/simulation.js'

// Generate synthetic 10-year log (3650 entries)
const startDate = new Date('2015-01-01')
const log3650 = Array.from({ length: 3650 }, (_, i) => {
  const d = new Date(startDate)
  d.setDate(d.getDate() + i)
  return {
    date: d.toISOString().slice(0, 10),
    tss: 60 + Math.sin(i / 30) * 20,
    type: 'Run',
  }
})

// TSS array for 1 year (365 entries)
const tssArray365 = Array.from({ length: 365 }, (_, i) => 60 + Math.sin(i / 30) * 20)

describe('Sport science engine performance', () => {
  bench('calculateACWR — 3650 entries (10 years)', () => {
    calculateACWR(log3650)
  })

  bench('simulateBanister — 365 entries (1 year)', () => {
    simulateBanister(tssArray365)
  })

  bench('monteCarloOptimizer — 12 weeks, 200 simulations', () => {
    monteCarloOptimizer({ weeks: 12, minWeeklyTSS: 200, maxWeeklyTSS: 800 }, 200)
  })
})
