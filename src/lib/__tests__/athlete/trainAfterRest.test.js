// ─── trainAfterRest.test.js — analyzer unit tests ──────────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  analyzeTrainAfterRest,
  TRAIN_AFTER_REST_CITATION,
} from '../../athlete/trainAfterRest.js'

const TODAY = '2026-05-19'
const DEFAULT_WINDOW = 60
// Window: [todayIso - 59 .. todayIso] inclusive = 60 days.
// 2026-05-19 minus 59d = 2026-03-21.
const WINDOW_START = '2026-03-21'

function addDaysIso(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Helper: { tssByDate: {'2026-03-21': 50, ...} } → log array. dayTss=0 entries
// are written as zero-tss rows so that they remain "REST" (the analyzer
// requires positive TSS to count a day as training).
function logFromTssMap(tssByDate) {
  const out = []
  for (const date in tssByDate) {
    out.push({ date, tss: tssByDate[date] })
  }
  return out
}

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  vi.setSystemTime(new Date())
})

// ─── Invalid today ──────────────────────────────────────────────────────────
describe('analyzeTrainAfterRest — invalid today', () => {
  it('returns null when today is undefined', () => {
    expect(analyzeTrainAfterRest({ log: [] })).toBeNull()
  })
  it('returns null when today is an invalid string', () => {
    expect(analyzeTrainAfterRest({ log: [], today: 'nope' })).toBeNull()
  })
  it('returns null when today is an invalid Date object', () => {
    expect(analyzeTrainAfterRest({ log: [], today: new Date('xxx') })).toBeNull()
  })
  it('returns null on a calendar-impossible date (Feb 30)', () => {
    expect(analyzeTrainAfterRest({ log: [], today: '2026-02-30' })).toBeNull()
  })
})

