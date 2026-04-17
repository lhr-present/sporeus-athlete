import { describe, it, expect } from 'vitest'
import { hrv28dStats, detectHRVAlert } from '../hrvAlert.js'

// ── hrv28dStats ───────────────────────────────────────────────────────────────

describe('hrv28dStats', () => {
  it('returns null for fewer than 5 valid values', () => {
    expect(hrv28dStats([70, 72, 68])).toBeNull()
    expect(hrv28dStats([])).toBeNull()
    expect(hrv28dStats(null)).toBeNull()
  })

  it('returns null when all values are invalid', () => {
    expect(hrv28dStats([null, undefined, NaN, 0, 0])).toBeNull()
  })

  it('computes correct mean for uniform series', () => {
    const series = Array(10).fill(60)
    const stats  = hrv28dStats(series)
    expect(stats).not.toBeNull()
    expect(stats.mean).toBe(60)
    expect(stats.stddev).toBe(0)
  })

  it('computes mean and stddev for known series', () => {
    // Series: [50, 60, 70, 80, 90] → mean=70, variance=200, stddev≈14.1
    const stats = hrv28dStats([50, 60, 70, 80, 90])
    expect(stats.mean).toBeCloseTo(70, 0)
    expect(stats.stddev).toBeCloseTo(14.1, 0)
  })

  it('ignores zero and negative values', () => {
    const stats = hrv28dStats([0, -1, 70, 70, 70, 70, 70])
    expect(stats.mean).toBe(70)
  })
})

// ── detectHRVAlert ────────────────────────────────────────────────────────────

describe('detectHRVAlert', () => {
  // Baseline: mean=70, stddev=5 (series: 60,65,70,75,80 → mean=70, pop-stddev=7.07)
  // Use flat series for predictable stddev=0 → no alert
  it('returns no alert when stddev is 0 (uniform series)', () => {
    const series = Array(10).fill(70)
    const result = detectHRVAlert(70, series)
    expect(result.alert).toBe(false)
  })

  it('returns no alert when drop is < 2σ', () => {
    // mean≈70, stddev≈7 — drop to 60 is ~1.4σ → no alert
    const series = [60, 65, 70, 75, 80, 65, 70, 75]
    const result = detectHRVAlert(60, series)
    expect(result.alert).toBe(false)
    expect(result.sigma).toBeLessThan(-1)
  })

  it('returns alert when drop is > 2σ', () => {
    // mean=70, stddev≈7 — drop to 55 is ~2.1σ → alert
    const series = [60, 65, 70, 75, 80, 65, 70, 75, 70, 68]
    const result = detectHRVAlert(50, series)  // 50 is a big drop
    expect(result.alert).toBe(true)
    expect(result.sigma).toBeLessThan(-2)
    expect(result.delta).toBeLessThan(0)
  })

  it('returns alert with correct sigma for 3σ drop', () => {
    // Build series with mean=70, predictable stddev
    const series = Array(20).fill(70)
    // With stddev≈0, we can't get a sigma — use mixed series
    const series2 = Array(10).fill(70).concat(Array(10).fill(80))
    // mean=75, stddev=5 (pop)
    const result = detectHRVAlert(60, series2)  // 60 is 3σ below 75
    expect(result.alert).toBe(true)
    expect(result.sigma).toBeLessThan(-2)
  })

  it('returns no alert for insufficient baseline data', () => {
    const result = detectHRVAlert(50, [70, 68])   // only 2 samples
    expect(result.alert).toBe(false)
  })
})
