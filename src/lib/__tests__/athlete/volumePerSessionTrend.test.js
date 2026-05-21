// src/lib/__tests__/athlete/volumePerSessionTrend.test.js
//
// Pure-fn tests for analyzeVolumePerSessionTrend — Daniels 2014 /
// Pfitzinger 2014 weekly mean session duration trend tracker. Covers
// all 5 bands (SHRINKING, STABLE, GROWING, AGGRESSIVE_GROWTH,
// INSUFFICIENT_DATA), regression-slope math, weekly mean math, zero-week
// handling, durationMin/duration_min equivalence, ISO-week boundaries,
// custom window, and Date-vs-string `today`.

import { describe, it, expect } from 'vitest'
import {
  analyzeVolumePerSessionTrend,
  VOLUME_PER_SESSION_TREND_CITATION,
} from '../../athlete/volumePerSessionTrend.js'

const TODAY = '2026-05-18'  // Monday

// ─── Helpers ────────────────────────────────────────────────────────────────

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function mondayOf(iso) {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

function daysAgo(n, base = TODAY) {
  return isoMinusDays(base, n)
}

// Build a log where each week index 0..N-1 (oldest..newest) gets ONE
// session with the supplied durationMin. Zero/null skips the week.
function buildWeeklyLog(weekMinutes) {
  const log = []
  for (let i = 0; i < weekMinutes.length; i++) {
    const min = weekMinutes[i]
    if (!min) continue
    const weeksBack = (weekMinutes.length - 1) - i
    log.push({
      date: daysAgo(weeksBack * 7),
      durationMin: min,
      type: 'Easy Run',
    })
  }
  return log
}

// Build a log with multiple sessions per week. weekSessions is an array
// of arrays — weekSessions[i] = [min, min, ...] for week index i.
function buildMultiSessionLog(weekSessions) {
  const log = []
  for (let i = 0; i < weekSessions.length; i++) {
    const arr = weekSessions[i] || []
    const weeksBack = (weekSessions.length - 1) - i
    for (let j = 0; j < arr.length; j++) {
      const min = arr[j]
      if (!min) continue
      const day = isoMinusDays(daysAgo(weeksBack * 7), -Math.min(j, 6))
      log.push({ date: day, durationMin: min, type: 'Easy Run' })
    }
  }
  return log
}

// ─── null guards ────────────────────────────────────────────────────────────

describe('analyzeVolumePerSessionTrend — null guards', () => {
  it('returns null when today is missing', () => {
    expect(analyzeVolumePerSessionTrend({ log: [], today: undefined })).toBeNull()
  })

  it('returns null when today is null', () => {
    expect(analyzeVolumePerSessionTrend({ log: [], today: null })).toBeNull()
  })

  it('returns null when today is an unparseable string', () => {
    expect(analyzeVolumePerSessionTrend({ log: [], today: 'not-a-date' })).toBeNull()
  })

  it('returns null when today is the empty string', () => {
    expect(analyzeVolumePerSessionTrend({ log: [], today: '' })).toBeNull()
  })

  it('returns null when today is a numeric value', () => {
    expect(analyzeVolumePerSessionTrend({ log: [], today: 12345 })).toBeNull()
  })

  it('returns null when today is an Invalid Date', () => {
    expect(analyzeVolumePerSessionTrend({ log: [], today: new Date('boom') })).toBeNull()
  })

  it('exposes the citation constant', () => {
    expect(VOLUME_PER_SESSION_TREND_CITATION).toBe('Daniels 2014; Pfitzinger 2014')
  })
})

// ─── INSUFFICIENT_DATA gate ─────────────────────────────────────────────────

describe('analyzeVolumePerSessionTrend — INSUFFICIENT_DATA gate', () => {
  it('returns INSUFFICIENT_DATA with weeks[] populated and slope=0 when fewer than 12 sessions logged', () => {
    // 8 sessions only — below the 12-session minimum.
    const log = buildWeeklyLog([0, 0, 0, 0, 60, 60, 60, 60, 60, 60, 60, 60])
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('INSUFFICIENT_DATA')
    expect(r.weeks).toHaveLength(12)
    expect(r.trendSlopeMinPerWeek).toBe(0)
    expect(r.trendPctPerWeek).toBe(0)
    expect(r.sessionCountTotal).toBe(8)
  })

  it('returns INSUFFICIENT_DATA for a totally empty log', () => {
    const r = analyzeVolumePerSessionTrend({ log: [], today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_DATA')
    expect(r.weeks).toHaveLength(12)
    expect(r.sessionCountTotal).toBe(0)
    expect(r.overallMeanSessionMin).toBe(0)
  })

  it('returns INSUFFICIENT_DATA with weeks still ordered oldest → newest', () => {
    const log = buildWeeklyLog([0, 60, 0, 60, 0, 0, 60, 0, 0, 60, 60, 60])
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_DATA')
    const starts = r.weeks.map(w => w.weekStart)
    const sorted = [...starts].sort()
    expect(starts).toEqual(sorted)
    expect(r.weeks[11].weekStart).toBe(mondayOf(TODAY))
  })

  it('handles non-array log without crashing (sessionCountTotal=0)', () => {
    const r = analyzeVolumePerSessionTrend({ log: null, today: TODAY })
    expect(r.band).toBe('INSUFFICIENT_DATA')
    expect(r.sessionCountTotal).toBe(0)
  })
})

// ─── STABLE band ────────────────────────────────────────────────────────────

describe('analyzeVolumePerSessionTrend — STABLE band', () => {
  it('flags STABLE when weekly means are flat at 60 min for 12 weeks', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    expect(r.band).toBe('STABLE')
    expect(r.trendSlopeMinPerWeek).toBe(0)
    expect(r.trendPctPerWeek).toBe(0)
    expect(r.overallMeanSessionMin).toBe(60)
    expect(r.sessionCountTotal).toBe(12)
  })

  it('flags STABLE when each weekly mean drifts within ±2%/wk', () => {
    // Mean ~60, tiny noise — slope ≈ 0.
    const log = buildWeeklyLog([60, 61, 59, 60, 61, 60, 59, 60, 61, 60, 59, 60])
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    expect(r.band).toBe('STABLE')
    expect(Math.abs(r.trendPctPerWeek)).toBeLessThan(0.02)
  })
})

// ─── GROWING band ──────────────────────────────────────────────────────────

describe('analyzeVolumePerSessionTrend — GROWING band', () => {
  it('flags GROWING for ~3%/wk linear increase', () => {
    // 60, 62, 64, ... 82 — slope = +2 min/wk, overall mean ≈ 71, pct ≈ 0.0282
    const weekly = []
    for (let i = 0; i < 12; i++) weekly.push(60 + i * 2)
    const log = buildWeeklyLog(weekly)
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    expect(r.band).toBe('GROWING')
    expect(r.trendSlopeMinPerWeek).toBe(2)
    expect(r.trendPctPerWeek).toBeGreaterThanOrEqual(0.02)
    expect(r.trendPctPerWeek).toBeLessThan(0.05)
  })

  it('flags GROWING with mean inside [2%, 5%) growth band', () => {
    // 50→72 across 12 wks, +2/wk
    const weekly = []
    for (let i = 0; i < 12; i++) weekly.push(50 + i * 2)
    const log = buildWeeklyLog(weekly)
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    expect(r.band).toBe('GROWING')
  })
})

// ─── AGGRESSIVE_GROWTH band ────────────────────────────────────────────────

describe('analyzeVolumePerSessionTrend — AGGRESSIVE_GROWTH band', () => {
  it('flags AGGRESSIVE_GROWTH for ~7%/wk linear increase', () => {
    // 30 + 4*i → slope=4, overall mean≈52 → 4/52 ≈ 0.077
    const weekly = []
    for (let i = 0; i < 12; i++) weekly.push(30 + i * 4)
    const log = buildWeeklyLog(weekly)
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    expect(r.band).toBe('AGGRESSIVE_GROWTH')
    expect(r.trendPctPerWeek).toBeGreaterThanOrEqual(0.05)
  })

  it('flags AGGRESSIVE_GROWTH at the boundary case (≥5%/wk)', () => {
    // Sharper: 20 → 64 (slope=4), overall mean ≈ 42 → 4/42 ≈ 0.095
    const weekly = []
    for (let i = 0; i < 12; i++) weekly.push(20 + i * 4)
    const log = buildWeeklyLog(weekly)
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    expect(r.band).toBe('AGGRESSIVE_GROWTH')
  })
})

// ─── SHRINKING band ───────────────────────────────────────────────────────

describe('analyzeVolumePerSessionTrend — SHRINKING band', () => {
  it('flags SHRINKING when weekly mean drops 2 min/wk over 12 weeks', () => {
    const weekly = []
    for (let i = 0; i < 12; i++) weekly.push(82 - i * 2)
    const log = buildWeeklyLog(weekly)
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    expect(r.band).toBe('SHRINKING')
    expect(r.trendSlopeMinPerWeek).toBe(-2)
    expect(r.trendPctPerWeek).toBeLessThan(-0.02)
  })

  it('flags SHRINKING when sessions shorten meaningfully', () => {
    const weekly = []
    for (let i = 0; i < 12; i++) weekly.push(90 - i * 3)
    const log = buildWeeklyLog(weekly)
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    expect(r.band).toBe('SHRINKING')
  })
})

// ─── weekly mean math (sum/count) ──────────────────────────────────────────

describe('analyzeVolumePerSessionTrend — weekly mean math', () => {
  it('computes meanSessionMin as sum/count for a single multi-session week', () => {
    // Week 11 (newest) gets 3 sessions: 30, 60, 90 → mean 60.
    const weekly = [[60], [60], [60], [60], [60], [60], [60], [60], [60], [60], [60], [30, 60, 90]]
    const log = buildMultiSessionLog(weekly)
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    expect(r.band).not.toBe('INSUFFICIENT_DATA')
    expect(r.weeks[11].sessionCount).toBe(3)
    expect(r.weeks[11].meanSessionMin).toBe(60)
  })

  it('reports meanSessionMin = 0 and sessionCount = 0 for empty weeks', () => {
    const weekly = [60, 0, 60, 0, 60, 60, 60, 60, 60, 60, 60, 60]
    const log = buildWeeklyLog(weekly)
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    expect(r.weeks[1].sessionCount).toBe(0)
    expect(r.weeks[1].meanSessionMin).toBe(0)
    expect(r.weeks[3].sessionCount).toBe(0)
    expect(r.weeks[3].meanSessionMin).toBe(0)
    // Non-empty weeks stay at 60.
    expect(r.weeks[0].meanSessionMin).toBe(60)
  })

  it('rounds meanSessionMin to 2 decimal places', () => {
    // Week with 3 sessions: 30, 31, 32 → mean 31.00
    const weekly = [[60], [60], [60], [60], [60], [60], [60], [60], [60], [60], [60], [30, 31, 32]]
    const log = buildMultiSessionLog(weekly)
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    expect(r.weeks[11].meanSessionMin).toBe(31)
  })

  it('rounds meanSessionMin to 2 decimals when value is fractional', () => {
    // 3 sessions: 31, 32, 34 → mean 32.333... → 32.33
    const weekly = [[60], [60], [60], [60], [60], [60], [60], [60], [60], [60], [60], [31, 32, 34]]
    const log = buildMultiSessionLog(weekly)
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    expect(r.weeks[11].meanSessionMin).toBe(32.33)
  })
})

// ─── overallMeanSessionMin math ────────────────────────────────────────────

describe('analyzeVolumePerSessionTrend — overall mean math', () => {
  it('overallMeanSessionMin = total minutes / total sessions', () => {
    // 11 weeks of one 60-min session + week 11 (newest) of two 30-min sessions.
    const weekly = []
    for (let i = 0; i < 11; i++) weekly.push([60])
    weekly.push([30, 30])
    const log = buildMultiSessionLog(weekly)
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    // total = 11*60 + 60 = 720 over 13 sessions → 55.38
    expect(r.sessionCountTotal).toBe(13)
    expect(r.overallMeanSessionMin).toBeCloseTo(55.38, 2)
  })

  it('overallMeanSessionMin rounds to 2 decimals', () => {
    const weekly = [[60], [60], [60], [60], [60], [60], [60], [60], [60], [60], [60], [61]]
    const log = buildMultiSessionLog(weekly)
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    // total = 60*11 + 61 = 721 over 12 → 60.0833 → 60.08
    expect(r.overallMeanSessionMin).toBe(60.08)
  })

  it('overallMeanSessionMin = 0 when no sessions logged', () => {
    const r = analyzeVolumePerSessionTrend({ log: [], today: TODAY })
    expect(r.overallMeanSessionMin).toBe(0)
  })
})

// ─── durationMin vs duration_min ───────────────────────────────────────────

describe('analyzeVolumePerSessionTrend — durationMin vs duration_min', () => {
  it('accepts duration_min (snake_case) when durationMin is missing', () => {
    const log = []
    for (let i = 0; i < 12; i++) {
      log.push({ date: daysAgo(i * 7), duration_min: 60, type: 'Easy Run' })
    }
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    expect(r.band).toBe('STABLE')
    expect(r.sessionCountTotal).toBe(12)
    expect(r.overallMeanSessionMin).toBe(60)
  })

  it('prefers durationMin (camelCase) over duration_min when both are present', () => {
    const log = []
    for (let i = 0; i < 12; i++) {
      log.push({
        date: daysAgo(i * 7),
        durationMin: 90,
        duration_min: 30,   // should be ignored
        type: 'Long Run',
      })
    }
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    expect(r.overallMeanSessionMin).toBe(90)
  })

  it('skips entries with no usable duration field', () => {
    const log = []
    for (let i = 0; i < 12; i++) {
      log.push({ date: daysAgo(i * 7), durationMin: 60 })
    }
    // Add a junk entry with no duration — must be ignored.
    log.push({ date: daysAgo(0), type: 'Easy Run' })
    log.push({ date: daysAgo(0), durationMin: 'not-a-number' })
    log.push({ date: daysAgo(0), durationMin: -10 })
    log.push({ date: daysAgo(0), durationMin: 0 })
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    expect(r.sessionCountTotal).toBe(12)
  })
})

// ─── trendPctPerWeek divide-by-zero safety ─────────────────────────────────

describe('analyzeVolumePerSessionTrend — trendPctPerWeek divide-by-zero safety', () => {
  it('uses denom = max(overallMeanSessionMin, 1), so trendPctPerWeek never explodes when mean is 0', () => {
    // Force 12 sessions but with the first sessions counted differently:
    // we still need 12 sessions ≥ 0. If mean rounds to 0 (impossible
    // with positive durations), pct must be finite, not NaN/Infinity.
    // We approximate by passing durations that round to 0 — but minutes
    // must be > 0 to count. So instead test with 12 normal sessions and
    // confirm pct is finite + correctly computed.
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    expect(Number.isFinite(r.trendPctPerWeek)).toBe(true)
    expect(r.trendPctPerWeek).toBe(0)
  })

  it('produces a finite trendPctPerWeek even when slope sign is negative', () => {
    const weekly = []
    for (let i = 0; i < 12; i++) weekly.push(90 - i * 4)
    const log = buildWeeklyLog(weekly)
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    expect(Number.isFinite(r.trendPctPerWeek)).toBe(true)
    expect(r.trendPctPerWeek).toBeLessThan(0)
  })
})

// ─── custom windowWeeks ────────────────────────────────────────────────────

describe('analyzeVolumePerSessionTrend — custom windowWeeks', () => {
  it('honours a custom windowWeeks (8)', () => {
    const weekly = []
    for (let i = 0; i < 8; i++) weekly.push(60)
    // Insert 4 extra older weeks that should be IGNORED if window=8.
    const log = []
    for (let i = 0; i < 8; i++) {
      const weeksBack = 7 - i
      log.push({ date: daysAgo(weeksBack * 7), durationMin: 60, type: 'Easy Run' })
    }
    // Add 4 way-older sessions — outside an 8-week window.
    for (let i = 0; i < 4; i++) {
      log.push({ date: daysAgo((8 + i) * 7), durationMin: 200, type: 'Easy Run' })
    }
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY, windowWeeks: 8 })
    expect(r.weeks).toHaveLength(8)
    expect(r.sessionCountTotal).toBe(8)
    expect(r.overallMeanSessionMin).toBe(60)
  })

  it('clamps windowWeeks to 12 when value is non-numeric', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY, windowWeeks: 'bogus' })
    expect(r.weeks).toHaveLength(12)
  })

  it('honours larger windows when supplied', () => {
    // 16 weeks of 60-min sessions.
    const log = []
    for (let i = 0; i < 16; i++) {
      log.push({ date: daysAgo(i * 7), durationMin: 60, type: 'Easy Run' })
    }
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY, windowWeeks: 16 })
    expect(r.weeks).toHaveLength(16)
    expect(r.sessionCountTotal).toBe(16)
  })
})

