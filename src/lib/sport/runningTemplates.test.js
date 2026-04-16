import { describe, it, expect } from 'vitest'
import {
  RUNNING_TEMPLATES,
  getRunningTemplate,
  getTemplatesByPhase,
  getTemplatesByTag,
  instantiateRunningTemplate,
  raceSpecificPlan,
  secKmToString,
} from './runningTemplates.js'

// ── RUNNING_TEMPLATES array ───────────────────────────────────────────────────
describe('RUNNING_TEMPLATES', () => {
  it('contains exactly 6 templates', () => {
    expect(RUNNING_TEMPLATES).toHaveLength(6)
  })

  it('each template has required fields', () => {
    for (const t of RUNNING_TEMPLATES) {
      expect(t.id).toBeTruthy()
      expect(t.name).toBeTruthy()
      expect(t.paceKey).toMatch(/^[EMTIR]$/)
      expect(typeof t.tssMultiplier).toBe('number')
      expect(Array.isArray(t.tags)).toBe(true)
    }
  })

  it('has templates for each Daniels pace zone', () => {
    const paceKeys = RUNNING_TEMPLATES.map(t => t.paceKey)
    expect(paceKeys).toContain('E')
    expect(paceKeys).toContain('M')
    expect(paceKeys).toContain('T')
    expect(paceKeys).toContain('I')
    expect(paceKeys).toContain('R')
  })
})

// ── getRunningTemplate ────────────────────────────────────────────────────────
describe('getRunningTemplate', () => {
  it('returns correct template by id', () => {
    const t = getRunningTemplate('vo2max_intervals')
    expect(t.id).toBe('vo2max_intervals')
    expect(t.paceKey).toBe('I')
  })

  it('returns null for unknown id', () => {
    expect(getRunningTemplate('no_such_id')).toBeNull()
  })
})

// ── getTemplatesByPhase ───────────────────────────────────────────────────────
describe('getTemplatesByPhase', () => {
  it('returns base-phase templates', () => {
    const base = getTemplatesByPhase('base')
    expect(base.length).toBeGreaterThan(0)
    base.forEach(t => expect(t.phase).toBe('base'))
  })

  it('peak-phase templates use I or R paceKey (quality)', () => {
    const peak = getTemplatesByPhase('peak')
    const qualityKeys = peak.map(t => t.paceKey)
    expect(qualityKeys.some(k => ['I', 'R'].includes(k))).toBe(true)
  })
})

// ── getTemplatesByTag ─────────────────────────────────────────────────────────
describe('getTemplatesByTag', () => {
  it('returns templates tagged "threshold"', () => {
    const thr = getTemplatesByTag('threshold')
    expect(thr.length).toBeGreaterThan(0)
  })

  it('returns empty array for unknown tag', () => {
    expect(getTemplatesByTag('nonexistent-tag')).toHaveLength(0)
  })
})

