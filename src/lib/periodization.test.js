import { describe, it, expect } from 'vitest'
import {
  buildYearlyPlan,
  validatePlan,
  updateWeekTSS,
  exportPlanCSV,
} from './periodization.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function addWeeks(dateStr, n) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n * 7)
  return d.toISOString().slice(0, 10)
}

const TODAY = new Date().toISOString().slice(0, 10)

function defaultPlan(overrides = {}) {
  return buildYearlyPlan({
    startDate:       TODAY,
    races:           [{ date: addWeeks(TODAY, 24), name: 'Test Race', priority: 'A' }],
    currentCTL:      40,
    targetCTL:       55,
    maxHoursPerWeek: 10,
    trainingDays:    5,
    model:           'traditional',
    ...overrides,
  })
}

// ── buildYearlyPlan ───────────────────────────────────────────────────────────

describe('buildYearlyPlan', () => {
  it('always generates exactly 52 weeks', () => {
    const { weeks } = defaultPlan()
    expect(weeks).toHaveLength(52)
  })

  it('week objects have all required fields', () => {
    const { weeks } = defaultPlan()
    const w = weeks[0]
    expect(w).toHaveProperty('weekStart')
    expect(w).toHaveProperty('weekNum')
    expect(w).toHaveProperty('phase')
    expect(w).toHaveProperty('targetTSS')
    expect(w).toHaveProperty('plannedHours')
    expect(w).toHaveProperty('zoneDistribution')
    expect(w).toHaveProperty('isDeload')
    expect(w).toHaveProperty('raceName')
    expect(w).toHaveProperty('raceDate')
    expect(w).toHaveProperty('priority')
    expect(w).toHaveProperty('note')
  })

  it('traditional: first phase is Base (race is 24 weeks away)', () => {
    const { weeks } = defaultPlan()
    expect(weeks[0].phase).toBe('Base')
  })

  it('traditional: week before race is Peak', () => {
    const { weeks } = defaultPlan()
    const raceIdx = weeks.findIndex(w => w.phase === 'Race')
    expect(raceIdx).toBeGreaterThan(0)
    expect(weeks[raceIdx - 1].phase).toBe('Peak')
  })

  it('week marked as Race has race details set', () => {
    const { weeks } = defaultPlan()
    const raceWeek = weeks.find(w => w.phase === 'Race')
    expect(raceWeek).toBeDefined()
    expect(raceWeek.raceName).toBe('Test Race')
    expect(raceWeek.priority).toBe('A')
    expect(raceWeek.raceDate).toBeTruthy()
  })

  it('deload every 4th week (isDeload=true)', () => {
    const { weeks } = defaultPlan()
    // Week 4 (index 3) should be a deload
    expect(weeks[3].isDeload).toBe(true)
  })

  it('deload week TSS ≈ 60% of prior week', () => {
    const { weeks } = defaultPlan()
    const deloadIdx = weeks.findIndex(w => w.isDeload)
    expect(deloadIdx).toBeGreaterThan(0)
    const priorTSS = weeks[deloadIdx - 1].targetTSS
    const deloadTSS = weeks[deloadIdx].targetTSS
    if (priorTSS > 0) {
      expect(deloadTSS / priorTSS).toBeGreaterThan(0.5)
      expect(deloadTSS / priorTSS).toBeLessThan(0.7)
    }
  })

  it('race week TSS is 40–50% of peak TSS', () => {
    const { weeks } = defaultPlan()
    const raceWeek = weeks.find(w => w.phase === 'Race')
    const peakTSS  = Math.min(55 * 7, 10 * 65)
    expect(raceWeek.targetTSS / peakTSS).toBeGreaterThanOrEqual(0.40)
    expect(raceWeek.targetTSS / peakTSS).toBeLessThanOrEqual(0.50)
  })

  it('recovery week after A race has TSS < base TSS', () => {
    const { weeks } = defaultPlan()
    const raceIdx     = weeks.findIndex(w => w.phase === 'Race')
    const recoveryWk  = weeks[raceIdx + 1]
    const baseTSS     = Math.max(40 * 7, 10 * 45)
    if (recoveryWk && recoveryWk.phase === 'Recovery') {
      expect(recoveryWk.targetTSS).toBeLessThan(baseTSS)
    }
  })

  it('no races: all Base except last 2 weeks are Peak', () => {
    const { weeks } = buildYearlyPlan({
      startDate:    TODAY,
      races:        [],
      currentCTL:   40,
      model:        'traditional',
    })
    expect(weeks[0].phase).toBe('Base')
    expect(weeks[50].phase).toBe('Peak')
    expect(weeks[51].phase).toBe('Peak')
    // Weeks in the middle should be Base
    const midPhases = weeks.slice(1, 50).map(w => w.phase)
    expect(midPhases.every(p => p === 'Base' || p === 'Base')).toBe(true)
  })

  it('polarized model: all weeks Z1=0.80 regardless of phase', () => {
    const { weeks } = defaultPlan({ model: 'polarized' })
    for (const w of weeks) {
      expect(w.zoneDistribution.Z1).toBeCloseTo(0.80, 5)
      expect(w.zoneDistribution.Z2).toBeCloseTo(0.00, 5)
      expect(w.zoneDistribution.Z4).toBeCloseTo(0.15, 5)
      expect(w.zoneDistribution.Z5).toBeCloseTo(0.05, 5)
    }
  })

  it('block model: weeks follow 3+1+1 accumulation/intensification/realization cycle', () => {
    const { weeks } = defaultPlan({ model: 'block' })
    // Weeks 1,2,3 → Accumulation (Z1=0.60)
    expect(weeks[0].zoneDistribution.Z1).toBeCloseTo(0.60, 5)
    expect(weeks[1].zoneDistribution.Z1).toBeCloseTo(0.60, 5)
    expect(weeks[2].zoneDistribution.Z1).toBeCloseTo(0.60, 5)
    // Week 4 → Intensification (Z1=0.50)
    expect(weeks[3].zoneDistribution.Z1).toBeCloseTo(0.50, 5)
    // Week 5 → Realization (Z1=0.45)
    expect(weeks[4].zoneDistribution.Z1).toBeCloseTo(0.45, 5)
    // Week 6 → back to Accumulation
    expect(weeks[5].zoneDistribution.Z1).toBeCloseTo(0.60, 5)
  })

  it('targetTSS never exceeds maxHoursPerWeek * 65', () => {
    const { weeks } = defaultPlan({ maxHoursPerWeek: 10 })
    const maxAllowed = 10 * 65
    for (const w of weeks) {
      expect(w.targetTSS).toBeLessThanOrEqual(maxAllowed)
    }
  })

  it('projectedCTL > 0 when there is training load', () => {
    const { projectedCTL } = defaultPlan()
    expect(projectedCTL).toBeGreaterThan(0)
  })

  it('weeks after last race are Transition', () => {
    const { weeks } = defaultPlan()
    const lastRaceIdx = weeks.map(w => w.phase).lastIndexOf('Race')
    const afterRace = weeks.slice(lastRaceIdx + 2)  // skip recovery week
    if (afterRace.length > 0) {
      expect(afterRace.every(w => w.phase === 'Transition')).toBe(true)
    }
  })

  it('weekNum is 1-based and sequential', () => {
    const { weeks } = defaultPlan()
    weeks.forEach((w, i) => expect(w.weekNum).toBe(i + 1))
  })
})

