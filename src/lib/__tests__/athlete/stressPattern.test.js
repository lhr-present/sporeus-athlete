// ─── stressPattern.test.js ────────────────────────────────────────────────
// Covers 7 achievable trend × pattern combinations, null cases, and
// correlation math. The two unreachable combos (CALMING/STEADY +
// STRESS_DRIVEN) are documented but cannot be asserted because the
// pattern classifier requires `trend === 'MOUNTING'` for STRESS_DRIVEN.
import { describe, it, expect } from 'vitest'
import {
  analyzeStressPattern,
  STRESS_PATTERN_CITATION,
  DEFAULT_WINDOW_DAYS,
  HALF_WINDOW_DAYS,
  MIN_SAMPLES,
  TREND_DELTA_BAND,
  CORR_COUPLING_BAND,
} from '../../athlete/stressPattern.js'

const TODAY = '2026-05-17'

// Helpers ───────────────────────────────────────────────────────────────────
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// Build a 28-day recovery array ending at `today`. `early` is the array
// of stress values for days [today-27 .. today-14]; `recent` is days
// [today-13 .. today]. `sleepHrs` is either a number (constant) or a
// (stress) => sleepHrs function for inducing correlation.
function buildRecovery({ today = TODAY, early, recent, sleepFn }) {
  const out = []
  const all = [...early, ...recent]
  const n = all.length
  for (let i = 0; i < n; i++) {
    const stress = all[i]
    const date = addDays(today, -(n - 1 - i))
    const sleepHrs = typeof sleepFn === 'function' ? sleepFn(stress, i) : sleepFn
    const row = { date, stress }
    if (sleepHrs !== undefined && sleepHrs !== null) row.sleepHrs = sleepHrs
    out.push(row)
  }
  return out
}

// ── Constants ───────────────────────────────────────────────────────────────
describe('analyzeStressPattern — exports + constants', () => {
  it('exports the expected citation and threshold constants', () => {
    expect(STRESS_PATTERN_CITATION).toMatch(/Selye/)
    expect(STRESS_PATTERN_CITATION).toMatch(/Kallus/)
    expect(DEFAULT_WINDOW_DAYS).toBe(28)
    expect(HALF_WINDOW_DAYS).toBe(14)
    expect(MIN_SAMPLES).toBe(7)
    expect(TREND_DELTA_BAND).toBe(0.3)
    expect(CORR_COUPLING_BAND).toBe(0.3)
  })
})

