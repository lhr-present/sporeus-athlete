import { describe, it, expect } from 'vitest'
import { makeLCG, generateDemoSquad, deriveTrainingStatus, mapAcwrStatus } from './squadUtils.js'

// ── makeLCG ───────────────────────────────────────────────────────────────────
describe('makeLCG', () => {
  it('produces values in [0, 1)', () => {
    const rng = makeLCG(42)
    for (let i = 0; i < 20; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('same seed produces same sequence', () => {
    const r1 = makeLCG(99)
    const r2 = makeLCG(99)
    for (let i = 0; i < 10; i++) {
      expect(r1()).toBe(r2())
    }
  })

  it('different seeds produce different sequences', () => {
    const r1 = makeLCG(1)
    const r2 = makeLCG(2)
    const v1 = r1()
    const v2 = r2()
    expect(v1).not.toBe(v2)
  })
})

// ── mapAcwrStatus ─────────────────────────────────────────────────────────────
describe('mapAcwrStatus', () => {
  it('maps undertraining → low', () => {
    expect(mapAcwrStatus('undertraining')).toBe('low')
  })
  it('maps insufficient → low', () => {
    expect(mapAcwrStatus('insufficient')).toBe('low')
  })
  it('passes through valid statuses', () => {
    expect(mapAcwrStatus('optimal')).toBe('optimal')
    expect(mapAcwrStatus('caution')).toBe('caution')
    expect(mapAcwrStatus('danger')).toBe('danger')
  })
})

// ── deriveTrainingStatus ──────────────────────────────────────────────────────
describe('deriveTrainingStatus', () => {
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  it('returns Overreaching when ATL > CTL + 20', () => {
    expect(deriveTrainingStatus(60, 85, -25, 57, today)).toBe('Overreaching')
  })

  it('returns Detraining when last session > 5 days ago', () => {
    const sixDaysAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)
    expect(deriveTrainingStatus(60, 55, 5, 57, sixDaysAgo)).toBe('Detraining')
  })

  it('returns Detraining for null last session date', () => {
    expect(deriveTrainingStatus(50, 45, 5, 47, null)).toBe('Detraining')
  })

  it('returns Building when CTL > ctlWeekAgo + 3', () => {
    expect(deriveTrainingStatus(65, 60, 5, 60, yesterday)).toBe('Building')
  })

  it('returns Peaking when TSB > 15', () => {
    expect(deriveTrainingStatus(70, 50, 20, 68, yesterday)).toBe('Peaking')
  })

  it('returns Recovering when CTL < ctlWeekAgo - 3', () => {
    expect(deriveTrainingStatus(60, 62, -2, 67, yesterday)).toBe('Recovering')
  })

  it('returns Maintaining when no other condition triggers', () => {
    // CTL stable, TSB moderate, ATL not much higher than CTL
    expect(deriveTrainingStatus(60, 58, 2, 60, yesterday)).toBe('Maintaining')
  })
})

// ── generateDemoSquad ─────────────────────────────────────────────────────────
describe('generateDemoSquad', () => {
  it('returns exactly 6 athletes', () => {
    expect(generateDemoSquad(42)).toHaveLength(6)
  })

  it('each athlete has required schema fields', () => {
    const squad = generateDemoSquad(42)
    const REQUIRED = [
      'athlete_id', 'display_name', 'today_ctl', 'today_atl', 'today_tsb',
      'acwr_ratio', 'acwr_status', 'last_hrv_score', 'last_session_date',
      'missed_sessions_7d', 'training_status', 'adherence_pct',
    ]
    for (const a of squad) {
      for (const field of REQUIRED) {
        expect(a, `missing field ${field}`).toHaveProperty(field)
      }
    }
  })

  it('produces identical output for the same seed', () => {
    const s1 = generateDemoSquad(42)
    const s2 = generateDemoSquad(42)
    expect(JSON.stringify(s1)).toBe(JSON.stringify(s2))
  })

  it('produces different output for different seeds', () => {
    const s1 = generateDemoSquad(1)
    const s2 = generateDemoSquad(2)
    expect(s1[0].last_hrv_score).not.toBe(s2[0].last_hrv_score)
  })

  it('all CTL values are positive numbers', () => {
    const squad = generateDemoSquad(42)
    for (const a of squad) {
      expect(a.today_ctl).toBeGreaterThan(0)
      expect(typeof a.today_ctl).toBe('number')
    }
  })

  it('acwr_status is a valid value for each athlete', () => {
    const VALID = ['optimal', 'caution', 'danger', 'low']
    const squad = generateDemoSquad(42)
    for (const a of squad) {
      expect(VALID).toContain(a.acwr_status)
    }
  })

  it('training_status is a valid label for each athlete', () => {
    const VALID = ['Overreaching', 'Detraining', 'Building', 'Peaking', 'Recovering', 'Maintaining']
    const squad = generateDemoSquad(42)
    for (const a of squad) {
      expect(VALID).toContain(a.training_status)
    }
  })

  it('shows a variety of training statuses (at least 4 distinct)', () => {
    const squad = generateDemoSquad(42)
    const statuses = new Set(squad.map(a => a.training_status))
    expect(statuses.size).toBeGreaterThanOrEqual(4)
  })

  it('last_hrv_score is in plausible range [3, 10]', () => {
    const squad = generateDemoSquad(42)
    for (const a of squad) {
      expect(a.last_hrv_score).toBeGreaterThanOrEqual(3)
      expect(a.last_hrv_score).toBeLessThanOrEqual(10)
    }
  })

  it('_log is present with entries for CTLChart rendering', () => {
    const squad = generateDemoSquad(42)
    for (const a of squad) {
      expect(Array.isArray(a._log)).toBe(true)
      if (a._log.length > 0) {
        expect(a._log[0]).toHaveProperty('date')
        expect(a._log[0]).toHaveProperty('tss')
      }
    }
  })
})
