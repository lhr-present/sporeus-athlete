import { describe, it, expect } from 'vitest'
import {
  detectFitnessConsistency,
  FITNESS_CONSISTENCY_CITATION,
} from '../../athlete/fitnessConsistency.js'

const TODAY = '2026-05-07'

// ─── Helpers ────────────────────────────────────────────────────────────────
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Build a log of `count` daily entries ending on `endDate`. tss may be a
 * function (i: 0..count-1, where 0=oldest, count-1=endDate).
 */
function makeLog(count, endDate, tss) {
  const log = []
  for (let i = 0; i < count; i++) {
    const v = typeof tss === 'function' ? tss(i) : tss
    log.push({ date: addDays(endDate, -(count - 1 - i)), type: 'run', tss: v })
  }
  return log
}

// ─── Empty / null inputs ────────────────────────────────────────────────────
describe('detectFitnessConsistency — empty / null inputs', () => {
  it('null log → reliable=false, all zeros, band=rock-solid', () => {
    const r = detectFitnessConsistency(null, TODAY)
    expect(r.meanCTL).toBe(0)
    expect(r.stdevCTL).toBe(0)
    expect(r.minCTL).toBe(0)
    expect(r.maxCTL).toBe(0)
    expect(r.cv).toBe(0)
    expect(r.rangePct).toBe(0)
    expect(r.weeksAnalyzed).toBe(0)
    expect(r.band).toBe('rock-solid')
    expect(r.reliable).toBe(false)
  })

  it('empty log → reliable=false, band=rock-solid', () => {
    const r = detectFitnessConsistency([], TODAY)
    expect(r.weeksAnalyzed).toBe(0)
    expect(r.band).toBe('rock-solid')
    expect(r.reliable).toBe(false)
  })

  it('non-array log → safe defaults', () => {
    const r = detectFitnessConsistency({ foo: 'bar' }, TODAY)
    expect(r.band).toBe('rock-solid')
    expect(r.reliable).toBe(false)
  })
})

// ─── Reliability ─────────────────────────────────────────────────────────────
describe('detectFitnessConsistency — reliability', () => {
  it('log span < 90 days → reliable=false', () => {
    const log = makeLog(60, TODAY, 80)
    const r = detectFitnessConsistency(log, TODAY)
    expect(r.reliable).toBe(false)
  })

  it('log span ≥ 90 days with healthy CTL → reliable=true', () => {
    const log = makeLog(180, TODAY, 80)
    const r = detectFitnessConsistency(log, TODAY)
    expect(r.reliable).toBe(true)
  })

  it('insufficient weeks (<4 weekly averages) → reliable=false', () => {
    // ~2 weeks of data
    const log = makeLog(14, TODAY, 80)
    const r = detectFitnessConsistency(log, TODAY)
    expect(r.weeksAnalyzed).toBeLessThan(4)
    expect(r.reliable).toBe(false)
  })

  it('meanCTL ≤ 5 → reliable=false even with 90+ day span', () => {
    // Very low TSS keeps CTL well below 5
    const log = makeLog(180, TODAY, 3)
    const r = detectFitnessConsistency(log, TODAY)
    expect(r.meanCTL).toBeLessThanOrEqual(5)
    expect(r.reliable).toBe(false)
  })
})

