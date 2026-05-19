// ─── restingHrFitnessTrend.test.js — pure-fn tests for RHR fitness-trend ────
import { describe, it, expect } from 'vitest'
import {
  analyzeRestingHrFitnessTrend,
  RHR_FITNESS_TREND_CITATION,
} from '../../athlete/restingHrFitnessTrend.js'

// ── helpers ──────────────────────────────────────────────────────────────────

function daysBefore(todayISO, n) {
  const [y, m, d] = todayISO.split('-').map(v => parseInt(v, 10))
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() - n)
  return dt.toISOString().slice(0, 10)
}

// Build a recovery array spanning `values.length` consecutive days ending at
// `today` (values[0] is OLDEST, values[length-1] is `today`).
function buildRecovery(today, values) {
  const total = values.length
  const out = []
  for (let i = 0; i < total; i++) {
    const ageFromToday = total - 1 - i
    out.push({ date: daysBefore(today, ageFromToday), restingHR: values[i] })
  }
  return out
}

const TODAY = '2026-05-17'

// ── tests ────────────────────────────────────────────────────────────────────

describe('analyzeRestingHrFitnessTrend — guard rails', () => {
  it('returns null for empty / null recovery input', () => {
    expect(analyzeRestingHrFitnessTrend({ recovery: [], today: TODAY })).toBeNull()
    expect(analyzeRestingHrFitnessTrend({ recovery: null, today: TODAY })).toBeNull()
    expect(analyzeRestingHrFitnessTrend({})).toBeNull()
  })

  it('returns null when fewer than 10 valid lifetime entries', () => {
    // 9 valid entries → below the 10-entry lifetime threshold.
    const values = Array.from({ length: 9 }, () => 55)
    const recovery = buildRecovery(TODAY, values)
    expect(
      analyzeRestingHrFitnessTrend({ recovery, today: TODAY })
    ).toBeNull()
  })

  it('returns null when fewer than 5 entries in the recent window', () => {
    // 10 valid lifetime entries, but only 4 of them within the recent 90d window.
    // We put 6 entries way back (~200 days ago) and 4 within the window.
    const recovery = [
      // 6 old entries (well outside the 90d window)
      { date: daysBefore(TODAY, 200), restingHR: 55 },
      { date: daysBefore(TODAY, 201), restingHR: 55 },
      { date: daysBefore(TODAY, 202), restingHR: 55 },
      { date: daysBefore(TODAY, 203), restingHR: 55 },
      { date: daysBefore(TODAY, 204), restingHR: 55 },
      { date: daysBefore(TODAY, 205), restingHR: 55 },
      // 4 recent entries (within last 90 days)
      { date: daysBefore(TODAY, 5),  restingHR: 50 },
      { date: daysBefore(TODAY, 10), restingHR: 50 },
      { date: daysBefore(TODAY, 15), restingHR: 50 },
      { date: daysBefore(TODAY, 20), restingHR: 50 },
    ]
    expect(
      analyzeRestingHrFitnessTrend({ recovery, today: TODAY })
    ).toBeNull()
  })

  it('filters out entries with restingHR <= 0 or missing', () => {
    // 10 entries — 5 invalid (zero / null / missing), so only 5 valid lifetime
    // entries remain → below the lifetime threshold → null.
    const recovery = [
      { date: daysBefore(TODAY, 1),  restingHR: 0 },
      { date: daysBefore(TODAY, 2),  restingHR: null },
      { date: daysBefore(TODAY, 3),  restingHR: undefined },
      { date: daysBefore(TODAY, 4),  restingHR: '' },
      { date: daysBefore(TODAY, 5),  restingHR: 'abc' },
      { date: daysBefore(TODAY, 6),  restingHR: 50 },
      { date: daysBefore(TODAY, 7),  restingHR: 50 },
      { date: daysBefore(TODAY, 8),  restingHR: 50 },
      { date: daysBefore(TODAY, 9),  restingHR: 50 },
      { date: daysBefore(TODAY, 10), restingHR: 50 },
    ]
    expect(
      analyzeRestingHrFitnessTrend({ recovery, today: TODAY })
    ).toBeNull()
  })
})

