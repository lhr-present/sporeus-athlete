// src/lib/patterns.test.js
import { describe, it, expect } from 'vitest'
import {
  correlateTrainingToResults,
  findRecoveryPatterns,
  mineInjuryPatterns,
  findOptimalWeekStructure,
  getDayPattern,
} from './patterns.js'

function entry(daysAgo, tss = 80, rpe = 6, type = 'Easy Run') {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return { date: d.toISOString().slice(0, 10), tss, rpe, duration: 60, type }
}

function recovEntry(daysAgo, readiness = 7, sleep = 7.5) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return { date: d.toISOString().slice(0, 10), readiness, sleep, fatigue: 3 }
}

// ── correlateTrainingToResults ────────────────────────────────────────────────
describe('correlateTrainingToResults', () => {
  it('returns object with patterns array for no data', () => {
    const result = correlateTrainingToResults([], [])
    expect(result).toHaveProperty('patterns')
    expect(Array.isArray(result.patterns)).toBe(true)
  })

  it('returns object with patterns property', () => {
    const log = Array.from({ length: 40 }, (_, i) => entry(40 - i, 80))
    const testResults = [{ date: new Date().toISOString().slice(0, 10), testId: 'cooper', value: '50', unit: 'mL/kg/min' }]
    const result = correlateTrainingToResults(log, testResults)
    expect(result).toHaveProperty('patterns')
    expect(typeof result.reliable).toBe('boolean')
  })
})

// ── findRecoveryPatterns ──────────────────────────────────────────────────────
describe('findRecoveryPatterns', () => {
  it('returns an object for empty data', () => {
    const result = findRecoveryPatterns([], [])
    expect(typeof result).toBe('object')
  })

  it('returns a result object with at least one key', () => {
    const log = Array.from({ length: 20 }, (_, i) => entry(i, 80))
    const rec = Array.from({ length: 20 }, (_, i) => recovEntry(i))
    const result = findRecoveryPatterns(log, rec)
    expect(typeof result).toBe('object')
    expect(Object.keys(result).length).toBeGreaterThan(0)
  })
})

// ── mineInjuryPatterns ────────────────────────────────────────────────────────
describe('mineInjuryPatterns', () => {
  it('returns an object for empty data', () => {
    const result = mineInjuryPatterns([], [], [])
    expect(typeof result).toBe('object')
  })

  it('has patterns and vulnerableZones properties', () => {
    const result = mineInjuryPatterns([], [], [])
    expect(result).toHaveProperty('patterns')
    expect(result).toHaveProperty('vulnerableZones')
  })
})

// ── findOptimalWeekStructure ──────────────────────────────────────────────────
describe('findOptimalWeekStructure', () => {
  it('returns an object for insufficient data', () => {
    const log = Array.from({ length: 10 }, (_, i) => entry(i, 80))
    const result = findOptimalWeekStructure(log, [])
    expect(typeof result).toBe('object')
  })

  it('result has sampleSize or bestPattern property', () => {
    const log = Array.from({ length: 10 }, (_, i) => entry(i, 80))
    const result = findOptimalWeekStructure(log, [])
    expect(result).toHaveProperty('sampleSize')
  })

  it('with 90 days of data returns sampleSize > 0', () => {
    const log = Array.from({ length: 90 }, (_, i) => entry(i, 80, i % 3 === 0 ? 8 : 5))
    const rec  = Array.from({ length: 90 }, (_, i) => recovEntry(i, 7))
    const result = findOptimalWeekStructure(log, rec)
    expect(result.sampleSize).toBeGreaterThan(0)
  })
})

// ── getDayPattern ─────────────────────────────────────────────────────────────