// ── validatePlan ──────────────────────────────────────────────────────────────

describe('validatePlan', () => {
  it('detects TSS spike >50% between consecutive weeks', () => {
    const weeks = [
      { weekNum: 1, targetTSS: 200, phase: 'Build', isDeload: false, raceDate: null },
      { weekNum: 2, targetTSS: 400, phase: 'Build', isDeload: false, raceDate: null },
    ]
    const warnings = validatePlan(weeks)
    expect(warnings.some(w => w.includes('TSS jumps'))).toBe(true)
  })

  it('no warning when TSS increase is ≤50%', () => {
    const weeks = [
      { weekNum: 1, targetTSS: 200, phase: 'Base', isDeload: false, raceDate: null },
      { weekNum: 2, targetTSS: 290, phase: 'Build', isDeload: false, raceDate: null },
    ]
    const warnings = validatePlan(weeks)
    expect(warnings.some(w => w.includes('TSS jumps'))).toBe(false)
  })

  it('detects races < 10 days apart', () => {
    const d1 = TODAY
    const d2 = new Date(TODAY)
    d2.setDate(d2.getDate() + 7)
    const d2str = d2.toISOString().slice(0, 10)
    const weeks = [
      { weekNum: 1, targetTSS: 200, phase: 'Race', isDeload: false, raceDate: d1, raceName: 'Race A' },
      { weekNum: 2, targetTSS: 200, phase: 'Race', isDeload: false, raceDate: d2str, raceName: 'Race B' },
    ]
    const warnings = validatePlan(weeks)
    expect(warnings.some(w => w.includes('days apart'))).toBe(true)
  })

  it('no race-proximity warning when races are ≥10 days apart', () => {
    const d1 = TODAY
    const d2 = new Date(TODAY)
    d2.setDate(d2.getDate() + 14)
    const d2str = d2.toISOString().slice(0, 10)
    const weeks = [
      { weekNum: 1, targetTSS: 200, phase: 'Race', isDeload: false, raceDate: d1, raceName: 'Race A' },
      { weekNum: 2, targetTSS: 200, phase: 'Race', isDeload: false, raceDate: d2str, raceName: 'Race B' },
    ]
    const warnings = validatePlan(weeks)
    expect(warnings.some(w => w.includes('days apart'))).toBe(false)
  })

  it('detects missing deload in 5+ consecutive Build weeks', () => {
    const weeks = Array.from({ length: 6 }, (_, i) => ({
      weekNum: i + 1, targetTSS: 300, phase: 'Build', isDeload: false, raceDate: null,
    }))
    const warnings = validatePlan(weeks)
    expect(warnings.some(w => w.includes('consecutive build weeks'))).toBe(true)
  })

  it('no deload warning when streak is ≤4', () => {
    const weeks = Array.from({ length: 4 }, (_, i) => ({
      weekNum: i + 1, targetTSS: 300, phase: 'Build', isDeload: false, raceDate: null,
    }))
    const warnings = validatePlan(weeks)
    expect(warnings.some(w => w.includes('consecutive build weeks'))).toBe(false)
  })

  it('returns empty array for empty weeks', () => {
    expect(validatePlan([])).toEqual([])
    expect(validatePlan(null)).toEqual([])
  })
})

