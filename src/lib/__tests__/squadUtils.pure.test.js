// E102
import { describe, it, expect } from 'vitest'
import {
  filterByTeam,
  DEMO_TEAMS,
  makeLCG,
  deriveTrainingStatus,
  mapAcwrStatus,
  generateDemoSquad,
} from '../squadUtils.js'

// ── DEMO_TEAMS constant ───────────────────────────────────────────────────────
describe('DEMO_TEAMS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(DEMO_TEAMS)).toBe(true)
    expect(DEMO_TEAMS.length).toBeGreaterThan(0)
  })

  it('has 3 demo teams', () => {
    expect(DEMO_TEAMS.length).toBe(3)
  })

  it('each team has id, name, sport, age_group, athlete_ids', () => {
    for (const team of DEMO_TEAMS) {
      expect(team).toHaveProperty('id')
      expect(team).toHaveProperty('name')
      expect(team).toHaveProperty('sport')
      expect(team).toHaveProperty('age_group')
      expect(team).toHaveProperty('athlete_ids')
      expect(Array.isArray(team.athlete_ids)).toBe(true)
    }
  })

  it('contains the Senior, U23, U18 teams', () => {
    const names = DEMO_TEAMS.map(t => t.name)
    expect(names).toContain('Senior')
    expect(names).toContain('U23')
    expect(names).toContain('U18')
  })

  it('athlete_ids across all teams cover all 6 demo athletes', () => {
    const allIds = DEMO_TEAMS.flatMap(t => t.athlete_ids)
    expect(allIds).toContain('demo-eddy')
    expect(allIds).toContain('demo-fausto')
    expect(allIds).toContain('demo-bernard')
    expect(allIds).toContain('demo-miguel')
    expect(allIds).toContain('demo-tadej')
    expect(allIds).toContain('demo-wout')
  })
})

// ── filterByTeam ──────────────────────────────────────────────────────────────
describe('filterByTeam', () => {
  const athletes = [
    { athlete_id: 'demo-eddy',    name: 'Eddy' },
    { athlete_id: 'demo-fausto',  name: 'Fausto' },
    { athlete_id: 'demo-bernard', name: 'Bernard' },
    { athlete_id: 'demo-miguel',  name: 'Miguel' },
    { athlete_id: 'demo-tadej',   name: 'Tadej' },
    { athlete_id: 'demo-wout',    name: 'Wout' },
  ]

  it('returns all athletes when team is null', () => {
    expect(filterByTeam(athletes, null)).toBe(athletes)
  })

  it('returns all athletes when team has no athlete_ids', () => {
    expect(filterByTeam(athletes, {})).toBe(athletes)
  })

  it('returns all athletes when athlete_ids is empty array', () => {
    expect(filterByTeam(athletes, { athlete_ids: [] })).toBe(athletes)
  })

  it('filters to Senior team members only', () => {
    const seniorTeam = DEMO_TEAMS.find(t => t.name === 'Senior')
    const result = filterByTeam(athletes, seniorTeam)
    expect(result.length).toBe(3)
    const ids = result.map(a => a.athlete_id)
    expect(ids).toContain('demo-eddy')
    expect(ids).toContain('demo-fausto')
    expect(ids).toContain('demo-bernard')
    expect(ids).not.toContain('demo-miguel')
  })

  it('filters to U23 team members only', () => {
    const u23Team = DEMO_TEAMS.find(t => t.name === 'U23')
    const result = filterByTeam(athletes, u23Team)
    expect(result.length).toBe(2)
    const ids = result.map(a => a.athlete_id)
    expect(ids).toContain('demo-miguel')
    expect(ids).toContain('demo-tadej')
  })

  it('filters to U18 team (single member)', () => {
    const u18Team = DEMO_TEAMS.find(t => t.name === 'U18')
    const result = filterByTeam(athletes, u18Team)
    expect(result.length).toBe(1)
    expect(result[0].athlete_id).toBe('demo-wout')
  })

  it('returns empty array when team ids match no athletes', () => {
    const fakeTeam = { athlete_ids: ['nobody-1', 'nobody-2'] }
    expect(filterByTeam(athletes, fakeTeam)).toEqual([])
  })
})

