// E100
import { describe, it, expect } from 'vitest'
import {
  RUNNING_TEMPLATES,
  getRunningTemplate,
  getTemplatesByPhase,
  getTemplatesByTag,
  instantiateRunningTemplate,
  raceSpecificPlan,
  weeklyRunPlan,
} from '../../sport/runningTemplates.js'

// ── RUNNING_TEMPLATES array ───────────────────────────────────────────────────
describe('RUNNING_TEMPLATES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(RUNNING_TEMPLATES)).toBe(true)
    expect(RUNNING_TEMPLATES.length).toBeGreaterThan(0)
  })

  it('every template has required keys', () => {
    for (const t of RUNNING_TEMPLATES) {
      expect(t).toHaveProperty('id')
      expect(t).toHaveProperty('name')
      expect(t).toHaveProperty('phase')
      expect(t).toHaveProperty('paceKey')
      expect(t).toHaveProperty('tags')
      expect(Array.isArray(t.tags)).toBe(true)
    }
  })

  it('contains the 6 known template IDs', () => {
    const ids = RUNNING_TEMPLATES.map(t => t.id)
    expect(ids).toContain('easy_run')
    expect(ids).toContain('marathon_tempo')
    expect(ids).toContain('threshold_cruise')
    expect(ids).toContain('vo2max_intervals')
    expect(ids).toContain('repetition_speed')
    expect(ids).toContain('long_run')
  })

  it('paceKey values are within the Daniels set (E/M/T/I/R)', () => {
    const valid = new Set(['E', 'M', 'T', 'I', 'R'])
    for (const t of RUNNING_TEMPLATES) {
      expect(valid.has(t.paceKey)).toBe(true)
    }
  })

  it('phase values are one of base/build/peak', () => {
    const valid = new Set(['base', 'build', 'peak'])
    for (const t of RUNNING_TEMPLATES) {
      expect(valid.has(t.phase)).toBe(true)
    }
  })
})

