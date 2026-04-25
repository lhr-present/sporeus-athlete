// ─── cyclePlanner.test.js — E31 cycle planner unit tests ────────────────────
import { describe, it, expect } from 'vitest'
import { computeCyclePlan, phaseTrainingRec } from '../../athlete/cyclePlanner.js'
import { PHASES } from '../../cycleUtils.js'

// ─── computeCyclePlan: null-guard tests ──────────────────────────────────────
describe('computeCyclePlan — null guards', () => {
  it('returns null when gender is not female', () => {
    expect(computeCyclePlan({ gender: 'male', lastPeriodStart: '2026-04-01', cycleLength: 28 })).toBeNull()
  })

  it('returns null when gender is missing', () => {
    expect(computeCyclePlan({ lastPeriodStart: '2026-04-01', cycleLength: 28 })).toBeNull()
  })

  it('returns null when lastPeriodStart is falsy (undefined)', () => {
    expect(computeCyclePlan({ gender: 'female', cycleLength: 28 })).toBeNull()
  })

  it('returns null when lastPeriodStart is empty string', () => {
    expect(computeCyclePlan({ gender: 'female', lastPeriodStart: '', cycleLength: 28 })).toBeNull()
  })

  it('returns null when gender is empty string', () => {
    expect(computeCyclePlan({ gender: '', lastPeriodStart: '2026-04-01' })).toBeNull()
  })
})

// ─── computeCyclePlan: valid profile ─────────────────────────────────────────
// With cycleLength=28 and ovDay=14:
//   menstruation: days 1-5    → lastPeriodStart 1 day ago → day 2 → menstruation
//   follicular:   days 6-13   → lastPeriodStart 8 days ago → day 9 → follicular
//   ovulation:    days 14-15  → lastPeriodStart 13 days ago → day 14 → ovulation
//   luteal:       days 16-28  → lastPeriodStart 20 days ago → day 21 → luteal
describe('computeCyclePlan — valid female profile', () => {
  const makeProfile = (daysAgo, cycleLength = 28) => {
    const d = new Date('2026-04-25')
    d.setDate(d.getDate() - daysAgo)
    return {
      gender: 'female',
      lastPeriodStart: d.toISOString().slice(0, 10),
      cycleLength,
    }
  }
  const TODAY = '2026-04-25'

  it('returns phase=menstruation when lastPeriodStart is 1 day ago', () => {
    const result = computeCyclePlan(makeProfile(1), TODAY)
    expect(result).not.toBeNull()
    expect(result.phase).toBe('menstruation')
  })

  it('returns phase=follicular when lastPeriodStart is 8 days ago', () => {
    const result = computeCyclePlan(makeProfile(8), TODAY)
    expect(result.phase).toBe('follicular')
  })

  it('returns phase=ovulation when lastPeriodStart is 13 days ago', () => {
    const result = computeCyclePlan(makeProfile(13), TODAY)
    expect(result.phase).toBe('ovulation')
  })

  it('returns phase=luteal when lastPeriodStart is 20 days ago', () => {
    const result = computeCyclePlan(makeProfile(20), TODAY)
    expect(result.phase).toBe('luteal')
  })

  it('allPhases has length 4', () => {
    const result = computeCyclePlan(makeProfile(8), TODAY)
    expect(result.allPhases).toHaveLength(4)
  })

  it('daysUntilNext is >= 0', () => {
    const result = computeCyclePlan(makeProfile(8), TODAY)
    expect(result.daysUntilNext).toBeGreaterThanOrEqual(0)
  })

  it('phaseInfo has a color property', () => {
    const result = computeCyclePlan(makeProfile(8), TODAY)
    expect(result.phaseInfo).toHaveProperty('color')
    expect(typeof result.phaseInfo.color).toBe('string')
  })

  it('dayInCycle matches expected cycle day', () => {
    // 8 days ago → day 9 of cycle
    const result = computeCyclePlan(makeProfile(8), TODAY)
    expect(result.dayInCycle).toBe(9)
  })

  it('cycleLength is preserved from profile', () => {
    const result = computeCyclePlan(makeProfile(8, 30), TODAY)
    expect(result.cycleLength).toBe(30)
  })

  it('defaults cycleLength to 28 when not provided', () => {
    const d = new Date('2026-04-25')
    d.setDate(d.getDate() - 8)
    const result = computeCyclePlan({ gender: 'female', lastPeriodStart: d.toISOString().slice(0, 10) }, TODAY)
    expect(result.cycleLength).toBe(28)
  })

  it('nextPhase is a valid PHASES entry', () => {
    const result = computeCyclePlan(makeProfile(8), TODAY)
    expect(PHASES).toContain(result.nextPhase)
  })

  it('nextPhase follows current phase in cycle order', () => {
    const result = computeCyclePlan(makeProfile(8), TODAY) // follicular
    expect(result.phase).toBe('follicular')
    expect(result.nextPhase).toBe('ovulation')
  })
})

// ─── phaseTrainingRec ─────────────────────────────────────────────────────────
describe('phaseTrainingRec — intensity levels', () => {
  it('menstruation → low intensity', () => {
    expect(phaseTrainingRec('menstruation').intensity).toBe('low')
  })

  it('follicular → high intensity', () => {
    expect(phaseTrainingRec('follicular').intensity).toBe('high')
  })

  it('ovulation → high intensity', () => {
    expect(phaseTrainingRec('ovulation').intensity).toBe('high')
  })

  it('luteal → moderate intensity', () => {
    expect(phaseTrainingRec('luteal').intensity).toBe('moderate')
  })
})

// ─── phaseTrainingRec smoke tests ─────────────────────────────────────────────
describe('phaseTrainingRec — smoke tests', () => {
  PHASES.forEach(phase => {
    it(`does not throw for phase "${phase}"`, () => {
      expect(() => phaseTrainingRec(phase)).not.toThrow()
    })

    it(`returns tip_en and tip_tr for "${phase}"`, () => {
      const rec = phaseTrainingRec(phase)
      expect(typeof rec.tip_en).toBe('string')
      expect(typeof rec.tip_tr).toBe('string')
      expect(rec.tip_en.length).toBeGreaterThan(0)
      expect(rec.tip_tr.length).toBeGreaterThan(0)
    })
  })

  it('returns null for unknown phase string', () => {
    expect(phaseTrainingRec('unknown')).toBeNull()
  })
})
