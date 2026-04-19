// src/lib/__tests__/science/durabilityScore.test.js
// E12 — Citation-grounded tests for durabilityScore.js
//
// References:
//   Maunder E. et al. (2021). Relevance of training volume, intensity distribution
//     and durability to middle- and long-distance triathlon.
//     Sports Med 51:1523–1550. DOI:10.1007/s40279-021-01459-0
//
// Reference values:
//   baselineMMP5min = 300W (well-trained cyclist)
//   lastHour5minPeak = 285W → durability% = 285/300 × 100 = 95.0% → 'high'
//   lastHour5minPeak = 270W → durability% = 270/300 × 100 = 90.0% → 'moderate'
//   lastHour5minPeak = 255W → durability% = 255/300 × 100 = 85.0% → 'low'
//   lastHour5minPeak = 240W → durability% = 240/300 × 100 = 80.0% → 'very_low'

import { describe, it, expect } from 'vitest'
import {
  computeDurability,
  classifyDurability,
  DURABILITY_THRESHOLDS,
} from '../../science/durabilityScore.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a power stream:
 * - `duration` seconds at `baseWatts`
 * - A 5-min (300s) block embedded in the last hour at `peakWatts`
 */
function buildPowerStream(durationSec, baseWatts, peakWatts, peakOffsetFromEnd = 600) {
  const stream = new Array(durationSec).fill(baseWatts)
  const peakStart = Math.max(0, durationSec - peakOffsetFromEnd)
  for (let i = peakStart; i < Math.min(peakStart + 300, durationSec); i++) {
    stream[i] = peakWatts
  }
  return stream
}

const BASELINE = 300 // W — baseline 5-min MMP
const SESSION_90MIN = 90 * 60  // 5400 seconds

// ── computeDurability — null guards ──────────────────────────────────────────

describe('computeDurability — null guards (Maunder 2021)', () => {
  it('returns null when session is null', () => {
    expect(computeDurability(null, BASELINE)).toBeNull()
  })

  it('returns null when baseline is null', () => {
    expect(computeDurability({ powerStream: new Array(6000).fill(200), durationSec: 6000 }, null)).toBeNull()
  })

  it('returns null when baseline is zero', () => {
    expect(computeDurability({ powerStream: new Array(6000).fill(200), durationSec: 6000 }, 0)).toBeNull()
  })

  it('returns null when powerStream is empty', () => {
    expect(computeDurability({ powerStream: [], durationSec: 0 }, BASELINE)).toBeNull()
  })

  it('returns null when session is shorter than 90 min', () => {
    // 89-minute session
    const stream = new Array(89 * 60).fill(250)
    const r = computeDurability({ powerStream: stream, durationSec: 89 * 60 }, BASELINE)
    expect(r).toBeNull()
  })

  it('accepts exactly 90-min session', () => {
    const stream = new Array(SESSION_90MIN).fill(250)
    const r = computeDurability({ powerStream: stream, durationSec: SESSION_90MIN }, BASELINE)
    expect(r).not.toBeNull()
    expect(r.valid ?? true).not.toBe(false)
  })
})

// ── computeDurability — reference values (Maunder et al. 2021) ────────────────

