// ─── trainRestTrainPattern.test.js — analyzer unit tests ────────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  analyzeTrainRestTrainPattern,
  TRAIN_REST_TRAIN_PATTERN_CITATION,
} from '../../athlete/trainRestTrainPattern.js'

// 2026-05-19 is a TUESDAY. Monday of that week = 2026-05-18.
// 12-week window start (Monday of currentMonday - 11 weeks) = 2026-03-02.
// Calendar-day SPAN from 2026-03-02 → 2026-05-19 inclusive = 79 days.
const TODAY = '2026-05-19'
const WINDOW_START = '2026-03-02'
const SPAN_DAYS = 79

function addDaysIso(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Build a fully active log over the strip.
function fullyActiveLog(spanDays = SPAN_DAYS, start = WINDOW_START) {
  const out = []
  for (let i = 0; i < spanDays; i++) {
    out.push({ date: addDaysIso(start, i), duration_min: 30, tss: 40 })
  }
  return out
}

// Build a log from a "pattern string" of A/R characters, oldest day first,
// where index 0 = WINDOW_START and index spanDays-1 = TODAY.
function logFromPattern(pattern, start = WINDOW_START) {
  const out = []
  for (let i = 0; i < pattern.length; i++) {
    if (pattern[i] === 'A') {
      out.push({ date: addDaysIso(start, i), duration_min: 30 })
    }
    // R = REST: no entry on that day.
  }
  return out
}

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  vi.setSystemTime(new Date())
})

// ─── Invalid input ──────────────────────────────────────────────────────────
describe('analyzeTrainRestTrainPattern — invalid today', () => {
  it('returns null when today is undefined', () => {
    expect(analyzeTrainRestTrainPattern({ log: [] })).toBeNull()
  })
  it('returns null when today is an invalid string', () => {
    expect(analyzeTrainRestTrainPattern({ log: [], today: 'nope' })).toBeNull()
  })
  it('returns null when today is an invalid Date object', () => {
    expect(analyzeTrainRestTrainPattern({ log: [], today: new Date('xxx') })).toBeNull()
  })
  it('returns null when today is a calendar-impossible date (Feb 30)', () => {
    expect(analyzeTrainRestTrainPattern({ log: [], today: '2026-02-30' })).toBeNull()
  })
})

