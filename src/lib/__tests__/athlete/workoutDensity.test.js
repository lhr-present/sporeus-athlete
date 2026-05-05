// ─── workoutDensity.test.js — E121: Workout Density Detector unit tests ─────
import { describe, it, expect } from 'vitest'
import { detectWorkoutDensity } from '../../athlete/workoutDensity.js'

// Reference date: Thursday 2026-04-30
//  → ISO week containing today: Mon 2026-04-27 .. Sun 2026-05-03
//  → Last 4 weeks (oldest → newest):
//      W1 2026-04-06 .. 2026-04-12
//      W2 2026-04-13 .. 2026-04-19
//      W3 2026-04-20 .. 2026-04-26
//      W4 2026-04-27 .. 2026-05-03
const TODAY = '2026-04-30'

// ─── Synthetic log helpers ───────────────────────────────────────────────────
function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Build a hi-intensity entry (Z4-heavy) for a given date.
 */
function hardEntry(date, type = 'run') {
  return { date, type, duration: 60, rpe: 8, zones: [0, 10, 10, 60, 20] }
}

/**
 * Build an easy entry (mostly Z2) for a given date.
 */
function easyEntry(date, type = 'run') {
  return { date, type, duration: 60, rpe: 4, zones: [10, 70, 10, 5, 5] }
}

/**
 * 4 weeks of polarized 80/20: 1 hard day per week (W4) + 5 easy days/week.
 */
function polarizedLog(_today = TODAY) {
  const log = []
  // 28 days ending today (today-27 .. today). Today is Thu 04-30.
  // We anchor entries to actual calendar dates within the 4-week window.
  // Use w1Start = today's Monday - 21 = 2026-04-06.
  const w1Start = '2026-04-06'
  for (let w = 0; w < 4; w++) {
    const weekStart = addDays(w1Start, w * 7)
    // 5 easy days (Mon..Fri) + 1 hard day (Sat) + 1 rest (Sun)
    for (let d = 0; d < 5; d++) {
      log.push(easyEntry(addDays(weekStart, d)))
    }
    log.push(hardEntry(addDays(weekStart, 5)))  // Sat
  }
  return log
}

/**
 * 4 weeks where each week has `hardDays` hi-intensity days (Mon..hardDays-1).
 */
function hardWeeksLog(hardDays, _today = TODAY) {
  const log = []
  const w1Start = '2026-04-06'
  for (let w = 0; w < 4; w++) {
    const weekStart = addDays(w1Start, w * 7)
    for (let d = 0; d < hardDays; d++) {
      log.push(hardEntry(addDays(weekStart, d)))
    }
    // remaining days easy (Z2)
    for (let d = hardDays; d < 7; d++) {
      log.push(easyEntry(addDays(weekStart, d)))
    }
  }
  return log
}

// ─── Tests ──────────────────────────────────────────────────────────────────
describe('detectWorkoutDensity — empty / null inputs', () => {
  it('returns defaults for null log', () => {
    const r = detectWorkoutDensity(null, TODAY)
    expect(r.weeks).toEqual([])
    expect(r.consecutiveFlagged).toBe(0)
    expect(r.risk).toBe('low')
    expect(r.reliable).toBe(false)
  })

  it('returns defaults for empty array log', () => {
    const r = detectWorkoutDensity([], TODAY)
    expect(r.weeks).toEqual([])
    expect(r.consecutiveFlagged).toBe(0)
    expect(r.risk).toBe('low')
    expect(r.reliable).toBe(false)
  })

  it('returns defaults for non-array input', () => {
    const r = detectWorkoutDensity('not-a-log', TODAY)
    expect(r.weeks).toEqual([])
    expect(r.reliable).toBe(false)
  })

  it('always carries the citation string', () => {
    const r = detectWorkoutDensity([], TODAY)
    expect(r.citation).toBe('Gabbett 2016; Hulin 2016')
  })
})

