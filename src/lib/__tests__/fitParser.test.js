import { describe, it, expect } from 'vitest'
import { powerMetrics, hrZoneDistribution, decouplingPct, normalizedPower } from '../fitParser.js'

// ── Fixture helpers ───────────────────────────────────────────────────────────

/** 1-Hz flat power stream of `value` watts for `seconds` seconds */
function flatPower(value, seconds) {
  return Array(seconds).fill(value)
}

/** Variable power: 120-second blocks alternating hi/lo so the 30s rolling average
 *  stays near each level (not flattened to the mean like per-second alternation would be). */
function variablePower(lo, hi, totalSeconds) {
  const blockSize = 120
  return Array.from({ length: totalSeconds }, (_, i) =>
    Math.floor(i / blockSize) % 2 === 0 ? hi : lo
  )
}

/** HR stream uniformly covering all 5 zones (20% each) */
function allZoneHR(maxHR, samples = 500) {
  const boundaries = [0.55, 0.65, 0.75, 0.85, 0.95]
  const perZone    = Math.floor(samples / 5)
  const series     = []
  for (const pct of boundaries) {
    for (let i = 0; i < perZone; i++) series.push(Math.round(pct * maxHR))
  }
  return series
}

// ── powerMetrics ──────────────────────────────────────────────────────────────

describe('powerMetrics', () => {
  it('flat 200W at FTP=250 for 3600s gives TSS ≈ 64', () => {
    const series = flatPower(200, 3600)
    const { np, intensityFactor, tss } = powerMetrics(series, 250, 3600)
    // NP ≈ 200 (flat power), IF = 0.80, TSS = (3600×200×0.8)/(250×3600)×100 = 64
    expect(np).toBeCloseTo(200, 0)
    expect(intensityFactor).toBeCloseTo(0.80, 1)
    expect(tss).toBeCloseTo(64, 0)
  })

  it('variable power (50/350W) has NP > average power', () => {
    // Average = 200W; but NP weights by 4th power so NP > average
    const series = variablePower(50, 350, 1800)
    const np     = normalizedPower(series)
    const avgPow = series.reduce((s, v) => s + v, 0) / series.length
    expect(np).toBeGreaterThan(avgPow)
  })

  it('returns zeros when FTP is 0', () => {
    const { np, intensityFactor, tss } = powerMetrics(flatPower(200, 600), 0, 600)
    expect(np).toBe(0)
    expect(intensityFactor).toBe(0)
    expect(tss).toBe(0)
  })

  it('returns zeros for empty power series', () => {
    const { np, tss } = powerMetrics([], 250, 3600)
    expect(np).toBe(0)
    expect(tss).toBe(0)
  })
})

// ── hrZoneDistribution ────────────────────────────────────────────────────────

describe('hrZoneDistribution', () => {
  it('distributes 5 equal groups to ~20% each zone', () => {
    const series = allZoneHR(185, 500)
    const zones  = hrZoneDistribution(series, 185)
    expect(zones).toHaveLength(5)
    zones.forEach(z => expect(z).toBeGreaterThan(0))
    const sum = zones.reduce((s, v) => s + v, 0)
    // Percentages should sum to ~100 (rounding may put it at 99–101)
    expect(sum).toBeGreaterThanOrEqual(98)
    expect(sum).toBeLessThanOrEqual(102)
  })

  it('all Z5 when every sample is above 90% maxHR', () => {
    const series = Array(300).fill(180)  // 97% of 185
    const zones  = hrZoneDistribution(series, 185)
    expect(zones[4]).toBe(100)
    expect(zones.slice(0, 4).every(z => z === 0)).toBe(true)
  })

  it('returns [0,0,0,0,0] for empty series', () => {
    expect(hrZoneDistribution([], 185)).toEqual([0, 0, 0, 0, 0])
  })

  it('returns [0,0,0,0,0] when maxHR is 0', () => {
    expect(hrZoneDistribution([120, 140, 160], 0)).toEqual([0, 0, 0, 0, 0])
  })
})

// ── decouplingPct ─────────────────────────────────────────────────────────────

describe('decouplingPct', () => {
  it('returns null when HR series is too short', () => {
    const hr    = Array(60).fill(140)
    const power = Array(60).fill(200)
    expect(decouplingPct(hr, { powerSeries: power })).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(decouplingPct([], {})).toBeNull()
  })
})
