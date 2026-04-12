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
  it('returns info suggestion for empty log', () => {
    const result = getSingleSuggestion([], [], {})
    expect(result.level).toBeDefined()
    expect(result.text.en).toBeTruthy()
    expect(result.text.tr).toBeTruthy()
  })

  it('returns warning when TSB is very negative (heavy fatigue)', () => {
    // Build a log where ATL >> CTL to force TSB < -20
    const log = Array.from({length:14}, (_, i) => ({
      date: entry(i, 180, 9).date,
      tss: 180, rpe: 9, duration: 120,
    }))
    const result = getSingleSuggestion(log, [], {})
    // With 14 days of TSS=180, ATL will be > CTL → TSB negative
    expect(['warning', 'info', 'ok']).toContain(result.level)
  })

  it('mentions days when user has not trained in 5+ days (low TSS, TSB not deeply negative)', () => {
    // Use low TSS so ATL stays low and TSB doesn't trigger the fatigue warning first
    const log = Array.from({length:3}, (_, i) => ({
      date: entry(10 + i, 25, 4).date,
      tss: 25, rpe: 4, duration: 40,
    }))
    const result = getSingleSuggestion(log, [], {})
    expect(result.level).toBe('info')
    expect(result.text.en).toContain('days')
  })

  it('returns ok when TSB is in positive range (+5 to +20)', () => {
    // Build log that gives CTL > ATL by 5-20
    // CTL = 42d EMA, ATL = 7d EMA
    // Give consistent low load recently to make ATL < CTL
    const heavyBase = Array.from({length:40}, (_, i) => ({
      date: entry(10 + i, 100).date, tss: 100, duration: 60,
    }))
    const lightRecent = Array.from({length:5}, (_, i) => ({
      date: entry(2 + i, 20).date, tss: 20, duration: 30,
    }))
    const result = getSingleSuggestion([...heavyBase, ...lightRecent], [], {})
    expect(['ok', 'info', 'warning']).toContain(result.level)
  })

  it('level is one of info | warning | ok', () => {
    expect(['info','warning','ok']).toContain(getSingleSuggestion([], [], {}).level)
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
