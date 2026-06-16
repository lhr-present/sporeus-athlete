// @vitest-environment node
// ─── Contract C7b: get_squad_overview training_status + ACWR thresholds ───────────
// Validates the training_status logic and ACWR status thresholds against the REAL
// producer: the SQL function get_squad_overview. The ACWR thresholds are PARSED
// from the live migration so the JS replica can't silently drift from the SQL; the
// training_status replica is pinned (by comment + tests) to the same migration.
//
// round-3 test-integrity finding: the old replica had DRIFTED — it used caution
// >1.35 (SQL: >1.3), Peaking on tsb>15 from a separately-passed tsb (SQL derives
// (ctl-atl)>15), and was MISSING the Detraining branch entirely. Corrected here.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Latest live definition of get_squad_overview (CREATE OR REPLACE base for the
// load-signals pass). Pin to this so threshold edits in SQL surface here.
const SQL = readFileSync(
  resolve(__dirname, '../../../supabase/migrations/20260628_squad_overview_load_signals.sql'),
  'utf8',
)

// ── Parse the ACWR thresholds straight out of the SQL CASE so they can't drift ──
// SQL (verbatim):
//   when acwr_ratio > 1.5  then 'danger'
//   when acwr_ratio > 1.3  then 'caution'
//   when acwr_ratio >= 0.8 then 'optimal'
//   else 'low'
function parseAcwrThresholds(sql) {
  const danger  = sql.match(/when\s+acwr_ratio\s*>\s*([\d.]+)\s+then\s+'danger'/i)
  const caution = sql.match(/when\s+acwr_ratio\s*>\s*([\d.]+)\s+then\s+'caution'/i)
  const optimal = sql.match(/when\s+acwr_ratio\s*>=\s*([\d.]+)\s+then\s+'optimal'/i)
  if (!danger || !caution || !optimal) {
    throw new Error('Could not parse ACWR thresholds from get_squad_overview SQL')
  }
  return {
    danger:  parseFloat(danger[1]),   // 1.5  (strict >)
    caution: parseFloat(caution[1]),  // 1.3  (strict >)
    optimal: parseFloat(optimal[1]),  // 0.8  (>=)
  }
}

const ACWR = parseAcwrThresholds(SQL)

// Replica built FROM the parsed thresholds — mirrors the SQL CASE order exactly.
function computeAcwrStatus(acwrRatio) {
  if (acwrRatio > ACWR.danger)   return 'danger'
  if (acwrRatio > ACWR.caution)  return 'caution'
  if (acwrRatio >= ACWR.optimal) return 'optimal'
  return 'low'
}

// training_status replica — pinned to get_squad_overview (20260628). The SQL CASE
// (lines 165–173) in branch order:
//   1. _atl > _ctl + 20                        → 'Overreaching'
//   2. last_session_date null OR < today-4     → 'Detraining'
//   3. _ctl > _ctl_7ago + 3                    → 'Building'
//   4. (_ctl - _atl) > 15                       → 'Peaking'
//   5. _ctl < _ctl_7ago - 3                     → 'Recovering'
//   6. else                                     → 'Maintaining'
// daysSinceLastSession: null = no sessions ever; integer = today - last_session_date.
function computeTrainingStatus({ atl, ctl, ctl7ago, daysSinceLastSession }) {
  const prevCtl = ctl7ago ?? 0
  if (atl > ctl + 20)                                                   return 'Overreaching'
  if (daysSinceLastSession === null || daysSinceLastSession > 4)        return 'Detraining'
  if (ctl > prevCtl + 3)                                                return 'Building'
  if (ctl - atl > 15)                                                   return 'Peaking'
  if (ctl < prevCtl - 3)                                                return 'Recovering'
  return 'Maintaining'
}

