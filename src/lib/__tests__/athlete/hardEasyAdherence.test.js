// Hard/Easy Adherence — lib tests
import { describe, it, expect } from 'vitest'
import {
  analyzeHardEasyAdherence,
  HARD_EASY_ADHERENCE_CITATION,
} from '../../athlete/hardEasyAdherence.js'

const TODAY = '2026-04-30' // Thursday
// ISO Monday of this week = '2026-04-27'
// Window of 12 weeks ends with week starting 2026-04-27.
// Oldest week in window starts 11 weeks earlier = 2026-02-09.

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function entry(date, tss, extra = {}) {
  return { date, tss, ...extra }
}

// Build a series of daily entries with provided per-day TSS values.
// `start` = first ISO date; `tssArr` = TSS per consecutive day, starting at start.
function dailyLog(start, tssArr) {
  return tssArr.map((tss, i) => entry(addDaysStr(start, i), tss))
}

describe('analyzeHardEasyAdherence — null gates', () => {
  it('returns null when today is missing', () => {
    expect(analyzeHardEasyAdherence({ log: [], today: null })).toBeNull()
    expect(analyzeHardEasyAdherence({ log: [], today: '' })).toBeNull()
    expect(analyzeHardEasyAdherence({ log: [], today: 'not-a-date' })).toBeNull()
  })

  it('returns null when log is not an array', () => {
    expect(analyzeHardEasyAdherence({ log: null, today: TODAY })).toBeNull()
    expect(analyzeHardEasyAdherence({ log: undefined, today: TODAY })).toBeNull()
    expect(analyzeHardEasyAdherence({ log: 'log', today: TODAY })).toBeNull()
  })

  it('returns null for an empty log', () => {
    expect(analyzeHardEasyAdherence({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null when no week reaches ≥ 2 hard days', () => {
    // Two scattered hard sessions in different weeks → no week has ≥ 2 hard days.
    const log = [
      entry('2026-04-13', 100), // Mon of week starting 2026-04-13
      entry('2026-04-20', 100), // Mon of week starting 2026-04-20
    ]
    expect(analyzeHardEasyAdherence({ log, today: TODAY })).toBeNull()
  })

  it('returns null when only entries without tss exist', () => {
    const log = [
      { date: '2026-04-20' },
      { date: '2026-04-21', tss: 0 },
      { date: '2026-04-22', tss: -5 },
    ]
    expect(analyzeHardEasyAdherence({ log, today: TODAY })).toBeNull()
  })
})

describe('analyzeHardEasyAdherence — shape & citation', () => {
  it('returns expected shape on a valid analysis', () => {
    // Strict pattern: every week, 3 hard sessions on Mon/Wed/Fri.
    const log = []
    for (let w = 0; w < 12; w++) {
      const wkMon = addDaysStr('2026-02-09', w * 7)
      log.push(entry(wkMon, 100))
      log.push(entry(addDaysStr(wkMon, 2), 100))
      log.push(entry(addDaysStr(wkMon, 4), 100))
    }
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r).toHaveProperty('band')
    expect(r).toHaveProperty('weeks')
    expect(r).toHaveProperty('totalViolations')
    expect(r).toHaveProperty('totalHardDays')
    expect(r).toHaveProperty('cleanWeeks')
    expect(r).toHaveProperty('weeksAnalyzed')
    expect(r).toHaveProperty('cleanWeekRate')
    expect(r).toHaveProperty('citation')
    expect(r.citation).toBe(HARD_EASY_ADHERENCE_CITATION)
    expect(r.citation).toMatch(/Daniels|Foster/)
    expect(Array.isArray(r.weeks)).toBe(true)
    expect(r.weeks.length).toBe(12)
  })
})

describe('analyzeHardEasyAdherence — STRICT band', () => {
  it('classifies STRICT when all 12 weeks have ≥2 hard days and zero violations', () => {
    const log = []
    // Mon/Wed/Fri pattern for 12 weeks. No adjacencies (Wed-Fri = 2 days apart;
    // Fri to next Mon = 3 days apart).
    for (let w = 0; w < 12; w++) {
      const wkMon = addDaysStr('2026-02-09', w * 7)
      log.push(entry(wkMon, 100))
      log.push(entry(addDaysStr(wkMon, 2), 100))
      log.push(entry(addDaysStr(wkMon, 4), 100))
    }
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r.band).toBe('STRICT')
    expect(r.totalViolations).toBe(0)
    expect(r.weeksAnalyzed).toBe(12)
    expect(r.cleanWeeks).toBe(12)
    expect(r.cleanWeekRate).toBe(1)
  })

  it('STRICT requires weeksAnalyzed ≥ 4 even at 100% cleanness', () => {
    // 3 weeks of Mon/Wed pattern, all clean.
    const log = []
    for (let w = 0; w < 3; w++) {
      const wkMon = addDaysStr('2026-04-13', w * 7)
      log.push(entry(wkMon, 100))
      log.push(entry(addDaysStr(wkMon, 2), 100))
    }
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.weeksAnalyzed).toBe(3)
    expect(r.cleanWeekRate).toBe(1)
    expect(r.band).toBe('GOOD') // not STRICT
  })
})

