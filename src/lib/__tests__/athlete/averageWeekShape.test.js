// ─── averageWeekShape.test.js — pattern + edge-case unit tests ──────────────
import { describe, it, expect } from 'vitest'
import { analyzeAverageWeekShape, AVERAGE_WEEK_SHAPE_CITATION }
  from '../../athlete/averageWeekShape.js'

// ─── Setup ──────────────────────────────────────────────────────────────────
// We anchor today to a Sunday so the trailing 8-week window aligns cleanly.
// 2026-04-26 is a Sunday → window = 2026-03-02 (Mon) through 2026-04-26 (Sun)
const TODAY = '2026-04-27' // Monday → previous completed Sunday = 2026-04-26
const WINDOW_START = '2026-03-02' // Mon, 56 days back inclusive

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Build a log over 8 trailing weeks, applying a TSS-per-weekday pattern.
 * `pattern` is an array of 7 numbers Mon=0..Sun=6 representing TSS each day.
 * Each of the 8 weeks repeats the same pattern.
 */
function makeWeeklyLog(pattern, weeks = 8) {
  const log = []
  // Mon of oldest week = WINDOW_START
  for (let w = 0; w < weeks; w++) {
    const weekStartIdx = w * 7
    for (let d = 0; d < 7; d++) {
      const tss = pattern[d]
      if (tss > 0) {
        log.push({
          date: addDays(WINDOW_START, weekStartIdx + d),
          tss,
          type: 'run',
        })
      }
    }
  }
  return log
}

