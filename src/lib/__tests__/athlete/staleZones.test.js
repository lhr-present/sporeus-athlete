// ─── staleZones.test.js — E120: Stale Zones Detector unit tests ──────────────
import { describe, it, expect } from 'vitest'
import { detectStaleZones } from '../../athlete/staleZones.js'

const TODAY = '2026-04-30'

// ─── Synthetic log helpers ───────────────────────────────────────────────────
/**
 * Build a log of `count` daily entries ending on `today`. Each entry's zones
 * are the per-zone contribution array (length 5). Returns oldest→newest.
 */
function makeLog(count, today, zonesArr) {
  const log = []
  const base = new Date(today + 'T00:00:00Z')
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() - i)
    log.push({
      date: d.toISOString().slice(0, 10),
      zones: zonesArr.slice(),
      duration: zonesArr.reduce((s, v) => s + v, 0),
      type: 'run',
      tss: zonesArr.reduce((s, v) => s + v, 0),
    })
  }
  return log
}

/**
 * Like makeLog but the last `recentDays` entries use `recentZones` and the
 * older portion uses `oldZones`. Useful for "drop" scenarios.
 */
function makeSplitLog(totalDays, recentDays, today, oldZones, recentZones) {
  const log = []
  const base = new Date(today + 'T00:00:00Z')
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() - i)
    const zones = i < recentDays ? recentZones : oldZones
    log.push({
      date: d.toISOString().slice(0, 10),
      zones: zones.slice(),
      duration: zones.reduce((s, v) => s + v, 0),
      type: 'run',
    })
  }
  return log
}

// ─── Tests ──────────────────────────────────────────────────────────────────
describe('detectStaleZones — empty / null inputs', () => {
  it('returns empty zones + reliable=false for null log', () => {
    const r = detectStaleZones(null, TODAY)
    expect(r.zones).toEqual([])
    expect(r.reliable).toBe(false)
    expect(r.summary).toEqual({ stale: 0, dropped: 0, healthy: 0 })
  })

  it('returns empty zones + reliable=false for empty log', () => {
    const r = detectStaleZones([], TODAY)
    expect(r.zones).toEqual([])
    expect(r.reliable).toBe(false)
  })

  it('returns empty zones + reliable=false for non-array input', () => {
    const r = detectStaleZones('not-a-log', TODAY)
    expect(r.zones).toEqual([])
    expect(r.reliable).toBe(false)
  })

  it('always carries the citation string', () => {
    const r = detectStaleZones([], TODAY)
    expect(r.citation).toBe('Seiler 2010 polarized; Foster 2001')
  })
})

describe('detectStaleZones — reliability flag', () => {
  it('marks reliable=false when log spans < 14 distinct days', () => {
    const log = makeLog(10, TODAY, [10, 30, 5, 3, 2])
    const r = detectStaleZones(log, TODAY)
    expect(r.reliable).toBe(false)
    // Still computes zones array (always 5 entries)
    expect(r.zones.length).toBe(5)
  })

  it('marks reliable=true when log spans ≥ 14 distinct days', () => {
    const log = makeLog(20, TODAY, [10, 30, 5, 3, 2])
    const r = detectStaleZones(log, TODAY)
    expect(r.reliable).toBe(true)
  })

  it('still computes zones with sparse data', () => {
    const log = makeLog(5, TODAY, [0, 60, 0, 0, 0])
    const r = detectStaleZones(log, TODAY)
    expect(r.zones.length).toBe(5)
    expect(r.reliable).toBe(false)
  })
})

describe('detectStaleZones — all-Z2 log', () => {
  it('flags Z1, Z3, Z4, Z5 as stale when all training is Z2', () => {
    const log = makeLog(28, TODAY, [0, 60, 0, 0, 0])
    const r = detectStaleZones(log, TODAY)
    const byZone = Object.fromEntries(r.zones.map(z => [z.zone, z]))
    expect(byZone.Z1.status).toBe('stale')
    expect(byZone.Z2.status).toBe('healthy')
    expect(byZone.Z3.status).toBe('stale')
    expect(byZone.Z4.status).toBe('stale')
    expect(byZone.Z5.status).toBe('stale')
  })

  it('summary counts 4 stale, 1 healthy', () => {
    const log = makeLog(28, TODAY, [0, 60, 0, 0, 0])
    const r = detectStaleZones(log, TODAY)
    expect(r.summary.stale).toBe(4)
    expect(r.summary.healthy).toBe(1)
    expect(r.summary.dropped).toBe(0)
  })
})

