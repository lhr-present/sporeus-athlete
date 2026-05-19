// ─── weeklyVolumeRecord.test.js — pure-fn tests ──────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  analyzeWeeklyVolumeRecord,
  WEEKLY_VOLUME_RECORD_CITATION,
} from '../../athlete/weeklyVolumeRecord.js'

// ─── Anchors ────────────────────────────────────────────────────────────────
// Today = Wednesday 2026-04-29 → current-week Monday = 2026-04-27.
// We anchor lifetime weeks BEFORE this current week.
const TODAY = '2026-04-29'
const CURRENT_WEEK_MONDAY = '2026-04-27'

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Generate `n` completed weeks (Mondays) preceding the current week,
 * each with the given weekly TSS spread across exactly one session
 * on the Monday of that week. Weeks returned oldest-first.
 */
function makeWeeklyLog(weeklyTssArray, opts = {}) {
  const {
    firstMonday = addDays(CURRENT_WEEK_MONDAY, -7 * weeklyTssArray.length),
  } = opts
  const log = []
  for (let i = 0; i < weeklyTssArray.length; i++) {
    const tss = weeklyTssArray[i]
    if (tss <= 0) continue
    log.push({
      date: addDays(firstMonday, i * 7),
      tss,
      type: 'run',
    })
  }
  return log
}