// ─── Band fixtures ───────────────────────────────────────────────────────────
describe('detectFitnessConsistency — band fixtures', () => {
  it('flat constant load → CV ≈ 0, band=rock-solid', () => {
    // 200d of constant 80 TSS to fully converge before window
    const log = makeLog(280, TODAY, 80)
    const r = detectFitnessConsistency(log, TODAY)
    expect(r.cv).toBeLessThan(0.05)
    expect(r.band).toBe('rock-solid')
    expect(r.reliable).toBe(true)
  })

  it('gradually rising uniform load → low CV, stable or oscillating', () => {
    // Tiny daily increment from base 60 → modest CTL drift across 13 weeks
    const log = makeLog(280, TODAY, (i) => 60 + i * 0.05)
    const r = detectFitnessConsistency(log, TODAY)
    expect(r.cv).toBeLessThan(0.20)
    expect(['rock-solid', 'stable', 'oscillating']).toContain(r.band)
  })

  it('alternating heavy/easy weeks → CV above rock-solid threshold', () => {
    // Prime then 90d of strong on/off weeks: 200 vs 0 TSS
    const prime = 200
    const test = 90
    const log = makeLog(prime + test, TODAY, (i) => {
      if (i < prime) return 70
      const w = Math.floor((i - prime) / 7)
      return w % 2 === 0 ? 200 : 0
    })
    const r = detectFitnessConsistency(log, TODAY)
    expect(r.cv).toBeGreaterThan(0.04)
    expect(['stable', 'oscillating', 'chaotic']).toContain(r.band)
  })

  it('chaotic random load → high CV', () => {
    // Deterministic pseudo-random pattern with strong week-to-week swings
    const prime = 150
    const test = 90
    const pseudo = (k) => {
      const x = Math.sin(k * 9301.337) * 10000
      return x - Math.floor(x)
    }
    const log = makeLog(prime + test, TODAY, (i) => {
      if (i < prime) return 50
      const w = Math.floor((i - prime) / 7)
      // Wildly different weekly TSS targets
      return Math.round(20 + pseudo(w) * 250)
    })
    const r = detectFitnessConsistency(log, TODAY)
    expect(r.cv).toBeGreaterThan(0.05)
    expect(['oscillating', 'chaotic']).toContain(r.band)
  })
})

// ─── Math correctness ───────────────────────────────────────────────────────
describe('detectFitnessConsistency — math', () => {
  it('CV = stdevCTL / meanCTL (rounded match)', () => {
    const log = makeLog(280, TODAY, (i) => 60 + (i % 14) * 4)
    const r = detectFitnessConsistency(log, TODAY)
    if (r.meanCTL > 0) {
      const expected = Math.round((r.stdevCTL / r.meanCTL) * 1000) / 1000
      // stdevCTL is rounded to 0.1, so we allow a small tolerance
      expect(Math.abs(r.cv - expected)).toBeLessThan(0.005)
    }
  })

  it('rangePct = (maxCTL - minCTL) / meanCTL × 100 (matches within tolerance)', () => {
    const log = makeLog(280, TODAY, (i) => 60 + (i % 14) * 4)
    const r = detectFitnessConsistency(log, TODAY)
    if (r.meanCTL > 0) {
      const expected = Math.round(((r.maxCTL - r.minCTL) / r.meanCTL) * 1000) / 10
      expect(Math.abs(r.rangePct - expected)).toBeLessThan(0.5)
    }
  })

  it('weeksAnalyzed reports actual count (12-13 with ≥90d log)', () => {
    const log = makeLog(280, TODAY, 80)
    const r = detectFitnessConsistency(log, TODAY)
    // 90d / 7 = 12.857 → 12 or 13 complete weekly buckets depending on
    // weekday alignment of `today`.
    expect(r.weeksAnalyzed).toBeGreaterThanOrEqual(12)
    expect(r.weeksAnalyzed).toBeLessThanOrEqual(13)
  })

  it('weeksAnalyzed less than 13 for shorter logs', () => {
    const log = makeLog(35, TODAY, 80)
    const r = detectFitnessConsistency(log, TODAY)
    expect(r.weeksAnalyzed).toBeGreaterThanOrEqual(4)
    expect(r.weeksAnalyzed).toBeLessThan(13)
  })

  it('ctlToday-equivalent meanCTL approaches load on fully converged flat log', () => {
    // After 280d of constant 80 TSS, CTL ≈ 80, and weekly averages of last
    // 13 weeks should be very close to 80
    const log = makeLog(280, TODAY, 80)
    const r = detectFitnessConsistency(log, TODAY)
    expect(r.meanCTL).toBeGreaterThan(70)
    expect(r.meanCTL).toBeLessThan(85)
  })

  it('minCTL ≤ meanCTL ≤ maxCTL', () => {
    const log = makeLog(280, TODAY, (i) => 60 + (i % 21) * 5)
    const r = detectFitnessConsistency(log, TODAY)
    expect(r.minCTL).toBeLessThanOrEqual(r.meanCTL)
    expect(r.meanCTL).toBeLessThanOrEqual(r.maxCTL)
  })
})