// ── instantiateRunningTemplate ────────────────────────────────────────────────
describe('instantiateRunningTemplate', () => {
  const vdot = 50  // ~20 min 5K

  it('returns null for invalid inputs', () => {
    expect(instantiateRunningTemplate('easy_run', 0)).toBeNull()
    expect(instantiateRunningTemplate('unknown', vdot)).toBeNull()
    expect(instantiateRunningTemplate('easy_run', null)).toBeNull()
  })

  it('returns targetPaceSecKm in plausible range for easy run at VDOT 50', () => {
    const inst = instantiateRunningTemplate('easy_run', vdot)
    expect(inst).not.toBeNull()
    // VDOT 50 easy pace: roughly 5:30–6:30/km (330–390 sec/km)
    expect(inst.targetPaceSecKm).toBeGreaterThan(300)
    expect(inst.targetPaceSecKm).toBeLessThan(450)
  })

  it('targetPaceFmt is formatted as mm:ss', () => {
    const inst = instantiateRunningTemplate('easy_run', vdot)
    expect(inst.targetPaceFmt).toMatch(/^\d:\d{2}$/)
  })

  it('estimatedTSS is positive', () => {
    const inst = instantiateRunningTemplate('threshold_cruise', vdot)
    expect(inst.estimatedTSS).toBeGreaterThan(0)
  })

  it('VO2max intervals have intervalBreakdown', () => {
    const inst = instantiateRunningTemplate('vo2max_intervals', vdot)
    expect(inst.intervalBreakdown).not.toBeNull()
    expect(inst.intervalBreakdown.count).toBe(6)
    expect(inst.intervalBreakdown.distanceM).toBe(1000)
    expect(inst.intervalBreakdown.targetPaceFmt).toMatch(/^\d:\d{2}$/)
  })

  it('pace hierarchy: E > M > T > I > R (slower to faster sec/km)', () => {
    const easyPace = instantiateRunningTemplate('easy_run', vdot)?.targetPaceSecKm
    const maraPace = instantiateRunningTemplate('marathon_tempo', vdot)?.targetPaceSecKm
    const thrPace  = instantiateRunningTemplate('threshold_cruise', vdot)?.targetPaceSecKm
    const intPace  = instantiateRunningTemplate('vo2max_intervals', vdot)?.targetPaceSecKm
    const repPace  = instantiateRunningTemplate('repetition_speed', vdot)?.targetPaceSecKm
    expect(easyPace).toBeGreaterThan(maraPace)
    expect(maraPace).toBeGreaterThan(thrPace)
    expect(thrPace).toBeGreaterThan(intPace)
    expect(intPace).toBeGreaterThan(repPace)
  })

  it('higher VDOT → faster target paces (lower sec/km)', () => {
    const v50 = instantiateRunningTemplate('threshold_cruise', 50)
    const v60 = instantiateRunningTemplate('threshold_cruise', 60)
    expect(v60.targetPaceSecKm).toBeLessThan(v50.targetPaceSecKm)
  })
})

// ── raceSpecificPlan ──────────────────────────────────────────────────────────
describe('raceSpecificPlan', () => {
  it('returns a plan with correct total week count', () => {
    const plan = raceSpecificPlan(12)
    expect(plan).not.toBeNull()
    expect(plan).toHaveLength(12)
  })

  it('phases appear in correct order: base → build → peak → taper', () => {
    const plan = raceSpecificPlan(16)
    const phases = plan.map(w => w.phase)
    const baseEnd  = phases.lastIndexOf('base')
    const buildEnd = phases.lastIndexOf('build')
    const peakEnd  = phases.lastIndexOf('peak')
    const taperEnd = phases.lastIndexOf('taper')
    expect(baseEnd).toBeLessThan(buildEnd)
    expect(buildEnd).toBeLessThan(peakEnd)
    expect(peakEnd).toBeLessThan(taperEnd)
  })

  it('returns null for fewer than 4 weeks', () => {
    expect(raceSpecificPlan(3)).toBeNull()
    expect(raceSpecificPlan(0)).toBeNull()
    expect(raceSpecificPlan(null)).toBeNull()
  })

  it('each week has templates array with valid template IDs', () => {
    const plan = raceSpecificPlan(8)
    for (const week of plan) {
      expect(Array.isArray(week.templates)).toBe(true)
      week.templates.forEach(id => expect(getRunningTemplate(id)).not.toBeNull())
    }
  })
})

// ── secKmToString ─────────────────────────────────────────────────────────────
describe('secKmToString', () => {
  it('formats 330s as 5:30', () => {
    expect(secKmToString(330)).toBe('5:30')
  })

  it('formats 240s as 4:00', () => {
    expect(secKmToString(240)).toBe('4:00')
  })

  it('returns "--:--" for null or zero', () => {
    expect(secKmToString(0)).toBe('--:--')
    expect(secKmToString(null)).toBe('--:--')
  })
})
