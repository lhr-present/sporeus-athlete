// src/lib/__tests__/powerAnalysis.test.js — E96
import { describe, it, expect } from 'vitest'
import {
  KEY_DURATIONS,
  calculateMMP,
  fitCriticalPower,
  detectIntervals,
  estimateFTP,
} from '../powerAnalysis.js'

// ── Helpers ───────────────────────────────────────────────────────────────────
/** Build a constant-power stream of `length` seconds at `watts`. */
function flatStream(watts, length) {
  return Array(length).fill(watts)
}

/**
 * Build a stream with N interval blocks at `effortWatts` separated by
 * `restWatts` rest blocks. Each block is `blockSec` seconds.
 */
function intervalStream({ effortWatts = 300, restWatts = 100, blockSec = 60, blocks = 4 } = {}) {
  const result = []
  for (let i = 0; i < blocks; i++) {
    result.push(...Array(blockSec).fill(effortWatts))
    result.push(...Array(blockSec).fill(restWatts))
  }
  return result
}

/**
 * Build an MMP array that covers durations 120–1800 s (the CP fit window)
 * using the hyperbolic model P(t) = W'/t + CP with the supplied cp/wPrime.
 */
function syntheticMMP(cp = 250, wPrime = 20000) {
  const durations = [120, 180, 240, 300, 360, 480, 600, 720, 900, 1200, 1500, 1800]
  return durations.map(d => ({ duration: d, power: Math.round(wPrime / d + cp) }))
}

