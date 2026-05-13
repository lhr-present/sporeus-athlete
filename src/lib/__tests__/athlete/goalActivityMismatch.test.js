// v9.104.0 (Prompt DD) — tests for goal-vs-activity mismatch detection.

import { describe, it, expect } from 'vitest'
import { detectGoalActivityMismatch, categorizeLogEntry } from '../../athlete/goalActivityMismatch.js'

const TODAY = '2026-05-14'
function logEntry(date, sportOrType, asType = false) {
  return asType ? { date, type: sportOrType } : { date, sport: sportOrType }
}
function fillWindow(count, sportOrType, daysBack = 1) {
  const entries = []
  for (let i = 0; i < count; i++) {
    const d = new Date(TODAY + 'T12:00:00Z')
    d.setUTCDate(d.getUTCDate() - (daysBack + i))
    entries.push(logEntry(d.toISOString().slice(0, 10), sportOrType))
  }
  return entries
}

describe('categorizeLogEntry', () => {
  it('maps run-family strings to run bucket', () => {
    expect(categorizeLogEntry({ sport: 'Running' })).toBe('run')
    expect(categorizeLogEntry({ type: 'Tempo run' })).toBe('run')
    expect(categorizeLogEntry({ type: 'Intervals 6x800' })).toBe('run')
  })
  it('maps cycling family to bike', () => {
    expect(categorizeLogEntry({ sport: 'Cycling' })).toBe('bike')
    expect(categorizeLogEntry({ type: 'Ride 90min' })).toBe('bike')
    expect(categorizeLogEntry({ type: 'Bike commute' })).toBe('bike')
  })
  it('maps strength keywords to strength', () => {
    expect(categorizeLogEntry({ type: 'Strength' })).toBe('strength')
    expect(categorizeLogEntry({ type: 'Deadlift session' })).toBe('strength')
    expect(categorizeLogEntry({ sport: 'Weightlifting' })).toBe('strength')
  })
  it('maps swim and row distinctly', () => {
    expect(categorizeLogEntry({ sport: 'Swimming' })).toBe('swim')
    expect(categorizeLogEntry({ sport: 'Rowing' })).toBe('row')
    expect(categorizeLogEntry({ type: 'Erg 5k' })).toBe('row')
  })
  it('returns other for empty / unknown', () => {
    expect(categorizeLogEntry({})).toBe('other')
    expect(categorizeLogEntry({ type: 'something weird' })).toBe('other')
  })
  it('prefers sport over type', () => {
    expect(categorizeLogEntry({ sport: 'Cycling', type: 'Run' })).toBe('bike')
  })
})

describe('detectGoalActivityMismatch', () => {
  it('flags strength-dominant log when goal is running', () => {
    const profile = { primarySport: 'Running' }
    const log = fillWindow(10, 'Strength')
    const out = detectGoalActivityMismatch(profile, log, { today: TODAY })
    expect(out.mismatched).toBe(true)
    expect(out.goalSport).toBe('run')
    expect(out.dominantSport).toBe('strength')
    expect(out.dominantShare).toBeGreaterThanOrEqual(0.6)
    expect(out.recommendation.en).toMatch(/STRENGTH/)
  })

  it('does NOT flag when goal sport matches dominant logged sport', () => {
    const profile = { primarySport: 'Running' }
    const log = fillWindow(10, 'Running')
    const out = detectGoalActivityMismatch(profile, log, { today: TODAY })
    expect(out.mismatched).toBe(false)
    expect(out.dominantSport).toBe('run')
  })

  it('does NOT flag below minSessions threshold', () => {
    const profile = { primarySport: 'Running' }
    const log = fillWindow(3, 'Strength')  // < 6
    const out = detectGoalActivityMismatch(profile, log, { today: TODAY })
    expect(out.mismatched).toBe(false)
    expect(out.sessionsInWindow).toBe(3)
  })

  it('does NOT flag when goal sport share exceeds ceiling', () => {
    // 4 strength + 4 run + 2 strength = 6 strength, 4 run out of 10
    // strength dominance = 0.6 (at floor) but run share = 0.4 > ceiling
    const profile = { primarySport: 'Running' }
    const log = [
      ...fillWindow(6, 'Strength'),
      ...fillWindow(4, 'Running', 7),
    ]
    const out = detectGoalActivityMismatch(profile, log, { today: TODAY })
    expect(out.mismatched).toBe(false)
  })

  it('returns null goalSport for missing profile sport', () => {
    const out = detectGoalActivityMismatch({}, fillWindow(10, 'Strength'), { today: TODAY })
    expect(out.goalSport).toBeNull()
    expect(out.mismatched).toBe(false)
  })

  it('does not flag triathlon goal (multi-sport)', () => {
    const profile = { primarySport: 'Triathlon' }
    const log = fillWindow(10, 'Cycling')
    const out = detectGoalActivityMismatch(profile, log, { today: TODAY })
    expect(out.mismatched).toBe(false)
    expect(out.goalSport).toBeNull()
  })

  it('excludes entries outside the lookback window', () => {
    const profile = { primarySport: 'Running' }
    // 10 strength sessions but 60 days back — outside default 28d window
    const old = []
    for (let i = 0; i < 10; i++) {
      const d = new Date(TODAY + 'T12:00:00Z')
      d.setUTCDate(d.getUTCDate() - (60 + i))
      old.push(logEntry(d.toISOString().slice(0, 10), 'Strength'))
    }
    const out = detectGoalActivityMismatch(profile, old, { today: TODAY })
    expect(out.sessionsInWindow).toBe(0)
    expect(out.mismatched).toBe(false)
  })

  it('honors custom lookbackDays', () => {
    const profile = { primarySport: 'Running' }
    const log = []
    // 8 strength sessions 14 days back
    for (let i = 0; i < 8; i++) {
      const d = new Date(TODAY + 'T12:00:00Z')
      d.setUTCDate(d.getUTCDate() - (14 + i))
      log.push(logEntry(d.toISOString().slice(0, 10), 'Strength'))
    }
    const tight = detectGoalActivityMismatch(profile, log, { today: TODAY, lookbackDays: 10 })
    expect(tight.sessionsInWindow).toBe(0)
    const wide = detectGoalActivityMismatch(profile, log, { today: TODAY, lookbackDays: 60 })
    expect(wide.sessionsInWindow).toBe(8)
    expect(wide.mismatched).toBe(true)
  })

  it('tolerates malformed log entries', () => {
    const profile = { primarySport: 'Running' }
    const log = [
      ...fillWindow(7, 'Strength'),
      { date: null, sport: 'Strength' },
      { /* no fields */ },
      'not an object',
    ]
    const out = detectGoalActivityMismatch(profile, log, { today: TODAY })
    expect(out.mismatched).toBe(true)
    expect(out.sessionsInWindow).toBe(7)
  })
})
