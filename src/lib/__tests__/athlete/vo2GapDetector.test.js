// vo2GapDetector — unit tests
import { describe, it, expect } from 'vitest'
import { detectVO2Gap, VO2_GAP_CITATION } from '../../athlete/vo2GapDetector.js'

const TODAY = '2026-05-04'

// ─── Helpers ────────────────────────────────────────────────────────────────
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Build an entry with explicit per-zone TSS (array shape).
 * zones[4] = Z5.
 */
function entryZ(date, [z1, z2, z3, z4, z5]) {
  return { date, type: 'run', zones: [z1, z2, z3, z4, z5] }
}

/**
 * Build a "padding" base load: a fixed Z2-only entry so the window has
 * non-trivial total load when we want to test share thresholds.
 * Uses object-shape zones to also exercise that branch.
 */
function pad(date, z2 = 60) {
  return { date, type: 'run', zones: { Z1: 0, Z2: z2, Z3: 0, Z4: 0, Z5: 0 } }
}

// ─── Empty / null inputs ────────────────────────────────────────────────────
describe('detectVO2Gap — empty / null inputs', () => {
  it('null log → safe defaults, ok band, reliable=false', () => {
    const r = detectVO2Gap(null, TODAY)
    expect(r.daysSinceZ5).toBeNull()
    expect(r.z5Sessions).toBe(0)
    expect(r.z5Total).toBe(0)
    expect(r.share28d).toBe(0)
    expect(r.lastZ5Date).toBeNull()
    expect(r.band).toBe('ok')
    expect(r.reliable).toBe(false)
    expect(r.citation).toBe('Stöggl & Sperlich 2014; Seiler 2010')
  })

  it('empty log → safe defaults', () => {
    const r = detectVO2Gap([], TODAY)
    expect(r.band).toBe('ok')
    expect(r.reliable).toBe(false)
  })

  it('non-array log (object) → safe defaults', () => {
    const r = detectVO2Gap({ foo: 'bar' }, TODAY)
    expect(r.band).toBe('ok')
    expect(r.daysSinceZ5).toBeNull()
  })

  it('entries with malformed dates are skipped', () => {
    const log = [
      { date: 'not-a-date', zones: [0, 0, 0, 0, 50] },
      { date: null, zones: [0, 0, 0, 0, 50] },
      { date: TODAY, zones: [0, 0, 0, 0, 30] },
    ]
    const r = detectVO2Gap(log, TODAY)
    expect(r.z5Sessions).toBe(1)
    expect(r.z5Total).toBe(30)
  })
})

// ─── Window filtering ───────────────────────────────────────────────────────
describe('detectVO2Gap — window filtering', () => {
  it('entries older than 28 days are ignored', () => {
    const log = [
      entryZ(addDays(TODAY, -30), [0, 0, 0, 0, 50]),
      entryZ(addDays(TODAY, -28), [0, 0, 0, 0, 50]),
      entryZ(addDays(TODAY, -10), [0, 0, 0, 0, 30]),
    ]
    const r = detectVO2Gap(log, TODAY)
    expect(r.z5Sessions).toBe(1)
    expect(r.z5Total).toBe(30)
    expect(r.lastZ5Date).toBe(addDays(TODAY, -10))
  })

  it('entries dated after today are ignored', () => {
    const log = [
      entryZ(addDays(TODAY, 1), [0, 0, 0, 0, 999]),
      entryZ(addDays(TODAY, 5), [0, 0, 0, 0, 999]),
      entryZ(TODAY, [0, 0, 0, 0, 40]),
    ]
    const r = detectVO2Gap(log, TODAY)
    expect(r.z5Sessions).toBe(1)
    expect(r.z5Total).toBe(40)
  })

  it('exact start of 28d window (today-27) is included', () => {
    const log = [
      entryZ(addDays(TODAY, -27), [0, 0, 0, 0, 25]),
      entryZ(addDays(TODAY, -28), [0, 0, 0, 0, 999]),
    ]
    const r = detectVO2Gap(log, TODAY)
    expect(r.z5Sessions).toBe(1)
    expect(r.z5Total).toBe(25)
  })
})

