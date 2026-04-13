import { describe, it, expect } from 'vitest'
import {
  ROWING_TEMPLATES,
  getRowingTemplate,
  getTemplatesByZone,
  getTemplatesByTag,
  instantiateTemplate,
  weeklyTemplatePlan,
} from './rowingTemplates.js'

// ── ROWING_TEMPLATES array ────────────────────────────────────────────────────
describe('ROWING_TEMPLATES', () => {
  it('contains exactly 7 templates', () => {
    expect(ROWING_TEMPLATES).toHaveLength(7)
  })

  it('each template has required fields', () => {
    for (const t of ROWING_TEMPLATES) {
      expect(t.id).toBeTruthy()
      expect(t.name).toBeTruthy()
      expect(Array.isArray(t.intervals)).toBe(true)
      expect(typeof t.tssMultiplier).toBe('number')
      expect(Array.isArray(t.tags)).toBe(true)
    }
  })

  it('step_test template has pctOf2k-based intervals', () => {
    const st = ROWING_TEMPLATES.find(t => t.id === 'step_test')
    expect(st).not.toBeNull()
    expect(st.intervals[0].pctOf2k).toBeDefined()
    expect(st.intervals).toHaveLength(5)
  })
})

// ── getRowingTemplate ──────────────────────────────────────────────────────────
describe('getRowingTemplate', () => {
  it('returns correct template by id', () => {
    const t = getRowingTemplate('race_pace')
    expect(t.id).toBe('race_pace')
    expect(t.zone).toBe(5)
  })

  it('returns null for unknown id', () => {
    expect(getRowingTemplate('nonexistent')).toBeNull()
  })
})

// ── getTemplatesByZone ────────────────────────────────────────────────────────
describe('getTemplatesByZone', () => {
  it('returns templates that include the given zone', () => {
    const z3 = getTemplatesByZone(3)
    expect(z3.length).toBeGreaterThan(0)
    const ids = z3.map(t => t.id)
    expect(ids).toContain('at_threshold')
  })

  it('returns empty array for an unused zone number', () => {
    expect(getTemplatesByZone(99)).toHaveLength(0)
  })
})

// ── getTemplatesByTag ─────────────────────────────────────────────────────────
describe('getTemplatesByTag', () => {
  it('returns templates tagged "race-pace"', () => {
    const rp = getTemplatesByTag('race-pace')
    expect(rp.length).toBeGreaterThanOrEqual(2)
  })

  it('returns empty array for unknown tag', () => {
    expect(getTemplatesByTag('nonexistent-tag')).toHaveLength(0)
  })
})

// ── instantiateTemplate ───────────────────────────────────────────────────────
describe('instantiateTemplate', () => {
  // Athlete with 2:00/500m (120s) 2000m race split
  const split2k = 120

  it('returns null for unknown template id', () => {
    expect(instantiateTemplate('nope', split2k)).toBeNull()
  })

  it('returns null for invalid split', () => {
    expect(instantiateTemplate('ut2_steady', 0)).toBeNull()
    expect(instantiateTemplate('ut2_steady', null)).toBeNull()
  })

  it('returns instance with split2000Fmt', () => {
    const inst = instantiateTemplate('ut2_steady', split2k)
    expect(inst).not.toBeNull()
    expect(inst.split2000Fmt).toBe('2:00')
  })

  it('intervals have targetSplitSec for zone-based templates', () => {
    const inst = instantiateTemplate('at_threshold', split2k)
    expect(inst.intervals[0].targetSplitSec).toBeGreaterThan(0)
    expect(inst.intervals[0].targetSplitFmt).toMatch(/^\d:\d{2}$/)
  })

  it('step_test intervals have targetSplitSec calculated from pctOf2k', () => {
    const inst = instantiateTemplate('step_test', split2k)
    expect(inst.intervals).toHaveLength(5)
    // First step is 120% of race pace (slower = higher sec/500m)
    expect(inst.intervals[0].targetSplitSec).toBeCloseTo(split2k * 1.20, 0)
    // Last step is 97% (faster = lower sec/500m)
    expect(inst.intervals[4].targetSplitSec).toBeCloseTo(split2k * 0.97, 0)
  })

  it('estimatedTSS is a positive number', () => {
    const inst = instantiateTemplate('race_pace', split2k)
    expect(inst.estimatedTSS).toBeGreaterThan(0)
  })

  it('UT2 target split is slower than UT1 target split', () => {
    const ut2 = instantiateTemplate('ut2_steady', split2k)
    const ut1 = instantiateTemplate('ut1_steady', split2k)
    // UT2 is slower → higher sec/500m
    expect(ut2.intervals[0].targetSplitSec).toBeGreaterThan(ut1.intervals[0].targetSplitSec)
  })
})

// ── weeklyTemplatePlan ────────────────────────────────────────────────────────
describe('weeklyTemplatePlan', () => {
  it('returns array of template IDs for "base" phase', () => {
    const plan = weeklyTemplatePlan('base')
    expect(Array.isArray(plan)).toBe(true)
    expect(plan.length).toBeGreaterThan(0)
    // All IDs should correspond to real templates
    plan.forEach(id => expect(getRowingTemplate(id)).not.toBeNull())
  })

  it('peak phase has more quality sessions than base', () => {
    const base = weeklyTemplatePlan('base')
    const peak = weeklyTemplatePlan('peak')
    const qualityIds = ['race_pace', 'an_power', 'tr_pieces']
    const baseQuality = base.filter(id => qualityIds.includes(id)).length
    const peakQuality = peak.filter(id => qualityIds.includes(id)).length
    expect(peakQuality).toBeGreaterThan(baseQuality)
  })

  it('taper phase has fewer sessions than build', () => {
    expect(weeklyTemplatePlan('taper').length).toBeLessThan(weeklyTemplatePlan('build').length)
  })

  it('falls back to base for unknown phase', () => {
    const plan = weeklyTemplatePlan('unknown')
    expect(Array.isArray(plan)).toBe(true)
    expect(plan.length).toBeGreaterThan(0)
  })
})