// ─── INSUFFICIENT_REST_DAYS band ────────────────────────────────────────────
describe('analyzeTrainRestTrainPattern — INSUFFICIENT_REST_DAYS', () => {
  it('fully active 12 weeks → INSUFFICIENT_REST_DAYS (zero rest days)', () => {
    const r = analyzeTrainRestTrainPattern({ log: fullyActiveLog(), today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('INSUFFICIENT_REST_DAYS')
    expect(r.totalRestDays).toBe(0)
    expect(r.isolatedRestDays).toBe(0)
    expect(r.extendedRestBlocks).toBe(0)
    expect(r.longestRestBlockDays).toBe(0)
  })

  it('only 5 isolated rest days (<6 threshold) → INSUFFICIENT_REST_DAYS', () => {
    // Active log with 5 single-day holes spaced out (avoiding edges).
    const drops = [10, 20, 30, 40, 50]  // indices from WINDOW_START
    const log = fullyActiveLog().filter(e => {
      const idx = (new Date(e.date) - new Date(WINDOW_START)) / 86400000
      return !drops.includes(idx)
    })
    const r = analyzeTrainRestTrainPattern({ log, today: TODAY })
    expect(r.totalRestDays).toBe(5)
    expect(r.band).toBe('INSUFFICIENT_REST_DAYS')
  })
})

// ─── EXTENDED_REST_DOMINANT band ────────────────────────────────────────────
describe('analyzeTrainRestTrainPattern — EXTENDED_REST_DOMINANT', () => {
  it('two 3-day rest blocks (6 days total, 0 isolated) → EXTENDED_REST_DOMINANT', () => {
    const drops = new Set([10, 11, 12, 30, 31, 32])
    const log = fullyActiveLog().filter(e => {
      const idx = (new Date(e.date) - new Date(WINDOW_START)) / 86400000
      return !drops.has(idx)
    })
    const r = analyzeTrainRestTrainPattern({ log, today: TODAY })
    expect(r.band).toBe('EXTENDED_REST_DOMINANT')
    expect(r.extendedRestBlocks).toBe(2)
    expect(r.extendedRestDaysTotal).toBe(6)
    expect(r.isolatedRestDays).toBe(0)
    expect(r.totalRestDays).toBe(6)
    expect(r.isolatedShare).toBe(0)
    expect(r.longestRestBlockDays).toBe(3)
  })

  it('three 2-day rest blocks → EXTENDED_REST_DOMINANT', () => {
    const drops = new Set([10, 11, 25, 26, 40, 41])
    const log = fullyActiveLog().filter(e => {
      const idx = (new Date(e.date) - new Date(WINDOW_START)) / 86400000
      return !drops.has(idx)
    })
    const r = analyzeTrainRestTrainPattern({ log, today: TODAY })
    expect(r.band).toBe('EXTENDED_REST_DOMINANT')
    expect(r.extendedRestBlocks).toBe(3)
    expect(r.extendedRestDaysTotal).toBe(6)
    expect(r.totalRestDays).toBe(6)
    expect(r.longestRestBlockDays).toBe(2)
  })
})

// ─── ISOLATED_REST_DOMINANT band ────────────────────────────────────────────
describe('analyzeTrainRestTrainPattern — ISOLATED_REST_DOMINANT', () => {
  it('many isolated single-day rests (≥70% isolated share)', () => {
    // 7 evenly-spaced isolated rest days flanked by active days.
    const drops = new Set([7, 14, 21, 28, 35, 42, 49])
    const log = fullyActiveLog().filter(e => {
      const idx = (new Date(e.date) - new Date(WINDOW_START)) / 86400000
      return !drops.has(idx)
    })
    const r = analyzeTrainRestTrainPattern({ log, today: TODAY })
    expect(r.totalRestDays).toBe(7)
    expect(r.isolatedRestDays).toBe(7)
    expect(r.isolatedShare).toBe(1)
    expect(r.band).toBe('ISOLATED_REST_DOMINANT')
    expect(r.extendedRestBlocks).toBe(0)
  })

  it('isolatedShare exactly at 0.70 floor → ISOLATED_REST_DOMINANT', () => {
    // 7 isolated + 1 extended 3-day block = 10 rest days, 7/10 = 0.7
    const drops = new Set([5, 12, 19, 26, 33, 40, 47, 60, 61, 62])
    const log = fullyActiveLog().filter(e => {
      const idx = (new Date(e.date) - new Date(WINDOW_START)) / 86400000
      return !drops.has(idx)
    })
    const r = analyzeTrainRestTrainPattern({ log, today: TODAY })
    expect(r.totalRestDays).toBe(10)
    expect(r.isolatedRestDays).toBe(7)
    expect(r.extendedRestBlocks).toBe(1)
    expect(r.isolatedShare).toBe(0.7)
    expect(r.band).toBe('ISOLATED_REST_DOMINANT')
  })
})

// ─── BALANCED band ──────────────────────────────────────────────────────────
describe('analyzeTrainRestTrainPattern — BALANCED', () => {
  it('mix of isolated + extended that falls between thresholds → BALANCED', () => {
    // 3 isolated + 1 extended 3-day block = 6 rest days; isolated share = 0.5.
    // extendedRestBlocks = 1 (< 2 required for extended-dominant gate).
    const drops = new Set([10, 20, 30, 50, 51, 52])
    const log = fullyActiveLog().filter(e => {
      const idx = (new Date(e.date) - new Date(WINDOW_START)) / 86400000
      return !drops.has(idx)
    })
    const r = analyzeTrainRestTrainPattern({ log, today: TODAY })
    expect(r.totalRestDays).toBe(6)
    expect(r.isolatedRestDays).toBe(3)
    expect(r.extendedRestBlocks).toBe(1)
    expect(r.isolatedShare).toBe(0.5)
    expect(r.band).toBe('BALANCED')
  })

  it('low isolated share (0.20) but only 1 extended block → BALANCED', () => {
    // 1 isolated + 1 extended 4-day block = 5 rest days. But that's <6 →
    // INSUFFICIENT. Bump extended block to 8 days so total ≥ 6 and share ≤ 0.30.
    // 1 isolated + 1 extended 8-day block = 9 rest days; share = 1/9 ≈ 0.11.
    // extendedRestBlocks = 1 → fails ≥2 gate → BALANCED.
    const drops = new Set([10, 30, 31, 32, 33, 34, 35, 36, 37])
    const log = fullyActiveLog().filter(e => {
      const idx = (new Date(e.date) - new Date(WINDOW_START)) / 86400000
      return !drops.has(idx)
    })
    const r = analyzeTrainRestTrainPattern({ log, today: TODAY })
    expect(r.totalRestDays).toBe(9)
    expect(r.isolatedRestDays).toBe(1)
    expect(r.extendedRestBlocks).toBe(1)
    expect(r.band).toBe('BALANCED')
  })
})

// ─── Isolated-rest detection rules ──────────────────────────────────────────
describe('analyzeTrainRestTrainPattern — isolated detection rules', () => {
  it('length-1 rest with active neighbours on BOTH sides counts as isolated', () => {
    const drops = new Set([15])  // single isolated day, well inside the window
    const log = fullyActiveLog().filter(e => {
      const idx = (new Date(e.date) - new Date(WINDOW_START)) / 86400000
      return !drops.has(idx)
    })
    const r = analyzeTrainRestTrainPattern({ log, today: TODAY })
    expect(r.isolatedRestDays).toBe(1)
    expect(r.totalRestDays).toBe(1)
    expect(r.extendedRestBlocks).toBe(0)
    expect(r.longestRestBlockDays).toBe(1)
  })

  it('a length-1 rest block at the START of the window is NOT counted as isolated', () => {
    // Day 0 (WINDOW_START) is rest, day 1+ is active.
    const pattern = 'R' + 'A'.repeat(SPAN_DAYS - 1)
    const log = logFromPattern(pattern)
    const r = analyzeTrainRestTrainPattern({ log, today: TODAY })
    expect(r.totalRestDays).toBe(1)
    expect(r.isolatedRestDays).toBe(0)
    expect(r.extendedRestBlocks).toBe(0)
    expect(r.longestRestBlockDays).toBe(1)
  })

  it('a length-1 rest block at the END of the window is NOT counted as isolated', () => {
    // Last day (TODAY) is rest, all earlier days active.
    const pattern = 'A'.repeat(SPAN_DAYS - 1) + 'R'
    const log = logFromPattern(pattern)
    const r = analyzeTrainRestTrainPattern({ log, today: TODAY })
    expect(r.totalRestDays).toBe(1)
    expect(r.isolatedRestDays).toBe(0)
    expect(r.extendedRestBlocks).toBe(0)
    expect(r.longestRestBlockDays).toBe(1)
  })

  it('a length-≥2 rest block at the START of the window IS counted as extended', () => {
    // First 3 days rest, rest active.
    const pattern = 'RRR' + 'A'.repeat(SPAN_DAYS - 3)
    const log = logFromPattern(pattern)
    const r = analyzeTrainRestTrainPattern({ log, today: TODAY })
    expect(r.totalRestDays).toBe(3)
    expect(r.extendedRestBlocks).toBe(1)
    expect(r.extendedRestDaysTotal).toBe(3)
    expect(r.longestRestBlockDays).toBe(3)
    expect(r.isolatedRestDays).toBe(0)
  })

  it('a length-≥2 rest block at the END of the window IS counted as extended', () => {
    const pattern = 'A'.repeat(SPAN_DAYS - 4) + 'RRRR'
    const log = logFromPattern(pattern)
    const r = analyzeTrainRestTrainPattern({ log, today: TODAY })
    expect(r.totalRestDays).toBe(4)
    expect(r.extendedRestBlocks).toBe(1)
    expect(r.extendedRestDaysTotal).toBe(4)
    expect(r.longestRestBlockDays).toBe(4)
  })
})

// ─── Tally / math correctness ───────────────────────────────────────────────
describe('analyzeTrainRestTrainPattern — tallies + math', () => {
  it('longestRestBlockDays = max of all block lengths', () => {
    // Mix: 2-day block at 5, 5-day block at 20, 1-day at 35, 3-day at 50.
    const drops = new Set([
      5, 6,
      20, 21, 22, 23, 24,
      35,
      50, 51, 52,
    ])
    const log = fullyActiveLog().filter(e => {
      const idx = (new Date(e.date) - new Date(WINDOW_START)) / 86400000
      return !drops.has(idx)
    })
    const r = analyzeTrainRestTrainPattern({ log, today: TODAY })
    expect(r.longestRestBlockDays).toBe(5)
  })

  it('totalRestDays counts ALL rest days, including unclassified edge length-1', () => {
    // Day 0 = REST (leading edge, length-1, unclassified); day 5 = isolated.
    const pattern = 'R' + 'AAAA' + 'R' + 'A'.repeat(SPAN_DAYS - 6)
    const log = logFromPattern(pattern)
    const r = analyzeTrainRestTrainPattern({ log, today: TODAY })
    expect(r.totalRestDays).toBe(2)
    expect(r.isolatedRestDays).toBe(1)
    expect(r.extendedRestBlocks).toBe(0)
  })

  it('isolatedShare = isolatedRestDays / max(totalRestDays, 1), 4dp', () => {
    // 2 isolated + 1 extended 5-day block = 7 rest days; share = 2/7 ≈ 0.2857.
    const drops = new Set([10, 20, 30, 31, 32, 33, 34])
    const log = fullyActiveLog().filter(e => {
      const idx = (new Date(e.date) - new Date(WINDOW_START)) / 86400000
      return !drops.has(idx)
    })
    const r = analyzeTrainRestTrainPattern({ log, today: TODAY })
    expect(r.isolatedRestDays).toBe(2)
    expect(r.totalRestDays).toBe(7)
    expect(r.isolatedShare).toBe(0.2857)
  })

  it('isolatedShare denominator falls back to 1 when totalRestDays=0', () => {
    const r = analyzeTrainRestTrainPattern({ log: fullyActiveLog(), today: TODAY })
    expect(r.totalRestDays).toBe(0)
    expect(r.isolatedShare).toBe(0)
  })
})

// ─── Day-activity classification gates ──────────────────────────────────────
describe('analyzeTrainRestTrainPattern — day classification', () => {
  it('tss=0 + dur=0 + km=0 entry counts as REST', () => {
    const log = []
    for (let i = 0; i < SPAN_DAYS; i++) {
      // Every day has an entry but it's all zero-valued.
      log.push({ date: addDaysIso(WINDOW_START, i), tss: 0, duration_min: 0, distance_km: 0 })
    }
    const r = analyzeTrainRestTrainPattern({ log, today: TODAY })
    expect(r.totalRestDays).toBe(SPAN_DAYS)
  })

  it('tss > 0 alone counts as ACTIVE', () => {
    const pattern = 'A'.repeat(SPAN_DAYS)
    const log = logFromPattern(pattern)
    // Override: use ONLY tss to mark active.
    const logTss = log.map(e => ({ date: e.date, tss: 10 }))
    const r = analyzeTrainRestTrainPattern({ log: logTss, today: TODAY })
    expect(r.totalRestDays).toBe(0)
  })

  it('distance_km > 0 alone counts as ACTIVE', () => {
    const log = []
    for (let i = 0; i < SPAN_DAYS; i++) {
      log.push({ date: addDaysIso(WINDOW_START, i), distance_km: 5 })
    }
    const r = analyzeTrainRestTrainPattern({ log, today: TODAY })
    expect(r.totalRestDays).toBe(0)
  })

  it('durationMin (camelCase) > 0 counts as ACTIVE', () => {
    const log = []
    for (let i = 0; i < SPAN_DAYS; i++) {
      log.push({ date: addDaysIso(WINDOW_START, i), durationMin: 25 })
    }
    const r = analyzeTrainRestTrainPattern({ log, today: TODAY })
    expect(r.totalRestDays).toBe(0)
  })

  it('multiple entries on same date — any active entry marks day ACTIVE', () => {
    const log = []
    for (let i = 0; i < SPAN_DAYS; i++) {
      log.push({ date: addDaysIso(WINDOW_START, i), tss: 0 })   // zero entry
      log.push({ date: addDaysIso(WINDOW_START, i), tss: 30 })  // active entry
    }
    const r = analyzeTrainRestTrainPattern({ log, today: TODAY })
    expect(r.totalRestDays).toBe(0)
  })
})

// ─── Custom window / today handling ─────────────────────────────────────────
describe('analyzeTrainRestTrainPattern — window + today', () => {
  it('respects custom windowWeeks', () => {
    // 4-week window: today=Tue 2026-05-19, currentMonday=2026-05-18,
    // windowStart = 2026-05-18 - 3w = 2026-04-27 → span = 23 days.
    const log = fullyActiveLog(150, '2026-01-01')
    const r = analyzeTrainRestTrainPattern({ log, today: TODAY, windowWeeks: 4 })
    expect(r).not.toBeNull()
    expect(r.totalRestDays).toBe(0)
  })

  it('accepts today as a Date instance', () => {
    const r = analyzeTrainRestTrainPattern({
      log: fullyActiveLog(),
      today: new Date(`${TODAY}T08:00:00Z`),
    })
    expect(r).not.toBeNull()
    expect(r.band).toBe('INSUFFICIENT_REST_DAYS')
  })

  it('accepts today as an ISO string', () => {
    const r = analyzeTrainRestTrainPattern({ log: fullyActiveLog(), today: TODAY })
    expect(r).not.toBeNull()
  })

  it('ISO week boundary — today on Sunday uses that ISO week (Mon-Sun)', () => {
    // 2026-05-17 is a Sunday → ISO Monday of that week = 2026-05-11.
    const sun = '2026-05-17'
    const r = analyzeTrainRestTrainPattern({ log: [], today: sun, windowWeeks: 1 })
    expect(r).not.toBeNull()
    // 1-week window: windowStart = monday of sun's week = 2026-05-11.
    // Span = 7 days (Mon..Sun).
    expect(r.totalRestDays).toBe(7)
  })

  it('non-Monday today: ISO Monday is computed correctly', () => {
    // 2026-05-19 is Tuesday → ISO Monday = 2026-05-18 → 12-week start = 2026-03-02.
    const r = analyzeTrainRestTrainPattern({ log: [], today: TODAY })
    // Empty log → every day in span is REST.
    expect(r.totalRestDays).toBe(SPAN_DAYS)
    // First (leading) and last (trailing) blocks merge into one giant block.
    expect(r.extendedRestBlocks).toBe(1)
    expect(r.extendedRestDaysTotal).toBe(SPAN_DAYS)
    expect(r.longestRestBlockDays).toBe(SPAN_DAYS)
  })

  it('citation string is exposed verbatim', () => {
    const r = analyzeTrainRestTrainPattern({ log: fullyActiveLog(), today: TODAY })
    expect(r.citation).toBe(TRAIN_REST_TRAIN_PATTERN_CITATION)
    expect(r.citation).toMatch(/Issurin 2010/)
    expect(r.citation).toMatch(/Bompa 2018/)
  })
})

// ─── Edge cases ─────────────────────────────────────────────────────────────
describe('analyzeTrainRestTrainPattern — misc edge cases', () => {
  it('ignores entries with invalid dates', () => {
    const log = [
      ...fullyActiveLog(),
      { date: 'not-a-date', duration_min: 60 },
      { date: null, duration_min: 60 },
      { date: undefined, duration_min: 60 },
    ]
    const r = analyzeTrainRestTrainPattern({ log, today: TODAY })
    expect(r.totalRestDays).toBe(0)
  })

  it('ignores entries outside the window', () => {
    const log = fullyActiveLog()
    // Add entries before window start — they must not affect classification.
    log.push({ date: '2025-01-01', duration_min: 60 })
    log.push({ date: '2025-12-31', duration_min: 60 })
    const r = analyzeTrainRestTrainPattern({ log, today: TODAY })
    expect(r.totalRestDays).toBe(0)
  })

  it('returns null when windowWeeks is zero or negative (gets floored to 1)', () => {
    // Per spec safe-floor: max(1, ...). 0 → 1, not null.
    const r = analyzeTrainRestTrainPattern({ log: [], today: TODAY, windowWeeks: 0 })
    expect(r).not.toBeNull()
  })

  it('an isolated rest with rest neighbour (length-2 block) is NOT isolated', () => {
    // Day 10–11 are both rest → that's a length-2 extended block, not 2 isolated.
    const drops = new Set([10, 11])
    const log = fullyActiveLog().filter(e => {
      const idx = (new Date(e.date) - new Date(WINDOW_START)) / 86400000
      return !drops.has(idx)
    })
    const r = analyzeTrainRestTrainPattern({ log, today: TODAY })
    expect(r.isolatedRestDays).toBe(0)
    expect(r.extendedRestBlocks).toBe(1)
    expect(r.extendedRestDaysTotal).toBe(2)
  })
})