describe('C7b — get_squad_overview training status + ACWR thresholds', () => {
  describe('ACWR thresholds match the SQL', () => {
    it('parsed thresholds equal the live SQL values', () => {
      expect(ACWR).toEqual({ danger: 1.5, caution: 1.3, optimal: 0.8 })
    })
  })

  describe('computeAcwrStatus', () => {
    it('< 0.8 → low (undertraining)', () => {
      expect(computeAcwrStatus(0.79)).toBe('low')
      expect(computeAcwrStatus(0.5)).toBe('low')
    })

    it('0.8–1.3 → optimal', () => {
      expect(computeAcwrStatus(0.8)).toBe('optimal')   // >= 0.8 boundary
      expect(computeAcwrStatus(0.9)).toBe('optimal')
      expect(computeAcwrStatus(1.2)).toBe('optimal')
      expect(computeAcwrStatus(1.3)).toBe('optimal')   // 1.3 is NOT > 1.3
    })

    it('1.3–1.5 → caution', () => {
      expect(computeAcwrStatus(1.31)).toBe('caution')  // just over 1.3
      expect(computeAcwrStatus(1.4)).toBe('caution')
      expect(computeAcwrStatus(1.5)).toBe('caution')   // 1.5 is NOT > 1.5
    })

    it('> 1.5 → danger (overreaching risk)', () => {
      expect(computeAcwrStatus(1.51)).toBe('danger')
      expect(computeAcwrStatus(2.0)).toBe('danger')
    })

    it('boundary: exactly 1.3 is optimal, 1.31 is caution', () => {
      expect(computeAcwrStatus(1.3)).toBe('optimal')
      expect(computeAcwrStatus(1.31)).toBe('caution')
    })
  })

  describe('computeTrainingStatus', () => {
    it('ATL > CTL + 20 → Overreaching', () => {
      expect(computeTrainingStatus({ atl: 80, ctl: 55, ctl7ago: 54, daysSinceLastSession: 0 })).toBe('Overreaching')
    })

    it('no session in >4 days → Detraining', () => {
      expect(computeTrainingStatus({ atl: 30, ctl: 40, ctl7ago: 40, daysSinceLastSession: 5 })).toBe('Detraining')
    })

    it('never trained (null last session) → Detraining', () => {
      expect(computeTrainingStatus({ atl: 0, ctl: 0, ctl7ago: 0, daysSinceLastSession: null })).toBe('Detraining')
    })

    it('CTL growing > 3 pts vs 7 days ago → Building', () => {
      expect(computeTrainingStatus({ atl: 55, ctl: 60, ctl7ago: 55, daysSinceLastSession: 0 })).toBe('Building')
    })

    it('CTL − ATL > 15 (taper) → Peaking', () => {
      // ctl-atl = 20 > 15; CTL not growing (60 vs 60) so it falls through to Peaking.
      expect(computeTrainingStatus({ atl: 40, ctl: 60, ctl7ago: 60, daysSinceLastSession: 1 })).toBe('Peaking')
    })

    it('CTL dropping > 3 pts → Recovering', () => {
      expect(computeTrainingStatus({ atl: 48, ctl: 50, ctl7ago: 55, daysSinceLastSession: 1 })).toBe('Recovering')
    })

    it('CTL similar, fresh session → Maintaining', () => {
      expect(computeTrainingStatus({ atl: 50, ctl: 52, ctl7ago: 52, daysSinceLastSession: 1 })).toBe('Maintaining')
    })
  })

  describe('SQL pins (guard against producer drift)', () => {
    it('Peaking branch uses (ctl - atl) > 15, not a passed-in tsb', () => {
      expect(SQL).toMatch(/\(_ctl\s*-\s*_atl\)\s*>\s*15\s+then\s+'Peaking'/i)
    })
    it('Detraining branch exists (last_session_date null or < today-4)', () => {
      expect(SQL).toMatch(/last_session_date\s+is\s+null/i)
      expect(SQL).toMatch(/last_session_date\s*<\s*current_date\s*-\s*4[\s\S]*?then\s+'Detraining'/i)
    })
    it('Overreaching branch uses atl > ctl + 20', () => {
      expect(SQL).toMatch(/_atl\s*>\s*_ctl\s*\+\s*20\s+then\s+'Overreaching'/i)
    })
  })
})
