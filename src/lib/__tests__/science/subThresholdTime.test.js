// src/lib/__tests__/science/subThresholdTime.test.js
// E12 — Citation-grounded tests for subThresholdTime.js
//
// References:
//   Seiler S. (2010). What is best practice for training intensity distribution?
//     Int J Sports Physiol Perform 5(3):276–291.
//   Seiler K.S. & Kjerland G.Ø. (2006). Quantifying training intensity distribution
//     in endurance athletes. Scand J Med Sci Sports 16(1):49–56.
//
// Polarized model: ≥ 80% of sessions/time should be below VT2 (Zone 1+2).
// This module quantifies that sub-threshold volume per week.

import { describe, it, expect } from 'vitest'
import { weekSubThresholdMin, subThresholdTrend } from '../../science/subThresholdTime.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSession(date, opts = {}) {
  return {
    date,
    durationSec: opts.durationSec ?? 3600,
    avgHR:        opts.avgHR,
    hrStream:     opts.hrStream,
    powerStream:  opts.powerStream,
    zoneType:     opts.zoneType,
  }
}

const WEEK_START = '2026-04-13' // Monday
const WEEK_END   = '2026-04-19' // Sunday (exclusive — sessions on Mon–Sun inclusive)

// ── weekSubThresholdMin — null guards ─────────────────────────────────────────

describe('weekSubThresholdMin — null guards (Seiler 2010)', () => {
  it('returns null when sessions array is empty', () => {
    expect(weekSubThresholdMin([], WEEK_START, { thresholdHR: 160 })).toBeNull()
  })

  it('returns null when weekStart is missing', () => {
    const s = makeSession('2026-04-14', { avgHR: 140, durationSec: 3600 })
    expect(weekSubThresholdMin([s], null, { thresholdHR: 160 })).toBeNull()
  })

  it('returns null when zones is empty object', () => {
    const s = makeSession('2026-04-14', { avgHR: 140, durationSec: 3600 })
    expect(weekSubThresholdMin([s], WEEK_START, {})).toBeNull()
  })

  it('returns null when no sessions fall in the target week', () => {
    const s = makeSession('2026-03-01', { avgHR: 140, durationSec: 3600 })
    expect(weekSubThresholdMin([s], WEEK_START, { thresholdHR: 160 })).toBeNull()
  })
})

// ── weekSubThresholdMin — HR stream (Seiler 2010) ────────────────────────────

describe('weekSubThresholdMin — HR stream (Seiler 2010)', () => {
  // Reference: 60-min session, all HR=150bpm, threshold=160bpm
  // → all 3600s below threshold → 60 minutes sub-threshold
  it('counts full session when all HR samples below threshold', () => {
    const hrStream = new Array(3600).fill(150)
    const s = makeSession('2026-04-14', { hrStream, durationSec: 3600 })
    const r = weekSubThresholdMin([s], WEEK_START, { thresholdHR: 160 })
    expect(r).not.toBeNull()
    expect(r.minutes).toBe(60)
    expect(r.sessionsIncluded).toBe(1)
  })

  // Reference: 60-min session, all HR=165bpm (above threshold=160)
  // → 0 seconds sub-threshold
  it('returns 0 minutes when all HR samples above threshold', () => {
    const hrStream = new Array(3600).fill(165)
    const s = makeSession('2026-04-14', { hrStream, durationSec: 3600 })
    const r = weekSubThresholdMin([s], WEEK_START, { thresholdHR: 160 })
    expect(r).not.toBeNull()
    expect(r.minutes).toBe(0)
  })

  // Reference: 60-min session, first 30 min at 150bpm (below), last 30 min at 165bpm (above)
  // → 1800s sub-threshold = 30 minutes
  it('counts partial sub-threshold time correctly (30/60 min)', () => {
    const hrStream = [
      ...new Array(1800).fill(150),
      ...new Array(1800).fill(165),
    ]
    const s = makeSession('2026-04-14', { hrStream, durationSec: 3600 })
    const r = weekSubThresholdMin([s], WEEK_START, { thresholdHR: 160 })
    expect(r).not.toBeNull()
    expect(r.minutes).toBe(30)
  })

  it('sums sub-threshold time across multiple sessions in the week', () => {
    const s1 = makeSession('2026-04-14', { hrStream: new Array(3600).fill(150), durationSec: 3600 })
    const s2 = makeSession('2026-04-16', { hrStream: new Array(3600).fill(150), durationSec: 3600 })
    const r = weekSubThresholdMin([s1, s2], WEEK_START, { thresholdHR: 160 })
    expect(r.minutes).toBe(120)
    expect(r.sessionsIncluded).toBe(2)
  })

  it('excludes sessions outside the target week', () => {
    const inWeek  = makeSession('2026-04-15', { hrStream: new Array(3600).fill(150), durationSec: 3600 })
    const outWeek = makeSession('2026-04-20', { hrStream: new Array(3600).fill(150), durationSec: 3600 })
    const r = weekSubThresholdMin([inWeek, outWeek], WEEK_START, { thresholdHR: 160 })
    expect(r.minutes).toBe(60)
    expect(r.sessionsIncluded).toBe(1)
  })
})