describe('analyzeHardEasyAdherence — GOOD band', () => {
  it('classifies GOOD when 75% ≤ cleanWeekRate < 95%', () => {
    // 12 weeks Mon/Wed clean, but inject Mon-Tue adjacency on weeks 0,1,2
    // → 3 dirty weeks / 12 = 9 clean / 12 = 75%
    const log = []
    for (let w = 0; w < 12; w++) {
      const wkMon = addDaysStr('2026-02-09', w * 7)
      log.push(entry(wkMon, 100))
      // Inject adjacency for first 3 weeks (Tue follow-up).
      if (w < 3) {
        log.push(entry(addDaysStr(wkMon, 1), 100))
      }
      // Add Wed hard day to give ≥ 2 hard days in non-dirty weeks too.
      if (w >= 3) {
        log.push(entry(addDaysStr(wkMon, 2), 100))
      }
    }
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r.weeksAnalyzed).toBe(12)
    expect(r.cleanWeeks).toBe(9)
    expect(r.cleanWeekRate).toBe(0.75)
    expect(r.band).toBe('GOOD')
  })

  it('classifies GOOD when cleanWeekRate is exactly 0.75', () => {
    // 4 weeks: 3 clean Mon/Wed + 1 dirty Mon/Tue = 75%
    const log = []
    for (let w = 0; w < 3; w++) {
      const wkMon = addDaysStr('2026-03-30', w * 7)
      log.push(entry(wkMon, 100))
      log.push(entry(addDaysStr(wkMon, 2), 100))
    }
    // Current week: Mon-Tue adjacency.
    log.push(entry('2026-04-20', 100))
    log.push(entry('2026-04-21', 100))
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r.weeksAnalyzed).toBe(4)
    expect(r.cleanWeeks).toBe(3)
    expect(r.cleanWeekRate).toBe(0.75)
    expect(r.band).toBe('GOOD')
  })
})

describe('analyzeHardEasyAdherence — OCCASIONAL_VIOLATIONS band', () => {
  it('classifies OCCASIONAL_VIOLATIONS when 50% ≤ rate < 75%', () => {
    // 12 weeks, 6 dirty + 6 clean = 50%
    const log = []
    for (let w = 0; w < 12; w++) {
      const wkMon = addDaysStr('2026-02-09', w * 7)
      log.push(entry(wkMon, 100))
      if (w < 6) {
        // adjacency
        log.push(entry(addDaysStr(wkMon, 1), 100))
      } else {
        // spaced
        log.push(entry(addDaysStr(wkMon, 2), 100))
      }
    }
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r.weeksAnalyzed).toBe(12)
    expect(r.cleanWeeks).toBe(6)
    expect(r.cleanWeekRate).toBe(0.5)
    expect(r.band).toBe('OCCASIONAL_VIOLATIONS')
  })
})

describe('analyzeHardEasyAdherence — CHRONIC_VIOLATIONS band', () => {
  it('classifies CHRONIC_VIOLATIONS when < 50% clean', () => {
    // 12 weeks all Mon-Tue adjacency → 0 clean
    const log = []
    for (let w = 0; w < 12; w++) {
      const wkMon = addDaysStr('2026-02-09', w * 7)
      log.push(entry(wkMon, 100))
      log.push(entry(addDaysStr(wkMon, 1), 100))
    }
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r.weeksAnalyzed).toBe(12)
    expect(r.cleanWeeks).toBe(0)
    expect(r.cleanWeekRate).toBe(0)
    expect(r.band).toBe('CHRONIC_VIOLATIONS')
    expect(r.totalViolations).toBe(12)
  })
})

describe('analyzeHardEasyAdherence — single violation math', () => {
  it('counts a single Mon-Tue adjacency as exactly 1 violation', () => {
    const log = [
      entry('2026-04-27', 100), // Mon
      entry('2026-04-28', 100), // Tue
      entry('2026-04-30', 100), // Thu — third hard day in week, no adjacency
    ]
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalViolations).toBe(1)
    expect(r.totalHardDays).toBe(3)
  })

  it('does NOT count Mon and Wed (gap > 1 day) as a violation', () => {
    const log = [
      entry('2026-04-27', 100), // Mon
      entry('2026-04-29', 100), // Wed
    ]
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalViolations).toBe(0)
    expect(r.totalHardDays).toBe(2)
    expect(r.cleanWeeks).toBe(1)
  })
})

