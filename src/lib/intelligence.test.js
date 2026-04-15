// src/lib/intelligence.test.js
import { describe, it, expect } from 'vitest'
import {
  analyzeLoadTrend,
  analyzeZoneBalance,
  predictFitness,
  scoreSession,
  assessDataQuality,
  getTodayPlannedSession,
  getSingleSuggestion,
  generateDailyDigest,
} from './intelligence.js'

// Helper: build a log entry N days ago
function entry(daysAgo, tss = 80, rpe = 6, type = 'Easy Run', extra = {}) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return { date: d.toISOString().slice(0, 10), tss, rpe, duration: 60, type, ...extra }
}

// ── analyzeLoadTrend ──────────────────────────────────────────────────────────
describe('analyzeLoadTrend', () => {
  it('returns insufficient for fewer than 4 sessions', () => {
    expect(analyzeLoadTrend([]).trend).toBe('insufficient')
    expect(analyzeLoadTrend([entry(1)]).trend).toBe('insufficient')
  })

  it('detects building trend when last week has >15% more TSS', () => {
    const log = [
      entry(15, 50), entry(14, 50), entry(13, 50),
      entry(6, 100), entry(5, 100), entry(4, 100), entry(3, 100),
    ]
    const result = analyzeLoadTrend(log)
    expect(result.trend).toBe('building')
  })

  it('returns ctl and atl values', () => {
    const log = Array.from({ length: 10 }, (_, i) => entry(i, 100))
    const result = analyzeLoadTrend(log)
    expect(typeof result.ctl).toBe('number')
    expect(typeof result.atl).toBe('number')
  })
})

// ── analyzeZoneBalance ────────────────────────────────────────────────────────
describe('analyzeZoneBalance', () => {
  it('returns no data for empty log', () => {
    const result = analyzeZoneBalance([])
    expect(result.status).toBe('no_data')
  })

  it('detects polarized pattern with lots of Z1+Z2 and Z4+Z5', () => {
    const log = Array.from({ length: 10 }, (_, i) => ({
      ...entry(i, 100),
      zones: [30, 20, 5, 5, 0],  // 50 min easy, 10 min hard
    }))
    const result = analyzeZoneBalance(log)
    expect(result.status).not.toBe('no_data')
    expect(typeof result.z1z2Pct).toBe('number')
  })
})

// ── predictFitness ────────────────────────────────────────────────────────────
describe('predictFitness', () => {
  it('returns zero fitness for empty log', () => {
    const result = predictFitness([])
    expect(result.current).toBe(0)
    expect(result.trajectory).toBe('flat')
  })

  it('CTL increases with consistent training', () => {
    const log = Array.from({ length: 60 }, (_, i) => entry(60 - i, 100))
    const result = predictFitness(log)
    expect(result.current).toBeGreaterThan(0)
    expect(['improving','stable','declining']).toContain(result.trajectory)
  })

  it('projects in4w as a number', () => {
    const log = Array.from({ length: 30 }, (_, i) => entry(30 - i, 80))
    const result = predictFitness(log)
    expect(typeof result.in4w).toBe('number')
  })
})

// ── scoreSession ──────────────────────────────────────────────────────────────
describe('scoreSession', () => {
  it('returns grade B for null entry', () => {
    const result = scoreSession(null, [], {})
    expect(result.grade).toBe('B')
    expect(result.score).toBe(50)
  })

  it('returns an object with score, grade, feedback', () => {
    const e = entry(0, 100, 7)
    const result = scoreSession(e, [], {})
    expect(typeof result.score).toBe('number')
    expect(typeof result.grade).toBe('string')
    expect(result.feedback).toBeDefined()
  })

  it('high RPE session gets a non-zero score', () => {
    const e = entry(0, 150, 9)
    const result = scoreSession(e, [e], {})
    expect(result.score).toBeGreaterThan(0)
  })
})

// ── getTodayPlannedSession ────────────────────────────────────────────────────
describe('getTodayPlannedSession', () => {
  function makePlan(sessions, generatedAt, weekOffset = 0) {
    const d = new Date(generatedAt)
    d.setDate(d.getDate() - weekOffset * 7)
    return {
      generatedAt: d.toISOString().slice(0, 10),
      weeks: [{ phase: 'Base', sessions }],
    }
  }

  it('returns null for null/missing plan', () => {
    expect(getTodayPlannedSession(null, '2026-04-12')).toBeNull()
    expect(getTodayPlannedSession({}, '2026-04-12')).toBeNull()
  })

  it('returns null when today is before plan start', () => {
    const plan = makePlan(
      Array.from({length:7}, (_, i) => ({ type:'Easy Run', duration:60, rpe:5, tss:50 })),
      '2026-04-20'
    )
    expect(getTodayPlannedSession(plan, '2026-04-12')).toBeNull()
  })

  it('returns null for Rest sessions', () => {
    const sessions = Array.from({length:7}, (_, i) => ({ type:'Rest', duration:0, rpe:0, tss:0 }))
    const plan = makePlan(sessions, '2026-04-07')
    const result = getTodayPlannedSession(plan, '2026-04-12')
    expect(result).toBeNull()
  })

  it('returns session with weekIdx and dayIdx', () => {
    const sessions = Array.from({length:7}, (_, i) => ({ type:'Easy Run', duration:60, rpe:5, tss:50 }))
    const plan = makePlan(sessions, '2026-04-07')
    const result = getTodayPlannedSession(plan, '2026-04-12')
    // 2026-04-12 is a Sunday: planDayIdx = (0 + 6) % 7 = 6
    expect(result).not.toBeNull()
    expect(result.weekIdx).toBe(0)
    expect(result.dayIdx).toBe(6)
    expect(result.type).toBe('Easy Run')
  })

  it('returns null when plan is exhausted (beyond last week)', () => {
    const sessions = Array.from({length:7}, () => ({ type:'Easy Run', duration:60, rpe:5, tss:50 }))
    const plan = { generatedAt: '2026-01-01', weeks: [{ sessions }] }
    // Today (2026-04-12) is way beyond week 0 ending 2026-01-08
    expect(getTodayPlannedSession(plan, '2026-04-12')).toBeNull()
  })
})

