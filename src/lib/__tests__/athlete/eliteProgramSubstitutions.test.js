import { describe, it, expect } from 'vitest'
import {
  buildSubstitutionMap,
  buildTriathlonSubstitutionMap,
  SUBSTITUTIONS_CITATION,
} from '../../athlete/eliteProgramSubstitutions.js'

describe('eliteProgramSubstitutions', () => {
  it('exports citation', () => {
    expect(SUBSTITUTIONS_CITATION).toMatch(/Mujika|Bompa|Issurin/)
  })

  it('run map covers all standard intents', () => {
    const m = buildSubstitutionMap({ sport: 'run' })
    expect(m.Easy).toBeTruthy()
    expect(m.Tempo).toBeTruthy()
    expect(m.Threshold).toBeTruthy()
    expect(m.VO2).toBeTruthy()
    expect(m.Long).toBeTruthy()
    expect(m.Race).toBeTruthy()
  })

  it('every intent has all 5 alternate scenarios with bilingual EN+TR', () => {
    const m = buildSubstitutionMap({ sport: 'run' })
    for (const intent of Object.keys(m)) {
      const set = m[intent]
      for (const k of ['indoor', 'crossTrain', 'injured', 'weather', 'missedMakeup']) {
        expect(set[k].en, `run/${intent}/${k}/en`).toBeTruthy()
        expect(set[k].tr, `run/${intent}/${k}/tr`).toBeTruthy()
      }
    }
  })

  it('bike map covers Easy/Tempo/Threshold/VO2/Long/Race', () => {
    const m = buildSubstitutionMap({ sport: 'bike' })
    expect(m.Easy).toBeTruthy()
    expect(m.Tempo).toBeTruthy()
    expect(m.Threshold).toBeTruthy()
    expect(m.VO2).toBeTruthy()
    expect(m.Long).toBeTruthy()
    expect(m.Race).toBeTruthy()
  })

  it('swim map covers Easy/CSS/Race', () => {
    const m = buildSubstitutionMap({ sport: 'swim' })
    expect(m.Easy).toBeTruthy()
    expect(m.CSS).toBeTruthy()
    expect(m.Race).toBeTruthy()
  })

  it('Race intent injured fallback is "pull from race"', () => {
    const m = buildSubstitutionMap({ sport: 'run' })
    expect(m.Race.injured.en.toLowerCase()).toMatch(/pull|withdraw|skip/)
  })

  it('triathlon variant returns all 3 sport maps', () => {
    const tri = buildTriathlonSubstitutionMap()
    expect(tri.run.Easy).toBeTruthy()
    expect(tri.bike.Easy).toBeTruthy()
    expect(tri.swim.Easy).toBeTruthy()
  })

  it('defaults to run for unknown sport', () => {
    const m = buildSubstitutionMap({ sport: 'gravel' })
    expect(m.Easy).toBeTruthy()
    expect(m.VO2).toBeTruthy()
  })

  it('defaults to run when sport missing', () => {
    const m = buildSubstitutionMap({})
    expect(m.Easy).toBeTruthy()
  })

  it('threshold fallback says do not skip in Build/Peak', () => {
    const m = buildSubstitutionMap({ sport: 'run' })
    expect(m.Threshold.weather.en.toLowerCase()).toMatch(/cannot|indoor|build/i)
  })

  it('Easy missedMakeup says skip (do not chase)', () => {
    const m = buildSubstitutionMap({ sport: 'run' })
    expect(m.Easy.missedMakeup.en.toLowerCase()).toMatch(/skip|do not chase|accumulate/)
  })
})
