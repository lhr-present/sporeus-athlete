// ─── cyclingNpTrend.test.js — pure-fn tests for 90d best-NP-by-duration ──────
import { describe, it, expect } from 'vitest'
import {
  computeCyclingNpTrend,
  CYCLING_NP_TREND_CITATION,
} from '../../athlete/cyclingNpTrend.js'
import { sanitizeLogEntry } from '../../validate.js'

const TODAY = '2026-05-15'

/** Return YYYY-MM-DD `n` days before `TODAY`. */
function daysAgo(n) {
  const d = new Date(TODAY + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

// Round-trip every entry through sanitizeLogEntry so tests exercise exactly
// what the app stores. Pre-fix the sanitizer STRIPPED `np`/`normalizedPower`,
// so the card was dead on real rides while raw-field tests passed. The
// whitelist add in validate.js means `np` now survives this round-trip — and
// any future regression that drops it from the whitelist will fail these tests.
function mk(raw) { return sanitizeLogEntry(raw) }

describe('computeCyclingNpTrend — null cases', () => {
  it('returns null for an empty log', () => {
    expect(computeCyclingNpTrend({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null when log has no bike sessions (only runs/swims)', () => {
    const log = [
      mk({ date: daysAgo(10), type: 'run',  np: 250, duration: 60 }),
      mk({ date: daysAgo(20), type: 'swim', np: 180, duration: 30 }),
    ]
    expect(computeCyclingNpTrend({ log, today: TODAY })).toBeNull()
  })

  it('returns null when bike sessions exist but have no NP field', () => {
    const log = [
      mk({ date: daysAgo(10), type: 'bike', duration: 60, tss: 75 }),
      mk({ date: daysAgo(20), type: 'ride', duration: 90, tss: 100 }),
    ]
    expect(computeCyclingNpTrend({ log, today: TODAY })).toBeNull()
  })

  it('returns null when bike sessions have NP but no duration', () => {
    const log = [
      mk({ date: daysAgo(10), type: 'bike', np: 250 }),
      mk({ date: daysAgo(20), type: 'bike', normalizedPower: 270 }),
    ]
    expect(computeCyclingNpTrend({ log, today: TODAY })).toBeNull()
  })

  it('returns null when all bike sessions are outside the 90d window', () => {
    const log = [
      mk({ date: daysAgo(120), type: 'bike', np: 250, duration: 60 }),
      mk({ date: daysAgo(200), type: 'bike', np: 280, duration: 60 }),
    ]
    expect(computeCyclingNpTrend({ log, today: TODAY })).toBeNull()
  })
})

describe('computeCyclingNpTrend — trend classification', () => {
  it("returns trend='rising' when recent best > early best by ≥3% across buckets", () => {
    const log = [
      // early window (~60–89 days ago): max 60-min NP = 200
      mk({ date: daysAgo(85), type: 'bike', np: 200, duration: 60 }),
      mk({ date: daysAgo(80), type: 'bike', np: 195, duration: 60 }),
      // mid window
      mk({ date: daysAgo(55), type: 'bike', np: 205, duration: 60 }),
      // recent window (~last 30 days): max 60-min NP = 220 (+10% vs early)
      mk({ date: daysAgo(20), type: 'bike', np: 220, duration: 60 }),
      mk({ date: daysAgo(5),  type: 'bike', np: 215, duration: 60 }),
    ]
    const r = computeCyclingNpTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.trend).toBe('rising')
    // 60-min bucket should specifically reflect rising
    const b60 = r.buckets.find(b => b.duration === 60)
    expect(b60.trend).toBe('rising')
    expect(b60.bestNp).toBe(220)
  })

  it("returns trend='falling' when recent best < early best by ≥3%", () => {
    const log = [
      mk({ date: daysAgo(85), type: 'bike', np: 250, duration: 60 }),
      mk({ date: daysAgo(80), type: 'bike', np: 245, duration: 60 }),
      mk({ date: daysAgo(55), type: 'bike', np: 240, duration: 60 }),
      mk({ date: daysAgo(20), type: 'bike', np: 220, duration: 60 }),
      mk({ date: daysAgo(5),  type: 'bike', np: 225, duration: 60 }),
    ]
    const r = computeCyclingNpTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.trend).toBe('falling')
    const b60 = r.buckets.find(b => b.duration === 60)
    expect(b60.trend).toBe('falling')
  })

  it("returns trend='stable' when recent vs early are within ±3%", () => {
    const log = [
      mk({ date: daysAgo(85), type: 'bike', np: 250, duration: 60 }),
      mk({ date: daysAgo(60), type: 'bike', np: 252, duration: 60 }),
      mk({ date: daysAgo(20), type: 'bike', np: 253, duration: 60 }),
      mk({ date: daysAgo(5),  type: 'bike', np: 251, duration: 60 }),
    ]
    const r = computeCyclingNpTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.trend).toBe('stable')
  })
})

describe('computeCyclingNpTrend — field handling + bucketing', () => {
  it('accepts both `np` and `normalizedPower` field names', () => {
    const log = [
      mk({ date: daysAgo(80), type: 'bike', np:              200, duration: 60 }),
      mk({ date: daysAgo(70), type: 'ride', normalizedPower: 210, duration: 60 }),
      mk({ date: daysAgo(10), type: 'bike', normalizedPower: 230, duration: 60 }),
    ]
    const r = computeCyclingNpTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    const b60 = r.buckets.find(b => b.duration === 60)
    expect(b60.bestNp).toBe(230)
  })

  it('buckets are correctly grouped by minimum duration (≥5, ≥20, ≥60)', () => {
    const log = [
      // 8-min effort (counts toward 5-min bucket only)
      mk({ date: daysAgo(10), type: 'bike', np: 350, duration: 8 }),
      // 25-min effort (counts toward 5+20)
      mk({ date: daysAgo(15), type: 'bike', np: 300, duration: 25 }),
      // 75-min effort (counts toward 5+20+60)
      mk({ date: daysAgo(20), type: 'bike', np: 250, duration: 75 }),
    ]
    const r = computeCyclingNpTrend({ log, today: TODAY, bucketMins: [5, 20, 60] })
    expect(r).not.toBeNull()
    const b5  = r.buckets.find(b => b.duration === 5)
    const b20 = r.buckets.find(b => b.duration === 20)
    const b60 = r.buckets.find(b => b.duration === 60)
    expect(b5.bestNp).toBe(350)   // 8-min effort wins 5-bucket
    expect(b20.bestNp).toBe(300)  // 25-min wins 20-bucket (8-min excluded)
    expect(b60.bestNp).toBe(250)  // only 75-min qualifies
  })

  it('returns a citation matching the published constant', () => {
    const log = [mk({ date: daysAgo(10), type: 'bike', np: 250, duration: 60 })]
    const r = computeCyclingNpTrend({ log, today: TODAY })
    expect(r.citation).toBe(CYCLING_NP_TREND_CITATION)
    expect(r.citation).toMatch(/Coggan/i)
  })

  it('latestBest reflects the recent-window best at the highest bucket with data', () => {
    const log = [
      // 5-min only data
      mk({ date: daysAgo(80), type: 'bike', np: 400, duration: 8 }),
      mk({ date: daysAgo(10), type: 'bike', np: 380, duration: 8 }),
      // 60-min data
      mk({ date: daysAgo(85), type: 'bike', np: 200, duration: 75 }),
      mk({ date: daysAgo(15), type: 'bike', np: 230, duration: 75 }),
    ]
    const r = computeCyclingNpTrend({ log, today: TODAY })
    // highest bucket with data = 60-min, recent best there = 230
    expect(r.latestBest).toBe(230)
  })

  it('omits buckets that have no qualifying session entirely', () => {
    const log = [
      // only 7-min efforts — 20-min and 60-min buckets get no data
      mk({ date: daysAgo(10), type: 'bike', np: 320, duration: 7 }),
      mk({ date: daysAgo(40), type: 'bike', np: 310, duration: 7 }),
    ]
    const r = computeCyclingNpTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.buckets.map(b => b.duration)).toEqual([5])
  })
})