// ── getRunningTemplate ────────────────────────────────────────────────────────
describe('getRunningTemplate', () => {
  it('returns the correct object for a known id', () => {
    const t = getRunningTemplate('threshold_cruise')
    expect(t).not.toBeNull()
    expect(t.id).toBe('threshold_cruise')
    expect(t.paceKey).toBe('T')
  })

  it('returns the easy_run template', () => {
    const t = getRunningTemplate('easy_run')
    expect(t).not.toBeNull()
    expect(t.phase).toBe('base')
  })

  it('returns null for an unknown id', () => {
    expect(getRunningTemplate('nonexistent')).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(getRunningTemplate(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(getRunningTemplate('')).toBeNull()
  })
})

// ── getTemplatesByPhase ───────────────────────────────────────────────────────
describe('getTemplatesByPhase', () => {
  it('returns only base-phase templates', () => {
    const results = getTemplatesByPhase('base')
    expect(results.length).toBeGreaterThan(0)
    for (const t of results) expect(t.phase).toBe('base')
  })

  it('returns only build-phase templates', () => {
    const results = getTemplatesByPhase('build')
    expect(results.length).toBeGreaterThan(0)
    for (const t of results) expect(t.phase).toBe('build')
  })

  it('returns only peak-phase templates', () => {
    const results = getTemplatesByPhase('peak')
    expect(results.length).toBeGreaterThan(0)
    for (const t of results) expect(t.phase).toBe('peak')
  })

  it('returns empty array for a non-existent phase', () => {
    expect(getTemplatesByPhase('taper')).toEqual([])
  })

  it('base templates include easy_run and long_run', () => {
    const ids = getTemplatesByPhase('base').map(t => t.id)
    expect(ids).toContain('easy_run')
    expect(ids).toContain('long_run')
  })

  it('peak templates include vo2max_intervals and repetition_speed', () => {
    const ids = getTemplatesByPhase('peak').map(t => t.id)
    expect(ids).toContain('vo2max_intervals')
    expect(ids).toContain('repetition_speed')
  })
})

// ── getTemplatesByTag ─────────────────────────────────────────────────────────
describe('getTemplatesByTag', () => {
  it('returns templates matching the "threshold" tag', () => {
    const results = getTemplatesByTag('threshold')
    expect(results.length).toBeGreaterThan(0)
    for (const t of results) expect(t.tags).toContain('threshold')
  })

  it('returns templates matching the "aerobic" tag', () => {
    const results = getTemplatesByTag('aerobic')
    expect(results.length).toBeGreaterThan(0)
    for (const t of results) expect(t.tags).toContain('aerobic')
  })

  it('returns templates matching the "vo2max" tag', () => {
    const results = getTemplatesByTag('vo2max')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe('vo2max_intervals')
  })

  it('returns empty array for a non-existent tag', () => {
    expect(getTemplatesByTag('ultramarathon')).toEqual([])
  })

  it('returns empty array for empty string tag', () => {
    expect(getTemplatesByTag('')).toEqual([])
  })

  it('"easy" tag matches easy_run and long_run', () => {
    const ids = getTemplatesByTag('easy').map(t => t.id)
    expect(ids).toContain('easy_run')
    expect(ids).toContain('long_run')
  })
})

// ── instantiateRunningTemplate ────────────────────────────────────────────────
describe('instantiateRunningTemplate', () => {
  it('returns null for an invalid template id', () => {
    expect(instantiateRunningTemplate('nonexistent', 50)).toBeNull()
  })

  it('returns null when vdot is 0', () => {
    expect(instantiateRunningTemplate('easy_run', 0)).toBeNull()
  })

  it('returns null when vdot is negative', () => {
    expect(instantiateRunningTemplate('easy_run', -5)).toBeNull()
  })

  it('returns null when vdot is undefined', () => {
    expect(instantiateRunningTemplate('easy_run', undefined)).toBeNull()
  })

  it('returns an object with required pace fields for valid input', () => {
    const result = instantiateRunningTemplate('easy_run', 50)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('targetPaceSecKm')
    expect(result).toHaveProperty('targetPaceFmt')
    expect(result).toHaveProperty('estimatedTSS')
    expect(typeof result.targetPaceSecKm).toBe('number')
    expect(result.targetPaceSecKm).toBeGreaterThan(0)
  })

  it('pace format matches mm:ss pattern', () => {
    const result = instantiateRunningTemplate('easy_run', 50)
    expect(result.targetPaceFmt).toMatch(/^\d+:\d{2}$/)
  })

  it('TSS is a positive number', () => {
    const result = instantiateRunningTemplate('threshold_cruise', 52)
    expect(result.estimatedTSS).toBeGreaterThan(0)
  })

  it('threshold_cruise returns intervalBreakdown', () => {
    const result = instantiateRunningTemplate('threshold_cruise', 52)
    expect(result.intervalBreakdown).not.toBeNull()
    expect(result.intervalBreakdown.count).toBe(5)
    expect(result.intervalBreakdown.distanceM).toBe(1609)
    expect(result.intervalBreakdown).toHaveProperty('intervalTimeFmt')
  })

  it('vo2max_intervals returns intervalBreakdown with 6 reps', () => {
    const result = instantiateRunningTemplate('vo2max_intervals', 55)
    expect(result.intervalBreakdown.count).toBe(6)
    expect(result.intervalBreakdown.distanceM).toBe(1000)
  })

  it('easy_run has no intervalBreakdown (continuous session)', () => {
    const result = instantiateRunningTemplate('easy_run', 50)
    expect(result.intervalBreakdown).toBeNull()
  })

  it('instantiated template retains vdot', () => {
    const result = instantiateRunningTemplate('marathon_tempo', 48)
    expect(result.vdot).toBe(48)
  })

  it('higher VDOT produces faster pace (lower sec/km)', () => {
    const low  = instantiateRunningTemplate('easy_run', 40)
    const high = instantiateRunningTemplate('easy_run', 60)
    expect(high.targetPaceSecKm).toBeLessThan(low.targetPaceSecKm)
  })
})

// ── raceSpecificPlan ──────────────────────────────────────────────────────────
describe('raceSpecificPlan', () => {
  it('returns null for weeksToRace < 4', () => {
    expect(raceSpecificPlan(3)).toBeNull()
    expect(raceSpecificPlan(0)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(raceSpecificPlan(undefined)).toBeNull()
  })

  it('returns an array for 12 weeks', () => {
    const plan = raceSpecificPlan(12)
    expect(Array.isArray(plan)).toBe(true)
    expect(plan.length).toBe(12)
  })

  it('each entry has week, phase, templates keys', () => {
    const plan = raceSpecificPlan(12)
    for (const entry of plan) {
      expect(entry).toHaveProperty('week')
      expect(entry).toHaveProperty('phase')
      expect(entry).toHaveProperty('templates')
      expect(Array.isArray(entry.templates)).toBe(true)
    }
  })

  it('weeks are sequential starting at 1', () => {
    const plan = raceSpecificPlan(8)
    plan.forEach((entry, i) => expect(entry.week).toBe(i + 1))
  })

  it('plan contains base and peak phases', () => {
    const plan = raceSpecificPlan(16)
    const phases = new Set(plan.map(e => e.phase))
    expect(phases.has('base')).toBe(true)
    expect(phases.has('peak')).toBe(true)
  })

  it('last phase(s) are taper', () => {
    const plan = raceSpecificPlan(12)
    expect(plan[plan.length - 1].phase).toBe('taper')
  })

  it('works for minimum 4 weeks', () => {
    const plan = raceSpecificPlan(4)
    expect(Array.isArray(plan)).toBe(true)
    expect(plan.length).toBe(4)
  })

  it('templates are non-empty arrays', () => {
    const plan = raceSpecificPlan(12)
    for (const entry of plan) {
      expect(entry.templates.length).toBeGreaterThan(0)
    }
  })
})

// ── weeklyRunPlan ─────────────────────────────────────────────────────────────
describe('weeklyRunPlan', () => {
  it('returns a non-empty array for base', () => {
    const plan = weeklyRunPlan('base')
    expect(Array.isArray(plan)).toBe(true)
    expect(plan.length).toBeGreaterThan(0)
  })

  it('returns a non-empty array for build', () => {
    const plan = weeklyRunPlan('build')
    expect(plan.length).toBeGreaterThan(0)
  })

  it('returns a non-empty array for peak', () => {
    const plan = weeklyRunPlan('peak')
    expect(plan.length).toBeGreaterThan(0)
  })

  it('returns a non-empty array for taper', () => {
    const plan = weeklyRunPlan('taper')
    expect(plan.length).toBeGreaterThan(0)
  })

  it('base plan includes easy_run and long_run', () => {
    const plan = weeklyRunPlan('base')
    expect(plan).toContain('easy_run')
    expect(plan).toContain('long_run')
  })

  it('build plan includes marathon_tempo and threshold_cruise', () => {
    const plan = weeklyRunPlan('build')
    expect(plan).toContain('marathon_tempo')
    expect(plan).toContain('threshold_cruise')
  })

  it('peak plan includes vo2max_intervals and repetition_speed', () => {
    const plan = weeklyRunPlan('peak')
    expect(plan).toContain('vo2max_intervals')
    expect(plan).toContain('repetition_speed')
  })

  it('unknown phase falls back to base plan', () => {
    const plan = weeklyRunPlan('unknown_phase')
    expect(plan).toContain('easy_run')
  })

  it('all returned IDs exist in RUNNING_TEMPLATES', () => {
    const knownIds = new Set(RUNNING_TEMPLATES.map(t => t.id))
    for (const phase of ['base', 'build', 'peak', 'taper']) {
      for (const id of weeklyRunPlan(phase)) {
        expect(knownIds.has(id)).toBe(true)
      }
    }
  })
})
