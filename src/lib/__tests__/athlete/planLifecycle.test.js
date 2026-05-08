// src/lib/__tests__/athlete/planLifecycle.test.js
import { describe, it, expect } from 'vitest'
import { getPlanLifecycle } from '../../athlete/planLifecycle.js'

const PROGRAM_START = '2026-04-01'
const RACE_DATE     = '2026-08-15'

function makeProgram(overrides = {}) {
  return {
    input: {
      sport: 'run',
      currentPR: { distanceM: 10000, timeSec: 3000 },
      targetPR:  { distanceM: 10000, timeSec: 2700 },
      raceDate:  RACE_DATE,
      ...overrides,
    },
    feasibility: { band: 'realistic', effectiveRaceDate: RACE_DATE },
    sport: 'run',
  }
}

function appliedYearlyPlan() {
  return {
    weeks: [
      { weekNum: 1, targetTSS: 350 },
      { weekNum: 2, targetTSS: 380 },
      { weekNum: 3, targetTSS: 400 },
    ],
  }
}

describe('getPlanLifecycle — reliability gating', () => {
  it('null program returns reliable=false (state=draft)', () => {
    const out = getPlanLifecycle(null, [], { today: '2026-05-07', programStart: PROGRAM_START })
    expect(out.reliable).toBe(false)
    expect(out.state).toBe('draft')
  })

  it('missing raceDate returns reliable=false', () => {
    const program = makeProgram({ raceDate: null })
    program.feasibility.effectiveRaceDate = null
    const out = getPlanLifecycle(program, [], { today: '2026-05-07', programStart: PROGRAM_START })
    expect(out.reliable).toBe(false)
  })

  it('missing programStart returns reliable=false', () => {
    const out = getPlanLifecycle(makeProgram(), [], { today: '2026-05-07', programStart: null })
    expect(out.reliable).toBe(false)
  })
})

describe('getPlanLifecycle — draft state', () => {
  it('returns draft when no yearlyPlan in options', () => {
    const out = getPlanLifecycle(makeProgram(), [], {
      today: '2026-05-07', programStart: PROGRAM_START, yearlyPlan: null,
    })
    expect(out.state).toBe('draft')
    expect(out.percentComplete).toBe(0)
    expect(out.reliable).toBe(true)
  })

  it('returns draft when yearlyPlan.weeks all have zero TSS', () => {
    const yearlyPlan = { weeks: [{ targetTSS: 0 }, { targetTSS: 0 }, { targetTSS: 0 }] }
    const out = getPlanLifecycle(makeProgram(), [], {
      today: '2026-05-07', programStart: PROGRAM_START, yearlyPlan,
    })
    expect(out.state).toBe('draft')
  })
})

describe('getPlanLifecycle — applied state', () => {
  it('returns applied when yearlyPlan present + no log entries in window', () => {
    const out = getPlanLifecycle(makeProgram(), [], {
      today: '2026-05-07', programStart: PROGRAM_START, yearlyPlan: appliedYearlyPlan(),
    })
    expect(out.state).toBe('applied')
    expect(out.percentComplete).toBe(5)
  })
})

describe('getPlanLifecycle — in-progress state', () => {
  it('returns in-progress with ≥1 entry in window + race in future', () => {
    const log = [{ date: '2026-04-15', type: 'Easy Run', distanceKm: 10, duration: 50 }]
    const out = getPlanLifecycle(makeProgram(), log, {
      today: '2026-05-07', programStart: PROGRAM_START, yearlyPlan: appliedYearlyPlan(),
    })
    expect(out.state).toBe('in-progress')
    expect(out.percentComplete).toBeGreaterThan(5)
    expect(out.percentComplete).toBeLessThan(95)
  })

  it('percentComplete monotonic over simulated time', () => {
    const log = [{ date: '2026-04-15', type: 'Easy Run', distanceKm: 10 }]
    const opts = (today) => ({
      today, programStart: PROGRAM_START, yearlyPlan: appliedYearlyPlan(),
    })
    const a = getPlanLifecycle(makeProgram(), log, opts('2026-04-20')).percentComplete
    const b = getPlanLifecycle(makeProgram(), log, opts('2026-06-01')).percentComplete
    const c = getPlanLifecycle(makeProgram(), log, opts('2026-07-15')).percentComplete
    expect(a).toBeLessThanOrEqual(b)
    expect(b).toBeLessThanOrEqual(c)
  })
})

describe('getPlanLifecycle — complete state', () => {
  it('returns complete when raceDate passed + matching race log entry within ±7d', () => {
    const log = [
      { date: RACE_DATE, type: 'Race Run', sport: 'run', distanceM: 10000, timeSec: 2750 },
    ]
    const out = getPlanLifecycle(makeProgram(), log, {
      today: '2026-08-18', programStart: PROGRAM_START, yearlyPlan: appliedYearlyPlan(),
    })
    expect(out.state).toBe('complete')
    expect(out.percentComplete).toBe(100)
  })
})