// ─── Rounding ────────────────────────────────────────────────────────────────
describe('detectFitnessConsistency — rounding', () => {
  it('meanCTL, stdevCTL, minCTL, maxCTL rounded to 1 decimal', () => {
    const log = makeLog(280, TODAY, (i) => 60 + (i % 14) * 3)
    const r = detectFitnessConsistency(log, TODAY)
    for (const v of [r.meanCTL, r.stdevCTL, r.minCTL, r.maxCTL]) {
      const decimals = (Math.abs(v).toString().split('.')[1] || '').length
      expect(decimals).toBeLessThanOrEqual(1)
    }
  })

  it('cv rounded to 3 decimals', () => {
    const log = makeLog(280, TODAY, (i) => 60 + (i % 14) * 3)
    const r = detectFitnessConsistency(log, TODAY)
    const decimals = (Math.abs(r.cv).toString().split('.')[1] || '').length
    expect(decimals).toBeLessThanOrEqual(3)
  })

  it('rangePct rounded to 1 decimal', () => {
    const log = makeLog(280, TODAY, (i) => 60 + (i % 14) * 3)
    const r = detectFitnessConsistency(log, TODAY)
    const decimals = (Math.abs(r.rangePct).toString().split('.')[1] || '').length
    expect(decimals).toBeLessThanOrEqual(1)
  })
})

// ─── Band boundary edges ─────────────────────────────────────────────────────
describe('detectFitnessConsistency — band boundaries', () => {
  it('CV < 0.05 → rock-solid', () => {
    const log = makeLog(280, TODAY, 80)
    const r = detectFitnessConsistency(log, TODAY)
    expect(r.cv).toBeLessThan(0.05)
    expect(r.band).toBe('rock-solid')
  })

  it('classifier maps tied CTL across all weeks → CV=0, band=rock-solid', () => {
    // Long fully-converged constant log → all 13 weekly averages essentially equal
    const log = makeLog(400, TODAY, 90)
    const r = detectFitnessConsistency(log, TODAY)
    expect(r.cv).toBeLessThan(0.01)
    expect(r.band).toBe('rock-solid')
  })

  it('chaotic case: CV ≥ 0.20 → band=chaotic', () => {
    // Aggressive on/off weeks from a low base produces large CV
    const prime = 30
    const test = 90
    const log = makeLog(prime + test, TODAY, (i) => {
      if (i < prime) return 0
      const w = Math.floor((i - prime) / 7)
      return w % 2 === 0 ? 200 : 0
    })
    const r = detectFitnessConsistency(log, TODAY)
    if (r.cv >= 0.20) expect(r.band).toBe('chaotic')
    else expect(['oscillating', 'chaotic']).toContain(r.band)
  })
})

// ─── Edge cases ──────────────────────────────────────────────────────────────
describe('detectFitnessConsistency — edge cases', () => {
  it('multiple entries on the same date sum into one daily TSS', () => {
    const baseLog = makeLog(180, addDays(TODAY, -1), 70)
    const splitToday = [
      ...baseLog,
      { date: TODAY, type: 'bike', tss: 40 },
      { date: TODAY, type: 'run', tss: 30 },
    ]
    const mergedToday = [
      ...baseLog,
      { date: TODAY, type: 'combined', tss: 70 },
    ]
    const a = detectFitnessConsistency(splitToday, TODAY)
    const b = detectFitnessConsistency(mergedToday, TODAY)
    expect(a.meanCTL).toBeCloseTo(b.meanCTL, 1)
    expect(a.cv).toBeCloseTo(b.cv, 2)
  })

  it('options.today override is deterministic', () => {
    const log = makeLog(280, TODAY, 80)
    const r1 = detectFitnessConsistency(log, TODAY)
    const r2 = detectFitnessConsistency(log, TODAY)
    expect(r1.meanCTL).toBe(r2.meanCTL)
    expect(r1.cv).toBe(r2.cv)
    expect(r1.band).toBe(r2.band)
  })

  it('entries dated after today are ignored', () => {
    const past = makeLog(180, TODAY, 80)
    const future = makeLog(20, addDays(TODAY, 30), 999)
    const r1 = detectFitnessConsistency(past, TODAY)
    const r2 = detectFitnessConsistency([...past, ...future], TODAY)
    expect(r1.meanCTL).toBeCloseTo(r2.meanCTL, 1)
    expect(r1.cv).toBeCloseTo(r2.cv, 3)
  })

  it('NaN / missing tss values do not corrupt the EWMA', () => {
    const log = [
      ...makeLog(180, TODAY, 70),
      { date: TODAY, type: 'mystery' },
      { date: addDays(TODAY, -1), type: 'broken', tss: 'oops' },
    ]
    const r = detectFitnessConsistency(log, TODAY)
    expect(Number.isFinite(r.meanCTL)).toBe(true)
    expect(Number.isFinite(r.cv)).toBe(true)
  })
})