describe('detectStaleZones — dropped status', () => {
  it('flags Z2 as dropped when recent 7d share is much lower than prior 21d', () => {
    // Prior 21 days: heavy Z2; last 7 days: nearly zero Z2 (replaced by Z4)
    const log = makeSplitLog(28, 7, TODAY,
      [10, 80, 5, 3, 2],   // old: Z2 dominant (~76%)
      [10, 5, 5, 70, 10],  // recent: Z2 only ~5%
    )
    const r = detectStaleZones(log, TODAY)
    const z2 = r.zones.find(z => z.zone === 'Z2')
    expect(z2.status).toBe('dropped')
    expect(z2.message.en).toMatch(/dropped/)
    expect(z2.message.tr).toMatch(/düştü/)
  })

  it('does not flag dropped when recent share is comparable to prior', () => {
    const log = makeLog(28, TODAY, [10, 50, 20, 15, 5])
    const r = detectStaleZones(log, TODAY)
    const z2 = r.zones.find(z => z.zone === 'Z2')
    expect(z2.status).toBe('healthy')
  })
})

describe('detectStaleZones — healthy polarized mix', () => {
  it('returns 5 healthy zones for a Seiler 80/20 polarized distribution', () => {
    // Z1=15%, Z2=65%, Z3=5%, Z4=10%, Z5=5% — every zone above 5%
    const log = makeLog(28, TODAY, [15, 65, 5, 10, 5])
    const r = detectStaleZones(log, TODAY)
    expect(r.summary.healthy).toBe(5)
    expect(r.summary.stale).toBe(0)
    expect(r.summary.dropped).toBe(0)
  })
})

describe('detectStaleZones — boundary conditions', () => {
  it('does NOT flag stale at exactly 5% share (strict less-than)', () => {
    // Build totals so Z3 is exactly 5/100 = 5.0%
    // Use fixed integers: total 100 per day, Z3 = 5
    const log = makeLog(28, TODAY, [20, 65, 5, 5, 5])
    const r = detectStaleZones(log, TODAY)
    const z3 = r.zones.find(z => z.zone === 'Z3')
    expect(z3.share28d).toBe(5)
    expect(z3.status).not.toBe('stale')
  })

  it('flags stale when share is strictly below 5% (e.g. 4.9%)', () => {
    // Z5 contributes 4 out of 100 per day → 4%
    const log = makeLog(28, TODAY, [20, 66, 5, 5, 4])
    const r = detectStaleZones(log, TODAY)
    const z5 = r.zones.find(z => z.zone === 'Z5')
    expect(z5.share28d).toBeLessThan(5)
    expect(z5.status).toBe('stale')
  })

  it('does NOT flag dropped at exactly 50% of prior-21d share (strict less-than)', () => {
    // Prior 21d: Z3 share = 20% ; Recent 7d: Z3 share = 10% (exactly half).
    // Use uniform totals so shares are integer-friendly.
    const log = makeSplitLog(28, 7, TODAY,
      [20, 50, 20, 5, 5],   // Z3 = 20/100 = 20%
      [20, 60, 10, 5, 5],   // Z3 = 10/100 = 10%  (exactly half of 20%)
    )
    const r = detectStaleZones(log, TODAY)
    const z3 = r.zones.find(z => z.zone === 'Z3')
    expect(z3.share7d).toBe(10)
    expect(z3.share21d).toBe(20)
    expect(z3.status).not.toBe('dropped')
  })

  it('flags dropped when recent share is strictly below 50% of prior', () => {
    // Prior: Z3 share = 20%; Recent: Z3 = 8% (< 10%)
    const log = makeSplitLog(28, 7, TODAY,
      [20, 50, 20, 5, 5],
      [22, 60, 8, 5, 5],
    )
    const r = detectStaleZones(log, TODAY)
    const z3 = r.zones.find(z => z.zone === 'Z3')
    expect(z3.share7d).toBeLessThan(z3.share21d * 0.5)
    expect(z3.status).toBe('dropped')
  })
})

describe('detectStaleZones — invariants', () => {
  it('always returns exactly 5 zone entries (Z1..Z5) when log non-empty', () => {
    const log = makeLog(28, TODAY, [10, 50, 20, 15, 5])
    const r = detectStaleZones(log, TODAY)
    expect(r.zones.length).toBe(5)
    expect(r.zones.map(z => z.zone)).toEqual(['Z1', 'Z2', 'Z3', 'Z4', 'Z5'])
  })

  it('summary counts always sum to 5 when log non-empty', () => {
    const log = makeLog(28, TODAY, [10, 50, 20, 15, 5])
    const r = detectStaleZones(log, TODAY)
    expect(r.summary.stale + r.summary.dropped + r.summary.healthy).toBe(5)
  })

  it('summary counts sum to 5 even with all-stale extreme', () => {
    // Single tiny Z2 entry → others all stale
    const log = makeLog(28, TODAY, [0, 1, 0, 0, 0])
    const r = detectStaleZones(log, TODAY)
    expect(r.summary.stale + r.summary.dropped + r.summary.healthy).toBe(5)
  })
})

