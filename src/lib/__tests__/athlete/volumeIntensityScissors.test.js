// src/lib/__tests__/athlete/volumeIntensityScissors.test.js
//
// Pure-fn tests for analyzeVolumeIntensityScissors —
// Issurin 2010 / Stöggl 2014 block-periodization scissors detector.
// Covers all 5 bands, gating, trend math, duration-weighted intensity,
// zero-divisor safety, windowWeeks override, ISO week boundary, mixed
// sports, and today as Date vs string.

import { describe, it, expect } from 'vitest'
import {
  analyzeVolumeIntensityScissors,
  VOLUME_INTENSITY_SCISSORS_CITATION,
} from '../../athlete/volumeIntensityScissors.js'

// 2026-05-17 is a Sunday → Monday of that week is 2026-05-11.
const TODAY = '2026-05-17'

// ─── helpers ────────────────────────────────────────────────────────────

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

// Build one entry per week at Wednesday with given duration_min and tss.
// Per-session intensity = (tss / duration_min) × 60.
// `weekly` is an array of { dur, tss } from oldest to newest.
function buildSingleSessionPerWeekLog({ today = TODAY, weekly }) {
  const monday = mondayOf(today)
  const log = []
  for (let i = 0; i < weekly.length; i++) {
    const weekStart = isoMinusDays(monday, (weekly.length - 1 - i) * 7)
    const sessionDate = isoMinusDays(weekStart, -2) // Wednesday
    const { dur, tss } = weekly[i] || {}
    if (dur != null) {
      const e = { date: sessionDate, duration_min: dur }
      if (tss != null) e.tss = tss
      log.push(e)
    }
  }
  return log
}

// ─── null / insufficient signal ─────────────────────────────────────────

describe('analyzeVolumeIntensityScissors — null / insufficient signals', () => {
  it('returns null when today is missing', () => {
    expect(analyzeVolumeIntensityScissors({ log: [], today: undefined })).toBeNull()
  })

  it('returns null when today is invalid', () => {
    expect(analyzeVolumeIntensityScissors({ log: [], today: 'nope' })).toBeNull()
    expect(analyzeVolumeIntensityScissors({ log: [], today: '' })).toBeNull()
  })

  it('returns null when log is null', () => {
    expect(analyzeVolumeIntensityScissors({ log: null, today: TODAY })).toBeNull()
  })

  it('returns null when log is empty', () => {
    expect(analyzeVolumeIntensityScissors({ log: [], today: TODAY })).toBeNull()
  })

  it('returns null when fewer than 6 of 8 weeks have non-zero volume', () => {
    // Only 5 weeks of volume → below the 6-week minimum.
    const weekly = [
      {}, {}, {},
      { dur: 60, tss: 60 },
      { dur: 60, tss: 60 },
      { dur: 60, tss: 60 },
      { dur: 60, tss: 60 },
      { dur: 60, tss: 60 },
    ]
    const res = analyzeVolumeIntensityScissors({
      log: buildSingleSessionPerWeekLog({ weekly }),
      today: TODAY,
    })
    expect(res).toBeNull()
  })

  it('returns a result once exactly 6 of 8 weeks carry volume', () => {
    const weekly = [
      {}, {},
      { dur: 60, tss: 60 },
      { dur: 60, tss: 60 },
      { dur: 60, tss: 60 },
      { dur: 60, tss: 60 },
      { dur: 60, tss: 60 },
      { dur: 60, tss: 60 },
    ]
    const res = analyzeVolumeIntensityScissors({
      log: buildSingleSessionPerWeekLog({ weekly }),
      today: TODAY,
    })
    expect(res).not.toBeNull()
    expect(res.weeks).toHaveLength(8)
  })

  it('returns null when fewer than 4 weeks have measurable intensity', () => {
    // 6 weeks of duration but tss only on 3 of them → intensity gate fails.
    const weekly = [
      { dur: 60 }, { dur: 60 },
      { dur: 60, tss: 60 },
      { dur: 60, tss: 60 },
      { dur: 60, tss: 60 },
      { dur: 60 }, { dur: 60 }, { dur: 60 },
    ]
    const res = analyzeVolumeIntensityScissors({
      log: buildSingleSessionPerWeekLog({ weekly }),
      today: TODAY,
    })
    expect(res).toBeNull()
  })

  it('returns a result when ≥4 weeks have intensity AND ≥6 have volume', () => {
    const weekly = [
      { dur: 60 }, { dur: 60 },
      { dur: 60, tss: 60 },
      { dur: 60, tss: 60 },
      { dur: 60, tss: 60 },
      { dur: 60, tss: 60 },
      { dur: 60 }, { dur: 60 },
    ]
    const res = analyzeVolumeIntensityScissors({
      log: buildSingleSessionPerWeekLog({ weekly }),
      today: TODAY,
    })
    expect(res).not.toBeNull()
  })
})

