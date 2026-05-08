import { describe, it, expect } from 'vitest'
import { buildRaceWeekProtocol, RACE_WEEK_CITATION } from '../../athlete/eliteProgramRaceWeek.js'

describe('eliteProgramRaceWeek', () => {
  it('exports citation', () => {
    expect(RACE_WEEK_CITATION).toMatch(/Mujika|Bosquet/)
  })

  it('returns 8 days T-7 through T-0', () => {
    const p = buildRaceWeekProtocol({ sport: 'run' })
    expect(p.schedule.length).toBe(8)
    const tValues = p.schedule.map(d => d.tMinus)
    expect(tValues).toEqual([7, 6, 5, 4, 3, 2, 1, 0])
  })

  it('every day has bilingual session/fueling/notes', () => {
    const p = buildRaceWeekProtocol({ sport: 'run' })
    for (const d of p.schedule) {
      expect(d.session.en).toBeTruthy()
      expect(d.session.tr).toBeTruthy()
      expect(d.fueling.en).toBeTruthy()
      expect(d.fueling.tr).toBeTruthy()
      expect(d.notes.en).toBeTruthy()
      expect(d.notes.tr).toBeTruthy()
    }
  })

  it('raceDay block has all 6 fields with bilingual content', () => {
    const p = buildRaceWeekProtocol({ sport: 'run' })
    const r = p.raceDay
    for (const k of ['wakeUp', 'breakfast', 'warmup', 'pacing', 'fueling', 'mental']) {
      expect(r[k].en).toBeTruthy()
      expect(r[k].tr).toBeTruthy()
    }
  })

  it('returns sport-specific schedule for bike', () => {
    const p = buildRaceWeekProtocol({ sport: 'bike' })
    const text = JSON.stringify(p)
    expect(text).toMatch(/FTP|trainer|bisiklet/i)
  })

  it('returns sport-specific schedule for swim', () => {
    const p = buildRaceWeekProtocol({ sport: 'swim' })
    const text = JSON.stringify(p)
    expect(text).toMatch(/CSS|m \d|havuz/i)
  })

  it('defaults to run for unknown sport', () => {
    const p = buildRaceWeekProtocol({ sport: 'gravel' })
    expect(p.schedule.length).toBe(8)
  })

  it('defaults to run for missing sport', () => {
    const p = buildRaceWeekProtocol({})
    expect(p.schedule.length).toBe(8)
  })

  it('T-3 day mentions carb load (begin)', () => {
    const p = buildRaceWeekProtocol({ sport: 'run' })
    const tMinus3 = p.schedule.find(d => d.tMinus === 3)
    expect(tMinus3.fueling.en.toLowerCase()).toMatch(/carb|cho/)
  })

  it('T-1 schedule mentions early dinner / sleep', () => {
    const p = buildRaceWeekProtocol({ sport: 'run' })
    const tMinus1 = p.schedule.find(d => d.tMinus === 1)
    expect(tMinus1.notes.en.toLowerCase()).toMatch(/sleep|alarm|kit/)
  })

  it('T-0 (race day) is well-formed', () => {
    const p = buildRaceWeekProtocol({ sport: 'run' })
    const t0 = p.schedule.find(d => d.tMinus === 0)
    expect(t0.day.toLowerCase()).toMatch(/race|t-0/)
  })

  it('schedules differ between sports', () => {
    const r = buildRaceWeekProtocol({ sport: 'run' })
    const b = buildRaceWeekProtocol({ sport: 'bike' })
    expect(JSON.stringify(r.schedule)).not.toBe(JSON.stringify(b.schedule))
  })
})
