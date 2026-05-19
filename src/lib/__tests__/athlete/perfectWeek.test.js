// ─── perfectWeek.test.js — pure-fn tests for analyzePerfectWeek ─────────────
import { describe, it, expect } from 'vitest'
import {
  analyzePerfectWeek,
  PERFECT_WEEK_CITATION,
} from '../../athlete/perfectWeek.js'

// 2026-05-17 is a Sunday. The 12-week window ending in that week:
//   start Mon = 2026-02-23
//   end   Sun = 2026-05-17
const TODAY = '2026-05-17'

// Mon of each of the 12 weeks (oldest → newest).
const WEEKS = [
  '2026-02-23', // 0
  '2026-03-02', // 1
  '2026-03-09', // 2
  '2026-03-16', // 3
  '2026-03-23', // 4
  '2026-03-30', // 5
  '2026-04-06', // 6
  '2026-04-13', // 7
  '2026-04-20', // 8
  '2026-04-27', // 9
  '2026-05-04', // 10
  '2026-05-11', // 11
]

// Build an entry on a specific weekday offset (0=Mon..6=Sun) of a given week.
function entry(weekIdx, dayOffset, durationMin, rpe, extra = {}) {
  const base = new Date(WEEKS[weekIdx] + 'T00:00:00Z')
  base.setUTCDate(base.getUTCDate() + dayOffset)
  const date = base.toISOString().slice(0, 10)
  return { date, durationMin, rpe, type: 'run', ...extra }
}

// Builds a "perfect" week: 3 sessions, at least one ≥90 min, at least one RPE≥7.
function perfectWeekEntries(weekIdx) {
  return [
    entry(weekIdx, 0, 60, 5),   // Mon — easy
    entry(weekIdx, 2, 60, 7),   // Wed — hard
    entry(weekIdx, 5, 120, 6),  // Sat — long
  ]
}

describe('analyzePerfectWeek — citation', () => {
  it('exports a Hellard 2019 + Seiler 2010 citation string', () => {
    expect(PERFECT_WEEK_CITATION).toMatch(/Hellard 2019/)
    expect(PERFECT_WEEK_CITATION).toMatch(/Seiler 2010/)
  })
})

describe('analyzePerfectWeek — null gates', () => {
  it('non-array log → null', () => {
    expect(analyzePerfectWeek({ log: null, today: TODAY })).toBeNull()
    expect(analyzePerfectWeek({ log: undefined, today: TODAY })).toBeNull()
  })

  it('missing/invalid today → null', () => {
    expect(analyzePerfectWeek({ log: [], today: null })).toBeNull()
    expect(analyzePerfectWeek({ log: [], today: 123 })).toBeNull()
  })

  it('fewer than 6 of 12 weeks have any sessions → null', () => {
    // Only 5 weeks with activity.
    const log = []
    for (let w = 0; w < 5; w++) {
      log.push(entry(w, 0, 60, 5))
    }
    expect(analyzePerfectWeek({ log, today: TODAY })).toBeNull()
  })

  it('empty log → null (since no active weeks)', () => {
    expect(analyzePerfectWeek({ log: [], today: TODAY })).toBeNull()
  })
})