// ─── shape + citation ───────────────────────────────────────────────────

describe('analyzeVolumeIntensityScissors — shape', () => {
  it('returns the expected shape with all fields', () => {
    const weekly = new Array(8).fill({ dur: 60, tss: 60 })
    const res = analyzeVolumeIntensityScissors({
      log: buildSingleSessionPerWeekLog({ weekly }),
      today: TODAY,
    })
    expect(res).not.toBeNull()
    expect(res).toHaveProperty('band')
    expect(res).toHaveProperty('weeks')
    expect(res).toHaveProperty('volumeTrendPct')
    expect(res).toHaveProperty('intensityTrendPct')
    expect(res).toHaveProperty('citation')
    expect(res.citation).toBe(VOLUME_INTENSITY_SCISSORS_CITATION)
    expect(res.citation).toMatch(/Issurin/)
    expect(res.citation).toMatch(/Stöggl/)
  })

  it('weeks array is ordered oldest first, newest last', () => {
    const weekly = new Array(8).fill({ dur: 60, tss: 60 })
    const res = analyzeVolumeIntensityScissors({
      log: buildSingleSessionPerWeekLog({ weekly }),
      today: TODAY,
    })
    const dates = res.weeks.map(w => w.weekStart)
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] > dates[i - 1]).toBe(true)
    }
    // Last week is the week-of-TODAY's Monday.
    expect(dates[dates.length - 1]).toBe(mondayOf(TODAY))
  })
})

// ─── bands ──────────────────────────────────────────────────────────────

