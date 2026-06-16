// ─── runningCV.test.js — E42: 24 tests ───────────────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  extractRunEfforts,
  computeRunningCV,
  fmtPace,
  classifyCV,
} from '../../athlete/runningCV.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Build a valid run session with pace inside 120–700 sec/km AND ensure
// different paces so CV regression yields DAna > 0 (CV model requires this).
// 5K in 20 min → pace = 240 s/km (faster)
const run5K  = { type: 'run', distanceM: 5000,  duration: 20, date: '2026-04-10' }
// 10K in 48 min → pace = 288 s/km (slightly slower — realistic drop-off)
const run10K = { type: 'run', distanceM: 10000, duration: 48, date: '2026-04-15' }
// HM in 106 min → pace ≈ 300 s/km (further drop-off)
const runHM  = { type: 'run', distanceM: 21097, duration: 106, date: '2026-04-20' }

// Session using sport field
const sportRun5K = { sport: 'running', distanceM: 5000, duration: 25, date: '2026-04-12' }

// Pace out of range: 5K in 1 min → pace = 12 s/km (too fast)
const tooFast = { type: 'run', distanceM: 5000, duration: 1, date: '2026-04-01' }
// Pace out of range: 5K in 60 min → pace = 720 s/km (too slow)
const tooSlow = { type: 'run', distanceM: 5000, duration: 60, date: '2026-04-02' }

// ─── 1. extractRunEfforts ─────────────────────────────────────────────────────
describe('extractRunEfforts', () => {
  it('returns [] for null or empty log', () => {
    expect(extractRunEfforts(null)).toEqual([])
    expect(extractRunEfforts([])).toEqual([])
  })

  it('ignores non-run sessions', () => {
    const bike = { type: 'bike', distanceM: 5000, duration: 20, date: '2026-04-10' }
    expect(extractRunEfforts([bike])).toEqual([])
  })

  it('returns effort with correct shape for a valid run', () => {
    const result = extractRunEfforts([run5K])
    expect(result.length).toBe(1)
    expect(result[0]).toHaveProperty('distanceM', 5000)
    expect(result[0]).toHaveProperty('label', '5K')
    expect(result[0]).toHaveProperty('timeSec', 20 * 60)
    expect(result[0]).toHaveProperty('date')
  })

  it('detects runs via sport field', () => {
    const result = extractRunEfforts([sportRun5K])
    expect(result.length).toBe(1)
  })

  it('excludes sessions with pace out of sanity range', () => {
    expect(extractRunEfforts([tooFast])).toEqual([])
    expect(extractRunEfforts([tooSlow])).toEqual([])
  })

  it('keeps the best (fastest) effort per bucket', () => {
    const fast5K = { type: 'run', distanceM: 5000, duration: 20, date: '2026-04-11' }
    const result = extractRunEfforts([run5K, fast5K])
    const bucket5k = result.find(e => e.label === '5K')
    expect(bucket5k.timeSec).toBe(20 * 60)
  })

  it('returns one entry per bucket across multiple distances', () => {
    const result = extractRunEfforts([run5K, run10K])
    expect(result.length).toBe(2)
    const labels = result.map(e => e.label)
    expect(labels).toContain('5K')
    expect(labels).toContain('10K')
  })

  it('returns null date when session has no date field', () => {
    const noDate = { type: 'run', distanceM: 5000, duration: 25 }
    const result = extractRunEfforts([noDate])
    expect(result[0].date).toBeNull()
  })
})

// ─── 2. computeRunningCV ─────────────────────────────────────────────────────
describe('computeRunningCV', () => {
  it('returns null for empty or invalid log', () => {
    expect(computeRunningCV(null)).toBeNull()
    expect(computeRunningCV([])).toBeNull()
  })

  it('returns null with only one bucket', () => {
    expect(computeRunningCV([run5K])).toBeNull()
  })

  it('returns result shape with 2+ distance buckets', () => {
    const result = computeRunningCV([run5K, run10K])
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('CV')
    expect(result).toHaveProperty('DAna')
    expect(result).toHaveProperty('CVPaceSecKm')
    expect(result).toHaveProperty('effortsUsed')
    expect(result).toHaveProperty('efforts')
    expect(result.effortsUsed).toBe(2)
  })

  it('CV is positive when computed from valid efforts', () => {
    const result = computeRunningCV([run5K, run10K])
    expect(result.CV).toBeGreaterThan(0)
  })

  it('uses more efforts when more buckets provided', () => {
    const result = computeRunningCV([run5K, run10K, runHM])
    expect(result.effortsUsed).toBe(3)
  })
})

// ─── 3. fmtPace ──────────────────────────────────────────────────────────────
describe('fmtPace', () => {
  it('formats 300 sec/km as 5:00 /km', () => {
    expect(fmtPace(300)).toBe('5:00 /km')
  })

  it('formats 267 sec/km as 4:27 /km', () => {
    expect(fmtPace(267)).toBe('4:27 /km')
  })

  it('formats 60 sec/km as 1:00 /km', () => {
    expect(fmtPace(60)).toBe('1:00 /km')
  })

  it('pads seconds to two digits', () => {
    expect(fmtPace(61)).toBe('1:01 /km')
  })
})

// ─── 4. classifyCV ───────────────────────────────────────────────────────────
describe('classifyCV', () => {
  it('returns elite for pace < 240 sec/km', () => {
    expect(classifyCV(200)).toBe('elite')
    expect(classifyCV(239)).toBe('elite')
  })

  it('returns advanced for pace 240–299', () => {
    expect(classifyCV(240)).toBe('advanced')
    expect(classifyCV(299)).toBe('advanced')
  })

  it('returns intermediate for pace 300–359', () => {
    expect(classifyCV(300)).toBe('intermediate')
    expect(classifyCV(359)).toBe('intermediate')
  })

  it('returns recreational for pace >= 360', () => {
    expect(classifyCV(360)).toBe('recreational')
    expect(classifyCV(500)).toBe('recreational')
  })
})

// ─── distanceKm normalization (regression) ──────────────────────────────────
// Manual runs store distanceKm (not distanceM). extractRunEfforts must
// normalize distance so these are not silently dropped.
describe('extractRunEfforts — distanceKm normalization', () => {
  it('accepts a run that only has distanceKm (5K in 20 min)', () => {
    const kmRun = { type: 'run', distanceKm: 5, duration: 20, date: '2026-04-10' }
    const efforts = extractRunEfforts([kmRun])
    expect(efforts).toHaveLength(1)
    expect(efforts[0].distanceM).toBe(5000)
    expect(efforts[0].timeSec).toBe(1200)
  })

  it('accepts heuristic `distance` field (>1000 = meters, else km)', () => {
    const kmRun = { type: 'run', distance: 10, duration: 48, date: '2026-04-15' } // 10 km
    const efforts = extractRunEfforts([kmRun])
    expect(efforts).toHaveLength(1)
    expect(efforts[0].distanceM).toBe(10000)
  })
})
