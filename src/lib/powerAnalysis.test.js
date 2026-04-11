import { describe, it, expect } from 'vitest'
import {
  calculateMMP,
  fitCriticalPower,
  detectIntervals,
  estimateFTP,
} from './powerAnalysis.js'

// ── calculateMMP ──────────────────────────────────────────────────────────────
describe('calculateMMP', () => {
  it('returns empty for empty stream', () => {
    expect(calculateMMP([])).toEqual([])
    expect(calculateMMP(null)).toEqual([])
  })

  it('1s MMP equals highest single watt value', () => {
    const stream = [200, 350, 180, 400, 250]
    const mmp = calculateMMP(stream)
    const p1 = mmp.find(p => p.duration === 1)
    expect(p1).toBeDefined()
    expect(p1.power).toBe(400)
  })

  it('5s MMP is the highest 5-second mean power', () => {
    // Blocks: [100,100,100,100,100] and [300,300,300,300,300]
    const stream = Array(5).fill(100).concat(Array(5).fill(300))
    const mmp = calculateMMP(stream)
    const p5 = mmp.find(p => p.duration === 5)
    expect(p5).toBeDefined()
    expect(p5.power).toBe(300)
  })

  it('skips window where < 90% samples are non-zero', () => {
    // 5-sample window: 4 zeros and one 500W — only 20% valid, should not count
    const stream = [0, 0, 0, 0, 500]
    const mmp = calculateMMP(stream)
    const p5 = mmp.find(p => p.duration === 5)
    // All 5-second windows have < 90% valid (at best 1/5 = 20%)
    expect(p5).toBeUndefined()
  })

  it('returns {duration, power} pairs with power > 0', () => {
    const stream = Array(120).fill(200)
    const mmp = calculateMMP(stream)
    expect(mmp.length).toBeGreaterThan(0)
    mmp.forEach(p => {
      expect(typeof p.duration).toBe('number')
      expect(typeof p.power).toBe('number')
      expect(p.power).toBeGreaterThan(0)
    })
  })

  it('longer durations have equal or lower power (monotone non-increasing)', () => {
    // Constant power stream → MMP should be flat
    const stream = Array(600).fill(250)
    const mmp = calculateMMP(stream)
    for (let i = 1; i < mmp.length; i++) {
      expect(mmp[i].power).toBeLessThanOrEqual(mmp[i - 1].power + 1)
    }
  })
})

// ── fitCriticalPower ──────────────────────────────────────────────────────────
describe('fitCriticalPower', () => {
  it('returns null for fewer than 3 points', () => {
    expect(fitCriticalPower(null)).toBeNull()
    expect(fitCriticalPower([])).toBeNull()
    expect(fitCriticalPower([{ duration: 300, power: 320 }])).toBeNull()
  })

  it('returns null when no points in 2–30 min range', () => {
    // Only short durations — outside fit window
    const pts = [
      { duration: 1, power: 500 },
      { duration: 5, power: 450 },
      { duration: 10, power: 420 },
    ]
    expect(fitCriticalPower(pts)).toBeNull()
  })

  it('recovers known CP and W′ from ideal model data', () => {
    // P(t) = 20000/t + 250  →  CP=250, W′=20000J
    const CP = 250; const WP = 20000
    const mmps = [120, 300, 600, 1200, 1800].map(d => ({
      duration: d,
      power: WP / d + CP,
    }))
    const fit = fitCriticalPower(mmps)
    expect(fit).not.toBeNull()
    expect(fit.cp).toBeCloseTo(CP, -1)    // within ±10W
    expect(fit.wPrime).toBeCloseTo(WP, -2) // within ±100J
    expect(fit.r2).toBeGreaterThan(0.99)
  })

  it('r2 is between 0 and 1', () => {
    const CP = 280; const WP = 22000
    const mmps = [120, 300, 600, 900, 1200, 1800].map(d => ({
      duration: d,
      power: WP / d + CP + (Math.random() - 0.5) * 5,
    }))
    const fit = fitCriticalPower(mmps)
    if (fit) {
      expect(fit.r2).toBeGreaterThanOrEqual(0)
      expect(fit.r2).toBeLessThanOrEqual(1)
    }
  })
})

// ── detectIntervals ───────────────────────────────────────────────────────────
describe('detectIntervals', () => {
  it('returns empty for all-zero stream', () => {
    expect(detectIntervals(Array(60).fill(0), 250)).toEqual([])
  })

  it('returns empty when no stream / cp provided', () => {
    expect(detectIntervals([], 250)).toEqual([])
    expect(detectIntervals([200, 300, 400], 0)).toEqual([])
  })

  it('detects a single interval above threshold', () => {
    // 30s easy, 30s hard (>0.85*250=212.5W), 30s easy
    const stream = [
      ...Array(30).fill(150),
      ...Array(30).fill(300),
      ...Array(30).fill(150),
    ]
    const intervals = detectIntervals(stream, 250)
    expect(intervals.length).toBe(1)
    expect(intervals[0].durationSec).toBe(30)
    expect(intervals[0].avgPower).toBe(300)
  })

  it('merges gaps shorter than 5 seconds', () => {
    // Hard 20s, easy 4s (gap < 5), hard 20s → should merge into one interval
    const stream = [
      ...Array(20).fill(300),
      ...Array(4).fill(100),
      ...Array(20).fill(300),
    ]
    const intervals = detectIntervals(stream, 250)
    expect(intervals.length).toBe(1)
    expect(intervals[0].durationSec).toBe(44)
  })

  it('filters out efforts shorter than minDuration', () => {
    // 10s hard (below default 20s minimum)
    const stream = [...Array(30).fill(150), ...Array(10).fill(350), ...Array(30).fill(150)]
    const intervals = detectIntervals(stream, 250)
    expect(intervals.length).toBe(0)
  })

  it('assigns correct zone based on avgPower/CP ratio', () => {
    // 0.95*CP = Z4 (0.90–1.05)
    const cp = 260
    const power = Math.round(cp * 0.97)  // Z4
    const stream = [...Array(10).fill(100), ...Array(30).fill(power), ...Array(10).fill(100)]
    const intervals = detectIntervals(stream, cp)
    expect(intervals.length).toBe(1)
    expect(intervals[0].zone).toBe('Z4')
  })
})

// ── estimateFTP ───────────────────────────────────────────────────────────────
describe('estimateFTP', () => {
  it('returns null for empty / null mmps', () => {
    expect(estimateFTP(null)).toBeNull()
    expect(estimateFTP([])).toBeNull()
  })

  it('returns 60-min MMP directly when available', () => {
    const mmps = [{ duration: 3600, power: 260 }, { duration: 1200, power: 290 }]
    expect(estimateFTP(mmps)).toBe(260)
  })

  it('returns 95% of 20-min MMP when 60-min not present', () => {
    const mmps = [{ duration: 1200, power: 300 }]
    expect(estimateFTP(mmps)).toBe(285)  // Math.round(300 * 0.95)
  })

  it('returns 90% of 8-min MMP as last resort', () => {
    const mmps = [{ duration: 480, power: 330 }]
    expect(estimateFTP(mmps)).toBe(297)  // Math.round(330 * 0.90)
  })
})
