// src/lib/__tests__/trainingLoad.banister.test.js — E92

import { describe, it, expect, vi, afterEach } from 'vitest'
import { fitBanister, predictBanister, generateWeeklyRecap } from '../trainingLoad.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a simple training log with uniform TSS over a date range */
function makeLog(startDateStr, days, tss = 80, type = 'run') {
  const entries = []
  for (let i = 0; i < days; i++) {
    const d = new Date(startDateStr + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + i)
    entries.push({ date: d.toISOString().slice(0, 10), tss, type })
  }
  return entries
}

/**
 * Build a log for generateWeeklyRecap Monday tests.
 * Monday = 2026-04-27 UTC → last week = 2026-04-20 to 2026-04-26 (7 days)
 */
function makeLogForMonday(tss = 80, sessions = 7, rpe = null) {
  const entries = []
  for (let i = 0; i < sessions; i++) {
    const d = new Date('2026-04-20T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + i)
    const entry = { date: d.toISOString().slice(0, 10), tss, type: 'run' }
    if (rpe !== null) entry.rpe = rpe
    entries.push(entry)
  }
  return entries
}

/** Build test results spaced across the log */
function makeTestResults(log, count = 3) {
  const step = Math.floor(log.length / (count + 1))
  const results = []
  for (let i = 1; i <= count; i++) {
    const entry = log[i * step - 1] || log[log.length - 1]
    results.push({ date: entry.date, value: 200 + i * 20 })
  }
  return results
}

// ─── fitBanister ─────────────────────────────────────────────────────────────

describe('fitBanister', () => {
  const log = makeLog('2024-01-01', 120, 80)

  it('returns null when testResults is null', () => {
    expect(fitBanister(log, null)).toBeNull()
  })

  it('returns null when testResults is undefined', () => {
    expect(fitBanister(log, undefined)).toBeNull()
  })

  it('returns null for empty testResults array', () => {
    expect(fitBanister(log, [])).toBeNull()
  })

  it('returns null with only 2 valid results', () => {
    const two = [
      { date: '2024-02-01', value: 220 },
      { date: '2024-03-01', value: 240 },
    ]
    expect(fitBanister(log, two)).toBeNull()
  })

  it('filters out entries with non-number value — if only 2 valid remain, returns null', () => {
    const mixed = [
      { date: '2024-02-01', value: 220 },
      { date: '2024-03-01', value: 'fast' },   // invalid
      { date: '2024-04-01', value: null },       // invalid
      { date: '2024-05-01', value: 240 },
    ]
    expect(fitBanister(log, mixed)).toBeNull()
  })

  it('returns non-null object with 3 valid test results', () => {
    const tests = makeTestResults(log, 3)
    const fit = fitBanister(log, tests)
    expect(fit).not.toBeNull()
    expect(fit).toBeTypeOf('object')
  })

  it('returned object has k1, k2, p0, r2, minV, maxV keys', () => {
    const tests = makeTestResults(log, 3)
    const fit = fitBanister(log, tests)
    expect(fit).toHaveProperty('k1')
    expect(fit).toHaveProperty('k2')
    expect(fit).toHaveProperty('p0')
    expect(fit).toHaveProperty('r2')
    expect(fit).toHaveProperty('minV')
    expect(fit).toHaveProperty('maxV')
  })

  it('k1, k2, p0 are finite numbers (not NaN)', () => {
    const tests = makeTestResults(log, 3)
    const fit = fitBanister(log, tests)
    expect(Number.isFinite(fit.k1)).toBe(true)
    expect(Number.isFinite(fit.k2)).toBe(true)
    expect(Number.isFinite(fit.p0)).toBe(true)
  })

  it('r2 is between 0 and 1 inclusive', () => {
    const tests = makeTestResults(log, 5)
    const fit = fitBanister(log, tests)
    expect(fit.r2).toBeGreaterThanOrEqual(0)
    expect(fit.r2).toBeLessThanOrEqual(1)
  })

  it('minV and maxV match min and max of input test values', () => {
    const tests = [
      { date: '2024-02-01', value: 200 },
      { date: '2024-03-01', value: 260 },
      { date: '2024-04-01', value: 230 },
    ]
    const fit = fitBanister(log, tests)
    expect(fit.minV).toBe(200)
    expect(fit.maxV).toBe(260)
  })

  it('r2 = 0 when all test values are identical (no variance to explain)', () => {
    const sameValueTests = [
      { date: '2024-02-01', value: 250 },
      { date: '2024-03-01', value: 250 },
      { date: '2024-04-01', value: 250 },
    ]
    const fit = fitBanister(log, sameValueTests)
    expect(fit.r2).toBe(0)
  })

  it('with empty log and 3 test results — g=0,h=0 at all tests — returns non-null (degenerate but valid)', () => {
    const tests = [
      { date: '2024-02-01', value: 200 },
      { date: '2024-03-01', value: 250 },
      { date: '2024-04-01', value: 220 },
    ]
    // Empty log → g=0, h=0 for all test points → column [g]=all zeros → singular → null
    // This is the correct behavior: null because gauss3 returns null on singular matrix
    const fit = fitBanister([], tests)
    // With g=0 h=0 for all rows, the A matrix is degenerate (columns 1 and 2 are zero vectors)
    // gauss3 will return null → fitBanister returns null
    expect(fit).toBeNull()
  })

  it('returns valid fit with 5 test results', () => {
    const tests = makeTestResults(log, 5)
    const fit = fitBanister(log, tests)
    expect(fit).not.toBeNull()
    expect(Number.isFinite(fit.k1)).toBe(true)
    expect(Number.isFinite(fit.r2)).toBe(true)
  })

  it('r2 is rounded to exactly 2 decimal places', () => {
    const tests = makeTestResults(log, 5)
    const fit = fitBanister(log, tests)
    const decimals = (fit.r2.toString().split('.')[1] || '').length
    expect(decimals).toBeLessThanOrEqual(2)
    // Verify it equals its own 2-decimal rounding
    expect(fit.r2).toBe(Math.round(fit.r2 * 100) / 100)
  })

  it('filters out test entries with missing date field', () => {
    const tests = [
      { value: 220 },                            // no date — filtered
      { date: '2024-03-01', value: 230 },
      { date: '2024-04-01', value: 250 },
    ]
    // Only 2 valid after filtering → null
    expect(fitBanister(log, tests)).toBeNull()
  })
})

// ─── predictBanister ─────────────────────────────────────────────────────────

describe('predictBanister', () => {
  const log = makeLog('2024-01-01', 120, 80)
  const tests = makeTestResults(log, 5)
  let fit

  // Obtain a real fit once (outside fake-timer zone — no system time dependency here)
  fit = fitBanister(log, tests)

  it('returns [] when fit is null', () => {
    expect(predictBanister(log, null)).toEqual([])
  })

  it('returns [] when fit is undefined', () => {
    expect(predictBanister(log, undefined)).toEqual([])
  })

  it('returns array of exactly 90 items by default', () => {
    const result = predictBanister(log, fit)
    expect(result).toHaveLength(90)
  })

  it('returns array of exactly 28 items when days=28', () => {
    const result = predictBanister(log, fit, [], 28)
    expect(result).toHaveLength(28)
  })

  it('each item has date, predicted, g, h properties', () => {
    const result = predictBanister(log, fit, [], 5)
    for (const item of result) {
      expect(item).toHaveProperty('date')
      expect(item).toHaveProperty('predicted')
      expect(item).toHaveProperty('g')
      expect(item).toHaveProperty('h')
    }
  })

  it('predicted is always >= 0', () => {
    const result = predictBanister(log, fit)
    for (const item of result) {
      expect(item.predicted).toBeGreaterThanOrEqual(0)
    }
  })

  it('predicted is always <= 100', () => {
    const result = predictBanister(log, fit)
    for (const item of result) {
      expect(item.predicted).toBeLessThanOrEqual(100)
    }
  })

  it('dates are sorted ascending', () => {
    const result = predictBanister(log, fit, [], 10)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].date > result[i - 1].date).toBe(true)
    }
  })

  it('first date is tomorrow (today + 1 day)', () => {
    const result = predictBanister(log, fit, [], 1)
    const tomorrow = new Date()
    tomorrow.setUTCHours(0, 0, 0, 0)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    expect(result[0].date).toBe(tomorrow.toISOString().slice(0, 10))
  })

  it('all dates are valid YYYY-MM-DD strings', () => {
    const result = predictBanister(log, fit, [], 10)
    const isoPattern = /^\d{4}-\d{2}-\d{2}$/
    for (const item of result) {
      expect(item.date).toMatch(isoPattern)
      expect(isNaN(new Date(item.date).getTime())).toBe(false)
    }
  })

  it('g and h values are non-negative numbers', () => {
    const result = predictBanister(log, fit, [], 10)
    for (const item of result) {
      expect(typeof item.g).toBe('number')
      expect(typeof item.h).toBe('number')
      expect(item.g).toBeGreaterThanOrEqual(0)
      expect(item.h).toBeGreaterThanOrEqual(0)
    }
  })

  it('planned future sessions increase g and h compared to no planned sessions', () => {
    const tomorrow = new Date()
    tomorrow.setUTCHours(0, 0, 0, 0)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    const tomorrowStr = tomorrow.toISOString().slice(0, 10)

    const planned = [{ date: tomorrowStr, tss: 200 }]
    const withPlanned    = predictBanister(log, fit, planned, 5)
    const withoutPlanned = predictBanister(log, fit, [],     5)

    // First day should have higher g and h when a high-TSS session is planned
    expect(withPlanned[0].g).toBeGreaterThan(withoutPlanned[0].g)
    expect(withPlanned[0].h).toBeGreaterThan(withoutPlanned[0].h)
  })

  it('predictions are deterministic — same input produces identical output', () => {
    const r1 = predictBanister(log, fit, [], 10)
    const r2 = predictBanister(log, fit, [], 10)
    expect(r1).toEqual(r2)
  })
})

