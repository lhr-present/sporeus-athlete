// ─── runningCV.test.js — 15+ tests for runningCV lib (E42) ───────────────────
import { describe, it, expect } from 'vitest'
import {
  extractRunEfforts,
  computeRunningCV,
  fmtPace,
  classifyCV,
} from '../../athlete/runningCV.js'

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeRun = (id, date, distanceM, durationMin) => ({
  id, date, type: 'Run', distanceM, duration: durationMin,
})
const makeNonRun = (id, date) => ({
  id, date, type: 'Swim', distanceM: 1000, duration: 20,
})

// ── assignBucket (tested via extractRunEfforts) ───────────────────────────────
describe('assignBucket (via extractRunEfforts)', () => {
  it('5000m → bucket 5K', () => {
    // 5000m in 25min → 300 sec/km — within sanity range
    const log = [makeRun('a', '2026-01-01', 5000, 25)]
    const efforts = extractRunEfforts(log)
    expect(efforts).toHaveLength(1)
    expect(efforts[0].label).toBe('5K')
  })

  it('42195m → bucket M', () => {
    // 42195m in 240min → 341 sec/km — within sanity range
    const log = [makeRun('a', '2026-01-01', 42195, 240)]
    const efforts = extractRunEfforts(log)
    expect(efforts).toHaveLength(1)
    expect(efforts[0].label).toBe('M')
  })

  it('1100m → bucket 1K', () => {
    // 1100m in 6min → 327 sec/km — within sanity range
    const log = [makeRun('a', '2026-01-01', 1100, 6)]
    const efforts = extractRunEfforts(log)
    expect(efforts).toHaveLength(1)
    expect(efforts[0].label).toBe('1K')
  })

  it('7000m (no matching bucket) → excluded from efforts', () => {
    // 7000m does not fall in any bucket
    const log = [makeRun('a', '2026-01-01', 7000, 35)]
    const efforts = extractRunEfforts(log)
    expect(efforts).toHaveLength(0)
  })
})

// ── extractRunEfforts ─────────────────────────────────────────────────────────
describe('extractRunEfforts', () => {
  it('returns empty array when log is empty', () => {
    expect(extractRunEfforts([])).toEqual([])
  })

  it('non-run sessions are filtered out', () => {
    const log = [makeNonRun('s1', '2026-01-01'), makeNonRun('s2', '2026-01-02')]
    expect(extractRunEfforts(log)).toHaveLength(0)
  })

  it('only one effort per bucket — fastest (lowest timeSec) wins', () => {
    const log = [
      makeRun('a', '2026-01-01', 5000, 30),  // slower: 360 sec/km
      makeRun('b', '2026-01-05', 5000, 25),  // faster: 300 sec/km
      makeRun('c', '2026-01-10', 5000, 28),  // middle: 336 sec/km
    ]
    const efforts = extractRunEfforts(log)
    expect(efforts).toHaveLength(1)
    expect(efforts[0].label).toBe('5K')
    expect(efforts[0].timeSec).toBe(25 * 60)
  })

  it('pace sanity filter: too fast (< 120 sec/km) excluded', () => {
    // 5000m in 5min → 60 sec/km → excluded
    const log = [makeRun('a', '2026-01-01', 5000, 5)]
    expect(extractRunEfforts(log)).toHaveLength(0)
  })

  it('pace sanity filter: too slow (> 700 sec/km) excluded', () => {
    // 1000m in 12min → 720 sec/km → excluded
    const log = [makeRun('a', '2026-01-01', 1000, 12)]
    expect(extractRunEfforts(log)).toHaveLength(0)
  })

  it('returns distanceM, timeSec, label, date for valid effort', () => {
    const log = [makeRun('a', '2026-03-15', 10000, 50)]
    const efforts = extractRunEfforts(log)
    expect(efforts[0]).toMatchObject({
      distanceM: 10000,
      timeSec:   3000,
      label:     '10K',
      date:      '2026-03-15',
    })
  })

  it('detects run session by sport field (not just type)', () => {
    const session = { id: 'x', date: '2026-01-01', sport: 'running', distanceM: 5000, duration: 25 }
    const efforts = extractRunEfforts([session])
    expect(efforts).toHaveLength(1)
    expect(efforts[0].label).toBe('5K')
  })

  it('multiple buckets all returned when each distance is different', () => {
    const log = [
      makeRun('a', '2026-01-01', 5000,  25),  // 5K: 300 sec/km
      makeRun('b', '2026-01-02', 10000, 55),  // 10K: 330 sec/km
      makeRun('c', '2026-01-03', 21097, 125), // HM: ~354 sec/km
    ]
    const efforts = extractRunEfforts(log)
    expect(efforts).toHaveLength(3)
    const labels = efforts.map(e => e.label).sort()
    expect(labels).toEqual(['10K', '5K', 'HM'])
  })
})