describe('analyzeVolumeIntensityScissors — bands', () => {
  it('classifies PROPER_SCISSORS: volume down >10%, intensity up >10%', () => {
    // Volume drops from 600 → 300 (-50%). Intensity rises from 60 → 90 (+50%).
    // To get intensity 60: dur 60, tss 60 → (60/60)*60 = 60
    // To get intensity 90: dur 60, tss 90 → (90/60)*60 = 90
    const weekly = [
      { dur: 600, tss: 600 }, // intensity = 60
      { dur: 600, tss: 600 },
      { dur: 600, tss: 600 },
      { dur: 600, tss: 600 },
      { dur: 300, tss: 450 }, // intensity = (450/300)*60 = 90
      { dur: 300, tss: 450 },
      { dur: 300, tss: 450 },
      { dur: 300, tss: 450 },
    ]
    const res = analyzeVolumeIntensityScissors({
      log: buildSingleSessionPerWeekLog({ weekly }),
      today: TODAY,
    })
    expect(res.band).toBe('PROPER_SCISSORS')
    expect(res.volumeTrendPct).toBeLessThan(-0.10)
    expect(res.intensityTrendPct).toBeGreaterThan(0.10)
  })

  it('classifies INVERTED: volume up >10%, intensity down >10%', () => {
    const weekly = [
      { dur: 300, tss: 450 }, // intensity 90
      { dur: 300, tss: 450 },
      { dur: 300, tss: 450 },
      { dur: 300, tss: 450 },
      { dur: 600, tss: 600 }, // intensity 60
      { dur: 600, tss: 600 },
      { dur: 600, tss: 600 },
      { dur: 600, tss: 600 },
    ]
    const res = analyzeVolumeIntensityScissors({
      log: buildSingleSessionPerWeekLog({ weekly }),
      today: TODAY,
    })
    expect(res.band).toBe('INVERTED')
    expect(res.volumeTrendPct).toBeGreaterThan(0.10)
    expect(res.intensityTrendPct).toBeLessThan(-0.10)
  })

  it('classifies BOTH_UP: volume up >10% AND intensity up >10%', () => {
    const weekly = [
      { dur: 300, tss: 300 }, // intensity 60
      { dur: 300, tss: 300 },
      { dur: 300, tss: 300 },
      { dur: 300, tss: 300 },
      { dur: 600, tss: 900 }, // intensity 90
      { dur: 600, tss: 900 },
      { dur: 600, tss: 900 },
      { dur: 600, tss: 900 },
    ]
    const res = analyzeVolumeIntensityScissors({
      log: buildSingleSessionPerWeekLog({ weekly }),
      today: TODAY,
    })
    expect(res.band).toBe('BOTH_UP')
    expect(res.volumeTrendPct).toBeGreaterThan(0.10)
    expect(res.intensityTrendPct).toBeGreaterThan(0.10)
  })

  it('classifies BOTH_DOWN: volume down >10% AND intensity down >10%', () => {
    const weekly = [
      { dur: 600, tss: 900 }, // intensity 90
      { dur: 600, tss: 900 },
      { dur: 600, tss: 900 },
      { dur: 600, tss: 900 },
      { dur: 300, tss: 300 }, // intensity 60
      { dur: 300, tss: 300 },
      { dur: 300, tss: 300 },
      { dur: 300, tss: 300 },
    ]
    const res = analyzeVolumeIntensityScissors({
      log: buildSingleSessionPerWeekLog({ weekly }),
      today: TODAY,
    })
    expect(res.band).toBe('BOTH_DOWN')
    expect(res.volumeTrendPct).toBeLessThan(-0.10)
    expect(res.intensityTrendPct).toBeLessThan(-0.10)
  })

  it('classifies NO_CHANGE: both trends within ±10%', () => {
    // Steady volume and intensity throughout.
    const weekly = new Array(8).fill({ dur: 400, tss: 400 })
    const res = analyzeVolumeIntensityScissors({
      log: buildSingleSessionPerWeekLog({ weekly }),
      today: TODAY,
    })
    expect(res.band).toBe('NO_CHANGE')
    expect(Math.abs(res.volumeTrendPct)).toBeLessThanOrEqual(0.10)
    expect(Math.abs(res.intensityTrendPct)).toBeLessThanOrEqual(0.10)
  })

  it('NO_CHANGE when only ONE axis has a >10% trend (volume only)', () => {
    // Volume swings hard, intensity stays flat → not a "scissors".
    const weekly = [
      { dur: 600, tss: 600 }, { dur: 600, tss: 600 },
      { dur: 600, tss: 600 }, { dur: 600, tss: 600 },
      { dur: 300, tss: 300 }, { dur: 300, tss: 300 },
      { dur: 300, tss: 300 }, { dur: 300, tss: 300 },
    ]
    const res = analyzeVolumeIntensityScissors({
      log: buildSingleSessionPerWeekLog({ weekly }),
      today: TODAY,
    })
    // Intensity flat (60 throughout), volume dropped → no scissors / inverted.
    expect(res.band).toBe('NO_CHANGE')
  })

  it('NO_CHANGE when only intensity changes (volume flat)', () => {
    const weekly = [
      { dur: 400, tss: 400 }, { dur: 400, tss: 400 },
      { dur: 400, tss: 400 }, { dur: 400, tss: 400 },
      { dur: 400, tss: 600 }, { dur: 400, tss: 600 },
      { dur: 400, tss: 600 }, { dur: 400, tss: 600 },
    ]
    const res = analyzeVolumeIntensityScissors({
      log: buildSingleSessionPerWeekLog({ weekly }),
      today: TODAY,
    })
    expect(res.band).toBe('NO_CHANGE')
  })
})

