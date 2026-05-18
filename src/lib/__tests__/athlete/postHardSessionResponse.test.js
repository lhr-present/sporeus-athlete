// src/lib/__tests__/athlete/postHardSessionResponse.test.js
//
// Pure-fn tests for analyzePostHardSessionResponse — covers all 3
// bands, null guards (<3 pairs, missing dates, non-array inputs),
// and edge cases (HRV missing but sleep+RHR valid).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  analyzePostHardSessionResponse,
  classifyResponseBand,
  POST_HARD_RESPONSE_CITATION,
} from '../../athlete/postHardSessionResponse.js'

const TODAY = '2026-05-18'

beforeEach(() => {
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`))
})
afterEach(() => {
  vi.setSystemTime(new Date())
})

function daysAgo(n) {
  const d = new Date(`${TODAY}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

function session({ d, rpe = 8 }) {
  return { date: daysAgo(d), rpe, tss: 80, type: 'Threshold' }
}

function recovery({ d, sleepHrs, restingHR, hrv }) {
  const entry = { date: daysAgo(d) }
  if (sleepHrs !== undefined) entry.sleepHrs = sleepHrs
  if (restingHR !== undefined) entry.restingHR = restingHR
  if (hrv !== undefined) entry.hrv = hrv
  return entry
}

describe('classifyResponseBand', () => {
  it('returns WEAK when avg RHR delta >= +3', () => {
    expect(classifyResponseBand({ avgSleepDelta: 0, avgRhrDelta: 3, avgHrvDelta: 0 }))
      .toBe('WEAK')
    expect(classifyResponseBand({ avgSleepDelta: 0, avgRhrDelta: 5, avgHrvDelta: 0 }))
      .toBe('WEAK')
  })
  it('returns WEAK when avg sleep delta <= -0.5', () => {
    expect(classifyResponseBand({ avgSleepDelta: -0.6, avgRhrDelta: 0, avgHrvDelta: 0 }))
      .toBe('WEAK')
  })
  it('returns STRONG when sleep >= +0.2 AND rhr <= -1', () => {
    expect(classifyResponseBand({ avgSleepDelta: 0.3, avgRhrDelta: -1.5, avgHrvDelta: 0 }))
      .toBe('STRONG')
  })
  it('returns STRONG when sleep >= +0.2 AND hrv >= +5 with rhr missing', () => {
    expect(classifyResponseBand({ avgSleepDelta: 0.3, avgRhrDelta: null, avgHrvDelta: 6 }))
      .toBe('STRONG')
  })
  it('returns NORMAL otherwise', () => {
    expect(classifyResponseBand({ avgSleepDelta: 0, avgRhrDelta: 0, avgHrvDelta: 0 }))
      .toBe('NORMAL')
    expect(classifyResponseBand({ avgSleepDelta: 0.1, avgRhrDelta: -0.5, avgHrvDelta: 2 }))
      .toBe('NORMAL')
  })
})

describe('analyzePostHardSessionResponse — null guards', () => {
  it('returns null for empty inputs', () => {
    expect(analyzePostHardSessionResponse({ log: [], recovery: [], today: TODAY })).toBeNull()
  })
  it('returns null for non-array inputs', () => {
    expect(analyzePostHardSessionResponse({ log: null, recovery: null, today: TODAY }))
      .toBeNull()
  })
  it('returns null when fewer than 3 hard-session pairs', () => {
    const log = [session({ d: 5 }), session({ d: 7 })]
    const rec = [
      recovery({ d: 4, sleepHrs: 7.5, restingHR: 52, hrv: 60 }),
      recovery({ d: 6, sleepHrs: 7.2, restingHR: 53, hrv: 59 }),
    ]
    expect(analyzePostHardSessionResponse({ log, recovery: rec, today: TODAY }))
      .toBeNull()
  })
  it('returns null when next-day recovery missing for hard sessions', () => {
    const log = [
      session({ d: 5 }),
      session({ d: 7 }),
      session({ d: 9 }),
      session({ d: 11 }),
    ]
    const rec = [
      // recovery on session day, not next day — won't pair
      recovery({ d: 5, sleepHrs: 7, restingHR: 50, hrv: 60 }),
      recovery({ d: 7, sleepHrs: 7, restingHR: 50, hrv: 60 }),
      recovery({ d: 9, sleepHrs: 7, restingHR: 50, hrv: 60 }),
    ]
    expect(analyzePostHardSessionResponse({ log, recovery: rec, today: TODAY }))
      .toBeNull()
  })
  it('returns null for invalid today date', () => {
    expect(analyzePostHardSessionResponse({ log: [], recovery: [], today: 'not-a-date' }))
      .toBeNull()
  })
})

describe('analyzePostHardSessionResponse — STRONG band', () => {
  it('detects strong recovery (more sleep + lower RHR vs baseline)', () => {
    // Baseline: 6 recovery days at sleep=7h, rhr=55, hrv=60
    // Post-hard days: sleep=7.5h, rhr=52, hrv=68 (each clearly above/below baseline)
    const log = [
      session({ d: 10 }),
      session({ d: 14 }),
      session({ d: 18 }),
    ]
    const rec = [
      // baseline days (non-post-hard)
      recovery({ d: 2, sleepHrs: 7.0, restingHR: 55, hrv: 60 }),
      recovery({ d: 4, sleepHrs: 7.0, restingHR: 55, hrv: 60 }),
      recovery({ d: 6, sleepHrs: 7.0, restingHR: 55, hrv: 60 }),
      recovery({ d: 8, sleepHrs: 7.0, restingHR: 55, hrv: 60 }),
      recovery({ d: 12, sleepHrs: 7.0, restingHR: 55, hrv: 60 }),
      recovery({ d: 16, sleepHrs: 7.0, restingHR: 55, hrv: 60 }),
      // post-hard recovery days (d-1 from each session)
      recovery({ d: 9, sleepHrs: 7.6, restingHR: 52, hrv: 68 }),
      recovery({ d: 13, sleepHrs: 7.5, restingHR: 53, hrv: 67 }),
      recovery({ d: 17, sleepHrs: 7.7, restingHR: 52, hrv: 69 }),
    ]
    const r = analyzePostHardSessionResponse({ log, recovery: rec, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('STRONG')
    expect(r.pairCount).toBe(3)
    expect(r.avgSleepDelta).toBeGreaterThanOrEqual(0.2)
    expect(r.avgRhrDelta).toBeLessThanOrEqual(-1)
    expect(r.citation).toBe(POST_HARD_RESPONSE_CITATION)
    expect(r.baseline.sleep).toBeGreaterThan(0)
    expect(r.baseline.rhr).toBeGreaterThan(0)
    expect(r.baseline.hrv).toBeGreaterThan(0)
  })
})

describe('analyzePostHardSessionResponse — NORMAL band', () => {
  it('detects normal recovery (markers near baseline)', () => {
    const log = [
      session({ d: 10 }),
      session({ d: 14 }),
      session({ d: 18 }),
    ]
    const rec = [
      // baseline days
      recovery({ d: 2, sleepHrs: 7.0, restingHR: 55, hrv: 60 }),
      recovery({ d: 4, sleepHrs: 7.0, restingHR: 55, hrv: 60 }),
      recovery({ d: 6, sleepHrs: 7.0, restingHR: 55, hrv: 60 }),
      recovery({ d: 8, sleepHrs: 7.0, restingHR: 55, hrv: 60 }),
      // post-hard recovery near baseline
      recovery({ d: 9, sleepHrs: 7.0, restingHR: 55, hrv: 60 }),
      recovery({ d: 13, sleepHrs: 7.1, restingHR: 55, hrv: 61 }),
      recovery({ d: 17, sleepHrs: 6.9, restingHR: 56, hrv: 59 }),
    ]
    const r = analyzePostHardSessionResponse({ log, recovery: rec, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('NORMAL')
    expect(r.pairCount).toBe(3)
  })
})

describe('analyzePostHardSessionResponse — WEAK band', () => {
  it('detects weak recovery via elevated RHR', () => {
    const log = [
      session({ d: 10 }),
      session({ d: 14 }),
      session({ d: 18 }),
    ]
    const rec = [
      // baseline days
      recovery({ d: 2, sleepHrs: 7.0, restingHR: 55, hrv: 60 }),
      recovery({ d: 4, sleepHrs: 7.0, restingHR: 55, hrv: 60 }),
      recovery({ d: 6, sleepHrs: 7.0, restingHR: 55, hrv: 60 }),
      recovery({ d: 8, sleepHrs: 7.0, restingHR: 55, hrv: 60 }),
      // post-hard: RHR clearly elevated
      recovery({ d: 9, sleepHrs: 6.8, restingHR: 60, hrv: 50 }),
      recovery({ d: 13, sleepHrs: 6.5, restingHR: 61, hrv: 48 }),
      recovery({ d: 17, sleepHrs: 6.7, restingHR: 59, hrv: 49 }),
    ]
    const r = analyzePostHardSessionResponse({ log, recovery: rec, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('WEAK')
    expect(r.avgRhrDelta).toBeGreaterThanOrEqual(3)
  })

  it('detects weak recovery via sleep loss', () => {
    const log = [
      session({ d: 10 }),
      session({ d: 14 }),
      session({ d: 18 }),
    ]
    const rec = [
      // baseline days
      recovery({ d: 2, sleepHrs: 7.5, restingHR: 55, hrv: 60 }),
      recovery({ d: 4, sleepHrs: 7.5, restingHR: 55, hrv: 60 }),
      recovery({ d: 6, sleepHrs: 7.5, restingHR: 55, hrv: 60 }),
      recovery({ d: 8, sleepHrs: 7.5, restingHR: 55, hrv: 60 }),
      // post-hard: sleep dropped ≥0.5h
      recovery({ d: 9, sleepHrs: 6.5, restingHR: 55, hrv: 60 }),
      recovery({ d: 13, sleepHrs: 6.7, restingHR: 56, hrv: 59 }),
      recovery({ d: 17, sleepHrs: 6.6, restingHR: 55, hrv: 60 }),
    ]
    const r = analyzePostHardSessionResponse({ log, recovery: rec, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.band).toBe('WEAK')
    expect(r.avgSleepDelta).toBeLessThanOrEqual(-0.5)
  })
})

describe('analyzePostHardSessionResponse — edge cases', () => {
  it('works when HRV is missing entirely (sleep + RHR present)', () => {
    const log = [
      session({ d: 10 }),
      session({ d: 14 }),
      session({ d: 18 }),
    ]
    const rec = [
      // baseline days — no hrv field
      recovery({ d: 2, sleepHrs: 7.0, restingHR: 55 }),
      recovery({ d: 4, sleepHrs: 7.0, restingHR: 55 }),
      recovery({ d: 6, sleepHrs: 7.0, restingHR: 55 }),
      recovery({ d: 8, sleepHrs: 7.0, restingHR: 55 }),
      // post-hard — no hrv field
      recovery({ d: 9, sleepHrs: 7.6, restingHR: 52 }),
      recovery({ d: 13, sleepHrs: 7.5, restingHR: 53 }),
      recovery({ d: 17, sleepHrs: 7.7, restingHR: 52 }),
    ]
    const r = analyzePostHardSessionResponse({ log, recovery: rec, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.avgHrvDelta).toBeNull()
    expect(r.avgSleepDelta).toBeGreaterThan(0)
    expect(r.avgRhrDelta).toBeLessThan(0)
    expect(r.band).toBe('STRONG')
  })

  it('ignores non-hard sessions (rpe < 7)', () => {
    const log = [
      session({ d: 10, rpe: 5 }),
      session({ d: 12, rpe: 4 }),
      session({ d: 14, rpe: 6 }),
    ]
    const rec = [
      recovery({ d: 2, sleepHrs: 7, restingHR: 55, hrv: 60 }),
      recovery({ d: 4, sleepHrs: 7, restingHR: 55, hrv: 60 }),
      recovery({ d: 9, sleepHrs: 7.5, restingHR: 52, hrv: 65 }),
      recovery({ d: 11, sleepHrs: 7.5, restingHR: 52, hrv: 65 }),
      recovery({ d: 13, sleepHrs: 7.5, restingHR: 52, hrv: 65 }),
    ]
    expect(analyzePostHardSessionResponse({ log, recovery: rec, today: TODAY }))
      .toBeNull()
  })

  it('skips pairs where next-day recovery entry is missing', () => {
    const log = [
      session({ d: 10 }),  // missing d-1=9 recovery
      session({ d: 14 }),
      session({ d: 18 }),
      session({ d: 20 }),
    ]
    const rec = [
      // baseline
      recovery({ d: 2, sleepHrs: 7, restingHR: 55, hrv: 60 }),
      recovery({ d: 4, sleepHrs: 7, restingHR: 55, hrv: 60 }),
      recovery({ d: 6, sleepHrs: 7, restingHR: 55, hrv: 60 }),
      // pairs: only 14→13, 18→17, 20→19 (missing 10→9)
      recovery({ d: 13, sleepHrs: 7.0, restingHR: 55, hrv: 60 }),
      recovery({ d: 17, sleepHrs: 7.0, restingHR: 55, hrv: 60 }),
      recovery({ d: 19, sleepHrs: 7.0, restingHR: 55, hrv: 60 }),
    ]
    const r = analyzePostHardSessionResponse({ log, recovery: rec, today: TODAY })
    expect(r).not.toBeNull()
    expect(r.pairCount).toBe(3)
  })
})