describe('analyzeRestingHrFitnessTrend — band classification', () => {
  it('IMPROVING when recent ≤ lifetime − 2 bpm', () => {
    // Old entries (>90d ago) at 55, recent 5 at 50.
    // Lifetime avg = (15*55 + 5*50) / 20 = (825 + 250) / 20 = 53.75
    // Recent avg = 50. Delta = 50 − 53.75 = −3.75 → IMPROVING.
    const recovery = [
      ...Array.from({ length: 15 }, (_, i) => ({
        date: daysBefore(TODAY, 200 + i),  // older than 90d
        restingHR: 55,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        date: daysBefore(TODAY, i),         // within 90d
        restingHR: 50,
      })),
    ]
    const r = analyzeRestingHrFitnessTrend({ recovery, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('IMPROVING')
    expect(r.recentAvgRHR).toBeCloseTo(50, 1)
    expect(r.lifetimeAvgRHR).toBeCloseTo(53.75, 1)
    expect(r.delta).toBeCloseTo(-3.75, 1)
    expect(r.recentSampleCount).toBe(5)
    expect(r.lifetimeSampleCount).toBe(20)
    expect(r.citation).toBe(RHR_FITNESS_TREND_CITATION)
  })

  it('STABLE when |delta| < 2 bpm', () => {
    // All entries roughly 50 → delta near 0.
    const recovery = [
      ...Array.from({ length: 15 }, (_, i) => ({
        date: daysBefore(TODAY, 200 + i),
        restingHR: 50,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        date: daysBefore(TODAY, i),
        restingHR: 50,
      })),
    ]
    const r = analyzeRestingHrFitnessTrend({ recovery, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('STABLE')
    expect(Math.abs(r.delta)).toBeLessThan(2)
  })

  it('RISING when recent ≥ lifetime + 2 bpm', () => {
    // Old (>90d) at 50, recent 5 at 55. Recent shifts lifetime up some but
    // delta still > 2.
    // Lifetime = (15*50 + 5*55) / 20 = (750 + 275) / 20 = 51.25
    // Recent = 55. Delta = 55 − 51.25 = 3.75 → RISING.
    const recovery = [
      ...Array.from({ length: 15 }, (_, i) => ({
        date: daysBefore(TODAY, 200 + i),
        restingHR: 50,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        date: daysBefore(TODAY, i),
        restingHR: 55,
      })),
    ]
    const r = analyzeRestingHrFitnessTrend({ recovery, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('RISING')
    expect(r.delta).toBeCloseTo(3.75, 1)
  })
})

describe('analyzeRestingHrFitnessTrend — boundary cases', () => {
  it('delta exactly −2 bpm → IMPROVING (boundary inclusive)', () => {
    // Construct so lifetime − recent = exactly 2.
    // 15 lifetime-only entries at 52, 5 recent at 50.
    // Lifetime = (15*52 + 5*50) / 20 = (780 + 250) / 20 = 51.5
    // Recent = 50. Delta = 50 − 51.5 = -1.5 → STABLE.
    // We need delta exactly -2. Adjust: 15 @ 54, 5 @ 50.
    // Lifetime = (15*54 + 5*50)/20 = (810+250)/20 = 53. Recent=50. Delta=-3.
    // Need delta = -2 exactly: solve (15*a + 5*50)/20 - 50 = 2 → 15a + 250 = 1040 → a = 790/15 = 52.666...
    // Just use the direct boundary: 15 entries each 50 + 2.666... is messy.
    // Simpler: directly construct delta = exactly -2.
    //   lifetime = (10 * 52 + 5 * 50) / 15 = (520 + 250)/15 = 51.333...
    // Easier with weights: set recent=50, lifetime=52 by having recent already
    // count in lifetime. lifetime = (Lold * Vold + 5 * 50) / (Lold + 5) = 52
    //   → Lold*Vold + 250 = 52*(Lold+5) = 52*Lold + 260
    //   → Lold*(Vold − 52) = 10
    // Pick Lold=10, Vold=53 → 10*1 = 10. ✓
    // So: 10 old entries @ 53 + 5 recent @ 50.
    // Lifetime = (10*53 + 5*50)/15 = (530+250)/15 = 780/15 = 52.
    // Recent = 50. Delta = -2 exactly → IMPROVING.
    const recovery = [
      ...Array.from({ length: 10 }, (_, i) => ({
        date: daysBefore(TODAY, 200 + i),
        restingHR: 53,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        date: daysBefore(TODAY, i),
        restingHR: 50,
      })),
    ]
    const r = analyzeRestingHrFitnessTrend({ recovery, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.delta).toBeCloseTo(-2, 1)
    expect(r.band).toBe('IMPROVING')
  })

  it('delta exactly +2 bpm → RISING (boundary inclusive)', () => {
    // Mirror of the IMPROVING boundary:
    // 10 old @ 47 + 5 recent @ 50.
    // Lifetime = (10*47 + 5*50)/15 = (470+250)/15 = 720/15 = 48.
    // Recent = 50. Delta = +2 exactly → RISING.
    const recovery = [
      ...Array.from({ length: 10 }, (_, i) => ({
        date: daysBefore(TODAY, 200 + i),
        restingHR: 47,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        date: daysBefore(TODAY, i),
        restingHR: 50,
      })),
    ]
    const r = analyzeRestingHrFitnessTrend({ recovery, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.delta).toBeCloseTo(2, 1)
    expect(r.band).toBe('RISING')
  })

  it('delta just inside ±2 → STABLE', () => {
    // Construct delta ≈ +1.9 (just below the RISING threshold).
    // 10 old @ ~47.15 + 5 recent @ 50.
    // Lifetime = (10*47.15 + 5*50)/15 = (471.5+250)/15 = 721.5/15 = 48.1
    // Recent − lifetime = 50 − 48.1 = 1.9 → STABLE.
    const recovery = [
      ...Array.from({ length: 10 }, (_, i) => ({
        date: daysBefore(TODAY, 200 + i),
        restingHR: 47.15,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        date: daysBefore(TODAY, i),
        restingHR: 50,
      })),
    ]
    const r = analyzeRestingHrFitnessTrend({ recovery, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.delta).toBeCloseTo(1.9, 1)
    expect(r.band).toBe('STABLE')
  })
})

describe('analyzeRestingHrFitnessTrend — RHR zero / invalid filtering', () => {
  it('entries with restingHR = 0 are filtered out of all computations', () => {
    // 15 entries — 5 of which have restingHR=0 (should be ignored).
    // Effective lifetime sample = 10 entries at 50 → lifetime = 50.
    // Recent window (last 90d) sees only the 5 most-recent valid entries
    // at 50 → recent = 50. Delta = 0 → STABLE.
    const recovery = [
      // 5 zero-RHR entries scattered (some recent, some older — should be
      // dropped at the filter stage regardless of date).
      ...Array.from({ length: 3 }, (_, i) => ({
        date: daysBefore(TODAY, 1 + i),       // within recent window
        restingHR: 0,
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        date: daysBefore(TODAY, 200 + i),     // outside recent window
        restingHR: 0,
      })),
      // 5 valid older entries (well outside the 90d window)
      ...Array.from({ length: 5 }, (_, i) => ({
        date: daysBefore(TODAY, 300 + i),
        restingHR: 50,
      })),
      // 5 valid recent entries (inside the 90d window)
      ...Array.from({ length: 5 }, (_, i) => ({
        date: daysBefore(TODAY, 10 + i),
        restingHR: 50,
      })),
    ]
    const r = analyzeRestingHrFitnessTrend({ recovery, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('STABLE')
    expect(r.lifetimeSampleCount).toBe(10) // zero-RHR entries excluded
    expect(r.recentSampleCount).toBe(5)
    expect(r.lifetimeAvgRHR).toBeCloseTo(50, 1)
    expect(r.recentAvgRHR).toBeCloseTo(50, 1)
  })
})

describe('analyzeRestingHrFitnessTrend — windowDays parameter', () => {
  it('respects a custom windowDays value', () => {
    // 30-day window: include only entries within the last 30 days.
    // Old entries (60+ d ago) at 55, recent (within 30d) at 50.
    const recovery = [
      ...Array.from({ length: 10 }, (_, i) => ({
        date: daysBefore(TODAY, 60 + i),     // outside 30d window
        restingHR: 55,
      })),
      ...Array.from({ length: 5 }, (_, i) => ({
        date: daysBefore(TODAY, i),          // inside 30d window
        restingHR: 50,
      })),
    ]
    const r = analyzeRestingHrFitnessTrend({
      recovery, today: TODAY, windowDays: 30,
    })
    expect(r).not.toBeNull()
    // Lifetime = (10*55 + 5*50)/15 = (550+250)/15 = 53.333...
    // Recent (30d) = 50. Delta = 50 − 53.33 = −3.33 → IMPROVING.
    expect(r.band).toBe('IMPROVING')
    expect(r.recentSampleCount).toBe(5)
    expect(r.lifetimeSampleCount).toBe(15)
  })
})