// ── updateWeekTSS ─────────────────────────────────────────────────────────────

describe('updateWeekTSS', () => {
  const sampleWeeks = [
    { weekNum: 1, targetTSS: 300, phase: 'Base',  isDeload: false, plannedHours: 5.0 },
    { weekNum: 2, targetTSS: 320, phase: 'Build', isDeload: false, plannedHours: 5.3 },
    { weekNum: 3, targetTSS: 340, phase: 'Build', isDeload: false, plannedHours: 5.7 },
  ]

  it('original array is unchanged (immutability)', () => {
    const original = JSON.parse(JSON.stringify(sampleWeeks))
    updateWeekTSS(sampleWeeks, 1, 500)
    expect(sampleWeeks[1].targetTSS).toBe(320)
    expect(sampleWeeks).toEqual(original)
  })

  it('returned array has updated TSS at correct index', () => {
    const result = updateWeekTSS(sampleWeeks, 1, 500)
    expect(result[1].targetTSS).toBe(500)
  })

  it('other weeks are unchanged', () => {
    const result = updateWeekTSS(sampleWeeks, 1, 500)
    expect(result[0].targetTSS).toBe(300)
    expect(result[2].targetTSS).toBe(340)
  })

  it('plannedHours is recalculated from new TSS', () => {
    const result = updateWeekTSS(sampleWeeks, 0, 600)
    expect(result[0].plannedHours).toBeCloseTo(600 / 60, 1)
  })

  it('floors negative TSS at 0', () => {
    const result = updateWeekTSS(sampleWeeks, 0, -50)
    expect(result[0].targetTSS).toBe(0)
  })
})

