// ─── strainHistory.test.js — 12+ tests (Foster 1998) ─────────────────────────
import { describe, it, expect } from 'vitest'
import {
  classifyStrainWeek,
  computeStrainHistory,
  computeStrainReport,
  FOSTER_CITATION,
  MONOTONY_HIGH_THRESHOLD,
  STRAIN_HIGH_THRESHOLD,
} from '../../athlete/strainHistory.js'

// ─── Synthetic log generator ─────────────────────────────────────────────────
/**
 * Generate `count` log entries spread over the last `count` days ending on `today`.
 * Alternates TSS 80/20 to produce high monotony scenario.
 */
function makeLog(count = 70, today = '2026-04-25', altHigh = true) {
  const log = []
  const base = new Date(today + 'T00:00:00')
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(base)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    // Alternate 80/20 for high monotony (very consistent load every day)
    const tss = altHigh ? (i % 2 === 0 ? 80 : 20) : (40 + (i % 5) * 10)
    log.push({ date: dateStr, tss, type: 'run', duration: 60 })
  }
  return log
}

const TODAY    = '2026-04-25'
const LOG70    = makeLog(70, TODAY)          // 70-day alternating 80/20
const LOG5     = makeLog(5, TODAY)           // too short → []
const LOG6     = makeLog(6, TODAY)           // too short → []
const LOG_ZERO = []                          // empty log

// ─── 1. classifyStrainWeek ───────────────────────────────────────────────────
describe('classifyStrainWeek', () => {
  it('returns low_load for null monotony', () => {
    expect(classifyStrainWeek(null, null)).toBe('low_load')
  })

  it('returns low_load for monotony === 0', () => {
    expect(classifyStrainWeek(0, 0)).toBe('low_load')
  })

  it('returns high_monotony at exact threshold 2.0', () => {
    expect(classifyStrainWeek(MONOTONY_HIGH_THRESHOLD, 1000)).toBe('high_monotony')
  })

  it('returns high_monotony above threshold 2.5', () => {
    expect(classifyStrainWeek(2.5, 10000)).toBe('high_monotony')
  })

  it('high_monotony takes priority over high_strain', () => {
    expect(classifyStrainWeek(2.1, 9000)).toBe('high_monotony')
  })

  it('returns high_strain when strain >= 6000 and monotony < 2.0', () => {
    expect(classifyStrainWeek(1.5, STRAIN_HIGH_THRESHOLD)).toBe('high_strain')
  })

  it('returns high_strain boundary exactly 6000', () => {
    expect(classifyStrainWeek(1.9, 6000)).toBe('high_strain')
  })

  it('returns ok when monotony > 0 and below all thresholds', () => {
    expect(classifyStrainWeek(1.2, 3000)).toBe('ok')
  })

  it('returns ok when strain is null but monotony is positive and below 2.0', () => {
    expect(classifyStrainWeek(1.5, null)).toBe('ok')
  })
})