// ─────────────────────────────────────────────────────────────────────────────
// KEY_DURATIONS
// ─────────────────────────────────────────────────────────────────────────────
describe('KEY_DURATIONS', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(KEY_DURATIONS)).toBe(true)
    expect(KEY_DURATIONS.length).toBeGreaterThan(0)
  })

  it('contains the expected short durations: 1, 2, 3, 5', () => {
    expect(KEY_DURATIONS).toContain(1)
    expect(KEY_DURATIONS).toContain(2)
    expect(KEY_DURATIONS).toContain(3)
    expect(KEY_DURATIONS).toContain(5)
  })

  it('contains mid-range durations: 60, 300, 1200', () => {
    expect(KEY_DURATIONS).toContain(60)
    expect(KEY_DURATIONS).toContain(300)
    expect(KEY_DURATIONS).toContain(1200)
  })

  it('contains long durations: 1800, 3600', () => {
    expect(KEY_DURATIONS).toContain(1800)
    expect(KEY_DURATIONS).toContain(3600)
  })

  it('is sorted in ascending order', () => {
    for (let i = 1; i < KEY_DURATIONS.length; i++) {
      expect(KEY_DURATIONS[i]).toBeGreaterThan(KEY_DURATIONS[i - 1])
    }
  })

  it('contains only positive integers', () => {
    for (const d of KEY_DURATIONS) {
      expect(d).toBeGreaterThan(0)
      expect(Number.isInteger(d)).toBe(true)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// calculateMMP
// ─────────────────────────────────────────────────────────────────────────────
describe('calculateMMP', () => {
  it('returns [] for null input', () => {
    expect(calculateMMP(null)).toEqual([])
  })

  it('returns [] for undefined input', () => {
    expect(calculateMMP(undefined)).toEqual([])
  })

  it('returns [] for empty array', () => {
    expect(calculateMMP([])).toEqual([])
  })

  it('returns [] when stream is shorter than minimum key duration (1 s)', () => {
    // A zero-length stream is already covered; verify that a single zero
    // sample produces no result because maxAvg stays 0.
    const result = calculateMMP([0])
    expect(result).toEqual([])
  })

  it('returns a single result for a 1-second all-positive stream', () => {
    const result = calculateMMP([300])
    expect(result).toHaveLength(1)
    expect(result[0].duration).toBe(1)
    expect(result[0].power).toBe(300)
  })

  it('each result has {duration, power} shape', () => {
    const result = calculateMMP(flatStream(200, 10))
    for (const pt of result) {
      expect(pt).toHaveProperty('duration')
      expect(pt).toHaveProperty('power')
      expect(typeof pt.duration).toBe('number')
      expect(typeof pt.power).toBe('number')
    }
  })

  it('only includes durations ≤ stream length', () => {
    const stream = flatStream(200, 30)
    const result = calculateMMP(stream)
    for (const pt of result) {
      expect(pt.duration).toBeLessThanOrEqual(30)
    }
  })

  it('returns correct mean-max power for a flat stream (all durations equal)', () => {
    const watts = 250
    const stream = flatStream(watts, 300) // 5 min
    const result = calculateMMP(stream)
    for (const pt of result) {
      expect(pt.power).toBeCloseTo(watts, 0)
    }
  })

  it('correctly picks the highest-power window across durations', () => {
    // 60 s at 100 W, then 60 s at 300 W
    const stream = [...flatStream(100, 60), ...flatStream(300, 60)]
    const result = calculateMMP(stream)
    const pt60 = result.find(p => p.duration === 60)
    expect(pt60).toBeDefined()
    expect(pt60.power).toBe(300) // best 60-s window = the second block
    const pt120 = result.find(p => p.duration === 120)
    expect(pt120).toBeDefined()
    expect(pt120.power).toBeCloseTo(200, 0) // average of both blocks
  })

  it('1-s mean-max equals the peak single sample', () => {
    const stream = [100, 450, 200, 300]
    const result = calculateMMP(stream)
    const pt1 = result.find(p => p.duration === 1)
    expect(pt1).toBeDefined()
    expect(pt1.power).toBe(450)
  })

  it('power is rounded to one decimal place', () => {
    const stream = flatStream(200.123456, 60)
    const result = calculateMMP(stream)
    for (const pt of result) {
      const decimals = (pt.power.toString().split('.')[1] || '').length
      expect(decimals).toBeLessThanOrEqual(1)
    }
  })

  it('windows with < 90 % non-zero samples are excluded (skips zero-heavy blocks)', () => {
    // 1 non-zero sample followed by 99 zeros → 1/100 = 1% non-zero for d=100 window
    // The 1-s window should capture the 300 W sample; the 100-s window should be excluded.
    const stream = [300, ...Array(99).fill(0)]
    const result = calculateMMP(stream)
    const pt100 = result.find(p => p.duration === 100)
    expect(pt100).toBeUndefined() // filtered out due to < 90 % rule
    const pt1 = result.find(p => p.duration === 1)
    expect(pt1).toBeDefined()
    expect(pt1.power).toBe(300)
  })

  it('returns power values as positive numbers', () => {
    const result = calculateMMP(flatStream(150, 600))
    for (const pt of result) {
      expect(pt.power).toBeGreaterThan(0)
    }
  })

  it('longer durations produce equal or lower power than shorter durations for a flat stream (non-increasing curve)', () => {
    // On a constant-power stream the MMP is the same at every duration,
    // so the curve is trivially non-increasing (strictly equal).
    const result = calculateMMP(flatStream(250, 600))
    for (let i = 1; i < result.length; i++) {
      expect(result[i].power).toBeLessThanOrEqual(result[i - 1].power + 0.5) // allow rounding
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// fitCriticalPower
// ─────────────────────────────────────────────────────────────────────────────
describe('fitCriticalPower', () => {
  it('returns null for null input', () => {
    expect(fitCriticalPower(null)).toBeNull()
  })

  it('returns null for empty array', () => {
    expect(fitCriticalPower([])).toBeNull()
  })

  it('returns null for fewer than 3 data points total', () => {
    expect(fitCriticalPower([{ duration: 300, power: 280 }])).toBeNull()
    expect(fitCriticalPower([
      { duration: 300, power: 280 },
      { duration: 600, power: 265 },
    ])).toBeNull()
  })

  it('returns null when fewer than 3 points fall in the 2–30 min fit window', () => {
    // Only short durations outside 120–1800 s window
    const pts = [
      { duration: 1,  power: 800 },
      { duration: 5,  power: 600 },
      { duration: 30, power: 400 },
    ]
    expect(fitCriticalPower(pts)).toBeNull()
  })

  it('returns {cp, wPrime, r2} shape for valid input', () => {
    const mmps = syntheticMMP(250, 20000)
    const result = fitCriticalPower(mmps)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('cp')
    expect(result).toHaveProperty('wPrime')
    expect(result).toHaveProperty('r2')
  })

  it('cp is a positive number in physiologically plausible range (50–600 W)', () => {
    const mmps = syntheticMMP(250, 20000)
    const result = fitCriticalPower(mmps)
    expect(result).not.toBeNull()
    expect(result.cp).toBeGreaterThanOrEqual(50)
    expect(result.cp).toBeLessThanOrEqual(600)
  })

  it('wPrime is in physiologically plausible range (3000–120 000 J)', () => {
    const mmps = syntheticMMP(250, 20000)
    const result = fitCriticalPower(mmps)
    expect(result).not.toBeNull()
    expect(result.wPrime).toBeGreaterThanOrEqual(3000)
    expect(result.wPrime).toBeLessThanOrEqual(120000)
  })

  it('recovers cp close to the synthetic ground truth', () => {
    const truthCP = 240
    const mmps = syntheticMMP(truthCP, 18000)
    const result = fitCriticalPower(mmps)
    expect(result).not.toBeNull()
    // OLS on a perfect hyperbola should recover CP within ±5 W
    expect(Math.abs(result.cp - truthCP)).toBeLessThanOrEqual(5)
  })

  it('recovers wPrime close to the synthetic ground truth', () => {
    const truthWP = 18000
    const mmps = syntheticMMP(240, truthWP)
    const result = fitCriticalPower(mmps)
    expect(result).not.toBeNull()
    // Allow ±1000 J tolerance for OLS rounding
    expect(Math.abs(result.wPrime - truthWP)).toBeLessThanOrEqual(1000)
  })

  it('r2 is between 0 and 1 (inclusive)', () => {
    const mmps = syntheticMMP(250, 20000)
    const result = fitCriticalPower(mmps)
    expect(result).not.toBeNull()
    expect(result.r2).toBeGreaterThanOrEqual(0)
    expect(result.r2).toBeLessThanOrEqual(1)
  })

  it('r2 is close to 1 for a perfect hyperbolic dataset', () => {
    const mmps = syntheticMMP(250, 20000)
    const result = fitCriticalPower(mmps)
    expect(result).not.toBeNull()
    expect(result.r2).toBeGreaterThan(0.98)
  })

  it('returns null when inferred cp is out of physiological bounds', () => {
    // All points at the same power → OLS produces cp ≈ power, wPrime ≈ 0
    const flat = [120, 180, 240, 300, 600, 900, 1200, 1800].map(d => ({ duration: d, power: 1000 }))
    // cp=1000 > 600 → should return null
    const result = fitCriticalPower(flat)
    expect(result).toBeNull()
  })

  it('r2 is rounded to 3 decimal places', () => {
    const mmps = syntheticMMP(250, 20000)
    const result = fitCriticalPower(mmps)
    if (result !== null) {
      const decimals = (result.r2.toString().split('.')[1] || '').length
      expect(decimals).toBeLessThanOrEqual(3)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// detectIntervals
// ─────────────────────────────────────────────────────────────────────────────
describe('detectIntervals', () => {
  it('returns [] for null stream', () => {
    expect(detectIntervals(null, 250)).toEqual([])
  })

  it('returns [] for empty stream', () => {
    expect(detectIntervals([], 250)).toEqual([])
  })

  it('returns [] when cp is falsy (0 or undefined)', () => {
    expect(detectIntervals(flatStream(300, 120), 0)).toEqual([])
    expect(detectIntervals(flatStream(300, 120), undefined)).toEqual([])
  })

  it('returns [] when no sample meets the threshold', () => {
    // Stream entirely below 0.85 × 250 = 212.5 W
    const result = detectIntervals(flatStream(100, 120), 250)
    expect(result).toEqual([])
  })

  it('detects a single sustained effort above threshold', () => {
    // 60 s at 300 W with cp=250 → 300 ≥ 0.85 × 250 = 212.5
    const result = detectIntervals(flatStream(300, 60), 250)
    expect(result).toHaveLength(1)
    expect(result[0].durationSec).toBe(60)
  })

  it('each result has required shape keys', () => {
    const result = detectIntervals(flatStream(300, 60), 250)
    const iv = result[0]
    expect(iv).toHaveProperty('start')
    expect(iv).toHaveProperty('end')
    expect(iv).toHaveProperty('durationSec')
    expect(iv).toHaveProperty('avgPower')
    expect(iv).toHaveProperty('np')
    expect(iv).toHaveProperty('zone')
  })

  it('detects multiple interval blocks separated by rest', () => {
    // 4 × (60 s effort @ 300 W, 60 s rest @ 100 W), cp=250
    const stream = intervalStream({ effortWatts: 300, restWatts: 100, blockSec: 60, blocks: 4 })
    const result = detectIntervals(stream, 250)
    expect(result.length).toBeGreaterThanOrEqual(4)
  })

  it('returns intervals sorted by avgPower descending', () => {
    // Two effort levels so sorting is observable: 350 W first, then 280 W
    const stream = [
      ...flatStream(100, 30),
      ...flatStream(280, 60),
      ...flatStream(100, 30),
      ...flatStream(350, 60),
      ...flatStream(100, 30),
    ]
    const result = detectIntervals(stream, 250)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].avgPower).toBeLessThanOrEqual(result[i - 1].avgPower)
    }
  })

  it('filters efforts shorter than minDuration (default 20 s)', () => {
    // 10-second spike followed by a 60 s effort
    const stream = [
      ...flatStream(300, 10), // below minDuration=20
      ...flatStream(100, 30),
      ...flatStream(300, 60),
    ]
    const result = detectIntervals(stream, 250)
    for (const iv of result) {
      expect(iv.durationSec).toBeGreaterThanOrEqual(20)
    }
  })

  it('respects custom minDuration parameter', () => {
    // Default min=20 would keep 30-s effort; minDuration=40 should drop it
    const stream = [
      ...flatStream(300, 30),
      ...flatStream(100, 30),
      ...flatStream(300, 60),
    ]
    const resultDefault  = detectIntervals(stream, 250)
    const resultCustom   = detectIntervals(stream, 250, 0.85, 40)
    // custom should have fewer or equal intervals
    expect(resultCustom.length).toBeLessThanOrEqual(resultDefault.length)
  })

  it('merges adjacent efforts separated by ≤ mergeSec (default 5 s) gap', () => {
    // Two 30 s efforts at 300 W with a 3 s rest gap → should merge into one
    const stream = [
      ...flatStream(300, 30),
      ...flatStream(100, 3),  // gap ≤ 5 s → merges
      ...flatStream(300, 30),
    ]
    const result = detectIntervals(stream, 250)
    expect(result).toHaveLength(1)
    expect(result[0].durationSec).toBeGreaterThanOrEqual(60)
  })

  it('does NOT merge efforts separated by more than mergeSec', () => {
    // Two 30 s efforts with a 10 s gap → should remain separate
    const stream = [
      ...flatStream(300, 30),
      ...flatStream(100, 10), // gap > 5 s → no merge
      ...flatStream(300, 30),
    ]
    const result = detectIntervals(stream, 250)
    expect(result.length).toBeGreaterThanOrEqual(2)
  })

  it('zone label is a string starting with "Z"', () => {
    const result = detectIntervals(flatStream(300, 60), 250)
    expect(result[0].zone).toMatch(/^Z\d$/)
  })

  it('assigns correct zone for power above CP (Z4/Z5/Z6)', () => {
    // 350 W with cp=250 → ratio=1.4 → Z6 (> 1.20)
    const result = detectIntervals(flatStream(350, 60), 250)
    expect(['Z5', 'Z6']).toContain(result[0].zone)
  })

  it('durationSec equals end − start + 1', () => {
    const result = detectIntervals(flatStream(300, 60), 250)
    const iv = result[0]
    expect(iv.durationSec).toBe(iv.end - iv.start + 1)
  })

  it('avgPower is a positive integer (rounded)', () => {
    const result = detectIntervals(flatStream(300, 60), 250)
    const iv = result[0]
    expect(Number.isInteger(iv.avgPower)).toBe(true)
    expect(iv.avgPower).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// estimateFTP
// ─────────────────────────────────────────────────────────────────────────────
describe('estimateFTP', () => {
  it('returns null for null input', () => {
    expect(estimateFTP(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(estimateFTP(undefined)).toBeNull()
  })

  it('returns null for empty array', () => {
    expect(estimateFTP([])).toBeNull()
  })

  it('returns null when array contains no usable durations', () => {
    const mmps = [{ duration: 10, power: 500 }, { duration: 30, power: 400 }]
    expect(estimateFTP(mmps)).toBeNull()
  })

  it('prefers 60-min MMP when available', () => {
    const mmps = [
      { duration: 3600, power: 240 },
      { duration: 1200, power: 280 },
      { duration: 480,  power: 310 },
    ]
    expect(estimateFTP(mmps)).toBe(240) // direct 60-min value
  })

  it('falls back to 20-min × 0.95 when no 60-min point', () => {
    const p20 = 270
    const mmps = [
      { duration: 1200, power: p20 },
      { duration: 480,  power: 310 },
    ]
    expect(estimateFTP(mmps)).toBe(Math.round(p20 * 0.95))
  })

  it('falls back to 8-min × 0.90 when no 60-min or 20-min point', () => {
    const p8 = 340
    const mmps = [
      { duration: 480, power: p8 },
      { duration: 60,  power: 380 },
    ]
    expect(estimateFTP(mmps)).toBe(Math.round(p8 * 0.90))
  })

  it('result is a positive number', () => {
    const mmps = [{ duration: 1200, power: 280 }]
    const ftp = estimateFTP(mmps)
    expect(ftp).not.toBeNull()
    expect(ftp).toBeGreaterThan(0)
  })

  it('FTP estimate is less than or equal to peak short-duration power', () => {
    const mmps = [
      { duration: 1,    power: 900 },
      { duration: 5,    power: 600 },
      { duration: 60,   power: 400 },
      { duration: 300,  power: 320 },
      { duration: 1200, power: 270 },
    ]
    const ftp = estimateFTP(mmps)
    expect(ftp).toBeLessThanOrEqual(900)
  })

  it('returns an integer (Math.round applied)', () => {
    const mmps = [{ duration: 1200, power: 271.7 }]
    const ftp = estimateFTP(mmps)
    expect(Number.isInteger(ftp)).toBe(true)
  })

  it('FTP from 60-min is lower than 20-min × 0.95 (physiological check)', () => {
    const p60 = 230
    const p20 = 260
    const mmps = [
      { duration: 3600, power: p60 },
      { duration: 1200, power: p20 },
    ]
    // Should use 60-min value
    expect(estimateFTP(mmps)).toBe(230)
    expect(estimateFTP(mmps)).toBeLessThan(Math.round(p20 * 0.95) + 1)
  })

  it('handles MMP arrays with many durations correctly (full curve)', () => {
    const mmps = calculateMMP(flatStream(260, 7200)) // 2-hour flat ride
    const ftp = estimateFTP(mmps)
    expect(ftp).not.toBeNull()
    expect(ftp).toBeGreaterThan(0)
    expect(ftp).toBeLessThanOrEqual(260)
  })
})
