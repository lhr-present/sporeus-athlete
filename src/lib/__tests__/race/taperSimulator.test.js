import { describe, it, expect } from 'vitest'
import { simulateTaper, compareTapers } from '../../race/taperSimulator.js'

// Build a synthetic 60-day log with consistent daily TSS
function buildLog(days, dailyTSS, today) {
  const log = []
  for (let i = days; i >= 1; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    log.push({ date: d.toISOString().slice(0, 10), tss: dailyTSS })
  }
  return log
}

const TODAY = '2026-05-01'
const RACE  = '2026-05-22'  // 21 days out

describe('simulateTaper', () => {
  it('2-week taper at 75%: TSB in sweet spot + CTL drop ≤ 20% → optimal', () => {
    const log = buildLog(60, 80, TODAY)
    const r = simulateTaper({ currentLog: log, raceDate: RACE, taperWeeks: 2, taperVolumePct: 0.75, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.recommendation).toBe('optimal')
    expect(r.raceDayTSB).toBeGreaterThanOrEqual(5)
    expect(r.raceDayTSB).toBeLessThanOrEqual(20)
  })

  it('3-week taper at 55%: recommendation = optimal or over_tapered', () => {
    const log = buildLog(60, 80, TODAY)
    const r = simulateTaper({ currentLog: log, raceDate: RACE, taperWeeks: 3, taperVolumePct: 0.55, today: TODAY })
    expect(['optimal', 'over_tapered']).toContain(r.recommendation)
  })

  it('1-week taper at 90%: recommendation = under_tapered', () => {
    const log = buildLog(60, 80, TODAY)
    const r = simulateTaper({ currentLog: log, raceDate: RACE, taperWeeks: 1, taperVolumePct: 0.9, today: TODAY })
    expect(r.recommendation).toBe('under_tapered')
  })

  it('4-week taper at 35%: CTL drops significantly → over_tapered', () => {
    const log = buildLog(90, 100, TODAY)
    const LONG_RACE = '2026-06-15'  // 45 days out for 4-week taper
    const r = simulateTaper({ currentLog: log, raceDate: LONG_RACE, taperWeeks: 4, taperVolumePct: 0.35, today: TODAY })
    expect(r.recommendation).toBe('over_tapered')
  })

  it('projection array length = days between today and raceDate', () => {
    const log = buildLog(60, 80, TODAY)
    const r = simulateTaper({ currentLog: log, raceDate: RACE, taperWeeks: 2, taperVolumePct: 0.6, today: TODAY })
    const expected = Math.round((new Date(RACE) - new Date(TODAY)) / 86400000)
    expect(r.dailyProjection).toHaveLength(expected)
  })

  it('race-day CTL/TSB match last projection row', () => {
    const log = buildLog(60, 80, TODAY)
    const r = simulateTaper({ currentLog: log, raceDate: RACE, taperWeeks: 2, taperVolumePct: 0.6, today: TODAY })
    const last = r.dailyProjection[r.dailyProjection.length - 1]
    expect(r.raceDayCTL).toBe(last.projectedCTL)
    expect(r.raceDayTSB).toBe(last.projectedTSB)
  })

  it('compareTapers returns all 3 options', () => {
    const log = buildLog(60, 80, TODAY)
    const results = compareTapers({ currentLog: log, raceDate: RACE, today: TODAY })
    expect(results).toHaveLength(3)
    expect(results.map(r => r.taperWeeks)).toEqual([2, 3, 4])
  })

  it('citation present', () => {
    const log = buildLog(60, 80, TODAY)
    const r = simulateTaper({ currentLog: log, raceDate: RACE, taperWeeks: 2, taperVolumePct: 0.6, today: TODAY })
    expect(r.citation).toContain('Mujika')
  })

  it('returns null when raceDate is in the past', () => {
    const log = buildLog(60, 80, TODAY)
    const r = simulateTaper({ currentLog: log, raceDate: '2026-04-01', taperWeeks: 2, taperVolumePct: 0.6, today: TODAY })
    expect(r).toBeNull()
  })
})