describe('analyzePerfectWeek — return shape', () => {
  it('returns 12 week summaries with correct structure', () => {
    const log = []
    // Activity in every week so we clear the 6-week gate.
    for (let w = 0; w < 12; w++) {
      log.push(...perfectWeekEntries(w))
    }
    const r = analyzePerfectWeek({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.weeks).toHaveLength(12)
    for (const wk of r.weeks) {
      expect(typeof wk.weekStart).toBe('string')
      expect(typeof wk.sessionCount).toBe('number')
      expect(typeof wk.hadHard).toBe('boolean')
      expect(typeof wk.hadLong).toBe('boolean')
      expect(typeof wk.isPerfect).toBe('boolean')
    }
    // weekStarts should be ordered oldest → newest.
    expect(r.weeks[0].weekStart).toBe('2026-02-23')
    expect(r.weeks[11].weekStart).toBe('2026-05-11')
    expect(r.citation).toBe(PERFECT_WEEK_CITATION)
  })
})

describe('analyzePerfectWeek — pattern classification', () => {
  it('HABITUAL_QUALITY when ≥50% of weeks are perfect', () => {
    // 8 perfect weeks + 4 active-but-imperfect weeks = 8/12 = 66.7%.
    const log = []
    for (let w = 0; w < 8; w++) log.push(...perfectWeekEntries(w))
    for (let w = 8; w < 12; w++) {
      log.push(entry(w, 0, 60, 5))
      log.push(entry(w, 2, 60, 5))
      log.push(entry(w, 4, 60, 5))
    }
    const r = analyzePerfectWeek({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.pattern).toBe('HABITUAL_QUALITY')
    expect(r.perfectWeeks).toBe(8)
    expect(r.perfectRate).toBeCloseTo(8 / 12, 5)
  })

  it('OCCASIONAL when 20% ≤ rate < 50%', () => {
    // 3 perfect + 9 active-but-imperfect = 3/12 = 25%.
    const log = []
    for (let w = 0; w < 3; w++) log.push(...perfectWeekEntries(w))
    for (let w = 3; w < 12; w++) {
      log.push(entry(w, 0, 60, 5))
      log.push(entry(w, 2, 60, 5))
      log.push(entry(w, 4, 60, 5))
    }
    const r = analyzePerfectWeek({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.pattern).toBe('OCCASIONAL')
    expect(r.perfectWeeks).toBe(3)
  })

  it('SPORADIC when rate < 20%', () => {
    // 1 perfect + 11 active-but-imperfect = 1/12 ≈ 8.3%.
    const log = []
    log.push(...perfectWeekEntries(0))
    for (let w = 1; w < 12; w++) {
      log.push(entry(w, 0, 60, 5))
      log.push(entry(w, 2, 60, 5))
      log.push(entry(w, 4, 60, 5))
    }
    const r = analyzePerfectWeek({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.pattern).toBe('SPORADIC')
    expect(r.perfectWeeks).toBe(1)
  })

  it('boundary: exactly 50% → HABITUAL_QUALITY', () => {
    const log = []
    for (let w = 0; w < 6; w++) log.push(...perfectWeekEntries(w))
    for (let w = 6; w < 12; w++) {
      log.push(entry(w, 0, 60, 5))
      log.push(entry(w, 2, 60, 5))
      log.push(entry(w, 4, 60, 5))
    }
    const r = analyzePerfectWeek({ log, today: TODAY })
    expect(r.perfectRate).toBeCloseTo(0.5, 5)
    expect(r.pattern).toBe('HABITUAL_QUALITY')
  })

  it('boundary: exactly 20% (rounded) → OCCASIONAL', () => {
    // Exactly 20% is unattainable in /12, but rate==0.25 (3/12) lands OCCASIONAL.
    // Test the inclusive boundary at 0.20 via a 10-week scenario isn't possible
    // with windowWeeks=12; instead verify just-above-threshold lands OCCASIONAL.
    const log = []
    for (let w = 0; w < 3; w++) log.push(...perfectWeekEntries(w))
    for (let w = 3; w < 12; w++) {
      log.push(entry(w, 0, 60, 5))
      log.push(entry(w, 2, 60, 5))
      log.push(entry(w, 4, 60, 5))
    }
    const r = analyzePerfectWeek({ log, today: TODAY })
    expect(r.perfectRate).toBeGreaterThanOrEqual(0.2)
    expect(r.perfectRate).toBeLessThan(0.5)
    expect(r.pattern).toBe('OCCASIONAL')
  })
})

describe('analyzePerfectWeek — criteria evaluation per week', () => {
  it('flags isPerfect=true only when all three criteria hit', () => {
    const log = [
      // Week 0: 3 sessions, RPE 7, 120 min → PERFECT
      entry(0, 0, 60, 5),
      entry(0, 2, 60, 7),
      entry(0, 5, 120, 6),
      // Week 1: 3 sessions, NO hard → not perfect
      entry(1, 0, 60, 5),
      entry(1, 2, 60, 5),
      entry(1, 5, 120, 5),
      // Week 2: 3 sessions, hard, but NO long → not perfect
      entry(2, 0, 60, 5),
      entry(2, 2, 60, 7),
      entry(2, 5, 60, 5),
      // Week 3: only 2 sessions, hard AND long → not perfect (sessions miss)
      entry(3, 2, 60, 7),
      entry(3, 5, 120, 5),
      // Weeks 4..11: filler activity so the 6-active-week gate passes.
      ...Array.from({ length: 8 }, (_, i) => entry(4 + i, 0, 60, 5)),
    ]
    const r = analyzePerfectWeek({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.weeks[0].isPerfect).toBe(true)
    expect(r.weeks[0].hadHard).toBe(true)
    expect(r.weeks[0].hadLong).toBe(true)
    expect(r.weeks[0].sessionCount).toBe(3)

    expect(r.weeks[1].isPerfect).toBe(false)
    expect(r.weeks[1].hadHard).toBe(false)
    expect(r.weeks[1].hadLong).toBe(true)

    expect(r.weeks[2].isPerfect).toBe(false)
    expect(r.weeks[2].hadHard).toBe(true)
    expect(r.weeks[2].hadLong).toBe(false)

    expect(r.weeks[3].isPerfect).toBe(false)
    expect(r.weeks[3].sessionCount).toBe(2)
    expect(r.weeks[3].hadHard).toBe(true)
    expect(r.weeks[3].hadLong).toBe(true)
  })

  it('RPE 7 is the hard threshold (inclusive)', () => {
    // Week 0 has RPE=7 exactly → hadHard true.
    // Week 1 has RPE=6.9 → hadHard false.
    const log = [
      entry(0, 0, 60, 5),
      entry(0, 2, 60, 7),
      entry(0, 5, 120, 6),

      entry(1, 0, 60, 5),
      entry(1, 2, 60, 6.9),
      entry(1, 5, 120, 6),

      ...Array.from({ length: 10 }, (_, i) => entry(2 + i, 0, 60, 5)),
    ]
    const r = analyzePerfectWeek({ log, today: TODAY })
    expect(r.weeks[0].hadHard).toBe(true)
    expect(r.weeks[1].hadHard).toBe(false)
  })

  it('90 min is the long threshold (inclusive)', () => {
    const log = [
      // 90 min exactly → hadLong true
      entry(0, 0, 60, 5),
      entry(0, 2, 60, 7),
      entry(0, 5, 90, 6),
      // 89 min → hadLong false
      entry(1, 0, 60, 5),
      entry(1, 2, 60, 7),
      entry(1, 5, 89, 6),

      ...Array.from({ length: 10 }, (_, i) => entry(2 + i, 0, 60, 5)),
    ]
    const r = analyzePerfectWeek({ log, today: TODAY })
    expect(r.weeks[0].hadLong).toBe(true)
    expect(r.weeks[0].isPerfect).toBe(true)
    expect(r.weeks[1].hadLong).toBe(false)
    expect(r.weeks[1].isPerfect).toBe(false)
  })
})

describe('analyzePerfectWeek — mostCommonGap identification', () => {
  it('picks the highest-miss criterion', () => {
    // 12 weeks all active, none perfect. Construct distinct miss counts:
    //   missing sessions: 2 weeks (only 1 session)
    //   missing hard:     10 weeks (no RPE≥7)
    //   missing long:     3 weeks  (no ≥90 min entry)
    // Most common gap should be 'hard' (10).
    const log = []
    // 2 weeks with only 1 session — must include hard + long so the "hard"
    // and "long" gap counters don't also tick for them.
    for (let w = 0; w < 2; w++) {
      log.push(entry(w, 0, 120, 7)) // 1 session, hard, long
    }
    // 7 weeks with 3 sessions, long present, NO hard.
    for (let w = 2; w < 9; w++) {
      log.push(entry(w, 0, 60, 5))
      log.push(entry(w, 2, 60, 5))
      log.push(entry(w, 5, 120, 5))
    }
    // 3 weeks with 3 sessions, NO hard AND NO long.
    for (let w = 9; w < 12; w++) {
      log.push(entry(w, 0, 60, 5))
      log.push(entry(w, 2, 60, 5))
      log.push(entry(w, 4, 60, 5))
    }
    const r = analyzePerfectWeek({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.perfectWeeks).toBe(0)
    expect(r.mostCommonGap).toBe('hard')
  })

  it('tie-break order: sessions wins over hard wins over long', () => {
    // Build a scenario where missing-sessions ties missing-hard ties missing-long.
    // 12 weeks all 1-session-only, RPE 5, 60 min → every imperfect week misses
    // sessions AND hard AND long → all three counters = 12. Tie-breaks to 'sessions'.
    const log = []
    for (let w = 0; w < 12; w++) {
      log.push(entry(w, 0, 60, 5))
    }
    const r = analyzePerfectWeek({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.mostCommonGap).toBe('sessions')
  })

  it('tie-break: hard wins over long when sessions count is lower', () => {
    // 12 weeks each with 3+ sessions (no sessions gap), missing hard AND long
    // in all 12 weeks → tie hard vs long → 'hard' wins.
    const log = []
    for (let w = 0; w < 12; w++) {
      log.push(entry(w, 0, 60, 5))
      log.push(entry(w, 2, 60, 5))
      log.push(entry(w, 4, 60, 5))
    }
    const r = analyzePerfectWeek({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.mostCommonGap).toBe('hard')
  })

  it('long is picked when sessions and hard are not the leaders', () => {
    // 12 weeks each 3 sessions + RPE 7 present (no sessions/hard gap),
    // no ≥90 min entry → only "long" misses.
    const log = []
    for (let w = 0; w < 12; w++) {
      log.push(entry(w, 0, 60, 5))
      log.push(entry(w, 2, 60, 7))
      log.push(entry(w, 4, 60, 5))
    }
    const r = analyzePerfectWeek({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.mostCommonGap).toBe('long')
  })

  it('mostCommonGap is null when every week is perfect', () => {
    const log = []
    for (let w = 0; w < 12; w++) log.push(...perfectWeekEntries(w))
    const r = analyzePerfectWeek({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.perfectWeeks).toBe(12)
    expect(r.mostCommonGap).toBeNull()
  })
})

describe('analyzePerfectWeek — windowing', () => {
  it('ignores entries outside the 12-week window', () => {
    const log = [
      // Far-past entries → ignored.
      { date: '2025-01-01', durationMin: 120, rpe: 8 },
      { date: '2025-12-31', durationMin: 120, rpe: 8 },
      // In-window activity to clear gate.
      ...Array.from({ length: 12 }, (_, i) => entry(i, 0, 60, 5)),
    ]
    const r = analyzePerfectWeek({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.perfectWeeks).toBe(0)
  })

  it('reads entry.duration as a fallback when durationMin is absent', () => {
    // Same minutes via the legacy `duration` key.
    const log = []
    for (let w = 0; w < 12; w++) {
      log.push({ date: WEEKS[w], duration: 60, rpe: 5 })
      log.push({ date: addOffset(WEEKS[w], 2), duration: 60, rpe: 7 })
      log.push({ date: addOffset(WEEKS[w], 5), duration: 120, rpe: 6 })
    }
    const r = analyzePerfectWeek({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.perfectWeeks).toBe(12)
  })
})

// Helper used in the `duration` fallback test.
function addOffset(weekStartIso, days) {
  const d = new Date(weekStartIso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
