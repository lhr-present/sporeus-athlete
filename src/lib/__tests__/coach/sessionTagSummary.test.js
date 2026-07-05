// v9.472.0 — coach execution-profile aggregator tests (E4 reader).

import { describe, it, expect } from 'vitest'
import { summarizeSessionTags, TAG_ORDER, TAG_COLORS } from '../../coach/sessionTagSummary.js'

const db = (over = {}) => ({ date: '2026-07-01', type: 'row', duration_min: 60, tss: 60, rpe: 6, session_tag: null, ...over })

describe('summarizeSessionTags', () => {
  it('prefers the stored session_tag over recomputation', () => {
    const out = summarizeSessionTags([db({ session_tag: 'planned_match', duration_min: 10, rpe: 2 })])
    expect(out.counts.planned_match).toBe(1)
    expect(out.counts.junk).toBe(0)  // would classify junk if recomputed
  })

  it('classifies untagged history rows on the fly (DB shape: duration_min)', () => {
    const out = summarizeSessionTags([
      db({}),                                        // moderate
      db({ tss: 160 }),                              // unplanned_high (absolute load)
      db({ type: 'CP Test' }),                       // test
      db({ duration_min: 30, rpe: 3 }),              // recovery
    ])
    expect(out.total).toBe(4)
    expect(out.counts.moderate).toBe(1)
    expect(out.counts.unplanned_high).toBe(1)
    expect(out.counts.test).toBe(1)
    expect(out.counts.recovery).toBe(1)
  })

  it('accepts entry shape (duration, sessionTag) — demo data path', () => {
    const out = summarizeSessionTags([{ date: '2026-07-01', type: 'Run', duration: 60, tss: 70, rpe: 6, sessionTag: 'moderate' }])
    expect(out.counts.moderate).toBe(1)
  })

  it('share sums to ~100 and unknown/garbage rows are skipped', () => {
    const out = summarizeSessionTags([db({}), db({}), null, 'x', db({ tss: 200 })])
    expect(out.total).toBe(3)
    const sum = Object.values(out.share).reduce((s, v) => s + v, 0)
    expect(sum).toBeGreaterThanOrEqual(99)
    expect(sum).toBeLessThanOrEqual(101)
  })

  it('flags heavy junk share only at n>=6', () => {
    const junky = Array.from({ length: 4 }, () => db({ duration_min: 10, rpe: 2 }))
    expect(summarizeSessionTags([...junky, db({}), db({})]).flags.some(f => f.en.includes('junk'))).toBe(true)
    expect(summarizeSessionTags(junky).flags.length).toBe(0)  // n=4 < 6
  })

  it('flags unplanned-high pattern and easy-window info', () => {
    const high = Array.from({ length: 3 }, () => db({ tss: 180 }))
    const rest = Array.from({ length: 3 }, () => db({}))
    expect(summarizeSessionTags([...high, ...rest]).flags.some(f => f.en.includes('high-load'))).toBe(true)
    const easy = Array.from({ length: 6 }, () => db({ duration_min: 30, rpe: 3 }))
    expect(summarizeSessionTags(easy).flags.some(f => f.level === 'info')).toBe(true)
  })

  it('empty input → zero totals, no flags', () => {
    const out = summarizeSessionTags([])
    expect(out.total).toBe(0)
    expect(out.flags).toEqual([])
  })

  it('every TAG_ORDER tag has a color', () => {
    for (const t of TAG_ORDER) expect(TAG_COLORS[t]).toMatch(/^#/)
  })
})

// ─── v9.476 — plan-aware mode ─────────────────────────────────────────────────
import { adaptCoachPlan } from '../../coach/sessionTagSummary.js'

describe('adaptCoachPlan (v9.476)', () => {
  const planRow = {
    start_date: '2026-06-01',
    weeks: [
      { week: 1, phase: 'Base',  tss: 300 },
      { week: 2, phase: 'Build', tss: 350 },
    ],
  }
  it('derives startDate per week from top-level start_date + i×7d, tssEst from week.tss', () => {
    const p = adaptCoachPlan(planRow)
    expect(p.weeks).toHaveLength(2)
    expect(p.weeks[0]).toMatchObject({ startDate: '2026-06-01', tssEst: 300 })
    expect(p.weeks[1]).toMatchObject({ startDate: '2026-06-08', tssEst: 350 })
    expect(p.weeks[1].weekLabel).toBe('W2 Build')
  })
  it('null for missing/invalid input', () => {
    expect(adaptCoachPlan(null)).toBeNull()
    expect(adaptCoachPlan({ weeks: [] })).toBeNull()
    expect(adaptCoachPlan({ start_date: 'garbage', weeks: [{ tss: 300 }] })).toBeNull()
  })
})

describe('summarizeSessionTags — plan-aware (v9.476)', () => {
  const plan = adaptCoachPlan({
    start_date: '2026-06-01',
    weeks: [{ week: 1, tss: 300 }, { week: 2, tss: 300 }, { week: 3, tss: 300 }],
  })
  // per-session target = 300/5 = 60 TSS; match band 0.8–1.4 → 48–84

  it('plan context refines tags: in-band → planned_match, far-below → unplanned_low (stored tag superseded)', () => {
    const rows = [
      db({ date: '2026-06-02', tss: 60, session_tag: 'moderate' }),   // in band → planned_match
      db({ date: '2026-06-03', tss: 20, session_tag: 'moderate' }),   // 33% of target → unplanned_low
    ]
    const out = summarizeSessionTags(rows, { plan, today: '2026-06-10' })
    expect(out.planAware).toBe(true)
    expect(out.counts.planned_match).toBe(1)
    expect(out.counts.unplanned_low).toBe(1)
    expect(out.counts.moderate).toBe(0)
  })

  it('counts planned_miss for elapsed target weeks with zero sessions; misses excluded from share', () => {
    // Sessions only in week 1; weeks 2 (06-08..06-14) fully elapsed by 06-16 with no sessions.
    const rows = [db({ date: '2026-06-02', tss: 60 })]
    const out = summarizeSessionTags(rows, { plan, today: '2026-06-16' })
    expect(out.counts.planned_miss).toBe(1)   // week 2 (week 3 not finished by 06-16)
    expect(out.total).toBe(1)                 // misses are not sessions
    expect(out.share.planned_miss).toBe(0)
    expect(out.flags.some(f => f.en.includes('plan week'))).toBe(true)
  })

  it('unfinished and out-of-window weeks do not count as misses', () => {
    const rows = [db({ date: '2026-06-02', tss: 60 })]
    // today mid-week-2: week 2 not finished → no miss
    expect(summarizeSessionTags(rows, { plan, today: '2026-06-10' }).counts.planned_miss).toBe(0)
    // today far later: weeks outside the 28d miss window don't count
    const late = summarizeSessionTags(rows, { plan, today: '2026-09-01' })
    expect(late.counts.planned_miss).toBe(0)
  })

  it('back-compat: single-arg call stays plan-less (stored tags win)', () => {
    const out = summarizeSessionTags([db({ session_tag: 'recovery' })])
    expect(out.planAware).toBe(false)
    expect(out.counts.recovery).toBe(1)
  })

  it('v9.480 — coverage guard: weeks older than the oldest fetched row are not judged (last-N fetch ≠ date window)', () => {
    // High-volume athlete: fetch coverage starts 06-10; week 1 (06-01..06-08)
    // is OLDER than coverage → must NOT count as a miss despite no rows in it.
    const rows = [db({ date: '2026-06-10', tss: 60 }), db({ date: '2026-06-12', tss: 60 })]
    const out = summarizeSessionTags(rows, { plan, today: '2026-06-16' })
    expect(out.counts.planned_miss).toBe(0)
    // Empty fetch → nothing judgeable → zero misses (conservative).
    expect(summarizeSessionTags([], { plan, today: '2026-06-16' }).counts.planned_miss).toBe(0)
  })
})