// ─── 1. Null cases ──────────────────────────────────────────────────────────
describe('analyzeAverageWeekShape — null cases', () => {
  it('returns null for empty log', () => {
    expect(analyzeAverageWeekShape({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null for non-array log', () => {
    expect(analyzeAverageWeekShape({ log: null, today: TODAY })).toBeNull()
    expect(analyzeAverageWeekShape({ log: undefined, today: TODAY })).toBeNull()
  })

  it('returns null when no entries inside the window', () => {
    const log = [
      { date: '2025-01-01', tss: 60, type: 'run' },
      { date: '2025-02-01', tss: 50, type: 'run' },
    ]
    expect(analyzeAverageWeekShape({ log, today: TODAY })).toBeNull()
  })

  it('returns null when fewer than 4 weeks have any sessions', () => {
    // Only 3 weeks active
    const log = []
    for (let w = 0; w < 3; w++) {
      log.push({ date: addDays(WINDOW_START, w * 7), tss: 60, type: 'run' })
    }
    expect(analyzeAverageWeekShape({ log, today: TODAY })).toBeNull()
  })

  it('returns null when total window TSS = 0 (all zero TSS entries)', () => {
    const log = []
    for (let w = 0; w < 8; w++) {
      log.push({ date: addDays(WINDOW_START, w * 7), tss: 0, type: 'rest' })
    }
    expect(analyzeAverageWeekShape({ log, today: TODAY })).toBeNull()
  })

  it('returns null when entries have non-numeric TSS', () => {
    const log = []
    for (let w = 0; w < 8; w++) {
      log.push({ date: addDays(WINDOW_START, w * 7), tss: 'abc', type: 'run' })
    }
    expect(analyzeAverageWeekShape({ log, today: TODAY })).toBeNull()
  })
})

// ─── 2. Return shape ────────────────────────────────────────────────────────
describe('analyzeAverageWeekShape — return shape', () => {
  it('returns full structure with citation', () => {
    const log = makeWeeklyLog([60, 60, 60, 60, 60, 60, 60])
    const r = analyzeAverageWeekShape({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.pattern).toBeDefined()
    expect(r.days).toHaveLength(7)
    expect(r.peakDay).toBeDefined()
    expect(r.restDay).toBeDefined()
    expect(r.mean).toBeGreaterThan(0)
    expect(r.citation).toBe(AVERAGE_WEEK_SHAPE_CITATION)
    expect(r.citation).toMatch(/Bompa 2018/)
    expect(r.citation).toMatch(/Issurin 2010/)
  })

  it('days array is Mon=0..Sun=6 with bilingual labels', () => {
    const log = makeWeeklyLog([60, 60, 60, 60, 60, 60, 60])
    const r = analyzeAverageWeekShape({ log, today: TODAY })
    expect(r.days[0].dayLabelEn).toBe('MON')
    expect(r.days[0].dayLabelTr).toBe('PZT')
    expect(r.days[6].dayLabelEn).toBe('SUN')
    expect(r.days[6].dayLabelTr).toBe('PAZ')
    expect(r.days[2].dayLabelEn).toBe('WED')
    expect(r.days[2].dayLabelTr).toBe('ÇAR')
  })

  it('average per weekday divides by window weeks (8) not active count', () => {
    // 4 weeks with Mon=120, 4 weeks empty → still divides by 8 weeks
    const log = []
    for (let w = 0; w < 4; w++) {
      log.push({ date: addDays(WINDOW_START, w * 7), tss: 120, type: 'run' })
    }
    // Pad active week count to >=4 by adding sessions on other weekdays
    // We already have 4 active weeks (each Mon).
    const r = analyzeAverageWeekShape({ log, today: TODAY })
    expect(r).not.toBeNull()
    // 4 weeks × 120 = 480; divided by 8 weeks = 60
    expect(r.days[0].avgTss).toBe(60)
  })
})

// ─── 3. Pattern classification — 5 patterns ─────────────────────────────────
describe('analyzeAverageWeekShape — WEEKEND_HEAVY', () => {
  it('classifies as WEEKEND_HEAVY when Sat+Sun > 1.5× weekday avg', () => {
    // Mon-Fri = 30 TSS each (avg 30, weekend > 90); Sat=150, Sun=120
    const log = makeWeeklyLog([30, 30, 30, 30, 30, 150, 120])
    const r = analyzeAverageWeekShape({ log, today: TODAY })
    expect(r.pattern).toBe('WEEKEND_HEAVY')
    expect(r.peakDay.dayIndex).toBe(5) // Sat
  })
})

describe('analyzeAverageWeekShape — MIDWEEK_HEAVY', () => {
  it('classifies as MIDWEEK_HEAVY when Wed+Thu > 1.5× Mon+Tue avg', () => {
    // Mon=20, Tue=20 (avg=20); Wed=80, Thu=80 (sum=160 > 30=1.5×20)
    // Keep weekend low so it's not WEEKEND_HEAVY
    const log = makeWeeklyLog([20, 20, 80, 80, 30, 10, 10])
    const r = analyzeAverageWeekShape({ log, today: TODAY })
    expect(r.pattern).toBe('MIDWEEK_HEAVY')
  })
})

describe('analyzeAverageWeekShape — EVENLY_DISTRIBUTED', () => {
  it('classifies as EVENLY_DISTRIBUTED when stdev < 30% of mean', () => {
    // 60/55/65/60/55/60/65 → mean ~60, stdev small
    const log = makeWeeklyLog([60, 55, 65, 60, 55, 60, 65])
    const r = analyzeAverageWeekShape({ log, today: TODAY })
    expect(r.pattern).toBe('EVENLY_DISTRIBUTED')
  })
})

describe('analyzeAverageWeekShape — POLARIZED', () => {
  it('classifies as POLARIZED with 2+ heavy days and 2+ near-rest days', () => {
    // mean = (140+0+140+0+50+0+50)/7 = 54.3
    // 1.5× mean = 81.4; 0.3× mean = 16.3
    // 140 days = 2 (heavy); 0 days = 3 (rest) → POLARIZED
    // Sat+Sun=50 < 1.5× weekday avg (66) → not WEEKEND_HEAVY
    // Wed+Thu=140 vs Mon+Tue avg=70 → 1.5×70 = 105 < 140 → would be MIDWEEK_HEAVY
    // So shift heavy days off Wed/Thu: use Tue + Sat heavy with rest days
    // Mon=0, Tue=140, Wed=0, Thu=50, Fri=0, Sat=140, Sun=50
    // weekday avg (Mon-Fri) = (0+140+0+50+0)/5 = 38; weekend sum = 190 > 57 → WEEKEND_HEAVY!
    // Need to avoid WEEKEND_HEAVY and MIDWEEK_HEAVY.
    // Try: Mon=140, Tue=140, Wed=50, Thu=0, Fri=0, Sat=50, Sun=0
    // mean = 380/7 = 54.3; 1.5× = 81.4 → heavy: Mon, Tue (2 days)
    // 0.3× = 16.3 → low: Thu, Fri, Sun (3 days)
    // weekday avg = 330/5 = 66; weekend sum = 50; 50 < 99 → not WEEKEND_HEAVY ✓
    // monTueAvg=140; midweekSum=Wed+Thu=50; 50 < 1.5×140=210 → not MIDWEEK_HEAVY ✓
    // 2 heavy + 3 rest → POLARIZED ✓
    const log = makeWeeklyLog([140, 140, 50, 0, 0, 50, 0])
    const r = analyzeAverageWeekShape({ log, today: TODAY })
    expect(r.pattern).toBe('POLARIZED')
  })
})

describe('analyzeAverageWeekShape — MIXED', () => {
  it('falls back to MIXED when no other pattern matches', () => {
    // Mon=60, Tue=70, Wed=55, Thu=50, Fri=80, Sat=40, Sun=30
    // mean = 385/7 ≈ 55
    // stdev ≈ 16.6 → 16.6/55 = 30.2% → NOT EVENLY_DISTRIBUTED (just above 30%)
    // weekday avg = 63; weekend = 70 < 94.5 → not WEEKEND_HEAVY
    // monTueAvg=65; Wed+Thu=105 < 1.5×65=97.5? 105 > 97.5 → would be MIDWEEK_HEAVY
    // Need to break MIDWEEK_HEAVY: lower Wed+Thu
    // Try: Mon=70, Tue=80, Wed=55, Thu=40, Fri=75, Sat=50, Sun=45
    // mean = 415/7 ≈ 59.3; stdev ≈ 14.7 → 14.7/59.3 ≈ 24.8% → EVENLY_DISTRIBUTED
    // Need stdev/mean >= 0.30 to skip EVENLY_DISTRIBUTED
    // Try: Mon=40, Tue=80, Wed=50, Thu=70, Fri=90, Sat=60, Sun=30
    // mean = 420/7 = 60; stdev: dev² = 400+400+100+100+900+0+900 = 2800; var=400; sd=20
    // 20/60 = 33.3% → above 30% → not EVENLY
    // weekday avg = (40+80+50+70+90)/5 = 66; weekend sum = 90; 1.5×66 = 99 → 90 < 99 ✓ not WEEKEND
    // monTueAvg=60; Wed+Thu=120; 1.5×60=90 → 120 > 90 → MIDWEEK_HEAVY ✗
    // Try: Mon=80, Tue=80, Wed=50, Thu=50, Fri=90, Sat=40, Sun=20
    // mean = 410/7 ≈ 58.6; sd: devs from 58.6 are 21.4,21.4,8.6,8.6,31.4,18.6,38.6
    // var = (457.96+457.96+73.96+73.96+985.96+345.96+1489.96)/7 = 555.7; sd ≈ 23.6
    // 23.6/58.6 = 40.3% → not EVENLY
    // weekday avg=70; weekend sum=60; 1.5×70=105 → not WEEKEND ✓
    // monTueAvg=80; Wed+Thu=100; 1.5×80=120 → 100 < 120 → not MIDWEEK ✓
    // Polarized check: 1.5×58.6=87.9 → heavy: Fri (90). Only 1. Not POLARIZED ✓
    // → MIXED
    const log = makeWeeklyLog([80, 80, 50, 50, 90, 40, 20])
    const r = analyzeAverageWeekShape({ log, today: TODAY })
    expect(r.pattern).toBe('MIXED')
  })
})

// ─── 4. Peak/rest day ───────────────────────────────────────────────────────
describe('analyzeAverageWeekShape — peak and rest days', () => {
  it('peakDay = highest avg TSS weekday', () => {
    // Saturday=150 is the peak
    const log = makeWeeklyLog([20, 20, 20, 20, 20, 150, 30])
    const r = analyzeAverageWeekShape({ log, today: TODAY })
    expect(r.peakDay.dayIndex).toBe(5)
    expect(r.peakDay.dayLabelEn).toBe('SAT')
    expect(r.peakDay.dayLabelTr).toBe('CMT')
  })

  it('restDay = lowest avg TSS weekday (may be zero)', () => {
    // Mon = 0 → rest day
    const log = makeWeeklyLog([0, 60, 50, 70, 80, 90, 40])
    const r = analyzeAverageWeekShape({ log, today: TODAY })
    expect(r.restDay.dayIndex).toBe(0)
    expect(r.restDay.avgTss).toBe(0)
    expect(r.restDay.dayLabelEn).toBe('MON')
  })

  it('restDay can be a non-zero low day', () => {
    // Sunday = 10 is the lowest
    const log = makeWeeklyLog([60, 50, 70, 80, 90, 100, 10])
    const r = analyzeAverageWeekShape({ log, today: TODAY })
    expect(r.restDay.dayIndex).toBe(6)
    expect(r.restDay.avgTss).toBe(10)
  })
})

// ─── 5. windowWeeks override ────────────────────────────────────────────────
describe('analyzeAverageWeekShape — windowWeeks option', () => {
  it('default windowWeeks=8 works without override', () => {
    const log = makeWeeklyLog([60, 60, 60, 60, 60, 60, 60])
    const r = analyzeAverageWeekShape({ log, today: TODAY })
    expect(r).not.toBeNull()
  })

  it('respects custom windowWeeks (e.g., 4)', () => {
    // Build 4 active weeks at the START of the 8-week window.
    // With windowWeeks=4, the window covers only the last 4 weeks → empty
    const log = []
    for (let w = 0; w < 4; w++) {
      for (let d = 0; d < 7; d++) {
        log.push({ date: addDays(WINDOW_START, w * 7 + d), tss: 60, type: 'run' })
      }
    }
    // windowWeeks=4 looks only at last 4 weeks (weeks 4-7), which are empty
    expect(analyzeAverageWeekShape({ log, today: TODAY, windowWeeks: 4 })).toBeNull()
  })

  it('with windowWeeks=4 and recent-half data, returns valid result', () => {
    // Active in last 4 weeks of 8-week window
    const log = []
    for (let w = 4; w < 8; w++) {
      for (let d = 0; d < 7; d++) {
        log.push({ date: addDays(WINDOW_START, w * 7 + d), tss: 60, type: 'run' })
      }
    }
    const r = analyzeAverageWeekShape({ log, today: TODAY, windowWeeks: 4 })
    expect(r).not.toBeNull()
    expect(r.days[0].avgTss).toBe(60) // 4 weeks × 60 / 4 = 60
  })
})

// ─── 6. Edge: window boundary ───────────────────────────────────────────────
describe('analyzeAverageWeekShape — window boundary', () => {
  it('excludes entries outside the trailing 8-week window', () => {
    const log = makeWeeklyLog([60, 60, 60, 60, 60, 60, 60])
    // Add an outlier far before the window
    log.push({ date: '2020-01-01', tss: 9999, type: 'run' })
    // Add an outlier in the future (after WINDOW_END)
    log.push({ date: '2026-12-31', tss: 9999, type: 'run' })
    const r = analyzeAverageWeekShape({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.days[0].avgTss).toBe(60)
  })

  it('respects activeWeekSet >= 4 across the window', () => {
    // 4 active weeks (spread across window) → just makes the floor
    const log = []
    log.push({ date: addDays(WINDOW_START, 0 * 7), tss: 60, type: 'run' })
    log.push({ date: addDays(WINDOW_START, 2 * 7), tss: 60, type: 'run' })
    log.push({ date: addDays(WINDOW_START, 4 * 7), tss: 60, type: 'run' })
    log.push({ date: addDays(WINDOW_START, 6 * 7), tss: 60, type: 'run' })
    const r = analyzeAverageWeekShape({ log, today: TODAY })
    expect(r).not.toBeNull()
  })
})

// ─── 7. Smoke: weekday index mapping ────────────────────────────────────────
describe('analyzeAverageWeekShape — weekday index mapping', () => {
  it('maps WINDOW_START (Mon) → dayIndex 0', () => {
    // 2026-03-02 is a Monday
    const log = []
    for (let w = 0; w < 8; w++) {
      log.push({ date: addDays(WINDOW_START, w * 7), tss: 100, type: 'run' })
    }
    const r = analyzeAverageWeekShape({ log, today: TODAY })
    expect(r.days[0].avgTss).toBe(100) // 8 mondays × 100 / 8 = 100
    expect(r.days[1].avgTss).toBe(0)
  })

  it('maps WINDOW_END (Sun) → dayIndex 6', () => {
    // 2026-04-26 is a Sunday
    const log = []
    for (let w = 0; w < 8; w++) {
      log.push({ date: addDays(WINDOW_START, w * 7 + 6), tss: 70, type: 'run' })
    }
    const r = analyzeAverageWeekShape({ log, today: TODAY })
    expect(r.days[6].avgTss).toBe(70)
    expect(r.days[5].avgTss).toBe(0)
  })
})