describe('detectWorkoutDensity — reliability flag', () => {
  it('marks reliable=false when fewer than 14 distinct days of data', () => {
    // 10 distinct days of easy training
    const log = []
    for (let i = 0; i < 10; i++) log.push(easyEntry(addDays(TODAY, -i)))
    const r = detectWorkoutDensity(log, TODAY)
    expect(r.reliable).toBe(false)
    // Still computes 4 weeks of buckets
    expect(r.weeks.length).toBe(4)
    expect(r.risk).toBe('low')
  })

  it('marks reliable=true when ≥14 distinct days of data', () => {
    const r = detectWorkoutDensity(polarizedLog(), TODAY)
    expect(r.reliable).toBe(true)
  })
})

describe('detectWorkoutDensity — polarized 80/20 (low risk)', () => {
  it('returns risk=low and 0 flagged weeks for polarized training', () => {
    const r = detectWorkoutDensity(polarizedLog(), TODAY)
    expect(r.risk).toBe('low')
    expect(r.consecutiveFlagged).toBe(0)
    for (const wk of r.weeks) {
      expect(wk.flagged).toBe(false)
      expect(wk.hiDays).toBeLessThan(4)
    }
  })

  it('low-risk message + empty recommendation', () => {
    const r = detectWorkoutDensity(polarizedLog(), TODAY)
    expect(r.message.en).toBe('Workout density healthy.')
    expect(r.message.tr).toBe('Antrenman yoğunluğu sağlıklı.')
    expect(r.recommendation.en).toBe('')
    expect(r.recommendation.tr).toBe('')
  })
})

describe('detectWorkoutDensity — high risk (4 weeks of 5 hard days)', () => {
  it('returns risk=high with 4 flagged weeks', () => {
    const r = detectWorkoutDensity(hardWeeksLog(5), TODAY)
    expect(r.risk).toBe('high')
    expect(r.consecutiveFlagged).toBe(4)
    expect(r.weeks.every(w => w.flagged)).toBe(true)
  })

  it('high-risk message + recommendation present in EN+TR', () => {
    const r = detectWorkoutDensity(hardWeeksLog(5), TODAY)
    expect(r.message.en).toMatch(/injury risk/)
    expect(r.message.tr).toMatch(/yaralanma/)
    expect(r.recommendation.en.length).toBeGreaterThan(0)
    expect(r.recommendation.tr.length).toBeGreaterThan(0)
  })
})

describe('detectWorkoutDensity — moderate risk', () => {
  it('1 flagged week (most recent) → risk=moderate', () => {
    // Easy weeks 1..3, only week 4 has 4 hard days.
    const log = []
    const w1Start = '2026-04-06'
    for (let w = 0; w < 3; w++) {
      const weekStart = addDays(w1Start, w * 7)
      for (let d = 0; d < 7; d++) log.push(easyEntry(addDays(weekStart, d)))
    }
    const w4Start = addDays(w1Start, 21)
    for (let d = 0; d < 4; d++) log.push(hardEntry(addDays(w4Start, d)))
    for (let d = 4; d < 7; d++) log.push(easyEntry(addDays(w4Start, d)))

    const r = detectWorkoutDensity(log, TODAY)
    expect(r.consecutiveFlagged).toBe(1)
    expect(r.risk).toBe('moderate')
    expect(r.weeks[3].flagged).toBe(true)
    expect(r.weeks[2].flagged).toBe(false)
  })

  it('moderate message recommends adding a recovery day', () => {
    const log = []
    const w1Start = '2026-04-06'
    for (let w = 0; w < 3; w++) {
      const weekStart = addDays(w1Start, w * 7)
      for (let d = 0; d < 7; d++) log.push(easyEntry(addDays(weekStart, d)))
    }
    const w4Start = addDays(w1Start, 21)
    for (let d = 0; d < 4; d++) log.push(hardEntry(addDays(w4Start, d)))

    const r = detectWorkoutDensity(log, TODAY)
    expect(r.recommendation.en).toMatch(/recovery day/)
    expect(r.recommendation.tr).toMatch(/toparlanma/)
  })
})