describe('computeDurability — reference values (Maunder et al. 2021)', () => {
  // Reference: 285W peak in last hour, baseline=300W → 95.0% → 'high'
  it('returns 95.0% durability for 285W last-hour peak, baseline=300W', () => {
    const stream = buildPowerStream(SESSION_90MIN, 200, 285)
    const r = computeDurability({ powerStream: stream, durationSec: SESSION_90MIN }, BASELINE)
    expect(r).not.toBeNull()
    expect(r.durabilityPct).toBeCloseTo(95.0, 0)
    expect(r.tier).toBe('high')
  })

  // Reference: 270W peak → 90.0% → boundary of 'moderate'
  it('returns 90.0% durability for 270W last-hour peak (moderate tier, Maunder 90–95%)', () => {
    const stream = buildPowerStream(SESSION_90MIN, 200, 270)
    const r = computeDurability({ powerStream: stream, durationSec: SESSION_90MIN }, BASELINE)
    expect(r).not.toBeNull()
    expect(r.durabilityPct).toBeCloseTo(90.0, 0)
    expect(r.tier).toBe('moderate')
  })

  // Reference: 255W peak → 85.0% → boundary of 'low'
  it('returns 85.0% durability for 255W last-hour peak (low tier, Maunder 85–90%)', () => {
    const stream = buildPowerStream(SESSION_90MIN, 200, 255)
    const r = computeDurability({ powerStream: stream, durationSec: SESSION_90MIN }, BASELINE)
    expect(r).not.toBeNull()
    expect(r.durabilityPct).toBeCloseTo(85.0, 0)
    expect(r.tier).toBe('low')
  })

  // Reference: 240W peak → 80.0% → 'very_low'
  it('returns 80.0% durability for 240W last-hour peak (very_low, Maunder < 85%)', () => {
    const stream = buildPowerStream(SESSION_90MIN, 200, 240)
    const r = computeDurability({ powerStream: stream, durationSec: SESSION_90MIN }, BASELINE)
    expect(r).not.toBeNull()
    expect(r.durabilityPct).toBeCloseTo(80.0, 0)
    expect(r.tier).toBe('very_low')
  })

  it('ignores early-session high-power and uses last-hour window only', () => {
    // High power at start (first 5 min), low power throughout → last hour shows fatigue
    const stream = new Array(SESSION_90MIN).fill(200)
    // Set first 5 min = 310W (higher than baseline, but in first 30 min)
    for (let i = 0; i < 300; i++) stream[i] = 310
    // Last hour: all 200W → EF = 200/300 = 66.7%
    const r = computeDurability({ powerStream: stream, durationSec: SESSION_90MIN }, BASELINE)
    expect(r).not.toBeNull()
    expect(r.durabilityPct).toBeCloseTo(66.7, 0)
    expect(r.tier).toBe('very_low')
  })

  it('exposes lastHour5minPeak and baselineMMP5min on result', () => {
    const stream = buildPowerStream(SESSION_90MIN, 200, 280)
    const r = computeDurability({ powerStream: stream, durationSec: SESSION_90MIN }, BASELINE)
    expect(r.lastHour5minPeak).toBeCloseTo(280, 0)
    expect(r.baselineMMP5min).toBe(BASELINE)
  })

  it('infers durationSec from powerStream.length when not provided', () => {
    const stream = new Array(SESSION_90MIN).fill(250)
    const r = computeDurability({ powerStream: stream }, BASELINE)
    expect(r).not.toBeNull()
    expect(r.durationSec).toBe(SESSION_90MIN)
  })
})

// ── classifyDurability — Maunder et al. (2021) thresholds ────────────────────

describe('classifyDurability — Maunder et al. (2021) thresholds', () => {
  it('classifies 95% as high', () => {
    expect(classifyDurability(95)).toBe('high')
  })

  it('classifies 90% as moderate (boundary)', () => {
    expect(classifyDurability(90)).toBe('moderate')
  })

  it('classifies 92% as moderate', () => {
    expect(classifyDurability(92)).toBe('moderate')
  })

  it('classifies 85% as low (boundary)', () => {
    expect(classifyDurability(85)).toBe('low')
  })

  it('classifies 87% as low', () => {
    expect(classifyDurability(87)).toBe('low')
  })

  it('classifies 84.9% as very_low', () => {
    expect(classifyDurability(84.9)).toBe('very_low')
  })
})

// ── DURABILITY_THRESHOLDS constant ────────────────────────────────────────────

describe('DURABILITY_THRESHOLDS constant — Maunder et al. (2021)', () => {
  it('exports high=95, moderate=90, low=85', () => {
    expect(DURABILITY_THRESHOLDS.high).toBe(95)
    expect(DURABILITY_THRESHOLDS.moderate).toBe(90)
    expect(DURABILITY_THRESHOLDS.low).toBe(85)
  })

  it('is frozen', () => {
    expect(Object.isFrozen(DURABILITY_THRESHOLDS)).toBe(true)
  })
})
