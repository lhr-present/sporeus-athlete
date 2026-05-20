// ─── seasonRestartCount.test.js — analyzeSeasonRestartCount unit tests ──────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  analyzeSeasonRestartCount,
  SEASON_RESTART_COUNT_CITATION,
} from '../../athlete/seasonRestartCount.js'

const TODAY = '2026-05-19'

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Build a fully-active log for `windowDays` days ending at `today`.
function activeLog(windowDays = 365, today = TODAY) {
  const out = []
  for (let i = 0; i < windowDays; i++) {
    out.push({ date: addDays(today, -i), duration_min: 30, tss: 40 })
  }
  return out
}

// Remove all entries on a list of "days ago" offsets.
function dropDays(log, offsets, today = TODAY) {
  const drops = new Set(offsets.map(n => addDays(today, -n)))
  return log.filter(e => !drops.has(e.date))
}

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  vi.setSystemTime(new Date())
})

// ─── Invalid input ──────────────────────────────────────────────────────────
describe('analyzeSeasonRestartCount — invalid input', () => {
  it('returns null when today is undefined', () => {
    expect(analyzeSeasonRestartCount({ log: [] })).toBeNull()
  })

  it('returns null when today is an unparseable string', () => {
    expect(analyzeSeasonRestartCount({ log: [], today: 'banana' })).toBeNull()
  })

  it('returns null when today is an invalid Date', () => {
    expect(analyzeSeasonRestartCount({ log: [], today: new Date('???') })).toBeNull()
  })

  it('returns null when today is an impossible calendar day', () => {
    expect(analyzeSeasonRestartCount({ log: [], today: '2026-02-30' })).toBeNull()
  })
})

