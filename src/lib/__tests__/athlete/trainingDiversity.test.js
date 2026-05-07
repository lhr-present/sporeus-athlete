// ─── trainingDiversity.test.js — Multi-Sport Variety Detector unit tests ────
import { describe, it, expect } from 'vitest'
import {
  detectTrainingDiversity,
  TRAINING_DIVERSITY_CITATION,
} from '../../athlete/trainingDiversity.js'

const TODAY = '2026-05-07'

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const runEntry = (date, duration = 60) => ({ date, type: 'run', duration })
const bikeEntry = (date, duration = 60) => ({ date, type: 'bike', duration })
const swimEntry = (date, duration = 60) => ({ date, type: 'swim', duration })
const strengthEntry = (date, duration = 60) => ({ date, type: 'strength', duration })
const otherEntry = (date, duration = 60) => ({ date, type: 'yoga', duration })

// ─── Empty / null ───────────────────────────────────────────────────────────
describe('detectTrainingDiversity — empty / null inputs', () => {
  it('returns reliable=false and band=monotypic for null log', () => {
    const r = detectTrainingDiversity(null, TODAY)
    expect(r.reliable).toBe(false)
    expect(r.band).toBe('monotypic')
    expect(r.totalSessions).toBe(0)
    expect(r.totalMinutes).toBe(0)
  })

  it('returns reliable=false for empty array log', () => {
    const r = detectTrainingDiversity([], TODAY)
    expect(r.reliable).toBe(false)
    expect(r.band).toBe('monotypic')
    expect(r.sportsActive).toBe(0)
    expect(r.herfindahlIndex).toBe(0)
  })

  it('returns reliable=false for non-array input', () => {
    const r = detectTrainingDiversity('nope', TODAY)
    expect(r.reliable).toBe(false)
    expect(r.totalSessions).toBe(0)
  })

  it('log <5 sessions → reliable=false but still computes', () => {
    const log = [
      runEntry(addDays(TODAY, -1)),
      bikeEntry(addDays(TODAY, -2)),
    ]
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.reliable).toBe(false)
    expect(r.totalSessions).toBe(2)
    expect(r.sportsActive).toBe(2)
  })
})

// ─── Bands ──────────────────────────────────────────────────────────────────
describe('detectTrainingDiversity — band classification', () => {
  it('10 run-only sessions → monotypic band, dominantSport=run, HHI=1.0', () => {
    const log = []
    for (let i = 0; i < 10; i++) log.push(runEntry(addDays(TODAY, -i)))
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.band).toBe('monotypic')
    expect(r.dominantSport).toBe('run')
    expect(r.herfindahlIndex).toBe(1.0)
    expect(r.sportsActive).toBe(1)
    expect(r.reliable).toBe(true)
  })

  it('10 sessions split run/bike 50/50 → limited band, HHI≈0.5', () => {
    const log = []
    for (let i = 0; i < 5; i++) log.push(runEntry(addDays(TODAY, -i), 60))
    for (let i = 0; i < 5; i++) log.push(bikeEntry(addDays(TODAY, -i - 5), 60))
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.band).toBe('limited')
    expect(r.sportsActive).toBe(2)
    expect(r.herfindahlIndex).toBeCloseTo(0.5, 2)
  })

  it('12 sessions split run/bike/swim 4/4/4 → balanced, HHI≈0.333', () => {
    const log = []
    for (let i = 0; i < 4; i++) log.push(runEntry(addDays(TODAY, -i), 60))
    for (let i = 0; i < 4; i++) log.push(bikeEntry(addDays(TODAY, -i - 4), 60))
    for (let i = 0; i < 4; i++) log.push(swimEntry(addDays(TODAY, -i - 8), 60))
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.band).toBe('balanced')
    expect(r.sportsSubstantial).toBe(3)
    expect(r.herfindahlIndex).toBeCloseTo(0.333, 2)
  })

  it('15 sessions split 5 sports equally → fragmented, HHI≈0.20', () => {
    const log = []
    for (let i = 0; i < 3; i++) log.push(runEntry(addDays(TODAY, -i), 60))
    for (let i = 0; i < 3; i++) log.push(bikeEntry(addDays(TODAY, -i - 3), 60))
    for (let i = 0; i < 3; i++) log.push(swimEntry(addDays(TODAY, -i - 6), 60))
    for (let i = 0; i < 3; i++) log.push(strengthEntry(addDays(TODAY, -i - 9), 60))
    for (let i = 0; i < 3; i++) log.push(otherEntry(addDays(TODAY, -i - 12), 60))
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.band).toBe('fragmented')
    expect(r.sportsActive).toBe(5)
    expect(r.herfindahlIndex).toBeCloseTo(0.20, 2)
  })
})