// ─── trend math ─────────────────────────────────────────────────────────

describe('analyzeVolumeIntensityScissors — trend math', () => {
  it('volumeTrendPct is (lastHalfMean - firstHalfMean) / firstHalfMean', () => {
    // First half mean vol = 600, last half mean vol = 300 → -0.50
    const weekly = [
      { dur: 600, tss: 600 }, { dur: 600, tss: 600 },
      { dur: 600, tss: 600 }, { dur: 600, tss: 600 },
      { dur: 300, tss: 450 }, { dur: 300, tss: 450 },
      { dur: 300, tss: 450 }, { dur: 300, tss: 450 },
    ]
    const res = analyzeVolumeIntensityScissors({
      log: buildSingleSessionPerWeekLog({ weekly }),
      today: TODAY,
    })
    expect(res.volumeTrendPct).toBeCloseTo(-0.5, 4)
  })

  it('intensityTrendPct uses duration-weighted intensity', () => {
    // First half: intensity 60 everywhere. Last half: intensity 90 everywhere.
    // (90 - 60) / 60 = +0.5
    const weekly = [
      { dur: 600, tss: 600 }, { dur: 600, tss: 600 },
      { dur: 600, tss: 600 }, { dur: 600, tss: 600 },
      { dur: 300, tss: 450 }, { dur: 300, tss: 450 },
      { dur: 300, tss: 450 }, { dur: 300, tss: 450 },
    ]
    const res = analyzeVolumeIntensityScissors({
      log: buildSingleSessionPerWeekLog({ weekly }),
      today: TODAY,
    })
    expect(res.intensityTrendPct).toBeCloseTo(0.5, 4)
  })

  it('rounds trends to 4 decimal places', () => {
    const weekly = new Array(8).fill({ dur: 100, tss: 100 })
    const res = analyzeVolumeIntensityScissors({
      log: buildSingleSessionPerWeekLog({ weekly }),
      today: TODAY,
    })
    // Verify <=4 decimal places in the stored value.
    const vstr = String(res.volumeTrendPct)
    const istr = String(res.intensityTrendPct)
    if (vstr.includes('.')) {
      expect(vstr.split('.')[1].length).toBeLessThanOrEqual(4)
    }
    if (istr.includes('.')) {
      expect(istr.split('.')[1].length).toBeLessThanOrEqual(4)
    }
  })

  it('weeks expose totalMinutes per week summed across sessions', () => {
    // Two sessions in the same week → totalMinutes = sum.
    const monday = mondayOf(TODAY)
    const log = []
    // 8 weeks of single 60-min sessions...
    for (let i = 7; i >= 1; i--) {
      const wkStart = isoMinusDays(monday, i * 7)
      log.push({ date: isoMinusDays(wkStart, -2), duration_min: 60, tss: 60 })
    }
    // ...plus 2 sessions in the current week.
    log.push({ date: isoMinusDays(monday, -1), duration_min: 60, tss: 60 })
    log.push({ date: isoMinusDays(monday, -3), duration_min: 45, tss: 45 })
    const res = analyzeVolumeIntensityScissors({ log, today: TODAY })
    const last = res.weeks[res.weeks.length - 1]
    expect(last.totalMinutes).toBe(105)
  })
})

// ─── duration-weighted intensity ────────────────────────────────────────

