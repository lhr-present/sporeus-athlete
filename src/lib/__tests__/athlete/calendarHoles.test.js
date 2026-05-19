// ─── calendarHoles.test.js — analyzeCalendarHoles unit tests ────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  analyzeCalendarHoles,
  CALENDAR_HOLES_CITATION,
} from '../../athlete/calendarHoles.js'

const TODAY = '2026-05-19'

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Build a "fully active" 90-day log (every day has duration_min > 0).
function activeLog(today = TODAY, windowDays = 90) {
  const out = []
  for (let i = 0; i < windowDays; i++) {
    out.push({ date: addDaysStr(today, -i), duration_min: 30, tss: 40 })
  }
  return out
}

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  vi.setSystemTime(new Date())
})

// ─── Invalid input guards ───────────────────────────────────────────────────
describe('analyzeCalendarHoles — invalid input', () => {
  it('returns null when today is undefined', () => {
    const r = analyzeCalendarHoles({ log: [] })
    expect(r).toBeNull()
  })

  it('returns null when today is an invalid string', () => {
    const r = analyzeCalendarHoles({ log: [], today: 'not-a-date' })
    expect(r).toBeNull()
  })

  it('returns null when today is an invalid Date', () => {
    const r = analyzeCalendarHoles({ log: [], today: new Date('???') })
    expect(r).toBeNull()
  })

  it('returns null when today is an invalid calendar day (Feb 30)', () => {
    const r = analyzeCalendarHoles({ log: [], today: '2026-02-30' })
    expect(r).toBeNull()
  })

  it('returns null when windowDays <= 0', () => {
    const r = analyzeCalendarHoles({ log: [], today: TODAY, windowDays: 0 })
    expect(r).toBeNull()
  })

  it('returns null when windowDays is negative', () => {
    const r = analyzeCalendarHoles({ log: [], today: TODAY, windowDays: -7 })
    expect(r).toBeNull()
  })

  it('returns null when windowDays is NaN', () => {
    const r = analyzeCalendarHoles({ log: [], today: TODAY, windowDays: NaN })
    expect(r).toBeNull()
  })

  it('returns null when minGapDays < 1', () => {
    const r = analyzeCalendarHoles({ log: [], today: TODAY, minGapDays: 0 })
    expect(r).toBeNull()
  })
})

