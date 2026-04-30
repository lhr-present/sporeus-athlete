// E101
import { describe, it, expect } from 'vitest'
import {
  ROWING_TEMPLATES,
  getRowingTemplate,
  getTemplatesByZone,
  getTemplatesByTag,
  instantiateTemplate,
  weeklyTemplatePlan,
} from '../../sport/rowingTemplates.js'

// ── ROWING_TEMPLATES array ────────────────────────────────────────────────────
describe('ROWING_TEMPLATES', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(ROWING_TEMPLATES)).toBe(true)
    expect(ROWING_TEMPLATES.length).toBeGreaterThan(0)
  })

  it('every template has required keys', () => {
    for (const t of ROWING_TEMPLATES) {
      expect(t).toHaveProperty('id')
      expect(t).toHaveProperty('name')
      expect(t).toHaveProperty('tags')
      expect(Array.isArray(t.tags)).toBe(true)
      expect(t).toHaveProperty('intervals')
      expect(Array.isArray(t.intervals)).toBe(true)
    }
  })

  it('contains the 7 known template IDs', () => {
    const ids = ROWING_TEMPLATES.map(t => t.id)
    expect(ids).toContain('ut2_steady')
    expect(ids).toContain('ut1_steady')
    expect(ids).toContain('at_threshold')
    expect(ids).toContain('tr_pieces')
    expect(ids).toContain('race_pace')
    expect(ids).toContain('an_power')
    expect(ids).toContain('step_test')
  })

  it('non-test templates have a numeric zone', () => {
    for (const t of ROWING_TEMPLATES) {
      if (t.id === 'step_test') continue
      expect(typeof t.zone).toBe('number')
      expect(t.zone).toBeGreaterThanOrEqual(1)
    }
  })

  it('step_test template has null zone and null distanceM', () => {
    const t = getRowingTemplate('step_test')
    expect(t.zone).toBeNull()
    expect(t.distanceM).toBeNull()
  })
})

// ── getRowingTemplate ─────────────────────────────────────────────────────────
describe('getRowingTemplate', () => {
  it('returns correct object for ut2_steady', () => {
    const t = getRowingTemplate('ut2_steady')
    expect(t).not.toBeNull()
    expect(t.id).toBe('ut2_steady')
    expect(t.zone).toBe(1)
  })

  it('returns correct object for at_threshold', () => {
    const t = getRowingTemplate('at_threshold')
    expect(t).not.toBeNull()
    expect(t.rpe).toBe(15)
  })

  it('returns null for an unknown id', () => {
    expect(getRowingTemplate('unknown_id')).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(getRowingTemplate(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(getRowingTemplate('')).toBeNull()
  })
})

// ── getTemplatesByZone ────────────────────────────────────────────────────────
describe('getTemplatesByZone', () => {
  it('returns templates for zone 1', () => {
    const results = getTemplatesByZone(1)
    expect(results.length).toBeGreaterThan(0)
  })

  it('zone 1 results include ut2_steady', () => {
    const ids = getTemplatesByZone(1).map(t => t.id)
    expect(ids).toContain('ut2_steady')
  })

  it('returns templates for zone 3', () => {
    const results = getTemplatesByZone(3)
    expect(results.length).toBeGreaterThan(0)
    const ids = results.map(t => t.id)
    expect(ids).toContain('at_threshold')
  })

  it('zone 5 includes race_pace', () => {
    const ids = getTemplatesByZone(5).map(t => t.id)
    expect(ids).toContain('race_pace')
  })

  it('zone 6 includes an_power', () => {
    const ids = getTemplatesByZone(6).map(t => t.id)
    expect(ids).toContain('an_power')
  })

  it('returns empty array for zone 99', () => {
    expect(getTemplatesByZone(99)).toEqual([])
  })

  it('step_test is returned when querying one of its interval zones', () => {
    // step_test has intervals covering zones 1–5
    const results = getTemplatesByZone(2)
    const ids = results.map(t => t.id)
    expect(ids).toContain('step_test')
  })
})

// ── getTemplatesByTag ─────────────────────────────────────────────────────────
describe('getTemplatesByTag (rowing)', () => {
  it('returns templates with "threshold" tag', () => {
    const results = getTemplatesByTag('threshold')
    expect(results.length).toBeGreaterThan(0)
    for (const t of results) expect(t.tags).toContain('threshold')
  })

  it('"aerobic" tag returns ut2_steady and ut1_steady', () => {
    const ids = getTemplatesByTag('aerobic').map(t => t.id)
    expect(ids).toContain('ut2_steady')
    expect(ids).toContain('ut1_steady')
  })

  it('"race-pace" tag returns tr_pieces and race_pace', () => {
    const ids = getTemplatesByTag('race-pace').map(t => t.id)
    expect(ids).toContain('tr_pieces')
    expect(ids).toContain('race_pace')
  })

  it('"anaerobic" tag returns an_power', () => {
    const results = getTemplatesByTag('anaerobic')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].id).toBe('an_power')
  })

  it('"test" tag returns step_test', () => {
    const ids = getTemplatesByTag('test').map(t => t.id)
    expect(ids).toContain('step_test')
  })

  it('returns empty array for non-existent tag', () => {
    expect(getTemplatesByTag('cycling')).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(getTemplatesByTag('')).toEqual([])
  })
})

