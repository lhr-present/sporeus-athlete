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

// ── v9.30.0 — Triathlon race-week protocol (was falling through to RUN) ──
describe('buildRaceWeekProtocol — triathlon (v9.30.0)', () => {
  it('triathlon gets sport-specific schedule, NOT run protocol', () => {
    const tri = buildRaceWeekProtocol({ sport: 'triathlon' })
    const run = buildRaceWeekProtocol({ sport: 'run' })
    expect(JSON.stringify(tri.schedule)).not.toBe(JSON.stringify(run.schedule))
    expect(JSON.stringify(tri.raceDay)).not.toBe(JSON.stringify(run.raceDay))
  })

  it('triathlon schedule mentions brick session in T-7 and T-4', () => {
    const tri = buildRaceWeekProtocol({ sport: 'triathlon' })
    const t7 = tri.schedule.find(d => d.tMinus === 7)
    const t4 = tri.schedule.find(d => d.tMinus === 4)
    expect(t7.session.en.toLowerCase()).toMatch(/brick/)
    expect(t4.session.en.toLowerCase()).toMatch(/brick/)
    expect(t7.session.tr.toLowerCase()).toMatch(/brick/)
    expect(t4.session.tr.toLowerCase()).toMatch(/brick/)
  })

  it('triathlon schedule covers all 8 days T-7 through T-0', () => {
    const tri = buildRaceWeekProtocol({ sport: 'triathlon' })
    expect(tri.schedule.length).toBe(8)
    for (let i = 0; i <= 7; i++) {
      expect(tri.schedule.find(d => d.tMinus === i)).toBeDefined()
    }
  })

  it('triathlon raceDay includes transitionLayout (T1/T2 walk-through)', () => {
    const tri = buildRaceWeekProtocol({ sport: 'triathlon' })
    expect(tri.raceDay.transitionLayout).toBeDefined()
    expect(tri.raceDay.transitionLayout.en).toMatch(/T1.*T2|T2.*T1/i)
    expect(tri.raceDay.transitionLayout.tr).toBeDefined()
  })

  it('triathlon raceDay includes brickRefuelWindow (post-swim CHO timing)', () => {
    const tri = buildRaceWeekProtocol({ sport: 'triathlon' })
    expect(tri.raceDay.brickRefuelWindow).toBeDefined()
    expect(tri.raceDay.brickRefuelWindow.en).toMatch(/T1|gel|CHO/i)
  })

  it('triathlon raceDay carries sport-specific mentalRehearsal scripts mentioning transitions', () => {
    const tri = buildRaceWeekProtocol({ sport: 'triathlon' })
    expect(Array.isArray(tri.raceDay.mentalRehearsal?.en)).toBe(true)
    expect(tri.raceDay.mentalRehearsal.en.length).toBeGreaterThan(4)
    const allText = tri.raceDay.mentalRehearsal.en.join(' ')
    expect(allText).toMatch(/T1|T2/)
  })

  it('triathlon raceDay carries pre-race meals with T1 refuel mention', () => {
    const tri = buildRaceWeekProtocol({ sport: 'triathlon' })
    const allMealsEn = tri.raceDay.preRaceMeals.en.join(' ')
    expect(allMealsEn).toMatch(/T1/i)
  })

  it('triathlon raceDay carries sport-specific caffeine dosing protocol', () => {
    const tri = buildRaceWeekProtocol({ sport: 'triathlon' })
    expect(tri.raceDay.caffeine).toBeDefined()
    expect(tri.raceDay.caffeine.en).toMatch(/mg\/kg|swim/i)
  })

  it('non-tri sports do NOT carry transitionLayout or brickRefuelWindow', () => {
    for (const sport of ['run', 'bike', 'swim', 'rowing']) {
      const r = buildRaceWeekProtocol({ sport })
      expect(r.raceDay.transitionLayout).toBeUndefined()
      expect(r.raceDay.brickRefuelWindow).toBeUndefined()
    }
  })

  it('triathlon distance-tier overrides still apply (Olympic distance)', () => {
    const tri = buildRaceWeekProtocol({ sport: 'triathlon', raceDistanceM: 51500 })
    expect(tri.raceDay.distanceTier).toBeDefined()
  })
})

