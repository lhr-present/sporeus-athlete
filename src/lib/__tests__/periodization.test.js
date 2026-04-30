import { describe, it, expect } from 'vitest'
import {
  buildYearlyPlan,
  validatePlan,
  updateWeekTSS,
  exportPlanCSV,
} from '../periodization.js'

// ─── helpers ──────────────────────────────────────────────────────────────────
const monday = '2025-01-06'  // a known Monday

function minPlan(overrides = {}) {
  return buildYearlyPlan({ startDate: monday, ...overrides })
}

const VALID_PHASES = ['Base', 'Build', 'Peak', 'Race', 'Recovery', 'Transition']

// ─── buildYearlyPlan — structure ──────────────────────────────────────────────
describe('buildYearlyPlan — structure', () => {
  it('always returns exactly 52 weeks', () => {
    const { weeks } = minPlan()
    expect(weeks).toHaveLength(52)
  })

  it('returns { weeks, warnings, projectedCTL }', () => {
    const result = minPlan()
    expect(result).toHaveProperty('weeks')
    expect(result).toHaveProperty('warnings')
    expect(result).toHaveProperty('projectedCTL')
  })

  it('each week has required fields', () => {
    const { weeks } = minPlan()
    for (const w of weeks) {
      expect(w).toHaveProperty('weekStart')
      expect(w).toHaveProperty('weekNum')
      expect(w).toHaveProperty('phase')
      expect(w).toHaveProperty('targetTSS')
      expect(w).toHaveProperty('plannedHours')
      expect(w).toHaveProperty('zoneDistribution')
      expect(w).toHaveProperty('isDeload')
    }
  })

  it('weekNum is sequential 1–52', () => {
    const { weeks } = minPlan()
    weeks.forEach((w, i) => expect(w.weekNum).toBe(i + 1))
  })

  it('all phase values are valid strings', () => {
    const { weeks } = minPlan()
    for (const w of weeks) {
      expect(VALID_PHASES).toContain(w.phase)
    }
  })

  it('all targetTSS values are non-negative numbers', () => {
    const { weeks } = minPlan()
    for (const w of weeks) {
      expect(typeof w.targetTSS).toBe('number')
      expect(w.targetTSS).toBeGreaterThanOrEqual(0)
    }
  })

  it('plannedHours is approximately targetTSS / 60', () => {
    const { weeks } = minPlan()
    for (const w of weeks) {
      const expected = Math.round(w.targetTSS / 60 * 10) / 10
      expect(w.plannedHours).toBe(expected)
    }
  })

  it('null params (no startDate) throws RangeError on date construction', () => {
    expect(() => buildYearlyPlan(null)).toThrow(RangeError)
  })

  it('undefined params (no startDate) throws RangeError on date construction', () => {
    expect(() => buildYearlyPlan(undefined)).toThrow(RangeError)
  })
})

// ─── buildYearlyPlan — date arithmetic ────────────────────────────────────────
describe('buildYearlyPlan — date arithmetic', () => {
  it('week 1 start is a Monday', () => {
    const { weeks } = minPlan({ startDate: monday })
    const d = new Date(weeks[0].weekStart)
    // UTC day: 1 = Monday
    expect(d.getUTCDay()).toBe(1)
  })

  it('consecutive weeks are 7 days apart', () => {
    const { weeks } = minPlan()
    for (let i = 1; i < weeks.length; i++) {
      const prev = new Date(weeks[i - 1].weekStart).getTime()
      const curr = new Date(weeks[i].weekStart).getTime()
      expect(curr - prev).toBe(7 * 86400000)
    }
  })

  it('no weekStart is an Invalid Date', () => {
    const { weeks } = minPlan()
    for (const w of weeks) {
      const d = new Date(w.weekStart)
      expect(isNaN(d.getTime())).toBe(false)
    }
  })

  it('non-Monday startDate is still normalized to Monday', () => {
    // 2025-01-08 is a Wednesday
    const { weeks } = buildYearlyPlan({ startDate: '2025-01-08' })
    const d = new Date(weeks[0].weekStart)
    expect(d.getUTCDay()).toBe(1)
  })
})