// ── instantiateTemplate ───────────────────────────────────────────────────────
describe('instantiateTemplate', () => {
  it('returns null for invalid template id', () => {
    expect(instantiateTemplate('nonexistent', 100)).toBeNull()
  })

  it('returns null when split2000Sec is 0', () => {
    expect(instantiateTemplate('ut2_steady', 0)).toBeNull()
  })

  it('returns null when split2000Sec is negative', () => {
    expect(instantiateTemplate('ut2_steady', -1)).toBeNull()
  })

  it('returns null when split2000Sec is undefined', () => {
    expect(instantiateTemplate('ut2_steady', undefined)).toBeNull()
  })

  it('returns an object with required fields for valid input', () => {
    const result = instantiateTemplate('ut2_steady', 110)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('intervals')
    expect(result).toHaveProperty('estimatedTSS')
    expect(result).toHaveProperty('split2000Sec')
    expect(result).toHaveProperty('split2000Fmt')
  })

  it('split2000Sec is echoed back on result', () => {
    const result = instantiateTemplate('ut2_steady', 110)
    expect(result.split2000Sec).toBe(110)
  })

  it('split2000Fmt matches mm:ss pattern', () => {
    const result = instantiateTemplate('at_threshold', 100)
    expect(result.split2000Fmt).toMatch(/^\d+:\d{2}$/)
  })

  it('estimatedTSS is a positive number', () => {
    const result = instantiateTemplate('at_threshold', 100)
    expect(result.estimatedTSS).toBeGreaterThan(0)
  })

  it('intervals array is populated', () => {
    const result = instantiateTemplate('at_threshold', 100)
    expect(Array.isArray(result.intervals)).toBe(true)
    expect(result.intervals.length).toBe(4)  // at_threshold: 4 × 2000m
  })

  it('each regular interval has targetSplitSec and targetSplitFmt', () => {
    const result = instantiateTemplate('at_threshold', 100)
    for (const iv of result.intervals) {
      expect(iv).toHaveProperty('targetSplitSec')
      expect(iv).toHaveProperty('targetSplitFmt')
      expect(iv.targetSplitSec).toBeGreaterThan(0)
    }
  })

  it('step_test intervals have targetSplitSec computed from pctOf2k', () => {
    const result = instantiateTemplate('step_test', 100)
    expect(result).not.toBeNull()
    for (const iv of result.intervals) {
      expect(iv).toHaveProperty('targetSplitSec')
      expect(iv.targetSplitSec).toBeGreaterThan(0)
    }
  })

  it('faster split produces faster target paces', () => {
    const slow = instantiateTemplate('at_threshold', 120)
    const fast = instantiateTemplate('at_threshold', 90)
    expect(fast.intervals[0].targetSplitSec).toBeLessThan(slow.intervals[0].targetSplitSec)
  })

  it('an_power returns 10 intervals', () => {
    const result = instantiateTemplate('an_power', 95)
    expect(result.intervals.length).toBe(10)
  })

  it('race_pace returns 8 intervals', () => {
    const result = instantiateTemplate('race_pace', 100)
    expect(result.intervals.length).toBe(8)
  })
})

// ── weeklyTemplatePlan ────────────────────────────────────────────────────────
describe('weeklyTemplatePlan', () => {
  it('returns a non-empty array for base', () => {
    const plan = weeklyTemplatePlan('base')
    expect(Array.isArray(plan)).toBe(true)
    expect(plan.length).toBeGreaterThan(0)
  })

  it('returns a non-empty array for build', () => {
    expect(weeklyTemplatePlan('build').length).toBeGreaterThan(0)
  })

  it('returns a non-empty array for peak', () => {
    expect(weeklyTemplatePlan('peak').length).toBeGreaterThan(0)
  })

  it('returns a non-empty array for taper', () => {
    expect(weeklyTemplatePlan('taper').length).toBeGreaterThan(0)
  })

  it('base plan contains ut2_steady', () => {
    expect(weeklyTemplatePlan('base')).toContain('ut2_steady')
  })

  it('build plan contains at_threshold and tr_pieces', () => {
    const plan = weeklyTemplatePlan('build')
    expect(plan).toContain('at_threshold')
    expect(plan).toContain('tr_pieces')
  })

  it('peak plan contains race_pace', () => {
    expect(weeklyTemplatePlan('peak')).toContain('race_pace')
  })

  it('taper plan contains race_pace and ut2_steady', () => {
    const plan = weeklyTemplatePlan('taper')
    expect(plan).toContain('race_pace')
    expect(plan).toContain('ut2_steady')
  })

  it('unknown phase falls back to base plan', () => {
    const plan = weeklyTemplatePlan('unknown')
    expect(plan).toContain('ut2_steady')
  })

  it('all returned IDs exist in ROWING_TEMPLATES', () => {
    const knownIds = new Set(ROWING_TEMPLATES.map(t => t.id))
    for (const phase of ['base', 'build', 'peak', 'taper']) {
      for (const id of weeklyTemplatePlan(phase)) {
        expect(knownIds.has(id)).toBe(true)
      }
    }
  })
})