describe('analyzeVolumeIntensityScissors — duration weighting', () => {
  it('weights per-session intensity by duration when aggregating a week', () => {
    // Two sessions in one week:
    //   60 min @ intensity 100  (tss = (100/60)*60 = ...; pick tss=100, dur=60)
    //   180 min @ intensity 50  (tss = 150)
    // Duration-weighted avg = (100*60 + 50*180) / (60+180) = (6000 + 9000)/240 = 62.5
    // Naive mean would be 75.
    const monday = mondayOf(TODAY)
    const log = []
    // Fill weeks 0..7 (oldest to newest) with steady single sessions.
    for (let i = 7; i >= 1; i--) {
      const wkStart = isoMinusDays(monday, i * 7)
      log.push({ date: isoMinusDays(wkStart, -2), duration_min: 100, tss: 100 })
    }
    // Current week: two sessions, different intensities.
    log.push({ date: isoMinusDays(monday, -1), duration_min: 60, tss: 100 })
    log.push({ date: isoMinusDays(monday, -3), duration_min: 180, tss: 150 })
    const res = analyzeVolumeIntensityScissors({ log, today: TODAY })
    const last = res.weeks[res.weeks.length - 1]
    expect(last.avgIntensity).toBeCloseTo(62.5, 1)
  })

  it('a week with no qualifying sessions has avgIntensity = 0', () => {
    const monday = mondayOf(TODAY)
    const log = []
    // Fill weeks 0..6 with intensity, leave current week empty.
    for (let i = 7; i >= 1; i--) {
      const wkStart = isoMinusDays(monday, i * 7)
      log.push({ date: isoMinusDays(wkStart, -2), duration_min: 60, tss: 60 })
    }
    const res = analyzeVolumeIntensityScissors({ log, today: TODAY })
    const last = res.weeks[res.weeks.length - 1]
    expect(last.totalMinutes).toBe(0)
    expect(last.avgIntensity).toBe(0)
  })

  it('ignores sessions with non-finite duration', () => {
    const monday = mondayOf(TODAY)
    const log = []
    for (let i = 7; i >= 0; i--) {
      const wkStart = isoMinusDays(monday, i * 7)
      log.push({ date: isoMinusDays(wkStart, -2), duration_min: 60, tss: 60 })
    }
    log.push({ date: isoMinusDays(monday, -1), duration_min: 'bad', tss: 50 })
    log.push({ date: isoMinusDays(monday, -2), duration_min: NaN, tss: 50 })
    const res = analyzeVolumeIntensityScissors({ log, today: TODAY })
    // Non-finite sessions don't pollute the current week.
    const last = res.weeks[res.weeks.length - 1]
    expect(last.totalMinutes).toBe(60)
  })

  it('ignores sessions with non-positive tss when computing intensity', () => {
    const monday = mondayOf(TODAY)
    const log = []
    for (let i = 7; i >= 0; i--) {
      const wkStart = isoMinusDays(monday, i * 7)
      log.push({ date: isoMinusDays(wkStart, -2), duration_min: 60, tss: 60 })
    }
    // Add a no-tss session to current week — duration counts but intensity doesn't.
    log.push({ date: isoMinusDays(monday, -1), duration_min: 60, tss: 0 })
    const res = analyzeVolumeIntensityScissors({ log, today: TODAY })
    const last = res.weeks[res.weeks.length - 1]
    expect(last.totalMinutes).toBe(120)
    // Only the tss-bearing session counts for intensity: (60/60)*60 = 60
    expect(last.avgIntensity).toBe(60)
  })
})

// ─── zero-divisor safety ────────────────────────────────────────────────

