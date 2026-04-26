// src/lib/__tests__/athlete/intensityBalance.test.js — E76
import { describe, it, expect } from 'vitest'
import { computeIntensityBalance } from '../../athlete/intensityBalance.js'

function makeEntry(daysAgo, rpe, duration, today = '2026-04-27') {
  const d = new Date(today + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return { date: d.toISOString().slice(0, 10), rpe, duration }
}

describe('computeIntensityBalance', () => {
  it('returns null for empty log', () => {
    expect(computeIntensityBalance([])).toBeNull()
  })

  it('returns null for null log', () => {
    expect(computeIntensityBalance(null)).toBeNull()
  })

  it('returns insufficient status for < 4 sessions', () => {
    const log = [makeEntry(1, 4, 60), makeEntry(2, 5, 60), makeEntry(3, 6, 60)]
    const r = computeIntensityBalance(log, 4, '2026-04-27')
    expect(r.status).toBe('insufficient')
  })

  it('returns polarized when ≥75% easy', () => {
    const log = [
      makeEntry(1, 4, 80), makeEntry(3, 4, 80), makeEntry(5, 4, 80),
      makeEntry(7, 4, 80), makeEntry(9, 7, 20),
    ]
    const r = computeIntensityBalance(log, 4, '2026-04-27')
    expect(r.status).toBe('polarized')
    expect(r.easyPct).toBeGreaterThanOrEqual(75)
  })

  it('returns too-hard when <60% easy', () => {
    const log = [
      makeEntry(1, 8, 60), makeEntry(2, 9, 60), makeEntry(3, 7, 60),
      makeEntry(4, 4, 20), makeEntry(5, 8, 60),
    ]
    const r = computeIntensityBalance(log, 4, '2026-04-27')
    expect(r.status).toBe('too-hard')
    expect(r.easyPct).toBeLessThan(60)
  })

  it('returns balanced when 60–74% easy', () => {
    const log = [
      makeEntry(1, 4, 65), makeEntry(3, 4, 65),
      makeEntry(5, 8, 35), makeEntry(7, 8, 35),
    ]
    const r = computeIntensityBalance(log, 4, '2026-04-27')
    expect(r.status).toBe('balanced')
    expect(r.easyPct).toBeGreaterThanOrEqual(60)
    expect(r.easyPct).toBeLessThan(75)
  })

  it('easyPct + hardPct = 100', () => {
    const log = [
      makeEntry(1, 4, 60), makeEntry(2, 7, 40), makeEntry(3, 4, 30), makeEntry(4, 8, 30),
    ]
    const r = computeIntensityBalance(log, 4, '2026-04-27')
    expect(r.easyPct + r.hardPct).toBe(100)
  })

  it('excludes sessions older than nWeeks', () => {
    const log = [
      // 5 sessions within 4 weeks
      makeEntry(5, 4, 60), makeEntry(10, 4, 60), makeEntry(15, 4, 60),
      makeEntry(20, 4, 60), makeEntry(25, 4, 60),
      // old sessions beyond window should be ignored
      makeEntry(35, 8, 999), makeEntry(40, 9, 999),
    ]
    const r = computeIntensityBalance(log, 4, '2026-04-27')
    expect(r.easyPct).toBe(100)
    expect(r.status).toBe('polarized')
  })

  it('includes sessions count', () => {
    const log = [
      makeEntry(1, 4, 60), makeEntry(2, 5, 60), makeEntry(3, 6, 60),
      makeEntry(4, 4, 60), makeEntry(5, 7, 60),
    ]
    const r = computeIntensityBalance(log, 4, '2026-04-27')
    expect(r.sessions).toBe(5)
  })

  it('returns en and tr strings', () => {
    const log = [
      makeEntry(1, 4, 80), makeEntry(3, 4, 80), makeEntry(5, 4, 80),
      makeEntry(7, 4, 80), makeEntry(9, 7, 20),
    ]
    const r = computeIntensityBalance(log, 4, '2026-04-27')
    expect(typeof r.en).toBe('string')
    expect(typeof r.tr).toBe('string')
    expect(r.en.length).toBeGreaterThan(5)
  })

  it('RPE 5 counts as easy', () => {
    const log = [
      makeEntry(1, 5, 100), makeEntry(2, 5, 100),
      makeEntry(3, 6, 1),   makeEntry(4, 5, 100),
    ]
    const r = computeIntensityBalance(log, 4, '2026-04-27')
    expect(r.easyPct).toBeGreaterThan(90)
  })
})