describe('analyzeHardEasyAdherence — multi-violation week', () => {
  it('counts 3 consecutive hard days as 2 violations (Mon-Tue + Tue-Wed)', () => {
    const log = [
      entry('2026-04-27', 100), // Mon
      entry('2026-04-28', 100), // Tue
      entry('2026-04-29', 100), // Wed
    ]
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r.totalViolations).toBe(2)
    expect(r.totalHardDays).toBe(3)
    // Both violations belong to the same week (week starting 2026-04-27).
    const wk = r.weeks.find(w => w.weekStart === '2026-04-27')
    expect(wk.violations).toBe(2)
    expect(wk.hardDays).toBe(3)
  })
})

describe('analyzeHardEasyAdherence — CTL warmup floor', () => {
  it('uses TSS-60 floor when CTL is not yet built up', () => {
    // First two days both at TSS=60 → CTL starts at ~0, threshold = 60.
    // Both should count as hard.
    const log = [
      entry('2026-04-27', 60), // Mon
      entry('2026-04-28', 60), // Tue (adjacency)
    ]
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalHardDays).toBe(2)
    expect(r.totalViolations).toBe(1)
  })

  it('rejects sessions just below the 60-TSS floor when CTL is low', () => {
    const log = [
      entry('2026-04-27', 59), // just below floor
      entry('2026-04-28', 59),
      entry('2026-04-29', 100), // hard
      entry('2026-04-30', 100), // hard, adjacency to Wed
    ]
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalHardDays).toBe(2) // Wed + Thu
    expect(r.totalViolations).toBe(1)
  })
})

describe('analyzeHardEasyAdherence — CTL-scaled threshold once warmed', () => {
  it('raises threshold above 60 once CTL × 0.9 > 60', () => {
    // 216 days of TSS=100 leading up to current week → CTL stays warm at ~100.
    // Then current week (Mon/Tue at TSS=80, Wed/Thu at TSS=120) tests the
    // CTL-scaled gate: TSS=80 < ~90 threshold → not hard; TSS=120 ≥ ~90 → hard.
    const start = addDaysStr(TODAY, -219) // 220-day span ending on TODAY
    const tssArr = Array(216).fill(100)
    const log = dailyLog(start, tssArr)
    // Days 217-220 = Mon 2026-04-27 through Thu 2026-04-30:
    log.push(entry('2026-04-27', 80)) // below ~90 → not hard
    log.push(entry('2026-04-28', 80)) // below ~90 → not hard
    log.push(entry('2026-04-29', 120)) // hard
    log.push(entry('2026-04-30', 120)) // hard, adjacency to Wed

    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r).not.toBeNull()
    const currentWk = r.weeks.find(w => w.weekStart === '2026-04-27')
    expect(currentWk.hardDays).toBe(2)
    expect(currentWk.violations).toBe(1)
  })
})

describe('analyzeHardEasyAdherence — weeks with 0-1 hard days excluded from denominator', () => {
  it('excludes weeks with 0 hard days from weeksAnalyzed', () => {
    const log = [
      // Week starting 2026-04-20: 2 hard days, clean (Mon + Thu)
      entry('2026-04-20', 100),
      entry('2026-04-23', 100),
      // Week starting 2026-04-27: 2 hard days, dirty (Mon + Tue)
      entry('2026-04-27', 100),
      entry('2026-04-28', 100),
    ]
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r.weeksAnalyzed).toBe(2)
    expect(r.cleanWeeks).toBe(1)
    expect(r.cleanWeekRate).toBe(0.5)
  })

  it('excludes weeks with exactly 1 hard day from weeksAnalyzed', () => {
    const log = [
      // Week starting 2026-04-13: 1 hard day → excluded
      entry('2026-04-13', 100),
      // Week starting 2026-04-20: 1 hard day → excluded
      entry('2026-04-20', 100),
      // Week starting 2026-04-27: 2 hard, clean
      entry('2026-04-27', 100),
      entry('2026-04-29', 100),
    ]
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r.weeksAnalyzed).toBe(1)
    expect(r.cleanWeeks).toBe(1)
    expect(r.cleanWeekRate).toBe(1)
  })
})