// ─── buildYearlyPlan — phase assignment ──────────────────────────────────────
describe('buildYearlyPlan — phase assignment with A race', () => {
  const raceDate = '2025-04-14'  // week ~14 from Jan 6

  it('week containing race date has phase Race', () => {
    const { weeks } = minPlan({ races: [{ date: raceDate, name: 'Spring Race', priority: 'A' }] })
    const raceWeek = weeks.find(w => w.raceDate === raceDate)
    expect(raceWeek).toBeDefined()
    expect(raceWeek.phase).toBe('Race')
  })

  it('week immediately after A race has phase Recovery', () => {
    const { weeks } = minPlan({ races: [{ date: raceDate, name: 'Spring Race', priority: 'A' }] })
    const raceIdx = weeks.findIndex(w => w.raceDate === raceDate)
    expect(weeks[raceIdx + 1].phase).toBe('Recovery')
  })

  it('weeks well before A race (>10 weeks out) are Base', () => {
    const { weeks } = minPlan({ races: [{ date: raceDate, name: 'Spring Race', priority: 'A' }] })
    // Week 1 is >10 weeks before ~week 14
    expect(weeks[0].phase).toBe('Base')
  })

  it('weeks 3–10 before A race are Build', () => {
    const { weeks } = minPlan({ races: [{ date: raceDate, name: 'Spring Race', priority: 'A' }] })
    const raceIdx = weeks.findIndex(w => w.raceDate === raceDate)
    // 5 weeks before race should be Build
    const buildCandidate = weeks[raceIdx - 5]
    expect(buildCandidate.phase).toBe('Build')
  })

  it('weeks 1–2 before A race are Peak', () => {
    const { weeks } = minPlan({ races: [{ date: raceDate, name: 'Spring Race', priority: 'A' }] })
    const raceIdx = weeks.findIndex(w => w.raceDate === raceDate)
    expect(weeks[raceIdx - 1].phase).toBe('Peak')
  })

  it('weeks after the last race are Transition', () => {
    const { weeks } = minPlan({ races: [{ date: raceDate, name: 'Spring Race', priority: 'A' }] })
    const raceIdx = weeks.findIndex(w => w.raceDate === raceDate)
    // skip the Recovery week right after; the one after that should be Transition
    expect(weeks[raceIdx + 2].phase).toBe('Transition')
  })
})

// ─── buildYearlyPlan — TSS scaling ───────────────────────────────────────────
describe('buildYearlyPlan — TSS scaling', () => {
  it('higher maxHoursPerWeek produces higher average TSS', () => {
    const { weeks: low }  = minPlan({ maxHoursPerWeek: 5 })
    const { weeks: high } = minPlan({ maxHoursPerWeek: 15 })
    const avg = ws => ws.reduce((s, w) => s + w.targetTSS, 0) / ws.length
    expect(avg(high)).toBeGreaterThan(avg(low))
  })

  it('every 4th week is a deload in Base/Build phases', () => {
    const { weeks } = minPlan()
    const deloadWeeks = weeks.filter(w => w.isDeload)
    expect(deloadWeeks.length).toBeGreaterThan(0)
    for (const w of deloadWeeks) {
      expect(w.weekNum % 4).toBe(0)
    }
  })

  it('same inputs produce identical results (deterministic)', () => {
    const a = minPlan({ currentCTL: 55, maxHoursPerWeek: 10 })
    const b = minPlan({ currentCTL: 55, maxHoursPerWeek: 10 })
    expect(a.weeks.map(w => w.targetTSS)).toEqual(b.weeks.map(w => w.targetTSS))
  })

  it('projectedCTL is a positive number', () => {
    const { projectedCTL } = minPlan({ currentCTL: 40 })
    expect(typeof projectedCTL).toBe('number')
    expect(projectedCTL).toBeGreaterThan(0)
  })
})

// ─── buildYearlyPlan — zone distributions ────────────────────────────────────
describe('buildYearlyPlan — zone distributions', () => {
  it('zone fractions sum to ~1.0 for traditional model', () => {
    const { weeks } = minPlan({ model: 'traditional' })
    for (const w of weeks) {
      const z = w.zoneDistribution
      const sum = z.Z1 + z.Z2 + z.Z3 + z.Z4 + z.Z5
      expect(sum).toBeCloseTo(1.0, 5)
    }
  })

  it('zone fractions sum to ~1.0 for polarized model', () => {
    const { weeks } = minPlan({ model: 'polarized' })
    for (const w of weeks) {
      const z = w.zoneDistribution
      const sum = z.Z1 + z.Z2 + z.Z3 + z.Z4 + z.Z5
      expect(sum).toBeCloseTo(1.0, 5)
    }
  })

  it('polarized model has Z2 = 0 on all weeks', () => {
    const { weeks } = minPlan({ model: 'polarized' })
    for (const w of weeks) {
      expect(w.zoneDistribution.Z2).toBe(0)
    }
  })
})