describe('detectWorkoutDensity — flagged then healthy → low risk', () => {
  it('1 flagged week followed by healthy most-recent week → low', () => {
    // Weeks 1, 3, 4 easy; week 2 has 5 hard days.
    const log = []
    const w1Start = '2026-04-06'
    for (let w = 0; w < 4; w++) {
      const weekStart = addDays(w1Start, w * 7)
      if (w === 1) {
        for (let d = 0; d < 5; d++) log.push(hardEntry(addDays(weekStart, d)))
        for (let d = 5; d < 7; d++) log.push(easyEntry(addDays(weekStart, d)))
      } else {
        for (let d = 0; d < 7; d++) log.push(easyEntry(addDays(weekStart, d)))
      }
    }
    const r = detectWorkoutDensity(log, TODAY)
    expect(r.weeks[1].flagged).toBe(true)
    expect(r.weeks[3].flagged).toBe(false)
    // Most recent week not flagged → consecutiveFlagged from end = 0
    expect(r.consecutiveFlagged).toBe(0)
    expect(r.risk).toBe('low')
  })
})

describe('detectWorkoutDensity — 2 consecutive flagged → high', () => {
  it('weeks 3+4 both flagged → risk=high consecutiveFlagged=2', () => {
    const log = []
    const w1Start = '2026-04-06'
    for (let w = 0; w < 4; w++) {
      const weekStart = addDays(w1Start, w * 7)
      const hard = w >= 2 ? 4 : 0
      for (let d = 0; d < hard; d++) log.push(hardEntry(addDays(weekStart, d)))
      for (let d = hard; d < 7; d++) log.push(easyEntry(addDays(weekStart, d)))
    }
    const r = detectWorkoutDensity(log, TODAY)
    expect(r.consecutiveFlagged).toBe(2)
    expect(r.risk).toBe('high')
    expect(r.weeks[2].flagged).toBe(true)
    expect(r.weeks[3].flagged).toBe(true)
  })
})

describe('detectWorkoutDensity — boundary at 4 hi-days/week', () => {
  it('exactly 4 hi-days IS flagged (>=4)', () => {
    const r = detectWorkoutDensity(hardWeeksLog(4), TODAY)
    expect(r.weeks.every(w => w.hiDays === 4)).toBe(true)
    expect(r.weeks.every(w => w.flagged === true)).toBe(true)
    expect(r.risk).toBe('high')
  })

  it('exactly 3 hi-days/week is NOT flagged (<4)', () => {
    const r = detectWorkoutDensity(hardWeeksLog(3), TODAY)
    expect(r.weeks.every(w => w.hiDays === 3)).toBe(true)
    expect(r.weeks.every(w => w.flagged === false)).toBe(true)
    expect(r.risk).toBe('low')
  })
})

describe('detectWorkoutDensity — same-day coalescing', () => {
  it('multiple hard sessions on the same day count as 1 hi-day', () => {
    // Week 4: 4 distinct days, but day 0 has 3 sessions.
    const log = []
    const w1Start = '2026-04-06'
    // Fill weeks 1-3 with easy
    for (let w = 0; w < 3; w++) {
      const weekStart = addDays(w1Start, w * 7)
      for (let d = 0; d < 7; d++) log.push(easyEntry(addDays(weekStart, d)))
    }
    const w4Start = addDays(w1Start, 21)
    // 3 hard sessions same day
    log.push(hardEntry(addDays(w4Start, 0), 'run'))
    log.push(hardEntry(addDays(w4Start, 0), 'bike'))
    log.push(hardEntry(addDays(w4Start, 0), 'swim'))
    // 2 more hard days
    log.push(hardEntry(addDays(w4Start, 1)))
    log.push(hardEntry(addDays(w4Start, 2)))
    for (let d = 3; d < 7; d++) log.push(easyEntry(addDays(w4Start, d)))

    const r = detectWorkoutDensity(log, TODAY)
    // 3 distinct hi-days (day 0 coalesced) → < 4 → not flagged
    expect(r.weeks[3].hiDays).toBe(3)
    expect(r.weeks[3].flagged).toBe(false)
  })

  it('1 hard + 1 easy same day still counts that day as hi-day', () => {
    const log = []
    const w1Start = '2026-04-06'
    for (let w = 0; w < 3; w++) {
      const weekStart = addDays(w1Start, w * 7)
      for (let d = 0; d < 7; d++) log.push(easyEntry(addDays(weekStart, d)))
    }
    const w4Start = addDays(w1Start, 21)
    // Day 0: easy AM + hard PM → counts as hi-day
    log.push(easyEntry(addDays(w4Start, 0)))
    log.push(hardEntry(addDays(w4Start, 0)))
    for (let d = 1; d < 4; d++) log.push(hardEntry(addDays(w4Start, d)))
    for (let d = 4; d < 7; d++) log.push(easyEntry(addDays(w4Start, d)))

    const r = detectWorkoutDensity(log, TODAY)
    expect(r.weeks[3].hiDays).toBe(4)
    expect(r.weeks[3].flagged).toBe(true)
  })
})

