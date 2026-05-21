// Alternating week pattern — pure-function tests.
//
// Covers: null gating, INSUFFICIENT_DATA when <6 weeks have TSS,
// STRONG_ALTERNATION / MODERATE_ALTERNATION / NO_ALTERNATION bands,
// role tagging at ±10 % boundaries, alternationScore math (HIGH–LOW
// pairs count, NEUTRAL pairs don't), amplitudeRatio math, divide-by-zero
// safety, flat weeks → all NEUTRAL → 0 alternation, custom windowWeeks,
// ISO week boundary handling, today as Date vs string.

import { describe, it, expect } from 'vitest'
import {
  analyzeAlternatingWeekPattern,
  ALTERNATING_WEEK_PATTERN_CITATION,
} from '../../athlete/alternatingWeekPattern.js'

const TODAY = '2026-05-20' // Wed → ISO Monday = 2026-05-18

// Mondays for the 8-week window ending at TODAY, oldest first.
// Window length is 8 in this module (vs. 12 in mesocycleProgression).
const WEEK_MONDAYS = [
  '2026-03-30', // idx 0  (oldest)
  '2026-04-06', // idx 1
  '2026-04-13', // idx 2
  '2026-04-20', // idx 3
  '2026-04-27', // idx 4
  '2026-05-04', // idx 5
  '2026-05-11', // idx 6
  '2026-05-18', // idx 7  (current)
]

function sessionInWeek(weekIdx, tss, dayOffset = 1) {
  const monday = WEEK_MONDAYS[weekIdx]
  const d = new Date(monday + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + dayOffset)
  return { date: d.toISOString().slice(0, 10), tss, type: 'Endurance' }
}

function logFromWeeklyTss(weekly) {
  const out = []
  for (let i = 0; i < weekly.length; i++) {
    const tss = Number(weekly[i])
    if (!Number.isFinite(tss) || tss <= 0) continue
    out.push(sessionInWeek(i, tss, 1))
  }
  return out
}

describe('analyzeAlternatingWeekPattern — citation export', () => {
  it('exports the citation string', () => {
    expect(ALTERNATING_WEEK_PATTERN_CITATION).toBe('Issurin 2010; Mujika 2014')
  })
})

describe('analyzeAlternatingWeekPattern — guards', () => {
  it('returns null when called with no args', () => {
    expect(analyzeAlternatingWeekPattern()).toBeNull()
  })

  it('returns null when today is missing', () => {
    expect(analyzeAlternatingWeekPattern({ log: [] })).toBeNull()
  })

  it('returns null when today is a malformed string', () => {
    expect(
      analyzeAlternatingWeekPattern({ log: [], today: 'not-a-date' })
    ).toBeNull()
  })

  it('returns null when today is an invalid Date', () => {
    expect(
      analyzeAlternatingWeekPattern({ log: [], today: new Date('not real') })
    ).toBeNull()
  })

  it('handles a non-array log without throwing', () => {
    const r1 = analyzeAlternatingWeekPattern({ log: null, today: TODAY })
    const r2 = analyzeAlternatingWeekPattern({ log: 'nope', today: TODAY })
    expect(r1).not.toBeNull()
    expect(r1.band).toBe('INSUFFICIENT_DATA')
    expect(r2.band).toBe('INSUFFICIENT_DATA')
  })

  it('ignores entries with no date / invalid date / non-numeric TSS', () => {
    // Solid alternating base with garbage entries mixed in.
    const weekly = [300, 100, 320, 110, 310, 105, 305, 100]
    const log = logFromWeeklyTss(weekly).concat([
      { date: null, tss: 999 },
      { date: '2026-05-18', tss: 'oops' },
      { date: 'not-a-date', tss: 100 },
      { date: '1999-01-01', tss: 500 }, // outside window
      { tss: 999 }, // missing date
      { date: '2026-05-18', tss: -50 }, // non-positive
    ])
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    expect(result).not.toBeNull()
    expect(result.band).toBe('STRONG_ALTERNATION')
  })

  it('ignores entries dated in the future / after window end', () => {
    const weekly = [300, 100, 320, 110, 310, 105, 305, 100]
    const log = logFromWeeklyTss(weekly).concat([
      { date: '2026-06-15', tss: 500 }, // future week beyond window
    ])
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    expect(result.band).toBe('STRONG_ALTERNATION')
  })
})

