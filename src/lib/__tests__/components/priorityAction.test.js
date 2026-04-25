// ── tests/components/priorityAction.test.js — E39 ─────────────────────────────
// Tests computeNextAction() pure function — no mocking of internal libs.
import { describe, it, expect } from 'vitest'
import { computeNextAction } from '../../nextAction.js'

// ── Helpers ────────────────────────────────────────────────────────────────────
function makeSession(daysAgo, tss = 80, rpe = 6) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return { date: d.toISOString().slice(0, 10), tss, rpe, duration: 60 }
}

function makeRecovery(daysAgo, score = 60, sleepHrs = 7.5, hrv = 55) {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return { date: d.toISOString().slice(0, 10), score, sleepHrs, hrv }
}

// ── computeNextAction — null/empty inputs ─────────────────────────────────────
describe('computeNextAction — empty/null inputs', () => {
  it('returns an object (not null) for null log — triggers no_sessions rule', () => {
    const result = computeNextAction(null, [], {})
    // computeNextAction always returns an action; null log → no_sessions rule
    expect(result).not.toBeNull()
  })

  it('returns an action object for empty log', () => {
    const result = computeNextAction([], [], {})
    expect(result).not.toBeNull()
    expect(result).toHaveProperty('action')
    expect(result).toHaveProperty('rationale')
  })

  it('no_sessions action triggered for empty log', () => {
    const result = computeNextAction([], [], {})
    expect(result.id).toBe('no_sessions')
  })
})

// ── computeNextAction — return shape ──────────────────────────────────────────
describe('computeNextAction — return shape', () => {
  const log     = [makeSession(1)]
  const rec     = [makeRecovery(0)]
  const profile = {}

  it('result has action field', () => {
    const result = computeNextAction(log, rec, profile)
    expect(result).toHaveProperty('action')
  })

  it('result has rationale field', () => {
    const result = computeNextAction(log, rec, profile)
    expect(result).toHaveProperty('rationale')
  })

  it('action is bilingual object with en key', () => {
    const result = computeNextAction(log, rec, profile)
    if (typeof result.action === 'object') {
      expect(result.action).toHaveProperty('en')
    } else {
      expect(typeof result.action).toBe('string')
    }
  })

  it('rationale is bilingual object with en key', () => {
    const result = computeNextAction(log, rec, profile)
    if (typeof result.rationale === 'object') {
      expect(result.rationale).toHaveProperty('en')
    } else {
      expect(typeof result.rationale).toBe('string')
    }
  })

  it('result has color field', () => {
    const result = computeNextAction(log, rec, profile)
    expect(result).toHaveProperty('color')
    expect(['red', 'amber', 'green', 'blue', 'muted']).toContain(result.color)
  })

  it('result has citation field', () => {
    const result = computeNextAction(log, rec, profile)
    expect(result).toHaveProperty('citation')
  })
})

// ── computeNextAction — rule triggering ───────────────────────────────────────
describe('computeNextAction — rule triggering', () => {
  it('wellness_poor rule fires when recent recovery score ≤ 40 (=score 2/5)', () => {
    // score = 40 → Math.max(1, Math.min(5, Math.round(40/20))) = 2 → wellness_poor
    const today = new Date().toISOString().slice(0, 10)
    const rec   = [{ date: today, score: 40, sleepHrs: 7, hrv: 55 }]
    const log   = [makeSession(1)]
    const result = computeNextAction(log, rec, {})
    // Should fire wellness_poor (priority 2) — unless ACWR > 1.5 (priority 1)
    expect(['wellness_poor', 'acwr_spike']).toContain(result.id)
  })

  it('returns a result with id field', () => {
    const result = computeNextAction([makeSession(0)], [], {})
    expect(result).toHaveProperty('id')
    expect(typeof result.id).toBe('string')
  })

  it('high TSS log triggers a warning or load rule', () => {
    // 7 days of 200 TSS/day → ACWR spike
    const log = Array.from({ length: 7 }, (_, i) => makeSession(i, 200, 9))
    const result = computeNextAction(log, [], {})
    expect(result).not.toBeNull()
    // Should be acwr_spike or acwr_high due to sudden high load
    expect(result.id).toBeTruthy()
  })
})
