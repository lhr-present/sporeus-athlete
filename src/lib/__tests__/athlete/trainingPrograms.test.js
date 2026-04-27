// src/lib/__tests__/athlete/trainingPrograms.test.js — E90
import { describe, it, expect } from 'vitest'
import { PROGRAMS, buildStaticPlan, getCurrentStaticWeek } from '../../athlete/trainingPrograms.js'

const VDOT   = 38
const START  = '2026-05-01'
const IDS    = Object.keys(PROGRAMS)

describe('PROGRAMS definition', () => {
  it('exports at least 3 programs', () => expect(IDS.length).toBeGreaterThanOrEqual(3))
  it('each program has required fields', () => {
    for (const id of IDS) {
      const p = PROGRAMS[id]
      expect(typeof p.name).toBe('string')
      expect(typeof p.nameTR).toBe('string')
      expect(p.distanceM).toBeGreaterThan(0)
      expect(p.weeks).toBeGreaterThan(0)
      expect(p.vdotMin).toBeGreaterThan(0)
      expect(p.vdotMax).toBeGreaterThan(p.vdotMin)
      expect(Array.isArray(p.sequence)).toBe(true)
      expect(p.sequence.length).toBe(p.weeks)
    }
  })
  it('each sequence entry has 6 elements', () => {
    for (const id of IDS) {
      for (const entry of PROGRAMS[id].sequence) {
        expect(entry).toHaveLength(6)
      }
    }
  })
  it('all program distances are valid race distances', () => {
    const validDist = [5000, 10000, 21097, 42195]
    for (const id of IDS) {
      expect(validDist).toContain(PROGRAMS[id].distanceM)
    }
  })
})

describe('buildStaticPlan — null/edge cases', () => {
  it('returns null for null programId', () => expect(buildStaticPlan(null, VDOT, START)).toBeNull())
  it('returns null for unknown programId', () => expect(buildStaticPlan('does-not-exist', VDOT, START)).toBeNull())
  it('returns null for zero VDOT', () => expect(buildStaticPlan('10k-24w', 0, START)).toBeNull())
  it('returns null for null planStart', () => expect(buildStaticPlan('10k-24w', VDOT, null)).toBeNull())
})

describe('buildStaticPlan — 10K 24-week', () => {
  const plan = buildStaticPlan('10k-24w', VDOT, START)

  it('returns array', () => expect(Array.isArray(plan)).toBe(true))
  it('has correct week count', () => expect(plan.length).toBe(24))
  it('week 1 starts on planStart', () => expect(plan[0].startDate).toBe(START))
  it('week nums are sequential', () => plan.forEach((w, i) => expect(w.weekNum).toBe(i + 1)))
  it('each week has 7 sessions', () => plan.forEach(w => expect(w.sessions).toHaveLength(7)))
  it('each week has startDate/endDate matching YYYY-MM-DD', () => {
    plan.forEach(w => {
      expect(w.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(w.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })
  it('each week has phase string', () => {
    plan.forEach(w => expect(typeof w.phase).toBe('string'))
  })
  it('each week has tss > 0', () => {
    plan.forEach(w => expect(w.tss).toBeGreaterThan(0))
  })
  it('deload weeks have lower TSS than adjacent non-deload weeks', () => {
    const deloads = plan.filter(w => w.isDeload)
    expect(deloads.length).toBeGreaterThan(0)
    deloads.forEach(dw => {
      // Find nearest non-deload in same phase
      const samePhase = plan.filter(w => w.phase === dw.phase && !w.isDeload)
      if (samePhase.length > 0) {
        const maxNormal = Math.max(...samePhase.map(w => w.tss))
        expect(dw.tss).toBeLessThan(maxNormal)
      }
    })
  })
  it('sessions with zone have paceStr', () => {
    for (const w of plan) {
      for (const s of w.sessions) {
        if (s.zone) {
          expect(s.paceStr).toMatch(/^\d+:\d{2}\/km$/)
        }
      }
    }
  })
  it('sessions with null zone have null paceStr', () => {
    for (const w of plan) {
      for (const s of w.sessions) {
        if (!s.zone) expect(s.paceStr).toBeNull()
      }
    }
  })
  it('has bilingual EN+TR descriptions per week', () => {
    plan.forEach(w => {
      expect(typeof w.en).toBe('string')
      expect(typeof w.tr).toBe('string')
      expect(w.en.length).toBeGreaterThan(5)
      expect(w.tr.length).toBeGreaterThan(5)
    })
  })
  it('phases include Base and Taper', () => {
    const phases = new Set(plan.map(w => w.phase))
    expect(phases.has('Base')).toBe(true)
    expect(phases.has('Taper')).toBe(true)
  })
  it('E sessions have the slowest pace in each week', () => {
    // In a week with both E and T sessions, E pace should be slower (higher secKm)
    for (const w of plan) {
      const eSess = w.sessions.find(s => s.zone === 'E')
      const tSess = w.sessions.find(s => s.zone === 'T')
      if (eSess && tSess && eSess.paceSecKm && tSess.paceSecKm) {
        expect(eSess.paceSecKm).toBeGreaterThan(tSess.paceSecKm)
      }
    }
  })
})

describe('buildStaticPlan — HM 18-week', () => {
  const plan = buildStaticPlan('hm-18w', VDOT, START)
  it('has 18 weeks', () => expect(plan.length).toBe(18))
  it('first week starts on planStart', () => expect(plan[0].startDate).toBe(START))
})

describe('buildStaticPlan — Marathon 18-week', () => {
  const plan = buildStaticPlan('marathon-18w', 42, START)
  it('has 18 weeks', () => expect(plan.length).toBe(18))
  it('has at least one M-pace session', () => {
    const allSessions = plan.flatMap(w => w.sessions)
    const mSessions   = allSessions.filter(s => s.zone === 'M')
    expect(mSessions.length).toBeGreaterThan(0)
  })
})

describe('getCurrentStaticWeek', () => {
  const plan = buildStaticPlan('10k-24w', VDOT, START)

  it('returns null for null plan', () => expect(getCurrentStaticWeek(null, START)).toBeNull())
  it('returns null for empty plan', () => expect(getCurrentStaticWeek([], START)).toBeNull())
  it('returns week 1 on planStart', () => {
    expect(getCurrentStaticWeek(plan, START)?.week?.weekNum).toBe(1)
  })
  it('returns week 1 before planStart', () => {
    expect(getCurrentStaticWeek(plan, '2026-01-01')?.weekIdx).toBe(0)
  })
  it('returns last week after plan end', () => {
    expect(getCurrentStaticWeek(plan, '2030-01-01')?.weekIdx).toBe(plan.length - 1)
  })
  it('returns week 5 at planStart + 28 days', () => {
    const d = new Date(START + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() + 28)
    const r = getCurrentStaticWeek(plan, d.toISOString().slice(0, 10))
    expect(r?.week?.weekNum).toBe(5)
  })
})