// ─── generateWeeklyRecap ─────────────────────────────────────────────────────

describe('generateWeeklyRecap', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  // ── null / insufficient data ──────────────────────────────────────────────

  it('returns null when log is null', () => {
    expect(generateWeeklyRecap(null)).toBeNull()
  })

  it('returns null when log is undefined', () => {
    expect(generateWeeklyRecap(undefined)).toBeNull()
  })

  it('returns null when log has fewer than 7 entries', () => {
    const shortLog = makeLog('2026-04-20', 6, 80)
    // Even on Monday this should return null because log.length < 7
    vi.useFakeTimers({ now: new Date('2026-04-27T12:00:00Z'), toFake: ['Date'] })
    expect(generateWeeklyRecap(shortLog)).toBeNull()
  })

  // ── non-Monday guard ──────────────────────────────────────────────────────

  it('returns null on Tuesday (non-Monday)', () => {
    // 2026-04-28 is Tuesday
    vi.useFakeTimers({ now: new Date('2026-04-28T12:00:00Z'), toFake: ['Date'] })
    const log = makeLogForMonday(80, 7)
    expect(generateWeeklyRecap(log)).toBeNull()
  })

  it('returns null on Sunday (non-Monday)', () => {
    // 2026-04-26 is Sunday
    vi.useFakeTimers({ now: new Date('2026-04-26T12:00:00Z'), toFake: ['Date'] })
    const log = makeLogForMonday(80, 7)
    expect(generateWeeklyRecap(log)).toBeNull()
  })

  it('returns null on Wednesday (non-Monday)', () => {
    // 2026-04-29 is Wednesday
    vi.useFakeTimers({ now: new Date('2026-04-29T12:00:00Z'), toFake: ['Date'] })
    const log = makeLogForMonday(80, 7)
    expect(generateWeeklyRecap(log)).toBeNull()
  })

  // ── Monday with valid data ────────────────────────────────────────────────

  it('returns non-null on Monday with 7+ entries in last week', () => {
    vi.useFakeTimers({ now: new Date('2026-04-27T12:00:00Z'), toFake: ['Date'] })
    const log = makeLogForMonday(80, 7)
    expect(generateWeeklyRecap(log)).not.toBeNull()
  })

  it('returned object has all required keys', () => {
    vi.useFakeTimers({ now: new Date('2026-04-27T12:00:00Z'), toFake: ['Date'] })
    const log = makeLogForMonday(80, 7)
    const recap = generateWeeklyRecap(log)
    expect(recap).toHaveProperty('sessions')
    expect(recap).toHaveProperty('totalTSS')
    expect(recap).toHaveProperty('ctlDelta')
    expect(recap).toHaveProperty('atlDelta')
    expect(recap).toHaveProperty('avgRPE')
    expect(recap).toHaveProperty('dominantType')
    expect(recap).toHaveProperty('comparedToAvg')
    expect(recap).toHaveProperty('weekLabel')
    expect(recap.comparedToAvg).toHaveProperty('tssRatio')
    expect(recap.comparedToAvg).toHaveProperty('sessionRatio')
  })

  it('weekLabel matches "WK N" format', () => {
    vi.useFakeTimers({ now: new Date('2026-04-27T12:00:00Z'), toFake: ['Date'] })
    const log = makeLogForMonday(80, 7)
    const recap = generateWeeklyRecap(log)
    expect(recap.weekLabel).toMatch(/^WK \d+$/)
  })

  it('sessions count equals number of entries in last 7 days', () => {
    vi.useFakeTimers({ now: new Date('2026-04-27T12:00:00Z'), toFake: ['Date'] })
    // makeLogForMonday puts 7 entries in 2026-04-20 to 2026-04-26 (all in last week)
    const log = makeLogForMonday(80, 7)
    const recap = generateWeeklyRecap(log)
    expect(recap.sessions).toBe(7)
  })

  it('totalTSS is a number equal to sum of TSS in last week', () => {
    vi.useFakeTimers({ now: new Date('2026-04-27T12:00:00Z'), toFake: ['Date'] })
    const log = makeLogForMonday(100, 7)
    const recap = generateWeeklyRecap(log)
    expect(typeof recap.totalTSS).toBe('number')
    expect(recap.totalTSS).toBe(700)
  })

  it('avgRPE is null when no rpe values exist in last week', () => {
    vi.useFakeTimers({ now: new Date('2026-04-27T12:00:00Z'), toFake: ['Date'] })
    const log = makeLogForMonday(80, 7, null)  // no RPE
    const recap = generateWeeklyRecap(log)
    expect(recap.avgRPE).toBeNull()
  })

  it('avgRPE is a number when rpe values are present', () => {
    vi.useFakeTimers({ now: new Date('2026-04-27T12:00:00Z'), toFake: ['Date'] })
    const log = makeLogForMonday(80, 7, 7)  // RPE = 7 for all entries
    const recap = generateWeeklyRecap(log)
    expect(typeof recap.avgRPE).toBe('number')
    expect(recap.avgRPE).toBe(7)
  })

  it('dominantType is null when no entries have a type', () => {
    vi.useFakeTimers({ now: new Date('2026-04-27T12:00:00Z'), toFake: ['Date'] })
    // Build 7 entries with no type field, spread into last week
    const entries = []
    for (let i = 0; i < 7; i++) {
      const d = new Date('2026-04-20T00:00:00Z')
      d.setUTCDate(d.getUTCDate() + i)
      entries.push({ date: d.toISOString().slice(0, 10), tss: 80 })
    }
    const recap = generateWeeklyRecap(entries)
    expect(recap.dominantType).toBeNull()
  })

  it('dominantType is the most frequent type in last week', () => {
    vi.useFakeTimers({ now: new Date('2026-04-27T12:00:00Z'), toFake: ['Date'] })
    const entries = []
    const types = ['run', 'run', 'run', 'bike', 'bike', 'swim', 'run']
    for (let i = 0; i < 7; i++) {
      const d = new Date('2026-04-20T00:00:00Z')
      d.setUTCDate(d.getUTCDate() + i)
      entries.push({ date: d.toISOString().slice(0, 10), tss: 80, type: types[i] })
    }
    const recap = generateWeeklyRecap(entries)
    expect(recap.dominantType).toBe('run')
  })
})