// ── makeLCG ───────────────────────────────────────────────────────────────────
describe('makeLCG', () => {
  it('returns a function', () => {
    expect(typeof makeLCG(42)).toBe('function')
  })

  it('output is in [0, 1)', () => {
    const rng = makeLCG(42)
    for (let i = 0; i < 100; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('same seed produces same sequence (deterministic)', () => {
    const rng1 = makeLCG(12345)
    const rng2 = makeLCG(12345)
    for (let i = 0; i < 20; i++) {
      expect(rng1()).toBe(rng2())
    }
  })

  it('different seeds produce different sequences', () => {
    const rng1 = makeLCG(1)
    const rng2 = makeLCG(2)
    const seq1 = Array.from({ length: 10 }, () => rng1())
    const seq2 = Array.from({ length: 10 }, () => rng2())
    expect(seq1).not.toEqual(seq2)
  })

  it('sequence advances — consecutive calls differ', () => {
    const rng = makeLCG(99)
    const v1 = rng()
    const v2 = rng()
    expect(v1).not.toBe(v2)
  })

  it('seed 0 is handled (no crash, returns values in [0,1))', () => {
    const rng = makeLCG(0)
    for (let i = 0; i < 10; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

// ── deriveTrainingStatus ──────────────────────────────────────────────────────
describe('deriveTrainingStatus', () => {
  // Helper: date string N days from today
  function daysAgo(n) {
    return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
  }

  const today     = daysAgo(0)
  const yesterday = daysAgo(1)
  const fourAgo   = daysAgo(4)
  const sixAgo    = daysAgo(6)

  it('returns Overreaching when ATL > CTL + 20', () => {
    // ctl=70, atl=91 => atl > ctl+20
    expect(deriveTrainingStatus(70, 91, 5, 67, today)).toBe('Overreaching')
  })

  it('Overreaching boundary: atl exactly equals ctl+20 does NOT trigger it', () => {
    // atl must be strictly > ctl+20
    const status = deriveTrainingStatus(70, 90, 5, 67, today)
    expect(status).not.toBe('Overreaching')
  })

  it('returns Detraining when lastSessionDate is null', () => {
    expect(deriveTrainingStatus(60, 55, 5, 57, null)).toBe('Detraining')
  })

  it('returns Detraining when lastSessionDate is 6 days ago (> 5 days threshold)', () => {
    expect(deriveTrainingStatus(60, 55, 5, 57, sixAgo)).toBe('Detraining')
  })

  it('does NOT return Detraining when lastSessionDate is 4 days ago', () => {
    // CTL steady, high TSB → Peaking
    expect(deriveTrainingStatus(70, 50, 20, 69, fourAgo)).toBe('Peaking')
  })

  it('returns Building when CTL increased by more than 3 vs week ago', () => {
    // ctl=80, ctlWeekAgo=76 → ctl > ctlWeekAgo+3
    expect(deriveTrainingStatus(80, 60, 5, 76, yesterday)).toBe('Building')
  })

  it('Building boundary: ctl exactly ctlWeekAgo+3 does NOT trigger Building', () => {
    // ctl=79, ctlWeekAgo=76 → not > 79
    const status = deriveTrainingStatus(79, 60, 5, 76, yesterday)
    expect(status).not.toBe('Building')
  })

  it('returns Peaking when TSB > 15 (and not Overreaching/Detraining/Building)', () => {
    // ctl=70, ctlWeekAgo=70 (no change), tsb=20
    expect(deriveTrainingStatus(70, 50, 20, 70, yesterday)).toBe('Peaking')
  })

  it('Peaking boundary: tsb exactly 15 does NOT trigger Peaking', () => {
    // tsb=15 not > 15; ctl=ctlWeekAgo (no build/recover) → Maintaining
    expect(deriveTrainingStatus(70, 50, 15, 70, yesterday)).toBe('Maintaining')
  })

  it('returns Recovering when CTL dropped by more than 3', () => {
    // ctl=65, ctlWeekAgo=69 → ctl < ctlWeekAgo-3
    expect(deriveTrainingStatus(65, 50, 5, 69, yesterday)).toBe('Recovering')
  })

  it('returns Maintaining when no other condition triggers', () => {
    // ctl unchanged, tsb=5, atl not spiked, recently active
    expect(deriveTrainingStatus(70, 65, 5, 70, yesterday)).toBe('Maintaining')
  })

  it('Overreaching takes priority over Detraining (checked first)', () => {
    // If ATL spikes AND last session was 7 days ago, still Overreaching
    expect(deriveTrainingStatus(70, 95, 5, 70, sixAgo)).toBe('Overreaching')
  })
})

// ── mapAcwrStatus ─────────────────────────────────────────────────────────────
describe('mapAcwrStatus', () => {
  it('"undertraining" maps to "low"', () => {
    expect(mapAcwrStatus('undertraining')).toBe('low')
  })

  it('"insufficient" maps to "low"', () => {
    expect(mapAcwrStatus('insufficient')).toBe('low')
  })

  it('other known statuses pass through unchanged', () => {
    expect(mapAcwrStatus('optimal')).toBe('optimal')
    expect(mapAcwrStatus('high')).toBe('high')
    expect(mapAcwrStatus('very_high')).toBe('very_high')
  })

  it('null/undefined falls back to "low"', () => {
    expect(mapAcwrStatus(null)).toBe('low')
    expect(mapAcwrStatus(undefined)).toBe('low')
  })

  it('empty string falls back to "low"', () => {
    expect(mapAcwrStatus('')).toBe('low')
  })

  it('arbitrary string passes through', () => {
    expect(mapAcwrStatus('custom_status')).toBe('custom_status')
  })
})

// ── generateDemoSquad ─────────────────────────────────────────────────────────
describe('generateDemoSquad', () => {
  it('returns an array of 6 athletes', () => {
    const squad = generateDemoSquad(42)
    expect(Array.isArray(squad)).toBe(true)
    expect(squad.length).toBe(6)
  })

  it('each athlete has the expected schema fields', () => {
    const squad = generateDemoSquad(42)
    for (const a of squad) {
      expect(a).toHaveProperty('athlete_id')
      expect(a).toHaveProperty('display_name')
      expect(a).toHaveProperty('today_ctl')
      expect(a).toHaveProperty('today_atl')
      expect(a).toHaveProperty('today_tsb')
      expect(a).toHaveProperty('acwr_ratio')
      expect(a).toHaveProperty('acwr_status')
      expect(a).toHaveProperty('last_hrv_score')
      expect(a).toHaveProperty('last_session_date')
      expect(a).toHaveProperty('training_status')
      expect(a).toHaveProperty('adherence_pct')
    }
  })

  it('athlete_ids follow the demo-<name> pattern', () => {
    const squad = generateDemoSquad(42)
    for (const a of squad) {
      expect(a.athlete_id).toMatch(/^demo-\w+$/)
    }
  })

  it('display_names include Eddy, Fausto, Bernard, Miguel, Tadej, Wout', () => {
    const names = generateDemoSquad(42).map(a => a.display_name)
    expect(names).toContain('Eddy')
    expect(names).toContain('Fausto')
    expect(names).toContain('Bernard')
    expect(names).toContain('Miguel')
    expect(names).toContain('Tadej')
    expect(names).toContain('Wout')
  })

  it('CTL values are non-negative numbers', () => {
    const squad = generateDemoSquad(42)
    for (const a of squad) {
      expect(typeof a.today_ctl).toBe('number')
      expect(a.today_ctl).toBeGreaterThanOrEqual(0)
    }
  })

  it('HRV score is within expected 4.5–9 range', () => {
    const squad = generateDemoSquad(42)
    for (const a of squad) {
      expect(a.last_hrv_score).toBeGreaterThanOrEqual(4.5)
      expect(a.last_hrv_score).toBeLessThanOrEqual(9.0)
    }
  })

  it('adherence_pct is a non-negative number', () => {
    // Computed as Math.round(sessions7 / 7 * 100); can exceed 100 for athletes
    // with multiple sessions per day, so we only assert non-negative.
    const squad = generateDemoSquad(42)
    for (const a of squad) {
      expect(typeof a.adherence_pct).toBe('number')
      expect(a.adherence_pct).toBeGreaterThanOrEqual(0)
    }
  })

  it('is deterministic — same seed produces identical squad', () => {
    const squad1 = generateDemoSquad(42)
    const squad2 = generateDemoSquad(42)
    expect(JSON.stringify(squad1)).toBe(JSON.stringify(squad2))
  })

  it('different seeds produce different HRV values', () => {
    const squad1 = generateDemoSquad(1)
    const squad2 = generateDemoSquad(9999)
    const hrv1 = squad1.map(a => a.last_hrv_score).join(',')
    const hrv2 = squad2.map(a => a.last_hrv_score).join(',')
    expect(hrv1).not.toBe(hrv2)
  })

  it('training_status values are from the known status set', () => {
    const validStatuses = new Set([
      'Overreaching', 'Detraining', 'Building', 'Peaking', 'Recovering', 'Maintaining',
    ])
    const squad = generateDemoSquad(42)
    for (const a of squad) {
      expect(validStatuses.has(a.training_status)).toBe(true)
    }
  })

  it('Eddy has Overreaching status (spike pattern)', () => {
    const squad = generateDemoSquad(42)
    const eddy = squad.find(a => a.display_name === 'Eddy')
    expect(eddy.training_status).toBe('Overreaching')
  })

  it('Fausto has Detraining status (stopped pattern)', () => {
    const squad = generateDemoSquad(42)
    const fausto = squad.find(a => a.display_name === 'Fausto')
    expect(fausto.training_status).toBe('Detraining')
  })

  it('squad has internal _log arrays for demo chart rendering', () => {
    const squad = generateDemoSquad(42)
    for (const a of squad) {
      expect(Array.isArray(a._log)).toBe(true)
      expect(a._log.length).toBeGreaterThan(0)
    }
  })

  it('uses seed=42 as default when called with no argument', () => {
    const defaultSquad = generateDemoSquad()
    const seeded42 = generateDemoSquad(42)
    expect(JSON.stringify(defaultSquad)).toBe(JSON.stringify(seeded42))
  })
})