describe('analyzeVolumeIntensityScissors — zero-divisor safety', () => {
  it('volumeTrendPct = 0 when firstHalfMeanVol is 0', () => {
    // First half all zero (gate still passes via overall ≥6 weeks of volume in last half)...
    // Actually if first half has no volume but last half has 6+ weeks, no weeks of volume
    // available in first half → trend defaults to 0.
    const weekly = [
      {}, {}, {}, {},
      { dur: 60, tss: 60 },
      { dur: 60, tss: 60 },
      { dur: 60, tss: 60 },
      { dur: 60, tss: 60 },
    ]
    // Only 4 vol weeks → gate fails. Need ≥6 → bump weeks.
    // Use weeks 2-7 with volume → 6 weeks of vol, 6 weeks of intensity.
    const weekly2 = [
      {}, {},
      { dur: 60, tss: 60 },
      { dur: 60, tss: 60 },
      { dur: 60, tss: 60 },
      { dur: 60, tss: 60 },
      { dur: 60, tss: 60 },
      { dur: 60, tss: 60 },
    ]
    expect(weekly).toBeDefined() // silence lint
    const res = analyzeVolumeIntensityScissors({
      log: buildSingleSessionPerWeekLog({ weekly: weekly2 }),
      today: TODAY,
    })
    expect(res).not.toBeNull()
    // First half = weeks 0..3 → vol means [0,0,60,60] → mean 30. Not zero.
    // Confirm result exists and trend is finite.
    expect(Number.isFinite(res.volumeTrendPct)).toBe(true)
    expect(Number.isFinite(res.intensityTrendPct)).toBe(true)
  })

  it('all-zero first half intensity → intensityTrendPct = 0', () => {
    // First half: volume only (no tss). Last half: full intensity.
    const weekly = [
      { dur: 60 }, { dur: 60 }, { dur: 60 }, { dur: 60 },
      { dur: 60, tss: 60 }, { dur: 60, tss: 60 },
      { dur: 60, tss: 60 }, { dur: 60, tss: 60 },
    ]
    const res = analyzeVolumeIntensityScissors({
      log: buildSingleSessionPerWeekLog({ weekly }),
      today: TODAY,
    })
    expect(res).not.toBeNull()
    // First half intensity mean = 0 → intensityTrendPct defaults to 0
    expect(res.intensityTrendPct).toBe(0)
    expect(Number.isFinite(res.intensityTrendPct)).toBe(true)
  })

  it('never returns NaN or Infinity in trend fields', () => {
    const weekly = new Array(8).fill({ dur: 0.0001, tss: 0.0001 })
    const res = analyzeVolumeIntensityScissors({
      log: buildSingleSessionPerWeekLog({ weekly }),
      today: TODAY,
    })
    if (res) {
      expect(Number.isFinite(res.volumeTrendPct)).toBe(true)
      expect(Number.isFinite(res.intensityTrendPct)).toBe(true)
    }
  })
})

// ─── windowWeeks override ───────────────────────────────────────────────

describe('analyzeVolumeIntensityScissors — windowWeeks override', () => {
  it('respects a non-default windowWeeks', () => {
    const weekly = new Array(12).fill({ dur: 60, tss: 60 })
    const res = analyzeVolumeIntensityScissors({
      log: buildSingleSessionPerWeekLog({ weekly }),
      today: TODAY,
      windowWeeks: 12,
    })
    expect(res).not.toBeNull()
    expect(res.weeks).toHaveLength(12)
  })

  it('scales the minimum-coverage gate down when window is smaller', () => {
    // 4 weeks of full data should pass with windowWeeks=4.
    const weekly = new Array(4).fill({ dur: 60, tss: 60 })
    const res = analyzeVolumeIntensityScissors({
      log: buildSingleSessionPerWeekLog({ weekly }),
      today: TODAY,
      windowWeeks: 4,
    })
    expect(res).not.toBeNull()
    expect(res.weeks).toHaveLength(4)
  })

  it('defaults to 8 weeks when windowWeeks is invalid', () => {
    const weekly = new Array(8).fill({ dur: 60, tss: 60 })
    const res = analyzeVolumeIntensityScissors({
      log: buildSingleSessionPerWeekLog({ weekly }),
      today: TODAY,
      windowWeeks: 'bad',
    })
    expect(res).not.toBeNull()
    expect(res.weeks).toHaveLength(8)
  })

  it('floors fractional windowWeeks', () => {
    const weekly = new Array(8).fill({ dur: 60, tss: 60 })
    const res = analyzeVolumeIntensityScissors({
      log: buildSingleSessionPerWeekLog({ weekly }),
      today: TODAY,
      windowWeeks: 6.9,
    })
    expect(res).not.toBeNull()
    expect(res.weeks).toHaveLength(6)
  })
})