describe('analyzeHardEasyAdherence — ISO week boundary', () => {
  it('attributes a Sunday-Monday violation to the Sunday week (start of adjacency)', () => {
    // Sunday 2026-04-26 (week starting 2026-04-20) hard
    // Monday 2026-04-27 (week starting 2026-04-27) hard
    const log = [
      entry('2026-04-20', 100), // Mon prior — gives prev week ≥ 2 hard days
      entry('2026-04-23', 100), // Thu prior
      entry('2026-04-26', 100), // Sun
      entry('2026-04-27', 100), // Mon
      entry('2026-04-29', 100), // Wed — gives current week ≥ 2 hard days
    ]
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalViolations).toBe(1)
    // Violation attributed to Sun's week → 2026-04-20.
    const sunWk = r.weeks.find(w => w.weekStart === '2026-04-20')
    const monWk = r.weeks.find(w => w.weekStart === '2026-04-27')
    expect(sunWk.violations).toBe(1)
    expect(monWk.violations).toBe(0)
  })
})

describe('analyzeHardEasyAdherence — multi-session day uses max not sum', () => {
  it('uses max-session TSS for a multi-session day (not sum)', () => {
    // Day with two sessions, neither alone reaching the 60-TSS floor:
    // 40 + 40 = 80 (would be hard if summed), but max is 40 (not hard).
    const log = [
      entry('2026-04-27', 40, { id: 'a' }),
      entry('2026-04-27', 40, { id: 'b' }),
      entry('2026-04-28', 100), // hard
      entry('2026-04-30', 100), // hard
    ]
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r).not.toBeNull()
    // Mon is not hard (max-session = 40). Tue + Thu hard. No adjacency.
    expect(r.totalHardDays).toBe(2)
    expect(r.totalViolations).toBe(0)
  })

  it('correctly identifies a multi-session day as hard when one session ≥ threshold', () => {
    const log = [
      entry('2026-04-27', 30, { id: 'a' }),
      entry('2026-04-27', 100, { id: 'b' }), // max ≥ 60 → hard
      entry('2026-04-28', 100), // hard
      entry('2026-04-30', 100), // hard
    ]
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalHardDays).toBe(3)
    expect(r.totalViolations).toBe(1) // Mon-Tue adjacency
  })
})

describe('analyzeHardEasyAdherence — custom ctlHalflifeDays', () => {
  it('accepts custom ctlHalflifeDays and produces a valid result', () => {
    const log = [
      entry('2026-04-27', 100),
      entry('2026-04-28', 100),
      entry('2026-04-30', 100),
    ]
    const r = analyzeHardEasyAdherence({ log, today: TODAY, ctlHalflifeDays: 28 })
    expect(r).not.toBeNull()
    expect(r.totalViolations).toBe(1)
  })

  it('falls back to default halflife when ctlHalflifeDays is invalid', () => {
    const log = [
      entry('2026-04-27', 100),
      entry('2026-04-28', 100),
      entry('2026-04-29', 100),
    ]
    const r1 = analyzeHardEasyAdherence({ log, today: TODAY, ctlHalflifeDays: 0 })
    const r2 = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r1).not.toBeNull()
    expect(r2).not.toBeNull()
    expect(r1.totalViolations).toBe(r2.totalViolations)
  })
})

describe('analyzeHardEasyAdherence — custom windowWeeks', () => {
  it('honors custom windowWeeks (4)', () => {
    const log = []
    // 4 weeks Mon/Wed clean
    for (let w = 0; w < 4; w++) {
      const wkMon = addDaysStr('2026-04-06', w * 7)
      log.push(entry(wkMon, 100))
      log.push(entry(addDaysStr(wkMon, 2), 100))
    }
    const r = analyzeHardEasyAdherence({ log, today: TODAY, windowWeeks: 4 })
    expect(r).not.toBeNull()
    expect(r.weeks.length).toBe(4)
    expect(r.weeksAnalyzed).toBe(4)
    expect(r.band).toBe('STRICT')
  })

  it('honors custom windowWeeks (8)', () => {
    const log = [
      entry('2026-04-27', 100),
      entry('2026-04-29', 100),
    ]
    const r = analyzeHardEasyAdherence({ log, today: TODAY, windowWeeks: 8 })
    expect(r).not.toBeNull()
    expect(r.weeks.length).toBe(8)
  })
})