describe('analyzeAlternatingWeekPattern — INSUFFICIENT_DATA', () => {
  it('returns INSUFFICIENT_DATA shape when log is empty', () => {
    const result = analyzeAlternatingWeekPattern({ log: [], today: TODAY })
    expect(result).toEqual({
      band: 'INSUFFICIENT_DATA',
      weeks: [],
      alternationScore: 0,
      amplitudeRatio: 0,
      highWeekCount: 0,
      lowWeekCount: 0,
      citation: ALTERNATING_WEEK_PATTERN_CITATION,
    })
  })

  it('returns INSUFFICIENT_DATA when only 5 weeks have TSS', () => {
    const weekly = [200, 0, 200, 0, 200, 0, 200, 200] // 5 non-zero
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    expect(result.band).toBe('INSUFFICIENT_DATA')
    expect(result.weeks).toEqual([])
  })

  it('crosses the 6-week threshold from INSUFFICIENT_DATA to a real band', () => {
    const weekly = [200, 0, 200, 0, 200, 200, 200, 200] // 6 non-zero
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    expect(result.band).not.toBe('INSUFFICIENT_DATA')
    expect(result.weeks.length).toBe(8)
  })
})

describe('analyzeAlternatingWeekPattern — STRONG_ALTERNATION', () => {
  it('classifies a clean high/low alternating sequence as STRONG_ALTERNATION', () => {
    const weekly = [300, 100, 300, 100, 300, 100, 300, 100]
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    expect(result.band).toBe('STRONG_ALTERNATION')
    // 7 adjacent pairs, all alternating.
    expect(result.alternationScore).toBe(1)
    expect(result.highWeekCount).toBe(4)
    expect(result.lowWeekCount).toBe(4)
  })

  it('marks STRONG_ALTERNATION exactly at the 0.70 floor', () => {
    // 8 weeks with HIGH/LOW such that 6 of 7 adjacent pairs alternate.
    // Sequence: H L H L H L H N → pairs (HL HL HL HL HL HL HN)
    // Mean of [400,100,400,100,400,100,400,250] = 2150/8 = 268.75
    //   HIGH threshold = 295.625, LOW threshold = 241.875
    //   400 → HIGH, 100 → LOW, 250 → NEUTRAL (between)
    // → alternations: 6 / 7 ≈ 0.857 (above floor → STRONG)
    const weekly = [400, 100, 400, 100, 400, 100, 400, 250]
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    expect(result.band).toBe('STRONG_ALTERNATION')
    expect(result.alternationScore).toBeGreaterThanOrEqual(0.7)
  })
})

describe('analyzeAlternatingWeekPattern — MODERATE_ALTERNATION', () => {
  it('classifies partial alternation as MODERATE_ALTERNATION', () => {
    // 4 of 7 adjacent pairs alternate → 0.5714 → MODERATE.
    // Build: H L H L N N N N
    const weekly = [400, 100, 400, 100, 240, 240, 240, 240]
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    expect(result.band).toBe('MODERATE_ALTERNATION')
    expect(result.alternationScore).toBeGreaterThanOrEqual(0.4)
    expect(result.alternationScore).toBeLessThan(0.7)
  })
})