// ── v9.31.0 — Cold-weather race protocol ─────────────────────────────
describe('buildRaceWeekProtocol — cold-weather protocol (v9.31.0)', () => {
  it('omits cold protocol when raceTempC is null/undefined', () => {
    const r = buildRaceWeekProtocol({ sport: 'run' })
    expect(r.cold).toBeUndefined()
  })

  it('omits cold protocol when raceTempC ≥5°C (warm or temperate)', () => {
    const r = buildRaceWeekProtocol({ sport: 'run', raceTempC: 5 })
    expect(r.cold).toBeUndefined()
    const warm = buildRaceWeekProtocol({ sport: 'run', raceTempC: 18 })
    expect(warm.cold).toBeUndefined()
  })

  it('activates moderate cold tier between 0°C and 5°C', () => {
    const r = buildRaceWeekProtocol({ sport: 'run', raceTempC: 3 })
    expect(r.cold).toBeDefined()
    expect(r.cold.summary.en).toMatch(/moderate/i)
    expect(r.cold.summary.tr).toMatch(/orta/i)
  })

  it('activates severe cold tier between -10°C and 0°C', () => {
    const r = buildRaceWeekProtocol({ sport: 'bike', raceTempC: -3 })
    expect(r.cold).toBeDefined()
    expect(r.cold.summary.en).toMatch(/severe/i)
    expect(r.cold.summary.tr).toMatch(/şiddetli/i)
  })

  it('activates extreme cold tier at or below -10°C', () => {
    const r = buildRaceWeekProtocol({ sport: 'run', raceTempC: -15 })
    expect(r.cold).toBeDefined()
    expect(r.cold.summary.en).toMatch(/extreme/i)
    expect(r.cold.summary.tr).toMatch(/aşırı/i)
  })

  it('shape matches heat/altitude (summary/acclimatization/pacing/fueling)', () => {
    const r = buildRaceWeekProtocol({ sport: 'run', raceTempC: -5 })
    expect(r.cold.summary).toHaveProperty('en')
    expect(r.cold.summary).toHaveProperty('tr')
    expect(r.cold.acclimatization).toHaveProperty('en')
    expect(r.cold.pacing).toHaveProperty('en')
    expect(r.cold.fueling).toHaveProperty('en')
  })

  it('frostbite warning surfaces in fueling for severe + extreme tiers', () => {
    const severe = buildRaceWeekProtocol({ sport: 'run', raceTempC: -3 })
    expect(severe.cold.fueling.en).toMatch(/frostbite/i)
    const extreme = buildRaceWeekProtocol({ sport: 'run', raceTempC: -20 })
    expect(extreme.cold.fueling.en).toMatch(/frostbite/i)
  })

  it('frostbite warning suppressed for moderate tier (≥0°C)', () => {
    const moderate = buildRaceWeekProtocol({ sport: 'run', raceTempC: 3 })
    expect(moderate.cold.fueling.en).not.toMatch(/frostbite/i)
  })

  it('citation list mentions cold-weather sources', () => {
    const r = buildRaceWeekProtocol({ sport: 'run', raceTempC: -5 })
    expect(r.citation).toMatch(/Tipton|Castellani/)
  })
})

// ── v9.33.0 — Universal post-race 48h recovery protocol ────────────────
describe('buildRaceWeekProtocol — post-race 48h recovery (v9.33.0)', () => {
  it('every sport carries postRaceRecovery48h block', () => {
    for (const sport of ['run', 'bike', 'swim', 'rowing', 'triathlon']) {
      const r = buildRaceWeekProtocol({ sport })
      expect(r.raceDay.postRaceRecovery48h).toBeDefined()
    }
  })

  it('post-race block has all 5 timeline windows + warning signs', () => {
    const r = buildRaceWeekProtocol({ sport: 'run' })
    const post = r.raceDay.postRaceRecovery48h
    expect(post.hour0to2).toBeDefined()
    expect(post.hour2to4).toBeDefined()
    expect(post.day1).toBeDefined()
    expect(post.day2).toBeDefined()
    expect(post.day3plus).toBeDefined()
    expect(post.warningSigns).toBeDefined()
  })

  it('hour0to2 block specifies CHO + protein dosing (Stellingwerff 2014)', () => {
    const r = buildRaceWeekProtocol({ sport: 'run' })
    expect(r.raceDay.postRaceRecovery48h.hour0to2.en).toMatch(/CHO|carbohydrate/i)
    expect(r.raceDay.postRaceRecovery48h.hour0to2.en).toMatch(/protein/i)
    expect(r.raceDay.postRaceRecovery48h.hour0to2.en).toMatch(/g\/kg/i)
  })

  it('day1 specifies easy-walking-only / no strength', () => {
    const r = buildRaceWeekProtocol({ sport: 'run' })
    expect(r.raceDay.postRaceRecovery48h.day1.en).toMatch(/walking/i)
    expect(r.raceDay.postRaceRecovery48h.day1.en).toMatch(/no strength/i)
  })

  it('warningSigns includes rhabdomyolysis + dizziness markers', () => {
    const r = buildRaceWeekProtocol({ sport: 'run' })
    expect(r.raceDay.postRaceRecovery48h.warningSigns.en).toMatch(/rhabdo/i)
    expect(r.raceDay.postRaceRecovery48h.warningSigns.en).toMatch(/dizziness|syncope/i)
  })

  it('all 6 fields are bilingual EN+TR', () => {
    const r = buildRaceWeekProtocol({ sport: 'run' })
    const post = r.raceDay.postRaceRecovery48h
    for (const field of ['hour0to2', 'hour2to4', 'day1', 'day2', 'day3plus', 'warningSigns']) {
      expect(post[field]).toHaveProperty('en')
      expect(post[field]).toHaveProperty('tr')
      expect(post[field].tr.length).toBeGreaterThan(20)
    }
  })
})