// ─── Recency math ───────────────────────────────────────────────────────────
describe('detectVO2Gap — daysSinceZ5', () => {
  it('Z5 today → daysSinceZ5 = 0', () => {
    const r = detectVO2Gap([entryZ(TODAY, [0, 0, 0, 0, 30])], TODAY)
    expect(r.daysSinceZ5).toBe(0)
    expect(r.lastZ5Date).toBe(TODAY)
  })

  it('Z5 7 days ago → daysSinceZ5 = 7', () => {
    const r = detectVO2Gap([entryZ(addDays(TODAY, -7), [0, 0, 0, 0, 30])], TODAY)
    expect(r.daysSinceZ5).toBe(7)
  })

  it('multiple Z5 entries → uses most recent', () => {
    const log = [
      entryZ(addDays(TODAY, -20), [0, 0, 0, 0, 50]),
      entryZ(addDays(TODAY, -5), [0, 0, 0, 0, 30]),
      entryZ(addDays(TODAY, -15), [0, 0, 0, 0, 40]),
    ]
    const r = detectVO2Gap(log, TODAY)
    expect(r.daysSinceZ5).toBe(5)
    expect(r.lastZ5Date).toBe(addDays(TODAY, -5))
    expect(r.z5Sessions).toBe(3)
  })

  it('only Z2/Z3 in window → daysSinceZ5 null', () => {
    const log = [
      entryZ(addDays(TODAY, -2), [0, 60, 0, 0, 0]),
      entryZ(addDays(TODAY, -5), [0, 0, 30, 0, 0]),
    ]
    const r = detectVO2Gap(log, TODAY)
    expect(r.daysSinceZ5).toBeNull()
    expect(r.z5Sessions).toBe(0)
  })
})

// ─── Band classification ────────────────────────────────────────────────────
describe('detectVO2Gap — band: ok', () => {
  it('Z5 today + share above 5% → ok', () => {
    // Z5 today=20, plus a single Z2=60 entry: share = 20/(20+60)=25% → ok
    const log = [
      entryZ(TODAY, [0, 0, 0, 0, 20]),
      pad(addDays(TODAY, -1), 60),
    ]
    const r = detectVO2Gap(log, TODAY)
    expect(r.band).toBe('ok')
    expect(r.message.en).toMatch(/on target/i)
    expect(r.message.tr).toMatch(/hedefte/)
    expect(r.recommendation.en).toBe('')
  })
})

describe('detectVO2Gap — band: warning', () => {
  it('Z5 within last 12 days but share <5% → warning', () => {
    // Z5 12 days ago = 5; pad with Z2=400 → share = 5/405 ≈ 1.2% — that is <2 → severe.
    // Use Z5=10, Z2=300 → 10/310 ≈ 3.2% → between 2 and 5 → warning (recency 12 → also warning band)
    const log = [
      entryZ(addDays(TODAY, -12), [0, 0, 0, 0, 10]),
      pad(addDays(TODAY, -1), 300),
    ]
    const r = detectVO2Gap(log, TODAY)
    expect(r.band).toBe('warning')
    expect(r.message.en).toMatch(/tapering/i)
    expect(r.message.tr).toMatch(/azalıyor/)
    expect(r.recommendation.en.length).toBeGreaterThan(0)
    expect(r.recommendation.tr.length).toBeGreaterThan(0)
  })

  it('Z5 today but share <5% → warning (share-driven)', () => {
    // Z5=3, Z2=200 → 3/203 ≈ 1.5% — that is <2 → severe; bump to Z5=8 → 8/208≈3.8% → warning
    const log = [
      entryZ(TODAY, [0, 0, 0, 0, 8]),
      pad(addDays(TODAY, -1), 200),
    ]
    const r = detectVO2Gap(log, TODAY)
    expect(r.daysSinceZ5).toBe(0)
    expect(r.share28d).toBeGreaterThanOrEqual(2)
    expect(r.share28d).toBeLessThan(5)
    expect(r.band).toBe('warning')
  })
})