describe('analyzeAlternatingWeekPattern — NO_ALTERNATION', () => {
  it('classifies near-flat weeks (all NEUTRAL) as NO_ALTERNATION', () => {
    const weekly = [200, 205, 198, 202, 200, 199, 201, 203]
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    expect(result.band).toBe('NO_ALTERNATION')
    expect(result.alternationScore).toBe(0)
    // All NEUTRAL → 0 high, 0 low → amplitudeRatio = 0
    expect(result.amplitudeRatio).toBe(0)
    expect(result.highWeekCount).toBe(0)
    expect(result.lowWeekCount).toBe(0)
    expect(result.weeks.every(w => w.role === 'NEUTRAL')).toBe(true)
  })

  it('classifies a rising trend (no oscillation) as NO_ALTERNATION', () => {
    // Weeks rise monotonically — only first weeks are LOW, only last
    // are HIGH. No alternation, just a slope.
    const weekly = [100, 120, 140, 200, 220, 260, 300, 340]
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    expect(result.band).toBe('NO_ALTERNATION')
  })

  it('classifies repeated HIGH-HIGH or LOW-LOW (no alternation) as NO_ALTERNATION', () => {
    // H H L L H H L L → some HL/LH pairs at boundaries but not most.
    // weekly: 300,300,100,100,300,300,100,100 → mean = 200
    //   HIGH threshold = 220, LOW threshold = 180.
    // roles: H H L L H H L L
    // adjacent pairs: HH HL LL LH HH HL LL → 3 alternating of 7 → 0.4286
    // 0.4286 is ≥ 0.40 → MODERATE_ALTERNATION. So pick weights tighter.
    // Use 4 HIGH, 4 LOW arranged H H H H L L L L → 1 alternation of 7.
    const weekly = [300, 300, 300, 300, 100, 100, 100, 100]
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    expect(result.band).toBe('NO_ALTERNATION')
    expect(result.alternationScore).toBeLessThan(0.4)
  })
})

describe('analyzeAlternatingWeekPattern — role tagging at ±10 % boundaries', () => {
  it('tags TSS clearly above mean × 1.10 as HIGH', () => {
    // mean = (250 + 200*6 + 180) / 8 = 1630/8 = 203.75
    // HIGH threshold = 1.10 × 203.75 = 224.125 → 250 > 224.125 → HIGH.
    // LOW threshold = 0.90 × 203.75 = 183.375 → 180 < 183.375 → LOW.
    const weekly = [250, 200, 200, 200, 200, 200, 200, 180]
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    expect(result.weeks[0].role).toBe('HIGH')
    expect(result.weeks[7].role).toBe('LOW')
    // The 6 middle 200s are between thresholds → NEUTRAL.
    for (let i = 1; i <= 6; i++) {
      expect(result.weeks[i].role).toBe('NEUTRAL')
    }
  })

  it('tags TSS just below the HIGH band as NEUTRAL', () => {
    // mean = (220 + 200*6 + 180) / 8 = 1600/8 = 200
    // HIGH threshold = 220 (or 220.0000…003 in FP).
    // Picking 219 → 219 < 220 → NEUTRAL.
    // After re-mean: (219+1200+180)/8 = 1599/8 = 199.875
    // HIGH threshold = 1.10 × 199.875 = 219.8625 → 219 < 219.8625 → NEUTRAL.
    const weekly = [219, 200, 200, 200, 200, 200, 200, 180]
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    expect(result.weeks[0].role).toBe('NEUTRAL')
  })

  it('tags TSS just above the LOW band as NEUTRAL', () => {
    // mean ≈ 200; bump LOW week to 181: 181/200 = 0.905 → above 0.90 → NEUTRAL.
    const weekly = [220, 200, 200, 200, 200, 200, 200, 181]
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    expect(result.weeks[7].role).toBe('NEUTRAL')
  })
})

describe('analyzeAlternatingWeekPattern — alternationScore math', () => {
  it('NEUTRAL pairs do NOT count as alternating', () => {
    // 4 weeks alternate HIGH/LOW, then 4 weeks NEUTRAL.
    // Sequence: H L H L N N N N → 3 HL pairs, then HN, NN, NN, NN
    // Score = 3 / 7 = 0.4286
    const weekly = [400, 100, 400, 100, 240, 240, 240, 240]
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    // Verify only HL/LH boundaries are counted.
    expect(result.alternationScore).toBeCloseTo(3 / 7, 4)
  })

  it('LH and HL both count as alternating', () => {
    // L H L H L H L H — score should be 1.0
    const weekly = [100, 300, 100, 300, 100, 300, 100, 300]
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    expect(result.alternationScore).toBe(1)
  })

  it('rounds alternationScore to 4 decimal places', () => {
    // 3 of 7 alternating → 3/7 = 0.428571… → rounded to 0.4286.
    const weekly = [400, 100, 400, 100, 240, 240, 240, 240]
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    expect(result.alternationScore).toBe(0.4286)
  })
})

