// src/lib/__tests__/athlete/eliteProgramAutopsy.test.js
import { describe, it, expect } from 'vitest'
import { buildEliteProgramAutopsy } from '../../athlete/eliteProgramAutopsy.js'

const RACE_DATE = '2026-04-26'
const POST_RACE = '2026-05-01'

function programInput(overrides = {}) {
  return {
    input: {
      sport: 'run',
      currentPR: { distanceM: 10000, timeSec: 3000 },  // 50:00
      targetPR:  { distanceM: 10000, timeSec: 2700 },  // 45:00
      raceDate: RACE_DATE,
      ...overrides,
    },
  }
}

function logEntry(overrides = {}) {
  return {
    date: RACE_DATE,
    type: 'Race Run',
    sport: 'run',
    distanceM: 10000,
    timeSec: 2700,
    ...overrides,
  }
}

describe('buildEliteProgramAutopsy — null inputs', () => {
  it('returns null for null program', () => {
    expect(buildEliteProgramAutopsy(null, [], POST_RACE)).toBeNull()
  })

  it('returns null when program.input is missing', () => {
    expect(buildEliteProgramAutopsy({}, [], POST_RACE)).toBeNull()
  })

  it('returns null when raceDate missing', () => {
    const p = programInput({ raceDate: null })
    expect(buildEliteProgramAutopsy(p, [logEntry()], POST_RACE)).toBeNull()
  })

  it('returns null when targetPR.distanceM missing', () => {
    const p = programInput({ targetPR: { distanceM: 0, timeSec: 2700 } })
    expect(buildEliteProgramAutopsy(p, [logEntry()], POST_RACE)).toBeNull()
  })
})

describe('buildEliteProgramAutopsy — pre-race', () => {
  it('returns null when today is before raceDate', () => {
    const result = buildEliteProgramAutopsy(programInput(), [logEntry()], '2026-04-20')
    expect(result).toBeNull()
  })
})

describe('buildEliteProgramAutopsy — no matching log entry', () => {
  it('returns null when log empty', () => {
    expect(buildEliteProgramAutopsy(programInput(), [], POST_RACE)).toBeNull()
  })

  it('returns null when log entry sport mismatch', () => {
    const p = programInput()
    const e = logEntry({ type: 'Easy Bike', sport: 'cycling' })
    expect(buildEliteProgramAutopsy(p, [e], POST_RACE)).toBeNull()
  })

  it('returns null when no entry within ±7d of race date', () => {
    const p = programInput()
    const e = logEntry({ date: '2026-04-15' })  // 11 days before
    expect(buildEliteProgramAutopsy(p, [e], POST_RACE)).toBeNull()
  })

  it('11.5K does not match 10K target (>10% over)', () => {
    const p = programInput()
    const e = logEntry({ distanceM: 11500 })
    expect(buildEliteProgramAutopsy(p, [e], POST_RACE)).toBeNull()
  })
})

describe('buildEliteProgramAutopsy — verdict bucketing', () => {
  it('exact target time → on-target', () => {
    const r = buildEliteProgramAutopsy(programInput(), [logEntry({ timeSec: 2700 })], POST_RACE)
    expect(r).not.toBeNull()
    expect(r.verdict).toBe('on-target')
    expect(r.pctOfTarget).toBe(1.0)
  })

  it('beat target by 5% → beat-target', () => {
    const r = buildEliteProgramAutopsy(programInput(), [logEntry({ timeSec: 2565 })], POST_RACE)
    expect(r.verdict).toBe('beat-target')
    expect(r.pctOfTarget).toBeLessThan(1.0)
  })

  it('shortfall ~4% → shortfall', () => {
    const r = buildEliteProgramAutopsy(programInput(), [logEntry({ timeSec: 2808 })], POST_RACE)
    expect(r.verdict).toBe('shortfall')
  })

  it('major shortfall ~10% → major-shortfall', () => {
    const r = buildEliteProgramAutopsy(programInput(), [logEntry({ timeSec: 2970 })], POST_RACE)
    expect(r.verdict).toBe('major-shortfall')
  })
})

describe('buildEliteProgramAutopsy — distance tolerance', () => {
  it('9.5K vs 10K target matches (within ±10%)', () => {
    const r = buildEliteProgramAutopsy(programInput(), [logEntry({ distanceM: 9500, timeSec: 2700 })], POST_RACE)
    expect(r).not.toBeNull()
    expect(r.foundRace.distanceM).toBe(9500)
  })

  it('11.5K vs 10K target does not match (>10%)', () => {
    const r = buildEliteProgramAutopsy(programInput(), [logEntry({ distanceM: 11500 })], POST_RACE)
    expect(r).toBeNull()
  })
})

describe('buildEliteProgramAutopsy — date tolerance', () => {
  it('±7d window: matches 5 days early', () => {
    const e = logEntry({ date: '2026-04-21' })  // 5 days before race
    const r = buildEliteProgramAutopsy(programInput(), [e], POST_RACE)
    expect(r).not.toBeNull()
  })

  it('multiple matches: picks closest to raceDate', () => {
    const log = [
      logEntry({ date: '2026-04-22', timeSec: 2900 }),  // 4 days before
      logEntry({ date: '2026-04-26', timeSec: 2750 }),  // exact race day
      logEntry({ date: '2026-04-30', timeSec: 2950 }),  // 4 days after
    ]
    const r = buildEliteProgramAutopsy(programInput(), log, POST_RACE)
    expect(r.foundRace.date).toBe('2026-04-26')
    expect(r.foundRace.timeSec).toBe(2750)
  })
})

