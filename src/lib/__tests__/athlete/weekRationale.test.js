// v9.131.0 — Weekly plan rationale tests.

import { describe, it, expect } from 'vitest'
import { explainPlannedWeek } from '../../athlete/weekRationale.js'

function session(type, rpe, duration = 60, tss = duration) {
  return { type, rpe, duration, tss }
}
function week(phase, sessions, tss, opts = {}) {
  return { phase, sessions, tss, totalHours: (tss / 60).toFixed(1), ...opts }
}

describe('explainPlannedWeek — guards', () => {
  it('returns empty for missing plan', () => {
    expect(explainPlannedWeek({})).toEqual({ factors: [], hasContent: false })
  })
  it('returns empty for missing weekIdx', () => {
    const plan = { weeks: [week('Base', [], 0)] }
    expect(explainPlannedWeek({ plan })).toEqual({ factors: [], hasContent: false })
  })
  it('returns empty for out-of-range weekIdx', () => {
    const plan = { weeks: [week('Base', [], 0)] }
    expect(explainPlannedWeek({ plan, weekIdx: 5 })).toEqual({ factors: [], hasContent: false })
  })
})

describe('explainPlannedWeek — phase factor', () => {
  it('Base phase blurb', () => {
    const plan = { weeks: [week('Base', [], 0)] }
    const out = explainPlannedWeek({ plan, weekIdx: 0 })
    const p = out.factors.find(f => f.key === 'phase')
    expect(p.label.en).toContain('BASE')
    expect(p.detail.en.toLowerCase()).toContain('aerobic capacity')
    expect(p.citation).toContain('Seiler')
  })
  it('Taper phase blurb', () => {
    const plan = { weeks: [week('Taper', [], 0)] }
    const out = explainPlannedWeek({ plan, weekIdx: 0 })
    const p = out.factors.find(f => f.key === 'phase')
    expect(p.detail.en).toContain('41%')
    expect(p.citation).toContain('Bosquet')
  })
  it('Race Week treated as taper', () => {
    const plan = { weeks: [week('Race Week', [], 0)] }
    expect(explainPlannedWeek({ plan, weekIdx: 0 }).factors.find(f => f.key === 'phase')).toBeTruthy()
  })
  it('no phase factor when phase is unknown', () => {
    const plan = { weeks: [week('Custom', [], 0)] }
    expect(explainPlannedWeek({ plan, weekIdx: 0 }).factors.find(f => f.key === 'phase')).toBeUndefined()
  })
})

describe('explainPlannedWeek — volume ramp', () => {
  it('fires when ramp ≥ ±3%', () => {
    const plan = { weeks: [
      week('Base',  [], 400),
      week('Build', [], 480),  // +20%
    ] }
    const out = explainPlannedWeek({ plan, weekIdx: 1 })
    const r = out.factors.find(f => f.key === 'volume-ramp')
    expect(r.label.en).toContain('+20%')
    expect(r.detail.en).toContain('+14%')  // safe-ramp band reference
    expect(r.citation).toContain('Coggan')
  })
  it('flags step-down with Mujika citation', () => {
    const plan = { weeks: [
      week('Build',    [], 500),
      week('Recovery', [], 300),  // -40%
    ] }
    const out = explainPlannedWeek({ plan, weekIdx: 1 })
    const r = out.factors.find(f => f.key === 'volume-ramp')
    expect(r.citation).toContain('Mujika')
    expect(r.detail.en).toContain('Recovery-type')
  })
  it('no ramp factor when delta < 3%', () => {
    const plan = { weeks: [week('Base', [], 500), week('Base', [], 510)] }
    expect(explainPlannedWeek({ plan, weekIdx: 1 }).factors.find(f => f.key === 'volume-ramp')).toBeUndefined()
  })
  it('no ramp factor on first week (no prev)', () => {
    const plan = { weeks: [week('Base', [], 400)] }
    expect(explainPlannedWeek({ plan, weekIdx: 0 }).factors.find(f => f.key === 'volume-ramp')).toBeUndefined()
  })
})

describe('explainPlannedWeek — distribution', () => {
  it('flags polarized when easy share ≥ 70% and threshold ≤ 20%', () => {
    const sessions = [
      session('Easy', 4), session('Easy', 4), session('Easy', 4),
      session('VO2', 9),
    ]
    const plan = { weeks: [week('Build', sessions, 400)] }
    const out = explainPlannedWeek({ plan, weekIdx: 0 })
    const d = out.factors.find(f => f.key === 'distribution')
    expect(d.detail.en).toContain('polarized')
  })
  it('flags threshold-heavy', () => {
    const sessions = [
      session('Tempo', 7), session('Threshold', 7), session('Threshold', 7),
      session('Easy', 4),
    ]
    const plan = { weeks: [week('Build', sessions, 400)] }
    const out = explainPlannedWeek({ plan, weekIdx: 0 })
    const d = out.factors.find(f => f.key === 'distribution')
    expect(d.detail.en).toContain('threshold-heavy')
  })
  it('no distribution factor when <3 quality sessions', () => {
    const sessions = [session('Easy', 4), session('Rest', 0, 0, 0)]
    const plan = { weeks: [week('Base', sessions, 100)] }
    expect(explainPlannedWeek({ plan, weekIdx: 0 }).factors.find(f => f.key === 'distribution')).toBeUndefined()
  })
})

describe('explainPlannedWeek — position', () => {
  it('reports week N of M and percentage', () => {
    const plan = { weeks: Array.from({ length: 12 }, () => week('Base', [], 100)) }
    const out = explainPlannedWeek({ plan, weekIdx: 5 })
    const p = out.factors.find(f => f.key === 'position')
    expect(p.label.en).toBe('Week 6 of 12')
    expect(p.detail.en).toContain('50%')
  })
})

describe('explainPlannedWeek — transition', () => {
  it('emits transition factor when next week phase differs', () => {
    const plan = { weeks: [
      week('Build', [], 500),
      week('Peak',  [], 540),
    ] }
    const out = explainPlannedWeek({ plan, weekIdx: 0 })
    const t = out.factors.find(f => f.key === 'transition')
    expect(t.label.en).toContain('PEAK')
  })
  it('no transition when next week is same phase', () => {
    const plan = { weeks: [
      week('Build', [], 500),
      week('Build', [], 520),
    ] }
    expect(explainPlannedWeek({ plan, weekIdx: 0 }).factors.find(f => f.key === 'transition')).toBeUndefined()
  })
  it('no transition on last week of plan', () => {
    const plan = { weeks: [week('Race Week', [], 100)] }
    expect(explainPlannedWeek({ plan, weekIdx: 0 }).factors.find(f => f.key === 'transition')).toBeUndefined()
  })
})