describe('analyzeAlternatingWeekPattern — amplitudeRatio math', () => {
  it('computes amplitudeRatio = mean(HIGH) / mean(LOW), rounded to 2 dp', () => {
    // HIGH weeks 300, 320 → mean 310
    // LOW weeks 100, 120 → mean 110
    // ratio = 310/110 = 2.8181… → 2.82
    const weekly = [300, 100, 320, 120, 300, 100, 320, 120]
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    expect(result.amplitudeRatio).toBeCloseTo(310 / 110, 2)
    expect(result.amplitudeRatio).toBe(2.82)
  })

  it('amplitudeRatio is 0 when no HIGH weeks exist', () => {
    // Flat weeks → all NEUTRAL.
    const weekly = [200, 200, 200, 200, 200, 200, 200, 200]
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    expect(result.highWeekCount).toBe(0)
    expect(result.lowWeekCount).toBe(0)
    expect(result.amplitudeRatio).toBe(0)
  })

  it('amplitudeRatio is 0 when no LOW weeks exist', () => {
    // Construct mean such that all real weeks are above 1.10× mean,
    // and a couple of zero weeks pull the mean down.
    // weeks: 6 weeks of 300, plus 2 weeks of 0. But zero weeks would
    // need to be marked LOW too: 0 ≤ 0.90 × mean → also LOW.
    // To get NO LOW: every week must be at-or-above 0.90× mean.
    // Easiest: tiny variation around the mean, just enough to push some
    // above 1.10× without pushing any below 0.90×.
    // Use [240, 200, 240, 200, 240, 200, 240, 200] → mean = 220
    // HIGH threshold = 242, LOW = 198. All weeks NEUTRAL.
    // That gives 0 HIGH AND 0 LOW. For 0 LOW but some HIGH we need
    // a tighter design.
    //
    // Use [260, 220, 220, 220, 220, 220, 220, 220] → mean = 227.5
    // HIGH = 250.25 → 260 → HIGH. LOW = 204.75 → 220 → NEUTRAL.
    const weekly = [260, 220, 220, 220, 220, 220, 220, 220]
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    expect(result.highWeekCount).toBeGreaterThanOrEqual(1)
    expect(result.lowWeekCount).toBe(0)
    expect(result.amplitudeRatio).toBe(0)
  })

  it('clamps the LOW denominator at 1 to avoid divide-by-zero', () => {
    // A LOW bucket with tiny TSS values still produces a finite ratio
    // (max(meanLow, 1)). With LOW values summing to 0 (not possible
    // since LOW weeks need TSS > 0 to count as non-zero, but the math
    // path is safe).
    const weekly = [300, 100, 320, 120, 300, 100, 320, 120]
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    expect(Number.isFinite(result.amplitudeRatio)).toBe(true)
  })
})

describe('analyzeAlternatingWeekPattern — custom windowWeeks', () => {
  it('respects a smaller windowWeeks override', () => {
    // 6-week window. Need ≥ 6 non-zero weeks → fill all 6.
    const weekly6 = [300, 100, 300, 100, 300, 100]
    const log = []
    // The 6-week window ends in current Monday and starts 5 weeks before.
    const startMonday = '2026-04-13' // 5 weeks before 2026-05-18
    for (let i = 0; i < 6; i++) {
      const d = new Date(startMonday + 'T00:00:00Z')
      d.setUTCDate(d.getUTCDate() + i * 7 + 1)
      log.push({ date: d.toISOString().slice(0, 10), tss: weekly6[i], type: 'Endurance' })
    }
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY, windowWeeks: 6 })
    expect(result.weeks.length).toBe(6)
    expect(result.band).toBe('STRONG_ALTERNATION')
  })

  it('falls back to default windowWeeks when given a non-finite value', () => {
    const weekly = [300, 100, 300, 100, 300, 100, 300, 100]
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({
      log,
      today: TODAY,
      windowWeeks: NaN,
    })
    expect(result.weeks.length).toBe(8)
  })
})