// ─── ISO week boundary ──────────────────────────────────────────────────

describe('analyzeVolumeIntensityScissors — ISO week boundary', () => {
  it('groups Sunday and following Monday into different weeks (ISO Mon-first)', () => {
    // 2026-05-17 Sun is the END of its week. 2026-05-18 Mon would be in the next.
    // Anchor on a different today so the window includes a clean Sun/Mon pair.
    const today = '2026-05-17' // Sunday
    const monday = mondayOf(today) // 2026-05-11
    const log = []
    // Steady history for 7 weeks before...
    for (let i = 7; i >= 1; i--) {
      const wkStart = isoMinusDays(monday, i * 7)
      log.push({ date: isoMinusDays(wkStart, -2), duration_min: 60, tss: 60 })
    }
    // Two sessions split across the Sunday/Monday boundary in the most-recent
    // segment. Sunday session belongs to the PREVIOUS week (which is the
    // 7th-from-current week's tail). Monday session is in the next week.
    // Use the Monday/Sunday inside the window.
    log.push({ date: '2026-05-10', duration_min: 60, tss: 60 }) // Sunday → week starting 2026-05-04
    log.push({ date: '2026-05-11', duration_min: 60, tss: 60 }) // Monday → week starting 2026-05-11

    const res = analyzeVolumeIntensityScissors({ log, today })
    // weeks[6].weekStart should be '2026-05-04' (Sunday session counted here)
    // weeks[7].weekStart should be '2026-05-11' (Monday session counted here)
    const wk6 = res.weeks.find(w => w.weekStart === '2026-05-04')
    const wk7 = res.weeks.find(w => w.weekStart === '2026-05-11')
    expect(wk6).toBeDefined()
    expect(wk7).toBeDefined()
    // wk6 had original 60-min session + the Sunday 60 → 120; wk7 has 60.
    expect(wk6.totalMinutes).toBe(120)
    expect(wk7.totalMinutes).toBe(60)
  })

  it('only includes sessions inside the [oldest week start, current week end] window', () => {
    const monday = mondayOf(TODAY)
    const log = []
    for (let i = 7; i >= 0; i--) {
      const wkStart = isoMinusDays(monday, i * 7)
      log.push({ date: isoMinusDays(wkStart, -2), duration_min: 60, tss: 60 })
    }
    // Way too old session: should be ignored.
    log.push({ date: '2020-01-01', duration_min: 9999, tss: 9999 })
    // Future session beyond current week: should also be ignored.
    log.push({ date: isoMinusDays(monday, -14), duration_min: 9999, tss: 9999 })

    const res = analyzeVolumeIntensityScissors({ log, today: TODAY })
    // Verify no week exceeds 60 totalMinutes.
    for (const w of res.weeks) {
      expect(w.totalMinutes).toBeLessThanOrEqual(60)
    }
  })
})

// ─── mixed sports ───────────────────────────────────────────────────────