describe('buildEliteProgramAutopsy — sport-specific levels', () => {
  it('run sport produces vdot', () => {
    const r = buildEliteProgramAutopsy(programInput(), [logEntry({ timeSec: 2700 })], POST_RACE)
    expect(r.actualLevel.vdot).toBeGreaterThan(0)
    expect(r.actualLevel.ftp).toBeNull()
    expect(r.actualLevel.css).toBeNull()
  })

  it('bike sport produces ftp', () => {
    const p = {
      input: {
        sport: 'bike',
        currentPR: { distanceM: 40000, timeSec: 4200 },
        targetPR: { distanceM: 40000, timeSec: 3900 },
        raceDate: RACE_DATE,
      },
    }
    const e = { date: RACE_DATE, type: 'Bike Race', sport: 'cycling', distanceM: 40000, timeSec: 3900 }
    const r = buildEliteProgramAutopsy(p, [e], POST_RACE)
    expect(r).not.toBeNull()
    expect(r.actualLevel.ftp).toBeGreaterThan(0)
    expect(r.actualLevel.vdot).toBeNull()
  })

  it('swim sport produces css', () => {
    const p = {
      input: {
        sport: 'swim',
        currentPR: { distanceM: 1500, timeSec: 1500 },
        targetPR:  { distanceM: 1500, timeSec: 1380 },
        raceDate: RACE_DATE,
      },
    }
    const e = { date: RACE_DATE, type: 'Swim', sport: 'swim', distanceM: 1500, timeSec: 1380 }
    const r = buildEliteProgramAutopsy(p, [e], POST_RACE)
    expect(r).not.toBeNull()
    expect(r.actualLevel.css).toBeGreaterThan(0)
    expect(r.actualLevel.vdot).toBeNull()
    expect(r.actualLevel.ftp).toBeNull()
  })

  it('triathlon tolerates run-only result', () => {
    const p = programInput({ sport: 'triathlon' })
    const e = logEntry()  // running entry
    const r = buildEliteProgramAutopsy(p, [e], POST_RACE)
    expect(r).not.toBeNull()
    expect(r.actualLevel.vdot).toBeGreaterThan(0)
  })
})

describe('buildEliteProgramAutopsy — nextCyclePR', () => {
  it('beat-target → faster than actual time', () => {
    const r = buildEliteProgramAutopsy(programInput(), [logEntry({ timeSec: 2565 })], POST_RACE)
    expect(r.nextCyclePR.distanceM).toBe(10000)
    expect(r.nextCyclePR.timeSec).toBeLessThan(2565)
  })

  it('on-target → faster than target', () => {
    const r = buildEliteProgramAutopsy(programInput(), [logEntry({ timeSec: 2700 })], POST_RACE)
    expect(r.nextCyclePR.timeSec).toBeLessThan(2700)
  })

  it('shortfall → keeps target same', () => {
    const r = buildEliteProgramAutopsy(programInput(), [logEntry({ timeSec: 2808 })], POST_RACE)
    expect(r.nextCyclePR.timeSec).toBe(2700)
  })

  it('major-shortfall → resets target near actual', () => {
    const r = buildEliteProgramAutopsy(programInput(), [logEntry({ timeSec: 2970 })], POST_RACE)
    expect(r.nextCyclePR.timeSec).toBeGreaterThan(2700)
    expect(r.nextCyclePR.timeSec).toBeLessThanOrEqual(Math.round(2970 * 1.01))
  })
})

describe('buildEliteProgramAutopsy — bilingual output', () => {
  it('message has en + tr', () => {
    const r = buildEliteProgramAutopsy(programInput(), [logEntry({ timeSec: 2700 })], POST_RACE)
    expect(r.message.en).toMatch(/.+/)
    expect(r.message.tr).toMatch(/.+/)
  })

  it('recommendation has en + tr', () => {
    const r = buildEliteProgramAutopsy(programInput(), [logEntry({ timeSec: 2700 })], POST_RACE)
    expect(r.recommendation.en).toMatch(/.+/)
    expect(r.recommendation.tr).toMatch(/.+/)
  })
})

describe('buildEliteProgramAutopsy — log-shape tolerance', () => {
  it('entry without timeSec but with duration in min: converts correctly', () => {
    const e = { date: RACE_DATE, type: 'Race Run', distanceM: 10000, duration: 45 }
    const r = buildEliteProgramAutopsy(programInput(), [e], POST_RACE)
    expect(r).not.toBeNull()
    expect(r.foundRace.timeSec).toBe(2700)  // 45min → 2700s
  })

  it('entry with sport=running lowercase matches run', () => {
    const e = { date: RACE_DATE, type: 'training', sport: 'running', distanceM: 10000, timeSec: 2700 }
    const r = buildEliteProgramAutopsy(programInput(), [e], POST_RACE)
    expect(r).not.toBeNull()
  })

  it('entry sport mismatch → not picked', () => {
    const e = { date: RACE_DATE, type: 'Swim Test', sport: 'swim', distanceM: 10000, timeSec: 2700 }
    const r = buildEliteProgramAutopsy(programInput(), [e], POST_RACE)
    expect(r).toBeNull()
  })
})

describe('buildEliteProgramAutopsy — citation', () => {
  it('includes Daniels and Galloway citation', () => {
    const r = buildEliteProgramAutopsy(programInput(), [logEntry({ timeSec: 2700 })], POST_RACE)
    expect(r.citation).toMatch(/Daniels/)
    expect(r.citation).toMatch(/Galloway/)
  })
})