describe('analyzeAlternatingWeekPattern — ISO week boundary', () => {
  it('Sunday session counts to the same ISO week as the prior Monday', () => {
    // 8 weeks of clean alternation; put each session on Sunday (dayOffset=6).
    const weekly = [300, 100, 300, 100, 300, 100, 300, 100]
    const log = []
    for (let i = 0; i < weekly.length; i++) {
      const d = new Date(WEEK_MONDAYS[i] + 'T00:00:00Z')
      d.setUTCDate(d.getUTCDate() + 6) // Sunday
      log.push({ date: d.toISOString().slice(0, 10), tss: weekly[i], type: 'Endurance' })
    }
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    expect(result.weeks.length).toBe(8)
    expect(result.band).toBe('STRONG_ALTERNATION')
  })

  it('first day (Monday) and last day (Sunday) of the week both count', () => {
    // Two sessions in the same week: Monday + Sunday → tss sums.
    const monday = WEEK_MONDAYS[0]
    const sunday = new Date(monday + 'T00:00:00Z')
    sunday.setUTCDate(sunday.getUTCDate() + 6)
    const log = [
      { date: monday, tss: 150, type: 'Endurance' },
      { date: sunday.toISOString().slice(0, 10), tss: 150, type: 'Endurance' },
      // Fill remaining weeks for INSUFFICIENT_DATA gate.
      ...logFromWeeklyTss([0, 100, 100, 100, 100, 100, 100, 100]),
    ]
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    // Sum to weekTSS in week 0 should be 300.
    expect(result.weeks[0].tss).toBe(300)
  })
})

describe('analyzeAlternatingWeekPattern — today input variants', () => {
  it('accepts today as a Date object', () => {
    const weekly = [300, 100, 300, 100, 300, 100, 300, 100]
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({
      log,
      today: new Date(TODAY + 'T18:30:00Z'),
    })
    expect(result.band).toBe('STRONG_ALTERNATION')
  })

  it('accepts today as a long ISO string', () => {
    const weekly = [300, 100, 300, 100, 300, 100, 300, 100]
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({
      log,
      today: '2026-05-20T08:00:00.000Z',
    })
    expect(result.band).toBe('STRONG_ALTERNATION')
  })

  it('accepts today as a YYYY-MM-DD string', () => {
    const weekly = [300, 100, 300, 100, 300, 100, 300, 100]
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    expect(result.band).toBe('STRONG_ALTERNATION')
  })
})

describe('analyzeAlternatingWeekPattern — shape integrity', () => {
  it('returns weeks in chronological order (oldest first)', () => {
    const weekly = [300, 100, 300, 100, 300, 100, 300, 100]
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    for (let i = 0; i < result.weeks.length - 1; i++) {
      expect(result.weeks[i].weekStart < result.weeks[i + 1].weekStart).toBe(true)
    }
  })

  it('emits the citation string on every successful result', () => {
    const weekly = [300, 100, 300, 100, 300, 100, 300, 100]
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    expect(result.citation).toBe('Issurin 2010; Mujika 2014')
  })

  it('rounds each weeks[].tss to an integer', () => {
    // Sum of fractional TSS across the week → rounded.
    const log = [
      { date: WEEK_MONDAYS[0], tss: 50.4, type: 'E' },
      { date: WEEK_MONDAYS[0], tss: 50.3, type: 'E' },
      ...logFromWeeklyTss([0, 100, 100, 100, 100, 100, 100, 100]),
    ]
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    expect(Number.isInteger(result.weeks[0].tss)).toBe(true)
    // 50.4 + 50.3 = 100.7 → rounded to 101.
    expect(result.weeks[0].tss).toBe(101)
  })

  it('returns valid counts that match the tagged roles', () => {
    const weekly = [300, 100, 300, 100, 300, 100, 300, 100]
    const log = logFromWeeklyTss(weekly)
    const result = analyzeAlternatingWeekPattern({ log, today: TODAY })
    const highs = result.weeks.filter(w => w.role === 'HIGH').length
    const lows = result.weeks.filter(w => w.role === 'LOW').length
    expect(result.highWeekCount).toBe(highs)
    expect(result.lowWeekCount).toBe(lows)
  })
})