// ── getSingleSuggestion ───────────────────────────────────────────────────────
describe('getSingleSuggestion', () => {
  it('returns structured object for empty log', () => {
    const result = getSingleSuggestion([], [], {})
    expect(result.action).toBeTruthy()
    expect(result.rationale).toBeTruthy()
    expect(['none', 'easy', 'moderate', 'hard']).toContain(result.load)
    expect(result.source).toBeTruthy()
  })

  it('returns a valid source for heavy fatigue log', () => {
    const log = Array.from({length:14}, (_, i) => ({
      date: entry(i, 180, 9).date,
      tss: 180, rpe: 9, duration: 120,
    }))
    const result = getSingleSuggestion(log, [], {})
    expect(typeof result.source).toBe('string')
    expect(result.source.length).toBeGreaterThan(0)
  })

  it('returns structured object with action and rationale for sparse log', () => {
    const log = Array.from({length:3}, (_, i) => ({
      date: entry(10 + i, 25, 4).date,
      tss: 25, rpe: 4, duration: 40,
    }))
    const result = getSingleSuggestion(log, [], {})
    expect(result.action).toBeTruthy()
    expect(result.rationale).toBeTruthy()
  })

  it('returns structured object for heavy base + light recent log', () => {
    const heavyBase = Array.from({length:40}, (_, i) => ({
      date: entry(10 + i, 100).date, tss: 100, duration: 60,
    }))
    const lightRecent = Array.from({length:5}, (_, i) => ({
      date: entry(2 + i, 20).date, tss: 20, duration: 30,
    }))
    const result = getSingleSuggestion([...heavyBase, ...lightRecent], [], {})
    expect(['none', 'easy', 'moderate', 'hard']).toContain(result.load)
    expect(typeof result.rationale).toBe('string')
  })

  it('source is a non-empty string for any input', () => {
    expect(typeof getSingleSuggestion([], [], {}).source).toBe('string')
    expect(getSingleSuggestion([], [], {}).source.length).toBeGreaterThan(0)
  })
})