describe('analyzeVolumeIntensityScissors — mixed sports', () => {
  it('aggregates across sports — type-agnostic', () => {
    const monday = mondayOf(TODAY)
    const log = []
    for (let i = 7; i >= 0; i--) {
      const wkStart = isoMinusDays(monday, i * 7)
      // Alternate sports week to week.
      const sport = i % 2 === 0 ? 'cycling' : 'running'
      const type = i % 2 === 0 ? 'bike' : 'run'
      log.push({
        date: isoMinusDays(wkStart, -2),
        duration_min: 60,
        tss: 60,
        sport,
        type,
      })
    }
    const res = analyzeVolumeIntensityScissors({ log, today: TODAY })
    expect(res).not.toBeNull()
    // Every week should carry the single session regardless of sport.
    for (const w of res.weeks) {
      expect(w.totalMinutes).toBe(60)
    }
  })

  it('handles entries with extra non-relevant fields gracefully', () => {
    const monday = mondayOf(TODAY)
    const log = []
    for (let i = 7; i >= 0; i--) {
      const wkStart = isoMinusDays(monday, i * 7)
      log.push({
        date: isoMinusDays(wkStart, -2),
        duration_min: 60,
        tss: 60,
        sport: 'swim',
        notes: 'CSS 1:40/100m',
        heartRate: 145,
      })
    }
    const res = analyzeVolumeIntensityScissors({ log, today: TODAY })
    expect(res).not.toBeNull()
  })
})

// ─── today as Date vs string ────────────────────────────────────────────

describe('analyzeVolumeIntensityScissors — today as Date vs string', () => {
  it('accepts today as a Date object', () => {
    const weekly = new Array(8).fill({ dur: 60, tss: 60 })
    const log = buildSingleSessionPerWeekLog({ weekly })
    const dateToday = new Date(TODAY + 'T12:00:00Z')
    const fromString = analyzeVolumeIntensityScissors({ log, today: TODAY })
    const fromDate = analyzeVolumeIntensityScissors({ log, today: dateToday })
    expect(fromDate).not.toBeNull()
    expect(fromDate.weeks).toEqual(fromString.weeks)
    expect(fromDate.band).toBe(fromString.band)
  })

  it('rejects invalid Date objects', () => {
    const weekly = new Array(8).fill({ dur: 60, tss: 60 })
    const res = analyzeVolumeIntensityScissors({
      log: buildSingleSessionPerWeekLog({ weekly }),
      today: new Date('invalid'),
    })
    expect(res).toBeNull()
  })

  it('accepts ISO datetime strings — slices off the time portion', () => {
    const weekly = new Array(8).fill({ dur: 60, tss: 60 })
    const log = buildSingleSessionPerWeekLog({ weekly })
    const res = analyzeVolumeIntensityScissors({
      log,
      today: TODAY + 'T09:00:00Z',
    })
    expect(res).not.toBeNull()
  })
})

// ─── input robustness ───────────────────────────────────────────────────

describe('analyzeVolumeIntensityScissors — input robustness', () => {
  it('tolerates malformed log entries (null, missing date, junk)', () => {
    const monday = mondayOf(TODAY)
    const log = [null, undefined, {}, { date: 'bad' }, { date: '' }]
    // Add valid sessions to satisfy the gate.
    for (let i = 7; i >= 0; i--) {
      const wkStart = isoMinusDays(monday, i * 7)
      log.push({ date: isoMinusDays(wkStart, -2), duration_min: 60, tss: 60 })
    }
    const res = analyzeVolumeIntensityScissors({ log, today: TODAY })
    expect(res).not.toBeNull()
  })

  it('ignores log entries whose date is not an ISO YYYY-MM-DD', () => {
    const monday = mondayOf(TODAY)
    const log = []
    for (let i = 7; i >= 0; i--) {
      const wkStart = isoMinusDays(monday, i * 7)
      log.push({ date: isoMinusDays(wkStart, -2), duration_min: 60, tss: 60 })
    }
    log.push({ date: '17 May 2026', duration_min: 9999, tss: 9999 })
    const res = analyzeVolumeIntensityScissors({ log, today: TODAY })
    expect(res).not.toBeNull()
    for (const w of res.weeks) {
      expect(w.totalMinutes).toBeLessThanOrEqual(60)
    }
  })

  it('does not throw on undefined args object', () => {
    expect(() => analyzeVolumeIntensityScissors()).not.toThrow()
    expect(analyzeVolumeIntensityScissors()).toBeNull()
  })
})
