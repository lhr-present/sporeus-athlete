// src/lib/__tests__/science/polarizationCompliance.test.js
// E16 — Week-by-Week Polarization Compliance tests
import { describe, it, expect } from 'vitest'
import {
  weekStart,
  weeklyPolarizationScore,
  polarizationTrend,
  overallPolarizationCompliance,
  SEILER_TARGET,
} from '../../science/polarizationCompliance.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a log entry with explicit zone minutes */
function zoneEntry(date, z1 = 0, z2 = 0, z3 = 0, z4 = 0, z5 = 0) {
  return { date, zones: { Z1: z1, Z2: z2, Z3: z3, Z4: z4, Z5: z5 } }
}

/** Build a log entry with RPE + duration (minutes by default) */
function rpeEntry(date, rpe, durationMin) {
  return { date, rpe, duration: durationMin }
}

// Monday of a known week for tests
const MON = '2024-01-08'  // a confirmed Monday

// ── weekStart ─────────────────────────────────────────────────────────────────

describe('weekStart', () => {
  it('Monday returns itself', () => {
    expect(weekStart('2024-01-08')).toBe('2024-01-08')
  })

  it('Sunday maps to previous Monday', () => {
    expect(weekStart('2024-01-14')).toBe('2024-01-08')
  })

  it('Wednesday maps to correct Monday', () => {
    expect(weekStart('2024-01-10')).toBe('2024-01-08')
  })
})

// ── weeklyPolarizationScore ───────────────────────────────────────────────────

describe('weeklyPolarizationScore — perfect 80/20 split', () => {
  // 80 min easy (Z1+Z2) + 20 min hard (Z4+Z5) = 100 min total
  const log = [
    zoneEntry(MON, 40, 40, 0, 10, 10),
  ]

  it('complianceScore is 100 for exact 80/20', () => {
    const result = weeklyPolarizationScore(log, MON)
    expect(result.complianceScore).toBe(100)
  })

  it('model is polarized', () => {
    const result = weeklyPolarizationScore(log, MON)
    expect(result.model).toBe('polarized')
  })

  it('citation is always present', () => {
    const result = weeklyPolarizationScore(log, MON)
    expect(result.citation).toBeTruthy()
    expect(typeof result.citation).toBe('string')
    expect(result.citation.length).toBeGreaterThan(10)
  })
})

describe('weeklyPolarizationScore — all easy (100/0/0)', () => {
  // 100 min all easy → easyPct=100, hardPct=0
  // easyDev = |100-80|/80 = 0.25,  hardDev = |0-20|/20 = 1.0
  // raw = 1 - (0.25*0.6 + 1.0*0.4) = 1 - (0.15+0.40) = 0.45 → score=45
  const log = [zoneEntry(MON, 60, 40, 0, 0, 0)]

  it('complianceScore < 50 (hard deviation penalizes)', () => {
    const result = weeklyPolarizationScore(log, MON)
    expect(result.complianceScore).toBeLessThan(50)
  })
})

describe('weeklyPolarizationScore — all hard (0/0/100)', () => {
  // 100 min all Z4/Z5 → easyPct=0, hardPct=100
  // easyDev=1.0, hardDev=4.0 — capped at 0
  // raw = 1 - (1.0*0.6 + 4.0*0.4) = 1 - (0.6+1.6) = -1.2 → max(0,…) = 0
  const log = [zoneEntry(MON, 0, 0, 0, 60, 40)]

  it('complianceScore is 0', () => {
    const result = weeklyPolarizationScore(log, MON)
    expect(result.complianceScore).toBe(0)
  })
})

describe('weeklyPolarizationScore — near-polarized split (easyPct≥75, hardPct≥10)', () => {
  // 77 easy + 8 thresh + 15 hard = 100 min
  // easyPct=77, thresholdPct=8, hardPct=15
  // easyDev=|77-80|/80=0.0375, hardDev=|15-20|/20=0.25
  // raw=1-(0.0375*0.6+0.25*0.4)=1-(0.0225+0.1)=0.8775 → score=88
  const log = [zoneEntry(MON, 40, 37, 8, 8, 7)]  // 77 easy, 8 thresh, 15 hard

  it('complianceScore > 85', () => {
    const result = weeklyPolarizationScore(log, MON)
    expect(result.complianceScore).toBeGreaterThan(85)
  })

  it('model is polarized', () => {
    const result = weeklyPolarizationScore(log, MON)
    expect(result.model).toBe('polarized')
  })
})

describe('weeklyPolarizationScore — pyramidal (55/35/10)', () => {
  // easyPct≈55 < 75 so NOT polarized, but easyPct≥60? No: 55 < 60
  // Actually: let's use 65 easy, 25 thresh, 10 hard = 100 min
  // easyPct=65 >= 60, thresholdPct=25 >= 20 → pyramidal
  const log = [zoneEntry(MON, 35, 30, 25, 5, 5)]  // 65 easy, 25 thresh, 10 hard

  it('model is pyramidal', () => {
    const result = weeklyPolarizationScore(log, MON)
    expect(result.model).toBe('pyramidal')
  })
})

describe('weeklyPolarizationScore — threshold model', () => {
  // 20 easy + 50 thresh + 30 hard = 100 min
  // easyPct=20 < 60 (not pyramidal), thresholdPct=50 > 40 → threshold
  const log = [zoneEntry(MON, 10, 10, 50, 20, 10)]

  it('model is threshold when thresholdPct > 40', () => {
    const result = weeklyPolarizationScore(log, MON)
    expect(result.model).toBe('threshold')
  })
})