// ── weekSubThresholdMin — power stream (Seiler 2010) ─────────────────────────

describe('weekSubThresholdMin — power stream (Seiler 2010)', () => {
  // Reference: 60-min session, all power=200W, threshold=250W → all 3600s sub-threshold
  it('counts full session when all power samples below threshold', () => {
    const powerStream = new Array(3600).fill(200)
    const s = makeSession('2026-04-14', { powerStream, durationSec: 3600 })
    const r = weekSubThresholdMin([s], WEEK_START, { thresholdPower: 250 })
    expect(r.minutes).toBe(60)
  })

  it('prefers power stream over HR stream when both present', () => {
    // HR all below threshold, power all above → power wins → 0 minutes
    const s = makeSession('2026-04-14', {
      hrStream:    new Array(3600).fill(150),   // all below 160
      powerStream: new Array(3600).fill(280),   // all above 250
      durationSec: 3600,
    })
    const r = weekSubThresholdMin([s], WEEK_START, {
      thresholdHR: 160,
      thresholdPower: 250,
    })
    expect(r.minutes).toBe(0)
  })
})

// ── weekSubThresholdMin — avgHR fallback ──────────────────────────────────────

describe('weekSubThresholdMin — avgHR fallback (Seiler 2010)', () => {
  it('counts full durationSec when avgHR below threshold (no stream)', () => {
    const s = makeSession('2026-04-14', { avgHR: 150, durationSec: 3600 })
    const r = weekSubThresholdMin([s], WEEK_START, { thresholdHR: 160 })
    expect(r.minutes).toBe(60)
  })

  it('counts 0 minutes when avgHR above threshold', () => {
    const s = makeSession('2026-04-14', { avgHR: 165, durationSec: 3600 })
    const r = weekSubThresholdMin([s], WEEK_START, { thresholdHR: 160 })
    expect(r.minutes).toBe(0)
  })
})

// ── weekSubThresholdMin — zoneType label fallback ─────────────────────────────

describe('weekSubThresholdMin — zoneType label fallback (Seiler 2010)', () => {
  it('counts full duration for z1 session', () => {
    const s = makeSession('2026-04-14', { zoneType: 'z1', durationSec: 3600 })
    const r = weekSubThresholdMin([s], WEEK_START, { thresholdHR: 160 })
    expect(r.minutes).toBe(60)
  })

  it('counts full duration for z2 session', () => {
    const s = makeSession('2026-04-14', { zoneType: 'z2', durationSec: 5400 })
    const r = weekSubThresholdMin([s], WEEK_START, { thresholdHR: 160 })
    expect(r.minutes).toBe(90)
  })
})

// ── subThresholdTrend (Seiler 2010) ──────────────────────────────────────────

describe('subThresholdTrend — Seiler (2010)', () => {
  it('returns empty array when sessions is empty', () => {
    expect(subThresholdTrend([], { thresholdHR: 160 }, 4)).toEqual([])
  })

  it('returns array of length `weeks`', () => {
    const sessions = [
      makeSession('2026-04-14', { avgHR: 150, durationSec: 3600 }),
    ]
    const result = subThresholdTrend(sessions, { thresholdHR: 160 }, 4)
    expect(result).toHaveLength(4)
  })

  it('each entry has weekStart, minutes, sessionsIncluded fields', () => {
    const sessions = [makeSession('2026-04-14', { avgHR: 150, durationSec: 3600 })]
    const result = subThresholdTrend(sessions, { thresholdHR: 160 }, 2)
    for (const entry of result) {
      expect(entry).toHaveProperty('weekStart')
      expect(entry).toHaveProperty('minutes')
      expect(entry).toHaveProperty('sessionsIncluded')
    }
  })

  it('returns null minutes for weeks with no data', () => {
    // All sessions in one week, other weeks empty
    const sessions = [makeSession('2026-04-14', { avgHR: 150, durationSec: 3600 })]
    const result = subThresholdTrend(sessions, { thresholdHR: 160 }, 8)
    const nullWeeks = result.filter(e => e.minutes === null)
    expect(nullWeeks.length).toBeGreaterThan(0)
  })

  it('returns chronological order (oldest week first)', () => {
    const sessions = [makeSession('2026-04-14', { avgHR: 150, durationSec: 3600 })]
    const result = subThresholdTrend(sessions, { thresholdHR: 160 }, 4)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].weekStart > result[i - 1].weekStart).toBe(true)
    }
  })
})
