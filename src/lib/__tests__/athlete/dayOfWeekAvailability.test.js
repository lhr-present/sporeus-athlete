// ─── dayOfWeekAvailability.test.js — pattern + edge-case unit tests ─────────
import { describe, it, expect } from 'vitest'
import { analyzeDayOfWeekAvailability, DAY_OF_WEEK_AVAILABILITY_CITATION }
  from '../../athlete/dayOfWeekAvailability.js'

// ─── Setup ──────────────────────────────────────────────────────────────────
// today=Mon 2026-04-27. Window = 12 weeks (Mon-Sun) ending in week containing
// today. Monday of today's week = 2026-04-27. Window start = 11 weeks before =
// 2026-04-27 - 77 days = 2026-02-09 (Mon). Window end = 2026-05-03 (Sun).
const TODAY = '2026-04-27'
const WINDOW_START = '2026-02-09' // Monday

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Build a log over `weeks` consecutive weeks starting at WINDOW_START.
 * `weeksByDay` is an array of 7 numbers Mon=0..Sun=6: how many of the first
 * `weeksByDay[d]` weeks contain a session on weekday d. We start from week 0.
 */
function makeLogByDayCount(weeksByDay, weeks = 12, tss = 60) {
  const log = []
  for (let d = 0; d < 7; d++) {
    const n = Math.min(weeksByDay[d], weeks)
    for (let w = 0; w < n; w++) {
      log.push({
        date: addDays(WINDOW_START, w * 7 + d),
        tss,
        type: 'run',
      })
    }
  }
  return log
}