describe('detectWorkoutDensity — RPE-only signal', () => {
  it('detects hi-days via RPE alone (no zones array)', () => {
    const log = []
    const w1Start = '2026-04-06'
    for (let w = 0; w < 4; w++) {
      const weekStart = addDays(w1Start, w * 7)
      for (let d = 0; d < 4; d++) {
        log.push({ date: addDays(weekStart, d), type: 'run', duration: 60, rpe: 7 })
      }
      for (let d = 4; d < 7; d++) {
        log.push({ date: addDays(weekStart, d), type: 'run', duration: 60, rpe: 3 })
      }
    }
    const r = detectWorkoutDensity(log, TODAY)
    expect(r.weeks.every(w => w.hiDays === 4)).toBe(true)
    expect(r.risk).toBe('high')
  })

  it('RPE exactly 6 IS hi-intensity (>=6 boundary)', () => {
    const log = [{ date: TODAY, type: 'run', duration: 60, rpe: 6 }]
    const r = detectWorkoutDensity(log, TODAY)
    expect(r.weeks[3].hiDays).toBe(1)
  })

  it('RPE 5 is NOT hi-intensity', () => {
    const log = [{ date: TODAY, type: 'run', duration: 60, rpe: 5 }]
    const r = detectWorkoutDensity(log, TODAY)
    expect(r.weeks[3].hiDays).toBe(0)
  })
})

describe('detectWorkoutDensity — zone-only signal', () => {
  it('uses Z3+Z4+Z5 share > 40% when no RPE present', () => {
    const log = []
    const w1Start = '2026-04-06'
    // 4 weeks of 4 zone-hard days (Z3+Z4+Z5 ≈ 50%)
    for (let w = 0; w < 4; w++) {
      const weekStart = addDays(w1Start, w * 7)
      for (let d = 0; d < 4; d++) {
        log.push({
          date: addDays(weekStart, d),
          type: 'run', duration: 60,
          zones: [10, 40, 30, 15, 5],  // Z3+Z4+Z5 = 50/100 = 50% > 40%
        })
      }
      for (let d = 4; d < 7; d++) {
        log.push({
          date: addDays(weekStart, d),
          type: 'run', duration: 60,
          zones: [20, 70, 5, 3, 2],  // Z3+Z4+Z5 = 10% ≤ 40%
        })
      }
    }
    const r = detectWorkoutDensity(log, TODAY)
    expect(r.weeks.every(w => w.hiDays === 4)).toBe(true)
    expect(r.risk).toBe('high')
  })

  it('Z3+Z4+Z5 share at exactly 40% is NOT hi (strict greater-than)', () => {
    const log = [{
      date: TODAY, type: 'run', duration: 60,
      zones: [20, 40, 20, 15, 5],  // hi share = 40/100 = 40% (not > 40%)
    }]
    const r = detectWorkoutDensity(log, TODAY)
    expect(r.weeks[3].hiDays).toBe(0)
  })

  it('Z3+Z4+Z5 share at 41% IS hi (strictly above 40%)', () => {
    const log = [{
      date: TODAY, type: 'run', duration: 60,
      zones: [19, 40, 21, 15, 5],  // hi share = 41/100 = 41%
    }]
    const r = detectWorkoutDensity(log, TODAY)
    expect(r.weeks[3].hiDays).toBe(1)
  })

  it('object-shaped zones {Z1, Z2, ...} also work', () => {
    const log = [{
      date: TODAY, type: 'run', duration: 60,
      zones: { Z1: 0, Z2: 0, Z3: 30, Z4: 20, Z5: 10 },  // hi = 100%
    }]
    const r = detectWorkoutDensity(log, TODAY)
    expect(r.weeks[3].hiDays).toBe(1)
  })
})

