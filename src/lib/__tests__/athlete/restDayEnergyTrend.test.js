// ─── restDayEnergyTrend.test.js — rest-day-vs-training-day energy gap tests ──

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  analyzeRestDayEnergyTrend,
  REST_DAY_ENERGY_TREND_CITATION,
  DEFAULT_WINDOW_DAYS,
  DEFAULT_TREND_WINDOW_DAYS,
} from '../../athlete/restDayEnergyTrend.js'

const TODAY = '2026-05-14' // Thursday → ISO 2026-W20

function daysAgo(n) {
  const d = new Date(`${TODAY}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/** Make a training-log entry that counts as a "training day". */
function train(age, { tss = 50 } = {}) {
  return { date: daysAgo(age), tss }
}
/** Make a recovery-log entry. */
function rec(age, energy) {
  return { date: daysAgo(age), energy }
}

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  vi.setSystemTime(new Date())
})

// ─── Exports ────────────────────────────────────────────────────────────────

describe('restDayEnergyTrend — constants & exports', () => {
  it('exports the documented citation', () => {
    expect(REST_DAY_ENERGY_TREND_CITATION).toBe('Lemyre 2007; Kellmann 2018')
  })

  it('exports the documented defaults', () => {
    expect(DEFAULT_WINDOW_DAYS).toBe(30)
    expect(DEFAULT_TREND_WINDOW_DAYS).toBe(56)
  })
})

// ─── Null gates ─────────────────────────────────────────────────────────────

describe('restDayEnergyTrend — null gates', () => {
  it('falls back to the system clock when today is omitted', () => {
    // System clock is frozen at TODAY by setSystemTime; with no data we
    // still get null (no usable means), but the function reached the
    // means-check stage rather than the resolve-today gate.
    expect(analyzeRestDayEnergyTrend({ log: [], recovery: [] })).toBeNull()
  })

  it('returns null when today is a malformed string', () => {
    expect(
      analyzeRestDayEnergyTrend({ log: [], recovery: [], today: 'oops' }),
    ).toBeNull()
    expect(
      analyzeRestDayEnergyTrend({ log: [], recovery: [], today: 'not-a-date' }),
    ).toBeNull()
  })

  it('returns null when today is an invalid Date instance', () => {
    expect(
      analyzeRestDayEnergyTrend({ log: [], recovery: [], today: new Date('bogus') }),
    ).toBeNull()
  })

  it('returns null when there is no recovery data at all', () => {
    const out = analyzeRestDayEnergyTrend({
      log: [train(1), train(3)],
      recovery: [],
      today: TODAY,
    })
    expect(out).toBeNull()
  })

  it('returns null when recovery is null and no usable data', () => {
    expect(
      analyzeRestDayEnergyTrend({ log: null, recovery: null, today: TODAY }),
    ).toBeNull()
  })

  it('returns null when both recent means are null (only 1-2 samples each)', () => {
    // 2 rest-day entries and 1 training-day entry — both below MIN_DAY_COUNT (3)
    const recovery = [
      rec(0, 6),
      rec(2, 6),
      rec(1, 5),
    ]
    const log = [train(1)]
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    expect(out).toBeNull()
  })
})

// ─── Day classification ─────────────────────────────────────────────────────

describe('restDayEnergyTrend — day classification (rest vs training)', () => {
  it('classifies a day with a training entry (tss > 0) as a training day', () => {
    const log = [train(0), train(2), train(4)]
    const recovery = [
      rec(0, 5), rec(2, 5), rec(4, 5), // training days
      rec(1, 7), rec(3, 7), rec(5, 7), // rest days
    ]
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.recentTrainingDayMean).toBeCloseTo(5, 5)
    expect(out.recentRestDayMean).toBeCloseTo(7, 5)
    expect(out.energyGap).toBeCloseTo(2, 5)
  })

  it('classifies durationMin > 0 (no tss) as a training day', () => {
    const log = [
      { date: daysAgo(0), durationMin: 60 },
      { date: daysAgo(2), durationMin: 45 },
      { date: daysAgo(4), durationMin: 90 },
    ]
    const recovery = [
      rec(0, 5), rec(2, 5), rec(4, 5),
      rec(1, 8), rec(3, 8), rec(5, 8),
    ]
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    expect(out.recentTrainingDayMean).toBeCloseTo(5, 5)
    expect(out.recentRestDayMean).toBeCloseTo(8, 5)
  })

  it('classifies duration_min > 0 (snake_case) as a training day', () => {
    const log = [
      { date: daysAgo(0), duration_min: 60 },
      { date: daysAgo(2), duration_min: 45 },
      { date: daysAgo(4), duration_min: 90 },
    ]
    const recovery = [
      rec(0, 4), rec(2, 4), rec(4, 4),
      rec(1, 9), rec(3, 9), rec(5, 9),
    ]
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    expect(out.recentTrainingDayMean).toBeCloseTo(4, 5)
    expect(out.recentRestDayMean).toBeCloseTo(9, 5)
  })

  it('classifies a day with tss=0 and duration=0 as a rest day', () => {
    const log = [{ date: daysAgo(0), tss: 0, durationMin: 0 }]
    const recovery = [
      rec(0, 7), rec(1, 7), rec(2, 7), // all classified as rest (no training)
    ]
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    expect(out.restDayCount).toBe(3)
    expect(out.trainingDayCount).toBe(0)
  })

  it('skips recovery entries missing the energy field', () => {
    const log = [train(0), train(2)]
    const recovery = [
      rec(0, 5), rec(2, 5),
      { date: daysAgo(4) }, // missing energy → skipped
      rec(1, 7), rec(3, 7), rec(5, 7),
      { date: daysAgo(7), energy: 'oops' }, // non-finite → skipped
    ]
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    // training samples: rec(0,5), rec(2,5) = 2 → below MIN, training mean null
    expect(out.trainingDayCount).toBe(2)
    expect(out.recentTrainingDayMean).toBeNull()
    // rest samples: rec(1,7), rec(3,7), rec(5,7) = 3
    expect(out.restDayCount).toBe(3)
    expect(out.recentRestDayMean).toBeCloseTo(7, 5)
  })
})

// ─── Means + gap math ───────────────────────────────────────────────────────

describe('restDayEnergyTrend — recent means + gap', () => {
  it('recentRestDayMean null when fewer than 3 rest-day samples', () => {
    const log = [train(0), train(1), train(2), train(3), train(4)]
    const recovery = [
      rec(0, 5), rec(1, 5), rec(2, 5), // 3 training
      rec(5, 7), rec(6, 7),            // only 2 rest → null
    ]
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    expect(out.restDayCount).toBe(2)
    expect(out.recentRestDayMean).toBeNull()
    expect(out.recentTrainingDayMean).toBeCloseTo(5, 5)
    expect(out.energyGap).toBeNull()
  })

  it('recentTrainingDayMean null when fewer than 3 training-day samples', () => {
    const log = [train(0), train(1)] // only 2 training days
    const recovery = [
      rec(0, 5), rec(1, 5),            // 2 training
      rec(3, 8), rec(5, 8), rec(7, 8), // 3 rest
    ]
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    expect(out.trainingDayCount).toBe(2)
    expect(out.recentTrainingDayMean).toBeNull()
    expect(out.recentRestDayMean).toBeCloseTo(8, 5)
    expect(out.energyGap).toBeNull()
  })

  it('rounds means + gap to two decimal places', () => {
    // rest: 7,7,8 → 7.333; training: 5,5,6 → 5.333; gap = 2.00
    const log = [train(0), train(2), train(4)]
    const recovery = [
      rec(0, 5), rec(2, 5), rec(4, 6),
      rec(1, 7), rec(3, 7), rec(5, 8),
    ]
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    expect(out.recentRestDayMean).toBe(7.33)
    expect(out.recentTrainingDayMean).toBe(5.33)
    expect(out.energyGap).toBe(2)
  })

  it('computes a positive gap when rest energy exceeds training energy', () => {
    const log = [train(0), train(2), train(4)]
    const recovery = [
      rec(0, 6), rec(2, 6), rec(4, 6),
      rec(1, 8), rec(3, 8), rec(5, 8),
    ]
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    expect(out.energyGap).toBeCloseTo(2, 5)
  })

  it('computes a negative gap when rest energy is BELOW training energy', () => {
    const log = [train(0), train(2), train(4)]
    const recovery = [
      rec(0, 8), rec(2, 8), rec(4, 8),
      rec(1, 5), rec(3, 5), rec(5, 5),
    ]
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    expect(out.energyGap).toBeCloseTo(-3, 5)
  })
})

// ─── Bands ──────────────────────────────────────────────────────────────────

describe('restDayEnergyTrend — band classification', () => {
  it('BURNOUT_SIGNAL when gap is negative (rest energy below training)', () => {
    const log = [train(0), train(2), train(4)]
    const recovery = [
      rec(0, 7), rec(2, 7), rec(4, 7),
      rec(1, 5), rec(3, 5), rec(5, 5),
    ]
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    expect(out.energyGap).toBeLessThan(0)
    expect(out.band).toBe('BURNOUT_SIGNAL')
  })

  it('BURNOUT_SIGNAL when trend is collapsing (< -0.20 per week) even with positive gap', () => {
    // Build a wide trend window where weekly gap collapses week-on-week.
    // Use ages 0..55 (8 weeks). Each week alternates: 4 training days at
    // energy = trainE, 3 rest days at energy = restE. We schedule the gap
    // to fall by 0.5 each ISO week → slope ≈ -0.5 per week.
    const log = []
    const recovery = []
    // Map ISO weeks back to ages relative to TODAY = 2026-05-14 (W20).
    // Week W20: ages 0..3 (Mon=age3, Thu=age0 etc). For simplicity we just
    // tile 7 consecutive days per "week" relative to the trend mapping.
    for (let weekIdx = 0; weekIdx < 8; weekIdx++) {
      // Newest week (closest to TODAY) gets the lowest gap; oldest week the largest.
      // We want slope = -0.5 → weeks newest→oldest go 0.0, 0.5, 1.0, ..., 3.5.
      // With sorted ascending (oldest first), x=0 is oldest → gap=3.5; x=7 is newest → gap=0.
      // Construct: train mean stable at 5, rest = 5 + (3.5 - 0.5*x)
      // Translate weekIdx (0 = newest in this loop) into age range:
      const startAge = weekIdx * 7
      const trainEnergy = 5
      const restEnergy = 5 + (0 + 0.5 * weekIdx) // matches above
      // Days in week (7 ages): 0..6 of startAge
      // We'll put 4 training days and 3 rest days per week.
      for (let d = 0; d < 4; d++) {
        const age = startAge + d
        log.push({ date: daysAgo(age), tss: 50 })
        recovery.push({ date: daysAgo(age), energy: trainEnergy })
      }
      for (let d = 4; d < 7; d++) {
        const age = startAge + d
        recovery.push({ date: daysAgo(age), energy: restEnergy })
      }
    }
    // The newest week (weekIdx=0) has restEnergy = 5 (so gap = 0 inside recent 30d),
    // older weeks rise.
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.trendDeltaPerWeek).not.toBeNull()
    // Slope should be strongly negative (newer weeks = smaller gap)
    expect(out.trendDeltaPerWeek).toBeLessThan(-0.20)
    expect(out.band).toBe('BURNOUT_SIGNAL')
  })

  it('WARNING when 0 ≤ gap < 0.5 AND trend < -0.05', () => {
    // Construct: gap ≈ 0.3 today; weekly gaps falling at ~0.1/week.
    // Newest week gap = 0.3, then 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0
    // → slope = -0.1 per week.
    const log = []
    const recovery = []
    for (let weekIdx = 0; weekIdx < 8; weekIdx++) {
      const startAge = weekIdx * 7
      const trainEnergy = 6
      const restEnergy = 6 + (0.3 + 0.1 * weekIdx)
      for (let d = 0; d < 4; d++) {
        const age = startAge + d
        log.push({ date: daysAgo(age), tss: 50 })
        recovery.push({ date: daysAgo(age), energy: trainEnergy })
      }
      for (let d = 4; d < 7; d++) {
        const age = startAge + d
        recovery.push({ date: daysAgo(age), energy: restEnergy })
      }
    }
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    expect(out).not.toBeNull()
    // The recent-window gap should be small (close to 0.3-0.4)
    expect(out.energyGap).toBeGreaterThanOrEqual(0)
    expect(out.energyGap).toBeLessThan(0.5)
    expect(out.trendDeltaPerWeek).toBeLessThan(-0.05)
    expect(out.trendDeltaPerWeek).toBeGreaterThanOrEqual(-0.20)
    expect(out.band).toBe('WARNING')
  })

  it('WELL_RESTORED when gap ≥ 1.5', () => {
    const log = [train(0), train(2), train(4), train(6)]
    const recovery = [
      rec(0, 5), rec(2, 5), rec(4, 5), rec(6, 5),
      rec(1, 8), rec(3, 8), rec(5, 8), rec(7, 8),
    ]
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    expect(out.energyGap).toBeGreaterThanOrEqual(1.5)
    expect(out.band).toBe('WELL_RESTORED')
  })

  it('NEUTRAL for a moderate stable gap with no negative trend', () => {
    // gap stably ≈ 1.0 across weeks → slope ≈ 0, not WARNING, not WELL_RESTORED
    const log = []
    const recovery = []
    for (let weekIdx = 0; weekIdx < 8; weekIdx++) {
      const startAge = weekIdx * 7
      const trainEnergy = 5
      const restEnergy = 6
      for (let d = 0; d < 4; d++) {
        const age = startAge + d
        log.push({ date: daysAgo(age), tss: 50 })
        recovery.push({ date: daysAgo(age), energy: trainEnergy })
      }
      for (let d = 4; d < 7; d++) {
        const age = startAge + d
        recovery.push({ date: daysAgo(age), energy: restEnergy })
      }
    }
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.energyGap).toBeCloseTo(1, 1)
    expect(out.band).toBe('NEUTRAL')
  })

  it('NEUTRAL when energyGap is null but at least one mean exists', () => {
    // Only training-day samples in the recent window; rest count = 0
    const log = [
      train(0), train(1), train(2), train(3), train(4), train(5),
      train(6), train(7), train(8), train(9), train(10),
    ]
    const recovery = [
      rec(0, 5), rec(2, 5), rec(4, 5), rec(6, 5),
    ]
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.recentRestDayMean).toBeNull()
    expect(out.recentTrainingDayMean).toBeCloseTo(5, 5)
    expect(out.energyGap).toBeNull()
    expect(out.band).toBe('NEUTRAL')
  })
})

// ─── Trend regression ───────────────────────────────────────────────────────

describe('restDayEnergyTrend — weekly trend regression', () => {
  it('trendDeltaPerWeek null when fewer than 4 valid weekly buckets', () => {
    // Only 3 weeks of data → < MIN_TREND_WEEKS
    const log = []
    const recovery = []
    for (let weekIdx = 0; weekIdx < 3; weekIdx++) {
      const startAge = weekIdx * 7
      for (let d = 0; d < 4; d++) {
        const age = startAge + d
        log.push({ date: daysAgo(age), tss: 50 })
        recovery.push({ date: daysAgo(age), energy: 5 })
      }
      for (let d = 4; d < 7; d++) {
        const age = startAge + d
        recovery.push({ date: daysAgo(age), energy: 7 })
      }
    }
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.trendDeltaPerWeek).toBeNull()
  })

  it('trendDeltaPerWeek positive when weekly gap is GROWING (rest restoring more)', () => {
    // weekIdx=0 (newest) has biggest gap, oldest has smallest.
    // Sorted ascending → oldest first → x=0..7 gap rises → positive slope.
    const log = []
    const recovery = []
    for (let weekIdx = 0; weekIdx < 8; weekIdx++) {
      const startAge = weekIdx * 7
      const trainEnergy = 5
      const restEnergy = 5 + (2.0 - 0.25 * weekIdx) // newest = 7, oldest = 5.25
      for (let d = 0; d < 4; d++) {
        const age = startAge + d
        log.push({ date: daysAgo(age), tss: 50 })
        recovery.push({ date: daysAgo(age), energy: trainEnergy })
      }
      for (let d = 4; d < 7; d++) {
        const age = startAge + d
        recovery.push({ date: daysAgo(age), energy: restEnergy })
      }
    }
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.trendDeltaPerWeek).not.toBeNull()
    expect(out.trendDeltaPerWeek).toBeGreaterThan(0.10)
  })

  it('trendDeltaPerWeek negative when weekly gap is SHRINKING', () => {
    // Newest week = tiny gap, oldest = large gap → ascending x has falling y.
    const log = []
    const recovery = []
    for (let weekIdx = 0; weekIdx < 8; weekIdx++) {
      const startAge = weekIdx * 7
      const trainEnergy = 5
      const restEnergy = 5 + (0.5 + 0.5 * weekIdx) // newest = 5.5, oldest = 9
      for (let d = 0; d < 4; d++) {
        const age = startAge + d
        log.push({ date: daysAgo(age), tss: 50 })
        recovery.push({ date: daysAgo(age), energy: trainEnergy })
      }
      for (let d = 4; d < 7; d++) {
        const age = startAge + d
        recovery.push({ date: daysAgo(age), energy: restEnergy })
      }
    }
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    expect(out.trendDeltaPerWeek).toBeLessThan(-0.20)
  })

  it('rounds trendDeltaPerWeek to 4 decimal places', () => {
    const log = []
    const recovery = []
    for (let weekIdx = 0; weekIdx < 8; weekIdx++) {
      const startAge = weekIdx * 7
      const trainEnergy = 5
      const restEnergy = 6 + 0.1 * weekIdx
      for (let d = 0; d < 4; d++) {
        const age = startAge + d
        log.push({ date: daysAgo(age), tss: 50 })
        recovery.push({ date: daysAgo(age), energy: trainEnergy })
      }
      for (let d = 4; d < 7; d++) {
        const age = startAge + d
        recovery.push({ date: daysAgo(age), energy: restEnergy })
      }
    }
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    // Slope should be a rounded number — at most 4 decimal places
    const s = out.trendDeltaPerWeek
    expect(Number.isFinite(s)).toBe(true)
    expect(Math.round(s * 10000)).toBe(s * 10000) // no extra fractional digits
  })
})

// ─── Window overrides ───────────────────────────────────────────────────────

describe('restDayEnergyTrend — window options', () => {
  it('honors a custom windowDays', () => {
    // Use a 7-day window. Place 3 rest + 3 training inside; place noise
    // outside that wouldn't count.
    const log = [
      train(0), train(2), train(4),
      train(20, { tss: 1000 }), // outside 7d window
    ]
    const recovery = [
      rec(0, 5), rec(2, 5), rec(4, 5),
      rec(1, 9), rec(3, 9), rec(5, 9),
      rec(20, 1), // outside 7d window → must be excluded
    ]
    const out = analyzeRestDayEnergyTrend({
      log,
      recovery,
      today: TODAY,
      windowDays: 7,
    })
    expect(out.restDayCount).toBe(3)
    expect(out.trainingDayCount).toBe(3)
    expect(out.recentRestDayMean).toBeCloseTo(9, 5)
    expect(out.recentTrainingDayMean).toBeCloseTo(5, 5)
  })

  it('honors a custom trendWindowDays', () => {
    // Tight trend window of 21 days → only ~3 weekly buckets at most,
    // so trendDeltaPerWeek should be null.
    const log = []
    const recovery = []
    for (let weekIdx = 0; weekIdx < 8; weekIdx++) {
      const startAge = weekIdx * 7
      for (let d = 0; d < 4; d++) {
        const age = startAge + d
        log.push({ date: daysAgo(age), tss: 50 })
        recovery.push({ date: daysAgo(age), energy: 5 })
      }
      for (let d = 4; d < 7; d++) {
        const age = startAge + d
        recovery.push({ date: daysAgo(age), energy: 7 })
      }
    }
    const out = analyzeRestDayEnergyTrend({
      log,
      recovery,
      today: TODAY,
      trendWindowDays: 21,
    })
    expect(out).not.toBeNull()
    expect(out.trendDeltaPerWeek).toBeNull()
  })

  it('returns null for non-positive windowDays', () => {
    expect(
      analyzeRestDayEnergyTrend({
        log: [],
        recovery: [],
        today: TODAY,
        windowDays: 0,
      }),
    ).toBeNull()
    expect(
      analyzeRestDayEnergyTrend({
        log: [],
        recovery: [],
        today: TODAY,
        trendWindowDays: -5,
      }),
    ).toBeNull()
  })
})

// ─── ISO week boundary ──────────────────────────────────────────────────────

describe('restDayEnergyTrend — ISO week boundary', () => {
  it('groups data by ISO week (Mon-Sun) for the trend regression', () => {
    // Place a full week's data such that the rest/training split is clean
    // for 8 contiguous weeks. Verify the trend bucket count.
    const log = []
    const recovery = []
    for (let weekIdx = 0; weekIdx < 8; weekIdx++) {
      const startAge = weekIdx * 7
      for (let d = 0; d < 4; d++) {
        const age = startAge + d
        log.push({ date: daysAgo(age), tss: 50 })
        recovery.push({ date: daysAgo(age), energy: 5 })
      }
      for (let d = 4; d < 7; d++) {
        const age = startAge + d
        recovery.push({ date: daysAgo(age), energy: 7 })
      }
    }
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    expect(out).not.toBeNull()
    expect(out.trendDeltaPerWeek).not.toBeNull()
    // With a constant gap, slope must be 0 to within rounding tolerance.
    expect(Math.abs(out.trendDeltaPerWeek)).toBeLessThan(0.0001)
  })
})

// ─── today accepts Date and string ──────────────────────────────────────────

describe('restDayEnergyTrend — today accepts Date and string', () => {
  it('accepts today as a Date object', () => {
    const log = [train(0), train(2), train(4)]
    const recovery = [
      rec(0, 5), rec(2, 5), rec(4, 5),
      rec(1, 7), rec(3, 7), rec(5, 7),
    ]
    const out = analyzeRestDayEnergyTrend({
      log,
      recovery,
      today: new Date(`${TODAY}T12:00:00Z`),
    })
    expect(out).not.toBeNull()
    expect(out.energyGap).toBeCloseTo(2, 5)
  })

  it('accepts today as an ISO string with trailing time component', () => {
    const log = [train(0), train(2), train(4)]
    const recovery = [
      rec(0, 5), rec(2, 5), rec(4, 5),
      rec(1, 7), rec(3, 7), rec(5, 7),
    ]
    const out = analyzeRestDayEnergyTrend({
      log,
      recovery,
      today: `${TODAY}T08:00:00Z`,
    })
    expect(out).not.toBeNull()
    expect(out.energyGap).toBeCloseTo(2, 5)
  })
})

// ─── Output shape ───────────────────────────────────────────────────────────

describe('restDayEnergyTrend — output shape', () => {
  it('returns the documented field set with the citation', () => {
    const log = [train(0), train(2), train(4)]
    const recovery = [
      rec(0, 5), rec(2, 5), rec(4, 5),
      rec(1, 7), rec(3, 7), rec(5, 7),
    ]
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    expect(out).not.toBeNull()
    expect(out).toEqual({
      band: expect.stringMatching(/^(WELL_RESTORED|NEUTRAL|WARNING|BURNOUT_SIGNAL)$/),
      recentRestDayMean: expect.any(Number),
      recentTrainingDayMean: expect.any(Number),
      energyGap: expect.any(Number),
      trendDeltaPerWeek: null, // only 3 weeks of data, < MIN
      restDayCount: 3,
      trainingDayCount: 3,
      citation: 'Lemyre 2007; Kellmann 2018',
    })
  })

  it('skips future-dated recovery entries', () => {
    const log = [train(0), train(2), train(4)]
    const recovery = [
      rec(0, 5), rec(2, 5), rec(4, 5),
      rec(1, 7), rec(3, 7), rec(5, 7),
      rec(-3, 10), // future-dated
    ]
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    expect(out.restDayCount).toBe(3) // future-dated NOT counted
  })

  it('skips entries with malformed date strings', () => {
    const log = [train(0), train(2), train(4)]
    const recovery = [
      rec(0, 5), rec(2, 5), rec(4, 5),
      rec(1, 7), rec(3, 7), rec(5, 7),
      { date: 'nope', energy: 1 },
      { date: '', energy: 1 },
      { date: 12345, energy: 1 },
    ]
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    expect(out.restDayCount).toBe(3)
    expect(out.trainingDayCount).toBe(3)
  })

  it('tolerates null/undefined entries in log and recovery', () => {
    const log = [null, undefined, train(0), train(2), train(4), 'oops']
    const recovery = [
      null, undefined,
      rec(0, 5), rec(2, 5), rec(4, 5),
      rec(1, 7), rec(3, 7), rec(5, 7),
    ]
    const out = analyzeRestDayEnergyTrend({ log, recovery, today: TODAY })
    expect(out.restDayCount).toBe(3)
    expect(out.trainingDayCount).toBe(3)
  })
})