// ─── 1. Null cases ──────────────────────────────────────────────────────────
describe('analyzeDayOfWeekAvailability — null cases', () => {
  it('returns null for empty log', () => {
    expect(analyzeDayOfWeekAvailability({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null for non-array log', () => {
    expect(analyzeDayOfWeekAvailability({ log: null, today: TODAY })).toBeNull()
    expect(analyzeDayOfWeekAvailability({ log: undefined, today: TODAY })).toBeNull()
  })

  it('returns null when no entries inside the window', () => {
    const log = [
      { date: '2025-01-01', tss: 60, type: 'run' },
      { date: '2025-02-01', tss: 50, type: 'run' },
    ]
    expect(analyzeDayOfWeekAvailability({ log, today: TODAY })).toBeNull()
  })

  it('returns null when fewer than 6 of 12 weeks have any sessions', () => {
    // 5 active weeks → below threshold
    const log = []
    for (let w = 0; w < 5; w++) {
      log.push({ date: addDays(WINDOW_START, w * 7), tss: 60, type: 'run' })
    }
    expect(analyzeDayOfWeekAvailability({ log, today: TODAY })).toBeNull()
  })

  it('returns a result at exactly 6 active weeks (boundary)', () => {
    // 6 active weeks → just makes the floor
    const log = []
    for (let w = 0; w < 6; w++) {
      log.push({ date: addDays(WINDOW_START, w * 7), tss: 60, type: 'run' })
    }
    const r = analyzeDayOfWeekAvailability({ log, today: TODAY })
    expect(r).not.toBeNull()
  })
})

// ─── 2. Return shape ────────────────────────────────────────────────────────
describe('analyzeDayOfWeekAvailability — return shape', () => {
  it('returns full structure with citation', () => {
    const log = makeLogByDayCount([12, 12, 12, 12, 12, 12, 12])
    const r = analyzeDayOfWeekAvailability({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.pattern).toBeDefined()
    expect(r.days).toHaveLength(7)
    expect(r.anchorDays).toBeDefined()
    expect(r.weakDays).toBeDefined()
    expect(r.averageRate).toBeGreaterThan(0)
    expect(r.weeksInWindow).toBe(12)
    expect(r.citation).toBe(DAY_OF_WEEK_AVAILABILITY_CITATION)
    expect(r.citation).toMatch(/Bompa 2018/)
    expect(r.citation).toMatch(/Issurin 2010/)
  })

  it('days array is Mon=0..Sun=6 with bilingual labels', () => {
    const log = makeLogByDayCount([12, 12, 12, 12, 12, 12, 12])
    const r = analyzeDayOfWeekAvailability({ log, today: TODAY })
    expect(r.days[0].dayLabelEn).toBe('MON')
    expect(r.days[0].dayLabelTr).toBe('PZT')
    expect(r.days[2].dayLabelEn).toBe('WED')
    expect(r.days[2].dayLabelTr).toBe('ÇAR')
    expect(r.days[6].dayLabelEn).toBe('SUN')
    expect(r.days[6].dayLabelTr).toBe('PAZ')
  })
})

// ─── 3. Rate math ───────────────────────────────────────────────────────────
describe('analyzeDayOfWeekAvailability — rate math', () => {
  it('count = unique dates per weekday; rate = count / weeksInWindow', () => {
    // 12 of 12 Mondays → rate 1.0; 6 of 12 Tuesdays → rate 0.5; 0 Wednesdays → 0
    const log = makeLogByDayCount([12, 6, 0, 12, 12, 12, 12])
    const r = analyzeDayOfWeekAvailability({ log, today: TODAY })
    expect(r.days[0].count).toBe(12)
    expect(r.days[0].rate).toBe(1)
    expect(r.days[1].count).toBe(6)
    expect(r.days[1].rate).toBe(0.5)
    expect(r.days[2].count).toBe(0)
    expect(r.days[2].rate).toBe(0)
  })

  it('multiple sessions on the same date count as one trained day', () => {
    // Two sessions on the same Monday → count=1, not 2
    const log = [
      { date: WINDOW_START, tss: 60, type: 'run' },
      { date: WINDOW_START, tss: 40, type: 'bike' },
      // Pad to ≥6 active weeks
      ...Array.from({ length: 6 }, (_, w) => ({
        date: addDays(WINDOW_START, (w + 1) * 7),
        tss: 60,
        type: 'run',
      })),
    ]
    const r = analyzeDayOfWeekAvailability({ log, today: TODAY })
    expect(r).not.toBeNull()
    // Monday count = 7 (week 0 + weeks 1-6)
    expect(r.days[0].count).toBe(7)
  })
})

// ─── 4. Pattern classification — STRUCTURED ─────────────────────────────────
describe('analyzeDayOfWeekAvailability — STRUCTURED', () => {
  it('classifies as STRUCTURED when ≥3 anchors AND ≥1 weak day', () => {
    // 12/12 Mon, Tue, Wed (rate 1.0 — anchors) + 12/12 Fri (anchor)
    // 2/12 Sun (rate ~0.167 → weak)
    // Thu/Sat: 6/12 (rate 0.5 — neutral)
    const log = makeLogByDayCount([12, 12, 12, 6, 12, 6, 2])
    const r = analyzeDayOfWeekAvailability({ log, today: TODAY })
    expect(r.pattern).toBe('STRUCTURED')
    expect(r.anchorDays.length).toBeGreaterThanOrEqual(3)
    expect(r.weakDays.length).toBeGreaterThanOrEqual(1)
  })
})

// ─── 5. Pattern classification — OPPORTUNISTIC ──────────────────────────────
describe('analyzeDayOfWeekAvailability — OPPORTUNISTIC', () => {
  it('classifies as OPPORTUNISTIC when avg ≥ 0.30 but no clear structure', () => {
    // All 7 weekdays at 6/12 = 0.5 → avg 0.5 (above SPARSE 0.30)
    // No day ≥ 0.75 (no anchors); no day ≤ 0.25 (no weak)
    // → not STRUCTURED, not SPARSE → OPPORTUNISTIC
    const log = makeLogByDayCount([6, 6, 6, 6, 6, 6, 6])
    const r = analyzeDayOfWeekAvailability({ log, today: TODAY })
    expect(r.pattern).toBe('OPPORTUNISTIC')
    expect(r.anchorDays.length).toBe(0)
    expect(r.weakDays.length).toBe(0)
  })

  it('OPPORTUNISTIC when anchors exist but no weak day', () => {
    // Mon/Tue/Wed/Thu at 12/12 (anchors), Fri/Sat/Sun at 6/12 (neutral)
    // 4 anchors, 0 weak → not STRUCTURED (needs ≥1 weak)
    // avg = (1+1+1+1+0.5+0.5+0.5)/7 ≈ 0.643 → not SPARSE
    // → OPPORTUNISTIC
    const log = makeLogByDayCount([12, 12, 12, 12, 6, 6, 6])
    const r = analyzeDayOfWeekAvailability({ log, today: TODAY })
    expect(r.pattern).toBe('OPPORTUNISTIC')
    expect(r.anchorDays.length).toBe(4)
    expect(r.weakDays.length).toBe(0)
  })
})

// ─── 6. Pattern classification — SPARSE ─────────────────────────────────────
describe('analyzeDayOfWeekAvailability — SPARSE', () => {
  it('classifies as SPARSE when averageRate < 0.30', () => {
    // All 7 days at 2/12 ≈ 0.167 → avg ~0.167 < 0.30
    // ≥6 active weeks: 2 weeks per day × 7 days, but we need 6 distinct weeks.
    // makeLogByDayCount puts sessions on weeks 0..n-1 for each weekday.
    // With weeksByDay=[2,2,2,2,2,2,2] → only weeks 0 and 1 are active → 2 weeks!
    // Need to spread across more weeks. Use a manual log instead.
    const log = []
    // 7 weekday entries each in distinct early weeks (one per week) to hit >=6
    for (let w = 0; w < 7; w++) {
      log.push({
        date: addDays(WINDOW_START, w * 7), // Mon of week w
        tss: 60,
        type: 'run',
      })
    }
    // Now Mondays: 7/12 rate 0.583 — too high. Want each day low.
    // Let me think: SPARSE needs avg < 0.30. Spread thinly across all days.
    // Use 1 session per weekday but across 6+ distinct weeks.
    const sparseLog = []
    // week 0: Mon (idx 0)
    sparseLog.push({ date: addDays(WINDOW_START, 0), tss: 60, type: 'run' })
    // week 1: Tue (idx 1)
    sparseLog.push({ date: addDays(WINDOW_START, 1 * 7 + 1), tss: 60, type: 'run' })
    // week 2: Wed
    sparseLog.push({ date: addDays(WINDOW_START, 2 * 7 + 2), tss: 60, type: 'run' })
    // week 3: Thu
    sparseLog.push({ date: addDays(WINDOW_START, 3 * 7 + 3), tss: 60, type: 'run' })
    // week 4: Fri
    sparseLog.push({ date: addDays(WINDOW_START, 4 * 7 + 4), tss: 60, type: 'run' })
    // week 5: Sat
    sparseLog.push({ date: addDays(WINDOW_START, 5 * 7 + 5), tss: 60, type: 'run' })
    // week 6: Sun
    sparseLog.push({ date: addDays(WINDOW_START, 6 * 7 + 6), tss: 60, type: 'run' })
    // 7 active weeks ✓ ≥6. Each weekday count = 1, rate = 1/12 ≈ 0.083
    // avg ≈ 0.083 < 0.30 → SPARSE
    const r = analyzeDayOfWeekAvailability({ log: sparseLog, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.pattern).toBe('SPARSE')
    expect(r.averageRate).toBeLessThan(0.30)
  })
})

// ─── 7. Boundary tests — anchor at 0.75, weak at 0.25 ───────────────────────
describe('analyzeDayOfWeekAvailability — anchor/weak boundaries', () => {
  it('rate exactly 0.75 → counted as anchor (≥ 0.75)', () => {
    // 9/12 = 0.75 exactly on Monday — should be anchor
    // Pad active weeks to ≥6 with other days
    const log = makeLogByDayCount([9, 0, 0, 0, 0, 0, 0])
    // Only 9 active weeks (weeks 0-8). Plus 0 elsewhere → activeWeekSet=9 ≥6 ✓
    const r = analyzeDayOfWeekAvailability({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.days[0].rate).toBe(0.75)
    expect(r.anchorDays.find(d => d.dayIndex === 0)).toBeDefined()
  })

  it('rate exactly 0.25 → counted as weak (≤ 0.25)', () => {
    // 3/12 = 0.25 exactly on Sunday — should be weak
    // Mix with other days to give enough active weeks
    const log = []
    // 3 Sundays (weeks 0, 1, 2)
    for (let w = 0; w < 3; w++) {
      log.push({ date: addDays(WINDOW_START, w * 7 + 6), tss: 60, type: 'run' })
    }
    // Pad active weeks to ≥6 with Mondays
    for (let w = 3; w < 9; w++) {
      log.push({ date: addDays(WINDOW_START, w * 7), tss: 60, type: 'run' })
    }
    const r = analyzeDayOfWeekAvailability({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.days[6].rate).toBe(0.25)
    expect(r.weakDays.find(d => d.dayIndex === 6)).toBeDefined()
  })

  it('rate just above 0.75 → anchor; just below → not anchor', () => {
    // 10/12 = 0.833 → anchor; 8/12 = 0.667 → not anchor
    const log = makeLogByDayCount([10, 8, 0, 0, 0, 0, 0])
    const r = analyzeDayOfWeekAvailability({ log, today: TODAY })
    expect(r.days[0].rate).toBeCloseTo(0.8333, 3)
    expect(r.days[1].rate).toBeCloseTo(0.6667, 3)
    expect(r.anchorDays.find(d => d.dayIndex === 0)).toBeDefined()
    expect(r.anchorDays.find(d => d.dayIndex === 1)).toBeUndefined()
  })
})

// ─── 8. windowWeeks override ────────────────────────────────────────────────
describe('analyzeDayOfWeekAvailability — windowWeeks option', () => {
  it('default windowWeeks=12 works without override', () => {
    const log = makeLogByDayCount([12, 12, 12, 12, 12, 12, 12])
    const r = analyzeDayOfWeekAvailability({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.weeksInWindow).toBe(12)
  })

  it('respects custom windowWeeks (e.g., 8)', () => {
    // With windowWeeks=8, window is 8 weeks ending in today's week.
    // Today=Mon 2026-04-27. Mon-of-week=2026-04-27. Window start =
    // 2026-04-27 - 7*7 = 2026-03-09. Sessions before that fall outside.
    // makeLogByDayCount puts sessions starting at WINDOW_START=2026-02-09,
    // i.e. 4 weeks before the 8-week-window start → first 4 weeks excluded.
    // weeks 4..11 (8 weeks) fall inside.
    const log = makeLogByDayCount([12, 12, 12, 12, 12, 12, 12])
    const r = analyzeDayOfWeekAvailability({ log, today: TODAY, windowWeeks: 8 })
    expect(r).not.toBeNull()
    expect(r.weeksInWindow).toBe(8)
    // Each weekday: 8 entries within the 8-week window → rate 1.0
    expect(r.days[0].rate).toBe(1)
  })

  it('windowWeeks override changes the MIN_ACTIVE_WEEKS floor reference', () => {
    // Even with windowWeeks=8, the floor is hard-coded to 6 active weeks
    // (we check `activeWeekSet.size < 6`). With only 5 active weeks → null.
    const log = []
    for (let w = 0; w < 5; w++) {
      log.push({ date: addDays(WINDOW_START, w * 7), tss: 60, type: 'run' })
    }
    expect(
      analyzeDayOfWeekAvailability({ log, today: TODAY, windowWeeks: 8 })
    ).toBeNull()
  })
})

// ─── 9. Window boundary ─────────────────────────────────────────────────────
describe('analyzeDayOfWeekAvailability — window boundary', () => {
  it('excludes entries outside the trailing 12-week window', () => {
    const log = makeLogByDayCount([12, 12, 12, 12, 12, 12, 12])
    log.push({ date: '2020-01-01', tss: 9999, type: 'run' })
    log.push({ date: '2026-12-31', tss: 9999, type: 'run' })
    const r = analyzeDayOfWeekAvailability({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.days[0].rate).toBe(1)
  })
})
