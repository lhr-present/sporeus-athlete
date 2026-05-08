import { describe, it, expect } from 'vitest'
import {
  buildPlanMilestones,
  getNextMilestone,
  daysUntil,
  PLAN_MILESTONE_CITATION,
} from '../../athlete/planMilestones.js'

const FULL_PROGRAM = {
  sport: 'run',
  feasibility: { effectiveRaceDate: '2026-08-15' },
  input: { raceDate: '2026-08-15' },
  phases: [
    { phase: 'Base',  weeks: [1, 2, 3, 4, 5, 6, 7, 8] },
    { phase: 'Build', weeks: [9, 10, 11, 12] },
    { phase: 'Peak',  weeks: [13, 14, 15] },
    { phase: 'Taper', weeks: [16] },
  ],
}

describe('planMilestones', () => {
  it('exports a citation', () => {
    expect(PLAN_MILESTONE_CITATION).toMatch(/Mujika|Bompa/)
  })

  describe('buildPlanMilestones', () => {
    it('returns 4 milestones for a full Base/Build/Peak/Taper program with raceDate', () => {
      const ms = buildPlanMilestones(FULL_PROGRAM, '2026-04-27')  // Monday
      expect(ms.length).toBe(4)
      const types = ms.map(m => m.type)
      expect(types).toContain('field-test')
      expect(types).toContain('race-pace-primer')
      expect(types).toContain('taper-start')
      expect(types).toContain('race-day')
    })

    it('orders milestones chronologically', () => {
      const ms = buildPlanMilestones(FULL_PROGRAM, '2026-04-27')
      for (let i = 1; i < ms.length; i++) {
        expect(ms[i].dateISO >= ms[i - 1].dateISO).toBe(true)
      }
    })

    it('field-test placed on Wednesday of last Base week', () => {
      const ms = buildPlanMilestones(FULL_PROGRAM, '2026-04-27')
      const ft = ms.find(m => m.type === 'field-test')
      expect(ft).toBeTruthy()
      expect(ft.weekNum).toBe(8)
      // 2026-04-27 (Mon) + week 8 (idx 7) * 7 + 2 (Wed) = 51 days = 2026-06-17
      expect(ft.dateISO).toBe('2026-06-17')
    })

    it('race-pace-primer placed on Saturday mid-Peak', () => {
      const ms = buildPlanMilestones(FULL_PROGRAM, '2026-04-27')
      const rpp = ms.find(m => m.type === 'race-pace-primer')
      expect(rpp).toBeTruthy()
      // mid-Peak = floor((13+15)/2) = 14; week idx 13 * 7 + 5 (Sat) = 96 days = 2026-08-01
      expect(rpp.weekNum).toBe(14)
      expect(rpp.dateISO).toBe('2026-08-01')
    })

    it('taper-start placed on Monday of first Taper week', () => {
      const ms = buildPlanMilestones(FULL_PROGRAM, '2026-04-27')
      const ts = ms.find(m => m.type === 'taper-start')
      expect(ts).toBeTruthy()
      expect(ts.weekNum).toBe(16)
      // week idx 15 * 7 = 105 days = 2026-08-10
      expect(ts.dateISO).toBe('2026-08-10')
    })

    it('race-day uses feasibility.effectiveRaceDate', () => {
      const ms = buildPlanMilestones(FULL_PROGRAM, '2026-04-27')
      const rd = ms.find(m => m.type === 'race-day')
      expect(rd).toBeTruthy()
      expect(rd.dateISO).toBe('2026-08-15')
    })

    it('falls back to input.raceDate when feasibility missing', () => {
      const p = { ...FULL_PROGRAM, feasibility: {} }
      const ms = buildPlanMilestones(p, '2026-04-27')
      const rd = ms.find(m => m.type === 'race-day')
      expect(rd?.dateISO).toBe('2026-08-15')
    })

    it('omits race-day when no race date present', () => {
      const p = { ...FULL_PROGRAM, feasibility: {}, input: {} }
      const ms = buildPlanMilestones(p, '2026-04-27')
      expect(ms.find(m => m.type === 'race-day')).toBeUndefined()
    })

    it('field-test uses Build when no Base', () => {
      const p = {
        sport: 'run',
        feasibility: { effectiveRaceDate: '2026-08-15' },
        phases: [
          { phase: 'Build', weeks: [1, 2, 3, 4] },
          { phase: 'Peak',  weeks: [5, 6] },
          { phase: 'Taper', weeks: [7] },
        ],
      }
      const ms = buildPlanMilestones(p, '2026-04-27')
      const ft = ms.find(m => m.type === 'field-test')
      expect(ft?.weekNum).toBe(4)
      expect(ft?.phase).toBe('Build')
    })

    it('omits race-pace-primer when no Peak phase', () => {
      const p = {
        sport: 'run',
        feasibility: { effectiveRaceDate: '2026-08-15' },
        phases: [
          { phase: 'Base',  weeks: [1, 2, 3] },
          { phase: 'Taper', weeks: [4] },
        ],
      }
      const ms = buildPlanMilestones(p, '2026-04-27')
      expect(ms.find(m => m.type === 'race-pace-primer')).toBeUndefined()
    })

    it('omits taper-start when no Taper', () => {
      const p = {
        sport: 'run',
        feasibility: { effectiveRaceDate: '2026-08-15' },
        phases: [
          { phase: 'Base',  weeks: [1, 2, 3] },
          { phase: 'Build', weeks: [4, 5] },
        ],
      }
      const ms = buildPlanMilestones(p, '2026-04-27')
      expect(ms.find(m => m.type === 'taper-start')).toBeUndefined()
    })

    it('every milestone has bilingual EN+TR labels', () => {
      const ms = buildPlanMilestones(FULL_PROGRAM, '2026-04-27')
      for (const m of ms) {
        expect(m.label.en).toBeTruthy()
        expect(m.label.tr).toBeTruthy()
      }
    })

    it('returns empty array for invalid input', () => {
      expect(buildPlanMilestones(null, '2026-04-27')).toEqual([])
      expect(buildPlanMilestones(FULL_PROGRAM, 'not-a-date')).toEqual([])
      expect(buildPlanMilestones({ phases: [] }, '2026-04-27')).toEqual([])
    })
  })

  describe('getNextMilestone', () => {
    const milestones = [
      { dateISO: '2026-06-17', type: 'field-test', label: { en: 'a', tr: 'a' }, weekNum: 8, phase: 'Base' },
      { dateISO: '2026-08-01', type: 'race-pace-primer', label: { en: 'b', tr: 'b' }, weekNum: 14, phase: 'Peak' },
      { dateISO: '2026-08-10', type: 'taper-start', label: { en: 'c', tr: 'c' }, weekNum: 16, phase: 'Taper' },
      { dateISO: '2026-08-15', type: 'race-day', label: { en: 'd', tr: 'd' }, weekNum: 16, phase: 'Race' },
    ]

    it('returns the next future milestone', () => {
      const m = getNextMilestone(milestones, '2026-07-01')
      expect(m?.type).toBe('race-pace-primer')
    })

    it('returns first milestone when today is before all', () => {
      const m = getNextMilestone(milestones, '2026-04-01')
      expect(m?.type).toBe('field-test')
    })

    it('returns null when today is after all milestones', () => {
      const m = getNextMilestone(milestones, '2026-09-01')
      expect(m).toBeNull()
    })

    it('returns null for empty/invalid input', () => {
      expect(getNextMilestone([], '2026-07-01')).toBeNull()
      expect(getNextMilestone(null, '2026-07-01')).toBeNull()
    })
  })

  describe('daysUntil', () => {
    it('counts days correctly', () => {
      expect(daysUntil('2026-08-15', '2026-08-08')).toBe(7)
    })

    it('returns 0 for same day', () => {
      expect(daysUntil('2026-08-15', '2026-08-15')).toBe(0)
    })

    it('returns negative for past', () => {
      expect(daysUntil('2026-08-15', '2026-08-22')).toBe(-7)
    })

    it('returns null for invalid input', () => {
      expect(daysUntil('bad', '2026-08-15')).toBeNull()
      expect(daysUntil('2026-08-15', 'bad')).toBeNull()
    })
  })
})