// ─── Bilingual messages ──────────────────────────────────────────────────────
describe('detectFitnessConsistency — bilingual messages', () => {
  it('rock-solid band has EN+TR messages and empty recommendations', () => {
    const log = makeLog(280, TODAY, 80)
    const r = detectFitnessConsistency(log, TODAY)
    expect(r.band).toBe('rock-solid')
    expect(r.message.en).toMatch(/Rock-solid/)
    expect(r.message.tr).toMatch(/stabil/i)
    expect(r.recommendation.en).toBe('')
    expect(r.recommendation.tr).toBe('')
  })

  it('chaotic band has EN+TR messages and recommendation', () => {
    const prime = 30
    const test = 90
    const log = makeLog(prime + test, TODAY, (i) => {
      if (i < prime) return 0
      const w = Math.floor((i - prime) / 7)
      return w % 2 === 0 ? 200 : 0
    })
    const r = detectFitnessConsistency(log, TODAY)
    if (r.band === 'chaotic') {
      expect(r.message.en).toMatch(/Chaotic/)
      expect(r.message.tr).toMatch(/Kaotik/)
      expect(r.recommendation.en).toMatch(/structured plan/i)
      expect(r.recommendation.tr).toMatch(/yapılandırılmış/i)
    }
  })

  it('all 4 bands have non-empty bilingual messages', () => {
    // Reach into the constant table indirectly: each call returns a valid msg
    const fixtures = [
      makeLog(280, TODAY, 80),                                        // rock-solid
      makeLog(280, TODAY, (i) => 60 + (i % 14) * 1.5),                // probably stable/osc
      makeLog(280, TODAY, (i) => (Math.floor(i / 7) % 2 === 0 ? 90 : 30)), // osc
      // chaotic-ish
      makeLog(280, TODAY, (i) => {
        if (i < 100) return 50
        const w = Math.floor((i - 100) / 7)
        return w % 2 === 0 ? 200 : 0
      }),
    ]
    for (const log of fixtures) {
      const r = detectFitnessConsistency(log, TODAY)
      expect(r.message.en.length).toBeGreaterThan(0)
      expect(r.message.tr.length).toBeGreaterThan(0)
    }
  })
})

// ─── Citation + return shape ────────────────────────────────────────────────
describe('detectFitnessConsistency — return shape', () => {
  it('citation matches export constant', () => {
    const r = detectFitnessConsistency([], TODAY)
    expect(r.citation).toBe(FITNESS_CONSISTENCY_CITATION)
    expect(FITNESS_CONSISTENCY_CITATION).toBe(
      'Banister 1991; Coggan PMC; Fitz-Clarke 1991 model stability',
    )
  })

  it('result has all 12 expected keys', () => {
    const r = detectFitnessConsistency([], TODAY)
    const keys = Object.keys(r).sort()
    expect(keys).toEqual([
      'band',
      'citation',
      'cv',
      'maxCTL',
      'meanCTL',
      'message',
      'minCTL',
      'rangePct',
      'recommendation',
      'reliable',
      'stdevCTL',
      'weeksAnalyzed',
    ])
  })

  it('uses default today when omitted', () => {
    const r = detectFitnessConsistency([])
    expect(r.band).toBe('rock-solid')
    expect(typeof r.cv).toBe('number')
  })
})