describe('detectVO2Gap — band: critical', () => {
  it('Z5 16 days ago → critical', () => {
    // recency 16 → between 15 and 21 → critical; share decent (Z5=30, Z2=60 → 33%) so share is fine
    const log = [
      entryZ(addDays(TODAY, -16), [0, 0, 0, 0, 30]),
      pad(addDays(TODAY, -1), 60),
    ]
    const r = detectVO2Gap(log, TODAY)
    expect(r.band).toBe('critical')
    expect(r.message.en).toMatch(/Significant/i)
    expect(r.message.tr).toMatch(/Belirgin/)
    expect(r.recommendation.en).toMatch(/3 days/i)
    expect(r.recommendation.tr).toMatch(/3 gün/)
  })
})

describe('detectVO2Gap — band: severe', () => {
  it('Z5 25 days ago → severe (recency >21)', () => {
    const log = [
      entryZ(addDays(TODAY, -25), [0, 0, 0, 0, 30]),
      pad(addDays(TODAY, -1), 60),
    ]
    const r = detectVO2Gap(log, TODAY)
    expect(r.daysSinceZ5).toBe(25)
    expect(r.band).toBe('severe')
    expect(r.message.en).toMatch(/Prolonged/i)
    expect(r.message.tr).toMatch(/Uzun süreli/)
  })

  it('share <2% with Z5 today → severe (share-driven)', () => {
    // Z5=2, Z2=300 → share ≈ 0.66% → <2 → severe
    const log = [
      entryZ(TODAY, [0, 0, 0, 0, 2]),
      pad(addDays(TODAY, -1), 300),
    ]
    const r = detectVO2Gap(log, TODAY)
    expect(r.share28d).toBeLessThan(2)
    expect(r.band).toBe('severe')
  })
})

describe('detectVO2Gap — band: never', () => {
  it('no Z5 in window but other zones logged → never', () => {
    const log = [
      pad(addDays(TODAY, -2), 60),
      pad(addDays(TODAY, -5), 60),
    ]
    const r = detectVO2Gap(log, TODAY)
    expect(r.daysSinceZ5).toBeNull()
    expect(r.band).toBe('never')
    expect(r.message.en).toMatch(/No VO2max work/i)
    expect(r.message.tr).toMatch(/kaydedilmemiş/)
    expect(r.recommendation.en).toMatch(/primer/i)
  })

  it('all entries outside window → ok (no load → nothing to flag)', () => {
    const log = [entryZ(addDays(TODAY, -40), [0, 60, 0, 0, 0])]
    const r = detectVO2Gap(log, TODAY)
    expect(r.band).toBe('ok')
  })
})

// ─── Reliability ────────────────────────────────────────────────────────────
describe('detectVO2Gap — reliability', () => {
  it('<14 distinct days in window → reliable: false', () => {
    const log = []
    for (let i = 0; i < 13; i++) log.push(pad(addDays(TODAY, -i), 30))
    const r = detectVO2Gap(log, TODAY)
    expect(r.reliable).toBe(false)
  })

  it('exactly 14 distinct days in window → reliable: true', () => {
    const log = []
    for (let i = 0; i < 14; i++) log.push(pad(addDays(TODAY, -i), 30))
    const r = detectVO2Gap(log, TODAY)
    expect(r.reliable).toBe(true)
  })

  it('multiple entries on same day count as one distinct day', () => {
    const log = []
    for (let i = 0; i < 13; i++) log.push(pad(addDays(TODAY, -i), 30))
    log.push(pad(addDays(TODAY, -1), 30)) // duplicate day
    const r = detectVO2Gap(log, TODAY)
    expect(r.reliable).toBe(false) // still 13 distinct
  })
})