describe('getDayPattern', () => {
  // Build a session on a specific ISO date string
  function sessionOn(dateStr, type = 'Easy Run', duration = 45, sport = 'Running') {
    return { date: dateStr, type, duration, sport, tss: 50, rpe: 6 }
  }

  // Produce a date string N weeks ago on the same day-of-week as `anchor`
  function sameWeekdayWeeksAgo(anchor, weeksBack) {
    const d = new Date(anchor + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() - weeksBack * 7)
    return d.toISOString().slice(0, 10)
  }

  it('returns null for empty log', () => {
    expect(getDayPattern([], '2026-04-21')).toBeNull()
    expect(getDayPattern(null, '2026-04-21')).toBeNull()
  })

  it('returns null when fewer than 3 same-weekday sessions in 56-day window', () => {
    const anchor = '2026-04-21' // Monday
    const log = [
      sessionOn(sameWeekdayWeeksAgo(anchor, 1)),
      sessionOn(sameWeekdayWeeksAgo(anchor, 2)),
    ]
    expect(getDayPattern(log, anchor)).toBeNull()
  })

  it('returns pattern when 3+ same-weekday sessions exist', () => {
    const anchor = '2026-04-21' // Monday
    const log = [
      sessionOn(sameWeekdayWeeksAgo(anchor, 1), 'Easy Run', 45),
      sessionOn(sameWeekdayWeeksAgo(anchor, 2), 'Easy Run', 50),
      sessionOn(sameWeekdayWeeksAgo(anchor, 3), 'Easy Run', 40),
    ]
    const result = getDayPattern(log, anchor)
    expect(result).not.toBeNull()
    expect(result.type).toBe('Easy Run')
  })

  it('correctly finds mode session type', () => {
    const anchor = '2026-04-21'
    const log = [
      sessionOn(sameWeekdayWeeksAgo(anchor, 1), 'Tempo Run', 55),
      sessionOn(sameWeekdayWeeksAgo(anchor, 2), 'Tempo Run', 60),
      sessionOn(sameWeekdayWeeksAgo(anchor, 3), 'Easy Run',  45),
      sessionOn(sameWeekdayWeeksAgo(anchor, 4), 'Tempo Run', 58),
    ]
    const result = getDayPattern(log, anchor)
    expect(result.type).toBe('Tempo Run')
  })

  it('returns median duration', () => {
    const anchor = '2026-04-21'
    const log = [
      sessionOn(sameWeekdayWeeksAgo(anchor, 1), 'Easy Run', 40),
      sessionOn(sameWeekdayWeeksAgo(anchor, 2), 'Easy Run', 45),
      sessionOn(sameWeekdayWeeksAgo(anchor, 3), 'Easy Run', 90), // outlier
    ]
    const result = getDayPattern(log, anchor)
    expect(result.durationMin).toBe(45)
  })

  it('ignores sessions older than 56 days', () => {
    const anchor = '2026-04-21'
    // Only 2 in-window + 3 old ones
    const log = [
      sessionOn(sameWeekdayWeeksAgo(anchor, 1), 'Easy Run', 45),
      sessionOn(sameWeekdayWeeksAgo(anchor, 2), 'Easy Run', 45),
      sessionOn(sameWeekdayWeeksAgo(anchor, 9), 'Easy Run', 45),  // 63 days back → outside
      sessionOn(sameWeekdayWeeksAgo(anchor, 10), 'Easy Run', 45), // outside
      sessionOn(sameWeekdayWeeksAgo(anchor, 11), 'Easy Run', 45), // outside
    ]
    // Only 2 in-window → should return null
    expect(getDayPattern(log, anchor)).toBeNull()
  })

  it('Monday pattern does not bleed into Tuesday (different dow)', () => {
    const monday = '2026-04-20'
    const tuesday = '2026-04-21'
    const log = [
      sessionOn(sameWeekdayWeeksAgo(monday, 1), 'Easy Run', 45),
      sessionOn(sameWeekdayWeeksAgo(monday, 2), 'Easy Run', 45),
      sessionOn(sameWeekdayWeeksAgo(monday, 3), 'Easy Run', 45),
    ]
    // Pattern exists for Monday
    expect(getDayPattern(log, monday)).not.toBeNull()
    // But Tuesday sees no matching sessions
    expect(getDayPattern(log, tuesday)).toBeNull()
  })

  it('returns confidence between 0 and 1', () => {
    const anchor = '2026-04-21'
    const log = [
      sessionOn(sameWeekdayWeeksAgo(anchor, 1), 'Easy Run', 45),
      sessionOn(sameWeekdayWeeksAgo(anchor, 2), 'Easy Run', 45),
      sessionOn(sameWeekdayWeeksAgo(anchor, 3), 'Easy Run', 45),
    ]
    const result = getDayPattern(log, anchor)
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })
})
