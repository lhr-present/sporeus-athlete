// ─── athleteStatusSummary.test.js — E49: 22 tests ────────────────────────────
import { describe, it, expect } from 'vitest'
import {
  buildSelfAthleteShape,
  computeAthleteStatus,
} from '../../athlete/athleteStatusSummary.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Use relative dates so entries fall inside calculateACWR's 28-day window.
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function makeLog(count = 10, tss = 60) {
  return Array.from({ length: count }, (_, i) => ({
    date: daysAgo(i * 2),   // every 2 days within the last 20 days
    tss,
    type: 'run',
    duration: 45,
  }))
}

function makeRecovery(count = 3) {
  return Array.from({ length: count }, (_, i) => ({
    date: daysAgo(i * 2),
    hrv: 60 + i,
  }))
}

const LOG_10   = makeLog(10)
const LOG_4    = makeLog(4)   // below threshold of 5
const RECOVERY = makeRecovery(3)
const PROFILE  = { name: 'TestAthlete' }

// ─── 1. buildSelfAthleteShape ─────────────────────────────────────────────────
describe('buildSelfAthleteShape', () => {
  it('returns an object without crashing on empty log', () => {
    const result = buildSelfAthleteShape([], [], {})
    expect(result).toBeDefined()
    expect(result).toHaveProperty('display_name')
    expect(result).toHaveProperty('today_ctl')
    expect(result).toHaveProperty('today_tsb')
    expect(result).toHaveProperty('acwr_ratio')
    expect(result).toHaveProperty('training_status')
  })

  it('uses profile name when provided', () => {
    const result = buildSelfAthleteShape(LOG_10, [], { name: 'Huseyin' })
    expect(result.display_name).toBe('Huseyin')
  })

  it('falls back to "Athlete" when no name in profile', () => {
    const result = buildSelfAthleteShape(LOG_10, [], {})
    expect(result.display_name).toBe('Athlete')
  })

  it('computes non-null CTL for a log with entries', () => {
    const result = buildSelfAthleteShape(LOG_10, [], {})
    expect(typeof result.today_ctl).toBe('number')
    expect(result.today_ctl).toBeGreaterThanOrEqual(0)
  })

  it('extracts last_hrv_score from recovery', () => {
    const result = buildSelfAthleteShape(LOG_10, RECOVERY, {})
    expect(result.last_hrv_score).toBeGreaterThan(0)
  })

  it('last_hrv_score is null when no recovery data', () => {
    const result = buildSelfAthleteShape(LOG_10, [], {})
    expect(result.last_hrv_score).toBeNull()
  })

  it('returns _log set to the provided log', () => {
    const result = buildSelfAthleteShape(LOG_10, [], {})
    expect(result._log).toBe(LOG_10)
  })

  it('training_status is a known value', () => {
    const result = buildSelfAthleteShape(LOG_10, [], {})
    const known = ['Recovering', 'Maintaining', 'Building', 'Peaking']
    expect(known).toContain(result.training_status)
  })
})

// ─── 2. computeAthleteStatus ──────────────────────────────────────────────────
describe('computeAthleteStatus', () => {
  it('returns null for null log', () => {
    expect(computeAthleteStatus(null, [], {})).toBeNull()
  })

  it('returns null for empty log', () => {
    expect(computeAthleteStatus([], [], {})).toBeNull()
  })

  it('returns null for log with fewer than 5 entries', () => {
    expect(computeAthleteStatus(LOG_4, [], {})).toBeNull()
  })

  it('returns full result shape for valid log', () => {
    const result = computeAthleteStatus(LOG_10, RECOVERY, PROFILE)
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('ctl')
    expect(result).toHaveProperty('tsb')
    expect(result).toHaveProperty('ctlTrendStr')
    expect(result).toHaveProperty('acwrLabel')
    expect(result).toHaveProperty('acwrRatio')
    expect(result).toHaveProperty('overallTrend')
    expect(result).toHaveProperty('trainingStatus')
    expect(result).toHaveProperty('digestLine')
    expect(result).toHaveProperty('dataPoints')
  })

  it('dataPoints equals log length', () => {
    const result = computeAthleteStatus(LOG_10, [], {})
    expect(result.dataPoints).toBe(10)
  })

  it('ctlTrendStr is a non-empty string', () => {
    const result = computeAthleteStatus(LOG_10, [], {})
    expect(typeof result.ctlTrendStr).toBe('string')
    expect(result.ctlTrendStr.length).toBeGreaterThan(0)
  })

  it('digestLine is a non-empty string', () => {
    const result = computeAthleteStatus(LOG_10, [], {})
    expect(typeof result.digestLine).toBe('string')
    expect(result.digestLine.length).toBeGreaterThan(0)
  })

  it('works without recovery data', () => {
    const result = computeAthleteStatus(LOG_10, null, {})
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('ctl')
  })

  it('works without profile data', () => {
    const result = computeAthleteStatus(LOG_10, [], null)
    expect(result).not.toBeNull()
  })

  it('acwrRatio is a finite number', () => {
    const result = computeAthleteStatus(LOG_10, [], {})
    expect(Number.isFinite(result.acwrRatio)).toBe(true)
  })
})
