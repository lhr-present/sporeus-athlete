// ─── restDayDistribution.test.js — pure-fn unit tests ──────────────────────
import { describe, it, expect } from 'vitest'
import {
  analyzeRestDayDistribution,
  REST_DAY_DISTRIBUTION_CITATION,
} from '../../athlete/restDayDistribution.js'

// ─── Setup ──────────────────────────────────────────────────────────────────
// 28-day window ending TODAY (inclusive). today = 2026-04-28 →
// windowStart = 2026-04-01 (28 days, indices 0..27).
const TODAY         = '2026-04-28'
const WINDOW_START  = '2026-04-01'

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Build a 28-day log from a pattern of per-day RPEs.
 * patternRpe[i] semantics:
 *   null       → REST day (no session)
 *   number ≥7  → HARD day
 *   number <7  → EASY day
 *
 * Always emits an "anchor" session on WINDOW_START to ensure the
 * (today − oldest) >= 27 days guard passes, even when day-0 itself is
 * supposed to be REST.  When pattern[0] is null (REST), we emit the
 * anchor ONE DAY EARLIER (WINDOW_START − 1) so day 0 remains a true
 * REST inside the window.
 */
function buildLog(patternRpe) {
  if (patternRpe.length !== 28) throw new Error('pattern must be length 28')
  const log = []
  for (let i = 0; i < 28; i++) {
    const rpe = patternRpe[i]
    if (rpe != null) {
      log.push({ date: addDays(WINDOW_START, i), rpe, type: 'run' })
    }
  }
  if (patternRpe[0] == null) {
    // Anchor BEFORE the window to satisfy 28-day floor, but outside →
    // it is excluded from in-window stats.
    log.push({ date: addDays(WINDOW_START, -1), rpe: 5, type: 'easy' })
  }
  return log
}