describe('getPlanLifecycle — autopsy-ready state', () => {
  it('returns autopsy-ready when raceDate <14d in past + no match', () => {
    const out = getPlanLifecycle(makeProgram(), [], {
      today: '2026-08-22', programStart: PROGRAM_START, yearlyPlan: appliedYearlyPlan(),
    })
    expect(out.state).toBe('autopsy-ready')
    expect(out.percentComplete).toBe(100)
    expect(out.daysToRace).toBeLessThan(0)
  })
})

describe('getPlanLifecycle — expired state', () => {
  it('returns expired when raceDate >14d past with no race log entry', () => {
    const out = getPlanLifecycle(makeProgram(), [], {
      today: '2026-09-15', programStart: PROGRAM_START, yearlyPlan: appliedYearlyPlan(),
    })
    expect(out.state).toBe('expired')
    expect(out.percentComplete).toBe(100)
  })
})

describe('getPlanLifecycle — labels & colors', () => {
  it('every state has bilingual EN/TR labels', () => {
    const states = ['draft', 'applied', 'in-progress', 'complete', 'autopsy-ready', 'expired']
    const fixtures = [
      // draft
      { program: makeProgram(), log: [], opts: { today: '2026-05-07', programStart: PROGRAM_START, yearlyPlan: null } },
      // applied
      { program: makeProgram(), log: [], opts: { today: '2026-05-07', programStart: PROGRAM_START, yearlyPlan: appliedYearlyPlan() } },
      // in-progress
      { program: makeProgram(), log: [{ date: '2026-04-15', type: 'Easy Run' }], opts: { today: '2026-05-07', programStart: PROGRAM_START, yearlyPlan: appliedYearlyPlan() } },
      // complete
      { program: makeProgram(), log: [{ date: RACE_DATE, type: 'Race Run', sport: 'run', distanceM: 10000 }], opts: { today: '2026-08-18', programStart: PROGRAM_START, yearlyPlan: appliedYearlyPlan() } },
      // autopsy-ready
      { program: makeProgram(), log: [], opts: { today: '2026-08-22', programStart: PROGRAM_START, yearlyPlan: appliedYearlyPlan() } },
      // expired
      { program: makeProgram(), log: [], opts: { today: '2026-09-15', programStart: PROGRAM_START, yearlyPlan: appliedYearlyPlan() } },
    ]
    fixtures.forEach((f, i) => {
      const out = getPlanLifecycle(f.program, f.log, f.opts)
      expect(out.state).toBe(states[i])
      expect(typeof out.label.en).toBe('string')
      expect(typeof out.label.tr).toBe('string')
      expect(out.label.en.length).toBeGreaterThan(0)
      expect(out.label.tr.length).toBeGreaterThan(0)
    })
  })

  it('color hex stable per state', () => {
    const expected = {
      draft: '#6c757d',
      applied: '#0064ff',
      'in-progress': '#ff6600',
      complete: '#28a745',
      'autopsy-ready': '#ff9500',
      expired: '#999',
    }
    const calls = [
      ['draft', { program: makeProgram(), log: [], opts: { today: '2026-05-07', programStart: PROGRAM_START, yearlyPlan: null } }],
      ['applied', { program: makeProgram(), log: [], opts: { today: '2026-05-07', programStart: PROGRAM_START, yearlyPlan: appliedYearlyPlan() } }],
      ['in-progress', { program: makeProgram(), log: [{ date: '2026-04-15', type: 'Easy Run' }], opts: { today: '2026-05-07', programStart: PROGRAM_START, yearlyPlan: appliedYearlyPlan() } }],
      ['complete', { program: makeProgram(), log: [{ date: RACE_DATE, type: 'Race Run', sport: 'run', distanceM: 10000 }], opts: { today: '2026-08-18', programStart: PROGRAM_START, yearlyPlan: appliedYearlyPlan() } }],
      ['autopsy-ready', { program: makeProgram(), log: [], opts: { today: '2026-08-22', programStart: PROGRAM_START, yearlyPlan: appliedYearlyPlan() } }],
      ['expired', { program: makeProgram(), log: [], opts: { today: '2026-09-15', programStart: PROGRAM_START, yearlyPlan: appliedYearlyPlan() } }],
    ]
    for (const [state, f] of calls) {
      const out = getPlanLifecycle(f.program, f.log, f.opts)
      expect(out.state).toBe(state)
      expect(out.color).toBe(expected[state])
    }
  })
})

