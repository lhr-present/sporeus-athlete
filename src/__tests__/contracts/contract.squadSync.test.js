// @vitest-environment node
// ─── Contract C7: mv_squad_readiness → get_squad_overview → CoachDashboard ───────
// Validates the get_squad_overview output shape and that CoachDashboard
// helper functions handle all documented variants without NaN/null crashes.

import { describe, it, expect } from 'vitest'

// ── get_squad_overview return shape ────────────────────────────────────────────

const VALID_ACWR_STATUSES    = ['low', 'caution', 'optimal', 'danger']
const VALID_TRAINING_STATUSES = ['Overreaching', 'Detraining', 'Building', 'Peaking', 'Recovering', 'Maintaining']

function isValidAthleteOverview(row) {
  return (
    typeof row === 'object' && row !== null &&
    typeof row.athlete_id          === 'string' &&
    typeof row.display_name        === 'string' &&
    typeof row.today_ctl           === 'number' &&
    typeof row.today_atl           === 'number' &&
    typeof row.today_tsb           === 'number' &&
    typeof row.acwr_ratio          === 'number' &&
    VALID_ACWR_STATUSES.includes(row.acwr_status) &&
    (row.last_hrv_score   === null || typeof row.last_hrv_score   === 'number') &&
    (row.last_session_date === null || typeof row.last_session_date === 'string') &&
    typeof row.missed_sessions_7d  === 'number' &&
    VALID_TRAINING_STATUSES.includes(row.training_status) &&
    typeof row.adherence_pct       === 'number' && row.adherence_pct >= 0 && row.adherence_pct <= 100
  )
}

// ── Pure replica of CoachDashboard computeAthleteMetrics ──────────────────────
function daysBefore(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
}

function computeAthleteMetrics(athlete) {
  const log      = athlete.log      || []
  const recovery = athlete.recovery || []
  const d7  = daysBefore(7)
  const d28 = daysBefore(28)

  const log7  = log.filter(e => e.date >= d7)
  const log28 = log.filter(e => e.date >= d28)
  const tss7  = log7.reduce((s, e) => s + (e.tss || 0), 0)
  const chronic28 = log28.reduce((s, e) => s + (e.tss || 0), 0) / 4

  let acwr = null
  if (chronic28 > 0) acwr = Math.round((tss7 / chronic28) * 100) / 100

  const lastRec   = [...recovery].sort((a, b) => b.date > a.date ? 1 : -1)[0]
  const readiness = lastRec?.score ?? null

  return { acwr, readiness }
}

describe('C7 — squad overview contract', () => {
  describe('get_squad_overview row shape', () => {
    const validRow = {
      athlete_id: 'u1', display_name: 'Ali',
      today_ctl: 52.3, today_atl: 58.1, today_tsb: -5.8,
      acwr_ratio: 1.12, acwr_status: 'caution',
      last_hrv_score: 68.4, last_session_date: '2026-04-17',
      missed_sessions_7d: 1, training_status: 'Building',
      adherence_pct: 85,
    }

    it('valid row passes shape check', () => {
      expect(isValidAthleteOverview(validRow)).toBe(true)
    })

    it('acwr_status must be one of four values', () => {
      for (const s of VALID_ACWR_STATUSES) {
        expect(isValidAthleteOverview({ ...validRow, acwr_status: s })).toBe(true)
      }
      expect(isValidAthleteOverview({ ...validRow, acwr_status: 'high' })).toBe(false)
    })

    it('training_status must be one of six values', () => {
      for (const s of VALID_TRAINING_STATUSES) {
        expect(isValidAthleteOverview({ ...validRow, training_status: s })).toBe(true)
      }
      expect(isValidAthleteOverview({ ...validRow, training_status: 'Unknown' })).toBe(false)
    })

    it('today_ctl/atl/tsb are 0 (not null) for new athletes', () => {
      const newAthlete = { ...validRow, today_ctl: 0, today_atl: 0, today_tsb: 0 }
      expect(isValidAthleteOverview(newAthlete)).toBe(true)
    })

    it('last_hrv_score can be null', () => {
      expect(isValidAthleteOverview({ ...validRow, last_hrv_score: null })).toBe(true)
    })

    it('last_session_date can be null', () => {
      expect(isValidAthleteOverview({ ...validRow, last_session_date: null })).toBe(true)
    })

    it('adherence_pct is bounded 0–100', () => {
      expect(isValidAthleteOverview({ ...validRow, adherence_pct: -1 })).toBe(false)
      expect(isValidAthleteOverview({ ...validRow, adherence_pct: 101 })).toBe(false)
    })
  })

  describe('computeAthleteMetrics — empty athlete', () => {
    it('returns null acwr for athlete with no sessions', () => {
      const { acwr } = computeAthleteMetrics({ log: [], recovery: [] })
      expect(acwr).toBeNull()
    })

    it('returns null readiness for athlete with no recovery logs', () => {
      const { readiness } = computeAthleteMetrics({ log: [], recovery: [] })
      expect(readiness).toBeNull()
    })

    it('does not crash with undefined log/recovery', () => {
      expect(() => computeAthleteMetrics({})).not.toThrow()
    })
  })

  describe('computeAthleteMetrics — normal athlete', () => {
    const today = new Date().toISOString().slice(0, 10)
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

    it('computes acwr when chronic load is positive', () => {
      const log = Array.from({ length: 28 }, (_, i) => ({
        date: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10),
        tss: 80,
      }))
      const { acwr } = computeAthleteMetrics({ log })
      expect(acwr).not.toBeNull()
      expect(typeof acwr).toBe('number')
    })

    it('returns most recent recovery score', () => {
      const recovery = [
        { date: yesterday, score: 72 },
        { date: today,     score: 85 },
      ]
      const { readiness } = computeAthleteMetrics({ log: [], recovery })
      expect(readiness).toBe(85)
    })
  })
})