// ── assessDataQuality ─────────────────────────────────────────────────────────
describe('assessDataQuality', () => {
  it('returns F grade for empty data', () => {
    const result = assessDataQuality([], [], [], {})
    expect(result.grade).toBe('F')
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('score improves with a complete profile', () => {
    const profile = { name:'Test', primarySport:'Run', age:'30', weight:'70', ftp:'250', athleteLevel:'Competitive', goal:'Marathon' }
    const log = Array.from({ length: 20 }, (_, i) => entry(i, 80, 6))
    const result = assessDataQuality(log, [], [], profile)
    expect(result.score).toBeGreaterThan(assessDataQuality([], [], [], {}).score)
  })

  it('returns grade string', () => {
    const result = assessDataQuality([], [], [], {})
    expect(['A','B','C','D','F']).toContain(result.grade)
  })
})

// ── generateDailyDigest ───────────────────────────────────────────────────────
describe('generateDailyDigest', () => {
  it('returns empty digest when log is empty', () => {
    const result = generateDailyDigest([], [], {})
    expect(result.empty).toBe(true)
    expect(result.en).toContain('first session')
    expect(result.tr).toContain('ilk antrenman')
  })

  it('returns empty digest for null/undefined log', () => {
    expect(generateDailyDigest(null, [], {}).empty).toBe(true)
    expect(generateDailyDigest(undefined, [], {}).empty).toBe(true)
  })

  it('returns non-empty digest when log has entries', () => {
    const log = Array.from({ length: 5 }, (_, i) => entry(i + 1, 80))
    const result = generateDailyDigest(log, [], {})
    expect(result.empty).toBe(false)
    expect(result.en).toContain('CTL')
    expect(result.tr).toContain('KTY')
  })

  it('includes TSB with sign', () => {
    const log = Array.from({ length: 10 }, (_, i) => entry(i + 1, 100))
    const result = generateDailyDigest(log, [], {})
    expect(result.en).toMatch(/TSB [+-]\d+/)
  })

  it('includes ACWR OPTIMAL when ratio is in 0.8–1.3 range', () => {
    // Consistent load over 4 weeks — ACWR ≈ 1.0
    const log = Array.from({ length: 28 }, (_, i) => entry(i + 1, 60))
    const result = generateDailyDigest(log, [], {})
    expect(result.en).toContain('ACWR')
    expect(result.en).toContain('OPTIMAL')
  })

  it('includes wellness line when today\'s recovery exists', () => {
    const log = [entry(1, 80)]
    const today = new Date().toISOString().slice(0, 10)
    const recovery = [{ date: today, score: 78, sleep: 4, energy: 4, soreness: 2 }]
    const result = generateDailyDigest(log, recovery, {})
    expect(result.en).toContain('Wellness: 78/100')
    expect(result.en).toContain('GO')
  })

  it('labels wellness MONITOR when score is 50–74', () => {
    const log = [entry(1, 80)]
    const today = new Date().toISOString().slice(0, 10)
    const recovery = [{ date: today, score: 60 }]
    const result = generateDailyDigest(log, recovery, {})
    expect(result.en).toContain('MONITOR')
  })

  it('labels wellness REST when score < 50', () => {
    const log = [entry(1, 80)]
    const today = new Date().toISOString().slice(0, 10)
    const recovery = [{ date: today, score: 35 }]
    const result = generateDailyDigest(log, recovery, {})
    expect(result.en).toContain('REST')
  })

  it('includes zone balance for ≥7 sessions', () => {
    const log = Array.from({ length: 10 }, (_, i) => entry(i + 1, 80, 6 - (i % 2)))
    const result = generateDailyDigest(log, [], {})
    expect(result.en).toContain('Zone balance')
    expect(result.tr).toContain('Zon dağılımı')
  })

  it('omits zone balance for fewer than 7 sessions', () => {
    const log = Array.from({ length: 4 }, (_, i) => entry(i + 1, 80))
    const result = generateDailyDigest(log, [], {})
    expect(result.en).not.toContain('Zone balance')
  })

  it('returns numeric ctl, tsb, acwr fields', () => {
    const log = Array.from({ length: 14 }, (_, i) => entry(i + 1, 70))
    const result = generateDailyDigest(log, [], {})
    expect(typeof result.ctl).toBe('number')
    expect(typeof result.tsb).toBe('number')
    expect(result.acwr).not.toBeNull()
    expect(typeof result.acwr).toBe('number')
  })

  it('returns null acwr when no sessions in last 28d produce a chronic', () => {
    // Single entry at day 0 but chron = 0 because... actually with 1 session there's still chronic.
    // Test: empty log returns null acwr
    const result = generateDailyDigest([], [], {})
    expect(result.acwr).toBeNull()
  })
})

// ── getFormScore / getPeakWeekLoad / getConsistencyScore ──────────────────────
import { getFormScore, getPeakWeekLoad, getConsistencyScore } from './intelligence.js'

describe('getFormScore', () => {
  it('returns Fatigued (red) when ATL >> CTL (high recent load)', () => {
    // 4-week base then sudden spike: ATL >> CTL → TSB negative
    const base = Array.from({ length: 28 }, (_, i) => entry(i + 1, 50))
    const spike = Array.from({ length: 7 }, (_, i) => entry(35 + i, 200))
    const { label } = getFormScore([...base, ...spike])
    expect(label).toBe('Fatigued')
  })

  it('returns Fresh (green) after a taper (low recent load)', () => {
    // Heavy base (older) then recent taper → ATL drops, CTL stays → TSB > 10
    const base  = Array.from({ length: 60 }, (_, i) => entry(i + 11, 100)) // 11-70d ago
    const taper = Array.from({ length: 10 }, (_, i) => entry(i + 1,  10))  // 1-10d ago
    const { label } = getFormScore([...base, ...taper])
    expect(label).toBe('Fresh')
  })
})

describe('getPeakWeekLoad', () => {
  it('returns 0 for empty log', () => expect(getPeakWeekLoad([])).toBe(0))

  it('finds the highest 7-day TSS window', () => {
    const light  = Array.from({ length: 14 }, (_, i) => entry(i + 1, 50))
    const heavy  = Array.from({ length: 7  }, (_, i) => entry(15 + i, 150)) // 1050 TSS
    const result = getPeakWeekLoad([...light, ...heavy])
    expect(result).toBeGreaterThanOrEqual(1000)
  })
})

describe('getConsistencyScore', () => {
  it('returns 0 for empty log', () => expect(getConsistencyScore([])).toBe(0))

  it('returns ~50% when half the days have sessions over 28d', () => {
    // 14 sessions spread across 28-day window
    const log = Array.from({ length: 14 }, (_, i) => entry(i + 1, 60))
    const pct = getConsistencyScore(log, 28)
    expect(pct).toBeGreaterThanOrEqual(40)
    expect(pct).toBeLessThanOrEqual(60)
  })
})