describe('analyzeHardEasyAdherence — today as Date vs string', () => {
  it('accepts today as a Date object', () => {
    const log = [
      entry('2026-04-27', 100),
      entry('2026-04-28', 100),
    ]
    const r = analyzeHardEasyAdherence({
      log,
      today: new Date(TODAY + 'T12:00:00Z'),
    })
    expect(r).not.toBeNull()
    expect(r.totalViolations).toBe(1)
  })

  it('accepts today as an ISO string', () => {
    const log = [
      entry('2026-04-27', 100),
      entry('2026-04-28', 100),
    ]
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalViolations).toBe(1)
  })

  it('Date and string today produce identical results', () => {
    const log = [
      entry('2026-04-27', 100),
      entry('2026-04-28', 100),
      entry('2026-04-30', 100),
    ]
    const fromString = analyzeHardEasyAdherence({ log, today: TODAY })
    const fromDate = analyzeHardEasyAdherence({
      log,
      today: new Date(TODAY + 'T08:00:00Z'),
    })
    expect(fromString).not.toBeNull()
    expect(fromDate).not.toBeNull()
    expect(fromDate.totalViolations).toBe(fromString.totalViolations)
    expect(fromDate.weeksAnalyzed).toBe(fromString.weeksAnalyzed)
    expect(fromDate.cleanWeekRate).toBe(fromString.cleanWeekRate)
  })
})

describe('analyzeHardEasyAdherence — weeks array structure', () => {
  it('returns weeks in chronological order (oldest first)', () => {
    const log = [
      entry('2026-04-27', 100),
      entry('2026-04-29', 100),
    ]
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.weeks.length).toBe(12)
    // weeks[0].weekStart < weeks[11].weekStart
    expect(r.weeks[0].weekStart < r.weeks[11].weekStart).toBe(true)
    // Last week = Monday containing today.
    expect(r.weeks[11].weekStart).toBe('2026-04-27')
  })

  it('week entries include hardDays and violations counts', () => {
    const log = [
      entry('2026-04-27', 100),
      entry('2026-04-28', 100),
      entry('2026-04-30', 100),
    ]
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    const wk = r.weeks.find(w => w.weekStart === '2026-04-27')
    expect(wk).toBeDefined()
    expect(wk.hardDays).toBe(3)
    expect(wk.violations).toBe(1)
  })
})

describe('analyzeHardEasyAdherence — cleanWeekRate rounding', () => {
  it('rounds cleanWeekRate to 4 decimal places', () => {
    // 7 clean / 11 analyzed → 0.6363636363... → expected 0.6364
    const log = []
    // Build 11 weeks (skip one week → only 11 analyzable weeks).
    for (let w = 0; w < 12; w++) {
      if (w === 5) continue // skip week 5 — no hard days, excluded.
      const wkMon = addDaysStr('2026-02-09', w * 7)
      log.push(entry(wkMon, 100))
      // 4 of remaining 11 weeks get adjacency.
      if (w < 4) {
        log.push(entry(addDaysStr(wkMon, 1), 100))
      } else {
        log.push(entry(addDaysStr(wkMon, 2), 100))
      }
    }
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.weeksAnalyzed).toBe(11)
    expect(r.cleanWeeks).toBe(7)
    // 4 decimal places
    expect(r.cleanWeekRate).toBe(0.6364)
  })
})

describe('analyzeHardEasyAdherence — entries outside window are ignored for adjacency', () => {
  it('does not count an adjacency that crosses the window start boundary', () => {
    // Add an old entry far before the window — its adjacency to anything
    // inside the window cannot happen (entries are non-consecutive).
    const log = [
      entry('2024-01-01', 100),
      entry('2024-01-02', 100), // way before window — should not affect window counts
      // Inside window:
      entry('2026-04-27', 100),
      entry('2026-04-29', 100),
    ]
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalViolations).toBe(0)
    expect(r.totalHardDays).toBe(2)
  })
})

describe('analyzeHardEasyAdherence — non-string / malformed dates skipped', () => {
  it('ignores entries with malformed dates', () => {
    const log = [
      { date: 'not-a-date', tss: 100 },
      { date: '2026/04/27', tss: 100 },
      entry('2026-04-27', 100),
      entry('2026-04-28', 100),
    ]
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalHardDays).toBe(2)
    expect(r.totalViolations).toBe(1)
  })
})

describe('analyzeHardEasyAdherence — totalHardDays counts unique in-window hard days', () => {
  it('counts distinct dates in-window only', () => {
    const log = [
      entry('2026-02-09', 100), // start of window
      entry('2026-04-27', 100),
      entry('2026-04-29', 100),
    ]
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalHardDays).toBe(3)
  })

  it('does not double-count multi-session days', () => {
    const log = [
      entry('2026-04-27', 100, { id: 'a' }),
      entry('2026-04-27', 80, { id: 'b' }),
      entry('2026-04-29', 100),
    ]
    const r = analyzeHardEasyAdherence({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.totalHardDays).toBe(2)
  })
})