// ─── Zone-shape variants ────────────────────────────────────────────────────
describe('detectVO2Gap — zone parsing variants', () => {
  it('object-shape zones (capital) are read', () => {
    const log = [
      { date: TODAY, type: 'bike', zones: { Z1: 0, Z2: 0, Z3: 0, Z4: 0, Z5: 25 } },
    ]
    const r = detectVO2Gap(log, TODAY)
    expect(r.z5Total).toBe(25)
    expect(r.daysSinceZ5).toBe(0)
  })

  it('object-shape zones (lowercase) are read', () => {
    const log = [
      { date: TODAY, type: 'bike', zones: { z1: 0, z2: 0, z3: 0, z4: 0, z5: 18 } },
    ]
    const r = detectVO2Gap(log, TODAY)
    expect(r.z5Total).toBe(18)
  })

  it('RPE+duration fallback maps RPE 9 to Z5', () => {
    const log = [
      { date: TODAY, type: 'run', duration: 35, rpe: 9 },
      pad(addDays(TODAY, -1), 60),
    ]
    const r = detectVO2Gap(log, TODAY)
    expect(r.z5Sessions).toBe(1)
    expect(r.z5Total).toBe(35)
    expect(r.daysSinceZ5).toBe(0)
  })

  it('RPE 7 with duration → falls into Z3, not Z5', () => {
    const log = [{ date: TODAY, type: 'run', duration: 50, rpe: 7 }]
    const r = detectVO2Gap(log, TODAY)
    expect(r.z5Sessions).toBe(0)
    expect(r.daysSinceZ5).toBeNull()
  })

  it('multiple Z5 sessions on same day are summed', () => {
    const log = [
      entryZ(TODAY, [0, 0, 0, 0, 10]),
      entryZ(TODAY, [0, 0, 0, 0, 15]),
    ]
    const r = detectVO2Gap(log, TODAY)
    expect(r.z5Sessions).toBe(2)
    expect(r.z5Total).toBe(25)
    expect(r.daysSinceZ5).toBe(0)
  })
})

// ─── Bilingual messages ─────────────────────────────────────────────────────
describe('detectVO2Gap — bilingual messages', () => {
  it('every band has non-empty EN + TR messages', () => {
    const cases = [
      // ok
      [
        [entryZ(TODAY, [0, 0, 0, 0, 30]), pad(addDays(TODAY, -1), 60)],
        'ok',
      ],
      // warning (recency)
      [
        [entryZ(addDays(TODAY, -12), [0, 0, 0, 0, 10]), pad(addDays(TODAY, -1), 300)],
        'warning',
      ],
      // critical
      [
        [entryZ(addDays(TODAY, -16), [0, 0, 0, 0, 30]), pad(addDays(TODAY, -1), 60)],
        'critical',
      ],
      // severe
      [
        [entryZ(addDays(TODAY, -25), [0, 0, 0, 0, 30]), pad(addDays(TODAY, -1), 60)],
        'severe',
      ],
      // never
      [[pad(addDays(TODAY, -2), 60), pad(addDays(TODAY, -5), 60)], 'never'],
    ]
    for (const [log, expectedBand] of cases) {
      const r = detectVO2Gap(log, TODAY)
      expect(r.band).toBe(expectedBand)
      expect(r.message.en.length).toBeGreaterThan(0)
      expect(r.message.tr.length).toBeGreaterThan(0)
    }
  })

  it('non-ok bands have non-empty EN + TR recommendations', () => {
    const log = [entryZ(addDays(TODAY, -25), [0, 0, 0, 0, 30]), pad(addDays(TODAY, -1), 60)]
    const r = detectVO2Gap(log, TODAY)
    expect(r.band).toBe('severe')
    expect(r.recommendation.en.length).toBeGreaterThan(0)
    expect(r.recommendation.tr.length).toBeGreaterThan(0)
  })

  it('ok band has empty recommendations', () => {
    const log = [entryZ(TODAY, [0, 0, 0, 0, 30]), pad(addDays(TODAY, -1), 60)]
    const r = detectVO2Gap(log, TODAY)
    expect(r.band).toBe('ok')
    expect(r.recommendation.en).toBe('')
    expect(r.recommendation.tr).toBe('')
  })
})