// ─── 1. Null cases ──────────────────────────────────────────────────────────
describe('analyzeRestDayDistribution — null cases', () => {
  it('returns null for empty log', () => {
    expect(analyzeRestDayDistribution({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null for non-array log', () => {
    expect(analyzeRestDayDistribution({ log: null, today: TODAY })).toBeNull()
    expect(analyzeRestDayDistribution({ log: undefined, today: TODAY })).toBeNull()
  })

  it('returns null when oldest entry is less than 28 days from today', () => {
    // Oldest = today - 10 days → diffDays = 10 < 27
    const log = []
    for (let i = 18; i < 28; i++) {
      log.push({ date: addDays(WINDOW_START, i), rpe: 8, type: 'run' })
    }
    expect(analyzeRestDayDistribution({ log, today: TODAY })).toBeNull()
  })

  it('returns null when fewer than 5 days have any session', () => {
    // 4 active days, anchor outside ensures 28-day window passes
    const log = [
      { date: addDays(WINDOW_START, -1), rpe: 5, type: 'easy' }, // anchor outside
      { date: addDays(WINDOW_START, 10), rpe: 8, type: 'run' },
      { date: addDays(WINDOW_START, 15), rpe: 8, type: 'run' },
      { date: addDays(WINDOW_START, 20), rpe: 8, type: 'run' },
      { date: addDays(WINDOW_START, 25), rpe: 8, type: 'run' },
    ]
    expect(analyzeRestDayDistribution({ log, today: TODAY })).toBeNull()
  })
})

// ─── 2. Return shape ────────────────────────────────────────────────────────
describe('analyzeRestDayDistribution — return shape', () => {
  it('returns full structure with citation', () => {
    // Hard-easy rhythm: HARD, REST, HARD, REST, ...
    const pat = new Array(28).fill(null)
    for (let i = 0; i < 28; i += 2) pat[i] = 8        // even → HARD
    // odd → REST (null)
    const r = analyzeRestDayDistribution({ log: buildLog(pat), today: TODAY })
    expect(r).not.toBeNull()
    expect(r.pattern).toBeDefined()
    expect(r.restDayCount).toBe(14)
    expect(r.hardDayCount).toBe(14)
    expect(r.easyDayCount).toBe(0)
    expect(r.citation).toBe(REST_DAY_DISTRIBUTION_CITATION)
    expect(r.citation).toMatch(/Bompa 2018/)
    expect(r.citation).toMatch(/Foster 2001/)
  })

  it('rounds postHardRestRate to 3 decimals', () => {
    // 7 hard days, 3 followed by rest → 3/7 = 0.4285714... → 0.429
    const pat = new Array(28).fill(null)
    // HARD on days 0,4,8,12,16,20,24 → REST after 0,4,8 (days 1,5,9)
    // Other hards (12,16,20,24) followed by sessions on days 13,17,21,25 (EASY)
    pat[0] = 8
    pat[4] = 8
    pat[8] = 8
    pat[12] = 8
    pat[16] = 8
    pat[20] = 8
    pat[24] = 8
    // Easy fillers after the last 4 hards
    pat[13] = 5
    pat[17] = 5
    pat[21] = 5
    pat[25] = 5
    const r = analyzeRestDayDistribution({ log: buildLog(pat), today: TODAY })
    expect(r).not.toBeNull()
    expect(r.hardDayCount).toBe(7)
    expect(r.postHardRestCount).toBe(3)
    expect(r.postHardRestRate).toBeCloseTo(0.429, 3)
  })
})

// ─── 3. WELL_PLACED ─────────────────────────────────────────────────────────
describe('analyzeRestDayDistribution — WELL_PLACED', () => {
  it('classifies as WELL_PLACED when rate ≥ 0.5 and restDayCount ≥ 4', () => {
    // Pattern: HARD-REST-EASY-EASY repeated (7 cycles × 4 = 28 days)
    // Days: 0H 1R 2E 3E 4H 5R 6E 7E ...
    // Hard days: 0,4,8,12,16,20,24 → 7 hards
    // Day after each hard is REST → 7 postHardRest
    // Rate = 7/7 = 1.0 ≥ 0.5 ✓
    // Rest days: 1,5,9,13,17,21,25 → 7 rest days ≥ 4 ✓
    const pat = new Array(28).fill(null)
    for (let i = 0; i < 28; i++) {
      const m = i % 4
      if (m === 0) pat[i] = 8       // HARD
      else if (m === 1) pat[i] = null // REST
      else pat[i] = 5               // EASY
    }
    const r = analyzeRestDayDistribution({ log: buildLog(pat), today: TODAY })
    expect(r.pattern).toBe('WELL_PLACED')
    expect(r.restDayCount).toBe(7)
    expect(r.hardDayCount).toBe(7)
    expect(r.postHardRestCount).toBe(7)
    expect(r.postHardRestRate).toBe(1)
  })

  it('classifies as WELL_PLACED at threshold rate = 0.5', () => {
    // 4 hards, 2 followed by rest = 0.5 ✓; rest count >= 4
    // Days 0,7,14,21 → HARD. Day 1,8 → REST (after hard).
    // Day 15 → EASY (not rest after hard). Day 22 → EASY.
    // Extra rest days (no session) outside hard-follow: 4,5
    const pat = new Array(28).fill(null)
    // Fill all with EASY first
    for (let i = 0; i < 28; i++) pat[i] = 5
    // Hards
    pat[0] = 8; pat[7] = 8; pat[14] = 8; pat[21] = 8
    // Rest after hard days 0 and 7
    pat[1] = null
    pat[8] = null
    // Day 15 and 22 stay EASY (rpe 5)
    // Add 2 more rest days elsewhere (not following a hard)
    pat[4] = null
    pat[5] = null
    const r = analyzeRestDayDistribution({ log: buildLog(pat), today: TODAY })
    expect(r.hardDayCount).toBe(4)
    expect(r.postHardRestCount).toBe(2)
    expect(r.postHardRestRate).toBe(0.5)
    expect(r.restDayCount).toBe(4)
    expect(r.pattern).toBe('WELL_PLACED')
  })
})

// ─── 4. MIXED ───────────────────────────────────────────────────────────────
describe('analyzeRestDayDistribution — MIXED', () => {
  it('classifies as MIXED when rest count ≥ 4 but post-hard rate < 0.5', () => {
    // 4 hards, 0 followed by rest, but 4 rest days scattered elsewhere.
    // Hards: 0, 7, 14, 21. After-hard days (1,8,15,22) ALL have EASY.
    // Rest days: 4, 11, 18, 25 (random placement, none after hard)
    const pat = new Array(28).fill(null)
    for (let i = 0; i < 28; i++) pat[i] = 5  // default EASY
    pat[0] = 8; pat[7] = 8; pat[14] = 8; pat[21] = 8
    // After-hard days stay EASY
    pat[4] = null
    pat[11] = null
    pat[18] = null
    pat[25] = null
    const r = analyzeRestDayDistribution({ log: buildLog(pat), today: TODAY })
    expect(r.hardDayCount).toBe(4)
    expect(r.postHardRestCount).toBe(0)
    expect(r.postHardRestRate).toBe(0)
    expect(r.restDayCount).toBe(4)
    expect(r.pattern).toBe('MIXED')
  })
})

// ─── 5. TOO_FEW_REST ────────────────────────────────────────────────────────
describe('analyzeRestDayDistribution — TOO_FEW_REST', () => {
  it('classifies as TOO_FEW_REST when restDayCount < 4', () => {
    // 3 rest days only, even if every hard is followed by rest.
    // Day 0,2 HARD. Day 1,3 REST. Day 5 REST (random).
    // Other days EASY.
    const pat = new Array(28).fill(null)
    for (let i = 0; i < 28; i++) pat[i] = 5
    pat[0] = 8
    pat[1] = null
    pat[2] = 8
    pat[3] = null
    pat[5] = null
    const r = analyzeRestDayDistribution({ log: buildLog(pat), today: TODAY })
    expect(r.restDayCount).toBe(3)
    expect(r.pattern).toBe('TOO_FEW_REST')
  })

  it('TOO_FEW_REST takes precedence over high post-hard rate', () => {
    // Even with 100% post-hard rest, < 4 rest days → TOO_FEW_REST
    const pat = new Array(28).fill(null)
    for (let i = 0; i < 28; i++) pat[i] = 5
    pat[0] = 8; pat[1] = null
    pat[5] = 8; pat[6] = null
    // 2 rest days, 2 hards, both followed by rest → rate=1.0
    const r = analyzeRestDayDistribution({ log: buildLog(pat), today: TODAY })
    expect(r.restDayCount).toBe(2)
    expect(r.postHardRestRate).toBe(1)
    expect(r.pattern).toBe('TOO_FEW_REST')
  })
})

// ─── 6. Classification logic ────────────────────────────────────────────────
describe('analyzeRestDayDistribution — day classification', () => {
  it('REST = no session; HARD = max RPE ≥ 7; EASY = max RPE < 7', () => {
    const pat = new Array(28).fill(null)
    for (let i = 0; i < 28; i++) pat[i] = 4  // all EASY
    pat[10] = 9                              // HARD
    pat[11] = 6                              // EASY (rpe=6 < 7)
    pat[12] = null                           // REST
    // boundary: rpe exactly 7 → HARD
    pat[13] = 7
    const r = analyzeRestDayDistribution({ log: buildLog(pat), today: TODAY })
    expect(r.hardDayCount).toBe(2)  // day 10 + day 13
    expect(r.easyDayCount).toBe(25) // all others with rpe < 7
    expect(r.restDayCount).toBe(1)  // only day 12
  })

  it('day classified HARD if ANY session that day has RPE ≥ 7', () => {
    // Two sessions same day: easy AM, hard PM → HARD
    const pat = new Array(28).fill(null)
    for (let i = 0; i < 28; i++) pat[i] = 4
    const log = buildLog(pat)
    // Add an extra HARD session on day 10 already filled with rpe=4
    log.push({ date: addDays(WINDOW_START, 10), rpe: 8, type: 'intervals' })
    const r = analyzeRestDayDistribution({ log, today: TODAY })
    expect(r.hardDayCount).toBe(1)
  })
})

// ─── 7. postHardRest counting — day 0 cannot count ──────────────────────────
describe('analyzeRestDayDistribution — postHardRest counting', () => {
  it('day 0 is not counted as post-hard rest (no preceding in-window day)', () => {
    // Day 0 = REST. Hard sessions later in window.
    // We do NOT want the "rest" on day 0 to count for any preceding hard.
    const pat = new Array(28).fill(null)
    // pat[0] = null (REST)
    for (let i = 1; i < 28; i++) pat[i] = 5  // EASY
    pat[5] = 8                                // HARD
    pat[6] = null                             // REST after hard
    pat[10] = 8                               // HARD
    pat[11] = null                            // REST after hard
    pat[15] = 8                               // HARD
    pat[16] = null                            // REST after hard
    const r = analyzeRestDayDistribution({ log: buildLog(pat), today: TODAY })
    // 4 rest days: 0, 6, 11, 16
    expect(r.restDayCount).toBe(4)
    expect(r.hardDayCount).toBe(3)
    // Only days 6, 11, 16 follow a hard — day 0 doesn't have one before it
    expect(r.postHardRestCount).toBe(3)
    expect(r.postHardRestRate).toBe(1)
  })

  it('counts back-to-back hard→rest correctly', () => {
    // Days 5,6,7 all HARD, day 8 REST → only day 8 counts (preceded by H)
    const pat = new Array(28).fill(null)
    for (let i = 0; i < 28; i++) pat[i] = 5
    pat[5] = 8; pat[6] = 8; pat[7] = 8
    pat[8] = null
    // Add 3 more rest days elsewhere to hit ≥4
    pat[15] = null
    pat[20] = null
    pat[25] = null
    const r = analyzeRestDayDistribution({ log: buildLog(pat), today: TODAY })
    expect(r.hardDayCount).toBe(3)
    // Day 8 was post-hard rest. Days 15/20/25 were preceded by EASY days.
    expect(r.postHardRestCount).toBe(1)
    expect(r.restDayCount).toBe(4)
  })
})

// ─── 8. Window boundary ─────────────────────────────────────────────────────
describe('analyzeRestDayDistribution — window boundary', () => {
  it('excludes entries outside the trailing 28-day window', () => {
    // Build a normal in-window pattern then add far-past and future outliers
    const pat = new Array(28).fill(null)
    for (let i = 0; i < 28; i += 2) pat[i] = 8
    const log = buildLog(pat)
    log.push({ date: '2020-01-01', rpe: 9, type: 'run' })
    log.push({ date: '2027-01-01', rpe: 9, type: 'run' })
    const r = analyzeRestDayDistribution({ log, today: TODAY })
    expect(r).not.toBeNull()
    // 14 even-indexed HARD days; 14 odd-indexed REST days (when ignoring outliers)
    expect(r.hardDayCount).toBe(14)
    expect(r.restDayCount).toBe(14)
  })

  it('respects custom windowDays (e.g., 14)', () => {
    // For windowDays=14, oldest must be at least 13 days before today.
    const log = []
    // Oldest entry today-13 = 2026-04-15
    for (let i = 0; i < 14; i++) {
      const date = addDays('2026-04-15', i)
      // 5 active days: HARD on i=0,4,8 + EASY on i=12; REST elsewhere
      if (i === 0 || i === 4 || i === 8) log.push({ date, rpe: 8 })
      if (i === 12) log.push({ date, rpe: 5 })
      if (i === 6) log.push({ date, rpe: 5 })
      if (i === 2) log.push({ date, rpe: 5 })
    }
    const r = analyzeRestDayDistribution({
      log, today: TODAY, windowDays: 14,
    })
    expect(r).not.toBeNull()
    // hards: 3; rest: 14 − 6 active = 8
    expect(r.hardDayCount).toBe(3)
    expect(r.restDayCount).toBe(8)
  })
})

// ─── 9. Edge cases ──────────────────────────────────────────────────────────
describe('analyzeRestDayDistribution — edge cases', () => {
  it('handles entries with missing or non-numeric RPE as EASY (0)', () => {
    // 28 days, all with sessions but no RPE → all EASY, 0 rest, < 4 rest
    const log = [{ date: addDays(WINDOW_START, -1), rpe: 5 }]
    for (let i = 0; i < 28; i++) {
      log.push({ date: addDays(WINDOW_START, i), type: 'easy' })
    }
    const r = analyzeRestDayDistribution({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.hardDayCount).toBe(0)
    expect(r.easyDayCount).toBe(28)
    expect(r.restDayCount).toBe(0)
    expect(r.pattern).toBe('TOO_FEW_REST')
  })

  it('postHardRestRate is 0 when no hard days exist', () => {
    // All EASY → hardDayCount = 0, rate = 0
    const pat = new Array(28).fill(null)
    // 24 easy + 4 rest spread out
    for (let i = 0; i < 28; i++) pat[i] = 4
    pat[3] = null
    pat[10] = null
    pat[17] = null
    pat[24] = null
    const r = analyzeRestDayDistribution({ log: buildLog(pat), today: TODAY })
    expect(r.hardDayCount).toBe(0)
    expect(r.postHardRestRate).toBe(0)
    expect(r.restDayCount).toBe(4)
    // 4 rest + rate < 0.5 → MIXED
    expect(r.pattern).toBe('MIXED')
  })

  it('handles entries with malformed/missing date by skipping them', () => {
    // Build valid pattern and inject malformed entries — function must ignore
    const pat = new Array(28).fill(null)
    for (let i = 0; i < 28; i += 2) pat[i] = 8
    const log = buildLog(pat)
    log.push({ rpe: 9 })           // no date
    log.push(null)                  // null entry
    log.push({ date: '', rpe: 8 })  // empty date string
    const r = analyzeRestDayDistribution({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.hardDayCount).toBe(14)
  })
})
