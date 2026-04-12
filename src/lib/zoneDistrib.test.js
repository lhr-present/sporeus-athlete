// src/lib/zoneDistrib.test.js — Zone distribution pure function tests
import { describe, it, expect } from 'vitest'
import { rpeToZone, zoneDistribution, trainingModel } from './zoneDistrib.js'

// ── rpeToZone ─────────────────────────────────────────────────────────────────
describe('rpeToZone', () => {
  it.each([
    [1, 1], [2, 1], [3, 1],
    [4, 2], [5, 2],
    [6, 3], [7, 3],
    [8, 4],
    [9, 5], [10, 5],
  ])('RPE %i → Zone %i', (rpe, expected) => {
    expect(rpeToZone(rpe)).toBe(expected)
  })

  it('returns null for 0', () => {
    expect(rpeToZone(0)).toBeNull()
  })

  it('returns null for null/undefined', () => {
    expect(rpeToZone(null)).toBeNull()
    expect(rpeToZone(undefined)).toBeNull()
  })

  it('rounds fractional RPE', () => {
    expect(rpeToZone(3.6)).toBe(2)  // rounds to 4 → Z2
    expect(rpeToZone(2.4)).toBe(1)  // rounds to 2 → Z1
  })
})

// ── zoneDistribution ──────────────────────────────────────────────────────────
describe('zoneDistribution', () => {
  it('returns null for empty session array', () => {
    expect(zoneDistribution([])).toBeNull()
  })

  it('returns null when no sessions have RPE', () => {
    expect(zoneDistribution([{ duration: 60 }, { duration: 45 }])).toBeNull()
  })

  it('returns 100% Z1 when all sessions have RPE 2', () => {
    const sessions = [
      { rpe: 2, duration: 60 },
      { rpe: 2, duration: 40 },
    ]
    const d = zoneDistribution(sessions)
    expect(d[1]).toBe(100)
    expect(d[2]).toBe(0)
  })

  it('weights by duration correctly', () => {
    const sessions = [
      { rpe: 3, duration: 60 },  // Z1, 60 min
      { rpe: 8, duration: 60 },  // Z4, 60 min
    ]
    const d = zoneDistribution(sessions)
    expect(d[1]).toBe(50)
    expect(d[4]).toBe(50)
  })

  it('handles sessions with no duration (treated as 0)', () => {
    const sessions = [
      { rpe: 5, duration: 60 },
      { rpe: 9, duration: 0 },   // zero duration — contributes nothing
    ]
    const d = zoneDistribution(sessions)
    expect(d[2]).toBe(100)
  })

  it('produces percentages that sum to ~100', () => {
    const sessions = [
      { rpe: 2, duration: 30 },
      { rpe: 5, duration: 30 },
      { rpe: 7, duration: 30 },
      { rpe: 8, duration: 10 },
    ]
    const d = zoneDistribution(sessions)
    const total = d[1] + d[2] + d[3] + d[4] + d[5]
    // Allow ±3 due to rounding
    expect(total).toBeGreaterThanOrEqual(97)
    expect(total).toBeLessThanOrEqual(103)
  })
})

// ── trainingModel ─────────────────────────────────────────────────────────────
describe('trainingModel', () => {
  it('returns unknown for null', () => {
    expect(trainingModel(null)).toBe('unknown')
  })

  it('identifies polarized: Z1+Z2 ≥ 70%, Z4+Z5 ≥ 15%', () => {
    expect(trainingModel({ 1: 50, 2: 25, 3: 5, 4: 15, 5: 5 })).toBe('polarized')
  })

  it('identifies pyramidal: Z1+Z2 ≥ 60%, Z3 ≥ 20%, hard < 20%', () => {
    expect(trainingModel({ 1: 40, 2: 25, 3: 25, 4: 8, 5: 2 })).toBe('pyramidal')
  })

  it('identifies threshold when Z3 ≥ 30%', () => {
    expect(trainingModel({ 1: 30, 2: 20, 3: 35, 4: 10, 5: 5 })).toBe('threshold')
  })

  it('identifies recovery when Z1+Z2 ≥ 85%', () => {
    expect(trainingModel({ 1: 60, 2: 27, 3: 8, 4: 3, 5: 2 })).toBe('recovery')
  })

  it('returns mixed for unclear distribution', () => {
    expect(trainingModel({ 1: 20, 2: 20, 3: 20, 4: 20, 5: 20 })).toBe('mixed')
  })
})