// ─── Sport detection ────────────────────────────────────────────────────────
describe('detectTrainingDiversity — sport detection', () => {
  it('type="run" → run bucket', () => {
    const log = [{ date: addDays(TODAY, -1), type: 'run', duration: 30 }]
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.sessionsPerSport.run).toBe(1)
  })

  it('type="cycling" → bike bucket', () => {
    const log = [{ date: addDays(TODAY, -1), type: 'cycling', duration: 60 }]
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.sessionsPerSport.bike).toBe(1)
  })

  it('type="swim 2km" → swim bucket', () => {
    const log = [{ date: addDays(TODAY, -1), type: 'swim 2km', duration: 45 }]
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.sessionsPerSport.swim).toBe(1)
  })

  it('type="gym strength" → strength bucket', () => {
    const log = [{ date: addDays(TODAY, -1), type: 'gym strength', duration: 50 }]
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.sessionsPerSport.strength).toBe(1)
  })

  it('type="yoga" → other bucket', () => {
    const log = [{ date: addDays(TODAY, -1), type: 'yoga', duration: 30 }]
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.sessionsPerSport.other).toBe(1)
  })

  it('entry.sport overrides entry.type', () => {
    const log = [{
      date: addDays(TODAY, -1),
      sport: 'swim',
      type: 'run',
      duration: 30,
    }]
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.sessionsPerSport.swim).toBe(1)
    expect(r.sessionsPerSport.run).toBe(0)
  })

  it('case insensitive matching (BIKE / Run / SWIM)', () => {
    const log = [
      { date: addDays(TODAY, -1), type: 'BIKE', duration: 30 },
      { date: addDays(TODAY, -2), type: 'Run', duration: 30 },
      { date: addDays(TODAY, -3), type: 'SWIM', duration: 30 },
    ]
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.sessionsPerSport.bike).toBe(1)
    expect(r.sessionsPerSport.run).toBe(1)
    expect(r.sessionsPerSport.swim).toBe(1)
  })

  it('jog → run, trail → run', () => {
    const log = [
      { date: addDays(TODAY, -1), type: 'jog', duration: 30 },
      { date: addDays(TODAY, -2), type: 'trail', duration: 60 },
    ]
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.sessionsPerSport.run).toBe(2)
  })

  it('weight / lift / resistance → strength', () => {
    const log = [
      { date: addDays(TODAY, -1), type: 'weights', duration: 30 },
      { date: addDays(TODAY, -2), type: 'lift', duration: 30 },
      { date: addDays(TODAY, -3), type: 'resistance', duration: 30 },
    ]
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.sessionsPerSport.strength).toBe(3)
  })
})

