import { describe, it, expect } from 'vitest'
import {
  ostrcAnalysis,
  ostrcTrend,
  computeOSTRCSummary,
  OSTRC_CITATION,
} from '../../athlete/ostrcSummary.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeEntry(n, total) {
  const weekNum = String(n).padStart(2, '0')
  return {
    week:  `2026-W${weekNum}`,
    date:  `2026-01-${String(n).padStart(2, '0')}`,
    total,
    answers: [],
  }
}

// ─── ostrcAnalysis: edge cases ───────────────────────────────────────────────
describe('ostrcAnalysis — empty and minimal input', () => {
  it('returns [] for empty array', () => {
    expect(ostrcAnalysis([])).toEqual([])
  })

  it('returns [] for single entry', () => {
    expect(ostrcAnalysis([makeEntry(1, 0)])).toEqual([])
  })

  it('returns [] for non-array input', () => {
    expect(ostrcAnalysis(null)).toEqual([])
    expect(ostrcAnalysis(undefined)).toEqual([])
  })

  it('returns analysis for exactly 2 entries', () => {
    const h = [makeEntry(1, 0), makeEntry(2, 30)]
    const result = ostrcAnalysis(h)
    expect(result).toHaveLength(2)
  })
})

// ─── ostrcAnalysis: risk label correctness ───────────────────────────────────
// ostrcRisk: 0 → 'none', 1–25 → 'minor', 26–50 → 'moderate', 51–100 → 'substantial'
describe('ostrcAnalysis — risk labels (Clarsen 2013 tiers)', () => {
  it('score 0 → risk none', () => {
    const h = [makeEntry(1, 0), makeEntry(2, 0)]
    const result = ostrcAnalysis(h)
    expect(result[0].risk).toBe('none')
  })

  it('score 25 → risk minor (boundary, >0 and ≤25)', () => {
    const h = [makeEntry(1, 25), makeEntry(2, 10)]
    const result = ostrcAnalysis(h)
    expect(result[0].risk).toBe('minor')
  })

  it('score 26 → risk moderate (boundary, >25 and ≤50)', () => {
    const h = [makeEntry(1, 26), makeEntry(2, 10)]
    const result = ostrcAnalysis(h)
    expect(result[0].risk).toBe('moderate')
  })

  it('score 50 → risk moderate (upper boundary of moderate)', () => {
    const h = [makeEntry(1, 50), makeEntry(2, 10)]
    const result = ostrcAnalysis(h)
    expect(result[0].risk).toBe('moderate')
  })

  it('score 51 → risk substantial (>50)', () => {
    const h = [makeEntry(1, 51), makeEntry(2, 10)]
    const result = ostrcAnalysis(h)
    expect(result[0].risk).toBe('substantial')
  })

  it('score 100 → risk substantial', () => {
    const h = [makeEntry(1, 100), makeEntry(2, 0)]
    const result = ostrcAnalysis(h)
    expect(result[0].risk).toBe('substantial')
  })

  it('sorts oldest to newest and maps score/risk correctly', () => {
    const h = [makeEntry(3, 60), makeEntry(1, 0), makeEntry(2, 30)]
    const result = ostrcAnalysis(h)
    expect(result).toHaveLength(3)
    expect(result[0].date).toBe('2026-01-01')
    expect(result[0].risk).toBe('none')
    expect(result[1].risk).toBe('moderate')
    expect(result[2].risk).toBe('substantial')
  })

  it('respects limit parameter, keeping most recent entries', () => {
    const h = Array.from({ length: 10 }, (_, i) => makeEntry(i + 1, i * 10))
    const result = ostrcAnalysis(h, 4)
    expect(result).toHaveLength(4)
    // last 4 of 10 entries (indices 6–9 → totals 60,70,80,90)
    expect(result[0].score).toBe(60)
    expect(result[3].score).toBe(90)
  })
})

// ─── ostrcTrend: boundary conditions ─────────────────────────────────────────
describe('ostrcTrend — classification', () => {
  it('returns null for fewer than 4 entries', () => {
    expect(ostrcTrend([])).toBeNull()
    expect(ostrcTrend([{ score: 10 }, { score: 20 }, { score: 30 }])).toBeNull()
  })

  it('returns null for non-array', () => {
    expect(ostrcTrend(null)).toBeNull()
  })

  it('detects worsening when second half mean > first half mean + 5', () => {
    // first half avg = 5, second half avg = 60 → diff = 55 > 5
    const analysis = [
      { score: 0 }, { score: 10 },
      { score: 50 }, { score: 70 },
    ]
    expect(ostrcTrend(analysis)).toBe('worsening')
  })

  it('detects improving when second half mean < first half mean - 5', () => {
    // first half avg = 60, second half avg = 5 → diff = -55 < -5
    const analysis = [
      { score: 50 }, { score: 70 },
      { score: 0  }, { score: 10 },
    ]
    expect(ostrcTrend(analysis)).toBe('improving')
  })

  it('detects stable when halves differ by ≤5', () => {
    // first half avg = 20, second half avg = 24 → diff = 4 ≤ 5
    const analysis = [
      { score: 20 }, { score: 20 },
      { score: 22 }, { score: 26 },
    ]
    expect(ostrcTrend(analysis)).toBe('stable')
  })
})

// ─── computeOSTRCSummary: full pipeline ───────────────────────────────────────
describe('computeOSTRCSummary — shape and null behaviour', () => {
  it('returns null for empty history', () => {
    expect(computeOSTRCSummary([])).toBeNull()
  })

  it('returns null for single entry', () => {
    expect(computeOSTRCSummary([makeEntry(1, 10)])).toBeNull()
  })

  it('returns correct shape for 2+ entries', () => {
    const h = [makeEntry(1, 0), makeEntry(2, 30)]
    const result = computeOSTRCSummary(h)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('latest')
    expect(result).toHaveProperty('trend')
    expect(result).toHaveProperty('analysis')
    expect(result).toHaveProperty('citation', OSTRC_CITATION)
  })

  it('latest is the most recent entry', () => {
    const h = [makeEntry(1, 0), makeEntry(2, 60)]
    const result = computeOSTRCSummary(h)
    expect(result.latest.score).toBe(60)
    expect(result.latest.risk).toBe('substantial')
  })

  it('trend is null for fewer than 4 entries', () => {
    const h = [makeEntry(1, 10), makeEntry(2, 20)]
    const result = computeOSTRCSummary(h)
    expect(result.trend).toBeNull()
  })

  it('full pipeline: 8-entry worsening scenario', () => {
    const h = [
      makeEntry(1, 0),  makeEntry(2, 5),  makeEntry(3, 5),  makeEntry(4, 10),
      makeEntry(5, 40), makeEntry(6, 50), makeEntry(7, 60), makeEntry(8, 70),
    ]
    const result = computeOSTRCSummary(h)
    expect(result.analysis).toHaveLength(8)
    expect(result.trend).toBe('worsening')
    expect(result.latest.score).toBe(70)
    expect(result.latest.risk).toBe('substantial')
  })
})