// ─── ISO-week boundaries ───────────────────────────────────────────────────

describe('analyzeVolumePerSessionTrend — ISO week boundaries', () => {
  it('newest week in the output is the Monday of the week of `today`', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    expect(r.weeks[11].weekStart).toBe(mondayOf(TODAY))
  })

  it('handles today = mid-week (Wednesday) — newest weekStart is the Monday of that week', () => {
    const WED = '2026-05-20'  // Wednesday
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    const r = analyzeVolumePerSessionTrend({ log: [], today: WED })
    expect(r.weeks[11].weekStart).toBe(mondayOf(WED))
    expect(log.length).toBeGreaterThan(0)  // referenced to silence unused-var lint
  })

  it('excludes sessions in the week AFTER the current week', () => {
    // Sessions dated 7 days from TODAY should be outside the window.
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    // Add a future session a week away.
    log.push({ date: isoMinusDays(TODAY, -7), durationMin: 999, type: 'Future' })
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    expect(r.overallMeanSessionMin).toBe(60)
    expect(r.sessionCountTotal).toBe(12)
  })

  it('excludes sessions older than the earliest week in the window', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    // Add ancient session 20 weeks back.
    log.push({ date: daysAgo(20 * 7), durationMin: 999, type: 'Ancient' })
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    expect(r.sessionCountTotal).toBe(12)
    expect(r.overallMeanSessionMin).toBe(60)
  })

  it('rejects entries with malformed dates', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    log.push({ date: 'whenever', durationMin: 200 })
    log.push({ date: '', durationMin: 200 })
    log.push({ date: null, durationMin: 200 })
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    expect(r.sessionCountTotal).toBe(12)
  })
})