// ─── Math correctness ───────────────────────────────────────────────────────
describe('detectTrainingDiversity — math correctness', () => {
  it('substantial threshold: 10% of totalMinutes', () => {
    // 90 min run, 10 min bike (10% exactly) → both substantial
    const log = [
      runEntry(addDays(TODAY, -1), 90),
      bikeEntry(addDays(TODAY, -2), 10),
      runEntry(addDays(TODAY, -3), 0),
      bikeEntry(addDays(TODAY, -4), 0),
      runEntry(addDays(TODAY, -5), 0),
    ]
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.totalMinutes).toBe(100)
    expect(r.sportsSubstantial).toBe(2)
  })

  it('substantial threshold: <10% bike → only run substantial', () => {
    const log = [
      runEntry(addDays(TODAY, -1), 100),
      bikeEntry(addDays(TODAY, -2), 5),
      runEntry(addDays(TODAY, -3), 0),
      runEntry(addDays(TODAY, -4), 0),
      runEntry(addDays(TODAY, -5), 0),
    ]
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.sportsSubstantial).toBe(1)
  })

  it('minutesPerSport math correct', () => {
    const log = [
      runEntry(addDays(TODAY, -1), 30),
      runEntry(addDays(TODAY, -2), 45),
      bikeEntry(addDays(TODAY, -3), 90),
      swimEntry(addDays(TODAY, -4), 25),
      strengthEntry(addDays(TODAY, -5), 40),
    ]
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.minutesPerSport.run).toBe(75)
    expect(r.minutesPerSport.bike).toBe(90)
    expect(r.minutesPerSport.swim).toBe(25)
    expect(r.minutesPerSport.strength).toBe(40)
    expect(r.totalMinutes).toBe(230)
  })

  it('sessionsPerSport math correct', () => {
    const log = [
      runEntry(addDays(TODAY, -1)),
      runEntry(addDays(TODAY, -2)),
      runEntry(addDays(TODAY, -3)),
      bikeEntry(addDays(TODAY, -4)),
      swimEntry(addDays(TODAY, -5)),
    ]
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.sessionsPerSport.run).toBe(3)
    expect(r.sessionsPerSport.bike).toBe(1)
    expect(r.sessionsPerSport.swim).toBe(1)
    expect(r.totalSessions).toBe(5)
  })

  it('shares sum to ~1.0 within rounding', () => {
    const log = [
      runEntry(addDays(TODAY, -1), 30),
      bikeEntry(addDays(TODAY, -2), 60),
      swimEntry(addDays(TODAY, -3), 30),
      strengthEntry(addDays(TODAY, -4), 30),
      otherEntry(addDays(TODAY, -5), 30),
    ]
    const r = detectTrainingDiversity(log, TODAY)
    const sum = r.sharesPerSport.run + r.sharesPerSport.bike +
      r.sharesPerSport.swim + r.sharesPerSport.strength + r.sharesPerSport.other
    expect(sum).toBeGreaterThan(0.7)
    expect(sum).toBeLessThan(1.3)
  })

  it('herfindahlIndex math: 100/0/0/0/0 → 1.0', () => {
    const log = []
    for (let i = 0; i < 6; i++) log.push(runEntry(addDays(TODAY, -i), 60))
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.herfindahlIndex).toBe(1.0)
  })

  it('herfindahlIndex math: 50/50/0/0/0 → 0.5', () => {
    const log = []
    for (let i = 0; i < 3; i++) log.push(runEntry(addDays(TODAY, -i), 60))
    for (let i = 0; i < 3; i++) log.push(bikeEntry(addDays(TODAY, -i - 3), 60))
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.herfindahlIndex).toBe(0.5)
  })

  it('herfindahlIndex zero when all minutes zero', () => {
    const log = []
    for (let i = 0; i < 5; i++) {
      log.push({ date: addDays(TODAY, -i), type: 'run', duration: 0 })
    }
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.herfindahlIndex).toBe(0)
    expect(r.totalSessions).toBe(5)
    expect(r.totalMinutes).toBe(0)
  })
})

// ─── Edge cases ─────────────────────────────────────────────────────────────
describe('detectTrainingDiversity — edge cases', () => {
  it('entries with no duration still counted as sessions', () => {
    const log = [
      { date: addDays(TODAY, -1), type: 'run' },
      { date: addDays(TODAY, -2), type: 'run' },
      { date: addDays(TODAY, -3), type: 'bike' },
      { date: addDays(TODAY, -4), type: 'swim' },
      { date: addDays(TODAY, -5), type: 'strength' },
    ]
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.totalSessions).toBe(5)
    expect(r.totalMinutes).toBe(0)
    expect(r.sportsActive).toBe(4)
  })

  it('entries outside 28d window excluded', () => {
    const log = [
      runEntry(addDays(TODAY, -40), 60),
      runEntry(addDays(TODAY, -35), 60),
      bikeEntry(addDays(TODAY, -1), 60),
      bikeEntry(addDays(TODAY, -2), 60),
      bikeEntry(addDays(TODAY, -3), 60),
      bikeEntry(addDays(TODAY, -4), 60),
      bikeEntry(addDays(TODAY, -5), 60),
    ]
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.sessionsPerSport.run).toBe(0)
    expect(r.sessionsPerSport.bike).toBe(5)
    expect(r.totalSessions).toBe(5)
  })

  it('multi-entry same date count separately', () => {
    const day = addDays(TODAY, -2)
    const log = [
      runEntry(day, 30),
      bikeEntry(day, 60),
      swimEntry(day, 30),
    ]
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.totalSessions).toBe(3)
    expect(r.sessionsPerSport.run).toBe(1)
    expect(r.sessionsPerSport.bike).toBe(1)
    expect(r.sessionsPerSport.swim).toBe(1)
  })

  it('unmatched type falls into other bucket', () => {
    const log = [
      { date: addDays(TODAY, -1), type: 'rowing', duration: 30 },
      { date: addDays(TODAY, -2), type: 'hike', duration: 60 },
      { date: addDays(TODAY, -3), type: 'ski', duration: 60 },
      { date: addDays(TODAY, -4), type: 'mobility', duration: 30 },
      { date: addDays(TODAY, -5), type: 'random', duration: 30 },
    ]
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.sessionsPerSport.other).toBe(5)
  })
})