// ─── validatePlan ─────────────────────────────────────────────────────────────
describe('validatePlan', () => {
  it('returns [] for empty weeks array', () => {
    expect(validatePlan([])).toEqual([])
  })

  it('returns [] for null input', () => {
    expect(validatePlan(null)).toEqual([])
  })

  it('warns when plan has fewer than 8 weeks', () => {
    const { weeks } = minPlan()
    const shortPlan = weeks.slice(0, 4)
    const warnings = validatePlan(shortPlan)
    expect(warnings.some(w => w.includes('minimum 8 weeks'))).toBe(true)
  })

  it('warns when TSS spikes >50% between consecutive weeks', () => {
    const fakeWeeks = [
      { weekNum: 1, targetTSS: 100, phase: 'Base', raceDate: null },
      { weekNum: 2, targetTSS: 200, phase: 'Base', raceDate: null },
    ]
    const warnings = validatePlan(fakeWeeks)
    expect(warnings.some(w => w.includes('TSS jumps'))).toBe(true)
  })

  it('does not warn for normal TSS progression', () => {
    const fakeWeeks = Array.from({ length: 8 }, (_, i) => ({
      weekNum: i + 1,
      targetTSS: 300 + i * 20,
      phase: i % 4 === 3 ? 'Recovery' : 'Base',
      isDeload: i % 4 === 3,
      raceDate: null,
    }))
    const warnings = validatePlan(fakeWeeks)
    expect(warnings.filter(w => w.includes('TSS jumps'))).toHaveLength(0)
  })

  it('warns when races are fewer than 10 days apart', () => {
    const fakeWeeks = [
      { weekNum: 1,  targetTSS: 200, phase: 'Race', raceDate: '2025-06-01', raceName: 'Race A', isDeload: false },
      { weekNum: 2,  targetTSS: 200, phase: 'Race', raceDate: '2025-06-07', raceName: 'Race B', isDeload: false },
      ...Array.from({ length: 6 }, (_, i) => ({ weekNum: i + 3, targetTSS: 200, phase: 'Base', raceDate: null, isDeload: false })),
    ]
    const warnings = validatePlan(fakeWeeks)
    expect(warnings.some(w => w.includes('days apart'))).toBe(true)
  })

  it('returns array (never throws) for a full 52-week plan', () => {
    const { weeks } = minPlan()
    expect(() => validatePlan(weeks)).not.toThrow()
    expect(Array.isArray(validatePlan(weeks))).toBe(true)
  })
})

// ─── updateWeekTSS ────────────────────────────────────────────────────────────
describe('updateWeekTSS', () => {
  const { weeks } = minPlan()

  it('returns a new array of the same length', () => {
    const updated = updateWeekTSS(weeks, 0, 400)
    expect(updated).toHaveLength(weeks.length)
  })

  it('only the target week changes', () => {
    const updated = updateWeekTSS(weeks, 3, 999)
    for (let i = 0; i < weeks.length; i++) {
      if (i === 3) {
        expect(updated[i].targetTSS).toBe(999)
      } else {
        expect(updated[i].targetTSS).toBe(weeks[i].targetTSS)
      }
    }
  })

  it('original array is not mutated', () => {
    const original = weeks[0].targetTSS
    updateWeekTSS(weeks, 0, 9999)
    expect(weeks[0].targetTSS).toBe(original)
  })

  it('negative TSS is clamped to 0', () => {
    const updated = updateWeekTSS(weeks, 0, -100)
    expect(updated[0].targetTSS).toBe(0)
  })

  it('plannedHours is recalculated after TSS update', () => {
    const updated = updateWeekTSS(weeks, 0, 600)
    expect(updated[0].plannedHours).toBe(Math.round(600 / 60 * 10) / 10)
  })
})

// ─── exportPlanCSV ────────────────────────────────────────────────────────────
describe('exportPlanCSV', () => {
  it('returns a string', () => {
    const { weeks } = minPlan()
    expect(typeof exportPlanCSV(weeks)).toBe('string')
  })

  it('first line is the header row', () => {
    const { weeks } = minPlan()
    const csv = exportPlanCSV(weeks)
    expect(csv.split('\n')[0]).toBe(
      'Week,Start,Phase,TargetTSS,Hours,Z1%,Z2%,Z3%,Z4%,Z5%,Race,Priority,Notes'
    )
  })

  it('has 53 lines for a 52-week plan (header + 52 rows)', () => {
    const { weeks } = minPlan()
    const lines = exportPlanCSV(weeks).split('\n').filter(Boolean)
    expect(lines).toHaveLength(53)
  })

  it('handles null/undefined weeks gracefully', () => {
    expect(() => exportPlanCSV(null)).not.toThrow()
    expect(() => exportPlanCSV(undefined)).not.toThrow()
    expect(exportPlanCSV(null)).toBe(
      'Week,Start,Phase,TargetTSS,Hours,Z1%,Z2%,Z3%,Z4%,Z5%,Race,Priority,Notes'
    )
  })

  it('commas in notes are escaped as semicolons', () => {
    const fakeWeeks = [{
      weekNum: 1, weekStart: '2025-01-06', phase: 'Base',
      targetTSS: 300, plannedHours: 5,
      zoneDistribution: { Z1: 0.7, Z2: 0.2, Z3: 0.08, Z4: 0.02, Z5: 0 },
      raceName: null, priority: null, note: 'easy,steady',
    }]
    const csv = exportPlanCSV(fakeWeeks)
    const dataRow = csv.split('\n')[1]
    expect(dataRow).toContain('easy;steady')
    expect(dataRow.split(',').length).toBe(13)
  })
})
