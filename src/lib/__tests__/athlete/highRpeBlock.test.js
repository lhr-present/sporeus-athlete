// ─── highRpeBlock.test.js — analyzeHighRpeBlock unit tests ──────────────────
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  analyzeHighRpeBlock,
  HIGH_RPE_BLOCK_CITATION,
} from '../../athlete/highRpeBlock.js'

const TODAY = '2026-05-19'

function addDaysStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// Build a log with one entry per day in the last `windowDays` days.
// Each entry's RPE is `lowRpe` (default 5) unless its day-offset is in
// `highOffsets`, in which case it uses `highRpe` (default 9).
function buildLog({
  today = TODAY,
  windowDays = 60,
  highOffsets = [],
  lowRpe = 5,
  highRpe = 9,
} = {}) {
  const set = new Set(highOffsets)
  const out = []
  for (let i = 0; i < windowDays; i++) {
    out.push({
      date: addDaysStr(today, -i),
      rpe: set.has(i) ? highRpe : lowRpe,
    })
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
describe('analyzeHighRpeBlock — invalid input', () => {
  it('returns null when today is undefined', () => {
    expect(analyzeHighRpeBlock({ log: [] })).toBeNull()
  })

  it('returns null when today is an invalid string', () => {
    expect(analyzeHighRpeBlock({ log: [], today: 'not-a-date' })).toBeNull()
  })

  it('returns null when today is an invalid Date', () => {
    expect(analyzeHighRpeBlock({ log: [], today: new Date('???') })).toBeNull()
  })

  it('returns null when today is an invalid calendar day (Feb 30)', () => {
    expect(analyzeHighRpeBlock({ log: [], today: '2026-02-30' })).toBeNull()
  })

  it('returns null when windowDays <= 0', () => {
    expect(analyzeHighRpeBlock({ log: [], today: TODAY, windowDays: 0 })).toBeNull()
  })

  it('returns null when windowDays is NaN', () => {
    expect(analyzeHighRpeBlock({ log: [], today: TODAY, windowDays: NaN })).toBeNull()
  })

  it('returns null when minBlockDays < 1', () => {
    expect(analyzeHighRpeBlock({ log: [], today: TODAY, minBlockDays: 0 })).toBeNull()
  })

  it('returns null when highRpeThreshold is NaN', () => {
    expect(analyzeHighRpeBlock({
      log: [], today: TODAY, highRpeThreshold: NaN,
    })).toBeNull()
  })
})

// ─── Empty / CLEAN cases ────────────────────────────────────────────────────
describe('analyzeHighRpeBlock — CLEAN band', () => {
  it('empty log returns populated CLEAN result', () => {
    const r = analyzeHighRpeBlock({ log: [], today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('CLEAN')
    expect(r.blocks).toEqual([])
    expect(r.totalBlocks).toBe(0)
    expect(r.longestBlockDays).toBe(0)
    expect(r.totalHighRpeDays).toBe(0)
    expect(r.citation).toBe(HIGH_RPE_BLOCK_CITATION)
  })

  it('undefined log returns populated CLEAN result without throwing', () => {
    const r = analyzeHighRpeBlock({ today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('CLEAN')
  })

  it('CLEAN when every day has low RPE', () => {
    const r = analyzeHighRpeBlock({ log: buildLog(), today: TODAY })
    expect(r.band).toBe('CLEAN')
    expect(r.totalHighRpeDays).toBe(0)
    expect(r.totalBlocks).toBe(0)
  })

  it('CLEAN when high days are present but never 3 consecutive', () => {
    // Single-day spikes spaced > 2 days apart → no block ≥ 3.
    const r = analyzeHighRpeBlock({
      log: buildLog({ highOffsets: [0, 5, 12, 20] }),
      today: TODAY,
    })
    expect(r.band).toBe('CLEAN')
    expect(r.totalBlocks).toBe(0)
    expect(r.longestBlockDays).toBe(0)
    expect(r.totalHighRpeDays).toBe(4)
  })

  it('CLEAN when 2 consecutive high days appear (below minBlockDays=3)', () => {
    const r = analyzeHighRpeBlock({
      log: buildLog({ highOffsets: [10, 11] }),
      today: TODAY,
    })
    expect(r.band).toBe('CLEAN')
    expect(r.totalBlocks).toBe(0)
    expect(r.longestBlockDays).toBe(0)
    expect(r.totalHighRpeDays).toBe(2)
  })
})

// ─── OCCASIONAL_BLOCK band ──────────────────────────────────────────────────
describe('analyzeHighRpeBlock — OCCASIONAL_BLOCK band', () => {
  it('one block of exactly 3 days → OCCASIONAL_BLOCK', () => {
    const r = analyzeHighRpeBlock({
      log: buildLog({ highOffsets: [5, 6, 7] }),
      today: TODAY,
    })
    expect(r.band).toBe('OCCASIONAL_BLOCK')
    expect(r.totalBlocks).toBe(1)
    expect(r.longestBlockDays).toBe(3)
    expect(r.totalHighRpeDays).toBe(3)
    expect(r.blocks[0]).toMatchObject({
      lengthDays: 3,
      peakRpe: 9,
      startDate: addDaysStr(TODAY, -7),
      endDate: addDaysStr(TODAY, -5),
    })
  })

  it('one 5-day block stays OCCASIONAL_BLOCK (longest < 6)', () => {
    const r = analyzeHighRpeBlock({
      log: buildLog({ highOffsets: [10, 11, 12, 13, 14] }),
      today: TODAY,
    })
    expect(r.band).toBe('OCCASIONAL_BLOCK')
    expect(r.longestBlockDays).toBe(5)
    expect(r.totalBlocks).toBe(1)
  })
})

// ─── REPEAT_BLOCKS band ─────────────────────────────────────────────────────
describe('analyzeHighRpeBlock — REPEAT_BLOCKS band', () => {
  it('exactly 2 blocks of 3 → REPEAT_BLOCKS', () => {
    const r = analyzeHighRpeBlock({
      log: buildLog({ highOffsets: [3, 4, 5, 20, 21, 22] }),
      today: TODAY,
    })
    expect(r.band).toBe('REPEAT_BLOCKS')
    expect(r.totalBlocks).toBe(2)
    expect(r.longestBlockDays).toBe(3)
    expect(r.totalHighRpeDays).toBe(6)
  })

  it('exactly 3 blocks of 3 → REPEAT_BLOCKS', () => {
    const r = analyzeHighRpeBlock({
      log: buildLog({ highOffsets: [3, 4, 5, 15, 16, 17, 30, 31, 32] }),
      today: TODAY,
    })
    expect(r.band).toBe('REPEAT_BLOCKS')
    expect(r.totalBlocks).toBe(3)
    expect(r.longestBlockDays).toBe(3)
  })
})

// ─── CHRONIC_STRAIN band ────────────────────────────────────────────────────
describe('analyzeHighRpeBlock — CHRONIC_STRAIN band', () => {
  it('≥4 blocks → CHRONIC_STRAIN', () => {
    const r = analyzeHighRpeBlock({
      log: buildLog({ highOffsets: [
        3, 4, 5,
        15, 16, 17,
        25, 26, 27,
        40, 41, 42,
      ] }),
      today: TODAY,
    })
    expect(r.band).toBe('CHRONIC_STRAIN')
    expect(r.totalBlocks).toBe(4)
  })

  it('single 6-day block → CHRONIC_STRAIN even if only 1 block', () => {
    const r = analyzeHighRpeBlock({
      log: buildLog({ highOffsets: [10, 11, 12, 13, 14, 15] }),
      today: TODAY,
    })
    expect(r.band).toBe('CHRONIC_STRAIN')
    expect(r.longestBlockDays).toBe(6)
    expect(r.totalBlocks).toBe(1)
  })

  it('single 7-day block → CHRONIC_STRAIN', () => {
    const r = analyzeHighRpeBlock({
      log: buildLog({ highOffsets: [5, 6, 7, 8, 9, 10, 11] }),
      today: TODAY,
    })
    expect(r.band).toBe('CHRONIC_STRAIN')
    expect(r.longestBlockDays).toBe(7)
  })

  it('CHRONIC_STRAIN wins over REPEAT_BLOCKS count', () => {
    // 4 blocks AND one of them is 6 days — both criteria true.
    const r = analyzeHighRpeBlock({
      log: buildLog({ highOffsets: [
        3, 4, 5,
        15, 16, 17,
        25, 26, 27,
        40, 41, 42, 43, 44, 45,  // 6-day block
      ] }),
      today: TODAY,
    })
    expect(r.band).toBe('CHRONIC_STRAIN')
    expect(r.longestBlockDays).toBe(6)
  })
})

// ─── Block detection correctness ────────────────────────────────────────────
describe('analyzeHighRpeBlock — algorithm', () => {
  it('detects maximal streaks (not overlapping sub-streaks)', () => {
    const r = analyzeHighRpeBlock({
      log: buildLog({ highOffsets: [10, 11, 12, 13] }),
      today: TODAY,
    })
    expect(r.totalBlocks).toBe(1)
    expect(r.blocks[0].lengthDays).toBe(4)
  })

  it('a non-high gap day splits two streaks', () => {
    // 3 high, 1 low, 3 high → two separate blocks.
    const r = analyzeHighRpeBlock({
      log: buildLog({ highOffsets: [10, 11, 12, 14, 15, 16] }),
      today: TODAY,
    })
    expect(r.totalBlocks).toBe(2)
    expect(r.blocks.every(b => b.lengthDays === 3)).toBe(true)
  })

  it('blocks sorted oldest-first by startDate', () => {
    const r = analyzeHighRpeBlock({
      log: buildLog({ highOffsets: [3, 4, 5, 30, 31, 32] }),
      today: TODAY,
    })
    expect(r.blocks[0].startDate < r.blocks[1].startDate).toBe(true)
  })

  it('peakRpe is the max RPE across the block days', () => {
    // Day -7 RPE 9, day -6 RPE 10, day -5 RPE 8 → peak 10.
    const log = [
      { date: addDaysStr(TODAY, -7), rpe: 9 },
      { date: addDaysStr(TODAY, -6), rpe: 10 },
      { date: addDaysStr(TODAY, -5), rpe: 8 },
    ]
    const r = analyzeHighRpeBlock({ log, today: TODAY })
    expect(r.totalBlocks).toBe(1)
    expect(r.blocks[0].peakRpe).toBe(10)
  })

  it('multi-session day uses the MAX RPE across that day\'s entries', () => {
    // Day -5 has two sessions, RPE 4 and RPE 9 → day is high (max=9).
    const log = [
      { date: addDaysStr(TODAY, -6), rpe: 8 },
      { date: addDaysStr(TODAY, -5), rpe: 4 },
      { date: addDaysStr(TODAY, -5), rpe: 9 },
      { date: addDaysStr(TODAY, -4), rpe: 8 },
    ]
    const r = analyzeHighRpeBlock({ log, today: TODAY })
    expect(r.totalBlocks).toBe(1)
    expect(r.blocks[0].lengthDays).toBe(3)
    expect(r.blocks[0].peakRpe).toBe(9)
  })

  it('multi-session day where only one entry meets threshold still counts as high', () => {
    // Single high entry on a day = high day.
    const log = [
      { date: addDaysStr(TODAY, -3), rpe: 3 },
      { date: addDaysStr(TODAY, -3), rpe: 9 },
      { date: addDaysStr(TODAY, -2), rpe: 9 },
      { date: addDaysStr(TODAY, -1), rpe: 9 },
    ]
    const r = analyzeHighRpeBlock({ log, today: TODAY })
    expect(r.totalBlocks).toBe(1)
    expect(r.blocks[0].lengthDays).toBe(3)
  })

  it('missing RPE / NaN treated as NOT high', () => {
    const log = [
      { date: addDaysStr(TODAY, -5), rpe: 9 },
      { date: addDaysStr(TODAY, -4) },              // missing
      { date: addDaysStr(TODAY, -3), rpe: 'bad' },  // NaN
      { date: addDaysStr(TODAY, -2), rpe: 9 },
    ]
    const r = analyzeHighRpeBlock({ log, today: TODAY })
    // Days -5 and -2 are high, but -4 and -3 break the streak → no block.
    expect(r.totalBlocks).toBe(0)
    expect(r.totalHighRpeDays).toBe(2)
  })

  it('totalHighRpeDays counts every high day, in or out of a block', () => {
    // 3 days in a block + 1 isolated → 4 total high days, 1 block.
    const r = analyzeHighRpeBlock({
      log: buildLog({ highOffsets: [10, 11, 12, 25] }),
      today: TODAY,
    })
    expect(r.totalBlocks).toBe(1)
    expect(r.totalHighRpeDays).toBe(4)
  })

  it('entries outside the window are ignored', () => {
    // High block 70 days ago (outside 60-day window) → no block.
    const log = buildLog({ highOffsets: [70, 71, 72], windowDays: 90 })
    const r = analyzeHighRpeBlock({ log, today: TODAY })
    expect(r.totalBlocks).toBe(0)
    expect(r.totalHighRpeDays).toBe(0)
  })

  it('block at the window edge (today) is detected', () => {
    // Days -2, -1, 0 (today) all high.
    const r = analyzeHighRpeBlock({
      log: buildLog({ highOffsets: [0, 1, 2] }),
      today: TODAY,
    })
    expect(r.totalBlocks).toBe(1)
    expect(r.blocks[0].endDate).toBe(TODAY)
    expect(r.blocks[0].startDate).toBe(addDaysStr(TODAY, -2))
  })

  it('block at the window start edge is detected', () => {
    // 60-day window means oldest day is today-59.
    const r = analyzeHighRpeBlock({
      log: buildLog({ highOffsets: [57, 58, 59] }),
      today: TODAY,
    })
    expect(r.totalBlocks).toBe(1)
    expect(r.blocks[0].startDate).toBe(addDaysStr(TODAY, -59))
    expect(r.blocks[0].endDate).toBe(addDaysStr(TODAY, -57))
  })
})

// ─── Custom thresholds ──────────────────────────────────────────────────────
describe('analyzeHighRpeBlock — custom parameters', () => {
  it('lower highRpeThreshold (=7) catches RPE-7 days', () => {
    const log = [
      { date: addDaysStr(TODAY, -2), rpe: 7 },
      { date: addDaysStr(TODAY, -1), rpe: 7 },
      { date: addDaysStr(TODAY, -0), rpe: 7 },
    ]
    // Default threshold = 8 → no high days.
    const def = analyzeHighRpeBlock({ log, today: TODAY })
    expect(def.totalBlocks).toBe(0)
    // Custom threshold = 7 → one 3-day block.
    const custom = analyzeHighRpeBlock({ log, today: TODAY, highRpeThreshold: 7 })
    expect(custom.totalBlocks).toBe(1)
    expect(custom.blocks[0].lengthDays).toBe(3)
  })

  it('minBlockDays=2 detects shorter blocks', () => {
    const log = [
      { date: addDaysStr(TODAY, -2), rpe: 9 },
      { date: addDaysStr(TODAY, -1), rpe: 9 },
    ]
    const def = analyzeHighRpeBlock({ log, today: TODAY })
    expect(def.totalBlocks).toBe(0)
    const custom = analyzeHighRpeBlock({ log, today: TODAY, minBlockDays: 2 })
    expect(custom.totalBlocks).toBe(1)
    expect(custom.blocks[0].lengthDays).toBe(2)
  })

  it('custom windowDays expands the search', () => {
    // High block 70 days ago, default 60-day window misses it.
    const log = [
      { date: addDaysStr(TODAY, -72), rpe: 9 },
      { date: addDaysStr(TODAY, -71), rpe: 9 },
      { date: addDaysStr(TODAY, -70), rpe: 9 },
    ]
    const def = analyzeHighRpeBlock({ log, today: TODAY })
    expect(def.totalBlocks).toBe(0)
    const custom = analyzeHighRpeBlock({ log, today: TODAY, windowDays: 90 })
    expect(custom.totalBlocks).toBe(1)
  })

  it('citation field is always populated', () => {
    const r = analyzeHighRpeBlock({ log: [], today: TODAY })
    expect(r.citation).toBe(HIGH_RPE_BLOCK_CITATION)
    expect(r.citation).toMatch(/Foster 2001/)
    expect(r.citation).toMatch(/Halson 2014/)
  })
})

// ─── today input forms ──────────────────────────────────────────────────────
describe('analyzeHighRpeBlock — date inputs', () => {
  it('accepts today as ISO string', () => {
    const r = analyzeHighRpeBlock({ log: [], today: TODAY })
    expect(r).not.toBeNull()
  })

  it('accepts today as Date object', () => {
    const r = analyzeHighRpeBlock({ log: [], today: new Date(`${TODAY}T00:00:00Z`) })
    expect(r).not.toBeNull()
  })

  it('Date and ISO string today produce identical results', () => {
    const log = buildLog({ highOffsets: [3, 4, 5] })
    const a = analyzeHighRpeBlock({ log, today: TODAY })
    const b = analyzeHighRpeBlock({ log, today: new Date(`${TODAY}T00:00:00Z`) })
    expect(a).toEqual(b)
  })

  it('ISO date with time/zone suffix is accepted', () => {
    const r = analyzeHighRpeBlock({ log: [], today: `${TODAY}T08:30:00Z` })
    expect(r).not.toBeNull()
  })

  it('windowStart is inclusive: today-(windowDays-1) is day 0', () => {
    // High day exactly at today-59 alone → not a block but counted as high.
    const log = [{ date: addDaysStr(TODAY, -59), rpe: 9 }]
    const r = analyzeHighRpeBlock({ log, today: TODAY })
    expect(r.totalHighRpeDays).toBe(1)
  })

  it('day before the window is NOT counted', () => {
    const log = [{ date: addDaysStr(TODAY, -60), rpe: 9 }]
    const r = analyzeHighRpeBlock({ log, today: TODAY })
    expect(r.totalHighRpeDays).toBe(0)
  })
})