describe('detectStaleZones — bilingual messages', () => {
  it('stale messages have non-empty en + tr strings', () => {
    const log = makeLog(28, TODAY, [0, 60, 0, 0, 0])
    const r = detectStaleZones(log, TODAY)
    const stale = r.zones.filter(z => z.status === 'stale')
    expect(stale.length).toBeGreaterThan(0)
    for (const z of stale) {
      expect(z.message.en.length).toBeGreaterThan(0)
      expect(z.message.tr.length).toBeGreaterThan(0)
    }
  })

  it('dropped messages have non-empty en + tr strings', () => {
    const log = makeSplitLog(28, 7, TODAY,
      [10, 80, 5, 3, 2],
      [10, 5, 5, 70, 10],
    )
    const r = detectStaleZones(log, TODAY)
    const dropped = r.zones.filter(z => z.status === 'dropped')
    expect(dropped.length).toBeGreaterThan(0)
    for (const z of dropped) {
      expect(z.message.en.length).toBeGreaterThan(0)
      expect(z.message.tr.length).toBeGreaterThan(0)
    }
  })

  it('healthy messages are empty strings for both languages', () => {
    const log = makeLog(28, TODAY, [15, 65, 5, 10, 5])
    const r = detectStaleZones(log, TODAY)
    const healthy = r.zones.filter(z => z.status === 'healthy')
    for (const z of healthy) {
      expect(z.message.en).toBe('')
      expect(z.message.tr).toBe('')
    }
  })

  it('stale Z5 message includes VO2max label in both languages', () => {
    const log = makeLog(28, TODAY, [0, 60, 0, 0, 0])
    const r = detectStaleZones(log, TODAY)
    const z5 = r.zones.find(z => z.zone === 'Z5')
    expect(z5.status).toBe('stale')
    expect(z5.message.en).toMatch(/VO2max/)
    expect(z5.message.tr).toMatch(/VO2max/)
  })
})

describe('detectStaleZones — citation present', () => {
  it('returns Seiler+Foster citation in result', () => {
    const log = makeLog(28, TODAY, [10, 50, 20, 15, 5])
    const r = detectStaleZones(log, TODAY)
    expect(r.citation).toBe('Seiler 2010 polarized; Foster 2001')
  })
})

describe('detectStaleZones — UTC bucketing', () => {
  it('treats date strings as UTC days regardless of host timezone', () => {
    // An entry with date '2026-04-30' must always fall in the today bucket
    // even if interpreted naively as midnight in UTC+3 (which would shift to 04-29 21:00).
    // We rely on string compare against UTC-derived window boundaries.
    const log = [{
      date: '2026-04-30',
      zones: [0, 0, 0, 0, 60],  // pure Z5
      type: 'run',
    }]
    const r = detectStaleZones(log, '2026-04-30')
    const z5 = r.zones.find(z => z.zone === 'Z5')
    // Z5 is 100% of the only entry → it's healthy (not stale)
    expect(z5.status).toBe('healthy')
    expect(z5.share28d).toBe(100)
  })

  it('window boundary at exactly today-27 is INCLUDED (28d window)', () => {
    // today=2026-04-30; today-27 = 2026-04-03
    const oldEntry = { date: '2026-04-03', zones: [0, 0, 0, 0, 60], type: 'run' }
    const r = detectStaleZones([oldEntry], '2026-04-30')
    const z5 = r.zones.find(z => z.zone === 'Z5')
    expect(z5.share28d).toBe(100)
  })

  it('window boundary at today-28 is EXCLUDED', () => {
    const tooOld = { date: '2026-04-02', zones: [0, 0, 0, 0, 60], type: 'run' }
    const r = detectStaleZones([tooOld], '2026-04-30')
    // No data within 28d window → all shares are 0 → no stale flag fires
    // (because sum28 === 0 short-circuits the stale check).
    expect(r.summary.stale).toBe(0)
    expect(r.summary.healthy).toBe(5)
  })
})

describe('detectStaleZones — alternate zones shapes', () => {
  it('parses object-shaped zones {Z1, Z2, ...}', () => {
    const log = []
    const base = new Date(TODAY + 'T00:00:00Z')
    for (let i = 27; i >= 0; i--) {
      const d = new Date(base)
      d.setUTCDate(d.getUTCDate() - i)
      log.push({
        date: d.toISOString().slice(0, 10),
        zones: { Z1: 10, Z2: 50, Z3: 20, Z4: 15, Z5: 5 },
        type: 'run',
      })
    }
    const r = detectStaleZones(log, TODAY)
    expect(r.summary.healthy).toBe(5)
    expect(r.reliable).toBe(true)
  })

  it('falls back to RPE-bucketed duration when zones are missing', () => {
    // High-RPE sessions only → should bias toward Z4/Z5 buckets
    const log = []
    const base = new Date(TODAY + 'T00:00:00Z')
    for (let i = 27; i >= 0; i--) {
      const d = new Date(base)
      d.setUTCDate(d.getUTCDate() - i)
      log.push({
        date: d.toISOString().slice(0, 10),
        duration: 60,
        rpe: 9,  // → bucket index 4 (Z5)
        type: 'run',
      })
    }
    const r = detectStaleZones(log, TODAY)
    const z5 = r.zones.find(z => z.zone === 'Z5')
    expect(z5.status).toBe('healthy')
    // Z1..Z4 should be flagged stale (no data in those buckets)
    const z1 = r.zones.find(z => z.zone === 'Z1')
    expect(z1.status).toBe('stale')
  })
})