// ─── Bilingual / shape ──────────────────────────────────────────────────────
describe('detectTrainingDiversity — bilingual messages and result shape', () => {
  it('{sport} substitution in monotypic message — bilingual', () => {
    const log = []
    for (let i = 0; i < 6; i++) log.push(runEntry(addDays(TODAY, -i), 60))
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.band).toBe('monotypic')
    expect(r.message.en).toContain('run')
    expect(r.message.tr).toContain('koşu')
  })

  it('{sport}=bike substitution in monotypic message — bilingual', () => {
    const log = []
    for (let i = 0; i < 6; i++) log.push(bikeEntry(addDays(TODAY, -i), 60))
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.band).toBe('monotypic')
    expect(r.message.en).toContain('bike')
    expect(r.message.tr).toContain('bisiklet')
  })

  it('balanced band: empty recommendation, non-empty message', () => {
    const log = []
    for (let i = 0; i < 4; i++) log.push(runEntry(addDays(TODAY, -i), 60))
    for (let i = 0; i < 4; i++) log.push(bikeEntry(addDays(TODAY, -i - 4), 60))
    for (let i = 0; i < 4; i++) log.push(swimEntry(addDays(TODAY, -i - 8), 60))
    const r = detectTrainingDiversity(log, TODAY)
    expect(r.band).toBe('balanced')
    expect(r.message.en.length).toBeGreaterThan(0)
    expect(r.message.tr.length).toBeGreaterThan(0)
    expect(r.recommendation.en).toBe('')
    expect(r.recommendation.tr).toBe('')
  })

  it('limited / fragmented have non-empty bilingual recommendations', () => {
    const limitedLog = []
    for (let i = 0; i < 3; i++) limitedLog.push(runEntry(addDays(TODAY, -i), 60))
    for (let i = 0; i < 3; i++) limitedLog.push(bikeEntry(addDays(TODAY, -i - 3), 60))
    const lim = detectTrainingDiversity(limitedLog, TODAY)
    expect(lim.band).toBe('limited')
    expect(lim.recommendation.en.length).toBeGreaterThan(0)
    expect(lim.recommendation.tr.length).toBeGreaterThan(0)

    const fragLog = []
    for (let i = 0; i < 3; i++) fragLog.push(runEntry(addDays(TODAY, -i), 60))
    for (let i = 0; i < 3; i++) fragLog.push(bikeEntry(addDays(TODAY, -i - 3), 60))
    for (let i = 0; i < 3; i++) fragLog.push(swimEntry(addDays(TODAY, -i - 6), 60))
    for (let i = 0; i < 3; i++) fragLog.push(strengthEntry(addDays(TODAY, -i - 9), 60))
    for (let i = 0; i < 3; i++) fragLog.push(otherEntry(addDays(TODAY, -i - 12), 60))
    const frag = detectTrainingDiversity(fragLog, TODAY)
    expect(frag.band).toBe('fragmented')
    expect(frag.recommendation.en.length).toBeGreaterThan(0)
    expect(frag.recommendation.tr.length).toBeGreaterThan(0)
  })

  it('citation always present', () => {
    const r = detectTrainingDiversity([], TODAY)
    expect(r.citation).toBe(TRAINING_DIVERSITY_CITATION)
    expect(r.citation).toContain('Bompa')
  })

  it('options.today override is deterministic', () => {
    const log = [
      runEntry('2026-05-06', 60),
      runEntry('2026-05-05', 60),
      runEntry('2026-05-04', 60),
      runEntry('2026-05-03', 60),
      runEntry('2026-05-02', 60),
    ]
    const r1 = detectTrainingDiversity(log, '2026-05-07')
    const r2 = detectTrainingDiversity(log, '2026-05-07')
    expect(r1).toEqual(r2)
    expect(r1.totalSessions).toBe(5)
  })

  it('result has all expected keys', () => {
    const r = detectTrainingDiversity([runEntry(addDays(TODAY, -1))], TODAY)
    expect(Object.keys(r).sort()).toEqual([
      'band',
      'citation',
      'dominantSport',
      'herfindahlIndex',
      'message',
      'minutesPerSport',
      'recommendation',
      'reliable',
      'sessionsPerSport',
      'sharesPerSport',
      'sportsActive',
      'sportsSubstantial',
      'totalMinutes',
      'totalSessions',
    ])
  })
})