// ─── 1. Null cases ──────────────────────────────────────────────────────────
describe('analyzeWeeklyVolumeRecord — null cases', () => {
  it('returns null for empty log', () => {
    expect(analyzeWeeklyVolumeRecord({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null for non-array log', () => {
    expect(analyzeWeeklyVolumeRecord({ log: null, today: TODAY })).toBeNull()
    expect(analyzeWeeklyVolumeRecord({ log: undefined, today: TODAY })).toBeNull()
  })

  it('returns null when fewer than 8 completed weeks in lifetime', () => {
    // 7 historical weeks → below threshold
    const log = makeWeeklyLog([200, 220, 250, 230, 210, 240, 260])
    expect(analyzeWeeklyVolumeRecord({ log, today: TODAY })).toBeNull()
  })

  it('returns null when current-week sessions are the ONLY data', () => {
    // Session in the current week only — no lifetime distribution.
    const log = [{ date: TODAY, tss: 100, type: 'run' }]
    expect(analyzeWeeklyVolumeRecord({ log, today: TODAY })).toBeNull()
  })
})

// ─── 2. Current-week exclusion from lifetime distribution ────────────────────
describe('analyzeWeeklyVolumeRecord — current week excluded from distribution', () => {
  it('peakWeekTss IGNORES current-week TSS even if it is the biggest', () => {
    // 8 historical weeks at 100..170; current week pumped to 500.
    const log = [
      ...makeWeeklyLog([100, 110, 120, 130, 140, 150, 160, 170]),
      // Current week (Mon=2026-04-27): a giant session today
      { date: TODAY, tss: 500, type: 'run' },
    ]
    const r = analyzeWeeklyVolumeRecord({ log, today: TODAY })
    expect(r).not.toBeNull()
    // Peak should be from history (170), NOT current (500)
    expect(r.peakWeekTss).toBe(170)
    expect(r.currentWeekTss).toBe(500)
    expect(r.totalCompletedWeeks).toBe(8)
  })

  it('rank/percentile use lifetime distribution that excludes current week', () => {
    // 8 historical weeks all = 100. Current = 200. Lifetime size is 8.
    const log = [
      ...makeWeeklyLog(Array(8).fill(100)),
      { date: TODAY, tss: 200, type: 'run' },
    ]
    const r = analyzeWeeklyVolumeRecord({ log, today: TODAY })
    expect(r.totalCompletedWeeks).toBe(8)
    // 200 > 100 → NEW_RECORD, rank 1
    expect(r.band).toBe('NEW_RECORD')
    expect(r.currentRank).toBe(1)
  })
})

// ─── 3. Rank & percentile math ──────────────────────────────────────────────
describe('analyzeWeeklyVolumeRecord — rank & percentile math', () => {
  it('exact rank using "strictly greater" convention', () => {
    // History: 100,200,300,400,500,600,700,800,900,1000 (10 weeks)
    // Current = 550 → 5 weeks strictly greater (600,700,800,900,1000) → rank 6
    // Less count = 5 (100,200,300,400,500) → percentile = round(5/10*100)=50
    const log = [
      ...makeWeeklyLog([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]),
      { date: TODAY, tss: 550, type: 'run' },
    ]
    const r = analyzeWeeklyVolumeRecord({ log, today: TODAY })
    expect(r.currentRank).toBe(6)
    expect(r.currentPercentile).toBe(50)
    expect(r.band).toBe('TYPICAL')
  })

  it('ties: matching value shares the lower rank', () => {
    // History: 100,200,300,300,300,400,500,600 (8 weeks). Current = 300.
    // strictlyGreater: 400,500,600 → 3 → rank 4
    // less = 100, 200 → 2 → percentile = round(2/8*100) = 25
    const log = [
      ...makeWeeklyLog([100, 200, 300, 300, 300, 400, 500, 600]),
      { date: TODAY, tss: 300, type: 'run' },
    ]
    const r = analyzeWeeklyVolumeRecord({ log, today: TODAY })
    expect(r.currentRank).toBe(4)
    expect(r.currentPercentile).toBe(25)
  })

  it('peakWeekStart points to the Monday of the historical peak week', () => {
    // 8 weeks ascending 100..170, oldest first. Peak = last hist week.
    const firstMonday = addDays(CURRENT_WEEK_MONDAY, -7 * 8)
    const log = makeWeeklyLog([100, 110, 120, 130, 140, 150, 160, 170], { firstMonday })
    const r = analyzeWeeklyVolumeRecord({
      log: [...log, { date: TODAY, tss: 50, type: 'run' }],
      today: TODAY,
    })
    expect(r.peakWeekTss).toBe(170)
    // Peak week's Monday = firstMonday + 7*7
    expect(r.peakWeekStart).toBe(addDays(firstMonday, 7 * 7))
  })
})

// ─── 4. Band classification — all 5 bands ───────────────────────────────────
describe('analyzeWeeklyVolumeRecord — band classification', () => {
  it('NEW_RECORD when current > historical peak', () => {
    const log = [
      ...makeWeeklyLog([100, 110, 120, 130, 140, 150, 160, 170]),
      { date: TODAY, tss: 999, type: 'run' },
    ]
    const r = analyzeWeeklyVolumeRecord({ log, today: TODAY })
    expect(r.band).toBe('NEW_RECORD')
    expect(r.currentRank).toBe(1)
  })

  it('TOP_5 when rank in 2..5 (not a new record)', () => {
    // 10 historical weeks: 100..1000. Current = 950 → strictlyGreater=1
    // → rank 2 → TOP_5.
    const log = [
      ...makeWeeklyLog([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]),
      { date: TODAY, tss: 950, type: 'run' },
    ]
    const r = analyzeWeeklyVolumeRecord({ log, today: TODAY })
    expect(r.band).toBe('TOP_5')
    expect(r.currentRank).toBe(2)
  })

  it('TOP_20_PERCENT when percentile ≥ 80 but not in top 5', () => {
    // 20 weeks, 100..2000 step 100. Current must rank > 5 but be ≥ 80th pct.
    // Use 1550 → strictlyGreater = (1600..2000) = 5 → rank 6
    // less = 100..1500 = 15 → percentile = round(15/20*100) = 75. Hmm, want >=80.
    // Switch to 1650 → strictlyGreater = (1700,1800,1900,2000)=4 → rank 5 (TOP_5, not desired)
    // Better: 30 historical weeks, current somewhere that gives rank > 5 AND pct >= 80
    // 30 weeks 100..3000. Current 2550 → strictlyGreater = (2600..3000)=5 → rank 6
    // less = 100..2500 = 25 → percentile = round(25/30*100) = 83.
    const weekly = []
    for (let i = 1; i <= 30; i++) weekly.push(i * 100)
    const log = [
      ...makeWeeklyLog(weekly),
      { date: TODAY, tss: 2550, type: 'run' },
    ]
    const r = analyzeWeeklyVolumeRecord({ log, today: TODAY })
    expect(r.currentRank).toBe(6)
    expect(r.currentPercentile).toBeGreaterThanOrEqual(80)
    expect(r.band).toBe('TOP_20_PERCENT')
  })

  it('TYPICAL when percentile is 20..80', () => {
    // 20 weeks 100..2000. Current = 1050 → strictlyGreater=(1100..2000)=10 → rank 11
    // less = (100..1000) = 10 → percentile = round(10/20*100) = 50. → TYPICAL.
    const weekly = []
    for (let i = 1; i <= 20; i++) weekly.push(i * 100)
    const log = [
      ...makeWeeklyLog(weekly),
      { date: TODAY, tss: 1050, type: 'run' },
    ]
    const r = analyzeWeeklyVolumeRecord({ log, today: TODAY })
    expect(r.band).toBe('TYPICAL')
    expect(r.currentPercentile).toBeGreaterThanOrEqual(20)
    expect(r.currentPercentile).toBeLessThan(80)
  })

  it('LOW when percentile < 20', () => {
    // 20 weeks 100..2000. Current = 150 → less = (100) = 1
    // → percentile = round(1/20*100) = 5 → LOW.
    const weekly = []
    for (let i = 1; i <= 20; i++) weekly.push(i * 100)
    const log = [
      ...makeWeeklyLog(weekly),
      { date: TODAY, tss: 150, type: 'run' },
    ]
    const r = analyzeWeeklyVolumeRecord({ log, today: TODAY })
    expect(r.band).toBe('LOW')
    expect(r.currentPercentile).toBeLessThan(20)
  })
})

// ─── 5. Misc plumbing ───────────────────────────────────────────────────────
describe('analyzeWeeklyVolumeRecord — plumbing', () => {
  it('returns the citation string', () => {
    const log = [
      ...makeWeeklyLog([100, 110, 120, 130, 140, 150, 160, 170]),
      { date: TODAY, tss: 100, type: 'run' },
    ]
    const r = analyzeWeeklyVolumeRecord({ log, today: TODAY })
    expect(r.citation).toBe(WEEKLY_VOLUME_RECORD_CITATION)
    expect(r.citation).toMatch(/Hellard 2019/)
    expect(r.citation).toMatch(/Issurin 2010/)
  })

  it('handles current-week TSS of zero (no sessions logged yet)', () => {
    // 8 weeks of history, no sessions in current week at all.
    const log = makeWeeklyLog([200, 220, 250, 230, 210, 240, 260, 280])
    const r = analyzeWeeklyVolumeRecord({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.currentWeekTss).toBe(0)
    expect(r.band).toBe('LOW')
  })

  it('Mon-Sun week grouping: a Sunday session counts in that ISO week', () => {
    // 8 historical weeks at 100 each. Add a session on Sunday of last
    // completed week (= 2026-04-26) at 50. That week's TSS should be 150.
    const lastCompletedMon = addDays(CURRENT_WEEK_MONDAY, -7)
    const log = [
      ...makeWeeklyLog([100, 100, 100, 100, 100, 100, 100, 100]),
      { date: addDays(lastCompletedMon, 6), tss: 50, type: 'run' }, // Sunday
    ]
    const r = analyzeWeeklyVolumeRecord({ log, today: TODAY })
    // That Sunday session pushes the last hist week to 150 → new peak.
    expect(r.peakWeekTss).toBe(150)
    expect(r.peakWeekStart).toBe(lastCompletedMon)
  })

  it('aggregates multiple sessions within the same week', () => {
    // 7 weeks at 100, plus 2 sessions in the 8th historical week summing to 300.
    const firstMon = addDays(CURRENT_WEEK_MONDAY, -7 * 8)
    const log = [
      ...makeWeeklyLog([100, 100, 100, 100, 100, 100, 100], { firstMonday: firstMon }),
      // 8th historical week
      { date: addDays(firstMon, 7 * 7 + 0), tss: 150, type: 'run' },
      { date: addDays(firstMon, 7 * 7 + 3), tss: 150, type: 'run' },
      { date: TODAY, tss: 50, type: 'run' },
    ]
    const r = analyzeWeeklyVolumeRecord({ log, today: TODAY })
    expect(r.totalCompletedWeeks).toBe(8)
    expect(r.peakWeekTss).toBe(300)
  })

  it('ignores future-dated entries', () => {
    // 8 weeks of history; a "session" dated past today shouldn't poison
    // either the lifetime distribution or the current week.
    const log = [
      ...makeWeeklyLog([100, 110, 120, 130, 140, 150, 160, 170]),
      { date: addDays(TODAY, 30), tss: 9999, type: 'run' },
    ]
    const r = analyzeWeeklyVolumeRecord({ log, today: TODAY })
    expect(r.peakWeekTss).toBe(170)
    expect(r.currentWeekTss).toBe(0)
  })

  it('ignores non-numeric/zero/negative TSS entries', () => {
    const log = [
      ...makeWeeklyLog([100, 110, 120, 130, 140, 150, 160, 170]),
      { date: TODAY, tss: 0, type: 'run' },
      { date: TODAY, tss: -50, type: 'run' },
      { date: TODAY, tss: 'NaN', type: 'run' },
      { date: TODAY, tss: 75, type: 'run' },
    ]
    const r = analyzeWeeklyVolumeRecord({ log, today: TODAY })
    expect(r.currentWeekTss).toBe(75)
  })

  it('ignores entries with malformed dates', () => {
    const log = [
      ...makeWeeklyLog([100, 110, 120, 130, 140, 150, 160, 170]),
      { date: 'not-a-date', tss: 9999, type: 'run' },
      { date: '2026-13-99', tss: 9999, type: 'run' },
    ]
    const r = analyzeWeeklyVolumeRecord({ log, today: TODAY })
    expect(r.peakWeekTss).toBe(170)
  })
})
