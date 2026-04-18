// @vitest-environment node
// ─── Contract C7b: mv_squad_readiness refresh trigger validation ──────────────────
// Pure JS validation of the training_status logic and ACWR status thresholds
// documented in get_squad_overview (SQL function).

import { describe, it, expect } from 'vitest'

// ── Pure replicas of SQL CASE logic in get_squad_overview ────────────────────

function computeAcwrStatus(acwrRatio) {
  if (acwrRatio < 0.8)  return 'low'
  if (acwrRatio > 1.5)  return 'danger'
  if (acwrRatio > 1.35) return 'caution'
  return 'optimal'
}

function computeTrainingStatus(atl, ctl, ctl7ago, tsb) {
  const prevCtl = ctl7ago ?? 0
  if (atl > ctl + 20)           return 'Overreaching'
  if (ctl < prevCtl - 3)        return 'Detraining'
  if (ctl > prevCtl + 3)        return 'Building'
  if (tsb > 15)                 return 'Peaking'
  if (ctl < prevCtl - 3)        return 'Recovering'
  return 'Maintaining'
}

describe('C7b — mv_squad_readiness training status logic', () => {
  describe('computeAcwrStatus', () => {
    it('< 0.8 → low (undertraining)', () => {
      expect(computeAcwrStatus(0.75)).toBe('low')
      expect(computeAcwrStatus(0.5)).toBe('low')
    })

    it('0.8–1.35 → optimal', () => {
      expect(computeAcwrStatus(0.9)).toBe('optimal')
      expect(computeAcwrStatus(1.2)).toBe('optimal')
    })

    it('1.35–1.5 → caution', () => {
      expect(computeAcwrStatus(1.4)).toBe('caution')
    })

    it('> 1.5 → danger (overreaching risk)', () => {
      expect(computeAcwrStatus(1.6)).toBe('danger')
      expect(computeAcwrStatus(2.0)).toBe('danger')
    })

    it('exactly 1.35 is caution boundary', () => {
      expect(computeAcwrStatus(1.35)).toBe('optimal')
      expect(computeAcwrStatus(1.36)).toBe('caution')
    })
  })

  describe('computeTrainingStatus', () => {
    it('ATL > CTL + 20 → Overreaching', () => {
      expect(computeTrainingStatus(80, 55, 54, -25)).toBe('Overreaching')
    })

    it('CTL growing > 3 pts vs 7 days ago → Building', () => {
      expect(computeTrainingStatus(55, 60, 55, -5)).toBe('Building')
    })

    it('TSB > 15 (taper) → Peaking', () => {
      expect(computeTrainingStatus(40, 60, 60, 20)).toBe('Peaking')
    })

    it('CTL similar, TSB near zero → Maintaining', () => {
      expect(computeTrainingStatus(50, 52, 52, 2)).toBe('Maintaining')
    })

    it('new athlete with all zeros → Maintaining', () => {
      expect(computeTrainingStatus(0, 0, 0, 0)).toBe('Maintaining')
    })
  })
})