// ── exportPlanCSV ─────────────────────────────────────────────────────────────

describe('exportPlanCSV', () => {
  const { weeks } = defaultPlan()

  it('first line is header', () => {
    const csv = exportPlanCSV(weeks)
    const lines = csv.split('\n')
    expect(lines[0]).toContain('Week')
    expect(lines[0]).toContain('Phase')
    expect(lines[0]).toContain('TargetTSS')
    expect(lines[0]).toContain('Z1%')
  })

  it('column count in header matches data rows', () => {
    const csv   = exportPlanCSV(weeks)
    const lines = csv.split('\n')
    const headerCols = lines[0].split(',').length
    for (const line of lines.slice(1)) {
      expect(line.split(',').length).toBe(headerCols)
    }
  })

  it('zone values are integers 0–100', () => {
    const csv   = exportPlanCSV(weeks)
    const lines = csv.split('\n')
    // Header: Week,Start,Phase,TargetTSS,Hours,Z1%,Z2%,Z3%,Z4%,Z5%,...
    // Z1% is column 5 (0-indexed)
    for (const line of lines.slice(1)) {
      const cols = line.split(',')
      for (let c = 5; c <= 9; c++) {
        const val = parseInt(cols[c])
        expect(val).toBeGreaterThanOrEqual(0)
        expect(val).toBeLessThanOrEqual(100)
        expect(Number.isInteger(val)).toBe(true)
      }
    }
  })

  it('has 53 lines (1 header + 52 data rows)', () => {
    const csv   = exportPlanCSV(weeks)
    const lines = csv.split('\n').filter(l => l.trim())
    expect(lines).toHaveLength(53)
  })

  it('handles empty weeks array', () => {
    const csv = exportPlanCSV([])
    const lines = csv.split('\n').filter(l => l.trim())
    expect(lines).toHaveLength(1)  // only header
  })
})


// ─── Edge cases ───────────────────────────────────────────────────────────────
describe('buildYearlyPlan — edge cases', () => {
  it('no races: still generates 52 weeks, all Base or Peak', () => {
    const { weeks } = buildYearlyPlan({ startDate: TODAY, races: [], currentCTL: 30 })
    expect(weeks).toHaveLength(52)
    weeks.forEach(w => expect(['Base', 'Peak']).toContain(w.phase))
  })

  it('all weeks have positive targetTSS', () => {
    const { weeks } = defaultPlan()
    weeks.forEach(w => expect(w.targetTSS).toBeGreaterThan(0))
  })

  it('polarized model uses 80% Z1 in zoneDistribution regardless of phase', () => {
    const { weeks } = buildYearlyPlan({
      startDate: TODAY, races: [], currentCTL: 40, model: 'polarized',
    })
    // Every week should have polarized zone distribution
    weeks.forEach(w => {
      expect(w.zoneDistribution.Z1).toBe(0.80)
      expect(w.zoneDistribution.Z2).toBe(0.00)
    })
  })

  it('block model still uses standard phase labels (Base/Build/Peak)', () => {
    const { weeks } = buildYearlyPlan({
      startDate: TODAY,
      races: [{ date: addWeeks(TODAY, 24), name: 'Block Race', priority: 'A' }],
      currentCTL: 40, model: 'block',
    })
    const phases = new Set(weeks.map(w => w.phase))
    // Block model uses standard phase names; zone distribution varies per sub-cycle
    expect(phases.has('Base') || phases.has('Build')).toBe(true)
    expect(weeks).toHaveLength(52)
  })
})

describe('updateWeekTSS — edge cases', () => {
  it('negative TSS is clamped to 0', () => {
    const { weeks } = defaultPlan()
    const updated = updateWeekTSS(weeks, 0, -50)
    expect(updated[0].targetTSS).toBe(0)
  })

  it('does not mutate other weeks', () => {
    const { weeks } = defaultPlan()
    const orig = weeks[5].targetTSS
    const updated = updateWeekTSS(weeks, 3, 999)
    expect(updated[5].targetTSS).toBe(orig)
  })
})
