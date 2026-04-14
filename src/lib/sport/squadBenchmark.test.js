import { describe, it, expect } from 'vitest'
import {
  rankSquad,
  exportSquadCSV,
  calcCompliancePct,
  limitSelection,
} from './squadBenchmark.js'

describe('rankSquad', () => {
  it('sorts by ctl descending correctly', () => {
    const athletes = [
      { id: 1, name: 'Alice', ctl: 60 },
      { id: 2, name: 'Bob',   ctl: 90 },
      { id: 3, name: 'Carol', ctl: 75 },
    ]
    const result = rankSquad(athletes, 'ctl')
    expect(result[0].ctl).toBe(90)
    expect(result[1].ctl).toBe(75)
    expect(result[2].ctl).toBe(60)
  })

  it('handles empty array', () => {
    expect(rankSquad([], 'ctl')).toEqual([])
  })
})

describe('exportSquadCSV', () => {
  it('has correct headers and row count', () => {
    const athletes = [
      { name: 'Alice', ctl: 60, acwr: 1.1, compliance_pct: 80, wellness_avg: 3.5 },
      { name: 'Bob',   ctl: 90, acwr: 0.9, compliance_pct: 95, wellness_avg: 4.0 },
    ]
    const csv = exportSquadCSV(athletes)
    const lines = csv.split('\n')
    expect(lines[0]).toBe('name,ctl,acwr,compliance_pct,wellness_avg')
    expect(lines.length).toBe(3) // header + 2 rows
  })

  it('empty array returns just headers', () => {
    const csv = exportSquadCSV([])
    expect(csv).toBe('name,ctl,acwr,compliance_pct,wellness_avg\n')
  })
})

describe('calcCompliancePct', () => {
  it('within 10% counts as compliant', () => {
    // 100 planned, 105 actual = 5% deviation = compliant
    // 100 planned, 80  actual = 20% deviation = not compliant
    const planned = [100, 100]
    const actual  = [105, 80]
    expect(calcCompliancePct(planned, actual)).toBe(50)
  })
})

describe('limitSelection', () => {
  it('caps at 5 items', () => {
    const ids = [1, 2, 3, 4, 5, 6, 7]
    expect(limitSelection(ids)).toHaveLength(5)
    expect(limitSelection(ids)).toEqual([1, 2, 3, 4, 5])
  })
})