// ── v9.35.0 — DNF triage decision tree ──────────────────────────────────
describe('buildRaceWeekProtocol — DNF triage (v9.35.0)', () => {
  it('every sport carries dnfTriageDecisionTree block', () => {
    for (const sport of ['run', 'bike', 'swim', 'rowing', 'triathlon']) {
      const r = buildRaceWeekProtocol({ sport })
      expect(r.raceDay.dnfTriageDecisionTree).toBeDefined()
      expect(r.raceDay.dnfTriageDecisionTree.en).toBeDefined()
      expect(r.raceDay.dnfTriageDecisionTree.tr).toBeDefined()
    }
  })

  it('DNF tree includes all 3 triage categories (STOP, EXIT, CONTINUE)', () => {
    const r = buildRaceWeekProtocol({ sport: 'run' })
    expect(r.raceDay.dnfTriageDecisionTree.en).toMatch(/STOP IMMEDIATELY/i)
    expect(r.raceDay.dnfTriageDecisionTree.en).toMatch(/EXIT TO WALK|DNF/i)
    expect(r.raceDay.dnfTriageDecisionTree.en).toMatch(/CONTINUE WITH ADJUSTMENT/i)
  })

  it('DNF tree mentions specific stop-conditions: chest pain, syncope, vision', () => {
    const r = buildRaceWeekProtocol({ sport: 'run' })
    const en = r.raceDay.dnfTriageDecisionTree.en.toLowerCase()
    expect(en).toMatch(/chest pain/)
    expect(en).toMatch(/syncope|collapse/)
    expect(en).toMatch(/vision/)
  })

  it('DNF tree mentions sports-injury markers: rhabdo, stress fracture, fever', () => {
    const r = buildRaceWeekProtocol({ sport: 'run' })
    const en = r.raceDay.dnfTriageDecisionTree.en.toLowerCase()
    expect(en).toMatch(/rhabdomyolysis|tea-colored|dark-cola/)
    expect(en).toMatch(/stress fracture|compartment/)
    expect(en).toMatch(/fever/)
  })

  it('DNF tree includes continuation criteria with concrete adjustments', () => {
    const r = buildRaceWeekProtocol({ sport: 'run' })
    const en = r.raceDay.dnfTriageDecisionTree.en.toLowerCase()
    expect(en).toMatch(/cramp/)
    expect(en).toMatch(/electrolyte/)
    expect(en).toMatch(/mechanical|flat|chain/)
  })
})

// ── v9.35.0 — Last 3 nights sleep hygiene ──────────────────────────────
describe('buildRaceWeekProtocol — last-3-nights sleep hygiene (v9.35.0)', () => {
  it('every sport carries last3NightsSleepHygiene block', () => {
    for (const sport of ['run', 'bike', 'swim', 'rowing', 'triathlon']) {
      const r = buildRaceWeekProtocol({ sport })
      expect(r.raceDay.last3NightsSleepHygiene).toBeDefined()
      expect(r.raceDay.last3NightsSleepHygiene.en).toBeDefined()
      expect(r.raceDay.last3NightsSleepHygiene.tr).toBeDefined()
    }
  })

  it('sleep hygiene specifies caffeine cutoff (T-3) with concrete time/threshold', () => {
    const r = buildRaceWeekProtocol({ sport: 'run' })
    const en = r.raceDay.last3NightsSleepHygiene.en.toLowerCase()
    expect(en).toMatch(/caffeine/)
    expect(en).toMatch(/14:00|2 ?pm|after.*1[24]/)
  })

  it('sleep hygiene specifies melatonin gating (T-2) for >5h zone shift', () => {
    const r = buildRaceWeekProtocol({ sport: 'run' })
    const en = r.raceDay.last3NightsSleepHygiene.en.toLowerCase()
    expect(en).toMatch(/melatonin/)
    expect(en).toMatch(/zone shift|time.zone|>5/i)
  })

  it('sleep hygiene specifies bedroom environment (T-1): temp + blackout + screens', () => {
    const r = buildRaceWeekProtocol({ sport: 'run' })
    const en = r.raceDay.last3NightsSleepHygiene.en.toLowerCase()
    expect(en).toMatch(/16-19|17|18|19.°c|temperature/)
    expect(en).toMatch(/blackout|dark/)
    expect(en).toMatch(/screen/)
  })

  it('sleep hygiene anchors wake time (NOT bedtime) for circadian phase', () => {
    const r = buildRaceWeekProtocol({ sport: 'run' })
    const en = r.raceDay.last3NightsSleepHygiene.en.toLowerCase()
    expect(en).toMatch(/wake time|consistent/)
  })

  it('sleep hygiene includes race-morning HRV check', () => {
    const r = buildRaceWeekProtocol({ sport: 'run' })
    const en = r.raceDay.last3NightsSleepHygiene.en
    expect(en).toMatch(/HRV/)
    expect(en).toMatch(/baseline|elevated/i)
  })
})