// ─── 2. computeStrainHistory ─────────────────────────────────────────────────
describe('computeStrainHistory', () => {
  it('returns [] for empty log', () => {
    expect(computeStrainHistory(LOG_ZERO, 8, TODAY)).toEqual([])
  })

  it('returns [] for log with 5 entries (< 7)', () => {
    expect(computeStrainHistory(LOG5, 8, TODAY)).toEqual([])
  })

  it('returns [] for log with 6 entries (< 7)', () => {
    expect(computeStrainHistory(LOG6, 8, TODAY)).toEqual([])
  })

  it('returns 8 entries for 70-day log', () => {
    const hist = computeStrainHistory(LOG70, 8, TODAY)
    expect(hist).toHaveLength(8)
  })

  it('each entry has isoWeek, monotony, strain, weekTSS, status fields', () => {
    const hist = computeStrainHistory(LOG70, 8, TODAY)
    for (const w of hist) {
      expect(w).toHaveProperty('isoWeek')
      expect(w).toHaveProperty('monotony')
      expect(w).toHaveProperty('strain')
      expect(w).toHaveProperty('weekTSS')
      expect(w).toHaveProperty('status')
    }
  })

  it('isoWeek format matches YYYY-Www', () => {
    const hist = computeStrainHistory(LOG70, 8, TODAY)
    const isoWeekRegex = /^\d{4}-W\d{2}$/
    for (const w of hist) {
      expect(w.isoWeek).toMatch(isoWeekRegex)
    }
  })

  it('entries are sorted oldest→newest', () => {
    const hist = computeStrainHistory(LOG70, 8, TODAY)
    for (let i = 1; i < hist.length; i++) {
      expect(hist[i].isoWeek >= hist[i - 1].isoWeek).toBe(true)
    }
  })

  it('monotony values are numeric or null (not NaN)', () => {
    const hist = computeStrainHistory(LOG70, 8, TODAY)
    for (const w of hist) {
      if (w.monotony !== null) {
        expect(typeof w.monotony).toBe('number')
        expect(Number.isNaN(w.monotony)).toBe(false)
      }
    }
  })

  it('status is one of the 4 valid strings', () => {
    const valid = new Set(['high_monotony', 'high_strain', 'ok', 'low_load'])
    const hist = computeStrainHistory(LOG70, 8, TODAY)
    for (const w of hist) {
      expect(valid.has(w.status)).toBe(true)
    }
  })

  it('weekTSS is a non-negative number', () => {
    const hist = computeStrainHistory(LOG70, 8, TODAY)
    for (const w of hist) {
      expect(typeof w.weekTSS).toBe('number')
      expect(w.weekTSS).toBeGreaterThanOrEqual(0)
    }
  })
})

// ─── 3. computeStrainReport ──────────────────────────────────────────────────
describe('computeStrainReport', () => {
  it('returns null for empty log', () => {
    expect(computeStrainReport([], 8, TODAY)).toBeNull()
  })

  it('returns null for log < 7 entries', () => {
    expect(computeStrainReport(LOG6, 8, TODAY)).toBeNull()
  })

  it('returns non-null report for sufficient log', () => {
    const report = computeStrainReport(LOG70, 8, TODAY)
    expect(report).not.toBeNull()
  })

  it('report has correct shape: weeks, maxMonotony, maxStrain, hasHighMonotony, hasHighStrain, citation', () => {
    const report = computeStrainReport(LOG70, 8, TODAY)
    expect(report).toHaveProperty('weeks')
    expect(report).toHaveProperty('maxMonotony')
    expect(report).toHaveProperty('maxStrain')
    expect(report).toHaveProperty('hasHighMonotony')
    expect(report).toHaveProperty('hasHighStrain')
    expect(report).toHaveProperty('citation')
  })

  it('weeks array has 8 entries', () => {
    const report = computeStrainReport(LOG70, 8, TODAY)
    expect(report.weeks).toHaveLength(8)
  })

  it('citation matches FOSTER_CITATION constant', () => {
    const report = computeStrainReport(LOG70, 8, TODAY)
    expect(report.citation).toBe(FOSTER_CITATION)
  })

  it('hasHighMonotony is boolean', () => {
    const report = computeStrainReport(LOG70, 8, TODAY)
    expect(typeof report.hasHighMonotony).toBe('boolean')
  })

  it('hasHighStrain is boolean', () => {
    const report = computeStrainReport(LOG70, 8, TODAY)
    expect(typeof report.hasHighStrain).toBe('boolean')
  })

  it('maxMonotony is null or a finite number', () => {
    const report = computeStrainReport(LOG70, 8, TODAY)
    if (report.maxMonotony !== null) {
      expect(Number.isFinite(report.maxMonotony)).toBe(true)
    }
  })

  it('FOSTER_CITATION contains expected reference text', () => {
    expect(FOSTER_CITATION).toContain('Foster 1998')
    expect(FOSTER_CITATION).toContain('Med Sci Sports Exerc')
  })
})
