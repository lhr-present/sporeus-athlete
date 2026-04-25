// ─── injuryForecast.test.js — 12+ tests ──────────────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  riskBand,
  injuryRiskHistory,
  projectInjuryRisk,
  computeInjuryForecast,
  INJURY_RISK_CITATION,
} from '../../athlete/injuryForecast.js'

// ─── Synthetic log generator ─────────────────────────────────────────────────
/**
 * Generate `count` log entries spread over the last `count` days ending on `today`.
 */
function makeLog(count = 60, today = '2026-04-25') {
  const log = []
  const base = new Date(today + 'T00:00:00')
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(base)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().slice(0, 10)
    log.push({
      date: dateStr,
      tss: 40 + Math.round(Math.random() * 40),   // 40–80
      rpe: 6 + (i % 3),                            // 6–8
      type: 'run',
      duration: 60,
    })
  }
  return log
}

const TODAY = '2026-04-25'
const LOG60 = makeLog(60, TODAY)
const LOG4  = makeLog(4, TODAY)
const LOG6  = makeLog(6, TODAY)

// ─── 1. riskBand ─────────────────────────────────────────────────────────────
describe('riskBand', () => {
  it('returns low for score 0', () => {
    expect(riskBand(0)).toBe('low')
  })

  it('returns low at boundary 30', () => {
    expect(riskBand(30)).toBe('low')
  })

  it('returns moderate at boundary 31', () => {
    expect(riskBand(31)).toBe('moderate')
  })

  it('returns moderate at boundary 60', () => {
    expect(riskBand(60)).toBe('moderate')
  })

  it('returns high at boundary 61', () => {
    expect(riskBand(61)).toBe('high')
  })

  it('returns high for score 100', () => {
    expect(riskBand(100)).toBe('high')
  })
})

// ─── 2. injuryRiskHistory ────────────────────────────────────────────────────
describe('injuryRiskHistory', () => {
  it('returns [] for empty log', () => {
    expect(injuryRiskHistory([], [], 8, TODAY)).toEqual([])
  })

  it('returns [] for log < 7 days', () => {
    expect(injuryRiskHistory(LOG6, [], 8, TODAY)).toEqual([])
  })

  it('returns array of correct length for sufficient log', () => {
    const result = injuryRiskHistory(LOG60, [], 8, TODAY)
    expect(result).toHaveLength(8)
  })

  it('each entry has isoWeek, score, band', () => {
    const result = injuryRiskHistory(LOG60, [], 8, TODAY)
    for (const entry of result) {
      expect(entry).toHaveProperty('isoWeek')
      expect(entry).toHaveProperty('score')
      expect(entry).toHaveProperty('band')
    }
  })

  it('isoWeek strings are in YYYY-Www format', () => {
    const result = injuryRiskHistory(LOG60, [], 8, TODAY)
    const isoWeekPattern = /^\d{4}-W\d{2}$/
    for (const entry of result) {
      expect(entry.isoWeek).toMatch(isoWeekPattern)
    }
  })

  it('entries are sorted oldest to newest', () => {
    const result = injuryRiskHistory(LOG60, [], 8, TODAY)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].isoWeek >= result[i - 1].isoWeek).toBe(true)
    }
  })

  it('band values are valid strings', () => {
    const result = injuryRiskHistory(LOG60, [], 8, TODAY)
    const validBands = new Set(['low', 'moderate', 'high'])
    for (const entry of result) {
      expect(validBands.has(entry.band)).toBe(true)
    }
  })

  it('scores are numbers in range 0–100', () => {
    const result = injuryRiskHistory(LOG60, [], 8, TODAY)
    for (const entry of result) {
      expect(typeof entry.score).toBe('number')
      expect(entry.score).toBeGreaterThanOrEqual(0)
      expect(entry.score).toBeLessThanOrEqual(100)
    }
  })
})

// ─── 3. projectInjuryRisk ────────────────────────────────────────────────────
describe('projectInjuryRisk', () => {
  it('returns [] for log < 14 days', () => {
    expect(projectInjuryRisk(LOG6, [], 4, TODAY)).toEqual([])
  })

  it('returns [] for log of exactly 4 entries', () => {
    expect(projectInjuryRisk(LOG4, [], 4, TODAY)).toEqual([])
  })

  it('returns 4 projected entries for sufficient log', () => {
    const result = projectInjuryRisk(LOG60, [], 4, TODAY)
    expect(result).toHaveLength(4)
  })

  it('all entries have projected: true', () => {
    const result = projectInjuryRisk(LOG60, [], 4, TODAY)
    for (const entry of result) {
      expect(entry.projected).toBe(true)
    }
  })

  it('each projected entry has isoWeek, score, band, projected', () => {
    const result = projectInjuryRisk(LOG60, [], 4, TODAY)
    for (const entry of result) {
      expect(entry).toHaveProperty('isoWeek')
      expect(entry).toHaveProperty('score')
      expect(entry).toHaveProperty('band')
      expect(entry).toHaveProperty('projected')
    }
  })

  it('isoWeek strings in YYYY-Www format for projected entries', () => {
    const result = projectInjuryRisk(LOG60, [], 4, TODAY)
    const isoWeekPattern = /^\d{4}-W\d{2}$/
    for (const entry of result) {
      expect(entry.isoWeek).toMatch(isoWeekPattern)
    }
  })
})

// ─── 4. computeInjuryForecast ────────────────────────────────────────────────
describe('computeInjuryForecast', () => {
  it('returns null for log < 7 entries', () => {
    expect(computeInjuryForecast(LOG6, [], TODAY)).toBeNull()
  })

  it('returns null for empty log', () => {
    expect(computeInjuryForecast([], [], TODAY)).toBeNull()
  })

  it('returns object with history, forecast, topFactor, citation for sufficient log', () => {
    const result = computeInjuryForecast(LOG60, [], TODAY)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('history')
    expect(result).toHaveProperty('forecast')
    expect(result).toHaveProperty('topFactor')
    expect(result).toHaveProperty('citation')
  })

  it('citation matches INJURY_RISK_CITATION constant', () => {
    const result = computeInjuryForecast(LOG60, [], TODAY)
    expect(result.citation).toBe(INJURY_RISK_CITATION)
  })

  it('history has length 8', () => {
    const result = computeInjuryForecast(LOG60, [], TODAY)
    expect(result.history).toHaveLength(8)
  })

  it('forecast has length 4 for log ≥ 14 days', () => {
    const result = computeInjuryForecast(LOG60, [], TODAY)
    expect(result.forecast).toHaveLength(4)
  })

  it('topFactor is null or has label and severity', () => {
    const result = computeInjuryForecast(LOG60, [], TODAY)
    if (result.topFactor !== null && result.topFactor !== undefined) {
      expect(result.topFactor).toHaveProperty('label')
      expect(result.topFactor).toHaveProperty('severity')
    }
  })
})