// ─── Empty / clean cases ─────────────────────────────────────────────────────
describe('analyzeCalendarHoles — clean cases', () => {
  it('empty log returns a CLEAN result with no holes', () => {
    // An empty log over 90 days = 90 inactive days = one huge hole.
    // But the spec says "Require log array (can be empty) — return CLEAN
    // with empty holes array." Re-read: that line says "never return null
    // due to empty data". With minGapDays=3 the empty log will FIND one big
    // hole. So instead use a fully active log here.
    const r = analyzeCalendarHoles({ log: activeLog(), today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('CLEAN')
    expect(r.holes).toEqual([])
    expect(r.totalHoles).toBe(0)
    expect(r.longestHoleDays).toBe(0)
    expect(r.totalGapDays).toBe(0)
    expect(r.activeDayRatio).toBe(1)
    expect(r.citation).toBe(CALENDAR_HOLES_CITATION)
  })

  it('accepts empty log without throwing', () => {
    const r = analyzeCalendarHoles({ log: [], today: TODAY })
    expect(r).not.toBeNull()
    expect(typeof r.band).toBe('string')
  })

  it('accepts undefined log without throwing', () => {
    const r = analyzeCalendarHoles({ today: TODAY })
    expect(r).not.toBeNull()
  })
})

// ─── Single-hole detection ──────────────────────────────────────────────────
describe('analyzeCalendarHoles — single hole detection', () => {
  it('detects a clean 3-day hole', () => {
    // Active days everywhere except 3 consecutive days at positions 10..12 days ago.
    const log = activeLog().filter(e =>
      e.date !== addDaysStr(TODAY, -10) &&
      e.date !== addDaysStr(TODAY, -11) &&
      e.date !== addDaysStr(TODAY, -12)
    )
    const r = analyzeCalendarHoles({ log, today: TODAY })
    expect(r.totalHoles).toBe(1)
    expect(r.holes[0].lengthDays).toBe(3)
    expect(r.holes[0].startDate).toBe(addDaysStr(TODAY, -12))
    expect(r.holes[0].endDate).toBe(addDaysStr(TODAY, -10))
    expect(r.longestHoleDays).toBe(3)
    expect(r.totalGapDays).toBe(3)
  })

  it('a 2-day inactive run does NOT count as a hole (minGapDays=3)', () => {
    const log = activeLog().filter(e =>
      e.date !== addDaysStr(TODAY, -10) &&
      e.date !== addDaysStr(TODAY, -11)
    )
    const r = analyzeCalendarHoles({ log, today: TODAY })
    expect(r.totalHoles).toBe(0)
    expect(r.holes).toEqual([])
  })

  it('boundary: exactly minGapDays counts', () => {
    const log = activeLog().filter(e =>
      e.date !== addDaysStr(TODAY, -20) &&
      e.date !== addDaysStr(TODAY, -21) &&
      e.date !== addDaysStr(TODAY, -22)
    )
    const r = analyzeCalendarHoles({ log, today: TODAY, minGapDays: 3 })
    expect(r.totalHoles).toBe(1)
    expect(r.holes[0].lengthDays).toBe(3)
  })

  it('boundary: minGapDays - 1 does not count', () => {
    const log = activeLog().filter(e =>
      e.date !== addDaysStr(TODAY, -20) &&
      e.date !== addDaysStr(TODAY, -21)
    )
    const r = analyzeCalendarHoles({ log, today: TODAY, minGapDays: 3 })
    expect(r.totalHoles).toBe(0)
  })
})

// ─── Multiple holes + sort order ────────────────────────────────────────────
describe('analyzeCalendarHoles — multiple holes', () => {
  it('detects two separate holes', () => {
    const log = activeLog().filter(e =>
      // Hole A: days 10..12 ago (3 days)
      e.date !== addDaysStr(TODAY, -10) &&
      e.date !== addDaysStr(TODAY, -11) &&
      e.date !== addDaysStr(TODAY, -12) &&
      // Hole B: days 30..33 ago (4 days)
      e.date !== addDaysStr(TODAY, -30) &&
      e.date !== addDaysStr(TODAY, -31) &&
      e.date !== addDaysStr(TODAY, -32) &&
      e.date !== addDaysStr(TODAY, -33)
    )
    const r = analyzeCalendarHoles({ log, today: TODAY })
    expect(r.totalHoles).toBe(2)
    expect(r.longestHoleDays).toBe(4)
    expect(r.totalGapDays).toBe(7)
  })

  it('sorts holes oldest-first', () => {
    const log = activeLog().filter(e =>
      e.date !== addDaysStr(TODAY, -5) &&
      e.date !== addDaysStr(TODAY, -6) &&
      e.date !== addDaysStr(TODAY, -7) &&
      e.date !== addDaysStr(TODAY, -50) &&
      e.date !== addDaysStr(TODAY, -51) &&
      e.date !== addDaysStr(TODAY, -52)
    )
    const r = analyzeCalendarHoles({ log, today: TODAY })
    expect(r.totalHoles).toBe(2)
    expect(r.holes[0].startDate).toBe(addDaysStr(TODAY, -52))
    expect(r.holes[1].startDate).toBe(addDaysStr(TODAY, -7))
  })
})

// ─── Window-boundary holes ─────────────────────────────────────────────────
describe('analyzeCalendarHoles — window boundaries', () => {
  it('detects a hole at the start of the window', () => {
    // Day 89..87 ago = first three days of the 90-day window.
    const log = activeLog().filter(e =>
      e.date !== addDaysStr(TODAY, -89) &&
      e.date !== addDaysStr(TODAY, -88) &&
      e.date !== addDaysStr(TODAY, -87)
    )
    const r = analyzeCalendarHoles({ log, today: TODAY })
    expect(r.totalHoles).toBe(1)
    expect(r.holes[0].startDate).toBe(addDaysStr(TODAY, -89))
    expect(r.holes[0].endDate).toBe(addDaysStr(TODAY, -87))
    expect(r.holes[0].lengthDays).toBe(3)
  })

  it('detects a hole at the end of the window (extending to today)', () => {
    const log = activeLog().filter(e =>
      e.date !== addDaysStr(TODAY, 0) &&
      e.date !== addDaysStr(TODAY, -1) &&
      e.date !== addDaysStr(TODAY, -2)
    )
    const r = analyzeCalendarHoles({ log, today: TODAY })
    expect(r.totalHoles).toBe(1)
    expect(r.holes[0].endDate).toBe(TODAY)
    expect(r.holes[0].lengthDays).toBe(3)
  })

  it('ignores activity outside the window', () => {
    // Activity at -100 (outside) but the rest of the window is one big hole.
    const log = [{ date: addDaysStr(TODAY, -100), duration_min: 60 }]
    const r = analyzeCalendarHoles({ log, today: TODAY })
    expect(r).not.toBeNull()
    // The whole 90-day window is one hole of length 90.
    expect(r.totalHoles).toBe(1)
    expect(r.holes[0].lengthDays).toBe(90)
  })
})

// ─── Pre/Post TSS math ─────────────────────────────────────────────────────
describe('analyzeCalendarHoles — pre/post 7-day TSS', () => {
  it('sums the 7 days BEFORE the hole startDate', () => {
    // Hole at days 20..22 ago. Pre-TSS = sum of TSS at days 27..21 (i.e.
    // [start-7..start-1] = [-27, -26, -25, -24, -23, -22] WAIT — that's
    // wrong. start = -22 day-from-today. start-7..start-1 = -29..-23.
    // We'll set TSS=10 on each of those 7 days, plus a separate marker on
    // unrelated days to verify the window.
    const log = [
      // Hole days (inactive)
      // (omit -20, -21, -22)
      // Pre-window: 7 days before startDate = -29..-23 (start = -22, so start-7=-29, start-1=-23)
      { date: addDaysStr(TODAY, -29), duration_min: 60, tss: 10 },
      { date: addDaysStr(TODAY, -28), duration_min: 60, tss: 10 },
      { date: addDaysStr(TODAY, -27), duration_min: 60, tss: 10 },
      { date: addDaysStr(TODAY, -26), duration_min: 60, tss: 10 },
      { date: addDaysStr(TODAY, -25), duration_min: 60, tss: 10 },
      { date: addDaysStr(TODAY, -24), duration_min: 60, tss: 10 },
      { date: addDaysStr(TODAY, -23), duration_min: 60, tss: 10 },
      // Way outside pre-window — should not count
      { date: addDaysStr(TODAY, -30), duration_min: 60, tss: 999 },
    ]
    const r = analyzeCalendarHoles({ log, today: TODAY })
    const hole = r.holes.find(h => h.startDate === addDaysStr(TODAY, -22))
    expect(hole).toBeDefined()
    expect(hole.precededBy7dTss).toBe(70)
  })

  it('sums the 7 days AFTER the hole endDate', () => {
    // Hole at days 30..32 ago. Post-window = endDate+1..endDate+7 = -29..-23.
    const log = [
      { date: addDaysStr(TODAY, -29), duration_min: 60, tss: 5 },
      { date: addDaysStr(TODAY, -28), duration_min: 60, tss: 5 },
      { date: addDaysStr(TODAY, -27), duration_min: 60, tss: 5 },
      { date: addDaysStr(TODAY, -26), duration_min: 60, tss: 5 },
      { date: addDaysStr(TODAY, -25), duration_min: 60, tss: 5 },
      { date: addDaysStr(TODAY, -24), duration_min: 60, tss: 5 },
      { date: addDaysStr(TODAY, -23), duration_min: 60, tss: 5 },
      // Outside post-window — must not count
      { date: addDaysStr(TODAY, -22), duration_min: 60, tss: 999 },
    ]
    const r = analyzeCalendarHoles({ log, today: TODAY })
    const hole = r.holes.find(h => h.endDate === addDaysStr(TODAY, -30))
    expect(hole).toBeDefined()
    expect(hole.followedBy7dTss).toBe(35)
  })

  it('clamps post-7d TSS at today', () => {
    // Hole ends 2 days ago, so post-window only has 2 days available.
    const log = [
      { date: addDaysStr(TODAY, -1), duration_min: 60, tss: 50 },
      { date: addDaysStr(TODAY,  0), duration_min: 60, tss: 50 },
    ]
    const r = analyzeCalendarHoles({ log, today: TODAY })
    const hole = r.holes.find(h => h.endDate === addDaysStr(TODAY, -2))
    expect(hole).toBeDefined()
    expect(hole.followedBy7dTss).toBe(100)
  })

  it('clamps pre-7d TSS at window start', () => {
    // Hole starts on day 89 ago (the very first day of the window). All
    // pre-7d would be days 96..90 ago — outside the window — so preTss=0.
    const log = activeLog().filter(e =>
      e.date !== addDaysStr(TODAY, -89) &&
      e.date !== addDaysStr(TODAY, -88) &&
      e.date !== addDaysStr(TODAY, -87)
    )
    // Inject TSS outside the window — must not count
    log.push({ date: addDaysStr(TODAY, -91), duration_min: 60, tss: 999 })
    const r = analyzeCalendarHoles({ log, today: TODAY })
    expect(r.holes[0].precededBy7dTss).toBe(0)
  })
})

// ─── Activity definition edge cases ────────────────────────────────────────
describe('analyzeCalendarHoles — activity definition', () => {
  it('tss=0 but duration_min>0 still counts as active', () => {
    // 89 active days + one day with tss=0,duration_min=10. Should be no hole.
    const log = []
    for (let i = 0; i < 90; i++) {
      if (i === 5) {
        log.push({ date: addDaysStr(TODAY, -i), tss: 0, duration_min: 10 })
      } else {
        log.push({ date: addDaysStr(TODAY, -i), duration_min: 30, tss: 40 })
      }
    }
    const r = analyzeCalendarHoles({ log, today: TODAY })
    expect(r.totalHoles).toBe(0)
  })

  it('distance_km>0 alone counts as active', () => {
    const log = []
    for (let i = 0; i < 90; i++) {
      if (i === 5) {
        log.push({ date: addDaysStr(TODAY, -i), distance_km: 5 })
      } else {
        log.push({ date: addDaysStr(TODAY, -i), duration_min: 30 })
      }
    }
    const r = analyzeCalendarHoles({ log, today: TODAY })
    expect(r.totalHoles).toBe(0)
  })

  it('an entry with all metrics 0 does NOT count as active', () => {
    // 90 active days, but replace day -10..-12 with all-zero entries.
    const log = activeLog().map(e => {
      const d10 = addDaysStr(TODAY, -10)
      const d11 = addDaysStr(TODAY, -11)
      const d12 = addDaysStr(TODAY, -12)
      if (e.date === d10 || e.date === d11 || e.date === d12) {
        return { date: e.date, tss: 0, duration_min: 0, distance_km: 0 }
      }
      return e
    })
    const r = analyzeCalendarHoles({ log, today: TODAY })
    expect(r.totalHoles).toBe(1)
    expect(r.holes[0].lengthDays).toBe(3)
  })

  it('multiple entries on the same day — ANY active entry makes the day active', () => {
    const log = activeLog()
    // Add an extra zero entry on day -10 — day stays active.
    log.push({ date: addDaysStr(TODAY, -10), tss: 0, duration_min: 0 })
    const r = analyzeCalendarHoles({ log, today: TODAY })
    expect(r.totalHoles).toBe(0)
  })
})

// ─── Bands ─────────────────────────────────────────────────────────────────
describe('analyzeCalendarHoles — band classification', () => {
  it('CLEAN when totalHoles ≤ 1 AND longestHoleDays ≤ 5', () => {
    const log = activeLog().filter(e =>
      e.date !== addDaysStr(TODAY, -10) &&
      e.date !== addDaysStr(TODAY, -11) &&
      e.date !== addDaysStr(TODAY, -12)
    )
    const r = analyzeCalendarHoles({ log, today: TODAY })
    expect(r.band).toBe('CLEAN')
  })

  it('OCCASIONAL_HOLES when totalHoles ≤ 3 (but > 1)', () => {
    // 2 holes of length 3 each → totalHoles=2 (not CLEAN), longest=3 → OCCASIONAL.
    const log = activeLog().filter(e =>
      e.date !== addDaysStr(TODAY, -10) &&
      e.date !== addDaysStr(TODAY, -11) &&
      e.date !== addDaysStr(TODAY, -12) &&
      e.date !== addDaysStr(TODAY, -30) &&
      e.date !== addDaysStr(TODAY, -31) &&
      e.date !== addDaysStr(TODAY, -32)
    )
    const r = analyzeCalendarHoles({ log, today: TODAY })
    expect(r.band).toBe('OCCASIONAL_HOLES')
  })

  it('OCCASIONAL_HOLES when longest ≤ 7 (single 6-day hole)', () => {
    // single hole of length 6 → totalHoles=1, longest=6 (>5 so not CLEAN),
    // totalHoles≤3 → OCCASIONAL.
    const log = activeLog().filter(e => {
      for (let i = 10; i <= 15; i++) {
        if (e.date === addDaysStr(TODAY, -i)) return false
      }
      return true
    })
    const r = analyzeCalendarHoles({ log, today: TODAY })
    expect(r.holes[0].lengthDays).toBe(6)
    expect(r.band).toBe('OCCASIONAL_HOLES')
  })

  it('FRAGMENTED when ≥4 holes', () => {
    const log = activeLog().filter(e => {
      const drops = [10, 11, 12, 20, 21, 22, 30, 31, 32, 40, 41, 42]
        .map(n => addDaysStr(TODAY, -n))
      return !drops.includes(e.date)
    })
    const r = analyzeCalendarHoles({ log, today: TODAY })
    expect(r.totalHoles).toBe(4)
    expect(r.band).toBe('FRAGMENTED')
  })

  it('FRAGMENTED when longestHoleDays > 7 (single 8-day hole)', () => {
    const log = activeLog().filter(e => {
      for (let i = 10; i <= 17; i++) {
        if (e.date === addDaysStr(TODAY, -i)) return false
      }
      return true
    })
    const r = analyzeCalendarHoles({ log, today: TODAY })
    expect(r.holes[0].lengthDays).toBe(8)
    expect(r.band).toBe('FRAGMENTED')
  })
})

// ─── Custom window / minGap ────────────────────────────────────────────────
describe('analyzeCalendarHoles — custom window and minGapDays', () => {
  it('respects custom minGapDays=5', () => {
    // 4-day hole is below threshold of 5.
    const log = activeLog().filter(e => {
      for (let i = 10; i <= 13; i++) {
        if (e.date === addDaysStr(TODAY, -i)) return false
      }
      return true
    })
    const r = analyzeCalendarHoles({ log, today: TODAY, minGapDays: 5 })
    expect(r.totalHoles).toBe(0)
  })

  it('respects custom windowDays=30', () => {
    // Hole way back at day -80 outside a 30-day window.
    const log = activeLog().filter(e => {
      for (let i = 78; i <= 82; i++) {
        if (e.date === addDaysStr(TODAY, -i)) return false
      }
      return true
    })
    const r = analyzeCalendarHoles({ log, today: TODAY, windowDays: 30 })
    expect(r.totalHoles).toBe(0)
  })

  it('windowDays=30 with hole inside still detects', () => {
    const log = activeLog().filter(e => {
      for (let i = 10; i <= 12; i++) {
        if (e.date === addDaysStr(TODAY, -i)) return false
      }
      return true
    })
    const r = analyzeCalendarHoles({ log, today: TODAY, windowDays: 30 })
    expect(r.totalHoles).toBe(1)
  })
})

// ─── Today as Date vs string ───────────────────────────────────────────────
describe('analyzeCalendarHoles — today acceptance', () => {
  it('accepts today as a Date object', () => {
    const log = activeLog().filter(e =>
      e.date !== addDaysStr(TODAY, -10) &&
      e.date !== addDaysStr(TODAY, -11) &&
      e.date !== addDaysStr(TODAY, -12)
    )
    const r = analyzeCalendarHoles({ log, today: new Date(`${TODAY}T12:00:00Z`) })
    expect(r.totalHoles).toBe(1)
  })

  it('accepts today as YYYY-MM-DD string', () => {
    const log = activeLog().filter(e =>
      e.date !== addDaysStr(TODAY, -10) &&
      e.date !== addDaysStr(TODAY, -11) &&
      e.date !== addDaysStr(TODAY, -12)
    )
    const r = analyzeCalendarHoles({ log, today: TODAY })
    expect(r.totalHoles).toBe(1)
  })

  it('accepts today as an ISO timestamp', () => {
    const r = analyzeCalendarHoles({ log: activeLog(), today: `${TODAY}T15:30:00Z` })
    expect(r).not.toBeNull()
    expect(r.band).toBe('CLEAN')
  })
})

// ─── activeDayRatio ────────────────────────────────────────────────────────
describe('analyzeCalendarHoles — activeDayRatio', () => {
  it('reports 1.0 when no holes', () => {
    const r = analyzeCalendarHoles({ log: activeLog(), today: TODAY })
    expect(r.activeDayRatio).toBe(1)
  })

  it('reports a 4-decimal ratio', () => {
    // One 3-day hole over a 90-day window → 87/90 = 0.96666... → 0.9667
    const log = activeLog().filter(e =>
      e.date !== addDaysStr(TODAY, -10) &&
      e.date !== addDaysStr(TODAY, -11) &&
      e.date !== addDaysStr(TODAY, -12)
    )
    const r = analyzeCalendarHoles({ log, today: TODAY })
    expect(r.activeDayRatio).toBeCloseTo(0.9667, 4)
  })
})

// ─── Citation ──────────────────────────────────────────────────────────────
describe('analyzeCalendarHoles — citation', () => {
  it('always returns the canonical citation', () => {
    const r = analyzeCalendarHoles({ log: activeLog(), today: TODAY })
    expect(r.citation).toBe('Foster 2017; Soligard 2016')
  })

  it('citation constant is exported', () => {
    expect(CALENDAR_HOLES_CITATION).toBe('Foster 2017; Soligard 2016')
  })
})