describe('getPlanLifecycle — daysToRace + bounds', () => {
  it('daysToRace correct (positive future, negative past)', () => {
    const futureOpts = { today: '2026-05-07', programStart: PROGRAM_START, yearlyPlan: null }
    const pastOpts   = { today: '2026-08-22', programStart: PROGRAM_START, yearlyPlan: appliedYearlyPlan() }
    const future = getPlanLifecycle(makeProgram(), [], futureOpts)
    const past   = getPlanLifecycle(makeProgram(), [], pastOpts)
    expect(future.daysToRace).toBeGreaterThan(0)
    expect(past.daysToRace).toBeLessThan(0)
  })

  it('percentComplete always in [0, 100]', () => {
    const samples = [
      { today: '2026-04-01', programStart: PROGRAM_START, yearlyPlan: null },
      { today: '2026-04-15', programStart: PROGRAM_START, yearlyPlan: appliedYearlyPlan() },
      { today: '2026-08-15', programStart: PROGRAM_START, yearlyPlan: appliedYearlyPlan() },
      { today: '2026-09-15', programStart: PROGRAM_START, yearlyPlan: appliedYearlyPlan() },
    ]
    const log = [{ date: '2026-04-15', type: 'Easy Run' }]
    samples.forEach(opts => {
      const out = getPlanLifecycle(makeProgram(), log, opts)
      expect(out.percentComplete).toBeGreaterThanOrEqual(0)
      expect(out.percentComplete).toBeLessThanOrEqual(100)
    })
  })
})

describe('getPlanLifecycle — robustness', () => {
  it('malformed log entry does not crash', () => {
    const log = [
      null,
      undefined,
      'garbage',
      { date: 'not-a-date' },
      { type: 'Run', distanceKm: 10 },
      { date: '2026-04-15', type: 'Easy Run', distanceKm: 10 },
    ]
    expect(() => getPlanLifecycle(makeProgram(), log, {
      today: '2026-05-07', programStart: PROGRAM_START, yearlyPlan: appliedYearlyPlan(),
    })).not.toThrow()
  })

  it('mismatched race log entry (wrong distance) → autopsy-ready not complete', () => {
    // 5K logged on race day but program target was 10K → should NOT match (>10% off)
    const log = [
      { date: RACE_DATE, type: 'Race Run', sport: 'run', distanceM: 5000, timeSec: 1300 },
    ]
    const out = getPlanLifecycle(makeProgram(), log, {
      today: '2026-08-18', programStart: PROGRAM_START, yearlyPlan: appliedYearlyPlan(),
    })
    expect(out.state).toBe('autopsy-ready')
  })
})

describe('getPlanLifecycle — multi-state walk', () => {
  it('walks draft → applied → in-progress → autopsy-ready → expired across simulated time', () => {
    const program = makeProgram()
    const yearlyPlan = appliedYearlyPlan()

    // Day 1 — no plan yet
    const draft = getPlanLifecycle(program, [], {
      today: '2026-04-02', programStart: PROGRAM_START, yearlyPlan: null,
    })
    expect(draft.state).toBe('draft')

    // Day 2 — applied but nothing logged
    const applied = getPlanLifecycle(program, [], {
      today: '2026-04-02', programStart: PROGRAM_START, yearlyPlan,
    })
    expect(applied.state).toBe('applied')

    // Day 3 — first log entry
    const log = [{ date: '2026-04-03', type: 'Easy Run', distanceKm: 8 }]
    const inProgress = getPlanLifecycle(program, log, {
      today: '2026-04-10', programStart: PROGRAM_START, yearlyPlan,
    })
    expect(inProgress.state).toBe('in-progress')

    // Day 4 — race day passed, no match yet
    const autopsy = getPlanLifecycle(program, log, {
      today: '2026-08-20', programStart: PROGRAM_START, yearlyPlan,
    })
    expect(autopsy.state).toBe('autopsy-ready')

    // Day 5 — race day way passed, never logged
    const expired = getPlanLifecycle(program, log, {
      today: '2026-09-05', programStart: PROGRAM_START, yearlyPlan,
    })
    expect(expired.state).toBe('expired')
  })
})

// ── v9.3.0 — coach edits summary ────────────────────────────────────────────
describe('getPlanLifecycle — coach edits summary (v9.3.0)', () => {
  it('returns zero-filled coachEdits when no edits supplied', () => {
    const program = makeProgram()
    const out = getPlanLifecycle(program, [], { today: '2026-05-07', programStart: PROGRAM_START })
    expect(out.coachEdits).toEqual({ applied: 0, pending: 0, total: 0 })
  })

  it('counts pending vs accepted vs rejected', () => {
    const program = makeProgram()
    const edits = [
      { id: 'a', accepted: true },
      { id: 'b', accepted: false },
      { id: 'c' },                     // pending
      { id: 'd', accepted: true },
    ]
    const out = getPlanLifecycle(program, [], {
      today: '2026-05-07', programStart: PROGRAM_START, coachEdits: edits,
    })
    expect(out.coachEdits).toEqual({ applied: 2, pending: 1, total: 4 })
  })

  it('zero-fills coachEdits on unreliable result', () => {
    const out = getPlanLifecycle(null, [], { today: '2026-05-07', programStart: PROGRAM_START })
    expect(out.coachEdits).toEqual({ applied: 0, pending: 0, total: 0 })
    expect(out.reliable).toBe(false)
  })
})