// ── Null cases ──────────────────────────────────────────────────────────────
describe('analyzeStressPattern — null cases', () => {
  it('returns null for null/undefined input', () => {
    expect(analyzeStressPattern({ recovery: null, today: TODAY })).toBeNull()
    expect(analyzeStressPattern({ recovery: undefined, today: TODAY })).toBeNull()
  })

  it('returns null for empty array', () => {
    expect(analyzeStressPattern({ recovery: [], today: TODAY })).toBeNull()
  })

  it('returns null when fewer than 7 entries with stress defined', () => {
    const recovery = [
      { date: addDays(TODAY, -0), stress: 3, sleepHrs: 7 },
      { date: addDays(TODAY, -1), stress: 3, sleepHrs: 7 },
      { date: addDays(TODAY, -2), stress: 3, sleepHrs: 7 },
      { date: addDays(TODAY, -3), stress: 3, sleepHrs: 7 },
      { date: addDays(TODAY, -4), stress: 3, sleepHrs: 7 },
      { date: addDays(TODAY, -5), stress: 3, sleepHrs: 7 },
    ]
    expect(analyzeStressPattern({ recovery, today: TODAY })).toBeNull()
  })

  it('exactly 7 stress entries is the minimum (does NOT return null)', () => {
    const recovery = Array.from({ length: 7 }, (_, i) => ({
      date: addDays(TODAY, -i),
      stress: 3,
      sleepHrs: 7,
    }))
    const r = analyzeStressPattern({ recovery, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.sampleCount).toBe(7)
  })

  it('returns null when entries lack `stress` field (filtered out)', () => {
    const recovery = Array.from({ length: 10 }, (_, i) => ({
      date: addDays(TODAY, -i),
      // no stress field
      sleepHrs: 7,
    }))
    expect(analyzeStressPattern({ recovery, today: TODAY })).toBeNull()
  })

  it('ignores entries outside the 28-day window', () => {
    // 14 OLD entries (35 days back) + only 5 recent → fewer than 7 in window
    const old = Array.from({ length: 14 }, (_, i) => ({
      date: addDays(TODAY, -(35 + i)),
      stress: 3,
      sleepHrs: 7,
    }))
    const recent = Array.from({ length: 5 }, (_, i) => ({
      date: addDays(TODAY, -i),
      stress: 3,
      sleepHrs: 7,
    }))
    expect(analyzeStressPattern({ recovery: [...old, ...recent], today: TODAY })).toBeNull()
  })

  it('filters out non-numeric / out-of-range stress values', () => {
    const recovery = [
      { date: addDays(TODAY, -0), stress: 'high', sleepHrs: 7 },
      { date: addDays(TODAY, -1), stress: NaN,    sleepHrs: 7 },
      { date: addDays(TODAY, -2), stress: 0,      sleepHrs: 7 },   // < 1
      { date: addDays(TODAY, -3), stress: 6,      sleepHrs: 7 },   // > 5
      { date: addDays(TODAY, -4), stress: 3,      sleepHrs: 7 },
      { date: addDays(TODAY, -5), stress: 3,      sleepHrs: 7 },
      { date: addDays(TODAY, -6), stress: 3,      sleepHrs: 7 },
    ]
    // only 3 valid → null
    expect(analyzeStressPattern({ recovery, today: TODAY })).toBeNull()
  })

  it('de-dupes multiple entries on the same date', () => {
    // 7 duplicate dates → only 1 unique date → null (below min samples)
    const recovery = Array.from({ length: 7 }, () => ({
      date: TODAY,
      stress: 3,
      sleepHrs: 7,
    }))
    expect(analyzeStressPattern({ recovery, today: TODAY })).toBeNull()
  })
})

// ── Trend classification ────────────────────────────────────────────────────
describe('analyzeStressPattern — stress trend bands', () => {
  it('CALMING: recent half mean drops ≥ 0.3 below early half', () => {
    // 14 early at stress=4, 14 recent at stress=2  →  delta = -2.0
    const recovery = buildRecovery({
      early:  Array(14).fill(4),
      recent: Array(14).fill(2),
      sleepFn: 7,
    })
    const r = analyzeStressPattern({ recovery, today: TODAY })
    expect(r.stressTrend).toBe('CALMING')
    expect(r.stressDelta).toBeCloseTo(-2.0, 2)
  })

  it('STEADY: |delta| < 0.3', () => {
    // 14 early at 3, 14 recent at 3.1  →  delta = 0.1  →  STEADY
    const recovery = buildRecovery({
      early:  Array(14).fill(3),
      recent: Array(14).fill(3.1),
      sleepFn: 7,
    })
    const r = analyzeStressPattern({ recovery, today: TODAY })
    expect(r.stressTrend).toBe('STEADY')
    expect(Math.abs(r.stressDelta)).toBeLessThan(0.3)
  })

  it('MOUNTING: recent half mean rises ≥ 0.3 above early half', () => {
    // 14 early at 2, 14 recent at 4  →  delta = +2.0
    const recovery = buildRecovery({
      early:  Array(14).fill(2),
      recent: Array(14).fill(4),
      sleepFn: 7,
    })
    const r = analyzeStressPattern({ recovery, today: TODAY })
    expect(r.stressTrend).toBe('MOUNTING')
    expect(r.stressDelta).toBeCloseTo(2.0, 2)
  })

  it('boundary: delta exactly -0.3 → CALMING', () => {
    // early mean=3.15, recent mean=2.85, delta=-0.30 exactly
    const recovery = buildRecovery({
      early:  Array(14).fill(3.15),
      recent: Array(14).fill(2.85),
      sleepFn: 7,
    })
    expect(analyzeStressPattern({ recovery, today: TODAY }).stressTrend).toBe('CALMING')
  })

  it('boundary: delta exactly +0.3 → MOUNTING', () => {
    const recovery = buildRecovery({
      early:  Array(14).fill(2.85),
      recent: Array(14).fill(3.15),
      sleepFn: 7,
    })
    expect(analyzeStressPattern({ recovery, today: TODAY }).stressTrend).toBe('MOUNTING')
  })
})

// ── Pattern classification — achievable combos ──────────────────────────────
describe('analyzeStressPattern — pattern classification (7 achievable combos)', () => {
  it('MOUNTING + STRESS_DRIVEN (rising stress, sleep collapsing)', () => {
    // stress rising linearly 1..5; sleep falls 9..6 in lockstep
    // → strong negative correlation, MOUNTING trend
    const early  = [1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2]
    const recent = [3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5]
    const recovery = buildRecovery({
      early,
      recent,
      // sleep mirrors stress: higher stress → less sleep
      sleepFn: (s) => 10 - s,   // stress 1→9h, stress 5→5h
    })
    const r = analyzeStressPattern({ recovery, today: TODAY })
    expect(r.stressTrend).toBe('MOUNTING')
    expect(r.pattern).toBe('STRESS_DRIVEN')
    expect(r.sleepCorrelation).toBeLessThanOrEqual(-0.3)
  })

  it('MOUNTING + DECOUPLED (rising stress, sleep uncorrelated)', () => {
    // Rising stress trend, but sleep is roughly constant → r ≈ 0
    const early  = Array(14).fill(2)
    const recent = Array(14).fill(4)
    const recovery = buildRecovery({
      early,
      recent,
      // Inject mild noise so r isn't exactly zero, but keep |r| < 0.3.
      // Sleep stays around 7h regardless of stress.
      sleepFn: (s, i) => 7 + ((i % 2) === 0 ? 0.1 : -0.1),
    })
    const r = analyzeStressPattern({ recovery, today: TODAY })
    expect(r.stressTrend).toBe('MOUNTING')
    expect(r.pattern).toBe('DECOUPLED')
    expect(Math.abs(r.sleepCorrelation)).toBeLessThan(0.3)
  })

  it('MOUNTING + PROTECTED (rising stress, but sleep is fine — positive r)', () => {
    // Stress rises but athlete deliberately sleeps MORE under stress
    // → positive correlation → PROTECTED label.
    const early  = Array(14).fill(2)
    const recent = Array(14).fill(4)
    const recovery = buildRecovery({
      early,
      recent,
      // stress 2 → 7h, stress 4 → 9h. Positive r.
      sleepFn: (s) => 5 + s,
    })
    const r = analyzeStressPattern({ recovery, today: TODAY })
    expect(r.stressTrend).toBe('MOUNTING')
    expect(r.pattern).toBe('PROTECTED')
    expect(r.sleepCorrelation).toBeGreaterThanOrEqual(0.3)
  })

  it('CALMING + DECOUPLED (stress dropping, sleep uncorrelated)', () => {
    const early  = Array(14).fill(4)
    const recent = Array(14).fill(2)
    const recovery = buildRecovery({
      early,
      recent,
      sleepFn: (s, i) => 7 + ((i % 2) === 0 ? 0.1 : -0.1),
    })
    const r = analyzeStressPattern({ recovery, today: TODAY })
    expect(r.stressTrend).toBe('CALMING')
    expect(r.pattern).toBe('DECOUPLED')
  })

  it('CALMING + PROTECTED (stress dropping, sleep rising in step)', () => {
    // Stress 4→2; sleep 6→8. Negative correlation between (stress, sleep)
    // values — but it's ≤ -0.3, which lands in PROTECTED branch only if
    // |r| ≥ 0.3 AND trend is NOT MOUNTING. Confirm classification.
    const early  = Array(14).fill(4)
    const recent = Array(14).fill(2)
    const recovery = buildRecovery({
      early,
      recent,
      sleepFn: (s) => 10 - s,   // stress 4→6h, stress 2→8h
    })
    const r = analyzeStressPattern({ recovery, today: TODAY })
    expect(r.stressTrend).toBe('CALMING')
    // negative correlation but trend not MOUNTING → not STRESS_DRIVEN
    expect(r.sleepCorrelation).toBeLessThanOrEqual(-0.3)
    // |r| ≥ 0.3 → not DECOUPLED → falls into PROTECTED
    expect(r.pattern).toBe('PROTECTED')
  })

  it('STEADY + DECOUPLED (flat stress, uncorrelated sleep)', () => {
    const early  = Array(14).fill(3)
    const recent = Array(14).fill(3)
    const recovery = buildRecovery({
      early,
      recent,
      sleepFn: (s, i) => 7 + (i % 3 === 0 ? 0.05 : -0.05),
    })
    const r = analyzeStressPattern({ recovery, today: TODAY })
    expect(r.stressTrend).toBe('STEADY')
    // With constant stress, Pearson r is 0 (zero variance in x)
    expect(r.sleepCorrelation).toBe(0)
    expect(r.pattern).toBe('DECOUPLED')
  })

  it('STEADY + PROTECTED (flat stress with varying stress → strong r and not MOUNTING)', () => {
    // Build a setup where the half-means are essentially equal but
    // within-window variance produces a strong correlation. Each half
    // has matching stress points 2,2,2,4,4,4,4 → same mean per half;
    // sleep mirrors stress for strong negative r within each half.
    const half = [2, 2, 2, 4, 4, 4, 4]   // mean = 3.14
    const recovery = buildRecovery({
      early:  half,
      recent: half,
      // sleep inversely proportional to stress within each half
      sleepFn: (s) => 10 - s,             // r is strongly negative
    })
    const r = analyzeStressPattern({ recovery, today: TODAY })
    expect(r.stressTrend).toBe('STEADY')
    // |r| ≥ 0.3, trend not MOUNTING → PROTECTED
    expect(Math.abs(r.sleepCorrelation)).toBeGreaterThanOrEqual(0.3)
    expect(r.pattern).toBe('PROTECTED')
  })
})

// ── Correlation math ────────────────────────────────────────────────────────
describe('analyzeStressPattern — correlation math', () => {
  it('perfect negative correlation rounds to -1.00', () => {
    const recovery = buildRecovery({
      early:  [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4],
      recent: [5, 4, 3, 2, 1, 5, 4, 3, 2, 1, 5, 4, 3, 2],
      sleepFn: (s) => 10 - s,
    })
    const r = analyzeStressPattern({ recovery, today: TODAY })
    expect(r.sleepCorrelation).toBe(-1)
  })

  it('perfect positive correlation rounds to +1.00', () => {
    const recovery = buildRecovery({
      early:  [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4],
      recent: [5, 4, 3, 2, 1, 5, 4, 3, 2, 1, 5, 4, 3, 2],
      sleepFn: (s) => 5 + s,
    })
    const r = analyzeStressPattern({ recovery, today: TODAY })
    expect(r.sleepCorrelation).toBe(1)
  })

  it('zero variance in sleepHrs → correlation = 0', () => {
    const recovery = buildRecovery({
      early:  [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4],
      recent: [5, 4, 3, 2, 1, 5, 4, 3, 2, 1, 5, 4, 3, 2],
      sleepFn: 7,   // constant
    })
    const r = analyzeStressPattern({ recovery, today: TODAY })
    expect(r.sleepCorrelation).toBe(0)
  })

  it('correlation is rounded to 2 decimal places', () => {
    const recovery = buildRecovery({
      early:  [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4],
      recent: [4, 3, 2, 1, 5, 4, 3, 2, 1, 5, 4, 3, 2, 1],
      sleepFn: (s, i) => 8 - s * 0.4 + ((i % 5) * 0.2),
    })
    const r = analyzeStressPattern({ recovery, today: TODAY })
    // Just confirm the precision: at most 2 decimals
    const dp = (r.sleepCorrelation.toString().split('.')[1] || '').length
    expect(dp).toBeLessThanOrEqual(2)
  })

  it('sleepHrs missing on some entries → only paired rows count toward r', () => {
    // 28 entries spread over the full 28-day window — half have sleepHrs,
    // half don't. Trend should still resolve from all 28 stress points;
    // correlation from the 14 paired rows.
    const stressVals = [
      ...Array(14).fill(3),   // early half
      ...Array(14).fill(4),   // recent half
    ]
    const recovery = stressVals.map((stress, i) => {
      const row = {
        date: addDays(TODAY, -(stressVals.length - 1 - i)),
        stress,
      }
      // Add sleepHrs only on even indices → 14 paired rows
      if (i % 2 === 0) row.sleepHrs = 10 - stress
      return row
    })
    const r = analyzeStressPattern({ recovery, today: TODAY })
    expect(r.sampleCount).toBe(28)
    expect(r.stressTrend).toBe('MOUNTING')
    // paired rows had stress ∈ {3,4}, sleep = 10 - stress → perfect -1
    expect(r.sleepCorrelation).toBe(-1)
  })
})

// ── Result shape ────────────────────────────────────────────────────────────
describe('analyzeStressPattern — result shape', () => {
  it('returns the expected keys with the citation string', () => {
    const recovery = buildRecovery({
      early:  Array(14).fill(3),
      recent: Array(14).fill(3),
      sleepFn: 7,
    })
    const r = analyzeStressPattern({ recovery, today: TODAY })
    expect(r).toMatchObject({
      stressTrend:      expect.any(String),
      pattern:          expect.any(String),
      avgStress:        expect.any(Number),
      stressDelta:      expect.any(Number),
      sleepCorrelation: expect.any(Number),
      sampleCount:      expect.any(Number),
      citation:         STRESS_PATTERN_CITATION,
    })
  })

  it('avgStress and stressDelta are rounded to 2 decimal places', () => {
    const recovery = buildRecovery({
      early:  [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4],
      recent: [2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5],
      sleepFn: 7,
    })
    const r = analyzeStressPattern({ recovery, today: TODAY })
    const avgDp   = (r.avgStress.toString().split('.')[1]   || '').length
    const deltaDp = (r.stressDelta.toString().split('.')[1] || '').length
    expect(avgDp).toBeLessThanOrEqual(2)
    expect(deltaDp).toBeLessThanOrEqual(2)
  })
})