describe('weeklyPolarizationScore — insufficient_data (totalMin < 60)', () => {
  // Only 30 min total
  const log = [zoneEntry(MON, 15, 10, 0, 5, 0)]

  it('model is insufficient_data', () => {
    const result = weeklyPolarizationScore(log, MON)
    expect(result.model).toBe('insufficient_data')
  })

  it('complianceScore is null', () => {
    const result = weeklyPolarizationScore(log, MON)
    expect(result.complianceScore).toBeNull()
  })
})

// ── RPE fallback ──────────────────────────────────────────────────────────────

describe('weeklyPolarizationScore — RPE fallback', () => {
  it('RPE=4 → 100% easy bucket', () => {
    // 60 min session, RPE=4 → all easy
    const log = [rpeEntry(MON, 4, 60)]
    const result = weeklyPolarizationScore(log, MON)
    expect(result.easyPct).toBe(100)
    expect(result.hardPct).toBe(0)
    expect(result.thresholdPct).toBe(0)
  })

  it('RPE=6 → 100% threshold bucket', () => {
    const log = [rpeEntry(MON, 6, 60)]
    const result = weeklyPolarizationScore(log, MON)
    expect(result.thresholdPct).toBe(100)
    expect(result.easyPct).toBe(0)
    expect(result.hardPct).toBe(0)
  })

  it('RPE=9 → 100% hard bucket', () => {
    const log = [rpeEntry(MON, 9, 60)]
    const result = weeklyPolarizationScore(log, MON)
    expect(result.hardPct).toBe(100)
    expect(result.easyPct).toBe(0)
    expect(result.thresholdPct).toBe(0)
  })

  it('RPE fallback: duration in seconds (> 600) is converted to minutes', () => {
    // 3600 seconds = 60 minutes, RPE=4 → all easy
    const log = [rpeEntry(MON, 4, 3600)]
    const result = weeklyPolarizationScore(log, MON)
    expect(result.totalMin).toBeCloseTo(60, 0)
    expect(result.easyPct).toBe(100)
  })
})

// ── polarizationTrend ─────────────────────────────────────────────────────────

describe('polarizationTrend', () => {
  it('returns array of correct length (8 by default)', () => {
    const trend = polarizationTrend([], 8, '2024-01-15')
    expect(trend).toHaveLength(8)
  })

  it('returns array of correct length when weeks=4', () => {
    const trend = polarizationTrend([], 4, '2024-01-15')
    expect(trend).toHaveLength(4)
  })

  it('oldest week comes first', () => {
    const trend = polarizationTrend([], 8, '2024-01-15')
    for (let i = 1; i < trend.length; i++) {
      expect(trend[i].weekStart >= trend[i - 1].weekStart).toBe(true)
    }
  })

  it('each entry has required keys', () => {
    const trend = polarizationTrend([], 8, '2024-01-15')
    for (const week of trend) {
      expect(week).toHaveProperty('weekStart')
      expect(week).toHaveProperty('easyPct')
      expect(week).toHaveProperty('hardPct')
      expect(week).toHaveProperty('thresholdPct')
      expect(week).toHaveProperty('totalMin')
      expect(week).toHaveProperty('complianceScore')
      expect(week).toHaveProperty('model')
      expect(week).toHaveProperty('citation')
    }
  })
})

// ── overallPolarizationCompliance ─────────────────────────────────────────────

describe('overallPolarizationCompliance', () => {
  it('meanScore is mean of non-null complianceScores', () => {
    // Two weeks with enough data: one perfect 80/20, one all-easy
    const w1Start = '2024-01-01'
    const w2Start = '2024-01-08'
    const log = [
      zoneEntry(w1Start, 40, 40, 0, 10, 10),  // 100 min, perfect 80/20 → score 100
      zoneEntry(w2Start, 60, 40, 0, 0, 0),    // 100 min, all easy → score ~45
    ]
    const result = overallPolarizationCompliance(log, 2, '2024-01-14')
    expect(result.weeksAnalyzed).toBe(2)
    // meanScore must be avg of the two individual scores
    const w1Score = weeklyPolarizationScore(log, w1Start).complianceScore
    const w2Score = weeklyPolarizationScore(log, w2Start).complianceScore
    const expected = Math.round((w1Score + w2Score) / 2)
    expect(result.meanScore).toBe(expected)
  })

  it('meanScore is null when no data exists', () => {
    const result = overallPolarizationCompliance([], 4, '2024-01-15')
    expect(result.meanScore).toBeNull()
    expect(result.weeksAnalyzed).toBe(0)
  })

  it('modelCounts has all expected keys', () => {
    const result = overallPolarizationCompliance([], 4, '2024-01-15')
    expect(result.modelCounts).toHaveProperty('polarized')
    expect(result.modelCounts).toHaveProperty('pyramidal')
    expect(result.modelCounts).toHaveProperty('threshold')
    expect(result.modelCounts).toHaveProperty('unstructured')
    expect(result.modelCounts).toHaveProperty('insufficient_data')
  })

  it('modelCounts sums to the number of weeks requested', () => {
    const result = overallPolarizationCompliance([], 8, '2024-01-15')
    const total = Object.values(result.modelCounts).reduce((s, v) => s + v, 0)
    expect(total).toBe(8)
  })
})

// ── SEILER_TARGET ─────────────────────────────────────────────────────────────

describe('SEILER_TARGET constant', () => {
  it('has easy: 80 and hard: 20', () => {
    expect(SEILER_TARGET.easy).toBe(80)
    expect(SEILER_TARGET.hard).toBe(20)
  })
})
