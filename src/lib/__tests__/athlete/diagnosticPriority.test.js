// v9.110.0 (Prompt AAA) — diagnostic priority tests.

import { describe, it, expect } from 'vitest'
import { rankDiagnostics, getDiagnosticSeverity } from '../../athlete/diagnosticPriority.js'

describe('getDiagnosticSeverity', () => {
  it('returns null for empty/missing payloads', () => {
    expect(getDiagnosticSeverity('goal-mismatch', null)).toBeNull()
    expect(getDiagnosticSeverity('goal-mismatch', { mismatched: false })).toBeNull()
    expect(getDiagnosticSeverity('stale-plan', { stale: false })).toBeNull()
    expect(getDiagnosticSeverity('comeback', { isComeback: false })).toBeNull()
  })

  it('goal-mismatch is critical when mismatched', () => {
    expect(getDiagnosticSeverity('goal-mismatch', { mismatched: true })).toBe('critical')
  })

  it('stale-plan reason=both is critical', () => {
    expect(getDiagnosticSeverity('stale-plan', { stale: true, reason: 'both' })).toBe('critical')
  })

  it('stale-plan reason=age or ctl alone is warning', () => {
    expect(getDiagnosticSeverity('stale-plan', { stale: true, reason: 'age' })).toBe('warning')
    expect(getDiagnosticSeverity('stale-plan', { stale: true, reason: 'ctl' })).toBe('warning')
  })

  it('plan-drift action=regenerate is critical', () => {
    expect(getDiagnosticSeverity('plan-drift', { action: 'regenerate' })).toBe('critical')
  })

  it('plan-drift action=reduce-next / monitor-fatigue are warning', () => {
    expect(getDiagnosticSeverity('plan-drift', { action: 'reduce-next' })).toBe('warning')
    expect(getDiagnosticSeverity('plan-drift', { action: 'monitor-fatigue' })).toBe('warning')
  })

  it('plan-drift action=continue is suppressed (null)', () => {
    expect(getDiagnosticSeverity('plan-drift', { action: 'continue' })).toBeNull()
  })

  it('plan-drift status=pending is suppressed (null)', () => {
    expect(getDiagnosticSeverity('plan-drift', { status: 'pending', action: 'continue' })).toBeNull()
  })

  it('comeback isComeback=true is warning', () => {
    expect(getDiagnosticSeverity('comeback', { isComeback: true })).toBe('warning')
  })

  it('unknown key returns null', () => {
    expect(getDiagnosticSeverity('unknown', { foo: 'bar' })).toBeNull()
  })
})

describe('rankDiagnostics', () => {
  it('returns empty for empty input', () => {
    expect(rankDiagnostics([])).toEqual({ top: null, rest: [] })
    expect(rankDiagnostics(null)).toEqual({ top: null, rest: [] })
  })

  it('returns top=null when all diagnostics are unflagged', () => {
    const out = rankDiagnostics([
      { key: 'goal-mismatch', payload: { mismatched: false } },
      { key: 'stale-plan',    payload: { stale: false } },
    ])
    expect(out.top).toBeNull()
    expect(out.rest).toEqual([])
  })

  it('returns the single diagnostic when only one fires', () => {
    const out = rankDiagnostics([
      { key: 'comeback', payload: { isComeback: true, gapDays: 30 } },
      { key: 'goal-mismatch', payload: { mismatched: false } },
    ])
    expect(out.top.key).toBe('comeback')
    expect(out.top.severity).toBe('warning')
    expect(out.rest).toEqual([])
  })

  it('critical beats warning regardless of order', () => {
    const out = rankDiagnostics([
      { key: 'comeback',      payload: { isComeback: true } },
      { key: 'goal-mismatch', payload: { mismatched: true } },
    ])
    expect(out.top.key).toBe('goal-mismatch')
    expect(out.rest.map(r => r.key)).toEqual(['comeback'])
  })

  it('within same severity, canonical order wins (mismatch > stale)', () => {
    const out = rankDiagnostics([
      { key: 'stale-plan',    payload: { stale: true, reason: 'both' } },
      { key: 'goal-mismatch', payload: { mismatched: true } },
    ])
    expect(out.top.key).toBe('goal-mismatch')
    expect(out.rest[0].key).toBe('stale-plan')
  })

  it('all 4 detectors firing — top=goal-mismatch (critical) + rest sorted', () => {
    const out = rankDiagnostics([
      { key: 'comeback',      payload: { isComeback: true } },
      { key: 'plan-drift',    payload: { action: 'regenerate' } },
      { key: 'stale-plan',    payload: { stale: true, reason: 'ctl' } },
      { key: 'goal-mismatch', payload: { mismatched: true } },
    ])
    expect(out.top.key).toBe('goal-mismatch')
    // rest sorted: plan-drift (critical) > stale-plan (warning) > comeback (warning, canonical-later)
    expect(out.rest.map(r => r.key)).toEqual(['plan-drift', 'stale-plan', 'comeback'])
  })

  it('suppresses info-tier (plan-drift action=continue) entirely', () => {
    const out = rankDiagnostics([
      { key: 'plan-drift', payload: { action: 'continue' } },
      { key: 'comeback',   payload: { isComeback: true } },
    ])
    expect(out.top.key).toBe('comeback')
    expect(out.rest).toEqual([])  // continue should NOT show up
  })

  it('skips null / malformed entries', () => {
    const out = rankDiagnostics([
      null,
      { key: 'goal-mismatch' /* no payload */ },
      { /* no key */ payload: { mismatched: true } },
      { key: 'comeback', payload: { isComeback: true } },
    ])
    expect(out.top.key).toBe('comeback')
  })

  it('two critical entries — canonical tie-break (goal-mismatch wins over plan-drift)', () => {
    const out = rankDiagnostics([
      { key: 'plan-drift',    payload: { action: 'regenerate' } },
      { key: 'goal-mismatch', payload: { mismatched: true } },
    ])
    expect(out.top.key).toBe('goal-mismatch')
    expect(out.top.severity).toBe('critical')
    expect(out.rest[0].key).toBe('plan-drift')
    expect(out.rest[0].severity).toBe('critical')
  })
})
