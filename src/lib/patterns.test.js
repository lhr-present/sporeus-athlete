// src/lib/patterns.test.js
import { describe, it, expect } from 'vitest'
import {
  correlateTrainingToResults,
  findRecoveryPatterns,
  mineInjuryPatterns,
  findOptimalWeekStructure,
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