// ─── Empty log → CONSISTENT ─────────────────────────────────────────────────
describe('analyzeSeasonRestartCount — empty log', () => {
  it('empty log returns CONSISTENT with no restarts', () => {
    const r = analyzeSeasonRestartCount({ log: [], today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('CONSISTENT')
    expect(r.restarts).toEqual([])
    expect(r.totalRestarts).toBe(0)
    expect(r.longestStreakAfterRestart).toBe(0)
    expect(r.longestGap).toBe(0)
    expect(r.citation).toBe(SEASON_RESTART_COUNT_CITATION)
  })

  it('undefined log returns CONSISTENT', () => {
    const r = analyzeSeasonRestartCount({ today: TODAY })
    expect(r.band).toBe('CONSISTENT')
    expect(r.totalRestarts).toBe(0)
  })
})

// ─── CONSISTENT band ────────────────────────────────────────────────────────
describe('analyzeSeasonRestartCount — CONSISTENT band', () => {
  it('fully-active 365-day log → CONSISTENT, 0 restarts', () => {
    const r = analyzeSeasonRestartCount({ log: activeLog(), today: TODAY })
    expect(r.band).toBe('CONSISTENT')
    expect(r.totalRestarts).toBe(0)
    expect(r.longestGap).toBe(0)
  })

  it('one 14-day gap (boundary) → 1 restart, still CONSISTENT', () => {
    const log = dropDays(activeLog(), Array.from({ length: 14 }, (_, i) => 30 + i))
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    expect(r.totalRestarts).toBe(1)
    expect(r.longestGap).toBe(14)
    expect(r.band).toBe('CONSISTENT')
  })

  it('1 restart but longestGap=15 → OCCASIONAL_BREAKS (not CONSISTENT)', () => {
    const log = dropDays(activeLog(), Array.from({ length: 15 }, (_, i) => 30 + i))
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    expect(r.totalRestarts).toBe(1)
    expect(r.longestGap).toBe(15)
    expect(r.band).toBe('OCCASIONAL_BREAKS')
  })
})

// ─── OCCASIONAL_BREAKS (2-3 restarts) ───────────────────────────────────────
describe('analyzeSeasonRestartCount — OCCASIONAL_BREAKS band', () => {
  it('2 restarts (two 8-day gaps) → OCCASIONAL_BREAKS', () => {
    let log = activeLog()
    log = dropDays(log, Array.from({ length: 8 }, (_, i) => 30 + i))
    log = dropDays(log, Array.from({ length: 8 }, (_, i) => 100 + i))
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    expect(r.totalRestarts).toBe(2)
    expect(r.band).toBe('OCCASIONAL_BREAKS')
  })

  it('3 restarts → OCCASIONAL_BREAKS', () => {
    let log = activeLog()
    log = dropDays(log, Array.from({ length: 8 }, (_, i) => 30 + i))
    log = dropDays(log, Array.from({ length: 8 }, (_, i) => 100 + i))
    log = dropDays(log, Array.from({ length: 8 }, (_, i) => 200 + i))
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    expect(r.totalRestarts).toBe(3)
    expect(r.band).toBe('OCCASIONAL_BREAKS')
  })
})

// ─── FRAGMENTED (4-6 restarts) ──────────────────────────────────────────────
describe('analyzeSeasonRestartCount — FRAGMENTED band', () => {
  it('4 restarts → FRAGMENTED', () => {
    let log = activeLog()
    const blocks = [[30,37],[80,87],[150,157],[250,257]]
    for (const [s] of blocks) {
      log = dropDays(log, Array.from({ length: 8 }, (_, i) => s + i))
    }
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    expect(r.totalRestarts).toBe(4)
    expect(r.band).toBe('FRAGMENTED')
  })

  it('6 restarts → FRAGMENTED', () => {
    let log = activeLog()
    const starts = [30, 70, 110, 150, 200, 250]
    for (const s of starts) {
      log = dropDays(log, Array.from({ length: 8 }, (_, i) => s + i))
    }
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    expect(r.totalRestarts).toBe(6)
    expect(r.band).toBe('FRAGMENTED')
  })
})

// ─── CHRONIC_RESTART ────────────────────────────────────────────────────────
describe('analyzeSeasonRestartCount — CHRONIC_RESTART band', () => {
  it('>6 restarts → CHRONIC_RESTART', () => {
    let log = activeLog()
    const starts = [20, 50, 80, 110, 140, 200, 260]
    for (const s of starts) {
      log = dropDays(log, Array.from({ length: 8 }, (_, i) => s + i))
    }
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    expect(r.totalRestarts).toBe(7)
    expect(r.band).toBe('CHRONIC_RESTART')
  })

  it('longestGap >60 days alone is enough → CHRONIC_RESTART', () => {
    const log = dropDays(activeLog(), Array.from({ length: 61 }, (_, i) => 30 + i))
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    expect(r.totalRestarts).toBe(1)
    expect(r.longestGap).toBe(61)
    expect(r.band).toBe('CHRONIC_RESTART')
  })
})

// ─── Gap-boundary handling ──────────────────────────────────────────────────
describe('analyzeSeasonRestartCount — gap boundary (≥7 vs <7)', () => {
  it('exactly 7-day gap counts as a restart', () => {
    const log = dropDays(activeLog(), [30, 31, 32, 33, 34, 35, 36])
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    expect(r.totalRestarts).toBe(1)
    expect(r.restarts[0].gapLengthDays).toBe(7)
  })

  it('6-day gap does NOT count as a restart', () => {
    const log = dropDays(activeLog(), [30, 31, 32, 33, 34, 35])
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    expect(r.totalRestarts).toBe(0)
  })
})

// ─── History-start anchor ───────────────────────────────────────────────────
describe('analyzeSeasonRestartCount — history start anchor', () => {
  it('first active day in log is NOT counted as a restart', () => {
    // First active day = 50 days ago. No log entries before that. So the
    // implied gap from infinity should NOT trigger a restart.
    const log = []
    for (let i = 0; i < 50; i++) {
      log.push({ date: addDays(TODAY, -i), duration_min: 30 })
    }
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    expect(r.totalRestarts).toBe(0)
  })

  it('after history-start, a genuine ≥7d gap inside data IS counted', () => {
    // Active from day -200 to day -100, then gap of 10d, then active again
    // up to today.
    const log = []
    for (let i = 100; i <= 200; i++) {
      log.push({ date: addDays(TODAY, -i), duration_min: 30 })
    }
    // gap: -99..-90 inclusive (10 days)
    for (let i = 0; i < 90; i++) {
      log.push({ date: addDays(TODAY, -i), duration_min: 30 })
    }
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    expect(r.totalRestarts).toBe(1)
    expect(r.restarts[0].gapLengthDays).toBe(10)
    expect(r.restarts[0].restartDate).toBe(addDays(TODAY, -89))
  })
})

// ─── streakAfterDays semantics ──────────────────────────────────────────────
describe('analyzeSeasonRestartCount — streakAfterDays', () => {
  it('streakAfterDays terminated by next ≥7d gap', () => {
    // Active for 300 days then gap (30..37 = 8 days), then active for 4 days,
    // then another gap (18..24 = 7 days), then active to today.
    let log = activeLog()
    // First gap: days 30..37 (8 days)
    log = dropDays(log, [30, 31, 32, 33, 34, 35, 36, 37])
    // Second gap: days 18..24 (7 days)
    log = dropDays(log, [18, 19, 20, 21, 22, 23, 24])
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    expect(r.totalRestarts).toBe(2)
    // First restart is at -29; after restart there should be 4 active days
    // (days -29, -28, -27, -26, -25 = 5 days). Then gap at -24.
    const firstRestart = r.restarts.find(x => x.restartDate === addDays(TODAY, -29))
    expect(firstRestart).toBeDefined()
    expect(firstRestart.streakAfterDays).toBe(5)
  })

  it('streakAfterDays clamped to today when no terminating gap', () => {
    // Gap days 100..107 (8 days), then continuous active up to today.
    const log = dropDays(activeLog(), Array.from({ length: 8 }, (_, i) => 100 + i))
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    expect(r.totalRestarts).toBe(1)
    // Restart at -99, today=-0, so 100 days inclusive.
    expect(r.restarts[0].streakAfterDays).toBe(100)
  })

  it('1 active day then immediate ≥7d gap → streakAfterDays = 1', () => {
    // Sparse log: active at -200..-180, gap, active SINGLE day at -100,
    // then gap, then active to today.
    const log = []
    for (let i = 180; i <= 200; i++) {
      log.push({ date: addDays(TODAY, -i), duration_min: 30 })
    }
    // Single isolated active day at -100
    log.push({ date: addDays(TODAY, -100), duration_min: 30 })
    // Active again from -80 to 0
    for (let i = 0; i <= 80; i++) {
      log.push({ date: addDays(TODAY, -i), duration_min: 30 })
    }
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    // Two restarts: at -100 (gap from -179..-101 = 79 days) and at -80
    // (gap from -99..-81 = 19 days).
    expect(r.totalRestarts).toBe(2)
    const at100 = r.restarts.find(x => x.restartDate === addDays(TODAY, -100))
    expect(at100).toBeDefined()
    expect(at100.streakAfterDays).toBe(1)
  })
})

// ─── gapLengthDays accuracy ─────────────────────────────────────────────────
describe('analyzeSeasonRestartCount — gapLengthDays accuracy', () => {
  it('reports exact length of the inactive run preceding restart', () => {
    const log = dropDays(activeLog(), [50, 51, 52, 53, 54, 55, 56, 57, 58, 59])
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    expect(r.totalRestarts).toBe(1)
    expect(r.restarts[0].gapLengthDays).toBe(10)
  })

  it('different gap sizes get the right lengths', () => {
    let log = activeLog()
    log = dropDays(log, Array.from({ length: 7 }, (_, i) => 30 + i))
    log = dropDays(log, Array.from({ length: 14 }, (_, i) => 100 + i))
    log = dropDays(log, Array.from({ length: 22 }, (_, i) => 200 + i))
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    const lengths = r.restarts.map(x => x.gapLengthDays).sort((a, b) => a - b)
    expect(lengths).toEqual([7, 14, 22])
  })
})

// ─── Sort order ─────────────────────────────────────────────────────────────
describe('analyzeSeasonRestartCount — sort order', () => {
  it('restarts are sorted oldest-first', () => {
    let log = activeLog()
    log = dropDays(log, Array.from({ length: 8 }, (_, i) => 30 + i))
    log = dropDays(log, Array.from({ length: 8 }, (_, i) => 100 + i))
    log = dropDays(log, Array.from({ length: 8 }, (_, i) => 200 + i))
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    const dates = r.restarts.map(x => x.restartDate)
    const sorted = [...dates].sort()
    expect(dates).toEqual(sorted)
  })
})

// ─── Custom parameters ──────────────────────────────────────────────────────
describe('analyzeSeasonRestartCount — custom parameters', () => {
  it('custom minGapDays=3 detects shorter restarts', () => {
    const log = dropDays(activeLog(), [30, 31, 32, 33])
    const r = analyzeSeasonRestartCount({ log, today: TODAY, minGapDays: 3 })
    expect(r.totalRestarts).toBe(1)
    expect(r.restarts[0].gapLengthDays).toBe(4)
  })

  it('custom minGapDays=10 ignores 7-day gaps', () => {
    const log = dropDays(activeLog(), [30, 31, 32, 33, 34, 35, 36])
    const r = analyzeSeasonRestartCount({ log, today: TODAY, minGapDays: 10 })
    expect(r.totalRestarts).toBe(0)
  })

  it('custom lookbackDays=180 ignores restarts older than 180d', () => {
    let log = activeLog()
    // Gap inside last 180d
    log = dropDays(log, Array.from({ length: 8 }, (_, i) => 30 + i))
    // Gap older than 180d
    log = dropDays(log, Array.from({ length: 8 }, (_, i) => 250 + i))
    const r = analyzeSeasonRestartCount({ log, today: TODAY, lookbackDays: 180 })
    expect(r.totalRestarts).toBe(1)
    expect(r.restarts[0].restartDate).toBe(addDays(TODAY, -29))
  })

  it('lookbackDays=0 returns empty CONSISTENT', () => {
    const log = dropDays(activeLog(), Array.from({ length: 8 }, (_, i) => 30 + i))
    const r = analyzeSeasonRestartCount({ log, today: TODAY, lookbackDays: 0 })
    expect(r.band).toBe('CONSISTENT')
    expect(r.totalRestarts).toBe(0)
  })

  it('negative lookbackDays returns empty CONSISTENT', () => {
    const r = analyzeSeasonRestartCount({ log: activeLog(), today: TODAY, lookbackDays: -5 })
    expect(r.band).toBe('CONSISTENT')
    expect(r.totalRestarts).toBe(0)
  })
})

// ─── Date input formats ─────────────────────────────────────────────────────
describe('analyzeSeasonRestartCount — date input formats', () => {
  it('accepts today as ISO string', () => {
    const r = analyzeSeasonRestartCount({ log: activeLog(), today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('CONSISTENT')
  })

  it('accepts today as a Date object', () => {
    const r = analyzeSeasonRestartCount({
      log: activeLog(),
      today: new Date(`${TODAY}T08:30:00Z`),
    })
    expect(r).not.toBeNull()
    expect(r.band).toBe('CONSISTENT')
  })

  it('Date and string today produce identical results', () => {
    const log = dropDays(activeLog(), Array.from({ length: 8 }, (_, i) => 30 + i))
    const rStr = analyzeSeasonRestartCount({ log, today: TODAY })
    const rDate = analyzeSeasonRestartCount({
      log,
      today: new Date(`${TODAY}T00:00:00Z`),
    })
    expect(rStr.totalRestarts).toBe(rDate.totalRestarts)
    expect(rStr.longestGap).toBe(rDate.longestGap)
  })
})

// ─── Activity detection ─────────────────────────────────────────────────────
describe('analyzeSeasonRestartCount — activity definition', () => {
  it('all-zero metrics are NOT active', () => {
    // Log has entries on every day but all metrics are 0 → effectively empty.
    const log = []
    for (let i = 0; i < 90; i++) {
      log.push({ date: addDays(TODAY, -i), duration_min: 0, tss: 0, distance_km: 0 })
    }
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    expect(r.totalRestarts).toBe(0) // no active days at all → no history start
  })

  it('distance_km > 0 counts as active', () => {
    let log = activeLog()
    log = dropDays(log, Array.from({ length: 8 }, (_, i) => 30 + i))
    // Re-add one of the dropped days as a distance-only entry → fills the gap
    log.push({ date: addDays(TODAY, -33), distance_km: 5 })
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    // The single distance entry splits the 8-day gap into 3 + 4 — both < 7.
    expect(r.totalRestarts).toBe(0)
  })

  it('distanceKm (camelCase) is recognized', () => {
    let log = activeLog()
    log = dropDays(log, Array.from({ length: 8 }, (_, i) => 30 + i))
    log.push({ date: addDays(TODAY, -33), distanceKm: 5 })
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    expect(r.totalRestarts).toBe(0)
  })

  it('durationMin (camelCase) is recognized', () => {
    const log = []
    for (let i = 0; i < 30; i++) {
      log.push({ date: addDays(TODAY, -i), durationMin: 30 })
    }
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    expect(r.band).toBe('CONSISTENT')
    expect(r.totalRestarts).toBe(0)
  })

  it('tss alone (no duration) counts as active', () => {
    const log = []
    for (let i = 0; i < 30; i++) {
      log.push({ date: addDays(TODAY, -i), tss: 50 })
    }
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    expect(r.band).toBe('CONSISTENT')
  })
})

// ─── Restart at very recent date ────────────────────────────────────────────
describe('analyzeSeasonRestartCount — recent restart edge', () => {
  it('restart on today (after long gap) is counted', () => {
    const log = []
    // Active from -200..-15
    for (let i = 15; i <= 200; i++) {
      log.push({ date: addDays(TODAY, -i), duration_min: 30 })
    }
    // Then gap from -14..-1, then active today
    log.push({ date: TODAY, duration_min: 30 })
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    expect(r.totalRestarts).toBe(1)
    expect(r.restarts[0].restartDate).toBe(TODAY)
    expect(r.restarts[0].gapLengthDays).toBe(14)
    expect(r.restarts[0].streakAfterDays).toBe(1)
  })

  it('restart 1 day ago counted', () => {
    const yesterday = addDays(TODAY, -1)
    const log = []
    for (let i = 15; i <= 200; i++) {
      log.push({ date: addDays(TODAY, -i), duration_min: 30 })
    }
    log.push({ date: yesterday, duration_min: 30 })
    log.push({ date: TODAY, duration_min: 30 })
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    expect(r.totalRestarts).toBe(1)
    expect(r.restarts[0].restartDate).toBe(yesterday)
    expect(r.restarts[0].streakAfterDays).toBe(2)
  })
})

// ─── Misc / structural ──────────────────────────────────────────────────────
describe('analyzeSeasonRestartCount — structural', () => {
  it('returns the expected shape', () => {
    const r = analyzeSeasonRestartCount({ log: activeLog(), today: TODAY })
    expect(r).toHaveProperty('band')
    expect(r).toHaveProperty('restarts')
    expect(r).toHaveProperty('totalRestarts')
    expect(r).toHaveProperty('longestStreakAfterRestart')
    expect(r).toHaveProperty('longestGap')
    expect(r).toHaveProperty('citation')
  })

  it('citation contains both authorities', () => {
    const r = analyzeSeasonRestartCount({ log: [], today: TODAY })
    expect(r.citation).toMatch(/Hägglund/)
    expect(r.citation).toMatch(/Gabbett/)
  })

  it('ignores log entries with invalid dates', () => {
    const log = [
      ...activeLog(),
      { date: 'not-a-date', duration_min: 30 },
      { date: '2026-02-30', duration_min: 30 },
    ]
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    expect(r.band).toBe('CONSISTENT')
  })

  it('longestStreakAfterRestart picks max across restarts', () => {
    let log = activeLog()
    log = dropDays(log, Array.from({ length: 8 }, (_, i) => 200 + i))
    log = dropDays(log, Array.from({ length: 8 }, (_, i) => 100 + i))
    const r = analyzeSeasonRestartCount({ log, today: TODAY })
    expect(r.totalRestarts).toBe(2)
    // Older restart at -199 lasts from -199 until next gap at -107 = 93 days
    // Newer restart at -99 lasts from -99 to today = 100 days
    expect(r.longestStreakAfterRestart).toBe(100)
  })
})