// ─── INSUFFICIENT_REBOUND_DAYS band ─────────────────────────────────────────
describe('analyzeTrainAfterRest — INSUFFICIENT_REBOUND_DAYS', () => {
  it('empty log → INSUFFICIENT with zeros', () => {
    const r = analyzeTrainAfterRest({ log: [], today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('INSUFFICIENT_REBOUND_DAYS')
    expect(r.postRestCount).toBe(0)
    expect(r.meanPostRestTss).toBe(0)
    expect(r.meanTrainingDayTss).toBe(0)
    expect(r.reboundRatio).toBe(0)
    expect(r.postRestSessions).toEqual([])
  })

  it('3 post-rest training days (< 4 threshold) → INSUFFICIENT', () => {
    // Build training days separated by rest days. Three rest→train transitions.
    const log = [
      { date: addDaysIso(WINDOW_START, 0), tss: 50 },
      // rest day 1
      { date: addDaysIso(WINDOW_START, 2), tss: 60 },  // post-rest #1
      // rest day 3
      { date: addDaysIso(WINDOW_START, 4), tss: 70 },  // post-rest #2
      // rest day 5
      { date: addDaysIso(WINDOW_START, 6), tss: 80 },  // post-rest #3
    ]
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    expect(r.postRestCount).toBe(3)
    expect(r.band).toBe('INSUFFICIENT_REBOUND_DAYS')
  })

  it('zero TSS log entries still counted as rest (not training)', () => {
    // Every day has a zero-TSS entry → no training, no post-rest.
    const map = {}
    for (let i = 0; i < DEFAULT_WINDOW; i++) {
      map[addDaysIso(WINDOW_START, i)] = 0
    }
    const r = analyzeTrainAfterRest({ log: logFromTssMap(map), today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_REBOUND_DAYS')
    expect(r.postRestCount).toBe(0)
    expect(r.meanTrainingDayTss).toBe(0)
  })
})

// ─── CONSERVATIVE_REBOUND band ──────────────────────────────────────────────
describe('analyzeTrainAfterRest — CONSERVATIVE_REBOUND', () => {
  it('reboundRatio = 0.5 → CONSERVATIVE_REBOUND', () => {
    // Training-day pattern: alternate rest-train-train, so we get plenty of
    // post-rest days AND non-post-rest training days. Make post-rest days low
    // TSS (40) and the next training day high TSS (160). Mean training-day
    // TSS = 100; mean post-rest = 40; ratio = 0.4.
    // Pattern repeating every 3 days: R / 40 / 160.
    const map = {}
    for (let i = 0; i < DEFAULT_WINDOW; i++) {
      const mod = i % 3
      if (mod === 0) continue  // rest day → no entry
      if (mod === 1) map[addDaysIso(WINDOW_START, i)] = 40  // post-rest
      if (mod === 2) map[addDaysIso(WINDOW_START, i)] = 160  // follow-up
    }
    const r = analyzeTrainAfterRest({ log: logFromTssMap(map), today: TODAY })
    expect(r.band).toBe('CONSERVATIVE_REBOUND')
    expect(r.reboundRatio).toBeLessThanOrEqual(0.85)
    expect(r.meanPostRestTss).toBe(40)
    expect(r.meanTrainingDayTss).toBe(100)
    expect(r.reboundRatio).toBe(0.4)
  })

  it('reboundRatio exactly at 0.85 ceiling → CONSERVATIVE_REBOUND', () => {
    // Force exactly 0.85: post-rest = 85, training avg = 100.
    // Pattern: R / 85 / 100 / 100 / 100 / 100 repeating (period 6 days).
    // Per period: 1 rest, 4 training days (85, 100, 100, 100, 100 + one
    // follow-up 100 → adjust).
    // Simpler: build 12 post-rest days at tss=85, then 12 non-post-rest
    // training days at tss=115 → ratio = 85/((85+115)/2)=85/100=0.85.
    const log = []
    // 12 "R / T_post=85 / T=115" sequences = 36 days
    for (let i = 0; i < 12; i++) {
      const base = i * 3
      // day base = rest, day base+1 = 85 (post-rest), day base+2 = 115
      log.push({ date: addDaysIso(WINDOW_START, base + 1), tss: 85 })
      log.push({ date: addDaysIso(WINDOW_START, base + 2), tss: 115 })
    }
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    expect(r.meanPostRestTss).toBe(85)
    expect(r.meanTrainingDayTss).toBe(100)
    expect(r.reboundRatio).toBe(0.85)
    expect(r.band).toBe('CONSERVATIVE_REBOUND')
  })
})

// ─── BALANCED band ─────────────────────────────────────────────────────────
describe('analyzeTrainAfterRest — BALANCED', () => {
  it('reboundRatio = 1.0 → BALANCED', () => {
    // Every training day = 100 TSS. Some are post-rest, some not.
    const map = {}
    for (let i = 0; i < DEFAULT_WINDOW; i++) {
      const mod = i % 3
      if (mod === 0) continue
      map[addDaysIso(WINDOW_START, i)] = 100
    }
    const r = analyzeTrainAfterRest({ log: logFromTssMap(map), today: TODAY })
    expect(r.band).toBe('BALANCED')
    expect(r.reboundRatio).toBe(1)
  })

  it('reboundRatio just above 0.85 → BALANCED', () => {
    // post-rest = 90, training avg = 100, ratio = 0.9 → BALANCED.
    const log = []
    for (let i = 0; i < 12; i++) {
      const base = i * 3
      log.push({ date: addDaysIso(WINDOW_START, base + 1), tss: 90 })
      log.push({ date: addDaysIso(WINDOW_START, base + 2), tss: 110 })
    }
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    expect(r.meanPostRestTss).toBe(90)
    expect(r.meanTrainingDayTss).toBe(100)
    expect(r.reboundRatio).toBe(0.9)
    expect(r.band).toBe('BALANCED')
  })

  it('reboundRatio just below 1.20 → BALANCED', () => {
    // post-rest = 119, training avg = 100, ratio = 1.19.
    // Use 119 post-rest + 81 follow-up → mean = 100.
    const log = []
    for (let i = 0; i < 12; i++) {
      const base = i * 3
      log.push({ date: addDaysIso(WINDOW_START, base + 1), tss: 119 })
      log.push({ date: addDaysIso(WINDOW_START, base + 2), tss: 81 })
    }
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    expect(r.meanPostRestTss).toBe(119)
    expect(r.meanTrainingDayTss).toBe(100)
    expect(r.reboundRatio).toBe(1.19)
    expect(r.band).toBe('BALANCED')
  })
})

// ─── AGGRESSIVE_REBOUND band ────────────────────────────────────────────────
describe('analyzeTrainAfterRest — AGGRESSIVE_REBOUND', () => {
  it('reboundRatio = 1.50 → AGGRESSIVE_REBOUND', () => {
    // Post-rest=150, follow-up=50 → training avg = 100, ratio = 1.5.
    const log = []
    for (let i = 0; i < 12; i++) {
      const base = i * 3
      log.push({ date: addDaysIso(WINDOW_START, base + 1), tss: 150 })
      log.push({ date: addDaysIso(WINDOW_START, base + 2), tss: 50 })
    }
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    expect(r.meanPostRestTss).toBe(150)
    expect(r.meanTrainingDayTss).toBe(100)
    expect(r.reboundRatio).toBe(1.5)
    expect(r.band).toBe('AGGRESSIVE_REBOUND')
  })

  it('reboundRatio exactly at 1.20 floor → AGGRESSIVE_REBOUND', () => {
    // post-rest=120, follow-up=80 → mean = 100, ratio = 1.20.
    const log = []
    for (let i = 0; i < 12; i++) {
      const base = i * 3
      log.push({ date: addDaysIso(WINDOW_START, base + 1), tss: 120 })
      log.push({ date: addDaysIso(WINDOW_START, base + 2), tss: 80 })
    }
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    expect(r.meanPostRestTss).toBe(120)
    expect(r.meanTrainingDayTss).toBe(100)
    expect(r.reboundRatio).toBe(1.2)
    expect(r.band).toBe('AGGRESSIVE_REBOUND')
  })
})

// ─── reboundRatio math ──────────────────────────────────────────────────────
describe('analyzeTrainAfterRest — reboundRatio math', () => {
  it('reboundRatio rounded to 4 decimal places', () => {
    // post-rest=100, training avg=70 → ratio = 100/70 = 1.428571… → 1.4286
    const log = []
    // 4 post-rest at 100, 4 non-post-rest at 40 → mean = 70.
    for (let i = 0; i < 4; i++) {
      const base = i * 3  // 3-day cycle: R / post / follow
      log.push({ date: addDaysIso(WINDOW_START, base + 1), tss: 100 })
      log.push({ date: addDaysIso(WINDOW_START, base + 2), tss: 40 })
    }
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    expect(r.meanPostRestTss).toBe(100)
    expect(r.meanTrainingDayTss).toBe(70)
    expect(r.reboundRatio).toBe(1.4286)
  })

  it('uses max(meanTrainingDayTss, 1) in the denominator', () => {
    // If every training day is < 1 TSS (e.g. all zero from filtering), the
    // formula uses 1 in the denominator. But since we need post-rest count
    // ≥ 4, and all training days would have tss>0, the smallest is 1.
    // Build: 4 training days at exactly 1 TSS, all post-rest.
    const log = []
    for (let i = 0; i < 4; i++) {
      log.push({ date: addDaysIso(WINDOW_START, i * 2 + 1), tss: 1 })
    }
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    expect(r.meanPostRestTss).toBe(1)
    expect(r.meanTrainingDayTss).toBe(1)
    expect(r.reboundRatio).toBe(1)
    expect(r.band).toBe('BALANCED')
  })

  it('meanPostRestTss and meanTrainingDayTss rounded to 2dp', () => {
    // Post-rest TSS: 33.33, 33.34, 33.33, 33.33 → mean = 33.3325 → 33.33.
    // Add some non-post-rest training too. Use distinct days.
    const log = [
      { date: addDaysIso(WINDOW_START, 1), tss: 33.33 },
      { date: addDaysIso(WINDOW_START, 3), tss: 33.34 },
      { date: addDaysIso(WINDOW_START, 5), tss: 33.33 },
      { date: addDaysIso(WINDOW_START, 7), tss: 33.33 },
    ]
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    expect(r.meanPostRestTss).toBe(33.33)
    expect(r.meanTrainingDayTss).toBe(33.33)
  })

  it('reboundRatio = 0 when meanPostRestTss = 0', () => {
    const r = analyzeTrainAfterRest({ log: [], today: TODAY })
    expect(r.reboundRatio).toBe(0)
  })
})

// ─── postRestSessions content ───────────────────────────────────────────────
describe('analyzeTrainAfterRest — postRestSessions', () => {
  it('sorted oldest-first', () => {
    const log = []
    for (let i = 0; i < 4; i++) {
      log.push({ date: addDaysIso(WINDOW_START, i * 2 + 1), tss: 50 })
    }
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    expect(r.postRestSessions.length).toBe(4)
    const dates = r.postRestSessions.map(s => s.date)
    const sorted = [...dates].sort()
    expect(dates).toEqual(sorted)
  })

  it('multi-day rest preceding — restDaysBefore counts ALL consecutive rest', () => {
    // Days 0-3 rest, day 4 train → restDaysBefore = 4.
    // Need 4 total post-rest sessions for non-INSUFFICIENT.
    const log = [
      { date: addDaysIso(WINDOW_START, 4), tss: 50 },
      // ... then 3 more post-rest events later in the window
      { date: addDaysIso(WINDOW_START, 10), tss: 50 },
      { date: addDaysIso(WINDOW_START, 15), tss: 50 },
      { date: addDaysIso(WINDOW_START, 20), tss: 50 },
    ]
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    expect(r.postRestSessions[0].restDaysBefore).toBe(4)
  })

  it('a 1-day rest gap gives restDaysBefore = 1', () => {
    const log = [
      { date: addDaysIso(WINDOW_START, 0), tss: 60 },
      { date: addDaysIso(WINDOW_START, 2), tss: 60 },  // post-rest, gap=1
      { date: addDaysIso(WINDOW_START, 4), tss: 60 },  // post-rest, gap=1
      { date: addDaysIso(WINDOW_START, 6), tss: 60 },  // post-rest, gap=1
      { date: addDaysIso(WINDOW_START, 8), tss: 60 },  // post-rest, gap=1
    ]
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    expect(r.postRestSessions.length).toBe(4)
    for (const s of r.postRestSessions) {
      expect(s.restDaysBefore).toBe(1)
    }
  })

  it('postRestSessions entries have round-2 dayTss', () => {
    const log = [
      { date: addDaysIso(WINDOW_START, 1), tss: 50.555 },
      { date: addDaysIso(WINDOW_START, 3), tss: 50 },
      { date: addDaysIso(WINDOW_START, 5), tss: 50 },
      { date: addDaysIso(WINDOW_START, 7), tss: 50 },
    ]
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    expect(r.postRestSessions[0].dayTss).toBe(50.56)
  })

  it('dayTss sums multiple entries on the same date', () => {
    // 2-a-day on a post-rest day: 30 + 40 = 70 TSS.
    const log = [
      { date: addDaysIso(WINDOW_START, 1), tss: 30 },
      { date: addDaysIso(WINDOW_START, 1), tss: 40 },
      { date: addDaysIso(WINDOW_START, 3), tss: 70 },
      { date: addDaysIso(WINDOW_START, 5), tss: 70 },
      { date: addDaysIso(WINDOW_START, 7), tss: 70 },
    ]
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    expect(r.postRestSessions[0].dayTss).toBe(70)
  })
})

// ─── Pre-window rest day handling ───────────────────────────────────────────
describe('analyzeTrainAfterRest — pre-window data', () => {
  it('a rest day BEFORE windowStart correctly marks day 0 as post-rest', () => {
    // Place a training session BEFORE the window starts (some far-past date)
    // to anchor "oldest seen" earlier than windowStart. Then place a rest
    // day immediately before windowStart (no entry, no anchor needed), and
    // a training session on windowStart day itself. Day 0 should be
    // detected as post-rest.
    const log = [
      // Anchor day far before windowStart (so oldestSeen is well prior)
      { date: addDaysIso(WINDOW_START, -10), tss: 50 },
      // No entry on day -1 (rest)
      { date: addDaysIso(WINDOW_START, 0), tss: 50 },   // post-rest, windowStart
      { date: addDaysIso(WINDOW_START, 2), tss: 50 },   // post-rest
      { date: addDaysIso(WINDOW_START, 4), tss: 50 },   // post-rest
      { date: addDaysIso(WINDOW_START, 6), tss: 50 },   // post-rest
    ]
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    expect(r.postRestSessions[0].date).toBe(addDaysIso(WINDOW_START, 0))
    // restDaysBefore should count from windowStart-1 back through to
    // windowStart-9 (since windowStart-10 was training). That's 9 rest days.
    expect(r.postRestSessions[0].restDaysBefore).toBe(9)
  })

  it('first day of window with NO prior log data does NOT count as post-rest', () => {
    // The log's oldest entry IS day 0 of the window. There's no observed
    // history before windowStart, so we cannot claim day 0 follows rest.
    // Day 0 should not be a post-rest session.
    const log = [
      { date: addDaysIso(WINDOW_START, 0), tss: 50 },   // earliest seen
      { date: addDaysIso(WINDOW_START, 2), tss: 50 },   // post-rest
      { date: addDaysIso(WINDOW_START, 4), tss: 50 },   // post-rest
      { date: addDaysIso(WINDOW_START, 6), tss: 50 },   // post-rest
      { date: addDaysIso(WINDOW_START, 8), tss: 50 },   // post-rest
    ]
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    // Day 0 IS earliest seen so its prior day was unobserved → not post-rest.
    const dates = r.postRestSessions.map(s => s.date)
    expect(dates).not.toContain(addDaysIso(WINDOW_START, 0))
    expect(r.postRestSessions.length).toBe(4)
  })

  it('day 0 IS post-rest when log has an explicit zero-TSS entry the day before', () => {
    // Explicit zero-TSS entry on day -1 confirms it as a real rest day.
    const log = [
      { date: addDaysIso(WINDOW_START, -1), tss: 0 },
      { date: addDaysIso(WINDOW_START, 0), tss: 50 },
      { date: addDaysIso(WINDOW_START, 2), tss: 50 },
      { date: addDaysIso(WINDOW_START, 4), tss: 50 },
      { date: addDaysIso(WINDOW_START, 6), tss: 50 },
    ]
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    const dates = r.postRestSessions.map(s => s.date)
    expect(dates).toContain(addDaysIso(WINDOW_START, 0))
  })
})

// ─── Non-finite TSS handling ────────────────────────────────────────────────
describe('analyzeTrainAfterRest — non-finite TSS ignored', () => {
  it('NaN tss treated as no training', () => {
    const log = [
      { date: addDaysIso(WINDOW_START, 0), tss: 'banana' },  // → NaN
      { date: addDaysIso(WINDOW_START, 1), tss: 50 },  // post-rest if day 0 is treated as rest
      { date: addDaysIso(WINDOW_START, 3), tss: 50 },
      { date: addDaysIso(WINDOW_START, 5), tss: 50 },
      { date: addDaysIso(WINDOW_START, 7), tss: 50 },
    ]
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    // Day 0 is "rest" because tss is NaN → ignored.
    expect(r.postRestSessions.find(s => s.date === addDaysIso(WINDOW_START, 1))).toBeDefined()
  })

  it('null tss ignored', () => {
    const log = [
      { date: addDaysIso(WINDOW_START, 0), tss: null },
      { date: addDaysIso(WINDOW_START, 2), tss: 50 },
      { date: addDaysIso(WINDOW_START, 4), tss: 50 },
      { date: addDaysIso(WINDOW_START, 6), tss: 50 },
      { date: addDaysIso(WINDOW_START, 8), tss: 50 },
    ]
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    expect(r.meanTrainingDayTss).toBe(50)
  })

  it('negative tss ignored', () => {
    const log = [
      { date: addDaysIso(WINDOW_START, 0), tss: -10 },
      { date: addDaysIso(WINDOW_START, 2), tss: 50 },
      { date: addDaysIso(WINDOW_START, 4), tss: 50 },
      { date: addDaysIso(WINDOW_START, 6), tss: 50 },
      { date: addDaysIso(WINDOW_START, 8), tss: 50 },
    ]
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    expect(r.meanTrainingDayTss).toBe(50)
  })

  it('Infinity tss ignored', () => {
    const log = [
      { date: addDaysIso(WINDOW_START, 0), tss: Infinity },
      { date: addDaysIso(WINDOW_START, 2), tss: 50 },
      { date: addDaysIso(WINDOW_START, 4), tss: 50 },
      { date: addDaysIso(WINDOW_START, 6), tss: 50 },
      { date: addDaysIso(WINDOW_START, 8), tss: 50 },
    ]
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    expect(r.meanTrainingDayTss).toBe(50)
  })
})

// ─── Custom windowDays ─────────────────────────────────────────────────────
describe('analyzeTrainAfterRest — custom windowDays', () => {
  it('respects custom windowDays = 14', () => {
    // Today=2026-05-19, 14-day window → windowStart = 2026-05-06.
    const start14 = '2026-05-06'
    const log = [
      { date: addDaysIso(start14, 1), tss: 100 },  // post-rest
      { date: addDaysIso(start14, 3), tss: 100 },
      { date: addDaysIso(start14, 5), tss: 100 },
      { date: addDaysIso(start14, 7), tss: 100 },
    ]
    const r = analyzeTrainAfterRest({ log, today: TODAY, windowDays: 14 })
    expect(r.postRestCount).toBe(4)
  })

  it('windowDays excludes events outside the window', () => {
    // 14-day window: anything before 2026-05-06 is out-of-window.
    // Place several training days well BEFORE the window to ensure they
    // are NOT counted in means/post-rest tallies.
    const log = []
    for (let i = 0; i < 20; i++) {
      // Days 2026-03-21 .. 2026-04-09 — all out of window for windowDays=14.
      log.push({ date: addDaysIso(WINDOW_START, i), tss: 999 })
    }
    // 4 valid post-rest events inside the 14-day window:
    const start14 = '2026-05-06'
    log.push({ date: addDaysIso(start14, 1), tss: 50 })
    log.push({ date: addDaysIso(start14, 3), tss: 50 })
    log.push({ date: addDaysIso(start14, 5), tss: 50 })
    log.push({ date: addDaysIso(start14, 7), tss: 50 })
    const r = analyzeTrainAfterRest({ log, today: TODAY, windowDays: 14 })
    // 20 out-of-window training days (tss=999) must NOT contribute to means.
    expect(r.postRestCount).toBe(4)
    expect(r.meanTrainingDayTss).toBe(50)
  })

  it('windowDays floored to 1 when zero or negative', () => {
    const r = analyzeTrainAfterRest({ log: [], today: TODAY, windowDays: 0 })
    expect(r).not.toBeNull()
    expect(r.band).toBe('INSUFFICIENT_REBOUND_DAYS')
  })
})

// ─── today as Date vs string ───────────────────────────────────────────────
describe('analyzeTrainAfterRest — today input types', () => {
  it('accepts today as ISO string', () => {
    const r = analyzeTrainAfterRest({ log: [], today: TODAY })
    expect(r).not.toBeNull()
  })

  it('accepts today as a Date instance', () => {
    const r = analyzeTrainAfterRest({
      log: [],
      today: new Date(`${TODAY}T08:00:00Z`),
    })
    expect(r).not.toBeNull()
  })

  it('ISO date boundary — today at end of month', () => {
    // 2026-03-31 → 60-day window start = 2026-01-31.
    const t = '2026-03-31'
    const r = analyzeTrainAfterRest({ log: [], today: t })
    expect(r).not.toBeNull()
    expect(r.band).toBe('INSUFFICIENT_REBOUND_DAYS')
  })

  it('returns citation verbatim', () => {
    const r = analyzeTrainAfterRest({ log: [], today: TODAY })
    expect(r.citation).toBe(TRAIN_AFTER_REST_CITATION)
    expect(r.citation).toMatch(/Bompa 2018/)
    expect(r.citation).toMatch(/Skorski 2019/)
  })
})

// ─── Misc ──────────────────────────────────────────────────────────────────
describe('analyzeTrainAfterRest — misc', () => {
  it('ignores entries with invalid dates', () => {
    const log = [
      { date: 'not-a-date', tss: 100 },
      { date: null, tss: 100 },
      { date: undefined, tss: 100 },
      { date: addDaysIso(WINDOW_START, 1), tss: 50 },
      { date: addDaysIso(WINDOW_START, 3), tss: 50 },
      { date: addDaysIso(WINDOW_START, 5), tss: 50 },
      { date: addDaysIso(WINDOW_START, 7), tss: 50 },
    ]
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    expect(r.postRestCount).toBe(4)
    expect(r.meanTrainingDayTss).toBe(50)
  })

  it('accepts Date-object dates inside log entries', () => {
    const log = []
    for (let i = 0; i < 4; i++) {
      const iso = addDaysIso(WINDOW_START, i * 2 + 1)
      log.push({ date: new Date(`${iso}T08:00:00Z`), tss: 60 })
    }
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    expect(r.postRestCount).toBe(4)
    expect(r.meanTrainingDayTss).toBe(60)
  })

  it('non-array log is treated as empty', () => {
    const r = analyzeTrainAfterRest({ log: null, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_REBOUND_DAYS')
    expect(r.postRestCount).toBe(0)
  })

  it('exactly 4 post-rest days (threshold) → band classified, NOT INSUFFICIENT', () => {
    const log = [
      // Anchor an earlier seen day so subsequent post-rest claims are
      // verifiable (without this the "earliest seen = day 1" rule would
      // exclude day 1 from being called post-rest).
      { date: addDaysIso(WINDOW_START, -5), tss: 100 },
      { date: addDaysIso(WINDOW_START, 1), tss: 100 },
      { date: addDaysIso(WINDOW_START, 3), tss: 100 },
      { date: addDaysIso(WINDOW_START, 5), tss: 100 },
      { date: addDaysIso(WINDOW_START, 7), tss: 100 },
    ]
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    expect(r.postRestCount).toBe(4)
    expect(r.band).not.toBe('INSUFFICIENT_REBOUND_DAYS')
    expect(r.band).toBe('BALANCED')  // all training is post-rest @100 TSS
  })

  it('a training day following another training day is NOT post-rest', () => {
    const log = [
      { date: addDaysIso(WINDOW_START, 5), tss: 100 },   // post-rest #1
      { date: addDaysIso(WINDOW_START, 6), tss: 100 },   // NOT post-rest
      { date: addDaysIso(WINDOW_START, 7), tss: 100 },   // NOT post-rest
      { date: addDaysIso(WINDOW_START, 10), tss: 100 },  // post-rest #2
      { date: addDaysIso(WINDOW_START, 15), tss: 100 },  // post-rest #3
      { date: addDaysIso(WINDOW_START, 20), tss: 100 },  // post-rest #4
    ]
    const r = analyzeTrainAfterRest({ log, today: TODAY })
    expect(r.postRestCount).toBe(4)
    const dates = r.postRestSessions.map(s => s.date)
    expect(dates).not.toContain(addDaysIso(WINDOW_START, 6))
    expect(dates).not.toContain(addDaysIso(WINDOW_START, 7))
  })
})