describe('detectWorkoutDensity — UTC stability', () => {
  it('date string is treated as UTC day regardless of host TZ', () => {
    // Date '2026-04-30' (Thu in week 4); a session created at 23:00 UTC+3
    // would be 20:00 UTC same day. We rely on 'YYYY-MM-DD' string compare,
    // so the entry stays in the today bucket.
    const log = [{ date: '2026-04-30', type: 'run', duration: 60, rpe: 9 }]
    const r = detectWorkoutDensity(log, TODAY)
    expect(r.weeks[3].weekStart).toBe('2026-04-27')
    expect(r.weeks[3].weekEnd).toBe('2026-05-03')
    expect(r.weeks[3].hiDays).toBe(1)
  })

  it('ISO week boundaries: Monday is week start, Sunday is week end', () => {
    const r = detectWorkoutDensity([{ date: TODAY, rpe: 8, duration: 60 }], TODAY)
    // Week 4 (most recent) covers 2026-04-27 (Mon) .. 2026-05-03 (Sun)
    expect(r.weeks[3].weekStart).toBe('2026-04-27')
    expect(r.weeks[3].weekEnd).toBe('2026-05-03')
    // Week 1 (oldest) covers 2026-04-06 .. 2026-04-12
    expect(r.weeks[0].weekStart).toBe('2026-04-06')
    expect(r.weeks[0].weekEnd).toBe('2026-04-12')
  })
})

describe('detectWorkoutDensity — invariants', () => {
  it('weeks array always has 4 entries when log non-empty', () => {
    const r = detectWorkoutDensity(polarizedLog(), TODAY)
    expect(r.weeks.length).toBe(4)
  })

  it('weeks sorted oldest → most recent', () => {
    const r = detectWorkoutDensity(polarizedLog(), TODAY)
    for (let i = 1; i < r.weeks.length; i++) {
      expect(r.weeks[i].weekStart > r.weeks[i - 1].weekStart).toBe(true)
    }
  })

  it('citation field is always present', () => {
    const r = detectWorkoutDensity(polarizedLog(), TODAY)
    expect(r.citation).toBe('Gabbett 2016; Hulin 2016')
  })

  it('bilingual: en+tr non-empty for moderate, recommendation empty for low', () => {
    const lo = detectWorkoutDensity(polarizedLog(), TODAY)
    expect(lo.message.en.length).toBeGreaterThan(0)
    expect(lo.message.tr.length).toBeGreaterThan(0)
    expect(lo.recommendation.en).toBe('')
    expect(lo.recommendation.tr).toBe('')

    // Build moderate: 1 flagged most-recent week
    const log = []
    const w1Start = '2026-04-06'
    for (let w = 0; w < 3; w++) {
      const weekStart = addDays(w1Start, w * 7)
      for (let d = 0; d < 7; d++) log.push(easyEntry(addDays(weekStart, d)))
    }
    const w4Start = addDays(w1Start, 21)
    for (let d = 0; d < 4; d++) log.push(hardEntry(addDays(w4Start, d)))
    const mid = detectWorkoutDensity(log, TODAY)
    expect(mid.message.en.length).toBeGreaterThan(0)
    expect(mid.message.tr.length).toBeGreaterThan(0)
    expect(mid.recommendation.en.length).toBeGreaterThan(0)
    expect(mid.recommendation.tr.length).toBeGreaterThan(0)
  })

  it('out-of-window entries are ignored', () => {
    // Entry 35 days ago should be excluded (window is 28d)
    const old = { date: addDays(TODAY, -35), type: 'run', duration: 60, rpe: 9 }
    const r = detectWorkoutDensity([old], TODAY)
    expect(r.weeks.every(w => w.hiDays === 0)).toBe(true)
    expect(r.risk).toBe('low')
  })
})
