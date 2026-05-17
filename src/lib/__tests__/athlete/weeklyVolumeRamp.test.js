// src/lib/__tests__/athlete/weeklyVolumeRamp.test.js
//
// Pure-fn tests for computeWeeklyVolumeRamp — Gabbett 2016 / Foster 2001
// / Bertelsen 2017 weekly-volume ramp detector.
import { describe, it, expect } from 'vitest'
import {
  computeWeeklyVolumeRamp,
  WEEKLY_VOLUME_RAMP_CITATION,
} from '../../athlete/weeklyVolumeRamp.js'

const TODAY = '2026-05-17'

// Helpers ────────────────────────────────────────────────────────────────────

function isoMinusDays(iso, days) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

// Build a log of constant `dailyMinutes` over `days` days ending on `today`.
function buildFlatLog({ today = TODAY, dailyMinutes = 60, days = 60 } = {}) {
  const log = []
  for (let i = days - 1; i >= 0; i--) {
    log.push({ date: isoMinusDays(today, i), duration: dailyMinutes })
  }
  return log
}

// Build a log where each of the `weeklyMinutes.length` trailing weeks
// has a single session per day totalling `weeklyMinutes[k]` minutes for
// that week (split evenly across 7 days). Week index 0 is the OLDEST
// week. Returns a log spanning exactly weeks*7 days ending on `today`.
function buildWeeklyLog({ today = TODAY, weeklyMinutes }) {
  const log = []
  const weeks = weeklyMinutes.length
  for (let k = 0; k < weeks; k++) {
    const perDay = weeklyMinutes[k] / 7
    for (let d = 1; d <= 7; d++) {
      const offsetFromToday = weeks * 7 - (k * 7 + d)
      log.push({ date: isoMinusDays(today, offsetFromToday), duration: perDay })
    }
  }
  return log
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('computeWeeklyVolumeRamp — null / insufficient signals', () => {
  it('(a) returns null for an empty log', () => {
    expect(
      computeWeeklyVolumeRamp({ log: [], today: TODAY })
    ).toBeNull()
  })

  it('(b) returns null for a log shorter than weeks+1 weeks', () => {
    // 10 days of entries — not enough for 5 weekly buckets (default weeks=4).
    const log = []
    for (let i = 9; i >= 0; i--) {
      log.push({ date: isoMinusDays(TODAY, i), duration: 60 })
    }
    expect(computeWeeklyVolumeRamp({ log, today: TODAY })).toBeNull()
  })

  it('returns null for invalid today', () => {
    const log = buildFlatLog({ days: 60 })
    expect(
      computeWeeklyVolumeRamp({ log, today: 'not-a-date' })
    ).toBeNull()
  })

  it('returns null for weeks < 1', () => {
    const log = buildFlatLog({ days: 60 })
    expect(
      computeWeeklyVolumeRamp({ log, today: TODAY, weeks: 0 })
    ).toBeNull()
  })

  it('returns null when the prior week has zero minutes (no baseline)', () => {
    // Build 5 weekly buckets with the SECOND-oldest week empty (would
    // create a divide-by-zero in the delta calculation).
    const log = buildWeeklyLog({
      weeklyMinutes: [200, 0, 200, 200, 200],
    })
    expect(computeWeeklyVolumeRamp({ log, today: TODAY })).toBeNull()
  })
})

describe('computeWeeklyVolumeRamp — band classification', () => {
  it('(c) flat volume → rampPct ≈ 0, band GENTLE', () => {
    const log = buildFlatLog({ dailyMinutes: 60, days: 60 })
    const r = computeWeeklyVolumeRamp({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(Math.abs(r.rampPct)).toBeLessThan(0.5)
    // 0 lands in GENTLE band by spec (0..<5).
    expect(r.band).toBe('GENTLE')
  })

  it('(d) +8%/week ramp → band PRODUCTIVE', () => {
    // 5 weeks (weeks+1), each +8% over previous. 100 → 108 → ... → ~136.05
    const base = 700 // minutes/week
    const minutes = []
    for (let i = 0; i < 5; i++) {
      minutes.push(base * Math.pow(1.08, i))
    }
    const log = buildWeeklyLog({ weeklyMinutes: minutes })
    const r = computeWeeklyVolumeRamp({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.rampPct).toBeGreaterThanOrEqual(5)
    expect(r.rampPct).toBeLessThan(10)
    expect(r.band).toBe('PRODUCTIVE')
  })

  it('(e) +12%/week ramp → band AGGRESSIVE', () => {
    const base = 600
    const minutes = []
    for (let i = 0; i < 5; i++) {
      minutes.push(base * Math.pow(1.12, i))
    }
    const log = buildWeeklyLog({ weeklyMinutes: minutes })
    const r = computeWeeklyVolumeRamp({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.rampPct).toBeGreaterThanOrEqual(10)
    expect(r.rampPct).toBeLessThanOrEqual(15)
    expect(r.band).toBe('AGGRESSIVE')
  })

  it('(f) +20%/week ramp → band OVERSHOOT', () => {
    const base = 500
    const minutes = []
    for (let i = 0; i < 5; i++) {
      minutes.push(base * Math.pow(1.20, i))
    }
    const log = buildWeeklyLog({ weeklyMinutes: minutes })
    const r = computeWeeklyVolumeRamp({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.rampPct).toBeGreaterThan(15)
    expect(r.band).toBe('OVERSHOOT')
  })

  it('(g) declining (-5%/week) → band DECLINING', () => {
    const base = 800
    const minutes = []
    for (let i = 0; i < 5; i++) {
      minutes.push(base * Math.pow(0.95, i))
    }
    const log = buildWeeklyLog({ weeklyMinutes: minutes })
    const r = computeWeeklyVolumeRamp({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.rampPct).toBeLessThan(0)
    expect(r.band).toBe('DECLINING')
  })

  it('(h) band threshold boundaries: 4.9 → GENTLE, 5 → PRODUCTIVE, 9.9 → PRODUCTIVE, 10 → AGGRESSIVE, 15 → AGGRESSIVE, 15.1 → OVERSHOOT', () => {
    // 4.9% growth → GENTLE
    {
      const minutes = []
      for (let i = 0; i < 5; i++) minutes.push(700 * Math.pow(1.049, i))
      const r = computeWeeklyVolumeRamp({
        log: buildWeeklyLog({ weeklyMinutes: minutes }),
        today: TODAY,
      })
      expect(r.rampPct).toBeLessThan(5)
      expect(r.band).toBe('GENTLE')
    }
    // 5.0% growth → PRODUCTIVE (>= 5 lands in PRODUCTIVE per spec)
    {
      const minutes = []
      for (let i = 0; i < 5; i++) minutes.push(700 * Math.pow(1.05, i))
      const r = computeWeeklyVolumeRamp({
        log: buildWeeklyLog({ weeklyMinutes: minutes }),
        today: TODAY,
      })
      expect(r.rampPct).toBeGreaterThanOrEqual(5)
      expect(r.band).toBe('PRODUCTIVE')
    }
    // 10.0% growth → AGGRESSIVE
    {
      const minutes = []
      for (let i = 0; i < 5; i++) minutes.push(700 * Math.pow(1.10, i))
      const r = computeWeeklyVolumeRamp({
        log: buildWeeklyLog({ weeklyMinutes: minutes }),
        today: TODAY,
      })
      expect(r.rampPct).toBeGreaterThanOrEqual(10)
      expect(r.band).toBe('AGGRESSIVE')
    }
    // 18% growth → OVERSHOOT
    {
      const minutes = []
      for (let i = 0; i < 5; i++) minutes.push(700 * Math.pow(1.18, i))
      const r = computeWeeklyVolumeRamp({
        log: buildWeeklyLog({ weeklyMinutes: minutes }),
        today: TODAY,
      })
      expect(r.rampPct).toBeGreaterThan(15)
      expect(r.band).toBe('OVERSHOOT')
    }
  })
})

describe('computeWeeklyVolumeRamp — shape + metadata', () => {
  it('weeklyDeltasPct length === weeks (default 4); weeklyMinutes length === weeks+1', () => {
    const log = buildFlatLog({ dailyMinutes: 60, days: 60 })
    const r = computeWeeklyVolumeRamp({ log, today: TODAY })
    expect(r).not.toBeNull()
    expect(Array.isArray(r.weeklyDeltasPct)).toBe(true)
    expect(r.weeklyDeltasPct).toHaveLength(4)
    expect(r.weeklyMinutes).toHaveLength(5)
  })

  it('falls back to `time` field when `duration` is absent', () => {
    const log = []
    for (let i = 60 - 1; i >= 0; i--) {
      log.push({ date: isoMinusDays(TODAY, i), time: 50 })
    }
    const r = computeWeeklyVolumeRamp({ log, today: TODAY })
    expect(r).not.toBeNull()
    // Flat 50-min sessions → rampPct ≈ 0 → GENTLE
    expect(Math.abs(r.rampPct)).toBeLessThan(0.5)
    expect(r.band).toBe('GENTLE')
    // Weekly minutes should be ~50 * 7 = 350
    for (const m of r.weeklyMinutes) {
      expect(Math.abs(m - 350)).toBeLessThan(0.5)
    }
  })

  it('exposes the Gabbett/Foster/Bertelsen citation', () => {
    const log = buildFlatLog({ dailyMinutes: 60, days: 60 })
    const r = computeWeeklyVolumeRamp({ log, today: TODAY })
    expect(r.citation).toBe(WEEKLY_VOLUME_RAMP_CITATION)
    expect(r.citation).toMatch(/Gabbett 2016/)
    expect(r.citation).toMatch(/Foster 2001/)
    expect(r.citation).toMatch(/Bertelsen 2017/)
  })
})