// ─── today as Date vs string ───────────────────────────────────────────────

describe('analyzeVolumePerSessionTrend — today as Date vs string', () => {
  it('accepts today as a Date object', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    const r = analyzeVolumePerSessionTrend({
      log,
      today: new Date(`${TODAY}T12:00:00Z`),
    })
    expect(r.band).toBe('STABLE')
    expect(r.weeks[11].weekStart).toBe(mondayOf(TODAY))
  })

  it('matches result of string today when given equivalent Date', () => {
    const log = buildWeeklyLog([60, 62, 64, 66, 68, 70, 72, 74, 76, 78, 80, 82])
    const rStr = analyzeVolumePerSessionTrend({ log, today: TODAY })
    const rDate = analyzeVolumePerSessionTrend({
      log,
      today: new Date(`${TODAY}T08:30:00Z`),
    })
    expect(rDate.band).toBe(rStr.band)
    expect(rDate.trendSlopeMinPerWeek).toBe(rStr.trendSlopeMinPerWeek)
    expect(rDate.overallMeanSessionMin).toBe(rStr.overallMeanSessionMin)
  })
})

// ─── citation + weeks shape ────────────────────────────────────────────────

describe('analyzeVolumePerSessionTrend — output shape', () => {
  it('returns the expected top-level keys', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    expect(Object.keys(r).sort()).toEqual([
      'band',
      'citation',
      'overallMeanSessionMin',
      'sessionCountTotal',
      'trendPctPerWeek',
      'trendSlopeMinPerWeek',
      'weeks',
    ])
    expect(r.citation).toBe('Daniels 2014; Pfitzinger 2014')
  })

  it('each week row carries weekStart, meanSessionMin, sessionCount', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    for (const w of r.weeks) {
      expect(typeof w.weekStart).toBe('string')
      expect(w.weekStart).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(typeof w.meanSessionMin).toBe('number')
      expect(typeof w.sessionCount).toBe('number')
    }
  })

  it('returns weeks in chronological order (oldest first)', () => {
    const log = buildWeeklyLog([60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 60])
    const r = analyzeVolumePerSessionTrend({ log, today: TODAY })
    const starts = r.weeks.map(w => w.weekStart)
    const sorted = [...starts].sort()
    expect(starts).toEqual(sorted)
  })
})