// ── computeRunningCV ──────────────────────────────────────────────────────────
describe('computeRunningCV', () => {
  it('returns null when log has < 2 different bucket efforts', () => {
    const log = [makeRun('a', '2026-01-01', 5000, 25)]
    expect(computeRunningCV(log)).toBeNull()
  })

  it('returns null when log is empty', () => {
    expect(computeRunningCV([])).toBeNull()
  })

  it('returns CV, DAna, CVPaceSecKm with 2+ valid efforts', () => {
    const log = [
      makeRun('a', '2026-01-01', 3000, 12),  // ~4:00/km
      makeRun('b', '2026-01-02', 5000, 22),  // ~4:24/km
    ]
    const result = computeRunningCV(log)
    expect(result).not.toBeNull()
    expect(typeof result.CV).toBe('number')
    expect(typeof result.DAna).toBe('number')
    expect(typeof result.CVPaceSecKm).toBe('number')
  })

  it('effortsUsed matches efforts array length', () => {
    const log = [
      makeRun('a', '2026-01-01', 3000, 12),
      makeRun('b', '2026-01-02', 5000, 22),
      makeRun('c', '2026-01-03', 10000, 50),
    ]
    const result = computeRunningCV(log)
    expect(result.effortsUsed).toBe(result.efforts.length)
    expect(result.effortsUsed).toBe(3)
  })

  it('CV > 0 with valid 2+ efforts', () => {
    const log = [
      makeRun('a', '2026-01-01', 3000, 12),
      makeRun('b', '2026-01-02', 5000, 22),
    ]
    const result = computeRunningCV(log)
    expect(result.CV).toBeGreaterThan(0)
  })

  it('CVPaceSecKm = 1000 / CV (spot check)', () => {
    const log = [
      makeRun('a', '2026-01-01', 3000, 12),
      makeRun('b', '2026-01-02', 5000, 22),
    ]
    const result = computeRunningCV(log)
    // CVPaceSecKm should be approx 1000 / CV (rounded to nearest integer)
    expect(result.CVPaceSecKm).toBeCloseTo(1000 / result.CV, -1)
  })

  it('correct CV value with known inputs', () => {
    // 3000m in 720s, 5000m in 1260s
    // Expected from criticalVelocity docstring: CV ≈ 3.77 m/s
    // 3000m = 12min, 5000m = 21min
    const log = [
      makeRun('a', '2026-01-01', 3000, 12),
      makeRun('b', '2026-01-02', 5000, 21),
    ]
    const result = computeRunningCV(log)
    expect(result).not.toBeNull()
    expect(result.CV).toBeGreaterThan(3.5)
    expect(result.CV).toBeLessThan(4.2)
  })
})

// ── fmtPace ───────────────────────────────────────────────────────────────────
describe('fmtPace', () => {
  it('267 → "4:27 /km"', () => {
    expect(fmtPace(267)).toBe('4:27 /km')
  })

  it('300 → "5:00 /km"', () => {
    expect(fmtPace(300)).toBe('5:00 /km')
  })

  it('240 → "4:00 /km"', () => {
    expect(fmtPace(240)).toBe('4:00 /km')
  })

  it('180 → "3:00 /km"', () => {
    expect(fmtPace(180)).toBe('3:00 /km')
  })

  it('390 → "6:30 /km"', () => {
    expect(fmtPace(390)).toBe('6:30 /km')
  })
})

// ── classifyCV ────────────────────────────────────────────────────────────────
describe('classifyCV', () => {
  it('200 sec/km → "elite"', () => {
    expect(classifyCV(200)).toBe('elite')
  })

  it('270 sec/km → "advanced"', () => {
    expect(classifyCV(270)).toBe('advanced')
  })

  it('330 sec/km → "intermediate"', () => {
    expect(classifyCV(330)).toBe('intermediate')
  })

  it('400 sec/km → "recreational"', () => {
    expect(classifyCV(400)).toBe('recreational')
  })

  it('boundary: 239 → "elite"', () => {
    expect(classifyCV(239)).toBe('elite')
  })

  it('boundary: 240 → "advanced"', () => {
    expect(classifyCV(240)).toBe('advanced')
  })

  it('boundary: 299 → "advanced"', () => {
    expect(classifyCV(299)).toBe('advanced')
  })

  it('boundary: 300 → "intermediate"', () => {
    expect(classifyCV(300)).toBe('intermediate')
  })

  it('boundary: 360 → "recreational"', () => {
    expect(classifyCV(360)).toBe('recreational')
  })
})