// ─── Return shape ───────────────────────────────────────────────────────────
describe('detectVO2Gap — return shape', () => {
  it('citation field is "Stöggl & Sperlich 2014; Seiler 2010"', () => {
    const r = detectVO2Gap([], TODAY)
    expect(r.citation).toBe('Stöggl & Sperlich 2014; Seiler 2010')
    expect(VO2_GAP_CITATION).toBe('Stöggl & Sperlich 2014; Seiler 2010')
  })

  it('result has all 10 expected keys', () => {
    const r = detectVO2Gap([], TODAY)
    const keys = Object.keys(r).sort()
    expect(keys).toEqual([
      'band',
      'citation',
      'daysSinceZ5',
      'lastZ5Date',
      'message',
      'recommendation',
      'reliable',
      'share28d',
      'z5Sessions',
      'z5Total',
    ])
  })

  it('share28d is rounded to 0.1', () => {
    const log = [entryZ(TODAY, [0, 0, 0, 0, 8]), pad(addDays(TODAY, -1), 200)]
    const r = detectVO2Gap(log, TODAY)
    const decimals = (r.share28d.toString().split('.')[1] || '').length
    expect(decimals).toBeLessThanOrEqual(1)
  })

  it('z5Total is rounded to 0.1', () => {
    const log = [entryZ(TODAY, [0, 0, 0, 0, 12.345])]
    const r = detectVO2Gap(log, TODAY)
    const decimals = (r.z5Total.toString().split('.')[1] || '').length
    expect(decimals).toBeLessThanOrEqual(1)
  })

  it('daysSinceZ5 is an integer when set', () => {
    const log = [entryZ(addDays(TODAY, -3), [0, 0, 0, 0, 20])]
    const r = detectVO2Gap(log, TODAY)
    expect(Number.isInteger(r.daysSinceZ5)).toBe(true)
  })
})

// ─── Boundary conditions ────────────────────────────────────────────────────
describe('detectVO2Gap — band boundaries', () => {
  it('recency exactly 10 with strong share → ok', () => {
    const log = [
      entryZ(addDays(TODAY, -10), [0, 0, 0, 0, 30]),
      pad(addDays(TODAY, -1), 60),
    ]
    const r = detectVO2Gap(log, TODAY)
    expect(r.daysSinceZ5).toBe(10)
    expect(r.band).toBe('ok')
  })

  it('recency 11 with strong share → warning', () => {
    const log = [
      entryZ(addDays(TODAY, -11), [0, 0, 0, 0, 30]),
      pad(addDays(TODAY, -1), 60),
    ]
    const r = detectVO2Gap(log, TODAY)
    expect(r.daysSinceZ5).toBe(11)
    expect(r.band).toBe('warning')
  })

  it('recency 14 with strong share → warning (boundary inclusive)', () => {
    const log = [
      entryZ(addDays(TODAY, -14), [0, 0, 0, 0, 30]),
      pad(addDays(TODAY, -1), 60),
    ]
    const r = detectVO2Gap(log, TODAY)
    expect(r.daysSinceZ5).toBe(14)
    expect(r.band).toBe('warning')
  })

  it('recency 15 with strong share → critical', () => {
    const log = [
      entryZ(addDays(TODAY, -15), [0, 0, 0, 0, 30]),
      pad(addDays(TODAY, -1), 60),
    ]
    const r = detectVO2Gap(log, TODAY)
    expect(r.band).toBe('critical')
  })

  it('recency 21 with strong share → critical (boundary inclusive)', () => {
    const log = [
      entryZ(addDays(TODAY, -21), [0, 0, 0, 0, 30]),
      pad(addDays(TODAY, -1), 60),
    ]
    const r = detectVO2Gap(log, TODAY)
    expect(r.band).toBe('critical')
  })

  it('recency 22 → severe', () => {
    const log = [
      entryZ(addDays(TODAY, -22), [0, 0, 0, 0, 30]),
      pad(addDays(TODAY, -1), 60),
    ]
    const r = detectVO2Gap(log, TODAY)
    expect(r.band).toBe('severe')
  })
})
