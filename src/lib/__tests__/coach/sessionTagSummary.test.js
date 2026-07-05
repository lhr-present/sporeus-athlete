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
